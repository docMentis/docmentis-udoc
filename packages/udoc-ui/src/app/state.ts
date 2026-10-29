import { EMPTY_SELECTION_CAPABILITIES } from "../geometry.js";
import type { Peer, Scrollbars, SelectionCapabilities, Size } from "../geometry.js";
import { defaultDpiForDocType } from "../worker/protocol.js";
import type { PageComments, SelectedAnnotations, SlideSectionRun } from "../worker/protocol.js";
import type { AnnotationStyles } from "./annotations.js";
import type { MessageKey } from "./i18n/index.js";
import type {
    Feature,
    FileFormat,
    PresentationPlaneKind,
    SearchMatch,
    SheetState,
    StampIcon,
    StartError,
    UDocSearchScope,
    UDocType,
} from "@docmentis/udoc-wasm";
import type { Fit, LayoutMode, PageGap, ScrollAlignment, ScrollMode } from "../geometry.js";

export type { LayoutMode, ScrollMode };

/** Status of the current document load. */
export type LoadStatus = "empty" | "loading" | "ready" | "error";

// -----------------------------------------------------------------------------
// Theme
// -----------------------------------------------------------------------------

export type ThemeMode = "light" | "dark" | "system";

// -----------------------------------------------------------------------------
// View controls placement
// -----------------------------------------------------------------------------

/**
 * Where the view-state controls (page nav + zoom + view mode) are docked:
 *
 * - `top-toolbar` — inline in the top command bar's left zone.
 * - `floating` — a bar hovering over the bottom-center of the viewport that
 *   auto-hides when idle (the default).
 * - `status-bar` — pinned to the right edge of the bottom status bar.
 *
 * When `top-toolbar` is selected but the top toolbar is hidden (chromeless
 * embeds), the controls fall back to `floating` so they stay reachable.
 */
export type ViewControlsPlacement = "top-toolbar" | "floating" | "status-bar";

// -----------------------------------------------------------------------------
// Zoom
// -----------------------------------------------------------------------------

/** No fit: the zoom is the explicit one the controls set. */
export const NO_FIT: Fit = { mode: "none", zoomCap: null };

/** Whether `a` and `b` are the same fit — the same mode under the same cap. */
export function sameFit(a: Fit, b: Fit): boolean {
    return a.mode === b.mode && a.zoomCap === b.zoomCap;
}

/**
 * The default bounds of the explicit (no-fit) zoom — the manual zoom-out floor
 * and zoom-in ceiling, which the host's `minZoom` / `maxZoom` replace
 * ({@link UIState.minZoom}). Fit modes are not clamped by them: the engine
 * derives their zoom (it can go below the floor to fit a very large image) and
 * the UI shows it verbatim as `effectiveZoom`.
 */
export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 16;

/**
 * The faithful zoom currently on screen: the fit's derived zoom while fitting,
 * else the explicit one. This — not `zoom`, which holds the last explicit value
 * and goes stale under a fit — is the scale all scroll, scrollbar, and pointer
 * math must use.
 */
export function renderZoom(state: { zoom: number; effectiveZoom: number | null }): number {
    return state.effectiveZoom ?? state.zoom;
}

/**
 * The CSS px per inch the open document shows at: the host's {@link UIState.dpi},
 * else its doc type's default ({@link defaultDpiForDocType}). This — not `dpi` —
 * is what every pt ↔ CSS-px conversion takes, as the worker hands the engine.
 */
export function viewDpi(state: { dpi: number | null; docType: UDocType | null }): number {
    return state.dpi ?? defaultDpiForDocType(state.docType ?? undefined);
}

/**
 * The page index a step to the next (`1`) or previous (`-1`) page lands on:
 * in spread mode the next or previous spread's, past the shown spread
 * ({@link UIState.shownPages}), since a page of the shown spread is already
 * in view; otherwise the adjacent page. `null` past either end of the composed
 * pages.
 */
export function pageStep(state: UIState, by: 1 | -1): number | null {
    const { start, end } = state.shownPages;
    const bySpread = state.scrollMode === "spread" && end > start;
    const target = !bySpread ? state.pageIndex + by : by > 0 ? end : start - 1;
    return target >= 0 && target < state.pageCount ? target : null;
}

