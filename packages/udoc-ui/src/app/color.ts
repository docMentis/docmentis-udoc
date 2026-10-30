/**
 * Colour as the paint panel handles it: the `#rrggbb` a paint carries, its
 * bytes, and hue / saturation / value — the custom picker's own coordinates
 * (its square is saturation across and value down, the strip beneath it hue).
 * Pure, so it is tested off the DOM.
 */

/** A colour in HSV: `h` in degrees, `[0, 360)`; `s` and `v` in `[0, 1]`. */
export interface Hsv {
    h: number;
    s: number;
    v: number;
}

/** `text` as a lowercase `#rrggbb` — it may be `#rgb` or `#rrggbb`, the `#`
 *  optional, space around it ignored — or `null` when it is neither. */
export function parseHex(text: string): string | null {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text.trim());
    if (!m?.[1]) return null;
    const digits = m[1].toLowerCase();
    return digits.length === 3 ? `#${[...digits].map((d) => d + d).join("")}` : `#${digits}`;
}

/** A `#rrggbb` hex's three bytes, `0..255`. */
export function hexToRgb(hex: string): [number, number, number] {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Three channels, `0..255` (rounded and clamped), as a `#rrggbb` hex. */
export function rgbToHex(r: number, g: number, b: number): string {
    const h = (c: number) =>
        Math.round(Math.min(255, Math.max(0, c)))
            .toString(16)
            .padStart(2, "0");
    return `#${h(r)}${h(g)}${h(b)}`;
}

/** A `#rrggbb` hex in HSV. A grey has no hue of its own, and gets `0`. */
export function hexToHsv(hex: string): Hsv {
    const [r, g, b] = hexToRgb(hex).map((c) => c / 255) as [number, number, number];
    const max = Math.max(r, g, b);
    const d = max - Math.min(r, g, b);
    let h = 0;
    if (d > 0) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h = (h * 60 + 360) % 360;
    }
    return { h, s: max === 0 ? 0 : d / max, v: max };
}

/** An HSV colour as a `#rrggbb` hex. */
export function hsvToHex({ h, s, v }: Hsv): string {
    const f = (n: number): number => {
        const k = (n + h / 60) % 6;
        return (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255;
    };
    return rgbToHex(f(5), f(3), f(1));
}
