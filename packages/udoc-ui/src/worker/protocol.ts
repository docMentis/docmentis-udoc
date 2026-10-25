// Wire protocol between the main-thread {@link WorkerClient} and the worker that
// owns the OffscreenCanvas. Requests flow main → worker; each carries an
// optional correlation `_id` so the worker's reply can be matched to a pending
// promise. Fire-and-forget messages (viewport/invalidate/close/attach) omit it.
// The last section is the same for a {@link LocalCollaborationService} and its
// worker.

import type { PerfSummary } from "../performance/index.js";
import type {
    AcroFormField,
    ActionHideTarget,
    Annotation,
    Destination,
    SessionConfig,
    PaintFill,
    PaintLine,
    TextCharacterProperty,
    TextCharacterPropertyKey,
    TextParagraphProperty,
    TextParagraphPropertyKey,
    NonstrokingStyle,
    StrokingStyle,
    TableSelectionEdit,
    UDocError,
    UDocCommand,
    UDocFragment,
    UDocSelection,
    UDocSearchScope,
    UDocType,
    ExportFormat,
    FileFormat,
    FontLocation,
    GoogleFontFamily,
    PageExportFormat,
    SaveStrategy,
    SearchBatch,
    SearchContinuation,
    SearchMatchLocation,
    SearchOptions,
    UrlFont,
} from "@docmentis/udoc-wasm";
import type {
    GridCellSelectOptions,
    ContentPadding,
    DocumentLayout,
    Fit,
    Guide,
    LayoutMode,
    PageGap,
    Peer,
    PeerPointer,
    PeerSelectionGeometry,
    Rect,
    RgbColor,
    SelectMode,
    SelectionCapabilities,
    SelectionGeometry,
    TableSelectOptions,
    TextCaretMove,
    TextSelectOptions,
    ScrollAlignment,
    ScrollMode,
    UDocSelectionProperties,
    Viewport,
} from "../geometry.js";

/** Load + initialize the WASM module from a resolved glue/binary URL pair. */
export interface InitRequest {
    type: "init";
    /** URL of the `.wasm` binary, for the glue the worker is bundled with. */
    wasmUrl: string;
    /** Where the office-compatible fonts are, beside that binary. */
    fonts: FontLocation;
    /** The Google font families every session offers (`[]` for none).
     *  Absent is the catalog `startSession` offers unless told otherwise. */
    googleFontFamilies?: GoogleFontFamily[];
    /** Where css2 is asked for a Google family's faces. Absent is Google's own. */
    googleFontEndpoint?: string;
    /** Draw a family nothing serves with the viewer's own installed copy,
     *  through the worker's text stack. Absent is off. */
    enableCanvasFonts?: boolean;
}

/**
 * Start a licensed or permitted engine session — license validation and, for free/
 * unlicensed usage, the permit round trip, both inside the WASM.
 *
 * Sent per document, not per mount: a session is exactly one document long
 * (its permit is spent opening that document), so the client sends this at
 * the start of every open — before the document's bytes are even read — ahead
 * of its {@link OpenRequest} or {@link OpenRemoteRequest}, and the worker
 * replaces whatever session it held. Sending it at mount instead would spend a permit on every
 * page load, including the ones where nobody opens anything.
 *
 * Replies with the `Entitlements` the license granted, or rejects with the
 * refusal — `invalidLicense`, `permitRefused` or `cannotVerify` — whose code the
 * host branches on to tell a refusal from an unreachable service.
 */
export interface StartRequest {
    type: "start";
    config: SessionConfig;
}

/** Hand the worker the transferred canvas it will paint into. */
export interface AttachRequest {
    type: "attach";
    canvas: OffscreenCanvas;
}

/**
 * Offer the host's own fonts to every document opened from here on: `local` as
 * font files' bytes, `url` fetched only when a document's text asks for one.
 * The worker holds them and registers them on each session a
 * {@link StartRequest} starts, so the document already open keeps the fonts it
 * opened with. Adds to what earlier requests registered. Fire-and-forget.
 */
export interface RegisterFontsRequest {
    type: "registerFonts";
    local: Uint8Array[];
    url: UrlFont[];
}

/** Open a document from raw bytes (the buffer is transferred, not copied). */
export interface OpenRequest {
    type: "open";
    bytes: ArrayBuffer;
    /** The bytes' format, for bytes detection gets wrong; absent, it is detected. */
    format?: FileFormat;
    /** The character a CSV's fields are split by; absent, it is detected. */
    delimiter?: string;
}

/**
 * Open the package a server keeps at `url` — its package resource — fetching
 * each part the first time the document needs it. `url` is absolute: the
 * worker resolves nothing against the page.
 */
export interface OpenRemoteRequest {
    type: "openRemote";
    url: string;
}

/**
 * Unlock the open document, which needs a password (the open replied
 * `needsPassword`), with `password` — its user or its owner password. Replies
 * with the layout, as the open did: still `needsPassword` when `password` was
 * refused, the document's own once it opens.
 */
export interface AuthenticateRequest {
    type: "authenticate";
    password: string;
}

/** Update the painted window (scroll / zoom / resize). Latest-wins. */
export interface SetViewportRequest {
    type: "setViewport";
    viewport: Viewport;
    /**
     * Monotonic per-client sequence number. The worker echoes the latest
     * consumed value in each {@link PageViewsReport}, so the client can tell a
     * frame that reflects its newest viewport from one painted mid-burst.
     */
    seq: number;
}

/**
 * Scroll so page `index` (0-based) is brought to the top of the viewport — the
 * "go to page N" intent behind the page-number control. The worker composes
 * the target page first, then moves the camera; the resulting clamped scroll
 * and centered page ride back in the next {@link PageViewsReport}. Carries a
 * `seq` like {@link SetViewportRequest} so that frame is recognized as fresh.
 * Latest-wins, fire-and-forget.
 */
export interface GoToPageRequest {
    type: "goToPage";
    index: number;
    seq: number;
}

/**
 * Bring `rect` — page-local document points, as an annotation's rect is — on
 * page `index` (0-based) into view as `alignment` says, keeping the zoom —
 * `"top"` is a PDF `/XYZ` destination's landing: the landing a comment chosen
 * in the comments panel, or a search match, makes. The worker composes the target page first; the
 * resulting scroll rides back in the next {@link PageViewsReport}. Carries a
 * `seq` as {@link GoToPageRequest} does. Latest-wins, fire-and-forget.
 */
export interface GoToRectRequest {
    type: "goToRect";
    index: number;
    rect: Annotation["rect"];
    alignment: ScrollAlignment;
    seq: number;
}

/**
 * Follow a PDF `destination` — an outline item's or a link's: a named one
 * resolves through the document's named destinations, the worker composes the
 * target page, and the view lands as the destination's view asks, each zoom set
 * once for that page and its point by `alignment`. Replies with the `DestinationView` it landed by — a named
 * destination's, resolved — or `null` when it didn't land (the view is left
 * where it was). The resulting zoom and scroll ride back in the next
 * {@link PageViewsReport}. Carries a `seq` as {@link GoToPageRequest} does.
 */
export interface GoToDestinationRequest {
    type: "goToDestination";
    destination: Destination;
    alignment: ScrollAlignment;
    seq: number;
}

/**
 * Follow a link to the word-processing bookmark `name`
 * (`w:hyperlink@w:anchor`): the worker lays the document out as far as the
 * bookmark and lands the view on its start, its point by `alignment` — or on
 * the document's start where no bookmark has the name. The resulting scroll
 * rides back in the next {@link PageViewsReport}. Carries a `seq` as
 * {@link GoToPageRequest} does. Latest-wins, fire-and-forget.
 */
export interface GoToBookmarkRequest {
    type: "goToBookmark";
    name: string;
    alignment: ScrollAlignment;
    seq: number;
}

/**
 * Zoom to an explicit magnification keeping the content point under (`x`, `y`)
 * — a viewport point in device px — pinned on screen. The engine owns the
 * resulting scroll (exact at any step, unlike a host-computed scroll), so this
 * is how cursor-anchored wheel zoom and the zoom controls drive zoom. The new
 * scroll + zoom ride back in the next {@link PageViewsReport}; carries a `seq`
 * like {@link SetViewportRequest}. Latest-wins, fire-and-forget.
 */
export interface ZoomAtPointRequest {
    type: "zoomAtPoint";
    zoom: number;
    /** Viewport-space anchor in CSS px (the wasm boundary applies the dpr). */
    x: number;
    y: number;
    seq: number;
}

/**
 * Fit a viewport-space rectangle (`x`, `y`, `width`, `height` in CSS px — the
 * wasm boundary applies the dpr) to the viewport and centre it — the marquee
 * zoom. The engine derives the zoom
 * and resolves the scroll after re-arranging, so it stays correct across the
 * screen-fixed page spacing a host can't account for. The result rides back in
 * the next {@link PageViewsReport}; carries a `seq`. Latest-wins.
 */
export interface ZoomToRectRequest {
    type: "zoomToRect";
    x: number;
    y: number;
    width: number;
    height: number;
    seq: number;
}

