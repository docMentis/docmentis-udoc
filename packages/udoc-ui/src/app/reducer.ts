import { cssPxPerPt } from "../geometry.js";
import type { Action } from "./actions.js";
import type { UIState, PanelTab } from "./state.js";
import { NO_FIT, VIEW_MODE, initialState, isLeftPanelTab, renderZoom, viewDpi } from "./state.js";
import { defaultTab, profileDisabledPanels } from "./profiles.js";
import type { ModeEntitlement, TabSource } from "./profiles.js";
import { visibleSpan } from "./components/Scrollbar.js";
import { defaultScrollModeForDocType } from "../worker/protocol.js";

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

/** Largest valid scroll offset so the visible window stays within content. The
 *  guide bands render outside the canvas (in the DOM), so the visible window is
 *  the viewport less only a strip the engine keeps clear for a shown scrollbar
 *  (`visibleSpan`). */
function maxScroll(content: number, visible: number, perPt: number): number {
    // Visible document-space extent is the visible span (CSS px) / CSS px per point.
    return Math.max(0, content - visible / perPt);
}

function clampScroll(state: UIState, x: number, y: number): { scrollX: number; scrollY: number } {
    // The visible extent depends on the zoom actually rendered (the fit's
    // derived zoom while fitting), not the stale explicit `zoom`.
    const perPt = renderZoom(state) * cssPxPerPt(viewDpi(state));
    return {
        scrollX: clampAxis(x, state.scrollX, maxScroll(state.scrollSize.width, visibleSpan(state, "x"), perPt)),
        scrollY: clampAxis(y, state.scrollY, maxScroll(state.scrollSize.height, visibleSpan(state, "y"), perPt)),
    };
}

/**
 * Scroll `value` on an axis that scrolls through `[0, max]`, from `current`.
 * Content that fits on the axis (`max` 0) doesn't scroll: the engine places it
 * — centred, at a negative scroll — so the axis keeps the scroll it has, the
 * engine's, rather than a 0 the engine would only move back. Each such 0 cost
 * a round trip: a `setViewport`, a frame, and the engine's scroll adopted and
 * sent back — on every relayout, and every vertical wheel step.
 */
function clampAxis(value: number, current: number, max: number): number {
    return max === 0 ? current : clamp(value, 0, max);
}

/**
 * Record a zoom change anchored at (anchorX, anchorY) — CSS px from the
 * viewport's top-left, defaulting to the viewport centre — as a `zoomRequest`
 * the Canvas forwards to the engine's `zoomAtPoint`. The reducer does **not**
 * compute the scroll: with screen-fixed page spacing the post-zoom scroll
 * depends on layout only the engine knows, so the engine owns it and the result
 * rides back through `SYNC_VIEW`. `zoom` here is the optimistic display value
 * (kept accurate by that adoption); an explicit zoom drops any fit.
 */
function applyZoom(state: UIState, nextZoomRaw: number, anchorX?: number, anchorY?: number): UIState {
    const nextZoom = clamp(nextZoomRaw, state.minZoom, state.maxZoom);
    if (nextZoom === state.zoom && state.fit.mode === "none") return state;
    return {
        ...state,
        zoom: nextZoom,
        fit: NO_FIT,
        effectiveZoom: null,
        zoomRequest: {
            zoom: nextZoom,
            x: anchorX ?? state.viewportWidth / 2,
            y: anchorY ?? state.viewportHeight / 2,
            seq: state.zoomRequest.seq + 1,
        },
    };
}

/** The shell's reducer, whose modes show the tab strips `tabsOf` gives, a
 *  session entitled to them as `entitled` says. */
export function createReducer(
    tabsOf: TabSource,
    entitled: ModeEntitlement,
): (state: UIState, action: Action) => UIState {
    return (state, action) => reduce(state, action, tabsOf, entitled);
}

