// The host's page annotations — `@docmentis/udoc-viewer` 0.7's annotation calls
// and events, over the engine's own `Annotation`, as `udoc.d.ts` declares it.
//
// The calls are legacy's: a page by its 0-based index, an annotation by its
// `name` (`/NM`) — which a save writes and a reopen reads back, where its `id`
// is minted afresh each time a file is read — a batch checked whole before any
// of it is applied, a write resolving once its events have fired. An
// annotation is read without its appearance (`null`), and one written without
// one has it generated; a stamp updated without one keeps the picture it has
// while its icon and colour stay as they were.
//
// The add / update / remove events report every change to the document's
// annotations — an edit made here, a host call, an undo or redo, a
// collaborator's — one event per annotation. They are found by reading every
// page's annotations after each change and comparing with the read before, so
// they are read only while a host listens (`watch`).

import type { Annotation, AnnotationId, PageId, UDocCommand, UDocSelection } from "@docmentis/udoc-wasm";
import { subscribeSelector } from "../framework/index.js";
import type { Store } from "../framework/index.js";
import { Command } from "../worker/commands.js";
import type { WorkerClient } from "../worker/WorkerClient.js";
import type { Action } from "./actions.js";
import { applyAnnotationPatch } from "./annotation-patch.js";
import type { AnnotationPatch } from "./annotation-patch.js";
import type { UIState } from "./state.js";

/** The annotation events, with legacy's payload names. */
export interface PageAnnotationEventMap {
    "annotation:inserted": { pageIndex: number; annotation: Annotation };
    "annotation:updated": { pageIndex: number; annotation: Annotation };
    "annotation:removed": { pageIndex: number; annotation: Annotation };
    "annotation:selected": { pageIndex: number; annotation: Annotation } | null;
    "annotation:hovered": { pageIndex: number; annotation: Annotation; clientX: number; clientY: number } | null;
    "annotation:clicked": { pageIndex: number; annotation: Annotation; clientX: number; clientY: number };
}

/** A listener for every annotation event: its name and its payload. */
export type PageAnnotationListener = <K extends keyof PageAnnotationEventMap>(
    event: K,
    payload: PageAnnotationEventMap[K],
) => void;

/** The host's page annotations — {@link createPageAnnotations}. */
export type PageAnnotations = ReturnType<typeof createPageAnnotations>;

export interface PageAnnotationsDeps {
    client: WorkerClient;
    store: Store<UIState, Action>;
    /** Run `command` as one committing edit. */
    execute: (command: UDocCommand) => Promise<void>;
    /** A fresh id, or `null` with no document open. */
    mintId: () => Promise<string | null>;
    /** The current selection, once every change sent before has applied; `null` for none. */
    selection: () => Promise<UDocSelection | null>;
    /** Set the selection — presence only. */
    setSelection: (selection: UDocSelection) => void;
    emit: <K extends keyof PageAnnotationEventMap>(event: K, payload: PageAnnotationEventMap[K]) => void;
}

/** One annotation as the last read found it. */
interface Seen {
    pageIndex: number;
    annotation: Annotation;
    json: string;
}

