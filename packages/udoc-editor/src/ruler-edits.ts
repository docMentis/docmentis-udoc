// What a drop on the ruler means to the open document — the selection edit it
// sends. The engine projects the ruler and takes the edit; what a ruler control
// is, and what moving one means, is the editor's, read off the guide that
// placed the control and the selection's properties: the indents, the tab
// stops and the text insets the drop moves from. A ruler point is taken for a
// model point, which holds everywhere but for text in a scaled group.
import type {
    Consensus,
    Guide,
    Rect,
    TextBodyProperties,
    TextParagraphProperty,
    TextTabStop,
    UDocSelectionProperties,
    UDocType,
} from "@docmentis/udoc-wasm";
import type { SelectionCapabilities, SelectionEdit } from "@docmentis/udoc-ui/internal";
import type { RulerControl, RulerDrop, RulerEdge, RulerIndent } from "./ruler-controls.js";

/** The ruler arm of the engine's guide projection. */
type RulerGuide = Extract<Guide, { type: "ruler" }>;

/** What a ruler drop moves from: the selection's resolved indents and tab
 *  stops, and the text insets of the shape it is in, each `null` where the
 *  selection holds none or its paragraphs or shapes disagree. */
export interface SelectionRuler {
    readonly indentLeft: number | null;
    readonly indentRight: number | null;
    readonly indentFirstLine: number | null;
    readonly tabStops: readonly TextTabStop[] | null;
    readonly insetLeft: number | null;
    readonly insetTop: number | null;
    readonly insetRight: number | null;
    readonly insetBottom: number | null;
}

/** A selection a ruler drop moves nothing from. */
export const EMPTY_SELECTION_RULER: SelectionRuler = {
    indentLeft: null,
    indentRight: null,
    indentFirstLine: null,
    tabStops: null,
    insetLeft: null,
    insetTop: null,
    insetRight: null,
    insetBottom: null,
};

/** The value `consensus` agrees on, or `null` for none. */
function agreed<T>(consensus: Consensus<T>): T | null {
    return typeof consensus === "object" ? consensus.value : null;
}

/** Project the engine's selection `properties` onto what a ruler drop moves
 *  from. The office doc types carry the text and shape reads alike; any other
 *  moves nothing. */
export function selectionRuler(properties: UDocSelectionProperties | null): SelectionRuler {
    const common =
        properties && "presentation" in properties
            ? properties.presentation
            : properties && "wordprocessing" in properties
              ? properties.wordprocessing
              : null;
    if (!common) return EMPTY_SELECTION_RULER;
    const { text, shape } = common;
    return {
        indentLeft: agreed(text.indentLeft),
        indentRight: agreed(text.indentRight),
        indentFirstLine: agreed(text.indentFirstLine),
        tabStops: agreed(text.tabStops),
        insetLeft: agreed(shape.insetLeft),
        insetTop: agreed(shape.insetTop),
        insetRight: agreed(shape.insetRight),
        insetBottom: agreed(shape.insetBottom),
    };
}

/** The gate a margin edge's edit goes by, for the doc types that take one. */
const MARGIN_GATES: Partial<Record<UDocType, string>> = {
    wordprocessing: "setSectionPageMargins",
    presentation: "setShapeTextBodyProperties",
    portable: "resizeTextBox",
};

/** Whether `control` takes a drag on `docType` now — the engine gates the edit
 *  it would send, and the selection has the values it moves from. */
export function rulerMovable(
    control: RulerControl,
    guide: RulerGuide,
    docType: UDocType,
    caps: SelectionCapabilities,
    ruler: SelectionRuler,
): boolean {
    const gate = control.kind === "margin" ? MARGIN_GATES[docType] : "setParagraphProperties";
    return (
        gate !== undefined &&
        caps.allowed.includes(gate) &&
        rulerEdit({ control, by: 0 }, guide, docType, ruler) !== null
    );
}

/**
 * The selection edit `drop` sends on `docType` — its control moved `by` points
 * along its ruler — or `null` where it means none: an indent or a tab moves
 * the paragraphs' own, a margin edge a Word section's page margin, a shape's
 * text inset or a PDF text box's side.
 */
