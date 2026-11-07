// The shape gallery on a deck's slides and over an image's pages:
// every preset shape the engine draws, grouped as PowerPoint's gallery groups
// them, with the arrowed lines it offers beside its connectors. A PDF keeps its
// four page-object shapes (see `insert.ts`). The Shape tab's Change Shape offers
// it too, without the lines.
import type { ShapePresetGeometryType } from "@docmentis/udoc-wasm";
import type { PickerSection } from "@docmentis/udoc-ui/internal";
import { en } from "./i18n/en.js";
import type { MessageKey } from "./i18n/index.js";
import { SHAPE_ICONS } from "./shape-icons.js";

/** The ends of a line it draws an arrowhead at: where the drag ended, or both. */
export type LineArrows = "end" | "both";

/**
 * The gallery's groups in order, each its shapes in order: a preset by its own
 * name, or a line drawn with arrowheads as `[tool, preset, arrows]`. A preset's
 * mirror image the drag already draws is left out — `lineInv` is `line` dragged
 * the other way.
 */
const GALLERY = {
    lines: [
        "line",
        ["lineArrow", "straightConnector1", "end"],
        ["lineDoubleArrow", "straightConnector1", "both"],
        "bentConnector3",
        ["bentConnector3Arrow", "bentConnector3", "end"],
        ["bentConnector3DoubleArrow", "bentConnector3", "both"],
        "curvedConnector3",
        ["curvedConnector3Arrow", "curvedConnector3", "end"],
        ["curvedConnector3DoubleArrow", "curvedConnector3", "both"],
        "bentConnector2",
        "bentConnector4",
        "bentConnector5",
        "curvedConnector2",
        "curvedConnector4",
        "curvedConnector5",
    ],
    rectangles: [
        "rect",
        "roundRect",
        "snip1Rect",
        "snip2SameRect",
        "snip2DiagRect",
        "snipRoundRect",
        "round1Rect",
        "round2SameRect",
        "round2DiagRect",
    ],
    basicShapes: [
        "ellipse",
        "triangle",
        "rtTriangle",
        "parallelogram",
        "trapezoid",
        "nonIsoscelesTrapezoid",
        "diamond",
        "pentagon",
        "hexagon",
        "heptagon",
        "octagon",
        "decagon",
        "dodecagon",
        "pie",
        "pieWedge",
        "chord",
        "teardrop",
        "frame",
        "halfFrame",
        "corner",
        "diagStripe",
        "plus",
        "plaque",
        "can",
        "cube",
        "bevel",
        "donut",
        "noSmoking",
        "blockArc",
        "foldedCorner",
        "smileyFace",
        "heart",
        "lightningBolt",
        "sun",
        "moon",
        "cloud",
        "arc",
        "bracketPair",
        "bracePair",
        "leftBracket",
        "rightBracket",
        "leftBrace",
        "rightBrace",
        "gear6",
        "gear9",
        "funnel",
        "cornerTabs",
        "squareTabs",
        "plaqueTabs",
        "chartX",
        "chartStar",
        "chartPlus",
    ],
    blockArrows: [
        "rightArrow",
        "leftArrow",
        "upArrow",
        "downArrow",
        "leftRightArrow",
        "upDownArrow",
        "quadArrow",
        "leftRightUpArrow",
        "bentArrow",
        "uTurnArrow",
        "leftUpArrow",
        "bentUpArrow",
        "curvedRightArrow",
        "curvedLeftArrow",
        "curvedUpArrow",
        "curvedDownArrow",
        "stripedRightArrow",
        "notchedRightArrow",
        "homePlate",
        "chevron",
        "rightArrowCallout",
        "downArrowCallout",
        "leftArrowCallout",
        "upArrowCallout",
        "leftRightArrowCallout",
        "upDownArrowCallout",
        "quadArrowCallout",
        "circularArrow",
        "leftCircularArrow",
        "leftRightCircularArrow",
        "swooshArrow",
    ],
    equationShapes: ["mathPlus", "mathMinus", "mathMultiply", "mathDivide", "mathEqual", "mathNotEqual"],
    flowchart: [
        "flowChartProcess",
        "flowChartAlternateProcess",
        "flowChartDecision",
        "flowChartInputOutput",
        "flowChartPredefinedProcess",
        "flowChartInternalStorage",
        "flowChartDocument",
        "flowChartMultidocument",
        "flowChartTerminator",
        "flowChartPreparation",
        "flowChartManualInput",
        "flowChartManualOperation",
        "flowChartConnector",
        "flowChartOffpageConnector",
        "flowChartPunchedCard",
        "flowChartPunchedTape",
        "flowChartSummingJunction",
        "flowChartOr",
        "flowChartCollate",
        "flowChartSort",
        "flowChartExtract",
        "flowChartMerge",
        "flowChartOnlineStorage",
        "flowChartOfflineStorage",
        "flowChartDelay",
        "flowChartMagneticTape",
        "flowChartMagneticDisk",
        "flowChartMagneticDrum",
        "flowChartDisplay",
    ],
    starsAndBanners: [
        "irregularSeal1",
        "irregularSeal2",
        "star4",
        "star5",
        "star6",
        "star7",
        "star8",
        "star10",
        "star12",
        "star16",
        "star24",
        "star32",
        "ribbon2",
        "ribbon",
        "ellipseRibbon2",
        "ellipseRibbon",
        "leftRightRibbon",
        "verticalScroll",
        "horizontalScroll",
        "wave",
        "doubleWave",
    ],
    callouts: [
        "wedgeRectCallout",
        "wedgeRoundRectCallout",
        "wedgeEllipseCallout",
        "cloudCallout",
        "borderCallout1",
        "borderCallout2",
        "borderCallout3",
        "accentCallout1",
        "accentCallout2",
        "accentCallout3",
        "callout1",
        "callout2",
        "callout3",
        "accentBorderCallout1",
        "accentBorderCallout2",
        "accentBorderCallout3",
    ],
    actionButtons: [
        "actionButtonBackPrevious",
        "actionButtonForwardNext",
        "actionButtonBeginning",
        "actionButtonEnd",
        "actionButtonHome",
        "actionButtonInformation",
        "actionButtonReturn",
        "actionButtonMovie",
        "actionButtonDocument",
        "actionButtonSound",
        "actionButtonHelp",
        "actionButtonBlank",
    ],
} as const satisfies Readonly<
    Record<string, readonly (ShapePresetGeometryType | readonly [string, ShapePresetGeometryType, LineArrows])[]>
