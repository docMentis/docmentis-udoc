// A tether: the line from something on the document to the entry that stands
// for it in the right panel, so the eye goes from one to the other — the
// current search match to its result, the open comment to its card.
//
// It runs dashed from the middle of the right edge of the thing on the
// document, across to halfway to the entry, up or down there to the entry's
// height, and on into the entry's left edge. One layer over the whole body
// draws it, across the document area and the panel both, and takes no press.
// It follows the document each painted frame, the panel's scroll and resizing
// and the state it watches; it hides while the middle of either end is
// scrolled out of sight, while the panel's tab doesn't show the entry, and
// while the panel lies over the document rather than beside it, as a narrow
// layout's drawer does.

import type { Store } from "../../framework/index.js";
import { shallowEqual, subscribeSelector } from "../../framework/index.js";
import type { Action } from "../actions.js";
import type { UIState } from "../state.js";

const SVG_NS = "http://www.w3.org/2000/svg";
/** The radius of the line's two bends, CSS px. */
const BEND_RADIUS_PX = 6;

/** Where a tether runs between, read as client rects when it's drawn. */
export interface TetherEnds {
    /** The thing on the document, and the document area it shows in; null
     *  when there's none to start from. */
    from: () => { rect: DOMRect; area: DOMRect } | null;
    /** The entry in the panel, the height the line lands on it at, and the
     *  box it scrolls in; null when the panel isn't showing one. */
    to: () => { rect: DOMRect; y: number; clip: DOMRect } | null;
}

export interface TetherOptions {
    /** What it's a tether of, a modifier class that colours its line. */
    kind: string;
    /** The state an end moves with besides the document and the panel's
     *  scroll — compared field by field. */
    watch: (state: UIState) => Record<string, unknown>;
}

export function createTether(ends: TetherEnds, options: TetherOptions) {
    const el = document.createElement("div");
    el.className = `udoc-tether udoc-tether--${options.kind}`;
    el.setAttribute("aria-hidden", "true");
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.style.display = "none";
    const line = document.createElementNS(SVG_NS, "path");
    line.setAttribute("class", "udoc-tether__line");
    svg.appendChild(line);
    el.appendChild(svg);

    const cleanups: Array<() => void> = [];
    let pending: number | null = null;

    /** The line's path in the layer's own coordinates, or null when it hides. */
    function route(): string | null {
        const start = ends.from();
        if (!start) return null;
        const end = ends.to();
        if (!end) return null;
        const { rect, area } = start;
        if (area.width <= 0 || area.height <= 0 || end.rect.width <= 0 || end.rect.height <= 0) return null;
        const sy = rect.top + rect.height / 2;
        const ey = end.y;
        // The middle of either end scrolled out of sight.
        if (rect.right <= area.left || rect.left >= area.right) return null;
        if (sy < area.top || sy > area.bottom || ey < end.clip.top || ey > end.clip.bottom) return null;
        // The panel over the document, not beside it.
        if (end.rect.left < area.right - 1) return null;

        // From the thing's right end, or the document area's edge where it
        // runs past it; the vertical run halfway to the entry.
        const sx = Math.min(rect.right, area.right);
        const ex = end.rect.left;
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

    // The layer stays laid out and only its drawing hides: the line is placed
    // against the layer's own rect, which a layer not displayed reads as 0, 0.
    function draw(): void {
        const d = route();
        svg.style.display = d === null ? "none" : "";
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
        cleanups.push(subscribeSelector(store, options.watch, schedule, { equality: shallowEqual }));
        // The panel's list scrolling: a scroll doesn't bubble, so the panel
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

export type TetherComponent = ReturnType<typeof createTether>;
