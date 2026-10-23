import { subscribeSelector } from "../../framework/index.js";
import type { Store } from "../../framework/index.js";
import type { WorkerClient } from "../../worker/WorkerClient.js";
import type { Action } from "../actions.js";
import type { UIState, LeftPanelTab, PanelTab } from "../state.js";
import { LEFT_PANEL_TABS, isLeftPanelTab } from "../state.js";
import { ICON_THUMBNAIL, ICON_OUTLINE, ICON_LAYERS, ICON_ATTACHMENT } from "../icons.js";
import { createLayersPanel } from "./LayersPanel.js";
import type { LayersPanelComponent } from "./LayersPanel.js";
import { createOutlinePanel } from "./OutlinePanel.js";
import type { OutlinePanelCallbacks, OutlinePanelComponent } from "./OutlinePanel.js";
import { createThumbnailPanel } from "./ThumbnailPanel.js";
import type { ThumbnailPanelComponent } from "./ThumbnailPanel.js";
import type { I18n, MessageKey } from "../i18n/index.js";

interface TabConfig {
    id: LeftPanelTab;
    label: MessageKey;
    icon: string;
}

const TAB_PRESENTATION: Record<LeftPanelTab, { label: MessageKey; icon: string }> = {
    thumbnail: { label: "leftPanel.thumbnails", icon: ICON_THUMBNAIL },
    outline: { label: "leftPanel.outline", icon: ICON_OUTLINE },
    layers: { label: "leftPanel.layers", icon: ICON_LAYERS },
    attachments: { label: "leftPanel.attachments", icon: ICON_ATTACHMENT },
};

const TABS: TabConfig[] = LEFT_PANEL_TABS.map((id) => ({ id, ...TAB_PRESENTATION[id] }));

interface LeftPanelSlice {
    open: boolean;
    activeTab: LeftPanelTab | null;
    width: number | null;
    panelVisible: boolean;
    disabledPanels: ReadonlySet<PanelTab>;
    allDisabled: boolean;
    singleEnabledTab: boolean;
    noTransition: boolean;
}

/**
 * The left side panel: a vertical tab strip (thumbnails / outline / layers /
 * attachments), a resizable content area, and a drag handle.
 * A port of the previous udoc-viewer's panel — the chrome is complete; the thumbnails,
 * the outline and the layers are live, the other tabs placeholders for now.
 */