/**
 * Switch the scroll mode: `"spread"` (one spread at a time) or `"continuous"`
 * (the scrolling stack default). Sticky like the backdrop/spacing — re-applied
 * to every subsequently opened document, keeping the current page in view on a
 * live switch. Latest-wins, fire-and-forget.
 */
export interface SetScrollModeRequest {
    type: "setScrollMode";
    mode: ScrollMode;
}

/**
 * Set how the layout groups pages into spreads. Sticky like the spacing —
 * re-applied to every subsequently opened document. Latest-wins,
 * fire-and-forget.
 */
export interface SetLayoutModeRequest {
    type: "setLayoutMode";
    mode: LayoutMode;
}

/**
 * Turn every page `quarterTurns` quarter turns clockwise (`0`–`3`) on top of
 * its own rotation — a view setting, never a document edit. Sticky like the
 * spacing — re-applied to every subsequently opened document. Latest-wins,
 * fire-and-forget.
 */
export interface SetPageRotationRequest {
    type: "setPageRotation";
    quarterTurns: number;
}

/** Mark a document-space region dirty; omit `rect` to invalidate everything. */
export interface InvalidateRequest {
    type: "invalidate";
    rect?: Rect;
}

/**
 * Toggle the worker's performance counter. When enabled the worker times each
 * painted frame and streams a {@link PerfReport} roughly once per second; when
 * disabled it swaps in the no-op counter so the hot path stays branchless.
 * Off until the first toggle. Latest-wins, fire-and-forget.
 */
export interface SetPerfRequest {
    type: "setPerf";
    enabled: boolean;
}

/**
 * Set the viewport backdrop color (the gaps around and between pages). Sticky:
 * the worker re-applies it to every subsequently opened document. Latest-wins,
 * fire-and-forget.
 */
export interface SetBackdropRequest {
    type: "setBackdrop";
    color: RgbColor;
}

/**
 * Set the page-border color: the 1-device-pixel frame the engine paints just
 * outside each page (typically the theme's outline, so the host recolors it per
 * theme) — or `null` to draw none, where the pages touch. Sticky like the
 * backdrop: re-applied to every subsequently opened document. Latest-wins,
 * fire-and-forget.
 */
export interface SetPageBorderRequest {
    type: "setPageBorder";
    color: RgbColor | null;
}

/**
 * Set how far, in CSS px, the brand decal sits in from the viewport's bottom and
 * right edges — the thickness of scrollbars floating over the canvas, or `0` to
 * tuck it flush into the corner. Sticky like the backdrop: re-applied to every
 * subsequently opened document. Latest-wins, fire-and-forget; the worker
 * re-posts the moved {@link BrandingRectReport}.
 */
export interface SetBrandingInsetRequest {
    type: "setBrandingInset";
    inset: number;
}

// NOTE: `SetGuideColorsRequest` / `SetRulerVisibleRequest` were removed — guide
// chrome is host-rendered now (colors are CSS, visibility is DOM), so nothing is
// pushed to the engine. The guide render list rides the {@link PageViewsReport}.

/**
 * Set the page arrangement's spacing: the `pageGap` between adjacent pages
 * (document points, page-fixed — across a spread and down from one spread to
 * the next) and the `contentPadding` on each edge of the content block
 * (page-fixed `pt` or screen-fixed `px`). Sticky like the backdrop: re-applied
 * to every subsequently opened document. Latest-wins, fire-and-forget.
 */
export interface SetSpacingRequest {
    type: "setSpacing";
    contentPadding: ContentPadding;
    pageGap: PageGap;
}

/**
 * Set the scrollbar size, in CSS px: the strip the engine keeps clear along the
 * right edge while the vertical bar shows and along the bottom while the
 * horizontal one does ({@link PageViewsReport.scrollbarX} / `scrollbarY` say
 * which show), or `0` for bars that float over the content. Sticky like the
 * spacing: re-applied to every subsequently opened document. Latest-wins,
 * fire-and-forget.
 */
export interface SetScrollbarSizeRequest {
    type: "setScrollbarSize";
    size: number;
}

/**
 * Set the fit: the viewer derives its own zoom to fit the current spread into
 * the viewport and re-derives it on resize. Its `mode` is `"none"` (zoom stays
 * explicit), `"width"`, `"height"`, `"both"` (contain) or `"either"` (cover);
 * its `zoomCap` caps the derived zoom (`null` uncapped, `1` to never enlarge
 * past natural size). While a fit is active the worker ignores the per-frame
 * zoom in {@link SetViewportRequest}; the derived zoom rides back in
 * {@link PageViewsReport}'s `scale`. Latest-wins, fire-and-forget.
 */
export interface SetFitRequest {
    type: "setFit";
    fit: Fit;
}

/**
 * Set the fit every document opens with in place of its doc type's default
 * ({@link defaultFitForDocType}); `null` restores the doc type's. Sticky like
 * the spacing. Latest-wins, fire-and-forget.
 */
export interface SetDefaultFitRequest {
    type: "setDefaultFit";
    fit: Fit | null;
}

/**
 * Set the screen's CSS px per physical inch — what the host calibrated so 100%
 * shows a page at its real size; `null` keeps each doc type's default
 * ({@link defaultDpiForDocType}). Sticky across opens. Latest-wins,
 * fire-and-forget.
 */
export interface SetDpiRequest {
    type: "setDpi";
    dpi: number | null;
}

/**
 * Set the explicit zoom every document opens at while the fit it opens with is
 * `none`. Latest-wins, fire-and-forget.
 */
export interface SetDefaultZoomRequest {
    type: "setDefaultZoom";
    zoom: number;
}

/**
 * The default fit a freshly-opened document adopts, by doc type, in the
 * boundary's fit modes (see {@link SetFitRequest}). Paged text (PDF/DOCX)
 * opens fit-to-width but capped at 1.0 — never enlarge a small page past
 * natural size (the old viewer's `fit-spread-width-max`); slides and images
 * open fit-to-page (contain), uncapped. A spreadsheet grid has no page to fit
 * — its canvas spans the whole sheet — so it opens at an explicit 100% (no
 * fit); the engine ignores fits for the grid regardless.
 *
 * One table, two consumers: the worker applies it at open, *before* the
 * first frame, so the very first painted pixels are already fitted (waiting
 * for the host's `setFit` to round-trip would flash the opening frames at
 * 100%); the shell adopts the same default into its fit state when the open
 * reply lands.
 */
export function defaultFitForDocType(docType: UDocType | undefined): Fit {
    switch (docType) {
        case "presentation":
        case "image":
            return { mode: "both", zoomCap: null };
        case "spreadsheet":
            return { mode: "none", zoomCap: null };
        default:
            return { mode: "width", zoomCap: 1 };
    }
}

/**
 * The CSS px per inch a document shows at while the host sets no dpi, by doc
 * type: a spreadsheet at 72, where 100% draws a point as a CSS px as Mac
 * Excel's 100% draws it as a screen pixel; anything else at 96, the CSS inch.
 * One table, two consumers, as {@link defaultFitForDocType}: the worker applies
 * it at open, before the first frame; the shell's pt ↔ CSS-px conversions read
 * the same default.
 */
export function defaultDpiForDocType(docType: UDocType | undefined): number {
    return docType === "spreadsheet" ? 72 : 96;
}

/**
 * Compose through page index `pageLimit` (inclusive), now — what a print or a
 * page render needs composed first; the worker composes the rest ahead on its
 * own (see {@link ComposedReport}). Replies with the document's grown layout
 * (composed page count + content size), plus `complete`: whether there is
 * anything left to compose. A page is known only once composed, so that flag
 * is the only way to learn the document's length.
 */
export interface UpdateLayoutRequest {
    type: "updateLayout";
    pageLimit: number;
}

/**
 * Kick the worker's font pump: start fetching whatever the engine currently has
 * on order. The web-font seam beside {@link UpdateLayoutRequest}.
 *
 * Replies as soon as the fetches are *started*, not when they land — the whole
 * point is that no message waits behind a network round trip. The worker
 * installs each batch as it arrives and repaints, and re-arms itself while
 * anything is still on order, so there is no round to drive and nothing to
 * report back. Send this whenever a layout change may have put new families on
 * order; sending it with nothing on order costs a message.
 */
export interface FetchFontOrdersRequest {
    type: "fetchFontOrders";
}

/**
 * Fetch what is on order, and reply once nothing is — in the air or waiting to
 * install: `true` if anything was, and the composed pages may have been laid
 * out again, else `false` at once. The reply waits; the worker doesn't.
 */
export interface SettleFontsRequest {
    type: "settleFonts";
}

/**
 * Get a font here before the edit that applies it, so the text changes once.
 *
 * Applying a family the document has never used lays the text out in a stand-in,
 * raises the font request then, and reflows when it lands. Sending this first
 * raises the request up front — straight to in-flight on the engine side, so the
 * pump never takes it and nothing re-shapes; the edit that follows is the only
 * thing that composes.
 *
 * Replies `true` when the font is here (immediately, if it already was, or
 * nothing is selected), and `false` when it gave up: no vendor has those
 * characters, or the wait ran past its cap. Either way the change should then be
 * applied — `false` only means it will look the way it always did.
 */
