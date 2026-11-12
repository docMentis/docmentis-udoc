// The highlights of a Word or PowerPoint document's comments: the text each
// thread is on, on the pages on screen, a polygon per quad the engine gives —
// the open thread's stronger. Under the selection and taking no press, so the
// text under one is selected and typed in as any other. A PDF's comments are
// annotations, which draw themselves on the page.

import type { CommentMarkup } from "@docmentis/udoc-wasm";
import { applyPoint, type Affine } from "./affine.js";
import type { OverlaySource } from "./OverlayManager.js";

const SVG_NS = "http://www.w3.org/2000/svg";

export interface CommentHighlightsCallbacks {
    /** Whether highlights show: an Office document is open, its comments shown. */
    active: () => boolean;
    /** The markup read for page `page` of the plane shown — none until read. */
    markup: (page: number) => readonly CommentMarkup[];
    pageToViewport: (page: number) => Affine | null;
    /** The thread open, by its first comment's id. */
    open: () => string | null;
}

/** One quad to draw: the thread it's of, and its corners in viewport px. */
interface Highlight {
    comment: string;
    points: string;
}

export function commentHighlights(callbacks: CommentHighlightsCallbacks): OverlaySource {
    return (frame) => {
        if (!callbacks.active()) return [];
        const highlights: Highlight[] = [];
        for (const view of frame.views) {
            const m = callbacks.pageToViewport(view.index);
            if (!m) continue;
            for (const markup of callbacks.markup(view.index)) {
                if (!("text" in markup)) continue;
                const { comment, quads } = markup.text;
                for (const quad of quads) {
                    const points = quad.points
                        .map((p) => {
                            const v = applyPoint(m, p.x, p.y);
                            return `${v.x},${v.y}`;
                        })
                        .join(" ");
                    highlights.push({ comment, points });
                }
            }
        }
        if (highlights.length === 0) return [];
        const open = callbacks.open();
        // One layer over the viewport, at its origin, its polygons in viewport
        // px — pooled across frames.
        return [
            {
                key: "highlights",
                x: 0,
                y: 0,
                create: () => {
                    const el = document.createElement("div");
                    el.className = "udoc-comment-highlights";
                    el.setAttribute("aria-hidden", "true");
                    el.appendChild(document.createElementNS(SVG_NS, "svg"));
                    return el;
                },
                update: (el: HTMLElement) => {
                    const svg = el.firstElementChild as SVGSVGElement;
                    while (svg.childElementCount > highlights.length) svg.lastElementChild!.remove();
                    highlights.forEach((highlight, index) => {
                        let poly = svg.children[index] as SVGPolygonElement | undefined;
                        if (!poly) {
                            poly = document.createElementNS(SVG_NS, "polygon");
                            svg.appendChild(poly);
                        }
                        poly.setAttribute("points", highlight.points);
                        // The thread it stands for — what the comment tether
                        // finds a thread with no marker by.
                        poly.dataset.comment = highlight.comment;
                        poly.setAttribute(
                            "class",
                            highlight.comment === open
                                ? "udoc-comment-highlight udoc-comment-highlight--open"
                                : "udoc-comment-highlight",
                        );
                    });
                },
            },
        ];
    };
}