export function rulerEdit(
    drop: RulerDrop,
    guide: RulerGuide,
    docType: UDocType,
    ruler: SelectionRuler,
): SelectionEdit | null {
    const { control, by } = drop;
    switch (control.kind) {
        case "indent": {
            const properties = indentProperties(control.indent, by, ruler);
            return properties && { kind: "setParagraphProperties", properties };
        }
        case "tab": {
            const stops = movedTabStops(control.index, by, docType, ruler);
            return stops && { kind: "setParagraphProperties", properties: [{ tabStops: stops }] };
        }
        case "margin":
            return marginEdit(control.edge, by, guide, docType, ruler);
    }
}

/** The indents a drag of `indent` by `by` sets, as Word's ruler moves them:
 *  the first line alone; the hanging indent's lines with the first line
 *  staying put; the left indent's box both; the right indent from the right. */
function indentProperties(indent: RulerIndent, by: number, ruler: SelectionRuler): TextParagraphProperty[] | null {
    const { indentLeft, indentRight, indentFirstLine } = ruler;
    switch (indent) {
        case "firstLine":
            return indentFirstLine === null ? null : [{ indentFirstLine: indentFirstLine + by }];
        case "hanging":
            return indentLeft === null || indentFirstLine === null
                ? null
                : [{ indentLeft: indentLeft + by }, { indentFirstLine: indentFirstLine - by }];
        case "left":
            return indentLeft === null ? null : [{ indentLeft: indentLeft + by }];
        case "right":
            return indentRight === null ? null : [{ indentRight: indentRight - by }];
    }
}

/** The paragraphs' tab stops with stop `index` — counted as the ruler shows
 *  them, `clear` entries skipped — moved `by`. Word merges a paragraph's stops
 *  with its style's, so there a stop moved off a position is cleared at it,
 *  which a slide's list, written whole, has no need of. */
function movedTabStops(index: number, by: number, docType: UDocType, ruler: SelectionRuler): TextTabStop[] | null {
    const { tabStops } = ruler;
    const moved = tabStops?.filter((stop) => stop.alignment !== "clear")[index];
    if (!tabStops || !moved) return null;
    const stops = tabStops.map((stop) => (stop === moved ? { ...stop, position: stop.position + by } : stop));
    if (docType === "wordprocessing" && by !== 0 && !stops.some((stop) => stop.position === moved.position)) {
        stops.push({ position: moved.position, alignment: "clear", leader: "none" });
    }
    return stops.sort((a, b) => a.position - b.position);
}

/** The insets each margin edge sets. */
const INSET_KEYS = {
    left: "insetLeft",
    top: "insetTop",
    right: "insetRight",
    bottom: "insetBottom",
} as const satisfies Record<RulerEdge, keyof TextBodyProperties & keyof SelectionRuler>;

/** The side of a frame each margin edge sets. */
const FRAME_KEYS = { left: "x0", top: "y0", right: "x1", bottom: "y1" } as const satisfies Record<
    RulerEdge,
    keyof Rect
>;

/** The edit moving margin `edge` by `by`: a Word section's page margin, from
 *  the page's edge to the text area's; a shape's text inset, from the one it
 *  has; a PDF text box's side, the guide's text area moved into page-local
 *  points. A PDF box's height follows its lines, so its bottom takes none. */
function marginEdit(
    edge: RulerEdge,
    by: number,
    guide: RulerGuide,
    docType: UDocType,
    ruler: SelectionRuler,
): SelectionEdit | null {
    const near = edge === "left" || edge === "top";
    const { page, margins } = edge === "left" || edge === "right" ? guide.horizontal : guide.vertical;
    if (!margins) return null;
    switch (docType) {
        case "wordprocessing": {
            const sides: { left?: number; top?: number; right?: number; bottom?: number } = {};
            sides[edge] = near ? margins.start + by - page.start : page.end - (margins.end + by);
            return { kind: "setSectionPageMargins", ...sides };
        }
        case "presentation": {
            const key = INSET_KEYS[edge];
            const inset = ruler[key];
            if (inset === null) return null;
            const properties: TextBodyProperties = {};
            properties[key] = inset + (near ? by : -by);
            return { kind: "setShapeTextBodyProperties", properties };
        }
        case "portable": {
            const { horizontal: h, vertical: v } = guide;
            if (edge === "bottom" || !h.margins || !v.margins) return null;
            const frame: Rect = {
                x0: h.margins.start - h.page.start,
                y0: v.margins.start - v.page.start,
                x1: h.margins.end - h.page.start,
                y1: v.margins.end - v.page.start,
            };
            frame[FRAME_KEYS[edge]] += by;
            return { kind: "object", edit: { kind: "resizeTextBox", frame } };
        }
        default:
            return null;
    }
}