export interface EnsureFontRequest {
    type: "ensureFont";
    family: string;
    /**
     * The `(bold, italic)` faces the change will produce — usually one, more
     * when the selection spans faces, so the bold word in a paragraph gets its
     * own binary rather than reflowing on its own later.
     */
    faces: Array<[boolean, boolean]>;
}

/**
 * Read the document's plane roster — how many planes it has, which is current,
 * and each plane's display name, tab colour, whether it is a chartsheet and
 * its visibility. For a spreadsheet this is the sheet tabs (name, colour,
 * count, active sheet); for a single-plane doc type it's
 * `{ count: 1, current: 0, names: [""], colors: [null], chartsheets: [false], visibility: ["visible"] }`.
 * A pure read (no compose), pulled on open. Replies with a {@link PlaneInfo}.
 */
export interface PlaneInfoRequest {
    type: "planeInfo";
}

/**
 * Switch the current plane — the active sheet of a multi-sheet spreadsheet
 * (0-based). Resets the view to the new plane's top and replies with the layout
 * known before the frame composes the plane (page count + content size), as an
 * open does — the frame that paints it reports its extent. A no-op for a
 * single-plane doc type.
 */
export interface GoToPlaneRequest {
    type: "goToPlane";
    plane: number;
}

/** Release the open document (but keep the worker alive for the next open). */
export interface CloseRequest {
    type: "close";
}

/**
 * The document-wide history ops — `undo` / `redo`. They replay through the same
 * decode as a structural edit, so they too reply with a fresh layout.
 */
export type HistoryOp = "undo" | "redo";

/**
 * Apply a document-wide history op (`undo` / `redo`) — agnostic, not tied to any
 * page or selection. Replies with the document's new layout (page count +
 * content size), since undoing or redoing a structural edit can change the page
 * count.
 */
export interface HistoryRequest {
    type: "history";
    op: HistoryOp;
}

/**
 * Set a **text** selection from a pointer gesture between two points (CSS px,
 * canvas-relative): `anchor` where the press began, `focus` its live end (equal
 * for a click). `options` ({@link TextSelectOptions} — `granularity`, `extend`,
 * `global`) is optional per field. The host routes here after a
 * {@link HitTestRequest} says the anchor is over text. The resulting geometry
 * rides back in a {@link SelectionReport}. Fire-and-forget.
 */
export interface SelectTextRequest {
    type: "selectText";
    anchor: { x: number; y: number };
    focus: { x: number; y: number };
    options: TextSelectOptions;
}

/**
 * Set an **object** selection from a pointer gesture (CSS px): a click picks the
 * topmost object, a drag sweeps a marquee. `mode` is how the pick combines with
 * the current selection; `enclose` is the marquee's window rule (`true`
 * fully-contained only, `false` any-overlap). The object domain has no options
 * struct — these two cross directly. The host routes here when the anchor is over
 * an object or bare canvas. Geometry rides back in a {@link SelectionReport}.
 * Fire-and-forget.
 */
export interface SelectObjectsRequest {
    type: "selectObjects";
    anchor: { x: number; y: number };
    focus: { x: number; y: number };
    mode: SelectMode;
    enclose: boolean;
}

/**
 * Set a **cell** selection from a pointer gesture (CSS px) — a block on the
 * active sheet of a spreadsheet. `options` ({@link GridCellSelectOptions} —
 * `extend`) is optional. Geometry rides back in a {@link SelectionReport}.
 * Fire-and-forget.
 */
export interface SelectCellsRequest {
    type: "selectSheetCells";
    anchor: { x: number; y: number };
    focus: { x: number; y: number };
    options: GridCellSelectOptions;
}

/**
 * Set a **table cell** selection from a pointer gesture (CSS px) — a block
 * inside one graphic frame's table, the drawing cousin of
 * {@link SelectCellsRequest} (a worksheet's grid). `options`
 * ({@link TableSelectOptions} — `extend`) is optional.
 *
 * The host routes here when a {@link HitTestRequest} says the anchor is over a
 * table cell **and** the gesture means cells rather than text — a drag that has
 * crossed out of the cell it began in, or a Shift-press in another cell. A
 * gesture that stays within one cell is a {@link SelectTextRequest} against that
 * cell's own story instead, which is what puts a caret in a cell. Geometry rides
 * back in a {@link SelectionReport}. Fire-and-forget.
 */
export interface SelectTableCellsRequest {
    type: "selectTableCells";
    anchor: { x: number; y: number };
    focus: { x: number; y: number };
    options: TableSelectOptions;
}

/**
 * Select whole **columns** (top header band) / whole **rows** (left header band)
 * from a header gesture (CSS px). The resolving axis is the pointer's x for
 * columns / y for rows (the other coordinate is ignored). `options`
 * ({@link GridCellSelectOptions} — `extend`) is optional. Spreadsheet only; a no-op
 * otherwise. Geometry rides back in a {@link SelectionReport}. Fire-and-forget.
 */
export interface SelectColumnsRequest {
    type: "selectSheetColumns";
    anchor: { x: number; y: number };
    focus: { x: number; y: number };
    options: GridCellSelectOptions;
}

export interface SelectRowsRequest {
    type: "selectSheetRows";
    anchor: { x: number; y: number };
    focus: { x: number; y: number };
    options: GridCellSelectOptions;
}

/**
 * Select the whole sheet — a press on the header corner box. Spreadsheet only; a
 * no-op otherwise. Geometry rides back in a {@link SelectionReport}.
 * Fire-and-forget.
 */
export interface SelectAllRequest {
    type: "selectSheet";
}

/**
 * Widen the current **table** selection to the whole rows / columns it touches,
 * or to the whole table — the right-click Select ▸ Row / Column / Table
 * commands.
 *
 * Point-free, unlike every other picker here: a table has no header band to
 * press, so the gesture is a menu command over whatever is already picked (a
 * caret in a cell widens to its row). A no-op when the selection is not inside
 * a table. Geometry rides back in a {@link SelectionReport}. Fire-and-forget.
 */
export interface SelectTableRowsRequest {
    type: "selectTableRows";
}

export interface SelectTableColumnsRequest {
    type: "selectTableColumns";
}

export interface SelectWholeTableRequest {
    type: "selectTable";
}

/**
 * Move the text caret per a keyboard movement (arrows / Home / End),
 * extending the selection when Shift is held. Presence only, like
 * {@link SelectTextRequest}; the fresh geometry arrives via the selection
 * stream. `movement` is the {@link TextCaretMove} string the boundary decodes
 * straight into the engine's caret-move vocabulary.
 */
export interface MoveTextCaretRequest {
    type: "moveTextCaret";
    movement: TextCaretMove;
    extend: boolean;
}

/**
 * Clear the selection (e.g. on leaving edit mode). The now-empty geometry
 * rides back in a {@link SelectionReport}. Fire-and-forget.
 */
export interface ClearSelectionRequest {
    type: "clearSelection";
}

/**
 * Pick at a viewport point (CSS px, canvas-relative): the whole hit as a
 * {@link UDocHit} — the entity under the point and, for a text object, its caret
 * — the one read behind the host's hover cursor (the I-beam over text) and click
 * routing. Reads the live layout (no cached set to invalidate as edits /
 * collaborators change it) and is the same query a click routes on, so the cursor
 * can't disagree with what a click does. The host calls it **latest-wins** on
 * pointer move — one in flight, stale replies dropped. Replies the parsed
 * {@link UDocHit} (`"none"` with no open document). A read — no repaint, no report.
 */
export interface HitTestRequest {
    type: "hitTest";
    x: number;
    y: number;
}

/**
 * Allocate one fresh, CRDT-safe id (its 32-char hex key) for a host building a
 * new object to insert — a read, not an edit. The host stamps it into the
 * object's `id`, then issues an {@link InsertObjectRequest}. Replies with the
 * hex key, or `null` with no open document / a doc type that mints no ids.
 */
export interface MintIdRequest {
    type: "mintId";
}

/**
 * Read the id (hex key) of the portable page at `index` — a pure read. Replies
 * with the id, or `undefined` past the last page or with no open PDF.
 */
export interface PageIdByIndexRequest {
    type: "pageIdByIndex";
    index: number;
}

/**
 * Read the ids (hex keys) of every portable page, in page order — a pure read.
 * Replies with the list; empty with no open PDF.
 */
export interface PageIdsRequest {
    type: "pageIds";
}

/**
 * Read the portable document's `/PageMode` — how it asks to be shown when it
 * opens. Replies with the mode, or `null` when the file gives none (or no PDF
 * is open).
 */
export interface PageModeRequest {
    type: "pageMode";
}

/**
 * The next batch of `query`'s matches in `scope` — the open doc type's, or the
 * whole document when null — from `from`, the continuation the batch before
 * handed back, or from the start when null. Stateless: the worker keeps nothing
 * between batches. Replies with a {@link SearchReply}.
 */
export interface SearchRequest {
    type: "search";
    query: string;
    options: SearchOptions;
    scope: UDocSearchScope | null;
    from: SearchContinuation | null;
}

/**
 * A {@link SearchRequest}'s answer: the batch, and the layout after it — a
 * search lays out the pages its matches are drawn on, so the page count and
 * extent may have grown.
 */
