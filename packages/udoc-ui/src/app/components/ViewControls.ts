import { on, subscribeSelector, createMenuController } from "../../framework/index.js";
import type { Store } from "../../framework/index.js";
import type { Action } from "../actions.js";
import type { UIState } from "../state.js";
import { pageStep, sameFit } from "../state.js";
import { profileFor } from "../profiles.js";
import type { DocProfile } from "../profiles.js";
import type { Fit } from "../../geometry.js";
import { setupRovingTabindex } from "../a11y.js";
import { ICON_CHEVRON_LEFT, ICON_CHEVRON_RIGHT, ICON_CHEVRON_DOWN, ICON_ZOOM_IN, ICON_ZOOM_OUT } from "../icons.js";
import { createButton, nameButton, nameShortcut } from "./controls.js";
import { createViewModeMenu } from "./ViewModeMenu.js";
import type { I18n, MessageKey } from "../i18n/index.js";

/**
 * The view-state controls: `[page nav] [zoom] [view mode]`. A single, standalone
 * component — the canonical port of the viewer's floating-bar view controls —
 * that the shell mounts into whichever host the `viewControlsPlacement` selects
 * (the top toolbar, the bottom floating bar, or the status bar). It positions
 * nothing itself; the host owns chrome and placement.
 */

interface ViewControlsSlice {
    pageIndex: number;
    composedPageCount: number;
    /** The page index the previous / next buttons go to, or null for none. */
    previousPage: number | null;
    nextPage: number | null;
    zoom: number;
    fit: Fit;
    effectiveZoom: number | null;
    zoomSteps: readonly number[];
    minZoom: number;
    maxZoom: number;
    /** What a page is called — "Slide" in a deck. */
    pageNoun: DocProfile["pageNoun"];
}

function sliceEqual(a: ViewControlsSlice, b: ViewControlsSlice): boolean {
    return (
        a.pageIndex === b.pageIndex &&
        a.composedPageCount === b.composedPageCount &&
        a.previousPage === b.previousPage &&
        a.nextPage === b.nextPage &&
        a.zoom === b.zoom &&
        sameFit(a.fit, b.fit) &&
        a.effectiveZoom === b.effectiveZoom &&
        a.zoomSteps === b.zoomSteps &&
        a.minZoom === b.minZoom &&
        a.maxZoom === b.maxZoom &&
        a.pageNoun === b.pageNoun
    );
}

/** Whether the zoom list reads the same from both slices — its steps, their
 *  bounds, the fit options' names and which entry is marked. The page count and
 *  current page are no part of it. */
function sameZoomList(a: ViewControlsSlice, b: ViewControlsSlice): boolean {
    return (
        a.zoom === b.zoom &&
        sameFit(a.fit, b.fit) &&
        a.zoomSteps === b.zoomSteps &&
        a.minZoom === b.minZoom &&
        a.maxZoom === b.maxZoom &&
        a.pageNoun === b.pageNoun
    );
}

function selectSlice(state: UIState): ViewControlsSlice {
    return {
        pageIndex: state.pageIndex,
        composedPageCount: state.composedPageCount,
        previousPage: pageStep(state, -1),
        nextPage: pageStep(state, 1),
        zoom: state.zoom,
        fit: state.fit,
        effectiveZoom: state.effectiveZoom,
        zoomSteps: state.zoomSteps,
        minZoom: state.minZoom,
        maxZoom: state.maxZoom,
        pageNoun: profileFor(state.docType).pageNoun,
    };
}

/** Format zoom as a percentage string, preserving one decimal when present. */
function formatZoomPercent(zoom: number, i18n: I18n): string {
    return i18n.t("format.percent", { percent: Math.round(zoom * 1000) / 10 });
}

/** The percentage typed into the zoom field — read with either decimal mark,
 *  as the field writes it in the UI's language (`12,5 %`), and past the
 *  marks that isolate it in a right-to-left one. */
function parseZoomPercent(text: string): number {
    return parseFloat(text.replace(/[\u2066-\u2069]/g, "").replace(",", "."));
}

function getDisplayZoom(slice: ViewControlsSlice): number {
    if (slice.fit.mode === "none") return slice.zoom;
    return slice.effectiveZoom ?? slice.zoom;
}

/** The menu's fits, uncapped — so the capped open default matches none of them.
 *  Each labelled for the document's page noun ("Fit Slide" in a deck). */
const FIT_OPTIONS: Array<{ fit: Fit; label: (pageNoun: DocProfile["pageNoun"]) => MessageKey }> = [
    { fit: { mode: "width", zoomCap: null }, label: () => "zoom.fitWidth" },
    { fit: { mode: "height", zoomCap: null }, label: () => "zoom.fitHeight" },
    {
        fit: { mode: "both", zoomCap: null },
        label: (pageNoun) => (pageNoun === "Slide" ? "zoom.fitSlide" : "zoom.fitPage"),
    },
];

