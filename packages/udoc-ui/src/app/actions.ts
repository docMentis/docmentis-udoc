import type {
    Feature,
    FileFormat,
    SearchMatch,
    StampIcon,
    StartError,
    UDocSearchScope,
    UDocType,
} from "@docmentis/udoc-wasm";
import type { PageComments, SelectedAnnotations } from "../worker/protocol.js";
import type { AnnotationStyle } from "./annotations.js";
import type { Peer, Scrollbars, SelectionCapabilities, Size } from "../geometry.js";
import type {
    AnnotationTool,
    CollaborationStatus,
    DeveloperOptions,
    PanelTab,
    PlaceTool,
    PointerMode,
    ThemeMode,
    LayoutMode,
    ScrollMode,
    ViewControlsPlacement,
} from "./state.js";
import type { Fit, PageGap, ScrollAlignment } from "../geometry.js";

/**
 * The UI's action union. Events express intent by dispatching one of these;
 * the reducer is the only place state changes. Keep actions coarse and
 * declarative — "scroll by this delta", not "set scrollTop to N device px".
 */
export type Action =
    // Lifecycle
    | { type: "__INIT__" }
    // Document load
    | { type: "OPEN_START" }
    | {
          type: "OPEN_SUCCESS";
          composedPageCount: number;
          scrollSize: Size;
          /** The features the document's session is entitled to. */
          features: readonly Feature[];
          docType?: UDocType;
          sourceFormat?: FileFormat;
      }
    | { type: "OPEN_FAILURE"; error: string; refusal?: StartError["code"] }
    | { type: "CLOSE_DOC" }
    // How far the document being opened has been read; `null` once the engine
    // has its bytes
    | { type: "SET_LOAD_PROGRESS"; progress: { loaded: number; total: number } | null }
    // The current slide's resolved theme color palette (the color picker's
    // "Theme Colors"). Pulled from the engine on open and on slide change, since
    // a multi-master deck re-themes per slide; null for doc types without a theme.
    // The whole picker list — set once on open, cached (stable across the session).
    // Layout changed on the *same* document (e.g. an edit added/removed pages or
    // resized content). Updates page count + content size without resetting the
    // viewport or bumping the document generation.
    | { type: "DOC_RELAYOUT"; composedPageCount: number; scrollSize: Size }
    // The document's plane roster (a spreadsheet's sheet tabs) — count, active
    // plane, and each plane's name, tab colour, kind and whether it is very
    // hidden. Pulled from the engine on open.
    | {
          type: "SET_PLANES";
          count: number;
          current: number;
          names: readonly string[];
          colors: readonly (string | null | undefined)[];
          chartsheets: readonly boolean[];
          veryHidden: readonly boolean[];
      }
    // One plane's tab colour and whether it is a chartsheet — a sheet the
    // worker loaded in the background, after the open.
    | { type: "PLANE_LOADED"; plane: number; color: string | null; chartsheet: boolean }
    // Switch the active plane — a sheet-tab click. Optimistically sets
    // `currentPlane`; the shell watches it and tells the worker to switch,
    // reconciling the new plane's pages via a follow-up DOC_RELAYOUT.
    | { type: "SET_CURRENT_PLANE"; plane: number }
    // Undo/redo availability changed (pushed by the worker after every edit, and
    // on open/merge). Drives the history buttons' enablement.
    | { type: "HISTORY_CHANGED"; canUndo: boolean; canRedo: boolean }
    // Where this one stands in the collaboration — set by the shell as it joins,
    // pauses, resumes and leaves, and from the collaboration's events.
    | { type: "SET_COLLABORATION"; collaboration: CollaborationStatus }
    // The remote peers present (pushed by the worker's peer reports).
    | { type: "SET_PEERS"; peers: readonly Peer[] }
    // This one's name in a collaboration (the host's `setUserInfo`).
    | { type: "SET_USER_NAME"; name: string }
    // Share this one's pointer, or stop — the host's setter, the people menu's toggle.
    | { type: "SET_POINTER_SHARING"; enabled: boolean }
    // The engine's selection-command capability verdict (pushed from the worker's
    // selection reports). Drives every selection-gated control (Delete, Arrange).
    | { type: "SET_SELECTION_CAPABILITIES"; capabilities: SelectionCapabilities }
    // The current selection's resolved character format (font / bold / italic),
    // projected from the engine's selection properties — the Text tab mirrors it.
    // Pushed on the same cadence as the capabilities.
    // Adopt the engine's authoritative view state from a fresh painted frame.
    // With screen-fixed (px) page spacing the content extent — and, across a
    // re-arrangement, the clamped scroll — depend on zoom in ways the reducer
    // can't derive, so the engine's values are taken verbatim (no re-clamping:
    // they may include the viewer's centering, which is a negative scroll).
    | {
          type: "SYNC_VIEW";
          scrollSize: Size;
          scrollUsedSize: Size;
          scrollbars: Scrollbars;
          scrollX: number;
          scrollY: number;
          zoom: number;
      }
    // Viewport — synthetic scroll & zoom, all in document space
    | { type: "SCROLL_BY"; dx: number; dy: number }
    | { type: "SCROLL_TO"; x: number; y: number }
    | { type: "SET_ZOOM"; zoom: number; anchorX?: number; anchorY?: number }
    | { type: "ZOOM_IN" }
    | { type: "ZOOM_OUT" }
    // The screen's CSS px per physical inch, which 100% is measured against
    | { type: "SET_DPI"; dpi: number }
    // The bounds of the explicit zoom; one that now excludes it re-clamps it.
    | { type: "SET_MIN_ZOOM"; zoom: number }
    | { type: "SET_MAX_ZOOM"; zoom: number }
    // The fit's own `zoomCap` caps its derived zoom (`null` uncapped); the
    // open default caps at `1` to never enlarge past natural size.
    // `reframe` (default `true`) bumps `refitSeq` so the Canvas re-sends
    // `setFit` and the engine re-centers the current page; the open path passes
    // `false` — the worker already fitted at open, and a re-send would re-center
    // on a stale `current_page`, scrolling a fresh document off the top.
    | { type: "SET_FIT"; fit: Fit; reframe?: boolean }
    // The fit every document opens with in place of its doc type's default
    // (`null` restores the doc type's); the shell pushes it to the worker
    | { type: "SET_DEFAULT_FIT"; fit: Fit | null }
    | { type: "RESIZE_VIEWPORT"; width: number; height: number }
    // Derived / navigation
    | { type: "SET_PAGE_INDEX"; pageIndex: number }
    // The pages the last painted frame showed (0-based, `end` exclusive)
    | { type: "SET_SHOWN_PAGES"; start: number; end: number }
    | { type: "NAVIGATE_TO_PAGE"; pageIndex: number }
    // Arrangement — scroll mode, layout mode, page rotation and the reading
    // page gap; the shell pushes each to the worker
    | { type: "SET_SCROLL_MODE"; mode: ScrollMode }
    | { type: "SET_LAYOUT_MODE"; mode: LayoutMode }
    | { type: "SET_PAGE_ROTATION"; rotation: 0 | 90 | 180 | 270 }
    | { type: "SET_PAGE_GAP"; gap: PageGap | null }
    | { type: "SET_SHOW_PAGE_GAP"; showPageGap: boolean }
    // Show/hide the page ruler (paged doc types); the shell pushes the
    // mode-combined visibility to the worker
    // Show/hide formatting marks (the ribbon toggle); the shell pushes the
    // mode- and doc-type-combined visibility to the worker
    | { type: "SET_EXTENSION_STATE"; extension: unknown }
    // Where the view-state controls are docked
    | { type: "SET_VIEW_CONTROLS_PLACEMENT"; placement: ViewControlsPlacement }
    // Side panels
    | { type: "TOGGLE_PANEL"; panel: PanelTab }
    // Open `panel` — unless it, or its side, is hidden
    | { type: "OPEN_PANEL"; panel: PanelTab }
    | { type: "CLOSE_PANEL" }
    | { type: "SET_LEFT_PANEL_WIDTH"; width: number }
    | { type: "SET_RIGHT_PANEL_WIDTH"; width: number }
    | { type: "ENABLE_PANEL_TRANSITIONS" }
    // Theme & fullscreen
    | { type: "SET_THEME"; theme: ThemeMode }
    | { type: "SET_FULLSCREEN"; isFullscreen: boolean }
    // Mode
    | { type: "SET_MODE"; mode: string }
    // Tab strip (null folds the ribbon)
    | { type: "SET_TAB"; tab: string | null }
    // Pointer mode & placement
    | { type: "SET_POINTER_MODE"; pointer: PointerMode }
    | { type: "ARM_PLACE"; tool: PlaceTool; sticky: boolean }
    | { type: "PLACEMENT_COMMITTED" }
    | { type: "TOGGLE_STICKY" }
    // Flip the Align dropdown's reference between the page/slide and the selection
    // The style an annotation tool draws with (the Format controls, tool armed)
    | { type: "SET_ANNOTATION_STYLE"; tool: AnnotationTool; style: AnnotationStyle }
    // The stamp the Stamp tool drops (its dropdown's pick)
    | { type: "SET_STAMP"; stamp: StampIcon }
    // Open or close annotation `id`'s comment popup (its bar's comment button)
    | { type: "SET_COMMENT_POPUP"; id: string; open: boolean }
    // The selection's annotations, read back after a selection report
    | { type: "SET_SELECTED_ANNOTATIONS"; selected: SelectedAnnotations | null }
    // The comments read, by page key — every page's when `everyPage`
    | { type: "SET_COMMENTS"; comments: ReadonlyMap<string, PageComments>; everyPage: boolean }
    // A new search: its query and how it matches. Drops the matches found
    // before; the shell runs it.
    | {
          type: "SET_SEARCH";
          query: string;
          caseSensitive: boolean;
          fuzzy: boolean;
          scope: UDocSearchScope | null;
      }
    // A batch of the running search's matches — the first of a run replaces
    // what an earlier run found, the rest append
    | { type: "SEARCH_BATCH"; matches: readonly SearchMatch[]; first: boolean }
    // The running search found its last match
    | { type: "SEARCH_DONE" }
    // Make match `index` current (a result clicked), and go to it — by
    // `scrollAlignment` when given, else the standing search alignment
    | { type: "SET_SEARCH_ACTIVE_INDEX"; index: number; scrollAlignment?: ScrollAlignment }
    // Make the next / previous match current, wrapping, and go to it, as above
    | { type: "SEARCH_NEXT"; scrollAlignment?: ScrollAlignment }
    | { type: "SEARCH_PREV"; scrollAlignment?: ScrollAlignment }
    // Where a search match, and a followed link, outline item or comment, lands
    | { type: "SET_SEARCH_SCROLL_ALIGNMENT"; alignment: ScrollAlignment }
    | { type: "SET_NAVIGATION_SCROLL_ALIGNMENT"; alignment: ScrollAlignment }
    // Drop the search: no query, no matches
    | { type: "CLEAR_SEARCH" }
    // Developer options (More menu → "Developer" dialog)
    | { type: "SET_DEVELOPER_OPTION"; key: keyof DeveloperOptions; value: boolean };
