import { subscribeSelector } from "../../framework/index.js";
import type { Store } from "../../framework/index.js";
import type { Action } from "../actions.js";
import type { UIState, RightPanelTab } from "../state.js";
import { RIGHT_PANEL_TABS, isLeftPanelTab } from "../state.js";
import { ICON_CLEAR } from "../icons.js";
import { createCommentsPanel } from "./CommentsPanel.js";
import type { CommentsPanelCallbacks, CommentsPanelComponent } from "./CommentsPanel.js";
import { createSearchPanel } from "./SearchPanel.js";
import type { SearchPanelCallbacks, SearchPanelComponent } from "./SearchPanel.js";
import { createButton } from "./controls.js";
import type { I18n, MessageKey } from "../i18n/index.js";

const TAB_LABEL: Record<RightPanelTab, MessageKey> = {
    search: "rightPanel.search",
    comments: "rightPanel.comments",
};

interface RightPanelSlice {
    open: boolean;
    activeTab: RightPanelTab | null;
    width: number | null;
    panelVisible: boolean;
    allDisabled: boolean;
    noTransition: boolean;
}

/**
 * The right side panel (search / comments). A port of the previous udoc-viewer's
 * panel, under a header naming the tab shown, with the panel's close button.
 * Search finds text in the document ({@link createSearchPanel}); Comments lists
 * the document's comment threads ({@link createCommentsPanel}).
 */
