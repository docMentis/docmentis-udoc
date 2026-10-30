/**
 * The Fill / Line dropdown panel — the content behind a Shape-ribbon paint
 * split button's caret. It is *doc-type aware*: presentation (Office) documents
 * get a Theme Colors block (base slots + a tint/shade ladder each) above the
 * standard row, because a theme pick must stay a scheme reference that re-themes;
 * portable (PDF) documents get standard device colours only (no theme). Either
 * way "More Colors…" swaps the swatches for the custom picker
 * ({@link buildColorPicker}), for any other colour.
 *
 * A panel carries more than colour — that's the point of the split button. Fill
 * adds a "More Fill Options…" seam for the non-solid fills (gradient / pattern /
 * picture) that don't belong in a dropdown; stroke adds Weight and Dashes
 * fly-outs plus a "More Line Options…" seam. v1 emits only solid / none paints
 * and a flat weight / dash — the {@link PaintSpec} union and the extras are the
 * stable seam the engine payload grows into.
 *
 * This module is a pure *content builder*: {@link buildPaintPanel} fills a
 * caller-owned `.udoc-menu` element. The Ribbon owns the split button, the
 * persistent last-used / recent state, and the open/close lifecycle.
 */
import type { AnnotationLineEnding } from "@docmentis/udoc-wasm";
import type { PaintChannel } from "../commands.js";
import type { ThemePalette } from "../../geometry.js";
import type { I18n, Message, MessageKey } from "../i18n/index.js";
import { hexToRgb, parseHex, rgbToHex } from "../color.js";
import { buildColorPicker } from "./ColorPicker.js";
import {
    ICON_FILL,
    ICON_PALETTE,
    ICON_STROKE,
    ICON_NO_FILL,
    ICON_STROKE_WIDTH,
    ICON_LINE_STYLE,
    ICON_CHEVRON_RIGHT,
    ICON_ARROW_OPEN,
    ICON_ARROW_CLOSED,
    ICON_LINE_END_CIRCLE,
    ICON_LINE_END_SQUARE,
    ICON_LINE_END_DIAMOND,
} from "../icons.js";

/**
 * A paint value the panel can produce or reflect. v1 wires `none`, `solid`, and
 * `theme`; the remaining DrawingML fill kinds (gradient / pattern / picture)
 * land here as the authoring surface grows, so the ribbon → engine payload never
 * changes shape. A `theme` pick keeps its scheme `slot` (so it re-themes) plus
 * the resolved `hex` for display.
 */
export type PaintSpec =
    | { kind: "none" }
    | { kind: "solid"; hex: string }
    | { kind: "theme"; slot: string; hex: string; transforms: PaintTransform[] };

/** A tint/shade transform beneath a theme slot — mirrors the `DrawingML`
 *  `a:tint`/`a:shade`. `value` is the keep-fraction (`1.0` = the base color); the
 *  swatch `hex` is computed from this same transform, so preview matches result. */
export type PaintTransform = { kind: "tint"; value: number } | { kind: "shade"; value: number };

/** A dash pattern for a stroke. Solid-only strokes still carry `"solid"`. */
export type LineDash = "solid" | "dash" | "dot" | "dashDot";

/** The non-colour stroke attributes shown as fly-outs (Weight / Dashes). */
export interface StrokeStyle {
    /** Stroke weight in points. */
    weight: number;
    dash: LineDash;
}

/** One named colour in a palette row — a theme slot or a standard colour. */
export interface ThemeSwatch {
    name: MessageKey;
    hex: string;
    /** The `schemeClr` slot token (`accent1`, `tx1`, `bg2`, …) — the value the
     *  engine re-themes from. Present on theme swatches; standard colors omit it. */
    slot?: string;
}

/**
 * The ten theme swatches, in the standard Office order (two text/background
 * pairs, then accent 1–6), resolved from the open document's real theme
 * palette. The picker shows these ten; the palette's hyperlink slots aren't
 * offered as fills.
 */
export function themeSwatches(palette: ThemePalette): ThemeSwatch[] {
    return [
        { name: "paint.text1", hex: palette.text1, slot: "tx1" },
        { name: "paint.background1", hex: palette.background1, slot: "bg1" },
        { name: "paint.text2", hex: palette.text2, slot: "tx2" },
        { name: "paint.background2", hex: palette.background2, slot: "bg2" },
        { name: "paint.accent1", hex: palette.accent1, slot: "accent1" },
        { name: "paint.accent2", hex: palette.accent2, slot: "accent2" },
        { name: "paint.accent3", hex: palette.accent3, slot: "accent3" },
        { name: "paint.accent4", hex: palette.accent4, slot: "accent4" },
        { name: "paint.accent5", hex: palette.accent5, slot: "accent5" },
        { name: "paint.accent6", hex: palette.accent6, slot: "accent6" },
    ];
}

