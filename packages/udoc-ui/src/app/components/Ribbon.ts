import { createMenuController, subscribeSelector } from "../../framework/index.js";
import type { AnnotationLineEnding, Feature, UDocType } from "@docmentis/udoc-wasm";
import type { Store } from "../../framework/index.js";
import type { HistoryOp } from "../../worker/protocol.js";
import type { Action } from "../actions.js";
import type { SelectionCapabilities, PaintDisplay } from "../../geometry.js";
import type { UIState, MarkupTool, PlaceTool, PointerMode, ToolbarTab } from "../state.js";
import { tabsFor } from "../profiles.js";
import type { TabSource } from "../profiles.js";
import { COMMAND_CATALOG, commandContext } from "../commands.js";
import { paintColor } from "../annotations.js";
import type { AnnotationStyleChange, AnnotationStyles } from "../annotations.js";
import type { SelectedAnnotations } from "../../worker/protocol.js";
import type {
    ClusterKind,
    MenuAction,
    CommandContext,
    CommandDef,
    MenuItem,
    PaintChannel,
    PickerOption,
    RibbonControl,
} from "../commands.js";
import { setupRovingTabindex } from "../a11y.js";
import { ICON_MORE_VERT } from "../icons.js";
import {
    alignMenuToBounds,
    createButton,
    createDropdownButton,
    createMenuItem,
    nameButton,
    nameShortcut,
} from "./controls.js";
import type { DropdownButton } from "./controls.js";
import { buildMenuInto } from "./menuItems.js";
import { buildPaintPanel } from "./PaintPanel.js";
import type { PaintSpec, PaintTransform, LineDash, PaintPanelConfig } from "./PaintPanel.js";
import type { PaintColorTransform, PaintSchemeColor } from "@docmentis/udoc-wasm";
import type { I18n, MessageKey } from "../i18n/index.js";

export interface RibbonCallbacks {
    /** Apply a document-wide history op (undo / redo). */
    onHistory?: (op: HistoryOp) => void;
    /** Run a dropdown-menu row's action. */
    onMenuAction?: (action: MenuAction) => void;
    /** Make a change of the Annotate tab's Format group — to the armed
     *  annotation tool's style, or to the selected annotations (see
     *  `formatTarget`). The Color / Fill panels fire it here; the Opacity menu
     *  through {@link onMenuAction}. */
    onAnnotationStyle?: (change: AnnotationStyleChange) => void;
    /** Press an Annotate-tab text markup: mark the text selected with it, else
     *  arm it — or, armed, put it down. */
    onMarkup?: (tool: MarkupTool) => void;
}

/** Whether two place tools are the same tool — the same kind, and the same
 *  one of it. */
function samePlaceTool(a: PlaceTool, b: PlaceTool): boolean {
    return a.kind === b.kind && a.tool === b.tool;
}

/**
 * The main-region content of a Fill / Line split button: the channel glyph
 * stacked over a thin color bar (PowerPoint style). The bar carries the chosen
 * color via `--swatch-color`, so the monochrome glyph stays legible even for
 * pale colors; `none` shows a struck-through bar. Passed as the split's
 * `mainIcon` — an opaque HTML string.
 */
const PAINT_BAR_MODIFIERS = ["udoc-paint__bar--none", "udoc-paint__bar--mixed", "udoc-paint__bar--unknown"];

/** The bar modifier class for a {@link PaintDisplay}, or `""` for a color (which
 *  paints via `--swatch-color` instead). */
function paintBarModifier(display: PaintDisplay): string {
    return displayHex(display) ? "" : `udoc-paint__bar--${display.kind}`;
}

/** The Fill / Line / Text Color trigger glyph over a bar reflecting the
 *  *selection's* color: a swatch for a color (theme colors included — the engine
 *  resolved them), a struck bar for an explicit no-fill, a neutral bar for mixed
 *  / unknown. Passed as the dropdown's icon. */
export function paintSwatch(glyph: string, display: PaintDisplay): string {
    const mod = paintBarModifier(display);
    const cls = mod ? `udoc-paint__bar ${mod}` : "udoc-paint__bar";
    const hex = displayHex(display);
    const style = hex ? `style="--swatch-color:${hex}"` : "";
    return `<span class="udoc-paint">${glyph}<span class="${cls}" ${style}></span></span>`;
}

/** Update an already-mounted trigger's color bar to reflect `display`. */
export function applyPaintBar(trigger: HTMLElement, display: PaintDisplay): void {
    const bar = trigger.querySelector<HTMLElement>(".udoc-paint__bar");
    if (!bar) return;
    bar.classList.remove(...PAINT_BAR_MODIFIERS);
    const mod = paintBarModifier(display);
    if (mod) bar.classList.add(mod);
    const hex = displayHex(display);
    if (hex) bar.style.setProperty("--swatch-color", hex);
    else bar.style.removeProperty("--swatch-color");
}

