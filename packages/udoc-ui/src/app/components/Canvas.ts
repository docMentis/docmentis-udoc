import type { WorkerClient } from "../../worker/WorkerClient.js";
import type {
    Action as PdfAction,
    GraphicsObjectHit,
    LinkAnnotation,
    ShapeHit,
    TextHit,
    TextHyperlink,
    UDocHit,
    WidgetAnnotation,
    WordprocessingHit,
} from "@docmentis/udoc-wasm";
import { cssPxPerPt } from "../../geometry.js";
import type { PageView, PageViewsFrame, Rect, SelectMode, TextGranularity, Viewport } from "../../geometry.js";
import { applyContentClip } from "./overlayClip.js";
import { shallowEqual, subscribeSelector } from "../../framework/index.js";
import type { Store } from "../../framework/index.js";
import type { Action } from "../actions.js";
import type { AnnotationTool, UIState, MarkupTool, PlaceTool, ShapeKind } from "../state.js";
import { NO_FIT, VIEW_MODE, copyAllowed, pageStep, renderZoom, viewDpi } from "../state.js";
import { profileFor } from "../profiles.js";
import type { Segment, ShapePoint } from "../shapes.js";
import { segmentsFor, STROKE as SHAPE_STROKE, STROKE_WIDTH as SHAPE_STROKE_WIDTH } from "../shapes.js";
import { annotationStyle, colorHex, subtypeOf } from "../annotations.js";
import type { FillKind } from "../forms.js";
import { textLinkFollows, textLinkUrl, urlOf } from "../destinations.js";
import { OverlayManager } from "./OverlayManager.js";
import type { OverlayFrame, OverlayOptions, OverlaySource } from "./OverlayManager.js";
import { createHiddenTextInput } from "./HiddenTextInput.js";
import { AnnotationHoverLayer } from "./AnnotationHoverLayer.js";
import { SearchLayer } from "./SearchLayer.js";
import { SelectionLayer } from "./SelectionLayer.js";
import type { KeepOutRect, Preview, ResizeHandle, SelectionChrome, SelectionPlacement } from "./SelectionLayer.js";
import { GuideBands } from "./GuideBands.js";
import type { BandKind, GuideBand } from "./GuideBands.js";
import { SCROLLBAR_THICKNESS_PX, visibleSpan } from "./Scrollbar.js";
import { MAC } from "./controls.js";
import type { RgbColor } from "../../geometry.js";
import { applyPoint, applyVector, invert, translate } from "./affine.js";
import type { I18n } from "../i18n/index.js";

/** Whether a picked {@link UDocHit} landed in text — the point carries a caret,
 *  so the host draws the I-beam and a press starts a text selection (a docx body
 *  caret directly, a PDF / slide text object as an *ObjectText* that carries the
 *  object's box too, a PDF free text as a caret in its shape that carries the
 *  annotation's box). `"none"` (bare page), a plain object, and a grid cell are
 *  all false. A portable hit is text when it carries a caret: an object's, or a
 *  free text's — the one annotation that does; a slide's and a word document's
 *  are text where the **deepest** level the hit reached is — see
 *  {@link textHitText}. `global` is the flavor of text gesture the press would
 *  start, which decides which level of a PDF object's path counts — see
 *  {@link graphicsObjectHitText}. */
function hitText(hit: UDocHit, global: boolean): boolean {
    if (hit === "none") return false;
    if ("wordprocessing" in hit) return textHitText(flowTextHit(hit.wordprocessing));
    if ("portable" in hit) {
        const portable = hit.portable;
        if ("object" in portable) return graphicsObjectHitText(portable.object.object, global);
        return portable.annotation.text != null;
    }
    if ("presentation" in hit) return shapeHitText(hit.presentation.shapeHit, global);
    return false; // Spreadsheet — a grid cell, not text.
}

/** Whether a picked {@link UDocHit} is a PDF text markup — a highlight,
 *  underline, squiggly or strike-out — which marks the text under it: a click
 *  picks it, and a drag selects that text. */
function hitTextMarkup(hit: UDocHit): boolean {
    return hit !== "none" && "portable" in hit && "annotation" in hit.portable && hit.portable.annotation.textMarkup;
}

/** The annotation a picked {@link UDocHit} landed on — its page's and its own
 *  hex key — or null where it landed on none. */
function annotationOf(hit: UDocHit): { page: string; id: string } | null {
    return hit !== "none" && "portable" in hit && "annotation" in hit.portable
        ? { page: hit.portable.annotation.page, id: hit.portable.annotation.annotation }
        : null;
}

/** The link a picked {@link UDocHit} landed on — a PDF link annotation's
 *  entries, what a click on it follows — or `null` where it landed on none. */
function hitLink(hit: UDocHit): LinkAnnotation | null {
    return hit !== "none" && "portable" in hit && "annotation" in hit.portable ? hit.portable.annotation.link : null;
}

/** The widget a picked {@link UDocHit} landed on — its id, and its entries:
 *  what a click on it and the pointer over it run — or `null` where it landed
 *  on none. */
function hitWidget(hit: UDocHit): { id: string; widget: WidgetAnnotation } | null {
    if (hit === "none" || !("portable" in hit) || !("annotation" in hit.portable)) return null;
    const { annotation, widget } = hit.portable.annotation;
    return widget ? { id: annotation, widget } : null;
}

/** What a click on the annotation a picked {@link UDocHit} landed on follows —
 *  a link's destination or action, or a widget's action: its `/A`, else its
 *  `/AA` `/U`, the action of the release that ends a click (Table 197) — or
 *  `null` where it follows nothing. */
function hitTarget(hit: UDocHit): Pick<LinkAnnotation, "action" | "destination"> | null {
    const link = hitLink(hit);
    if (link) return link;
    const widget = hitWidget(hit)?.widget;
    const action = widget?.action ?? widget?.additionalActions?.mouseUp ?? null;
    return action ? { action, destination: null } : null;
}

/** What a word-processing hit picked in its flow's story, whichever flow — a
 *  section's body, or a header / footer band — the point landed in. */
function flowTextHit(hit: WordprocessingHit): TextHit {
    return "section" in hit ? hit.section.text : "header" in hit ? hit.header.text : hit.footer.text;
}

/** Whether a story's hit ends on a caret — walked down the path it reports,
 *  since what is under the point is its deepest level. The story's own caret is
 *  text; a table cell hands the question to the cell's story, a drawing to its
 *  shape. So a picture inside a cell is not text, where the cell around it is. */
function textHitText(textHit: TextHit): boolean {
    const content = textHit.content;
    if (content == null) return true;
    if ("table" in content) return textHitText(content.table.textHit);
    // A word document's text gesture picks a drawing's group whole in either
    // mode — it has no flowing flavor.
    return shapeHitText(content.drawing, false);
}

/** Whether a picked PDF graphics object ends on a caret. A `global` (flowing,
 *  view-mode) gesture reads the path down to its leaf — text in a group's child
 *  or a form's body counts; a confined (edit-mode) one reads the picked object's
 *  own text only, so a press on text inside a group or a form picks the object
 *  whole. */
function graphicsObjectHitText(hit: GraphicsObjectHit, global: boolean): boolean {
    const content = hit.content;
    if (content == null) return false;
    if ("text" in content) return true;
    if (!global) return false;
    return graphicsObjectHitText("group" in content ? content.group : content.form, global);
}

/** Whether a picked shape ends on a caret — its own text's, or a caret inside a
 *  cell of a table it hosts, each walked on down. A shape with no text of its
 *  own (a picture, a plain shape) is not text. A point in a group reads as its
 *  child only for a `global` (flowing, view-mode) gesture; any other press
 *  picks the group whole, as `ShapeSelection::from_hit` does. */
function shapeHitText(shapeHit: ShapeHit, global: boolean): boolean {
    const content = shapeHit.content;
    if (content == null) return false;
    if ("text" in content) return textHitText(content.text);
    if ("group" in content) return global && shapeHitText(content.group, global);
    return textHitText(content.table.textHit);
}

/** Whether a picked {@link UDocHit} landed on a spreadsheet grid cell — a press
 *  starts / extends a cell block (no marquee band; the range fill is the
 *  feedback). False for every other hit, including `"none"`. */
function hitCell(hit: UDocHit): boolean {
    return hit !== "none" && "spreadsheet" in hit;
}

/** The innermost table a picked {@link UDocHit} landed in, by id — the table a
 *  press or a right-click there works in — or `null` where the point is in
 *  none. Walked down the path the hit reports, as {@link hitText} is, so a
 *  table in a word document's flow answers as one in a slide's graphic frame
 *  does, and a table nested in a cell answers for itself. */
function tableOf(hit: UDocHit): string | null {
    if (hit === "none") return null;
    if ("wordprocessing" in hit) return textHitTable(flowTextHit(hit.wordprocessing));
    if ("presentation" in hit) return shapeHitTable(hit.presentation.shapeHit);
    return null; // Portable and Spreadsheet — no table to work in.
}

/** The innermost table a story's hit passes through — a cell's own answer
 *  first, then the table holding that cell — or `null` where it passes through
 *  none. */
function textHitTable(textHit: TextHit): string | null {
    const content = textHit.content;
    if (content == null) return null;
    if ("table" in content) return textHitTable(content.table.textHit) ?? content.table.table;
    return shapeHitTable(content.drawing);
}

/** The innermost table a picked shape passes through — one it hosts, or one
 *  in its text. A group is picked whole, so a table inside one is not worked
 *  in. */
function shapeHitTable(shapeHit: ShapeHit): string | null {
    const content = shapeHit.content;
    if (content == null || "group" in content) return null;
    if ("text" in content) return textHitTable(content.text);
    return textHitTable(content.table.textHit) ?? content.table.table;
}

/** The link a picked {@link UDocHit} landed on — the text run's, else the
 *  shape's own, in a word document's flow or on a slide, walked down the path
 *  the hit reports as {@link tableOf} is — or `null` where neither carries
 *  one. */
function hitTextLink(hit: UDocHit): TextHyperlink | null {
    if (hit === "none") return null;
    if ("wordprocessing" in hit) return textHitLink(flowTextHit(hit.wordprocessing));
    if ("presentation" in hit) return shapeHitLink(hit.presentation.shapeHit);
    return null; // Portable — a PDF's links are annotations; Spreadsheet — none.
}

/** The link a story's hit lands on — the deepest one: a run in a cell's or a
 *  drawing's text, or the drawing's own, first, then the run the drawing sits
 *  on. */
function textHitLink(textHit: TextHit): TextHyperlink | null {
    const content = textHit.content;
    const inner =
        content == null
            ? null
            : "table" in content
              ? textHitLink(content.table.textHit)
              : shapeHitLink(content.drawing);
    return inner ?? textHit.hyperlink ?? null;
}

/** The link a picked shape's hit lands on — the deepest one: a run in its own
 *  text, a hosted table cell's or a group child's first, then the shape's
 *  own. */
function shapeHitLink(shapeHit: ShapeHit): TextHyperlink | null {
    const content = shapeHit.content;
    const inner =
        content == null
            ? null
            : "text" in content
              ? textHitLink(content.text)
              : "group" in content
                ? shapeHitLink(content.group)
                : textHitLink(content.table.textHit);
    return inner ?? shapeHit.hyperlink ?? null;
}

/** Default span (document points) for a shape placed by a click, not a drag. */
const DEFAULT_SHAPE_WIDTH = 120;
const DEFAULT_SHAPE_HEIGHT = 80;

const SVG_NS = "http://www.w3.org/2000/svg";

/** How far (CSS px) the pointer travels before a pen stroke takes its next
 *  point — enough to keep a slow stroke from piling up points it can't show. */
const INK_STEP = 1.5;

/** Ignore sub-this view-state drift (pt) — float noise, not a real change. */
const SYNC_EPSILON = 0.01;

/** Treat a scroll within this many doc points of a page edge as "at the edge". */
const PAGE_EDGE_EPSILON = 0.5;

/** Quiet gap (ms) after which a single-page wheel flip re-arms (see `pageFlipArmed`). */
const WHEEL_REST_MS = 120;

/**
 * The viewport surface: a single canvas pinned to its container. The canvas is
 * transferred into the worker (via `attach`), which owns the OffscreenCanvas,
 * the dirty-rect compositor, and the rAF paint loop. This component only:
 *
 * - **Synthetic scroll** — wheel events are intercepted (never native scroll)
 *   and turned into `SCROLL_BY` actions.
 * - **Zoom** — ctrl/⌘ + wheel zooms about the cursor.
 * - **Viewport forwarding** — whenever the viewport slice of state changes (or
 *   the host resizes), it pushes the new {@link Viewport} into the worker with
 *   `setViewport`; the worker repaints on its next frame.
 *
 * State stays serializable; pixels live in the worker.
 */
/** What the canvas lends a gesture the shell's extension runs on it. */
export interface CanvasGestureHost {
    /** Show the selection's live transform preview, or clear it with null. */
    preview(preview: Preview | null): void;
    /** Draw the selection's chrome again now — after the extension's chrome
     *  changed its own state mid-gesture. */
    refreshChrome(): void;
    /**
     * Hold the live preview until the edit being committed lands, so the
     * selection settles onto its new geometry instead of snapping back.
     */
    committing(): void;
}

/** A pointer gesture the shell's extension runs on the canvas — the pointer is
 *  captured for it, from its press to its release. */
export interface CanvasGesture {
    /** The pointer moved to canvas-local `(x, y)`, CSS px. */
    move(x: number, y: number, ev: PointerEvent): void;
    /** The pointer was released at `(x, y)`. */
    up(x: number, y: number, ev: PointerEvent): void;
    /** The gesture was cancelled — the browser took the pointer. */
    cancel(): void;
    /** A key went down or up mid-gesture — Shift or Alt changing what it does. */
    modifier?(ev: KeyboardEvent): void;
}

/** Shell-provided callbacks for gestures that must run as document edits. */
export interface CanvasHooks {
    /**
     * Commit a move drag as a page-local translation `(dx, dy)` (document
     * points). Routed through the shell (not the worker client directly) so it
     * travels the same edit path as a page edit — relayout, compose-ahead, and
     * the `onEdit` cue a sync transport listens to. Without it an edit would
     * change the local document but never broadcast.
     */
    commitTranslate?: (dx: number, dy: number) => void;
    /**
     * Commit a resize drag on a selection: scale **each** selected object by
     * `(sx, sy)` about its own anchor (the held-fixed corner, as bounds
     * fractions `ax` / `ay`), so the group resizes member-by-member — the grabbed
     * handle tracks the pointer while every object's matching corner moves
     * proportionally. A single shared affine delta can't express the per-object
     * anchors, so this carries the scale + anchor; the engine reads each object's
     * bounds. Routed through the shell like {@link commitTranslate}.
     */
    commitScaleEach?: (sx: number, sy: number, ax: number, ay: number) => void;
    /** The chrome the shell's extension adds on the selection, beside its
     *  resize handles — see `UIExtension.selectionChrome`. */
    selectionChrome?: SelectionChrome;
    /** A select-pointer press the shell's extension takes ahead of the
     *  canvas's own routing, and the gesture it starts — see
     *  `UIExtension.pressCanvas`. */
    pressCanvas?: (x: number, y: number, ev: PointerEvent, canvas: CanvasGestureHost) => CanvasGesture | null;
    /** The resting cursor the shell's extension shows at `(x, y)`, or null —
     *  see `UIExtension.canvasCursor`. */
    canvasCursor?: (x: number, y: number) => string | null;
    /**
     * Insert typed / pasted text at the live text caret — the hidden text
     * input's keystrokes and IME commits. Routed through the shell like
     * {@link commitTranslate} so a text edit travels the same edit path
     * (relayout, compose-ahead, the `onEdit` sync cue).
     */
    insertText?: (text: string) => void;
    /** Delete at the live text caret (Backspace / Delete) — routed through the
     *  shell like {@link insertText}. */
    deleteText?: (forward: boolean) => void;
    /**
     * A right-click landed on the canvas: open the context menu at viewport
     * `(clientX, clientY)`. The canvas has already settled the selection the
     * menu will act on (see the `contextmenu` handler) and suppressed the
     * browser's own menu; the menu itself is the shell's.
     *
     * `inTable` says the click landed in a table cell — the canvas reads it from
     * the hit it already ran, and the menu shows its Select ▸ Row / Column /
     * Table fly-out only then. It travels with the open rather than through the
     * store because it describes *this* click, not the document's state.
     */
    onContextMenu?: (clientX: number, clientY: number, inTable: boolean) => void;
    /** The band the shell's extension draws around the content pane in `state`
     *  (edit mode's ruler), or null — see `bandKind`. */
    guideBand?: (state: UIState) => GuideBand | null;
    /** The outline the shell's extension's place `tool` drags out, or null
     *  for one placed by no drag — see `UIExtension.placedShape`. */
    placedShape?: (tool: string) => ShapeKind | null;
    /**
     * Commit the placement gesture of the shell's extension's `tool` (its
     * press-drag-release) on page `page`, spanning the page-local document
     * points `p0 → p1` — see `UIExtension.place`. Settles once the engine has
     * what it placed, so the canvas can hold its own drawing of it until then.
     */
    place?: (tool: string, page: number, p0: ShapePoint, p1: ShapePoint) => Promise<void> | void;
    /**
     * Commit an annotation drawn with an Annotate-tab tool: insert what `tool`
     * draws through `points` on page `page`, page-local document points — a
     * pen's stroke, a dragged shape's or text box's two corners, a polygon's
     * corners, or where a note or a stamp is dropped.
     * Routed through the shell like {@link place}; settles once the engine
     * has the annotation, so the canvas can hold its own drawing of it until then.
     */
    placeAnnotation?: (tool: AnnotationTool, page: number, points: ShapePoint[]) => Promise<void> | void;
    /**
     * Mark the text a markup tool's drag selected with `tool` — the drag has
     * set the text selection, and the shell reads its final quads. Routed
     * through the shell like {@link placeAnnotation}; settles to whether it
     * marked anything, which a selection with no text doesn't.
     */
    markText?: (tool: MarkupTool) => Promise<boolean>;
    /**
     * How a press on the annotation `annotation` (a hex key) fills in the form
     * field it is a widget of, or null when it is no widget a press fills in.
     * Read synchronously: a press routes its gesture on it.
     */
    formWidget?: (annotation: string) => FillKind | null;
    /**
     * Whether the annotation `annotation` (a hex key) is a form field's widget,
     * which view mode fills in and never selects. Read synchronously, as
     * {@link formWidget} is.
     */
    isFormWidget?: (annotation: string) => boolean;
    /**
     * The alternate name (`/TU`) of the form field whose widget is the
     * annotation `annotation` (a hex key), or null when it is no widget or its
     * field has none — what a hover over the widget shows. Read synchronously,
     * as {@link formWidget} is.
     */
    formFieldAlternateName?: (annotation: string) => string | null;
    /**
     * Fill in the form field whose widget is the annotation `annotation` on page
     * `page` (hex keys) — a press landed on it. Routed through the shell like
     * {@link placeAnnotation}.
     */
    fillFormField?: (page: string, annotation: string) => void;
    /**
     * Follow the link a click landed on — to its destination in the document,
     * or to the URL its action names. Routed through the shell like
     * {@link fillFormField}.
     */
    followLink?: (target: Pick<LinkAnnotation, "action" | "destination">) => void;
    /**
     * Follow the link the text run a click landed on carries — a word
     * document's or a slide's — clicked on page `page`, which a move to the
     * next or previous slide counts from. Routed through the shell like
     * {@link followLink}.
     */
    followTextLink?: (link: TextHyperlink, page: number) => void;
    /**
     * The annotation under the resting pointer changed: `annotation` — its
     * page's and its own hex key — the one now under it at viewport
     * `(clientX, clientY)`, or `null` where it left one. Reported in every
     * pointer mode.
     */
    annotationHover?: (annotation: { page: string; id: string } | null, clientX: number, clientY: number) => void;
    /**
     * A press and release with no drag between landed on `annotation` — its
     * page's and its own hex key — at viewport `(clientX, clientY)`. Reported
     * before the click is handled, so before a link it lands on is followed.
     */
    annotationClick?: (annotation: { page: string; id: string }, clientX: number, clientY: number) => void;
    /**
     * The pointer moved over the canvas, to canvas-local CSS px `(x, y)` — the
     * space a `hitTest` takes. Reported in every pointer mode, mid-gesture too:
     * where a shared pointer rests.
     */
    pointerMove?: (x: number, y: number) => void;
    /** The pointer left the canvas — onto a panel, the toolbar, or off the page. */
    pointerLeave?: () => void;
    /**
     * Commit a spreadsheet header-boundary drag: set column `index` (or row, for
     * {@link resizeRow}) to `points` document points (1/72 inch, not pixels). The
     * canvas scales the pixel drag back to points here (dividing by the
     * CSS-px-per-point scale it holds); the shell resolves the active sheet and
     * issues the `ResizeColumns` / `ResizeRows` command. Routed through the shell
     * like {@link commitTranslate} so it travels the same edit path (relayout,
     * compose-ahead, the `onEdit` sync cue).
     */
    resizeColumn?: (index: number, points: number) => void;
    /** Commit a row header-boundary drag — the row twin of {@link resizeColumn}. */
    resizeRow?: (index: number, points: number) => void;
}

