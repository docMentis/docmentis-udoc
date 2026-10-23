import { on, subscribeSelector } from "../../framework/index.js";
import type { Store } from "../../framework/index.js";
import type { Action } from "../actions.js";
import type { UIState, PointerMode } from "../state.js";
import { ICON_TOOL_POINTER, ICON_TOOL_HAND, ICON_TOOL_ZOOM } from "../icons.js";
import { createSplitButton, createMenuItem } from "./controls.js";
import type { I18n, MessageKey } from "../i18n/index.js";

/** The pointer-mode this control can switch the canvas into. */
type SelectableMode = "select" | "pan" | "marqueeZoom";

interface Tool {
    mode: SelectableMode;
    icon: string;
    label: MessageKey;
}

const TOOLS: readonly Tool[] = [
    { mode: "select", icon: ICON_TOOL_POINTER, label: "pointerTool.select" },
    { mode: "pan", icon: ICON_TOOL_HAND, label: "pointerTool.pan" },
    { mode: "marqueeZoom", icon: ICON_TOOL_ZOOM, label: "pointerTool.zoom" },
];

function pointerOf(mode: SelectableMode): PointerMode {
    return mode === "select" ? { kind: "select" } : mode === "pan" ? { kind: "pan" } : { kind: "marqueeZoom" };
}

/**
 * The pointer-mode split button — the canvas-tool selector (select / pan / zoom),
 * ported from the viewer's top-bar tool split button. Built on the shared
 * {@link createSplitButton}: the main button wears the active tool's icon and
 * re-asserts it on click; the caret opens a vertical menu to switch tools. It
 * leads the top toolbar's left zone (after the menu button), so the menu opens
 * downward like the viewer's.
 *
 * The transient `place` mode (armed by an Insert command) isn't one of these
 * tools: the button shows the last-used tool's glyph, the group's active tint
 * drops, and clicking the main button returns to that tool.
 */
export function createPointerModeMenu(i18n: I18n) {
    const split = createSplitButton({
        mainLabel: i18n.t("pointerTool.select"),
        caretLabel: i18n.t("pointerTool.options"),
        menuLabel: i18n.t("pointerTool.menu"),
    });
    const el = split.el;

    const itemBtns = new Map<SelectableMode, HTMLButtonElement>();
    for (const tool of TOOLS) {
        const item = createMenuItem({ icon: tool.icon, text: i18n.t(tool.label), role: "menuitemradio" });
        itemBtns.set(tool.mode, item);
        split.menu.appendChild(item);
    }

    let unsub: (() => void) | null = null;
    const unsubEvents: Array<() => void> = [];
    // The tool the main button re-asserts — the last simple tool actually chosen,
    // so it survives a hop through the transient `place` mode.
    let lastSimpleTool: SelectableMode = "select";

    function apply(kind: PointerMode["kind"]): void {
        const active = TOOLS.find((t) => t.mode === kind) ?? null;
        if (active) lastSimpleTool = active.mode;
        const shown = active ?? TOOLS.find((t) => t.mode === lastSimpleTool)!;
        split.main.innerHTML = shown.icon;
        const label = i18n.t(shown.label);
        split.main.title = i18n.t("pointerTool.tooltip", { tool: label });
        split.main.setAttribute("aria-label", i18n.t("pointerTool.label", { tool: label }));
        // The group reads as "active" while a pointer tool drives the canvas; it
        // dims under `place`, signalling the canvas is armed for an insert.
        split.setActive(active !== null);
        for (const tool of TOOLS) {
            const item = itemBtns.get(tool.mode)!;
            const on = tool.mode === kind;
            item.classList.toggle("udoc-menu__item--selected", on);
            item.setAttribute("aria-checked", String(on));
        }
    }

    function mount(store: Store<UIState, Action>): void {
        unsubEvents.push(
            on(split.main, "click", () =>
                store.dispatch({ type: "SET_POINTER_MODE", pointer: pointerOf(lastSimpleTool) }),
            ),
        );
        for (const tool of TOOLS) {
            unsubEvents.push(
                on(itemBtns.get(tool.mode)!, "click", (e: MouseEvent) => {
                    e.stopPropagation();
                    lastSimpleTool = tool.mode;
                    store.dispatch({ type: "SET_POINTER_MODE", pointer: pointerOf(tool.mode) });
                    split.controller.close();
                }),
            );
        }

        apply(store.getState().pointerMode.kind);
        unsub = subscribeSelector(
            store,
            (s) => s.pointerMode.kind,
            (kind) => apply(kind),
        );
    }

    function destroy(): void {
        if (unsub) unsub();
        for (const off of unsubEvents) off();
        split.destroy();
        el.remove();
    }

    return { el, mount, destroy };
}
