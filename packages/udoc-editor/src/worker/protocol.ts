// The requests edit mode sends its render worker beyond the engine's own —
// answered by the handlers in handlers.ts, sent by `EditClient`.
import type { ShapeNode, UDocFragment } from "@docmentis/udoc-wasm";

/**
 * Set whether content overflowing the page bounds is drawn. When on, an object
 * that runs off the page stays visible within the spread (the viewport in paged
 * view, or the page plus half the inter-page gap in continuous); when off it is
 * clipped to the page. Sticky like the view mode — re-applied to every
 * subsequently opened document. Latest-wins, fire-and-forget.
 */
export interface SetOverflowVisibleRequest {
    type: "setOverflowVisible";
    visible: boolean;
}

/**
 * Toggle empty-placeholder authoring chrome — the dashed frame and "Click to
 * add …" prompt an empty presentation placeholder shows while being edited. On
 * in edit mode, off in a reading view (an empty placeholder then renders blank).
 * Sticky like the backdrop: re-applied to every subsequently opened document.
 * A no-op for doc types without placeholders. Latest-wins, fire-and-forget.
 */
export interface SetPlaceholderPromptsRequest {
    type: "setPlaceholderPrompts";
    on: boolean;
}

/**
 * Read the current slide's resolved theme color palette — the mapped scheme
 * slots the color picker shows as "Theme Colors" — a pure read. Replies with a
 * `ThemePalette`, or `null` for a doc type
 * without a theme (only presentations carry one). Re-pulled on open and
 * whenever the viewed slide changes, since a multi-master deck re-themes per
 * slide.
 */
export interface ThemePaletteRequest {
    type: "themePalette";
}

/**
 * Read every font family available to the open document, sorted by name, with
 * its `sourceType` and **without** its faces — the picker's list. Replies with a
 * `FontFamilySummary[]`; empty when no document is open or the doc type has no
 * text font registry (PDF composes its own embedded font programs; an image has
 * no text).
 *
 * A picker draws a row per family and needs two things: what to call it, and
 * which vendor it comes from — `Local` / `Url` / `Google` the browser can load
 * into its own text stack, and the rest go through
 * {@link RenderFontPreviewRequest}. {@link FontFamiliesRequest} is the same list
 * carrying the faces too, for a picker that greys out bold and italic per
 * family; at ~1800 families those are three quarters of the payload. Stable
 * across the session, so pull this once on open and cache it.
 */
export interface FontFamilySummariesRequest {
    type: "fontFamilySummaries";
}

/**
 * Read the open word document's paragraph styles, in its style gallery's
 * order — the default first, then by Word's priority — each flagged
 * `inGallery` where the gallery offers it. Replies with a
 * `ParagraphStyleSummary[]`; empty when no document is open, for any other doc
 * type, and for a document with no styles (a text file). Every style is
 * listed, so the picker can name the one a paragraph is in even where its menu
 * leaves that one out. Fixed for the document, so pull it once on open.
 */
export interface ParagraphStyleSummariesRequest {
    type: "paragraphStyleSummaries";
}

/**
 * Read the families that are **loaded** — parsed and in hand this moment — a
 * subset of {@link FontFamilySummariesRequest}'s answer, in the same order. Replies
 * with a `string[]`.
 *
 * The set the document has actually used: fonts materialize lazily, so a family
 * arrives here when something resolves to it, whether it was bundled all along
 * or just finished downloading. Unlike the full list this is **not** stable — it
 * grows as the document composes and as fonts are picked — so pull it whenever
 * the picker is about to be shown rather than caching it on open. It orders the
 * list and gates nothing.
 */
export interface LoadedFontFamilyNamesRequest {
    type: "loadedFontFamilyNames";
}

/**
 * Read every font family available to the open document, sorted by name, each
 * with its faces and its **default source type** — the picker's list when it
 * needs more than the names. Replies with a `FontFamily[]`; empty when no
 * document is open or the doc type has no text font registry.
 *
 * `sourceType` is what a picker showing specimens reads: `Local` / `Url` /
 * `Google` are families the browser can load into its own text stack, and
 * `Embedded` / `OfficeCompatible` / `AdobeStandard` have no bytes outside wasm
 * and go through {@link RenderFontPreviewRequest}. Stable across the session,
 * so pull it once on open and cache it.
 */
export interface FontFamiliesRequest {
    type: "fontFamilies";
}

/**
 * Draw one family's name in its own face, as a PNG **alpha mask** — the picker
 * row for a family the browser can't load itself. Replies with the PNG bytes
 * plus the CSS box to draw them in, or `null` when nothing shaped.
 *
 * The color is flat black and carries nothing; only the coverage matters. The
 * host points a CSS `mask-image` at it over `currentColor`, so the specimen
 * takes the theme's text color and a light/dark switch needs no redraw. The PNG
 * is rendered at the device pixel ratio behind the returned box.
 */
export interface RenderFontPreviewRequest {
    type: "renderFontPreview";
    family: string;
    bold: boolean;
    italic: boolean;
    /** What to draw — usually the family's own name. */
    text: string;
    /** The em, in CSS px. */
    size: number;
}