export interface SearchReply {
    batch: SearchBatch;
    layout: DocumentLayout;
}

/**
 * The selection naming the text of the match found at `location` — the
 * separate step from a match to a selection. Replies with the
 * `UDocSelection`, or null when nothing there can be selected.
 */
export interface SearchMatchSelectionRequest {
    type: "searchMatchSelection";
    location: SearchMatchLocation;
}

/**
 * Read the portable document's outline — its bookmarks, loaded on first read.
 * Replies with the `Outline`; one with no items when the document has none (or
 * no PDF is open).
 */
export interface OutlineRequest {
    type: "outline";
}

/**
 * Read the portable document's font list — every font it has, loaded on first
 * read. Replies with the `FontInfoList`; one with no fonts when no PDF is open.
 */
export interface FontInfoListRequest {
    type: "fontInfoList";
}

/**
 * Read the portable document's interactive form — its terminal fields, each
 * naming its widget annotations, loaded on first read. Replies with the
 * `AcroForm`; one with no fields when the document has none or no PDF is open.
 */
export interface AcroFormRequest {
    type: "acroForm";
}

/**
 * Read the form field the widget annotation `widget` on page `page` (their hex
 * keys) belongs to, as the form holds it now, with the widget. Replies with a
 * {@link FormWidget}, or `null` when no field lists the widget or the page's
 * annotations don't. What filling the field in starts from.
 */
export interface FormWidgetRequest {
    type: "formWidget";
    page: string;
    widget: string;
}

/** A form field and one of its widgets: the field as the form holds it, the
 *  index of the widget's page, the widget's rect in page space, and the name of
 *  the state the widget shows when on — a check box's or radio button's, the
 *  one its appearance has besides `Off` — else `null`. */
export interface FormWidget {
    field: AcroFormField;
    index: number;
    rect: Annotation["rect"];
    on: string | null;
}

/**
 * Read the portable document's optional content properties — its layers and
 * the configurations that set them, loaded on first read. Replies with the
 * `OptionalContentProperties`, or `null` with no PDF open.
 */
export interface OptionalContentPropertiesRequest {
    type: "optionalContentProperties";
}

/**
 * Read which optional content groups are OFF now — session state, not the
 * document's. Replies with their ids (hex keys); every other group is ON. Empty
 * with no PDF open.
 */
export interface OptionalContentOffRequest {
    type: "optionalContentOff";
}

/**
 * Switch the optional content group `id` (its hex key) ON or OFF, as a layers
 * panel does: a locked group doesn't switch, and turning one ON turns the others
 * of its radio groups OFF. The composed pages recompose and repaint. Replies
 * with whether any group changed.
 */
export interface SetOptionalContentGroupOnRequest {
    type: "setOptionalContentGroupOn";
    id: string;
    on: boolean;
}

/**
 * Run a hide action: hide each of `targets` — its `/T` — or show it where
 * `hide` is `false`. Session state held as a layer's is: the composed pages
 * recompose and repaint. Replies with whether any annotation changed.
 */
export interface HideAnnotationsRequest {
    type: "hideAnnotations";
    targets: ActionHideTarget[];
    hide: boolean;
}

/**
 * Read the size (document points) of page `index` — a doc-type-agnostic pure
 * read (slides, PDF pages, image frames all answer). Replies with a
 * {@link import("../geometry.js").Size}; the thumbnail strip shapes and scales
 * a preview from it. Composes the page if needed. Returns a zero size when the
 * page is out of range / not composed, so a read degrades to "unknown".
 */
export interface PageSizeRequest {
    type: "pageSize";
    index: number;
}

/**
 * Read the 32-char hex keys of the currently-selected graphics objects (empty
 * when nothing is selected) — a read, the inverse of {@link SelectObjectsByIdRequest}.
 * Lets a host act on the current selection by id, e.g. adopt a peer's selection.
 */
export interface SelectedObjectsRequest {
    type: "selectedObjects";
}

/**
 * Read the annotations the selection holds — their values, not just their ids —
 * with the page they are on. Replies with {@link SelectedAnnotations}, or `null`
 * when the selection isn't a portable annotation selection. What the Annotate
 * tab's Format controls show, and what a restyle edits and sends back.
 */
export interface SelectedAnnotationsRequest {
    type: "selectedAnnotations";
}

/**
 * Read the annotations of each page in `pages` (their hex keys) — loading a
 * page's annotations part through the page list when it isn't yet, composed or
 * not — with the rich contents of each. Replies with {@link PageComments}[], one
 * per page that has annotations, in the order asked. What the comment threads
 * are built from: the selected annotation's page for its popup, every page for
 * the comments panel.
 */
export interface PageCommentsRequest {
    type: "pageComments";
    pages: string[];
}

/**
 * Read the annotations of each page in `pages` (their hex keys), loading each
 * page's annotations part as {@link PageCommentsRequest} does — without their
 * appearances. Replies with {@link PageAnnotations}[], one per page that has
 * annotations, in the order asked. What the host's page-annotation calls and
 * events read.
 */
export interface PageAnnotationsRequest {
    type: "pageAnnotations";
    pages: string[];
}

/**
 * Read annotation `id` of page `page` (its hex key) whole, its appearance with
 * it. Replies with the {@link Annotation}, or `null` where the page holds none
 * of that id. What keeps a stamp's picture through a host's update.
 */
export interface AnnotationRequest {
    type: "annotation";
    page: string;
    id: string;
}

/**
 * Read the local selection's geometry — the boxes, text quads and caret its
 * reports carry — as the worker has it once every message sent before this one
 * is applied. Replies with a {@link SelectionGeometry}. A read that waits on the
 * last pointer select, which a report streamed during a drag doesn't: marking
 * the text a drag selected reads its final quads here.
 */
export interface SelectionGeometryRequest {
    type: "selectionGeometry";
}

/** The selected annotations and the page they are on — its hex key, and its
 *  index — in the page's paint order, with the rich contents of each: XHTML,
 *  its `/RC`, else its `/Contents` a paragraph a line. */
export interface SelectedAnnotations {
    page: string;
    index: number;
    annotations: Annotation[];
    /** The rich contents of the annotation at the same index. */
    richContents: string[];
}

/** A page's annotations — its hex key and its index — in paint order, without
 *  their appearances. */
export interface PageAnnotations {
    page: string;
    index: number;
    annotations: Annotation[];
}

/** A page's annotations — its hex key and its index — in paint order, without
 *  their appearances, with the rich contents of each: XHTML, its `/RC`, else
 *  its `/Contents` a paragraph a line. */
export interface PageComments {
    page: string;
    index: number;
    annotations: Annotation[];
    /** The rich contents of the annotation at the same index. */
    richContents: string[];
}

/**
 * Select the graphics objects named by `ids` (their 32-char hex keys) — the
 * programmatic, id-addressed counterpart of {@link SelectObjectsRequest}'s
 * pointer pick. Presence only (no edit), so the new geometry rides back in a
 * {@link SelectionReport} with `localChanged: true`, exactly like a pointer
 * select — the cue to broadcast presence to peers. Unknown ids are skipped; an
 * empty list clears the selection. Fire-and-forget.
 */
export interface SelectObjectsByIdRequest {
    type: "selectObjectsById";
    /** The 0-based index of the page the objects sit on — a portable selection is
     *  confined to one page, so the page rides with the ids (the worker resolves
     *  the index to the page's stable id). Ignored when `ids` is empty (a clear). */
    page: number;
    /** The 32-char hex keys of the objects to select. */
    ids: string[];
}

/**
 * Read the elements of page `page` on the current plane that play media, each
 * with its box in page-local points. Replies with the parsed
 * {@link import("@docmentis/udoc-wasm").ComposedShapeMedia} list — empty for a
 * page not composed, one that plays nothing, or with no open presentation.
 */
export interface PageMediaRequest {
    type: "pageMedia";
    page: number;
}

/**
 * Read the media file `media` (its hex key) — the audio or video a player
 * plays, as an element's `media.data` names it — loaded on first read. Replies with a {@link MediaFile},
 * its buffer transferred, or `null` with no open presentation or no such file.
 */
export interface MediaDataRequest {
    type: "mediaData";
    media: string;
}

/** A media file as a player takes it: its bytes, and the content type the
 *  package declared for them. */
export interface MediaFile {
    bytes: ArrayBuffer;
    contentType: string;
}

/**
 * Read the id (hex key) of the spreadsheet sheet at tab position `index` — a
 * pure read. A plane is a sheet, in tab order, so the host passes its current
 * plane. Replies with the id, or `undefined` past the last sheet or with no open
 * spreadsheet.
 */
export interface SheetIdByIndexRequest {
    type: "sheetIdByIndex";
    index: number;
}

/**
 * Set the selection to a doc-type-tagged {@link import("@docmentis/udoc-wasm").UDocSelection}
 * — the agnostic, id-addressed presence path (the doc-type-neutral counterpart
 * of {@link SelectObjectsByIdRequest}, used for presentation shapes and any other
 * doc type). Presence only (no edit): the new geometry rides back in a
 * {@link SelectionReport} with `localChanged: true`. Fire-and-forget.
 */
export interface SetSelectionRequest {
    type: "setSelection";
    selection: UDocSelection;
}

