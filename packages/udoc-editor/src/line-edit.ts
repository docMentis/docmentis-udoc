// A change to a line, in the doc type's own model: what the change states replaces
// what the line has, and the rest is carried, as the engine sets a line as one
// value. What a line has nothing for comes from `fallback`: what the Line panel
// last set, for a side that has no line yet. Pure — `paint.ts` edits the selection
// with what this builds.
import type { LineStyle, PaintFill, PaintLine, PaintLineDash } from "@docmentis/udoc-wasm";
import type { LineDash } from "@docmentis/udoc-ui/internal";

/** The line's weight and dash a Line panel change states. */
export interface LineChange {
    /** The weight, in points. */
    weight?: number | undefined;
    dash?: LineDash | undefined;
}

/** A dash the panel offers as a `DrawingML` dash. */
function drawingDash(dash: LineDash): PaintLineDash {
    return { preset: dash };
}

/** A `DrawingML` dash as one the panel offers, or null for one it doesn't. A line
 *  stating none is solid. */
export function lineDashOfDrawing(dash: PaintLineDash | null | undefined): LineDash | null {
    if (!dash) return "solid";
    if (!("preset" in dash)) return null;
    const { preset } = dash;
    return preset === "solid" || preset === "dash" || preset === "dot" || preset === "dashDot" ? preset : null;
}

/** `current` with `change` and the color `fill` when given, over `fallback` for
 *  what it lacks: no line, or one painting nothing, takes the fallback's color, as
 *  setting its weight turns it on. Arrowheads, caps and joins are carried. */
export function changedDrawingLine(
    current: PaintLine | null,
    change: LineChange & { fill?: PaintFill | undefined },
    fallback: { fill: PaintFill; weight: number; dash: LineDash },
): PaintLine {
    const fill = current && current.fill !== "none" ? current.fill : fallback.fill;
    return {
        width: change.weight ?? current?.width ?? fallback.weight,
        cap: current?.cap ?? null,
        compound: current?.compound ?? null,
        align: current?.align ?? null,
        fill: change.fill ?? fill,
        dash: change.dash ? drawingDash(change.dash) : (current?.dash ?? drawingDash(fallback.dash)),
        join: current?.join ?? null,
        headEnd: current?.headEnd ?? null,
        tailEnd: current?.tailEnd ?? null,
    };
}

/** The dash array the panel's `dash` is at `weight`: scaled by it, so it reads the
 *  same at any weight. */
function portableDashArray(dash: LineDash, weight: number): number[] | null {
    const w = weight || 1;
    switch (dash) {
        case "dash":
            return [3 * w, 3 * w];
        case "dot":
            return [w, 2 * w];
        case "dashDot":
            return [3 * w, 2 * w, w, 2 * w];
        case "solid":
            return null;
    }
}

/** A PDF line's dash as one the panel offers, or null for one it doesn't. */
export function lineDashOfPortable(line: LineStyle): LineDash | null {
    const { dashArray, width } = line;
    if (!dashArray || dashArray.length === 0) return "solid";
    for (const dash of ["dash", "dot", "dashDot"] as const) {
        const preset = portableDashArray(dash, width);
        if (preset?.length === dashArray.length && preset.every((v, i) => Math.abs(v - dashArray[i]!) < 1e-6)) {
            return dash;
        }
    }
    return null;
}

/** A PDF line of `weight` and `dash` over `base`'s joins and offset. A dot's and a
 *  dash-dot's ends are round, as their dots are. */
function portableLineOf(base: LineStyle | null, weight: number, dash: LineDash): LineStyle {
    return {
        width: weight,
        lineCap: dash === "dot" || dash === "dashDot" ? "round" : "butt",
        lineJoin: base?.lineJoin ?? "miter",
        miterLimit: base?.miterLimit ?? 10,
        dashArray: portableDashArray(dash, weight),
        dashOffset: base?.dashOffset ?? 0,
    };
}

/** `current` with `change`, or a line of `fallback` for a side with none. A new
 *  weight alone scales the line's dashes with it, whatever they are. */
export function changedPortableLine(
    current: LineStyle | null,
    change: LineChange,
    fallback: { weight: number; dash: LineDash },
): LineStyle {
    if (!current) return portableLineOf(null, change.weight ?? fallback.weight, change.dash ?? fallback.dash);
    const weight = change.weight ?? current.width;
    if (change.dash) return portableLineOf(current, weight, change.dash);
    const scale = current.width > 0 ? weight / current.width : 1;
    return {
        ...current,
        width: weight,
        dashArray: current.dashArray ? current.dashArray.map((v) => v * scale) : current.dashArray,
    };
}
