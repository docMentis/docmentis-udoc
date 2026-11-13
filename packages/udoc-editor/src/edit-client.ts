// Edit mode's calls on the render worker: the requests its own handlers answer
// (worker/handlers.ts), sent through the shell's client.
import type {
    FontFamily,
    FontFamilySummary,
    ParagraphStyleSummary,
    ShapeNode,
    ShapePreview,
    UDocFragment,
} from "@docmentis/udoc-wasm";
import type { DocumentLayout } from "@docmentis/udoc-ui";
import type {
    SelectionBox,
    SelectionHandle,
    ThemePalette,
    UIShellHost,
    WorkerClient,
} from "@docmentis/udoc-ui/internal";
import type { EditRequest, FontPreviewImage } from "./worker/protocol.js";

/** Edit mode's requests of the render worker, over the shell's client. */
export class EditClient {
    readonly #client: WorkerClient;

    constructor(client: WorkerClient) {
        this.#client = client;
    }

    #request<T>(
        request: EditRequest,
        options?: { readonly transfer?: Transferable[]; readonly changesDocument?: boolean },
    ): Promise<T> {
        return this.#client.request<T>(request, options);
    }

    #post(request: EditRequest): void {
        this.#client.post(request);
    }

    /**
     * Set whether content overflowing the page bounds is drawn. When on, an
     * object that runs off the page stays visible within the spread (the
     * viewport in paged view, or the page plus half the inter-page gap in
     * continuous); when off it is clipped to the page. Sticky across opens in
     * the worker like the view mode. Latest-wins, fire-and-forget.
     */
    setOverflowVisible(visible: boolean): void {
        this.#post({ type: "setOverflowVisible", visible });
    }

    /**
     * Toggle empty-placeholder authoring chrome — the dashed frame and "Click to
     * add …" prompt shown on an empty presentation placeholder while editing. On
     * in edit mode, off in a reading view. Sticky across opens in the worker like
     * the backdrop; a no-op for doc types without placeholders. Latest-wins,
     * fire-and-forget.
     */
    setPlaceholderPrompts(on: boolean): void {
        this.#post({ type: "setPlaceholderPrompts", on });
    }

    /**
     * Record the open word document's edits as tracked changes, or stop —
     * review mode's. The open document's alone: each opens with it off. A
     * no-op for any other doc type. Latest-wins, fire-and-forget.
     */
    setTrackRevisions(on: boolean): void {
        this.#post({ type: "setTrackRevisions", on });
    }

    /**
     * Read the current slide's resolved theme color palette — the mapped scheme
     * slots the color picker shows as "Theme Colors". Resolves to `null` for a
     * doc type without a theme (only presentations carry one). Re-pull on open
     * and on slide change, since a multi-master deck re-themes per slide.
     */
    themePalette(): Promise<ThemePalette | null> {
        return this.#request({ type: "themePalette" });
    }

    /**
     * Read every font family available to the open document, sorted by name,
     * with its `sourceType` and **without** its faces — the picker's list.
     *
     * `sourceType` says who can draw the family's own name in its own face:
     * `Local` / `Url` / `Google` the browser loads into its own text stack (see
     * `fonts/preview.ts`), and the rest go through {@link renderFontPreview}.
     * {@link fontFamilies} is the same list carrying the faces; at ~1800
     * families those are three quarters of the payload. Stable across the
     * session, so pull this once on open and cache it. `[]` when no document is
     * open or the doc type has no text font registry.
     */
    fontFamilySummaries(): Promise<FontFamilySummary[]> {
        return this.#request({ type: "fontFamilySummaries" });
    }

    /**
     * Read the open word document's paragraph styles, in its style gallery's
     * order — the default first, then by Word's priority — each flagged
     * `inGallery` where the gallery offers it. Every style is listed, so the
     * picker can name the one a paragraph is in even where its menu leaves
     * that one out. Fixed for the document, so pull this once on open. `[]`
     * when no document is open, for any other doc type, and for a document
     * with no styles.
     */
    paragraphStyleSummaries(): Promise<ParagraphStyleSummary[]> {
        return this.#request({ type: "paragraphStyleSummaries" });
    }

    /**
     * Read the families that are **loaded** — parsed and in hand this moment — a
     * subset of {@link fontFamilySummaries}, in the same order.
     *
     * The set the document has actually used. **Not** stable across the session:
     * fonts materialize lazily, so this grows as the document composes and as
     * fonts are picked. Pull it when the picker is about to be shown rather than
     * caching it. It orders the list and gates nothing.
     */
    loadedFontFamilyNames(): Promise<string[]> {
        return this.#request({ type: "loadedFontFamilyNames" });
    }

    /**
     * Read every font family available, sorted by name, each with its **faces**
     * and its default `sourceType` — for a picker that greys out bold and
     * italic per family.
     *
     * {@link fontFamilySummaries} is the same list without the faces, and is
     * what a picker that only lists families should read.
     */
    fontFamilies(): Promise<FontFamily[]> {
        return this.#request({ type: "fontFamilies" });
    }

    /**
     * Draw one family's name in its own face as a PNG **alpha mask** — the
     * picker row for a family the browser can't load itself. `null` when nothing
     * shaped.
     *
     * `size` is the em in CSS px; the reply's `width`/`height` are the CSS box,
     * and the PNG behind it is already device-pixel-ratio scaled.
     */
    renderFontPreview(
        family: string,
        bold: boolean,
        italic: boolean,
        text: string,
        size: number,
    ): Promise<FontPreviewImage | null> {
        return this.#request({
            type: "renderFontPreview",
            family,
            bold,
            italic,
            text,
            size,
        });
    }

    /**
     * Paste a {@link UDocFragment} the caller read back off the system
     * clipboard — its objects are re-inserted with fresh ids and become the
     * selection. A committing edit (one undo step), so it resolves with the
     * document's new layout; the refreshed selection geometry follows via
     * the client's `onSelection`.
     */
    paste(fragment: UDocFragment): Promise<DocumentLayout> {
        return this.#request({ type: "paste", fragment }, { changesDocument: true });
    }

    /**
     * Insert the image file `bytes` as a picture on the current page, centred
     * and scaled down to fit, and select it. `contentType` is the file's MIME
     * type; an empty one is read from the bytes. A committing edit (one undo
     * step), so it resolves with the document's new layout; the selection
     * follows via the client's `onSelection`.
     */
    insertImage(bytes: Uint8Array, contentType: string): Promise<DocumentLayout> {
        // Transfer a fresh copy of the buffer to avoid detaching the caller's.
        const buffer = bytes.slice().buffer;
        return this.#request({ type: "insertImage", bytes: buffer, contentType }, { transfer: [buffer] });
    }

    /**
     * Insert a table of `rows` × `columns` and put the caret in its first cell
     * — on a deck centred on the current slide, in a word document at the
     * caret in a section's body, splitting the paragraph there. A committing
     * edit (one undo step), so it resolves with the document's new layout; the
     * selection follows via the client's `onSelection`.
     */
    insertTable(rows: number, columns: number): Promise<DocumentLayout> {
        return this.#request({ type: "insertTable", rows, columns });
    }

    /**
     * Where handle `index` of the selection lands if dragged to `(x, y)` — the
     * shape's text warp's handle when `textWarp`, as the streamed handle says,
     * else its outline's — with `(x, y)` a point in that handle's **own local
     * space** (the space the streamed handle's `point` is in), not CSS px.
     *
     * A handle travels the track its geometry describes and stops at the ends of
     * its range, so this is what a live drag draws: the position the release will
     * produce, resolved by the engine, with nothing written until then. Resolves
     * the whole handle (drop it in place of the streamed one) or `null` when the
     * selection offers none. Cheap enough to call per pointer-move; the caller
     * coalesces it latest-wins, like the client's `hitTest`.
     */
    selectionHandlePreview(textWarp: boolean, index: number, x: number, y: number): Promise<SelectionHandle | null> {
        return this.#request({ type: "selectionHandlePreview", textWarp, index, x, y });
    }

    /**
     * What `node` would paint on page `page` (0-based), read without placing it:
     * each outline at the size the node gives it, in the page's theme. What a live
     * drag draws, with nothing written until it ends. Cheap enough to call per
     * pointer-move; the caller coalesces it latest-wins. Resolves `null` for a doc
     * type whose pages take no shape nodes, or a page that isn't there.
     */
    shapePreview(page: number, node: ShapeNode): Promise<ShapePreview | null> {
        return this.#request({ type: "shapePreview", page, node });
    }

    /**
     * Where the anchor of the floating drawing selected in a word document would
     * stand if it were dropped at CSS-px point `(x, y)` of the viewport: beside
     * the paragraph nearest the point, a box on its page, as
     * {@link moveObjectAnchor} would put it. What a live drag of the anchor
     * draws, with nothing written until it ends. Cheap enough to call per
     * pointer-move; the caller coalesces it latest-wins. Resolves `null` where
     * the selection is not one floating drawing picked whole, its anchor is
     * locked, or the point lands on no paragraph.
     */
    objectAnchorPreview(x: number, y: number): Promise<SelectionBox | null> {
        return this.#request({ type: "objectAnchorPreview", x, y });
    }

    /**
     * Move the anchor of the floating drawing selected in a word document onto
     * the paragraph nearest CSS-px point `(x, y)` of the viewport — to that
     * paragraph's start, as Word does — keeping the drawing where it stands on
     * the page. A committing edit (one undo step), so it resolves with the
     * document's new layout; the drawing stays selected.
     */
    moveObjectAnchor(x: number, y: number): Promise<DocumentLayout> {
        return this.#request({ type: "moveObjectAnchor", x, y });
    }

    /** The id of the deck's slide at `index` (0-based), or `null` past the last
     *  slide or with no presentation open — what a shape placed on it names
     *  its slide by. */
    slideId(index: number): Promise<string | null> {
        return this.#request({ type: "slideId", index });
    }
}

/** What the shell lends edit mode, with edit mode's own client over its worker. */
export interface EditHost extends UIShellHost {
    readonly edit: EditClient;
}