/**
 * Read the current selection as the tagged
 * {@link import("@docmentis/udoc-wasm").UDocSelection} (or `null` when
 * nothing is selected / no document) — the doc-type-agnostic read a host uses
 * to see the selection whatever the doc type, unlike the portable-only
 * {@link SelectedObjectsRequest}.
 */
export interface SelectionReadRequest {
    type: "selection";
}

/**
 * Capture the current selection as a {@link import("@docmentis/udoc-wasm").UDocFragment}
 * for the system clipboard — a pure read, in view mode as in edit. Replies with
 * the doc-type-tagged fragment, or `null` when nothing copyable is selected.
 * The host writes the fragment as our own flavor and projects the other
 * flavors from it (see {@link PlainTextRequest} for `text/plain`); for a cut it
 * follows with a delete {@link ExecuteOnSelectionRequest}.
 */
export interface CopyRequest {
    type: "copy";
}

/**
 * Project a copied {@link import("@docmentis/udoc-wasm").UDocFragment} to
 * plain text — the `text/plain` clipboard flavor beside our own format, so a
 * paste into any other app gets readable text, not our JSON. Replies with the
 * string (empty when the fragment carries no text). A pure read; pairs with
 * {@link CopyRequest} (a future `html` projection joins it).
 */
export interface PlainTextRequest {
    type: "plainText";
    fragment: UDocFragment;
}

/**
 * A z-order gesture — bring-to-front / send-to-back (the extremes) and the
 * one-step forward / backward moves. The string values match the Rust
 * `ObjectZOrder` / `ShapeZOrder` serde (`camelCase`), so they ride straight into
 * the `ReorderObjects` / `ReorderShapes` command.
 */
export type ZOrder = "front" | "back" | "forward" | "backward";

/**
 * The edge (or center line) a {@link SelectionEdit} `align` pulls each selected
 * object's bounding box to. The string values match the Rust `ObjectAlignEdge` /
 * `ShapeAlignEdge` serde (`camelCase`), so they ride straight into
 * `AlignObjects` / `AlignShapes`.
 */
export type AlignEdge = "left" | "centerX" | "right" | "top" | "centerY" | "bottom";

/**
 * The axis a {@link SelectionEdit} `flip` / `distribute` acts along — the Rust
 * `ObjectAxis` / `ShapeAxis` serde (`camelCase`).
 */
export type EditAxis = "horizontal" | "vertical";

/**
 * A selection-relative edit — one that acts on *whatever is selected right now*
 * rather than on a named id, so it can't be addressed as a plain
 * {@link ExecuteRequest} from the main thread without a selection round-trip.
 * The worker tags it with the open doc type — turning it into the externally
 * tagged wire form on the way — and the engine resolves the
 * live selection to its ids and the matching command (a portable object or
 * annotation command, a shape command). Some
 * kinds originate from a
 * direct-manipulation drag (translate / rotate / scale), others from a menu
 * command (delete / reorder / group / ungroup) — what they share is the
 * current-selection target, not a gesture. Each commits one undo step.
 *
 * Each edit is named after what it acts on, as its command is: a PDF's page
 * objects (`translateObjects`) or annotations (`translateAnnotations`), a
 * drawing's shapes (`translateShapes`) — a slide's shapes, or a docx drawing's.
 * A PDF's edits travel in their family's wrapper — `{ kind: "object", edit }`,
 * `{ kind: "annotation", edit }` — a free text's drawing text edits in a
 * `{ kind: "common", edit }` inside the annotation one. The shell emits the one
 * matching the open doc type and the selection.
 */
export type SelectionEdit =
    /** PDF: translate every selected object by `(dx, dy)` page-local points — a move drag. */
    | { kind: "translateObjects"; dx: number; dy: number }
    /** PDF: rotate every selected object by `angle` radians about its **own** bounds-center. */
    | { kind: "rotateEachObject"; angle: number }
    /** PDF: scale every selected object by `(sx, sy)` about its **own** anchor, the
     *  held-fixed corner given as bounds fractions (`0` top/left … `1` bottom/right). */
    | { kind: "scaleEachObject"; sx: number; sy: number; anchorX: number; anchorY: number }
    /** PDF: delete the selected objects; the selection clears afterward. */
    | { kind: "deleteObjects" }
    /** PDF: reorder the selected objects within their sibling list (Arrange ▸ z-order). */
    | { kind: "reorderObjects"; order: ZOrder }
    /** PDF: group the selected objects under a new (engine-minted) group. */
    | { kind: "groupObjects" }
    /** PDF: ungroup the selected group(s), hoisting their children into place. */
    | { kind: "ungroupObjects" }
    /** PDF: align the selected objects' bounding boxes to a shared `edge` of either
     *  their own union (`toPage: false`) or the page (`toPage: true`). */
    | { kind: "alignObjects"; edge: AlignEdge; toPage: boolean }
    /** PDF: distribute the selected objects evenly along `axis` (their gaps equalized). */
    | { kind: "distributeObjects"; axis: EditAxis }
    /** PDF: mirror each selected object in place about its own center, along `axis`. */
    | { kind: "flipObjects"; axis: EditAxis }
    /** PDF: translate every selected annotation by `(dx, dy)` page points. */
    | { kind: "translateAnnotations"; dx: number; dy: number }
    /** PDF: resize every selected annotation by `(sx, sy)` about its own anchor. */
    | { kind: "resizeAnnotations"; sx: number; sy: number; anchorX: number; anchorY: number }
    /** PDF: delete the selected annotations; the selection clears afterward. */
    | { kind: "deleteAnnotations" }
    /** PDF: reorder the selected annotations among the page's annotations. */
    | { kind: "reorderAnnotations"; order: ZOrder }
    /** Shapes: the twin of `translateObjects`. */
    | { kind: "translateShapes"; dx: number; dy: number }
    /** Shapes: the twin of `rotateEachObject`. */
    | { kind: "rotateEachShape"; angle: number }
    /** Shapes: the twin of `scaleEachObject`. */
    | { kind: "scaleEachShape"; sx: number; sy: number; anchorX: number; anchorY: number }
    /** Shapes: the twin of `deleteObjects`. */
    | { kind: "deleteShapes" }
    /** Shapes: the twin of `reorderObjects`. */
    | { kind: "reorderShapes"; order: ZOrder }
    /** Shapes: the twin of `groupObjects`. */
    | { kind: "groupShapes" }
    /** Shapes: the twin of `ungroupObjects`. */
    | { kind: "ungroupShapes" }
    /** Shapes: the twin of `alignObjects`, `toPage` aligning to the slide. */
    | { kind: "alignShapes"; edge: AlignEdge; toPage: boolean }
    /** Shapes: the twin of `distributeObjects`. */
    | { kind: "distributeShapes"; axis: EditAxis }
    /** Shapes: the twin of `flipObjects`. */
    | { kind: "flipShapes"; axis: EditAxis }
    // Fill / Stroke — the picker's paint applied to the selection. The payload is
    // the doc type's own model style, built by the host (like `insertObject`), so
    // the variant differs by open format: a presentation carries the `DrawingML`
    // `Fill` / `Line`; a PDF carries the non-stroking / stroking `Style`. The
    // shell emits the one matching the open doc type.
    /** Presentation: set the shapes' interior fill. */
    | { kind: "setShapeFill"; fill: PaintFill }
    /** Presentation: set the shapes' outline. */
    | { kind: "setShapeLine"; line: PaintLine }
    /** Presentation: drag adjust handle `index` of the selected shape to `to`, a
     *  point in that shape's **own local space** — the geometry-reshaping drag
     *  (a rounded rectangle's corner, an arrow's head). Reshapes one geometry,
     *  so it needs a single-shape selection. */
    | { kind: "adjustShapeHandle"; index: number; to: { x: number; y: number } }
    /** PDF: set the paths' non-stroking (fill-side) style. */
    | { kind: "setNonstrokingStyle"; style: NonstrokingStyle }
    /** PDF: set the paths' stroking (outline) style. */
    | { kind: "setStrokingStyle"; style: StrokingStyle }
    /** Text: insert text at the text caret / range — typing, an IME commit, a
     *  paste. Newlines split paragraphs (Enter is `text: "\n"`); the caret lands
     *  after the insertion. Wrapped per doc type by the worker (a slide shape's
     *  text, a doc body). */
    | { kind: "insertText"; text: string }
    /** Text: delete at the text caret / range — a range deletes it, a collapsed
     *  caret deletes forward (Delete) or backward (Backspace). */
    | { kind: "deleteText"; forward: boolean }
    /** PDF: insert text at the caret / range in a page text object — typing, an
     *  IME commit, a paste. A newline splits the line (Enter is `text: "\n"`). */
    | { kind: "insertObjectText"; text: string }
    /** PDF: delete at the caret / range in a page text object, like `deleteText`. */
    | { kind: "deleteObjectText"; forward: boolean }
    /** PDF: an object edit (`translateObjects`, `insertObjectText`, …) on the
     *  selected objects, or at the caret in a page text object. */
    | { kind: "object"; edit: SelectionEdit }
    /** PDF: an annotation edit (`translateAnnotations`, `common`, …) on the
     *  selected annotations, or on the free text the caret sits in. */
    | { kind: "annotation"; edit: SelectionEdit }
    /** PDF: a drawing text edit (`insertText`, `deleteText`, …) at the caret in
     *  a free text, inside an `annotation` edit. */
    | { kind: "common"; edit: SelectionEdit }
    // Text character formatting — the Text tab's controls (bold / italic /
    // underline / strikethrough / a font / a size / a text color / a highlight)
    // over the current text selection, for presentation + wordprocessing (the
    // shared text engine). `properties` are set-values overlaid on the selected
    // spans; the selection is kept, so toggles chain.
    /** Text: overlay character properties onto the text selection (a set-value
     *  edit). */
    | { kind: "setCharacterProperties"; properties: TextCharacterProperty[] }
    /** Text: reset each of `keys` to inherited on the text selection — clear
     *  direct character formatting. */
    | { kind: "clearCharacterProperties"; keys: TextCharacterPropertyKey[] }
    // Text paragraph formatting — the Text tab's paragraph controls (align /
    // line and paragraph spacing / the two list toggles). Their unit is the
    // paragraphs the selection *touches*, not the spans it covers, so unlike the
    // character edits above they act on a bare caret too.
    /** Text: overlay paragraph properties onto every paragraph the text selection
     *  touches (a set-value edit). */
    | { kind: "setParagraphProperties"; properties: TextParagraphProperty[] }
    /** Text: reset each of `keys` to inherited on those paragraphs — clear direct
     *  paragraph formatting back to the style value. */
    | { kind: "clearParagraphProperties"; keys: TextParagraphPropertyKey[] }
    /** Text: step those paragraphs' indent by `delta` levels — Increase /
     *  Decrease Indent. Relative rather than a measure, so each paragraph steps
     *  from its own value and the engine decides what one step means for it. */
    | { kind: "indentParagraphs"; delta: number }
    /** Table: a structural edit on the table the selection sits in — insert or
     *  delete a row or column, merge or split the selected block. The tsify type
     *  itself, already in its wire form (`{ insertRows: { before, count } }`,
     *  `"deleteRows"`): `deleteRows` is a kind of its own, not `delete` (which
     *  deletes the frame holding the table), and the engine binds it to the
     *  innermost table the selection is in. A cell's **text** is not here — a caret in a cell is
     *  an ordinary text edit and rides the text kinds above. */
    | TableSelectionEdit;

