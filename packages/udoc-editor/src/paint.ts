// Paint: a color picker's choice lowered to the open doc type's model style,
// the Fill / Line edits of a shape or a page object, and the color dropdowns of
// the Shape, Object and Text tabs.
import type {
    Brush,
    DeviceColor,
    NonstrokingStyle,
    PaintColor,
    PaintColorTransform,
    PaintFill,
    PaintLine,
    PaintSchemeColor,
    StrokingStyle,
    UDocSelectionProperties,
    UDocType,
} from "@docmentis/udoc-wasm";
import {
    applyPaintBar,
    buildOpacityPanel,
    buildPaintPanel,
    createDropdownButton,
    DEFAULT_OFFICE_THEME,
    displayToActivePaint,
    drawingProperties,
    paintSwatch,
    profileFor,
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
    SelectionEdit,
    StrokeStyle,
    ThemePalette,
    ThemeSwatch,
    UIShellHost,
} from "@docmentis/udoc-ui/internal";
import { DOCMENTIS_LINE } from "./docmentis-theme.js";
import { changedDrawingLine, changedPortableLine, lineDashOfDrawing, lineDashOfPortable } from "./line-edit.js";
import { fillOpacity, fillWithOpacity, specifiedFill } from "./opacity.js";
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

/** The line the selected shapes agree on — a deck's, a word document's, or
 *  those drawn over an image — or null where they don't, or none is
 *  selected. */
export function selectionLine(properties: UDocSelectionProperties | null): PaintLine | null {
    const line = drawingProperties(properties)?.shape.line;
    return line !== undefined && typeof line === "object" ? line.value : null;
}

/** The Fill and Line panels' channels, which take an opacity. */
type OpacityChannel = "fill" | "stroke";

/** The fill-side style the selected PDF objects agree on, or null where they
 *  don't, have none, or it's a PDF path's turned off. */
function portableNonstroking(properties: UDocSelectionProperties | null): NonstrokingStyle | null {
    if (!properties || !("portable" in properties)) return null;
    const style = properties.portable.object.nonstrokingStyle;
    return typeof style === "object" ? style.value : null;
}

/** {@link portableNonstroking} for the outline. */
function portableStroking(properties: UDocSelectionProperties | null): StrokingStyle | null {
    if (!properties || !("portable" in properties)) return null;
    const style = properties.portable.object.strokingStyle;
    return typeof style === "object" ? style.value : null;
}

/**
 * The opacity the selection's `channel` paints with, where it agrees on one: a PDF
 * object's style's — a path's, an image's, a shading's, a text object's runs' — or
 * a drawing shape's solid fill's or line's. Null where the selection differs, has
 * no such side, or paints it with no one color — no fill, no line, a gradient, a
 * pattern, a picture — as there's nothing to carry it.
 */
export function selectionOpacity(properties: UDocSelectionProperties | null, channel: OpacityChannel): number | null {
    if (properties && "portable" in properties) {
        const { nonstrokingStyle, strokingStyle } = properties.portable.object;
        const style = channel === "fill" ? nonstrokingStyle : strokingStyle;
        return typeof style === "object" ? (style.value?.alpha ?? null) : null;
    }
    const shape = drawingProperties(properties)?.shape;
    if (!shape) return null;
    if (channel === "fill") return typeof shape.fill === "object" ? fillOpacity(shape.fill.value) : null;
    const line = typeof shape.line === "object" ? shape.line.value : null;
    return line?.fill ? fillOpacity(line.fill) : null;
}

/** The edit setting the selection's `channel` to `opacity`, carrying back the
 *  rest of its paint — or null where {@link selectionOpacity} has none to set. */
