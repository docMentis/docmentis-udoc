// Geometry primitives shared between the UI and the worker. All
// rectangles and sizes are in **document space** (PDF points, 1pt = 1/72")
// unless a field name says otherwise. The viewer maps document space → device
// pixels through the camera; the wasm boundary converts device px ↔ the CSS px
// the DOM works in via the `dpr`, so nothing above it does dpr math.

// Wire contract types declared from the Rust source (tsify → `udoc.d.ts`) are
// re-exported here so host code keeps one geometry import surface. They are the
// single definition — no hand-authored mirror.
import type { Feature, FileFormat, SheetState, UDocType } from "@docmentis/udoc-wasm";
import type {
    UDocSelectionCapabilities as SelectionCapabilities,
    SelectionBox,
    SelectionQuad,
    SelectionHandle,
    HeaderBands,
    SelectionGeometry,
    PeerSelectionGeometry,
    Peer,
    PeerPointer,
    Pointer,
    ViewLength,
    ContentPadding,
    ScrollAlignment,
    ScrollMode,
    Fit,
    FitMode,
    LayoutMode,
    PageGap,
    SelectMode,
    TextCaretMove,
    TextGranularity,
    TextSelectOptions,
    GridCellSelectOptions,
    TableSelectOptions,
    UDocSelectionProperties,
    Consensus,
    TextLineSpacing,
    TextParagraphAlign,
    PaintFill,
    PaintLine,
    PaintColor,
    PaintColorTransform,
    PaintSchemeColor,
    DeviceColor,
    Brush,
    Color,
    Guide,
    RulerAxis,
    RulerSpan,
    RulerText,
    RulerTab,
    RulerTabAlign,
    HeaderCell,
} from "@docmentis/udoc-wasm";

// Re-exported so host code keeps one geometry import surface; these are the
// single definition (generated from the Rust source), with no hand-authored
// mirror. The guide chrome and content padding are `core::viewer` types, the
// select options the text / spreadsheet types — reused, not shadowed.
export type {
    SelectionCapabilities,
    ViewLength,
    ContentPadding,
    ScrollAlignment,
    ScrollMode,
    Fit,
    FitMode,
    LayoutMode,
    PageGap,
    SelectMode,
    TextCaretMove,
    TextGranularity,
    TextSelectOptions,
    GridCellSelectOptions,
    TableSelectOptions,
    UDocSelectionProperties,
    TextParagraphAlign,
    Guide,
    RulerAxis,
    RulerSpan,
    RulerText,
    RulerTab,
    RulerTabAlign,
    HeaderCell,
};

// `Guide` is an internally-tagged union whose arm payloads tsify declares
// without the `kind` tag; recover the tagged per-kind shapes the band renderer
// takes by narrowing on `type` (still the one `Guide` source, not a shadow).
export type HeaderGuide = Extract<Guide, { type: "header" }>;

/**
 * CSS pixels per document point at 100% zoom on a screen of `dpi` CSS px per
 * physical inch: documents are 72 pt per inch. Zoom is *faithful* — `1.0`
 * displays one document inch as `dpi` CSS px; `dpi` is the doc type's default
 * (96, the CSS inch; 72 for a spreadsheet, Mac Excel's 100%) unless the host
 * calibrated it to the screen's real density, and the worker declares the
 * engine's dpi as `dpi × devicePixelRatio` to match — so every pt ↔ CSS-px
 * conversion goes through `zoom × cssPxPerPt(viewDpi(state))`.
 */
export function cssPxPerPt(dpi: number): number {
    return dpi / 72;
}

export interface Size {
    width: number;
    height: number;
}

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** An opaque sRGB color, each channel an integer in `[0, 255]`. */
export interface RgbColor {
    r: number;
    g: number;
    b: number;
}

// `ViewLength` (`{ pt } | { px }`), `ContentPadding`, `ScrollMode`, `Fit`,
// `FitMode`, `LayoutMode` and `PageGap` are re-exported from the schema at the
// top of this file. A `px` padding edge is CSS px here; the wasm boundary
// multiplies it by the dpr into the viewer's device px on `setSpacing`. The page
// gaps are document points and pass through.

/**
 * A snapshot of a document's layout: its page count, how far it has composed,
 * and its total scrollable size.
 *
 * All are **dynamic** — editing can add/remove pages or grow/shrink the
 * content — so this is a snapshot the worker reports (on open, and again after
 * any re-layout), never a constant captured once at open time.
 */
