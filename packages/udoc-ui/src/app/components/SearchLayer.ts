// The search highlights: every match of the search, drawn over the
// canvas — under the selection layer, so a match that becomes the selection
// shows its selection on top. Function-critical, like the selection, so it is a
// layer of its own rather than a registry overlay.
//
// A match's quads arrive in page-local document points (four corners each, the
// engine's), so each painted frame this layer projects them against the page
// views the worker streams and draws a polygon per quad — scroll and zoom move
// them with no worker traffic. Quads are bucketed by page as the matches land,
// so a frame touches only the pages on screen, however many matches there are.

import type { PageView, Rect } from "../../geometry.js";
import type { SearchMatch } from "@docmentis/udoc-wasm";
import { applyPoint } from "./affine.js";
import { applyContentClip } from "./overlayClip.js";
import { pageViewportAffine } from "./SelectionLayer.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** The slice of a page-views frame the projection needs. */
interface SearchFrame {
    views: PageView[];
    /** CSS px per document point for this frame. */
    scale: number;
}

/** One quad to draw: its four page-local corners, and whether its match is
 *  the current one. */
interface Highlight {
    points: ReadonlyArray<{ x: number; y: number }>;
    active: boolean;
}

export class SearchLayer {
    /** The clipped group the highlights draw in — it fills the canvas, so the
     *  branding rect drops straight into its clip coordinates. */
    readonly #chrome: HTMLElement;
    readonly #svg: SVGSVGElement;
    /** Pooled polygons, one per quad on screen. */
    readonly #polys: SVGPolygonElement[] = [];
    /** The quads of the matches on the shown plane, by page. */
    #byPage = new Map<number, Highlight[]>();
    #frame: SearchFrame = { views: [], scale: 1 };
    /** The branding decal's rect, punched out of the clip as every
     *  content-anchored layer does (see {@link applyContentClip}). */
    #brandingRect: Rect | null = null;
    #clipKey = "";

    constructor(container: HTMLElement) {
        this.#chrome = document.createElement("div");
        this.#chrome.className = "udoc-search-layer";
        this.#chrome.setAttribute("aria-hidden", "true");
        this.#svg = document.createElementNS(SVG_NS, "svg");
        this.#chrome.appendChild(this.#svg);
        container.appendChild(this.#chrome);
    }

    /** Show `matches`, those on `plane` — `active` (an index into `matches`,
     *  -1 for none) drawn as the current one. */
    setMatches(matches: readonly SearchMatch[], active: number, plane: number): void {
        const byPage = new Map<number, Highlight[]>();
        matches.forEach((match, index) => {
            if (match.plane !== plane) return;
            for (const quad of match.quads) {
                const highlights = byPage.get(quad.page) ?? [];
                highlights.push({ points: quad.points, active: index === active });
                byPage.set(quad.page, highlights);
            }
        });
        this.#byPage = byPage;
        this.#draw();
    }

    /** Re-project the highlights against one painted frame's pages. */
    render(frame: SearchFrame): void {
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
        for (const view of this.#frame.views) {
            const highlights = this.#byPage.get(view.index);
            if (!highlights) continue;
            const toViewport = pageViewportAffine(view, this.#frame.scale);
            for (const highlight of highlights) {
                let poly = this.#polys[used];
                if (!poly) {
                    poly = document.createElementNS(SVG_NS, "polygon");
                    this.#svg.appendChild(poly);
                    this.#polys.push(poly);
                }
                poly.setAttribute(
                    "points",
                    highlight.points
                        .map((p) => {
                            const v = applyPoint(toViewport, p.x, p.y);
                            return `${v.x},${v.y}`;
                        })
                        .join(" "),
                );
                poly.setAttribute(
                    "class",
                    highlight.active ? "udoc-search-highlight udoc-search-highlight--active" : "udoc-search-highlight",
                );
                poly.style.display = "";
                used++;
            }
        }
        for (let i = used; i < this.#polys.length; i++) this.#polys[i]!.style.display = "none";
    }
}
