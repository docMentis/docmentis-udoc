import { UDocEditor, UDocError } from "@docmentis/udoc-editor";
import type { UDocBase, UDocEditorOptions, WasmLocateOptions } from "@docmentis/udoc-editor";
import { UDocViewer } from "@docmentis/udoc-viewer";
import { h } from "../dom.js";
import type { Theme } from "../theme.js";
import type { Mode, OpenDoc } from "../types.js";
import { aiPanel } from "./AiPanel.js";

/** This page's name in a collaboration it joins with one editor — one per page load, so two browsers tell apart. */
const GUEST_NAME = `Guest ${Math.floor(100 + Math.random() * 900)}`;

/**
 * Where the engine is. A build leaves it out (see `vite.config.ts`) for its
 * host to serve beside it, at `udoc-wasm/` laid out as `@docmentis/udoc-wasm`'s
 * `dist/`, else it loads from jsDelivr; dev serves the installed engine.
 */
const ENGINE: WasmLocateOptions = import.meta.env.PROD ? { baseUrl: "./udoc-wasm/" } : {};

/**
 * The stage: everything to the right of the sidebar. Owns the editor host(s)
 * and rebuilds the body whenever the mode or open document changes — one
 * viewer for View, one editor for Edit, two synced editors for Co-edit, and for
 * Co-edit with AI the user's editor beside the AI panel (coming soon). Hosts
 * are always framed with the viewer-demo padding + shadow (square corners).
 */
export class Stage {
    readonly el: HTMLElement;
    #mode: Mode | null = null;
    #doc: OpenDoc | null = null;
    #editors: UDocBase[] = [];
    #teardownSync: (() => void) | null = null;
    #gen = 0;
    #theme: Theme;
    /** The options the Options dialog set, on top of each mode's own. */
    #options: UDocEditorOptions = { showDeveloperButton: true, enablePointerSharing: true, wasm: ENGINE };

    constructor(
        private readonly onError: (message: string) => void,
        initialTheme: Theme,
    ) {
        this.#theme = initialTheme;
        this.el = h("div", { class: "stage" });
    }

    /** Apply the demo theme to every live editor (and remember it for rebuilds). */
    setTheme(theme: Theme): void {
        this.#theme = theme;
        this.#editors.forEach((ed) => ed.setTheme(theme));
    }

    /**
     * Set editor options, remembered for rebuilds. One the editor has a setter
     * for is applied to the live editors by `apply`; any other is read only at
     * create, so the editors are rebuilt on the open document.
     */
    async setOptions(options: UDocEditorOptions, apply?: (editor: UDocBase) => void): Promise<void> {
        this.#options = { ...this.#options, ...options };
        if (apply) this.#editors.forEach(apply);
        else await this.#rebuild();
    }

    get mode(): Mode | null {
        return this.#mode;
    }

    get docName(): string | null {
        return this.#doc?.name ?? null;
    }