export interface DocumentLayout {
    /**
     * The document's page count once known — a PDF's pages and a
     * presentation's slides from the open, a flow document's once a compose
     * step reports {@link DocumentLayout.complete} — so a page not composed yet
     * can be gone to; absent before.
     */
    pageCount?: number;
    /**
     * The first page not composed (0 for doc types without pagination) — where
     * the compose-ahead pump goes on from, and the document's page count once
     * every page is composed.
     */
    firstUncomposedPage: number;
    /** Total scrollable size in document space. */
    scrollSize: Size;
    /**
     * Whether the document is now **fully composed** — there is nothing left to
     * compose ahead. Set only on the `updateLayout` reply, absent on open and
     * re-layout reports.
     */
    complete?: boolean;
    /**
     * The open document's doc type — the host's cue for a doc-type-appropriate
     * default fit. Set only on the open reply, absent on re-layout reports.
     */
    docType?: UDocType;
    /**
     * The file format the document came from — what saving it back means.
     * Set only on the open reply, and absent there too for a package that
     * recorded none.
     */
    sourceFormat?: FileFormat;
    /**
     * Whether the document opened needs a password before it can be read — a
     * PDF encrypted with a user password — the rest of this layout then being
     * an empty document's. Set only on the open and `authenticate` replies,
     * and only while it does.
     */
    needsPassword?: boolean;
}

/**
 * The document's plane roster — the source of a spreadsheet's sheet tabs. A
 * plane is one scrollable surface; most doc types have exactly one, a workbook
 * has one per sheet. Read on open (planes are workbook structure, stable until
 * an edit), never per frame.
 */
export interface PlaneInfo {
    /** Number of planes — the sheet count for a spreadsheet, `1` otherwise. */
    count: number;
    /** The active plane (0-based) — the current sheet. */
    current: number;
    /**
     * Each plane's display name, indexed by plane. A spreadsheet's sheet-tab
     * labels; `""` for a plane with no name (every single-plane doc type).
     */
    names: string[];
    /**
     * Each plane's tab colour as `#rrggbb`, indexed by plane — a spreadsheet's
     * sheet-tab colours. `null` for a tab in no colour (every single-plane doc
     * type), and `undefined` for a sheet not loaded yet: the worker loads the
     * sheets one by one, and posts each one's colour as it lands.
     */
    colors: (string | null | undefined)[];
    /**
     * Whether each plane is a chartsheet — a chart, with no grid and so no row
     * and column headers — indexed by plane. `false` for a worksheet, every
     * single-plane doc type, and a sheet not loaded yet, posted as it lands as
     * its colour is.
     */
    chartsheets: boolean[];
    /**
     * Each plane's sheet visibility, its `state`, indexed by plane: `"hidden"`
     * for a sheet Excel shows no tab for until the user unhides it,
     * `"veryHidden"` for one it offers no way to unhide, and `"visible"` for
     * every other sheet and every single-plane doc type.
     */
    visibility: SheetState[];
}

/**
 * A slide's resolved theme color palette — the mapped `DrawingML` scheme slots
 * as `#rrggbb` device-sRGB hex, the wire form of the engine's `themePalette()`.
 * Slots follow the Office order the picker shows. "Palette", not "theme":
 * colors only, not the theme's fonts/effects.
 */
export interface ThemePalette {
    /** The theme's color-scheme name (`a:clrScheme@name`). */
    name: string;
    /** `tx1` — primary text. */
    text1: string;
    /** `bg1` — primary background. */
    background1: string;
    /** `tx2` — secondary text. */
    text2: string;
    /** `bg2` — secondary background. */
    background2: string;
    accent1: string;
    accent2: string;
    accent3: string;
    accent4: string;
    accent5: string;
    accent6: string;
    /** `hlink` — hyperlink. */
    hyperlink: string;
    /** `folHlink` — followed hyperlink. */
    followedHyperlink: string;
}

/**
 * One on-screen page projected into **viewport space** (CSS px), the unit an
 * HTML overlay layer positions page chrome from: a corner button from a page's
 * box, an inter-page divider from the gap between two consecutive boxes. Unlike
 * everything else here, `x`/`y`/`width`/`height` are CSS px, not document
 * points — the worker has already applied the current scroll/zoom — so an
 * absolutely-positioned element drops straight onto the page. Recomputed each
 * painted frame and streamed from the worker; see the overlay layer.
 */
export interface PageView {
    /** 0-based page index, in the document's page order. */
    index: number;
    /** Top-left and size of the page in the viewport, CSS px. */
    x: number;
    y: number;
    width: number;
    height: number;
    /** The page's display rotation as quarter turns clockwise (0/1/2/3 =
     *  0°/90°/180°/270°). The rect above is the axis-aligned on-screen box; an
     *  overlay projecting page-anchored geometry needs this to orient itself on
     *  a rotated page. */
    rotation: number;
}

