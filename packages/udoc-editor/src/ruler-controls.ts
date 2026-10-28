// The ruler's controls: the margins' edges along both rulers, and along the
// horizontal one the indent markers and tab stops of the paragraph a caret is
// in, named as Word's ruler names them. They are elements in the layers udoc-ui
// keeps over the ruler's strips (`BandCanvas.layer`), where the graduation
// under them is pixels on the band's canvas, so each takes its own press and
// keeps its drag across the frames that repaint the ruler. A drag slides a
// control along its ruler within the page, on the nearest sixteenth of an inch
// unless Alt is held, carrying what Word's carries with it, and a dashed line
// across the content pane marks where the pressed one is, as Word's does. A
// drop hands what moved, and how far, to the ruler (ruler-edits.ts), and the
// controls hold where it left them until the edit it sends comes back. The
// default tab stops go unmarked, as Google Docs leaves them: they fall on the
// graduation's half inches, where a mark of their own would only double its
// ticks.
import type { RulerAxis, RulerTabAlign, RulerText } from "@docmentis/udoc-wasm";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Half the width of an indent marker's box, and of a tab stop's, CSS px: each
 *  shape is drawn about its box's middle pixel, so its 1px strokes fall whole
 *  on pixels. */
const INDENT_HALF = 5.5;
const TAB_HALF = 4.5;
/** The depth of the left indent's box, CSS px. */
const INDENT_BOX = 5;
/** Half the width of the strip a margin's edge is grabbed by, CSS px. */
const EDGE_HALF = 3.5;
/** What a drag snaps to, in points: a sixteenth of an inch from the ruler's
 *  zero, as Word's ruler does. */
const SNAP = 72 / 16;
/** How long the controls a drop left hold where it left them with no frame
 *  arriving after its edit, ms — they settle on the next frame otherwise. */
const HOLD = 500;

/** A tab stop's mark by its alignment, as Word's: a stem, and a foot running
 *  the way the text runs from the stop — right of a left stop, left of a right
 *  one, both ways under a center or a decimal one — or for a bar, the stem
 *  alone. A decimal stop adds its point beside the stem. */
const TAB_MARKS: Record<RulerTabAlign, string> = {
    left: "M4.5 0V6M4.5 5.5H8",
    center: "M4.5 0V6M1 5.5H8",
    right: "M4.5 0V6M1 5.5H4.5",
    decimal: "M4.5 0V6M1 5.5H8",
    bar: "M4.5 0V6",
};

/** A margin's edge: the text area's side it bounds. */
export type RulerEdge = "left" | "top" | "right" | "bottom";

/** An indent marker, as Word's ruler names them. */
export type RulerIndent = "firstLine" | "hanging" | "left" | "right";

/** Which of the ruler's controls — a margin's edge, an indent marker, or the
 *  tab stop at `index` in the guide's list. */
export type RulerControl =
    | { readonly kind: "margin"; readonly edge: RulerEdge }
    | { readonly kind: "indent"; readonly indent: RulerIndent }
    | { readonly kind: "tab"; readonly index: number };

/** A control dropped `by` points along its ruler from where the guide put it. */
export interface RulerDrop {
    readonly control: RulerControl;
    readonly by: number;
}

/** One ruler, as the guide places the controls along it this frame. */
export interface RulerPlacement {
    /** The layer over the ruler's strip the controls stand in. */
    readonly layer: HTMLElement;
    /** The layer over the content pane a drag along the ruler draws its line
     *  across, measured along the ruler as the strip is. */
    readonly pane: HTMLElement;
    /** What the ruler measures, in points from its origin. */
    readonly axis: RulerAxis;
    /** Where the ruler's zero falls along the strip, CSS px, and the CSS px a
     *  point spans — what a drag measures its points by. */
    readonly origin: number;
    readonly scale: number;
    /** Where `points` from the origin falls along the strip, CSS px — on the
     *  tick there. */
    readonly at: (points: number) => number;
}

/** The ruler's controls. */
export interface RulerControls {
    /**
     * Stand the controls where the guide places them — the margins' edges along
     * each ruler, `text`'s indent markers and tab stops along the horizontal
     * one — and hide those it places nowhere. A ruler whose strip collapsed is
     * null. Those `movable` refuses stay put under a press.
     */
    place(
        horizontal: RulerPlacement | null,
        vertical: RulerPlacement | null,
        text: RulerText | null,
        movable: (control: RulerControl) => boolean,
    ): void;
}

