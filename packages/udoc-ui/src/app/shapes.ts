// The outline of a dragged-out shape: when the user presses-drags-releases with
// a shape-placing tool armed, the canvas maps the gesture into two page-local
// document points, and this module turns them into the path segments of the
// shape between them, in the exact shape the Rust model's serde expects — what
// the canvas sketches while the drag lasts, and what a shape placed as a page
// object is drawn with.

import type { Color } from "@docmentis/udoc-wasm";
import type { ShapeKind } from "./state.js";

/** A page-local document point (top-left origin, y-down). */
export interface ShapePoint {
    x: number;
    y: number;
}

/** Default stroke — solid blue. */
export const STROKE: Color = { components: [0.16, 0.41, 0.85], colorSpace: "srgb" };
/** Stroke width, document points. */
export const STROKE_WIDTH = 1.5;

/**
 * Bezier circle constant — quarter-ellipse control-handle length as a fraction
 * of the radius (matches the Rust `KAPPA`).
 */
const KAPPA = 0.5522847498307935;
/** Arrowhead barb length (document points), capped to a third of the shaft. */
const ARROW_HEAD = 14;

/** A path segment in page-local document points, in the model's serde shape. */
export type Segment =
    | { moveTo: ShapePoint }
    | { lineTo: ShapePoint }
    | { cubicTo: { control1: ShapePoint; control2: ShapePoint; end: ShapePoint } }
    | "close";

const pt = (x: number, y: number): ShapePoint => ({ x, y });

/** Min/max corners of the box spanned by `p0` and `p1`. */
function bounds(p0: ShapePoint, p1: ShapePoint) {
    return {
        x0: Math.min(p0.x, p1.x),
        y0: Math.min(p0.y, p1.y),
        x1: Math.max(p0.x, p1.x),
        y1: Math.max(p0.y, p1.y),
    };
}

function rectangleSegments(p0: ShapePoint, p1: ShapePoint): Segment[] {
    const { x0, y0, x1, y1 } = bounds(p0, p1);
    return [{ moveTo: pt(x0, y0) }, { lineTo: pt(x1, y0) }, { lineTo: pt(x1, y1) }, { lineTo: pt(x0, y1) }, "close"];
}

function ellipseSegments(p0: ShapePoint, p1: ShapePoint): Segment[] {
    const { x0, y0, x1, y1 } = bounds(p0, p1);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const rx = (x1 - x0) / 2;
    const ry = (y1 - y0) / 2;
    const ox = rx * KAPPA;
    const oy = ry * KAPPA;
    // Four cubic quadrants, clockwise from the right vertex (y-down).
    return [
        { moveTo: pt(cx + rx, cy) },
        { cubicTo: { control1: pt(cx + rx, cy + oy), control2: pt(cx + ox, cy + ry), end: pt(cx, cy + ry) } },
        { cubicTo: { control1: pt(cx - ox, cy + ry), control2: pt(cx - rx, cy + oy), end: pt(cx - rx, cy) } },
        { cubicTo: { control1: pt(cx - rx, cy - oy), control2: pt(cx - ox, cy - ry), end: pt(cx, cy - ry) } },
        { cubicTo: { control1: pt(cx + ox, cy - ry), control2: pt(cx + rx, cy - oy), end: pt(cx + rx, cy) } },
        "close",
    ];
}

function lineSegments(p0: ShapePoint, p1: ShapePoint): Segment[] {
    return [{ moveTo: pt(p0.x, p0.y) }, { lineTo: pt(p1.x, p1.y) }];
}

function arrowSegments(p0: ShapePoint, p1: ShapePoint): Segment[] {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy);
    const segments: Segment[] = [{ moveTo: pt(p0.x, p0.y) }, { lineTo: pt(p1.x, p1.y) }];
    if (len > 1e-9) {
        const angle = Math.atan2(dy, dx);
        const head = Math.min(ARROW_HEAD, len / 3);
        // Two barbs splayed ±30° back from the tip along the shaft direction.
        for (const spread of [angle - Math.PI / 6, angle + Math.PI / 6]) {
            const barb = pt(p1.x - head * Math.cos(spread), p1.y - head * Math.sin(spread));
            segments.push({ moveTo: pt(p1.x, p1.y) }, { lineTo: barb });
        }
    }
    return segments;
}

/** The outline of `shape` spanning `p0` → `p1` — the path {@link shapeObject}
 *  inserts, and the one the canvas sketches while it is placed. */
export function segmentsFor(shape: ShapeKind, p0: ShapePoint, p1: ShapePoint): Segment[] {
    switch (shape) {
        case "rectangle":
            return rectangleSegments(p0, p1);
        case "ellipse":
            return ellipseSegments(p0, p1);
        case "line":
            return lineSegments(p0, p1);
        case "arrow":
            return arrowSegments(p0, p1);
    }
}
