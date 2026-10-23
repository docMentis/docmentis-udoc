import { on, subscribeSelector, createMenuController } from "../../framework/index.js";
import type { Store, MenuController } from "../../framework/index.js";
import { createButton } from "./controls.js";
import type { Action } from "../actions.js";
import type { UIState, LayoutMode, ScrollMode } from "../state.js";
import { profileFor } from "../profiles.js";
import type { I18n, Message, MessageKey } from "../i18n/index.js";
import {
    ICON_VIEW_MODE,
    ICON_VIEW_SPREAD,
    ICON_VIEW_CONTINUOUS,
    ICON_VIEW_SINGLE_PAGE,
    ICON_VIEW_DOUBLE_PAGE,
    ICON_VIEW_COVER,
    ICON_VIEW_ROTATION,
    ICON_VIEW_GAP_ON,
    ICON_VIEW_GAP_OFF,
} from "../icons.js";

/**
 * One choice of a section: its value, its name, and its icon when the icon set
 * has one — mirrored left to right with `iconFlipped`, and turned
 * `iconRotation` degrees clockwise when the choice is a turn.
 */
interface MenuOption<T> {
    value: T;
    label: Message;
    icon?: string;
    iconFlipped?: boolean;
    iconRotation?: number;
}

const SCROLL_OPTIONS: MenuOption<ScrollMode>[] = [
    { value: "spread", label: "viewMode.spread", icon: ICON_VIEW_SPREAD },
    { value: "continuous", label: "viewMode.continuous", icon: ICON_VIEW_CONTINUOUS },
];

// The two cover layouts share one book glyph, mirrored for the cover on the left.
const LAYOUT_OPTIONS: MenuOption<LayoutMode>[] = [
    { value: "singlePage", label: "viewMode.single", icon: ICON_VIEW_SINGLE_PAGE },
    { value: "doublePage", label: "viewMode.double", icon: ICON_VIEW_DOUBLE_PAGE },
    { value: "doublePageOddRight", label: "viewMode.coverRight", icon: ICON_VIEW_COVER },
    { value: "doublePageOddLeft", label: "viewMode.coverLeft", icon: ICON_VIEW_COVER, iconFlipped: true },
];

// A page glyph turned as each choice turns the pages — CSS `rotate()` is
// clockwise, as the page rotation is.
const ROTATION_OPTIONS: MenuOption<0 | 90 | 180 | 270>[] = [
    { value: 0, label: ["viewMode.degrees", { degrees: 0 }], icon: ICON_VIEW_ROTATION, iconRotation: 0 },
    { value: 90, label: ["viewMode.degrees", { degrees: 90 }], icon: ICON_VIEW_ROTATION, iconRotation: 90 },
    { value: 180, label: ["viewMode.degrees", { degrees: 180 }], icon: ICON_VIEW_ROTATION, iconRotation: 180 },
    { value: 270, label: ["viewMode.degrees", { degrees: 270 }], icon: ICON_VIEW_ROTATION, iconRotation: 270 },
];

const PAGE_GAP_OPTIONS: MenuOption<boolean>[] = [
    { value: true, label: "viewMode.on", icon: ICON_VIEW_GAP_ON },
    { value: false, label: "viewMode.off", icon: ICON_VIEW_GAP_OFF },
];

interface ViewModeSlice {
    scrollMode: ScrollMode;
    /** Whether the doc type offers the page arrangement — Layout, Rotation, Page Gap. */
    pageArrangement: boolean;
    layoutMode: LayoutMode;
    pageRotation: 0 | 90 | 180 | 270;
    showPageGap: boolean;
}

function selectSlice(state: UIState): ViewModeSlice {
    return {
        scrollMode: state.scrollMode,
        pageArrangement: profileFor(state.docType).pageArrangement,
        layoutMode: state.layoutMode,
        pageRotation: state.pageRotation,
        showPageGap: state.showPageGap,
    };
}

function sliceEqual(a: ViewModeSlice, b: ViewModeSlice): boolean {
    return (
        a.scrollMode === b.scrollMode &&
        a.pageArrangement === b.pageArrangement &&
        a.layoutMode === b.layoutMode &&
        a.pageRotation === b.pageRotation &&
        a.showPageGap === b.showPageGap
    );
}

/**
 * The view-settings dropdown (gear-ish icon) shared by the toolbar and the
 * floating toolbar — a port of the previous udoc-viewer's menu. Each section sets one
 * arrangement setting the shell pushes to the worker: how the view scrolls, how
 * the layout groups pages into spreads, the turn every page is shown at, and
 * whether gaps show between pages — the last three only for a doc type that
 * offers the page arrangement (PDF, Word). A choice the icon set has a symbol
 * for shows it; the rest show their name.
 */
