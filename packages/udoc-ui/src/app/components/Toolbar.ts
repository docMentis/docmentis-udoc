import { on, subscribeSelector, createMenuController } from "../../framework/index.js";
import type { Store } from "../../framework/index.js";
import type { Feature, UDocType } from "@docmentis/udoc-wasm";
import { createButton, createMenuItem, nameShortcut } from "./controls.js";
import type { HistoryOp } from "../../worker/protocol.js";
import type { Action } from "../actions.js";
import type { UIState, PanelTab, ThemeMode } from "../state.js";
import type { I18n } from "../i18n/index.js";
import { LEFT_PANEL_TABS, isLeftPanelTab } from "../state.js";
import { tabsFor } from "../profiles.js";
import type { TabSource } from "../profiles.js";
import { setupRovingTabindex } from "../a11y.js";
import {
    ICON_MENU,
    ICON_MORE,
    ICON_SEARCH,
    ICON_COMMENTS,
    ICON_FULLSCREEN,
    ICON_FULLSCREEN_EXIT,
    ICON_THEME_LIGHT,
    ICON_THEME_DARK,
    ICON_THEME_SYSTEM,
    ICON_DOWNLOAD,
    ICON_PRINT,
    ICON_CODE,
    ICON_UNDO,
    ICON_REDO,
} from "../icons.js";
import { createDeveloperOptionsModal } from "./DeveloperOptionsModal.js";
import { createPointerModeMenu } from "./PointerModeMenu.js";
import { createCollaborationMenu } from "./CollaborationMenu.js";

export interface ToolbarCallbacks {
    onDownload?: () => void;
    onPrint?: () => void;
    /** Apply a document-wide history op (undo / redo, from the history buttons). */
    onHistory?: (op: HistoryOp) => void;
    /** Pause co-editing — the people menu's Pause. */
    onPauseCollaboration?: () => void;
    /** Resume co-editing — the people menu's Resume. */
    onResumeCollaboration?: () => void;
}

interface ToolbarSlice {
    toolbarVisible: boolean;
    fullscreenButtonVisible: boolean;
    downloadButtonVisible: boolean;
    printButtonVisible: boolean;
    developerButtonVisible: boolean;
    isFullscreen: boolean;
    theme: ThemeMode;
    themeSwitchingDisabled: boolean;
    leftPanelVisible: boolean;
    rightPanelVisible: boolean;
    disabledPanels: ReadonlySet<PanelTab>;
    docType: UDocType | null;
    mode: string;
    features: readonly Feature[];
    ready: boolean;
    canUndo: boolean;
    canRedo: boolean;
}

function sliceEqual(a: ToolbarSlice, b: ToolbarSlice): boolean {
    return (
        a.toolbarVisible === b.toolbarVisible &&
        a.fullscreenButtonVisible === b.fullscreenButtonVisible &&
        a.downloadButtonVisible === b.downloadButtonVisible &&
        a.printButtonVisible === b.printButtonVisible &&
        a.developerButtonVisible === b.developerButtonVisible &&
        a.isFullscreen === b.isFullscreen &&
        a.theme === b.theme &&
        a.themeSwitchingDisabled === b.themeSwitchingDisabled &&
        a.leftPanelVisible === b.leftPanelVisible &&
        a.rightPanelVisible === b.rightPanelVisible &&
        a.disabledPanels === b.disabledPanels &&
        a.docType === b.docType &&
        a.mode === b.mode &&
        a.features === b.features &&
        a.ready === b.ready &&
        a.canUndo === b.canUndo &&
        a.canRedo === b.canRedo
    );
}

function selectSlice(state: UIState): ToolbarSlice {
    return {
        toolbarVisible: state.toolbarVisible,
        fullscreenButtonVisible: state.fullscreenButtonVisible,
        downloadButtonVisible: state.downloadButtonVisible,
        printButtonVisible: state.printButtonVisible,
        developerButtonVisible: state.developerButtonVisible,
        isFullscreen: state.isFullscreen,
        theme: state.theme,
        themeSwitchingDisabled: state.themeSwitchingDisabled,
        leftPanelVisible: state.leftPanelVisible,
        rightPanelVisible: state.rightPanelVisible,
        disabledPanels: state.disabledPanels,
        docType: state.docType,
        mode: state.mode,
        features: state.features,
        ready: state.status === "ready",
        // Typing into a cell isn't on the history, which waits for its save.
        canUndo: state.canUndo && state.activeCell?.entry == null,
        canRedo: state.canRedo && state.activeCell?.entry == null,
    };
}

