import { createDropdownButton, createMenuItem, subscribeSelector } from "@docmentis/udoc-ui/internal";
import type { Action, DropdownButton, Feature, Store, UIState } from "@docmentis/udoc-ui/internal";
import type { UDocType } from "@docmentis/udoc-wasm";
import type { I18n, MessageKey } from "../i18n/index.js";
import { ICON_MODE_EDIT, ICON_MODE_REVIEW, ICON_MODE_VIEW } from "../icons.js";
import { modeEntitled, modeOpen } from "../mode.js";
import type { EditorMode } from "../mode.js";
import { editState } from "../state.js";

/** Each mode as the switch shows it: its icon, its name, and what it's for. */
const MODES: Record<EditorMode, { icon: string; label: MessageKey; description: MessageKey }> = {
    view: { icon: ICON_MODE_VIEW, label: "mode.view", description: "mode.viewDescription" },
    edit: { icon: ICON_MODE_EDIT, label: "mode.edit", description: "mode.editDescription" },
    review: { icon: ICON_MODE_REVIEW, label: "mode.review", description: "mode.reviewDescription" },
};

interface ModeSwitchSlice {
    mode: EditorMode;
    allowedModes: readonly EditorMode[];
    features: readonly Feature[];
    docType: UDocType | null;
    showModeSwitch: boolean;
}

function sliceEqual(a: ModeSwitchSlice, b: ModeSwitchSlice): boolean {
    return (
        a.mode === b.mode &&
        a.allowedModes === b.allowedModes &&
        a.features === b.features &&
        a.docType === b.docType &&
        a.showModeSwitch === b.showModeSwitch
    );
}

function selectSlice(s: UIState): ModeSwitchSlice {
    const { allowedModes, showModeSwitch } = editState(s);
    return { mode: s.mode as EditorMode, allowedModes, features: s.features, docType: s.docType, showModeSwitch };
}

/** The modes the switcher offers: the host's, less those the session is not
 *  entitled to and those the open document's type isn't open to. */
function offeredModes(slice: ModeSwitchSlice): readonly EditorMode[] {
    return slice.allowedModes.filter((mode) => modeEntitled(mode, slice.features) && modeOpen(mode, slice.docType));
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
        // The current mode's icon, named in the tooltip — one width whatever
        // the mode, so switching doesn't move the tab strip beside it.
        const current = MODES[slice.mode];
        dropdown = createDropdownButton(
            {
                icon: current.icon,
                label: i18n.t("modeSwitch.current", { mode: i18n.t(current.label) }),
                field: true,
            },
            { menuLabel: i18n.t("modeSwitch.label"), menuRole: "listbox" },
        );
        for (const mode of offeredModes(slice)) {
            const { icon, label, description } = MODES[mode];
            const item = createMenuItem({
                icon,
                text: i18n.t(label),
                description: i18n.t(description),
                role: "option",
            });
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