/**
 * A stand-in Office theme palette, the fallback rendered when the engine
 * reports no theme (an older wasm, or a load miss). The ten slots are the
 * standard Office order: two text/background pairs, then accent 1–6. The live
 * document theme comes through {@link themeSwatches}.
 */
export const DEFAULT_OFFICE_THEME: readonly ThemeSwatch[] = [
    { name: "paint.text1", hex: "#000000", slot: "tx1" },
    { name: "paint.background1", hex: "#ffffff", slot: "bg1" },
    { name: "paint.text2", hex: "#44546a", slot: "tx2" },
    { name: "paint.background2", hex: "#e7e6e6", slot: "bg2" },
    { name: "paint.accent1", hex: "#4472c4", slot: "accent1" },
    { name: "paint.accent2", hex: "#ed7d31", slot: "accent2" },
    { name: "paint.accent3", hex: "#a5a5a5", slot: "accent3" },
    { name: "paint.accent4", hex: "#ffc000", slot: "accent4" },
    { name: "paint.accent5", hex: "#5b9bd5", slot: "accent5" },
    { name: "paint.accent6", hex: "#70ad47", slot: "accent6" },
];

/** The fixed "Standard Colors" row — device RGB, shown for every doc type. */
export const STANDARD_COLORS: readonly ThemeSwatch[] = [
    { name: "color.darkRed", hex: "#c00000" },
    { name: "color.red", hex: "#ff0000" },
    { name: "color.orange", hex: "#ffc000" },
    { name: "color.yellow", hex: "#ffff00" },
    { name: "color.lightGreen", hex: "#92d050" },
    { name: "color.green", hex: "#00b050" },
    { name: "color.lightBlue", hex: "#00b0f0" },
    { name: "color.blue", hex: "#0070c0" },
    { name: "color.darkBlue", hex: "#002060" },
    { name: "color.purple", hex: "#7030a0" },
];

/** Each channel's own words for the explicit-nothing row and the More Options
 *  row — keyed by every channel, so a new one has to name its own. */
const PAINT_WORDS: Record<PaintChannel, { none: MessageKey; more: MessageKey }> = {
    fill: { none: "paint.noFill", more: "paint.moreFillOptions" },
    stroke: { none: "paint.noLine", more: "paint.moreLineOptions" },
    text: { none: "paint.noColor", more: "paint.moreColorOptions" },
    highlight: { none: "paint.noColor", more: "paint.moreColorOptions" },
};

/** The weight presets (points) offered by the stroke Weight fly-out. */
export const LINE_WEIGHTS: readonly number[] = [0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4.5, 6];

/** The dash presets offered by the stroke Dashes fly-out, with a line preview. */
const DASH_OPTIONS: ReadonlyArray<{ dash: LineDash; label: MessageKey; icon: string }> = [
    {
        dash: "solid",
        label: "paint.solid",
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="12" x2="21" y2="12"/></svg>`,
    },
    {
        dash: "dash",
        label: "paint.dashed",
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 3"><line x1="3" y1="12" x2="21" y2="12"/></svg>`,
    },
    {
        dash: "dot",
        label: "paint.dotted",
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="1 3"><line x1="3" y1="12" x2="21" y2="12"/></svg>`,
    },
    {
        dash: "dashDot",
        label: "paint.dashDot",
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="5 3 1 3"><line x1="3" y1="12" x2="21" y2="12"/></svg>`,
    },
];

/** The line endings the stroke Start / End fly-outs offer, with their glyph
 *  drawn at the line's end. */
const LINE_ENDINGS: ReadonlyArray<{ ending: AnnotationLineEnding; label: MessageKey; icon: string }> = [
    { ending: "none", label: "lineEnding.none", icon: "" },
    { ending: "openArrow", label: "lineEnding.openArrow", icon: ICON_ARROW_OPEN },
    { ending: "closedArrow", label: "lineEnding.closedArrow", icon: ICON_ARROW_CLOSED },
    { ending: "circle", label: "lineEnding.circle", icon: ICON_LINE_END_CIRCLE },
    { ending: "square", label: "lineEnding.square", icon: ICON_LINE_END_SQUARE },
    { ending: "diamond", label: "lineEnding.diamond", icon: ICON_LINE_END_DIAMOND },
];

