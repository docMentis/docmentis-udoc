// The page ruler: a measurement band along the top and left of a paged
// document in edit mode — a user preference, on by default, and hidden in a
// reading pose, which needs no measurement chrome. The engine projects its
// marks each painted frame; this draws them into the bands udoc-ui reserves.
import type { Guide, RulerAxis, UDocType } from "@docmentis/udoc-wasm";
import type { Action, BandCanvas, GuideBand, Store, UIState } from "@docmentis/udoc-ui/internal";
import { editState, updateEditState } from "./state.js";

/** The ruler arm of the engine's guide projection. */
type RulerGuide = Extract<Guide, { type: "ruler" }>;

/** The doc types the engine measures with a ruler: the paged ones. */
const RULED: ReadonlySet<UDocType> = new Set<UDocType>(["portable", "presentation", "wordprocessing"]);

/** A screen-fixed UI font for the labels — not the document's fonts. */
const UI_FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`;

function stroke(ctx: CanvasRenderingContext2D, color: string, x0: number, y0: number, x1: number, y1: number): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
}

function drawAxis(
    canvas: BandCanvas,
    ctx: CanvasRenderingContext2D,
    axis: RulerAxis,
    thickness: number,
    orient: "h" | "v",
): void {
    const { colors } = canvas;
    const size = Math.min(11, Math.max(8, thickness * 0.5));
    ctx.font = `${size}px ${UI_FONT}`;
    const majorLen = thickness * 0.3;
    const minorLen = thickness * 0.16;
    const figCenter = (thickness - majorLen) / 2;
    // Shift the horizontal ruler's marks (along x) to ride the content canvas
    // mid-resize; the vertical ruler tracks height, which isn't shifted. See
    // `GuideBands.setContentShift`. `0` when settled.
    ctx.save();
    if (orient === "h") ctx.translate(canvas.shiftX, 0);
    for (const m of axis.marks) {
        const len = m.major ? majorLen : minorLen;
        const p = m.position;
        // Ticks hang from the inner (content) edge toward the outer, on the
        // soft `grid` they share with the ruler edge and the header separators.
        if (orient === "h") stroke(ctx, colors.grid, p, thickness, p, thickness - len);
        else stroke(ctx, colors.grid, thickness, p, thickness - len, p);
        if (m.label != null) {
            ctx.fillStyle = colors.text;
            if (orient === "h") ctx.fillText(m.label, m.position, figCenter);
            else ctx.fillText(m.label, figCenter, m.position);
        }
    }
    ctx.restore();
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
    if (top && guide.horizontal) {
        drawAxis(canvas, top.ctx, guide.horizontal, top.h, "h");
        // The ruler's inner (content-facing) edge line — a baseline the ticks
        // hang from, framing the ruler off the page below (mirrors the header
        // band's bottom border). The same soft `grid` as the ticks.
        stroke(top.ctx, colors.grid, 0, top.h - 0.5, top.w, top.h - 0.5);
    }
    const left = canvas.prepare("left");
    if (left && guide.vertical) {
        drawAxis(canvas, left.ctx, guide.vertical, left.w, "v");
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
