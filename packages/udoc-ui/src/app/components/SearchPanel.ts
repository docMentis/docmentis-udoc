// The right panel's Search tab — a port of the previous udoc-viewer's search panel.
//
// A query field with its match-case and fuzzy toggles, the count and the
// previous / next buttons, and the results list: each match's context under a
// header for the page (or sheet) it starts on. Enter runs a new query, or steps
// to the next match of the one already run (Shift+Enter, the previous);
// choosing a result makes it current, and the view goes to it.

import type { SearchMatch } from "@docmentis/udoc-wasm";
import type { Store } from "../../framework/index.js";
import { on, subscribeSelector } from "../../framework/index.js";
import type { Action } from "../actions.js";
import { ICON_CHEVRON_DOWN, ICON_CHEVRON_UP, ICON_CLEAR, ICON_SEARCH } from "../icons.js";
import type { UIState } from "../state.js";
import { profileFor } from "../profiles.js";
import type { DocProfile } from "../profiles.js";
import type { I18n } from "../i18n/index.js";

export interface SearchPanelCallbacks {
    /** Run `query` as a new search. */
    search: (query: string, options: { caseSensitive: boolean; fuzzy: boolean }) => void;
    /** Drop the search. */
    clear: () => void;
}

interface SearchPanelSlice {
    query: string;
    caseSensitive: boolean;
    fuzzy: boolean;
    matches: readonly SearchMatch[];
    activeIndex: number;
    running: boolean;
    planeCount: number;
    planeNames: readonly string[];
    /** What a page is called — "Slide" in a deck — for a match's group. */
    pageNoun: DocProfile["pageNoun"];
}

function selectSlice(state: UIState): SearchPanelSlice {
    return {
        query: state.searchQuery,
        caseSensitive: state.searchCaseSensitive,
        fuzzy: state.searchFuzzy,
        matches: state.searchMatches,
        activeIndex: state.searchActiveIndex,
        running: state.searchRunning,
        planeCount: state.planeCount,
        planeNames: state.planeNames,
        pageNoun: profileFor(state.docType).pageNoun,
    };
}

function sliceEqual(a: SearchPanelSlice, b: SearchPanelSlice): boolean {
    return (
        a.query === b.query &&
        a.caseSensitive === b.caseSensitive &&
        a.fuzzy === b.fuzzy &&
        a.matches === b.matches &&
        a.activeIndex === b.activeIndex &&
        a.running === b.running &&
        a.planeCount === b.planeCount &&
        a.planeNames === b.planeNames &&
        a.pageNoun === b.pageNoun
    );
}