/** The `schemeClr` slot token (the picker's vocabulary) for a resolved theme
 *  color's wire slot — the reverse of the shell's `SCHEME_TOKEN`. Only the ten
 *  slots the picker offers are here: the scheme's own `dk1`/`lt1` names, the link
 *  colors, and an unbound `phClr` have no cell to ring, so they show as the plain
 *  color they resolve to. */
const SLOT_TOKEN: Partial<Record<PaintSchemeColor, string>> = {
    text1: "tx1",
    background1: "bg1",
    text2: "tx2",
    background2: "bg2",
    accent1: "accent1",
    accent2: "accent2",
    accent3: "accent3",
    accent4: "accent4",
    accent5: "accent5",
    accent6: "accent6",
};

/** A resolved color's transform stack in the picker's vocabulary, or `null` when
 *  it holds a step the picker can't express — PowerPoint writes its own ladder as
 *  `lumMod`/`lumOff` where ours emits `tint`/`shade`, and a hand-authored deck can
 *  carry anything. Such a color still swatches its hex; it just isn't a pick the
 *  panel can point at. */
function paintTransforms(transforms: PaintColorTransform[]): PaintTransform[] | null {
    const picked: PaintTransform[] = [];
    for (const t of transforms) {
        if (typeof t === "object" && "tint" in t) picked.push({ kind: "tint", value: t.tint });
        else if (typeof t === "object" && "shade" in t) picked.push({ kind: "shade", value: t.shade });
        else return null;
    }
    return picked;
}

/** The selection swatch as a `PaintSpec` for the picker's active ring — an
 *  explicit no-fill, a solid color, or a theme color the panel can point at (a
 *  slot it offers, under transforms it can express). A theme color it can't name
 *  still rings by color; mixed / unknown ring nothing. */
export function displayToActivePaint(display: PaintDisplay): PaintSpec | null {
    if (display.kind === "none") return { kind: "none" };
    if (display.kind === "solid") return { kind: "solid", hex: display.hex };
    if (display.kind !== "theme") return null;
    const slot = SLOT_TOKEN[display.slot];
    const transforms = paintTransforms(display.transforms);
    return slot !== undefined && transforms !== null
        ? { kind: "theme", slot, hex: display.hex, transforms }
        : { kind: "solid", hex: display.hex };
}

interface RibbonSlice {
    toolbarVisible: boolean;
    docType: UDocType | null;
    mode: string;
    features: readonly Feature[];
    activeTab: string | null;
    disabledCommands: ReadonlySet<string>;
    pointerMode: PointerMode;
    ready: boolean;
    selectionCaps: SelectionCapabilities;
    extension: unknown;
    selectedAnnotations: SelectedAnnotations | null;
    annotationStyles: AnnotationStyles;
    /** What the View tab's Notes toggle reads pressed by. */
    notesOpen: boolean;
}

/** The color a display paints its bar with — a solid or theme color's own hex;
 *  `null` for the kinds that have no color (a struck no-fill, mixed, unknown). */
function displayHex(display: PaintDisplay): string | null {
    return display.kind === "solid" || display.kind === "theme" ? display.hex : null;
}

function sliceEqual(a: RibbonSlice, b: RibbonSlice): boolean {
    return (
        a.toolbarVisible === b.toolbarVisible &&
        a.docType === b.docType &&
        a.mode === b.mode &&
        a.features === b.features &&
        a.activeTab === b.activeTab &&
        a.disabledCommands === b.disabledCommands &&
        a.pointerMode === b.pointerMode &&
        a.ready === b.ready &&
        a.selectionCaps === b.selectionCaps &&
        a.extension === b.extension &&
        // Fresh only when they change: the shell reads the annotations back
        // after a selection report, and the reducer keeps a null as it is.
        a.selectedAnnotations === b.selectedAnnotations &&
        a.annotationStyles === b.annotationStyles &&
        a.notesOpen === b.notesOpen
    );
}

function selectSlice(s: UIState): RibbonSlice {
    return {
        toolbarVisible: s.toolbarVisible,
        docType: s.docType,
        mode: s.mode,
        features: s.features,
        activeTab: s.activeTab,
        disabledCommands: s.disabledCommands,
        pointerMode: s.pointerMode,
        ready: s.status === "ready",
        selectionCaps: s.selectionCaps,
        extension: s.extension,
        selectedAnnotations: s.selectedAnnotations,
        annotationStyles: s.annotationStyles,
        notesOpen: s.notesOpen,
    };
}

