// The crop box's geometry: where a drag takes it, kept inside the page and to
// an aspect. Pure, over plain numbers — crop mode (`crop.ts`) holds the box and
// the page it measures it by.
/** The aspect the crop box keeps: none, the page's own, or a preset one —
 *  turned to the page's orientation. */
export type CropAspect = "free" | "original" | "square" | "4:3" | "16:9";

/** The crop box, as fractions of the page from its top-left corner. */
export interface CropBox {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}

/** What a press drags: a corner, an edge, or the whole box. */
export type CropHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | "move";

/** The whole page. */
export const WHOLE: CropBox = { x0: 0, y0: 0, x1: 1, y1: 1 };

/** How far from the page's edge, as a fraction of it, the box still counts as
 *  keeping the whole page. */
const WHOLE_EPSILON = 1e-4;

/** The preset aspects, wider than tall. */
const PRESET_ASPECTS: Readonly<Record<"square" | "4:3" | "16:9", number>> = {
    square: 1,
    "4:3": 4 / 3,
    "16:9": 16 / 9,
};

/** The width-to-height ratio `aspect` keeps the box to on a page showing at
 *  `width` × `height` pixels, or null for none. A preset turns to the page's
 *  orientation, as a camera's does. */
export function aspectRatio(aspect: CropAspect, width: number, height: number): number | null {
    switch (aspect) {
        case "free":
            return null;
        case "original":
            return width / height;
        default: {
            const ratio = PRESET_ASPECTS[aspect];
            return width >= height ? ratio : 1 / ratio;
        }
    }
}

/** `box` at a page `width` × `height`, or back to fractions of it. */
export function scaled(box: CropBox, width: number, height: number): CropBox {
    return { x0: box.x0 * width, y0: box.y0 * height, x1: box.x1 * width, y1: box.y1 * height };
}

/** The largest box of `ratio` inside `box`, about its centre. */
export function fitRatio(box: CropBox, ratio: number): CropBox {
    const cx = (box.x0 + box.x1) / 2;
    const cy = (box.y0 + box.y1) / 2;
    let w = box.x1 - box.x0;
    let h = box.y1 - box.y0;
    if (w / h > ratio) w = h * ratio;
    else h = w / ratio;
    return { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
}

/**
 * `from` dragged by `handle` through `dx` × `dy`, all in pixels on a page
 * `width` × `height`: kept inside the page and no narrower than `min`, and to
 * `ratio` where it's set. A corner drags against the corner across from it; an
 * edge against the edge across, the box widening about its middle the other
 * way to keep a ratio.
 */
export function dragged(
    handle: CropHandle,
    from: CropBox,
    dx: number,
    dy: number,
    width: number,
    height: number,
    min: number,
    ratio: number | null,
): CropBox {
    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
    if (handle === "move") {
        const w = from.x1 - from.x0;
        const h = from.y1 - from.y0;
        const x0 = clamp(from.x0 + dx, 0, width - w);
        const y0 = clamp(from.y0 + dy, 0, height - h);
        return { x0, y0, x1: x0 + w, y1: y0 + h };
    }
    const west = handle.includes("w");
    const east = handle.includes("e");
    const north = handle.includes("n");
    const south = handle.includes("s");
    // The edges the handle moves, free.
    const free = {
        x0: west ? clamp(from.x0 + dx, 0, from.x1 - min) : from.x0,
        x1: east ? clamp(from.x1 + dx, from.x0 + min, width) : from.x1,
        y0: north ? clamp(from.y0 + dy, 0, from.y1 - min) : from.y0,
        y1: south ? clamp(from.y1 + dy, from.y0 + min, height) : from.y1,
    };
    if (ratio === null) return free;
    const horizontal = west || east;
    const vertical = north || south;
    let w = free.x1 - free.x0;
    let h = free.y1 - free.y0;
    // The edge each axis holds still: the one across from the handle, or, on
    // the axis an edge handle doesn't move, the box's middle.
    const ax = west ? from.x1 : east ? from.x0 : (from.x0 + from.x1) / 2;
    const ay = north ? from.y1 : south ? from.y0 : (from.y0 + from.y1) / 2;
    if (horizontal && vertical) {
        if (w / h > ratio) w = h * ratio;
        else h = w / ratio;
    } else if (horizontal) {
        h = w / ratio;
    } else {
        w = h * ratio;
    }
    // The room the page leaves from the held edges, each way.
    const maxW = west ? ax : east ? width - ax : 2 * Math.min(ax, width - ax);
    const maxH = north ? ay : south ? height - ay : 2 * Math.min(ay, height - ay);
    if (w > maxW) [w, h] = [maxW, maxW / ratio];
    if (h > maxH) [w, h] = [maxH * ratio, maxH];
    const x0 = west ? ax - w : east ? ax : ax - w / 2;
    const y0 = north ? ay - h : south ? ay : ay - h / 2;
    return { x0, y0, x1: x0 + w, y1: y0 + h };
}

/** Whether `box` keeps the whole page. */
export function wholePage(box: CropBox): boolean {
    return (
        box.x0 <= WHOLE_EPSILON && box.y0 <= WHOLE_EPSILON && box.x1 >= 1 - WHOLE_EPSILON && box.y1 >= 1 - WHOLE_EPSILON
    );
}
