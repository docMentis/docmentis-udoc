// The shapes the Image tab draws over an image's pages: a shape in the paint it's
// given, with an outline at a weight that reads at the page's size and a box's room
// for a label, a text box, and a table. Pure — `image.ts` places what this builds.
import type {
    PaintColor,
    PaintFill,
    PaintLine,
    PaintLineEnd,
    ShapeNode,
    ShapeSelection,
    TableCell,
    TablePartStyle,
    TableRow,
    TableStyle,
    TableThemeableLine,
    TextBody,
} from "@docmentis/udoc-wasm";
import type { ShapePoint } from "@docmentis/udoc-ui/internal";
import type { GalleryShape } from "./shape-gallery.js";
import type { TableSize } from "./table-picker.js";

/** What a shape is drawn over an image in. An image has no theme, so these are
 *  never scheme colors. */
export interface MarkupPaint {
    readonly fill: PaintFill;
    readonly line: PaintFill;
    /** A box's label's. */
    readonly text: PaintColor;
}

/** The page size, in points, one point of line weight is drawn per — so a
 *  shape's outline reads at the page's size, a photo's as a screenshot's. */
const POINTS_PER_LINE_POINT = 250;

/** The thinnest line a shape is drawn with, in points. */
const MIN_LINE_WEIGHT = 2;

/** The page size, in points, one point of a label's size is set per. */
const POINTS_PER_TEXT_POINT = 30;

/** The smallest a label is set, in points. */
const MIN_TEXT_SIZE = 12;

/** The least a text box spans across and down, in multiples of its text's size:
 *  room for a word or two, on a line. A box dropped with a click is sized in
 *  points, which on a large image is too narrow for one letter a line. */
const TEXT_BOX_MIN_WIDTH = 6;
const TEXT_BOX_MIN_HEIGHT = 1.5;

/** The weight in points a shape is outlined at over a page `width` ×
 *  `height` points: a point per {@link POINTS_PER_LINE_POINT} of its shorter
 *  side, and at least {@link MIN_LINE_WEIGHT}. */
export function markupLineWeight(width: number, height: number): number {
    return Math.max(MIN_LINE_WEIGHT, Math.round(Math.min(width, height) / POINTS_PER_LINE_POINT));
}

/** The size in points a label typed into a box is set at over a page `width`
 *  × `height` points: a point per {@link POINTS_PER_TEXT_POINT} of its shorter
 *  side, and at least {@link MIN_TEXT_SIZE}. */
export function markupTextSize(width: number, height: number): number {
    return Math.max(MIN_TEXT_SIZE, Math.round(Math.min(width, height) / POINTS_PER_TEXT_POINT));
}

/** An arrowhead at a line's end. */
const ARROWHEAD: PaintLineEnd = { kind: "triangle", width: "medium", length: "medium" };

/** A box's text body, empty: one paragraph centred in it, which the text typed
 *  into it takes `color` and `size` points from — what a press in the box lands a
 *  caret in, as in a slide's shape. Its story is `story`. */
function labelBody(story: string, size: number, color: PaintColor): TextBody {
    return {
        properties: { anchor: "center" },
        story: {
            id: story,
            blocks: [
                {
                    paragraph: {
                        properties: { props: [{ align: "center" }] },
                        end: { mark: { properties: { props: [{ size }, { fill: { solid: color } }] } } },
                        spans: [],
                    },
                },
            ],
        },
    };
}

/**
 * A text box across the box of `p0` and `p1` (the page's points) over a page
 * `page` points in size, its id `id`: a rectangle with no fill or outline, holding
 * `text` in the story `story`, wrapped at its width, in `color` and at the size of
 * a label. It spans at least {@link TEXT_BOX_MIN_WIDTH} ×
 * {@link TEXT_BOX_MIN_HEIGHT} of that size, moved back onto the page where that
 * takes it past the edge.
 */
export function markupTextBox(
    id: string,
    story: string,
    text: string,
    p0: ShapePoint,
    p1: ShapePoint,
    page: { width: number; height: number },
    color: PaintColor,
): ShapeNode {
    const size = markupTextSize(page.width, page.height);
    const properties = { props: [{ size }, { fill: { solid: color } }] };
    const width = Math.max(Math.abs(p1.x - p0.x), size * TEXT_BOX_MIN_WIDTH);
    const height = Math.max(Math.abs(p1.y - p0.y), size * TEXT_BOX_MIN_HEIGHT);
    return {
        shape: {
            id,
            nonVisual: { name: "TextBox", description: null, title: null, hidden: false, placeholder: null },
            properties: {
                transform: {
                    offset: {
                        x: Math.max(0, Math.min(Math.min(p0.x, p1.x), page.width - width)),
                        y: Math.max(0, Math.min(Math.min(p0.y, p1.y), page.height - height)),
                    },
                    extents: { width, height },
                    rotation: 0,
                    flipH: false,
                    flipV: false,
                },
                geometry: { preset: { preset: "rect", adjustValues: [] } },
                fill: "none",
                line: null,
                effects: null,
                scene3d: null,
                shape3d: null,
            },
            style: null,
            textBody: {
                properties: { wrap: "square" },
                story: {
                    id: story,
                    blocks: [
                        {
                            paragraph: {
                                properties: { props: [] },
                                end: { mark: { properties } },
                                spans: [{ regular: { properties, text } }],
                            },
                        },
                    ],
                },
            },
            textTransform: null,
            diagramPoint: null,
        },
    };
}