function opacityEdit(
    properties: UDocSelectionProperties | null,
    channel: OpacityChannel,
    opacity: number,
): SelectionEdit | null {
    if (selectionOpacity(properties, channel) === null) return null;
    if (properties && "portable" in properties) {
        if (channel === "fill") {
            const current = portableNonstroking(properties);
            if (!current) return null;
            return {
                kind: "object",
                edit: { kind: "setNonstrokingStyle", style: { ...current, alpha: opacity } },
            };
        }
        const current = portableStroking(properties);
        if (!current) return null;
        return { kind: "object", edit: { kind: "setStrokingStyle", style: { ...current, alpha: opacity } } };
    }
    const shape = drawingProperties(properties)?.shape;
    if (!shape) return null;
    if (channel === "fill") {
        if (typeof shape.fill !== "object") return null;
        return { kind: "setShapeFill", fill: fillWithOpacity(shape.fill.value, opacity) };
    }
    const line = typeof shape.line === "object" ? shape.line.value : null;
    if (!line?.fill) return null;
    return { kind: "setShapeLine", line: { ...line, fill: fillWithOpacity(line.fill, opacity) } };
}

function paintToBrush(paint: PaintSpec): Brush | null {
    if (paint.kind === "none") return null;
    const [r, g, b] = hexToRgbBytes(paint.hex);
    return { solid: { colorSpace: "deviceRgb", components: [r / 255, g / 255, b / 255] } };
}

/** What the Line panel last set: a side with no line takes it, as the line a
 *  weight, a dash or a color turns on. */
export interface StrokeSpec {
    paint: PaintSpec;
    /** Stroke weight in points. */
    weight: number;
    dash: LineDash;
}

/** A change to the selection's line, each part what the Line panel set: the color
 *  with the opacity the custom picker gave it, the weight or the dash. */
export interface StrokeChange {
    paint?: PaintSpec;
    opacity?: number | undefined;
    weight?: number;
    dash?: LineDash;
}

/**
 * The weight and dash the selection's line has, for the Line panel to mark: a
 * drawing shape's, or a PDF path's. Each null where the selection differs, it
 * has no line, or the dash isn't one the panel offers.
 */
function selectionStroke(properties: UDocSelectionProperties | null): {
    weight: number | null;
    dash: LineDash | null;
} {
    if (properties && "portable" in properties) {
        const style = portableStroking(properties);
        if (!style) return { weight: null, dash: null };
        return { weight: style.line.width, dash: lineDashOfPortable(style.line) };
    }
    const line = selectionLine(properties);
    if (!line) return { weight: null, dash: null };
    return { weight: line.width ?? null, dash: lineDashOfDrawing(line.dash) };
}