// The selection-geometry types are the engine's declarations (imported at the
// top), re-exported so the host imports them from one place. Page-anchored, in
// page-local document points and camera-independent — the selection layer
// projects them to CSS px each frame against the page's {@link PageView}, so
// scroll/zoom never re-send them. A `SelectionBox` carries a `rect` (the
// engine's `Rect`, bounds in its own local space) plus a `local → page`
// `transform` (its `Affine`); the layer maps the rect's four corners through
// the transform (then the page's on-screen rect) to draw a faithful
// parallelogram, so rotation and skew render correctly. A text highlight is a
// `SelectionQuad` instead — four corners already on the page — since the text
// under it may be bent by a warp, which no parallelogram follows.
export type { SelectionBox, SelectionQuad, SelectionHandle, HeaderBands, SelectionGeometry, PeerSelectionGeometry };

// A collaborator — its replica id, a stable color seed, and the name it
// advertised — and its pointer: the page it rests on and the point in that
// page's local space, page-anchored like a selection box, placed through the
// same page view.
export type { Peer, Pointer, PeerPointer };

// The select-gesture option types — `SelectMode` (`"replace" | "add" |
// "subtract" | "toggle"`), `TextGranularity`, `TextSelectOptions`,
// `GridCellSelectOptions` — are re-exported from the engine at the top of this file;
// they're the text / spreadsheet types, reused directly. The object domain has
// no options struct: `selectObjects` takes `mode` + `enclose` directly.

/**
 * A selection-edit gating kind — a name the engine reports in
 * {@link SelectionCapabilities.allowed}, the payload-free projection of the
 * like-named Rust `*SelectionEdit` variant (`camelCase`). Every kind is globally
 * distinct — a shape `deleteShapes` never collides with a text `deleteText` — so
 * the name alone says which edit it gates, wherever the selection sits.
 *
 * Each kind names what it acts on: a PDF's whole pages (`deletePages`), its page
 * objects (`deleteObjects`) or annotations (`deleteAnnotations`), a deck's
 * slides (`deleteSlides`), a drawing's shapes (`deleteShapes`). The object,
 * annotation and shape reorder kinds gate all four z-order moves (Bring to
 * Front / Forward / Send Backward / to Back); align / distribute / flip have no kind of their own —
 * the host gates them from the translate / scale-each kinds + `count`.
 */
export type SelectionEditKind =
    | "deletePages"
    | "rotatePages"
    | "insertPage"
    | "duplicatePages"
    | "reorderPages"
    | "deleteSlides"
    | "insertSlide"
    | "duplicateSlides"
    | "reorderSlides"
    | "setSlidesShow"
    | "deleteObjects"
    | "translateObjects"
    | "rotateEachObject"
    | "scaleEachObject"
    | "groupObjects"
    | "ungroupObjects"
    | "reorderObjects"
    | "setNonstrokingStyle"
    | "setStrokingStyle"
    | "deleteAnnotations"
    | "translateAnnotations"
    | "resizeAnnotations"
    | "reorderAnnotations"
    | "deleteShapes"
    | "translateShapes"
    | "rotateEachShape"
    | "scaleEachShape"
    | "groupShapes"
    | "ungroupShapes"
    | "reorderShapes"
    | "setShapeFill"
    | "setShapeLine"
    | "setShapeTextBodyProperties"
    | "resizeTextBox"
    | "setSectionPageMargins";

/** Whether `caps` allows a selection edit of any of `kinds` — no per-doc-type
 *  branch: pass every name the control's edit goes by (`deleteObjects`,
 *  `deleteAnnotations` and `deleteShapes` for Delete). */
export function allowsEdit(caps: SelectionCapabilities, ...kinds: SelectionEditKind[]): boolean {
    return caps.allowed.some((kind) => (kinds as string[]).includes(kind));
}

/** The edits on an annotation selection — `annotation`'s; every other kind is
 *  `editing`'s. */
const ANNOTATION_EDIT_KINDS: ReadonlySet<string> = new Set<SelectionEditKind>([
    "deleteAnnotations",
    "translateAnnotations",
    "resizeAnnotations",
    "reorderAnnotations",
]);

/** `caps` less the edits a session entitled to `features` may not make, so
 *  every control that reads them — a handle, Delete, the move cursor, a
 *  command's enablement — offers only what the engine will take. Selecting
 *  stays: it is reading. */
export function entitledCapabilities(caps: SelectionCapabilities, features: readonly Feature[]): SelectionCapabilities {
    const allowed = caps.allowed.filter((kind) =>
        features.includes(ANNOTATION_EDIT_KINDS.has(kind) ? "annotation" : "editing"),
    );
    return allowed.length === caps.allowed.length ? caps : { ...caps, allowed };
}