/**
 * The drawing shape `shape` spanning `p0 → p1` (the page's points) over a
 * page `page` points in size, its id `id` and a box's text story `story` —
 * in `paint`, a line and an open outline taking no fill; an arrowed line's head at
 * `p1`, and at `p0` too for a double arrow; any shape but a line a box, with an
 * empty label to type into. A line runs from
 * `p0` to `p1` by flipping the box its preset runs corner to corner across; a
 * box is never flipped, as a flip turns its label upside down.
 */
export function markupShape(
    id: string,
    story: string,
    shape: GalleryShape,
    p0: ShapePoint,
    p1: ShapePoint,
    page: { width: number; height: number },
    paint: MarkupPaint,
): ShapeNode {
    const box = !shape.line;
    const line: PaintLine = {
        width: markupLineWeight(page.width, page.height),
        cap: "round",
        compound: null,
        align: null,
        fill: paint.line,
        dash: null,
        join: "round",
        headEnd: shape.arrows === "both" ? ARROWHEAD : null,
        tailEnd: shape.arrows ? ARROWHEAD : null,
    };
    return {
        shape: {
            id,
            nonVisual: { name: shape.name, description: null, title: null, hidden: false, placeholder: null },
            properties: {
                transform: {
                    offset: { x: Math.min(p0.x, p1.x), y: Math.min(p0.y, p1.y) },
                    extents: { width: Math.abs(p1.x - p0.x), height: Math.abs(p1.y - p0.y) },
                    rotation: 0,
                    flipH: !box && p1.x < p0.x,
                    flipV: !box && p1.y < p0.y,
                },
                geometry: { preset: { preset: shape.preset, adjustValues: [] } },
                fill: box && !shape.outline ? paint.fill : "none",
                line,
                effects: null,
                scene3d: null,
                shape3d: null,
            },
            style: null,
            textBody: box ? labelBody(story, markupTextSize(page.width, page.height), paint.text) : null,
            textTransform: null,
            diagramPoint: null,
        },
    };
}

/** What a table is drawn over an image in: the regions of a deck's default table
 *  style, Medium Style 2, in colors of its own, as an image has no theme. */
export interface MarkupTablePaint {
    /** The header row's fill — and the total row's and the first and last
     *  column's, when the table's look turns them on. */
    readonly accent: PaintColor;
    /** The text on {@link accent}, and the rules between the cells. */
    readonly onAccent: PaintColor;
    /** The body's fill. */
    readonly body: PaintColor;
    /** The fill every other row takes, banded. */
    readonly band: PaintColor;
    /** The body's text. */
    readonly text: PaintColor;
}

/** The size a deck's table sets its text at, which a table over an image scales
 *  every measure of a deck's from: its row height, cell margins and rules. */
const DECK_TABLE_TEXT_SIZE = 18;

/** A deck's new table's row height, in points: `PowerPoint`'s 370840 EMU, a
 *  minimum. */
const DECK_ROW_HEIGHT = 29.2;

/** A deck's cell margins, in points: the schema's defaults, left and right, then
 *  top and bottom. */
const DECK_MARGIN_SIDE = 7.2;
const DECK_MARGIN_END = 3.6;

/** Medium Style 2's rules, in points: between all the cells, and the heavier one
 *  under the header row and over the total row. */
const DECK_RULE = 1;
const DECK_HEADER_RULE = 3;

/** How much of the page's width a new table spans, as a deck's does of its slide. */
const TABLE_WIDTH_SHARE = 2 / 3;

/** The id of the style a table over an image carries inline. A deck's inline
 *  `a:tblStyle` is named by a GUID; this one is docMentis's own. */
const MARKUP_TABLE_STYLE_ID = "{8EAE1DE5-23EC-47FE-95E1-36B4BED9CE17}";

/** How many ids {@link markupTable} mints for a table of `size`: its frame, the
 *  table, each column and row, and each cell's text story. */
export function markupTableIds(size: TableSize): number {
    return 2 + size.columns + size.rows * (1 + size.columns);
}

/** A solid rule `width` points wide in `color`, as a table style draws it. */
function rule(width: number, color: PaintColor): TableThemeableLine {
    return {
        literal: {
            width,
            cap: null,
            compound: null,
            align: null,
            fill: { solid: color },
            dash: null,
            join: null,
            headEnd: null,
            tailEnd: null,
        },
    };
}

