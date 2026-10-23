// The hovered annotation's outline: the area the annotation under the resting
// pointer covers, drawn over the canvas — under the selection layer, which
// marks a selected annotation with its own box. Function-critical, like the
// selection, so it is a layer of its own rather than a registry overlay.
//
// The area arrives as the hit's quads, in page-local document points (four
// corners each, the engine's), so each painted frame this layer projects them
// against the page views the worker streams — scroll and zoom move the outline
// with no worker traffic. The outline is one around them all: each quad grows
// by a padding with rounded corners, and the line is drawn through a mask —
// white where the grown quads widened by the line, black where the grown quads
// are — so where two meet, each covers the other's line inside the union.

import type { PageView, Rect } from "../../geometry.js";
import type { Point } from "@docmentis/udoc-wasm";
import { applyPoint } from "./affine.js";
import { applyContentClip } from "./overlayClip.js";
import { ANNOTATION_PADDING, pageViewportAffine } from "./SelectionLayer.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** How far the outline stands off the annotation's quads, CSS px — as far as
 *  a selected annotation's box stands off its rect — and the radius of its
 *  corners. */
const PADDING = ANNOTATION_PADDING;
/** The outline's width, CSS px — a selected box's (styles.ts,
 *  `.udoc-ui__selection-box`). */
const WIDTH = 1.5;

/** Numbers each layer's mask: an id is the whole page's, and a page can hold
 *  several instances. */
let maskCount = 0;

/** The slice of a page-views frame the projection needs. */
interface HoverFrame {
    views: PageView[];
    /** CSS px per document point for this frame. */
    scale: number;
}

/** The hovered annotation: the page it is on (its index) and the quads it
 *  covers, page-local. */
export interface AnnotationHover {
    page: number;
    quads: ReadonlyArray<ReadonlyArray<Point>>;
}

export class AnnotationHoverLayer {
    /** The clipped group the outline draws in — it fills the canvas, so the
     *  branding rect drops straight into its clip coordinates. */
    readonly #chrome: HTMLElement;
    /** The mask's two groups: the quads grown by the padding and the line, and
     *  by the padding alone. */
    readonly #outer: SVGGElement;
    readonly #inner: SVGGElement;
    /** The outline's colour, shown through the mask. */
    readonly #ink: SVGRectElement;
    /** Pooled polygons, one per quad in each group. */
    readonly #polys: Array<{ outer: SVGPolygonElement; inner: SVGPolygonElement }> = [];
    #hover: AnnotationHover | null = null;
    #frame: HoverFrame = { views: [], scale: 1 };
    /** The branding decal's rect, punched out of the clip as every
     *  content-anchored layer does (see {@link applyContentClip}). */
    #brandingRect: Rect | null = null;
    #clipKey = "";

    constructor(container: HTMLElement) {
        this.#chrome = document.createElement("div");
        this.#chrome.className = "udoc-annotation-hover-layer";
        this.#chrome.setAttribute("aria-hidden", "true");
        const svg = document.createElementNS(SVG_NS, "svg");
        const mask = document.createElementNS(SVG_NS, "mask");
        const id = `udoc-annotation-hover-mask-${maskCount++}`;
        mask.id = id;
        mask.setAttribute("maskUnits", "userSpaceOnUse");
        mask.setAttribute("x", "0");
        mask.setAttribute("y", "0");
        mask.setAttribute("width", "100%");
        mask.setAttribute("height", "100%");
        this.#outer = maskGroup("white", 2 * (PADDING + WIDTH));
        this.#inner = maskGroup("black", 2 * PADDING);
        mask.append(this.#outer, this.#inner);
        const defs = document.createElementNS(SVG_NS, "defs");
        defs.appendChild(mask);
        this.#ink = document.createElementNS(SVG_NS, "rect");
        this.#ink.setAttribute("class", "udoc-annotation-hover");
        this.#ink.setAttribute("width", "100%");
        this.#ink.setAttribute("height", "100%");
        this.#ink.setAttribute("mask", `url(#${id})`);
        this.#ink.style.display = "none";
        svg.append(defs, this.#ink);
        this.#chrome.appendChild(svg);
        container.appendChild(this.#chrome);
    }

    /** Outline `hover`, or nothing when it is null. */
    set(hover: AnnotationHover | null): void {
        if (hover === null && this.#hover === null) return;
        this.#hover = hover;
        this.#draw();
    }

    /** Re-project the outline against one painted frame's pages. */
    render(frame: HoverFrame): void {
        this.#frame = frame;
        this.#applyClip();
        this.#draw();
    }

    /** The branding decal's viewport rect (CSS px), or null when there is none. */
    setBrandingRect(rect: Rect | null): void {
        this.#brandingRect = rect;
        this.#applyClip();
    }

    #applyClip(): void {
        this.#clipKey = applyContentClip(this.#chrome, { branding: this.#brandingRect }, this.#clipKey);
    }

    #draw(): void {
        let used = 0;
        const hover = this.#hover;
        const view = hover && this.#frame.views.find((v) => v.index === hover.page);
        if (hover && view) {
            const toViewport = pageViewportAffine(view, this.#frame.scale);
            for (const quad of hover.quads) {
                let pair = this.#polys[used];
                if (!pair) {
                    pair = {
                        outer: document.createElementNS(SVG_NS, "polygon"),
                        inner: document.createElementNS(SVG_NS, "polygon"),
                    };
                    this.#outer.appendChild(pair.outer);
                    this.#inner.appendChild(pair.inner);
                    this.#polys.push(pair);
                }
                const points = quad
                    .map((p) => {
                        const v = applyPoint(toViewport, p.x, p.y);
                        return `${v.x},${v.y}`;
                    })
                    .join(" ");
                for (const poly of [pair.outer, pair.inner]) {
                    poly.setAttribute("points", points);
                    poly.style.display = "";
                }
                used++;
            }
        }
        for (let i = used; i < this.#polys.length; i++) {
            this.#polys[i]!.outer.style.display = "none";
            this.#polys[i]!.inner.style.display = "none";
        }
        this.#ink.style.display = used > 0 ? "" : "none";
    }
}

/** A mask group painting its quads in `color`, each grown by half `stroke` —
 *  filled, and stroked with round joins, which round the grown corners. */
function maskGroup(color: string, stroke: number): SVGGElement {
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("fill", color);
    g.setAttribute("stroke", color);
    g.setAttribute("stroke-width", String(stroke));
    g.setAttribute("stroke-linejoin", "round");
    return g;
}
