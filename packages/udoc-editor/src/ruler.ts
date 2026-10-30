// The page ruler: a measurement band along the top and left of a paged
// document in edit mode — a user preference, on by default, and hidden in a
// reading pose, which needs no measurement chrome. The engine projects, each
// painted frame, where each ruler's origin falls and what it measures from it
// in points: the page, and while a caret edits text, that text's margins and
// its indents and tab stops. This graduates the rulers at the frame's zoom and
// draws them into the bands udoc-ui reserves, over the span the selection
// covers on each axis, and stands the controls a drag takes — the margins'
// edges, the indent markers and the tab stops — over them (ruler-controls.ts),
// sending the edit a drop on one means (ruler-edits.ts).
import type { Guide, RulerAxis, UDocType } from "@docmentis/udoc-wasm";
import type { Action, BandCanvas, BandStrip, CommandDef, GuideBand, Store, UIState } from "@docmentis/udoc-ui/internal";
import type { EditHost } from "./edit-client.js";
import type { MessageKey } from "./i18n/index.js";
import { ICON_RULER } from "./icons.js";
import { createRulerControls } from "./ruler-controls.js";
import type { RulerControl, RulerControls, RulerDrop, RulerPlacement } from "./ruler-controls.js";
import { rulerEdit, rulerMovable } from "./ruler-edits.js";
import { editState, updateEditState } from "./state.js";

/** The ruler arm of the engine's guide projection. */
type RulerGuide = Extract<Guide, { type: "ruler" }>;

/** The doc types the engine measures with a ruler: the paged ones. */
export const RULED: ReadonlySet<UDocType> = new Set<UDocType>(["portable", "presentation", "wordprocessing"]);

/** The rulers' depth, top and left alike, CSS px. */
const THICKNESS = 22;

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

/** `v` CSS px along `ctx`'s `axis`, moved onto the nearest device pixel edge. */
function snap(ctx: CanvasRenderingContext2D, v: number, axis: "x" | "y"): number {
    const m = ctx.getTransform();
    const [k, offset] = axis === "x" ? [m.a, m.e] : [m.d, m.f];
    return (Math.round(v * k + offset) - offset) / k;
}

/**
 * Where a tick at `p` CSS px along the ruler stands: its `start` and `width`
 * along it in CSS px, whole device pixels — as many as a CSS px holds, one at
 * least — so every tick lands as sharp and as dark as the next however the
 * zoom and the dpr place it.
 */
function tickSpan(ctx: CanvasRenderingContext2D, p: number, orient: "h" | "v"): { start: number; width: number } {
    const k = ctx.getTransform().a;
    const width = Math.max(1, Math.round(k)) / k;
    return { start: snap(ctx, p - width / 2, orient === "h" ? "x" : "y"), width };
}

/** The centre of the tick at `p` — where a control standing on it centres. */
function tickCenter(ctx: CanvasRenderingContext2D, p: number, orient: "h" | "v"): number {
    const { start, width } = tickSpan(ctx, p, orient);
    return start + width / 2;
}

/** Fill a tick at `p`, `len` CSS px long, hanging from the inner edge of a strip
 *  `thickness` deep — its ends on device pixel edges too. */
function tick(
    ctx: CanvasRenderingContext2D,
    color: string,
    p: number,
    len: number,
    thickness: number,
    orient: "h" | "v",
): void {
    const { start, width } = tickSpan(ctx, p, orient);
    const across = orient === "h" ? "y" : "x";
    const top = snap(ctx, thickness - len, across);
    const bottom = snap(ctx, thickness, across);
    ctx.fillStyle = color;
    if (orient === "h") ctx.fillRect(start, top, width, bottom - top);
    else ctx.fillRect(top, start, bottom - top, width);
}

/**
 * Draw one ruler into its strip, `length` CSS px long and `thickness` deep: the
 * selection's span and the margins of the text a caret edits behind it, then
 * its graduation over the page.
 */
