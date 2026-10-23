import { createMenuController, subscribeSelector } from "../../framework/index.js";
import type { UDocType } from "@docmentis/udoc-wasm";
import type { MenuController, Store } from "../../framework/index.js";
import type { Action } from "../actions.js";
import type { UIState } from "../state.js";
import { profileFor } from "../profiles.js";
import { setupRovingTabindex } from "../a11y.js";
import { ICON_CHEVRON_LEFT, ICON_CHEVRON_RIGHT, ICON_MENU } from "../icons.js";
import { alignMenuToBounds, createButton, createMenuItem } from "./controls.js";
import type { I18n } from "../i18n/index.js";

/**
 * The bottom sheet-tab bar — one tab per layout plane (a workbook's sheets),
 * switching the viewer's current plane; a very hidden sheet has none, as in
 * Excel. Shown only for doc types whose profile sets `sheetTabs`
 * (spreadsheets); every single-plane doc type leaves it empty.
 *
 * A tab click dispatches `SET_CURRENT_PLANE`, which optimistically flips the
 * active tab; the shell watches `currentPlane` and tells the worker to switch
 * (reconciling the new sheet's pages). This mirrors the ribbon's tab strip —
 * a `tablist` with roving keyboard focus — but docked at the bottom, so the CSS
 * flips it (rounded *bottom* corners) and colors it to the viewport backdrop so
 * the active sheet blends into the page area above it. Tabs that overrun the
 * room the status bar leaves it scroll, as Excel's do (see `fit`).
 */
interface SheetTabsSlice {
    docType: UDocType | null;
    planeCount: number;
    currentPlane: number;
    planeNames: readonly string[];
    planeVeryHidden: readonly boolean[];
}

function selectSlice(s: UIState): SheetTabsSlice {
    return {
        docType: s.docType,
        planeCount: s.planeCount,
        currentPlane: s.currentPlane,
        planeNames: s.planeNames,
        planeVeryHidden: s.planeVeryHidden,
    };
}

function sliceEqual(a: SheetTabsSlice, b: SheetTabsSlice): boolean {
    return (
        a.docType === b.docType &&
        a.planeCount === b.planeCount &&
        a.currentPlane === b.currentPlane &&
        a.planeNames === b.planeNames &&
        a.planeVeryHidden === b.planeVeryHidden
    );
}

/** How far the open tab's fold fillet reaches past its side (styles.ts): a tab
 *  shows whole only when that much room is left after it. */
const FOLD = 7;

/** The label a tab shows for plane `index`: the sheet's name, or a `Sheet N`
 *  fallback when the workbook left it unnamed. */
function planeLabel(names: readonly string[], index: number, i18n: I18n): string {
    const name = names[index];
    return name && name.length > 0 ? name : i18n.t("sheet.unnamed", { sheet: index + 1 });
}

/** The label a tab filled in `hex` takes, as Excel picks it: white on a colour
 *  darker than a brightness of 128 — (299 R + 587 G + 114 B) / 1000 — and black
 *  from there up. */
function tabLabelColor(hex: string): string {
    const rgb = Number.parseInt(hex.slice(1), 16);
    const brightness = (299 * ((rgb >> 16) & 0xff) + 587 * ((rgb >> 8) & 0xff) + 114 * (rgb & 0xff)) / 1000;
    return brightness < 128 ? "#fff" : "#000";
}

