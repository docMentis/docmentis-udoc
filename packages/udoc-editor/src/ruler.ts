// The page ruler: a measurement band along the top and left of a paged
// document in edit mode — a user preference, on by default, and hidden in a
// reading pose, which needs no measurement chrome. The engine projects, each
// painted frame, where each ruler's origin falls and what it measures from it
// in points: the page, and while a caret edits text, that text's margins and
// its indents and tab stops. This graduates the rulers at the frame's zoom and
// draws them into the bands udoc-ui reserves, over the span the selection
// covers on each axis.
import type { Guide, RulerAxis, RulerTab, RulerText, UDocType } from "@docmentis/udoc-wasm";
import type { Action, BandCanvas, GuideBand, Store, UIState } from "@docmentis/udoc-ui/internal";
import { editState, updateEditState } from "./state.js";

/** The ruler arm of the engine's guide projection. */
type RulerGuide = Extract<Guide, { type: "ruler" }>;

/** The doc types the engine measures with a ruler: the paged ones. */
const RULED: ReadonlySet<UDocType> = new Set<UDocType>(["portable", "presentation", "wordprocessing"]);

/** A screen-fixed UI font for the labels — not the document's fonts. */
const UI_FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`;

/** Points per inch — the unit the rulers count in. */
const POINTS_PER_INCH = 72;
/** The subdivisions of an inch a ruler can tick, finest first. */
const SUBDIVISIONS = [8, 4, 2, 1];
/** How many inches apart the figures can stand, nearest first. */
const FIGURE_STEPS = [1, 2, 5, 10, 20, 50];
/** The closest two ticks stand, CSS px: a finer subdivision drops out below it. */
const MIN_TICK_GAP = 6;
/** The closest two figures stand, CSS px: a wider step takes over below it. */
const MIN_FIGURE_GAP = 24;

function stroke(ctx: CanvasRenderingContext2D, color: string, x0: number, y0: number, x1: number, y1: number): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
}

/** `x` on a pixel's centre, so a straight edge through it strokes crisp. */
function crisp(x: number): number {
    return Math.floor(x) + 0.5;
}

/**
 * Draw one ruler into its strip, `length` CSS px long and `thickness` deep: the
 * selection's span and the margins of the text a caret edits behind it, then
 * its graduation over the page — and on the horizontal one, the `text`'s
 * indent and tab markers.
 */
function drawAxis(
    canvas: BandCanvas,
    ctx: CanvasRenderingContext2D,
    axis: RulerAxis,
    text: RulerText | null,
    length: number,
    thickness: number,
    orient: "h" | "v",
): void {
    const { colors, extent, scale } = canvas;
    // Shift the horizontal ruler's marks (along x) to ride the content canvas
    // mid-resize; the vertical ruler tracks height, which isn't shifted. See
    // `GuideBands.setContentShift`. `0` when settled.
    const shift = orient === "h" ? canvas.shiftX : 0;
    ctx.save();
    ctx.translate(shift, 0);
    /** Where `points` from the origin falls in the strip, CSS px. */
    const at = (points: number): number => axis.origin + points * scale;
    const span = (from: number, to: number, color: string): void => {
        if (to <= from) return;
        ctx.fillStyle = color;
        if (orient === "h") ctx.fillRect(from, 0, to - from, thickness);
        else ctx.fillRect(0, from, thickness, to - from);
    };
    // The selection's span lights up behind the marks; while a caret edits
    // text, its text area does, between the darker margins of the page. All
    // ride the shift with the marks, so they keep their reading against them.
    if (extent) {
        if (orient === "h") span(extent.x0, extent.x1, colors.range);
        else span(extent.y0, extent.y1, colors.range);
    }
    const { page, margins } = axis;
    if (margins) {
        span(at(page.start), at(margins.start), colors.margin);
        span(at(margins.start), at(margins.end), colors.range);
        span(at(margins.end), at(page.end), colors.margin);
    }
    // Graduate the page in inches, as finely as the zoom leaves room for, the
    // figures counting outward from the origin — only where the strip shows.
    const inch = POINTS_PER_INCH * scale;
    const subdivisions = SUBDIVISIONS.find((n) => inch / n >= MIN_TICK_GAP) ?? 1;
    const figureStep = FIGURE_STEPS.find((n) => inch * n >= MIN_FIGURE_GAP) ?? FIGURE_STEPS[FIGURE_STEPS.length - 1]!;
    const step = POINTS_PER_INCH / subdivisions;
    const from = Math.max(page.start, (-shift - axis.origin) / scale);
    const to = Math.min(page.end, (length - shift - axis.origin) / scale);
    const size = Math.min(11, Math.max(8, thickness * 0.5));
    ctx.font = `${size}px ${UI_FONT}`;
    const inchLen = thickness * 0.3;
    const figCenter = (thickness - inchLen) / 2;
    ctx.fillStyle = colors.text;
    for (let n = Math.ceil(from / step); n <= Math.floor(to / step); n++) {
        const p = at(n * step);
        // An inch, a half, a quarter or an eighth — each a shorter tick.
        const len =
            n % subdivisions === 0
                ? inchLen
                : n % (subdivisions / 2) === 0
                  ? thickness * 0.22
                  : n % (subdivisions / 4) === 0
                    ? thickness * 0.16
                    : thickness * 0.1;
        // Ticks hang from the inner (content) edge toward the outer, on the
        // soft `grid` they share with the ruler edge and the header separators.
        if (orient === "h") stroke(ctx, colors.grid, p, thickness, p, thickness - len);
        else stroke(ctx, colors.grid, thickness, p, thickness - len, p);
        const inches = n / subdivisions;
        if (n % subdivisions === 0 && inches % figureStep === 0) {
            const figure = String(Math.abs(inches));
            if (orient === "h") ctx.fillText(figure, p, figCenter);
            else ctx.fillText(figure, figCenter, p);
        }
    }
    if (text) drawText(canvas, ctx, text, at, thickness);
    ctx.restore();
}

/** Half an indent marker's width, CSS px. */
const MARKER_HALF = 4;
/** How far an indent marker's triangle reaches from its base, CSS px. */
const MARKER_TIP = 5;
/** The height of the box under the left indent's triangle, CSS px. */
const MARKER_BOX = 4;
/** Half a tab mark's foot, and the height of its stem, CSS px. */
const TAB_HALF = 3.5;
const TAB_STEM = 5;
/** The length of a default tab stop's tick, CSS px. */
const DEFAULT_TAB_TICK = 2;

/**
 * Draw the markers of the `text` a caret edits on the horizontal ruler, as
 * Word does: the first-line indent's triangle hanging from the band's outer
 * edge, and toward its inner edge the left indent's triangle standing on a box,
 * the right indent's on its own, each tab stop's mark and, past the last of
 * them, the default stops' ticks. `at` places points from the origin.
 */
function drawText(
    canvas: BandCanvas,
    ctx: CanvasRenderingContext2D,
    text: RulerText,
    at: (points: number) => number,
    thickness: number,
): void {
    const { colors } = canvas;
    const floor = thickness - 1.5;
    const base = floor - MARKER_BOX;
    // The default stops: a tick on the inner edge at each, past the explicit
    // stops and short of the right indent — the grid the text tabs to there.
    const last = text.tabs.reduce((max, tab) => Math.max(max, tab.position), 0);
    if (text.defaultTab > 0) {
        for (let p = (Math.floor(last / text.defaultTab) + 1) * text.defaultTab; p < text.right; p += text.defaultTab) {
            const x = crisp(at(p));
            stroke(ctx, colors.marker, x, thickness, x, thickness - DEFAULT_TAB_TICK);
        }
    }
    for (const tab of text.tabs) drawTab(ctx, colors.text, tab, crisp(at(tab.position)), base);
    // The indent markers, filled with the light `range` and outlined in the
    // strong `marker`.
    ctx.fillStyle = colors.range;
    ctx.strokeStyle = colors.marker;
    ctx.lineWidth = 1;
    ctx.lineJoin = "round";
    const shape = (points: readonly (readonly [number, number])[]): void => {
        ctx.beginPath();
        for (const [x, y] of points) ctx.lineTo(x, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    };
    const standing = (x: number): void =>
        shape([
            [x - MARKER_HALF, base],
            [x, base - MARKER_TIP],
            [x + MARKER_HALF, base],
        ]);
    standing(crisp(at(text.right)));
    const left = crisp(at(text.left));
    standing(left);
    shape([
        [left - MARKER_HALF, base],
        [left + MARKER_HALF, base],
        [left + MARKER_HALF, floor],
        [left - MARKER_HALF, floor],
    ]);
    const first = crisp(at(text.firstLine));
    const top = 0.5;
    shape([
        [first - MARKER_HALF, top],
        [first + MARKER_HALF, top],
        [first, top + MARKER_TIP],
    ]);
}

/**
 * Draw `tab`'s mark at `x`, standing on `base`, as Word does: a stem, and a
 * foot running the way the text runs from the stop — right of a left stop,
 * left of a right one, both ways under a center or a decimal one (a decimal's
 * point beside its stem) — or for a bar, the stem alone.
 */
function drawTab(ctx: CanvasRenderingContext2D, color: string, tab: RulerTab, x: number, base: number): void {
    const foot = crisp(base) - 1;
    stroke(ctx, color, x, foot, x, foot - TAB_STEM);
    const { alignment } = tab;
    if (alignment === "bar") return;
    const start = alignment === "right" || alignment === "center" || alignment === "decimal" ? x - TAB_HALF : x;
    const end = alignment === "left" || alignment === "center" || alignment === "decimal" ? x + TAB_HALF : x;
    stroke(ctx, color, start, foot, end, foot);
    if (alignment === "decimal") {
        ctx.fillStyle = color;
        ctx.fillRect(x + 1.5, foot - 3, 1, 1);
    }
}

/**
 * Fill the ruler's corner box and mark only the junction dot — the single
 * pixel both the top ruler's bottom edge and the left ruler's right edge pass
 * through, which each stops just short of, leaving the corner open. Unlike the
 * header the ruler frames only its content-facing edge and has no grid to
 * continue, so the corner takes the meeting point alone rather than edges drawn
 * across the box.
 */
function drawCorner(canvas: BandCanvas): void {
    const corner = canvas.prepare("corner");
    if (!corner) return;
    const { ctx, w, h } = corner;
    ctx.fillStyle = canvas.colors.grid;
    ctx.fillRect(w - 1, h - 1, 1, 1);
}

function drawRuler(guide: RulerGuide, canvas: BandCanvas): void {
    const { colors } = canvas;
    const top = canvas.prepare("top");
    if (top) {
        drawAxis(canvas, top.ctx, guide.horizontal, guide.text ?? null, top.w, top.h, "h");
        // The ruler's inner (content-facing) edge line — a baseline the ticks
        // hang from, framing the ruler off the page below (mirrors the header
        // band's bottom border). The same soft `grid` as the ticks.
        stroke(top.ctx, colors.grid, 0, top.h - 0.5, top.w, top.h - 0.5);
    }
    const left = canvas.prepare("left");
    if (left) {
        drawAxis(canvas, left.ctx, guide.vertical, null, left.h, left.w, "v");
        stroke(left.ctx, colors.grid, left.w - 0.5, 0, left.w - 0.5, left.h);
    }
    drawCorner(canvas);
}

/** The ruler band. Paints only a ruler projection; any other leaves the strips
 *  cleared to their band background until one lands. */
export const RULER: GuideBand = {
    thickness: 22,
    draw(guide, canvas) {
        if (guide.type === "ruler") drawRuler(guide, canvas);
    },
};

/** Whether the ruler shows in `state`: a ruled doc type in edit mode, with the
 *  preference on. */
export function rulerShown(state: UIState): boolean {
    return editState(state).showRuler && state.mode === "edit" && state.docType !== null && RULED.has(state.docType);
}

/** Show or hide the ruler in `store` — a user preference, kept across documents. */
export function setShowRuler(store: Store<UIState, Action>, visible: boolean): void {
    updateEditState(store, { showRuler: visible });
}