/** Whether a command bunches into a segmented `.udoc-btn-group`, and with which
 *  of its kind: the Annotate tab's markups cluster as `"toggle"`, its Color /
 *  Fill as `"paint"` — with its Opacity, since it styles the same annotation —
 *  and an extension's controls and menus as their `cluster` says. Consecutive
 *  same-kind commands share one group; anything else stands alone. */
function clusterKind(def: CommandDef<string>): ClusterKind | null {
    if (def.run.kind === "control" || def.run.kind === "menu") return def.run.cluster ?? null;
    if (def.run.kind === "markup") return "toggle";
    if (def.run.kind === "annotationPaint") return "paint";
    if (def.id === "annotationOpacity") return "paint";
    return null;
}

/** Whether a command is the one currently armed in the pointer's place mode. */
function isCommandActive(def: CommandDef<string>, pointer: PointerMode): boolean {
    if (pointer.kind !== "place") return false;
    switch (def.run.kind) {
        case "arm":
            return samePlaceTool(def.run.tool, pointer.tool);
        case "armPicker": {
            const armed = pointer.tool;
            return def.run.options.some((opt) => samePlaceTool(opt.tool, armed));
        }
        case "markup":
            return pointer.tool.kind === "annotation" && pointer.tool.tool === def.run.tool;
        default:
            return false;
    }
}

/** Commands of the currently active tab, or [] when there's no tab.
 *  Host-disabled commands drop out for every tab; a *contextual* tab (Home) also
 *  drops the commands whose capability predicate is dead for the current
 *  selection — capability-driven show/hide — where an ordinary tab keeps them and
 *  lets the per-render pass grey them instead. */
function activeTabCommands(
    slice: RibbonSlice,
    ctx: CommandContext,
    tabs: readonly ToolbarTab<string>[],
    commandOf: (id: string) => CommandDef<string> | undefined,
): readonly string[] {
    const tab = tabs.find((t) => t.id === slice.activeTab);
    if (!tab) return [];
    return tab.commands.filter((id) => {
        const def = commandOf(id);
        return def !== undefined && !slice.disabledCommands.has(id) && (!tab.contextual || def.enabledWhen(ctx));
    });
}

/**
 * The ribbon — a tabbed tool band. It's just another toolbar: its tools are the
 * shared {@link createButton} / {@link createDropdownButton} controls, driven by
 * the command catalog. No ribbon-specific button or popup — a tool that opens a
 * menu (Arrange / Align / Rotate / the shape picker) is a plain dropdown button,
 * identical to the mode switch or app menu.
 *
 * It owns two surfaces:
 *
 * - The **tab strip** (the returned `tabStrip`), a `tablist` that selects which
 *   tab's tools are shown — or none, folding the ribbon to its tabs. The shell
 *   parents it into the top toolbar's `tabStripSlot`, so it renders anchored to
 *   the toolbar's bottom edge; the ribbon still owns its content, selection
 *   (`SET_TAB`), and keyboard roving. Tabs that overrun the slot's width move
 *   to the menu of a More tab at the strip's end (see `fitTabs`).
 * - The **tool surface** (`el`, the second row), showing the active tab's tools.
 *   Hidden while folded. Insert commands arm a one-shot placement; page edits
 *   route through the callbacks. (Undo/redo live in the top toolbar.) Tools
 *   that overrun its width move to the panel of a More button at its trailing
 *   edge (see `flow`).
 */
