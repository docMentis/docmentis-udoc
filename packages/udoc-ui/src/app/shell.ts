import { UDocError } from "@docmentis/udoc-wasm/error";

import { localCollaborationService } from "../worker/LocalCollaborationService.js";
import type { WorkerClient } from "../worker/WorkerClient.js";
import type { FormWidget, HistoryOp, SelectionEdit } from "../worker/protocol.js";
import { defaultFitForDocType, defaultScrollModeForDocType } from "../worker/protocol.js";
import { Command } from "../worker/commands.js";
import type {
    UDocCommand,
    UDocSelection,
    ExportFormat,
    FileFormat,
    PageExportFormat,
    SaveStrategy,
    ComposedShapeMedia,
    LinkAnnotation,
    SearchContinuation,
    SearchMatch,
    SearchOptions,
    SearchQuad,
    UrlFont,
    UDocSearchScope,
    Destination,
    CellEntryEdit,
    CellEntryMode,
    GridCellSelectionMove,
    ScrollAlignment,
    TextHyperlink,
} from "@docmentis/udoc-wasm";
import { allowsEdit, cssPxPerPt } from "../geometry.js";
import type {
    ContentPadding,
    DocumentLayout,
    Fit,
    LayoutMode,
    PageGap,
    PageView,
    PageViewsFrame,
    RgbColor,
    ScrollMode,
    SelectionBox,
    SelectionQuad,
} from "../geometry.js";
import { createStore, shallowEqual, subscribeSelector } from "../framework/index.js";
import type { Store } from "../framework/index.js";
import type { PageSpacing, UIExtension } from "../extension.js";
import type { Action } from "./actions.js";
import { CONTEXT_MENU, commandContext, sheetTabMenu } from "./commands.js";
import { reorderTo } from "./page-order.js";
import type { MenuAction } from "./commands.js";
import { createClipboardCopy } from "./clipboard.js";
import { createCanvas } from "./components/Canvas.js";
import { createContextMenu } from "./components/ContextMenu.js";
import { createFloatingToolbar } from "./components/FloatingToolbar.js";
import { createLeftPanel } from "./components/LeftPanel.js";
import { createNotesPane } from "./components/NotesPane.js";
import { createFormulaBar } from "./components/FormulaBar.js";
import { visibleSpan } from "./components/Scrollbar.js";
import { cellKeyAction } from "./cell-keys.js";
import type { CellKeyAction } from "./cell-keys.js";
import { createRightPanel } from "./components/RightPanel.js";
import { createStatusBar } from "./components/StatusBar.js";
import { createSheetTabs } from "./components/SheetTabs.js";
import { createRibbon } from "./components/Ribbon.js";
import { createToolbar } from "./components/Toolbar.js";
import { createViewControls } from "./components/ViewControls.js";
import type { OverlayOptions, OverlaySource } from "./components/OverlayManager.js";
import { createAnnotationBar } from "./components/AnnotationBar.js";
import { commentPopup } from "./components/CommentPopup.js";
import { formFieldInput } from "./components/FormFieldInput.js";
import { mediaPlayers } from "./components/MediaPlayer.js";
import { createBusyModal } from "./components/BusyModal.js";
import { createLoadingOverlay } from "./components/LoadingOverlay.js";
import { createLicenseNotice, isRefusal } from "./components/LicenseNotice.js";
import { createPasswordModal } from "./components/PasswordModal.js";
import { createPrintModal } from "./components/PrintModal.js";
import { createScrollbar } from "./components/Scrollbar.js";
import { createPerfHud } from "./components/PerfHud.js";
import { joinCollaboration, webSocketChannel } from "./collaboration.js";
import type { Collaboration, CollaborationEvent, OpenChannel } from "./collaboration.js";
import { remoteCheckpoint, remoteCopy } from "./remote.js";
import type { RemoteCheckpointResponse } from "./remote.js";
import { PRINT_DPI, printImages, printPageOf, printPdf } from "./print.js";
import type { PrintOptions, PrintPage } from "./print.js";
import { createEffects } from "./effects.js";
import { createReducer } from "./reducer.js";
import {
    LEFT_PANEL_TABS,
    RIGHT_PANEL_TABS,
    VIEW_MODE,
    initialState,
    planeOfView,
    renderZoom,
    viewDpi,
    viewOfPlane,
} from "./state.js";
import { arrangementFor, defaultTab, profileFor } from "./profiles.js";
import type { ModeEntitlement, TabSource } from "./profiles.js";
import type {
    AnnotationTool,
    UIState,
    MarkupTool,
    PanelTab,
    PresentationView,
    ThemeMode,
    ViewControlsPlacement,
} from "./state.js";
import type { ShapePoint } from "./shapes.js";
import {
    annotationFor,
    annotationFormat,
    annotationStyle,
    commentOpen,
    editedInBox,
    formatTarget,
    markupFor,
    pdfDate,
    replyTo,
    restyle,
    restyled,
    selectedAnnotation,
    selectedComment,
    TEXT_BOX_FONT,
} from "./annotations.js";
import type { AnnotationStyleChange, Comment } from "./annotations.js";
import { fillKind, toggled, widgetAlternateNames, widgetFills } from "./forms.js";
import type { FillKind } from "./forms.js";
import { follow, textLinkFollows, textLinkUrl } from "./destinations.js";
import { mediaType, readSource, signaturelessFormat, sourceName } from "./source.js";
import type { OpenSource } from "./source.js";
import { uiStyles } from "./styles.js";
import { createPageAnnotations } from "./page-annotations.js";
import { createI18n, MESSAGE_PACKS } from "./i18n/index.js";
import type { Messages } from "./i18n/index.js";
import type { PageAnnotationListener, PageAnnotations } from "./page-annotations.js";

/**
 * How many pages each step of composing a whole document — for a print — asks
 * the engine to compose. Kept small: composition is synchronous in the worker,
 * so a big batch blocks the worker's message loop and stalls scroll/repaint.
 */
const COMPOSE_BATCH = 2;

/**
 * The inputs that tell the worker the reader is at the shell. Each of them can
 * ask the worker something — a hover hit-test, a pick, a keystroke's edit — so
 * its background work waits until they have stopped a moment, and what they
 * ask doesn't land behind a step of it.
 */
const ACTIVITY_INPUTS = ["pointerdown", "pointermove", "keydown", "wheel"] as const;

/**
 * Page spacing where no extension takes its place: page-fixed (document points)
 * gaps between pages and screen-fixed (CSS px) paddings — no page chrome lives
 * in either, so the gaps read as paper and the paddings hold a constant
 * on-screen margin. A host's `pageGap` takes the gaps' place.
 */
const READ_PAGE_GAP: PageGap = { horizontal: 12, vertical: 12 };

/** The gaps with the view settings' Page Gap off: the pages butt together. */
const NO_PAGE_GAP: PageGap = { horizontal: 0, vertical: 0 };
const READ_PADDING: ContentPadding = { top: { px: 18 }, right: { px: 18 }, bottom: { px: 18 }, left: { px: 18 } };

/**
 * Parse a CSS color string — as `getComputedStyle` returns for a custom
 * property — into an {@link RgbColor}. Handles `#rgb`, `#rrggbb`,
 * `rgb()/rgba()`, and `color(srgb …)`, the form a resolved `color-mix()` takes;
 * returns `null` if it can't make sense of the value.
 */
function cssColorToRgb(value: string): RgbColor | null {
    const s = value.trim();
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
    if (hex) {
        const digits = hex[1]!;
        const full =
            digits.length === 3
                ? digits
                      .split("")
                      .map((c) => c + c)
                      .join("")
                : digits;
        return {
            r: parseInt(full.slice(0, 2), 16),
            g: parseInt(full.slice(2, 4), 16),
            b: parseInt(full.slice(4, 6), 16),
        };
    }
    const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
    if (rgb) {
        return { r: Math.round(+rgb[1]!), g: Math.round(+rgb[2]!), b: Math.round(+rgb[3]!) };
    }
    const srgb = /^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i.exec(s);
    if (srgb) {
        return { r: Math.round(+srgb[1]! * 255), g: Math.round(+srgb[2]! * 255), b: Math.round(+srgb[3]! * 255) };
    }
    return null;
}

/** How {@link UIShell.openSource} opens its source — the public `OpenOptions`. */
export interface OpenSourceOptions {
    format?: FileFormat | undefined;
    filename?: string | undefined;
    delimiter?: string | undefined;
    password?: string | undefined;
}

export interface UIShell {
    store: Store<UIState, Action>;
    getState: () => UIState;
    dispatch: (action: Action) => void;
    /** Subscribe to the frames the worker paints: the pages on screen and the view's scroll and scale with them; returns the unsubscribe. */
    onPageViews: (listener: (frame: PageViewsFrame) => void) => () => void;
    /** Open a document from bytes — as `format` when given, which skips detection, a CSV split by `delimiter` when given, named `filename` for {@link download}, and unlocked with `password` when it asks for one (drives the engine + dispatches load actions). */
    openSource: (source: OpenSource, options?: OpenSourceOptions) => Promise<void>;
    /** Open the package a server keeps at `url`, part by part (drives the engine + dispatches load actions). */
    openRemote: (url: string) => Promise<void>;
    /** Open the package the local collaboration service `id` keeps, then its edit log (drives the engine + dispatches load actions). */
    openLocal: (id: string) => Promise<void>;
    /** Offer the host's fonts — a font file's bytes, or a {@link UrlFont} — to every document opened after this. */
    registerFonts: (fonts: ReadonlyArray<Uint8Array | UrlFont>) => void;
    /** Apply a document-wide history op (undo / redo); refreshes the layout. */
    history: (op: HistoryOp) => Promise<void>;
    /** Mint a fresh CRDT-safe id (hex key) for a new object to insert — a read; `null` with no doc. */
    mintId: () => Promise<string | null>;
    /** The hex keys of the currently-selected graphics objects (empty if none) — a read. */
    selectedObjectIds: () => Promise<string[]>;
    /** Select the graphics objects named by `ids` (hex keys) on the page at index `page` — presence only, fires {@link onSelectionEdit}. */
    selectObjects: (page: number, ids: string[]) => void;
    /** Set the selection to a doc-type-tagged {@link UDocSelection} (presentation shapes, etc.) — presence only, fires {@link onSelectionEdit}. */
    setSelection: (selection: UDocSelection) => void;
    /** Read the current selection as the tagged {@link UDocSelection}, or `null` — a doc-type-agnostic read. */
    selection: () => Promise<UDocSelection | null>;
    /** Clear the selection — presence only, fires {@link onSelectionEdit}. */
    clearSelection: () => void;
    /** Execute an arbitrary, doc-type-tagged {@link UDocCommand} — the single write seam; a committing edit. */
    execute: (command: UDocCommand) => Promise<void>;
    /** Serialize the CRDT for sync with a peer (an opaque blob for {@link merge}). */
    snapshot: () => Promise<Uint8Array>;
    /** Save the open document as `format`, faithfully — the bytes reopen as the same document; a `strategy` other than `"rewrite"` writes over the original; without one, the engine's for `format`. */
    saveToBytes: (format: FileFormat, strategy?: SaveStrategy) => Promise<Uint8Array>;
    /** Save the open document as a udoc package (a `.udoc` zip); a `version` makes it a checkpoint, which keeps the edit log. */
    saveToPackage: (version?: number) => Promise<Uint8Array>;
    /** Ask the server the open document was opened from for a copy, saved as its source format by `strategy`, else by the engine's for it. */
    requestRemoteCopy: (strategy?: SaveStrategy) => Promise<Uint8Array>;
    /** Save the open document as its source format and hand it to the browser as a download named `filename`, else the name it was opened under, else `document.<format>`. */
    download: (filename?: string) => Promise<void>;
    /** Subscribe to the downloads {@link download} hands the browser — the toolbar's too — with each one's file name; returns the unsubscribe. */
    onDownload: (listener: (filename: string) => void) => () => void;
    /** Print the pages `options` names, or open the print dialog to choose them without `options`. */
    print: (options?: PrintOptions) => Promise<void>;
    /** Subscribe to the prints {@link print} hands the browser's print dialog — the toolbar's too — with each one's page count; returns the unsubscribe. */
    onPrint: (listener: (pageCount: number) => void) => () => void;
    /** Render page index `page` (0-based) at `scale` image pixels per point, composing it first if it isn't yet. */
    renderPage: (page: number, scale: number) => Promise<ImageBitmap>;
    /** Export the open document as `format` — a rendering of its laid-out pages, fixed and one-way — composing every page first. */
    exportToBytes: (format: ExportFormat) => Promise<Uint8Array>;
    /** Export page index `page` (0-based) as `format`, a PNG at a scale or an SVG, composing it first if it isn't yet. */
    exportPageToBytes: (page: number, format: PageExportFormat) => Promise<Uint8Array>;
    /** The host's page annotations: legacy's calls, over the model (page-annotations.ts). */
    pageAnnotations: PageAnnotations;
    /** Subscribe to the annotation events, with legacy's payloads; returns the unsubscribe. */
    onPageAnnotationEvent: (listener: PageAnnotationListener) => () => void;
    /** Search the open document for `query`; resolves with every match once the search has found them all, or with none if a newer search, a clear or an edit retires it. */
    search: (query: string, options?: SearchOptions & { scope?: UDocSearchScope }) => Promise<readonly SearchMatch[]>;
    /** Drop the search: no query, no matches, no highlights. */
    clearSearch: () => void;
    /** Make the next match current, wrapping, and go to it — by `scrollAlignment` when given, else the standing search alignment. */
    searchNext: (scrollAlignment?: ScrollAlignment) => void;
    /** Make the previous match current, wrapping, and go to it, as {@link searchNext} does. */
    searchPrev: (scrollAlignment?: ScrollAlignment) => void;
    /** Make match `index` current and go to it, as {@link searchNext} does; ignored past the matches found. */
    setSearchActiveIndex: (index: number, scrollAlignment?: ScrollAlignment) => void;
    /** Set where a search match lands. */
    setSearchScrollAlignment: (alignment: ScrollAlignment) => void;
    /** Set where a followed link or outline item, or a chosen comment, lands. */
    setNavigationScrollAlignment: (alignment: ScrollAlignment) => void;
    /** Follow a PDF `destination` — by `scrollAlignment` when given, else the standing navigation alignment; resolves once it has landed, or not. */
    goToDestination: (destination: Destination, scrollAlignment?: ScrollAlignment) => Promise<void>;
    /** Show plane `plane` — a sheet of the open workbook, 0-based — as its tab does; resolves once a frame showing it has painted, or the view has moved on without it. */
    goToPlane: (plane: number) => Promise<void>;
    /** The selection naming `match`'s text — the separate step from a match to a selection — or null when nothing there can be selected. */
    searchMatchSelection: (match: SearchMatch) => Promise<UDocSelection | null>;
    /** Ask the server the open document was opened from to checkpoint it. */
    requestRemoteCheckpoint: () => Promise<RemoteCheckpointResponse>;
    /** Read the version vector — hand to a peer's {@link patchSince} for an incremental delta. */
    versionVector: () => Promise<Uint8Array>;
    /** Compute the delta a peer (by its {@link versionVector}) lacks — feed to its {@link merge}. */
    patchSince: (peer: Uint8Array) => Promise<Uint8Array>;
    /** Merge a peer's {@link snapshot} or {@link patchSince} and refresh the layout (does not re-fire {@link onEdit}). */
    merge: (data: Uint8Array) => Promise<void>;
    /** The content of every opaque part (an inserted picture's image) a peer (by its {@link versionVector}) lacks — send it ahead of the {@link patchSince} patch. */
    opaquePartsSince: (peer: Uint8Array) => Promise<Uint8Array>;
    /** Create each part a peer's {@link opaquePartsSince} carries, to pass on in turn (does not re-fire {@link onEdit}). */
    mergeOpaqueParts: (data: Uint8Array) => Promise<void>;
    /** Serialize the presence (selection) for sync — the transient channel beside {@link snapshot}. */
    presence: () => Promise<Uint8Array>;
    /** Merge a peer's presence; its selection shows up in the selection overlay (does not re-fire {@link onSelectionEdit}). */
    mergePresence: (data: Uint8Array) => Promise<void>;
    /** Set the local user's info (display name) peers draw on this client's selection and its annotations are authored by (sticky across opens). */
    setUserInfo: (name: string) => void;
    /**
     * Subscribe to *local* edits (page edits, undo/redo) — not merges, so a
     * sync listener that pushes a snapshot to a peer can't loop. Returns an
     * unsubscribe.
     */
    onEdit: (listener: () => void) => () => void;
    /**
     * Subscribe to *local* selection changes (click-select, clear) — not
     * presence merges, so a sync listener that pushes {@link presence} to a
     * peer can't loop. Returns an unsubscribe.
     */
    onSelectionEdit: (listener: () => void) => () => void;
    /**
     * Join the collaboration a udoc server keeps for the open document at
     * `url`, as `name` (set as {@link setUserInfo} sets it), leaving any other
     * first. Throws with no document open.
     */
    joinRemoteCollaboration: (url: string, name: string) => void;
    /**
     * Join the collaboration of the local collaboration service `id`, as
     * {@link joinRemoteCollaboration} joins a server's. Throws with no document
     * open, or no such service.
     */
    joinLocalCollaboration: (id: string, name: string) => void;
    /** Leave the collaboration, local or remote — joined or paused. */
    leaveCollaboration: () => void;
    /**
     * Pause co-editing: leave the collaboration, keeping how to join it again —
     * and a local collaboration service, which a paused one still holds.
     */
    pauseCollaboration: () => void;
    /** Resume co-editing: join the collaboration paused out of again. */
    resumeCollaboration: () => void;
    /** Subscribe to what happens to the collaboration. Returns an unsubscribe. */
    onCollaboration: (listener: (event: CollaborationEvent) => void) => () => void;
    /**
     * Share this one's pointer with the collaboration joined, or stop sharing
     * it — then the others' copy of it is deleted.
     */
    setEnablePointerSharing: (enabled: boolean) => void;
    /** Draw the pointers the others in the collaboration share, or hide them here. */
    setShowPeerPointers: (show: boolean) => void;
    /**
     * Register (or replace) a page-anchored HTML overlay under `id` — DOM
     * chrome positioned over the canvas and kept in sync with scroll/zoom from
     * the worker's per-frame page geometry, under the selection or, with
     * `aboveSelection`, over it. Multiple overlays render at once; the
     * built-ins use `udoc:`-prefixed ids and are removable like any other.
     */
    setOverlay: (id: string, source: OverlaySource, options?: OverlayOptions) => void;
    /** Remove the overlay registered under `id` (false if unknown). */
    removeOverlay: (id: string) => boolean;
    /** Set the color theme (light / dark / system); also recolors the engine backdrop. */
    setTheme: (theme: ThemeMode) => void;
    /** Enter or leave fullscreen on the root; rejects when the browser refuses. */
    setFullscreen: (fullscreen: boolean) => Promise<void>;
    /** Scroll one spread at a time, or continuously — the open document and
     *  every later one; `null` restores each doc type's default. */
    setScrollMode: (mode: ScrollMode | null) => void;
    /** Group the pages into spreads as `mode` says. */
    setLayoutMode: (mode: LayoutMode) => void;
    /** Turn every page by `rotation` degrees clockwise on top of its own. */
    setPageRotation: (rotation: 0 | 90 | 180 | 270) => void;
    /** Set the gaps between pages; `null` restores the built-in gaps. */
    setPageGap: (gap: PageGap | null) => void;
    /** Fit the open document by `fit`, and open every later one by it; `null` restores each doc type's default. */
    setFit: (fit: Fit | null) => void;
    /** Zoom the open document to an explicit `zoom`, dropping its fit; clamped to the zoom bounds. */
    setZoom: (zoom: number) => void;
    /** Zoom to the next zoom step up. */
    zoomIn: () => void;
    /** Zoom to the next zoom step down. */
    zoomOut: () => void;
    /** Set the lowest explicit zoom, re-clamping one it now excludes. */
    setMinZoom: (zoom: number) => void;
    /** Set the highest explicit zoom, re-clamping one it now excludes. */
    setMaxZoom: (zoom: number) => void;
    /** Set the screen's CSS px per physical inch, which 100% is measured against. */
    setDpi: (dpi: number) => void;
    /** Open `panel`, unless it or its side is hidden. */
    openPanel: (panel: PanelTab) => void;
    /** Close the open side panel. */
    closePanel: () => void;
    /** Open a deck's notes panel under its slides, at its default height. */
    openNotesPanel: () => void;
    /** Close a deck's notes panel to its edge. */
    closeNotesPanel: () => void;
    /** Show a deck as `view`, resolving once a frame shows it — at once for
     *  a document that is not a deck, which keeps it for the next one. */
    setPresentationView: (view: PresentationView) => Promise<void>;
    /** Dock the view-state controls in the top toolbar, the floating bar, or the status bar. */
    setViewControlsPlacement: (placement: ViewControlsPlacement) => void;
    /** Close the current document. */
    close: () => void;
    destroy: () => void;
}

