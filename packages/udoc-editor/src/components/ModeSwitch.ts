import { createDropdownButton, createMenuItem, subscribeSelector } from "@docmentis/udoc-ui/internal";
import type { Action, DropdownButton, Feature, Store, UIState } from "@docmentis/udoc-ui/internal";
import type { I18n, MessageKey } from "../i18n/index.js";
import { modeEntitled } from "../mode.js";
import type { EditorMode } from "../mode.js";
import { editState } from "../state.js";

/** Human labels for each mode. */
const MODE_LABELS: Record<EditorMode, MessageKey> = {
    view: "mode.view",
    edit: "mode.edit",
};

interface ModeSwitchSlice {
    mode: EditorMode;
    allowedModes: readonly EditorMode[];
    features: readonly Feature[];
    showModeSwitch: boolean;
}

function sliceEqual(a: ModeSwitchSlice, b: ModeSwitchSlice): boolean {
    return (
        a.mode === b.mode &&
        a.allowedModes === b.allowedModes &&
        a.features === b.features &&
        a.showModeSwitch === b.showModeSwitch
    );
}

function selectSlice(s: UIState): ModeSwitchSlice {
    const { allowedModes, showModeSwitch } = editState(s);
    return { mode: s.mode as EditorMode, allowedModes, features: s.features, showModeSwitch };
}

/** The modes the switcher offers: the host's, less those the session is not
 *  entitled to. */
function offeredModes(slice: ModeSwitchSlice): readonly EditorMode[] {
    return slice.allowedModes.filter((mode) => modeEntitled(mode, slice.features));
}

/**
 * The mode switcher — sits in the toolbar's right cluster, governing the
 * commands to its left. Rendered only when `showModeSwitch` and more than one
 * mode is offered — allowed by the host and entitled (the common embedded case
 * fixes the mode up front, so this is usually absent). A standard {@link createDropdownButton} (bordered field
 * trigger), so it matches every other dropdown by construction.
 */
export function createModeSwitch(i18n: I18n) {
    const el = document.createElement("div");
    el.className = "udoc-mode-switch";

    let storeRef: Store<UIState, Action> | null = null;
    let unsub: (() => void) | null = null;
    let dropdown: DropdownButton | null = null;
    // Signature of what's currently built, to avoid rebuilding identical DOM.
    let builtKey = "";

    function setMode(mode: EditorMode): void {
        storeRef?.dispatch({ type: "SET_MODE", mode });
    }

    function clearDropdown(): void {
        dropdown?.destroy();
        dropdown = null;
        el.innerHTML = "";
    }

    function buildDropdown(slice: ModeSwitchSlice): void {
        clearDropdown();
        dropdown = createDropdownButton(
            { text: i18n.t(MODE_LABELS[slice.mode]), label: i18n.t("modeSwitch.label"), field: true },
            { menuLabel: i18n.t("modeSwitch.label"), menuRole: "listbox" },
        );
        for (const mode of offeredModes(slice)) {
            const item = createMenuItem({ text: i18n.t(MODE_LABELS[mode]), role: "option" });
            const active = mode === slice.mode;
            item.classList.toggle("udoc-menu__item--selected", active);
            item.setAttribute("aria-selected", String(active));
            item.addEventListener("click", (e) => {
                e.stopPropagation();
                setMode(mode);
                dropdown?.controller.close();
            });
            dropdown.menu.appendChild(item);
        }
        el.appendChild(dropdown.el);
    }

    function applyState(slice: ModeSwitchSlice): void {
        const modes = offeredModes(slice);
        const visible = slice.showModeSwitch && modes.length > 1;
        el.style.display = visible ? "" : "none";
        if (!visible) {
            clearDropdown();
            builtKey = "";
            return;
        }
        // Rebuild structure only when the mode set or active mode changes.
        const key = `${slice.mode}:${modes.join(",")}`;
        if (key === builtKey) return;
        builtKey = key;
        buildDropdown(slice);
    }

    function mount(container: HTMLElement, store: Store<UIState, Action>): void {
        storeRef = store;
        container.appendChild(el);
        applyState(selectSlice(store.getState()));
        unsub = subscribeSelector(store, selectSlice, applyState, { equality: sliceEqual });
    }

    function destroy(): void {
        if (unsub) unsub();
        clearDropdown();
        el.remove();
    }

    return { el, mount, destroy };
}
