// The shapes the Insert tab places on a deck's slides: a gallery shape across
// the drag, styled from the deck's theme as PowerPoint styles a shape it
// inserts. Pure — `insert.ts` places what this builds.
import type {
    PaintColor,
    PaintLine,
    PaintLineEnd,
    PaintSchemeColor,
    ShapeNode,
    ShapeNonVisualProperties,
    ShapeProperties,
    ShapeStyle,
    TextBody,
} from "@docmentis/udoc-wasm";
import type { ShapePoint } from "@docmentis/udoc-ui/internal";
import type { GalleryShape } from "./shape-gallery.js";

/** The theme color `scheme`, darkened by `shade` when given (a fraction). */
function scheme(scheme: PaintSchemeColor, shade?: number): PaintColor {
    return { base: { scheme }, transforms: shade === undefined ? [] : [{ shade }] };
}

/** A shape's theme style: filled with the first accent from the style matrix's
 *  subtle fill, outlined in its moderate line in that accent darkened, its text
 *  in the light text color — PowerPoint's for a shape it inserts. */
const SHAPE_STYLE: ShapeStyle = {
    lineRef: { index: 2, color: scheme("accent1", 0.15) },
    fillRef: { index: 1, color: scheme("accent1") },
    effectRef: { index: 0, color: scheme("accent1") },
    fontRef: { index: "minor", color: scheme("light1") },
};

/** A line's theme style, and an open outline's: the style matrix's subtle line
 *  in the first accent, unfilled, its text in the dark text color. */
const LINE_STYLE: ShapeStyle = {
    lineRef: { index: 1, color: scheme("accent1") },
    fillRef: { index: 0, color: scheme("accent1") },
    effectRef: { index: 0, color: scheme("accent1") },
    fontRef: { index: "minor", color: scheme("text1") },
};

/** An arrowhead, sized by the line it ends. */
const ARROWHEAD: PaintLineEnd = { kind: "triangle", width: null, length: null };

/** A line's own outline: its arrowheads alone, the rest from its style. */
function arrowedLine(shape: GalleryShape): PaintLine | null {
    if (!shape.arrows) return null;
    return {
        width: null,
        cap: null,
        compound: null,
        align: null,
        fill: null,
        dash: null,
        join: null,
        headEnd: shape.arrows === "both" ? ARROWHEAD : null,
        tailEnd: ARROWHEAD,
    };
}

/** An empty text body, centred both ways — what a press in the shape lands a
 *  caret in, and what text typed into it fills. Its story is `story`. */
function emptyBody(story: string): TextBody {
    return {
        properties: { anchor: "center" },
        story: { id: story, blocks: [{ paragraph: { properties: [{ align: "center" }], spans: [] } }] },
    };
}

/**
 * The slide shape `shape` spanning `p0 → p1` (the slide's points), its id `id`
 * and its text's story `story`. A line is a connector running from `p0` to
 * `p1`, by flipping the box its preset runs corner to corner across, with its
 * arrowheads at `p1` — and at `p0` too for a double arrow. Anything else spans
 * the box of the two points, unflipped, with an empty text body to type into.
 * Fill, outline and text color come from the theme, through its style.
 */
export function slideShape(id: string, story: string, shape: GalleryShape, p0: ShapePoint, p1: ShapePoint): ShapeNode {
    const nonVisual: ShapeNonVisualProperties = {
        name: shape.name,
        description: null,
        title: null,
        hidden: false,
        placeholder: null,
    };
    const properties: ShapeProperties = {
        transform: {
            offset: { x: Math.min(p0.x, p1.x), y: Math.min(p0.y, p1.y) },
            extents: { width: Math.abs(p1.x - p0.x), height: Math.abs(p1.y - p0.y) },
            rotation: 0,
            flipH: shape.line && p1.x < p0.x,
            flipV: shape.line && p1.y < p0.y,
        },
        geometry: { preset: { preset: shape.preset, adjustValues: [] } },
        fill: null,
        line: arrowedLine(shape),
        effects: null,
        scene3d: null,
        shape3d: null,
    };
    if (shape.line) {
        return {
            connector: { id, nonVisual, startConnection: null, endConnection: null, properties, style: LINE_STYLE },
        };
    }
    return {
        shape: {
            id,
            nonVisual,
            properties,
            style: shape.outline ? LINE_STYLE : SHAPE_STYLE,
            textBody: emptyBody(story),
            textTransform: null,
            diagramPoint: null,
        },
    };
}