export function createPageAnnotations(deps: PageAnnotationsDeps) {
    const { client, store, execute, emit } = deps;

    // --- reading -------------------------------------------------------------

    /** Page `pageIndex`'s id and its annotations, in paint order. */
    async function readPage(pageIndex: number): Promise<{ pageId: PageId; annotations: Annotation[] }> {
        const pageId = await client.portable.pageIdByIndex(pageIndex);
        if (pageId === undefined) throw new Error(`No page ${pageIndex}`);
        const [read] = await client.portable.pageAnnotations([pageId]);
        return { pageId, annotations: read?.annotations ?? [] };
    }

    function ensureLoaded(): void {
        if (store.getState().status !== "ready") throw new Error("No document loaded");
    }

    function ensurePortable(): void {
        ensureLoaded();
        if (store.getState().docType !== "portable") throw new Error("Annotations are supported on PDF documents only");
    }

    async function newId(): Promise<string> {
        const id = await deps.mintId();
        if (id === null) throw new Error("No document loaded");
        return id;
    }

    /** The annotation named `name` on page `pageIndex`, with its id, or legacy's error. */
    function requireNamed(
        annotations: readonly Annotation[],
        pageIndex: number,
        name: string,
    ): Annotation & { id: AnnotationId } {
        const found = annotations.find(
            (annotation): annotation is Annotation & { id: AnnotationId } =>
                annotation.name === name && annotation.id !== undefined,
        );
        if (!found) throw new Error(`No annotation with name "${name}" on page ${pageIndex}`);
        return found;
    }

    // --- the calls -----------------------------------------------------------

    async function getPageAnnotations(pageIndex: number): Promise<Annotation[]> {
        ensureLoaded();
        if (store.getState().docType !== "portable") return [];
        return (await readPage(pageIndex)).annotations;
    }

    async function addPageAnnotations(pageIndex: number, annotations: Annotation[]): Promise<Annotation[]> {
        ensurePortable();
        if (annotations.length === 0) return [];
        const { pageId } = await readPage(pageIndex);
        const inserted: Annotation[] = [];
        for (const annotation of annotations) {
            inserted.push({
                ...annotation,
                id: annotation.id ?? (await newId()),
                name: annotation.name ?? generateAnnotationName(),
            });
        }
        // The insert selects what it inserts, as the Annotate tab's tools want; a host's
        // add leaves the selection as it was, as legacy's did.
        const selection = await deps.selection();
        holdingSelection++;
        try {
            await execute(Command.insertAnnotations(pageId, inserted));
            deps.setSelection(selection ?? { portable: "none" });
            await deps.selection();
        } finally {
            holdingSelection--;
        }
        await flush();
        return inserted;
    }

    async function updatePageAnnotations(
        pageIndex: number,
        updates: Array<{ name: string; annotation: Annotation }>,
    ): Promise<Annotation[]> {
        ensurePortable();
        if (updates.length === 0) return [];
        const { pageId, annotations } = await readPage(pageIndex);
        // Every name is found before anything changes; each keeps its id and name.
        const resolved = updates.map(({ name, annotation }) => {
            const { id } = requireNamed(annotations, pageIndex, name);
            return { ...annotation, id, name };
        });
        const updated = await Promise.all(resolved.map((annotation) => keepingPicture(pageId, annotation)));
        await execute(Command.updateAnnotations(pageId, updated));
        await flush();
        return resolved;
    }

    /**
     * `annotation`, a stamp sent without an appearance given back the picture
     * it has while its icon and colour stay as they were — a read carries no
     * appearance, and one sent without is generated afresh.
     */
    async function keepingPicture(pageId: PageId, annotation: Annotation): Promise<Annotation> {
        const kind = annotation.kind;
        if (annotation.appearance !== null || typeof kind !== "object" || !("stamp" in kind)) return annotation;
        const stored = annotation.id === undefined ? null : await client.portable.annotation(pageId, annotation.id);
        if (!stored?.appearance || typeof stored.kind !== "object" || !("stamp" in stored.kind)) return annotation;
        const sameLook =
            JSON.stringify(stored.kind.stamp.icon) === JSON.stringify(kind.stamp.icon) &&
            JSON.stringify(stored.color) === JSON.stringify(annotation.color);
        return sameLook ? { ...annotation, appearance: stored.appearance } : annotation;
    }

    async function patchPageAnnotations(
        pageIndex: number,
        patches: Array<{ name: string; patch: AnnotationPatch }>,
    ): Promise<Annotation[]> {
        ensurePortable();
        if (patches.length === 0) return [];
        const { annotations } = await readPage(pageIndex);
        const updates = patches.map(({ name, patch }) => ({
            name,
            annotation: applyAnnotationPatch(requireNamed(annotations, pageIndex, name), patch),
        }));
        return updatePageAnnotations(pageIndex, updates);
    }

    async function removePageAnnotation(pageIndex: number, name: string): Promise<void> {
        ensurePortable();
        const { pageId, annotations } = await readPage(pageIndex);
        const { id } = requireNamed(annotations, pageIndex, name);
        // The engine takes its replies, state notes and popup with it.
        await execute(Command.deleteAnnotations(pageId, [id]));
        await flush();
    }

    // --- add / update / remove -----------------------------------------------

    let watching = false;
    /** The annotations the last read found, by id; `null` before a document's first read. */
    let seen: Map<AnnotationId, Seen> | null = null;
    let reading: Promise<void> = Promise.resolve();
    let scheduled = false;

    /** Compare the document's annotations with the last read, and report each change. */
    function flush(): Promise<void> {
        reading = reading.then(compare, compare);
        return reading;
    }

    async function compare(): Promise<void> {
        const state = store.getState();
        if (!watching || state.status !== "ready" || state.docType !== "portable") {
            seen = null;
            return;
        }
        const generation = state.docGeneration;
        const pages = await client.portable.pageAnnotations(await client.portable.pageIds());
        if (store.getState().docGeneration !== generation) return;
        const now = new Map<AnnotationId, Seen>();
        for (const page of pages) {
            for (const annotation of page.annotations) {
                if (annotation.id === undefined) continue;
                now.set(annotation.id, { pageIndex: page.index, annotation, json: JSON.stringify(annotation) });
            }
        }
        const before = seen;
        seen = now;
        if (before === null) return;
        for (const [id, after] of now) {
            const was = before.get(id);
            if (!was) emit("annotation:inserted", { pageIndex: after.pageIndex, annotation: after.annotation });
            else if (was.json !== after.json)
                emit("annotation:updated", { pageIndex: after.pageIndex, annotation: after.annotation });
        }
        for (const [id, was] of before) {
            if (!now.has(id)) emit("annotation:removed", { pageIndex: was.pageIndex, annotation: was.annotation });
        }
    }

    /** Compare once the change just sent has applied — the read queues behind it. */
    function schedule(): void {
        if (!watching || scheduled) return;
        scheduled = true;
        queueMicrotask(() => {
            scheduled = false;
            void flush();
        });
    }

    const unsubDocumentChanged = client.onDocumentChanged(schedule);
    // A document opened is the next first read, which reports nothing.
    const unsubDocument = subscribeSelector(
        store,
        (s) => ({ generation: s.docGeneration, ready: s.status === "ready" }),
        () => {
            seen = null;
            schedule();
        },
        { equality: (a, b) => a.generation === b.generation && a.ready === b.ready },
    );

    /** Report add / update / remove while `on`: a host listens to one of them. */
    function watch(on: boolean): void {
        if (on === watching) return;
        watching = on;
        seen = null;
        if (on) schedule();
    }

    // --- select / hover / click ----------------------------------------------

    /** The annotation of `id` on page `pageId`, with its page's index. */
    async function shown(
        pageId: PageId,
        id: AnnotationId,
    ): Promise<{ pageIndex: number; annotation: Annotation } | null> {
        const [read] = await client.portable.pageAnnotations([pageId]);
        const annotation = read?.annotations.find((candidate) => candidate.id === id);
        return read && annotation ? { pageIndex: read.index, annotation } : null;
    }

    let selected: AnnotationId | null = null;
    /** Writes under way that select what they insert and then restore the selection: no select is reported meanwhile. */
    let holdingSelection = 0;
    const unsubSelect = subscribeSelector(
        store,
        (s) => s.selectedAnnotations,
        (selection) => {
            if (holdingSelection > 0) return;
            const first = selection?.annotations[0]?.id ?? null;
            if (first === selected) return;
            selected = first;
            if (first === null || !selection) {
                emit("annotation:selected", null);
                return;
            }
            void shown(selection.page, first).then((found) => {
                if (found && selected === first) emit("annotation:selected", found);
            });
        },
    );

    let hovered: string | null = null;
    function hover(annotation: { page: string; id: string } | null, clientX: number, clientY: number): void {
        hovered = annotation?.id ?? null;
        if (!annotation) {
            emit("annotation:hovered", null);
            return;
        }
        const id = annotation.id;
        void shown(annotation.page, id).then((found) => {
            if (hovered === id) emit("annotation:hovered", found ? { ...found, clientX, clientY } : null);
        });
    }

    function click(annotation: { page: string; id: string }, clientX: number, clientY: number): void {
        void shown(annotation.page, annotation.id).then((found) => {
            if (found) emit("annotation:clicked", { ...found, clientX, clientY });
        });
    }

    return {
        getPageAnnotations,
        addPageAnnotations,
        updatePageAnnotations,
        patchPageAnnotations,
        removePageAnnotation,
        watch,
        hover,
        click,
        destroy(): void {
            unsubDocumentChanged();
            unsubDocument();
            unsubSelect();
        },
    };
}

/** A name for an annotation added without one, as legacy made it: a UUID. */
function generateAnnotationName(): string {
    const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
}
