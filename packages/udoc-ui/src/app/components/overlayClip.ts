// The one clip shared by every content-anchored overlay layer.
//
// Overlays sit in the DOM above the Rust-painted canvas, but the engine paints
// the "Powered by docMentis" branding decal into that canvas's bottom-right
// corner. Any overlay that paints over it covers chrome the engine owns. So
// every content-anchored overlay host — the selection chrome, the page-anchored
// overlay layer (built-in AND host-registered), the marquee — punches the decal
// out of its clip through this single definition, so the clip is identical
// across all of them. (The guide bands — a ruler, a spreadsheet's headers — were
// once reserved on the canvas and clipped here too; they now render in the DOM
// outside the canvas, so only the decal remains.)
//
// The local text caret is deliberately outside the clipped group: a `clip-path`
// ancestor blanks its `backdrop-filter` (it takes its ink from the pixels behind
// it), so it can't be clipped (see SelectionLayer).

import type { Rect } from "../../geometry.js";

/** The screen-fixed chrome an overlay must clip around, all in CSS px. */
export interface ContentRegion {
    /** The branding decal's rect (bottom-right), punched out so no overlay
     *  paints over the logo; `null` before the engine reports it. */
    branding: Rect | null;
}

/**
 * A cache key for the clip: the same branding rect produces the same clip, so a
 * host stores this and skips re-applying (and the layout read the branding hole
 * needs) when it's unchanged. Deliberately excludes the element's pixel size — a
 * resize moves the bottom-right-anchored branding, so the branding rect already
 * changes the key.
 */
function contentClipKey({ branding }: ContentRegion): string {
    const b = branding;
    return b ? `${b.x},${b.y},${b.width},${b.height}` : "";
}

/**
 * Apply the content clip to `el` — which must fill the canvas (`inset: 0`) so
 * viewport-space rects drop straight into its clip coordinates — reading its
 * pixel size lazily only when the clip actually changes (the branding hole needs
 * it, and a layout read is not free). Pass the previously-stored key; store what
 * this returns.
 *
 * Returns `""` when the branding hole is wanted but `el` isn't laid out yet
 * (a degenerate outer rect would clip it to nothing) — it clears the clip and the
 * empty key forces a rebuild once the size is known.
 */
export function applyContentClip(el: HTMLElement, region: ContentRegion, prevKey: string): string {
    const key = contentClipKey(region);
    if (key === prevKey) return prevKey;
    const { branding } = region;
    if (!branding) {
        el.style.clipPath = "";
        return key;
    }
    // Branding present: punch its rect out of the full canvas rect with an
    // evenodd path (outer canvas ring, inner branding ring). Needs the box size
    // for the outer ring; without it clear the clip and rebuild once laid out.
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w <= 0 || h <= 0) {
        el.style.clipPath = "";
        return "";
    }
    const content = `M0 0H${w}V${h}H0Z`;
    const b = branding;
    const hole = `M${b.x} ${b.y}H${b.x + b.width}V${b.y + b.height}H${b.x}Z`;
    el.style.clipPath = `path(evenodd, "${content} ${hole}")`;
    return key;
}