/** Chrome-related options resolved into the starting state when the shell is
 *  mounted — `UDocOptions`' share, documented there. */
export interface UIShellOptions {
    theme?: ThemeMode;
    showToolbar?: boolean;
    showLeftPanel?: boolean;
    showRightPanel?: boolean;
    showThumbnailPanel?: boolean;
    showOutlinePanel?: boolean;
    showLayersPanel?: boolean;
    showSearchPanel?: boolean;
    showCommentsPanel?: boolean;
    showThemeButton?: boolean;
    showFullscreenButton?: boolean;
    showPrintButton?: boolean;
    showDownloadButton?: boolean;
    showDeveloperButton?: boolean;
    enableCopy?: boolean;
    enablePointerSharing?: boolean;
    showPeerPointers?: boolean;
    viewControlsPlacement?: ViewControlsPlacement;
    scrollMode?: ScrollMode;
    layoutMode?: LayoutMode;
    pageRotation?: 0 | 90 | 180 | 270;
    pageGap?: PageGap;
    fit?: Fit;
    zoom?: number;
    dpi?: number;
    activePanel?: PanelTab | null;
    showNotesPanel?: boolean;
    presentationView?: PresentationView;
    showFormulaBar?: boolean;
    showLoadingOverlay?: boolean;
    zoomSteps?: readonly number[];
    minZoom?: number;
    maxZoom?: number;
    navigationScrollAlignment?: ScrollAlignment;
    searchScrollAlignment?: ScrollAlignment;
    /** Opens the URL a clicked link or outline item names, in place of a new
     *  browser tab. */
    onLinkClick?: (url: string) => void;
    /** The language the chrome speaks, a BCP 47 tag; the browser's when absent. */
    locale?: string;
    /** Strings that replace the built-in ones, by key. */
    translations?: Partial<Messages>;
}

/** The page-local box around a search quad's four corners — the rect a
 *  landing on the match brings into view. */