/** Discrete zoom steps the in/out buttons and the zoom dropdown snap to. */
export const DEFAULT_ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5] as const;

// -----------------------------------------------------------------------------
// Side panels
// -----------------------------------------------------------------------------

/** Tabs that live in the left side panel. */
export type LeftPanelTab = "thumbnail" | "outline" | "layers" | "attachments";
/** Tabs that live in the right side panel. */
export type RightPanelTab = "search" | "comments";
/** A side panel's tab, left or right. */
export type PanelTab = LeftPanelTab | RightPanelTab;

/** Canonical render order for the left-panel tab strip. */
export const LEFT_PANEL_TABS: readonly LeftPanelTab[] = ["thumbnail", "outline", "layers", "attachments"];

/** Canonical order of the right panel's tabs. */
export const RIGHT_PANEL_TABS: readonly RightPanelTab[] = ["search", "comments"];

const LEFT_TABS_SET: ReadonlySet<PanelTab> = new Set(LEFT_PANEL_TABS);
export function isLeftPanelTab(tab: PanelTab): tab is LeftPanelTab {
    return LEFT_TABS_SET.has(tab);
}

// -----------------------------------------------------------------------------
// Mode
// -----------------------------------------------------------------------------

/** The mode every session may be in: reading — navigation, filling in a form,
 *  and a PDF's annotations (its Annotate tab). An extension may add its own
 *  (`UIExtension.mode`). */
export const VIEW_MODE = "view";

/** Whether `state` lets a copy reach the system clipboard: always in an
 *  extension's mode, and in view mode where the host leaves copy on
 *  ({@link UIState.copyEnabled}). */
export function copyAllowed(state: UIState): boolean {
    return state.mode !== VIEW_MODE || state.copyEnabled;
}

// -----------------------------------------------------------------------------
// Pointer mode & placement
// -----------------------------------------------------------------------------

/** The shapes a placement drags out — an annotation's, or an extension's tool's. */
export type ShapeKind = "rectangle" | "ellipse" | "line" | "arrow";

/** The Annotate-tab tools that mark text: each drags a text selection across
 *  the page's objects and marks what it covers. */
export type MarkupTool = "highlight" | "underline" | "strikeOut" | "squiggly";

/**
 * What an Annotate-tab tool makes — each a PDF annotation (see `annotations.ts`
 * for the subtype each makes). A {@link MarkupTool} marks the text a drag
 * selects; `pen` is a freehand stroke; `rectangle`, `ellipse`, `line` and
 * `arrow` are dragged out; `polygon`, `polyline` and `cloud` are clicked out a
 * corner at a time and finished with a double-click; `note` is a sticky note
 * and `stamp` a rubber stamp, each dropped with a click; `textBox` is a box of
 * text, dragged out or dropped with a click.
 */
export type AnnotationTool =
    | MarkupTool
    | "note"
    | "textBox"
    | "stamp"
    | "pen"
    | "rectangle"
    | "ellipse"
    | "line"
    | "arrow"
    | "polygon"
    | "polyline"
    | "cloud";

/**
 * What a `place` pointer mode is currently dropping: an Annotate-tab tool, or a
 * tool of the extension's, named by its own id — the canvas asks the extension
 * what it drags out (`UIExtension.placedShape`) and hands it the drag
 * (`UIExtension.place`). Placement is armed by a command and returns to
 * `select` on commit.
 */
export type PlaceTool = { kind: "annotation"; tool: AnnotationTool } | { kind: "extension"; tool: string };

/**
 * What the pointer does on the canvas. `select` is the permanent default;
 * `pan`/`marqueeZoom` are navigation utilities; `place` is the transient
 * insertion state armed by an Insert command (returns to `select` on commit
 * unless `sticky`).
 */
export type PointerMode =
    | { kind: "select" }
    | { kind: "pan" }
    | { kind: "marqueeZoom" }
    | { kind: "place"; tool: PlaceTool; sticky: boolean };

/**
 * Where this one stands in a collaboration: in `none`; `joined`; joined but
 * `interrupted`, rejoining after a lost connection; or `paused` — left, to
 * join again.
 */