/**
 * A text sub-domain edit gate — the payload-free projection of the like-named
 * Rust `TextSelectionEdit` variant (`camelCase`). The text sub-domain is shared,
 * so the same gate arrives wherever the caret is: a slide shape's text, a table
 * cell, a word document's body or one of its text boxes.
 */
export type TextEditKind =
    | "insertText"
    | "deleteText"
    | "setCharacterProperties"
    | "clearCharacterProperties"
    | "setParagraphProperties"
    | "clearParagraphProperties"
    | "indentParagraphs";

/**
 * Whether `caps` allows the text edit `kind` — the text cousin of
 * {@link allowsEdit}, doc-type-independent (no `if pptx`). No host guard is
 * needed: the text names (`deleteText`, `setCharacterProperties`, …) are globally
 * distinct from the object and shape ones (`deleteObjects`, `deleteShapes`, …),
 * so a text gate never collides with an object gate.
 */
export function allowsTextEdit(caps: SelectionCapabilities, kind: TextEditKind): boolean {
    return caps.allowed.includes(kind);
}

/**
 * A table sub-domain edit gate — the payload-free projection of the like-named
 * Rust `TableSelectionEdit` variant (`camelCase`), whether the table sits in a
 * slide's graphic frame or a word document's flow.
 */
export type TableEditKind =
    | "insertRows"
    | "deleteRows"
    | "insertColumns"
    | "deleteColumns"
    | "mergeCells"
    | "unmergeCells";

/**
 * Whether `caps` allows the table edit `kind` — the table cousin of
 * {@link allowsTextEdit}.
 *
 * No host guard is needed here either: the table names (`deleteRows`,
 * `mergeCells`, …) are globally distinct from the shape ones (`deleteShapes`) and
 * the text ones (`deleteText`) — deleting a row is not deleting the frame it sits in.
 */
export function allowsTableEdit(caps: SelectionCapabilities, kind: TableEditKind): boolean {
    return caps.allowed.includes(kind);
}

/** The empty selection's capabilities — nothing is possible (no selection / no
 *  document). The reducer's initial value and the worker's no-document fallback. */
export const EMPTY_SELECTION_CAPABILITIES: SelectionCapabilities = {
    count: 0,
    copyable: false,
    allowed: [],
};

/** A character-format toggle's state across the selection — {@link SelectionTextFormat}'s
 *  bold / italic: `"on"` (every covered span has it), `"off"` (none, or nothing
 *  selected), or `"mixed"` (some do). Mirrors the Rust `Consensus`. */
export type TextFormatState = "on" | "off" | "mixed";

/**
 * The Text tab's mirror of the current selection's resolved character format —
 * the toolbar-ready projection of {@link UDocSelectionProperties}. `font` is the
 * resolved family name and `size` the resolved point size, each `""` when the
 * selection spans more than one value or carries none (a non-text selection);
 * the toggles fold to {@link TextFormatState}. Every value is *resolved* (after
 * the style / placeholder / theme cascade), so it reflects what the user sees,
 * not the model's inherit-marker.
 */
export interface SelectionTextFormat {
    font: string;
    size: string;
    bold: TextFormatState;
    italic: TextFormatState;
    underline: TextFormatState;
    strikethrough: TextFormatState;
    /** Raised off the baseline — docx's superscript or a positive pptx
     *  percentage, folded to presence like the underline. */
    superscript: TextFormatState;
    /** Lowered below the baseline, read the same way. */
    subscript: TextFormatState;
    /** The horizontal glyph scale the spans share (`1` unscaled, `1.5` for
     *  150%), or `null` when they disagree or the selection covers none — the
     *  Scale dropdown's marked row. */
    widthScale: number | null;
    /** The alignment the touched paragraphs share, or `null` when they disagree
     *  (or the selection touches none) — the Align dropdown's current value. */
    align: TextParagraphAlign | null;
    /** The line-spacing **multiple** the paragraphs share (`1.5` for one-and-a-half
     *  spacing), or `null` for none, a disagreement, or a spacing set in points —
     *  which the dropdown's multiples can't show as one of their own. */
    lineSpacing: number | null;
    /** The space above the paragraphs, in points, or `null` when absent / mixed /
     *  left to the consumer (docx's auto). Drives the Space Before switch. */
    spaceBefore: number | null;
    /** The space below, read the same way. */
    spaceAfter: number | null;
    /** Whether a bullet renders across the touched paragraphs — the bulleted-list
     *  toggle, folded to presence like the underline one (two paragraphs bulleted
     *  with different glyphs agree the toggle is on). */
    bulleted: TextFormatState;
    /** Whether an auto-number renders — the numbered-list toggle. */
    numbered: TextFormatState;
}

