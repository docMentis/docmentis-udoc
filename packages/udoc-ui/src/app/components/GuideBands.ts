// The guide bands — a spreadsheet's row/column headers, or a band an extension
// draws (edit mode's measurement ruler) — drawn on three main-thread 2D
// canvases (corner, top, left) laid out by CSS grid around the content pane. The engine projects the
// chrome each painted frame as a resolved render list in CSS px (origin at the
// content pane's top-left), so a redraw per frame keeps the bands tracking
// scroll and zoom with zero coordinate math here. Colors follow the host theme.
//
// Reservation and content are separate concerns. `layout` reserves the band
// strips (the grid tracks) from host-static state — the doc type and the
// extension's band — with no dependence on a painted frame, so the strips exist before
// the first paint and the content pane is measured at its final size once (not
// full-size, then re-measured when the first guide lands). `render` then paints
// the per-frame projection into the already-reserved strips; a cleared strip
// falls back to its CSS band background until its content arrives.
//
// Static for now: the bands render but don't yet handle hover / resize /
// dropdowns / ruler markers — those compose over the same track list later.

import type { Guide, HeaderBands, HeaderCell, HeaderGuide, RgbColor } from "../../geometry.js";

/** One band strip, sized and filled, with a context that draws in CSS px. */
export interface BandStrip {
    readonly ctx: CanvasRenderingContext2D;
    readonly w: number;
    readonly h: number;
}

/** What a {@link GuideBand} paints with: the strips, and the bands' colors. */
export interface BandCanvas {
    /** The strip `which`, sized and filled with the band color — null when it
     *  collapsed to nothing. */
    prepare(which: "top" | "left" | "corner"): BandStrip | null;
    readonly colors: BandColors;
    /** How far the top band's marks ride the content canvas mid-resize, in CSS
     *  px — see {@link GuideBands.setContentShift}. */
    readonly shiftX: number;
}

/**
 * A band an extension draws around the content pane — edit mode's ruler —
 * reserved while the extension says it is shown, and painted from the engine's
 * per-frame guide projection.
 */
export interface GuideBand {
    /** The strip's thickness, top and left alike, in CSS px. */
    readonly thickness: number;
    /** Paint this frame's `guide` into the strips. */
    draw(guide: Guide, canvas: BandCanvas): void;
}

/** The band reserved — a spreadsheet's row/column headers, an extension's
 *  band, or `null` for none. Host-static; see {@link GuideBands.layout}. */
export type BandKind = "header" | GuideBand | null;

/** Header band thickness in CSS px — the strips the grid reserves. */
const HEADER_TOP = 20;
const HEADER_LEFT = 44;