/**
 * Apply a {@link SelectionEdit} to the current selection — the move / rotate /
 * scale / delete / reorder / group / ungroup the canvas and ribbon drive. A
 * committing edit (one undo step), so it replies with the document's layout like
 * {@link HistoryRequest}, schedules a repaint, and re-posts the selection
 * geometry in a {@link SelectionReport}.
 */
export interface ExecuteOnSelectionRequest {
    type: "executeOnSelection";
    edit: SelectionEdit;
}

/**
 * Execute one arbitrary, doc-type-tagged {@link import("@docmentis/udoc-wasm").UDocCommand}
 * directly — the generic write seam beneath the typed verbs above, exposed for
 * a host that builds its own commands rather than calling a named method. The
 * command object passes to the wasm `execute` as is, which reads it through
 * its JSON. A committing edit — one command, one undo step — so it replies
 * with the document's layout, schedules a repaint, and re-posts the selection
 * in a {@link SelectionReport}.
 */
export interface ExecuteRequest {
    type: "execute";
    command: UDocCommand;
}

/**
 * Serialize the session's CRDT for sync with a peer. Replies with the bytes
 * (an `ArrayBuffer`) to feed another session's {@link MergeRequest}.
 */
export interface SnapshotRequest {
    type: "snapshot";
}

/**
 * Save the open document as `format`, faithfully — the bytes reopen as the same
 * document. Replies with the bytes (an `ArrayBuffer`).
 */
export interface SaveToBytesRequest {
    type: "saveToBytes";
    format: FileFormat;
    /** How much of the file the document was opened from the saved bytes keep; absent, the engine's for `format`. */
    strategy?: SaveStrategy;
}

/**
 * Read the file the open document was opened from, byte for byte, whatever has
 * been edited since. Replies with the bytes (an `ArrayBuffer`).
 */
export interface OriginalBytesRequest {
    type: "originalBytes";
}

/**
 * Save the open document as a udoc package — the bytes of a `.udoc` zip.
 * `version` makes it a checkpoint, baseline `v<version>`, which keeps the edit
 * log a reopen replays; absent, the package is a flat baseline. Replies with
 * the bytes (an `ArrayBuffer`).
 */
export interface SaveToPackageRequest {
    type: "saveToPackage";
    version?: number;
}

/**
 * Export the open document as `format` — a rendering of its laid-out pages,
 * fixed and one-way. Replies with the bytes (an `ArrayBuffer`).
 */
export interface ExportToBytesRequest {
    type: "exportToBytes";
    format: ExportFormat;
}

/**
 * Export page `index` (0-based) of the primary plane as `format`, the page
 * composed already. Replies with the bytes (an `ArrayBuffer`).
 */
export interface ExportPageToBytesRequest {
    type: "exportPageToBytes";
    index: number;
    format: PageExportFormat;
}

/**
 * Set this client's collaborator user info (currently a display name) — the
 * label peers draw on its selection. Sticky in the worker (re-applied to every
 * document opened later, like the backdrop), so it survives a re-open. Rides
 * the presence channel with the selection; the worker re-posts a
 * {@link SelectionReport} with `localChanged: true` so the host re-broadcasts
 * {@link PresenceRequest} and peers pick the name up even without a selection
 * change. Fire-and-forget.
 */
export interface SetUserInfoRequest {
    type: "setUserInfo";
    name: string;
}

/**
 * Serialize the session's presence (its selection) for sync with a peer — the
 * transient channel beside {@link SnapshotRequest}: last-write-wins, no
 * history, never part of a save. Replies with the bytes to feed another
 * session's {@link MergePresenceRequest}.
 */
export interface PresenceRequest {
    type: "presence";
}

/**
 * Merge a peer's {@link PresenceRequest} bytes. Engine- and repaint-free;
 * the refreshed peer selections ride back in a {@link SelectionReport} (with
 * `localChanged: false`, so a presence-sync listener can't ping-pong).
 */
export interface MergePresenceRequest {
    type: "mergePresence";
    data: ArrayBuffer;
}

/**
 * Set where this client's pointer rests from canvas-local CSS px `(x, y)` — the
 * page under it and the point in that page's local space — or delete it when the
 * point is off every page. Presence only. Replies with the bytes of that one
 * entry (an `ArrayBuffer`), to send as a presence: a pointer set on every move
 * travels alone.
 */
export interface SetPointerRequest {
    type: "setPointer";
    x: number;
    y: number;
}

/** Delete this client's pointer. Replies with the bytes of the deletion, as {@link SetPointerRequest}. */
export interface ClearPointerRequest {
    type: "clearPointer";
}

/**
 * Keep this client present: stamp its own presence entries anew and drop the
 * peers' that went quiet past the presence timeout — those that vanished without
 * leaving. Peers dropped ride out in a {@link SelectionReport}, a
 * {@link PeersReport} and a {@link PeerPointersReport}, each posted only when it
 * changed.
 */
export interface RefreshPresenceRequest {
    type: "refreshPresence";
}

/**
 * Leave the presence channel: replies with the bytes deleting this client's
 * entries (an `ArrayBuffer`), for the peers, and forgets every peer's here —
 * reported as for {@link RefreshPresenceRequest}.
 */
export interface WithdrawPresenceRequest {
    type: "withdrawPresence";
}

/**
 * Read the session's version vector — the per-peer op counts it holds. Replies
 * with the bytes (an `ArrayBuffer`); hand them to a peer's
 * {@link PatchSinceRequest} so it answers with only the ops this session lacks.
 */
export interface VersionVectorRequest {
    type: "versionVector";
}

/**
 * Compute the ops this session holds that the peer — identified by its
 * {@link VersionVectorRequest} bytes — does not. Replies with a patch (an
 * `ArrayBuffer`) to feed that peer's {@link MergeRequest}: the incremental
 * alternative to shipping a whole {@link SnapshotRequest}.
 */
export interface PatchSinceRequest {
    type: "patchSince";
    peer: ArrayBuffer;
}

/**
 * Merge a peer's {@link SnapshotRequest} or {@link PatchSinceRequest} bytes into
 * this session. Replies with the document's new layout (the remote edits may
 * have changed page count).
 */
export interface MergeRequest {
    type: "merge";
    data: ArrayBuffer;
}

/**
 * The content of every opaque part — an inserted picture's image — the peer,
 * identified by its {@link VersionVectorRequest} bytes, lacks. Replies with the
 * bytes (an `ArrayBuffer`, empty when there is nothing to send) to send ahead
 * of the {@link PatchSinceRequest} patch that names them.
 */
export interface OpaquePartsSinceRequest {
    type: "opaquePartsSince";
    peer: ArrayBuffer;
}

/**
 * Create each part a peer's {@link OpaquePartsSinceRequest} carries, to pass on
 * in turn. Replies with the document's layout.
 */