/** A control, and where the guide last placed it. */
interface Control {
    readonly el: HTMLElement;
    /** Which control it is. */
    readonly name: RulerControl;
    /** Whether it slides along the horizontal ruler or the vertical one. */
    readonly orient: "h" | "v";
    /** Half its box along its ruler, CSS px: from its position to the box's edge. */
    readonly half: number;
    /** The ruler it last stood on. */
    ruler: RulerPlacement | null;
    /** Where the guide placed it along its ruler, points from the ruler's zero,
     *  or null for nowhere. */
    points: number | null;
    /** The same, CSS px along the strip, on the tick there. */
    home: number | null;
    /** The page's span along its ruler, CSS px — where a drag keeps it. */
    page: { readonly start: number; readonly end: number } | null;
}

/** A tab stop's control, and the mark it shows. */
interface TabControl {
    readonly control: Control;
    readonly mark: SVGPathElement;
    readonly point: SVGRectElement;
}

/** A drag on a control. */
interface Drag {
    readonly pointerId: number;
    /** The pointer's client position along the ruler at the press. */
    readonly from: number;
    /** The ruler the pressed control stands on. */
    readonly ruler: RulerPlacement;
    /** Where the pressed control stood at the press, points and CSS px. */
    readonly points: number;
    readonly home: number;
    /** What the drag carries, the pressed control among them, each from where it
     *  stood at the press. */
    readonly carried: readonly { readonly control: Control; readonly from: number }[];
    /** How far it may carry them each way and keep the pressed one on the page. */
    readonly min: number;
    readonly max: number;
    /** How far it has carried them, in points. */
    by: number;
}

/** An SVG `width` × `height` CSS px in `el`, its one path drawn by `d`. */
function svg(el: HTMLElement, width: number, height: number, d: string): SVGPathElement {
    const s = document.createElementNS(SVG_NS, "svg");
    s.setAttribute("width", String(width));
    s.setAttribute("height", String(height));
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    s.append(path);
    el.append(s);
    return path;
}

/** Move `c` to `at` along its ruler. */
function move(c: Control, at: number): void {
    if (c.orient === "h") c.el.style.left = `${at - c.half}px`;
    else c.el.style.top = `${at - c.half}px`;
}

/** Return `c` to where the guide placed it, or hide it where it placed it nowhere. */
function settle(c: Control): void {
    c.el.style.display = c.home === null ? "none" : "";
    if (c.home !== null) move(c, c.home);
}

/** The ruler's controls for a ruler `thickness` CSS px deep, handing what a
 *  drop moved to `drop` — the edit it sends, settling when that is done, or
 *  `null` for none, which returns the controls to where they stood. */