export function createRibbon(
    i18n: I18n,
    tabsOf: TabSource,
    extensionCommands: Readonly<Record<string, CommandDef<string>>>,
) {
    const el = document.createElement("div");
    el.className = "udoc-ribbon";
    el.setAttribute("role", "toolbar");
    el.setAttribute("aria-label", i18n.t("ribbon.label"));

    /** The definition of command `id`: the shell's catalog's, else the extension's. */
    const commandOf = (id: string): CommandDef<string> | undefined =>
        (COMMAND_CATALOG as Readonly<Record<string, CommandDef>>)[id] ?? extensionCommands[id];
    /** A tab's or command's label, by its key — the shell's messages speak the
     *  extension's keys too. */
    const labelOf = (key: string): string => i18n.t(key as MessageKey);
    /** The tab strip `slice` shows, less the tabs its session isn't entitled to. */
    const tabsIn = (slice: RibbonSlice): readonly ToolbarTab<string>[] =>
        tabsFor(tabsOf(slice.docType, slice.mode), slice.features);
    el.style.display = "none";

    const toolsSection = document.createElement("div");
    toolsSection.className = "udoc-ribbon__tools";

    // The tab strip (a tablist) — selects the active tab whose tools fill the
    // surface below. The shell parents this into the top toolbar's slot, where
    // it bottom-anchors and the active tab merges into this surface.
    const tabStrip = document.createElement("div");
    tabStrip.className = "udoc-ribbon__tabs";
    tabStrip.setAttribute("role", "tablist");
    tabStrip.setAttribute("aria-label", i18n.t("ribbon.tabs"));
    // The strip's tabs, in order — on the strip while they fit it.
    const tabButtons: HTMLButtonElement[] = [];

    // The More tab closing the strip while its tabs overrun it, and its menu of
    // the tabs that left it. A row stands in for its tab: pressing it presses
    // the tab.
    const moreTabs = document.createElement("div");
    moreTabs.className = "udoc-dropdown";
    const moreTabsBtn = document.createElement("button");
    moreTabsBtn.className = "udoc-ribbon__tab udoc-ribbon__tab--more";
    moreTabsBtn.innerHTML = ICON_MORE_VERT;
    moreTabsBtn.setAttribute("aria-haspopup", "menu");
    nameButton(moreTabsBtn, i18n.t("ribbon.moreTabs"));
    const moreTabsMenu = document.createElement("div");
    moreTabsMenu.className = "udoc-menu";
    moreTabsMenu.setAttribute("role", "menu");
    moreTabsMenu.setAttribute("aria-label", i18n.t("ribbon.moreTabs"));
    moreTabs.append(moreTabsBtn, moreTabsMenu);
    const tabsMenu = createMenuController(moreTabsBtn, moreTabsMenu, {
        onOpen: () => {
            moreTabsMenu.innerHTML = "";
            for (const tab of tabButtons) {
                if (tab.parentElement === tabStrip) continue;
                const item = createMenuItem({ text: tab.textContent ?? "" });
                item.addEventListener("click", () => {
                    tabsMenu.close();
                    tab.click();
                });
                moreTabsMenu.appendChild(item);
            }
            alignMenuToBounds(moreTabsBtn, moreTabsMenu);
        },
    });

    // The More button at the surface's trailing edge, shown while the tools
    // overrun it, and the panel it opens — a second toolbar holding the
    // trailing tools that don't fit, which wraps onto further rows when they
    // don't fit across it either.
    const more = document.createElement("div");
    more.className = "udoc-dropdown udoc-ribbon__more";
    more.style.display = "none";
    const moreBtn = createButton({ icon: ICON_MORE_VERT, label: i18n.t("ribbon.more") });
    const overflow = document.createElement("div");
    overflow.className = "udoc-menu udoc-menu--end udoc-ribbon__overflow";
    overflow.setAttribute("role", "group");
    overflow.setAttribute("aria-label", i18n.t("ribbon.more"));
    const overflowTools = document.createElement("div");
    overflowTools.className = "udoc-ribbon__overflow-tools";
    overflow.append(overflowTools);
    more.append(moreBtn, overflow);

    el.append(toolsSection, more);

    let unsubRender: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let tabsObserver: ResizeObserver | null = null;
    let rovingTabindex: ReturnType<typeof setupRovingTabindex> | null = null;
    let tabsRoving: ReturnType<typeof setupRovingTabindex> | null = null;
    let callbacks: RibbonCallbacks = {};
    // The dropdown / combobox tools currently mounted — destroyed and rebuilt
    // with the tool surface so their menu controllers don't leak document
    // listeners. Both expose the same close / destroy handles.
    const dropdowns: DropdownButton[] = [];
    // The extension's controls on the tool surface, rebuilt with it.
    const controls: RibbonControl[] = [];
    // Recently-picked colors per channel (most-recent first) — the panel's Recent
    // row. Accrues as picks happen; not yet persisted across sessions.
    const recentPaint: Record<PaintChannel, string[]> = { fill: [], stroke: [], text: [], highlight: [] };
    // Signature of the currently-built tools (mode + tab + disabled set).
    let builtToolsKey = "";
    // Signature of the currently-built tab strip (docType + mode + active tab).
    let builtTabsKey = "";
    // The panel the Annotate tab's Color dropdown opens, once mounted.
    let annotationColorPanel: ((menu: HTMLElement, close: () => void) => void) | null = null;

    /** Hide a divider the More panel's wrap leaves at a row's edge, where it
     *  fences off nothing. Hidden, not removed, so the rows keep their breaks. */
    const trimDividers = (): void => {
        const sameRow = (a: Element, b: Element): boolean => {
            const ra = a.getBoundingClientRect();
            const rb = b.getBoundingClientRect();
            return ra.top < rb.bottom && rb.top < ra.bottom;
        };
        for (const divider of overflowTools.querySelectorAll<HTMLElement>(":scope > .udoc-divider")) {
            const prev = divider.previousElementSibling;
            const next = divider.nextElementSibling;
            const inRow = prev !== null && next !== null && sameRow(prev, divider) && sameRow(divider, next);
            divider.style.visibility = inRow ? "" : "hidden";
        }
    };

    const overflowMenu = createMenuController(moreBtn, overflow, {
        onOpen: () => {
            trimDividers();
            rovingTabindex?.refresh();
        },
        onClose: () => rovingTabindex?.refresh(),
    });

    /** Fit the tools to the surface. Every tool goes back on the row; when they
     *  overrun it, the More button shows and the controls that don't fit beside
     *  it move to its panel, in order. A cluster the cut lands in splits there —
     *  its head stays on the row, the rest goes on as a cluster of its own —
     *  rather than leaving its whole width empty. A divider the cut would leave
     *  trailing the row goes too, and the panel hides it as its first. */
    const flow = (): void => {
        if (el.style.display === "none") return;
        const rest = overflowTools.firstElementChild;
        if (rest?.classList.contains("udoc-ribbon__cluster-rest")) {
            toolsSection.lastElementChild?.append(...rest.children);
            rest.remove();
        }
        toolsSection.append(...overflowTools.children);
        const band = getComputedStyle(el);
        const width = el.clientWidth - parseFloat(band.paddingLeft) - parseFloat(band.paddingRight);
        const tools = [...toolsSection.children];
        const left = toolsSection.getBoundingClientRect().left;
        const end = (tool: Element): number => tool.getBoundingClientRect().right - left;
        const last = tools[tools.length - 1];
        if (last === undefined || end(last) <= width) {
            more.style.display = "none";
            overflowMenu.close();
        } else {
            more.style.display = "";
            overflow.style.maxWidth = `${width}px`;
            const room = width - more.offsetWidth - parseFloat(band.columnGap);
            const controls = tools.flatMap((tool) =>
                tool.classList.contains("udoc-btn-group") ? [...tool.children] : [tool],
            );
            const first = controls.find((control) => end(control) > room) ?? last;
            let cut = tools.findIndex((tool) => tool.contains(first));
            const cluster = first.parentElement;
            if (cluster !== null && cluster !== toolsSection && first.previousElementSibling !== null) {
                const split = document.createElement("div");
                split.className = "udoc-btn-group udoc-ribbon__cluster-rest";
                split.setAttribute("role", "group");
                const members = [...cluster.children];
                split.append(...members.slice(members.indexOf(first)));
                overflowTools.append(split);
                cut++;
            } else {
                while (cut > 0 && tools[cut - 1]?.classList.contains("udoc-divider")) cut--;
            }
            overflowTools.append(...tools.slice(cut));
            if (overflowMenu.isOpen) trimDividers();
        }
        rovingTabindex?.refresh();
    };

    /** Fit the tabs to the room the toolbar leaves the strip — its slot's
     *  width. Every tab goes back on the strip; when they overrun the room, the
     *  More tab closes the strip and tabs leave it from the end until the rest
     *  fit — all but the open one, whose edge the tool surface hangs from. */
    const fitTabs = (): void => {
        tabStrip.replaceChildren(...tabButtons);
        const room = tabStrip.parentElement?.clientWidth ?? 0;
        if (tabStrip.offsetWidth <= room) {
            tabsMenu.close();
        } else {
            tabStrip.append(moreTabs);
            for (const tab of [...tabButtons].reverse()) {
                if (tabStrip.offsetWidth <= room) break;
                if (!tab.classList.contains("udoc-ribbon__tab--selected")) tab.remove();
            }
        }
        tabsRoving?.refresh();
    };

    function mount(container: HTMLElement, store: Store<UIState, Action>): void {
        container.appendChild(el);

        // The tool buttons plus any combobox input a contributed control holds
        // share one roving tab stop; such an input consumes its own arrow /
        // Home / End keys so text editing isn't hijacked by the roving handler.
        rovingTabindex = setupRovingTabindex(el, ".udoc-btn, .udoc-combobox__input");
        // The tab strip is its own roving group (a tablist), even though the
        // shell parents it inside the toolbar's roving region — the util stops
        // an arrow press from also reaching the toolbar's group.
        tabsRoving = setupRovingTabindex(tabStrip, ".udoc-ribbon__tab");

        // --- Tab strip ---
        const buildTabs = (slice: RibbonSlice) => {
            tabButtons.length = 0;
            const tabs = tabsIn(slice);
            tabStrip.style.display = tabs.length > 0 ? "" : "none";
            for (const tab of tabs) {
                const btn = document.createElement("button");
                btn.className = "udoc-ribbon__tab";
                btn.setAttribute("role", "tab");
                btn.dataset.tab = tab.id;
                btn.textContent = labelOf(tab.label);
                const active = tab.id === slice.activeTab;
                btn.classList.toggle("udoc-ribbon__tab--selected", active);
                btn.setAttribute("aria-selected", String(active));
                // Pressing the open tab folds the ribbon; any tab unfolds it.
                btn.addEventListener("click", () => store.dispatch({ type: "SET_TAB", tab: active ? null : tab.id }));
                tabButtons.push(btn);
            }
            fitTabs();
        };

        // Fill a dropdown tool's top panel (Arrange and its nested Order / Align /
        // Rotate fly-outs) — the shared row renderer, which the canvas context
        // menu builds its own panel with too.
        const fillMenu = (dd: DropdownButton, items: readonly MenuItem<string>[]): void =>
            buildMenuInto(dd.menu, items, {
                i18n,
                context: () => commandContext(store.getState()),
                action: (action) => callbacks.onMenuAction?.(action),
                close: () => dd.controller.close(),
            });

        // Fill a dropdown tool's menu with its picker: a row arms its tool, a
        // stamp row with its stamp.
        const fillShapes = (dd: DropdownButton, options: readonly PickerOption<string>[]): void => {
            dd.menu.innerHTML = "";
            for (const opt of options) {
                const item = createMenuItem({ icon: opt.icon, text: labelOf(opt.label) });
                item.addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (opt.stamp) store.dispatch({ type: "SET_STAMP", stamp: opt.stamp });
                    store.dispatch({ type: "ARM_PLACE", tool: opt.tool, sticky: false });
                    dd.controller.close();
                });
                dd.menu.appendChild(item);
            }
        };

        // Record a picked color as most-recent for its channel (dedup, cap 10).
        const pushRecent = (channel: PaintChannel, hex: string): void => {
            const list = recentPaint[channel];
            const at = list.indexOf(hex);
            if (at >= 0) list.splice(at, 1);
            list.unshift(hex);
            if (list.length > 10) list.length = 10;
        };

        // What an Annotate-tab Color / Fill swatch shows: the colour of what the
        // Format controls act on, or a neutral bar when they act on nothing.
        const annotationDisplay = (ctx: CommandContext, channel: "color" | "fill"): PaintDisplay =>
            ctx.annotation?.[channel] ?? { kind: "unknown" };

        // The panel behind an Annotate-tab Color / Fill dropdown: standard colours
        // (a PDF has no theme), the recents it shares with the Object tab's
        // Stroke / Fill, and — for Color on something drawn with a line — that
        // line's Weight and Dashes, and the Start / End of one that takes
        // endings, marked with what it holds.
        const annotationPanelConfig = (channel: "color" | "fill", close: () => void): PaintPanelConfig => {
            const ctx = commandContext(store.getState());
            const recent = channel === "color" ? "stroke" : "fill";
            const line = channel === "color" ? ctx.annotation?.line : undefined;
            const ends = channel === "color" ? ctx.annotation?.lineEnds : undefined;
            const style = (change: AnnotationStyleChange): void => {
                callbacks.onAnnotationStyle?.(change);
                close();
            };
            return {
                i18n,
                variant: channel === "color" ? "stroke" : "fill",
                theme: null,
                recent: recentPaint[recent],
                active: displayToActivePaint(annotationDisplay(ctx, channel)),
                stroke: line ? { weight: line.width, dash: line.dash } : null,
                noneLabel: i18n.t(channel === "color" ? "paint.noColor" : "paint.noFill"),
                onPick: (paint) => {
                    if (paint.kind !== "none") pushRecent(recent, paint.hex);
                    style({ kind: channel, color: paintColor(paint) });
                },
                ...(line && {
                    onWeight: (width: number) => style({ kind: "width", width }),
                    onDash: (dash: LineDash) => style({ kind: "dash", dash }),
                }),
                ...(ends && {
                    ends,
                    onEnding: (end: "start" | "end", ending: AnnotationLineEnding) =>
                        style({ kind: "lineEnding", end, ending }),
                }),
            };
        };
        annotationColorPanel = (menu, close) => buildPaintPanel(menu, annotationPanelConfig("color", close));

        // Non-dropdown commands act immediately.
        const runCommand = (def: CommandDef<string>): void => {
            switch (def.run.kind) {
                case "history":
                    callbacks.onHistory?.(def.run.op);
                    break;
                case "action":
                    def.run.press(store);
                    break;
                case "markup":
                    callbacks.onMarkup?.(def.run.tool);
                    break;
                case "arm":
                    // Pressing the armed tool again puts it down — the way out of
                    // a sticky tool that doesn't need the Escape key.
                    if (isCommandActive(def, store.getState().pointerMode)) {
                        store.dispatch({ type: "SET_POINTER_MODE", pointer: { kind: "select" } });
                    } else {
                        store.dispatch({ type: "ARM_PLACE", tool: def.run.tool, sticky: def.run.sticky ?? false });
                    }
                    break;
                case "toggle":
                    def.run.press(store);
                    break;
            }
        };

        // A tool is either a dropdown button (opens a menu / shape picker) or a
        // plain button — both are the shared controls, tagged with the command id
        // for the per-render enablement/armed pass.
        const cmdButton = (def: CommandDef<string>): HTMLElement => {
            const label = labelOf(def.label);
            if (def.run.kind === "menu") {
                const items = def.run.menu;
                // Icon-only unless the command asks for its label (see
                // `CommandDef.labeled`).
                const content = def.labeled ? { icon: def.icon, text: label, label } : { icon: def.icon, label };
                const dd = createDropdownButton(content, {
                    menuLabel: label,
                    menuRole: "menu",
                    onOpen: () => fillMenu(dd, items),
                });
                dd.trigger.dataset.command = def.id;
                dropdowns.push(dd);
                return dd.el;
            }
            // An extension's control, built and kept in step by its own code.
            if (def.run.kind === "control") {
                const control = def.run.create({ store, label, recentPaint, pushRecent });
                controls.push(control);
                return control.el;
            }
            if (def.run.kind === "armPicker") {
                const options = def.run.options;
                const dd = createDropdownButton(
                    { icon: def.icon, text: label, label },
                    { menuLabel: label, menuRole: "menu", onOpen: () => fillShapes(dd, options) },
                );
                dd.trigger.dataset.command = def.id;
                dropdowns.push(dd);
                return dd.el;
            }
            // An Annotate-tab Color / Fill dropdown: its swatch mirrors what the
            // Format controls act on (see
            // `annotationDisplay`), and the per-render pass keeps it in sync.
            if (def.run.kind === "annotationPaint") {
                const channel = def.run.channel;
                const dd = createDropdownButton(
                    {
                        icon: paintSwatch(def.icon, annotationDisplay(commandContext(store.getState()), channel)),
                        label,
                    },
                    {
                        menuLabel: i18n.t("ribbon.paintOptions", { label }),
                        onOpen: () =>
                            buildPaintPanel(
                                dd.menu,
                                annotationPanelConfig(channel, () => dd.controller.close()),
                            ),
                    },
                );
                dd.trigger.dataset.command = def.id;
                dropdowns.push(dd);
                return dd.el;
            }
            // Placement commands keep their label, as does a command that asks
            // for it — their glyphs are ambiguous (a rectangle reads as "shape",
            // a page-add as "slide", only once you know). Anything else is
            // icon-only with a tooltip.
            const labeled = def.run.kind === "arm" || def.labeled === true;
            const btn = createButton({
                icon: def.icon,
                label,
                ...(labeled && { text: label }),
                ...(def.shortcut && { shortcut: nameShortcut(def.shortcut, i18n) }),
            });
            btn.dataset.command = def.id;
            btn.addEventListener("click", () => runCommand(def));
            return btn;
        };

        const buildTools = (commands: readonly string[]) => {
            for (const dd of dropdowns) dd.destroy();
            dropdowns.length = 0;
            for (const control of controls) control.destroy?.();
            controls.length = 0;
            toolsSection.innerHTML = "";
            overflowTools.innerHTML = "";
            // Render the tab's commands, separating consecutive groups (the
            // command's `group` key) with a thin divider — e.g. Home's Clipboard
            // group from its Editing group. Consecutive same-kind controls bunch
            // into one segmented `.udoc-btn-group` (see `clusterKind`): the
            // Bold / Italic / Underline / Strikethrough toggles as one cluster, the
            // Text Color / Highlight (or Fill / Line) color dropdowns as another,
            // the paragraph Align / Spacing / list controls as a third.
            let prevGroup: string | null = null;
            let cluster: HTMLElement | null = null;
            let clusterOf: ClusterKind | null = null;
            for (const id of commands) {
                const def = commandOf(id);
                if (!def) continue;
                if (prevGroup !== null && def.group !== prevGroup) {
                    cluster = null;
                    clusterOf = null;
                    const divider = document.createElement("div");
                    divider.className = "udoc-divider";
                    toolsSection.appendChild(divider);
                }
                prevGroup = def.group;
                const kind = clusterKind(def);
                if (kind) {
                    // Open a cluster on the first control of a kind, then keep
                    // appending while consecutive controls share it; a change of
                    // kind (toggles → colors) starts a fresh cluster beside it.
                    if (!cluster || clusterOf !== kind) {
                        cluster = document.createElement("div");
                        cluster.className = "udoc-btn-group";
                        cluster.setAttribute("role", "group");
                        clusterOf = kind;
                        toolsSection.appendChild(cluster);
                    }
                    cluster.appendChild(cmdButton(def));
                } else {
                    cluster = null;
                    clusterOf = null;
                    toolsSection.appendChild(cmdButton(def));
                }
            }
        };

        const applyState = (slice: RibbonSlice) => {
            // The selection-capability read every enablement / contextual-visibility
            // decision below shares — the contextual Home tab uses it to pick which
            // commands to show, the per-render pass to grey the rest.
            const ctx = commandContext(store.getState());
            // Tab strip: rebuilt on doc-type / mode / active-tab change,
            // independent of the tool surface (which stays visible for any active
            // tab — even one with no commands — and hides only while folded).
            const tabsKey = `${slice.docType}:${slice.mode}:${slice.activeTab}`;
            if (tabsKey !== builtTabsKey) {
                builtTabsKey = tabsKey;
                buildTabs(slice);
            }

            // Show the tool surface whenever a real tab is active — including a tab
            // with no commands (Home). An empty tab keeps its band so the active tab
            // reads as a present, connected folder tab (its bottom merges into this
            // surface) instead of a detached tab hanging off the toolbar, and the row
            // doesn't collapse when you switch to Home. Hidden only when the toolbar
            // is off or no tab is open (the ribbon folded, or a mode with no tabs).
            const tabs = tabsIn(slice);
            const activeTab = tabs.find((t) => t.id === slice.activeTab);
            const visible = slice.toolbarVisible && activeTab !== undefined;
            el.style.display = visible ? "flex" : "none";
            if (!visible) {
                for (const dd of dropdowns) dd.controller.close();
                for (const control of controls) control.close?.();
                overflowMenu.close();
                builtToolsKey = "";
                return;
            }

            // The commands the active tab shows now — its declared set minus the
            // host-disabled ones, and for the contextual Home tab minus the ones
            // the current selection can't take. Keying the tool surface off this
            // list (not just the disabled set) rebuilds Home as its live command
            // set changes with the selection, while an ordinary tab still rebuilds
            // only when a host toggle hides one of its commands.
            const shownCommands = activeTabCommands(slice, ctx, tabs, commandOf);
            const toolsKey = `${slice.mode}:${slice.activeTab}:${shownCommands.join(",")}`;
            if (toolsKey !== builtToolsKey) {
                builtToolsKey = toolsKey;
                buildTools(shownCommands);
                flow();
            }

            // Per-render: enablement (the command's own predicate over the
            // current context) + armed highlight. Host UI policy already applied
            // upstream — disabledCommands (and Home's contextual filter) drop
            // entries in activeTabCommands.
            for (const btn of el.querySelectorAll<HTMLButtonElement>("[data-command]")) {
                const def = commandOf(btn.dataset.command ?? "");
                if (!def) continue;
                btn.disabled = !def.enabledWhen(ctx);
                // An extension's control mirrors the state itself (below).
                if (def.run.kind === "control") continue;
                if (def.run.kind === "annotationPaint") {
                    applyPaintBar(btn, annotationDisplay(ctx, def.run.channel));
                } else if (def.run.kind === "toggle") {
                    const pressed = def.run.pressed(store.getState());
                    btn.classList.toggle("udoc-btn--selected", pressed);
                    btn.setAttribute("aria-pressed", String(pressed));
                } else {
                    btn.classList.toggle("udoc-btn--selected", isCommandActive(def, slice.pointerMode));
                }
            }
            for (const control of controls) control.sync?.(store.getState());

            rovingTabindex?.refresh();
        };

        applyState(selectSlice(store.getState()));
        unsubRender = subscribeSelector(store, selectSlice, applyState, { equality: sliceEqual });
        // The surface's width is its slot's, never its tools': refit on a resize.
        resizeObserver = new ResizeObserver(flow);
        resizeObserver.observe(el);
        // The tabs' room is their slot's width, never the tabs': refit on its resize.
        const tabSlot = tabStrip.parentElement;
        if (tabSlot) {
            tabsObserver = new ResizeObserver(fitTabs);
            tabsObserver.observe(tabSlot);
        }
    }

    function setCallbacks(next: RibbonCallbacks): void {
        callbacks = { ...callbacks, ...next };
    }

    function destroy(): void {
        if (unsubRender) unsubRender();
        resizeObserver?.disconnect();
        tabsObserver?.disconnect();
        overflowMenu.destroy();
        tabsMenu.destroy();
        if (rovingTabindex) rovingTabindex.destroy();
        if (tabsRoving) tabsRoving.destroy();
        for (const dd of dropdowns) dd.destroy();
        for (const control of controls) control.destroy?.();
        tabStrip.remove();
        el.remove();
    }

    /** Fill `menu` with the panel the Annotate tab's Color dropdown opens — its
     *  colours and recents, and a line's weight and dashes — whose picks restyle
     *  what the Format controls act on, calling `close` after each. */
    function fillAnnotationColor(menu: HTMLElement, close: () => void): void {
        annotationColorPanel?.(menu, close);
    }

    return { el, tabStrip, mount, setCallbacks, fillAnnotationColor, destroy };
}