function quadBounds(quad: SearchQuad): { x0: number; y0: number; x1: number; y1: number } {
    const xs = quad.points.map((p) => p.x);
    const ys = quad.points.map((p) => p.y);
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/**
 * Assemble the document UI: build the store and the shell (toolbar,
 * ribbon, left/right side panels, viewport with the WASM canvas + floating
 * toolbar), wire the worker client and effects, and return a lifecycle handle.
 *
 * The chrome was adopted from `docmentis-udoc-viewer` so the two share a look
 * and feel; the slot structure (toolbar / ribbon / body{left, viewport,
 * right}) mirrors `mountViewerShell`.
 */
export function mountUIShell(
    root: HTMLElement,
    client: WorkerClient,
    shellOptions: UIShellOptions,
    extension: UIExtension | null,
): UIShell {
    // The chrome's words, in the host's language — one for the shell's life,
    // speaking the extension's messages too where it brings its own.
    const i18n = createI18n(extension?.messages ?? MESSAGE_PACKS, shellOptions.locale, shellOptions.translations);

    const layout = document.createElement("div");
    layout.className = "udoc-ui-root";
    layout.setAttribute("tabindex", "-1");

    // The shell ships its own CSS as a single assembled sheet, the extension's
    // after it.
    const style = document.createElement("style");
    style.textContent = uiStyles + (extension?.styles ?? "");
    layout.appendChild(style);

    // The print dialog, opened from the toolbar menu's Print. Mounted once;
    // re-seeded with the document's page count each open.
    const printModal = createPrintModal(i18n);
    printModal.mount(layout);

    // The busy hold — the UI refusing input while it waits on something it
    // started: a font load (see `fontFamilySelection`), or the pages a print
    // renders (see `print`). Mounted on the root, and it has to be: what it
    // holds is its own siblings, so mounting it any deeper would leave the
    // ribbon and the panels live.
    const busyModal = createBusyModal(i18n);
    busyModal.mount(layout);

    // The password a protected document needs before it opens. On the root,
    // like the busy hold: until the document opens nothing the UI offers
    // works, so it blocks the whole component.
    const passwordModal = createPasswordModal(i18n);
    passwordModal.mount(layout);

    // --- slot scaffold (mirrors the viewer shell) ------------------------
    const toolbarSlot = document.createElement("div");
    toolbarSlot.className = "udoc-slot udoc-toolbar-slot";
    toolbarSlot.setAttribute("role", "region");
    toolbarSlot.setAttribute("aria-label", i18n.t("shell.regionToolbar"));
    toolbarSlot.setAttribute("tabindex", "-1");

    const ribbonSlot = document.createElement("div");
    ribbonSlot.className = "udoc-slot udoc-ribbon-slot";

    const bodySlot = document.createElement("div");
    bodySlot.className = "udoc-slot udoc-body-slot";

    const leftPanelSlot = document.createElement("div");
    leftPanelSlot.className = "udoc-slot udoc-left-panel-slot";
    leftPanelSlot.setAttribute("role", "region");
    leftPanelSlot.setAttribute("aria-label", i18n.t("shell.regionSidePanel"));
    leftPanelSlot.setAttribute("tabindex", "-1");

    const viewportSlot = document.createElement("div");
    viewportSlot.className = "udoc-slot udoc-viewport-slot";
    viewportSlot.setAttribute("role", "region");
    viewportSlot.setAttribute("aria-label", i18n.t("shell.regionDocument"));
    viewportSlot.setAttribute("tabindex", "-1");

    const rightPanelSlot = document.createElement("div");
    rightPanelSlot.className = "udoc-slot udoc-right-panel-slot";
    rightPanelSlot.setAttribute("role", "region");
    rightPanelSlot.setAttribute("aria-label", i18n.t("shell.regionSearchComments"));
    rightPanelSlot.setAttribute("tabindex", "-1");

    // Tapping outside an open panel closes it (mobile).
    const panelOverlay = document.createElement("div");
    panelOverlay.className = "udoc-panel-overlay";

    // Skip-navigation link for keyboard users.
    const skipLink = document.createElement("a");
    skipLink.href = "#";
    skipLink.className = "udoc-skip-link";
    skipLink.textContent = i18n.t("shell.skipToDocument");
    skipLink.addEventListener("click", (e) => {
        e.preventDefault();
        const focusTarget = viewportSlot.querySelector<HTMLElement>('[tabindex="0"]') ?? viewportSlot;
        focusTarget.focus();
    });

    bodySlot.append(leftPanelSlot, viewportSlot, rightPanelSlot, panelOverlay);
    layout.append(skipLink, toolbarSlot, ribbonSlot, bodySlot);
    root.appendChild(layout);

    // The mode the shell opens in: view, or the extension's when it says so.
    const startMode = extension?.initialMode ?? VIEW_MODE;
    const shownPanels: Record<PanelTab, boolean | undefined> = {
        thumbnail: shellOptions.showThumbnailPanel,
        outline: shellOptions.showOutlinePanel,
        layers: shellOptions.showLayersPanel,
        // Hidden, with no option to show it, until the tab has a panel.
        attachments: false,
        search: shellOptions.showSearchPanel,
        comments: shellOptions.showCommentsPanel,
    };
    const hostDisabledPanels: ReadonlySet<PanelTab> = new Set(
        [...LEFT_PANEL_TABS, ...RIGHT_PANEL_TABS].filter((tab) => shownPanels[tab] === false),
    );
    // The tab strip a doc type shows in a mode: its profile's in view mode, the
    // extension's in the extension's own.
    const tabsOf: TabSource = (docType, mode) =>
        mode === VIEW_MODE ? profileFor(docType).viewTabs : (extension?.tabs(docType) ?? []);
    // A session may be in view mode whatever it is entitled to, and in the
    // extension's as that mode's feature says.
    const entitled: ModeEntitlement = (mode, features) =>
        mode === VIEW_MODE || (mode === extension?.mode.id && features.includes(extension.mode.feature));
    const startState: UIState = {
        ...initialState,
        mode: startMode,
        activeTab: defaultTab(tabsOf(null, startMode)),
        extension: extension?.initialState ?? null,
        theme: shellOptions.theme ?? initialState.theme,
        toolbarVisible: shellOptions.showToolbar ?? initialState.toolbarVisible,
        leftPanelVisible: shellOptions.showLeftPanel ?? initialState.leftPanelVisible,
        rightPanelVisible: shellOptions.showRightPanel ?? initialState.rightPanelVisible,
        notesOpen: shellOptions.showNotesPanel ?? initialState.notesOpen,
        presentationView: shellOptions.presentationView ?? initialState.presentationView,
        formulaBarVisible: shellOptions.showFormulaBar ?? initialState.formulaBarVisible,
        disabledPanels: hostDisabledPanels,
        hostDisabledPanels,
        themeSwitchingDisabled: shellOptions.showThemeButton === false,
        fullscreenButtonVisible: shellOptions.showFullscreenButton ?? initialState.fullscreenButtonVisible,
        printButtonVisible: shellOptions.showPrintButton ?? initialState.printButtonVisible,
        downloadButtonVisible: shellOptions.showDownloadButton ?? initialState.downloadButtonVisible,
        developerButtonVisible: shellOptions.showDeveloperButton ?? initialState.developerButtonVisible,
        copyEnabled: shellOptions.enableCopy ?? initialState.copyEnabled,
        pointerSharing: shellOptions.enablePointerSharing ?? initialState.pointerSharing,
        peerPointersVisible: shellOptions.showPeerPointers ?? initialState.peerPointersVisible,
        viewControlsPlacement: shellOptions.viewControlsPlacement ?? initialState.viewControlsPlacement,
        scrollMode: shellOptions.scrollMode ?? initialState.scrollMode,
        defaultScrollMode: shellOptions.scrollMode ?? initialState.defaultScrollMode,
        layoutMode: shellOptions.layoutMode ?? initialState.layoutMode,
        pageRotation: shellOptions.pageRotation ?? initialState.pageRotation,
        pageGap: shellOptions.pageGap ?? initialState.pageGap,
        defaultFit: shellOptions.fit ?? initialState.defaultFit,
        zoom: shellOptions.zoom ?? initialState.zoom,
        dpi: shellOptions.dpi ?? initialState.dpi,
        defaultZoom: shellOptions.zoom ?? initialState.defaultZoom,
        zoomSteps: shellOptions.zoomSteps ?? initialState.zoomSteps,
        minZoom: shellOptions.minZoom ?? initialState.minZoom,
        maxZoom: shellOptions.maxZoom ?? initialState.maxZoom,
        navigationScrollAlignment: shellOptions.navigationScrollAlignment ?? initialState.navigationScrollAlignment,
        searchScrollAlignment: shellOptions.searchScrollAlignment ?? initialState.searchScrollAlignment,
    };

    const store = createStore<UIState, Action>(createReducer(tabsOf, entitled), startState, { batched: true });
    // The host's starting panel, opened as `openPanel` opens one — not when it,
    // or its side, is hidden — and before the chrome mounts, so it doesn't
    // slide in.
    if (shellOptions.activePanel) store.dispatch({ type: "OPEN_PANEL", panel: shellOptions.activePanel });

    // What covers the document area while a document opens: the wordmark and
    // how far the open has got. The body only — the toolbar, ribbon and status
    // bar show from mount on, and covering them later would flash them. It
    // carries the brand, so the host's `showLoadingOverlay: false` holds only
    // under a license.
    const loadingOverlay = createLoadingOverlay(
        i18n,
        () => shellOptions.showLoadingOverlay !== false || client.entitlements?.licensed !== true,
    );
    loadingOverlay.mount(bodySlot, store);

    // --- mount the chrome ------------------------------------------------
    const toolbar = createToolbar(i18n, tabsOf);
    toolbar.mount(toolbarSlot, store);

    // The ribbon owns the tab strip but renders it anchored to the toolbar's
    // bottom edge: parent it into the toolbar's slot before mounting, so the
    // ribbon's initial roving/refresh sees it already in the DOM.
    const ribbon = createRibbon(i18n, tabsOf, extension?.commands ?? {});
    toolbar.tabStripSlot.appendChild(ribbon.tabStrip);
    ribbon.mount(ribbonSlot, store);

    // The thumbnails' edits commit like the canvas's, and their menu is the
    // canvas's context menu, handed the page rows.
    const leftPanel = createLeftPanel(
        i18n,
        { openUrl: (url) => openUrl(url) },
        {
            onSelectionEdit: (edit) => editPages(edit),
            onRenameSection: (id, name) => renameSlideSection(id, name),
            onContextMenu: (x, y, rows) => contextMenu.open(x, y, rows),
        },
    );
    leftPanel.mount(leftPanelSlot, store, client);

    // The open PDF's form: each of its widgets, with how a press fills its field
    // in through it (null where none does) — read once a document opens, as
    // filling in changes a field's value and never which widgets are whose. And
    // the widget whose field is being filled in, with the field and widget as
    // read when the press landed. And the alternate name of each widget's field
    // that has one, which a hover over the widget shows.
    let formWidgets = new Map<string, FillKind | null>();
    let formAlternateNames = new Map<string, string>();
    let filling: { widget: string; form: FormWidget } | null = null;
    // The elements of each page that play media, by page index, as last read;
    // the generation of the document each page was last asked at, which a
    // change of the document moves on so the next frame asks again; and the
    // object URL of each media file a player has asked for, by its id, kept
    // until the document closes.
    let pageMedia = new Map<number, ComposedShapeMedia[]>();
    let pageMediaAsked = new Map<number, number>();
    let pageMediaGeneration = 0;
    let mediaFiles = new Map<string, Promise<string | null>>();
    // The pages the last frame showed, for a read that isn't a frame's.
    let mediaViews: readonly PageView[] = [];

    // The host's page annotations — legacy's calls and events, over the model.
    const pageAnnotationListeners = new Set<PageAnnotationListener>();
    const pageAnnotations = createPageAnnotations({
        client,
        store,
        execute: (command) => execute(command),
        mintId: () => mintId(),
        selection: () => selection(),
        setSelection: (next) => setSelection(next),
        emit: (event, payload) => {
            for (const listener of pageAnnotationListeners) listener(event, payload);
        },
    });

    // These commit fns are hoisted, so every object edit (move / rotate / scale)
    // commits through the same edit path as a page edit (relayout, compose-ahead,
    // the onEdit cue) — not the worker client directly, which would skip the sync
    // broadcast.
    const canvas = createCanvas(i18n, client, {
        commitTranslate: (dx, dy) => void translateSelection(dx, dy),
        commitScaleEach: (sx, sy, ax, ay) => void scaleSelectionEach(sx, sy, ax, ay),
        placedShape: (tool) => extension?.placedShape(tool) ?? null,
        place: (tool, page, p0, p1) => extension?.place(tool, page, p0, p1),
        placeAnnotation: (tool, page, points) => insertAnnotation(tool, page, points),
        markText: (tool) => markText(tool),
        // A widget fills its field in only for a session entitled to form
        // filling; without it, a press on one selects text as on the page.
        formWidget: (annotation) =>
            store.getState().features.includes("formFilling") ? (formWidgets.get(annotation) ?? null) : null,
        isFormWidget: (annotation) => formWidgets.has(annotation),
        formFieldAlternateName: (annotation) => formAlternateNames.get(annotation) ?? null,
        fillFormField: (page, annotation) => void fillFormField(page, annotation),
        followLink: (link) => followLink(link),
        followTextLink: (link, page) => followTextLink(link, page),
        annotationHover: (annotation, clientX, clientY) => pageAnnotations.hover(annotation, clientX, clientY),
        annotationClick: (annotation, clientX, clientY) => pageAnnotations.click(annotation, clientX, clientY),
        insertText: (text) => {
            if (store.getState().docType !== "spreadsheet") void insertSelectionText(text);
            else if (typingCell()) editCellEntry({ text: { edit: { insertText: { text } } } });
            else beginCellEntry("enter", text);
        },
        deleteText: (forward) => {
            // A workbook's grid takes Backspace and Delete as keys where no cell
            // is typed into (see `cellKey`).
            if (store.getState().docType !== "spreadsheet") void deleteSelectionText(forward);
            else if (typingCell()) editCellEntry({ text: { edit: { deleteText: { forward } } } });
        },
        cellKey: (ev) => cellKey(ev),
        beginCellEntry: (text) =>
            typingCell() ? editCellEntry({ text: { edit: { insertText: { text } } } }) : beginCellEntry("enter", text),
        commitCellEntry: () => void saveCellEntry(false, null),
        resizeColumn: (index, points) => void resizeColumn(index, points),
        resizeRow: (index, points) => void resizeRow(index, points),
        onContextMenu: (x, y, inTable) =>
            contextMenu.open(x, y, extension?.contextMenuItems(store.getState(), inTable) ?? CONTEXT_MENU),
        guideBand: (state) => extension?.guideBand(state) ?? null,
        ...(extension && { selectionChrome: extension.selectionChrome }),
        pressCanvas: (x, y, ev, host) => extension?.pressCanvas(x, y, ev, host) ?? null,
        canvasCursor: (x, y) => extension?.canvasCursor(x, y) ?? null,
        pointerMove: (x, y) => sharePointer({ x, y }),
        pointerLeave: () => sharePointer(null),
    });
    canvas.mount(viewportSlot, store);

    // A deck's speaker notes, in a pane under the slides: a second viewer on
    // the document, whose caret types through the canvas's hidden text input
    // and whose right-click opens the canvas's menu.
    const notesPane = createNotesPane(i18n, client, {
        focusTextInput: () => canvas.focusClipboardSink(),
        onContextMenu: (x, y) =>
            contextMenu.open(x, y, extension?.contextMenuItems(store.getState(), false) ?? CONTEXT_MENU),
    });
    notesPane.mount(viewportSlot, store);

    // A workbook's formula bar, above its grid: the active cell's reference
    // and contents, which it edits as the cell's entry.
    const formulaBar = createFormulaBar(i18n, {
        begin: () => beginCellEntry("edit", null),
        replace: (text, caret) => editCellEntry({ replace: { text, caret } }),
        save: (fill, then) => saveCellEntry(fill, then),
        cancel: () => runCellKey({ kind: "cancel" }),
        focusGrid: () => canvas.focusClipboardSink(),
        keyboard: (held) => canvas.setCaretShown(!held),
    });
    formulaBar.mount(viewportSlot, store);

    // --- a workbook's cells ---------------------------------------------
    //
    // The keys on the grid move the active cell and type into it (see
    // `cell-keys`); what is typed stays an entry the grid draws over the cell
    // until it is saved, which writes it as one undo step.

    // The entry as this side last asked for it — begun in a mode, or saved or
    // dropped (`null`) — until the selection report that follows; `undefined`
    // where the reports say. What is typed and pressed before that report
    // lands as it will by the time the worker reads it: into an entry just
    // begun, or after one just saved, beginning the next.
    let entryAsked: CellEntryMode | null | undefined;
    // How many requests editing or saving the entry this side has sent: a
    // report that has read fewer was sent before the last of them landed.
    let entryRequests = 0;

    /** Send `edit` to the entry, counted. */
    function editCellEntry(edit: CellEntryEdit): void {
        entryRequests++;
        client.editCellEntry(edit);
    }

    /** How a workbook's active cell is being typed into, or `null`. */
    function cellEntryMode(): CellEntryMode | null {
        const state = store.getState();
        if (state.docType !== "spreadsheet") return null;
        return entryAsked !== undefined ? entryAsked : (state.activeCell?.entry ?? null);
    }

    /** Whether a workbook's active cell is being typed into. */
    function typingCell(): boolean {
        return cellEntryMode() !== null;
    }

    /** Begin typing into the active cell in `mode` — `text` in place of what it
     *  holds, or with none its contents (Edit) or nothing (Enter). */
    function beginCellEntry(mode: CellEntryMode, text: string | null): void {
        entryAsked = mode;
        editCellEntry({ begin: { mode, text } });
    }

    // Set by a move the keyboard makes, so the selection it reports is
    // scrolled into view.
    let followCell = false;

    /** Take a key pressed on a workbook's grid, answering whether it did. */
    function cellKey(ev: KeyboardEvent): boolean {
        const state = store.getState();
        // A key pressed before the report of the press that selected the cell
        // reaches the worker after that press, and takes the cell it selected.
        if (state.status !== "ready") return false;
        const action = cellKeyAction(ev, cellEntryMode(), state.mode !== VIEW_MODE);
        if (!action) return false;
        runCellKey(action);
        return true;
    }

    function runCellKey(action: CellKeyAction): void {
        switch (action.kind) {
            case "move":
                followCell = true;
                client.moveCellSelection(action.movement, action.extend);
                return;
            case "begin":
                beginCellEntry(action.mode, action.text);
                return;
            case "clear":
                void commit(() => client.executeOnSelection({ kind: "clearCellContents" }));
                return;
            case "commit":
                void saveCellEntry(action.fill, action.then);
                return;
            case "lineBreak":
                editCellEntry({ text: { edit: { insertText: { text: "\n" } } } });
                return;
            case "switchMode": {
                // What is pressed before the report lands in the mode switched
                // to, as with a begin.
                const mode = cellEntryMode();
                if (mode !== null) entryAsked = mode === "enter" ? "edit" : "enter";
                editCellEntry("switchMode");
                return;
            }
            case "insertSheet":
                void insertSheet(store.getState().currentPlane);
                return;
            case "cancel":
                entryAsked = null;
                editCellEntry("cancel");
                return;
        }
    }

    /** Save what is typed into the active cell — into every selected cell with
     *  `fill` — and move `then`. Resolves whether it was saved: a refusal (a
     *  formula that doesn't parse) shows under the formula bar, the entry
     *  left open. */
    async function saveCellEntry(fill: boolean, then: GridCellSelectionMove | null): Promise<boolean> {
        followCell = then !== null;
        entryAsked = null;
        entryRequests++;
        try {
            await commit(() => client.executeOnSelection({ kind: "commitCellEntry", fill, then }));
            return true;
        } catch (error) {
            // Refused, the entry stays open, as the reports say.
            entryAsked = undefined;
            followCell = false;
            formulaBar.showRefusal(error instanceof Error ? error.message : String(error));
            return false;
        }
    }

    /** Scroll a cell block the keyboard moved to into view — the least that
     *  shows it, its top-left where it is larger than the view. */
    function followCellBlock(box: { rect: { x0: number; y0: number; x1: number; y1: number } } | undefined): void {
        if (!followCell || !box) return;
        followCell = false;
        const state = store.getState();
        const perPt = renderZoom(state) * cssPxPerPt(viewDpi(state));
        const width = visibleSpan(state, "x") / perPt;
        const height = visibleSpan(state, "y") / perPt;
        const { x0, y0, x1, y1 } = box.rect;
        const into = (scroll: number, near: number, far: number, span: number) =>
            near < scroll ? near : far > scroll + span ? Math.min(near, far - span) : scroll;
        const x = into(state.scrollX, x0, x1, width);
        const y = into(state.scrollY, y0, y1, height);
        if (x !== state.scrollX || y !== state.scrollY) store.dispatch({ type: "SCROLL_TO", x, y });
    }

    // The licensing refusal. On the root for the same reason as the busy hold:
    // without a session nothing the UI offers works, so it blocks its own
    // siblings — the whole component — rather than just the viewport. Mounted
    // here rather than beside the other dialogs only because it is the first
    // one that needs the store, which does not exist that early.
    const licenseNotice = createLicenseNotice(i18n);
    licenseNotice.mount(layout, store);

    // The page spacing: the extension's, for page chrome of its own that needs
    // room around the pages, else the reading spacing — the host's `pageGap`,
    // when it set one; none with the view settings' Page Gap off.
    function spacingFor(s: UIState): PageSpacing {
        return (
            extension?.spacing(s) ?? {
                padding: READ_PADDING,
                gap: arrangementFor(s).showPageGap ? (s.pageGap ?? READ_PAGE_GAP) : NO_PAGE_GAP,
            }
        );
    }
    function applySpacing(): void {
        const { padding, gap } = spacingFor(store.getState());
        client.setSpacing(padding, gap);
    }
    applySpacing();
    const unsubSpacing = subscribeSelector(store, spacingFor, () => applySpacing(), {
        equality: (a, b) => a.padding === b.padding && a.gap === b.gap,
    });

    // The selected comment's thread — a markup annotation's rich contents and
    // the replies that answer it — in a popup beside it, when it is open: the
    // engine draws a note's icon or a square's outline, not what it says. A
    // free text has none: its text is edited in its box. A note just placed
    // opens its popup editing, so its text is typed straight away.
    let focusPlacedComment = false;
    const commentPopupSource = commentPopup(i18n, {
        comment: () => {
            const state = store.getState();
            const comment = selectedComment(state);
            return comment && commentOpen(state, comment) ? comment : null;
        },
        pageToViewport: (page) => canvas.pageToViewport(page),
        takeFocus: () => {
            const take = focusPlacedComment;
            focusPlacedComment = false;
            return take;
        },
        onSave: (comment, richContents) => void saveComment(comment, richContents),
        onReply: (comment, richContents) => void replyToComment(comment, richContents),
        onDelete: (comment) => void deleteComment(comment),
        onDismiss: () => canvas.focusClipboardSink(),
        annotating: () => store.getState().features.includes("annotation"),
    });
    canvas.setOverlay("udoc:comment-popup", commentPopupSource, { aboveSelection: true });
    // The control a form field is filled in with, over the widget pressed: a
    // field's value is the browser's to type or pick, and the engine's to draw
    // once it is filled in.
    const formFieldSource = formFieldInput({
        filling: () => filling,
        pageToViewport: (page) => canvas.pageToViewport(page),
        onCommit: (fill) => void commit(() => client.execute(Command.fillAcroFormFields([fill]))),
        onClose: () => {
            filling = null;
            canvas.setOverlay("udoc:form-field", formFieldSource, { aboveSelection: true });
            canvas.focusClipboardSink();
        },
    });
    canvas.setOverlay("udoc:form-field", formFieldSource, { aboveSelection: true });
    // A player over each element on screen that plays media, in view mode: the
    // browser plays the file, the canvas keeps painting the element's own
    // picture under it.
    const mediaSource = mediaPlayers({
        active: mediaPlayersShow,
        media: (page) => pageMedia.get(page) ?? [],
        pageToViewport: (page) => canvas.pageToViewport(page),
        file: mediaFile,
    });
    canvas.setOverlay("udoc:media", mediaSource, { aboveSelection: true });
    // Each frame asks for the media of the pages it shows that weren't asked
    // for since the document last changed. A change asks nothing itself: the
    // frame it paints does, once the layout has it.
    const unsubPageMedia = client.onPageViews((frame) => {
        mediaViews = frame.views;
        askPageMedia();
    });
    const unsubDocumentChangedMedia = client.onDocumentChanged(() => {
        pageMediaGeneration += 1;
    });
    // Into view mode the players show, out of it they go.
    const unsubMediaMode = subscribeSelector(
        store,
        (s) => ({ status: s.status, docType: s.docType, mode: s.mode }),
        () => {
            askPageMedia();
            canvas.setOverlay("udoc:media", mediaSource, { aboveSelection: true });
        },
        { equality: shallowEqual },
    );
    // The annotation boxes the last selection report drew — the annotations
    // selected, or the free text a caret is in, whose drags are the
    // annotation's. Read off the report itself rather than
    // `selectedAnnotations`, which holds only selected annotations: its read
    // dumps the page's annotations, which typing would redo at every key.
    let annotationBoxes: readonly SelectionBox[] = [];
    // The bar of the one annotation selected, or the free text a caret is in,
    // above it: open its comment, change its colour — the Annotate tab's Color,
    // its panel and its recents — or delete it. Not while a tool is armed, when
    // the Format colour styles the tool rather than the selection.
    const annotationBar = createAnnotationBar(i18n, {
        box: () =>
            store.getState().pointerMode.kind === "select" && annotationBoxes.length === 1 ? annotationBoxes[0]! : null,
        selectedId: () => selectedAnnotation(store.getState())?.annotation.id,
        pageToViewport: (page) => canvas.pageToViewport(page),
        commentable: () => {
            const selected = selectedAnnotation(store.getState());
            return selected === null || !editedInBox(selected.annotation);
        },
        comment: () => {
            const state = store.getState();
            const comment = selectedComment(state);
            return comment ? commentOpen(state, comment) : null;
        },
        // A restyle is an annotation's edit, which no capability gates: offered
        // only to a session entitled to annotate.
        color: () => {
            const state = store.getState();
            return state.features.includes("annotation") ? annotationFormat(state)?.color : undefined;
        },
        deletable: () => allowsEdit(store.getState().selectionCaps, "deleteAnnotations"),
        onToggleComment: () => {
            const state = store.getState();
            const comment = selectedComment(state);
            const id = comment?.annotation.id;
            if (comment && id !== undefined) {
                store.dispatch({ type: "SET_COMMENT_POPUP", id, open: !commentOpen(state, comment) });
            }
        },
        fillColor: (menu, close) => ribbon.fillAnnotationColor(menu, close),
        onDelete: () => void deleteSelection(),
    });
    canvas.setOverlay("udoc:annotation-bar", annotationBar.source, { aboveSelection: true });
    // Rendered again whenever what they show changes, as selecting an
    // annotation paints no frame.
    const unsubCommentPopup = subscribeSelector(
        store,
        (s) => ({
            selected: s.selectedAnnotations,
            comments: s.comments,
            mode: s.mode,
            commentPopup: s.commentPopup,
            caps: s.selectionCaps,
            pointer: s.pointerMode,
        }),
        () => {
            canvas.setOverlay("udoc:comment-popup", commentPopupSource, { aboveSelection: true });
            canvas.setOverlay("udoc:annotation-bar", annotationBar.source, { aboveSelection: true });
        },
        { equality: shallowEqual },
    );

    // Virtual scrollbars (synthetic scroll has no native scrollbar), along the
    // canvas host's right and bottom edges. Whether they lie over the document
    // or in a strip the engine keeps clear for them is the doc type's call (the
    // profile's `scrollbarGutters`; see the canvas's `applyScrollbarMode`).
    const vScrollbar = createScrollbar("y");
    vScrollbar.mount(canvas.el, store);
    const hScrollbar = createScrollbar("x");
    hScrollbar.mount(canvas.el, store);

    // The single, shared view-state controls (page nav + zoom + view mode). It
    // is re-parented between three hosts as `viewControlsPlacement` changes —
    // the same component everywhere, so the three placements never drift.
    const viewControls = createViewControls(i18n);
    viewControls.mount(store);

    const floatingToolbar = createFloatingToolbar(i18n);
    floatingToolbar.mount(viewportSlot);

    const statusBar = createStatusBar(i18n);
    statusBar.mount(layout);

    // The bottom sheet-tab bar (spreadsheet plane switcher), docked in the
    // status bar's left edge. Empty for single-plane doc types. Outside view
    // mode it edits the workbook's sheets.
    const sheetTabs = createSheetTabs(i18n, {
        insert: () => void insertSheet(store.getState().currentPlane + 1),
        contextMenu: (plane, x, y) => {
            // A right-click makes its sheet current, as Excel's does, and the
            // menu acts on it.
            store.dispatch({ type: "SET_CURRENT_PLANE", plane });
            contextMenu.open(x, y, sheetTabMenu(store.getState()));
        },
        rename: (plane, name) => renameSheet(plane, name),
        move: (plane, before) => void moveSheet(plane, before),
    });
    sheetTabs.mount(statusBar.sheetTabsSlot, store);

    // The Comments tab lists every comment's thread, written as the popup's is;
    // choosing one goes to it and selects it.
    const rightPanel = createRightPanel(
        i18n,
        {
            onSave: (comment, richContents) => void saveComment(comment, richContents),
            onReply: (comment, richContents) => void replyToComment(comment, richContents),
            onDelete: (comment) => void deleteComment(comment),
            onDismiss: () => canvas.focusClipboardSink(),
            onChoose: (comment) => chooseComment(comment),
        },
        {
            search: (query, options) => void search(query, options),
            clear: () => clearSearch(),
        },
    );
    rightPanel.mount(rightPanelSlot, store);

    // Dock the view controls into the host the placement selects, and toggle the
    // hosts' visibility. `top-toolbar` falls back to `floating` when the top bar
    // is hidden (chromeless embeds) so the controls stay reachable.
    function resolvePlacement(state: UIState): ViewControlsPlacement {
        // A grid document (spreadsheet) has zoom-only controls that always pin to
        // the status bar beside its sheet tabs — never the floating page-nav bar —
        // so the configured placement doesn't apply.
        if (!profileFor(state.docType).pagedViewControls) return "status-bar";
        if (state.viewControlsPlacement === "top-toolbar" && !state.toolbarVisible) return "floating";
        return state.viewControlsPlacement;
    }
    let mountedPlacement: ViewControlsPlacement | null = null;
    function applyPlacement(placement: ViewControlsPlacement): void {
        if (placement === mountedPlacement) return;
        mountedPlacement = placement;
        // Dropdowns open downward only when docked in the top toolbar.
        viewControls.el.classList.toggle("udoc-view-controls--top", placement === "top-toolbar");
        if (placement === "top-toolbar") toolbar.viewControlsSlot.appendChild(viewControls.el);
        else if (placement === "status-bar") statusBar.controlsSlot.appendChild(viewControls.el);
        else floatingToolbar.el.appendChild(viewControls.el);
        floatingToolbar.setVisible(placement === "floating");
    }
    applyPlacement(resolvePlacement(store.getState()));
    const unsubPlacement = subscribeSelector(
        store,
        (s) => resolvePlacement(s),
        (placement) => applyPlacement(placement),
    );

    // Strip the paged sections (page nav + view mode) for grid documents, leaving
    // the bare zoom control. Keyed on the profile flag so it tracks the loaded
    // doc type (unknown until the first document loads).
    const pagedViewControls = (s: UIState) => profileFor(s.docType).pagedViewControls;
    viewControls.setPagedSections(pagedViewControls(store.getState()));
    const unsubViewControlsComposition = subscribeSelector(
        store,
        (s) => pagedViewControls(s),
        (paged) => viewControls.setPagedSections(paged),
    );

    // The status bar shows when it has something to host: the view controls
    // docked there, or the sheet-tab bar (spreadsheets). Independent of the
    // view-controls placement, so a spreadsheet keeps its tabs even with the
    // controls floating.
    function statusBarVisible(s: UIState): boolean {
        return resolvePlacement(s) === "status-bar" || profileFor(s.docType).sheetTabs;
    }
    statusBar.setVisible(statusBarVisible(store.getState()));
    const unsubStatusBar = subscribeSelector(
        store,
        (s) => statusBarVisible(s),
        (visible) => statusBar.setVisible(visible),
    );

    // Forward "go to page N" requests to the worker. The page nav controls
    // dispatch NAVIGATE_TO_PAGE (raising a navRequest); the worker owns the
    // per-page offsets, composes the target, scrolls, and streams the resulting
    // scroll + current page back in the next frame (adopted via SYNC_VIEW /
    // SET_PAGE_INDEX in Canvas). We watch the request seq, not pageIndex, so a
    // frame-driven page change can't loop back into a scroll.
    const unsubNav = subscribeSelector(
        store,
        (s) => s.navRequest,
        (req) => {
            if (store.getState().status === "ready") client.goToPage(req.pageIndex);
        },
    );

    // Push the arrangement — scroll mode, layout mode, page rotation — to the
    // worker when the view-mode menu or the host changes it, and once now for
    // the host's options. Sticky in the worker, so each survives re-opens, but
    // for the scroll mode, which each open sets to the default below; a
    // live switch keeps the current page in view (the engine re-anchors and
    // streams the result back via the fresh-frame SYNC_VIEW path in Canvas).
    const unsubScrollMode = subscribeSelector(
        store,
        (s) => s.scrollMode,
        (mode) => client.setScrollMode(mode),
    );
    client.setScrollMode(store.getState().scrollMode);
    // The scroll mode every document opens in: the worker applies it at open,
    // before the first frame, and the open adopts the same into the state.
    const unsubDefaultScrollMode = subscribeSelector(
        store,
        (s) => s.defaultScrollMode,
        (mode) => client.setDefaultScrollMode(mode),
    );
    client.setDefaultScrollMode(store.getState().defaultScrollMode);
    // Layout and rotation reach the engine only where the doc type offers them
    // (PDF, Word); any other document gets single, upright pages.
    const unsubLayoutMode = subscribeSelector(
        store,
        (s) => arrangementFor(s).layoutMode,
        (mode) => client.setLayoutMode(mode),
    );
    client.setLayoutMode(arrangementFor(store.getState()).layoutMode);
    const unsubPageRotation = subscribeSelector(
        store,
        (s) => arrangementFor(s).pageRotation,
        (rotation) => client.setPageRotation(rotation / 90),
    );
    client.setPageRotation(arrangementFor(store.getState()).pageRotation / 90);
    // The fit every document opens with: the worker fits by it at open, before
    // the first frame, and the open below adopts the same into the state.
    const unsubDefaultFit = subscribeSelector(
        store,
        (s) => s.defaultFit,
        (fit) => client.setDefaultFit(fit),
    );
    client.setDefaultFit(store.getState().defaultFit);
    // The explicit zoom it opens at without a fit, fixed at create.
    client.setDefaultZoom(store.getState().defaultZoom);
    // The screen density 100% is measured against — the host's calibration.
    const unsubDpi = subscribeSelector(
        store,
        (s) => s.dpi,
        (dpi) => client.setDpi(dpi),
    );
    client.setDpi(store.getState().dpi);

    // The plane the worker was last asked to show, as the store last told of
    // `currentPlane`; the plane the last painted frame showed (`-1` before the
    // open document's first); and the `goToPlane` calls waiting for a frame to
    // show theirs. A wait settles once that frame paints, or once the view has
    // moved on without it: another plane chosen, or the document gone.
    let requestedPlane = 0;
    let paintedPlane = -1;
    const planeWaiters = new Map<() => void, number>();
    function settlePlaneWaiters(): void {
        for (const [settle, plane] of planeWaiters) {
            if (requestedPlane !== plane || paintedPlane === plane) settle();
        }
    }

    // A sheet-tab click flips `currentPlane` in the store; tell the worker to
    // switch the active plane and adopt the new sheet's layout. Keyed on the
    // value, so the initial subscribe (and a no-op re-pick) doesn't fire.
    const unsubPlane = subscribeSelector(
        store,
        (s) => s.currentPlane,
        (plane) => {
            requestedPlane = plane;
            if (store.getState().status === "ready") void switchPlane(plane);
            settlePlaneWaiters();
        },
    );
    const unsubPaintedPlane = client.onPageViews((frame) => {
        if (store.getState().status !== "ready") return;
        paintedPlane = frame.plane;
        settlePlaneWaiters();
    });
    const unsubPlaneStatus = subscribeSelector(
        store,
        (s) => s.status,
        (status) => {
            if (status === "ready") return;
            paintedPlane = -1;
            for (const settle of planeWaiters.keys()) settle();
        },
    );

    async function goToPlane(plane: number): Promise<void> {
        store.dispatch({ type: "SET_CURRENT_PLANE", plane });
        // The store tells its subscribers in a microtask: by the end of it the
        // switch is asked for, or a later choice made in the same task has
        // superseded it.
        await Promise.resolve();
        if (requestedPlane !== plane || paintedPlane === plane) return;
        await new Promise<void>((resolve) => {
            const settle = (): void => {
                planeWaiters.delete(settle);
                resolve();
            };
            planeWaiters.set(settle, plane);
        });
    }

    async function setPresentationView(view: PresentationView): Promise<void> {
        store.dispatch({ type: "SET_PRESENTATION_VIEW", view });
        const plane = planeOfView(store.getState().planeKinds, view);
        if (plane >= 0) await goToPlane(plane);
    }

    // Performance counter: the toggle both enables the worker's counter and
    // shows the on-screen HUD; the HUD updates from the worker's perf stream.
    const perfHud = createPerfHud();
    viewportSlot.appendChild(perfHud.el);
    const unsubPerf = client.onPerformance((summary) => perfHud.update(summary));
    const unsubPerfToggle = subscribeSelector(
        store,
        (s) => s.developerOptions.performanceCounter,
        (on) => {
            client.setPerf(on);
            if (on) perfHud.show();
            else perfHud.hide();
        },
    );

    const effects = createEffects(store);

    // --- theme -----------------------------------------------------------
    // A hidden probe for reading resolved role colors back to the engine.
    // `getComputedStyle` does NOT substitute var() inside a *custom property*
    // (a component token is a var() of a role, like --udoc-canvas-background),
    // but it DOES resolve a real property — so we set the probe's `color` to the
    // token expression and read its computed `color`. See
    // docs/design/ui-color-system.md (Engine read-back).
    const colorProbe = document.createElement("div");
    colorProbe.setAttribute("aria-hidden", "true");
    colorProbe.style.cssText = "position:absolute;width:0;height:0;visibility:hidden;pointer-events:none";
    layout.appendChild(colorProbe);
    /** Resolve a color expression (e.g. `var(--udoc-canvas-background)`) to RGB. */
    function resolveColor(expr: string): RgbColor | null {
        colorProbe.style.color = expr;
        return cssColorToRgb(getComputedStyle(colorProbe).color);
    }

    function resolveIsDark(theme: ThemeMode): boolean {
        if (theme === "dark") return true;
        if (theme === "light") return false;
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    function applyThemeClass(isDark: boolean): void {
        layout.classList.toggle("udoc-ui-dark", isDark);
        // Pin color-scheme in lock-step with the class so native form controls /
        // scrollbars match the theme and a host's `light-dark()` overrides resolve.
        layout.style.colorScheme = isDark ? "dark" : "light";
        syncBackdrop(isDark);
        syncPageBorder();
        syncGuideColors();
    }
    // Push the canvas background (the Rust-painted gaps around the pages) to the
    // engine so it matches the theme, resolved through the probe (see above)
    // since it is a var() the chrome can't be read raw.
    function syncBackdrop(isDark: boolean): void {
        // The main editing area, on its own --udoc-canvas-background token
        // (defaults to `surface`, the ladder's canvas rung). White pages float on
        // it; the chrome frames it a rung higher, popups rise from there.
        const color = resolveColor("var(--udoc-canvas-background)");
        if (!color) return;
        client.setBackdrop(color);
        // A deck's notes stand on the same ground, under the slides.
        notesPane.setBackdrop(color, isDark);
    }
    // Push the page-border color (the Rust-painted 1px frame around each page) to
    // the engine so it tracks the theme. Outline-variant — the soft outline —
    // reads as a page edge against the canvas background without competing with
    // page content, matching the guide grid marks. Where the pages touch (the
    // view settings' Page Gap off) there is no edge to mark, only a line ruled
    // between pages, so none is drawn.
    function syncPageBorder(): void {
        if (pagesTouch(store.getState())) {
            client.setPageBorder(null);
            return;
        }
        const color = resolveColor("var(--udoc-color-outline-variant)");
        if (color) client.setPageBorder(color);
    }
    /** Whether the pages touch: no gap on either axis. */
    function pagesTouch(s: UIState): boolean {
        const { gap } = spacingFor(s);
        return gap.horizontal === 0 && gap.vertical === 0;
    }
    const unsubPageBorder = subscribeSelector(store, pagesTouch, () => syncPageBorder());
    // Recolor the host-rendered guide bands (the ruler / spreadsheet headers) to
    // the theme: resolve the colors the bands map onto through the probe and
    // hand them to the band renderer (drawn on the main thread now, not by the
    // engine). All must parse before applying (a partial palette would mix
    // themed and default colors).
    function syncGuideColors(): void {
        // The guide's own fill token. Mirrored by the band's CSS background — the
        // fallback until a strip's content lands.
        const band = resolveColor("var(--udoc-canvas-guide-background)");
        // Every structural mark the band draws — ticks, separators, framing edges —
        // is the soft outline-variant `grid`.
        const text = resolveColor("var(--udoc-color-on-surface-variant)");
        // The selected row / column: the selected overlay, composited opaque over
        // the band, since the renderer paints solid colors.
        const highlight = resolveColor(
            "color-mix(in srgb, var(--udoc-color-primary) var(--udoc-state-selected-opacity), var(--udoc-canvas-guide-background))",
        );
        const grid = resolveColor("var(--udoc-color-outline-variant)");
        // The ruler's active span and a text frame's margins: two rungs either
        // side of the band's on the surface ladder, lighter and darker in both
        // themes.
        const range = resolveColor("var(--udoc-color-surface-container-highest)");
        const margin = resolveColor("var(--udoc-color-surface)");
        if (band && text && highlight && grid && range && margin) {
            canvas.setGuideColors({ band, text, highlight, grid, range, margin });
        }
    }
    let systemDarkQuery: MediaQueryList | null = null;
    let systemDarkHandler: ((e: MediaQueryListEvent) => void) | null = null;
    function setupSystemListener(): void {
        systemDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");
        systemDarkHandler = (e) => applyThemeClass(e.matches);
        systemDarkQuery.addEventListener("change", systemDarkHandler);
    }
    function cleanupSystemListener(): void {
        if (systemDarkQuery && systemDarkHandler) {
            systemDarkQuery.removeEventListener("change", systemDarkHandler);
            systemDarkQuery = null;
            systemDarkHandler = null;
        }
    }
    applyThemeClass(resolveIsDark(store.getState().theme));
    if (store.getState().theme === "system") setupSystemListener();

    // --- react to UI state changes (panel-open class, theme) -------------
    const unsubChrome = store.subscribeRender((prev, next) => {
        if ((prev.activePanel === null) !== (next.activePanel === null)) {
            layout.classList.toggle("udoc-panel-open", next.activePanel !== null);
        }
        if (prev.theme !== next.theme) {
            if (prev.theme === "system") cleanupSystemListener();
            if (next.theme === "system") setupSystemListener();
            applyThemeClass(resolveIsDark(next.theme));
        }
        if (prev.textSelectionDisabled !== next.textSelectionDisabled) {
            layout.classList.toggle("udoc-ui--no-text-select", next.textSelectionDisabled);
        }
        if (next.panelTransitionsDisabled && !prev.panelTransitionsDisabled) {
            requestAnimationFrame(() => store.dispatch({ type: "ENABLE_PANEL_TRANSITIONS" }));
        }
    });

    // --- keyboard shortcuts (scoped to the root) -------------------------
    // A real text field (the search box, a numeric toolbar field), where a key
    // edits that field's own text rather than the document. Our hidden
    // clipboard/keyboard sink is NOT such a field: in object mode it lets keys
    // bubble here, and in text mode it handles them itself and stops
    // propagation, so we never see them.
    const isTypingTarget = (e: KeyboardEvent): boolean => {
        const target = e.target as HTMLElement | null;
        return (
            target != null &&
            !target.classList.contains("udoc-ui__text-input") &&
            (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable === true)
        );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        // Held: the UI is waiting on something and refusing input. The hold
        // marks every child of `layout` inert, but this listener is on `layout`
        // itself, so a key pressed in the hold's own dialog still arrives here —
        // the one way in that inert doesn't close. Escape is the hold's (it
        // cancels), which is why this returns before the Escape branch below.
        if (busyModal.held()) return;
        if ((e.ctrlKey || e.metaKey) && e.key === "f") {
            e.preventDefault();
            if (store.getState().activePanel !== "search") store.dispatch({ type: "TOGGLE_PANEL", panel: "search" });
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+") && !e.shiftKey) {
            e.preventDefault();
            store.dispatch({ type: "ZOOM_IN" });
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "-" && !e.shiftKey) {
            e.preventDefault();
            store.dispatch({ type: "ZOOM_OUT" });
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "0" && !e.shiftKey) {
            e.preventDefault();
            store.dispatch({ type: "SET_ZOOM", zoom: 1 });
        }
        // Undo / redo. Shift+Z and Ctrl+Y are both redo (mac and Windows
        // conventions). Over a real text field we stand aside and let the
        // browser undo that field's own text; everywhere else we take the key
        // even when the stack is empty, so it can't fall through to the native
        // textarea undo on our hidden sink (which would edit the scratch value).
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !isTypingTarget(e)) {
            e.preventDefault();
            requestHistory(e.shiftKey ? "redo" : "undo");
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y" && !e.shiftKey && !isTypingTarget(e)) {
            e.preventDefault();
            requestHistory("redo");
        }
        // The extension's own keys — one it takes, preventing its default, is
        // its alone.
        extension?.keydown(e);
        if (e.defaultPrevented) return;
        // Delete / Backspace removes the selected objects — but only in edit
        // mode, bar annotations, which edit in view mode too where their
        // capabilities allow (a session not entitled to annotate has none),
        // and never while typing in a real field, where the key edits text.
        // (Copy/cut/paste ride native clipboard events on the hidden sink, not
        // a shortcut here.)
        if (e.key === "Delete" || e.key === "Backspace") {
            const state = store.getState();
            const deletes = annotationsSelected()
                ? allowsEdit(state.selectionCaps, "deleteAnnotations")
                : state.mode !== VIEW_MODE;
            if (!isTypingTarget(e) && deletes) {
                e.preventDefault();
                void deleteSelection();
            }
        }
        if (e.key === "Escape") {
            const state = store.getState();
            if (state.pointerMode.kind !== "select") {
                e.preventDefault();
                store.dispatch({ type: "SET_POINTER_MODE", pointer: { kind: "select" } });
            } else if (state.activePanel !== null) {
                e.preventDefault();
                store.dispatch({ type: "CLOSE_PANEL" });
            }
        }
        if (e.key === "F6") {
            e.preventDefault();
            const regions = [toolbarSlot, leftPanelSlot, viewportSlot, rightPanelSlot].filter(
                (r) => r.offsetParent !== null,
            );
            if (regions.length === 0) return;
            const currentIndex = regions.findIndex((r) => r.contains(document.activeElement));
            const direction = e.shiftKey ? -1 : 1;
            const next = regions[(currentIndex + direction + regions.length) % regions.length]!;
            const focusable = next.querySelector<HTMLElement>(
                'button:not([disabled]), input:not([disabled]), [tabindex="0"]',
            );
            (focusable ?? next).focus();
        }
    };
    layout.addEventListener("keydown", handleKeyDown);

    const handleOverlayClick = () => store.dispatch({ type: "CLOSE_PANEL" });
    panelOverlay.addEventListener("click", handleOverlayClick);

    // --- background work -------------------------------------------------
    //
    // Pages compose lazily, so an open, an edit or a sheet switch only lays out
    // the visible window. The worker composes the rest ahead on its own, as it
    // renders the thumbnails and loads a workbook's other sheets: in the
    // background, whenever the reader leaves it a quiet moment. The shell tells
    // it when the reader touches the shell — captured at the root, so a handler
    // that stops propagation can't hide an input from it — and adopts the
    // layout compose-ahead grows, the page count and content extent (and the
    // scrollbar).
    const noteInput = (): void => client.noteActivity();
    for (const type of ACTIVITY_INPUTS) layout.addEventListener(type, noteInput, { capture: true, passive: true });
    const unsubComposed = client.onComposed((grown) => {
        // A step the worker took before the document closed, or before another
        // one opened, lands on none.
        if (store.getState().status !== "ready") return;
        store.dispatch({
            type: "DOC_RELAYOUT",
            pageCount: grown.pageCount ?? null,
            firstUncomposedPage: grown.firstUncomposedPage,
            scrollSize: grown.scrollSize,
        });
    });

    /** Bumped by every {@link openSource}, so a read an open has been replaced by stops reporting. */
    let sourceGeneration = 0;

    function openSource(
        source: OpenSource,
        { format, filename, delimiter, password }: OpenSourceOptions = {},
    ): Promise<void> {
        const generation = ++sourceGeneration;
        const name = filename ?? sourceName(source);
        return openDocument(
            async () => {
                const bytes = await readSource(source, (loaded, total) => {
                    if (generation !== sourceGeneration) return;
                    store.dispatch({ type: "SET_LOAD_PROGRESS", progress: { loaded, total } });
                });
                // The engine has it from here: the overlay's bar runs on.
                if (generation === sourceGeneration) store.dispatch({ type: "SET_LOAD_PROGRESS", progress: null });
                const layout = await client.open(bytes, format ?? signaturelessFormat(name), delimiter);
                // The host's password first, unasked: the dialog asks only
                // when it doesn't open the document.
                return layout.needsPassword && password !== undefined ? client.authenticate(password) : layout;
            },
            { filename: name },
        );
    }

    /** The package resource the open document was opened from with `openRemote`, absolute; `undefined` for any other. */
    let remotePackage: string | undefined;
    /** The name of the file the open document was opened from, as `openSource` was given it or found it; `undefined` for none. */
    let sourceFilename: string | undefined;

    function openRemote(url: string): Promise<void> {
        return openDocument(() => client.openRemote(url), { packageUrl: new URL(url, location.href).href });
    }

    function openLocal(id: string): Promise<void> {
        return openDocument(async () => {
            const { package: bytes, log, opaqueParts } = await localCollaborationService(id).document();
            const opened = await client.open(bytes);
            // The content of every opaque part the log names — an inserted
            // picture's image — is held first: nothing but the service has it.
            if (opaqueParts.byteLength > 0) await client.mergeOpaqueParts(opaqueParts);
            // Every edit the service holds was made over the package just
            // opened, so its log is merged, as a collaborator's edits are. The
            // doc type and source format ride only the open's reply.
            return { ...opened, ...(await client.merge(log)) };
        });
    }

    /**
     * Open a document with `open`, and bring the UI up on it — from
     * `from.packageUrl`, a server's package resource, when it is opened
     * remotely, and named `from.filename` when its file's name is known.
     */
    async function openDocument(
        open: () => Promise<DocumentLayout>,
        from: { packageUrl?: string | undefined; filename?: string | undefined } = {},
    ): Promise<void> {
        void leaveCollaboration(); // it was the previous document's
        passwordModal.dismiss(); // so was a password it asked for
        remotePackage = undefined; // and so was the server it came from
        sourceFilename = undefined; // and its file's name
        formWidgets = new Map(); // and so was its form
        formAlternateNames = new Map();
        filling = null;
        canvas.setOverlay("udoc:form-field", formFieldSource, { aboveSelection: true });
        resetMedia(); // and the media it played
        store.dispatch({ type: "OPEN_START" });
        try {
            // The session first, before any bytes are read: a refusal comes
            // before a download, and the loading overlay knows whether the
            // license lets it hide.
            await client.start();
            const layout = await unlock(await open());
            // Another document was opened, or this one closed, while it asked.
            if (!layout) return;
            store.dispatch({
                type: "OPEN_SUCCESS",
                pageCount: layout.pageCount ?? null,
                firstUncomposedPage: layout.firstUncomposedPage,
                scrollSize: layout.scrollSize,
                features: client.entitlements?.features ?? [],
                ...(layout.docType !== undefined ? { docType: layout.docType } : {}),
                ...(layout.sourceFormat !== undefined ? { sourceFormat: layout.sourceFormat } : {}),
            });
            remotePackage = from.packageUrl;
            sourceFilename = from.filename;
            // Pull the plane roster (the sheet tabs) — the session has
            // reconciled by the time `open` resolved, so the count is settled.
            // Asked before the first paint, which the worker answers it ahead
            // of; awaited last, so the document opens with its sheets known.
            const planesRead = client.planeInfo().then((planes) => {
                store.dispatch({
                    type: "SET_PLANES",
                    count: planes.count,
                    current: planes.current,
                    names: planes.names,
                    colors: planes.colors,
                    chartsheets: planes.chartsheets,
                    visibility: planes.visibility,
                    kinds: planes.kinds,
                });
            });
            // A PDF that asks to open with its outline showing opens the outline
            // tab — async, off the critical path.
            if (layout.docType === "portable") void openOutlineIfAsked();
            // Which widgets a press fills a form field in through — async, off
            // the critical path.
            if (layout.docType === "portable") void refreshFormWidgets();
            // A document opens with no slide left by a link jump.
            slideLeftByLink = null;
            // Adopt the fit the document opened with — the host's, else the doc
            // type's default. The worker already applied it at open (for the
            // first paint), so don't re-send it here (`reframe: false`) —
            // re-sending re-centers on whatever `current_page` the engine has
            // derived, which in a narrow pane is the *second* page (nearest the
            // tall viewport's center at scroll 0), pushing a fresh document off
            // the top. Just record the fit so the zoom UI matches.
            const fit = store.getState().defaultFit ?? defaultFitForDocType(layout.docType);
            store.dispatch({ type: "SET_FIT", fit, reframe: false });
            // Now that the doc type is known, apply the chrome
            // for it explicitly. The worker deliberately doesn't paint the
            // opening frame, so this `setSpacing` is what drives the first paint
            // — at the doc-type-correct padding, with no read→edit flash. Called
            // directly (not just via the docType subscription) so a reopen of
            // the same doc type still triggers it.
            //
            // Reserve the guide bands (a spreadsheet's headers, a paged doc's
            // ruler) for the doc type *first*, so the inset viewport reaches the
            // worker before the paint below — otherwise the opening frame paints
            // full-size and reflows a beat later when the bands land (a flash).
            canvas.reserveGuides();
            applySpacing();
            await planesRead;
        } catch (err) {
            passwordModal.dismiss();
            const error = UDocError.from(err);
            // A refusal to start a session draws the notice, by its code; every
            // other failure is an ordinary one and gets the message alone.
            store.dispatch({
                type: "OPEN_FAILURE",
                error: error.message,
                ...(isRefusal(error.code) ? { refusal: error.code } : {}),
            });
            throw error;
        }
    }

    /**
     * The layout of the document just opened once it can be read: `layout`
     * itself when it needs no password, else the one it opens with when the
     * reader gives a password the engine takes — asked for again as often as
     * one is refused. Null when another document is opened, or this one
     * closed, while it asks; the dialog is theirs then.
     */
    async function unlock(layout: DocumentLayout): Promise<DocumentLayout | null> {
        for (let refused = false; layout.needsPassword; refused = true) {
            const password = await passwordModal.ask(refused);
            if (password === null) return null;
            layout = await client.authenticate(password);
        }
        passwordModal.dismiss();
        return layout;
    }

    /**
     * Open the outline tab when the document asks to be shown with its outline
     * (`/PageMode /UseOutlines`) — unless the tab is disabled, already open, or
     * another document was opened meanwhile.
     */
    async function openOutlineIfAsked(): Promise<void> {
        const generation = store.getState().docGeneration;
        const mode = await client.portable.pageMode();
        const state = store.getState();
        if (mode !== "useOutlines" || state.docGeneration !== generation) return;
        if (state.activePanel === "outline" || state.disabledPanels.has("outline")) return;
        store.dispatch({ type: "TOGGLE_PANEL", panel: "outline" });
    }

    const editListeners = new Set<() => void>();
    function onEdit(listener: () => void): () => void {
        editListeners.add(listener);
        return () => editListeners.delete(listener);
    }

    // Local selection changes, surfaced for presence sync. The worker flags
    // which selection reports were caused by a local mutation (click-select /
    // clear) — presence merges and edits report false, so a listener that
    // ships presence to a peer can't ping-pong.
    const selectionEditListeners = new Set<() => void>();
    function onSelectionEdit(listener: () => void): () => void {
        selectionEditListeners.add(listener);
        return () => selectionEditListeners.delete(listener);
    }
    const unsubSelectionEdit = client.onSelection((state) => {
        annotationBoxes = state.local.annotations;
        // Push the engine's capability verdict for the new selection, driving the
        // selection-gated controls (Delete, Arrange). Every report counts — an
        // edit echo (localChanged:false) can change the selection or its z-order
        // (e.g. after a delete or reorder), so don't gate this.
        store.dispatch({ type: "SET_SELECTION_CAPABILITIES", capabilities: state.capabilities });
        // The whole pages it holds, for the thumbnails to tint — only when they
        // changed, so an object pick doesn't re-run the strip.
        const pages = state.local.pages ?? [];
        const before = store.getState().selectedPages;
        if (pages.length !== before.length || pages.some((page, i) => page !== before[i])) {
            store.dispatch({ type: "SET_SELECTED_PAGES", pages });
        }
        // The sections it holds, for the headers to tint and the section menu.
        const sections = state.slideSections;
        const sectionsBefore = store.getState().selectedSlideSections;
        if (sections.length !== sectionsBefore.length || sections.some((id, i) => id !== sectionsBefore[i])) {
            store.dispatch({ type: "SET_SELECTED_SLIDE_SECTIONS", ids: sections });
        }
        // Read back whether the selected slides are hidden, for Hide Slide's
        // check — every report, since an edit echo is how a hide arrives.
        refreshSelectedSlidesHidden(store.getState().docType === "presentation" ? pages : []);
        // Read back the annotations the selection holds, for the Annotate
        // tab's Format controls — every report, since an edit echo is how a
        // restyle's new values arrive. Only a PDF has annotations to read.
        if (store.getState().docType === "portable") refreshSelectedAnnotations();
        // A workbook's active cell, for the formula bar and the keys.
        const cell = state.properties && "spreadsheet" in state.properties ? state.properties.spreadsheet : null;
        if (state.cellEntries >= entryRequests) entryAsked = undefined;
        store.dispatch({
            type: "SET_ACTIVE_CELL",
            cell:
                cell?.reference != null && cell.input != null
                    ? { reference: cell.reference, input: cell.input, entry: cell.entry ?? null }
                    : null,
        });
        followCellBlock(state.local.cells[0]);
        if (!state.localChanged) return;
        for (const listener of selectionEditListeners) listener();
    });

    // The open deck's sections, read back after each change of the document and
    // each open — what the thumbnails group the slides under. The latest read
    // wins.
    let slideSectionsGeneration = 0;
    function refreshSlideSections(): void {
        const generation = ++slideSectionsGeneration;
        void client.presentation
            .slideSections()
            .then((sections) => {
                if (generation === slideSectionsGeneration) store.dispatch({ type: "SET_SLIDE_SECTIONS", sections });
            })
            .catch(() => {
                // Worker gone or document closed — the next open reads afresh.
            });
    }
    const unsubSlideSectionsEdited = client.onDocumentChanged(refreshSlideSections);
    const unsubSlideSectionsOpened = subscribeSelector(
        store,
        (s) => (s.status === "ready" ? s.docGeneration : -1),
        (generation) => {
            if (generation >= 0) refreshSlideSections();
        },
    );

    // The latest selected-slides read wins, as the annotations' does below.
    let slidesHiddenGeneration = 0;
    function refreshSelectedSlidesHidden(slides: readonly number[]): void {
        const generation = ++slidesHiddenGeneration;
        const set = (hidden: boolean) => {
            if (generation !== slidesHiddenGeneration) return;
            if (hidden !== store.getState().selectedSlidesHidden) {
                store.dispatch({ type: "SET_SELECTED_SLIDES_HIDDEN", hidden });
            }
        };
        if (slides.length === 0) {
            set(false);
            return;
        }
        void client.presentation
            .slidesShow(slides)
            .then((show) => set(show.every((shown) => !shown)))
            .catch(() => {
                // Worker gone or document closed — nothing is selected any more.
            });
    }

    // The latest selected-annotations read wins: a reply a newer selection report
    // has superseded is dropped, so a slow read can't show a stale style.
    let annotationsGeneration = 0;
    function refreshSelectedAnnotations(): void {
        const generation = ++annotationsGeneration;
        void client.portable
            .selectedAnnotations()
            .then((selected) => {
                if (generation !== annotationsGeneration) return;
                store.dispatch({ type: "SET_SELECTED_ANNOTATIONS", selected });
                // A note just placed opens its popup.
                const id = focusPlacedComment ? selectedComment(store.getState())?.annotation.id : undefined;
                if (id !== undefined) store.dispatch({ type: "SET_COMMENT_POPUP", id, open: true });
            })
            .catch(() => {
                // Worker gone or document closed — nothing is selected any more.
            });
    }

    // Undo/redo availability, pushed by the worker after every edit (and on
    // open/merge). Drives the history buttons' enablement.
    const unsubHistory = client.onHistory((state) => {
        store.dispatch({ type: "HISTORY_CHANGED", canUndo: state.canUndo, canRedo: state.canRedo });
    });

    // The remote peers present, pushed by the worker as presence changes. The
    // people button lists them.
    const unsubPeers = client.onPeers((peers) => store.dispatch({ type: "SET_PEERS", peers }));

    // A sheet's tab colour and whether it is a chartsheet, pushed by the worker
    // as it loads a workbook's sheets in the background after an open. Drives
    // the sheet tabs' fills, and the header bands a chartsheet goes without.
    const unsubPlaneLoaded = client.onPlaneLoaded((plane, color, chartsheet) => {
        store.dispatch({ type: "PLANE_LOADED", plane, color, chartsheet });
    });

    // A workbook's sheet tabs as an edit, an undo or a peer's left them, and
    // the sheet shown now — the engine's viewer keeps to its sheet through
    // them, or moves on from one deleted or hidden.
    const unsubPlanes = client.onPlanes((planes) => store.dispatch({ type: "SET_PLANES", ...planes }));

    // Run a committing edit: adopt the worker's new layout (which it composes
    // ahead from, on its own), and fire the local-edit cue (which a sync
    // transport turns into a snapshot push) — the shared ceremony behind every
    // edit verb. A no-op unless a document is ready. `merge` deliberately does
    // *not* go through here: a remote edit must not re-fire `onEdit` (it would
    // ping-pong between peers).
    async function commit(run: () => Promise<DocumentLayout>): Promise<void> {
        if (store.getState().status !== "ready") return;
        const layout = await run();
        store.dispatch({
            type: "DOC_RELAYOUT",
            pageCount: layout.pageCount ?? null,
            firstUncomposedPage: layout.firstUncomposedPage,
            scrollSize: layout.scrollSize,
        });
        for (const listener of editListeners) listener();
    }

    // Undo / redo — document-wide, doc-type-agnostic history on the client root.
    function history(op: HistoryOp): Promise<void> {
        return commit(() => (op === "undo" ? client.undo() : client.redo()));
    }

    // A history op asked for by a keyboard shortcut, which — unlike the toolbar
    // buttons — can't grey itself out to say "not now": drop it when the stack
    // it would pop is empty.
    function requestHistory(op: HistoryOp): void {
        const state = store.getState();
        // Typing into a cell isn't on the history: an undo drops it.
        if (typingCell()) {
            if (op === "undo") runCellKey({ kind: "cancel" });
            return;
        }
        if (!(op === "undo" ? state.canUndo : state.canRedo)) return;
        void history(op);
    }

    // Switch the active plane (a sheet-tab click, a deck's other view): tell
    // the worker, and adopt the layout it replies with — the new sheet's
    // extent the frame that paints it reports, and the worker composes ahead
    // on it from there. Not a document edit (no `onEdit` cue) — it's a view
    // change, like a page nav; the worker resets the camera to the new sheet's
    // top and repaints.
    async function switchPlane(plane: number): Promise<void> {
        const state = store.getState();
        if (state.status !== "ready") return;
        // What's typed into a cell is saved before another sheet shows, as in
        // Excel: the selection goes to the sheet shown, and the engine drops
        // an entry it leaves behind. Refused, the entry stays open, and the
        // sheet it's on stays shown.
        if (state.activeCell?.entry != null && paintedPlane >= 0 && plane !== paintedPlane) {
            if (!(await saveCellEntry(false, null))) {
                store.dispatch({ type: "SET_CURRENT_PLANE", plane: paintedPlane });
                return;
            }
        }
        const switched = client.goToPlane(plane);
        // A deck's views are each a page per slide: the one switched to opens
        // on the slide shown, where a sheet opens at its top.
        if (viewOfPlane(state.planeKinds, plane) !== null) client.goToPage(state.pageIndex);
        const layout = await switched;
        store.dispatch({
            type: "DOC_RELAYOUT",
            pageCount: layout.pageCount ?? null,
            firstUncomposedPage: layout.firstUncomposedPage,
            scrollSize: layout.scrollSize,
        });
    }

    // Each edit names what it acts on, as its command does: a drawing's shapes
    // (`translateShapes`) — in the doc types embedding the drawing families, a
    // slide's shapes, a docx drawing's or those drawn over an image — or a PDF's
    // page objects (`translateObjects`) or annotations (`translateAnnotations`).
    // The emitters below pick by the open doc type, then by what a PDF
    // selection holds.
    function shapeDocType(): boolean {
        return profileFor(store.getState().docType).drawingShapes;
    }

    function annotationsSelected(): boolean {
        return store.getState().selectedAnnotations !== null || annotationBoxes.length > 0;
    }

    // The canvas drag commits — translate / rotate-each / scale-each. They act on
    // the current selection, so they ride the agnostic `executeOnSelection` seam (the
    // worker resolves the live selection + open doc type to the right command).
    // Same edit path, so the change syncs.
    function translateSelection(dx: number, dy: number): Promise<void> {
        let edit: SelectionEdit;
        if (shapeDocType()) edit = { kind: "translateShapes", dx, dy };
        else if (annotationsSelected()) edit = { kind: "annotation", edit: { kind: "translateAnnotations", dx, dy } };
        else edit = { kind: "object", edit: { kind: "translateObjects", dx, dy } };
        return commit(() => client.executeOnSelection(edit));
    }

    function scaleSelectionEach(sx: number, sy: number, anchorX: number, anchorY: number): Promise<void> {
        let edit: SelectionEdit;
        if (shapeDocType()) edit = { kind: "scaleEachShape", sx, sy, anchorX, anchorY };
        else if (annotationsSelected())
            edit = { kind: "annotation", edit: { kind: "resizeAnnotations", sx, sy, anchorX, anchorY } };
        else edit = { kind: "object", edit: { kind: "scaleEachObject", sx, sy, anchorX, anchorY } };
        return commit(() => client.executeOnSelection(edit));
    }

    // A spreadsheet header-boundary drag (canvas → hook): resize column / row
    // `index` on the active sheet to `points` document points. Unlike the object
    // drags above (selection-relative `executeOnSelection`), a resize is addressed —
    // it names the sheet — so it resolves the active plane's sheet id (a plane is
    // a sheet, in tab order) and issues a `ResizeColumns` / `ResizeRows` through
    // the generic `execute` seam. Same committing-edit path (relayout,
    // compose-ahead, the `onEdit` sync cue). A no-op when the plane has no sheet
    // id (not a spreadsheet).
    async function resizeColumn(index: number, points: number): Promise<void> {
        const sheet = await client.spreadsheet.sheetIdByIndex(store.getState().currentPlane);
        if (sheet === undefined) return;
        await commit(() => client.execute(Command.resizeColumns(sheet, index, index, points)));
    }

    async function resizeRow(index: number, points: number): Promise<void> {
        const sheet = await client.spreadsheet.sheetIdByIndex(store.getState().currentPlane);
        if (sheet === undefined) return;
        await commit(() => client.execute(Command.resizeRows(sheet, index, index, points)));
    }

    // A workbook's sheet edits — the sheet tabs' and their menu's. Each names
    // its sheet by id, read off its plane, and commits as any edit does; the
    // tabs then follow from the worker's report of them.

    /** Insert a worksheet at `index` and show it. */
    async function insertSheet(index: number): Promise<void> {
        await commit(() => client.execute(Command.insertWorksheet(index)));
        store.dispatch({ type: "SET_CURRENT_PLANE", plane: index });
    }

    /** Run the sheet command `command` builds for the sheet on `plane`. */
    async function editSheet(plane: number, command: (id: string) => UDocCommand): Promise<void> {
        const id = await client.spreadsheet.sheetIdByIndex(plane);
        if (id !== undefined) await commit(() => client.execute(command(id)));
    }

    /** Name the sheet on `plane` `name`; resolves with why the engine refused
     *  it, or `null` once it is renamed. */
    async function renameSheet(plane: number, name: string): Promise<string | null> {
        try {
            await editSheet(plane, (id) => Command.renameSheet(id, name));
            return null;
        } catch (error) {
            return error instanceof Error ? error.message : String(error);
        }
    }

    /** Move the sheet on `plane` to stand before the sheet on `before`, or
     *  last with `null` — a drop beside it moving nothing. */
    async function moveSheet(plane: number, before: number | null): Promise<void> {
        const to = reorderTo([plane], before ?? store.getState().planeCount);
        if (to !== null) await editSheet(plane, (id) => Command.reorderSheets([id], to));
    }

    /** Colour the tab of the sheet on `plane` `color` (`#rrggbb`), or with
     *  `null` take its colour away. */
    async function colorSheetTab(plane: number, color: string | null): Promise<void> {
        const rgb =
            color === null ? null : { value: { rgb: 0xff000000 + Number.parseInt(color.slice(1), 16) }, tint: 0 };
        await editSheet(plane, (id) => Command.setSheetsTabColor([id], rgb));
    }

    /** Show the hidden sheet on `plane`, and go to it, as Excel's Unhide does. */
    async function unhideSheet(plane: number): Promise<void> {
        await editSheet(plane, (id) => Command.setSheetsState([id], "visible"));
        store.dispatch({ type: "SET_CURRENT_PLANE", plane });
    }

    // Execute an arbitrary UDocCommand — the generic write seam a host drives
    // with commands it builds. Same committing-edit path, so any selection change
    // rides back.
    function execute(command: UDocCommand): Promise<void> {
        return commit(() => client.execute(command));
    }

    // Insert a drawn annotation: build it (the canvas mapped the gesture into
    // page-local points) and issue an `InsertAnnotations` command on the page's
    // id. The engine mints its id, generates its
    // appearance and selects it. Its author is the name the host gave
    // {@link setUserInfo} — the one peers see on this one's selection. A
    // stamp is the one the Stamp dropdown last picked; a text box's text is set
    // in {@link textBoxFont}.
    async function insertAnnotation(tool: AnnotationTool, page: number, points: ShapePoint[]): Promise<void> {
        const state = store.getState();
        const style = annotationStyle(tool, state.annotationStyles);
        const font = tool === "textBox" ? await textBoxFont() : null;
        const annotation = annotationFor(tool, points, style, userName, new Date(), state.stamp, font);
        if (!annotation) return;
        const pageId = await pageIdByIndex(page);
        if (pageId === undefined) return;
        // The insert selects the note, whose popup then opens editing.
        focusPlacedComment = tool === "note";
        try {
            await commit(() => client.execute(Command.insertAnnotations(pageId, [annotation])));
        } catch (error) {
            focusPlacedComment = false;
            throw error;
        }
    }

    // The font list's id for the font a text box's text is set in: the one the
    // document holds — the standard font, not embedded — or, when it holds
    // none, one added under an id minted here, an undo step of its own. Null
    // with no document ready.
    async function textBoxFont(): Promise<string | null> {
        if (store.getState().status !== "ready") return null;
        const { fonts } = await client.portable.fontInfoList();
        const held = fonts.find((font) => font.standard === TEXT_BOX_FONT);
        if (held) return held.id;
        const id = await mintId();
        if (id === null) return null;
        await commit(() => client.execute(Command.addStandardFont(id, TEXT_BOX_FONT)));
        return id;
    }

    // Save `richContents` as the text of a comment in a thread — the popup's or
    // the comments panel's — its `/RC` and `/Contents` at once; the engine
    // generates its appearance afresh where that shows the text, a free text's.
    function saveComment(comment: Comment, richContents: string): Promise<void> {
        const id = comment.annotation.id;
        if (id === undefined) return Promise.resolve();
        const modified = pdfDate(new Date());
        return commit(() =>
            client.execute(Command.setAnnotationRichContents(comment.page, id, richContents, modified)),
        );
    }

    // Answer `comment` with a reply holding `richContents`, by this user. The
    // insert selects the reply, which isn't on the page; what was selected is
    // selected again, sent straight behind the insert so the selection reads
    // its report prompts already see it — the thread stays open where it was.
    function replyToComment(comment: Comment, richContents: string): Promise<void> {
        const reply = replyTo(comment.annotation, richContents, userName, new Date());
        if (!reply) return Promise.resolve();
        const selected = store.getState().selectedAnnotations;
        const done = commit(() => client.execute(Command.insertAnnotations(comment.page, [reply])));
        const ids = selected?.annotations.flatMap((a) => (a.id === undefined ? [] : [a.id])) ?? [];
        if (selected && ids.length > 0) setSelection({ portable: { annotations: { page: selected.page, ids } } });
        else clearSelection();
        return done;
    }

    // Delete `comment`, which no reply answers — the thread offers only those.
    function deleteComment(comment: Comment): Promise<void> {
        const id = comment.annotation.id;
        if (id === undefined) return Promise.resolve();
        return commit(() => client.execute(Command.deleteAnnotations(comment.page, [id])));
    }

    // Fill in the form field whose widget is `widget` on page `page`, a press
    // landed on: read the field as the form holds it now, then toggle a check
    // box or radio button straight away, or open the control the field is
    // filled in with over the widget.
    // Whether players stand over the elements that play media: over a
    // presentation, in view mode.
    function mediaPlayersShow(): boolean {
        const state = store.getState();
        return state.status === "ready" && state.docType === "presentation" && state.mode === VIEW_MODE;
    }

    // Ask for the media of each page on screen not asked for since the document
    // last changed; a reply from before a later change is dropped.
    function askPageMedia(): void {
        if (!mediaPlayersShow()) return;
        for (const { index } of mediaViews) {
            if (pageMediaAsked.get(index) === pageMediaGeneration) continue;
            const generation = pageMediaGeneration;
            pageMediaAsked.set(index, generation);
            void client.presentation.pageMedia(index).then((media) => {
                if (generation !== pageMediaGeneration) return;
                pageMedia.set(index, media);
                canvas.setOverlay("udoc:media", mediaSource, { aboveSelection: true });
            });
        }
    }

    // The object URL of the media file `data`, read the first time a player
    // asks for it — null when it doesn't load, or the document closed while
    // it was read.
    function mediaFile(data: string): Promise<string | null> {
        const asked = mediaFiles.get(data);
        if (asked) return asked;
        const files = mediaFiles;
        const file = client.presentation.mediaData(data).then((read) => {
            if (!read || files !== mediaFiles) return null;
            return URL.createObjectURL(new Blob([read.bytes], { type: read.contentType }));
        });
        files.set(data, file);
        return file;
    }

    // Forget the closed document's media: the players go, and the files with
    // them.
    function resetMedia(): void {
        for (const file of mediaFiles.values()) {
            void file.then((url) => {
                if (url) URL.revokeObjectURL(url);
            });
        }
        mediaFiles = new Map();
        pageMedia = new Map();
        pageMediaAsked = new Map();
        pageMediaGeneration += 1;
        canvas.setOverlay("udoc:media", mediaSource, { aboveSelection: true });
    }

    async function fillFormField(page: string, widget: string): Promise<void> {
        const form = await client.portable.formWidget(page, widget);
        if (!form || store.getState().status !== "ready") return;
        if (fillKind(form.field) === "toggle") {
            const fill = form.on === null ? null : toggled(form.field, form.on);
            if (fill) await commit(() => client.execute(Command.fillAcroFormFields([fill])));
            return;
        }
        filling = { widget, form };
        canvas.setOverlay("udoc:form-field", formFieldSource, { aboveSelection: true });
    }

    // Whether `destroy` has run: the worker it tears down rejects whatever was
    // still asked of it, which is no failure to report.
    let destroyed = false;

    // Follow a clicked link, or run a widget's action: a destination in the
    // document lands the view, a URL opens (`openUrl`), a named action moves a
    // page, and a hide action hides or shows its annotations.
    function followLink(target: Pick<LinkAnnotation, "action" | "destination">): void {
        follow(client, store, target, openUrl).catch((err: unknown) => {
            // A worker torn down under the call took the viewer with it.
            if (!destroyed) console.error("following a link failed:", err);
        });
    }

    // The slide the last link jump left — where a jump to the last slide
    // viewed goes back to.
    let slideLeftByLink: number | null = null;

    // Follow a text run's link clicked on page `page`: a URL opens (`openUrl`),
    // a bookmark lands the view on its start, and a slide jump or a move within
    // the show goes to its slide — the next and the previous counted from
    // `page`, the last viewed being the one the last link jump left.
    function followTextLink(link: TextHyperlink, page: number): void {
        if (!textLinkFollows(link)) return;
        const url = textLinkUrl(link);
        if (url !== null) {
            openUrl(url);
            return;
        }
        const { target, action } = link;
        const jump = typeof action === "object" && action !== null && "showJump" in action ? action.showJump : null;
        if (jump === null) {
            if (target == null || "url" in target) return;
            if ("anchor" in target) {
                client.wordprocessing.goToBookmark(target.anchor, store.getState().navigationScrollAlignment);
            } else goToSlide(target.slide.slideIndex, page);
            return;
        }
        const last = store.getState().pageCount - 1;
        const index =
            jump === "firstSlide"
                ? 0
                : jump === "lastSlide"
                  ? last
                  : jump === "nextSlide"
                    ? page + 1
                    : jump === "previousSlide"
                      ? page - 1
                      : jump === "lastSlideViewed"
                        ? slideLeftByLink
                        : typeof jump === "object"
                          ? jump.slide.slideIndex
                          : null;
        if (index !== null && index >= 0 && index <= last && index !== page) goToSlide(index, page);
    }

    // Go to slide `index` from slide `from`, remembering `from` as the slide
    // the jump left.
    function goToSlide(index: number, from: number): void {
        slideLeftByLink = from;
        store.dispatch({ type: "NAVIGATE_TO_PAGE", pageIndex: index });
    }

    // Open the URL a clicked link or outline item names: through the host's
    // `onLinkClick` when it gave one, else in a new browser tab.
    function openUrl(url: string): void {
        if (shellOptions.onLinkClick) shellOptions.onLinkClick(url);
        else window.open(url, "_blank", "noopener");
    }

    // Read the open PDF's form for its widgets, how a press fills a field in
    // through each, and the alternate name a hover over each shows.
    async function refreshFormWidgets(): Promise<void> {
        const form = await client.portable.acroForm();
        formWidgets = widgetFills(form);
        formAlternateNames = widgetAlternateNames(form);
    }

    // Go to a comment chosen in the comments panel — its rect at the viewport's
    // top-left, as a PDF destination lands — and select it.
    function chooseComment(comment: Comment): void {
        const id = comment.annotation.id;
        if (id === undefined || store.getState().status !== "ready") return;
        client.goToRect(comment.index, comment.annotation.rect, store.getState().navigationScrollAlignment);
        setSelection({ portable: { annotations: { page: comment.page, ids: [id] } } });
    }

    // A search runs batch by batch: each request asks the engine for the batch
    // after the last one's continuation, so no batch searches again what one
    // before it did, and the worker answers other requests between batches.
    // The run is the shell's; the engine and the worker keep nothing. A newer
    // search or a clear retires a run, and an edit, an open or fonts landing —
    // each can move text — run the search in force again.
    let searchGeneration = 0;
    async function runSearch(): Promise<readonly SearchMatch[]> {
        const run = ++searchGeneration;
        const state = store.getState();
        const query = state.searchQuery;
        if (state.status !== "ready" || query === "") {
            store.dispatch({ type: "SEARCH_DONE" });
            return [];
        }
        const options = { caseSensitive: state.searchCaseSensitive, fuzzy: state.searchFuzzy };
        let from: SearchContinuation | null = null;
        try {
            for (;;) {
                const { batch, layout } = await client.search(query, options, state.searchScope, from);
                if (run !== searchGeneration) return [];
                // A search lays out the pages its matches are drawn on.
                const { pageCount, firstUncomposedPage, scrollSize } = store.getState();
                if (
                    (layout.pageCount ?? layout.firstUncomposedPage) !== pageCount ||
                    layout.firstUncomposedPage !== firstUncomposedPage ||
                    layout.scrollSize.width !== scrollSize.width ||
                    layout.scrollSize.height !== scrollSize.height
                ) {
                    store.dispatch({
                        type: "DOC_RELAYOUT",
                        pageCount: layout.pageCount ?? null,
                        firstUncomposedPage: layout.firstUncomposedPage,
                        scrollSize: layout.scrollSize,
                    });
                }
                store.dispatch({ type: "SEARCH_BATCH", matches: batch.matches, first: from === null });
                if (batch.next === null) break;
                from = batch.next;
            }
        } catch {
            // Worker gone or document closed: the matches found so far stand.
            if (run !== searchGeneration) return [];
        }
        store.dispatch({ type: "SEARCH_DONE" });
        return store.getState().searchMatches;
    }

    function search(
        query: string,
        options: SearchOptions & { scope?: UDocSearchScope } = {},
    ): Promise<readonly SearchMatch[]> {
        store.dispatch({
            type: "SET_SEARCH",
            query,
            caseSensitive: options.caseSensitive ?? false,
            fuzzy: options.fuzzy ?? false,
            scope: options.scope ?? null,
        });
        return runSearch();
    }

    function clearSearch(): void {
        ++searchGeneration;
        store.dispatch({ type: "CLEAR_SEARCH" });
    }

    // Run the search in force again, once a frame however many changes land.
    let searchRerun: number | null = null;
    function rerunSearch(): void {
        if (store.getState().searchQuery === "" || searchRerun !== null) return;
        searchRerun = requestAnimationFrame(() => {
            searchRerun = null;
            void runSearch();
        });
    }
    const unsubSearchEdited = client.onDocumentChanged(rerunSearch);
    const unsubSearchFonts = client.onFontsRefreshed(rerunSearch);
    const unsubSearchOpened = subscribeSelector(
        store,
        (s) => (s.status === "ready" ? s.docGeneration : -1),
        (generation) => {
            if (generation >= 0) rerunSearch();
        },
    );

    // Each time a match is made current, go to it: its first quad at the
    // viewport's top-left, as a chosen comment lands — on its own sheet, which
    // is shown first.
    const unsubSearchNav = subscribeSelector(
        store,
        (s) => s.searchNavGen,
        () => {
            const state = store.getState();
            const match = state.searchMatches[state.searchActiveIndex];
            const quad = match?.quads[0];
            if (!match || !quad) return;
            const rect = quadBounds(quad);
            const alignment = state.searchNavAlignment ?? state.searchScrollAlignment;
            if (match.plane === state.currentPlane) {
                client.goToRect(quad.page, rect, alignment);
                return;
            }
            // The sheet switch posts its request as the store notifies, in the
            // microtask the dispatch queues; the landing queues behind it.
            store.dispatch({ type: "SET_CURRENT_PLANE", plane: match.plane });
            queueMicrotask(() => client.goToRect(quad.page, rect, alignment));
        },
    );

    // The comments the threads are built from: the selected annotation's page
    // for its popup, and every page while the comments panel is open — read
    // again whenever the document changes, and otherwise only when what is
    // shown needs a page not read yet. The latest read wins, and changes in one
    // frame are read once.
    let commentsGeneration = 0;
    let commentsPending: number | null = null;
    function refreshComments(changed: boolean): void {
        const shown = (state: UIState) => ({
            everyPage: state.activePanel === "comments",
            page: state.selectedAnnotations?.page,
        });
        const state = store.getState();
        if (state.status !== "ready" || state.docType !== "portable") return;
        const { everyPage, page } = shown(state);
        const missing = everyPage ? !state.allCommentsRead : page !== undefined && !state.comments.has(page);
        if (!changed && !missing) return;
        if (commentsPending !== null) cancelAnimationFrame(commentsPending);
        commentsPending = requestAnimationFrame(() => {
            commentsPending = null;
            const generation = ++commentsGeneration;
            const reading = shown(store.getState());
            void (async () => {
                const pages = reading.everyPage ? await pageIds() : reading.page !== undefined ? [reading.page] : [];
                const read = pages.length > 0 ? await client.portable.pageComments(pages) : [];
                if (generation !== commentsGeneration) return;
                store.dispatch({
                    type: "SET_COMMENTS",
                    comments: new Map(read.map((comments) => [comments.page, comments])),
                    everyPage: reading.everyPage,
                });
            })().catch(() => {
                // Worker gone or document closed — nothing to show.
            });
        });
    }
    const unsubDocumentChanged = client.onDocumentChanged(() => refreshComments(true));
    const unsubCommentsShown = subscribeSelector(
        store,
        (s) => ({
            status: s.status,
            generation: s.docGeneration,
            panel: s.activePanel === "comments",
            page: s.selectedAnnotations?.page,
        }),
        () => refreshComments(false),
        { equality: shallowEqual },
    );

    // Mark the selected text with `tool`: read the selection's final geometry —
    // the read waits on the last select, as the streamed reports don't — and
    // insert one markup per page its text runs cross, over their quads. Whether
    // there was text to mark.
    async function markText(tool: MarkupTool): Promise<boolean> {
        if (store.getState().status !== "ready") return false;
        const geometry = await client.portable.selectionGeometry();
        if (geometry.text.length === 0) return false;
        const style = annotationStyle(tool, store.getState().annotationStyles);
        const now = new Date();
        const byPage = new Map<number, SelectionQuad[]>();
        for (const quad of geometry.text) byPage.set(quad.page, [...(byPage.get(quad.page) ?? []), quad]);
        for (const [page, quads] of byPage) {
            const pageId = await pageIdByIndex(page);
            const annotation = markupFor(tool, quads, style, userName, now);
            if (pageId === undefined || !annotation) continue;
            await commit(() => client.execute(Command.insertAnnotations(pageId, [annotation])));
        }
        return true;
    }

    // An Annotate-tab text markup's button: put the armed tool down; else mark
    // the text already selected; else arm the tool to mark the text the next
    // drag selects, after which it returns to select.
    async function markupCommand(tool: MarkupTool): Promise<void> {
        const pointer = store.getState().pointerMode;
        if (pointer.kind === "place" && pointer.tool.kind === "annotation" && pointer.tool.tool === tool) {
            store.dispatch({ type: "SET_POINTER_MODE", pointer: { kind: "select" } });
            return;
        }
        if (await markText(tool)) return;
        store.dispatch({ type: "ARM_PLACE", tool: { kind: "annotation", tool }, sticky: false });
    }

    // Mint a fresh CRDT-safe id for a new object — a pure read; the host stamps
    // it into the object it builds before inserting it.
    function mintId(): Promise<string | null> {
        if (store.getState().status !== "ready") return Promise.resolve(null);
        return client.mintId();
    }

    // The id of the page at `index` — a pure read; undefined past the last page
    // or with no document ready.
    function pageIdByIndex(index: number): Promise<string | undefined> {
        if (store.getState().status !== "ready") return Promise.resolve(undefined);
        return client.portable.pageIdByIndex(index);
    }

    // Every page's id, in page order — a pure read; empty with no document ready.
    function pageIds(): Promise<string[]> {
        if (store.getState().status !== "ready") return Promise.resolve([]);
        return client.portable.pageIds();
    }

    // The ids of the current selection — a pure read, the source of truth for
    // "what is selected" (vs a host-side cached copy that can drift).
    async function selectedObjectIds(): Promise<string[]> {
        if (store.getState().status !== "ready") return [];
        return client.portable.selectedObjectIds();
    }

    // Select objects by id — presence only, like a click-select: the worker
    // reports the new geometry with `localChanged: true`, so {@link onSelectionEdit}
    // fires and a sync transport broadcasts it as this peer's selection.
    function selectObjects(page: number, ids: string[]): void {
        if (store.getState().status !== "ready") return;
        client.portable.selectObjects(page, ids);
    }

    // Set the selection to a doc-type-tagged UDocSelection (presentation shapes,
    // etc.) — presence only, the agnostic twin of {@link selectObjects}; the
    // worker reports the new geometry with `localChanged: true`.
    function setSelection(selection: UDocSelection): void {
        if (store.getState().status !== "ready") return;
        client.setSelection(selection);
    }

    // The current selection as the tagged UDocSelection (or `null`) — a pure,
    // doc-type-agnostic read (portable objects, presentation shapes, …).
    async function selection(): Promise<UDocSelection | null> {
        if (store.getState().status !== "ready") return null;
        return client.selection();
    }

    // Clear the selection — presence only, the doc-type-agnostic root verb.
    function clearSelection(): void {
        if (store.getState().status !== "ready") return;
        client.clearSelection();
    }

    // Delete / reorder / group / ungroup the current selection (the ribbon's
    // Delete and Arrange commands). Like the canvas drags, these act on the live
    // selection, so they ride the agnostic `executeOnSelection` seam — a no-op
    // worker-side when the selection doesn't suit the edit, so safe to call
    // unconditionally.
    // A page edit from the thumbnails — their menu, a drop, Delete — then the
    // first page it leaves selected brought into view: the page that took a
    // deleted one's place, a new page, the copies, the pages moved.
    async function editPages(edit: SelectionEdit): Promise<void> {
        await commit(() => client.executeOnSelection(edit));
        const pages = store.getState().selectedPages;
        if (pages.length > 0) store.dispatch({ type: "NAVIGATE_TO_PAGE", pageIndex: Math.min(...pages) });
    }

    /** Rename section `id` to `name` — addressed by id, as the header being
     *  edited names it whatever is selected by the time it commits. */
    function renameSlideSection(id: string, name: string): Promise<void> {
        return commit(() => client.execute(Command.renameSlideSection(id, name)));
    }

    /** Start an untitled section at the selected slides, then edit its name in
     *  its header, as the engine leaves it selected. */
    async function addSlideSection(): Promise<void> {
        await editPages({ kind: "insertSlideSection", name: i18n.t("thumbnails.untitledSection") });
        const [id] = store.getState().selectedSlideSections;
        if (id !== undefined) store.dispatch({ type: "SET_RENAMING_SLIDE_SECTION", id });
    }

    function deleteSelection(): Promise<void> {
        let edit: SelectionEdit;
        const state = store.getState();
        // A section selection holds its slides' pages too: Delete removes the
        // sections, their slides joining the section before.
        if (state.selectedSlideSections.length > 0) {
            if (!allowsEdit(state.selectionCaps, "deleteSlideSections")) return Promise.resolve();
            return editPages({ kind: "deleteSlideSections" });
        }
        if (state.selectedPages.length > 0) {
            // The engine keeps a PDF's last page: with every page selected the
            // delete isn't offered, and Delete does nothing.
            if (!allowsEdit(state.selectionCaps, "deleteSlides", "deletePages")) return Promise.resolve();
            return editPages(
                state.docType === "presentation"
                    ? { kind: "deleteSlides" }
                    : { kind: "page", edit: { kind: "deletePages" } },
            );
        }
        if (shapeDocType()) edit = { kind: "deleteShapes" };
        else if (annotationsSelected()) edit = { kind: "annotation", edit: { kind: "deleteAnnotations" } };
        else edit = { kind: "object", edit: { kind: "deleteObjects" } };
        return commit(() => client.executeOnSelection(edit));
    }

    // Typing at the text caret — the hidden text input's keystrokes and IME
    // commits. The same agnostic executeOnSelection seam: the engine binds the live
    // text selection worker-side, so no offsets cross the boundary. A PDF's page
    // text has its own edits, carried in an `object` edit; a free text's is
    // drawing text, like a slide's, carried in a `common` edit inside an
    // `annotation` one.
    function insertSelectionText(text: string): Promise<void> {
        let edit: SelectionEdit;
        if (shapeDocType()) edit = { kind: "insertText", text };
        else if (annotationsSelected())
            edit = { kind: "annotation", edit: { kind: "common", edit: { kind: "insertText", text } } };
        else edit = { kind: "object", edit: { kind: "insertObjectText", text } };
        return commit(() => client.executeOnSelection(edit));
    }

    function deleteSelectionText(forward: boolean): Promise<void> {
        let edit: SelectionEdit;
        if (shapeDocType()) edit = { kind: "deleteText", forward };
        else if (annotationsSelected())
            edit = { kind: "annotation", edit: { kind: "common", edit: { kind: "deleteText", forward } } };
        else edit = { kind: "object", edit: { kind: "deleteObjectText", forward } };
        return commit(() => client.executeOnSelection(edit));
    }

    // The Annotate tab's Format controls: set the armed annotation tool's style,
    // or restyle the selected annotations — each read back after the last
    // selection report, changed where the control edits, and sent back in one
    // `UpdateAnnotations` without its appearance, which the engine generates
    // afresh. An annotation the change doesn't reach is left out.
    function restyleAnnotations(change: AnnotationStyleChange): Promise<void> {
        const state = store.getState();
        const target = formatTarget(state);
        if (target?.kind === "tool") {
            const style = restyle(annotationStyle(target.tool, state.annotationStyles), change);
            store.dispatch({ type: "SET_ANNOTATION_STYLE", tool: target.tool, style });
            return Promise.resolve();
        }
        if (target?.kind !== "selection") return Promise.resolve();
        const now = new Date();
        const updated = target.annotations.flatMap((annotation) => restyled(annotation, change, now) ?? []);
        if (updated.length === 0) return Promise.resolve();
        return commit(() => client.execute(Command.updateAnnotations(target.page, updated)));
    }

    async function snapshot(): Promise<Uint8Array> {
        return client.snapshot();
    }

    async function saveToBytes(format: FileFormat, strategy?: SaveStrategy): Promise<Uint8Array> {
        return client.saveToBytes(format, strategy);
    }

    async function saveToPackage(version?: number): Promise<Uint8Array> {
        return client.saveToPackage(version);
    }

    async function requestRemoteCopy(strategy?: SaveStrategy): Promise<Uint8Array> {
        const format = store.getState().sourceFormat;
        if (format === null)
            throw new Error("requestRemoteCopy: the open document records no source format to copy as");
        return remoteCopy(remotePackageOf("requestRemoteCopy"), format, strategy);
    }

    /**
     * The open document saved as `format`, its source format, by the engine's
     * strategy for it. Both saves read their bytes into an ArrayBuffer, never
     * a shared one.
     */
    async function savedCopy(format: FileFormat): Promise<Uint8Array<ArrayBuffer>> {
        // Only the server holds the original of a document opened from it.
        const bytes = remotePackage === undefined ? await client.saveToBytes(format) : await requestRemoteCopy();
        return bytes as Uint8Array<ArrayBuffer>;
    }

    const downloadListeners = new Set<(filename: string) => void>();
    function onDownload(listener: (filename: string) => void): () => void {
        downloadListeners.add(listener);
        return () => downloadListeners.delete(listener);
    }

    async function download(filename?: string): Promise<void> {
        const format = store.getState().sourceFormat;
        if (format === null) throw new Error("download: there is no open document with a source format to save as");
        // Named before the save, which another open could overtake.
        const name = filename ?? sourceFilename ?? `document.${format}`;
        // A viewer edits only a PDF — its annotations and form fields — so any
        // other document it holds the original of downloads as that file.
        const bytes =
            extension === null && format !== "pdf" && remotePackage === undefined
                ? ((await client.originalBytes()) as Uint8Array<ArrayBuffer>)
                : await savedCopy(format);
        const url = URL.createObjectURL(new Blob([bytes], { type: mediaType(format) }));
        const link = document.createElement("a");
        link.href = url;
        link.download = name;
        link.click();
        // Revoked once the click has started the download, not under it.
        setTimeout(() => URL.revokeObjectURL(url));
        for (const listener of downloadListeners) listener(name);
    }

    /** Compose every page left to compose, as compose-ahead would, without waiting for the reader to pause. */
    async function composeAll(): Promise<void> {
        let count = store.getState().firstUncomposedPage;
        for (;;) {
            const layout = await client.updateLayout(count + COMPOSE_BATCH - 1);
            store.dispatch({
                type: "DOC_RELAYOUT",
                pageCount: layout.pageCount ?? null,
                firstUncomposedPage: layout.firstUncomposedPage,
                scrollSize: layout.scrollSize,
            });
            // The pump's safety net: a page that fails to compose never reports
            // complete.
            const grew = layout.firstUncomposedPage > count;
            count = layout.firstUncomposedPage;
            if (layout.complete || !grew) return;
        }
    }

    /**
     * Compose through page index `page` where the document's page count isn't
     * known to reach it, and check there is one: what `method` needs of a page
     * first. Where the engine knows the count up front, the page composes when
     * `method` asks for it.
     */
    async function composeThrough(method: string, page: number): Promise<void> {
        let { pageCount } = store.getState();
        // Elsewhere a page is known only once composed: compose through it first.
        if (Number.isInteger(page) && page >= pageCount) {
            const layout = await client.updateLayout(page);
            store.dispatch({
                type: "DOC_RELAYOUT",
                pageCount: layout.pageCount ?? null,
                firstUncomposedPage: layout.firstUncomposedPage,
                scrollSize: layout.scrollSize,
            });
            pageCount = layout.pageCount ?? layout.firstUncomposedPage;
        }
        if (!Number.isInteger(page) || page < 0 || page >= pageCount) {
            throw new Error(`${method}: there is no page at index ${page}, of ${pageCount}`);
        }
    }

    async function renderPage(page: number, scale: number): Promise<ImageBitmap> {
        if (store.getState().status !== "ready") throw new Error("renderPage: there is no open document to render");
        if (!(scale > 0)) throw new Error(`renderPage: scale ${scale} is not a positive number`);
        await composeThrough("renderPage", page);
        return client.renderPagePreview(0, page, scale);
    }

    /**
     * Compose by `compose`, then wait for the fonts the composing put on order,
     * and compose again, until none is left — so an export draws the
     * document's own fonts, never the stand-in of one still on order. A landed
     * font lays the composed pages out again, which can move page breaks.
     */
    async function composeSettled(compose: () => Promise<void>): Promise<void> {
        do await compose();
        while (await client.settleFonts());
    }

    async function exportToBytes(format: ExportFormat): Promise<Uint8Array> {
        if (store.getState().status !== "ready") throw new Error("exportToBytes: there is no open document to export");
        // Every page goes in: compose them first, as a print does, so the
        // reader's page count is the one exported.
        await composeSettled(composeAll);
        return client.exportToBytes(format);
    }

    async function exportPageToBytes(page: number, format: PageExportFormat): Promise<Uint8Array> {
        if (store.getState().status !== "ready") {
            throw new Error("exportPageToBytes: there is no open document to export");
        }
        if (format !== "svg" && !(format.png.scale > 0)) {
            throw new Error(`exportPageToBytes: scale ${format.png.scale} is not a positive number`);
        }
        await composeSettled(() => composeThrough("exportPageToBytes", page));
        return client.exportPageToBytes(page, format);
    }

    const printListeners = new Set<(pageCount: number) => void>();
    function onPrint(listener: (pageCount: number) => void): () => void {
        printListeners.add(listener);
        return () => printListeners.delete(listener);
    }

    async function print(options?: PrintOptions): Promise<void> {
        if (store.getState().status !== "ready") throw new Error("print: there is no open document to print");
        // A page is known only once composed, so every page must be to count
        // them, or to print them all.
        if (!(await busyModal.hold(i18n.t("busy.preparingPrint"), composeAll()))) return;
        const { pageCount, pageIndex } = store.getState();
        if (pageCount === 0) throw new Error("print: the open document has no pages to print");
        if (options === undefined) {
            printModal.open({
                pageCount,
                currentPage: pageIndex,
                pageNoun: profileFor(store.getState().docType).pageNoun,
                onPrint: (chosen) =>
                    void printPages(chosen).catch((error: unknown) => console.error("udoc: printing failed", error)),
            });
            return;
        }
        await printPages(options);
    }

    /** Print the pages `options` names, every page composed. */
    async function printPages(options: PrintOptions): Promise<void> {
        const { pageCount, sourceFormat } = store.getState();
        const pages = options.pages ?? Array.from({ length: pageCount }, (_, i) => i);
        if (pages.length === 0) throw new Error("print: no pages to print");
        const missing = pages.find((page) => !Number.isInteger(page) || page < 0 || page >= pageCount);
        if (missing !== undefined) throw new Error(`print: there is no page at index ${missing}, of ${pageCount}`);
        const quality = options.quality ?? "standard";
        const title = sourceFilename?.replace(/\.[^.]+$/, "");
        // Every page of a PDF at standard quality prints as the PDF itself,
        // through the browser's own viewer — vectors, not a rendering — as the
        // viewer's print did.
        if (sourceFormat === "pdf" && options.pages === undefined && quality === "standard") {
            const saving = savedCopy("pdf");
            if (!(await busyModal.hold(i18n.t("busy.preparingPrint"), saving))) return;
            // A PDF that can't be saved — one opened from a package keeps no
            // original to save over — prints rendered instead.
            const bytes = await saving.catch(() => null);
            if (bytes !== null) {
                await printPdf(bytes, title);
                for (const listener of printListeners) listener(pages.length);
                return;
            }
        }
        await printRendered(pages, PRINT_DPI[quality], title);
    }

    /** Render `pages` (0-based indices) at `dpi`, one at a time under the busy hold, and print them. */
    async function printRendered(pages: readonly number[], dpi: number, title: string | undefined): Promise<void> {
        const printed: PrintPage[] = [];
        let cancelled = false;
        const preparing =
            profileFor(store.getState().docType).pageNoun === "Slide" ? "busy.preparingSlide" : "busy.preparingPage";
        const rendering = (async () => {
            for (const [i, page] of pages.entries()) {
                if (cancelled) return;
                busyModal.relabel(i18n.t(preparing, { page: i + 1, count: pages.length }));
                // Ephemeral annotations show, but don't print.
                printed.push(await printPageOf(await client.renderPagePreview(0, page, dpi / 72, false), dpi));
            }
        })();
        cancelled = !(await busyModal.hold(i18n.t(preparing, { page: 1, count: pages.length }), rendering));
        try {
            await rendering;
        } catch (error) {
            for (const page of printed) URL.revokeObjectURL(page.url);
            throw error;
        }
        if (cancelled) {
            for (const page of printed) URL.revokeObjectURL(page.url);
            return;
        }
        await printImages(printed, title);
        for (const listener of printListeners) listener(pages.length);
    }

    async function requestRemoteCheckpoint(): Promise<RemoteCheckpointResponse> {
        return remoteCheckpoint(remotePackageOf("requestRemoteCheckpoint"));
    }

    /** The package resource the open document was opened from, for `call`, which asks its server. */
    function remotePackageOf(call: string): string {
        if (remotePackage === undefined) throw new Error(`${call}: the open document wasn't opened from a server`);
        return remotePackage;
    }

    async function versionVector(): Promise<Uint8Array> {
        return client.versionVector();
    }

    async function patchSince(peer: Uint8Array): Promise<Uint8Array> {
        return client.patchSince(peer);
    }

    async function presence(): Promise<Uint8Array> {
        return client.presence();
    }

    async function mergePresence(data: Uint8Array): Promise<void> {
        if (store.getState().status !== "ready") return;
        // No layout refresh: presence changes no document state. The merged
        // peer selections ride back on the worker's selection report.
        await client.mergePresence(data);
    }

    async function refreshPresence(): Promise<void> {
        if (store.getState().status !== "ready") return;
        await client.refreshPresence();
    }

    async function withdrawPresence(): Promise<Uint8Array> {
        return client.withdrawPresence();
    }

    // This one's pointer, shared with the collaboration joined while the
    // store's `pointerSharing` says so. Each move is sent latest-wins: one
    // `setPointer` in flight, and the newest point (or a clear, `null`) queued
    // behind it, so a fast pointer never queues a backlog.
    let pointerSending = false;
    /** The point waiting to be sent, `null` for a clear, `undefined` for none. */
    let pointerQueued: { x: number; y: number } | null | undefined;
    const pointerListeners = new Set<(presence: Uint8Array) => void>();
    function onPointer(listener: (presence: Uint8Array) => void): () => void {
        pointerListeners.add(listener);
        return () => pointerListeners.delete(listener);
    }

    /** Share the pointer at canvas-local `at`, or clear it (`null`), while sharing. */
    function sharePointer(at: { x: number; y: number } | null): void {
        if (store.getState().pointerSharing) queuePointer(at);
    }

    /** Send the pointer at `at`, or its clear, while joined. */
    function queuePointer(at: { x: number; y: number } | null): void {
        if (collaboration === undefined || store.getState().status !== "ready") return;
        pointerQueued = at;
        if (!pointerSending) sendQueuedPointer();
    }

    function sendQueuedPointer(): void {
        if (pointerQueued === undefined) return;
        const at = pointerQueued;
        pointerQueued = undefined;
        pointerSending = true;
        void (at ? client.setPointer(at.x, at.y) : client.clearPointer())
            .then(
                (presence) => {
                    for (const listener of pointerListeners) listener(presence);
                },
                (err: unknown) => console.error("udoc: sharing the pointer failed", err),
            )
            .finally(() => {
                pointerSending = false;
                sendQueuedPointer();
            });
    }

    function setEnablePointerSharing(enabled: boolean): void {
        store.dispatch({ type: "SET_POINTER_SHARING", enabled });
    }

    function setShowPeerPointers(show: boolean): void {
        store.dispatch({ type: "SET_PEER_POINTERS_VISIBLE", visible: show });
    }

    // Sharing stopped — by the host or the people menu — clears the pointer
    // for the others.
    const unsubPointerSharing = subscribeSelector(
        store,
        (state) => state.pointerSharing,
        (sharing) => {
            if (!sharing) queuePointer(null);
        },
    );

    // The local user's display name, from {@link setUserInfo}: the author of
    // the annotations drawn here. Null until the host sets one.
    let userName: string | null = null;

    function setUserInfo(name: string): void {
        // Sticky in the worker, so it's fine before a document is open — it
        // applies to whatever opens next, and the host re-broadcasts presence.
        userName = name;
        client.setUserInfo(name);
        store.dispatch({ type: "SET_USER_NAME", name });
    }

    async function opaquePartsSince(peer: Uint8Array): Promise<Uint8Array> {
        return client.opaquePartsSince(peer);
    }

    async function mergeOpaqueParts(data: Uint8Array): Promise<void> {
        if (store.getState().status !== "ready") return;
        // Content, not an edit: a picture whose image just arrived repaints.
        const layout = await client.mergeOpaqueParts(data);
        store.dispatch({
            type: "DOC_RELAYOUT",
            pageCount: layout.pageCount ?? null,
            firstUncomposedPage: layout.firstUncomposedPage,
            scrollSize: layout.scrollSize,
        });
    }

    async function merge(data: Uint8Array): Promise<void> {
        if (store.getState().status !== "ready") return;
        const layout = await client.merge(data);
        store.dispatch({
            type: "DOC_RELAYOUT",
            pageCount: layout.pageCount ?? null,
            firstUncomposedPage: layout.firstUncomposedPage,
            scrollSize: layout.scrollSize,
        });
        // Note: deliberately no editListeners fire — a merge is a remote edit,
        // and re-broadcasting it would ping-pong between synced peers.
    }

    // The collaboration the open document is in, if any, as it was joined: the
    // channel to it, the name joined as, and the release of what joining held —
    // a local collaboration service, kept while this one is paused. It belongs
    // to that document: opening another, closing it, or destroying the UI
    // leaves it.
    let joinedTo: { openChannel: OpenChannel; name: string; release: () => void } | undefined;
    // The connection to it while joined; none while paused.
    let collaboration: Collaboration | undefined;
    const collaborationListeners = new Set<(event: CollaborationEvent) => void>();
    function onCollaboration(listener: (event: CollaborationEvent) => void): () => void {
        collaborationListeners.add(listener);
        return () => collaborationListeners.delete(listener);
    }

    function joinRemoteCollaboration(url: string, name: string): void {
        join(webSocketChannel(new URL(url, location.href)), name);
    }

    function joinLocalCollaboration(id: string, name: string): void {
        const service = localCollaborationService(id);
        join(
            (events) => service.openChannel(events),
            name,
            () => service.hold(),
        );
    }

    /**
     * Join the collaboration `openChannel` connects to, as `name`, leaving any
     * other first — holding what `hold` holds until this one leaves.
     */
    function join(openChannel: OpenChannel, name: string, hold?: () => () => void): void {
        if (store.getState().status !== "ready") throw new Error("joining a collaboration needs an open document");
        void leaveCollaboration();
        joinedTo = { openChannel, name, release: hold?.() ?? (() => {}) };
        connect(joinedTo);
    }

    /** Connect to the collaboration `to` — on joining it, and on resuming. */
    function connect(to: { openChannel: OpenChannel; name: string }): void {
        setUserInfo(to.name);
        const joined = joinCollaboration(
            {
                versionVector,
                patchSince,
                merge,
                opaquePartsSince,
                mergeOpaqueParts,
                presence,
                mergePresence,
                refreshPresence,
                withdrawPresence,
                onEdit,
                onSelectionEdit,
                onPointer,
            },
            to.openChannel,
            (event) => {
                // A leave sets its own status: `paused`, or `none`.
                if (collaboration === joined && event.type !== "left") {
                    if (event.type === "failed") {
                        collaboration = undefined;
                        joinedTo?.release();
                        joinedTo = undefined;
                    }
                    const status = event.type === "failed" ? "none" : event.type;
                    store.dispatch({ type: "SET_COLLABORATION", collaboration: status });
                }
                for (const listener of collaborationListeners) listener(event);
            },
        );
        collaboration = joined;
        store.dispatch({ type: "SET_COLLABORATION", collaboration: "joined" });
    }

    /** Pause co-editing: leave the collaboration, keeping how to join it again. */
    function pauseCollaboration(): void {
        const joined = collaboration;
        if (!joined) return;
        collaboration = undefined;
        void joined.leave();
        store.dispatch({ type: "SET_COLLABORATION", collaboration: "paused" });
    }

    /** Resume co-editing: join the collaboration paused out of again. */
    function resumeCollaboration(): void {
        if (collaboration || !joinedTo || store.getState().status !== "ready") return;
        connect(joinedTo);
    }

    /**
     * Leave the collaboration, joined or paused, releasing what joining held.
     * Returns the leave under way while joined — the withdrawal of this one's
     * presence, sent before the channel closes.
     */
    function leaveCollaboration(): Promise<void> | undefined {
        const leaving = collaboration?.leave();
        collaboration = undefined;
        joinedTo?.release();
        joinedTo = undefined;
        store.dispatch({ type: "SET_COLLABORATION", collaboration: "none" });
        return leaving;
    }

    function close(): void {
        void leaveCollaboration();
        passwordModal.dismiss();
        remotePackage = undefined;
        sourceFilename = undefined;
        formWidgets = new Map();
        formAlternateNames = new Map();
        filling = null;
        canvas.setOverlay("udoc:form-field", formFieldSource, { aboveSelection: true });
        resetMedia();
        client.close();
        store.dispatch({ type: "CLOSE_DOC" });
    }

    /** Run a ribbon menu row's intent: an Annotate tab restyle, or the
     *  extension's own. */
    function runMenuAction(action: MenuAction): void {
        switch (action.kind) {
            case "extension":
                extension?.menuAction(action.action);
                break;
            case "annotationStyle":
                void restyleAnnotations(action.change);
                break;
            case "copy":
                clipboard.copy();
                break;
            case "selectionEdit":
                void editPages(action.edit);
                break;
            case "toggleSlidesHidden":
                // Show the slides again when every one is hidden, else hide
                // them all — a selection of both hides the shown ones.
                void editPages({ kind: "setSlidesShow", show: store.getState().selectedSlidesHidden });
                break;
            case "addSlideSection":
                void addSlideSection();
                break;
            case "renameSlideSection": {
                const [id] = store.getState().selectedSlideSections;
                if (id !== undefined) store.dispatch({ type: "SET_RENAMING_SLIDE_SECTION", id });
                break;
            }
            case "moveSlideSections": {
                // The first selected section a place up or down, the rest
                // following it as one run.
                const [first] = commandContext(store.getState()).slideSections.selected;
                if (first !== undefined) void editPages({ kind: "reorderSlideSections", to: first + action.by });
                break;
            }
            case "collapseSlideSections": {
                const ids = store.getState().slideSections.map((section) => section.id);
                store.dispatch({ type: "SET_SLIDE_SECTIONS_COLLAPSED", ids, collapsed: action.collapsed });
                break;
            }
            case "removeAllSlideSections": {
                // Every section by id, keeping the slides — a deck-wide act,
                // whatever is selected.
                const ids = store.getState().slideSections.map((section) => section.id);
                void commit(() => client.execute(Command.deleteSlideSections(ids, false)));
                break;
            }
            // The sheet tab menu's, on the current sheet. Insert puts the
            // worksheet before it, as Excel's does.
            case "insertSheet":
                void insertSheet(store.getState().currentPlane);
                break;
            case "deleteSheet":
                void editSheet(store.getState().currentPlane, (id) => Command.deleteSheets([id]));
                break;
            case "renameSheet":
                store.dispatch({ type: "SET_RENAMING_SHEET", plane: store.getState().currentPlane });
                break;
            case "setSheetTabColor":
                void colorSheetTab(store.getState().currentPlane, action.color);
                break;
            case "hideSheet":
                void editSheet(store.getState().currentPlane, (id) => Command.setSheetsState([id], "hidden"));
                break;
            case "unhideSheet":
                void unhideSheet(action.plane);
                break;
        }
    }

    // Undo / redo are routed from the top toolbar's history buttons; a menu
    // row's intent runs on the selection.
    ribbon.setCallbacks({
        onHistory: (op) => void history(op),
        onMenuAction: runMenuAction,
        onAnnotationStyle: (change) => void restyleAnnotations(change),
        onMarkup: (tool) => void markupCommand(tool),
    });
    toolbar.setCallbacks({
        onHistory: (op) => void history(op),
        onPauseCollaboration: pauseCollaboration,
        onResumeCollaboration: resumeCollaboration,
        onDownload: () => void download().catch((error: unknown) => console.error("udoc: the download failed", error)),
        onPrint: () => void print().catch((error: unknown) => console.error("udoc: printing failed", error)),
    });

    // The copy half of the clipboard, in view mode as in edit — a viewer copies
    // the text it selects; the extension's cut and paste build on it.
    const clipboard = createClipboardCopy(client, store, canvas.clipboardSink, canvas.focusClipboardSink);

    // The canvas context menu, opened by a right-click on the canvas in either
    // mode — the extension's rows, else the shell's. Parented on the root (it
    // positions against the whole shell, like the dialogs) rather than in the
    // viewport, so it can overhang the canvas near an edge.
    const contextMenu = createContextMenu(i18n);
    contextMenu.mount(layout, store);
    contextMenu.setCallbacks({ onMenuAction: runMenuAction });

    // The extension, onto the shell built whole.
    const unmountExtension = extension?.mount({
        root: layout,
        modeSlot: toolbar.modeSlot,
        store,
        client,
        commit,
        hold: (message, work) => busyModal.hold(message, work),
        annotationsSelected,
        deleteSelection,
        insertSelectionText,
        clipboardSink: canvas.clipboardSink,
        focusClipboardSink: canvas.focusClipboardSink,
        clipboard,
        setOverlay: canvas.setOverlay,
        removeOverlay: canvas.removeOverlay,
        hoveredPage: canvas.hoveredPage,
        selectionKeepOut: canvas.selectionKeepOut,
    });

    store.dispatch({ type: "__INIT__" });

    function destroy(): void {
        destroyed = true;
        pageAnnotations.destroy();
        pageAnnotationListeners.clear();
        unsubComposed();
        // The worker outlives the rest until the leave has sent the withdrawal
        // of this one's presence, which the worker makes — so the others drop it
        // at once rather than on its timeout.
        const leaving = leaveCollaboration();
        cleanupSystemListener();
        layout.removeEventListener("keydown", handleKeyDown);
        for (const type of ACTIVITY_INPUTS) layout.removeEventListener(type, noteInput, { capture: true });
        panelOverlay.removeEventListener("click", handleOverlayClick);
        unsubChrome();
        unsubSelectionEdit();
        unsubDocumentChanged();
        unsubPageMedia();
        unsubDocumentChangedMedia();
        unsubMediaMode();
        unsubCommentsShown();
        if (commentsPending !== null) cancelAnimationFrame(commentsPending);
        unsubSearchEdited();
        unsubSlideSectionsEdited();
        unsubSlideSectionsOpened();
        unsubSearchFonts();
        unsubSearchOpened();
        unsubSearchNav();
        if (searchRerun !== null) cancelAnimationFrame(searchRerun);
        unsubHistory();
        unsubPeers();
        unsubPointerSharing();
        unsubPlaneLoaded();
        unsubPlanes();
        unsubPlacement();
        unsubViewControlsComposition();
        unsubStatusBar();
        unsubSpacing();
        unmountExtension?.();
        contextMenu.destroy();
        clipboard.destroy();
        unsubCommentPopup();
        unsubNav();
        unsubScrollMode();
        unsubDefaultScrollMode();
        unsubLayoutMode();
        unsubPageRotation();
        unsubDefaultFit();
        unsubDpi();
        unsubPlane();
        unsubPaintedPlane();
        unsubPlaneStatus();
        unsubPageBorder();
        unsubPerf();
        unsubPerfToggle();
        effects.destroy();
        vScrollbar.destroy();
        hScrollbar.destroy();
        viewControls.destroy();
        floatingToolbar.destroy();
        sheetTabs.destroy();
        notesPane.destroy();
        formulaBar.destroy();
        statusBar.destroy();
        rightPanel.destroy();
        leftPanel.destroy();
        canvas.destroy();
        printModal.destroy();
        busyModal.destroy();
        loadingOverlay.destroy();
        passwordModal.destroy();
        licenseNotice.destroy();
        ribbon.destroy();
        annotationBar.destroy();
        toolbar.destroy();
        if (leaving) void leaving.finally(() => client.destroy());
        else client.destroy();
        layout.remove();
    }

    return {
        store,
        getState: store.getState,
        dispatch: store.dispatch,
        onPageViews: (listener) => client.onPageViews(listener),
        openSource,
        openRemote,
        openLocal,
        registerFonts: (fonts) => client.registerFonts(fonts),
        history,
        mintId,
        selectedObjectIds,
        selectObjects,
        setSelection,
        selection,
        clearSelection,
        execute,
        snapshot,
        saveToBytes,
        saveToPackage,
        requestRemoteCopy,
        download,
        onDownload,
        print,
        onPrint,
        renderPage,
        exportToBytes,
        exportPageToBytes,
        pageAnnotations,
        onPageAnnotationEvent: (listener) => {
            pageAnnotationListeners.add(listener);
            return () => pageAnnotationListeners.delete(listener);
        },
        search,
        clearSearch,
        searchNext: (scrollAlignment) =>
            store.dispatch({ type: "SEARCH_NEXT", ...(scrollAlignment ? { scrollAlignment } : {}) }),
        searchPrev: (scrollAlignment) =>
            store.dispatch({ type: "SEARCH_PREV", ...(scrollAlignment ? { scrollAlignment } : {}) }),
        setSearchActiveIndex: (index, scrollAlignment) =>
            store.dispatch({ type: "SET_SEARCH_ACTIVE_INDEX", index, ...(scrollAlignment ? { scrollAlignment } : {}) }),
        setSearchScrollAlignment: (alignment) => store.dispatch({ type: "SET_SEARCH_SCROLL_ALIGNMENT", alignment }),
        setNavigationScrollAlignment: (alignment) =>
            store.dispatch({ type: "SET_NAVIGATION_SCROLL_ALIGNMENT", alignment }),
        goToDestination: (destination, scrollAlignment) =>
            follow(client, store, { action: null, destination }, openUrl, scrollAlignment),
        goToPlane,
        searchMatchSelection: (match) => client.searchMatchSelection(match.location),
        requestRemoteCheckpoint,
        versionVector,
        patchSince,
        merge,
        opaquePartsSince,
        mergeOpaqueParts,
        presence,
        mergePresence,
        setUserInfo,
        onEdit,
        onSelectionEdit,
        joinRemoteCollaboration,
        joinLocalCollaboration,
        leaveCollaboration,
        pauseCollaboration,
        resumeCollaboration,
        onCollaboration,
        setEnablePointerSharing,
        setShowPeerPointers,
        setOverlay: canvas.setOverlay,
        removeOverlay: canvas.removeOverlay,
        setTheme: (theme) => store.dispatch({ type: "SET_THEME", theme }),
        // The toolbar's fullscreenchange listener keeps `isFullscreen` in step.
        setFullscreen: (fullscreen) => {
            if (fullscreen === (document.fullscreenElement === layout)) return Promise.resolve();
            return fullscreen ? layout.requestFullscreen() : document.exitFullscreen();
        },
        setScrollMode: (mode) => {
            store.dispatch({ type: "SET_DEFAULT_SCROLL_MODE", mode });
            store.dispatch({
                type: "SET_SCROLL_MODE",
                mode: mode ?? defaultScrollModeForDocType(store.getState().docType ?? undefined),
            });
        },
        setLayoutMode: (mode) => store.dispatch({ type: "SET_LAYOUT_MODE", mode }),
        setPageRotation: (rotation) => store.dispatch({ type: "SET_PAGE_ROTATION", rotation }),
        setPageGap: (gap) => store.dispatch({ type: "SET_PAGE_GAP", gap }),
        setFit: (fit) => {
            store.dispatch({ type: "SET_DEFAULT_FIT", fit });
            if (store.getState().status !== "ready") return;
            store.dispatch({
                type: "SET_FIT",
                fit: fit ?? defaultFitForDocType(store.getState().docType ?? undefined),
            });
        },
        setZoom: (zoom) => store.dispatch({ type: "SET_ZOOM", zoom }),
        zoomIn: () => store.dispatch({ type: "ZOOM_IN" }),
        zoomOut: () => store.dispatch({ type: "ZOOM_OUT" }),
        setMinZoom: (zoom) => store.dispatch({ type: "SET_MIN_ZOOM", zoom }),
        setMaxZoom: (zoom) => store.dispatch({ type: "SET_MAX_ZOOM", zoom }),
        setDpi: (dpi) => store.dispatch({ type: "SET_DPI", dpi }),
        openPanel: (panel) => store.dispatch({ type: "OPEN_PANEL", panel }),
        closePanel: () => store.dispatch({ type: "CLOSE_PANEL" }),
        openNotesPanel: () => store.dispatch({ type: "SET_NOTES_OPEN", open: true }),
        closeNotesPanel: () => store.dispatch({ type: "SET_NOTES_OPEN", open: false }),
        setPresentationView,
        setViewControlsPlacement: (placement) => store.dispatch({ type: "SET_VIEW_CONTROLS_PLACEMENT", placement }),
        close,
        destroy,
    };
}