/**
 * The top command bar. Two zones with the ribbon's tab strip centered in the
 * space between them:
 * - **left** — `[menu] [view-controls slot] [divider] [pointer selector]
 *   [undo/redo]`. The view-controls slot (zoom + page nav + view mode) leads the
 *   navigation group, fenced from the pointer selector (select / pan / zoom) by a
 *   divider. The slot holds the shared {@link createViewControls} instance only
 *   when `viewControlsPlacement` is `top-toolbar` (the shell parents it there);
 *   both the slot and its divider collapse otherwise. Undo/redo (document
 *   history, a different axis) trails the group, and is also the only
 *   mode-dependent element here — it shows only where the mode has tabs, so the
 *   trailing edge keeps that width change away from the navigation controls.
 * - **center** — `tabStripSlot`, taking the space the zones leave, where the
 *   shell parents the ribbon's tab strip (the ribbon owns the tabs; they
 *   bottom-anchor here and merge into the ribbon's tool surface below, and the
 *   ribbon fits them to the slot's width). Empty where the mode has no tabs (the
 *   ribbon hides it).
 * - **right** — the people button while the document is in a collaboration
 *   (who is present, sharing the pointer, pausing co-editing), then `modeSlot`,
 *   where an extension parents its mode switch, then a single app-menu
 *   dropdown collapsing search / comments / print / download / theme /
 *   fullscreen.
 */