function drawAxis(
    canvas: BandCanvas,
    ctx: CanvasRenderingContext2D,
    axis: RulerAxis,
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
    // Each span ends on device pixel edges, so a margin's edge meets its fill
    // without a sliver of another between them.
    const span = (from: number, to: number, color: string): void => {
        const along = orient === "h" ? "x" : "y";
        const start = snap(ctx, from, along);
        const end = snap(ctx, to, along);
        if (end <= start) return;
        ctx.fillStyle = color;
        if (orient === "h") ctx.fillRect(start, 0, end - start, thickness);
        else ctx.fillRect(0, start, thickness, end - start);
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
        // Each margin's edge, a line the ruler's depth on the tick its fill
        // ends at, in the soft `grid` of the ticks — drawn here with the fills
        // it bounds, the strip a drag takes it by over it (ruler-controls.ts).
        tick(ctx, colors.grid, at(margins.start), thickness, thickness, orient);
        tick(ctx, colors.grid, at(margins.end), thickness, thickness, orient);
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
    for (let n = Math.ceil(from / step); n <= Math.floor(to / step); n++) {
        const p = at(n * step);
        // An inch, a half, or a short tick at each finer division — as Word
        // and Google Docs graduate, three lengths a glance tells apart.
        const len =
            n % subdivisions === 0 ? inchLen : n % (subdivisions / 2) === 0 ? thickness * 0.22 : thickness * 0.14;
        // Ticks hang from the inner (content) edge toward the outer, on the
        // soft `grid` they share with the ruler edge and the header separators.
        tick(ctx, colors.grid, p, len, thickness, orient);
        const inches = n / subdivisions;
        if (n % subdivisions === 0 && inches % figureStep === 0) {
            const figure = String(Math.abs(inches));
            const c = tickCenter(ctx, p, orient);
            ctx.fillStyle = colors.text;
            if (orient === "h") ctx.fillText(figure, c, figCenter);
            else ctx.fillText(figure, figCenter, c);
        }
    }
    ctx.restore();
}

/**
 * Where the controls stand along the ruler `axis` drew in `strip`: on its
 * ticks, riding the top ruler's shift with them (see {@link drawAxis}).
 */
function placement(canvas: BandCanvas, strip: BandStrip, axis: RulerAxis, orient: "h" | "v"): RulerPlacement {
    const shift = orient === "h" ? canvas.shiftX : 0;
    return {
        layer: canvas.layer(orient === "h" ? "top" : "left"),
        pane: canvas.layer("pane"),
        axis,
        origin: axis.origin + shift,
        scale: canvas.scale,
        at: (points) => tickCenter(strip.ctx, axis.origin + points * canvas.scale + shift, orient),
    };
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

/** Draw `guide`'s rulers into `canvas`'s strips, and stand `controls` over them,
 *  those `movable` refuses fixed. */
function drawRuler(
    guide: RulerGuide,
    canvas: BandCanvas,
    controls: RulerControls,
    movable: (control: RulerControl) => boolean,
): void {
    const { colors } = canvas;
    const top = canvas.prepare("top");
    if (top) {
        drawAxis(canvas, top.ctx, guide.horizontal, top.w, top.h, "h");
        // The ruler's inner (content-facing) edge line — a baseline the ticks
        // hang from, framing the ruler off the page below (mirrors the header
        // band's bottom border). The same soft `grid` as the ticks.
        stroke(top.ctx, colors.grid, 0, top.h - 0.5, top.w, top.h - 0.5);
    }
    const left = canvas.prepare("left");
    if (left) {
        drawAxis(canvas, left.ctx, guide.vertical, left.h, left.w, "v");
        stroke(left.ctx, colors.grid, left.w - 0.5, 0, left.w - 0.5, left.h);
    }
    drawCorner(canvas);
    controls.place(
        top && placement(canvas, top, guide.horizontal, "h"),
        left && placement(canvas, left, guide.vertical, "v"),
        guide.text ?? null,
        movable,
    );
}

/** The ruler band, with controls of its own — one per editor, whose edits run
 *  through the `host` edit mode lends once it is mounted. Paints only a ruler
 *  projection; any other leaves the strips cleared to their band background
 *  until one lands. */
export function createRuler(host: () => EditHost | null): GuideBand {
    /** The projection the controls last stood on — what a drop is read off. */
    let placed: RulerGuide | null = null;
    /** Send the edit `drop` means to the open document, as one undo step; null
     *  where it means none. */
    const drop = (drop: RulerDrop): Promise<void> | null => {
        const lent = host();
        const state = lent?.store.getState();
        const edit =
            placed && state?.docType && rulerEdit(drop, placed, state.docType, editState(state).selectionRuler);
        if (!lent || !edit) return null;
        return lent.commit(() => lent.client.executeOnSelection(edit));
    };
    const controls = createRulerControls(THICKNESS, drop);
    return {
        thickness: THICKNESS,
        draw(guide, canvas) {
            if (guide.type !== "ruler") return;
            placed = guide;
            const state = host()?.store.getState();
            const docType = state?.docType;
            const movable = (control: RulerControl): boolean =>
                !!state &&
                !!docType &&
                rulerMovable(control, guide, docType, state.selectionCaps, editState(state).selectionRuler);
            drawRuler(guide, canvas, controls, movable);
        },
    };
}

/** Whether the ruler shows in `state`: a ruled doc type in edit mode, with the
 *  preference on. */
export function rulerShown(state: UIState): boolean {
    return editState(state).showRuler && state.mode === "edit" && state.docType !== null && RULED.has(state.docType);
}

/** Show or hide the ruler in `store` — a user preference, kept across documents. */
export function setShowRuler(store: Store<UIState, Action>, visible: boolean): void {
    updateEditState(store, { showRuler: visible });
}

/** The Ruler toggle — a guide over the pages, on the View tab of a doc type
 *  edit mode rules (see {@link RULED}), live whatever is selected. */
export const RULER_COMMAND: CommandDef<MessageKey> = {
    id: "ruler",
    label: "command.ruler",
    icon: ICON_RULER,
    group: "guides",
    run: {
        kind: "toggle",
        pressed: (s) => editState(s).showRuler,
        press: (store) => setShowRuler(store, !editState(store.getState()).showRuler),
    },
    enabledWhen: (c) => c.ready,
};