/** The empty text format — nothing selected (or a non-text selection). The
 *  reducer's initial value and the no-text fallback. */
export const EMPTY_SELECTION_TEXT_FORMAT: SelectionTextFormat = {
    font: "",
    size: "",
    bold: "off",
    italic: "off",
    underline: "off",
    strikethrough: "off",
    superscript: "off",
    subscript: "off",
    widthScale: null,
    align: null,
    lineSpacing: null,
    spaceBefore: null,
    spaceAfter: null,
    bulleted: "off",
    numbered: "off",
};

/** A `Consensus` boolean → a toggle state: `Value(true)` on, `Value(false)` /
 *  absent off, mixed mixed. */
function textFormatState(consensus: Consensus<boolean>): TextFormatState {
    if (consensus === "mixed") return "mixed";
    if (consensus === "absent") return "off";
    return consensus.value ? "on" : "off";
}

/** A `Consensus` string → the shared value, or `""` when absent / mixed (no
 *  single family to show). */
function consensusFont(consensus: Consensus<string>): string {
    return typeof consensus === "object" && "value" in consensus ? consensus.value : "";
}

/** A `Consensus` point size → the shared value formatted for the field (a whole
 *  size drops its `.0`, e.g. `18`; a fractional one keeps a place, e.g. `10.5`),
 *  or `""` when absent / mixed (no single size to show). */
function consensusSize(consensus: Consensus<number>): string {
    if (typeof consensus !== "object" || !("value" in consensus)) return "";
    const size = consensus.value;
    return Number.isInteger(size) ? String(size) : size.toFixed(1);
}

/** A `Consensus` width scale → the shared factor, or `null` when absent /
 *  mixed (no one row for the Scale dropdown to mark). */
function consensusScale(consensus: Consensus<number>): number | null {
    return typeof consensus === "object" && "value" in consensus ? consensus.value : null;
}

/** A `Consensus` alignment → the shared value, or `null` when absent / mixed
 *  (no one alignment for the trigger to wear or a row to mark). */
function consensusAlign(consensus: Consensus<TextParagraphAlign>): TextParagraphAlign | null {
    return typeof consensus === "object" && "value" in consensus ? consensus.value : null;
}

/** A `Consensus` line spacing → the shared **multiple**, or `null` when absent /
 *  mixed / measured in points. The dropdown offers multiples (1.0, 1.5, …), so an
 *  exact or at-least spacing in points has no row to mark — it is a real value
 *  the paragraph carries, just not one this control can show. */
function consensusLineSpacing(consensus: Consensus<TextLineSpacing>): number | null {
    if (typeof consensus !== "object" || !("value" in consensus)) return null;
    const spacing = consensus.value;
    return "percent" in spacing ? spacing.percent : null;
}

/** A `Consensus` point measure → the shared value, or `null` when absent / mixed.
 *  The paragraph-spacing twin of {@link consensusSize}, kept numeric (a switch
 *  reads it as on/off, not as a field's text). */
function consensusPoints(consensus: Consensus<number>): number | null {
    return typeof consensus === "object" && "value" in consensus ? consensus.value : null;
}

/**
 * Project the engine's {@link UDocSelectionProperties} onto the Text tab's
 * {@link SelectionTextFormat}. Text is a shared sub-domain, so the presentation
 * and wordprocessing variants both carry the same `text` block — read whichever
 * is open. Any other doc type (or no selection) reflects
 * {@link EMPTY_SELECTION_TEXT_FORMAT}.
 */
export function selectionTextFormat(properties: UDocSelectionProperties | null): SelectionTextFormat {
    const text =
        properties && "presentation" in properties
            ? properties.presentation.text
            : properties && "wordprocessing" in properties
              ? properties.wordprocessing.text
              : null;
    if (!text) return EMPTY_SELECTION_TEXT_FORMAT;
    return {
        font: consensusFont(text.font),
        size: consensusSize(text.size),
        bold: textFormatState(text.bold),
        italic: textFormatState(text.italic),
        underline: textFormatState(text.underline),
        strikethrough: textFormatState(text.strikethrough),
        superscript: textFormatState(text.superscript),
        subscript: textFormatState(text.subscript),
        widthScale: consensusScale(text.widthScale),
        align: consensusAlign(text.align),
        lineSpacing: consensusLineSpacing(text.lineSpacing),
        spaceBefore: consensusPoints(text.spacingBefore),
        spaceAfter: consensusPoints(text.spacingAfter),
        bulleted: textFormatState(text.bulleted),
        numbered: textFormatState(text.numbered),
    };
}