/** `icon` turned to face left — a start ending's glyph. */
function facingStart(icon: string): string {
    return icon.replace("<svg ", '<svg style="transform: scaleX(-1)" ');
}

// ---- Colour math (tint/shade ladder under each theme slot) ----
/** Mix each channel toward white (`amount` of the way) — a lighter tint. */
function lighten(hex: string, amount: number): string {
    const [r, g, b] = hexToRgb(hex);
    return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}
/** Mix each channel toward black — a darker shade. */
function darken(hex: string, amount: number): string {
    const [r, g, b] = hexToRgb(hex);
    return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}
/** Perceived lightness 0..1 — picks the ladder direction for a slot. */
function lightness(hex: string): number {
    const [r, g, b] = hexToRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** One tint/shade variant beneath a theme slot: the resolved colour plus a
 *  label describing its own transform ("Lighter 40%" / "Darker 25%"), so a
 *  swatch's tooltip always matches what it actually does. */
export interface ThemeVariant {
    hex: string;
    label: Message;
    /** The `DrawingML` transform that produced this variant, carried on the pick
     *  so the applied color stays a re-themeable `schemeClr` with this tint/shade. */
    transform: PaintTransform;
}

/**
 * The five tint/shade variants shown beneath a theme slot's base colour, in the
 * PowerPoint arrangement: light backgrounds step darker, dark text colours step
 * lighter, and mid accents run three tints then two shades. Each variant carries
 * the label for its own step (the direction is slot-dependent, so it can't be
 * inferred from the row index).
 */
export function themeLadder(hex: string): ThemeVariant[] {
    const l = lightness(hex);
    // A JS `lighten(a)` blends `a` of the way to white — the DrawingML `tint`
    // with keep-fraction `1 - a` (and `darken`/`shade` likewise), so the swatch
    // hex and the wire transform describe the same color.
    const tint = (a: number): ThemeVariant => ({
        hex: lighten(hex, a),
        label: ["paint.lighter", { percent: Math.round(a * 100) }],
        transform: { kind: "tint", value: 1 - a },
    });
    const shade = (a: number): ThemeVariant => ({
        hex: darken(hex, a),
        label: ["paint.darker", { percent: Math.round(a * 100) }],
        transform: { kind: "shade", value: 1 - a },
    });
    if (l > 0.85) return [0.05, 0.15, 0.25, 0.35, 0.5].map(shade);
    if (l < 0.15) return [0.5, 0.35, 0.25, 0.15, 0.05].map(tint);
    return [tint(0.8), tint(0.6), tint(0.4), shade(0.25), shade(0.5)];
}

export interface PaintPanelConfig {
    /** The language the panel's words are in. */
    i18n: I18n;
    variant: PaintChannel;
    /** Office theme palette to show above the standard row; `null` → PDF layout
     *  (standard colours only, no theme block). */
    theme: readonly ThemeSwatch[] | null;
    /** Recently-picked colours (most-recent first); empty hides the row. */
    recent: readonly string[];
    /** The paint to ring as active; `null` when unknown / mixed (no ring). */
    active: PaintSpec | null;
    /** The current stroke style, for the Weight / Dashes fly-outs to mark —
     *  a null entry marking nothing (a selection that disagrees). */
    stroke: { weight: number | null; dash: LineDash | null } | null;
    /** The explicit-nothing row's label, when not the variant's own ("No Fill",
     *  "No Line", "No Color"). */
    noneLabel?: string;
    /** Apply a chosen paint (a swatch, or "No Fill" / "No Line"). */
    onPick: (paint: PaintSpec) => void;
    /** Apply a stroke weight (points) / dash — stroke only; the Weight / Dashes
     *  fly-outs show when both are given. */
    onWeight?: (points: number) => void;
    onDash?: (dash: LineDash) => void;
    /** The current line ends, for the Start / End fly-outs to mark — a null
     *  end marking nothing (a selection that disagrees). */
    ends?: { start: AnnotationLineEnding | null; end: AnnotationLineEnding | null };
    /** Apply an ending to one end of the line — the Start / End fly-outs show,
     *  beside Weight / Dashes, when it is given. */
    onEnding?: (end: "start" | "end", ending: AnnotationLineEnding) => void;
    /** Open the advanced fill / line surface as a modal dialog — the non-colour
     *  fills and a custom colour for Fill, compound / cap / arrow options for
     *  Stroke ("More Fill/Line Options…"). The row shows when it is given. */
    onMoreOptions?: () => void;
}

/** Is `hex` (case-insensitively) the panel's active solid colour? A theme colour
 *  rings its own slot's cell instead ({@link isActiveTheme}) — picking the same
 *  hex from the standard row would write a flat `srgbClr`, so it is not the same
 *  paint even when it looks identical. */
function isActiveHex(active: PaintSpec | null, hex: string): boolean {
    return active?.kind === "solid" && active.hex.toLowerCase() === hex.toLowerCase();
}

/** Is `active` this theme cell — the same slot under the same tint/shade step?
 *  Matched by *identity*, not by colour: the engine resolves a `schemeClr`
 *  through the document's real theme (a tint in linear light), while the ladder
 *  below previews it by blending sRGB bytes, so the two agree on which colour is
 *  meant without agreeing on its bytes. */
function isActiveTheme(active: PaintSpec | null, slot: string, transforms: readonly PaintTransform[]): boolean {
    if (active?.kind !== "theme" || active.slot !== slot) return false;
    if (active.transforms.length !== transforms.length) return false;
    return active.transforms.every((t, i) => {
        const step = transforms[i];
        return step !== undefined && t.kind === step.kind && t.value === step.value;
    });
}

/** A colour cell — a filled swatch, identical for fill and stroke. Active cells
 *  carry a focus ring. */
function cell(hex: string, name: string, active: boolean, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = "udoc-paintpanel__cell";
    btn.classList.toggle("udoc-paintpanel__cell--selected", active);
    btn.style.setProperty("--swatch-color", hex);
    btn.title = name;
    btn.setAttribute("aria-label", name);
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        onClick();
    });
    return btn;
}