export type CollaborationStatus = "none" | "joined" | "interrupted" | "paused";

// -----------------------------------------------------------------------------
// Commands
// -----------------------------------------------------------------------------

/**
 * Identifier of a toolbar command. The catalog (labels, icons, effects) and the
 * per-mode command lists live in `commands.ts`; `disabledCommands` keys on these
 * for host-level overrides.
 */
export type CommandId =
    | "undo"
    | "redo"
    | "annotateHighlight"
    | "annotateUnderline"
    | "annotateStrikeOut"
    | "annotateSquiggly"
    | "annotateNote"
    | "annotateTextBox"
    | "annotateStamp"
    | "annotatePen"
    | "annotateShape"
    | "annotationColor"
    | "annotationFill"
    | "annotationOpacity"
    | "notes";

/**
 * A tab in the ribbon's tab strip. Selecting a tab swaps the ribbon's tool
 * surface to that tab's commands. The catalog (icons / effects) lives in
 * `commands.ts`; tabs reference commands by id.
 */
export interface ToolbarTab<K extends string = MessageKey> {
    id: string;
    /** Its label: a key of the shell's messages — udoc-ui's, or an extension's. */
    label: K;
    /** Its commands, by id: the shell's {@link CommandId}s, or an extension's. */
    commands: readonly string[];
    /**
     * When set, the tab is *contextual*: it shows only the commands whose
     * capability predicate is live for the current selection (capability-driven
     * show/hide), instead of showing every command and greying the inapplicable
     * ones. Home uses this to surface exactly the text / shape controls the
     * selection can take; the doc-type Text / Shape / Object tabs leave it unset — they
     * keep every command and enable/disable per selection.
     */
    contextual?: boolean;
    /** The feature the tab's commands need. A session not entitled to it does
     *  not see the tab. */
    feature?: Feature;
}

/**
 * The Annotate tab's commands — the tools that make a PDF annotation: the four
 * text markups; the Note, the Text Box and the Stamp dropdown (the standard
 * stamps); the Pen, then the Shapes dropdown (rectangle, ellipse, line,
 * arrow, polygon, polyline, cloud); then the Format group, which styles the
 * armed tool or the selected annotations: Color (with the line's weight,
 * dashes and ends), Fill and Opacity. Only a PDF carries annotations, so only
 * the portable profile shows it.
 */
export const ANNOTATE_COMMANDS: readonly CommandId[] = [
    "annotateHighlight",
    "annotateUnderline",
    "annotateStrikeOut",
    "annotateSquiggly",
    "annotateNote",
    "annotateTextBox",
    "annotateStamp",
    "annotatePen",
    "annotateShape",
    "annotationColor",
    "annotationFill",
    "annotationOpacity",
];

/** The View tab's commands — a deck's Notes toggle, which opens its speaker
 *  notes' pane under the slides, or closes it to its edge. */
export const VIEW_COMMANDS: readonly CommandId[] = ["notes"];

// -----------------------------------------------------------------------------
// UI state
// -----------------------------------------------------------------------------

/**
 * The UI's single source of truth. Kept flat and serializable (no DOM
 * nodes, no worker handles) so the reducer stays pure and the state is easy to
 * inspect/snapshot.
 *
 * Scroll/zoom live here in **document space** and are the input to the worker's
 * viewport — the canvas itself never scrolls (synthetic scrolling). The UI
 * chrome fields (panels, theme, tools) were adopted from the viewer so the two
 * share a look and feel.
 */
export interface UIState {
    // --- Document load ---------------------------------------------------
    status: LoadStatus;
    /**
     * How far the document being opened has been read: `loaded` bytes of
     * `total` — `0` when its size isn't known. `null` before reading starts,
     * once the engine has the bytes and is opening them, and with nothing
     * opening.
     */
    loadProgress: { loaded: number; total: number } | null;
    error: string | null;
    /**
     * Why the engine refused to start a session, by its code, when that is what
     * failed — an unusable key, a spent free allowance, or a check it could not
     * make. `null` for every other kind of open failure (a corrupt file, an
     * unsupported format), which is an ordinary error and not a licensing one.
     */
    refusal: StartError["code"] | null;