export interface MergeOpaquePartsRequest {
    type: "mergeOpaqueParts";
    data: ArrayBuffer;
}

/**
 * Rasterize page `index` (0-based) to a premultiplied-RGBA8 bitmap at `scale`
 * (output pixels per document point — 1.0 == 72 DPI), now: a one-off preview —
 * a slide layout's, a page to print. An off-viewport CPU raster, wholly
 * separate from the painted frame: a pure read, no document state change and
 * no repaint. Replies with a {@link ThumbnailResult} whose pixel buffer is
 * transferred. The thumbnail strip queues its renders instead
 * ({@link QueueThumbnailRequest}), for the worker to run when the reader leaves
 * it a moment.
 */
export interface RenderThumbnailRequest {
    type: "renderThumbnail";
    /** The layout plane to render — `0` is the slide plane (the thumbnail
     *  strip); `1..` a slide-master plane (the New-Slide picker's layout
     *  previews). Required, mirroring the plane-leading wasm `renderPageToRgba`;
     *  the slide-plane strip passes `0` explicitly. */
    plane: number;
    index: number;
    scale: number;
    /** Draw the ephemeral annotations — shown, never saved. Absent draws them;
     *  a print sends `false`, leaving them out. */
    ephemeral?: boolean;
}

/**
 * Queue a thumbnail-strip render of page `index` (0-based) on the slide plane at
 * `scale`, as a {@link RenderThumbnailRequest} renders it. The worker runs it
 * as background work — once the reader has been quiet a moment, nearest the
 * strip's focus ({@link ThumbnailFocusRequest}) first — and replies with the
 * {@link ThumbnailResult}, or `null` when the render was dropped before it ran:
 * replaced by a later request for the page, cancelled, or dropped with the rest.
 */
export interface QueueThumbnailRequest {
    type: "queueThumbnail";
    index: number;
    scale: number;
}

/** Drop the queued render of page `index`, if it hasn't run; it replies `null`. */
export interface CancelThumbnailRequest {
    type: "cancelThumbnail";
    index: number;
}

/** Drop every queued thumbnail render — the document changed; each replies `null`. */
export interface DropThumbnailsRequest {
    type: "dropThumbnails";
}

/**
 * The page the thumbnail strip is centred on: queued renders nearest it run
 * first. A hint, taken as it arrives rather than in turn, and never answered.
 */
export interface ThumbnailFocusRequest {
    type: "thumbnailFocus";
    page: number;
}

/**
 * The reader touched the shell — a pointer, a key, a wheel. Background work
 * waits for the reader to have been quiet a moment, so a hover or a keystroke
 * doesn't land behind it. A hint, taken as it arrives rather than in turn, and
 * never answered; the host posts it at most every few tens of ms.
 */
export interface ReaderActivityRequest {
    type: "readerActivity";
}

/**
 * The reply payload of a {@link RenderThumbnailRequest}: the premultiplied
 * RGBA8 pixels (`width * height * 4` bytes, row-major, Y-down — its backing
 * `ArrayBuffer` is transferred, not copied) plus the dimensions the renderer
 * chose. The host wraps `rgba` in an `ImageData` of those dimensions and
 * `createImageBitmap`s it.
 */
export interface ThumbnailResult {
    rgba: ArrayBuffer;
    width: number;
    height: number;
}

export type WorkerRequest =
    | InitRequest
    | StartRequest
    | AttachRequest
    | RegisterFontsRequest
    | OpenRequest
    | OpenRemoteRequest
    | AuthenticateRequest
    | SetViewportRequest
    | GoToPageRequest
    | GoToRectRequest
    | GoToDestinationRequest
    | GoToBookmarkRequest
    | ZoomAtPointRequest
    | ZoomToRectRequest
    | SetScrollModeRequest
    | SetLayoutModeRequest
    | SetPageRotationRequest
    | InvalidateRequest
    | SetPerfRequest
    | SetBackdropRequest
    | SetPageBorderRequest
    | SetBrandingInsetRequest
    | SetSpacingRequest
    | SetScrollbarSizeRequest
    | SetFitRequest
    | SetDefaultFitRequest
    | SetDpiRequest
    | SetDefaultZoomRequest
    | UpdateLayoutRequest
    | FetchFontOrdersRequest
    | SettleFontsRequest
    | EnsureFontRequest
    | PlaneInfoRequest
    | GoToPlaneRequest
    | RenderThumbnailRequest
    | QueueThumbnailRequest
    | CancelThumbnailRequest
    | DropThumbnailsRequest
    | ThumbnailFocusRequest
    | ReaderActivityRequest
    | CloseRequest
    | HistoryRequest
    | SelectTextRequest
    | SelectObjectsRequest
    | SelectCellsRequest
    | SelectTableCellsRequest
    | SelectTableRowsRequest
    | SelectTableColumnsRequest
    | SelectWholeTableRequest
    | SelectColumnsRequest
    | SelectRowsRequest
    | SelectAllRequest
    | MoveTextCaretRequest
    | ClearSelectionRequest
    | HitTestRequest
    | MintIdRequest
    | PageIdByIndexRequest
    | PageIdsRequest
    | PageModeRequest
    | OutlineRequest
    | SearchRequest
    | SearchMatchSelectionRequest
    | FontInfoListRequest
    | AcroFormRequest
    | FormWidgetRequest
    | OptionalContentPropertiesRequest
    | OptionalContentOffRequest
    | SetOptionalContentGroupOnRequest
    | HideAnnotationsRequest
    | PageSizeRequest
    | SelectObjectsByIdRequest
    | SelectedObjectsRequest
    | SelectedAnnotationsRequest
    | PageCommentsRequest
    | PageAnnotationsRequest
    | AnnotationRequest
    | SelectionGeometryRequest
    | PageMediaRequest
    | MediaDataRequest
    | SheetIdByIndexRequest
    | SetSelectionRequest
    | SelectionReadRequest
    | CopyRequest
    | PlainTextRequest
    | ExecuteRequest
    | ExecuteOnSelectionRequest
    | SnapshotRequest
    | SaveToBytesRequest
    | OriginalBytesRequest
    | SaveToPackageRequest
    | ExportToBytesRequest
    | ExportPageToBytesRequest
    | SetUserInfoRequest
    | PresenceRequest
    | MergePresenceRequest
    | SetPointerRequest
    | ClearPointerRequest
    | RefreshPresenceRequest
    | WithdrawPresenceRequest
    | VersionVectorRequest
    | PatchSinceRequest
    | MergeRequest
    | OpaquePartsSinceRequest
    | MergeOpaquePartsRequest;

/**
 * A request one of a product's own worker handlers answers (see `serveEngine`
 * in worker.ts) — the engine's own are {@link WorkerRequest}.
 */
export interface ExtensionRequest {
    readonly type: string;
}

/** A request envelope as posted to the worker: `_id` keys its reply. */
export type WorkerRequestEnvelope = WorkerRequest & { _id?: number };

// A successful `open` replies with the initial DocumentLayout (page count +
// content size). Worker → main results travel as `unknown`, so the layout type
// is shared from `geometry`, not redeclared here.

/**
 * A failure as it crosses the thread boundary: an `Error` loses its class on
 * the way, so the {@link UDocError} the main thread rebuilds travels as its
 * fields.
 */
export type WorkerFailure = Pick<UDocError, "code" | "message" | "detail">;

/** A reply to a correlated (`_id`-bearing) request. */
export type WorkerResponse =
    | { _id: number; ok: true; result?: unknown }
    | { _id: number; ok: false; error: WorkerFailure };

/** Unsolicited repaint-timing report, emitted ~once per second when `perf` is on. */
export interface PerfReport {
    type: "perf";
    summary: PerfSummary;
}

/**
 * Unsolicited page-geometry report, emitted after every painted frame so the
 * host's HTML overlay layer can track the document's pages as they scroll/zoom.
 * The pages on screen, already projected to viewport (CSS px) space, as a flat
 * buffer with stride 6 — `[index, x, y, width, height, rotation, …]`. The buffer's
 * backing `ArrayBuffer` is transferred (not copied); the main thread parses it
 * into {@link PageView}s. Sent only on frames that painted, so a still document
 * stops emitting and the overlays hold their positions.
 *
 * Beside the rects ride the frame's authoritative view metrics — zoom
 * (`scale`), clamped scroll, and content extent in document points — plus the
 * `seq` of the latest viewport the worker had consumed when it painted. With
 * screen-fixed (px) page spacing the extent and (across a re-arrangement) the
 * scroll depend on zoom in ways the main thread can't derive, so it adopts
 * these when `seq` matches the latest viewport it sent.
 */