export function createSheetTabs(i18n: I18n) {
    const el = document.createElement("div");
    el.className = "udoc-sheet-tabs";
    el.setAttribute("role", "tablist");
    el.setAttribute("aria-label", i18n.t("sheet.tabs"));

    // The sheets' tabs, in plane order — a very hidden sheet left out, so a
    // tab's index here need not be its plane (`data-plane` holds that).
    const tabs: HTMLButtonElement[] = [];

    // Excel's sheet navigation, before the strip and shown with it: the arrows
    // scrolling the strip a tab at a time, then the list of every sheet — which
    // a right-click on either arrow opens too, as in Excel.
    const nav = document.createElement("div");
    nav.className = "udoc-sheet-tabs__nav";
    const prev = createButton({ icon: ICON_CHEVRON_LEFT, label: i18n.t("sheet.scrollLeft") });
    const next = createButton({ icon: ICON_CHEVRON_RIGHT, label: i18n.t("sheet.scrollRight") });
    const all = document.createElement("div");
    all.className = "udoc-dropdown";
    const allBtn = createButton({ icon: ICON_MENU, label: i18n.t("sheet.all") });
    allBtn.setAttribute("aria-haspopup", "menu");
    const allMenu = document.createElement("div");
    allMenu.className = "udoc-menu udoc-sheet-tabs__menu";
    allMenu.setAttribute("role", "menu");
    allMenu.setAttribute("aria-label", i18n.t("sheet.all"));
    const allList = document.createElement("div");
    allList.className = "udoc-sheet-tabs__menu-list";
    allMenu.append(allList);
    all.append(allBtn, allMenu);
    nav.append(prev, next, all);

    let unsubRender: (() => void) | null = null;
    let unsubColors: (() => void) | null = null;
    let roving: ReturnType<typeof setupRovingTabindex> | null = null;
    let menu: MenuController | null = null;
    let resizeObserver: ResizeObserver | null = null;
    // Signature of the currently-built tab set (doc type + count + names + the
    // very hidden), so a pure current-plane change only restyles instead of
    // rebuilding.
    let builtKey = "";
    // The first tab the strip shows. It scrolls a whole tab at a time, as
    // Excel's does: the tabs before this one hide, those past its end clip.
    let first = 0;

    /** Fit the tabs to the room the status bar leaves them — their slot's
     *  width. The strip scrolls from `first` — moved, when `reveal` names a tab,
     *  just far enough to show that tab whole — and back toward the start while
     *  its last tab still shows whole, so no room goes empty at its end; when
     *  every tab fits, that is the start, and neither arrow has anywhere to go.
     *  The tabs hide rather than leave the strip, so one keeps the keyboard
     *  focus across a change of sheet. */
    const fit = (reveal: number | null): void => {
        const slot = el.parentElement;
        if (slot === null) return;
        const end = slot.getBoundingClientRect().right - FOLD;
        const whole = (tab: HTMLElement | undefined): boolean =>
            tab !== undefined && tab.getBoundingClientRect().right <= end;
        const scroll = (to: number): void => {
            first = to;
            tabs.forEach((tab, i) => (tab.style.display = i < to ? "none" : ""));
        };
        const last = tabs[tabs.length - 1];
        const keep = reveal !== null && tabs[reveal] !== undefined ? reveal : null;
        scroll(Math.max(0, Math.min(first, keep ?? first, tabs.length - 1)));
        if (keep !== null) while (first < keep && !whole(tabs[keep])) scroll(first + 1);
        while (first > 0 && whole(last)) {
            scroll(first - 1);
            if (!whole(last)) {
                scroll(first + 1);
                break;
            }
        }
        prev.disabled = first === 0;
        next.disabled = last === undefined || whole(last);
        roving?.refresh();
    };
    /** The current sheet's tab, by index. */
    const current = (): number => tabs.findIndex((tab) => tab.classList.contains("udoc-sheet-tab--selected"));

    prev.addEventListener("click", () => {
        first -= 1;
        fit(null);
    });
    next.addEventListener("click", () => {
        first += 1;
        fit(null);
    });

    function mount(container: HTMLElement, store: Store<UIState, Action>): void {
        container.append(nav, el);
        roving = setupRovingTabindex(el, ".udoc-sheet-tab");

        menu = createMenuController(allBtn, allMenu, {
            onOpen: () => {
                allList.innerHTML = "";
                for (const tab of tabs) {
                    const item = createMenuItem({ text: tab.textContent ?? "", role: "menuitemradio" });
                    const on = tab.classList.contains("udoc-sheet-tab--selected");
                    item.classList.toggle("udoc-menu__item--selected", on);
                    item.setAttribute("aria-checked", String(on));
                    item.addEventListener("click", () => {
                        menu?.close();
                        store.dispatch({ type: "SET_CURRENT_PLANE", plane: Number(tab.dataset.plane) });
                    });
                    allList.appendChild(item);
                }
                alignMenuToBounds(allBtn, allMenu);
                allList.querySelector(".udoc-menu__item--selected")?.scrollIntoView({ block: "nearest" });
            },
        });
        for (const arrow of [prev, next]) {
            arrow.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                menu?.open();
            });
        }

        const build = (slice: SheetTabsSlice): void => {
            el.innerHTML = "";
            tabs.length = 0;
            first = 0;
            for (let i = 0; i < slice.planeCount; i++) {
                if (slice.planeVeryHidden[i]) continue;
                const btn = document.createElement("button");
                btn.className = "udoc-sheet-tab";
                btn.setAttribute("role", "tab");
                btn.dataset.plane = String(i);
                btn.textContent = planeLabel(slice.planeNames, i, i18n);
                el.appendChild(btn);
                tabs.push(btn);
            }
        };

        const applyActive = (current: number): void => {
            for (const btn of tabs) {
                const active = Number(btn.dataset.plane) === current;
                btn.classList.toggle("udoc-sheet-tab--selected", active);
                btn.setAttribute("aria-selected", String(active));
            }
        };

        // Each tab in its sheet's colour, as the colours land — no rebuild.
        const applyColors = (colors: readonly (string | null)[]): void => {
            for (const btn of tabs) {
                const color = colors[Number(btn.dataset.plane)] ?? null;
                btn.classList.toggle("udoc-sheet-tab--colored", color !== null);
                if (color === null) {
                    btn.style.removeProperty("--sheet-tab-color");
                    btn.style.removeProperty("--sheet-tab-label");
                } else {
                    btn.style.setProperty("--sheet-tab-color", color);
                    btn.style.setProperty("--sheet-tab-label", tabLabelColor(color));
                }
            }
        };

        const applyState = (slice: SheetTabsSlice): void => {
            const show = profileFor(slice.docType).sheetTabs && slice.planeCount > 0;
            el.style.display = show ? "" : "none";
            nav.style.display = show ? "" : "none";
            if (!show) {
                menu?.close();
                builtKey = "";
                return;
            }
            const hidden = slice.planeVeryHidden.map(Number).join("");
            const key = `${slice.docType}:${slice.planeCount}:${slice.planeNames.join("\u0000")}:${hidden}`;
            if (key !== builtKey) {
                builtKey = key;
                build(slice);
                applyColors(store.getState().planeColors);
            }
            applyActive(slice.currentPlane);
            // The current sheet's tab scrolls into view.
            fit(tabs.findIndex((tab) => Number(tab.dataset.plane) === slice.currentPlane));
        };

        // A tab click switches the active plane. Delegated so it survives rebuilds.
        el.addEventListener("click", (e) => {
            const btn = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>(".udoc-sheet-tab");
            if (!btn) return;
            store.dispatch({ type: "SET_CURRENT_PLANE", plane: Number(btn.dataset.plane) });
        });
        // A tab the keyboard reaches past the strip's end scrolls into view.
        el.addEventListener("focusin", (e) => {
            const tab = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>(".udoc-sheet-tab");
            if (tab) fit(tabs.indexOf(tab));
        });

        applyState(selectSlice(store.getState()));
        unsubRender = subscribeSelector(store, selectSlice, applyState, { equality: sliceEqual });
        // The colours land one sheet at a time, after the tabs are built: each
        // only recolours, leaving the strip where it is scrolled.
        unsubColors = subscribeSelector(store, (s) => s.planeColors, applyColors);
        // The tabs' room is their slot's width, never the tabs': refit on its
        // resize, keeping the current sheet's tab in view.
        resizeObserver = new ResizeObserver(() => fit(current()));
        resizeObserver.observe(container);
    }

    function destroy(): void {
        if (unsubRender) unsubRender();
        if (unsubColors) unsubColors();
        if (roving) roving.destroy();
        resizeObserver?.disconnect();
        menu?.destroy();
        nav.remove();
        el.remove();
    }

    return { el, mount, destroy };
}