/**
 * The smallest a resize may shrink a side to, in **page points** — no
 * inversion. Converted into each object's own local units below (via the
 * transform's per-axis scale) so it's the same on-screen minimum whether the
 * object's local space is a unit square (an image) or hundreds of points (a
 * path); a flat object-local floor would explode a unit-square image, whose
 * whole local extent is 1.
 */
const MIN_RESIZE = 4;

/** Pointer travel (CSS px) past which a press becomes a drag, not a click. */
export const DRAG_THRESHOLD = 3;

/** The **object** selection mode a gesture carries, from its keyboard modifiers:
 *  Shift toggles the pick's membership, Alt subtracts, a bare gesture replaces.
 *  Object-domain only — a text / cell gesture carries a plain `extend` flag (the
 *  Shift intent) instead. Read at press time so a mid-gesture key change can't
 *  reinterpret the sweep underway. */
function selectModeFor(ev: { shiftKey: boolean; altKey: boolean }): SelectMode {
    if (ev.shiftKey) return "toggle";
    if (ev.altKey) return "subtract";
    return "replace";
}

/** Whether the link key — ⌘ on a Mac, Ctrl elsewhere — is down in `ev`: a
 *  click with it selects a link in view mode and follows one in edit mode.
 *  Not Ctrl on a Mac, where a Ctrl-click is the right click. */
function linkKeyDown(ev: { ctrlKey: boolean; metaKey: boolean }): boolean {
    return MAC ? ev.metaKey : ev.ctrlKey;
}

/** The text granularity a press's click-chain count encodes: a double click
 *  selects (and drags) by words, a triple click by paragraphs. */
function granularityFor(count: number): TextGranularity {
    return count >= 3 ? "paragraph" : count === 2 ? "word" : "character";
}

/**
 * What a **touch tap** — a press that never became a scroll drag — resolves to,
 * captured at press time so an unmoved release performs the same pick the mouse
 * gesture would have. A touch drag scrolls the viewport instead (a `touchScroll`
 * gesture); only a release with no movement runs this. Touch carries no keyboard
 * modifiers, so a text/cell tap never extends and an object tap replaces.
 */
type TapAction =
    | { kind: "text"; granularity: TextGranularity; global: boolean }
    | { kind: "cell" }
    | { kind: "object"; mode: SelectMode };

/** A drawing on the canvas ahead of the engine — a pen stroke, a polygon, a
 *  shape or text box being placed: `tool`'s line along `segments` on `page`
 *  (page-local document points). */
interface Sketch {
    tool: PlaceTool;
    page: number;
    segments: readonly Segment[];
}

/** Annotation `tool`'s line through `points` on `page` as a sketch, closed
 *  back to the first point when `closed`. A lone point draws as a dot: a round
 *  cap on a zero-length segment. */
function lineSketch(tool: AnnotationTool, page: number, points: readonly ShapePoint[], closed: boolean): Sketch {
    const through = points.length === 1 ? [points[0]!, points[0]!] : points;
    const segments: Segment[] = through.map((p, i) => (i === 0 ? { moveTo: p } : { lineTo: p }));
    if (closed && segments.length > 0) segments.push("close");
    return { tool: { kind: "annotation", tool }, page, segments };
}

/** The shape an annotation placing `tool` drops, as {@link segmentsFor}
 *  outlines it: the like-named one — a text box its rectangle. Null for a tool
 *  not placed by a drag. */
function annotationShape(tool: AnnotationTool): ShapeKind | null {
    switch (tool) {
        case "rectangle":
        case "ellipse":
        case "line":
        case "arrow":
            return tool;
        case "textBox":
            return "rectangle";
        default:
            return null;
    }
}

/** Whether `tool` marks text rather than drawing. */
function isMarkup(tool: AnnotationTool | null): tool is MarkupTool {
    return tool === "highlight" || tool === "underline" || tool === "strikeOut" || tool === "squiggly";
}

/** The fewest corners `tool` — one clicked out corner by corner — draws with. */
function minCorners(tool: AnnotationTool): number {
    return tool === "polyline" ? 2 : 3;
}

/** A chained press must land within this of the previous one (CSS px). */
const CLICK_CHAIN_RADIUS = 4;
/** ... and within this of it (ms) — the platform double-click window. */
const CLICK_CHAIN_MS = 500;

/** The held-fixed corner of `handle` as bounds fractions (the corner opposite
 *  the moved edges): `0` = top/left … `1` = bottom/right. The same fraction is
 *  applied to every object's own bounds, so each resizes about its matching
 *  corner. An axis with no moved edge keeps its fraction at 0 (its scale is 1). */
function anchorFractions(handle: ResizeHandle): { ax: number; ay: number } {
    return { ax: handle.includes("w") ? 1 : 0, ay: handle.includes("n") ? 1 : 0 };
}

/**
 * Resolve a resize drag to the local scale factors `(sx, sy)` it implies for
 * the **grabbed** object. The drag arrives as a page-local point delta
 * (`dxPage`, `dyPage`) — already un-rotated from the page's view rotation — and
 * is taken into the object's own local space (where its bounds are axis-aligned)
 * via the inverse of its `local → page` transform: the handle picks which local
 * edges move while the opposite edges stay put, giving the scale about the
 * held-fixed corner. Each moved edge is clamped so its side can't collapse past
 * {@link MIN_RESIZE} or invert. The factors are shared by every selected object
 * (each scaling about its own matching anchor), so the grabbed handle tracks the
 * pointer while the others move proportionally.
 */
function resizeScale(
    handle: ResizeHandle,
    place: SelectionPlacement,
    dxPage: number,
    dyPage: number,
    lock: boolean,
): { sx: number; sy: number } {
    const m = place.transform;
    const inv = invert(m);
    if (!inv) return { sx: 1, sy: 1 };
    // Page-point travel → the object's own local space.
    const d = applyVector(inv, dxPage, dyPage);
    // One local unit spans this many page points along each local axis (the
    // length of the transformed basis vector). Convert the page-point minimum
    // into local units per axis so the clamp is the same on-screen size for a
    // unit-square image as for a point-sized path, and holds under rotation/shear.
    const lenX = Math.hypot(m[0], m[1]);
    const lenY = Math.hypot(m[2], m[3]);
    const minX = lenX > 0 ? MIN_RESIZE / lenX : 0;
    const minY = lenY > 0 ? MIN_RESIZE / lenY : 0;
    const movesLeft = handle.includes("w");
    const movesRight = handle.includes("e");
    const movesTop = handle.includes("n");
    const movesBottom = handle.includes("s");
    let left = place.x;
    let right = place.x + place.width;
    let top = place.y;
    let bottom = place.y + place.height;
    if (movesLeft) left = Math.min(left + d.x, right - minX);
    if (movesRight) right = Math.max(right + d.x, left + minX);
    if (movesTop) top = Math.min(top + d.y, bottom - minY);
    if (movesBottom) bottom = Math.max(bottom + d.y, top + minY);
    let sx = movesLeft || movesRight ? (right - left) / place.width : 1;
    let sy = movesTop || movesBottom ? (bottom - top) / place.height : 1;
    if (lock) {
        // Aspect-ratio lock: a single uniform factor `s` scales both axes, so
        // width/height is preserved (sx === sy). A uniform local scale about the
        // anchor moves the grabbed point along the *page-space* vector from the
        // held-fixed corner to the handle (anchor→handle diagonal for a corner,
        // the moved edge's normal for an edge): G' = A + s·(G − A). Projecting
        // the page drag onto that vector makes the handle track the pointer as
        // seen on screen — not in the object's own (possibly non-uniformly
        // scaled / sheared) local space, where the visual diagonal is skewed.
        // The perpendicular travel is dropped (the pointer drifts off the box),
        // which is the constrained-resize feel every other graphics tool has.
        const dirLocalX = (movesRight ? 1 : movesLeft ? -1 : 0) * place.width;
        const dirLocalY = (movesBottom ? 1 : movesTop ? -1 : 0) * place.height;
        const dir = applyVector(m, dirLocalX, dirLocalY);
        const len2 = dir.x * dir.x + dir.y * dir.y;
        if (len2 > 0) {
            // Smallest factor that keeps every scaled side above the min, so the
            // locked box can't collapse or invert past {@link MIN_RESIZE}.
            const sMin = Math.max(place.width > 0 ? minX / place.width : 0, place.height > 0 ? minY / place.height : 0);
            const s = Math.max(1 + (dir.x * dxPage + dir.y * dyPage) / len2, sMin);
            sx = s;
            sy = s;
        }
    }
    return { sx, sy };
}