    /** Switch mode, rebuilding the editor hosts (no-op if already in `mode`). */
    async setMode(mode: Mode): Promise<void> {
        if (this.#mode === mode) return;
        this.#mode = mode;
        await this.#rebuild();
    }

    /**
     * Open a document and remember it for rebuilds. Switching from one document
     * to another rebuilds the editor host(s) from scratch — a fresh editor per
     * document, so no engine or view state leaks across documents. The first
     * open reuses the editor `setMode` just built (no document loaded yet), so
     * boot doesn't spin up a second worker.
     */
    async openDoc(doc: OpenDoc): Promise<void> {
        const switching = this.#doc !== null;
        this.#doc = doc;
        if (switching) {
            await this.#rebuild();
        } else {
            const editors = this.#editors;
            const service = await this.#openIn(editors, doc);
            if (this.#editors === editors) this.#syncEditors(editors, doc, service);
        }
    }

    async #rebuild(): Promise<void> {
        const gen = ++this.#gen;
        this.#teardownEditors();

        // Single-host modes that fill the stage on their own (Edit, View); the
        // others pair the host with a second pane (the AI panel, a co-edit host).
        const isSplit = this.#mode === "ai" || this.#mode === "coedit";
        // hosts[0] is always the user's editor; Co-edit adds a second.
        const hosts: HTMLElement[] = [];
        const body = h("div", { class: isSplit ? "stage-split" : "stage-single" });

        const visibleHostCount = this.#mode === "coedit" ? 2 : 1;
        for (let i = 0; i < visibleHostCount; i++) {
            const host = h("div", { class: "editor-host" });
            hosts.push(host);
            body.appendChild(h("div", { class: "editor-pane" }, host));
        }
        if (this.#mode === "ai") body.appendChild(aiPanel());

        this.el.replaceChildren(body);

        const options = this.#options;
        const create = (host: HTMLElement): Promise<UDocBase> =>
            this.#mode === "view" ? UDocViewer.create(host, options) : UDocEditor.create(host, options);

        let editors: UDocBase[];
        try {
            editors = await Promise.all(hosts.map(create));
        } catch (err) {
            if (gen !== this.#gen) return;
            const what = this.#mode === "view" ? "viewer" : "editor";
            console.error(`udoc: failed to start the ${what}`, err);
            this.onError(
                err instanceof UDocError && err.code === "unsupported"
                    ? `This browser is unsupported. The udoc ${what} needs OffscreenCanvas (Safari 16.4+, or a current Chrome/Firefox).`
                    : import.meta.env.DEV
                      ? "Failed to load the udoc WASM engine. Run `npm install` — and `just build-wasm` in a linked engine checkout — then reload."
                      : `The ${what} couldn't load. Reload the page to try again.`,
            );
            return;
        }

        // A newer rebuild superseded us mid-create — discard what we built.
        if (gen !== this.#gen) {
            editors.forEach((ed) => ed.destroy());
            return;
        }

        this.#editors = editors;
        editors.forEach((ed) => ed.setTheme(this.#theme));
        const doc = this.#doc;
        const service = doc ? await this.#openIn(editors, doc) : undefined;
        if (gen !== this.#gen) return;
        this.#syncEditors(editors, doc, service);
    }

    /**
     * Open `doc` in `editors`, from its bytes or from the server that keeps
     * it. The two editors of Co-edit open a document of their own bytes
     * through a local collaboration service instead — each opening the bytes
     * itself would mint ids of its own — and this resolves with its id.
     */
    async #openIn(editors: UDocBase[], doc: OpenDoc): Promise<string | undefined> {
        if ("remote" in doc) {
            await Promise.all(editors.map((ed) => ed.openRemote(doc.remote))).catch(openFailed);
            return undefined;
        }
        if (this.#mode !== "coedit") {
            await Promise.all(editors.map((ed) => ed.open(doc.bytes, { filename: doc.name }))).catch(openFailed);
            return undefined;
        }
        let service: string;
        try {
            service = await UDocEditor.startLocalCollaborationService(doc.bytes, { filename: doc.name, wasm: ENGINE });
        } catch (err) {
            console.error("udoc: failed to start a local collaboration service", err);
            this.onError(`Co-edit could not start: ${(err as Error).message}`);
            return undefined;
        }
        await Promise.all(editors.map((ed) => ed.openLocal(service))).catch(openFailed);
        return service;
    }

    /**
     * Join `editors`, just opened on `doc`, to its collaboration, each named
     * (see `namesOf`) so the others flag its selection with a readable label:
     * the one a server keeps for a document it keeps — as every editor open on
     * it anywhere joins — or that of the local collaboration service they
     * opened it from.
     */
    #syncEditors(editors: UDocBase[], doc: OpenDoc | null, service: string | undefined): void {
        this.#teardownSync?.();
        this.#teardownSync = null;
        let join: ((ed: UDocBase, name: string) => void) | undefined;
        if (doc && "collaboration" in doc) join = (ed, name) => ed.joinRemoteCollaboration(doc.collaboration, name);
        else if (service !== undefined) join = (ed, name) => ed.joinLocalCollaboration(service, name);
        if (!join) return;
        const names = namesOf(this.#mode);
        const offs = editors.flatMap((ed, i) => {
            const name = names[i]!;
            const listening = [
                ed.on("collaboration:joined", () => console.info(`udoc: ${name} joined the collaboration`)),
                ed.on("collaboration:interrupted", ({ code, reason }) =>
                    console.warn(`udoc: ${name}'s collaboration was interrupted (${reason || code}); rejoining`),
                ),
                ed.on("collaboration:failed", ({ code, reason }) =>
                    this.onError(`The collaboration failed: ${reason || `the connection closed (${code})`}`),
                ),
            ];
            join(ed, name);
            return listening;
        });
        this.#teardownSync = () => {
            offs.forEach((off) => off());
            editors.forEach((ed) => ed.leaveCollaboration());
        };
    }

    #teardownEditors(): void {
        this.#teardownSync?.();
        this.#teardownSync = null;
        this.#editors.forEach((ed) => ed.destroy());
        this.#editors = [];
    }
}

/** Each editor's name in `mode`, in the order the stage builds them: the user's first. */
function namesOf(mode: Mode | null): string[] {
    if (mode === "coedit") return ["Alex", "Robin"];
    return [GUEST_NAME];
}

/** A document that didn't open: the editor shows why itself, so the stage only logs it. */
function openFailed(err: unknown): void {
    console.error("udoc: the document didn't open", err);
}
