// Paint: a color picker's choice lowered to the open doc type's model style,
// the Fill / Line edits of a shape or a page object, and the color dropdowns of
// the Shape, Object and Text tabs.
import type {
    Brush,
    LineStyle,
    PaintColor,
    PaintColorTransform,
    PaintFill,
    PaintLine,
    PaintLineDash,
    PaintSchemeColor,
    UDocType,
} from "@docmentis/udoc-wasm";
import {
    applyPaintBar,
    buildPaintPanel,
    createDropdownButton,
    DEFAULT_OFFICE_THEME,
    displayToActivePaint,
    paintSwatch,
    themeSwatches,
} from "@docmentis/udoc-ui/internal";
import type {
    LineDash,
    PaintChannel,
    PaintPanelConfig,
    PaintSpec,
    PaintTransform,
    RibbonControl,
    RibbonControlEnv,
    StrokeStyle,
    ThemePalette,
    ThemeSwatch,
    UIShellHost,
} from "@docmentis/udoc-ui/internal";
import { editState } from "./state.js";
import type { EditTools } from "./tools.js";

/** Split an `#rrggbb` hex into its three bytes (`0..255`). */
function hexToRgbBytes(hex: string): [number, number, number] {
    const n = parseInt(hex.replace("#", ""), 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** A picker paint as a `PaintColor`, or `null` for "no fill": a solid sRGB
 *  color, or a theme pick kept as a `schemeClr` reference with its tint/shade
 *  transforms so it re-themes. The shared color construction behind
 *  {@link paintToDrawingFill} and the text highlight (a bare color). */
export function paintToDrawingColor(paint: PaintSpec): PaintColor | null {
    switch (paint.kind) {
        case "none":
            return null;
        case "solid": {
            const [r, g, b] = hexToRgbBytes(paint.hex);
            return { base: { sRgb: { r, g, b } }, transforms: [] };
        }
        case "theme":
            return {
                base: { scheme: schemeSlot(paint.slot) },
                transforms: paint.transforms.map(toDrawingTransform),
            };
    }
}

/** A picker paint as a `PaintFill`: a solid / theme color wrapped as a solid
 *  fill, or explicit `"none"` for "no fill". */
export function paintToDrawingFill(paint: PaintSpec): PaintFill {
    const color = paintToDrawingColor(paint);
    return color ? { solid: color } : "none";
}

function toDrawingTransform(t: PaintTransform): PaintColorTransform {
    return t.kind === "tint" ? { tint: t.value } : { shade: t.value };
}

/** Map a `schemeClr` slot token to the `PaintSchemeColor` wire name. */
const SCHEME_TOKEN: Record<string, PaintSchemeColor> = {
    tx1: "text1",
    bg1: "background1",
    tx2: "text2",
    bg2: "background2",
    accent1: "accent1",
    accent2: "accent2",
    accent3: "accent3",
    accent4: "accent4",
    accent5: "accent5",
    accent6: "accent6",
};
function schemeSlot(slot: string): PaintSchemeColor {
    return SCHEME_TOKEN[slot] ?? "text1";
}

/** A composed stroke as a `DrawingML` `Line`: its paint plus weight (points) and
 *  a preset dash. */
function paintToDrawingLine(stroke: StrokeSpec): PaintLine {
    return {
        width: stroke.weight,
        cap: null,
        compound: null,
        align: null,
        fill: paintToDrawingFill(stroke.paint),
        dash: dashToDrawing(stroke.dash),
        join: null,
        headEnd: null,
        tailEnd: null,
    };
}

function dashToDrawing(dash: LineDash): PaintLineDash {
    switch (dash) {
        case "solid":
            return { preset: "solid" };
        case "dash":
            return { preset: "dash" };
        case "dot":
            return { preset: "dot" };
        case "dashDot":
            return { preset: "dashDot" };
    }
}

function paintToBrush(paint: PaintSpec): Brush | null {
    if (paint.kind === "none") return null;
    const [r, g, b] = hexToRgbBytes(paint.hex);
    return { solid: { colorSpace: "deviceRgb", components: [r / 255, g / 255, b / 255] } };
}

/** A PDF stroking line: the weight (points) and a dash array derived from the
 *  preset, scaled by the width so it reads consistently at any weight. */
function portableStrokeLine(weight: number, dash: LineDash): LineStyle {
    const line: LineStyle = {
        width: weight,
        lineCap: dash === "dot" || dash === "dashDot" ? "round" : "butt",
        lineJoin: "miter",
        miterLimit: 10,
        dashArray: null,
        dashOffset: 0,
    };
    const w = weight || 1;
    const array =
        dash === "dash"
            ? [3 * w, 3 * w]
            : dash === "dot"
              ? [w, 2 * w]
              : dash === "dashDot"
                ? [3 * w, 2 * w, w, 2 * w]
                : null;
    if (array) line.dashArray = array;
    return line;
}

/** A composed stroke the Line picker applies: its color plus the weight and
 *  dash from the Weight / Dashes fly-outs. The shell lowers it to the doc type's
 *  outline model (`DrawingML` `Line` / PDF stroking style). */
export interface StrokeSpec {
    paint: PaintSpec;
    /** Stroke weight in points. */
    weight: number;
    dash: LineDash;
}

/** The Fill / Line edits of the selection, on the shell `host` lends. */
export function createPaintEdits(host: UIShellHost) {
    const { store, client, commit } = host;

    // Fill / Line — the picker's paint applied to the current selection. The
    // payload is the open doc type's own model style, built here (the host builds
    // model JSON, like `insertObject`), then sent through the same `executeOnSelection`
    // seam; the doc-type binder replaces the shape's fill / line or the path's
    // non-stroking / stroking style. "No Fill" on a PDF path (not expressible as a
    // device style) is skipped.
    function fillSelection(paint: PaintSpec): Promise<void> {
        if (store.getState().docType === "presentation") {
            return commit(() => client.executeOnSelection({ kind: "setShapeFill", fill: paintToDrawingFill(paint) }));
        }
        const brush = paintToBrush(paint);
        if (!brush) return Promise.resolve();
        return commit(() =>
            client.executeOnSelection({
                kind: "object",
                edit: { kind: "setNonstrokingStyle", style: { brush, alpha: 1, overprint: false } },
            }),
        );
    }

    // The whole composed stroke (color + weight + dash), since the engine sets the
    // outline as one value.
    function strokeSelection(stroke: StrokeSpec): Promise<void> {
        if (store.getState().docType === "presentation") {
            return commit(() => client.executeOnSelection({ kind: "setShapeLine", line: paintToDrawingLine(stroke) }));
        }
        const brush = paintToBrush(stroke.paint);
        if (!brush) return Promise.resolve();
        const line = portableStrokeLine(stroke.weight, stroke.dash);
        return commit(() =>
            client.executeOnSelection({
                kind: "object",
                edit: { kind: "setStrokingStyle", style: { brush, alpha: 1, overprint: false, line } },
            }),
        );
    }

    return { fillSelection, strokeSelection };
}

/** The Fill / Line edits {@link createPaintEdits} makes. */
export type PaintEdits = ReturnType<typeof createPaintEdits>;

/**
 * The doc types whose color pickers show the "Theme Colors" block above the
 * standard swatches: the OOXML office types, whose color model is
 * theme-relative (a `schemeClr` re-themes) — not PDF or images (device colors
 * only). The block shows the document's resolved palette (from the engine's
 * `themePalette()`) when it has landed, the stand-in Office palette until then.
 */
const THEMED: ReadonlySet<UDocType> = new Set<UDocType>(["presentation", "spreadsheet", "wordprocessing"]);

/** The picker's Theme Colors row: the current slide's resolved palette mapped
 *  to swatches, or the stand-in when the engine reported no theme. */
function mapThemeColors(palette: ThemePalette | null): readonly ThemeSwatch[] {
    return palette ? themeSwatches(palette) : DEFAULT_OFFICE_THEME;
}

/**
 * The last picks — edit mode's write-side memory: the color per channel that the
 * composed stroke re-sends when only its weight / dash change (the engine sets
 * the outline as one thing), and the weight / dash the Line panel marks. Not
 * shown on the triggers, which mirror the *selection*.
 */
export interface PaintMemory {
    readonly lastPaint: Record<PaintChannel, PaintSpec>;
    readonly lastStroke: StrokeStyle;
}

/** A {@link PaintMemory} at its defaults. */
export function createPaintMemory(): PaintMemory {
    return {
        lastPaint: {
            fill: { kind: "solid", hex: "#4472c4" },
            stroke: { kind: "solid", hex: "#000000" },
            text: { kind: "solid", hex: "#000000" },
            highlight: { kind: "solid", hex: "#ffff00" },
        },
        lastStroke: { weight: 1, dash: "solid" },
    };
}

/**
 * A Fill / Line / Text Color dropdown of `channel`, for command `id` drawn with
 * `icon`: the channel glyph over a color bar reflecting the *selection's* color,
 * the caret opening the color panel (rebuilt on each open). A mirror — clicking
 * always opens the picker (no last-color re-apply); each render keeps the
 * swatch in sync with the selection.
 */
export function paintControl(
    env: RibbonControlEnv,
    command: { id: string; icon: string; channel: PaintChannel },
    tools: EditTools,
): RibbonControl {
    const { i18n, paintMemory: memory } = tools;
    const { channel } = command;
    const selectionPaint = () => editState(env.store.getState()).selectionPaint;

    // Apply the current stroke (color + weight + dash) to the selection — the
    // whole composed value, since the engine sets the outline as one thing;
    // the color rides from the last pick.
    const applyStroke = (): void =>
        void tools.paint.strokeSelection({
            paint: memory.lastPaint.stroke,
            weight: memory.lastStroke.weight,
            dash: memory.lastStroke.dash,
        });

    // Apply a picked paint: fill / text / highlight send the color; stroke
    // sends the composed stroke (its last-used weight / dash ride along).
    const applyPaint = (paint: PaintSpec): void => {
        if (channel === "fill") void tools.paint.fillSelection(paint);
        else if (channel === "text") void tools.text.textFillSelection(paint);
        else if (channel === "highlight") void tools.text.textHighlightSelection(paint);
        else applyStroke();
    };

    // Commit a picked paint: remember it (for the composed stroke re-send and
    // the recent row) and apply it. The trigger swatch isn't touched here — it
    // mirrors the selection, so it updates when the resulting report lands.
    const commitPaint = (paint: PaintSpec): void => {
        memory.lastPaint[channel] = paint;
        if (paint.kind !== "none") env.pushRecent(channel, paint.hex);
        applyPaint(paint);
    };

    // The color panel — doc-type aware (Office shows the theme block, PDF
    // standard colors only). Rebuilt on each open so recent / active reflect
    // current state. `close` is the dropdown's.
    const panelConfig = (close: () => void): PaintPanelConfig => {
        const state = env.store.getState();
        return {
            i18n,
            variant: channel,
            // Office docs ({@link THEMED}) show the Theme Colors
            // block — the document's resolved palette when the engine reported
            // one, else the stand-in; PDF passes `null` for standard colors only.
            theme:
                state.docType !== null && THEMED.has(state.docType)
                    ? mapThemeColors(editState(state).themePalette)
                    : null,
            recent: env.recentPaint[channel],
            // Ring the *selection's* color as active (the design's true
            // "active"): a solid color or explicit no-fill; nothing for mixed /
            // unknown.
            active: displayToActivePaint(selectionPaint()[channel]),
            stroke: channel === "stroke" ? memory.lastStroke : null,
            onPick: (paint) => {
                commitPaint(paint);
                close();
            },
            onWeight: (pt) => {
                memory.lastStroke.weight = pt;
                applyStroke();
                close();
            },
            onDash: (dash) => {
                memory.lastStroke.dash = dash;
                applyStroke();
                close();
            },
            // No `onMoreOptions`: the More Options row waits for the advanced
            // dialog to hold the richer fill / line surface.
        };
    };

    const dd = createDropdownButton(
        { icon: paintSwatch(command.icon, selectionPaint()[channel]), label: env.label },
        {
            menuLabel: i18n.t("ribbon.paintOptions", { label: env.label }),
            onOpen: () =>
                buildPaintPanel(
                    dd.menu,
                    panelConfig(() => dd.controller.close()),
                ),
        },
    );
    dd.trigger.dataset.command = command.id;
    return {
        el: dd.el,
        // The swatch mirrors the selection.
        sync: (state) => applyPaintBar(dd.trigger, editState(state).selectionPaint[channel]),
        close: () => dd.controller.close(),
        destroy: () => dd.destroy(),
    };
}