/** {@link RenderFontPreviewRequest}'s answer: a PNG mask and its CSS box. */
export interface FontPreviewImage {
    /** PNG bytes whose alpha channel is the glyph coverage — transferred, like
     *  a thumbnail's pixels, rather than copied. */
    png: ArrayBuffer;
    /** The width to give the element, in CSS px. */
    width: number;
    /** The height to give the element, in CSS px. */
    height: number;
    /**
     * The transparent bleed baked into every side, in CSS px.
     *
     * The box is grown all round to hold ink that overhangs the advances (an
     * italic's ascender, a script face's tail), so the raster's left edge sits
     * one of these left of where the pen started. Offset the element by
     * `-bleed` to line the specimen up with ordinary text at the same em.
     */
    bleed: number;
}

/**
 * Read the id of the deck's slide at `index` (0-based, in slide order) — what
 * a shape inserted onto it names its slide by. A pure read. Replies with the
 * id, or `null` past the last slide or with no presentation open.
 */
export interface SlideIdRequest {
    type: "slideId";
    index: number;
}

/**
 * Paste a {@link import("@docmentis/udoc-wasm").UDocFragment} the host
 * read back off the system clipboard — the fragment's objects are re-inserted with
 * fresh ids onto the selection's page (else the current page) and become the
 * selection. A committing edit (one undo step), so it replies with the document's
 * layout like udoc-ui's `ExecuteRequest`, schedules a repaint, and re-posts the
 * selection in a `SelectionReport`.
 */
export interface PasteRequest {
    type: "paste";
    fragment: UDocFragment;
}

/**
 * Insert the image file `bytes` as a picture on the current page, centred and
 * scaled down to fit, and select it. `contentType` is the file's MIME type
 * (`image/png`, …); an empty one is read from the bytes' own signature. The
 * image is an opaque part (docs/design/core-editor-opaque-part.md): its bytes never enter
 * the CRDT. A committing edit (one undo step), so it replies with the
 * document's layout like udoc-ui's `ExecuteRequest`, schedules a repaint, and
 * re-posts the selection in a `SelectionReport`.
 */
export interface InsertImageRequest {
    type: "insertImage";
    bytes: ArrayBuffer;
    contentType: string;
}

/**
 * Insert a table of `rows` × `columns` and put the caret in its first cell —
 * Insert Table: on a deck centred on the current slide, in a word document at
 * the caret in a section's body. A committing edit (one undo step), replying
 * like `InsertImageRequest`.
 */
export interface InsertTableRequest {
    type: "insertTable";
    rows: number;
    columns: number;
}

/**
 * Where geometry handle `index` of the selection's `handles` would land if it
 * were dragged to `(x, y)` — a point in that handle's **own local space**
 * (document points, the space the streamed handle's `point` is in), not CSS px.
 *
 * A handle doesn't follow the pointer: it travels the track its geometry
 * describes (a corner radius along one edge, a callout's tail on an arc) and
 * stops at the ends of its range. Only the engine can say where it lands, so the
 * host asks rather than drawing the grip under the raw cursor. A pure read —
 * nothing is written until the drag commits — called **latest-wins** on pointer
 * move, one in flight. Replies with the whole `SelectionHandle`, so the
 * caller substitutes it for the streamed one and draws it through the same
 * projection; `null` when the selection offers no such handle.
 */
export interface SelectionHandlePreviewRequest {
    type: "selectionHandlePreview";
    /** Whether the handle is the shape's text warp's, as its streamed
     *  `textWarp` says, rather than its outline's. */
    textWarp: boolean;
    index: number;
    x: number;
    y: number;
}

/**
 * Where the anchor of the floating drawing selected in a word document would
 * stand if it were dropped at CSS-px point `(x, y)` of the viewport: beside the
 * paragraph nearest the point, as `MoveObjectAnchorRequest` would put it. A pure
 * read, called **latest-wins** on pointer move, one in flight. Replies with the
 * anchor's `SelectionBox` on its page; `null` where the selection is not one
 * floating drawing picked whole in a section's body, its anchor is locked, or
 * the point lands on no paragraph.
 */
export interface ObjectAnchorPreviewRequest {
    type: "objectAnchorPreview";
    x: number;
    y: number;
}

/**
 * Move the anchor of the floating drawing selected in a word document onto the
 * paragraph nearest CSS-px point `(x, y)` of the viewport — to that paragraph's
 * start, as Word does — keeping the drawing where it stands on the page. A
 * committing edit (one undo step), replying like `InsertImageRequest`; the
 * drawing stays selected.
 */
export interface MoveObjectAnchorRequest {
    type: "moveObjectAnchor";
    x: number;
    y: number;
}

/**
 * What `node` would paint on page `page` (0-based), read without placing it — the
 * read behind a shape being dragged out, called **latest-wins** on pointer move,
 * one in flight. Replies with the whole `ShapePreview`; `null` for a doc type
 * whose pages take no shape nodes, or a page that isn't there.
 */
export interface ShapePreviewRequest {
    type: "shapePreview";
    page: number;
    node: ShapeNode;
}

/** A request edit mode's worker answers beyond the engine's own. */
export type EditRequest =
    | SetOverflowVisibleRequest
    | SetPlaceholderPromptsRequest
    | ThemePaletteRequest
    | FontFamilySummariesRequest
    | ParagraphStyleSummariesRequest
    | LoadedFontFamilyNamesRequest
    | FontFamiliesRequest
    | RenderFontPreviewRequest
    | SlideIdRequest
    | PasteRequest
    | InsertImageRequest
    | InsertTableRequest
    | SelectionHandlePreviewRequest
    | ShapePreviewRequest
    | ObjectAnchorPreviewRequest
    | MoveObjectAnchorRequest;
