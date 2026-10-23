// The requests edit mode sends its render worker beyond the engine's own —
// answered by the handlers in handlers.ts, sent by `EditClient`.
import type { UDocFragment } from "@docmentis/udoc-wasm";

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
 * Toggle formatting marks — `¶` at each paragraph mark, a dot in each space, an
 * arrow in each tab and `↵` at each line break — drawn over composed text in the
 * space it already holds, so showing them never reflows. On while the user asks
 * for them in edit mode. Sticky like the backdrop: re-applied to every
 * subsequently opened document. Latest-wins, fire-and-forget.
 */
export interface SetFormattingMarksRequest {
    type: "setFormattingMarks";
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
 * Read every slide master, summarized for the New-Slide picker: its id, its
 * slide layouts' ids, and the layout **plane** it renders on. A pure read
 * (though it loads every slide master to learn its slide layouts). Replies with
 * the parsed {@link import("@docmentis/udoc-wasm").SlideMasterSummary} list.
 */
export interface SlideMastersSummaryRequest {
    type: "slideMastersSummary";
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
    index: number;
    x: number;
    y: number;
}

/** A request edit mode's worker answers beyond the engine's own. */
export type EditRequest =
    | SetOverflowVisibleRequest
    | SetPlaceholderPromptsRequest
    | SetFormattingMarksRequest
    | ThemePaletteRequest
    | FontFamilySummariesRequest
    | LoadedFontFamilyNamesRequest
    | FontFamiliesRequest
    | RenderFontPreviewRequest
    | SlideMastersSummaryRequest
    | PasteRequest
    | InsertImageRequest
    | SelectionHandlePreviewRequest;
