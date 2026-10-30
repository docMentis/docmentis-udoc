// The shapes the Insert tab draws over an image's pages: a markup's outline,
// in red and unfilled so the image shows through, at a weight that reads at the
// page's size, and a box's room for a label. Pure — `image.ts` places what
// this builds.
import type { PaintColor, PaintLine, ShapeNode, ShapePresetGeometryType, TextBody } from "@docmentis/udoc-wasm";
import type { ShapeKind, ShapePoint } from "@docmentis/udoc-ui/internal";

/** The color shapes are drawn over an image in — a markup red. An image has
 *  no theme, so it is an sRGB color, never a scheme one. */
const MARKUP_COLOR: PaintColor = { base: { sRgb: { r: 0xe5, g: 0x39, b: 0x35 } }, transforms: [] };

/** The page size, in points, one point of line weight is drawn per — so a
 *  shape's outline reads at the page's size, a photo's as a screenshot's. */
const POINTS_PER_LINE_POINT = 250;

/** The thinnest line a shape is drawn with, in points. */
const MIN_LINE_WEIGHT = 2;

/** The page size, in points, one point of a label's size is set per. */
const POINTS_PER_TEXT_POINT = 30;

/** The smallest a label is set, in points. */
const MIN_TEXT_SIZE = 12;

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

/** Each shape the Insert tab draws: its preset outline, its name, and whether
 *  it is a box, which takes a label. */
const MARKUP_SHAPES: Record<ShapeKind, { preset: ShapePresetGeometryType; name: string; box: boolean }> = {
    rectangle: { preset: "rect", name: "Rectangle", box: true },
    ellipse: { preset: "ellipse", name: "Oval", box: true },
    line: { preset: "line", name: "Line", box: false },
    arrow: { preset: "line", name: "Arrow", box: false },
};

/** A box's text body, empty: one paragraph centred in it, which the text typed
 *  into it takes the markup color and `size` points from — what a press in the
 *  box lands a caret in, as in a slide's shape. Its story is `story`. */
function labelBody(story: string, size: number): TextBody {
    return {
        properties: { anchor: "center" },
        story: {
            id: story,
            blocks: [
                {
                    paragraph: {
                        properties: [{ align: "center" }],
                        end: { mark: [{ size }, { fill: { solid: MARKUP_COLOR } }] },
                        spans: [],
                    },
                },
            ],
        },
    };
}

/**
 * The drawing shape `shape` spanning `p0 → p1` (the page's points) over a
 * page `page` points in size, its id `id` and a box's text story `story` —
 * outlined in {@link MARKUP_COLOR} and unfilled, so the image shows through;
 * an arrow's head at `p1`; a box with an empty label to type into. A line runs
 * from `p0` to `p1` by flipping the box its preset runs corner to corner
 * across; a box is never flipped, as a flip turns its label upside down.
 */
export function markupShape(
    id: string,
    story: string,
    shape: ShapeKind,
    p0: ShapePoint,
    p1: ShapePoint,
    page: { width: number; height: number },
): ShapeNode {
    const { preset, name, box } = MARKUP_SHAPES[shape];
    const line: PaintLine = {
        width: markupLineWeight(page.width, page.height),
        cap: "round",
        compound: null,
        align: null,
        fill: { solid: MARKUP_COLOR },
        dash: null,
        join: "round",
        headEnd: null,
        tailEnd: shape === "arrow" ? { kind: "triangle", width: "medium", length: "medium" } : null,
    };
    return {
        shape: {
            id,
            nonVisual: { name, description: null, title: null, hidden: false, placeholder: null },
            properties: {
                transform: {
                    offset: { x: Math.min(p0.x, p1.x), y: Math.min(p0.y, p1.y) },
                    extents: { width: Math.abs(p1.x - p0.x), height: Math.abs(p1.y - p0.y) },
                    rotation: 0,
                    flipH: !box && p1.x < p0.x,
                    flipV: !box && p1.y < p0.y,
                },
                geometry: { preset: { preset, adjustValues: [] } },
                fill: "none",
                line,
                effects: null,
                scene3d: null,
                shape3d: null,
            },
            style: null,
            textBody: box ? labelBody(story, markupTextSize(page.width, page.height)) : null,
            textTransform: null,
            diagramPoint: null,
        },
    };
}
