// A drawing paint's opacity, which a color carries as its alpha transforms: read
// the way the engine resolves them, and set in place of them. Pure — `paint.ts`
// edits the selection with what this builds.
import type { PaintColor, PaintColorTransform, PaintFill } from "@docmentis/udoc-wasm";

function isAlpha(transform: PaintColorTransform): boolean {
    return (
        typeof transform === "object" && ("alpha" in transform || "alphaOff" in transform || "alphaMod" in transform)
    );
}

/** The opacity `color` paints with, `0` to `1`: its alpha transforms in order,
 *  over opaque. */
export function colorOpacity(color: PaintColor): number {
    let opacity = 1;
    for (const transform of color.transforms) {
        if (typeof transform !== "object") continue;
        if ("alpha" in transform) opacity = transform.alpha;
        else if ("alphaMod" in transform) opacity *= transform.alphaMod;
        else if ("alphaOff" in transform) opacity += transform.alphaOff;
    }
    return Math.min(1, Math.max(0, opacity));
}

/** `color` at `opacity`, in place of the alpha transforms it had. Opaque states
 *  none, as a color with no alpha transform is. */
export function withOpacity(color: PaintColor, opacity: number): PaintColor {
    const transforms = color.transforms.filter((transform) => !isAlpha(transform));
    return { ...color, transforms: opacity < 1 ? [...transforms, { alpha: opacity }] : transforms };
}

/** The opacity `fill` paints with, or null for a fill with no one color to carry
 *  it: no fill, a gradient, a pattern or a picture. */
export function fillOpacity(fill: PaintFill): number | null {
    return typeof fill === "object" && "solid" in fill ? colorOpacity(fill.solid) : null;
}

/** `fill` at `opacity`, or as it is for a fill with no one color to carry it. */
export function fillWithOpacity(fill: PaintFill, opacity: number): PaintFill {
    return typeof fill === "object" && "solid" in fill ? { solid: withOpacity(fill.solid, opacity) } : fill;
}

/**
 * What a new shape paints a side with, from what was last specified for it: its
 * `color` at its `opacity`, an opacity alone taking `defaultColor`. Null with
 * neither specified, for the document's own default.
 */
export function specifiedFill(
    color: PaintColor | null,
    opacity: number | null,
    defaultColor: PaintColor,
): PaintFill | null {
    if (!color && opacity === null) return null;
    return { solid: withOpacity(color ?? defaultColor, opacity ?? colorOpacity(color ?? defaultColor)) };
}
