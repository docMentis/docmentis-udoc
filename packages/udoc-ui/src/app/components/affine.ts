// A tiny 2D affine-matrix toolkit for the selection overlay. Matrices are
// `[a, b, c, d, e, f]` in PDF/SVG order — the same order the engine reports an
// object's `local → page` transform and accepts a transform delta — mapping a
// point `(x, y)` to `(a·x + c·y + e, b·x + d·y + f)`. Composition matches the
// engine's `Affine::concat`: `multiply(m, n)` applies `n` first, then `m`.

import type { Affine as GraphicsAffine } from "@docmentis/udoc-wasm";

/** `[a, b, c, d, e, f]` (PDF/SVG order). */
export type Affine = [number, number, number, number, number, number];

/** The identity transform. */
export const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

/** Map a point through `m` (full affine, translation included). */
export function applyPoint(m: Affine, x: number, y: number): { x: number; y: number } {
    return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

/** Map a vector (delta) through `m`'s linear part only — no translation. */
export function applyVector(m: Affine, x: number, y: number): { x: number; y: number } {
    return { x: m[0] * x + m[2] * y, y: m[1] * x + m[3] * y };
}

/** Compose: the result applies `n` first, then `m` (matrix product `m·n`). */
export function multiply(m: Affine, n: Affine): Affine {
    return [
        m[0] * n[0] + m[2] * n[1],
        m[1] * n[0] + m[3] * n[1],
        m[0] * n[2] + m[2] * n[3],
        m[1] * n[2] + m[3] * n[3],
        m[0] * n[4] + m[2] * n[5] + m[4],
        m[1] * n[4] + m[3] * n[5] + m[5],
    ];
}

/** The inverse of `m`, or `null` when it is singular (degenerate object). */
export function invert(m: Affine): Affine | null {
    const det = m[0] * m[3] - m[1] * m[2];
    if (Math.abs(det) < 1e-12) return null;
    const inv = 1 / det;
    return [
        m[3] * inv,
        -m[1] * inv,
        -m[2] * inv,
        m[0] * inv,
        (m[2] * m[5] - m[3] * m[4]) * inv,
        (m[1] * m[4] - m[0] * m[5]) * inv,
    ];
}

/** A pure translation. */
export function translate(x: number, y: number): Affine {
    return [1, 0, 0, 1, x, y];
}

/** A pure (axis-aligned) scale. */
export function scale(sx: number, sy: number): Affine {
    return [sx, 0, 0, sy, 0, 0];
}

/** A rotation by `rad` (clockwise in the y-down page space). */
export function rotate(rad: number): Affine {
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return [cos, sin, -sin, cos, 0, 0];
}

/** Adopt the engine's `GraphicsAffine` (named components) as an {@link Affine}
 *  array. The component order is the PDF/SVG `[a, b, c, d, e, f]` this toolkit
 *  uses: `a = scaleX`, `b = skewY`, `c = skewX`, `d = scaleY`,
 *  `e = translateX`, `f = translateY` (the same mapping as the engine's
 *  `Affine::to_components`). */
export function fromComponents(t: GraphicsAffine): Affine {
    return [t.scaleX, t.skewY, t.skewX, t.scaleY, t.translateX, t.translateY];
}