export function createCanvas(i18n: I18n, client: WorkerClient, hooks: CanvasHooks = {}) {
    /** The shape placing `tool` drops — an annotation's own, or what the
     *  extension says its tool drags out — or null for a tool not placed by a
     *  drag. */
    function placedShape(tool: PlaceTool): ShapeKind | null {
        return tool.kind === "annotation" ? annotationShape(tool.tool) : (hooks.placedShape?.(tool.tool) ?? null);
    }

    /**
     * The guide band the host reserves for `state` — a spreadsheet's headers,
     * but for a chartsheet, which has no grid; the band the shell's extension
     * draws (edit mode's ruler); or none. Host-static: derived from the doc
     * profile and view state with no dependence on a painted frame, so the band
     * strips can be reserved before the first paint and the content pane
     * measured once (see {@link GuideBands.layout}).
     */
    function bandKind(state: UIState): BandKind {
        if (profileFor(state.docType).guide === "header" && !state.planeChartsheets[state.currentPlane]) {
            return "header";
        }
        return hooks.guideBand?.(state) ?? null;
    }

    const el = document.createElement("div");
    el.className = "udoc-ui__canvas-host";
    el.tabIndex = 0;

    const canvas = document.createElement("canvas");
    canvas.className = "udoc-ui__canvas";
    el.appendChild(canvas);

    // The selection overlay: boxes marking the selected objects, above the
    // canvas and the page chrome (selection marks stack over the page pill/rail
    // via a higher z-index, so a control can't occlude a handle).
    // Function-critical, so it is its own layer, not a registry overlay —
    // a host can't remove it like the page pill. Driven by the worker's
    // selection-geometry stream + the per-frame page views (SelectionLayer).
    // The search highlights, under the selection: a match the search selects
    // shows its selection on top. Driven by the store's matches + the per-frame
    // page views (SearchLayer).
    const searchHost = document.createElement("div");
    searchHost.className = "udoc-ui__search";
    el.appendChild(searchHost);
    const search = new SearchLayer(searchHost);

    // The hovered annotation's outline, over the search highlights and under
    // the selection, which marks a selected annotation with its own box. Driven
    // by the hover probe + the per-frame page views (AnnotationHoverLayer).
    const annotationHoverHost = document.createElement("div");
    annotationHoverHost.className = "udoc-ui__annotation-hover";
    el.appendChild(annotationHoverHost);
    const annotationHover = new AnnotationHoverLayer(annotationHoverHost);

    const selectionHost = document.createElement("div");
    selectionHost.className = "udoc-ui__selection";
    el.appendChild(selectionHost);
    const selection = new SelectionLayer(selectionHost);
    if (hooks.selectionChrome) selection.setChrome(hooks.selectionChrome);

    // The hidden field — the UI's keyboard and clipboard sink. It holds
    // focus for all of edit mode, and in view mode while the selection is
    // copyable, so native clipboard events land on it (the shell wires them);
    // keystrokes and IME commits edit text only while a caret is live. Edits route through the shell (the same path as a drag
    // commit); the caret-move keys are presence and go to the worker directly.
    const textInput = createHiddenTextInput(i18n, {
        insertText: (text) => hooks.insertText?.(text),
        deleteText: (forward) => hooks.deleteText?.(forward),
        moveCaret: (movement, extend) => client.moveTextCaret(movement, extend),
    });
    el.appendChild(textInput.el);

    /** Sync the sink's two modes to the store: focused for all of edit mode (so
     *  clipboard events land here) and, in view mode, while annotations are
     *  selected — they edit there too — or the selection is copyable, which
     *  only copies; text-editing only while an editable caret is live there, in
     *  a doc type whose text edits in place. */
    function syncTextInput(): void {
        const st = store?.getState();
        if (st?.status !== "ready") {
            textInput.setFocused(false);
            textInput.setEditingText(false);
            return;
        }
        const editable = st.mode !== VIEW_MODE || annotationSelected;
        textInput.setFocused(editable || (copyable && copyAllowed(st)));
        textInput.setEditingText(editable && editingText && profileFor(st.docType).textEditing === true);
    }

    // The HTML overlay layer: a sibling above the canvas (and below the
    // scrollbars) that holds page-anchored DOM chrome. `pointer-events: none`
    // in styles keeps wheel/scroll flowing to the canvas; the manager drives it
    // from the worker's per-frame page-geometry stream (see OverlayManager).
    const overlayHost = document.createElement("div");
    overlayHost.className = "udoc-ui__overlay";
    el.appendChild(overlayHost);
    const overlay = new OverlayManager(overlayHost);
    // The overlay layer above the selection, for the registry overlays that
    // belong over the selected object's boxes and handles rather than under
    // them — the selected annotation's bar and its comment popup
    // (`setOverlay`'s `aboveSelection`).
    const overlayAboveHost = document.createElement("div");
    overlayAboveHost.className = "udoc-ui__overlay udoc-ui__overlay--above-selection";
    el.appendChild(overlayAboveHost);
    const overlayAbove = new OverlayManager(overlayAboveHost);

    /** Render both overlay layers against `frame`. */
    function renderOverlays(frame: OverlayFrame): void {
        overlay.render(frame);
        overlayAbove.render(frame);
    }

    // The marquee: the band a zoom or select sweep draws over the region it
    // picks. Hidden except during a `marquee` / `marqueeSelect` gesture;
    // `pointer-events: none` (styles) keeps the underlying canvas the event
    // target so the gesture's pointer capture is never stolen. It lives inside a
    // full-canvas clip layer that clips it to the content area (shared with the
    // other overlays) so a sweep dragged over the ruler / branding is cut there.
    const marqueeClip = document.createElement("div");
    marqueeClip.className = "udoc-ui__marquee-clip";
    const marquee = document.createElement("div");
    marquee.className = "udoc-ui__marquee";
    marquee.style.display = "none";
    marqueeClip.appendChild(marquee);
    // What is being drawn, until the engine paints it: a pen stroke, a polygon's
    // corners so far, a shape or text box being placed. In the marquee's clip
    // layer, so it is cut at the content area's edge like the band (see
    // `renderSketch`).
    const sketch = document.createElementNS(SVG_NS, "svg");
    sketch.classList.add("udoc-ui__sketch");
    sketch.style.display = "none";
    const sketchPath = document.createElementNS(SVG_NS, "path");
    sketch.appendChild(sketchPath);
    marqueeClip.appendChild(sketch);
    el.appendChild(marqueeClip);
    // The content-clip key last applied to `marqueeClip` (see overlayClip).
    let marqueeClipKey = "";

    // The "Powered by docMentis" attribution: the mark itself is painted into
    // the canvas by the engine; this is the transparent click target laid over
    // it (the engine streams its CSS rect via `onBrandingRect`). A press over it
    // must not start a canvas gesture, so it swallows `pointerdown`.
    const brandingLink = document.createElement("a");
    brandingLink.className = "udoc-ui__branding";
    brandingLink.href = "https://docmentis.com";
    brandingLink.target = "_blank";
    brandingLink.rel = "noopener noreferrer";
    brandingLink.title = i18n.t("branding.title");
    brandingLink.setAttribute("aria-label", i18n.t("branding.label"));
    brandingLink.style.display = "none";
    brandingLink.addEventListener("pointerdown", (e) => e.stopPropagation());
    el.appendChild(brandingLink);

    // The repaint-area box (developer option "Show Repaint Area"): an outline
    // over the region the engine's latest frame actually repainted — the
    // compositor's dirty rect, which rides the per-frame page-geometry report in
    // CSS px. Positioned in the canvas host exactly like the branding target,
    // since both speak the engine's viewport coordinates; above every other
    // layer here (z-index in styles) so no chrome can hide it, and
    // `pointer-events: none` keeps the canvas the event target.
    const repaintBox = document.createElement("div");
    repaintBox.className = "udoc-ui__repaint-area";
    repaintBox.setAttribute("aria-hidden", "true");
    repaintBox.style.display = "none";
    el.appendChild(repaintBox);
    // Whether the option is on, and the latest box reported. The box is cached
    // so flipping the option on shows it at once — an idle document paints no
    // further frames, so waiting for the next report could mean waiting forever.
    let showRepaintArea = false;
    let lastRepaintArea: Rect | null = null;

    /** Lay the repaint-area box over the region the engine last repainted. */
    function renderRepaintArea(): void {
        if (!showRepaintArea || !lastRepaintArea) {
            repaintBox.style.display = "none";
            return;
        }
        const r = lastRepaintArea;
        repaintBox.style.left = `${r.x}px`;
        repaintBox.style.top = `${r.y}px`;
        repaintBox.style.width = `${r.width}px`;
        repaintBox.style.height = `${r.height}px`;
        repaintBox.style.display = "block";
    }

    // The guide bands (a spreadsheet's row/column headers, a paged doc's ruler):
    // three main-thread canvases laid out by CSS grid around the content pane
    // `el`, which sits in the grid's content cell — so the ResizeObserver on `el`
    // measures the content-pane viewport with the bands excluded, and the scroll
    // clamp / scrollbars need no inset. Drawn from the engine's per-frame guide
    // projection (already CSS px, scroll-resolved), colored by the host theme.
    const makeBand = (kind: string): HTMLCanvasElement => {
        const c = document.createElement("canvas");
        c.className = `udoc-ui__band udoc-ui__band--${kind}`;
        return c;
    };
    const root = document.createElement("div");
    root.className = "udoc-ui__viewport-grid";
    const bandCorner = makeBand("corner");
    const bandTop = makeBand("top");
    const bandLeft = makeBand("left");
    root.append(bandCorner, bandTop, bandLeft, el);
    const guideBands = new GuideBands(root, bandCorner, bandTop, bandLeft);

    // The header resize guide: a transient line the user drags along a column /
    // row header boundary, previewing the new track size; on release the drag
    // commits a `ResizeColumns` / `ResizeRows` edit (see endResize). One reusable
    // element repositioned per drag; a child of `root` (the viewport grid) so it
    // can run through both the header band and the content pane. Positioned via
    // the `--udoc-resize-pos` custom property so the CSS folds in the band
    // offset; `pointer-events: none` keeps the band the capture target.
    const resizeGuide = document.createElement("div");
    resizeGuide.className = "udoc-ui__resize-guide";
    resizeGuide.style.display = "none";
    const resizeGuideLabel = document.createElement("span");
    resizeGuideLabel.className = "udoc-ui__resize-guide-label";
    resizeGuide.appendChild(resizeGuideLabel);
    root.appendChild(resizeGuide);

    // Transfers control of the canvas into the worker. After this the worker
    // owns the drawing buffer; the main thread only sets the CSS display size.
    client.attach(canvas);

    let store: Store<UIState, Action> | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const cleanups: Array<() => void> = [];

    // The latest frame's CSS px per document point, from `onPageViews` — used to
    // convert a pointer drag (CSS px) into the document-point delta the move
    // command speaks.
    let lastScale = 1;
    // Latest frame's page rectangles (CSS px), kept for the page-band hit test
    // that drives the per-page control rail's hover-reveal.
    let lastViews: PageView[] = [];
    // Latest branding decal rect (CSS px), from `onBrandingRect` — the other half
    // of the content clip every overlay honors. `null` until the engine reports it.
    let lastBrandingRect: Rect | null = null;
    // The sheet the latest frame shows — a spreadsheet's, 0-based — or `-1` for
    // a doc type without sheets: the `sheet` every overlay frame carries.
    let lastSheet = -1;
    // The scrollbar size (CSS px) last sent to the worker, so a band re-layout
    // that leaves the doc type alone doesn't re-send it. `NaN` until the first
    // send.
    let scrollbarSize = Number.NaN;
    // Whether the brand decal's inset has gone to the worker — once, as every
    // doc type's bars lie over the same edges.
    let brandingInsetSent = false;
    // Refresh the page-anchored overlay whenever the selection chrome moves
    // between paints (a click-select, a drag preview, an edit-mode toggle): the
    // page-insert strips read the selection's keep-out rect, so they must
    // re-evaluate the instant it changes, not wait for the next painted frame.
    selection.onChromeChange(() =>
        renderOverlays({ views: lastViews, scale: lastScale, branding: lastBrandingRect, sheet: lastSheet }),
    );
    // The page the pointer is currently over (null over a gap or off-page). The
    // page-controls overlay reads this — via the accessor on the returned API —
    // to reveal only the hovered page's rail.
    let hoveredPage: number | null = null;
    // The latest in-canvas pointer position (local px), tracked during a resize
    // drag so the Shift key handlers can re-project the preview in place — with
    // no pointer movement — when the aspect-ratio lock is toggled.
    let lastPointerX = 0;
    let lastPointerY = 0;
    // In-progress pointer gesture (null when idle), discriminated by the pointer
    // mode it began under: a `select` press is a click-or-object-move; a `pan`
    // press drags the page; a `marquee` press rubber-bands a region to zoom into.
    // The mode is captured at press time so a mid-gesture toolbar switch can't
    // change the gesture underway.
    let gesture:
        | {
              kind: "select";
              startX: number;
              startY: number;
              pointerId: number;
              overSelection: boolean;
              mode: SelectMode;
              // Whether the link key was down at the press (see `linkKeyDown`).
              linkKey: boolean;
              moving: boolean;
              page: number | null;
          }
        | { kind: "pan"; lastX: number; lastY: number; pointerId: number }
        | { kind: "marquee"; startX: number; startY: number; pointerId: number; alt: boolean; moved: boolean }
        | {
              kind: "marqueeSelect";
              startX: number;
              startY: number;
              pointerId: number;
              mode: SelectMode;
              linkKey: boolean;
              moved: boolean;
          }
        | {
              // A dragged-out placement: an Insert-tab shape, or an Annotate-tab
              // rectangle / ellipse / line / arrow.
              kind: "place";
              tool: PlaceTool;
              page: number;
              startX: number;
              startY: number;
              // The pointer, the corner the drag has reached (canvas CSS px).
              lastX: number;
              lastY: number;
              pointerId: number;
              moved: boolean;
          }
        | {
              // A pen stroke: the page-local points the pointer passed through,
              // and the canvas point last taken.
              kind: "ink";
              tool: AnnotationTool;
              page: number;
              points: ShapePoint[];
              lastX: number;
              lastY: number;
              pointerId: number;
          }
        | {
              kind: "resize";
              handle: ResizeHandle;
              place: SelectionPlacement;
              startX: number;
              startY: number;
              pointerId: number;
              moved: boolean;
          }
        | {
              // A press the shell's extension took on its own chrome (edit
              // mode's rotation and geometry grips): the gesture it runs.
              kind: "extension";
              pointerId: number;
              gesture: CanvasGesture;
          }
        | {
              kind: "textSelect";
              startX: number;
              startY: number;
              pointerId: number;
              global: boolean;
              granularity: TextGranularity;
              extend: boolean;
              linkKey: boolean;
              moved: boolean;
              // The markup tool that marks what the drag selects, when a markup
              // tool's press started it.
              markup: MarkupTool | null;
              // A press on a text markup: an unmoved release picks it rather
              // than dropping a caret, and only a drag selects the text under it.
              clickPicks: boolean;
          }
        | { kind: "cellSelect"; startX: number; startY: number; pointerId: number; extend: boolean; moved: boolean }
        | {
              // A one-finger touch drag: scrolls the viewport (synthetic scroll,
              // like the pan tool). An unmoved release is a tap — it runs `tap`,
              // the pick captured at press. Object move / resize / rotate and the
              // explicit pan/zoom tools keep their own gestures on touch.
              kind: "touchScroll";
              startX: number;
              startY: number;
              lastX: number;
              lastY: number;
              pointerId: number;
              moved: boolean;
              tap: TapAction;
          }
        | null = null;
    // Click-chain counter behind double / triple click: a press within
    // CLICK_CHAIN_RADIUS and CLICK_CHAIN_MS of the previous one continues the
    // chain. Read at press time by the select gestures — the count picks the
    // text granularity (2 = word, 3 = paragraph) and rides the gesture, so a
    // double-click drag keeps selecting by words.
    let clickChain = { x: 0, y: 0, count: 0, time: 0 };
    function chainClick(x: number, y: number): number {
        const now = performance.now();
        const linked =
            now - clickChain.time <= CLICK_CHAIN_MS &&
            Math.hypot(x - clickChain.x, y - clickChain.y) <= CLICK_CHAIN_RADIUS;
        clickChain = { x, y, count: linked ? clickChain.count + 1 : 1, time: now };
        return clickChain.count;
    }
    // Whether the current selection is an edit-mode text selection (ObjectText:
    // a caret / range inside one object, shown with its box — or one in a free
    // text's text, shown with the annotation's). Set from the streamed geometry
    // (a box plus a caret/text item), it lets an interior press drag a text
    // range instead of moving the object.
    let inObjectText = false;
    // The table the pointer is working in — set by the last press in a table,
    // dropped by any press that isn't one (you left the table). A right-click
    // inside that same table keeps what is picked (see `onContextMenu`).
    let tableAnchor: string | null = null;
    // Whether the selection carries an editable text caret / range at all —
    // ObjectText (inside an object box) OR flow text with no object (a word
    // processor's body caret). Drives the hidden text input, which a bare flow
    // caret must claim too even though it has no object box.
    let editingText = false;
    // Whether the selection is annotations — a whole one, or a caret in a free
    // text's text. Annotations edit in view mode as in edit, so this opens the
    // hidden text input and the press routing to them in view too.
    let annotationSelected = false;
    // Whether the selection copies — which, in view mode, opens the hidden text
    // input as the clipboard sink alone, where the host leaves copy on.
    let copyable = false;
    // Set on a committed edit (move / resize / rotate) so the next selection
    // report (the edited geometry) clears the live preview instead of an
    // unrelated update doing so.
    let committingEdit = false;
    // What a gesture of the shell's extension reaches on the canvas.
    const gestureHost: CanvasGestureHost = {
        preview: (preview) => selection.setPreview(preview),
        refreshChrome: () => selection.refresh(),
        committing: () => {
            committingEdit = true;
        },
    };
    // A polygon, polyline or cloud being clicked out: its page, the corners
    // placed so far (page-local), and the pointer — the corner it would place
    // next. It spans presses, so it lives beside `gesture` rather than in it; a
    // double-click or Enter finishes it, and putting the tool down drops it.
    let polygonDraft: {
        tool: AnnotationTool;
        page: number;
        corners: ShapePoint[];
        pointer: ShapePoint | null;
    } | null = null;
    // Finished drawings — strokes, polygons, placed shapes — each kept drawn
    // until the first frame after the engine has it (`landed`), so it doesn't
    // blink out for the round trip before the engine paints it. Oldest first; a
    // quick hand can finish the next stroke before the last one lands.
    let heldSketches: Array<Sketch & { landed: boolean }> = [];
    // The sketch layer's paths, one per sketch shown, reused frame to frame.
    const sketchPaths: SVGPathElement[] = [sketchPath];

    // Hover hit probe (latest-wins): the whole `UDocHit` under the resting
    // pointer. Only the engine knows what's under a point, so we ask it
    // (`hitTest`) rather than cache every box on the main thread — correct by
    // construction as edits and collaborators change the layout, with no cache to
    // invalidate. Coalesced to one request in flight. It drives two things: the
    // I-beam cursor over text (applied only when the reply is still freshest and
    // the pointer hasn't moved off the probed point, so it only upgrades the bare
    // cursor), and `hoverHit` — the cached classification a press routes its
    // gesture on, so pointerdown can pick text / cell / object synchronously
    // without its own round-trip (the press lands where the pointer just rested).
    let hoverProbeSeq = 0;
    let hoverProbeBusy = false;
    let hoverProbeLatest: { x: number; y: number } | null = null;
    // Where the idle pointer rests over the canvas (local px), or null once it
    // has left. A scroll, a zoom or an edit moves the content under a pointer
    // that did not move, and no pointermove says so — each painted frame re-runs
    // the hover pass here instead (see `hover`).
    let restingPointer: { x: number; y: number } | null = null;
    // Whether Shift and the link key are held, as the last pointer move or key
    // said — what the resting cursor over a link reads (see `linkCursor`).
    let shiftHeld = false;
    let linkKeyHeld = false;
    // The latest resolved hover hit and the canvas-local point it was probed at.
    // Read at press time (`hitAt`) to route the gesture; stale beyond a small
    // radius (the pointer moved since), where it reads as `"none"`.
    let hoverHit: UDocHit = "none";
    let hoverHitAt: { x: number; y: number } | null = null;

    // Single-page wheel paging: a scroll that hits a page edge flips to the
    // adjacent page. `pageFlipArmed` allows one flip per gesture — it re-arms
    // only once the wheel has rested for `WHEEL_REST_MS`, so a trackpad's
    // momentum tail can't skip several pages in a single flick.
    let pageFlipArmed = true;
    let lastWheelTs = 0;

    /** Factor a marquee-zoom *click* (no rubber-band) steps the zoom by. */
    const ZOOM_CLICK_STEP = 1.5;

    function currentViewport(state: UIState): Viewport {
        return {
            scrollX: state.scrollX,
            scrollY: state.scrollY,
            zoom: state.zoom,
            dpr: globalThis.devicePixelRatio || 1,
            width: state.viewportWidth,
            height: state.viewportHeight,
        };
    }

    function mount(container: HTMLElement, s: Store<UIState, Action>): void {
        store = s;
        // Mount the grid `root` (bands + content pane); `el` is inside it.
        container.appendChild(root);

        // Reserve the guide bands from whatever host-static state exists now,
        // before the first measure below — so if a doc type is already known the
        // content pane is measured band-inset from the start. On a fresh mount the
        // type isn't known yet (nothing reserved); the open path then reserves and
        // pushes the inset viewport synchronously before the first paint (see
        // `reserveGuides`), and runtime changes (the extension's band shown or
        // hidden) re-reserve via `offBands`.
        const applyBandLayout = () => {
            guideBands.layout(bandKind(s.getState()));
            applyScrollbarMode(s.getState());
        };
        applyBandLayout();
        // Whether a band change waits on the worker's frame at the pane's new
        // size — see `changeBandLayout`.
        let bandAwaitsFrame = false;

        // Track the host's CSS size → viewport metrics, keeping the canvas's
        // CSS size in lock-step with the worker's backing store.
        //
        // The CSS size (here) and the backing-store size (in the worker) live
        // on different threads. If the main thread grows the CSS box before the
        // worker has repainted the larger backing store, the browser scales the
        // old pixels to fill it — the page visibly stretches during a resize.
        //
        // So we never set the CSS size ahead of the pixels: on resize we only
        // push the new metrics to the worker; it repaints at the new size and
        // acks via `onResized`, and only then do we commit the CSS size (see
        // the onResized subscription below). The first measure is the lone
        // exception — there are no painted pixels yet, so it sets the CSS size
        // immediately to claim layout space. Resizing is rare, so it's also
        // debounced (see `measure`).
        let sized = false;
        // Pin the canvas's CSS box onto the integer device-pixel grid. The
        // worker allocates a backing store of `round(cssSize × dpr)` device px
        // (see facade-wasm `session.rs`); if we then display that integer
        // backing in a CSS box whose `cssSize × dpr` isn't that same integer —
        // or whose top-left maps to a fractional physical pixel — the browser's
        // compositor bilinear-resamples the whole surface, softening every
        // glyph. This bites only at fractional dpr (e.g. 1.1 / 125% scaling),
        // where layout-driven CSS sizes and offsets almost never land on the
        // device grid. So we set the CSS size to `backing / dpr` (making
        // `cssSize × dpr` exactly the backing) and translate the surface by the
        // sub-pixel remainder of its physical origin. Same device-grid snap
        // OverlayManager already applies to page-anchored chrome.
        // The canvas CSS width its backing store is currently painted at. Held
        // so the surface can be kept centred in its host while a resize is in
        // flight (committed size != host size); `0` until the first measure.
        let committedCssW = 0;
        const commitCanvasSize = (cssW: number, cssH: number) => {
            const dpr = globalThis.devicePixelRatio || 1;
            const backingW = Math.max(1, Math.round(cssW * dpr));
            const backingH = Math.max(1, Math.round(cssH * dpr));
            canvas.style.width = `${backingW / dpr}px`;
            canvas.style.height = `${backingH / dpr}px`;
            committedCssW = backingW / dpr;
            applyCanvasTransform();
        };
        // Position the surface: the device-grid sub-pixel snap, plus — while a
        // resize is in flight — a horizontal shift that keeps the (still
        // old-sized) backing centred in its host. A side panel opening shrinks
        // the host now but the backing is repainted, re-fitted and re-centred a
        // worker round-trip later; without this the stale page sits off-centre
        // and visibly slides over when the re-fit lands. Shifting by half the
        // host's width change centres it immediately, so the re-fit is
        // seamless. The shift tracks the panel's width transition (the observer
        // fires each frame) and is exactly zero once the backing matches the
        // host again.
        function applyCanvasTransform(): void {
            const dpr = globalThis.devicePixelRatio || 1;
            const { left, top, width } = el.getBoundingClientRect();
            const dx = (Math.round(left * dpr) - left * dpr) / dpr;
            const dy = (Math.round(top * dpr) - top * dpr) / dpr;
            let shiftX = committedCssW > 0 ? -(committedCssW - width) / 2 : 0;
            if (Math.abs(shiftX) < 0.5) shiftX = 0; // settled (or sub-pixel) — no drift
            const tx = dx + shiftX;
            canvas.style.transform = tx || dy ? `translate(${tx}px, ${dy}px)` : "";
            // Slide the guide bands' marks by the same shift so the ruler /
            // column headers ride the content canvas instead of sitting frozen
            // (the worker repaint that refreshes them is debounced). Zero once
            // settled. See GuideBands.setContentShift.
            guideBands.setContentShift(shiftX);
        }
        const applyMeasure = () => {
            const rect = el.getBoundingClientRect();
            if (!sized) {
                commitCanvasSize(rect.width, rect.height);
                sized = true;
            }
            s.dispatch({ type: "RESIZE_VIEWPORT", width: rect.width, height: rect.height });
        };
        const measure = () => {
            // Re-centre the canvas immediately as the host animates (cheap, runs
            // every frame of the panel slide); debounce the worker resize itself
            // (heavy, rare) so it fires once the size settles.
            applyCanvasTransform();
            if (resizeTimer !== null) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                resizeTimer = null;
                applyMeasure();
            }, 150);
        };
        resizeObserver = new ResizeObserver(measure);
        resizeObserver.observe(el);
        applyMeasure(); // initial size, immediate

        // Synthetic scroll + zoom. `passive: false` so we can preventDefault.
        // On the host (not the canvas) so wheel over overlay chrome — the page
        // pill, an insert strip in a gap — still scrolls the document.
        el.addEventListener("wheel", onWheel, { passive: false });
        cleanups.push(() => el.removeEventListener("wheel", onWheel));

        // Click-select and object-move drag (edit mode, select pointer). One
        // pointer gesture: a press over a selected object that travels past the
        // threshold is a move (committed on release); anything shorter is a
        // click-select. The selection overlay is `pointer-events: none`, so a
        // press over a selected box still targets the bare canvas underneath.
        // A click on an annotation is reported in the capture phase, before
        // the handlers below act on it (follow a link, pick).
        el.addEventListener("pointerdown", onClickPress, true);
        el.addEventListener("pointerup", onClickRelease, true);
        el.addEventListener("pointerdown", onPointerDown);
        el.addEventListener("pointermove", onPointerMove);
        el.addEventListener("pointerup", onPointerUp);
        el.addEventListener("pointercancel", onPointerCancel);
        el.addEventListener("pointerleave", onPointerLeave);
        el.addEventListener("gotpointercapture", onGotCapture);
        el.addEventListener("lostpointercapture", onLostCapture);
        cleanups.push(() => {
            el.removeEventListener("pointerdown", onClickPress, true);
            el.removeEventListener("pointerup", onClickRelease, true);
            el.removeEventListener("pointerdown", onPointerDown);
            el.removeEventListener("pointermove", onPointerMove);
            el.removeEventListener("pointerup", onPointerUp);
            el.removeEventListener("pointercancel", onPointerCancel);
            el.removeEventListener("pointerleave", onPointerLeave);
            el.removeEventListener("gotpointercapture", onGotCapture);
            el.removeEventListener("lostpointercapture", onLostCapture);
        });

        // Right-click: the context menu over the document (edit mode only).
        el.addEventListener("contextmenu", onContextMenu);
        cleanups.push(() => el.removeEventListener("contextmenu", onContextMenu));

        // Spreadsheet header selection: a press on the top band selects whole
        // columns, the left band whole rows, the corner box the whole sheet — the
        // header analog of the content pane's cell gesture. The bands sit outside
        // `el`, so their presses never reach the content pointer handlers; these
        // handlers translate a band press into the matching select call. Active
        // only while a spreadsheet's header bands show and the select pointer is
        // live (view or edit), matching the cell gesture's gate.
        let bandGesture: {
            axis: "column" | "row";
            anchorX: number;
            anchorY: number;
            pointerId: number;
            extend: boolean;
        } | null = null;
        const headerSelectActive = (): boolean => {
            const st = s.getState();
            return bandKind(st) === "header" && st.pointerMode.kind === "select";
        };
        // Header resize: dragging the boundary between two headers previews a new
        // column width / row height with a guide line and a col-/row-resize
        // cursor, then commits a `ResizeColumns` / `ResizeRows` edit on release
        // (see endResize). It takes precedence over selection at a boundary (an
        // interior press still selects), and is live whenever the header bands
        // show outside view mode, in any pointer mode — matching how a
        // spreadsheet resizes regardless of the active tool. View mode only
        // views: a boundary there is a plain header press.
        const RESIZE_EDGE_TOL = 4; // CSS px either side of a boundary that grabs it
        const RESIZE_MIN_TRACK = 8; // CSS px a track can't be dragged below
        const RESIZE_DRAG_SLOP = 3; // CSS px of drag before a boundary press becomes a resize
        // A resize is armed on a boundary press but stays a *click* until the
        // pointer drags past the slop — so a press-release near an edge still
        // selects the header (see endResize), never swallowed by the resize. The
        // guide only appears once `moved` flips on the first real drag.
        let resizeGesture: {
            axis: "column" | "row";
            index: number;
            start: number;
            pointerId: number;
            pressX: number;
            pressY: number;
            shift: boolean;
            moved: boolean;
        } | null = null;
        const headerResizeActive = (): boolean => {
            const st = s.getState();
            return bandKind(st) === "header" && st.mode !== VIEW_MODE;
        };
        // A band press in canvas-relative CSS px — the same space the content
        // canvas resolves picks in (the top/left bands share the content pane's
        // edges), so the engine reads a band x as a column and a band y as a row,
        // and the header guide's track edges are measured in it too.
        const bandPoint = (ev: PointerEvent): { x: number; y: number } => {
            const rect = canvas.getBoundingClientRect();
            return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
        };
        // The header boundary near a band point, or null — column boundaries read
        // the x, row boundaries the y (matching each band's axis).
        const boundaryUnder = (axis: "column" | "row", p: { x: number; y: number }) =>
            axis === "column"
                ? guideBands.columnBoundaryAt(p.x, RESIZE_EDGE_TOL)
                : guideBands.rowBoundaryAt(p.y, RESIZE_EDGE_TOL);
        // Position the guide line + size label from a boundary position (CSS px,
        // content-pane relative). The CSS folds in the band offset, so `pos` is
        // the raw content coordinate. The label reads the size a release here
        // commits — in document points, the same as the commit below — so it
        // doesn't change with zoom.
        const drawResizeGuide = (pos: number): void => {
            const g = resizeGesture;
            if (!g) return;
            resizeGuide.style.setProperty("--udoc-resize-pos", `${pos}px`);
            resizeGuideLabel.textContent = i18n.t("format.points", { points: Math.round((pos - g.start) / lastScale) });
        };
        const dispatchBand = (p: { x: number; y: number }): void => {
            const g = bandGesture;
            if (!g) return;
            if (g.axis === "column")
                client.selectSheetColumns({ x: g.anchorX, y: 0 }, { x: p.x, y: 0 }, { extend: g.extend });
            else client.selectSheetRows({ x: 0, y: g.anchorY }, { x: 0, y: p.y }, { extend: g.extend });
        };
        const onBandDown = (axis: "column" | "row") => (ev: PointerEvent) => {
            if (ev.button !== 0) return;
            const p = bandPoint(ev);
            // A press on a track boundary resizes; anything else selects.
            const boundary = headerResizeActive() ? boundaryUnder(axis, p) : null;
            if (boundary) {
                // Arm a resize, but stay a click until the pointer drags past the
                // slop: a press-release without a drag falls through to a header
                // selection (endResize), so clicking near an edge still selects.
                ev.preventDefault();
                resizeGesture = {
                    axis,
                    index: boundary.index,
                    start: boundary.start,
                    pointerId: ev.pointerId,
                    pressX: p.x,
                    pressY: p.y,
                    shift: ev.shiftKey,
                    moved: false,
                };
                (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
                return;
            }
            if (!headerSelectActive()) return;
            ev.preventDefault();
            bandGesture = { axis, anchorX: p.x, anchorY: p.y, pointerId: ev.pointerId, extend: ev.shiftKey };
            (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
            dispatchBand(p);
        };
        // Combined per-band move: drive a live resize / selection drag, else
        // update the hover cursor over a boundary.
        const onBandMove = (axis: "column" | "row") => (ev: PointerEvent) => {
            if (resizeGesture && resizeGesture.pointerId === ev.pointerId) {
                const p = bandPoint(ev);
                const raw = axis === "column" ? p.x : p.y;
                const from = axis === "column" ? resizeGesture.pressX : resizeGesture.pressY;
                if (!resizeGesture.moved) {
                    // Below the slop it's still a click, not a resize — show nothing.
                    if (Math.abs(raw - from) < RESIZE_DRAG_SLOP) return;
                    resizeGesture.moved = true;
                    resizeGuide.classList.toggle("udoc-ui__resize-guide--column", axis === "column");
                    resizeGuide.classList.toggle("udoc-ui__resize-guide--row", axis === "row");
                    resizeGuide.style.display = "";
                }
                drawResizeGuide(Math.max(raw, resizeGesture.start + RESIZE_MIN_TRACK));
                return;
            }
            if (bandGesture && bandGesture.pointerId === ev.pointerId) {
                dispatchBand(bandPoint(ev));
                return;
            }
            // Idle hover: show the resize cursor when over a boundary.
            const band = ev.currentTarget as HTMLElement;
            const near = headerResizeActive() && boundaryUnder(axis, bandPoint(ev));
            band.style.cursor = near ? (axis === "column" ? "col-resize" : "row-resize") : "";
        };
        const endResize = (ev: PointerEvent, select: boolean): boolean => {
            if (!resizeGesture || resizeGesture.pointerId !== ev.pointerId) return false;
            const g = resizeGesture;
            resizeGesture = null;
            (ev.currentTarget as HTMLElement).releasePointerCapture(ev.pointerId);
            resizeGuide.style.display = "none";
            if (!g.moved) {
                // A boundary press with no drag is a header click, not a resize —
                // select the whole column / row it fell in, so selection keeps
                // working near edges. `select` is false on a cancel.
                if (select && headerSelectActive()) {
                    if (g.axis === "column")
                        client.selectSheetColumns({ x: g.pressX, y: 0 }, { x: g.pressX, y: 0 }, { extend: g.shift });
                    else client.selectSheetRows({ x: 0, y: g.pressY }, { x: 0, y: g.pressY }, { extend: g.shift });
                }
                return true;
            }
            // A drag ended: commit the new track size, unless this was a cancel
            // (`select` false — Escape / pointercancel), which discards the
            // preview. The boundary lands where the guide was drawn (clamped to
            // the min track); its distance from the track's near edge is the new
            // size in CSS px, scaled back to document points for the command.
            if (select) {
                const p = bandPoint(ev);
                const raw = g.axis === "column" ? p.x : p.y;
                const pos = Math.max(raw, g.start + RESIZE_MIN_TRACK);
                const points = (pos - g.start) / lastScale;
                if (g.axis === "column") hooks.resizeColumn?.(g.index, points);
                else hooks.resizeRow?.(g.index, points);
            }
            return true;
        };
        const endBand = (ev: PointerEvent, commit: boolean) => {
            if (!bandGesture || bandGesture.pointerId !== ev.pointerId) return;
            if (commit) dispatchBand(bandPoint(ev));
            (ev.currentTarget as HTMLElement).releasePointerCapture(ev.pointerId);
            bandGesture = null;
        };
        const onBandUp = (ev: PointerEvent) => {
            if (endResize(ev, true)) return;
            endBand(ev, true);
        };
        const onBandCancel = (ev: PointerEvent) => {
            if (endResize(ev, false)) return;
            endBand(ev, false);
        };
        // Clear the hover resize cursor when the pointer leaves an idle band.
        const onBandLeave = (ev: PointerEvent) => {
            if (resizeGesture || bandGesture) return;
            (ev.currentTarget as HTMLElement).style.cursor = "";
        };
        const onCornerDown = (ev: PointerEvent) => {
            if (ev.button !== 0 || !headerSelectActive()) return;
            ev.preventDefault();
            client.selectSheet();
        };
        const onBandTopDown = onBandDown("column");
        const onBandLeftDown = onBandDown("row");
        const onBandTopMove = onBandMove("column");
        const onBandLeftMove = onBandMove("row");
        bandTop.addEventListener("pointerdown", onBandTopDown);
        bandTop.addEventListener("pointermove", onBandTopMove);
        bandTop.addEventListener("pointerup", onBandUp);
        bandTop.addEventListener("pointercancel", onBandCancel);
        bandTop.addEventListener("pointerleave", onBandLeave);
        bandLeft.addEventListener("pointerdown", onBandLeftDown);
        bandLeft.addEventListener("pointermove", onBandLeftMove);
        bandLeft.addEventListener("pointerup", onBandUp);
        bandLeft.addEventListener("pointercancel", onBandCancel);
        bandLeft.addEventListener("pointerleave", onBandLeave);
        bandCorner.addEventListener("pointerdown", onCornerDown);
        cleanups.push(() => {
            bandTop.removeEventListener("pointerdown", onBandTopDown);
            bandTop.removeEventListener("pointermove", onBandTopMove);
            bandTop.removeEventListener("pointerup", onBandUp);
            bandTop.removeEventListener("pointercancel", onBandCancel);
            bandTop.removeEventListener("pointerleave", onBandLeave);
            bandLeft.removeEventListener("pointerdown", onBandLeftDown);
            bandLeft.removeEventListener("pointermove", onBandLeftMove);
            bandLeft.removeEventListener("pointerup", onBandUp);
            bandLeft.removeEventListener("pointercancel", onBandCancel);
            bandLeft.removeEventListener("pointerleave", onBandLeave);
            bandCorner.removeEventListener("pointerdown", onCornerDown);
        });

        // Shift toggles the resize aspect-ratio lock / rotation snap mid-drag,
        // and, idle, whether a click on a link follows it. On `window` (not the
        // canvas) so it still fires while the pointer is captured and held
        // still — the press/release alone updates the preview or the cursor.
        window.addEventListener("keydown", onEditModifier);
        window.addEventListener("keyup", onEditModifier);
        cleanups.push(() => {
            window.removeEventListener("keydown", onEditModifier);
            window.removeEventListener("keyup", onEditModifier);
        });

        // Enter finishes the polygon being clicked out, as a double-click does;
        // putting its tool down — Escape, another tool, its own button again —
        // drops it.
        window.addEventListener("keydown", onPolygonKey);
        cleanups.push(() => window.removeEventListener("keydown", onPolygonKey));
        const offPolygonTool = subscribeSelector(
            s,
            (st) => st.pointerMode,
            (pointer) => {
                const armed = pointer.kind === "place" && pointer.tool.kind === "annotation" ? pointer.tool.tool : null;
                if (!polygonDraft || armed === polygonDraft.tool) return;
                polygonDraft = null;
                renderSketch();
            },
        );
        cleanups.push(offPolygonTool);

        // Object selection lives in both view and edit; edit additionally shows
        // the resize/rotate chrome (setEditable). Switching between view and edit
        // keeps the selection (just toggles the chrome) — but for a form field's
        // widget, which view mode never selects, so entering it drops one. The
        // page-control rail is edit-only, so its hover state clears off edit.
        const applyModeSelection = (mode: string) => {
            selection.setEditable(mode !== VIEW_MODE);
            const widget = s.getState().selectedAnnotations?.annotations.some((a) => subtypeOf(a.kind) === "widget");
            if (mode === VIEW_MODE && widget === true) client.clearSelection();
            if (mode === VIEW_MODE) setHoveredPage(null);
            // Leaving edit mode parks the hidden text field (and its focus).
            syncTextInput();
        };
        const offMode = subscribeSelector(s, (st) => st.mode, applyModeSelection);
        cleanups.push(offMode);
        applyModeSelection(s.getState().mode);

        // The search's matches, redrawn when they grow, the current one moves,
        // or another sheet is shown — a highlight draws on its own plane only.
        const searchSlice = (st: UIState) => ({
            matches: st.searchMatches,
            active: st.searchActiveIndex,
            plane: st.currentPlane,
        });
        const applySearch = ({ matches, active, plane }: ReturnType<typeof searchSlice>) =>
            search.setMatches(matches, active, plane);
        const offSearch = subscribeSelector(s, searchSlice, applySearch, { equality: shallowEqual });
        cleanups.push(offSearch);
        applySearch(searchSlice(s.getState()));

        // Re-reserve the guide bands whenever the band changes: a new
        // document's type, the extension's band shown or hidden, or a sheet
        // with no grid shown in place of one with. The pane's size under the new
        // strips goes to the worker at once, beside whatever changed with them
        // (the sheet a tab click shows), and the strips change when the worker
        // acks the frame it painted at that size, as the canvas takes it (see
        // `offResized`). Changed as they happen, they moved the old frame with
        // the pane, and the worker repainted a debounced resize later: a
        // switch between a chartsheet and a worksheet flickered through three
        // frames.
        const changeBandLayout = (kind: BandKind) => {
            const shown = guideBands.kind;
            const before = el.getBoundingClientRect();
            // Lay the strips out to read the pane's size under them, then put
            // the shown ones back: one task, so nothing paints in between.
            guideBands.layout(kind);
            const after = el.getBoundingClientRect();
            guideBands.layout(shown);
            if (after.width === before.width && after.height === before.height) {
                applyBandLayout();
                return;
            }
            bandAwaitsFrame = true;
            s.dispatch({ type: "RESIZE_VIEWPORT", width: after.width, height: after.height });
        };
        const offBands = subscribeSelector(s, bandKind, changeBandLayout);
        cleanups.push(offBands);

        // The base cursor follows the pointer mode (grab for pan, zoom-in for
        // marquee-zoom, the I-beam for a markup tool, a crosshair for the other
        // place tools; select clears it and lets hover-over-selection set it).
        const offCursor = subscribeSelector(
            s,
            (st) => st.pointerMode,
            () => applyModeCursor(),
        );
        cleanups.push(offCursor);
        applyModeCursor();

        // The view is pushed to the worker as three independent intents, in this
        // registration order so a fit clears before the zoom that replaces it
        // (subscribers fire in order within a batched notification):
        //
        //   1. fit   — the fit mode + cap, deduped so a re-send doesn't re-arrange
        //   2. scroll/resize — scroll + viewport size (NOT zoom; see below)
        //   3. zoom  — each zoom intent, forwarded to the engine's `zoomAtPoint`
        //
        // Zoom does not ride the scroll push: with screen-fixed page spacing the
        // post-zoom scroll depends on layout only the engine knows, so the engine
        // owns it (`zoomAtPoint` / `zoomToRect`) and streams scroll + zoom back via
        // onPageViews → SYNC_VIEW. The store batches notifications, so a wheel
        // burst coalesces to one intent; the worker coalesces further onto a frame.
        // Push the fit on every `refitSeq` bump — i.e. every `SET_FIT`,
        // including re-picking the active fit. Keyed on the seq (not the fit)
        // so it re-fires at an unchanged fit, so the engine re-frames
        // (re-centers) the current page on the active fit.
        const offFit = subscribeSelector(
            s,
            (st) => st.refitSeq,
            () => client.setFit(s.getState().fit),
        );
        cleanups.push(offFit);

        const offViewport = subscribeSelector(
            s,
            (st) => ({
                scrollX: st.scrollX,
                scrollY: st.scrollY,
                width: st.viewportWidth,
                height: st.viewportHeight,
            }),
            () => client.setViewport(currentViewport(s.getState())),
            { equality: shallowEqual },
        );
        cleanups.push(offViewport);

        // Each zoom action bumps `zoomRequest.seq`; forward it to the engine as a
        // cursor-anchored zoom (anchor in CSS px — the wasm boundary applies the
        // dpr). Keyed on the seq so it re-fires even at an unchanged zoom, but
        // never from SYNC_VIEW adopting the engine's zoom (which leaves the seq
        // untouched) — so there's no loop.
        const offZoom = subscribeSelector(
            s,
            (st) => st.zoomRequest.seq,
            () => {
                const { zoom, x, y } = s.getState().zoomRequest;
                client.zoomAtPoint(zoom, x, y);
            },
        );
        cleanups.push(offZoom);

        // Drive the overlay layer from the worker's per-frame page geometry
        // (already projected to CSS px): position page-anchored chrome to match
        // the pixels Rust just painted, so overlays track scroll/zoom without a
        // main-thread recompute that could drift from the canvas.
        //
        // The same stream carries the engine's authoritative view state. When
        // the frame is fresh (reflects the latest viewport we sent — never a
        // stale mid-burst frame that would yank the view back), adopt any
        // extent/scroll the engine derived differently than the reducer did:
        // with px page spacing the extent depends on zoom, and a re-stack may
        // have re-anchored the scroll.
        const offViews = client.onPageViews((frame) => {
            lastScale = frame.scale;
            lastViews = frame.views;
            lastSheet = profileFor(s.getState().docType).sheetTabs ? frame.plane : -1;
            // Selection first: the page-insert overlay reads the selection's
            // keep-out rect (via `selectionKeepOut`) as it renders, so its chrome
            // must be projected against this frame before the overlay runs.
            search.render({ views: frame.views, scale: frame.scale });
            annotationHover.render({ views: frame.views, scale: frame.scale });
            selection.render({ views: frame.views, scale: frame.scale });
            textInput.setPosition(selection.caretViewportRect());
            // A finished drawing the engine has is painted in this frame, so
            // drop ours; re-project the rest onto the frame's view.
            if (heldSketches.some((held) => held.landed)) heldSketches = heldSketches.filter((held) => !held.landed);
            renderSketch();
            renderOverlays({
                views: frame.views,
                scale: frame.scale,
                branding: lastBrandingRect,
                sheet: lastSheet,
            });
            // Paint the guide bands' content into the strips `applyBandLayout`
            // reserved; whether a band shows (and how thick) is host-static and
            // set there, so the per-frame paint only fills the reserved space.
            guideBands.render(frame.guide);
            // `null` on a frame that painted nothing (a report also rides an
            // idle frame that owes the client a seq echo) — hold the last real
            // box rather than blinking it off.
            if (frame.repaintArea) lastRepaintArea = frame.repaintArea;
            // Gated on the option, not left to `renderRepaintArea` to shrug
            // off: with the box hidden this is every frame's cost for nothing.
            if (showRepaintArea) renderRepaintArea();
            if (frame.fresh && s.getState().status === "ready") {
                syncViewState(s, frame);
                syncCurrentPage(s, frame);
                syncShownPages(s, frame);
            }
            // Last, against this frame's page rects and selection chrome: the
            // content may have moved under a pointer that did not.
            if (restingPointer && gesture === null) hover(restingPointer.x, restingPointer.y);
        });
        cleanups.push(offViews);

        // The "Show Repaint Area" developer option. Nothing is pushed to the
        // engine: it reports the box on every frame regardless, so the toggle
        // only decides whether this host draws it.
        const offRepaintArea = subscribeSelector(
            s,
            (st) => st.developerOptions.repaintArea,
            (on) => {
                showRepaintArea = on;
                renderRepaintArea();
            },
        );
        cleanups.push(offRepaintArea);

        // Adopt the selection state (local + peers) whenever the worker
        // reports it changed (a click-select, a clear, a presence merge, or
        // an edit that moved/deleted objects). A just-committed move clears the
        // drag nudge here, where its fresh geometry lands — so the boxes settle
        // onto the moved object without snapping back first.
        const offSelection = client.onSelection((state) => {
            const resetDrag = committingEdit;
            committingEdit = false;
            selection.setState(state, resetDrag);
            // Tint the selected column / row headers on the guide band. A cell
            // selection repaints no engine pixels (no new frame), so the band
            // learns of the selection here rather than through the per-frame guide.
            guideBands.setSelection(state.local.headers ?? null);
            // ObjectText = an object box drawn together with a caret / text range
            // — or a free text's annotation box with the caret in its text, which
            // reads the same way; flow text has the caret / text with no box.
            const g = state.local;
            inObjectText = (g.objects.length > 0 || g.annotations.length > 0) && (g.text.length > 0 || g.caret != null);
            editingText = g.caret != null || g.text.length > 0;
            annotationSelected = g.annotations.length > 0;
            copyable = state.capabilities.copyable;
            syncTextInput();
            textInput.setPosition(selection.caretViewportRect());
        });
        cleanups.push(offSelection);
        // The peers' pointers, placed on their own: one moving re-projects no box.
        cleanups.push(client.onPeerPointers((pointers) => selection.setPeerPointers(pointers)));

        // Commit the canvas's CSS size only once the worker has repainted the
        // backing store at the new size, so the browser never scales stale
        // pixels (the resize "stretch"). See the `applyMeasure` comment.
        const offResized = client.onResized(({ width, height }) => {
            // A band change waiting on this frame shows with it — first, so the
            // canvas is placed in the pane its strips leave.
            if (bandAwaitsFrame) {
                bandAwaitsFrame = false;
                applyBandLayout();
            }
            commitCanvasSize(width, height);
        });
        cleanups.push(offResized);

        // Lay the attribution click target over the engine-painted decal. Its
        // CSS rect is viewport-relative (bottom-right), matching the canvas-host
        // box; `null` (no viewport yet) hides it.
        const offBranding = client.onBrandingRect((rect) => {
            // The decal is punched out of every overlay's content clip so nothing
            // paints over the logo. Cache it for the layers driven off the cached
            // frame (overlay, marquee) and hand it to the selection; the branding
            // stream is independent of the paint frame, so re-clip the overlay now
            // rather than waiting for the next paint.
            lastBrandingRect = rect;
            search.setBrandingRect(rect);
            annotationHover.setBrandingRect(rect);
            selection.setBrandingRect(rect);
            renderOverlays({ views: lastViews, scale: lastScale, branding: rect, sheet: lastSheet });
            if (!rect) {
                brandingLink.style.display = "none";
                return;
            }
            brandingLink.style.left = `${rect.x}px`;
            brandingLink.style.top = `${rect.y}px`;
            brandingLink.style.width = `${rect.width}px`;
            brandingLink.style.height = `${rect.height}px`;
            brandingLink.style.display = "block";
        });
        cleanups.push(offBranding);

        // Initial viewport (measure() above already set the size).
        client.setViewport(currentViewport(s.getState()));
    }

    /**
     * Register (or replace) a page-anchored overlay under `id`, in the layer
     * under the selection or, with `aboveSelection`, the one over it — taking
     * it out of the other. The manager renders it against the latest frame
     * immediately and on every painted frame after. `udoc:`-prefixed ids are
     * the built-ins, removable like any other.
     */
    function setOverlay(id: string, source: OverlaySource, options: OverlayOptions = {}): void {
        const [layer, other] = options.aboveSelection ? [overlayAbove, overlay] : [overlay, overlayAbove];
        other.remove(id);
        layer.set(id, source);
    }

    /** Remove the overlay registered under `id`, from whichever layer holds it
     *  (false if unknown). */
    function removeOverlay(id: string): boolean {
        return overlay.remove(id) || overlayAbove.remove(id);
    }

    /**
     * The viewport region the current selection's edit chrome (resize handles +
     * rotation grip) covers, or null when nothing is selected — the page-insert
     * overlay reads it each frame to keep its strips out from under the handles.
     */
    function selectionKeepOut(): KeepOutRect | null {
        return selection.keepOutRect();
    }

    /** Adopt the engine's authoritative extent/scroll when it actually moved. */
    function syncViewState(s: Store<UIState, Action>, frame: PageViewsFrame): void {
        const st = s.getState();
        // The engine's faithful zoom for this frame, recovered from its CSS-px
        // scale. The engine owns the zoom in every mode now — a fit derives it, a
        // marquee / zoomAtPoint sets it explicitly — so adopt it whenever it drifts
        // from what the reducer shows (effectiveZoom while fitting, else `zoom`).
        const derivedZoom = frame.scale / cssPxPerPt(viewDpi(st));
        const drifted =
            Math.abs(st.scrollSize.width - frame.scrollSize.width) > SYNC_EPSILON ||
            Math.abs(st.scrollSize.height - frame.scrollSize.height) > SYNC_EPSILON ||
            Math.abs(st.scrollX - frame.scroll.x) > SYNC_EPSILON ||
            Math.abs(st.scrollY - frame.scroll.y) > SYNC_EPSILON ||
            st.scrollbars.x !== frame.scrollbars.x ||
            st.scrollbars.y !== frame.scrollbars.y;
        const shownZoom = st.fit.mode === "none" ? st.zoom : (st.effectiveZoom ?? st.zoom);
        const zoomDrift = Math.abs(shownZoom - derivedZoom) > SYNC_EPSILON;
        // Always adopt the first painted frame, even when nothing drifted: a
        // fit-less open (a spreadsheet grid opens at an explicit 100% with the
        // content extent already known and scroll pinned at the origin) matches
        // the OPEN_SUCCESS state exactly, so a drift-only gate would never flip
        // `viewSettled` — and the scrollbar, which is gated on it, would never
        // appear. Later frames keep the drift check.
        if (!drifted && !zoomDrift && st.viewSettled) return;
        s.dispatch({
            type: "SYNC_VIEW",
            scrollSize: frame.scrollSize,
            scrollUsedSize: frame.scrollUsedSize,
            scrollbars: frame.scrollbars,
            scrollX: frame.scroll.x,
            scrollY: frame.scroll.y,
            zoom: derivedZoom,
        });
    }

    /**
     * Adopt the engine's current page so the page-number control follows the
     * scroll position. A "go to page" needs no hold here: the engine pins the
     * page it lands on while it stays in view, though a later page sits at the
     * viewport's center. The reducer no-ops when the index is unchanged, so
     * this can run on every painted frame.
     */
    function syncCurrentPage(s: Store<UIState, Action>, frame: PageViewsFrame): void {
        if (frame.currentPage === null || frame.currentPage === s.getState().pageIndex) return;
        s.dispatch({ type: "SET_PAGE_INDEX", pageIndex: frame.currentPage });
    }

    /**
     * Adopt the pages the frame showed — in spread mode, the shown spread the
     * page steps move past. The reducer no-ops when the range is unchanged, so
     * this can run on every painted frame.
     */
    function syncShownPages(s: Store<UIState, Action>, frame: PageViewsFrame): void {
        if (frame.views.length === 0) return;
        const indices = frame.views.map((view) => view.index);
        s.dispatch({ type: "SET_SHOWN_PAGES", start: Math.min(...indices), end: Math.max(...indices) + 1 });
    }

    /** Canvas-relative CSS-px coordinates of a pointer event. */
    function localPoint(ev: MouseEvent): { x: number; y: number } {
        const rect = canvas.getBoundingClientRect();
        return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    }

    /**
     * A viewport-px pointer delta → a **page-local** document-point delta for
     * `page`, run back through the inverse of that page's page→viewport affine
     * so it follows the page's own axes (correct under a rotated page view). The
     * affine carries the scale, so this subsumes the plain `/lastScale` divide;
     * it falls back to that divide only when the page isn't resolvable this
     * frame (e.g. scrolled off mid-drag).
     */
    function pageDelta(page: number, dxView: number, dyView: number): { x: number; y: number } {
        const v = selection.pageToViewport(page);
        const inv = v ? invert(v) : null;
        if (!inv) return { x: dxView / lastScale, y: dyView / lastScale };
        return applyVector(inv, dxView, dyView);
    }

    /**
     * The page whose vertical band contains canvas-local `y` (null over a gap or
     * off-page). Horizontal position is ignored so the whole page row counts —
     * reaching rightward into the gutter for the rail never drops the page.
     */
    function pageAt(y: number): number | null {
        for (const v of lastViews) {
            if (y >= v.y && y < v.y + v.height) return v.index;
        }
        return null;
    }

    /**
     * The page whose on-screen rect contains canvas-local `(x, y)` — both axes,
     * unlike {@link pageAt} — or null over a gap/gutter. Where a shape placement
     * starts: a draw must land on an actual page, not the inter-page gutter.
     */
    function pageAtPoint(x: number, y: number): number | null {
        for (const v of lastViews) {
            if (x >= v.x && x < v.x + v.width && y >= v.y && y < v.y + v.height) return v.index;
        }
        return null;
    }

    /**
     * Canvas-local CSS px → a **page-local** document point on `page`, via the
     * inverse of that page's page→viewport affine (so it's correct under a
     * rotated page view). `null` when the page isn't resolvable this frame.
     */
    function pagePoint(page: number, x: number, y: number): ShapePoint | null {
        const v = selection.pageToViewport(page);
        const inv = v ? invert(v) : null;
        return inv ? applyPoint(inv, x, y) : null;
    }

    /**
     * Set the hovered page and, on a change, re-render the overlay immediately so
     * the page-controls rail reveals/hides on pointer move rather than waiting
     * for the next painted frame (a static document paints no frames).
     */
    function setHoveredPage(page: number | null): void {
        if (page === hoveredPage) return;
        hoveredPage = page;
        renderOverlays({ views: lastViews, scale: lastScale, branding: lastBrandingRect, sheet: lastSheet });
    }

    /**
     * Probe the whole {@link UDocHit} under canvas-local `(x, y)` — the resting
     * pointer's classification. Latest-wins: one `hitTest` in flight, newer
     * requests queued (`hoverProbeLatest`) and chased on completion. A request
     * is newer by **identity**, not by position: a frame re-asks the very point
     * the pointer rests on once the content under it has moved, and an answer
     * computed before that is the stale one. The reply does two
     * things: it caches `hoverHit` (with the point it was probed at) so a press
     * can route its gesture synchronously, and — when it's still the freshest
     * probe, the pointer is still exactly on the probed point (it hasn't moved to
     * a handle since), and the pointer is idle over an edit-mode select hover — it
     * upgrades the bare cursor to the I-beam over text, never clobbering a handle /
     * move the synchronous pass already set — and outlines the annotation under
     * the pointer ({@link setAnnotationHover}).
     */
    function probeHover(x: number, y: number): void {
        const asked = { x, y };
        hoverProbeLatest = asked;
        if (hoverProbeBusy) return;
        hoverProbeBusy = true;
        const seq = ++hoverProbeSeq;
        void client.hitTest(x, y).then((hit) => {
            hoverProbeBusy = false;
            const fresh = seq === hoverProbeSeq && hoverProbeLatest === asked;
            // Cache the hit for the next press regardless of freshness of cursor —
            // it's the newest answer we have for this point.
            hoverHit = hit;
            hoverHitAt = { x, y };
            const st = store?.getState();
            const idleHover = gesture === null && st?.status === "ready" && st.pointerMode.kind === "select";
            // Re-resolve the resting cursor now the fresh hit is cached: the
            // synchronous hover pass may have read a stale (or empty) hit and so
            // shown "move" over a text object it couldn't yet see as text, or the
            // bare arrow over a text object off the selection. `selectHoverCursor`
            // re-runs the same handle / border / text decision against the
            // just-updated cache; `fresh` means the pointer still rests on this
            // point, so the recompute lands in place (and re-picks the handle /
            // move cursor unchanged when that's still the answer).
            if (fresh && idleHover) canvas.style.cursor = selectHoverCursor(x, y);
            if (fresh) setAnnotationHover(idleHover ? hit : "none", x, y);
            if (fresh) reportAnnotationHover(annotationOf(hit), x, y);
            if (fresh) setHoverTitle(gesture === null ? hit : "none");
            if (fresh) crossWidgets(gesture === null && st?.mode === VIEW_MODE ? hit : "none");
            // Chase the newest request if one arrived while we waited — a move,
            // or a frame that moved the content under this same point.
            const next = hoverProbeLatest;
            if (next && next !== asked) probeHover(next.x, next.y);
        });
    }

    /**
     * Say in the tooltip what the annotation `hit` picked has to say for
     * itself: the URL a link opens, or a form field's alternate name — or what
     * the text run it picked links to: the link's own tooltip, else the URL it
     * opens — or say nothing where it picked none of these.
     */
    function setHoverTitle(hit: UDocHit): void {
        const link = hitLink(hit);
        const annotation = annotationOf(hit);
        const textLink = hitTextLink(hit);
        const title =
            (link && urlOf(link)) ||
            (annotation && hooks.formFieldAlternateName?.(annotation.id)) ||
            (textLink && (textLink.tooltip ?? textLinkUrl(textLink))) ||
            null;
        if (title) canvas.title = title;
        else canvas.removeAttribute("title");
    }

    /** The widget the resting pointer was last over in view mode — its hex key,
     *  and the action its pointer leaving it runs — or `null`. */
    let hoveredWidget: { id: string; exit: PdfAction | null } | null = null;

    /**
     * Run what the pointer crossing a widget runs, in view mode, where the
     * widget under the resting pointer changed to the one `hit` picked: the
     * last one's `/AA` `/X`, then this one's `/E` (Table 197) — a rollover
     * showing and hiding its popup through hide actions. A gesture, edit mode
     * and the pointer leaving the canvas pass `"none"`: the pointer has left
     * the last one.
     */
    function crossWidgets(hit: UDocHit): void {
        const widget = hitWidget(hit);
        if ((widget?.id ?? null) === (hoveredWidget?.id ?? null)) return;
        const exit = hoveredWidget?.exit;
        if (exit) hooks.followLink?.({ action: exit, destination: null });
        const actions = widget?.widget.additionalActions;
        hoveredWidget = widget && { id: widget.id, exit: actions?.cursorExit ?? null };
        if (actions?.cursorEnter) hooks.followLink?.({ action: actions.cursorEnter, destination: null });
    }

    /** The hex key of the annotation the hovered pointer was last reported over, or `null`. */
    let reportedHover: string | null = null;

    /**
     * Report the annotation under the resting pointer at canvas-local `(x, y)`
     * to {@link CanvasHooks.annotationHover} when it changed.
     */
    function reportAnnotationHover(annotation: { page: string; id: string } | null, x: number, y: number): void {
        const id = annotation?.id ?? null;
        if (id === reportedHover) return;
        reportedHover = id;
        const rect = canvas.getBoundingClientRect();
        hooks.annotationHover?.(annotation, rect.left + x, rect.top + y);
    }

    /**
     * Outline the annotation `hit` picked under the resting pointer at
     * canvas-local `(x, y)` by the area it covers — or clear the outline where
     * `hit` is no annotation, or the point is over the current selection, whose
     * box already marks what it holds.
     */
    function setAnnotationHover(hit: UDocHit, x: number, y: number): void {
        const annotation =
            hit !== "none" && "portable" in hit && "annotation" in hit.portable ? hit.portable.annotation : null;
        const page = annotation && !selection.hitLocal(x, y) ? pageAtPoint(x, y) : null;
        annotationHover.set(annotation && page !== null ? { page, quads: annotation.quads } : null);
    }

    /**
     * The cached hover hit if it was probed within {@link CLICK_CHAIN_RADIUS} of
     * `(x, y)` — the classification a press at that point routes its gesture on.
     * A press lands where the pointer just rested, so the last hover probe covers
     * it; a hit probed farther away (the pointer jumped, or none yet) reads as
     * `"none"`, so the gesture falls back to the object / marquee path.
     */
    function hitAt(x: number, y: number): UDocHit {
        if (!hoverHitAt || Math.hypot(x - hoverHitAt.x, y - hoverHitAt.y) > CLICK_CHAIN_RADIUS) return "none";
        return hoverHit;
    }

    /**
     * The widget `hit` picked — its page and annotation, and how a press fills
     * its form field in — when it is a widget a press fills its field in
     * through ({@link CanvasHooks.formWidget}); else null.
     */
    function fillableWidget(hit: UDocHit): { page: string; annotation: string; kind: FillKind } | null {
        if (hit === "none" || !("portable" in hit) || !("annotation" in hit.portable)) return null;
        const { page, annotation } = hit.portable.annotation;
        const kind = hooks.formWidget?.(annotation) ?? null;
        return kind === null ? null : { page, annotation, kind };
    }

    /** The cursor over a widget a press at canvas-local `(x, y)` fills its form
     *  field in through — the I-beam where it types, the hand where it toggles
     *  or picks — else `""`. */
    function fillCursor(x: number, y: number): string {
        const kind = fillableWidget(hitAt(x, y))?.kind;
        return kind === undefined ? "" : kind === "text" ? "text" : "pointer";
    }

    /**
     * Whether a click — Shift held or not by `shift`, the link key
     * ({@link linkKeyDown}) by `linkKey` — follows the link it lands on: a
     * bare click in view mode, a link-key click in edit mode. The other click
     * selects the link, and a Shift-click extends or toggles the selection as
     * it does anywhere else.
     */
    function clickFollows(shift: boolean, linkKey: boolean): boolean {
        return !shift && linkKey === (store?.getState().mode !== VIEW_MODE);
    }

    /**
     * What a click at canvas-local `(x, y)` follows — a link, or a widget's
     * action ({@link hitTarget}), where the click follows one
     * ({@link clickFollows}) — or null where the click lands on neither, or
     * doesn't follow the one it lands on.
     */
    function followedLink(
        x: number,
        y: number,
        shift: boolean,
        linkKey: boolean,
    ): Pick<LinkAnnotation, "action" | "destination"> | null {
        if (!clickFollows(shift, linkKey)) return null;
        return hitTarget(hitAt(x, y));
    }

    /**
     * The link of the text run or shape a click at canvas-local `(x, y)`
     * follows, where the click follows one ({@link clickFollows}) — or null
     * where it doesn't, or lands on no run whose link goes anywhere this viewer
     * can take it ({@link textLinkFollows}).
     */
    function followedTextLink(x: number, y: number, shift: boolean, linkKey: boolean): TextHyperlink | null {
        if (!clickFollows(shift, linkKey)) return null;
        const link = hitTextLink(hitAt(x, y));
        return link && textLinkFollows(link) ? link : null;
    }

    /** Follow `link`, clicked at canvas-local `(x, y)`, through the shell —
     *  from the page under the point, else the current one. */
    function followTextLinkAt(link: TextHyperlink, x: number, y: number): void {
        hooks.followTextLink?.(link, pageAtPoint(x, y) ?? store?.getState().pageIndex ?? 0);
    }

    /** The hand over a link a click at canvas-local `(x, y)` follows with
     *  Shift and the link key as they are held — a bare click in view mode, a
     *  link-key click in edit mode — else `""`. */
    function linkCursor(x: number, y: number): string {
        return followedLink(x, y, shiftHeld, linkKeyHeld) || followedTextLink(x, y, shiftHeld, linkKeyHeld)
            ? "pointer"
            : "";
    }

    /**
     * The resting cursor over the current selection at canvas-local `(x, y)`
     * (CSS px), for the edit-mode select pointer. The extension's chrome wins
     * (its grips sit over the box chrome; see {@link onPointerDown}), then a
     * resize handle (it overlaps the edge), then the box
     * itself: the {@link SelectionLayer.borderLocal} band is the
     * move grab, and everywhere else over a **text** object is the I-beam — a
     * press there selects text — while a non-text object body stays a move grab,
     * except in a word document, where a press there is still the text verb and
     * re-picks the picture rather than grabbing it, so it keeps the arrow.
     * Off the selection the I-beam still shows over a bare text object (a press
     * starts a text selection there too), otherwise `""` (the mode's default
     * arrow). Whether a point is text is read from the cached hover hit
     * ({@link hitAt}); `inObjectText` short-circuits it, so an object already in
     * text editing always reads as text regardless of the async cache. This is
     * the hover twin of the press routing in {@link onPointerDown} — the two must
     * agree so the cursor never promises an action the press won't take.
     */
    function selectHoverCursor(x: number, y: number): string {
        const extension = hooks.canvasCursor?.(x, y);
        if (extension) return extension;
        const handle = selection.handleAt(x, y);
        if (handle) return selection.resizeCursor(handle.handle, handle.place);
        if (selection.hitLocal(x, y)) {
            // A selection that doesn't move keeps the arrow.
            const move = selection.allows("translateObjects", "translateAnnotations", "translateShapes") ? "move" : "";
            if (selection.borderLocal(x, y)) return move;
            const fill = fillCursor(x, y) || linkCursor(x, y);
            if (fill) return fill;
            // A text markup over the open text: a click picks it.
            if (inObjectText && hitTextMarkup(hitAt(x, y))) return "";
            if (inObjectText || hitText(hitAt(x, y), pressGlobal())) return "text";
            return store?.getState()?.docType === "wordprocessing" ? "" : move;
        }
        return fillCursor(x, y) || linkCursor(x, y) || (hitText(hitAt(x, y), pressGlobal()) ? "text" : "");
    }

    /** The flavor of text gesture a select-pointer press starts in the current
     *  mode — flowing across objects and pages in view mode, confined to the
     *  one object in edit mode (`TextSelectOptions.global`) — and so which level
     *  of a PDF hit's path reads as text ({@link hitText}). */
    function pressGlobal(): boolean {
        return store?.getState()?.mode === VIEW_MODE;
    }

    /**
     * Whether a press at canvas-local `(x, y)` routes to a **text** selection
     * rather than an object gesture — the text-vs-object arbiter shared by every
     * press branch. Text when:
     *
     * - the doc type is a word document, whose one verb is `selectText`: a
     *   press is a caret / range and Shift extends it, the word-processor norm,
     *   and a press on a picture in the flow picks it through the same verb —
     *   the text hit descends into the drawing — so nothing routes to the
     *   object path; or
     * - text is already active *under this press* (`inObjectText` and the point
     *   is over the selected box) — a Shift press extends the live range, and the
     *   whole box reads as text even where the async hit cache hasn't caught up;
     *   or
     * - it's a plain pick over a text object (single-click text selection).
     *
     * A **Shift / Alt** pick (an object set-operation — toggle / subtract) over a
     * doc type that has objects is deliberately *not* text: it falls through to
     * the object gesture so Shift-click keeps building a multi-object selection
     * instead of hijacking the shape's text. Modifiers are read via
     * {@link selectModeFor}, so this stays in lock-step with the object mode. The
     * `inObjectText` short-circuit is gated on {@link SelectionLayer.hitLocal} so
     * a press *off* the edited box (bare canvas) still clears / re-picks — only a
     * press within it extends the live edit.
     */
    function textIntent(x: number, y: number, ev: PointerEvent): boolean {
        if (store?.getState()?.docType === "wordprocessing") return true;
        if (inObjectText && selection.hitLocal(x, y)) return true;
        return hitText(hitAt(x, y), pressGlobal()) && selectModeFor(ev) === "replace";
    }

    /** Whether the session may annotate. Without it a press on an annotation
     *  takes no edit path and drops no caret in a free text's text; a click
     *  still picks one, to read it, its edits gone from its capabilities. */
    function annotating(): boolean {
        return store?.getState().features.includes("annotation") === true;
    }

    /**
     * Whether a press at canvas-local `(x, y)` edits an annotation as an edit-mode
     * press does, in view mode too: inside the annotation selection's box, or in
     * a free text's text under the point, where it drops a caret. A press on any
     * other annotation in view mode picks it with a click (see
     * {@link annotationPick}).
     */
    function annotationPress(x: number, y: number): boolean {
        if (!annotating()) return false;
        if (annotationSelected && selection.hitLocal(x, y)) return true;
        const hit = hitAt(x, y);
        return (
            hit !== "none" && "portable" in hit && "annotation" in hit.portable && hit.portable.annotation.text != null
        );
    }

    /**
     * Whether a view-mode click on `hit` picks it — an annotation, to edit it —
     * where a drag from it still selects the text under it. A form field's
     * widget is no pick: view mode fills it in and never moves it.
     */
    function annotationPick(hit: UDocHit): boolean {
        return (
            hit !== "none" &&
            "portable" in hit &&
            "annotation" in hit.portable &&
            hooks.isFormWidget?.(hit.portable.annotation.annotation) !== true
        );
    }

    /**
     * Resolve a single press-and-release (no drag) as an **object** pick: a
     * collapsed gesture (anchor == focus) at the point, combined per `mode`
     * (replace / toggle / subtract), which picks the topmost object or clears over
     * bare page. Only object / bare-page presses reach here — a text or cell press
     * routed into its own gesture (text-select / cell-select) at pointerdown, from
     * the cached hover hit — so this never needs to re-decide the domain.
     */
    function resolveObjectClick(x: number, y: number, mode: SelectMode): void {
        client.selectObjects({ x, y }, { x, y }, mode);
    }

    /**
     * Resolve a single press-and-release (no drag) that would pick per `mode`:
     * follow the link under it where the click follows one — an annotation's
     * ({@link followedLink}), else a text run's or a shape's
     * ({@link followedTextLink}), the link key held or not by `linkKey`, Shift
     * by `shift` — else pick ({@link resolveObjectClick}).
     */
    function resolveClick(
        x: number,
        y: number,
        mode: SelectMode,
        linkKey: boolean,
        shift: boolean = mode === "toggle",
    ): void {
        const link = followedLink(x, y, shift, linkKey);
        const textLink = link ? null : followedTextLink(x, y, shift, linkKey);
        if (link) hooks.followLink?.(link);
        else if (textLink) followTextLinkAt(textLink, x, y);
        else resolveObjectClick(x, y, mode);
    }

    /**
     * The gesture a **text-ish** press starts at `(x, y)` — a `textSelect`,
     * wherever it lands. One builder, because both press branches (inside the
     * current selection's box, and on bare canvas) start the same gesture.
     *
     * A press in a table cell is one too: `selectText` reads the two ends and
     * decides what the drag means — a range in one cell, the block of cells
     * between two, the block it swept held while the pointer is out of the
     * table — and a Shift press extends the live caret or block the same way.
     * The press only notes the table it landed in, for a right-click there.
     * `clicks` is the press's place in the click chain, counted here unless the
     * caller already counted it.
     */
    function textGesture(
        x: number,
        y: number,
        ev: PointerEvent,
        global: boolean,
        clicks: number = chainClick(x, y),
    ): Extract<NonNullable<typeof gesture>, { kind: "textSelect" }> {
        tableAnchor = tableOf(hitAt(x, y));
        return {
            kind: "textSelect",
            startX: x,
            startY: y,
            pointerId: ev.pointerId,
            global,
            granularity: granularityFor(clicks),
            extend: ev.shiftKey,
            linkKey: linkKeyDown(ev),
            moved: false,
            markup: null,
            clickPicks: false,
        };
    }

    /**
     * The gesture a **double press** on a slide object that shows no text
     * opens: a text gesture there anyway, where a single press over a blank box
     * stays an object pick. The engine lands the caret in a shape — at its sole
     * boundary, or naming no story for a shape with no text body, which the
     * first keystroke then gives one — and leaves a picture or a connector as
     * it was. `null` for any other press.
     *
     * It counts the press in the click chain either way: the press that picked
     * the object is the double's first click, and nothing else on the object
     * path counts presses.
     */
    function doublePressTextGesture(
        x: number,
        y: number,
        ev: PointerEvent,
    ): Extract<NonNullable<typeof gesture>, { kind: "textSelect" }> | null {
        const clicks = chainClick(x, y);
        const hit = hitAt(x, y);
        if (clicks !== 2 || hit === "none" || !("presentation" in hit) || selectModeFor(ev) !== "replace") {
            return null;
        }
        return textGesture(x, y, ev, false, clicks);
    }

    /**
     * The gesture a plain press on a text markup starts: a click picks the
     * markup, a drag selects the text under it — the text selection resolves
     * through the annotation to the object beneath.
     */
    function markupGesture(
        x: number,
        y: number,
        ev: PointerEvent,
    ): Extract<NonNullable<typeof gesture>, { kind: "textSelect" }> {
        return { ...textGesture(x, y, ev, false), clickPicks: true };
    }

    /** Build a {@link touchScroll} gesture starting at `(x, y)`, carrying the
     *  `tap` pick to run if the finger never travels past the drag threshold. */
    function touchScrollGesture(ev: PointerEvent, x: number, y: number, tap: TapAction) {
        return {
            kind: "touchScroll" as const,
            startX: x,
            startY: y,
            lastX: x,
            lastY: y,
            pointerId: ev.pointerId,
            moved: false,
            tap,
        };
    }

    /**
     * Run a touch tap's captured {@link TapAction} at `(x, y)` — the pick a press
     * makes when it never became a scroll drag. Mirrors the mouse gesture paths:
     * a text caret / word / paragraph, a grid cell, or an object pick (touch has
     * no modifiers, so text / cell never extend and an object pick replaces).
     */
    function runTap(tap: TapAction, x: number, y: number): void {
        if (tap.kind === "text") {
            // A tap on a linked run follows its link, as a click does.
            const textLink = tap.granularity === "character" ? followedTextLink(x, y, false, false) : null;
            if (textLink) followTextLinkAt(textLink, x, y);
            else client.selectText({ x, y }, { x, y }, { granularity: tap.granularity, global: tap.global });
        } else if (tap.kind === "cell") {
            client.selectSheetCells({ x, y }, { x, y }, {});
        } else {
            resolveClick(x, y, tap.mode, false);
        }
    }

    /**
     * Set the canvas's resting cursor for the current pointer mode. The select
     * pointer clears it to the default arrow in every mode (view included) and
     * lets the hover pass raise the I-beam over text / a move grab over a
     * selection; pan, marquee-zoom and place carry their own fixed cursor — a
     * markup tool the I-beam it selects text with, the other place tools a
     * crosshair.
     */
    function applyModeCursor(): void {
        const pointer = store?.getState().pointerMode ?? { kind: "select" };
        const kind = pointer.kind;
        const marking = pointer.kind === "place" && pointer.tool.kind === "annotation" && isMarkup(pointer.tool.tool);
        canvas.style.cursor =
            kind === "pan"
                ? "grab"
                : kind === "marqueeZoom"
                  ? "zoom-in"
                  : marking
                    ? "text"
                    : kind === "place"
                      ? "crosshair"
                      : "";
    }

    /**
     * Show/resize the marquee between two canvas-local points (CSS px).
     * `enclose` colours a select sweep by its rule — `false` crossing (blue),
     * `true` window (green); omit it for the neutral zoom band.
     */
    function updateMarquee(x0: number, y0: number, x1: number, y1: number, enclose?: boolean): void {
        // The band positions in raw canvas px; its clip layer bounds it to the
        // content area (the shared overlay clip), so a sweep dragged over the
        // ruler / frozen header or the branding decal is cut at that chrome's edge.
        marqueeClipKey = applyContentClip(marqueeClip, { branding: lastBrandingRect }, marqueeClipKey);
        marquee.style.left = `${Math.min(x0, x1)}px`;
        marquee.style.top = `${Math.min(y0, y1)}px`;
        marquee.style.width = `${Math.abs(x1 - x0)}px`;
        marquee.style.height = `${Math.abs(y1 - y0)}px`;
        marquee.classList.toggle("udoc-ui__marquee--crossing", enclose === false);
        marquee.classList.toggle("udoc-ui__marquee--enclose", enclose === true);
        marquee.style.display = "block";
    }

    /**
     * Finish a marquee-zoom gesture. A real sweep hands the swept rectangle to
     * the engine, which fits and centres it authoritatively — correct across the
     * screen-fixed page spacing a host computing scroll can't account for. A bare
     * click step-zooms about the point (Alt to zoom out) via the same `zoomAtPoint`
     * path as the wheel.
     */
    function commitMarquee(
        g: { startX: number; startY: number; alt: boolean; moved: boolean },
        endX: number,
        endY: number,
    ): void {
        const st = store?.getState();
        if (!st) return;
        if (!g.moved) {
            const z = renderZoom(st);
            store?.dispatch({
                type: "SET_ZOOM",
                zoom: z * (g.alt ? 1 / ZOOM_CLICK_STEP : ZOOM_CLICK_STEP),
                anchorX: endX,
                anchorY: endY,
            });
            return;
        }
        const left = Math.min(g.startX, endX);
        const top = Math.min(g.startY, endY);
        const wCss = Math.abs(endX - g.startX);
        const hCss = Math.abs(endY - g.startY);
        if (wCss < 1 || hCss < 1) return;
        // The engine fits the rect to the viewport, capped only at its own
        // ceiling; a rect that would pass the host's `maxZoom` zooms to it on
        // the rect's centre instead.
        const rectZoom = renderZoom(st) * Math.min(st.viewportWidth / wCss, st.viewportHeight / hCss);
        if (rectZoom > st.maxZoom) {
            store?.dispatch({ type: "SET_ZOOM", zoom: st.maxZoom, anchorX: left + wCss / 2, anchorY: top + hCss / 2 });
            return;
        }
        // Drop any fit so the zoom % follows the engine's result, then hand it the
        // rect in CSS px (the wasm boundary applies the dpr). `zoomToRect` clears
        // the fit itself and resolves the zoom + scroll after re-arranging,
        // streaming both back via SYNC_VIEW.
        if (st.fit.mode !== "none") store?.dispatch({ type: "SET_FIT", fit: NO_FIT });
        client.zoomToRect(left, top, wCss, hCss);
    }

    /**
     * Finish a shape-placement gesture: map the press/release (canvas CSS px)
     * into page-local document points and hand the shape — an Insert-tab shape,
     * or an Annotate-tab one — to the shell, keeping its sketch drawn until the
     * engine paints it. A real drag uses the two endpoints; a bare click (no
     * drag) drops a default-sized shape centred on the click — for a box shape
     * — or a default-length one from it, for a line/arrow. A no-op if the page
     * scrolled off mid-gesture.
     */
    function commitPlace(
        g: { tool: PlaceTool; page: number; startX: number; startY: number; moved: boolean },
        endX: number,
        endY: number,
    ): void {
        const start = pagePoint(g.page, g.startX, g.startY);
        if (!start) return;
        const shape = placedShape(g.tool);
        let p0 = start;
        let p1: ShapePoint;
        if (g.moved) {
            const end = pagePoint(g.page, endX, endY);
            if (!end) return;
            p1 = end;
        } else if (shape === "line" || shape === "arrow") {
            // A click: a default-length horizontal line from the point.
            p1 = { x: start.x + DEFAULT_SHAPE_WIDTH, y: start.y };
        } else {
            // A click: a default-sized box centred on the point.
            p0 = { x: start.x - DEFAULT_SHAPE_WIDTH / 2, y: start.y - DEFAULT_SHAPE_HEIGHT / 2 };
            p1 = { x: start.x + DEFAULT_SHAPE_WIDTH / 2, y: start.y + DEFAULT_SHAPE_HEIGHT / 2 };
        }
        const placed =
            g.tool.kind === "annotation"
                ? hooks.placeAnnotation?.(g.tool.tool, g.page, [p0, p1])
                : hooks.place?.(g.tool.tool, g.page, p0, p1);
        const sketched = placeSketch(g.tool, g.page, p0, p1);
        if (sketched) holdSketch(sketched, placed);
    }

    /**
     * The sketch of placing `tool` across `p0` → `p1` on `page`: the outline
     * {@link segmentsFor} gives the shape it drops, or null for a tool that
     * places none. An annotation square, circle or text box is drawn inside its
     * box, so its outline is inset by half the line — the stroke's outer edge
     * is the box, as the engine paints it. A box narrower than its line keeps
     * its centre.
     */
    function placeSketch(tool: PlaceTool, page: number, p0: ShapePoint, p1: ShapePoint): Sketch | null {
        const shape = placedShape(tool);
        if (!shape) return null;
        if (tool.kind !== "annotation" || shape === "line" || shape === "arrow") {
            return { tool, page, segments: segmentsFor(shape, p0, p1) };
        }
        const half = annotationStyle(tool.tool, store?.getState().annotationStyles ?? {}).borderStyle.width / 2;
        const inset = (a: number, b: number): [number, number] => {
            const lo = Math.min(a, b);
            const hi = Math.max(a, b);
            const d = Math.min(half, (hi - lo) / 2);
            return [lo + d, hi - d];
        };
        const [x0, x1] = inset(p0.x, p1.x);
        const [y0, y1] = inset(p0.y, p1.y);
        return { tool, page, segments: segmentsFor(shape, { x: x0, y: y0 }, { x: x1, y: y1 }) };
    }

    /**
     * A press with a polygon, polyline or cloud armed: place a corner where it
     * lands, starting the drawing on the page under it — or, on the second press
     * of a double-click, finish the drawing (its first press placed the last
     * corner). Later corners are placed on the drawing's page wherever they
     * land, so an edge may run off it.
     */
    function clickCorner(tool: AnnotationTool, x: number, y: number, double: boolean): void {
        if (polygonDraft && double) {
            finishPolygon();
            return;
        }
        if (!polygonDraft || polygonDraft.tool !== tool) {
            const page = pageAtPoint(x, y);
            if (page === null) return;
            polygonDraft = { tool, page, corners: [], pointer: null };
        }
        const corner = pagePoint(polygonDraft.page, x, y);
        if (!corner) return;
        polygonDraft.corners.push(corner);
        polygonDraft.pointer = corner;
        renderSketch();
    }

    /**
     * Finish the polygon being clicked out: hand its corners to the shell and
     * keep it drawn until the engine paints it. One with too few corners to draw
     * anything is dropped, and the tool stays armed to start again.
     */
    function finishPolygon(): void {
        const draft = polygonDraft;
        polygonDraft = null;
        if (!draft || draft.corners.length < minCorners(draft.tool)) {
            renderSketch();
            return;
        }
        const placed = hooks.placeAnnotation?.(draft.tool, draft.page, draft.corners);
        holdSketch(lineSketch(draft.tool, draft.page, draft.corners, draft.tool !== "polyline"), placed);
        store?.dispatch({ type: "PLACEMENT_COMMITTED" });
    }

    /** Keep `drawing` shown until the first frame after `placed` settles — the
     *  engine then has what it draws, and paints it. */
    function holdSketch(drawing: Sketch, placed: Promise<void> | void): void {
        const held = { ...drawing, landed: false };
        heldSketches.push(held);
        renderSketch();
        void Promise.resolve(placed).finally(() => {
            held.landed = true;
        });
    }

    /** What the sketch layer shows now: the finished drawings the engine
     *  hasn't painted yet, then the stroke being drawn, the shape being placed
     *  (press to pointer), or the polygon being clicked out (with the edge to
     *  the pointer). */
    function currentSketches(): Sketch[] {
        const drawings: Sketch[] = [...heldSketches];
        if (gesture?.kind === "ink") {
            drawings.push(lineSketch(gesture.tool, gesture.page, gesture.points, false));
        } else if (gesture?.kind === "place") {
            const p0 = pagePoint(gesture.page, gesture.startX, gesture.startY);
            const p1 = pagePoint(gesture.page, gesture.lastX, gesture.lastY);
            const sketched = p0 && p1 ? placeSketch(gesture.tool, gesture.page, p0, p1) : null;
            if (sketched) drawings.push(sketched);
        } else if (polygonDraft) {
            const { tool, page, corners, pointer } = polygonDraft;
            drawings.push(lineSketch(tool, page, pointer ? [...corners, pointer] : corners, false));
        }
        return drawings;
    }

    /**
     * Draw {@link currentSketches} in their tools' style, each projected through
     * its page's current view, so it holds its place on the page through a
     * scroll or a zoom — a drawing on a page off-screen is left out. An
     * annotation draws in its tool's style, an Insert-tab shape in the stroke it
     * lands with. The ink is an approximation until the engine paints the
     * result: the line in its colour, width, dash and opacity, without a fill,
     * a cloud's scallops or a line ending — an arrow's head is its two barbs. A
     * line with no colour draws as a guide, so the drawing still shows where it
     * goes.
     */
    function renderSketch(): void {
        const styles = store?.getState().annotationStyles ?? {};
        let shown = 0;
        for (const drawing of currentSketches()) {
            const view = selection.pageToViewport(drawing.page);
            if (!view || drawing.segments.length === 0) continue;
            let path = sketchPaths[shown];
            if (!path) {
                path = document.createElementNS(SVG_NS, "path");
                sketch.appendChild(path);
                sketchPaths.push(path);
            }
            shown++;
            const tool = drawing.tool.kind === "annotation" ? drawing.tool.tool : null;
            const style = tool ? annotationStyle(tool, styles) : null;
            const color = style ? style.color : SHAPE_STROKE;
            const width = style ? style.borderStyle.width : SHAPE_STROKE_WIDTH;
            const dash = style?.borderStyle.style === "dashed" ? (style.borderStyle.dash ?? [3]) : null;
            const pen = tool === "pen";
            const at = (p: ShapePoint): string => {
                const v = applyPoint(view, p.x, p.y);
                return `${v.x.toFixed(1)} ${v.y.toFixed(1)}`;
            };
            const d = drawing.segments
                .map((s) => {
                    if (s === "close") return "Z";
                    if ("moveTo" in s) return `M${at(s.moveTo)}`;
                    if ("lineTo" in s) return `L${at(s.lineTo)}`;
                    return `C${at(s.cubicTo.control1)} ${at(s.cubicTo.control2)} ${at(s.cubicTo.end)}`;
                })
                .join(" ");
            path.setAttribute("d", d);
            path.setAttribute("stroke", color ? colorHex(color) : "none");
            path.setAttribute("stroke-width", String(width * lastScale));
            path.setAttribute("stroke-dasharray", dash ? dash.map((d) => d * lastScale).join(" ") : "none");
            path.setAttribute("stroke-opacity", String(style ? style.opacity : 1));
            path.setAttribute("stroke-linecap", pen ? "round" : "butt");
            path.setAttribute("stroke-linejoin", pen ? "round" : "miter");
            path.classList.toggle("udoc-ui__sketch-guide", !color);
            path.style.display = "";
        }
        for (const path of sketchPaths.slice(shown)) path.style.display = "none";
        if (shown > 0) marqueeClipKey = applyContentClip(marqueeClip, { branding: lastBrandingRect }, marqueeClipKey);
        sketch.style.display = shown > 0 ? "block" : "none";
    }

    /**
     * Begin a pointer gesture. Only the primary button on the bare canvas counts
     * (overlay chrome and scrollbars sit above it and target themselves) — with
     * one exception: an edit-mode resize/rotate handle. Those float just outside
     * the selection box, so a selection near a page edge pushes them into the
     * inter-page gap, where they overlap the insert strip (an overlay element
     * with its own pointer events). The selection layer stacks above that chrome,
     * so the handle wins the press even though the event lands on the overlay,
     * not the bare canvas — but not over chrome stacked above the selection
     * (`aboveSelection` overlays), which wins it back. The pointer mode picks
     * the gesture: `pan` and `marqueeZoom` are live in any mode that's ready
     * (navigation), while object select/move is edit-only.
     */
    /**
     * A right-click over the canvas: settle the selection the menu will act on,
     * then hand the point to the shell (which owns the menu).
     *
     * View mode's menu acts on the selection as it stands — the text a drag
     * selected — so a right-click there picks nothing. A pointer tool that isn't
     * select leaves the browser's own menu alone.
     *
     * In edit mode the pick mirrors what a left click would do, minus the
     * gesture: a press
     * **inside the current selection** keeps it (the menu acts on the whole
     * selection — right-clicking one of three selected shapes must not collapse
     * the pick to that one), and a press **over text** keeps it too (the caret /
     * range is the selection there, and an object pick would clear it). Anything
     * else picks the topmost object at the point, or clears over bare page. The
     * pick is a worker round-trip, so the menu opens on the old capabilities and
     * the report settles its rows a frame later — see `createContextMenu`.
     */
    function onContextMenu(ev: MouseEvent): void {
        const st = store?.getState();
        if (!st || st.status !== "ready" || st.pointerMode.kind !== "select") return;
        if (ev.target !== canvas) return;
        ev.preventDefault();
        if (st.mode === VIEW_MODE) {
            hooks.onContextMenu?.(ev.clientX, ev.clientY, false);
            return;
        }
        const { x, y } = localPoint(ev);
        const hit = hitAt(x, y);
        const table = tableOf(hit);
        if (table) {
            // A right-click in a table the pointer is not already working in
            // places a caret in the cell it landed on, so the Select rows have
            // something to widen. A right-click inside the table the last press
            // was in keeps what is picked — that is how a right-click on a swept
            // block reaches Copy without collapsing the block first. The live
            // selection has to still be *under the pointer* for `tableAnchor`
            // to mean anything — the anchor outlives a selection cleared by
            // something other than a press. Under it is the frame's own box on a
            // slide, or the tinted cells a block draws: a word document's table
            // has no frame, so a block of its cells is all there is to be on.
            const onSelection = selection.hitLocal(x, y) || selection.hitCells(x, y);
            if (tableAnchor !== table || !onSelection) {
                client.selectText({ x, y }, { x, y });
                tableAnchor = table;
            }
        } else if (!selection.hitLocal(x, y) && !hitText(hit, pressGlobal())) {
            resolveObjectClick(x, y, "replace");
        }
        hooks.onContextMenu?.(ev.clientX, ev.clientY, table != null);
    }

    function onPointerDown(ev: PointerEvent): void {
        if (ev.button !== 0) return;
        const st = store?.getState();
        if (!st || st.status !== "ready") return;
        const { x, y } = localPoint(ev);
        // A press ends the hover; the outline returns with the next one.
        annotationHover.set(null);
        // A finger scrolls the document (there is no wheel on touch): a one-finger
        // drag pans the viewport, a tap picks. Only the ambient select/text/cell
        // gestures defer to it — object move, the resize/rotate handles, and the
        // explicit pan/place/zoom tools keep their own touch gestures below.
        const touch = ev.pointerType === "touch";
        // Whatever this press turns out to be, it ends the last table press's
        // claim; a press that lands in a table takes it back below (see
        // `textGesture`).
        tableAnchor = null;

        // Chrome stacked over the selection — the annotation bar, its colour
        // menu, the comment popup — keeps its own presses, over a handle or not.
        if (ev.target instanceof Node && overlayAboveHost.contains(ev.target)) return;
        const onSelect = st.pointerMode.kind === "select";
        // The extension's chrome on the selection (edit mode's rotation and
        // geometry grips) is asked **first**, ahead of the resize handles it can
        // land on top of — and, like them, over overlay chrome as well as the
        // canvas.
        const extension = onSelect ? hooks.pressCanvas?.(x, y, ev, gestureHost) : null;
        if (extension) {
            gesture = { kind: "extension", pointerId: ev.pointerId, gesture: extension };
            el.setPointerCapture(ev.pointerId);
            return;
        }
        // Resolve the resize handles up front so they can pass the
        // canvas-target gate below even when they sit over overlay chrome (the
        // hit test returns null off the select pointer, a selection, or one that
        // shows no chrome — view mode's, bar an annotation selection's — so it's
        // free to compute here). Reused by the select branch below.
        const handle = onSelect ? selection.handleAt(x, y) : null;
        if (ev.target !== canvas && !handle) return;

        if (st.pointerMode.kind === "pan") {
            gesture = { kind: "pan", lastX: x, lastY: y, pointerId: ev.pointerId };
            canvas.style.cursor = "grabbing";
            el.setPointerCapture(ev.pointerId);
            return;
        }
        if (st.pointerMode.kind === "marqueeZoom") {
            gesture = { kind: "marquee", startX: x, startY: y, pointerId: ev.pointerId, alt: ev.altKey, moved: false };
            updateMarquee(x, y, x, y);
            el.setPointerCapture(ev.pointerId);
            return;
        }
        // Placement. A markup tool drags a text selection; a polygon, polyline or
        // cloud is clicked out a corner per press (see `clickCorner`); a note or
        // a stamp is dropped where the press lands; a pen press starts a stroke;
        // an Annotate-tab text box / rectangle / ellipse / line / arrow, and an
        // extension's tool that drags out a shape, are a press-drag-release. An
        // extension's tool that drags out none places nothing here. A drawing
        // starts on a page.
        if (st.pointerMode.kind === "place") {
            const tool = st.pointerMode.tool;
            const annotation = tool.kind === "annotation" ? tool.tool : null;
            // A markup tool selects text as view mode does — across the page's
            // objects — and marks it on release.
            if (isMarkup(annotation)) {
                gesture = {
                    kind: "textSelect",
                    startX: x,
                    startY: y,
                    pointerId: ev.pointerId,
                    global: true,
                    granularity: granularityFor(chainClick(x, y)),
                    extend: false,
                    linkKey: false,
                    moved: false,
                    markup: annotation,
                    clickPicks: false,
                };
                el.setPointerCapture(ev.pointerId);
                return;
            }
            if (annotation === "polygon" || annotation === "polyline" || annotation === "cloud") {
                clickCorner(annotation, x, y, chainClick(x, y) >= 2);
                return;
            }
            if (annotation === null && placedShape(tool) === null) return;
            const page = pageAtPoint(x, y);
            if (page === null) return;
            if (annotation === "note" || annotation === "stamp") {
                const at = pagePoint(page, x, y);
                if (!at) return;
                void hooks.placeAnnotation?.(annotation, page, [at]);
                store?.dispatch({ type: "PLACEMENT_COMMITTED" });
                return;
            }
            if (annotation === "pen") {
                const start = pagePoint(page, x, y);
                if (!start) return;
                gesture = {
                    kind: "ink",
                    tool: annotation,
                    page,
                    points: [start],
                    lastX: x,
                    lastY: y,
                    pointerId: ev.pointerId,
                };
                renderSketch();
            } else {
                gesture = {
                    kind: "place",
                    tool,
                    page,
                    startX: x,
                    startY: y,
                    lastX: x,
                    lastY: y,
                    pointerId: ev.pointerId,
                    moved: false,
                };
            }
            el.setPointerCapture(ev.pointerId);
            return;
        }
        // Object selection runs in view and edit; only edit offers
        // move/resize/rotate — but annotations edit in view mode as in edit, so
        // a press on one, or on an annotation selection's handles, takes edit
        // mode's path there too.
        if (st.pointerMode.kind !== "select") return;
        const editable = st.mode !== VIEW_MODE || handle !== null || annotationPress(x, y);
        // A press on a form field's widget fills the field in — in view mode as
        // in edit, as a viewer fills one in on a plain click. Edit mode's
        // handles and a selected box's border still move and resize it, and a
        // Shift press still builds a selection.
        const widget = fillableWidget(hitAt(x, y));
        if (widget && !handle && !ev.shiftKey && !(editable && selection.borderLocal(x, y))) {
            hooks.fillFormField?.(widget.page, widget.annotation);
            return;
        }
        // View mode's select tool IS the text tool: a click drops a caret, a
        // drag selects a flowing range across objects and pages (no object
        // chrome). A double / triple press selects (and drags) by words /
        // paragraphs; Shift extends the current selection instead of
        // re-anchoring. Object move/resize is edit-only — an annotation press
        // took edit mode's path above — so view never reaches those. A
        // spreadsheet has no flow text (and its domain is
        // fixed — no floating objects yet), so a grid press selects a cell
        // block instead; the hover probe that classifies the other doc types is
        // edit-only, so this reads the doc type directly. A click on a link
        // follows it and a link-key click picks it (see `resolveClick`).
        if (!editable) {
            const hit = hitAt(x, y);
            // A click on a widget with an action runs it, as a link's follows;
            // a link-key or a Shift press selects the text under it.
            const picks =
                (annotationPick(hit) && selectModeFor(ev) === "replace") ||
                (!ev.shiftKey && !linkKeyDown(ev) && hitWidget(hit) !== null && hitTarget(hit) !== null);
            if (touch) {
                gesture = touchScrollGesture(
                    ev,
                    x,
                    y,
                    st.docType === "spreadsheet"
                        ? { kind: "cell" }
                        : picks
                          ? { kind: "object", mode: "replace" }
                          : { kind: "text", granularity: granularityFor(chainClick(x, y)), global: true },
                );
                el.setPointerCapture(ev.pointerId);
                return;
            }
            gesture =
                st.docType === "spreadsheet"
                    ? {
                          kind: "cellSelect",
                          startX: x,
                          startY: y,
                          pointerId: ev.pointerId,
                          extend: ev.shiftKey,
                          moved: false,
                      }
                    : {
                          kind: "textSelect",
                          startX: x,
                          startY: y,
                          pointerId: ev.pointerId,
                          global: true,
                          granularity: granularityFor(chainClick(x, y)),
                          extend: ev.shiftKey,
                          linkKey: linkKeyDown(ev),
                          moved: false,
                          markup: null,
                          // A click on an annotation picks it, so it can be
                          // edited — a link's follows it, and a widget's runs
                          // its action; a drag still selects the text under it.
                          clickPicks: picks,
                      };
            el.setPointerCapture(ev.pointerId);
            return;
        }
        if (editable) {
            // A press on a resize handle starts a resize; checked before the
            // move/select test since handles sit on (and just outside) the edge.
            // The grabbed object's placement is the resize frame, so the group
            // scales about that object's anchor.
            if (handle) {
                gesture = {
                    kind: "resize",
                    handle: handle.handle,
                    place: handle.place,
                    startX: x,
                    startY: y,
                    pointerId: ev.pointerId,
                    moved: false,
                };
                el.setPointerCapture(ev.pointerId);
                return;
            }
        }
        // A press inside the current selection's object box, off the resize /
        // rotate handles: text-first. The border band is the move grab — a drag
        // there moves the object, an unmoved press re-selects the frame (exiting
        // text editing) — while anywhere else `textIntent` decides: a plain pick
        // over a text object drops a caret or drags a range confined to it (double
        // / triple press by words / paragraphs; Shift, while editing, extends the
        // range), and a non-text object — or a Shift / Alt object-set pick — keeps
        // the whole body as the move-or-toggle grab, so Shift-click still toggles
        // the object rather than hijacking its text. A press outside every box
        // falls through to the bare-canvas routing below. A plain press on a text
        // markup over the open text is the markup's: a click picks it, a drag
        // selects the text under it. This is the press twin of
        // {@link selectHoverCursor} — they must agree.
        if (!handle && selection.hitLocal(x, y)) {
            const border = selection.borderLocal(x, y);
            if (textIntent(x, y, ev) && !border) {
                gesture =
                    hitTextMarkup(hitAt(x, y)) && selectModeFor(ev) === "replace"
                        ? markupGesture(x, y, ev)
                        : textGesture(x, y, ev, false);
            } else {
                // A double press off the border opens the blank shape's text.
                const entry = doublePressTextGesture(x, y, ev);
                gesture =
                    entry && !border
                        ? entry
                        : {
                              kind: "select",
                              startX: x,
                              startY: y,
                              pointerId: ev.pointerId,
                              overSelection: true,
                              mode: selectModeFor(ev),
                              linkKey: linkKeyDown(ev),
                              moving: false,
                              // The selection's page un-rotates the move delta.
                              page: selection.selectionPage(),
                          };
            }
            el.setPointerCapture(ev.pointerId);
            return;
        }
        // A press on bare canvas (not over the current selection) is routed to a
        // domain — the decision the old unified `select` made in Rust now lives
        // here, so the *rendering* follows it too. Single-domain doc types route
        // by type (they have nothing else under the point): a spreadsheet press is
        // always a cell block, a word-processor press always a text caret / range —
        // so a press on a blank docx page never rubber-bands an (object) marquee it
        // has no objects for. Multi-domain doc types (PDF, slides) route on the
        // cached hover hit — cell / text / object:
        //
        //   - a grid cell → a cell-select drag (the range fill is the feedback,
        //     no marquee band);
        //   - text (a docx body caret, a PDF / slide text object, or a PDF free
        //     text's text) → a text selection (a live caret / highlight, no
        //     band) — this is what makes a docx drag select text instead of
        //     rubber-banding a marquee. A Shift /
        //     Alt pick over PDF / slides is an object set-operation instead, so it
        //     falls through to the marquee (multi-select) — see `textIntent`;
        //   - a PDF text markup → a click picks it, a drag selects the text under
        //     it (a Shift / Alt pick is an object set-operation, the marquee);
        //   - an object or bare page → a marquee select (a drag sweeps a
        //     rectangle, a bare click picks / clears the point).
        const hit = hitAt(x, y);
        // A finger on bare canvas scrolls (drag) or picks (tap); the pick it
        // captures is the very gesture the mouse would have taken here.
        if (touch) {
            const tap: TapAction =
                st.docType === "spreadsheet" || hitCell(hit)
                    ? { kind: "cell" }
                    : textIntent(x, y, ev)
                      ? { kind: "text", granularity: granularityFor(chainClick(x, y)), global: false }
                      : { kind: "object", mode: selectModeFor(ev) };
            gesture = touchScrollGesture(ev, x, y, tap);
            el.setPointerCapture(ev.pointerId);
            return;
        }
        if (st.docType === "spreadsheet" || hitCell(hit)) {
            gesture = {
                kind: "cellSelect",
                startX: x,
                startY: y,
                pointerId: ev.pointerId,
                extend: ev.shiftKey,
                moved: false,
            };
            el.setPointerCapture(ev.pointerId);
            return;
        }
        if (textIntent(x, y, ev)) {
            // Edit-mode text is confined to the object under the anchor (a docx
            // caret, or an ObjectText that carries the object's box) — the
            // flowing cross-object flavor is the view-mode tool above. A press
            // inside a table cell is the same gesture (see `textGesture`).
            gesture = textGesture(x, y, ev, false);
            el.setPointerCapture(ev.pointerId);
            return;
        }
        if (hitTextMarkup(hit) && selectModeFor(ev) === "replace") {
            gesture = markupGesture(x, y, ev);
            el.setPointerCapture(ev.pointerId);
            return;
        }
        // A double press on a blank slide shape whose pick hasn't drawn its box
        // yet opens its text all the same.
        const entry = doublePressTextGesture(x, y, ev);
        if (entry) {
            gesture = entry;
            el.setPointerCapture(ev.pointerId);
            return;
        }
        gesture = {
            kind: "marqueeSelect",
            startX: x,
            startY: y,
            pointerId: ev.pointerId,
            mode: selectModeFor(ev),
            linkKey: linkKeyDown(ev),
            moved: false,
        };
        updateMarquee(x, y, x, y);
        // Capture so move/up keep arriving if the pointer leaves the canvas.
        el.setPointerCapture(ev.pointerId);
    }

    /**
     * Re-project the live resize preview from the last pointer position and the
     * given lock (Shift) state. Shared by the pointer drag and the Shift key
     * handlers so toggling the aspect lock updates the box even when the pointer
     * is still. A no-op unless a resize gesture has passed its drag threshold.
     */
    function previewResize(lock: boolean): void {
        if (gesture?.kind !== "resize" || !gesture.moved) return;
        // Pointer travel → page-local delta (un-rotated for the page view) → a
        // transform delta in the object's own (possibly rotated/sheared) frame.
        const d = pageDelta(gesture.place.page, lastPointerX - gesture.startX, lastPointerY - gesture.startY);
        const { sx, sy } = resizeScale(gesture.handle, gesture.place, d.x, d.y, lock);
        const { ax, ay } = anchorFractions(gesture.handle);
        selection.setPreview({ kind: "scaleEach", sx, sy, axFrac: ax, ayFrac: ay });
    }

    /** Enter finishes the polygon being clicked out. */
    function onPolygonKey(ev: KeyboardEvent): void {
        if (ev.key !== "Enter" || !polygonDraft) return;
        ev.preventDefault();
        finishPolygon();
    }

    /**
     * While a resize or rotate drag is live, pressing or releasing Shift toggles
     * the aspect-ratio lock / angle snap — re-project the preview in place so it
     * tracks the modifier without a pointer move. Idle, Shift and the link key
     * ({@link linkKeyDown}) switch whether a click on a link follows it, so the
     * resting cursor is resolved again. Other keys are ignored. Bound on
     * `window` so it fires regardless of focus during the pointer capture.
     */
    function onEditModifier(ev: KeyboardEvent): void {
        if (gesture?.kind === "resize") {
            if (ev.key === "Shift") previewResize(ev.shiftKey);
        } else if (gesture?.kind === "extension") {
            gesture.gesture.modifier?.(ev);
        } else if (gesture === null && (shiftHeld !== ev.shiftKey || linkKeyHeld !== linkKeyDown(ev))) {
            shiftHeld = ev.shiftKey;
            linkKeyHeld = linkKeyDown(ev);
            if (restingPointer) hover(restingPointer.x, restingPointer.y);
        }
    }

    /**
     * Drive the active gesture: pan scrolls by the pointer delta, marquee resizes
     * the rubber-band, select nudges the selection boxes once past the threshold.
     * With no gesture, hover sets a "move" cursor over a selected object.
     */
    function onPointerMove(ev: PointerEvent): void {
        if (hooks.pointerMove) {
            const { x, y } = localPoint(ev);
            hooks.pointerMove(x, y);
        }
        if (gesture && ev.pointerId === gesture.pointerId) {
            const { x, y } = localPoint(ev);
            // Keep the latest pointer position so the Shift key handlers can
            // re-project a resize / re-snap a rotation with no pointer movement.
            lastPointerX = x;
            lastPointerY = y;
            if (gesture.kind === "extension") {
                gesture.gesture.move(x, y, ev);
                return;
            }
            if (gesture.kind === "pan") {
                const st = store?.getState();
                if (st) {
                    const perPt = renderZoom(st) * cssPxPerPt(viewDpi(st));
                    store?.dispatch({
                        type: "SCROLL_BY",
                        dx: (gesture.lastX - x) / perPt,
                        dy: (gesture.lastY - y) / perPt,
                    });
                }
                gesture.lastX = x;
                gesture.lastY = y;
                return;
            }
            if (gesture.kind === "touchScroll") {
                // Below the threshold it's still a tap; once it travels it becomes
                // a scroll drag — the finger drags the paper directly (the same
                // delta the pan tool applies), and never a tap on release.
                if (!gesture.moved) {
                    if (Math.hypot(x - gesture.startX, y - gesture.startY) < DRAG_THRESHOLD) return;
                    gesture.moved = true;
                }
                const st = store?.getState();
                if (st) {
                    const perPt = renderZoom(st) * cssPxPerPt(viewDpi(st));
                    store?.dispatch({
                        type: "SCROLL_BY",
                        dx: (gesture.lastX - x) / perPt,
                        dy: (gesture.lastY - y) / perPt,
                    });
                }
                gesture.lastX = x;
                gesture.lastY = y;
                return;
            }
            if (gesture.kind === "ink") {
                if (Math.hypot(x - gesture.lastX, y - gesture.lastY) < INK_STEP) return;
                const p = pagePoint(gesture.page, x, y);
                if (!p) return;
                gesture.points.push(p);
                gesture.lastX = x;
                gesture.lastY = y;
                renderSketch();
                return;
            }
            if (gesture.kind === "place") {
                if (Math.hypot(x - gesture.startX, y - gesture.startY) >= DRAG_THRESHOLD) gesture.moved = true;
                gesture.lastX = x;
                gesture.lastY = y;
                renderSketch();
                return;
            }
            if (gesture.kind === "marquee" || gesture.kind === "marqueeSelect") {
                if (Math.hypot(x - gesture.startX, y - gesture.startY) >= DRAG_THRESHOLD) gesture.moved = true;
                // A select sweep colours by direction (leftward = window/enclose);
                // the zoom band stays neutral.
                const enclose = gesture.kind === "marqueeSelect" ? x < gesture.startX : undefined;
                updateMarquee(gesture.startX, gesture.startY, x, y, enclose);
                return;
            }
            if (gesture.kind === "resize") {
                if (!gesture.moved) {
                    if (Math.hypot(x - gesture.startX, y - gesture.startY) < DRAG_THRESHOLD) return;
                    gesture.moved = true;
                }
                // Shift is read live (not captured at press) so toggling it
                // mid-drag flips the aspect-ratio lock; the Shift key handlers
                // re-run this same projection when the pointer is held still.
                previewResize(ev.shiftKey);
                return;
            }
            if (gesture.kind === "textSelect") {
                if (Math.hypot(x - gesture.startX, y - gesture.startY) >= DRAG_THRESHOLD) gesture.moved = true;
                // A press on a text markup is still a click until it drags.
                if (gesture.clickPicks && !gesture.moved) return;
                // Stream the drag: anchor fixed at the press, focus at the pointer
                // (an `extend` gesture keeps the live selection's anchor instead).
                // The worker re-picks the ends and returns the caret / range
                // geometry (arriving via onSelection), so the highlight tracks the
                // pointer with no marquee band.
                client.selectText(
                    { x: gesture.startX, y: gesture.startY },
                    { x, y },
                    { granularity: gesture.granularity, extend: gesture.extend, global: gesture.global },
                );
                return;
            }
            if (gesture.kind === "cellSelect") {
                if (Math.hypot(x - gesture.startX, y - gesture.startY) >= DRAG_THRESHOLD) gesture.moved = true;
                // Stream the block: anchor the active cell at the press, focus the
                // cell under the pointer. The grid selection rectangle (fill +
                // border) is the feedback — no marquee band.
                client.selectSheetCells({ x: gesture.startX, y: gesture.startY }, { x, y }, { extend: gesture.extend });
                return;
            }
            const dx = x - gesture.startX;
            const dy = y - gesture.startY;
            if (!gesture.moving) {
                if (!gesture.overSelection || Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
                // A selection that doesn't move isn't dragged: the press stays a click.
                if (!selection.allows("translateObjects", "translateAnnotations", "translateShapes")) return;
                gesture.moving = true;
            }
            // Preview the move as a page-local translation delta — viewport px
            // un-rotated through the page view, not a bare scale divide.
            const d = pageDelta(gesture.page ?? -1, dx, dy);
            selection.setPreview({ kind: "affine", m: translate(d.x, d.y) });
            return;
        }
        // Hover (no active gesture).
        const { x, y } = localPoint(ev);
        restingPointer = { x, y };
        shiftHeld = ev.shiftKey;
        linkKeyHeld = linkKeyDown(ev);
        // The polygon being clicked out stretches its next edge to the pointer.
        if (polygonDraft) {
            polygonDraft.pointer = pagePoint(polygonDraft.page, x, y);
            renderSketch();
        }
        hover(x, y);
    }

    /**
     * The hover pass at canvas-local `(x, y)`. In edit mode, reveal the
     * page-control rail for whichever page the pointer is over (any pointer
     * tool). In the select pointer — edit or view — also set the hover cursor: a
     * "move" grab over a selected object, the I-beam over text, the arrow
     * elsewhere.
     *
     * Run by a pointer move, and by every painted frame at the
     * {@link restingPointer}: what is under a point is a question about the
     * content as well as the pointer, and a scroll moves the content alone.
     */
    function hover(x: number, y: number): void {
        const st = store?.getState();
        if (!st || st.status !== "ready") return;
        const page = pageAt(y);
        if (st.mode !== VIEW_MODE) setHoveredPage(page);
        if (st.pointerMode.kind === "select") {
            canvas.style.cursor = selectHoverCursor(x, y);
            // Probe the hit under the pointer whenever it's over a page — to keep
            // `hoverHit` current so the next press routes its gesture synchronously
            // (text / cell / object) and so `selectHoverCursor` can read the I-beam
            // over a text object. The reply re-resolves the cursor in place (see
            // probeHover), correcting a decision this pass made against a stale
            // cache — e.g. "move" shown over text before the hit was known.
            if (page !== null) probeHover(x, y);
            else annotationHover.set(null);
        } else {
            annotationHover.set(null);
        }
    }

    /**
     * Resolve the gesture on release. A select press that became a move commits
     * the displacement as one transform (a translation delta in document points,
     * via the live scale); an unmoved press is a click-select. A marquee press
     * applies its zoom; a pan press just settles the cursor.
     */
    function onPointerUp(ev: PointerEvent): void {
        if (!gesture || ev.pointerId !== gesture.pointerId) return;
        const { x, y } = localPoint(ev);
        lastPointerX = x;
        lastPointerY = y;
        // A mouse or pen rests where it was released; a finger lifts away.
        if (ev.pointerType !== "touch") restingPointer = { x, y };
        const g = gesture;
        gesture = null;
        if (el.hasPointerCapture(ev.pointerId)) el.releasePointerCapture(ev.pointerId);

        if (g.kind === "extension") {
            g.gesture.up(x, y, ev);
            return;
        }
        if (g.kind === "pan") {
            applyModeCursor();
            return;
        }
        if (g.kind === "touchScroll") {
            // A drag already scrolled the view; an unmoved release is a tap, so
            // run the pick it captured at press (object / text / cell).
            if (!g.moved) runTap(g.tap, g.startX, g.startY);
            return;
        }
        if (g.kind === "marquee") {
            marquee.style.display = "none";
            commitMarquee(g, x, y);
            return;
        }
        if (g.kind === "marqueeSelect") {
            marquee.style.display = "none";
            // A real sweep is a marquee over the swept rect; a bare click (no
            // drag) is a point pick at the press. The worker resolves the
            // page(s) either way, so the host just hands over the gesture in
            // canvas CSS px with the mode its modifiers picked.
            if (g.moved) {
                // Sweep direction picks the rule (CAD-style): dragging rightward
                // crosses (any object it touches), dragging leftward windows
                // (`enclose` — only objects fully inside the rect). The engine
                // builds the rect from the two points; the host just reports the
                // direction as `enclose`.
                const enclose = x < g.startX;
                client.selectObjects({ x: g.startX, y: g.startY }, { x, y }, g.mode, enclose);
            } else {
                // A bare click on an object or bare page — an object pick (a text /
                // cell press took its own gesture at pointerdown, so this is never
                // a text / cell click), or a link's follow.
                resolveClick(g.startX, g.startY, g.mode, g.linkKey);
            }
            return;
        }
        if (g.kind === "ink") {
            const placed = hooks.placeAnnotation?.(g.tool, g.page, g.points);
            holdSketch(lineSketch(g.tool, g.page, g.points, false), placed);
            store?.dispatch({ type: "PLACEMENT_COMMITTED" });
            return;
        }
        if (g.kind === "place") {
            commitPlace(g, x, y);
            // Drop the gesture's own sketch; what it placed holds its own.
            renderSketch();
            // One-shot: return to select unless the tool is sticky (the reducer
            // decides; a no-op outside place mode).
            store?.dispatch({ type: "PLACEMENT_COMMITTED" });
            return;
        }
        if (g.kind === "resize") {
            if (g.moved) {
                // Keep the preview until the resized geometry arrives (see
                // onSelection), so the box settles onto the new size with no flash.
                committingEdit = true;
                const d = pageDelta(g.place.page, x - g.startX, y - g.startY);
                const { sx, sy } = resizeScale(g.handle, g.place, d.x, d.y, ev.shiftKey);
                const { ax, ay } = anchorFractions(g.handle);
                // Each object scales about its own anchor, so this can't ride one
                // shared affine delta — the engine reads the per-object bounds.
                hooks.commitScaleEach?.(sx, sy, ax, ay);
            } else {
                // A bare click on a handle — drop the (no-op) preview.
                selection.setPreview(null);
            }
            return;
        }
        if (g.kind === "textSelect") {
            // A click on an annotation picks it — a link's follows it where a
            // click follows one.
            if (g.clickPicks && !g.moved) {
                resolveClick(g.startX, g.startY, "replace", g.linkKey, g.extend);
                return;
            }
            // A click on a linked run follows its link where a click follows
            // one; a chained press still selects the word or paragraph.
            const textLink =
                g.moved || g.granularity !== "character"
                    ? null
                    : followedTextLink(g.startX, g.startY, g.extend, g.linkKey);
            if (textLink) {
                followTextLinkAt(textLink, g.startX, g.startY);
                return;
            }
            // A click (no drag) drops a caret at the press — or the word /
            // paragraph around it on a chained press; a drag already streamed
            // the range on move. Either way, assert the final anchor→focus.
            client.selectText(
                { x: g.startX, y: g.startY },
                { x, y },
                { granularity: g.granularity, extend: g.extend, global: g.global },
            );
            // A markup tool's drag marks what it selected; a bare click leaves a
            // caret, which marks nothing. The tool is put down once it has
            // marked something, unless it is sticky.
            if (g.markup) {
                void hooks.markText?.(g.markup).then((marked) => {
                    if (marked) store?.dispatch({ type: "PLACEMENT_COMMITTED" });
                });
            }
            return;
        }
        if (g.kind === "cellSelect") {
            // A click sets the active cell; a drag already streamed the block on
            // move. Assert the final anchor (active) → focus block.
            client.selectSheetCells({ x: g.startX, y: g.startY }, { x, y }, { extend: g.extend });
            return;
        }
        if (g.moving) {
            // Keep the preview until the moved geometry arrives (see onSelection),
            // so the box settles onto the new position without a flash. A move is
            // a page-local translation — the precise sibling of rotate/scale.
            committingEdit = true;
            const d = pageDelta(g.page ?? -1, x - g.startX, y - g.startY);
            // Through the shell, so the move broadcasts like any other edit.
            hooks.commitTranslate?.(d.x, d.y);
        } else {
            // A bare click over the current selection re-picks the object per the
            // mode its modifiers set. Only object presses reach here: a press
            // inside an open text object (ObjectText) took the text branch above,
            // and a click on its border re-selects the frame (exits text editing).
            // A click on a selected link's body follows it where a click
            // follows one.
            if (selection.borderLocal(g.startX, g.startY)) resolveObjectClick(g.startX, g.startY, g.mode);
            else resolveClick(g.startX, g.startY, g.mode, g.linkKey);
        }
    }

    /** A cancelled gesture (e.g. the browser stealing the pointer): drop it. */
    function onPointerCancel(ev: PointerEvent): void {
        if (!gesture || ev.pointerId !== gesture.pointerId) return;
        const g = gesture;
        gesture = null;
        if (g.kind === "select" || g.kind === "resize") {
            committingEdit = false;
            selection.setPreview(null);
        }
        if (g.kind === "extension") {
            committingEdit = false;
            g.gesture.cancel();
        }
        if (g.kind === "marquee" || g.kind === "marqueeSelect") marquee.style.display = "none";
        if (g.kind === "ink" || g.kind === "place") renderSketch();
        applyModeCursor();
        if (el.hasPointerCapture(ev.pointerId)) el.releasePointerCapture(ev.pointerId);
    }

    /**
     * A gesture captures the pointer on the host, and while it holds it the
     * browser draws the **host's** cursor, not the canvas's under the pointer —
     * the I-beam a text drag started under, the move / resize / rotate cursor of
     * an object drag, pan's grabbing hand would all fall back to the arrow. So the
     * host wears the canvas's cursor for as long as it holds the capture. A guide
     * band captures on itself and keeps its own.
     */
    function onGotCapture(ev: PointerEvent): void {
        if (ev.target === el) el.style.cursor = canvas.style.cursor;
    }

    function onLostCapture(ev: PointerEvent): void {
        if (ev.target === el) el.style.cursor = "";
    }

    /** Pointer left the host entirely (onto a panel/toolbar): hide every rail. */
    function onPointerLeave(ev: PointerEvent): void {
        hooks.pointerLeave?.();
        restingPointer = null;
        setHoveredPage(null);
        annotationHover.set(null);
        setHoverTitle("none");
        crossWidgets("none");
        if (reportedHover !== null) {
            reportedHover = null;
            hooks.annotationHover?.(null, ev.clientX, ev.clientY);
        }
    }

    /** Where the last primary press went down, in viewport px, for {@link onClickRelease}. */
    let clickFrom: { x: number; y: number } | null = null;

    /** Note a primary press, ahead of the canvas's own handling. */
    function onClickPress(ev: PointerEvent): void {
        clickFrom = ev.button === 0 ? { x: ev.clientX, y: ev.clientY } : null;
    }

    /**
     * A release ending a press that didn't drag, on an annotation: report it to
     * {@link CanvasHooks.annotationClick} ahead of the canvas's own handling.
     */
    function onClickRelease(ev: PointerEvent): void {
        const from = clickFrom;
        clickFrom = null;
        if (!from || ev.button !== 0) return;
        if (Math.hypot(ev.clientX - from.x, ev.clientY - from.y) >= DRAG_THRESHOLD) return;
        const { x, y } = localPoint(ev);
        const annotation = annotationOf(hitAt(x, y));
        if (annotation) hooks.annotationClick?.(annotation, ev.clientX, ev.clientY);
    }

    function onWheel(ev: WheelEvent): void {
        if (!store) return;
        ev.preventDefault();
        if (ev.ctrlKey || ev.metaKey) {
            // Zoom about the cursor. Wheel up (negative deltaY) zooms in.
            const rect = canvas.getBoundingClientRect();
            const factor = Math.exp(-ev.deltaY * 0.002);
            store.dispatch({
                type: "SET_ZOOM",
                // Scale from the zoom on screen now (the fit's derived zoom when
                // zooming out of a fit), not the stale explicit one.
                zoom: renderZoom(store.getState()) * factor,
                anchorX: ev.clientX - rect.left,
                anchorY: ev.clientY - rect.top,
            });
        } else {
            const s = store.getState();
            // Document-space delta = CSS-px delta / (zoom × 96/72).
            const perPt = renderZoom(s) * cssPxPerPt(viewDpi(s));
            const dy = ev.deltaY / perPt;
            if (maybeFlipPage(store, s, dy)) return;
            store.dispatch({ type: "SCROLL_BY", dx: ev.deltaX / perPt, dy });
        }
    }

    /**
     * Single-page view paging: a vertical wheel scroll that pushes past the
     * current page's edge flips to the adjacent page rather than dead-ending at
     * the clamp. The engine's `go_to_page` re-clamps the carried scroll onto the
     * new page's near edge, so going forward the next page enters at its top and
     * going back the previous page enters at its bottom — a continuous reading
     * feel. Only one flip fires per gesture (`pageFlipArmed`), so a trackpad's
     * momentum tail can't skip pages. Returns true when it consumed the event,
     * in which case the caller skips the normal scroll.
     */
    function maybeFlipPage(st: Store<UIState, Action>, s: UIState, dy: number): boolean {
        if (s.scrollMode !== "spread" || dy === 0) return false;
        const now = Date.now();
        if (now - lastWheelTs > WHEEL_REST_MS) pageFlipArmed = true;
        lastWheelTs = now;

        const z = renderZoom(s);
        // When the page is smaller than the viewport the engine centers it, so
        // the reported scroll offset is negative and never reaches `maxY`. Treat
        // a fully-visible page as sitting at both edges, so a wheel in either
        // direction flips rather than dead-ending against the centered clamp.
        const visibleDocHeight = z > 0 ? visibleSpan(s, "y") / (z * cssPxPerPt(viewDpi(s))) : 0;
        const maxY = Math.max(0, s.scrollSize.height - visibleDocHeight);
        const fits = z > 0 && s.scrollSize.height <= visibleDocHeight + PAGE_EDGE_EPSILON;
        const atBottom = fits || s.scrollY >= maxY - PAGE_EDGE_EPSILON;
        const atTop = fits || s.scrollY <= PAGE_EDGE_EPSILON;
        const target = dy > 0 && atBottom ? pageStep(s, 1) : dy < 0 && atTop ? pageStep(s, -1) : null;
        if (target === null) return false; // mid-spread, or no adjacent spread

        // At the boundary with an adjacent page: consume the event either way.
        // Scrolling at the edge can't move within the page anyway, so swallowing
        // it while cooling down just avoids a no-op clamp.
        if (pageFlipArmed) {
            pageFlipArmed = false;
            st.dispatch({ type: "NAVIGATE_TO_PAGE", pageIndex: target });
        }
        return true;
    }

    function destroy(): void {
        resizeObserver?.disconnect();
        resizeObserver = null;
        if (resizeTimer !== null) clearTimeout(resizeTimer);
        resizeTimer = null;
        for (const off of cleanups) off();
        cleanups.length = 0;
        overlay.clear();
        overlayAbove.clear();
        selection.clear();
        root.remove();
        store = null;
    }

    /** Recolor the guide bands (ruler / headers) to the host theme — the shell
     *  calls this on a theme flip, reading its `--udoc-guide-*` tokens. */
    function setGuideColors(
        band: RgbColor,
        marker: RgbColor,
        text: RgbColor,
        highlight: RgbColor,
        grid: RgbColor,
    ): void {
        guideBands.setColors(band, marker, text, highlight, grid);
    }

    /**
     * Give the engine the scrollbar size for a doc type whose bars take a strip
     * of their own (see the profile's `scrollbarGutters`) — it keeps one clear
     * along the right / bottom edge in the very frame a bar shows, and centres
     * the page beside it — or none for one whose bars float over the canvas.
     * The grid class makes the guttered bars' tracks opaque, so the strip hides
     * the overlays too. Applied with the band reservation: it's the same kind of
     * fact — known from the doc type alone — so the engine has it before the
     * first paint.
     *
     * Either way the bars lie over the pane's bottom and right edges, so the
     * brand decal sits in from them by a bar's thickness.
     */
    function applyScrollbarMode(state: UIState): void {
        const gutters = profileFor(state.docType).scrollbarGutters;
        root.classList.toggle("udoc-ui__viewport-grid--scrollbar-gutters", gutters);
        const size = gutters ? SCROLLBAR_THICKNESS_PX : 0;
        if (size !== scrollbarSize) {
            scrollbarSize = size;
            client.setScrollbarSize(size);
        }
        if (!brandingInsetSent) {
            brandingInsetSent = true;
            client.setBrandingInset(SCROLLBAR_THICKNESS_PX);
        }
    }

    /**
     * Reserve the guide bands for the now-known doc type and push the resulting
     * (band-inset) viewport straight to the worker — the guide analog of the
     * shell's `setSpacing`, run on the open critical path *before* the first paint.
     *
     * The worker deliberately doesn't paint the opening frame; the shell drives it
     * explicitly once the doc type is known. Reserving the bands only reactively
     * (the store subscription — a microtask later, after the first paint) would
     * measure the pane full-size, paint the opening frame full-size, then reflow it
     * a beat later when the debounced band resize landed — the open flash. So here
     * we size the pane and hand the worker the inset viewport synchronously: the
     * band tracks resize the pane, we read it back (a forced relayout) and push
     * those metrics to the worker directly (not via the batched store subscription,
     * which wouldn't reach it until after the paint). The store catches up through
     * the normal debounced resize path; its later `setViewport` is an idempotent
     * no-op at the same size.
     */
    function reserveGuides(): void {
        if (!store) return;
        guideBands.layout(bandKind(store.getState()));
        applyScrollbarMode(store.getState());
        // `getBoundingClientRect` forces the pending grid-track relayout, so this
        // reads the content pane at its post-reservation (inset) size.
        const rect = el.getBoundingClientRect();
        store.dispatch({ type: "RESIZE_VIEWPORT", width: rect.width, height: rect.height });
        client.setViewport(currentViewport(store.getState()));
    }

    return {
        el,
        mount,
        destroy,
        setOverlay,
        removeOverlay,
        selectionKeepOut,
        setGuideColors,
        reserveGuides,
        hoveredPage: () => hoveredPage,
        /** Page `page`'s page→viewport affine this frame (CSS px), or null when
         *  it isn't on screen — for an overlay anchored to a point on the page. */
        pageToViewport: (page: number) => selection.pageToViewport(page),
        /** The hidden text input, focused for all of edit mode and, in view
         *  mode, while the selection is copyable — where the native `copy` /
         *  `cut` / `paste` events fire. */
        clipboardSink: textInput.el,
        /** Focus the clipboard sink so a menu row's `execCommand("copy" /
         *  "cut")` dispatches its synthetic clipboard event onto it (a click
         *  fires no native clipboard event of its own). */
        focusClipboardSink: () => textInput.focus(),
    };
}
