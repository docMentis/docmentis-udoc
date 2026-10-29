// Edit mode's requests, answered on the render worker beside the engine's own.
import type { WorkerHandler } from "@docmentis/udoc-ui/worker";
import { Transferring } from "@docmentis/udoc-ui/worker";
import type { ThemePalette } from "@docmentis/udoc-ui/internal";
import type { SlideMasterSummary } from "@docmentis/udoc-wasm";
import type { EditRequest } from "./protocol.js";

/** A handler for each of edit mode's requests, by type. */
type EditHandlers = { readonly [T in EditRequest["type"]]: WorkerHandler<Extract<EditRequest, { type: T }>> };

export const EDIT_HANDLERS: EditHandlers = {
    setOverflowVisible: {
        sticky: true,
        handle(request, worker) {
            // Sticky in Rust, like the scroll mode. Only the clip changes, so
            // a full repaint paints off-page content in (or clips it out).
            worker.session?.setOverflowVisible(worker.viewer, request.visible);
            worker.scheduleFrame();
        },
    },
    setPlaceholderPrompts: {
        sticky: true,
        handle(request, worker) {
            // Sticky in Rust, like the backdrop. Only presentations draw
            // prompts — on every viewer, so empty notes prompt in their pane
            // as an empty placeholder does on the slide; a full repaint
            // shows/clears them on the next frame.
            const session = worker.session;
            if (session) for (let v = 0; v < session.viewerCount(); v++) session.setPlaceholderPrompts(v, request.on);
            worker.scheduleFrame();
        },
    },
    setFormattingMarks: {
        sticky: true,
        handle(request, worker) {
            // Sticky in Rust, like the backdrop; a full repaint shows or
            // clears the marks on the next frame.
            worker.session?.setFormattingMarks(worker.viewer, request.on);
            worker.scheduleFrame();
        },
    },
    themePalette: {
        // The document's resolved theme palette — a slide's for a deck, the
        // single document theme for a word doc — a pure read. `null` when no
        // document is open or the doc type carries no theme (PDF / image); the
        // host then keeps its stand-in.
        handle(_request, { session, viewer }) {
            const json = session?.themePalette(viewer);
            return json !== undefined ? (JSON.parse(json) as ThemePalette) : null;
        },
    },
    fontFamilySummaries: {
        // The whole picker list: a name and a vendor per family, without the
        // faces. `[]` with no document or a doc type with no text font registry
        // (PDF/image).
        handle: (_request, { session }) => (session ? session.fontFamilySummaries() : []),
    },
    loadedFontFamilyNames: {
        // The subset needing no download — read fresh each time, since
        // binaries land throughout the session.
        handle: (_request, { session }) => (session ? session.loadedFontFamilyNames() : []),
    },
    fontFamilies: {
        // The same list carrying each family's faces — for a picker that greys
        // out bold and italic per family. Ours reads the summaries above
        // instead.
        handle: (_request, { session }) => (session ? session.fontFamilies() : []),
    },
    renderFontPreview: {
        // A specimen the browser can't draw itself — an embedded or bundled
        // face, rasterized here as a PNG alpha mask. Small (one short line of
        // text), so it runs inline like the reads above rather than queueing
        // as background work, as the thumbnail strip's renders do.
        //
        // Like `renderThumbnail`, the bytes are moved out of the wasm handle
        // and `slice()`d into a standalone transferable buffer before the
        // handle is freed.
        handle(request, { session }) {
            const image = session?.renderFontPreview(
                request.family,
                request.bold,
                request.italic,
                request.text,
                request.size,
            );
            if (!image) return null;
            const width = image.width;
            const height = image.height;
            const bleed = image.bleed;
            const png = image.takePng().slice().buffer;
            image.free();
            return new Transferring({ png, width, height, bleed }, [png]);
        },
    },
    selectionHandlePreview: {
        // Where a dragged geometry handle actually lands — the engine solves its
        // guide, so the host can draw the grip on its own track instead of under
        // the raw cursor. A pure read, no edit, no repaint; `null` when the
        // selection offers no such handle.
        handle: (request, { session, viewer }) =>
            session
                ? (session.selectionHandlePreview(viewer, request.textWarp, request.index, request.x, request.y) ??
                  null)
                : null,
    },
    slideMastersSummary: {
        // A pure read: every slide master, summarized for the New-Slide picker.
        // Empty when there's no open / non-presentation doc. Loads every slide
        // master (to learn its slide layouts), so `&mut`-backed. Lenient like
        // the engine's own reads: a throw reads as none.
        handle(_request, { session }): SlideMasterSummary[] {
            try {
                return session?.presentation.model.slideMasters.summary() ?? [];
            } catch {
                return [];
            }
        },
    },
    paste: {
        handle(request, worker) {
            const { session } = worker;
            if (!session) throw new Error("engine worker: paste before open");
            // Re-insert the fragment's objects with fresh ids — an
            // `InsertObjects` under the hood, so it commits as one undo step
            // and the pasted objects become the selection. The fragment is
            // already doc-type-tagged (from `copy`), so it crosses as-is. A
            // committing edit like `execute`: the layout rides back, the
            // selection re-posts, history updates, repaint.
            session.paste(worker.viewer, request.fragment);
            return worker.committed(session);
        },
    },
    insertImage: {
        handle(request, worker) {
            const { session } = worker;
            if (!session) throw new Error("engine worker: insertImage before open");
            // A committing edit like `execute`: the picture lands on the
            // current page and is selected, so the layout rides back, the
            // selection re-posts, history updates, and a repaint redraws.
            session.insertImage(worker.viewer, new Uint8Array(request.bytes), request.contentType);
            return worker.committed(session);
        },
    },
};