function label(text: string): HTMLElement {
    const el = document.createElement("div");
    el.className = "udoc-paintpanel__label";
    el.textContent = text;
    return el;
}

function grid(columns: number): HTMLElement {
    const g = document.createElement("div");
    g.className = "udoc-paintpanel__grid";
    g.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    return g;
}

/** A plain action row (`[icon] label`) styled like a menu item. `onClick` gets
 *  the event so a row can stop propagation before acting / closing. */
function row(icon: string, text: string, onClick: (e: MouseEvent) => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = "udoc-menu__item";
    btn.setAttribute("role", "menuitem");
    btn.innerHTML = `<span class="udoc-menu__item-icon">${icon}</span><span class="udoc-menu__item-label">${text}</span>`;
    btn.addEventListener("click", onClick);
    return btn;
}

/**
 * A fly-out row: a parent menu item with a trailing caret whose nested panel
 * opens beside it (hover, or click for touch / keyboard). Reuses the ribbon's
 * submenu classes so it matches Arrange's fly-outs, including the left-flip when
 * opening right would overflow the root. Returns the wrap to append.
 */
function flyoutRow(icon: string, text: string, fill: (panel: HTMLElement) => void): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "udoc-toolbar__submenu-wrap";

    const parent = document.createElement("button");
    parent.className = "udoc-toolbar__menu-item udoc-toolbar__menu-item--parent";
    parent.setAttribute("role", "menuitem");
    parent.setAttribute("aria-haspopup", "menu");
    parent.setAttribute("aria-expanded", "false");
    parent.innerHTML =
        `<span class="udoc-toolbar__menu-icon">${icon}</span>` +
        `<span class="udoc-toolbar__menu-label">${text}</span>` +
        `<span class="udoc-toolbar__menu-caret">${ICON_CHEVRON_RIGHT}</span>`;

    const sub = document.createElement("div");
    sub.className = "udoc-menu udoc-submenu";
    sub.setAttribute("role", "menu");
    fill(sub);

    const open = (): void => {
        sub.classList.add("udoc-submenu--open");
        parent.setAttribute("aria-expanded", "true");
        const root = wrap.closest(".udoc-ui-root");
        sub.classList.toggle(
            "udoc-submenu--left",
            !!root && sub.getBoundingClientRect().right > root.getBoundingClientRect().right - 8,
        );
    };
    const close = (): void => {
        sub.classList.remove("udoc-submenu--open", "udoc-submenu--left");
        parent.setAttribute("aria-expanded", "false");
    };
    wrap.addEventListener("mouseenter", open);
    wrap.addEventListener("mouseleave", close);
    parent.addEventListener("click", (e) => {
        e.stopPropagation();
        if (sub.classList.contains("udoc-submenu--open")) close();
        else open();
    });
    wrap.append(parent, sub);
    return wrap;
}