/**
 * Medium Style 2 in `paint`, its rules scaled by `scale`: the body in
 * {@link MarkupTablePaint.body} under its text, every cell ruled off in
 * {@link MarkupTablePaint.onAccent}, banded rows and columns in
 * {@link MarkupTablePaint.band}, and the header and total rows and the first and
 * last columns in bold on {@link MarkupTablePaint.accent} — the header ruled off
 * below it and the total above, more heavily.
 */
function markupTableStyle(paint: MarkupTablePaint, scale: number): TableStyle {
    const inner = rule(DECK_RULE * scale, paint.onAccent);
    const heavy = rule(DECK_HEADER_RULE * scale, paint.onAccent);
    const band: TablePartStyle = { cellStyle: { fill: { literal: { solid: paint.band } } } };
    const accent = (borders: TablePartStyle["cellStyle"] = {}): TablePartStyle => ({
        character: { props: [{ bold: true }, { fill: { solid: paint.onAccent } }] },
        cellStyle: { ...borders, fill: { literal: { solid: paint.accent } } },
    });
    return {
        id: MARKUP_TABLE_STYLE_ID,
        parts: {
            wholeTable: {
                character: { props: [{ fill: { solid: paint.text } }] },
                cellStyle: {
                    borders: {
                        left: inner,
                        right: inner,
                        top: inner,
                        bottom: inner,
                        insideHorizontal: inner,
                        insideVertical: inner,
                    },
                    fill: { literal: { solid: paint.body } },
                },
            },
            band1Horizontal: band,
            band1Vertical: band,
            firstRow: accent({ borders: { bottom: heavy } }),
            lastRow: accent({ borders: { top: heavy } }),
            firstColumn: accent(),
            lastColumn: accent(),
        },
    };
}

/**
 * A table of `size` over a page `page` points in size, as a deck's Insert Table
 * places one on its slide: two thirds of the page wide and centred on it, its
 * columns alike, its header row and banded rows on — but in `paint` rather than
 * the deck's theme, which an image has none of, and at the size of a label rather
 * than a slide's 18 points, its rows, margins and rules scaled along. A table too
 * tall for the page starts at its top. Its ids are `mint`'s, in the order
 * {@link markupTableIds} counts them. With it, the caret in its first cell.
 */
export function markupTable(
    mint: () => string,
    size: TableSize,
    page: { width: number; height: number },
    paint: MarkupTablePaint,
): { node: ShapeNode; caret: ShapeSelection } {
    const textSize = markupTextSize(page.width, page.height);
    const scale = textSize / DECK_TABLE_TEXT_SIZE;
    const width = page.width * TABLE_WIDTH_SHARE;
    const rowHeight = DECK_ROW_HEIGHT * scale;
    const height = rowHeight * size.rows;
    const side = DECK_MARGIN_SIDE * scale;
    const end = DECK_MARGIN_END * scale;
    const frame = mint();
    const table = mint();
    const columns = Array.from({ length: size.columns }, () => ({ id: mint(), width: width / size.columns }));
    const stories: string[] = [];
    const rows: TableRow[] = Array.from({ length: size.rows }, () => {
        const id = mint();
        const cells = columns.map((): TableCell => {
            const story = mint();
            stories.push(story);
            return {
                regular: {
                    properties: { margins: { top: end, bottom: end, left: side, right: side } },
                    body: {
                        properties: {},
                        story: {
                            id: story,
                            blocks: [
                                {
                                    paragraph: {
                                        properties: { props: [] },
                                        end: { mark: { properties: { props: [{ size: textSize }] } } },
                                        spans: [],
                                    },
                                },
                            ],
                        },
                    },
                },
            };
        });
        return { regular: { id, properties: { height: { atLeast: rowHeight } }, cells } };
    });
    const node: ShapeNode = {
        graphicFrame: {
            id: frame,
            nonVisual: { name: "Table", description: null, title: null, hidden: false, placeholder: null },
            transform: {
                offset: { x: (page.width - width) / 2, y: Math.max(0, (page.height - height) / 2) },
                extents: { width, height },
                rotation: 0,
                flipH: false,
                flipV: false,
            },
            graphic: {
                table: {
                    id: table,
                    properties: {
                        style: { inline: markupTableStyle(paint, scale) },
                        look: {
                            firstRow: true,
                            lastRow: false,
                            firstColumn: false,
                            lastColumn: false,
                            rowBanding: true,
                            columnBanding: false,
                        },
                    },
                    columns,
                    rows,
                },
            },
        },
    };
    const first = rows[0];
    const cell = {
        row: first && "regular" in first ? first.regular.id : "",
        column: columns[0]?.id ?? "",
    };
    const caret: ShapeSelection = {
        shapeTable: [
            frame,
            { cellText: { table, cell, text: { range: { story: stories[0] ?? "", anchor: 0, focus: 0 } } } },
        ],
    };
    return { node, caret };
}