/**
 * One color control's mirror of the selection: the swatch a Fill / Stroke / Text
 * Color dropdown shows. `solid` is a concrete color to paint; `theme` a color the
 * engine resolved from a `schemeClr`, carrying the slot it tracks (so the picker
 * can ring it) beside the `hex` it currently paints; `none` an explicit no-fill
 * (struck swatch); `mixed` a selection whose spans / objects disagree; `unknown`
 * no color info — a gradient / pattern fill that doesn't reduce to one swatch, or
 * a doc type that doesn't surface this channel.
 */
export type PaintDisplay =
    | { kind: "solid"; hex: string }
    | { kind: "theme"; slot: PaintSchemeColor; transforms: PaintColorTransform[]; hex: string }
    | { kind: "none" }
    | { kind: "mixed" }
    | { kind: "unknown" };

/** The color controls' mirrors of the current selection — what the Fill / Stroke
 *  / Text Color / Highlight dropdowns swatch. Projected from
 *  {@link UDocSelectionProperties}. */
export interface SelectionPaint {
    fill: PaintDisplay;
    stroke: PaintDisplay;
    text: PaintDisplay;
    highlight: PaintDisplay;
}

/** The empty paint mirror — nothing selected, or a doc type that surfaces no
 *  color. Every channel `unknown` (a neutral swatch). */
export const EMPTY_SELECTION_PAINT: SelectionPaint = {
    fill: { kind: "unknown" },
    stroke: { kind: "unknown" },
    text: { kind: "unknown" },
    highlight: { kind: "unknown" },
};

/** Reduce a channel's `Consensus` paint to a {@link PaintDisplay}: absent → no
 *  info, mixed → mixed, a single value → the reducer's swatch. */
function consensusPaint<T>(consensus: Consensus<T>, reduce: (value: T) => PaintDisplay): PaintDisplay {
    if (consensus === "absent") return { kind: "unknown" };
    if (consensus === "mixed") return { kind: "mixed" };
    return reduce(consensus.value);
}

/** An `#rrggbb` string from 0–255 channel values (clamped and rounded). */
function rgbHex(r: number, g: number, b: number): string {
    const byte = (v: number) =>
        Math.max(0, Math.min(255, Math.round(v)))
            .toString(16)
            .padStart(2, "0");
    return `#${byte(r)}${byte(g)}${byte(b)}`;
}

/** A device color's display hex from its components (`0..=1`), or `null` for a
 *  registered (non-device) color space. Reads both the engine's resolved
 *  `DeviceColor` (a shape's display color) and a portable path's
 *  `Color`: the same device vocabulary, so one reader serves both. */
function deviceColorHex(color: DeviceColor | Color): string | null {
    const space = color.colorSpace;
    const [a, b, c, d] = color.components;
    if (space === "deviceGray") return a === undefined ? null : rgbHex(a * 255, a * 255, a * 255);
    if (space === "deviceRgb" || space === "srgb") {
        return a === undefined || b === undefined || c === undefined ? null : rgbHex(a * 255, b * 255, c * 255);
    }
    if (space === "deviceCmyk") {
        if (a === undefined || b === undefined || c === undefined || d === undefined) return null;
        return rgbHex((1 - a) * (1 - d) * 255, (1 - b) * (1 - d) * 255, (1 - c) * (1 - d) * 255);
    }
    return null;
}

/** A portable `Brush` (a fill / stroke paint) → its swatch. A solid device color
 *  swatches directly; a pattern brush has no single swatch (`unknown`). */
function portableBrushDisplay(brush: Brush): PaintDisplay {
    if ("solid" in brush) {
        const hex = deviceColorHex(brush.solid);
        return hex ? { kind: "solid", hex } : { kind: "unknown" };
    }
    return { kind: "unknown" };
}

/**
 * A resolved paint channel (a shape's Fill / Stroke, a span's Text Color /
 * Highlight) → its swatch, from the two halves the engine reports. The **paint**
 * is the folded one: it carries the kind (an explicit no-fill, a solid color, a
 * gradient) and, for a `schemeClr`, the theme slot it tracks. The **color** is
 * that paint's own — the one thing the model can't say for itself — so it is
 * present exactly when the paint agrees on one color, and `reduce` only ever
 * needs it then.
 */
function resolvedPaintDisplay<T>(
    paint: Consensus<T>,
    color: DeviceColor | null | undefined,
    reduce: (paint: T, hex: string | null) => PaintDisplay,
): PaintDisplay {
    if (paint === "absent") return { kind: "unknown" };
    if (paint === "mixed") return { kind: "mixed" };
    return reduce(paint.value, color ? deviceColorHex(color) : null);
}