/** A screen-fixed UI font for the labels — not the document's fonts. */
const UI_FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`;

export interface BandColors {
    band: string;
    /** The ruler's indent / tab-stop markers — reserved for a future ruler; not
     *  yet drawn. The strong end of the outline pair; every mark currently drawn
     *  uses the softer `grid` instead. */
    marker: string;
    text: string;
    /** The fill behind a selected column's / row's header (spreadsheet only). */
    highlight: string;
    /** Every structural line the band draws — the ruler's ticks and framing edge,
     *  and the spreadsheet header's cell grid and outer border. Soft by design;
     *  the stronger `marker` is held back for the future ruler markers. */
    grid: string;
}

const DEFAULT_COLORS: BandColors = {
    band: "#f1f2f4",
    marker: "#aaaaaa",
    text: "#404040",
    highlight: "#c9ddf7",
    grid: "#d4d6da",
};

export class GuideBands {
    readonly #root: HTMLElement;
    readonly #corner: HTMLCanvasElement;
    readonly #top: HTMLCanvasElement;
    readonly #left: HTMLCanvasElement;
    #colors: BandColors = DEFAULT_COLORS;
    /** The reserved band layout (host-static) — drives the grid tracks. */
    #kind: BandKind = null;
    /** The latest per-frame projection painted into the reserved bands. */
    #guide: Guide | null = null;
    /** The selected column / row header runs to tint (spreadsheet only), or
     *  `null` for no cell selection. Updated on a selection change, not per
     *  frame; combined with the per-frame {@link #guide} tracks in {@link #draw}. */
    #selection: HeaderBands | null = null;
    /** Horizontal shift (CSS px) applied to the top band's marks while a resize
     *  is in flight — see {@link setContentShift}. `0` when settled. */
    #shiftX = 0;

    constructor(
        root: HTMLElement,
        corner: HTMLCanvasElement,
        top: HTMLCanvasElement,
        left: HTMLCanvasElement,
    ) {
        this.#root = root;
        this.#corner = corner;
        this.#top = top;
        this.#left = left;
    }

    /** Recolor the bands to the host theme (five sRGB triples — band fill, the
     *  future markers' color, labels, the selected-header highlight, and the
     *  structural grid the ticks / separators / edges all share) and redraw. */
    setColors(band: RgbColor, marker: RgbColor, text: RgbColor, highlight: RgbColor, grid: RgbColor): void {
        this.#colors = { band: css(band), marker: css(marker), text: css(text), highlight: css(highlight), grid: css(grid) };
        this.#draw();
    }

    /**
     * Adopt the selected column / row header runs to tint (or `null` to clear),
     * and redraw. Driven by the selection stream, not the per-frame guide — a
     * cell selection changes no pixels the engine paints, so the band only learns
     * of it here — while scroll / zoom keeps riding {@link render}. Both meet in
     * {@link #draw}: the runs are matched against whichever guide tracks were last
     * painted.
     */
    setSelection(selection: HeaderBands | null): void {
        this.#selection = selection;
        this.#draw();
    }

    /**
     * Reserve (or clear, when `null`) the band strips for `kind`. This is the
     * host-static half — the grid tracks — resolved from the doc type and the
     * extension's band, with no dependence on a painted frame. Set it up front
     * (before the first measure) so the content pane is sized once; a later
     * change (a band toggled, a new document) re-reserves and the viewport
     * follows. Painting the strips' content is {@link render}.
     */
    layout(kind: BandKind): void {
        if (kind === this.#kind) return;
        this.#kind = kind;
        this.#draw();
    }

    /** The band reserved now — what the last {@link layout} laid out. */
    get kind(): BandKind {
        return this.#kind;
    }

    /**
     * Paint the per-frame `guide` projection into the already-reserved bands
     * (see {@link layout}). A payload that doesn't match the reserved kind — or a
     * `null`, during a transient with no current page — leaves the reserved strip
     * cleared (its CSS band background shows) rather than collapsing it, so the
     * content pane never jumps between frames.
     */
    render(guide: Guide | null): void {
        this.#guide = guide;
        this.#draw();
    }

    /**
     * Slide the column ruler / headers horizontally by `shiftX` CSS px to ride the
     * content canvas while a resize is in flight — the band's twin of the content
     * canvas's maintain-size-and-shift (Canvas' `applyCanvasTransform`). The
     * content canvas keeps its pre-resize backing and shifts to stay centred as
     * the host animates, while the worker repaint — and so the next {@link render}
     * — is debounced; without matching the shift here the ticks would sit frozen
     * while the page slides beneath them, detaching ("stretching") the ruler from
     * the page until the resize settles. Only the marks shift, not the band's own
     * background / frame; the left (row) band isn't shifted, matching the content
     * canvas's horizontal-only centring. Driven each resize frame from the same
     * `applyCanvasTransform`, and reset to `0` once the size settles.
     */
    setContentShift(shiftX: number): void {
        const s = Math.abs(shiftX) < 0.5 ? 0 : shiftX; // settled (or sub-pixel) — no drift
        if (s === this.#shiftX) return;
        this.#shiftX = s;
        this.#draw();
    }

    /**
     * The column-header track whose **right edge** (the boundary a resize drags)
     * sits within `tol` CSS px of band-local `x`, or `null` when the last guide
     * isn't a header or none is near. `x` is content-pane-relative — the same
     * space {@link HeaderCell.start}/`end` and Canvas's `bandPoint` speak.
     * `index` is the column left of the boundary (the one a drag resizes),
     * `start` its near edge and `pos` the boundary (its far edge), both CSS x —
     * so the host places the col-resize cursor, the drag guide, and reads the
     * new width as `pointer − start`. Read-only.
     */
    columnBoundaryAt(x: number, tol: number): Boundary | null {
        const guide = this.#guide;
        if (guide?.type !== "header") return null;
        return boundaryAt(guide.columns, x, tol);
    }

    /**
     * The row-header track whose **bottom edge** sits within `tol` CSS px of
     * band-local `y` — the row-axis mirror of {@link columnBoundaryAt}.
     */
    rowBoundaryAt(y: number, tol: number): Boundary | null {
        const guide = this.#guide;
        if (guide?.type !== "header") return null;
        return boundaryAt(guide.rows, y, tol);
    }

    #draw(): void {
        const kind = this.#kind;
        // Reserve the strips via the grid tracks; setting them lays the band
        // canvases out at their content-aligned sizes before we read their box.
        // Idempotent per frame — the same value doesn't resize, so re-painting
        // never re-measures the viewport.
        const top = kind === "header" ? HEADER_TOP : (kind?.thickness ?? 0);
        const left = kind === "header" ? HEADER_LEFT : (kind?.thickness ?? 0);
        this.#root.style.setProperty("--udoc-band-top", `${top}px`);
        this.#root.style.setProperty("--udoc-band-left", `${left}px`);
        clear(this.#corner);
        clear(this.#top);
        clear(this.#left);
        if (kind === null) return;
        // Paint only a payload that matches the reserved band; otherwise the
        // strip stays cleared to its CSS background until its content lands.
        const guide = this.#guide;
        if (kind === "header") {
            if (guide?.type === "header") this.#drawHeader(guide);
        } else if (guide) {
            kind.draw(guide, {
                prepare: (which) =>
                    this.#prepare(which === "top" ? this.#top : which === "left" ? this.#left : this.#corner),
                colors: this.#colors,
                shiftX: this.#shiftX,
            });
        }
    }

    /**
     * Size a band canvas's backing store to its laid-out CSS box × dpr, fill it
     * with the band color, and return a context transformed to draw in CSS px —
     * or `null` when the band collapsed to nothing.
     */
    #prepare(canvas: HTMLCanvasElement): BandStrip | null {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (w <= 0 || h <= 0) return null;
        const dpr = globalThis.devicePixelRatio || 1;
        canvas.width = Math.max(1, Math.round(w * dpr));
        canvas.height = Math.max(1, Math.round(h * dpr));
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        // Pin drawing to the physical device-pixel grid — the same sub-pixel snap
        // the content canvas applies (Canvas' applyCanvasTransform) — so a divider
        // lands on the exact physical column the gridline painted on, at any dpr
        // or fractional layout offset. `0` at integer dpr with integer layout.
        const rect = canvas.getBoundingClientRect();
        const sx = Math.round(rect.left * dpr) - rect.left * dpr;
        const sy = Math.round(rect.top * dpr) - rect.top * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, sx, sy);
        ctx.fillStyle = this.#colors.band;
        // Overfill by a pixel so the sub-pixel shift leaves no uncovered sliver
        // (the canvas's CSS band background would show there anyway).
        ctx.fillRect(-1, -1, w + 2, h + 2);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        return { ctx, w, h };
    }

    /**
     * Fill the header's corner box and carry the frame across it — its bottom and
     * right edges continue the column header's bottom border and the row header's
     * right border to their junction. Without it the two stop at the corner's near
     * sides, leaving an open notch. Both edges are colinear with the bands' (the
     * corner shares their thickness), so this fills in the missing corner-width
     * segment; the corner reads as the header grid's own top-left cell.
     */
    #drawHeaderCorner(): void {
        const corner = this.#prepare(this.#corner);
        if (!corner) return;
        const { ctx, w, h } = corner;
        stroke(ctx, this.#colors.grid, 0, h - 0.5, w, h - 0.5);
        stroke(ctx, this.#colors.grid, w - 0.5, 0, w - 0.5, h);
    }

    #drawHeader(guide: HeaderGuide): void {
        this.#drawHeaderCorner();
        const sel = this.#selection;
        const top = this.#prepare(this.#top);
        if (top) {
            const { ctx, w, h } = top;
            // Shift the column tracks (not the band chrome) to ride the content
            // canvas mid-resize; `0` when settled. See setContentShift.
            ctx.save();
            ctx.translate(this.#shiftX, 0);
            // Tint the selected columns' headers behind the separators and labels
            // (a cell block, or a whole-column run). Matched by track index against
            // the same cells drawn below, so the fill lands exactly on them.
            if (sel) {
                ctx.fillStyle = this.#colors.highlight;
                for (const c of guide.columns) {
                    if (c.index >= sel.columnStart && c.index <= sel.columnEnd) {
                        ctx.fillRect(c.start, 0, c.end - c.start, h);
                    }
                }
            }
            const size = labelSize(h);
            ctx.font = `${size}px ${UI_FONT}`;
            for (const c of guide.columns) {
                // Draw at the exact projected edge (the engine's snapped scroll
                // grid did the pixel alignment); re-rounding here would drift it
                // off the gridline the content canvas painted at the same x. The
                // separators are the header's own cell grid — the soft `grid`,
                // shared with the band's outer border and the ruler's ticks.
                stroke(ctx, this.#colors.grid, c.start, 0, c.start, h);
                if (c.end - c.start >= size * 0.8) {
                    ctx.fillStyle = this.#colors.text;
                    ctx.fillText(c.label, (c.start + c.end) / 2, h / 2);
                }
            }
            ctx.restore();
            // The band's bottom border, framing the header off the cells below.
            // Drawn unshifted — it's band chrome that spans the full strip, not a
            // track — and on the same soft `grid` as the separators.
            stroke(ctx, this.#colors.grid, 0, h - 0.5, w, h - 0.5);
        }
        const left = this.#prepare(this.#left);
        if (left) {
            const { ctx, w, h } = left;
            if (sel) {
                ctx.fillStyle = this.#colors.highlight;
                for (const r of guide.rows) {
                    if (r.index >= sel.rowStart && r.index <= sel.rowEnd) {
                        ctx.fillRect(0, r.start, w, r.end - r.start);
                    }
                }
            }
            const size = labelSize(HEADER_TOP);
            ctx.font = `${size}px ${UI_FONT}`;
            for (const r of guide.rows) {
                stroke(ctx, this.#colors.grid, 0, r.start, w, r.start);
                if (r.end - r.start >= size * 0.9) {
                    ctx.fillStyle = this.#colors.text;
                    ctx.fillText(r.label, w / 2, (r.start + r.end) / 2);
                }
            }
            stroke(ctx, this.#colors.grid, w - 0.5, 0, w - 0.5, h);
        }
    }
}

/** A resize boundary the host acts on: the track `index` left of the edge, its
 *  near edge `start` and the boundary `pos` (its far edge) — all CSS px. */
export interface Boundary {
    index: number;
    start: number;
    pos: number;
}

/** The track in `cells` whose far edge (`end`) is nearest `pos` and within `tol`
 *  CSS px, or `null` when none qualifies. Nearest-wins when two adjacent edges
 *  both fall in tolerance (a collapsed / hidden track). */
function boundaryAt(cells: HeaderCell[], pos: number, tol: number): Boundary | null {
    let best: Boundary | null = null;
    let bestDist = tol;
    for (const cell of cells) {
        const dist = Math.abs(cell.end - pos);
        if (dist <= bestDist) {
            best = { index: cell.index, start: cell.start, pos: cell.end };
            bestDist = dist;
        }
    }
    return best;
}

function css(color: RgbColor): string {
    return `rgb(${color.r} ${color.g} ${color.b})`;
}

/** A header label size (CSS px) from the band thickness — a little over half. */
function labelSize(bandThickness: number): number {
    return Math.min(13, Math.max(8, bandThickness * 0.55));
}

function stroke(
    ctx: CanvasRenderingContext2D,
    color: string,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
}

function clear(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}