    /**
     * The open document's type (`"portable"`, `"presentation"`, …), or null with
     * no document open. Selects the per-doc-type UI profile (`profileFor` in
     * `profiles.ts`) that drives the toolbar tabs and which built-in overlays
     * apply.
     */
    docType: UDocType | null;

    /**
     * The file format the open document came from (`"pdf"`, `"pptx"`, …) — what
     * saving it back means — or null with no document open, or for a package
     * that recorded none.
     */
    sourceFormat: FileFormat | null;

    /**
     * The open document's page count — the count the page chrome shows and
     * pages are gone to by. Its total where the engine knows it (a PDF or a
     * presentation from the open, a flow document once a compose step reports
     * complete), so a page not composed yet can be gone to, and it composes
     * when reached; else {@link UIState.firstUncomposedPage}. Editing can add or
     * remove pages; 0 when no document is open.
     */
    pageCount: number;

    /**
     * The open document's first page not composed — where the idle
     * compose-ahead pump goes on from. **Not constant**: it grows as the pump
     * fills the document in, and editing can add or remove pages. Refreshed on
     * load and on every re-layout; 0 when no document is open.
     */
    firstUncomposedPage: number;

    /**
     * Number of planes (a spreadsheet's sheets) — the sheet-tab count. `1` for
     * a single-plane doc type, `0` with no document open. Pulled on open.
     */
    planeCount: number;
    /** The active plane (0-based) — the current sheet. Drives the sheet tabs'
     *  selected state; a tab click sets it (and the shell tells the engine). */
    currentPlane: number;
    /** Each plane's display name, indexed by plane — the sheet-tab labels. Empty
     *  with no document open; `""` for an unnamed plane. */
    planeNames: readonly string[];
    /** Each plane's tab colour as `#rrggbb`, indexed by plane — the sheet-tab
     *  colours. Empty with no document open; `null` for a tab in no colour, and
     *  `undefined` for one whose sheet the worker hasn't loaded yet. */
    planeColors: readonly (string | null | undefined)[];
    /** Whether each plane is a chartsheet, indexed by plane — a sheet with no
     *  grid, so no header bands. Empty with no document open; `false` for a
     *  worksheet, or one whose sheet the worker hasn't loaded yet. */
    planeChartsheets: readonly boolean[];
    /** Each plane's sheet visibility, indexed by plane — a hidden or very
     *  hidden sheet has no tab. Empty with no document open. */
    planeVisibility: readonly SheetState[];
    /** Which view of a deck each plane is, indexed by plane — its slides, their
     *  notes pages or notes text, a slide master's — `null` for any other doc
     *  type's. Empty with no document open. */
    planeKinds: readonly (PresentationPlaneKind | null)[];
    /** Full scrollable document size; drives scroll clamping. Also dynamic. */
    scrollSize: Size;
    /** Used content size the scrollbar is drawn from. Equals `scrollSize` for
     *  most doc types; for a spreadsheet it's the data range, which is smaller
     *  than the scrollable grid, so the thumb reflects the data and grows to the
     *  scroll position as the reader scrolls past it. Adopted via `SYNC_VIEW`. */
    scrollUsedSize: Size;
    /** The scrollbars the engine's last frame kept a strip clear for, where it
     *  keeps one (the profile's `scrollbarGutters`) — it decides them with the
     *  frame it paints, and the bars follow. None until the first `SYNC_VIEW`. */
    scrollbars: Scrollbars;
    /**
     * Whether the engine has reported its first real frame for the open
     * document. `false` from open until the first `SYNC_VIEW`: in that window
     * `scrollSize` is the document's full extent but `zoom`/`effectiveZoom`
     * are still the open defaults (the fit's derived zoom isn't known until the
     * first painted frame), so any scroll geometry computed from them is
     * meaningless. The scrollbar stays hidden until this is `true` rather than
     * flashing a phantom bar (a large image fitted to the page needs none).
     */
    viewSettled: boolean;
    /**
     * Bumped each time a *new* document is opened (not on re-layout), so async
     * effects can discard results that belong to a previous document.
     */
    docGeneration: number;

    /**
     * Whether an undo / redo would currently do anything — drives the history
     * buttons' enablement. Pushed by the worker after every edit (and on
     * open/merge), never derived here. Both false with no document open.
     */
    canUndo: boolean;
    canRedo: boolean;