/** A resolved fill (a shape's, or a text span's), displaying as `hex` → its
 *  swatch. `a:noFill` is `none`; a solid color swatches `hex`; a gradient /
 *  pattern / picture fill has no one color (`unknown`), as does a solid the
 *  engine couldn't resolve. */
function resolvedFillDisplay(fill: PaintFill, hex: string | null): PaintDisplay {
    if (fill === "none") return { kind: "none" };
    if (hex === null || typeof fill !== "object" || !("solid" in fill)) return { kind: "unknown" };
    return resolvedColorDisplay(fill.solid, hex);
}

/** A shape's resolved stroke (`PaintLine | null`), displaying as `hex` → its
 *  swatch. `null` is a resolved *no stroke* (the struck "No Line"), symmetric
 *  with a `Fill::None` fill; a line with no paint of its own still strokes, in
 *  the color the engine reports for it. */
function resolvedStrokeDisplay(line: PaintLine | null, hex: string | null): PaintDisplay {
    if (line === null) return { kind: "none" };
    if (line.fill == null) return hex === null ? { kind: "unknown" } : { kind: "solid", hex };
    return resolvedFillDisplay(line.fill, hex);
}

/** A text span's highlight (`PaintColor | null`), displaying as `hex` → its
 *  swatch. `null` is "no highlight" — a neutral bar, not the struck no-fill (an
 *  un-highlighted span is the normal case, not an explicit clear like a text
 *  `noFill`); a highlight color swatches `hex`, keeping a `schemeClr`'s theme
 *  identity like any other resolved color. */
function resolvedHighlightDisplay(color: PaintColor | null, hex: string | null): PaintDisplay {
    if (color === null || hex === null) return { kind: "unknown" };
    return resolvedColorDisplay(color, hex);
}

/** A resolved solid paint color, displaying as `hex` → its swatch: a `schemeClr`
 *  keeps the slot and transforms it tracks, so the picker can ring the theme
 *  swatch the paint follows rather than just a matching color; any other base is
 *  a plain color. */
function resolvedColorDisplay(color: PaintColor, hex: string): PaintDisplay {
    const base = color.base;
    return "scheme" in base
        ? { kind: "theme", slot: base.scheme, transforms: color.transforms, hex }
        : { kind: "solid", hex };
}

/**
 * Project the engine's {@link UDocSelectionProperties} onto the four color
 * controls' {@link SelectionPaint}. Portable surfaces a path's fill / stroke (its
 * non-stroking / stroking brush); a presentation and a word document report the
 * same drawing properties — a shape's *resolved* fill / stroke (the effective
 * paint the layout composed, after the placeholder / style / theme cascade), be
 * it a slide's shape or a document's drawing, *and* the span color / highlight of
 * a text caret, each with the color it displays as. Every drawing channel reports
 * its color the same way — the model paint (kind + theme identity) alongside the
 * color the engine resolved it to — so a theme-colored span swatches like a
 * theme-colored shape. A channel the selection doesn't reach reflects `unknown`
 * (a neutral swatch), as does no selection.
 */
export function selectionPaint(properties: UDocSelectionProperties | null): SelectionPaint {
    if (properties && "portable" in properties) {
        const p = properties.portable.object;
        return {
            fill: consensusPaint(p.nonstrokingStyle, (s) => portableBrushDisplay(s.brush)),
            stroke: consensusPaint(p.strokingStyle, (s) => portableBrushDisplay(s.brush)),
            text: { kind: "unknown" },
            highlight: { kind: "unknown" },
        };
    }
    const p =
        properties && "presentation" in properties
            ? properties.presentation
            : properties && "wordprocessing" in properties
              ? properties.wordprocessing
              : null;
    if (p) {
        return {
            fill: resolvedPaintDisplay(p.shape.fill, p.shape.fillColor, resolvedFillDisplay),
            stroke: resolvedPaintDisplay(p.shape.line, p.shape.lineColor, resolvedStrokeDisplay),
            text: resolvedPaintDisplay(p.text.fill, p.text.fillColor, resolvedFillDisplay),
            highlight: resolvedPaintDisplay(p.text.highlight, p.text.highlightColor, resolvedHighlightDisplay),
        };
    }
    return EMPTY_SELECTION_PAINT;
}