function divider(): HTMLElement {
    const el = document.createElement("div");
    el.className = "udoc-paintpanel__divider";
    return el;
}

/**
 * Populate `panel` with the fill / stroke panel for `cfg`. Clears the element
 * first, so it is safe to call on every open. Positioning / show-hide / outside
 * click belong to the caller (the split button controller).
 */
export function buildPaintPanel(panel: HTMLElement, cfg: PaintPanelConfig): void {
    const { i18n, variant, theme, recent, active, onPick } = cfg;
    panel.innerHTML = "";
    panel.style.minWidth = "";
    panel.classList.add("udoc-paintpanel");

    // "No Fill" / "No Line" — the explicit-nothing row.
    const noneRow = document.createElement("button");
    noneRow.className = "udoc-menu__item udoc-paintpanel__none";
    noneRow.classList.toggle("udoc-paintpanel__none--selected", active?.kind === "none");
    noneRow.setAttribute("role", "menuitem");
    noneRow.innerHTML =
        `<span class="udoc-menu__item-icon">${ICON_NO_FILL}</span>` +
        `<span class="udoc-menu__item-label">${cfg.noneLabel ?? i18n.t(PAINT_WORDS[variant].none)}</span>`;
    noneRow.addEventListener("click", (e) => {
        e.stopPropagation();
        onPick({ kind: "none" });
    });
    panel.appendChild(noneRow);

    // Theme block (Office only): base row + a tint/shade ladder per slot.
    if (theme && theme.length > 0) {
        panel.appendChild(label(i18n.t("paint.themeColors")));
        const g = grid(theme.length);
        for (const slot of theme) {
            const token = slot.slot ?? slot.name;
            g.appendChild(
                cell(slot.hex, i18n.t(slot.name), isActiveTheme(active, token, []), () =>
                    onPick({ kind: "theme", slot: token, hex: slot.hex, transforms: [] }),
                ),
            );
        }
        const ladders = theme.map((s) => themeLadder(s.hex));
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < theme.length; c++) {
                const slot = theme[c];
                const variant = ladders[c]?.[r];
                if (!slot || variant === undefined) continue;
                const token = slot.slot ?? slot.name;
                g.appendChild(
                    cell(
                        variant.hex,
                        i18n.t("paint.themeVariant", { color: i18n.t(slot.name), variant: i18n.t(variant.label) }),
                        isActiveTheme(active, token, [variant.transform]),
                        () => onPick({ kind: "theme", slot: token, hex: variant.hex, transforms: [variant.transform] }),
                    ),
                );
            }
        }
        panel.appendChild(g);
    }

    // Standard colours — always present.
    panel.appendChild(label(i18n.t("paint.standardColors")));
    const std = grid(STANDARD_COLORS.length);
    for (const c of STANDARD_COLORS) {
        std.appendChild(
            cell(c.hex, i18n.t(c.name), isActiveHex(active, c.hex), () => onPick({ kind: "solid", hex: c.hex })),
        );
    }
    panel.appendChild(std);

    // Recent colours — populated by the ribbon as picks accrue.
    if (recent.length > 0) {
        panel.appendChild(label(i18n.t("paint.recentColors")));
        const rg = grid(STANDARD_COLORS.length);
        for (const hex of recent) {
            rg.appendChild(cell(hex, hex, isActiveHex(active, hex), () => onPick({ kind: "solid", hex })));
        }
        panel.appendChild(rg);
    }

    // Any other colour — the custom picker, in the swatches' place. A row, not
    // a swatch, so fenced off from the grids above it.
    panel.appendChild(divider());
    const moreColors = row(ICON_PALETTE, i18n.t("paint.moreColors"), (e) => {
        e.stopPropagation();
        showColorPicker(panel, cfg);
    });
    moreColors.classList.add("udoc-paintpanel__more-colors");
    panel.appendChild(moreColors);

    // Stroke-only: Weight / Dashes fly-outs, then Start / End for a line that
    // takes endings.
    if (variant === "stroke" && cfg.onWeight && cfg.onDash) {
        panel.appendChild(divider());
        panel.appendChild(
            flyoutRow(ICON_STROKE_WIDTH, i18n.t("paint.weight"), (sub) => {
                // The current weight is listed, in order, even when it isn't a
                // preset — a document can carry any weight.
                const current = cfg.stroke?.weight ?? null;
                const weights =
                    current === null || LINE_WEIGHTS.includes(current)
                        ? LINE_WEIGHTS
                        : [...LINE_WEIGHTS, current].sort((a, b) => a - b);
                for (const pt of weights) {
                    const preview = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"><line x1="3" y1="12" x2="21" y2="12" stroke-width="${weightStroke(pt)}"/></svg>`;
                    const active = current === pt;
                    const item = row(preview, i18n.t("format.points", { points: Number(pt.toFixed(2)) }), (e) => {
                        e.stopPropagation();
                        cfg.onWeight?.(pt);
                    });
                    item.classList.toggle("udoc-menu__item--selected", active);
                    sub.appendChild(item);
                }
            }),
        );
        panel.appendChild(
            flyoutRow(ICON_LINE_STYLE, i18n.t("paint.dashes"), (sub) => {
                for (const opt of DASH_OPTIONS) {
                    const active = cfg.stroke?.dash === opt.dash;
                    const item = row(opt.icon, i18n.t(opt.label), (e) => {
                        e.stopPropagation();
                        cfg.onDash?.(opt.dash);
                    });
                    item.classList.toggle("udoc-menu__item--selected", active);
                    sub.appendChild(item);
                }
            }),
        );
        const onEnding = cfg.onEnding;
        if (onEnding) {
            for (const [end, text] of [
                ["start", i18n.t("paint.start")],
                ["end", i18n.t("paint.end")],
            ] as const) {
                const glyph = (icon: string): string => (end === "start" ? facingStart(icon) : icon);
                panel.appendChild(
                    flyoutRow(glyph(ICON_ARROW_OPEN), text, (sub) => {
                        for (const opt of LINE_ENDINGS) {
                            const item = row(glyph(opt.icon), i18n.t(opt.label), (e) => {
                                e.stopPropagation();
                                onEnding(end, opt.ending);
                            });
                            item.classList.toggle("udoc-menu__item--selected", cfg.ends?.[end] === opt.ending);
                            sub.appendChild(item);
                        }
                    }),
                );
            }
        }
    }

    // Escape hatch to the richer surface (custom colour + gradient / pattern /
    // picture for fill; compound / cap / arrows for stroke) that doesn't fit a
    // dropdown — opens a modal dialog.
    const onMoreOptions = cfg.onMoreOptions;
    if (!onMoreOptions) return;
    panel.appendChild(divider());
    panel.appendChild(
        row(variant === "stroke" ? ICON_STROKE : ICON_FILL, i18n.t(PAINT_WORDS[variant].more), (e) => {
            e.stopPropagation();
            onMoreOptions();
        }),
    );
}