export function createRulerControls(
    thickness: number,
    drop: (drop: RulerDrop) => Promise<unknown> | null,
): RulerControls {
    let drag: Drag | null = null;
    /** The controls a drop left where it left them, until its edit is done. */
    let held = new Set<Control>();
    /** Whether that edit is done, so the next frame settles them. */
    let released = false;

    /** Make control `name` of `className`, and let a drag take it. */
    const control = (name: RulerControl, className: string, orient: "h" | "v", half: number): Control => {
        const el = document.createElement("div");
        el.className = `udoc-ui__ruler-control ${className}`;
        const c: Control = { el, name, orient, half, ruler: null, points: null, home: null, page: null };
        grab(c);
        return c;
    };
    /** A margin's `edge`: the strip it is grabbed by, the full depth of its
     *  ruler, over the line the band's canvas draws for it. */
    const edge = (edge: RulerEdge): Control => {
        const orient = edge === "left" || edge === "right" ? "h" : "v";
        return control(
            { kind: "margin", edge },
            `udoc-ui__ruler-edge udoc-ui__ruler-edge--${orient}`,
            orient,
            EDGE_HALF,
        );
    };
    /** Indent marker `indent` drawn by `d`, in a box the full depth of the
     *  ruler that takes a press only on the shape — the edge under it takes the
     *  rest. */
    const indent = (indent: RulerIndent, d: string): Control => {
        const c = control(
            { kind: "indent", indent },
            "udoc-ui__ruler-marker udoc-ui__ruler-marker--indent",
            "h",
            INDENT_HALF,
        );
        svg(c.el, INDENT_HALF * 2, thickness, d);
        return c;
    };
    /** The tab stop at `index`, its mark's foot level with the hanging indent's
     *  base. */
    const tab = (index: number): TabControl => {
        const c = control({ kind: "tab", index }, "udoc-ui__ruler-marker udoc-ui__ruler-marker--tab", "h", TAB_HALF);
        c.el.style.top = `${thickness - 12}px`;
        const mark = svg(c.el, TAB_HALF * 2, 6, TAB_MARKS.left);
        const point = document.createElementNS(SVG_NS, "rect");
        point.setAttribute("x", "6");
        point.setAttribute("y", "2");
        point.setAttribute("width", "1");
        point.setAttribute("height", "1");
        mark.after(point);
        return { control: c, mark, point };
    };

    // The margins' edges come first, so the markers standing on one take a
    // press on their shapes, and the edge the press beside them.
    const leftMargin = edge("left");
    const rightMargin = edge("right");
    const topMargin = edge("top");
    const bottomMargin = edge("bottom");
    // The left indent's box sits a pixel above the ruler's baseline, the
    // hanging indent's triangle stands on it, and the first-line indent's hangs
    // from the outer edge to meet it tip to tip; the right indent's stands
    // level with the hanging indent's.
    const floor = thickness - 1.5;
    const base = floor - INDENT_BOX;
    const tip = (base + 0.5) / 2;
    const right = INDENT_HALF * 2 - 0.5;
    const standing = `M0.5 ${base}L${INDENT_HALF} ${tip}L${right} ${base}Z`;
    const firstLine = indent("firstLine", `M0.5 0.5H${right}L${INDENT_HALF} ${tip}Z`);
    const hanging = indent("hanging", standing);
    const leftIndent = indent("left", `M0.5 ${base}H${right}V${floor}H0.5Z`);
    const rightIndent = indent("right", standing);
    const tabs: TabControl[] = [];
    /** The dashed line a drag draws across the content pane at the pressed
     *  control — down from the horizontal ruler, across from the vertical. */
    const line = document.createElement("div");
    line.style.display = "none";

    /** Draw the drag's line at `at` along `c`'s ruler, or with null, clear it. */
    function drawLine(c: Control, at: number | null): void {
        line.style.display = at === null ? "none" : "";
        if (at === null) return;
        line.className = `udoc-ui__ruler-guide udoc-ui__ruler-guide--${c.orient}`;
        // Its 1px dash centred on the control.
        line.style.left = c.orient === "h" ? `${at - 0.5}px` : "";
        line.style.top = c.orient === "v" ? `${at - 0.5}px` : "";
    }

    /** What a drag on `c` carries, as Word's ruler does: the left indent's box
     *  both triangles above it, the hanging indent's triangle the box, a
     *  margin's edge the markers measured from it — the left the indents and
     *  tab stops, the right the right indent. */
    function carriedBy(c: Control): Control[] {
        if (c === leftIndent) return [firstLine, hanging, leftIndent];
        if (c === hanging) return [hanging, leftIndent];
        if (c === leftMargin) return [leftMargin, firstLine, hanging, leftIndent, ...tabs.map((t) => t.control)];
        if (c === rightMargin) return [rightMargin, rightIndent];
        return [c];
    }

    /** Let the controls a drop held go back to where the guide stands them. */
    function release(): void {
        released = false;
        const was = held;
        held = new Set();
        for (const c of was) settle(c);
    }

    function grab(c: Control): void {
        const along = (ev: PointerEvent): number => (c.orient === "h" ? ev.clientX : ev.clientY);
        c.el.addEventListener("pointerdown", (ev) => {
            if (drag || held.size > 0 || ev.button !== 0) return;
            if (c.home === null || c.points === null || !c.page || !c.ruler) return;
            ev.preventDefault();
            ev.stopPropagation();
            c.el.setPointerCapture(ev.pointerId);
            const carried = carriedBy(c).flatMap((k) => (k.home === null ? [] : [{ control: k, from: k.home }]));
            drag = {
                pointerId: ev.pointerId,
                from: along(ev),
                ruler: c.ruler,
                points: c.points,
                home: c.home,
                carried,
                min: c.page.start - c.home,
                max: c.page.end - c.home,
                by: 0,
            };
            c.el.classList.add("udoc-ui__ruler-control--dragging");
            drawLine(c, c.home);
        });
        c.el.addEventListener("pointermove", (ev) => {
            if (drag?.pointerId !== ev.pointerId) return;
            const { ruler } = drag;
            // Where it lands, in points from the ruler's zero — on the nearest
            // sixteenth of an inch unless Alt is held.
            const free = drag.points + (along(ev) - drag.from) / ruler.scale;
            const to = ev.altKey ? free : Math.round(free / SNAP) * SNAP;
            const target = ruler.origin + to * ruler.scale - drag.home;
            const offset = Math.min(drag.max, Math.max(drag.min, target));
            drag.by = offset === target ? to - drag.points : offset / ruler.scale;
            // Whole device pixels, so the shapes keep their crisp strokes.
            const dpr = globalThis.devicePixelRatio || 1;
            const shown = Math.round(offset * dpr) / dpr;
            for (const { control, from } of drag.carried) move(control, from + shown);
            drawLine(c, drag.home + shown);
        });
        const end = (ev: PointerEvent): void => {
            if (drag?.pointerId !== ev.pointerId) return;
            const { carried, by } = drag;
            drag = null;
            c.el.classList.remove("udoc-ui__ruler-control--dragging");
            drawLine(c, null);
            // A cancelled gesture drops nothing.
            const sent = by !== 0 && ev.type === "pointerup" ? drop({ control: c.name, by }) : null;
            if (!sent) {
                for (const { control } of carried) settle(control);
                return;
            }
            held = new Set(carried.map(({ control }) => control));
            void sent.finally(() => {
                released = true;
                setTimeout(() => {
                    if (released) release();
                }, HOLD);
            });
        };
        c.el.addEventListener("pointerup", end);
        c.el.addEventListener("pointercancel", end);
        c.el.addEventListener("lostpointercapture", end);
    }

    return {
        place(horizontal, vertical, text, movable) {
            /** The page's span along `ruler`, CSS px. */
            const pageOf = (ruler: RulerPlacement | null) =>
                ruler && { start: ruler.at(ruler.axis.page.start), end: ruler.at(ruler.axis.page.end) };
            const pages = { h: pageOf(horizontal), v: pageOf(vertical) };
            const pane = (horizontal ?? vertical)?.pane;
            if (pane && line.parentElement !== pane) pane.append(line);
            /** Place `c` at `points` along `ruler`, or nowhere for none — but
             *  leave it where a drag carries it, or a drop left it. */
            const stand = (c: Control, ruler: RulerPlacement | null, points: number | null | undefined): void => {
                if (ruler && c.el.parentElement !== ruler.layer) ruler.layer.append(c.el);
                c.ruler = ruler;
                c.points = ruler && points != null ? points : null;
                c.home = ruler && points != null ? ruler.at(points) : null;
                c.page = pages[c.orient];
                c.el.classList.toggle("udoc-ui__ruler-control--fixed", !movable(c.name));
                if (!drag?.carried.some((k) => k.control === c) && !held.has(c)) settle(c);
            };
            // The edit a drop sent is done, and this frame is what it brought.
            if (released) release();
            stand(leftMargin, horizontal, horizontal?.axis.margins?.start);
            stand(rightMargin, horizontal, horizontal?.axis.margins?.end);
            stand(topMargin, vertical, vertical?.axis.margins?.start);
            stand(bottomMargin, vertical, vertical?.axis.margins?.end);
            stand(firstLine, horizontal, text?.firstLine);
            stand(hanging, horizontal, text?.left);
            stand(leftIndent, horizontal, text?.left);
            stand(rightIndent, horizontal, text?.right);
            const stops = text?.tabs ?? [];
            while (tabs.length < stops.length) tabs.push(tab(tabs.length));
            tabs.forEach((t, i) => {
                const stop = stops[i];
                if (stop) {
                    t.mark.setAttribute("d", TAB_MARKS[stop.alignment]);
                    t.point.style.display = stop.alignment === "decimal" ? "" : "none";
                }
                stand(t.control, horizontal, stop?.position);
            });
        },
    };
}