    /**
     * Where this one stands in the collaboration the open document is joined
     * to — drives the people button, shown while it is not `none`. Set by the
     * shell as it joins, pauses, resumes and leaves, and from the
     * collaboration's events.
     */
    collaboration: CollaborationStatus;
    /** The remote peers present in it — the people button's roster. Pushed by
     *  the worker; empty out of one. */
    peers: readonly Peer[];
    /** This one's name in it — the host's `setUserInfo`; null until set. */
    userName: string | null;

    /**
     * The engine's verdict on which selection commands are live for the current
     * selection — drives every selection-gated control (Delete, Arrange ▸
     * z-order / group / ungroup). Pushed from the worker's selection reports,
     * never derived here; the host ANDs each flag with its own UI policy (mode,
     * host-disabled commands). {@link EMPTY_SELECTION_CAPABILITIES} with no
     * document open or an empty selection.
     */
    selectionCaps: SelectionCapabilities;

    /**
     * The whole pages (a deck's slides) the selection holds, as indices in page
     * order — what the thumbnails tint. Pushed from the worker's selection
     * reports; empty for any selection but a page selection.
     */
    selectedPages: readonly number[];

    /**
     * Whether every slide the selection holds is hidden from the slide show —
     * what Hide Slide reads checked by. Read back after each of the worker's
     * selection reports holding slides; `false` for any other selection.
     */
    selectedSlidesHidden: boolean;

    /**
     * The open deck's sections, in order, each with the run of slides it holds
     * — what the thumbnails group the slides under. Read back after each change
     * of the document; empty for a deck without sections, or any other
     * document.
     */
    slideSections: readonly SlideSectionRun[];

    /**
     * The sections the selection holds, by id — picked by their headers in the
     * thumbnails. Pushed from the worker's selection reports; empty for any
     * other selection.
     */
    selectedSlideSections: readonly string[];

    /** The sections whose slides the thumbnails fold away under their header,
     *  by id. A view of this session's, reset on each open. */
    collapsedSlideSections: ReadonlySet<string>;

    /** The section whose name the thumbnails are editing, by id, or `null`. */
    renamingSlideSection: string | null;

    /**
     * The annotations the selection holds, with their page — read back after
     * each of the worker's selection reports, for the Annotate tab's Format
     * controls to show and restyle. Null when it holds none.
     */
    selectedAnnotations: SelectedAnnotations | null;
    /**
     * The comments read, by page key: each page's annotations with their rich
     * contents, which the comment threads are built from — the selected
     * annotation's page for its popup, and every page while the comments panel
     * is open. Read again whenever the document changes.
     */
    comments: ReadonlyMap<string, PageComments>;
    /** Whether {@link comments} holds every page's — the panel's read landed. */
    allCommentsRead: boolean;

    // --- Search ------------------------------------------------------------
    /** The search's query; empty for none. Kept across documents, so a search
     *  in force runs again over the next one opened. */
    searchQuery: string;
    /** Whether the search matches letter case exactly. */
    searchCaseSensitive: boolean;
    /** Whether the search compares with separators dropped and punctuation
     *  folded — for a quotation from another source. */
    searchFuzzy: boolean;
    /** The part of the document the search covers; null for all of it. */
    searchScope: UDocSearchScope | null;
    /** The matches found, in document order — grown batch by batch while the
     *  search runs, and replaced when it runs again after an edit. */
    searchMatches: readonly SearchMatch[];
    /** The match shown as current; -1 for none. */
    searchActiveIndex: number;
    /** Bumped each time a match is made current, so the view goes to it. */
    searchNavGen: number;
    /** Where that landing puts the match when the call that made it current
     *  named an alignment of its own; `null` for {@link searchScrollAlignment}. */
    searchNavAlignment: ScrollAlignment | null;
    /** Where a search match lands — the host's `searchScrollAlignment`. */
    searchScrollAlignment: ScrollAlignment;
    /** Where a followed link or outline item, or a chosen comment, lands —
     *  the host's `navigationScrollAlignment`. */
    navigationScrollAlignment: ScrollAlignment;
    /** Whether the search is still finding matches. */
    searchRunning: boolean;