export function createViewModeMenu(i18n: I18n) {
    const el = document.createElement("div");
    el.className = "udoc-view-mode-menu";

    const toggleBtn = createButton({ icon: ICON_VIEW_MODE, label: i18n.t("viewMode.label") });
    toggleBtn.setAttribute("aria-haspopup", "true");
    el.appendChild(toggleBtn);

    const dropdown = document.createElement("div");
    // The shared menu panel; the modifier only re-anchors it above the trigger.
    dropdown.className = "udoc-menu udoc-view-mode-menu__dropdown";
    dropdown.setAttribute("role", "group");
    dropdown.setAttribute("aria-label", i18n.t("viewMode.label"));
    dropdown.style.display = "none";
    el.appendChild(dropdown);

    let unsub: (() => void) | null = null;
    let dropdownListeners: Array<() => void> = [];
    let storeRef: Store<UIState, Action> | null = null;
    let controller: MenuController | null = null;

    function createSection<T>(
        titleKey: MessageKey,
        options: MenuOption<T>[],
        current: T,
        select: (value: T) => Action,
    ): HTMLElement {
        const section = document.createElement("div");
        section.className = "udoc-view-mode-menu__section";
        const title = i18n.t(titleKey);

        const titleEl = document.createElement("div");
        titleEl.className = "udoc-view-mode-menu__title";
        titleEl.textContent = title;
        section.appendChild(titleEl);

        const row = document.createElement("div");
        row.className = "udoc-view-mode-menu__options";
        row.setAttribute("role", "radiogroup");
        row.setAttribute("aria-label", title);

        for (const opt of options) {
            const btn = document.createElement("button");
            btn.className = "udoc-view-mode-menu__option";
            const isActive = opt.value === current;
            if (isActive) btn.classList.add("udoc-view-mode-menu__option--selected");
            const label = i18n.t(opt.label);
            btn.title = label;
            btn.setAttribute("aria-label", label);
            btn.setAttribute("aria-pressed", String(isActive));

            if (opt.icon) {
                const icon = document.createElement("span");
                icon.className = "udoc-view-mode-menu__option-icon";
                icon.innerHTML = opt.icon;
                const transforms = [
                    opt.iconFlipped ? "scaleX(-1)" : "",
                    opt.iconRotation ? `rotate(${opt.iconRotation}deg)` : "",
                ].filter(Boolean);
                if (transforms.length > 0) icon.style.transform = transforms.join(" ");
                btn.appendChild(icon);
            } else {
                btn.classList.add("udoc-view-mode-menu__option--label");
                btn.textContent = label;
            }

            dropdownListeners.push(
                on(btn, "click", (e: MouseEvent) => {
                    e.stopPropagation();
                    storeRef?.dispatch(select(opt.value));
                }),
            );
            row.appendChild(btn);
        }

        section.appendChild(row);
        return section;
    }

    function buildDropdown(slice: ViewModeSlice): void {
        for (const off of dropdownListeners) off();
        dropdownListeners = [];
        dropdown.innerHTML = "";
        dropdown.append(
            createSection("viewMode.scroll", SCROLL_OPTIONS, slice.scrollMode, (mode) => ({
                type: "SET_SCROLL_MODE",
                mode,
            })),
        );
        if (!slice.pageArrangement) return;
        dropdown.append(
            createSection("viewMode.layout", LAYOUT_OPTIONS, slice.layoutMode, (mode) => ({
                type: "SET_LAYOUT_MODE",
                mode,
            })),
            createSection("viewMode.rotation", ROTATION_OPTIONS, slice.pageRotation, (rotation) => ({
                type: "SET_PAGE_ROTATION",
                rotation,
            })),
            createSection("viewMode.pageGap", PAGE_GAP_OPTIONS, slice.showPageGap, (showPageGap) => ({
                type: "SET_SHOW_PAGE_GAP",
                showPageGap,
            })),
        );
    }

    function mount(store: Store<UIState, Action>): void {
        storeRef = store;

        controller = createMenuController(toggleBtn, dropdown, { isInside: (t) => el.contains(t) });

        buildDropdown(selectSlice(store.getState()));
        unsub = subscribeSelector(store, selectSlice, buildDropdown, { equality: sliceEqual });
    }

    function destroy(): void {
        if (unsub) unsub();
        controller?.destroy();
        for (const off of dropdownListeners) off();
        el.remove();
    }

    return { el, mount, destroy };
}
