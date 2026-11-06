import { UDocBase } from "@docmentis/udoc-ui";
import type { LocalCollaborationServiceOptions, UDocEvents, UDocOptions } from "@docmentis/udoc-ui";
import { createAs, startLocalCollaborationService, subscribeSelector } from "@docmentis/udoc-ui/internal";
import type { UIShell, Wrapper } from "@docmentis/udoc-ui/internal";
import { editMode } from "./edit-mode.js";
import type { EditMode } from "./edit-mode.js";
import type { Messages } from "./i18n/index.js";
import type { EditorMode } from "./mode.js";
import { WRAPPER_VERSION } from "./version.js";
import { startRenderWorker } from "./worker/worker-source.js";

/** This package, as the wrapper it reports to the engine. */
const EDITOR_WRAPPER: Wrapper = { name: "udoc-editor", version: WRAPPER_VERSION };

/** Options for {@link UDocEditor.create}: the common ones, and edit mode's. Every field is optional; each says its default. */
export interface UDocEditorOptions extends UDocOptions {
    /** Strings that replace the built-in ones, by key — the host's own wording,
     *  or a language the editor doesn't ship. Default none. */
    translations?: Partial<Messages>;
    /** The mode the editor opens in. Default `"edit"`. */
    initialMode?: EditorMode;
    /** The modes the user may switch between. Default every mode. */
    allowedModes?: readonly EditorMode[];
    /** Show the mode switcher. Default `true` when more than one mode is allowed. */
    showModeSwitch?: boolean;
    /** Show edit mode's per-page controls — the page-control rail
     *  (`udoc:page-actions`) and the insert-between-pages affordance
     *  (`udoc:page-insert`) — with the wider page spacing they sit in. Default
     *  `false`: a PDF's Page tab and thumbnails do the same work. */
    showPageControls?: boolean;
    /** Show the page ruler on paged documents. Default `true`;
     *  {@link UDocEditor.setShowRuler} changes it. */
    showRuler?: boolean;
}

/** The editor's event map: the common events, and edit mode's. Subscribe with {@link UDocEditor.on}. */
export interface UDocEditorEvents extends UDocEvents {
    /** Fires when the editor mode changes (via {@link UDocEditor.setMode} or the mode switcher). */
    "mode:changed": { mode: EditorMode; previousMode: EditorMode };
}

/**
 * The document editor — construct it with {@link UDocEditor.create} and drive
 * it with `open` / `close` / `destroy`.
 */
export class UDocEditor extends UDocBase<UDocEditorEvents> {
    /** This package's version, from its `package.json`. */
    static readonly version: string = WRAPPER_VERSION;

    readonly #unsubscribeMode: () => void;
    readonly #editMode: EditMode;

    private constructor(shell: UIShell, editMode: EditMode) {
        super(shell);
        this.#editMode = editMode;
        this.#unsubscribeMode = subscribeSelector(
            shell.store,
            // The shell's mode is view or edit mode's own.
            (s) => s.mode as EditorMode,
            (mode, previousMode) => this.emit("mode:changed", { mode, previousMode }),
        );
    }

    /**
     * Create an editor mounted into `container`. Spawns the render worker and loads
     * the WASM (async), then mounts the UI. Rejects with an `unsupported`
     * `UDocError` on runtimes without OffscreenCanvas-in-worker support.
     *
     * With `null` for `container` the editor is headless: it puts nothing on
     * the page, and you drive it by its calls alone, to change, render, export
     * and save documents in the browser. Nothing it does waits on a person:
     * `open` and `print` say what they do in place of asking.
     */
    static create(container: HTMLElement | null, options: UDocEditorOptions = {}): Promise<UDocEditor> {
        return createAs(
            container,
            options,
            EDITOR_WRAPPER,
            startRenderWorker,
            () => editMode(options),
            (shell, mode) => new UDocEditor(shell, mode),
        );
    }

    /**
     * Start a local collaboration service on the document in `bytes`, and
     * resolve with its id — the page's own udoc server for one document, for
     * editors in this page to {@link openLocal} and
     * {@link joinLocalCollaboration}.
     *
     * Editors that each {@link open} the same bytes can't collaborate: a
     * document's ids are minted as its parts load, so two editors that load
     * them in a different order hold different ids for the same content. The
     * service imports the document once, in a worker of its own, and keeps its
     * udoc package, which every editor opening it shares; then it serves their
     * collaboration, as udoc-server serves one for a document it keeps. It ends
     * when the last editor joined to it leaves.
     *
     * Its session is started as an editor's is, under `options`: it rejects
     * when the license refuses it.
     */
    static startLocalCollaborationService(
        bytes: Uint8Array,
        options: LocalCollaborationServiceOptions = {},
    ): Promise<string> {
        return startLocalCollaborationService(bytes, options, EDITOR_WRAPPER);
    }

    /**
     * Insert the image file `bytes` as a picture on the current slide or PDF
     * page, centred and scaled down to fit, then selected — what the Image
     * button of a deck's Insert tab or a PDF's Page tab does with the file it asks
     * for. `contentType` is the file's MIME type (`image/png`, …); an empty one is
     * read from the bytes' own signature, which a PDF always reads. One
     * committing edit (one undo step). The image never enters the CRDT: it
     * reaches a peer through {@link opaquePartsSince}. Rejects for a document
     * that's neither a presentation nor a PDF, or bytes no codec reads.
     */
    insertImage(bytes: Uint8Array, contentType: string): Promise<void> {
        return this.#editMode.insertImage(bytes, contentType);
    }

    /**
     * Show or hide the page ruler on paged documents (PDF / DOCX / PPTX). A
     * user preference; the ruler is additionally hidden automatically in
     * `"view"` mode (a reading pose needs no measurement chrome). A spreadsheet's
     * row/column headers are essential and never affected.
     */
    setShowRuler(visible: boolean): void {
        this.#editMode.setShowRuler(visible);
    }

    /** The current editor mode; `"mode:changed"` fires when it changes. */
    get mode(): EditorMode {
        return this.#editMode.currentMode();
    }

    /**
     * Switch the editor mode. Ignored if `mode` isn't in the configured
     * `allowedModes`. Drives the toolbar's command set and pointer behavior.
     */
    setMode(mode: EditorMode): void {
        this.#editMode.setMode(mode);
    }

    /** Tear down components, listeners, and the render worker. */
    override destroy(): void {
        this.#unsubscribeMode();
        super.destroy();
    }
}