export function createRightPanel(i18n: I18n, comments: CommentsPanelCallbacks, search: SearchPanelCallbacks) {
    const el = document.createElement("div");
    el.className = "udoc-right-panel";

    const resizeHandle = document.createElement("div");
    resizeHandle.className = "udoc-right-panel__resize-handle";
    resizeHandle.setAttribute("role", "separator");
    resizeHandle.setAttribute("aria-orientation", "vertical");
    resizeHandle.setAttribute("aria-label", i18n.t("rightPanel.resizeHandle"));
    resizeHandle.setAttribute("tabindex", "0");
    resizeHandle.setAttribute("aria-valuenow", "320");
    resizeHandle.setAttribute("aria-valuemin", "200");
    resizeHandle.setAttribute("aria-valuemax", "500");

    const header = document.createElement("div");
    header.className = "udoc-right-panel__header";
    const title = document.createElement("span");
    title.className = "udoc-right-panel__title";
    const closeBtn = createButton({ icon: ICON_CLEAR, label: i18n.t("rightPanel.close") });
    header.append(title, closeBtn);

    const content = document.createElement("div");
    content.className = "udoc-right-panel__content";
    content.setAttribute("role", "region");

    el.append(resizeHandle, header, content);

    let unsubRender: (() => void) | null = null;
    const unsubEvents: Array<() => void> = [];
    let storeRef: Store<UIState, Action> | null = null;
    /** The tab whose content is shown, swapped only when another opens — so a
     *  resize keeps what is being typed in the Comments tab. */
    let shownTab: RightPanelTab | null = null;
    /** The Comments tab's live panel, mounted only while that tab is active. */
    let commentsPanel: CommentsPanelComponent | null = null;
    /** The Search tab's live panel, mounted only while that tab is active. */
    let searchPanel: SearchPanelComponent | null = null;

    function applyState(slice: RightPanelSlice): void {
        el.style.display = !slice.panelVisible || slice.allDisabled ? "none" : "";
        el.style.transition = slice.noTransition ? "none" : "";
        el.classList.toggle("udoc-right-panel--closed", !slice.open);
        el.style.width = slice.open && slice.width !== null ? `${slice.width}px` : "";

        if (slice.activeTab === shownTab) return;
        shownTab = slice.activeTab;
        commentsPanel?.destroy();
        commentsPanel = null;
        searchPanel?.destroy();
        searchPanel = null;
        content.innerHTML = "";
        if (slice.activeTab) {
            content.setAttribute("data-tab", slice.activeTab);
            const label = i18n.t(TAB_LABEL[slice.activeTab]);
            content.setAttribute("aria-label", label);
            title.textContent = label;
            if (slice.activeTab === "comments" && storeRef) {
                commentsPanel = createCommentsPanel(i18n, comments);
                commentsPanel.mount(content, storeRef);
            } else if (slice.activeTab === "search" && storeRef) {
                searchPanel = createSearchPanel(i18n, search);
                searchPanel.mount(content, storeRef);
            }
        } else {
            content.removeAttribute("data-tab");
            content.removeAttribute("aria-label");
        }
    }

    function setupResize(): void {
        let startX = 0;
        let startWidth = 0;
        const onPointerMove = (e: PointerEvent) => {
            // Dragging left widens the right panel.
            const newWidth = Math.max(200, Math.min(500, startWidth + (startX - e.clientX)));
            el.style.width = `${newWidth}px`;
        };
        const onPointerUp = () => {
            document.removeEventListener("pointermove", onPointerMove);
            document.removeEventListener("pointerup", onPointerUp);
            el.classList.remove("udoc-right-panel--resizing");
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            storeRef?.dispatch({ type: "SET_RIGHT_PANEL_WIDTH", width: el.offsetWidth });
        };
        const onPointerDown = (e: PointerEvent) => {
            e.preventDefault();
            startX = e.clientX;
            startWidth = el.offsetWidth;
            el.classList.add("udoc-right-panel--resizing");
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
            document.addEventListener("pointermove", onPointerMove);
            document.addEventListener("pointerup", onPointerUp);
        };
        resizeHandle.addEventListener("pointerdown", onPointerDown);
        unsubEvents.push(() => resizeHandle.removeEventListener("pointerdown", onPointerDown));

        const RESIZE_STEP = 20;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            e.preventDefault();
            const delta = e.key === "ArrowLeft" ? RESIZE_STEP : -RESIZE_STEP;
            const newWidth = Math.max(200, Math.min(500, el.offsetWidth + delta));
            el.style.width = `${newWidth}px`;
            resizeHandle.setAttribute("aria-valuenow", String(newWidth));
            storeRef?.dispatch({ type: "SET_RIGHT_PANEL_WIDTH", width: newWidth });
        };
        resizeHandle.addEventListener("keydown", onKeyDown);
        unsubEvents.push(() => resizeHandle.removeEventListener("keydown", onKeyDown));
    }

    function mount(container: HTMLElement, store: Store<UIState, Action>): void {
        container.appendChild(el);
        storeRef = store;
        const onClose = () => store.dispatch({ type: "CLOSE_PANEL" });
        closeBtn.addEventListener("click", onClose);
        unsubEvents.push(() => closeBtn.removeEventListener("click", onClose));
        setupResize();

        applyState(selectRightPanel(store.getState()));
        unsubRender = subscribeSelector(store, selectRightPanel, applyState, {
            equality: (a, b) =>
                a.open === b.open &&
                a.activeTab === b.activeTab &&
                a.width === b.width &&
                a.panelVisible === b.panelVisible &&
                a.allDisabled === b.allDisabled &&
                a.noTransition === b.noTransition,
        });
    }

    function destroy(): void {
        commentsPanel?.destroy();
        commentsPanel = null;
        searchPanel?.destroy();
        searchPanel = null;
        if (unsubRender) unsubRender();
        for (const off of unsubEvents) off();
        storeRef = null;
        el.remove();
    }

    return { el, mount, destroy };
}

function selectRightPanel(state: UIState): RightPanelSlice {
    const panel = state.activePanel;
    const isRightTab = panel !== null && !isLeftPanelTab(panel);
    const allDisabled = RIGHT_PANEL_TABS.every((tab) => state.disabledPanels.has(tab));
    return {
        open: isRightTab,
        activeTab: isRightTab ? panel : null,
        width: state.rightPanelWidth,
        panelVisible: state.rightPanelVisible,
        allDisabled,
        noTransition: state.panelTransitionsDisabled,
    };
}