    // --- Viewport (document space) ---------------------------------------
    /** Document-space scroll offset of the viewport's top-left. */
    scrollX: number;
    scrollY: number;
    /** Faithful zoom; 1 == 100% (one document inch per {@link viewDpi} CSS px). */
    zoom: number;
    /**
     * CSS px per physical inch of the screen, as the host calibrated it so 100%
     * shows a page at its real size — the `dpi` option or `setDpi`. `null`
     * keeps the doc type's default ({@link viewDpi}).
     */
    dpi: number | null;
    /**
     * How the zoom is chosen: a fit the engine derives it from, under the fit's
     * own cap (the open default caps at 1 while a menu fit pick doesn't), or
     * {@link NO_FIT} for the explicit zoom.
     */
    fit: Fit;
    /**
     * The fit every document opens with in place of its doc type's default —
     * the host's `fit` option or `setFit`. `null` keeps the doc type's default.
     */
    defaultFit: Fit | null;
    /**
     * The explicit zoom every document opens at while its fit is
     * {@link NO_FIT} — the host's `zoom` option.
     */
    defaultZoom: number;
    /** Derived zoom while a fit is active (null under {@link NO_FIT}). */
    effectiveZoom: number | null;
    /** Discrete steps the zoom in/out buttons and the dropdown snap to. */
    zoomSteps: readonly number[];
    /**
     * The bounds every explicit zoom is clamped to — set, stepped, wheeled,
     * pinched or swept. A fit's derived zoom is not.
     */
    minZoom: number;
    maxZoom: number;
    /**
     * The pending zoom intent the Canvas forwards to the engine as a
     * cursor-anchored `zoomAtPoint` — the engine owns the resulting scroll, so the
     * reducer never computes it. `x`/`y` are the viewport anchor in CSS px (the
     * cursor for a wheel zoom, the viewport centre for the controls). `seq` bumps
     * on every zoom action so the Canvas re-fires even at an unchanged zoom;
     * `SYNC_VIEW` adopting the engine's zoom never bumps it, so there's no loop.
     */
    zoomRequest: { zoom: number; x: number; y: number; seq: number };

    /**
     * Bumps on every `SET_FIT` — including re-picking the active fit — so
     * the Canvas re-sends `setFit` and the engine re-frames (re-centers) the
     * current page even when the fit mode itself is unchanged.
     */
    refitSeq: number;

    /** Visible canvas size in CSS px (updated by the Canvas on resize). */
    viewportWidth: number;
    viewportHeight: number;

    /**
     * The current page, 0-based: the engine's, adopted from each painted frame,
     * set ahead of it to the target of a "go to page" until the frame that
     * lands it.
     */
    pageIndex: number;
    /**
     * The pages the last painted frame showed, 0-based, `end` exclusive — in
     * spread mode, the shown spread, which {@link pageStep} steps past.
     */
    shownPages: { start: number; end: number };
    /**
     * A "go to page" request, as an event carried in state: `pageIndex` is the
     * target and `seq` bumps on every {@link Action} `NAVIGATE_TO_PAGE`
     * (even when the page is unchanged — re-centering after a fit change
     * re-requests the same page). The shell watches `seq` and forwards the
     * target to the worker, which owns per-page offsets and actually scrolls.
     */
    navRequest: { pageIndex: number; seq: number };

    // --- Arrangement -----------------------------------------------------
    /** How the view scrolls: one spread at a time, or continuously. */
    scrollMode: ScrollMode;
    /**
     * The scroll mode every document opens in in place of its doc type's
     * default — the host's `scrollMode` option or `setScrollMode`. `null` keeps
     * the doc type's default.
     */
    defaultScrollMode: ScrollMode | null;
    /** How the layout groups pages into spreads. */
    layoutMode: LayoutMode;
    /** The turn, in degrees clockwise, every page is shown at on top of its own. */
    pageRotation: 0 | 90 | 180 | 270;
    /**
     * The gaps between pages when the page controls aren't showing — the
     * host's `pageGap`. `null` keeps the built-in reading gap.
     */
    pageGap: PageGap | null;
    /**
     * Whether the gaps between pages show — the view settings' Page Gap. Off
     * butts the pages together; the page controls keep their own gap either
     * way.
     */
    showPageGap: boolean;