/**
 * Swap `panel`'s swatches for the custom picker, opened on the selection's
 * colour (else the latest recent one), holding the panel at its width so it
 * doesn't jump. OK picks the colour as a solid paint, like a swatch; Cancel
 * rebuilds the swatches.
 */
function showColorPicker(panel: HTMLElement, cfg: PaintPanelConfig): void {
    const { active, recent } = cfg;
    const current = active && active.kind !== "none" ? active.hex : recent[0];
    panel.style.minWidth = `${panel.clientWidth}px`;
    panel.innerHTML = "";
    const picker = buildColorPicker({
        i18n: cfg.i18n,
        initial: (current !== undefined && parseHex(current)) || "#000000",
        onApply: (hex) => cfg.onPick({ kind: "solid", hex }),
        onCancel: () => {
            buildPaintPanel(panel, cfg);
            panel.querySelector<HTMLElement>(".udoc-paintpanel__more-colors")?.focus();
        },
    });
    panel.appendChild(picker);
    picker.querySelector<HTMLElement>(".udoc-colorpicker__square")?.focus({ preventScroll: true });
}

/** Map a weight in points to a preview stroke-width in the 24×24 icon space,
 *  clamped so the thinnest is still visible and the thickest fits the row. */
function weightStroke(pt: number): number {
    return Math.max(0.75, Math.min(6, pt * 1.33));
}