export interface PageViewsReport {
    type: "pageViews";
    rects: Float64Array;
    /** Echo of the latest consumed {@link SetViewportRequest.seq} (0 before any). */
    seq: number;
    /** CSS px per document point for this frame. */
    scale: number;
    /** Authoritative (clamped/anchored) scroll, document points. */
    scrollX: number;
    scrollY: number;
    /** Authoritative scrollable extent (Rust `scroll_extent`), document points —
     *  the whole framed plane in continuous, the current page in single-page. */
    scrollWidth: number;
    scrollHeight: number;
    /** 0-based index of the page at the viewport center; `-1` when none. */
    currentPage: number;
    /** The plane this frame shows — a spreadsheet's sheet, 0-based; `0` for a
     *  single-plane doc type. */
    plane: number;
    /** Filled portion of the scrollable extent (Rust `scroll_used_extent`) the
     *  scrollbar thumb is drawn from, document points — equal to the scroll
     *  extent for most doc types, a spreadsheet's data range otherwise. */
    scrollUsedWidth: number;
    scrollUsedHeight: number;
    /** Whether the horizontal / vertical scrollbar shows (Rust `scrollbars`) —
     *  the bars this frame kept a strip clear for. */
    scrollbarX: boolean;
    scrollbarY: boolean;
    /** The guide chrome (ruler / row-column headers) to draw this frame, already
     *  scroll-resolved to CSS px, or `null` for a doc type with no chrome. */
    guide: Guide | null;
    /**
     * The viewport region (CSS px) this frame repainted — the compositor's
     * dirty window, after the scroll-blit and any full-repaint promotion.
     * `null` on a frame that painted nothing (a report can ride an idle frame;
     * see the emit rule), so a host that wants the box to stay on screen holds
     * the last non-null one. Read only by the developer repaint-area overlay.
     */
    repaintArea: { x: number; y: number; width: number; height: number } | null;
}

/**
 * Unsolicited selection report: the local selection's page-anchored geometry
 * plus every remote peer's projected selection, posted whenever either may
 * have changed — after a {@link SelectAtRequest} /
 * {@link ClearSelectionRequest}, a {@link MergePresenceRequest}, any edit /
 * undo / redo / merge (which can move or delete selected objects), a
 * compose-ahead step (newly composed pages can resolve more peer ids), and
 * on open/close. The geometry is camera-independent (page-local points); the
 * selection layer projects it against the per-frame {@link PageViewsReport}
 * rects, so scroll and zoom never re-post it.
 *
 * `localChanged` is true only for the two local mutations (select/clear) —
 * the host's cue to broadcast presence, shaped so a sync listener can't
 * ping-pong (a presence merge reports `false`).
 */
export interface SelectionReport {
    type: "selection";
    geometry: SelectionGeometry;
    peers: PeerSelectionGeometry[];
    /** The engine's verdict on which selection commands are live, for the host's
     *  selection-gated toolbar enablement. Recomputed with the geometry. */
    capabilities: SelectionCapabilities;
    /** The current values of the selection's editable properties — the resolved
     *  character format a text selection carries (font / bold / italic), for the
     *  Text tab to mirror. Recomputed with the geometry; `null` with no document
     *  open. */
    properties: UDocSelectionProperties | null;
    localChanged: boolean;
}

/**
 * Unsolicited peer report: the remote peers present on the presence channel —
 * each one's id and name — posted when they changed: after a
 * {@link MergePresenceRequest}, a {@link RefreshPresenceRequest} or
 * {@link WithdrawPresenceRequest}, and on open/close. A peer is present once it
 * has any presence, so this lists one that has selected nothing yet.
 */
export interface PeersReport {
    type: "peers";
    peers: Peer[];
}

/**
 * Unsolicited peer-pointer report: every remote peer's pointer on the plane
 * shown, posted when they changed — after a {@link MergePresenceRequest}, a
 * {@link RefreshPresenceRequest} or {@link WithdrawPresenceRequest}, a plane
 * switch, and on open/close. Page-anchored (page-local points) like a selection
 * box, so scroll and zoom never re-post it.
 */
export interface PeerPointersReport {
    type: "peerPointers";
    pointers: PeerPointer[];
}

/**
 * Unsolicited history-state report: whether an undo / redo would currently do
 * anything. Posted whenever the edit history may have changed — on open (resets
 * to all-false), after any committing edit (page edit, object move, undo, redo),
 * and after a merge (remote edits land on the local history). The host enables
 * or disables its undo / redo controls from this; it never needs to poll.
 */
export interface HistoryReport {
    type: "history";
    canUndo: boolean;
    canRedo: boolean;
}

/**
 * Unsolicited resize ack: posted after the worker has resized the backing store
 * AND run a frame at the new size, carrying the committed size in CSS px. The
 * main thread waits for this before setting the canvas's CSS size, so the
 * displayed box never runs ahead of the painted pixels — running ahead is what
 * makes the browser scale (stretch) the stale backing store during a resize.
 */
export interface ResizedReport {
    type: "resized";
    width: number;
    height: number;
}

/**
 * Unsolicited brand-decal placement: the CSS-px rect of the "Powered by
 * docMentis" mark the engine paints into the viewport corner, so the host can
 * lay an attribution click target exactly over it. Screen-fixed, so it's posted
 * only when the viewport changes. `null` clears the target (no viewport yet).
 */
export interface BrandingRectReport {
    type: "brandingRect";
    rect: { x: number; y: number; width: number; height: number } | null;
}

/**
 * Unsolicited fatal-render report: the frame pump caught an exception from
 * `render_frame` it can't recover from. A wasm `&mut self` export that unwinds
 * on a JS throw leaks its `WasmRefCell` borrow, so the session is poisoned —
 * every later frame would throw "recursive use of an object detected". The
 * worker stops ticking rAF (no busy error loop) and posts this once so the host
 * can surface the failure and, if it wants, tear down and re-open the document.
 */
export interface RenderErrorReport {
    type: "renderError";
    message: string;
}

/**
 * Fonts the engine ordered have landed and the composed pages were re-shaped
 * against them: text may sit elsewhere than it did, so what was placed by it —
 * a search's highlights — is placed again.
 */
export interface FontsRefreshedReport {
    type: "fontsRefreshed";
}

/**
 * Unsolicited sheet load: the worker loaded a workbook's sheet in the
 * background, before it was shown, and this is the colour its tab takes —
 * `#rrggbb`, or `null` for a tab in no colour — and whether it is a
 * chartsheet. Posted once per sheet, in tab order, after an open; the sheet
 * shown at the open is read by `planeInfo` instead.
 */
export interface PlaneLoadedReport {
    type: "planeLoaded";
    plane: number;
    color: string | null;
    chartsheet: boolean;
}

/**
 * Unsolicited layout growth: the worker composed more of the document ahead of
 * the reader, in the background, and this is its layout now — the composed
 * page count and content size the host's scroll bounds follow, and whether it
 * is `complete`. The worker starts composing ahead once an opened document has
 * painted, and again after each edit, sheet switch and font re-shape, until it
 * is complete. A worksheet's grid composes ahead by its rows, whose extent is
 * known before they are, so it posts none.
 */
export interface ComposedReport {
    type: "composed";
    layout: DocumentLayout;
}

/** Anything the worker posts back to the main thread. */
export type WorkerOutbound =
    | WorkerResponse
    | PerfReport
    | PageViewsReport
    | SelectionReport
    | PeersReport
    | PeerPointersReport
    | HistoryReport
    | ResizedReport
    | BrandingRectReport
    | FontsRefreshedReport
    | PlaneLoadedReport
    | ComposedReport
    | RenderErrorReport;

// --- the local collaboration service ---------------------------------------

/**
 * Start the service's session, and import `bytes` in it: the one open that
 * mints the document's ids, kept as its udoc package (the buffer is
 * transferred, not copied).
 */
export interface LocalServiceStartRequest {
    type: "start";
    config: SessionConfig;
    bytes: ArrayBuffer;
    /** The bytes' format, for bytes detection gets wrong; absent, it is detected. */
    format?: FileFormat;
}

/** Read the document as the service keeps it; replies with a {@link LocalServiceDocument}. */
export interface LocalServiceDocumentRequest {
    type: "document";
}

/**
 * Connect a client to the collaboration through `port`, which speaks
 * udoc-server's messages. `connection` is the service's number for it.
 */
export interface LocalServiceConnectRequest {
    type: "connect";
    connection: number;
    port: MessagePort;
}

/** The client on connection `connection` has left. */
export interface LocalServiceDisconnectRequest {
    type: "disconnect";
    connection: number;
}

/** Any request the main thread posts to a local collaboration service's worker. */
export type LocalServiceRequest =
    | InitRequest
    | LocalServiceStartRequest
    | LocalServiceDocumentRequest
    | LocalServiceConnectRequest
    | LocalServiceDisconnectRequest;

/** A request envelope as posted to a local collaboration service's worker. */
export type LocalServiceRequestEnvelope = LocalServiceRequest & { _id?: number };

/**
 * The document as a local collaboration service keeps it: its udoc package, the
 * edit log over it, and the content of every opaque part the log names — an
 * inserted picture's image, which only the service holds (empty when none).
 */
export interface LocalServiceDocument {
    package: ArrayBuffer;
    log: ArrayBuffer;
    opaqueParts: ArrayBuffer;
}

/**
 * The service's worker closed connection `connection`, with a WebSocket
 * close's `code` and `reason` — an edit its engine couldn't take.
 */
export interface LocalServiceClosedReport {
    type: "closed";
    connection: number;
    code: number;
    reason: string;
}

/** Anything a local collaboration service's worker posts back to the main thread. */
export type LocalServiceOutbound = WorkerResponse | LocalServiceClosedReport;
