import type { I18n } from "../i18n/index.js";

/**
 * A minimal status bar docked along the bottom of the UI. It hosts the
 * sheet tabs on the left ({@link sheetTabsSlot} — spreadsheet plane switcher,
 * filled by the shell's {@link createSheetTabs}) and the view controls (page
 * nav + zoom + view mode) pinned to its right edge ({@link controlsSlot}). The
 * left region between them is a home for future status content (document info,
 * save state); the sheet tabs take the space it and the controls leave.
 */
export function createStatusBar(i18n: I18n) {
    const el = document.createElement("div");
    el.className = "udoc-status-bar";
    el.setAttribute("role", "status");
    el.setAttribute("aria-label", i18n.t("statusBar.label"));

    // Sheet tabs: the spreadsheet plane switcher, anchored to the bar's left
    // edge (empty for single-plane doc types). It takes the bar's free space,
    // pushing the controls right — the room its tabs fit to.
    const sheetTabsSlot = document.createElement("div");
    sheetTabsSlot.className = "udoc-status-bar__sheet-tabs";

    // Left region: reserved for future status content, as wide as what it holds.
    const left = document.createElement("div");
    left.className = "udoc-status-bar__left";

    // Right region: the docked view controls.
    const controlsSlot = document.createElement("div");
    controlsSlot.className = "udoc-status-bar__controls";

    el.append(sheetTabsSlot, left, controlsSlot);

    function mount(container: HTMLElement): void {
        container.appendChild(el);
    }

    function setVisible(visible: boolean): void {
        el.style.display = visible ? "" : "none";
    }

    function destroy(): void {
        el.remove();
    }

    return { el, sheetTabsSlot, controlsSlot, mount, setVisible, destroy };
}