export function createSearchPanel(i18n: I18n, callbacks: SearchPanelCallbacks) {
    const el = document.createElement("div");
    el.className = "udoc-search-panel";

    const header = document.createElement("div");
    header.className = "udoc-search-panel__header";

    const inputWrapper = document.createElement("div");
    inputWrapper.className = "udoc-search-panel__input-wrapper";
    const inputIcon = document.createElement("span");
    inputIcon.className = "udoc-search-panel__input-icon";
    inputIcon.innerHTML = ICON_SEARCH;
    const input = document.createElement("input");
    input.className = "udoc-search-panel__input";
    input.type = "text";
    input.placeholder = i18n.t("search.placeholder");
    input.setAttribute("aria-label", i18n.t("search.label"));
    const clearBtn = document.createElement("button");
    clearBtn.className = "udoc-search-panel__clear";
    clearBtn.innerHTML = ICON_CLEAR;
    clearBtn.title = i18n.t("search.clear");
    clearBtn.setAttribute("aria-label", i18n.t("search.clear"));
    inputWrapper.append(inputIcon, input, clearBtn);

    const caseBtn = document.createElement("button");
    caseBtn.className = "udoc-search-panel__toggle";
    caseBtn.textContent = "Aa";
    caseBtn.title = i18n.t("search.matchCase");
    caseBtn.setAttribute("aria-label", i18n.t("search.matchCase"));
    const fuzzyBtn = document.createElement("button");
    fuzzyBtn.className = "udoc-search-panel__toggle";
    fuzzyBtn.textContent = "~";
    fuzzyBtn.title = i18n.t("search.fuzzyMatch");
    fuzzyBtn.setAttribute("aria-label", i18n.t("search.fuzzyMatch"));
    header.append(inputWrapper, caseBtn, fuzzyBtn);

    const nav = document.createElement("div");
    nav.className = "udoc-search-panel__nav";
    const status = document.createElement("span");
    status.className = "udoc-search-panel__status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const prevBtn = document.createElement("button");
    prevBtn.className = "udoc-search-panel__nav-btn";
    prevBtn.innerHTML = ICON_CHEVRON_UP;
    prevBtn.title = i18n.t("search.previousMatchTooltip");
    prevBtn.setAttribute("aria-label", i18n.t("search.previousMatch"));
    const nextBtn = document.createElement("button");
    nextBtn.className = "udoc-search-panel__nav-btn";
    nextBtn.innerHTML = ICON_CHEVRON_DOWN;
    nextBtn.title = i18n.t("search.nextMatchTooltip");
    nextBtn.setAttribute("aria-label", i18n.t("search.nextMatch"));
    const navButtons = document.createElement("div");
    navButtons.className = "udoc-search-panel__nav-buttons";
    navButtons.append(prevBtn, nextBtn);
    nav.append(status, navButtons);

    const results = document.createElement("div");
    results.className = "udoc-search-panel__results";
    results.setAttribute("role", "listbox");
    results.setAttribute("aria-label", i18n.t("search.results"));

    el.append(header, nav, results);

    let unsubRender: (() => void) | null = null;
    const unsubEvents: Array<() => void> = [];
    let storeRef: Store<UIState, Action> | null = null;
    /** The matches the list was built from, so a batch that only appends
     *  patches the list rather than rebuilding it — a rebuild between a
     *  result's mousedown and mouseup would lose its click. */
    let rendered: readonly SearchMatch[] = [];
    /** The group header last appended — a match on the same page joins it. */
    let lastGroup: string | null = null;

    function groupLabel(match: SearchMatch, slice: SearchPanelSlice): string {
        if (slice.planeCount > 1)
            return slice.planeNames[match.plane] || i18n.t("sheet.unnamed", { sheet: match.plane + 1 });
        return i18n.t(slice.pageNoun === "Slide" ? "search.slide" : "search.page", { page: match.page + 1 });
    }

    function appendResults(slice: SearchPanelSlice, from: number): void {
        for (let i = from; i < slice.matches.length; i++) {
            const match = slice.matches[i]!;
            const group = groupLabel(match, slice);
            if (group !== lastGroup) {
                lastGroup = group;
                const groupHeader = document.createElement("div");
                groupHeader.className = "udoc-search-result__page-header";
                groupHeader.textContent = group;
                results.appendChild(groupHeader);
            }
            const item = document.createElement("div");
            item.className = "udoc-search-result";
            item.setAttribute("role", "option");
            item.dataset.matchIndex = String(i);
            const [before, matched, after] = match.context;
            const mark = document.createElement("mark");
            mark.className = "udoc-search-result__match";
            mark.textContent = matched;
            item.append(document.createTextNode(before), mark, document.createTextNode(after));
            const index = i;
            item.addEventListener("click", () => storeRef?.dispatch({ type: "SET_SEARCH_ACTIVE_INDEX", index }));
            results.appendChild(item);
        }
    }

    function applyState(slice: SearchPanelSlice): void {
        if (document.activeElement !== input && input.value !== slice.query) input.value = slice.query;
        clearBtn.style.display = slice.query ? "" : "none";
        caseBtn.classList.toggle("udoc-search-panel__toggle--active", slice.caseSensitive);
        caseBtn.setAttribute("aria-pressed", String(slice.caseSensitive));
        fuzzyBtn.classList.toggle("udoc-search-panel__toggle--active", slice.fuzzy);
        fuzzyBtn.setAttribute("aria-pressed", String(slice.fuzzy));
        prevBtn.disabled = slice.matches.length === 0;
        nextBtn.disabled = slice.matches.length === 0;

        const count = slice.matches.length;
        if (count > 0) {
            status.textContent = i18n.t(slice.running ? "search.statusRunning" : "search.status", {
                current: slice.activeIndex + 1,
                total: count,
            });
        } else if (slice.running) {
            status.textContent = i18n.t("search.searching");
        } else {
            status.textContent = slice.query ? i18n.t("search.noResults") : "";
        }

        if (slice.matches !== rendered) {
            const appended =
                rendered.length > 0 &&
                slice.matches.length >= rendered.length &&
                slice.matches[rendered.length - 1] === rendered[rendered.length - 1];
            if (!appended) {
                results.innerHTML = "";
                lastGroup = null;
            }
            appendResults(slice, appended ? rendered.length : 0);
            rendered = slice.matches;
        }

        results.querySelector(".udoc-search-result--active")?.classList.remove("udoc-search-result--active");
        const active = results.querySelector(`[data-match-index="${slice.activeIndex}"]`);
        if (active) {
            active.classList.add("udoc-search-result--active");
            active.scrollIntoView({ block: "nearest" });
        }
    }

    function run(): void {
        const state = storeRef?.getState();
        if (!state) return;
        callbacks.search(input.value, { caseSensitive: state.searchCaseSensitive, fuzzy: state.searchFuzzy });
    }

    function mount(container: HTMLElement, store: Store<UIState, Action>): void {
        container.appendChild(el);
        storeRef = store;
        unsubEvents.push(
            on(input, "keydown", (e: KeyboardEvent) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    if (input.value !== store.getState().searchQuery) run();
                    else store.dispatch({ type: e.shiftKey ? "SEARCH_PREV" : "SEARCH_NEXT" });
                } else if (e.key === "Escape") {
                    store.dispatch({ type: "CLOSE_PANEL" });
                }
            }),
            on(caseBtn, "click", () => {
                const state = store.getState();
                callbacks.search(input.value, { caseSensitive: !state.searchCaseSensitive, fuzzy: state.searchFuzzy });
            }),
            on(fuzzyBtn, "click", () => {
                const state = store.getState();
                callbacks.search(input.value, { caseSensitive: state.searchCaseSensitive, fuzzy: !state.searchFuzzy });
            }),
            on(clearBtn, "click", () => {
                input.value = "";
                callbacks.clear();
                input.focus({ preventScroll: true });
            }),
            on(prevBtn, "click", () => store.dispatch({ type: "SEARCH_PREV" })),
            on(nextBtn, "click", () => store.dispatch({ type: "SEARCH_NEXT" })),
        );
        applyState(selectSlice(store.getState()));
        unsubRender = subscribeSelector(store, selectSlice, applyState, { equality: sliceEqual });
        requestAnimationFrame(() => input.focus({ preventScroll: true }));
    }

    function destroy(): void {
        unsubRender?.();
        for (const off of unsubEvents) off();
        storeRef = null;
        el.remove();
    }

    return { el, mount, destroy };
}

export type SearchPanelComponent = ReturnType<typeof createSearchPanel>;
