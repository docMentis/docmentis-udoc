// The highlights of a Word or PowerPoint document's comments: the text each
// thread is on, on the pages on screen, a polygon per quad the engine gives,
// bracketed by a line at its left on a page and one at its right — the open
// thread's stronger. Under the selection and taking no press, so the
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

/** One edge of a thread's text on a page: the left of its first quad or the
 *  right of its last, in viewport px. */
interface Edge {
    comment: string;
    from: { x: number; y: number };
    to: { x: number; y: number };
}

export function commentHighlights(callbacks: CommentHighlightsCallbacks): OverlaySource {
    return (frame) => {
        if (!callbacks.active()) return [];
        const highlights: Highlight[] = [];
        const edges: Edge[] = [];
        for (const view of frame.views) {
            const m = callbacks.pageToViewport(view.index);
            if (!m) continue;
            for (const markup of callbacks.markup(view.index)) {
                if (!("text" in markup)) continue;
                const { comment, quads } = markup.text;
                const at = (p: { x: number; y: number }) => applyPoint(m, p.x, p.y);
                for (const quad of quads) {
                    const points = quad.points.map((p) => {
                        const v = at(p);
                        return `${v.x},${v.y}`;
                    });
                    highlights.push({ comment, points: points.join(" ") });
                }
                // A quad's corners run top-left, top-right, bottom-right,
                // bottom-left.
                const first = quads[0];
                const last = quads[quads.length - 1];
                if (first && last) {
                    const [topLeft, , , bottomLeft] = first.points;
                    const [, topRight, bottomRight] = last.points;
                    edges.push({ comment, from: at(topLeft), to: at(bottomLeft) });
                    edges.push({ comment, from: at(topRight), to: at(bottomRight) });
                }
            }
        }
        if (highlights.length === 0) return [];
        const open = callbacks.open();
        // One layer over the viewport, at its origin, its polygons and edges in
        // viewport px — pooled across frames.
        return [
            {
                key: "highlights",
                x: 0,
                y: 0,
                create: () => {
                    const el = document.createElement("div");
                    el.className = "udoc-comment-highlights";
                    el.setAttribute("aria-hidden", "true");
                    const svg = document.createElementNS(SVG_NS, "svg");
                    svg.append(document.createElementNS(SVG_NS, "g"), document.createElementNS(SVG_NS, "g"));
                    el.appendChild(svg);
                    return el;
                },
                update: (el: HTMLElement) => {
                    const [fills, lines] = (el.firstElementChild as SVGSVGElement).children;
                    pooled(fills!, "polygon", highlights.length).forEach((poly, index) => {
                        const highlight = highlights[index]!;
                        poly.setAttribute("points", highlight.points);
                        // The thread it stands for — what the comment tether
                        // finds a thread with no marker by.
                        poly.dataset.comment = highlight.comment;
                        poly.setAttribute("class", classOf("udoc-comment-highlight", highlight.comment === open));
                    });
                    pooled(lines!, "line", edges.length).forEach((line, index) => {
                        const edge = edges[index]!;
                        line.setAttribute("x1", `${edge.from.x}`);
                        line.setAttribute("y1", `${edge.from.y}`);
                        line.setAttribute("x2", `${edge.to.x}`);
                        line.setAttribute("y2", `${edge.to.y}`);
                        line.setAttribute("class", classOf("udoc-comment-highlight-edge", edge.comment === open));
                    });
                },
            },
        ];
    };
}

/** `group`'s first `count` children, made `tag`s as needed, the rest gone. */
function pooled<K extends "polygon" | "line">(group: Element, tag: K, count: number): SVGElementTagNameMap[K][] {
    while (group.childElementCount > count) group.lastElementChild!.remove();
    while (group.childElementCount < count) group.appendChild(document.createElementNS(SVG_NS, tag));
    return [...group.children] as SVGElementTagNameMap[K][];
}

/** `base`, and its open modifier where the thread is open. */
function classOf(base: string, open: boolean): string {
    return open ? `${base} ${base}--open` : base;
}