/** The page navigation's names, for each word a page goes by. */
const PAGE_NAVIGATION: Record<
    DocProfile["pageNoun"],
    { previous: MessageKey; next: MessageKey; number: MessageKey; group: MessageKey }
> = {
    Page: {
        previous: "viewControls.previousPage",
        next: "viewControls.nextPage",
        number: "viewControls.pageNumber",
        group: "viewControls.pageNavigation",
    },
    Slide: {
        previous: "viewControls.previousSlide",
        next: "viewControls.nextSlide",
        number: "viewControls.slideNumber",
        group: "viewControls.slideNavigation",
    },
};

export function createViewControls(i18n: I18n) {
    const el = document.createElement("div");
    el.className = "udoc-view-controls";
    el.setAttribute("role", "group");
    el.setAttribute("aria-label", i18n.t(PAGE_NAVIGATION.Page.group));

    // --- Page navigation ---
    const navSection = document.createElement("div");
    navSection.className = "udoc-toolbar__group";

    const prevBtn = createButton({ icon: ICON_CHEVRON_LEFT, label: i18n.t(PAGE_NAVIGATION.Page.previous) });

    const pageInfo = document.createElement("div");
    pageInfo.className = "udoc-toolbar__page-info";

    const pageInput = document.createElement("input");
    pageInput.className = "udoc-toolbar__page-input";
    pageInput.type = "text";
    pageInput.inputMode = "numeric";
    pageInput.setAttribute("aria-label", i18n.t(PAGE_NAVIGATION.Page.number));

    const pageTotal = document.createElement("span");
    pageTotal.className = "udoc-toolbar__page-total";

    pageInfo.append(pageInput, pageTotal);

    const nextBtn = createButton({ icon: ICON_CHEVRON_RIGHT, label: i18n.t(PAGE_NAVIGATION.Page.next) });

    navSection.append(prevBtn, pageInfo, nextBtn);

    // --- Zoom ---
    const zoomSection = document.createElement("div");
    zoomSection.className = "udoc-toolbar__group";

    const zoomOutBtn = createButton({
        icon: ICON_ZOOM_OUT,
        label: i18n.t("zoom.zoomOut"),
        shortcut: nameShortcut({ key: "-" }, i18n),
    });

    const zoomDropdownContainer = document.createElement("div");
    zoomDropdownContainer.className = "udoc-zoom-dropdown";

    const zoomToggle = document.createElement("div");
    zoomToggle.className = "udoc-zoom-dropdown__toggle";

    const zoomInput = document.createElement("input");
    zoomInput.className = "udoc-zoom-dropdown__input";
    zoomInput.type = "text";
    zoomInput.inputMode = "numeric";
    zoomInput.title = i18n.t("zoom.level");
    zoomInput.setAttribute("aria-label", i18n.t("zoom.level"));

    const zoomChevron = document.createElement("button");
    zoomChevron.className = "udoc-zoom-dropdown__chevron";
    zoomChevron.innerHTML = ICON_CHEVRON_DOWN;
    zoomChevron.title = i18n.t("zoom.options");
    zoomChevron.setAttribute("aria-label", i18n.t("zoom.options"));
    zoomChevron.setAttribute("aria-haspopup", "listbox");
    zoomChevron.setAttribute("aria-expanded", "false");

    zoomToggle.append(zoomInput, zoomChevron);

    const zoomDropdown = document.createElement("div");
    // The shared menu panel; the modifier only re-anchors it above the trigger.
    zoomDropdown.className = "udoc-menu udoc-zoom-dropdown__menu";
    zoomDropdown.setAttribute("role", "listbox");
    zoomDropdown.setAttribute("aria-label", i18n.t("zoom.levels"));
    zoomDropdown.style.display = "none";

    zoomDropdownContainer.append(zoomToggle, zoomDropdown);

    const zoomInBtn = createButton({
        icon: ICON_ZOOM_IN,
        label: i18n.t("zoom.zoomIn"),
        shortcut: nameShortcut({ key: "+" }, i18n),
    });

    zoomSection.append(zoomOutBtn, zoomDropdownContainer, zoomInBtn);

    // --- View mode ---
    const viewModeMenu = createViewModeMenu(i18n);

    el.append(navSection, zoomSection, viewModeMenu.el);

    let unsub: (() => void) | null = null;
    const unsubEvents: Array<() => void> = [];
    let rovingTabindex: ReturnType<typeof setupRovingTabindex> | null = null;
    let zoomMenu: ReturnType<typeof createMenuController> | null = null;
    // Whether the page-fit zoom options (Fit width/height/page) are offered —
    // dropped for a grid doc that has no page to fit; see setPagedSections.
    let pagedSectionsVisible = true;
    // Rebuild the zoom dropdown on demand (set in mount) so setPagedSections can
    // refresh the fit options when the doc type flips the flag after mount.
    let refreshZoom: (() => void) | null = null;
    // What a page is called in the open document — "Slide" in a deck — which
    // the page navigation's names carry.
    let pageNoun: DocProfile["pageNoun"] = "Page";

    /** Name the page navigation for `noun`, and the group it heads. */
    function namePageNavigation(noun: DocProfile["pageNoun"]): void {
        pageNoun = noun;
        const names = PAGE_NAVIGATION[noun];
        nameButton(prevBtn, i18n.t(names.previous));
        nameButton(nextBtn, i18n.t(names.next));
        pageInput.setAttribute("aria-label", i18n.t(names.number));
        el.setAttribute("aria-label", i18n.t(pagedSectionsVisible ? names.group : "zoom.label"));
    }

    function mount(store: Store<UIState, Action>): void {
        rovingTabindex = setupRovingTabindex(el, ".udoc-btn, input");

        viewModeMenu.mount(store);

        // --- Page navigation ---
        unsubEvents.push(
            on(prevBtn, "click", () => {
                const pageIndex = pageStep(store.getState(), -1);
                if (pageIndex !== null) store.dispatch({ type: "NAVIGATE_TO_PAGE", pageIndex });
            }),
            on(nextBtn, "click", () => {
                const pageIndex = pageStep(store.getState(), 1);
                if (pageIndex !== null) store.dispatch({ type: "NAVIGATE_TO_PAGE", pageIndex });
            }),
            on(pageInput, "keydown", (e: KeyboardEvent) => {
                if (e.key !== "Enter") return;
                // The field holds a page number as a reader counts pages, from 1.
                const value = parseInt(pageInput.value, 10);
                const state = store.getState();
                if (!isNaN(value) && value >= 1 && value <= state.composedPageCount) {
                    store.dispatch({ type: "NAVIGATE_TO_PAGE", pageIndex: value - 1 });
                } else {
                    pageInput.value = String(state.pageIndex + 1);
                }
                pageInput.blur();
            }),
            on(pageInput, "blur", () => {
                pageInput.value = String(store.getState().pageIndex + 1);
            }),
        );

        // --- Zoom ---
        // The chevron opens the zoom list; the controller handles toggle /
        // outside-click / Escape / aria-expanded, and tints the chevron open.
        zoomMenu = createMenuController(zoomChevron, zoomDropdown, {
            isInside: (t) => zoomDropdownContainer.contains(t),
            onOpen: () => zoomChevron.classList.add("udoc-zoom-dropdown__chevron--open"),
            onClose: () => zoomChevron.classList.remove("udoc-zoom-dropdown__chevron--open"),
        });

        unsubEvents.push(
            on(zoomOutBtn, "click", () => store.dispatch({ type: "ZOOM_OUT" })),
            on(zoomInBtn, "click", () => store.dispatch({ type: "ZOOM_IN" })),
            on(zoomInput, "keydown", (e: KeyboardEvent) => {
                if (e.key !== "Enter") return;
                const value = parseZoomPercent(zoomInput.value);
                const state = store.getState();
                if (!isNaN(value) && value >= 10 && value <= 500) {
                    store.dispatch({ type: "SET_ZOOM", zoom: value / 100 });
                } else {
                    zoomInput.value = formatZoomPercent(getDisplayZoom(selectSlice(state)), i18n);
                }
                zoomInput.blur();
            }),
            on(zoomInput, "focus", () => zoomInput.select()),
            on(zoomInput, "blur", () => {
                zoomInput.value = formatZoomPercent(getDisplayZoom(selectSlice(store.getState())), i18n);
            }),
        );

        const buildZoomDropdown = (slice: ViewControlsSlice) => {
            zoomDropdown.innerHTML = "";

            const stepsSection = document.createElement("div");
            stepsSection.className = "udoc-zoom-dropdown__section";
            for (const step of slice.zoomSteps) {
                // A step outside the zoom bounds would only clamp to one.
                if (step < slice.minZoom || step > slice.maxZoom) continue;
                const item = document.createElement("button");
                item.className = "udoc-zoom-dropdown__item";
                item.setAttribute("role", "option");
                const stepPercent = Math.round(step * 100);
                const isActive = slice.fit.mode === "none" && stepPercent === Math.round(slice.zoom * 100);
                if (isActive) item.classList.add("udoc-zoom-dropdown__item--selected");
                item.setAttribute("aria-selected", String(isActive));
                item.textContent = i18n.t("format.percent", { percent: stepPercent });
                item.addEventListener("click", (e) => {
                    e.stopPropagation();
                    store.dispatch({ type: "SET_ZOOM", zoom: step });
                    zoomMenu?.close();
                });
                stepsSection.appendChild(item);
            }
            zoomDropdown.appendChild(stepsSection);

            // The page-fit options fit a *page*; a grid doc has none, so they're
            // dropped there (alongside the other paged sections), leaving the
            // dropdown a bare list of zoom steps.
            if (pagedSectionsVisible) {
                const dividerEl = document.createElement("div");
                dividerEl.className = "udoc-zoom-dropdown__divider";
                dividerEl.setAttribute("role", "separator");
                zoomDropdown.appendChild(dividerEl);

                const modeSection = document.createElement("div");
                modeSection.className = "udoc-zoom-dropdown__section";
                for (const opt of FIT_OPTIONS) {
                    const item = document.createElement("button");
                    item.className = "udoc-zoom-dropdown__item";
                    item.setAttribute("role", "option");
                    const isActive = sameFit(slice.fit, opt.fit);
                    if (isActive) item.classList.add("udoc-zoom-dropdown__item--selected");
                    item.setAttribute("aria-selected", String(isActive));
                    item.textContent = i18n.t(opt.label(slice.pageNoun));
                    item.addEventListener("click", (e) => {
                        e.stopPropagation();
                        // Re-selecting the active fit re-centers via the engine:
                        // `SET_FIT` always bumps `refitSeq`, so the Canvas
                        // re-sends `setFit` and the viewer re-centers the current
                        // page. (A `NAVIGATE_TO_PAGE` here would instead scroll to the
                        // page *top*, fighting that centering.)
                        store.dispatch({ type: "SET_FIT", fit: opt.fit });
                        zoomMenu?.close();
                    });
                    modeSection.appendChild(item);
                }
                zoomDropdown.appendChild(modeSection);
            }
        };
        refreshZoom = () => buildZoomDropdown(selectSlice(store.getState()));

        // --- Render ---
        // Compose-ahead grows the page count several times a second while a
        // document fills in, so each step lands here: leave alone what the
        // reader is using — a number being typed, the zoom list under a press
        // (a rebuild swaps its items between press and release, and the click
        // is lost) — and redo only what the change reaches.
        const applyState = (slice: ViewControlsSlice, prev?: ViewControlsSlice) => {
            if (slice.pageNoun !== pageNoun) namePageNavigation(slice.pageNoun);
            if (document.activeElement !== pageInput) pageInput.value = String(slice.pageIndex + 1);
            pageTotal.textContent = ` / ${slice.composedPageCount}`;
            if (document.activeElement !== zoomInput) {
                zoomInput.value = formatZoomPercent(getDisplayZoom(slice), i18n);
            }
            prevBtn.disabled = slice.previousPage === null;
            nextBtn.disabled = slice.nextPage === null;
            if (!prev || !sameZoomList(prev, slice)) buildZoomDropdown(slice);
            // The roving order holds the enabled buttons, so it moves only when
            // previous / next turn on or off.
            if (
                !prev ||
                (prev.previousPage === null) !== (slice.previousPage === null) ||
                (prev.nextPage === null) !== (slice.nextPage === null)
            ) {
                rovingTabindex?.refresh();
            }
        };

        applyState(selectSlice(store.getState()));
        unsub = subscribeSelector(store, selectSlice, applyState, { equality: sliceEqual });
    }

    /**
     * Show or hide the paged sections — page navigation, the view-mode menu,
     * and the page-fit zoom options (Fit
     * width/height/page) — leaving the zoom steps standalone. A grid document
     * (spreadsheet) has no page stack to scroll, group or turn, and no page to
     * fit, so the shell strips all three and docks the bare zoom control
     * in the status bar. Safe to call before {@link mount}; re-runs the roving
     * tabindex so the now-hidden buttons drop out of the arrow-key order.
     */
    function setPagedSections(visible: boolean): void {
        pagedSectionsVisible = visible;
        const display = visible ? "" : "none";
        navSection.style.display = display;
        viewModeMenu.el.style.display = display;
        el.setAttribute("aria-label", i18n.t(visible ? PAGE_NAVIGATION[pageNoun].group : "zoom.label"));
        // Rebuild the zoom list so the page-fit options follow the flag (a no-op
        // before mount, where the first buildZoomDropdown already reads it).
        refreshZoom?.();
        rovingTabindex?.refresh();
    }

    function destroy(): void {
        if (unsub) unsub();
        if (rovingTabindex) rovingTabindex.destroy();
        zoomMenu?.destroy();
        for (const off of unsubEvents) off();
        viewModeMenu.destroy();
        el.remove();
    }

    return { el, mount, setPagedSections, destroy };
}