export function createToolbar(i18n: I18n, tabsOf: TabSource) {
    const el = document.createElement("div");
    el.className = "udoc-toolbar";
    el.setAttribute("role", "toolbar");
    el.setAttribute("aria-label", i18n.t("toolbar.label"));

    // --- Left section --------------------------------------------------
    const leftSection = document.createElement("div");
    leftSection.className = "udoc-toolbar__left";
    const menuBtn = createButton({
        icon: ICON_MENU,
        label: i18n.t("toolbar.menu"),
        className: "udoc-toolbar__btn--menu",
    });

    const pointerModeMenu = createPointerModeMenu(i18n);
    const devModal = createDeveloperOptionsModal();

    // Undo / redo — trails the navigation group (view controls + pointer) at the
    // left zone's edge; shown only where the mode has tabs (see applyState).
    const historySection = document.createElement("div");
    historySection.className = "udoc-toolbar__history";
    const undoBtn = createButton({
        icon: ICON_UNDO,
        label: i18n.t("command.undo"),
        shortcut: nameShortcut({ key: "Z" }, i18n),
        className: "udoc-toolbar__btn--undo",
    });
    const redoBtn = createButton({
        icon: ICON_REDO,
        label: i18n.t("command.redo"),
        shortcut: nameShortcut({ key: "Y", mac: { key: "Z", shift: true } }, i18n),
        className: "udoc-toolbar__btn--redo",
    });
    undoBtn.dataset.command = "undo";
    redoBtn.dataset.command = "redo";
    historySection.append(undoBtn, redoBtn);

    // Host for the shared view controls when docked in the top toolbar. The
    // shell parents `viewControls.el` here (and tags it `--top` so its dropdowns
    // open downward); empty for the floating / status-bar placements.
    const viewControlsSlot = document.createElement("div");
    viewControlsSlot.className = "udoc-toolbar__view-controls";

    // Fences the docked view controls off from the pointer selector. Collapses
    // in CSS when the slot is empty (view controls not docked here), so it only
    // appears alongside them; see the `:empty + .udoc-divider` rule.
    const viewControlsDivider = document.createElement("div");
    viewControlsDivider.className = "udoc-divider";

    leftSection.append(menuBtn, viewControlsSlot, viewControlsDivider, pointerModeMenu.el, historySection);

    // Host for the ribbon's tab strip: it takes the space between the navigation
    // controls and the right section and centers the strip in it. The shell
    // parents `ribbon.tabStrip` here.
    const tabStripSlot = document.createElement("div");
    tabStripSlot.className = "udoc-toolbar__tabs-slot";

    // --- Right section (people + mode slot + app menu) -----------------
    const rightSection = document.createElement("div");
    rightSection.className = "udoc-toolbar__right";
    const collaborationMenu = createCollaborationMenu(i18n);
    const modeSlot = document.createElement("div");
    modeSlot.className = "udoc-toolbar__mode-slot";

    const appMenuContainer = document.createElement("div");
    appMenuContainer.className = "udoc-app-menu udoc-dropdown";
    const appMenuBtn = createButton({
        icon: ICON_MORE,
        label: i18n.t("toolbar.more"),
        className: "udoc-toolbar__btn--more",
    });
    appMenuBtn.setAttribute("aria-haspopup", "true");
    const appMenuDropdown = document.createElement("div");
    // Right-aligned so it hangs from the toolbar's trailing edge.
    appMenuDropdown.className = "udoc-menu udoc-menu--end";
    appMenuDropdown.setAttribute("role", "menu");
    appMenuContainer.append(appMenuBtn, appMenuDropdown);
    rightSection.append(collaborationMenu.el, modeSlot, appMenuContainer);
    const appMenu = createMenuController(appMenuBtn, appMenuDropdown, {
        isInside: (t) => appMenuContainer.contains(t),
    });

    el.append(leftSection, tabStripSlot, rightSection);

    const unsubEvents: Array<() => void> = [];
    let unsubRender: (() => void) | null = null;
    let rovingTabindex: ReturnType<typeof setupRovingTabindex> | null = null;
    const slotObserver = new MutationObserver(() => rovingTabindex?.refresh());
    let callbacks: ToolbarCallbacks = {};

    function mount(container: HTMLElement, store: Store<UIState, Action>): void {
        container.appendChild(el);
        pointerModeMenu.mount(store);
        collaborationMenu.mount(store, {
            pause: () => callbacks.onPauseCollaboration?.(),
            resume: () => callbacks.onResumeCollaboration?.(),
            shown: () => rovingTabindex?.refresh(),
        });

        // The developer-options dialog overlays the whole UI, so parent it
        // on the root (position: relative) rather than the toolbar slot.
        const root = el.closest(".udoc-ui-root");
        (root ?? container).appendChild(devModal.el);
        devModal.mount(store);

        rovingTabindex = setupRovingTabindex(el, ".udoc-btn, input");
        // The mode slot holds an extension's control, mounted after the
        // toolbar and rebuilt on its own schedule: refresh the roving set
        // whenever the slot's content changes, so its buttons join it.
        slotObserver.observe(modeSlot, { childList: true, subtree: true });

        // --- Menu button: toggle the first available left panel tab ---
        const onMenuClick = () => {
            const state = store.getState();
            if (state.activePanel !== null && isLeftPanelTab(state.activePanel)) {
                store.dispatch({ type: "CLOSE_PANEL" });
                return;
            }
            const firstTab = LEFT_PANEL_TABS.find((t) => !state.disabledPanels.has(t));
            if (firstTab) store.dispatch({ type: "TOGGLE_PANEL", panel: firstTab });
        };
        unsubEvents.push(on(menuBtn, "click", onMenuClick));

        // --- Undo / redo history buttons ---
        unsubEvents.push(on(undoBtn, "click", () => callbacks.onHistory?.("undo")));
        unsubEvents.push(on(redoBtn, "click", () => callbacks.onHistory?.("redo")));

        // --- App menu (collapsed global actions) ---
        const onSearchClick = () => store.dispatch({ type: "TOGGLE_PANEL", panel: "search" });
        const onCommentsClick = () => store.dispatch({ type: "TOGGLE_PANEL", panel: "comments" });
        const onThemeClick = () => {
            const t = store.getState().theme;
            const next: ThemeMode = t === "light" ? "dark" : t === "dark" ? "system" : "light";
            store.dispatch({ type: "SET_THEME", theme: next });
        };
        const onFullscreenClick = () => {
            const root = el.closest(".udoc-ui-root") as HTMLElement | null;
            if (!root) return;
            if (!document.fullscreenElement) root.requestFullscreen().catch(() => {});
            else document.exitFullscreen().catch(() => {});
        };
        const onPrintClick = () => callbacks.onPrint?.();
        const onDownloadClick = () => callbacks.onDownload?.();

        const onFullscreenChange = () => {
            const root = el.closest(".udoc-ui-root");
            store.dispatch({ type: "SET_FULLSCREEN", isFullscreen: document.fullscreenElement === root });
        };
        document.addEventListener("fullscreenchange", onFullscreenChange);
        unsubEvents.push(() => document.removeEventListener("fullscreenchange", onFullscreenChange));

        const buildAppMenu = (slice: ToolbarSlice) => {
            appMenuDropdown.innerHTML = "";
            const themeIcon =
                slice.theme === "light"
                    ? ICON_THEME_DARK
                    : slice.theme === "dark"
                      ? ICON_THEME_SYSTEM
                      : ICON_THEME_LIGHT;
            const themeLabel = i18n.t(
                slice.theme === "light"
                    ? "toolbar.darkMode"
                    : slice.theme === "dark"
                      ? "toolbar.systemTheme"
                      : "toolbar.lightMode",
            );
            const fsLabel = i18n.t(slice.isFullscreen ? "toolbar.exitFullscreen" : "toolbar.fullscreen");

            type Item = { icon: string; label: string; action: () => void };
            const items: Item[] = [];
            if (slice.rightPanelVisible && !slice.disabledPanels.has("search"))
                items.push({ icon: ICON_SEARCH, label: i18n.t("toolbar.search"), action: onSearchClick });
            if (slice.rightPanelVisible && !slice.disabledPanels.has("comments"))
                items.push({ icon: ICON_COMMENTS, label: i18n.t("toolbar.comments"), action: onCommentsClick });
            if (slice.printButtonVisible)
                items.push({ icon: ICON_PRINT, label: i18n.t("toolbar.print"), action: onPrintClick });
            if (slice.downloadButtonVisible)
                items.push({ icon: ICON_DOWNLOAD, label: i18n.t("toolbar.download"), action: onDownloadClick });
            if (!slice.themeSwitchingDisabled) items.push({ icon: themeIcon, label: themeLabel, action: onThemeClick });
            if (slice.fullscreenButtonVisible)
                items.push({
                    icon: slice.isFullscreen ? ICON_FULLSCREEN_EXIT : ICON_FULLSCREEN,
                    label: fsLabel,
                    action: onFullscreenClick,
                });
            // The developer entry, when the host shows it — opens the diagnostics dialog.
            if (slice.developerButtonVisible)
                items.push({ icon: ICON_CODE, label: i18n.t("toolbar.developer"), action: () => devModal.open() });
            for (const item of items) {
                const menuItem = createMenuItem({ icon: item.icon, text: item.label, role: "menuitem" });
                menuItem.addEventListener("click", (e) => {
                    e.stopPropagation();
                    appMenu.close();
                    item.action();
                });
                appMenuDropdown.appendChild(menuItem);
            }
            appMenuContainer.style.display = items.length > 0 ? "" : "none";
        };

        // --- Render ---
        const applyState = (slice: ToolbarSlice) => {
            el.style.display = slice.toolbarVisible ? "" : "none";

            const allLeftDisabled = LEFT_PANEL_TABS.every((t) => slice.disabledPanels.has(t));
            menuBtn.style.display = !slice.leftPanelVisible || allLeftDisabled ? "none" : "";

            // Undo/redo: visible where the mode has tabs — the tabs' commands
            // are its edits; greyed when the respective history stack is empty
            // (or no doc is ready yet).
            const showHistory = tabsFor(tabsOf(slice.docType, slice.mode), slice.features).length > 0;
            historySection.style.display = showHistory ? "" : "none";
            if (showHistory) {
                undoBtn.disabled = !slice.ready || !slice.canUndo;
                redoBtn.disabled = !slice.ready || !slice.canRedo;
            }

            buildAppMenu(slice);
            rovingTabindex?.refresh();
        };

        applyState(selectSlice(store.getState()));
        unsubRender = subscribeSelector(store, selectSlice, applyState, { equality: sliceEqual });
    }

    function setCallbacks(next: ToolbarCallbacks): void {
        callbacks = { ...callbacks, ...next };
    }

    function destroy(): void {
        if (unsubRender) unsubRender();
        slotObserver.disconnect();
        if (rovingTabindex) rovingTabindex.destroy();
        for (const off of unsubEvents) off();
        appMenu.destroy();
        pointerModeMenu.destroy();
        collaborationMenu.destroy();
        devModal.destroy();
        el.remove();
    }

    return { el, viewControlsSlot, tabStripSlot, modeSlot, mount, setCallbacks, destroy };
}