/**
 * One selection update from the worker: the local selection's geometry, every
 * remote peer's projected selection, the engine's capability verdict for the
 * local selection, and whether the update was caused by a *local* selection
 * mutation (`select` / `clearSelection`) — the host's cue to broadcast
 * presence to peers. Edits, document merges, and presence merges report
 * `localChanged: false`, so a sync listener can't ping-pong (the same contract
 * as `document:edited` vs `merge`).
 */
export interface SelectionState {
    local: SelectionGeometry;
    peers: PeerSelectionGeometry[];
    capabilities: SelectionCapabilities;
    /** The current values of the selection's editable properties (the resolved
     *  text format a text selection carries); `null` with no document open. */
    properties: UDocSelectionProperties | null;
    localChanged: boolean;
}

/**
 * Whether an undo / redo would currently do anything — the input to the host's
 * history-control enablement. Pushed by the worker whenever the edit history may
 * have changed (open, any committing edit, undo, redo, merge); see the worker's
 * `history` report. Both false with no document open.
 */
export interface HistoryState {
    canUndo: boolean;
    canRedo: boolean;
}

/**
 * One painted frame's page geometry plus the view state that produced it,
 * streamed from the worker after every painted frame.
 *
 * `views`/`scale` drive the HTML overlay layer. `scrollSize` and `scroll`
 * are the engine's *authoritative* values: with screen-fixed (px) page
 * spacing the content extent — and, across a re-arrangement, the clamped
 * scroll — depend on zoom in ways the main thread can't derive, so the
 * shell adopts them from here instead. `fresh` is true when the frame
 * reflects the latest viewport this client sent — only then is adopting safe
 * (a stale frame would yank the view back under rapid input).
 */
// The guide chrome (`Guide` and its `RulerAxis` / `RulerText` / `HeaderCell`,
// with the per-kind `HeaderGuide` arm) is re-exported from the
// schema at the top of this file — the `core::viewer` types, reused directly.
// The viewer projects a header's tracks and a ruler's origins in device px
// (origin at the content pane's top-left); the wasm boundary divides by the
// dpr, so they reach the frame in **CSS px**, where a track's `start` still
// aligns with the gridline painted at the same x. What a ruler measures is
// points from its origin, which the frame's `scale` places.

/** Which scrollbars show, one per axis — the engine's `Scrollbars`. */
export interface Scrollbars {
    /** The horizontal bar, along the bottom edge: the view scrolls along x. */
    x: boolean;
    /** The vertical bar, along the right edge: the view scrolls along y. */
    y: boolean;
}

export interface PageViewsFrame {
    views: PageView[];
    /** CSS px per document point for this frame (the zoom that painted it). */
    scale: number;
    /** Authoritative content extent, document points. */
    scrollSize: Size;
    /** Used content size the scrollbar is drawn from, document points — the
     *  scroll extent for most doc types, a spreadsheet's data range otherwise. */
    scrollUsedSize: Size;
    /** The scrollbars this frame kept a strip clear for, where the engine keeps
     *  one (see the profile's `scrollbarGutters`). */
    scrollbars: Scrollbars;
    /** Authoritative (clamped/anchored) scroll, document points. */
    scroll: { x: number; y: number };
    /**
     * 0-based index of the engine's current page, the one the page indicator
     * shows, or `null` when no page is arranged.
     */
    currentPage: number | null;
    /** The plane this frame shows — a spreadsheet's sheet, 0-based; `0` for a
     *  single-plane doc type. */
    plane: number;
    /** The guide chrome (ruler / row-column headers) to draw this frame, already
     *  scroll-resolved to CSS px, or `null` for a doc type with no chrome. Pulled
     *  each painted frame beside the view state, so the bands track scroll/zoom. */
    guide: Guide | null;
    /**
     * The viewport region (CSS px, canvas-relative) this frame repainted — the
     * compositor's dirty window, after the scroll-blit and any full-repaint
     * promotion. `null` on a frame that painted nothing, so a consumer that
     * wants the box to stay on screen holds the last non-null one. Drawn only
     * by the developer repaint-area overlay.
     */
    repaintArea: Rect | null;
    /** Whether this frame reflects the latest viewport sent by this client. */
    fresh: boolean;
}

/**
 * What the engine should paint: a window into document space plus the output
 * surface metrics. The canvas is pinned to the viewport (synthetic scroll), so
 * `scrollX/scrollY` are a document-space offset, not DOM scroll.
 */
export interface Viewport {
    /** Document-space offset of the top-left of the visible window. */
    scrollX: number;
    scrollY: number;
    /** Faithful zoom; 1 == 100% (1 document pt → 96/72 CSS px). */
    zoom: number;
    /** Device pixel ratio (CSS px → device px). */
    dpr: number;
    /** Visible canvas size in CSS px. */
    width: number;
    height: number;
}