>;

/** A group of the gallery's, under its heading. */
export type ShapeGroup = keyof typeof GALLERY;

type GalleryEntry = (typeof GALLERY)[ShapeGroup][number];

/** A tool of the gallery's: the shape it places. */
export type ShapeTool = Extract<GalleryEntry, string> | Extract<GalleryEntry, readonly unknown[]>[0];

/** A preset the engine draws that the gallery leaves out but `lineInv`. */
type Unoffered = Exclude<
    ShapePresetGeometryType,
    "lineInv" | Extract<GalleryEntry, string> | Extract<GalleryEntry, readonly unknown[]>[1]
>;

/** Compiles only for `never`. */
type None<T extends never> = T;

/** That the gallery offers every preset the engine draws but `lineInv`: one a
 *  newer engine adds fails to compile here until the gallery has it, with its
 *  name and its icon. */
export type OffersEveryPreset = None<Unoffered>;

/** The presets that are lines — a connector on a slide, never filled and
 *  holding no text, drawn from the drag's start to its end. */
const LINES: ReadonlySet<ShapePresetGeometryType> = new Set<ShapePresetGeometryType>([
    "line",
    "straightConnector1",
    "bentConnector2",
    "bentConnector3",
    "bentConnector4",
    "bentConnector5",
    "curvedConnector2",
    "curvedConnector3",
    "curvedConnector4",
    "curvedConnector5",
]);

/** The presets that are an open outline — an arc, a bracket or a brace —
 *  styled as a line is, though they are shapes that hold text. */
const OUTLINES: ReadonlySet<ShapePresetGeometryType> = new Set<ShapePresetGeometryType>([
    "arc",
    "leftBracket",
    "rightBracket",
    "leftBrace",
    "rightBrace",
    "bracketPair",
    "bracePair",
]);

/** The ids of a node built only to preview it, which never reaches the document:
 *  the node's, and its text's story's. */
export const PREVIEW_NODE_ID = "0-1";
export const PREVIEW_STORY_ID = "0-2";

/** A shape the gallery places. */
export interface GalleryShape {
    /** The preset it draws. */
    readonly preset: ShapePresetGeometryType;
    /** Whether it is a line: drawn from the drag's start to its end, unfilled,
     *  with no text. */
    readonly line: boolean;
    /** Whether it is an open outline — an arc, a bracket — styled as a line. */
    readonly outline: boolean;
    /** The ends a line draws arrowheads at, or null for none. */
    readonly arrows: LineArrows | null;
    /** Its name in the document, in English as PowerPoint names a shape. */
    readonly name: string;
}

/** Each of the gallery's shapes, by its tool. */
const SHAPES: ReadonlyMap<string, GalleryShape> = new Map(
    Object.values(GALLERY)
        .flat()
        .map((entry): [ShapeTool, GalleryShape] => {
            const [tool, preset, arrows] = typeof entry === "string" ? [entry, entry, null] : entry;
            const line = LINES.has(preset);
            return [tool, { preset, line, outline: OUTLINES.has(preset), arrows, name: en[`shapeName.${tool}`] }];
        }),
);

/** The gallery shape `tool` places, or null for a tool not the gallery's. */
export function galleryShape(tool: string): GalleryShape | null {
    return SHAPES.get(tool) ?? null;
}

/** The gallery as the Shapes picker shows it: a section per group,
 *  a cell per shape. */
export const SHAPE_GALLERY: readonly PickerSection<MessageKey>[] = Object.entries(GALLERY).map(([group, entries]) => ({
    label: `shapeGroup.${group as ShapeGroup}`,
    options: entries.map((entry) => {
        const tool: ShapeTool = typeof entry === "string" ? entry : entry[0];
        return {
            tool: { kind: "extension", tool },
            icon: SHAPE_ICONS[tool],
            label: `shapeName.${tool}`,
        } satisfies PickerSection<MessageKey>["options"][number];
    }),
}));

/** The gallery as the Shape tab's Change Shape shows it: all but the lines, as
 *  PowerPoint's does — a connector is drawn from end to end, not across a box. */
export const CHANGE_SHAPE_GALLERY: readonly PickerSection<MessageKey>[] = SHAPE_GALLERY.filter(
    (section) => section.label !== "shapeGroup.lines",
);