    /**
     * The extension's own state — the package that extended the shell keeps
     * it here, so it changes and is read as the rest of the state is. Null
     * without an extension.
     */
    extension: unknown;

    /** Where the view-state controls (page nav + zoom + view mode) are docked. */
    viewControlsPlacement: ViewControlsPlacement;

    // --- Side panels -----------------------------------------------------
    /** The currently open panel tab, or null when no panel is open. */
    activePanel: PanelTab | null;
    /** Left panel width in pixels (null = use the CSS default). */
    leftPanelWidth: number | null;
    /** Right panel width in pixels (null = use the CSS default). */
    rightPanelWidth: number | null;
    /** Whether the left panel area is available. */
    leftPanelVisible: boolean;
    /** Whether the right panel area is available. */
    rightPanelVisible: boolean;
    /** Panel tabs that are disabled (hidden from the UI): the open doc type's
     *  (`profileDisabledPanels`) and the host's ({@link hostDisabledPanels}). */
    disabledPanels: ReadonlySet<PanelTab>;
    /** Panel tabs the host hid (its `show*Panel` options) — the share of
     *  {@link disabledPanels} that opening a document keeps. */
    hostDisabledPanels: ReadonlySet<PanelTab>;
    /** When true, panel open/close skips CSS transitions (reset after one frame). */
    panelTransitionsDisabled: boolean;

    // --- Notes pane --------------------------------------------------------
    /** Whether a deck's notes pane is open under its slides, or closed to its
     *  edge — the View tab's Notes, the host's `showNotesPanel`, the splitter
     *  dragged to the edge. Kept for every doc type; only a deck has notes to
     *  show, and only while its slides show one at a time. */
    notesOpen: boolean;
    /** The open notes pane's height in pixels, as its splitter left it (null =
     *  its default, which opening it returns to). */
    notesHeight: number | null;

    // --- Toolbar / chrome visibility -------------------------------------
    /**
     * Whether the top toolbar is visible. When hidden (chromeless / immersive
     * embeds), the bottom floating bar surfaces page-nav + zoom instead.
     */
    toolbarVisible: boolean;
    /** Whether the fullscreen button is shown in the toolbar. */
    fullscreenButtonVisible: boolean;
    /** Whether the download button is shown in the toolbar. */
    downloadButtonVisible: boolean;
    /** Whether the print button is shown in the toolbar. */
    printButtonVisible: boolean;
    /** Whether the developer button is shown in the toolbar. */
    developerButtonVisible: boolean;
    /** Whether the viewer is in browser fullscreen. */
    isFullscreen: boolean;

    // --- Theme -----------------------------------------------------------
    theme: ThemeMode;
    /** Whether the theme toggle button is hidden. */
    themeSwitchingDisabled: boolean;
    /** Whether text selection is disabled (toggles a root class). */
    textSelectionDisabled: boolean;

    // --- Mode & tools ----------------------------------------------------
    /** The features the open document's session is entitled to
     *  (`entitlements().features`): what the UI may offer. Empty until a
     *  document opens. */
    features: readonly Feature[];
    /** The mode — {@link VIEW_MODE}, or the extension's own
     *  (`UIExtension.mode`). Scopes the toolbar's command set + pointer. */
    mode: string;
    /** The active tab in the top-bar tab strip, or null while the ribbon is
     *  folded (and in modes with no tabs). */
    activeTab: string | null;
    /** What the pointer is doing on the canvas. `select` is the default. */
    pointerMode: PointerMode;
    /** Commands disabled by the host (hidden from the toolbar). */
    disabledCommands: ReadonlySet<string>;
    /** Whether view mode copies the selection — the host's `enableCopy`. Edit
     *  mode copies whatever this says ({@link copyAllowed}). */
    copyEnabled: boolean;
    /** Whether this one's pointer is shared with the collaboration — the host's
     *  `enablePointerSharing` to start with, then the people menu's toggle. */
    pointerSharing: boolean;
    /** The style each annotation tool draws with, as the Format controls set it
     *  while the tool is armed; a tool not here draws with its default. */
    annotationStyles: AnnotationStyles;
    /** The stamp the Stamp tool drops — the one its dropdown last picked. */
    stamp: StampIcon;
    /** Whether the selected annotation's comment popup is open, as its
     *  annotation bar's comment button last set it — null until pressed, when
     *  a note's is open and the rest closed. Cleared when the selection moves
     *  off the annotation it names. */
    commentPopup: { id: string; open: boolean } | null;