/** The Fill / Line edits of the selection, on the shell `host` lends. */
export function createPaintEdits(host: UIShellHost) {
    const { store, client, commit } = host;

    // Fill / Line — the picker's paint applied to the current selection. The
    // payload is the open doc type's own model style, built here (the host builds
    // model JSON, like `insertObject`), then sent through the same `executeOnSelection`
    // seam; the doc-type binder replaces a drawing shape's fill / line or a PDF
    // object's non-stroking / stroking style, "No Fill" a null one, which turns a
    // path's fill off.
    function fillSelection(paint: PaintSpec, opacity?: number): Promise<void> {
        const state = store.getState();
        const properties = editState(state).selectionProperties;
        const alpha = opacity ?? selectionOpacity(properties, "fill") ?? 1;
        if (profileFor(state.docType).drawingShapes) {
            const fill = fillWithOpacity(paintToDrawingFill(paint), alpha);
            return commit(() => client.executeOnSelection({ kind: "setShapeFill", fill }));
        }
        const brush = paintToBrush(paint);
        const overprint = portableNonstroking(properties)?.overprint ?? false;
        const style = brush && { brush, alpha, overprint };
        return commit(() =>
            client.executeOnSelection({ kind: "object", edit: { kind: "setNonstrokingStyle", style } }),
        );
    }

    // A change to the line — its color, its weight or its dash — over the line the
    // selection has, carrying the rest, since the engine sets the outline as one
    // value: a new weight keeps the line's color, and an arrow keeps its head.
    // `fallback` is for what it hasn't: a side with no line, or lines that differ.
    function strokeSelection(change: StrokeChange, fallback: StrokeSpec): Promise<void> {
        const state = store.getState();
        const { selectionLine: current, selectionProperties: properties } = editState(state);
        const alpha = change.opacity ?? selectionOpacity(properties, "stroke") ?? 1;
        const { weight, dash, paint } = change;
        if (profileFor(state.docType).drawingShapes) {
            const fillOf = (spec: PaintSpec): PaintFill => fillWithOpacity(paintToDrawingFill(spec), alpha);
            const line = changedDrawingLine(
                current,
                { weight, dash, fill: paint && fillOf(paint) },
                { fill: fillOf(fallback.paint), weight: fallback.weight, dash: fallback.dash },
            );
            return commit(() => client.executeOnSelection({ kind: "setShapeLine", line }));
        }
        const style = portableStroking(properties);
        const brush = paint ? paintToBrush(paint) : (style?.brush ?? paintToBrush(fallback.paint));
        const line = changedPortableLine(style?.line ?? null, { weight, dash }, fallback);
        const overprint = style?.overprint ?? false;
        // "No Line" is a null style, which turns a path's outline off.
        const next = brush && { brush, alpha, overprint, line };
        return commit(() =>
            client.executeOnSelection({ kind: "object", edit: { kind: "setStrokingStyle", style: next } }),
        );
    }

    // The opacity alone: the rest of the paint is carried back as it stands.
    function setSelectionOpacity(channel: OpacityChannel, opacity: number): Promise<void> {
        const edit = opacityEdit(editState(store.getState()).selectionProperties, channel, opacity);
        return edit ? commit(() => client.executeOnSelection(edit)) : Promise.resolve();
    }

    return { fillSelection, strokeSelection, setSelectionOpacity };
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
 * The Object tab's Opacity button, for command `id` drawn with `icon`: the opacity
 * of what the selected PDF objects paint with on their non-stroking side — a
 * path's fill, an image, a shading, text.
 */
export function objectOpacityControl(
    env: RibbonControlEnv,
    command: { id: string; icon: string },
    tools: EditTools,
): RibbonControl {
    const dd = createDropdownButton(
        { icon: command.icon, label: env.label },
        {
            menuLabel: env.label,
            onOpen: () =>
                buildOpacityPanel(dd.menu, {
                    i18n: tools.i18n,
                    opacity: selectionOpacity(editState(env.store.getState()).selectionProperties, "fill"),
                    onSet: (opacity) => {
                        tools.paintMemory.lastOpacity.fill = opacity;
                        void tools.paint.setSelectionOpacity("fill", opacity);
                    },
                    close: () => dd.controller.close(),
                }),
        },
    );
    dd.trigger.dataset.command = command.id;
    return { el: dd.el, close: () => dd.controller.close(), destroy: () => dd.destroy() };
}

/**
 * What was last specified — edit mode's write-side memory, for as long as the
 * editor is open, across the documents it opens. A new shape takes a side's color
 * and opacity from it, over the document's default ({@link specifiedPaint}), and a
 * side with no line takes its color, weight and dash when the Line panel turns it
 * on. A No Fill or a No Line isn't a color, and leaves it be. Not shown on the
 * triggers or the panel's marks, which mirror the *selection*.
 */
export interface PaintMemory {
    /** The color last picked per channel, or null with none picked yet. */
    readonly lastPaint: Record<PaintChannel, PaintSpec | null>;
    /** The opacity last set per side, or null with none set yet. */
    readonly lastOpacity: Record<OpacityChannel, number | null>;
    readonly lastStroke: StrokeStyle;
}

/** A {@link PaintMemory} with nothing specified yet. */
export function createPaintMemory(): PaintMemory {
    return {
        lastPaint: { fill: null, stroke: null, text: null, highlight: null },
        lastOpacity: { fill: null, stroke: null },
        lastStroke: { weight: 1, dash: "solid" },
    };
}

/** The color last specified for `channel` as a drawing color. A theme color on a
 *  document with no theme, not `themed`, is the color it showed as. */
function specifiedColor(memory: PaintMemory, channel: OpacityChannel, themed: boolean): PaintColor | null {
    const last = memory.lastPaint[channel];
    if (!last || last.kind === "none") return null;
    return paintToDrawingColor(last.kind === "theme" && !themed ? { kind: "solid", hex: last.hex } : last);
}

/**
 * What a new drawing shape paints `channel` with, from what was last specified: its
 * color at its opacity, an opacity alone taking `defaultColor`. Null with neither
 * specified, for the document's default.
 */
export function specifiedPaint(
    memory: PaintMemory,
    channel: OpacityChannel,
    themed: boolean,
    defaultColor: PaintColor,
): PaintFill | null {
    return specifiedFill(specifiedColor(memory, channel, themed), memory.lastOpacity[channel], defaultColor);
}

/** What a new PDF object paints `channel` with: the color last specified, else
 *  `defaultHex`, at the opacity last set, else opaque. */
export function specifiedPortablePaint(
    memory: PaintMemory,
    channel: OpacityChannel,
    defaultHex: string,
): { color: DeviceColor; alpha: number } {
    const last = memory.lastPaint[channel];
    const hex = last && last.kind !== "none" ? last.hex : defaultHex;
    const [r, g, b] = hexToRgbBytes(hex);
    return {
        color: { colorSpace: "srgb", components: [r / 255, g / 255, b / 255] },
        alpha: memory.lastOpacity[channel] ?? 1,
    };
}

/** `hex` as a drawing color. */
export function drawingColorOf(hex: string): PaintColor {
    const [r, g, b] = hexToRgbBytes(hex);
    return { base: { sRgb: { r, g, b } }, transforms: [] };
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

    // Change the selection's line by what the panel set, the rest carried.
    const applyStroke = (change: StrokeChange): void => {
        const { docType } = env.store.getState();
        const themed = docType !== null && THEMED.has(docType);
        void tools.paint.strokeSelection(change, {
            paint: memory.lastPaint.stroke ?? { kind: "solid", hex: themed ? "#000000" : DOCMENTIS_LINE },
            weight: memory.lastStroke.weight,
            dash: memory.lastStroke.dash,
        });
    };

    // Apply a picked paint, at the opacity the custom picker gave it, else at
    // the one the channel has.
    const applyPaint = (paint: PaintSpec, opacity?: number): void => {
        if (channel === "fill") void tools.paint.fillSelection(paint, opacity);
        else if (channel === "text") void tools.text.textFillSelection(paint);
        else if (channel === "highlight") void tools.text.textHighlightSelection(paint);
        else applyStroke({ paint, opacity });
    };

    // Commit a picked paint: remember a color (what a side with no line takes, and
    // the recent row) and apply it. The trigger swatch isn't touched here — it
    // mirrors the selection, so it updates when the resulting report lands.
    const commitPaint = (paint: PaintSpec, opacity?: number): void => {
        if (paint.kind !== "none") {
            memory.lastPaint[channel] = paint;
            env.pushRecent(channel, paint.hex);
        }
        if (opacity !== undefined && (channel === "fill" || channel === "stroke")) {
            memory.lastOpacity[channel] = opacity;
        }
        applyPaint(paint, opacity);
    };

    // The color panel — doc-type aware (Office shows the theme block, PDF
    // standard colors only). Rebuilt on each open so recent / active reflect
    // current state. `close` is the dropdown's.
    const panelConfig = (close: () => void): PaintPanelConfig => {
        const state = env.store.getState();
        const properties = editState(state).selectionProperties;
        // A PDF's fill-side opacity is the Object tab's Opacity button's: it isn't
        // the fill's alone, as an image or text has it with no fill to speak of.
        const fillTakesOpacity = profileFor(state.docType).drawingShapes;
        const opacityChannel = channel === "stroke" || (channel === "fill" && fillTakesOpacity) ? channel : null;
        const opacity = opacityChannel ? selectionOpacity(properties, opacityChannel) : null;
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
            stroke: channel === "stroke" ? selectionStroke(properties) : null,
            onPick: (paint, pickedOpacity) => {
                commitPaint(paint, pickedOpacity);
                close();
            },
            onWeight: (pt) => {
                memory.lastStroke.weight = pt;
                applyStroke({ weight: pt });
                close();
            },
            onDash: (dash) => {
                memory.lastStroke.dash = dash;
                applyStroke({ dash });
                close();
            },
            // The custom picker's slider, on a side that takes an opacity; the
            // fly-out, where the selection paints it with one color to carry it.
            ...(opacityChannel ? { opacity } : {}),
            ...(opacityChannel && opacity !== null
                ? {
                      onOpacity: (value: number) => {
                          memory.lastOpacity[opacityChannel] = value;
                          void tools.paint.setSelectionOpacity(opacityChannel, value);
                          close();
                      },
                  }
                : {}),
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