export function createLeftPanel(i18n: I18n, outline: OutlinePanelCallbacks) {
    const el = document.createElement("div");
    el.className = "udoc-left-panel";

    const tabBar = document.createElement("div");
    tabBar.className = "udoc-left-panel__tabs";
    tabBar.setAttribute("role", "tablist");
    tabBar.setAttribute("aria-label", i18n.t("leftPanel.tabs"));

    const tabButtons = new Map<LeftPanelTab, HTMLButtonElement>();
    for (const tab of TABS) {
        const btn = document.createElement("button");
        btn.className = "udoc-left-panel__tab";
        btn.id = `udoc-left-tab-${tab.id}`;
        btn.setAttribute("aria-label", i18n.t(tab.label));
        btn.setAttribute("role", "tab");
        btn.setAttribute("aria-selected", "false");
        btn.setAttribute("aria-controls", "udoc-left-panel-content");
        btn.setAttribute("data-tab", tab.id);
        btn.title = i18n.t(tab.label);
        btn.innerHTML = tab.icon;
        tabButtons.set(tab.id, btn);
        tabBar.appendChild(btn);
    }

    const content = document.createElement("div");
    content.className = "udoc-left-panel__content";
    content.id = "udoc-left-panel-content";
    content.setAttribute("role", "tabpanel");

    const resizeHandle = document.createElement("div");
    resizeHandle.className = "udoc-left-panel__resize-handle";
    resizeHandle.setAttribute("role", "separator");
    resizeHandle.setAttribute("aria-orientation", "vertical");
    resizeHandle.setAttribute("aria-label", i18n.t("leftPanel.resizeHandle"));
    resizeHandle.setAttribute("tabindex", "0");
    resizeHandle.setAttribute("aria-valuenow", "280");
    resizeHandle.setAttribute("aria-valuemin", "200");
    resizeHandle.setAttribute("aria-valuemax", "500");

    el.append(tabBar, content, resizeHandle);

    let unsubRender: (() => void) | null = null;
    let unsubContent: (() => void) | null = null;
    const unsubEvents: Array<() => void> = [];
    let storeRef: Store<UIState, Action> | null = null;
    let clientRef: WorkerClient | null = null;
    /** The Thumbnails tab's live panel, mounted only while that tab is active. */
    let thumbnailPanel: ThumbnailPanelComponent | null = null;
    /** The Outline tab's live panel, mounted only while that tab is active. */
    let outlinePanel: OutlinePanelComponent | null = null;
    /** The Layers tab's live panel, mounted only while that tab is active. */
    let layersPanel: LayersPanelComponent | null = null;

    function applyState(slice: LeftPanelSlice): void {
        el.style.display = !slice.panelVisible || slice.allDisabled ? "none" : "";
        el.style.transition = slice.noTransition ? "none" : "";
        el.classList.toggle("udoc-left-panel--closed", !slice.open);
        tabBar.style.display = slice.singleEnabledTab ? "none" : "";
        el.style.width = slice.open && slice.width !== null ? `${slice.width}px` : "";

        for (const [tabId, btn] of tabButtons) {
            const isActive = tabId === slice.activeTab;
            btn.classList.toggle("udoc-left-panel__tab--selected", isActive);
            btn.setAttribute("aria-selected", String(isActive));
            btn.style.display = slice.disabledPanels.has(tabId) ? "none" : "";
        }

        if (slice.activeTab) content.setAttribute("aria-labelledby", `udoc-left-tab-${slice.activeTab}`);
        else content.removeAttribute("aria-labelledby");
    }

    function applyContent(activeTab: LeftPanelTab | null): void {
        // Tear down the live thumbnail panel (if any) before swapping content,
        // so it cancels in-flight renders and releases its listeners.
        if (thumbnailPanel) {
            thumbnailPanel.destroy();
            thumbnailPanel = null;
        }
        if (outlinePanel) {
            outlinePanel.destroy();
            outlinePanel = null;
        }
        if (layersPanel) {
            layersPanel.destroy();
            layersPanel = null;
        }
        content.innerHTML = "";
        if (!activeTab) return;
        if (activeTab === "thumbnail" && storeRef && clientRef) {
            thumbnailPanel = createThumbnailPanel(i18n);
            thumbnailPanel.mount(content, storeRef, clientRef);
            return;
        }
        if (activeTab === "outline" && storeRef && clientRef) {
            outlinePanel = createOutlinePanel(i18n, outline);
            outlinePanel.mount(content, storeRef, clientRef);
            return;
        }
        if (activeTab === "layers" && storeRef && clientRef) {
            layersPanel = createLayersPanel(i18n);
            layersPanel.mount(content, storeRef, clientRef);
            return;
        }
        const label = i18n.t(TAB_PRESENTATION[activeTab].label);
        const placeholder = document.createElement("div");
        placeholder.className = "udoc-panel-placeholder";
        placeholder.textContent = i18n.t("leftPanel.placeholder", { panel: label });
        content.appendChild(placeholder);
    }

    function setupResize(): void {
        let startX = 0;
        let startWidth = 0;
        const onPointerMove = (e: PointerEvent) => {
            const newWidth = Math.max(200, Math.min(500, startWidth + (e.clientX - startX)));
            el.style.width = `${newWidth}px`;
        };
        const onPointerUp = () => {
            document.removeEventListener("pointermove", onPointerMove);
            document.removeEventListener("pointerup", onPointerUp);
            el.classList.remove("udoc-left-panel--resizing");
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            storeRef?.dispatch({ type: "SET_LEFT_PANEL_WIDTH", width: el.offsetWidth });
        };
        const onPointerDown = (e: PointerEvent) => {
            e.preventDefault();
            startX = e.clientX;
            startWidth = el.offsetWidth;
            el.classList.add("udoc-left-panel--resizing");
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
            const delta = e.key === "ArrowRight" ? RESIZE_STEP : -RESIZE_STEP;
            const newWidth = Math.max(200, Math.min(500, el.offsetWidth + delta));
            el.style.width = `${newWidth}px`;
            resizeHandle.setAttribute("aria-valuenow", String(newWidth));
            storeRef?.dispatch({ type: "SET_LEFT_PANEL_WIDTH", width: newWidth });
        };
        resizeHandle.addEventListener("keydown", onKeyDown);
        unsubEvents.push(() => resizeHandle.removeEventListener("keydown", onKeyDown));
    }

    function mount(container: HTMLElement, store: Store<UIState, Action>, client: WorkerClient): void {
        container.appendChild(el);
        storeRef = store;
        clientRef = client;

        for (const [tabId, btn] of tabButtons) {
            const onClick = () => store.dispatch({ type: "TOGGLE_PANEL", panel: tabId });
            btn.addEventListener("click", onClick);
            unsubEvents.push(() => btn.removeEventListener("click", onClick));
        }

        setupResize();

        const initial = selectLeftPanel(store.getState());
        applyState(initial);
        unsubRender = subscribeSelector(store, selectLeftPanel, applyState, {
            equality: (a, b) =>
                a.open === b.open &&
                a.activeTab === b.activeTab &&
                a.width === b.width &&
                a.panelVisible === b.panelVisible &&
                a.disabledPanels === b.disabledPanels &&
                a.allDisabled === b.allDisabled &&
                a.singleEnabledTab === b.singleEnabledTab &&
                a.noTransition === b.noTransition,
        });

        applyContent(initial.activeTab);
        unsubContent = subscribeSelector(store, (state) => selectLeftPanel(state).activeTab, applyContent);
    }

    function destroy(): void {
        if (thumbnailPanel) {
            thumbnailPanel.destroy();
            thumbnailPanel = null;
        }
        if (outlinePanel) {
            outlinePanel.destroy();
            outlinePanel = null;
        }
        if (layersPanel) {
            layersPanel.destroy();
            layersPanel = null;
        }
        if (unsubRender) unsubRender();
        if (unsubContent) unsubContent();
        for (const off of unsubEvents) off();
        storeRef = null;
        clientRef = null;
        el.remove();
    }

    return { el, mount, destroy };
}

function selectLeftPanel(state: UIState): LeftPanelSlice {
    const panel = state.activePanel;
    const isLeftTab = panel !== null && isLeftPanelTab(panel);
    const enabledCount = TABS.reduce((n, tab) => (state.disabledPanels.has(tab.id) ? n : n + 1), 0);
    return {
        open: isLeftTab,
        activeTab: isLeftTab ? panel : null,
        width: state.leftPanelWidth,
        panelVisible: state.leftPanelVisible,
        disabledPanels: state.disabledPanels,
        allDisabled: enabledCount === 0,
        singleEnabledTab: enabledCount === 1,
        noTransition: state.panelTransitionsDisabled,
    };
}
