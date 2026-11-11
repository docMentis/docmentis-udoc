// The line from the current search match on the document to its result in the
// Search tab, so the eye goes from one to the other.
//
// It runs dashed in the current match's colour from the middle of the right
// edge of the match's first highlight on screen, across to halfway to the
// result, up or down there to the result's height, and on into the result.
// One layer over the whole body draws it, across the document area and the
// panel both, and takes no press. It follows the highlight each painted
// frame, the results list's scroll, the panel's resizing and the current
// match; it hides while the middle of the match or of its result is scrolled
// out of sight, while the Search tab isn't showing, and while the panel lies
// over the document rather than beside it, as a narrow layout's drawer does.

import type { Store } from "../../framework/index.js";
import { shallowEqual, subscribeSelector } from "../../framework/index.js";
import type { Action } from "../actions.js";
import type { UIState } from "../state.js";

const SVG_NS = "http://www.w3.org/2000/svg";
/** The radius of the line's two bends, CSS px. */
const BEND_RADIUS_PX = 6;

/** Where the line runs between, read as client rects when it's drawn. */
export interface SearchTetherEnds {
    /** The current match's first highlight drawn, and the document area it
     *  draws in; null when none of the match is drawn. */
    match: () => { highlight: DOMRect; area: DOMRect } | null;
    /** The current match's result in the Search tab, and the results list it
     *  scrolls in; null when the tab isn't showing one. */
    result: () => { row: DOMRect; list: DOMRect } | null;
}

export function createSearchTether(ends: SearchTetherEnds) {
    const el = document.createElement("div");
    el.className = "udoc-search-tether";
    el.setAttribute("aria-hidden", "true");
    const svg = document.createElementNS(SVG_NS, "svg");
    const line = document.createElementNS(SVG_NS, "path");
    line.setAttribute("class", "udoc-search-tether__line");
    line.style.display = "none";
    svg.appendChild(line);
    el.appendChild(svg);

    const cleanups: Array<() => void> = [];
    let pending: number | null = null;

    /** The line's path in the layer's own coordinates, or null when it hides. */
    function route(): string | null {
        const match = ends.match();
        if (!match) return null;
        const result = ends.result();
        if (!result) return null;
        const { highlight, area } = match;
        const { row, list } = result;
        if (area.width <= 0 || area.height <= 0 || row.width <= 0 || row.height <= 0) return null;
        const sy = highlight.top + highlight.height / 2;
        const ey = row.top + row.height / 2;
        // The middle of the match scrolled out of the document area, or of its
        // result out of the list.
        if (highlight.right <= area.left || highlight.left >= area.right) return null;
        if (sy < area.top || sy > area.bottom || ey < list.top || ey > list.bottom) return null;
        // The panel over the document, not beside it.
        if (row.left < area.right - 1) return null;

        // From the match's right end, or the document area's edge where the
        // match runs past it; the vertical run halfway to the result.
        const sx = Math.min(highlight.right, area.right);
        const ex = row.left;
        const gx = (sx + ex) / 2;
        const dy = ey - sy;
        const r = Math.max(0, Math.min(BEND_RADIUS_PX, Math.abs(dy) / 2, gx - sx, ex - gx));
        const s = Math.sign(dy);

        const origin = el.getBoundingClientRect();
        const x = (v: number) => (v - origin.left).toFixed(1);
        const y = (v: number) => (v - origin.top).toFixed(1);
        return (
            `M${x(sx)} ${y(sy)}H${x(gx - r)}Q${x(gx)} ${y(sy)} ${x(gx)} ${y(sy + s * r)}` +
            `V${y(ey - s * r)}Q${x(gx)} ${y(ey)} ${x(gx + r)} ${y(ey)}H${x(ex)}`
        );
    }

    // The layer stays laid out and only the line hides: the line is placed
    // against the layer's own rect, which a layer not displayed reads as 0, 0.
    function draw(): void {
        const d = route();
        line.style.display = d === null ? "none" : "";
        if (d !== null) line.setAttribute("d", d);
    }

    /** Draw the line again once this frame, however many changes ask. */
    function schedule(): void {
        if (pending !== null) return;
        pending = requestAnimationFrame(() => {
            pending = null;
            draw();
        });
    }

    /** Lay the line over `body`, the document area's and `panel`'s container,
     *  following what moves either end. */
    function mount(body: HTMLElement, panel: HTMLElement, store: Store<UIState, Action>): void {
        body.appendChild(el);
        // The current match, the matches, and the tab shown — another tab
        // changes neither the document area nor the panel's width.
        cleanups.push(
            subscribeSelector(
                store,
                (s) => ({ active: s.searchActiveIndex, matches: s.searchMatches, panel: s.activePanel }),
                schedule,
                { equality: shallowEqual },
            ),
        );
        // The results list scrolling: a scroll doesn't bubble, so the panel
        // catches it on the way down.
        panel.addEventListener("scroll", schedule, { capture: true, passive: true });
        cleanups.push(() => panel.removeEventListener("scroll", schedule, { capture: true }));
        // The body resized, or the panel opened, closed or resized.
        const resize = new ResizeObserver(schedule);
        resize.observe(body);
        resize.observe(panel);
        cleanups.push(() => resize.disconnect());
        schedule();
    }

    function destroy(): void {
        if (pending !== null) cancelAnimationFrame(pending);
        pending = null;
        for (const off of cleanups) off();
        cleanups.length = 0;
        el.remove();
    }

    return { el, mount, schedule, destroy };
}

export type SearchTetherComponent = ReturnType<typeof createSearchTether>;