    // --- Developer options -----------------------------------------------
    /** Diagnostic toggles from the More menu's "Developer" dialog. */
    developerOptions: DeveloperOptions;
}

/**
 * Developer/diagnostic toggles, surfaced in the More menu's "Developer"
 * dialog. Session-only (not persisted).
 */
export interface DeveloperOptions {
    /** Show the on-screen performance counter (open / repaint timings). */
    performanceCounter: boolean;
    /** Outline the region of the canvas the engine's latest frame repainted —
     *  the compositor's dirty rect, streamed on every painted frame. */
    repaintArea: boolean;
}

export const initialState: UIState = {
    status: "empty",
    loadProgress: null,
    error: null,
    refusal: null,
    docType: null,
    sourceFormat: null,
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
    scrollUsedSize: { width: 0, height: 0 },
    scrollbars: { x: false, y: false },
    viewSettled: false,
    docGeneration: 0,
    canUndo: false,
    canRedo: false,
    collaboration: "none",
    peers: [],
    userName: null,
    selectionCaps: EMPTY_SELECTION_CAPABILITIES,
    selectedPages: [],
    selectedSlidesHidden: false,
    slideSections: [],
    selectedSlideSections: [],
    collapsedSlideSections: new Set(),
    renamingSlideSection: null,
    selectedAnnotations: null,
    comments: new Map(),
    allCommentsRead: false,

    searchQuery: "",
    searchCaseSensitive: false,
    searchFuzzy: false,
    searchScope: null,
    searchMatches: [],
    searchActiveIndex: -1,
    searchNavGen: 0,
    searchNavAlignment: null,
    searchScrollAlignment: "nearest",
    navigationScrollAlignment: "top",
    searchRunning: false,

    scrollX: 0,
    scrollY: 0,
    zoom: 1,
    dpi: null,
    fit: NO_FIT,
    defaultFit: null,
    defaultZoom: 1,
    effectiveZoom: null,
    zoomSteps: DEFAULT_ZOOM_STEPS,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    zoomRequest: { zoom: 1, x: 0, y: 0, seq: 0 },
    refitSeq: 0,
    viewportWidth: 0,
    viewportHeight: 0,
    pageIndex: 0,
    shownPages: { start: 0, end: 0 },
    navRequest: { pageIndex: 0, seq: 0 },

    // Match the engine's default arrangement (a scrolling single column). The
    // view-mode menu switches them and the shell pushes each to the worker.
    scrollMode: "continuous",
    defaultScrollMode: null,
    layoutMode: "singlePage",
    pageRotation: 0,
    pageGap: null,
    showPageGap: true,
    // The paged ruler is on by default (matching the engine); the host toggles
    // it and it self-suppresses in view mode.
    extension: null,
    viewControlsPlacement: "floating",

    activePanel: null,
    leftPanelWidth: null,
    rightPanelWidth: null,
    leftPanelVisible: true,
    rightPanelVisible: true,
    disabledPanels: new Set(),
    hostDisabledPanels: new Set(),
    panelTransitionsDisabled: false,

    notesOpen: true,
    notesHeight: null,

    toolbarVisible: true,
    fullscreenButtonVisible: true,
    downloadButtonVisible: true,
    printButtonVisible: true,
    developerButtonVisible: false,
    isFullscreen: false,

    theme: "light",
    themeSwitchingDisabled: false,
    textSelectionDisabled: false,

    features: [],
    mode: VIEW_MODE,
    activeTab: null,
    pointerMode: { kind: "select" },
    disabledCommands: new Set(),
    copyEnabled: true,
    pointerSharing: false,
    annotationStyles: {},
    stamp: "draft",
    commentPopup: null,

    developerOptions: { performanceCounter: false, repaintArea: false },
};