function reduce(state: UIState, action: Action, tabsOf: TabSource, entitled: ModeEntitlement): UIState {
    switch (action.type) {
        case "__INIT__":
            return state;

        case "OPEN_START":
            return {
                ...state,
                comments: new Map(),
                allCommentsRead: false,
                searchMatches: [],
                searchActiveIndex: -1,
                searchRunning: false,
                status: "loading",
                error: null,
                loadProgress: null,
                refusal: null,
                docType: null,
                sourceFormat: null,
                // The sections are read back once the open is sent; the folds
                // and a rename were the last document's.
                slideSections: [],
                collapsedSlideSections: new Set(),
                renamingSlideSection: null,
            };

        case "OPEN_SUCCESS": {
            // The left-panel tabs the new doc type omits (e.g. a spreadsheet
            // drops the Thumbnails navigator — no page stack to thumbnail).
            // Seeded per doc type: the profile is the source, recomputed on each
            // open so a prior document's omissions never linger; the host's
            // hidden panels stay hidden whatever opens.
            const disabledPanels: ReadonlySet<PanelTab> = new Set<PanelTab>([
                ...profileDisabledPanels(action.docType ?? null),
                ...state.hostDisabledPanels,
            ]);
            // A mode the new session is not entitled to gives way to view,
            // which every session may use.
            const mode = entitled(state.mode, action.features) ? state.mode : VIEW_MODE;
            // Reset the view camera for the new document — scroll, page, and
            // zoom all return to defaults so nothing leaks from the previously
            // open document. `openSource` follows up with SET_FIT to adopt the
            // fit the document opens with. The scroll mode is the one the
            // worker opened it in: the host's, else the doc type's.
            return {
                ...state,
                status: "ready",
                loadProgress: null,
                error: null,
                docType: action.docType ?? null,
                sourceFormat: action.sourceFormat ?? null,
                features: action.features,
                mode,
                pointerMode: mode === state.mode ? state.pointerMode : { kind: "select" },
                pageCount: action.pageCount ?? action.firstUncomposedPage,
                firstUncomposedPage: action.firstUncomposedPage,
                scrollSize: action.scrollSize,
                disabledPanels,
                // Drop a now-disabled panel if it was the one open (e.g. the
                // Thumbnails tab when switching into a spreadsheet).
                activePanel:
                    state.activePanel !== null && disabledPanels.has(state.activePanel) ? null : state.activePanel,
                // Awaiting the first fitted frame — the scrollbar holds off until
                // then (zoom is still the open default here; see UIState).
                viewSettled: false,
                scrollbars: { x: false, y: false },
                docGeneration: state.docGeneration + 1,
                // Re-pick the active tab from the new doc type's profile (its
                // tab set may differ from the previous document's).
                activeTab: defaultTab(tabsOf(action.docType ?? null, mode)),
                // A fresh document has no history yet; the worker's open reply
                // pushes the same via a history report, but reset here too so the
                // buttons can't flash enabled between open and that report.
                canUndo: false,
                canRedo: false,
                scrollX: 0,
                scrollY: 0,
                zoom: state.defaultZoom,
                fit: initialState.fit,
                scrollMode: state.defaultScrollMode ?? defaultScrollModeForDocType(action.docType),
                effectiveZoom: initialState.effectiveZoom,
                pageIndex: 0,
                // No planes until the new document's roster lands (SET_PLANES),
                // so the previous workbook's sheets never show for this one.
                planeCount: 0,
                currentPlane: 0,
                planeNames: [],
                planeColors: [],
                planeChartsheets: [],
                planeVisibility: [],
                planeKinds: [],
            };
        }

        case "OPEN_FAILURE":
            return {
                ...state,
                status: "error",
                error: action.error,
                loadProgress: null,
                refusal: action.refusal ?? null,
                pageCount: 0,
                firstUncomposedPage: 0,
                docType: null,
                sourceFormat: null,
            };

        case "SET_LOAD_PROGRESS":
            return { ...state, loadProgress: action.progress };

        case "CLOSE_DOC":
            return {
                ...state,
                comments: new Map(),
                allCommentsRead: false,
                searchMatches: [],
                searchActiveIndex: -1,
                searchRunning: false,
                status: "empty",
                error: null,
                loadProgress: null,
                refusal: null,
                docType: null,
                sourceFormat: null,
                slideSections: [],
                collapsedSlideSections: new Set(),
                renamingSlideSection: null,
                pageCount: 0,
                firstUncomposedPage: 0,
                planeCount: 0,
                currentPlane: 0,
                planeNames: [],
                planeColors: [],
                planeChartsheets: [],
                planeVisibility: [],
                planeKinds: [],
                scrollSize: { width: 0, height: 0 },
                canUndo: false,
                canRedo: false,
                scrollX: 0,
                scrollY: 0,
                pageIndex: 0,
            };

        case "DOC_RELAYOUT": {
            // Same document, new layout: refresh page count + content size and
            // re-clamp scroll against the new extent. Viewport and document
            // generation are untouched — this is not a new document.
            const relaid = {
                ...state,
                pageCount: action.pageCount ?? action.firstUncomposedPage,
                firstUncomposedPage: action.firstUncomposedPage,
                scrollSize: action.scrollSize,
            };
            return { ...relaid, ...clampScroll(relaid, relaid.scrollX, relaid.scrollY) };
        }

        case "SET_PLANES":
            return {
                ...state,
                planeCount: action.count,
                currentPlane: action.current,
                planeNames: action.names,
                planeColors: action.colors,
                planeChartsheets: action.chartsheets,
                planeVisibility: action.visibility,
                planeKinds: action.kinds,
            };

        case "PLANE_LOADED": {
            // A sheet that lands before the roster does is in the roster's own.
            if (
                action.plane >= state.planeCount ||
                (state.planeColors[action.plane] === action.color &&
                    state.planeChartsheets[action.plane] === action.chartsheet)
            ) {
                return state;
            }
            const planeColors = [...state.planeColors];
            planeColors[action.plane] = action.color;
            const planeChartsheets = [...state.planeChartsheets];
            planeChartsheets[action.plane] = action.chartsheet;
            return { ...state, planeColors, planeChartsheets };
        }

        case "SET_CURRENT_PLANE":
            if (action.plane === state.currentPlane) return state;
            return { ...state, currentPlane: action.plane };

        case "HISTORY_CHANGED":
            if (action.canUndo === state.canUndo && action.canRedo === state.canRedo) return state;
            return { ...state, canUndo: action.canUndo, canRedo: action.canRedo };

        case "SET_COLLABORATION":
            if (action.collaboration === state.collaboration) return state;
            return { ...state, collaboration: action.collaboration };

        case "SET_PEERS":
            return { ...state, peers: action.peers };

        case "SET_USER_NAME":
            if (action.name === state.userName) return state;
            return { ...state, userName: action.name };

        case "SET_POINTER_SHARING":
            if (action.enabled === state.pointerSharing) return state;
            return { ...state, pointerSharing: action.enabled };

        case "SET_SELECTION_CAPABILITIES":
            return { ...state, selectionCaps: action.capabilities };
        case "SET_SELECTED_PAGES":
            return { ...state, selectedPages: action.pages };
        case "SET_SELECTED_SLIDES_HIDDEN":
            return { ...state, selectedSlidesHidden: action.hidden };
        case "SET_SLIDE_SECTIONS":
            return { ...state, slideSections: action.sections };
        case "SET_SELECTED_SLIDE_SECTIONS":
            return { ...state, selectedSlideSections: action.ids };
        case "SET_SLIDE_SECTIONS_COLLAPSED": {
            const collapsed = new Set(state.collapsedSlideSections);
            for (const id of action.ids) {
                if (action.collapsed) collapsed.add(id);
                else collapsed.delete(id);
            }
            return { ...state, collapsedSlideSections: collapsed };
        }
        case "SET_RENAMING_SLIDE_SECTION":
            return { ...state, renamingSlideSection: action.id };

        case "SYNC_VIEW":
            // The engine's authoritative values, adopted verbatim — no
            // clamping. With px page spacing the extent depends on zoom and the
            // engine may have re-anchored scroll across a re-arrangement; its
            // scroll can also be negative (centering content that fits). In a
            // fit mode the engine also derived the zoom — adopt it as the
            // effective zoom the UI shows; `custom` keeps its explicit zoom.
            return {
                ...state,
                scrollSize: action.scrollSize,
                scrollUsedSize: action.scrollUsedSize,
                scrollbars: action.scrollbars,
                // The engine has painted a real frame: its zoom/scroll are now
                // authoritative, so scroll geometry (the scrollbar) is valid.
                viewSettled: true,
                scrollX: action.scrollX,
                scrollY: action.scrollY,
                // Under a fit the engine derives the zoom → surface it as
                // effectiveZoom. With no fit the engine is authoritative too (a
                // marquee or zoomAtPoint set the zoom), so adopt its zoom as the
                // explicit value. This never bumps zoomRequest, so adopting it
                // can't re-trigger a zoomAtPoint.
                zoom: state.fit.mode === "none" ? action.zoom : state.zoom,
                effectiveZoom: state.fit.mode === "none" ? null : action.zoom,
            };

        case "SCROLL_BY":
            return { ...state, ...clampScroll(state, state.scrollX + action.dx, state.scrollY + action.dy) };

        case "SCROLL_TO":
            return { ...state, ...clampScroll(state, action.x, action.y) };

        case "SET_ZOOM":
            return applyZoom(state, action.zoom, action.anchorX, action.anchorY);

        case "ZOOM_IN": {
            // Snap to the next discrete step above the zoom on screen now (the
            // derived fit zoom if fitting, else the explicit one), clamped to the
            // last step. A no-op when already at or past the top step.
            const current = state.effectiveZoom ?? state.zoom;
            const steps = state.zoomSteps;
            const next = steps.find((s) => s > current + 1e-9) ?? steps[steps.length - 1] ?? current;
            if (next <= current + 1e-9) return state;
            return applyZoom(state, next);
        }

        case "ZOOM_OUT": {
            // Snap to the next discrete step below the zoom on screen now, clamped
            // to the first step. A no-op when already at or below the bottom step.
            const current = state.effectiveZoom ?? state.zoom;
            const steps = state.zoomSteps;
            const prev = [...steps].reverse().find((s) => s < current - 1e-9) ?? steps[0] ?? current;
            if (prev >= current - 1e-9) return state;
            return applyZoom(state, prev);
        }

        case "SET_DPI":
            return { ...state, dpi: action.dpi };

        case "SET_MIN_ZOOM":
        case "SET_MAX_ZOOM": {
            // An explicit zoom the new bound excludes is clamped into it; a
            // fit's derived zoom is not bounded by either.
            const bounded =
                action.type === "SET_MIN_ZOOM"
                    ? { ...state, minZoom: action.zoom }
                    : { ...state, maxZoom: action.zoom };
            return bounded.fit.mode === "none" ? applyZoom(bounded, bounded.zoom) : bounded;
        }

        case "SET_FIT": {
            // The core derives the fit zoom (the worker owns page sizes); we
            // record the fit and push it to the worker (see Canvas).
            // `effectiveZoom` is refreshed from the next painted frame's scale
            // (SYNC_VIEW); clear it when dropping the fit so the explicit zoom
            // shows.
            // Bump `refitSeq` — even when the fit is unchanged — so re-picking
            // the active fit re-sends `setFit` and re-centers the current page
            // (the Canvas listens on `refitSeq`). The open path opts out
            // (`reframe: false`): the worker already fitted at open, so a
            // re-send would only re-center on a stale `current_page` and push a
            // fresh document off the top.
            const reframe = action.reframe ?? true;
            return {
                ...state,
                fit: action.fit,
                effectiveZoom: action.fit.mode === "none" ? null : state.effectiveZoom,
                refitSeq: reframe ? state.refitSeq + 1 : state.refitSeq,
            };
        }

        case "SET_DEFAULT_FIT":
            return { ...state, defaultFit: action.fit };

        case "RESIZE_VIEWPORT": {
            const resized = { ...state, viewportWidth: action.width, viewportHeight: action.height };
            // Re-clamp scroll against the new viewport extent.
            return { ...resized, ...clampScroll(resized, resized.scrollX, resized.scrollY) };
        }

        case "SET_PAGE_INDEX":
            if (action.pageIndex === state.pageIndex) return state;
            return { ...state, pageIndex: action.pageIndex };

        case "SET_SHOWN_PAGES":
            if (action.start === state.shownPages.start && action.end === state.shownPages.end) return state;
            return { ...state, shownPages: { start: action.start, end: action.end } };

        case "NAVIGATE_TO_PAGE": {
            const pageIndex = clamp(Math.round(action.pageIndex), 0, Math.max(0, state.pageCount - 1));
            // Update the displayed page optimistically and raise a navRequest
            // the shell forwards to the worker (which owns per-page offsets and
            // does the actual scroll). The seq bumps even when the page is
            // unchanged so re-selecting the current page — re-centering after a
            // fit change — still re-scrolls.
            return {
                ...state,
                pageIndex,
                navRequest: { pageIndex, seq: state.navRequest.seq + 1 },
            };
        }

        case "SET_SCROLL_MODE":
            return { ...state, scrollMode: action.mode };

        case "SET_DEFAULT_SCROLL_MODE":
            return { ...state, defaultScrollMode: action.mode };

        case "SET_LAYOUT_MODE":
            return { ...state, layoutMode: action.mode };

        case "SET_PAGE_ROTATION":
            return { ...state, pageRotation: action.rotation };

        case "SET_PAGE_GAP":
            return { ...state, pageGap: action.gap };

        case "SET_SHOW_PAGE_GAP":
            if (action.showPageGap === state.showPageGap) return state;
            return { ...state, showPageGap: action.showPageGap };

        case "SET_EXTENSION_STATE":
            return { ...state, extension: action.extension };

        case "SET_VIEW_CONTROLS_PLACEMENT":
            if (action.placement === state.viewControlsPlacement) return state;
            return { ...state, viewControlsPlacement: action.placement };

        case "TOGGLE_PANEL": {
            if (state.disabledPanels.has(action.panel)) return state;
            const next = state.activePanel === action.panel ? null : action.panel;
            return { ...state, activePanel: next };
        }

        case "OPEN_PANEL": {
            // A hidden panel — by the host, the doc type, or its whole side —
            // can't be opened.
            const sideVisible = isLeftPanelTab(action.panel) ? state.leftPanelVisible : state.rightPanelVisible;
            if (!sideVisible || state.disabledPanels.has(action.panel)) return state;
            if (state.activePanel === action.panel) return state;
            return { ...state, activePanel: action.panel };
        }

        case "CLOSE_PANEL":
            if (state.activePanel === null) return state;
            return { ...state, activePanel: null };

        case "SET_LEFT_PANEL_WIDTH":
            return { ...state, leftPanelWidth: action.width };

        case "SET_RIGHT_PANEL_WIDTH":
            return { ...state, rightPanelWidth: action.width };

        case "SET_NOTES_OPEN":
            if (action.open === state.notesOpen) return state;
            return { ...state, notesOpen: action.open };

        case "SET_NOTES_HEIGHT":
            return { ...state, notesHeight: action.height };

        case "ENABLE_PANEL_TRANSITIONS":
            if (!state.panelTransitionsDisabled) return state;
            return { ...state, panelTransitionsDisabled: false };

        case "SET_THEME":
            return { ...state, theme: action.theme };

        case "SET_FULLSCREEN":
            if (action.isFullscreen === state.isFullscreen) return state;
            return { ...state, isFullscreen: action.isFullscreen };

        case "SET_MODE": {
            if (action.mode === state.mode || !entitled(action.mode, state.features)) return state;
            // Each mode lands in select + its default tab.
            return {
                ...state,
                mode: action.mode,
                activeTab: defaultTab(tabsOf(state.docType, action.mode)),
                pointerMode: { kind: "select" },
            };
        }

        case "SET_TAB":
            if (action.tab === state.activeTab) return state;
            return { ...state, activeTab: action.tab };

        case "SET_POINTER_MODE":
            return { ...state, pointerMode: action.pointer };

        case "ARM_PLACE":
            return { ...state, pointerMode: { kind: "place", tool: action.tool, sticky: action.sticky } };

        case "PLACEMENT_COMMITTED": {
            // One-shot insert: snap back to select after each placement unless
            // the tool is sticky (annotate's repeated-drawing workflow).
            const pm = state.pointerMode;
            if (pm.kind === "place" && !pm.sticky) return { ...state, pointerMode: { kind: "select" } };
            return state;
        }

        case "TOGGLE_STICKY": {
            const pm = state.pointerMode;
            if (pm.kind !== "place") return state;
            return { ...state, pointerMode: { ...pm, sticky: !pm.sticky } };
        }

        case "SET_ANNOTATION_STYLE":
            return { ...state, annotationStyles: { ...state.annotationStyles, [action.tool]: action.style } };

        case "SET_STAMP":
            return { ...state, stamp: action.stamp };

        case "SET_SELECTED_ANNOTATIONS": {
            // A selection holding no annotation reports null each time; keep the
            // state as it is, so subscribers don't hear of a change there isn't.
            if (action.selected === null && state.selectedAnnotations === null) return state;
            // A comment popup opened or closed stays so while its annotation is
            // the one selected — through the echo of an edit — and no longer.
            const [lone, ...rest] = action.selected?.annotations ?? [];
            const kept = rest.length === 0 && lone?.id === state.commentPopup?.id;
            return { ...state, selectedAnnotations: action.selected, commentPopup: kept ? state.commentPopup : null };
        }

        case "SET_COMMENTS":
            return { ...state, comments: action.comments, allCommentsRead: action.everyPage };

        case "SET_SEARCH":
            return {
                ...state,
                searchQuery: action.query,
                searchCaseSensitive: action.caseSensitive,
                searchFuzzy: action.fuzzy,
                searchScope: action.scope,
                searchMatches: [],
                searchActiveIndex: -1,
                searchRunning: action.query !== "",
            };

        case "SEARCH_BATCH": {
            const matches = action.first ? action.matches : [...state.searchMatches, ...action.matches];
            // A new search's first match becomes current and the view goes to
            // it; a search run again after an edit keeps the current one.
            if (state.searchActiveIndex < 0 && matches.length > 0) {
                return {
                    ...state,
                    searchMatches: matches,
                    searchActiveIndex: 0,
                    searchNavGen: state.searchNavGen + 1,
                    searchNavAlignment: null,
                };
            }
            return {
                ...state,
                searchMatches: matches,
                searchActiveIndex: Math.min(state.searchActiveIndex, matches.length - 1),
            };
        }

        case "SEARCH_DONE":
            return { ...state, searchRunning: false };

        case "SET_SEARCH_ACTIVE_INDEX":
            if (action.index < 0 || action.index >= state.searchMatches.length) return state;
            return {
                ...state,
                searchActiveIndex: action.index,
                searchNavGen: state.searchNavGen + 1,
                searchNavAlignment: action.scrollAlignment ?? null,
            };

        case "SEARCH_NEXT":
        case "SEARCH_PREV": {
            const count = state.searchMatches.length;
            if (count === 0) return state;
            const step = action.type === "SEARCH_NEXT" ? 1 : -1;
            return {
                ...state,
                searchActiveIndex: (state.searchActiveIndex + step + count) % count,
                searchNavGen: state.searchNavGen + 1,
                searchNavAlignment: action.scrollAlignment ?? null,
            };
        }

        case "SET_SEARCH_SCROLL_ALIGNMENT":
            return { ...state, searchScrollAlignment: action.alignment };

        case "SET_NAVIGATION_SCROLL_ALIGNMENT":
            return { ...state, navigationScrollAlignment: action.alignment };

        case "CLEAR_SEARCH":
            return { ...state, searchQuery: "", searchMatches: [], searchActiveIndex: -1, searchRunning: false };

        case "SET_COMMENT_POPUP":
            return { ...state, commentPopup: { id: action.id, open: action.open } };

        case "SET_DEVELOPER_OPTION":
            return {
                ...state,
                developerOptions: { ...state.developerOptions, [action.key]: action.value },
            };

        default:
            return state;
    }
}
