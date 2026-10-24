import { WorkerClient } from "./worker/WorkerClient.js";
import type { Wrapper } from "./worker/WorkerClient.js";
import type { WasmLocateOptions } from "./worker/wasm-loader.js";
import type { UIExtension } from "./extension.js";
import { mountUIShell } from "./app/shell.js";
import type { UIShell } from "./app/shell.js";
import type { RemoteCheckpointResponse } from "./app/remote.js";
import type { AnnotationPatch } from "./app/annotation-patch.js";
import { pageStep, renderZoom, viewDpi } from "./app/state.js";
import type { PanelTab, ThemeMode, UIState, ViewControlsPlacement } from "./app/state.js";
import { profileFor } from "./app/profiles.js";
import { cssPxPerPt } from "./geometry.js";
import type { Fit, LayoutMode, PageGap, PageViewsFrame, ScrollAlignment, ScrollMode } from "./geometry.js";
import type {
    Annotation,
    UDocCommand,
    UDocSearchScope,
    UDocSelection,
    Destination,
    FileFormat,
    GoogleFontFamily,
    SaveStrategy,
    SearchMatch,
    SearchOptions,
    SheetState,
    UDocType,
    UrlFont,
} from "@docmentis/udoc-wasm";
import type { OverlayOptions, OverlaySource } from "./app/components/OverlayManager.js";
import type { PrintOptions } from "./app/print.js";
import type { Messages } from "./app/i18n/index.js";
import { subscribeSelector } from "./framework/index.js";

/** Options for creating a {@link UDocBase}. Every field is optional; each says its default. */
export interface UDocOptions {
    /** Commercial license key. Default none: free usage, which is metered and
     *  needs the engine to reach the permit service. */
    license?: string;
    /** Ask for the "Powered by docMentis" decal not to be painted. Honored only
     *  with a license. Default `false`. */
    hideAttribution?: boolean;
    /** Ask for usage not to be reported. Honored only with a license. Default
     *  `false`. */
    disableTelemetry?: boolean;

    /** The color theme. Default `"light"`; {@link UDocBase.setTheme} changes it. */
    theme?: ThemeMode;
    /** The language the chrome speaks, a BCP 47 tag such as `"zh-CN"`: `en`,
     *  `zh-CN`, `zh-TW`, `ja`, `ko`, `es`, `fr`, `de`, `pt-BR`, `ar` or `ru`. Any
     *  other tag reads the pack in its language and script — `zh-HK` reads
     *  `zh-TW`, `pt-PT` reads `pt-BR` — then English. Default the browser's
     *  (`navigator.language`). */
    locale?: string;
    /** Strings that replace the built-in ones, by key — the host's own wording,
     *  or a language not shipped. Default none. */
    translations?: Partial<Messages>;

    /** Show the top toolbar and the ribbon under it. Default `true`. */
    showToolbar?: boolean;
    /** Show the left side panel — thumbnails, outline and the other navigators.
     *  Default `true`. */
    showLeftPanel?: boolean;
    /** Show the right side panel — search and comments. Default `true`. */
    showRightPanel?: boolean;
    /** Show the Thumbnails panel. Default `true`; a document type with no
     *  such panel shows none, whatever this says — as for each panel below. */
    showThumbnailPanel?: boolean;
    /** Show the Outline panel. Default `true`. */
    showOutlinePanel?: boolean;
    /** Show the Layers panel. Default `true`. */
    showLayersPanel?: boolean;
    /** Show the Search panel. Default `true`. */
    showSearchPanel?: boolean;
    /** Show the Comments panel. Default `true`. */
    showCommentsPanel?: boolean;
    /** Cover the document area while a document opens — the docMentis wordmark
     *  and how far the open has got — once it has taken 300ms; the toolbar
     *  stays as it is. `false` is honored
     *  only with a license, as the logo is the brand. Default `true`. */
    showLoadingOverlay?: boolean;
    /** The side panel open at start — not one hidden by the options above, or
     *  by its side's. Default `null`, none; {@link UDocBase.openPanel} and
     *  {@link UDocBase.closePanel} change it. */
    activePanel?: PanelTab | null;
    /** Show the theme button in the toolbar's menu. Default `true`. */
    showThemeButton?: boolean;
    /** Show the fullscreen button in the toolbar's menu. Default `true`. */
    showFullscreenButton?: boolean;
    /** Show the print button in the toolbar's menu. Default `true`. */
    showPrintButton?: boolean;
    /** Show the download button in the toolbar's menu. Default `true`. */
    showDownloadButton?: boolean;
    /** Show the developer button in the toolbar's menu — the diagnostics
     *  dialog: the performance counter, the repaint area. Default `false`. */
    showDeveloperButton?: boolean;
    /** Let the user copy what they select to the system clipboard — Ctrl/Cmd+C
     *  and the context menu's Copy — in view mode. `false` leaves the
     *  selection to highlight only; edit mode copies whatever this says.
     *  Default `true`. */
    enableCopy?: boolean;
    /** Share this one's pointer with the collaboration it joins: the others
     *  see it move over the pages, under its name — for presenting remotely.
     *  Default `false`; the people button's menu and
     *  {@link UDocBase.setEnablePointerSharing} change it. */
    enablePointerSharing?: boolean;
    /** Where the view controls (page nav + zoom + view settings) dock. Default
     *  `"floating"`; {@link UDocBase.setViewControlsPlacement} changes it. */
    viewControlsPlacement?: ViewControlsPlacement;
    /** How the view scrolls: `"spread"`, one spread at a time, or
     *  `"continuous"`. Default `"continuous"`; {@link UDocBase.setScrollMode}
     *  changes it. */
    scrollMode?: ScrollMode;
    /** How the pages group into spreads, shown side by side: `"singlePage"`,
     *  `"doublePage"` (1|2, 3|4, …), `"doublePageOddRight"` (the first page alone
     *  on the right, as a cover) or `"doublePageOddLeft"` (alone on the left, for
     *  a book read right to left). PDF and Word documents only; any other
     *  shows single pages. Default `"singlePage"`;
     *  {@link UDocBase.setLayoutMode} changes it. */
    layoutMode?: LayoutMode;
    /** The turn, in degrees clockwise, every page is shown at on top of its
     *  own — a view setting: the document is unchanged. PDF and Word documents
     *  only. Default `0`; {@link UDocBase.setPageRotation} changes it. */
    pageRotation?: 0 | 90 | 180 | 270;
    /** The gaps between pages, in document points — `horizontal` between the
     *  pages of a spread, `vertical` from one spread to the next. Default
     *  the built-in gaps; {@link UDocBase.setPageGap} changes it. */
    pageGap?: PageGap;
    /** The fit every document opens with: its `mode` (`"width"`, `"height"`,
     *  `"both"` to contain, `"either"` to cover, `"none"` for the explicit
     *  {@link zoom}) and the `zoomCap` its zoom never passes (`null` for none).
     *  Default each doc type's own — fit width capped at 100% for PDF and DOCX,
     *  fit page for slides and images; {@link UDocBase.setFit} changes it. */
    fit?: Fit;
    /** The explicit zoom every document opens at while its {@link fit} is
     *  `"none"` — `1` is 100%. Default `1`; {@link UDocBase.setZoom} zooms the
     *  open document. */
    zoom?: number;
    /** CSS px per physical inch on this screen, which 100% is measured
     *  against, as the host has calibrated it — say by the user matching a
     *  ruler on screen to a real one — so 100% shows a page at its real size, a
     *  Letter page as wide as the paper beside the screen. The browser can't
     *  measure it. Default each doc type's own: `72` for a spreadsheet, whose
     *  100% is Mac Excel's, a point drawn as a CSS px; `96`, the CSS inch, for
     *  the rest. {@link UDocBase.setDpi} changes it. */
    dpi?: number;
    /** The zooms {@link UDocBase.zoomIn}, {@link UDocBase.zoomOut} and the
     *  zoom menu step through, ascending. Default `[0.1, 0.25, 0.5, 0.75, 1,
     *  1.25, 1.5, 2, 3, 4, 5]`. */
    zoomSteps?: readonly number[];
    /** The lowest explicit zoom — set, stepped, wheeled or pinched to. A fit
     *  goes lower when a page is too large to fit above it. Default `0.02`;
     *  {@link UDocBase.setMinZoom} changes it. */
    minZoom?: number;
    /** The highest explicit zoom, a marquee zoom's included — which also stops
     *  at the engine's own `16`. Default `16`; {@link UDocBase.setMaxZoom}
     *  changes it. */
    maxZoom?: number;
    /** Where a followed link or outline item, or a comment chosen in the
     *  comments panel, lands in the view: `"top"` (its top-left at the
     *  viewport's top-left, where a PDF destination puts it), `"center"`,
     *  `"bottom"`, or `"nearest"` (the least scroll that shows it, none when
     *  it already shows). Default `"top"`;
     *  {@link UDocBase.setNavigationScrollAlignment} changes it, and
     *  {@link UDocBase.goToDestination} takes one per call. */
    navigationScrollAlignment?: ScrollAlignment;
    /** Where a search match lands when it becomes current, in the same terms.
     *  Default `"nearest"`, so stepping through matches already in view moves
     *  nothing; {@link UDocBase.setSearchScrollAlignment} changes it, and the
     *  calls that step to a match take one per call. */
    searchScrollAlignment?: ScrollAlignment;

    /** Receives the URL of a link or outline item the user clicks, in place of
     *  its being opened — to confirm it first, say, or open it somewhere
     *  else. One that goes to a place in the document never reaches it.
     *  Default: the URL opens in a new browser tab. */
    onLinkClick?: (url: string) => void;

    /** Fonts of the host's own, offered to every document from the first —
     *  each a font file's bytes or a {@link UrlFont}, as
     *  {@link UDocBase.registerFonts} takes them, which adds more later.
     *  Default none. */
    fonts?: ReadonlyArray<Uint8Array | UrlFont>;
    /** Fetch from Google Fonts the families a document names that no font of
     *  its own or the host's ({@link UDocBase.registerFonts}) covers.
     *  `false` offers no Google font family at all, so nothing is ever asked of
     *  Google. Default `true`. */
    enableGoogleFonts?: boolean;
    /** The Google font families offered, each its name, the `[bold, italic]`
     *  faces Google serves for it and its subsets — to narrow the catalog
     *  `@docmentis/udoc-wasm` ships (`GOOGLE_FONT_CATALOG`), extend it or keep it
     *  current. Ignored when {@link enableGoogleFonts} is `false`. Default that
     *  catalog. */
    googleFontFamilies?: GoogleFontFamily[];
    /** Where the Google Fonts css2 API is asked for a family's faces — a
     *  mirror's, for a host that can't or won't reach Google. The font files
     *  are fetched from the URLs its `@font-face` blocks give, so a mirror that
     *  also stands in for `fonts.gstatic.com` rewrites them. An absolute URL.
     *  Ignored when {@link enableGoogleFonts} is `false`. Default
     *  `https://fonts.googleapis.com/css2`. */
    googleFontEndpoint?: string | URL;
    /** Use the fonts available to the user's browser. A family a document
     *  names that is neither registered ({@link fonts}) nor served online
     *  (Google Fonts) then renders in the copy installed on the end user's
     *  machine, which is better quality than a substitute. It depends on the device, though: the same document may
     *  render differently here than on a server or on another device.
     *  Default `true`. */
    enableCanvasFonts?: boolean;

    /** Where to load the WASM from, for a host that serves it itself. Default
     *  the copy bundled with `@docmentis/udoc-wasm`, then jsDelivr's. */
    wasm?: WasmLocateOptions;
}

/** Options for {@link UDocBase.renderPage}. Every field is optional; each says its default. */
export interface RenderPageOptions {
    /** Image pixels per document point: `1` renders at 72 DPI, `2` at 144.
     *  Default `1`. */
    scale?: number;
}

/** Options for {@link UDocBase.open}. Every field is optional; each says its default. */
export interface OpenOptions {
    /** The bytes' format, for bytes detection gets wrong: given, it skips
     *  detection outright. Default detected — a CSV, a TSV or a PSV, which
     *  has no signature, by the file's name — and a `.udoc` zip opens as a
     *  package. */
    format?: FileFormat;
    /** The file's name — what {@link UDocBase.download} names the saved
     *  document. Default a `File`'s own name, or a URL's last path segment,
     *  else `document.<format>`. */
    filename?: string;
    /** The character a CSV's fields are split by, `";"`, `"|"`, …, for a
     *  file whose delimiter detection gets wrong. Default a comma, or a
     *  semicolon where the first record is split by more of them; saving back
     *  to CSV keeps it. No other format takes one. */
    delimiter?: string;
    /** The password a protected document opens with, for a host that holds
     *  it: tried first, and the user is asked only when it doesn't open the
     *  document. Default none — the user is asked. */
    password?: string;
}

/** A sheet of the open workbook, as {@link UDocBase.sheets} lists it. */
export interface SheetInfo {
    /** The sheet's name, as its tab shows it; `""` for one the workbook left unnamed. */
    name: string;
    /**
     * Whether the sheet shows: `"visible"`, or one with no tab — `"hidden"`,
     * which Excel lets its user unhide, or `"veryHidden"`, which it doesn't.
     * Only a visible sheet can be shown, by its tab or {@link UDocBase.goToSheet}.
     */
    visibility: "visible" | "hidden" | "veryHidden";
    /**
     * Its tab's color as `#rrggbb`, or `null` for a tab in no color. A sheet's
     * color is known once the sheet has loaded, `undefined` until then: the
     * workbook's sheets load in the background once it opens, a sheet shown
     * at once, and `"sheets:changed"` fires as each color becomes known.
     */
    color: string | null | undefined;
}

/**
 * The public event map: event name → payload. Subscribe with
 * {@link UDocBase.on}.
 */
export interface UDocEvents {
    /**
     * Fires when the current page changes — scrolled to, navigated to, or a
     * document opened. `page` and `previousPage` are 0-based page indices, as
     * {@link UDocBase.currentPage} is.
     */
    "currentPage:changed": { page: number; previousPage: number };
    /**
     * Fires when the sheet shown changes — a tab clicked, {@link UDocBase.goToSheet},
     * a search result on another sheet, or a workbook opened or closed.
     * `sheet` and `previousSheet` are 0-based indices, as
     * {@link UDocBase.currentSheet} is: `-1` for none.
     */
    "currentSheet:changed": { sheet: number; previousSheet: number };
    /**
     * Fires when {@link UDocBase.sheets} changes — a workbook opened or closed,
     * and a sheet's tab color becoming known as the sheet loads.
     */
    "sheets:changed": { sheets: readonly SheetInfo[] };
    /**
     * Fires when the view moves — scrolled, zoomed or laid out again — once the
     * frame showing it has painted, and only when what it reports has changed.
     * `firstVisiblePage` / `lastVisiblePage` are the 0-based indices of the
     * first and last pages at least partly on screen (the shown spread in
     * spread scrolling; both `-1` with none on screen), `zoom` is
     * {@link UDocBase.zoom}, and `scrollTop` how far down the view is
     * scrolled, in CSS px.
     */
    "viewport:changed": { firstVisiblePage: number; lastVisiblePage: number; zoom: number; scrollTop: number };
    /**
     * Fires as {@link UDocBase.open} reads a document's bytes — fetching its
     * URL, reading its `Blob`, or once for bytes given whole: `loaded` of
     * `total` (`0` when the size isn't known), and `percent` (`null` then).
     */
    "document:loading": { loaded: number; total: number; percent: number | null };
    /**
     * Fires when the document is handed to the browser as a download — by
     * {@link UDocBase.download} or the toolbar's Download — with the
     * download's file name.
     */
    "document:downloaded": { filename: string };
    /**
     * Fires when pages are handed to the browser's print dialog — by
     * {@link UDocBase.print} or the toolbar's Print, after its own
     * print dialog — with how many; not for a print cancelled while its pages
     * render.
     */
    "document:printed": { pageCount: number };
    /** Fires when a side panel opens, closes or switches — by the host, the user or a document asking for its outline. */
    "panel:changed": { panel: PanelTab | null; previousPanel: PanelTab | null };
    /**
     * Fires after a *local* edit is applied (page edits, undo/redo) — not on
     * merges, so a sync listener that pushes a snapshot to a peer can't loop.
     * Wire it to `peer.merge(await this.snapshot())` to keep two instances in sync.
     */
    "document:edited": { composedPageCount: number };
    /**
     * Fires after a *local* selection change (click-select, clear) — not on
     * presence merges, so a sync listener can't loop. Wire it to
     * `peer.mergePresence(await this.presence())` so collaborators see this
     * one's selection.
     */
    "selection:changed": Record<string, never>;
    /**
     * Fires when the search's matches or its current match change — as each
     * batch of a running {@link UDocBase.search} lands, when it runs again
     * after an edit, and when the current match moves.
     */
    "search:changed": { matches: readonly SearchMatch[]; activeIndex: number };
    /**
     * Fires when this one's join of a collaboration is answered
     * ({@link UDocBase.joinRemoteCollaboration},
     * {@link UDocBase.joinLocalCollaboration}): on joining, and again on each
     * rejoin after `"collaboration:interrupted"`.
     */
    "collaboration:joined": Record<string, never>;
    /**
     * Fires when the connection to a server's collaboration is lost; it
     * rejoins by itself, and edits made meanwhile are sent then. `code` and
     * `reason` are the connection's close — docs/design/node-collaboration.md
     * lists the server's; the reason is empty for a connection lost without one.
     * A local collaboration is never interrupted.
     */
    "collaboration:interrupted": { code: number; reason: string };
    /**
     * Fires when an error ends the collaboration: the server refused or ended
     * this one, or couldn't be reached to join; or the local collaboration
     * service ended it — an edit its engine couldn't take, or its worker
     * failing. `code` and `reason` are as for `"collaboration:interrupted"`.
     * Not rejoined.
     */
    "collaboration:failed": { code: number; reason: string };
    /**
     * Fires when this one leaves the collaboration: through
     * {@link UDocBase.leaveCollaboration}, or by opening another document or
     * closing this one.
     */
    "collaboration:left": Record<string, never>;
    /**
     * Fires for each annotation added to a PDF — by the Annotate tab's tools,
     * {@link UDocBase.addPageAnnotation}, an undo or redo, or a collaborator —
     * once per annotation, a reply too, in page order. The annotation is read
     * without its appearance.
     */
    "annotation:inserted": { pageIndex: number; annotation: Annotation };
    /** Fires for each annotation changed, by any of the means `"annotation:inserted"` names. */
    "annotation:updated": { pageIndex: number; annotation: Annotation };
    /** Fires for each annotation removed, by any of the means `"annotation:inserted"` names, with the annotation as it was. */
    "annotation:removed": { pageIndex: number; annotation: Annotation };
    /** Fires when the selected annotation changes — `null` when none is selected any more. */
    "annotation:selected": { pageIndex: number; annotation: Annotation } | null;
    /**
     * Fires when the pointer comes to rest on an annotation, in any pointer
     * mode, or leaves it (`null`). `clientX` / `clientY` are browser-viewport
     * coordinates at the change, for placing a tooltip in screen space.
     */
    "annotation:hovered": { pageIndex: number; annotation: Annotation; clientX: number; clientY: number } | null;
    /**
     * Fires for a click on an annotation, whatever the pointer mode, before
     * the click is handled (a link followed, the annotation picked).
     * `clientX` / `clientY` are browser-viewport coordinates at the click.
     */
    "annotation:clicked": { pageIndex: number; annotation: Annotation; clientX: number; clientY: number };
}

/** A handler for event `K` of the event map `E`, as {@link UDocBase.on} takes
 *  it: called with that event's payload. */
export type EventHandler<E, K extends keyof E> = (payload: E[K]) => void;

type Viewport = UDocEvents["viewport:changed"];

/** What `"viewport:changed"` reports of `frame`, painted on a screen of `dpi` CSS px per inch. */
function viewportOf(frame: PageViewsFrame, dpi: number): Viewport {
    const indices = frame.views.map((view) => view.index);
    return {
        firstVisiblePage: indices.length > 0 ? Math.min(...indices) : -1,
        lastVisiblePage: indices.length > 0 ? Math.max(...indices) : -1,
        zoom: frame.scale / cssPxPerPt(dpi),
        scrollTop: frame.scroll.y * frame.scale,
    };
}

/** How many sheets the open document has: its planes, for a workbook; `0` for anything else. */
function sheetCountOf(state: UIState): number {
    return state.status === "ready" && profileFor(state.docType).sheetTabs ? state.planeCount : 0;
}

/** What {@link UDocBase.sheets} lists for a document without sheets. */
const NO_SHEETS: readonly SheetInfo[] = [];

/** The sheet the open document shows, or `-1` for one without sheets. */
function currentSheetOf(state: UIState): number {
    return sheetCountOf(state) > 0 ? state.currentPlane : -1;
}

function sameViewport(a: Viewport, b: Viewport): boolean {
    return (
        a.firstVisiblePage === b.firstVisiblePage &&
        a.lastVisiblePage === b.lastVisiblePage &&
        a.zoom === b.zoom &&
        a.scrollTop === b.scrollTop
    );
}

/**
 * Mount a document UI into `container`, run as `wrapper` — the docMentis
 * package embedding it, which the engine reports with every permit request and
 * usage event — on the render worker `startWorker` starts (the package's own,
 * serving the requests its UI sends), with the package's `extension` of the
 * shell, if any, and hand the shell to `construct`, the package's own class. Exported from the
 * `./internal` entry only: the wrapper is a docMentis package's to declare,
 * never an embedder's option.
 */
export async function createAs<T>(
    container: HTMLElement,
    options: UDocOptions,
    wrapper: Wrapper,
    startWorker: () => Worker,
    extension: UIExtension | null,
    construct: (shell: UIShell) => T,
): Promise<T> {
    const client = await WorkerClient.create(options, wrapper, startWorker);
    const shell = mountUIShell(container, client, options, extension);
    return construct(shell);
}

/**
 * The document UI every docMentis package's public class extends — driven with
 * `open` / `close` / `destroy`. `E` is the package's event map, the common one
 * and any of its own.
 *
 * Internally it spins up a render worker (a `WorkerClient` on this thread
 * talking to a worker that owns the OffscreenCanvas and the WASM), then mounts
 * the shell (store / reducer / effects / toolbar / canvas). None of that is
 * exposed.
 */
export abstract class UDocBase<E extends UDocEvents = UDocEvents> {
    protected readonly shell: UIShell;
    readonly #eventHandlers = new Map<keyof E, Set<EventHandler<E, keyof E>>>();
    readonly #unsubscribes: Array<() => void> = [];

    protected constructor(shell: UIShell) {
        this.shell = shell;
        // Bridge internal store/shell signals to public events.
        this.#unsubscribes.push(
            subscribeSelector(
                shell.store,
                (s) => s.pageIndex,
                (page, previousPage) => this.#emit("currentPage:changed", { page, previousPage }),
            ),
            subscribeSelector(shell.store, currentSheetOf, (sheet, previousSheet) =>
                this.#emit("currentSheet:changed", { sheet, previousSheet }),
            ),
            subscribeSelector(
                shell.store,
                (s) => this.#sheetsOf(s),
                (sheets) => this.#emit("sheets:changed", { sheets }),
            ),
            this.#watchViewport(),
            subscribeSelector(
                shell.store,
                (s) => s.loadProgress,
                (progress) => {
                    if (!progress) return;
                    const { loaded, total } = progress;
                    const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : null;
                    this.#emit("document:loading", { loaded, total, percent });
                },
            ),
            subscribeSelector(
                shell.store,
                (s) => s.activePanel,
                (panel, previousPanel) => this.#emit("panel:changed", { panel, previousPanel }),
            ),
            shell.onEdit(() =>
                this.#emit("document:edited", { composedPageCount: shell.getState().composedPageCount }),
            ),
            shell.onSelectionEdit(() => this.#emit("selection:changed", {})),
            shell.onDownload((filename) => this.#emit("document:downloaded", { filename })),
            shell.onPrint((pageCount) => this.#emit("document:printed", { pageCount })),
            shell.onPageAnnotationEvent((event, payload) => this.#emit(event, payload as UDocEvents[typeof event])),
            subscribeSelector(
                shell.store,
                (s) => ({ matches: s.searchMatches, activeIndex: s.searchActiveIndex }),
                (change) => this.#emit("search:changed", change),
                { equality: (a, b) => a.matches === b.matches && a.activeIndex === b.activeIndex },
            ),
            shell.onCollaboration((event) => {
                if (event.type === "interrupted" || event.type === "failed") {
                    this.#emit(`collaboration:${event.type}`, { code: event.code, reason: event.reason });
                } else {
                    this.#emit(`collaboration:${event.type}`, {});
                }
            }),
        );
    }

    /**
     * Offer fonts of the host's own to every document opened after this call.
     * Each is either a font file's bytes — TrueType, OpenType, a collection,
     * WOFF, WOFF2 or EOT — which name their own family and faces, or a
     * {@link UrlFont}: a family and face, and the URL its file is fetched from
     * once a document's text asks for it. Bytes that aren't a font register
     * nothing.
     *
     * A document's own embedded fonts still come first; registered bytes, then
     * URLs, come ahead of Google Fonts and the bundled fonts. Each call adds to
     * the last. The document already open keeps the fonts it opened with — its
     * text was shaped as it opened — so register before {@link open}.
     */
    registerFonts(fonts: ReadonlyArray<Uint8Array | UrlFont>): void {
        this.shell.registerFonts(fonts);
    }

    /**
     * Open a document — `source` its URL, which is fetched, a `Blob`
     * such as a `File`, which it reads, or its bytes — as {@link OpenOptions}
     * says: its format, detected unless given, its file's name, and the
     * password a protected one opens with. While it
     * opens, `"document:loading"` reports how far its bytes have been read,
     * and the loading overlay shows once it has taken long enough to notice.
     * The opened document's doc type and source format are then
     * {@link docType} and {@link sourceFormat}, and a workbook's sheets
     * {@link sheetCount} and {@link currentSheet}.
     *
     * Rejects with a `UDocError` when the document doesn't open — an `io` one
     * when its URL can't be fetched — after showing it, with the
     * license notice for a licensing refusal.
     */
    open(source: string | URL | Blob | Uint8Array, options: OpenOptions = {}): Promise<void> {
        return this.shell.openSource(source, options);
    }

    /**
     * Open the document a udoc server keeps, part by part: `url` is its package
     * resource, `…/documents/{documentId}/package`. The engine fetches each part
     * the first time the document needs it, so only the parts it reaches are
     * downloaded. The doc type and source format are then {@link docType} and
     * {@link sourceFormat}, and a failure rejects, as for {@link open}.
     */
    openRemote(url: string): Promise<void> {
        return this.shell.openRemote(url);
    }

    /**
     * Open the document the local collaboration service `id` keeps (the id
     * the class's static `startLocalCollaborationService` resolves with): its
     * package, with every edit the service has merged. The doc type and source
     * format are then {@link docType} and {@link sourceFormat}, and a failure
     * rejects, as for {@link open}.
     */
    openLocal(id: string): Promise<void> {
        return this.shell.openLocal(id);
    }

    /** Undo the last edit. Resolves once the layout has been refreshed. */
    undo(): Promise<void> {
        return this.shell.history("undo");
    }

    /** Redo the last undone edit. Resolves once the layout has been refreshed. */
    redo(): Promise<void> {
        return this.shell.history("redo");
    }

    /**
     * Mint one fresh, CRDT-safe id (its 32-char hex key) — id allocation is the
     * session's, so a minted id can't collide with a loader or peer id. An
     * `InsertObjects` command carries the ids of the objects it inserts, so the
     * host mints one here, stamps it into the object it builds, and names it in
     * the command (and can select by it afterward). Resolves to `null` with no
     * open document or a doc type that mints no ids.
     */
    mintId(): Promise<string | null> {
        return this.shell.mintId();
    }

    /**
     * The hex keys of the graphics objects currently selected here —
     * empty when nothing is selected. The read that lets a host act on the
     * current selection by id, e.g. read one instance's selection and
     * {@link selectObjects} the same ids in another.
     */
    selectedObjectIds(): Promise<string[]> {
        return this.shell.selectedObjectIds();
    }

    /**
     * Select the graphics objects named by `ids` (their 32-char hex keys) on the
     * page at index `page` — id-addressed selection, the programmatic counterpart
     * of a pointer click. A portable selection is confined to one page, so the
     * page rides with the ids. Presence only (no edit, no undo step), so it fires
     * `"selection:changed"` and a sync transport broadcasts it as this one's
     * selection — collaborators see it in this peer's color. Unknown ids are
     * skipped; an empty list clears the selection.
     */
    selectObjects(page: number, ids: string[]): void {
        this.shell.selectObjects(page, ids);
    }

    /**
     * Set the selection to a doc-type-tagged {@link UDocSelection} — the
     * agnostic, id-addressed presence path used where {@link selectObjects}
     * (portable objects only) can't express the selection, e.g. presentation
     * shapes: `{ presentation: { shapes: { slide, selection: { shapes: ids } } } }`. Presence only (no
     * undo step); fires `"selection:changed"` and a sync transport broadcasts it
     * as this peer's selection. Pass `{ presentation: "none" }` (or the doc type's
     * empty variant) to clear.
     */
    setSelection(selection: UDocSelection): void {
        this.shell.setSelection(selection);
    }

    /**
     * The current selection as the tagged {@link UDocSelection}, or
     * `null` when nothing is selected / no document — the doc-type-agnostic read
     * (portable objects, presentation shapes, …). The counterpart of
     * {@link selectedObjectIds} for doc types beyond portable; lets a host read
     * its own or a peer's selection whatever the doc type.
     */
    selection(): Promise<UDocSelection | null> {
        return this.shell.selection();
    }

    /** Clear the selection (presence only; fires `"selection:changed"`). */
    clearSelection(): void {
        this.shell.clearSelection();
    }

    /**
     * Execute one arbitrary, doc-type-tagged {@link UDocCommand} — the **single
     * write seam**. Every edit is a command: page structure (`InsertPage` /
     * `DeletePage` / `ReorderPage`, addressed by index), object content
     * (`InsertObjects` / `TransformObjects` / `DeleteObjects`, addressed by
     * `PageId` + object ids), and their presentation twins. A host crafts the
     * strongly-typed command from the declared type (`UDocCommand`, in the
     * wasm's `udoc.d.ts`) — there are no per-verb methods; this is how all
     * writes happen, so the same shape is loggable and replayable. Build the
     * object payloads the host's own way and mint their ids with
     * {@link mintId}. One committing edit (one undo step); resolves
     * once the layout has refreshed, with any selection change reported via
     * `"selection:changed"`. Rejects if the command is invalid for the open
     * document.
     */
    execute(command: UDocCommand): Promise<void> {
        return this.shell.execute(command);
    }

    // --- Page annotations (the calls of @docmentis/udoc-viewer 0.7) ----------------

    /**
     * Get the annotations on a page of a PDF, in paint order — the engine's
     * model of each (`Annotation`), read without its appearance (`null`). A
     * reply is an annotation of its own, naming the one it answers in its
     * markup's `inReplyTo`.
     *
     * Every geometry field is in the page's unrotated MediaBox space — origin
     * top-left, PDF points, +y downward — whatever the page's `/Rotate`.
     * `[]` for a document that isn't a PDF.
     *
     * @param page - Page index (0-based)
     */
    getPageAnnotations(page: number): Promise<Annotation[]> {
        return this.shell.pageAnnotations.getPageAnnotations(page);
    }

    /**
     * Add a new annotation to a page.
     *
     * If `annotation.name` (its `/NM`) is omitted, a UUID is generated and
     * assigned — the key the other calls take, which a save writes and a reopen
     * reads back, where an annotation's `id` is minted afresh each time a file
     * is read. Its `id` is minted too where it has none, and its appearance is
     * generated where it has none. The returned value is the annotation as
     * inserted (with `id` and `name` populated). The selection is left as it was.
     *
     * Pass `ephemeral: true` to create one that shows but is never saved or
     * printed; `updatePageAnnotation` can flip the flag to promote a preview
     * into a saved annotation (or demote a saved one).
     *
     * Annotations are supported on PDF documents only. Resolves once
     * `"annotation:inserted"` has fired for it.
     *
     * @param page - Page index (0-based)
     * @returns The inserted annotation (with `id` and `name` populated).
     */
    async addPageAnnotation(page: number, annotation: Annotation): Promise<Annotation> {
        const [inserted] = await this.shell.pageAnnotations.addPageAnnotations(page, [annotation]);
        return inserted!;
    }

    /**
     * Add several annotations to one page in a single edit — one undo step.
     * Use it when importing or restoring annotations. `"annotation:inserted"`
     * still fires once per annotation, in input order.
     *
     * @param page - Page index (0-based)
     * @param annotations - Annotations to insert (may mix ephemeral and saved)
     * @returns The inserted annotations (with `id` and `name` populated), in input order.
     */
    addPageAnnotations(page: number, annotations: Annotation[]): Promise<Annotation[]> {
        return this.shell.pageAnnotations.addPageAnnotations(page, annotations);
    }

    /**
     * Replace an existing annotation, identified by its `name` (NM), with
     * `annotation` whole — a field it omits is cleared. Its `id` and `name`
     * are kept even where `annotation` gives others. Its appearance is
     * generated afresh where `annotation` gives none — but a stamp's picture,
     * which stays while its icon and colour do.
     *
     * @param page - Page index (0-based)
     * @param name - The annotation's `name` (NM).
     * @returns The updated annotation.
     * @throws If no annotation with the given `name` is found on the page.
     */
    async updatePageAnnotation(page: number, name: string, annotation: Annotation): Promise<Annotation> {
        const [updated] = await this.shell.pageAnnotations.updatePageAnnotations(page, [{ name, annotation }]);
        return updated!;
    }

    /**
     * Replace several annotations on one page, as {@link updatePageAnnotation}
     * does each. Validation is atomic: if any `name` is missing on the page
     * the call throws before any change is applied. `"annotation:updated"`
     * fires once per entry.
     *
     * @param page - Page index (0-based)
     * @returns The updated annotations, in input order.
     */
    updatePageAnnotations(
        page: number,
        updates: Array<{ name: string; annotation: Annotation }>,
    ): Promise<Annotation[]> {
        return this.shell.pageAnnotations.updatePageAnnotations(page, updates);
    }

    /**
     * Patch an existing annotation, identified by its `name` (NM).
     *
     * Unlike {@link updatePageAnnotation}, which replaces the entire
     * annotation, this only overwrites the fields present in `patch`, and
     * merges an object field into the annotation's, all the way down — so
     * `{ kind: { highlight: { markup: { author } } } }` keeps the quads and
     * every other markup entry.
     *
     * Semantics:
     * - `id` and `name` in the patch are ignored; a `kind` of another subtype
     *   replaces the kind whole.
     * - An array is replaced whole.
     * - `undefined` values are skipped, not treated as "clear this field";
     *   `null` clears.
     *
     * @param page - Page index (0-based)
     * @param name - The annotation's `name` (NM).
     * @param patch - Fields to merge into the existing annotation.
     * @returns The patched annotation.
     * @throws If no annotation with the given `name` is found on the page.
     */
    async patchPageAnnotation(page: number, name: string, patch: AnnotationPatch): Promise<Annotation> {
        const [patched] = await this.shell.pageAnnotations.patchPageAnnotations(page, [{ name, patch }]);
        return patched!;
    }

    /**
     * Patch several annotations on one page, as {@link patchPageAnnotation}
     * does each. Validation is atomic, as {@link updatePageAnnotations}'.
     *
     * @param page - Page index (0-based)
     * @returns The patched annotations, in input order.
     */
    patchPageAnnotations(
        page: number,
        patches: Array<{ name: string; patch: AnnotationPatch }>,
    ): Promise<Annotation[]> {
        return this.shell.pageAnnotations.patchPageAnnotations(page, patches);
    }

    /**
     * Remove an annotation, identified by its `name` (NM), with what answers
     * it — its replies, state notes and group members — and its popup.
     *
     * @param page - Page index (0-based)
     * @param name - The annotation's `name` (NM).
     * @throws If no annotation with the given `name` is found on the page.
     */
    removePageAnnotation(page: number, name: string): Promise<void> {
        return this.shell.pageAnnotations.removePageAnnotation(page, name);
    }

    /** Scroll the viewport to page index `page` (0-based, clamped to the pages composed). */
    goToPage(page: number): void {
        this.shell.dispatch({ type: "NAVIGATE_TO_PAGE", pageIndex: page });
    }

    /** Step to the next page, as the view controls' arrow does — the next
     *  spread's in spread scrolling. Nothing past the last page composed. */
    goToNextPage(): void {
        this.#stepPage(1);
    }

    /** Step to the previous page, as the view controls' arrow does — the
     *  previous spread's in spread scrolling. Nothing before the first. */
    goToPrevPage(): void {
        this.#stepPage(-1);
    }

    #stepPage(by: 1 | -1): void {
        const page = pageStep(this.shell.getState(), by);
        if (page !== null) this.shell.dispatch({ type: "NAVIGATE_TO_PAGE", pageIndex: page });
    }

    /**
     * Show a sheet of the open workbook, as clicking its tab does: `sheet` is
     * its 0-based index, as {@link currentSheet} counts it, or its name.
     * Resolves once a frame showing it has painted, so an overlay drawn then
     * lands on it; or once the view has moved on without it, another sheet
     * chosen first or the document closed. Each sheet's pages count from 0,
     * so {@link goToPage} moves within the sheet shown.
     *
     * Rejects with no workbook open, an index past the last sheet, a name no
     * sheet has, or a sheet that isn't visible — hidden or very hidden, it has
     * no tab, and Excel shows it only once unhidden.
     */
    async goToSheet(sheet: number | string): Promise<void> {
        const state = this.shell.getState();
        const count = sheetCountOf(state);
        if (count === 0) throw new Error("goToSheet: the open document has no sheets");
        const index = typeof sheet === "string" ? state.planeNames.indexOf(sheet) : sheet;
        if (typeof sheet === "string" && (sheet === "" || index < 0)) {
            throw new Error(`goToSheet: no sheet is named ${JSON.stringify(sheet)}`);
        }
        if (!Number.isInteger(index) || index < 0 || index >= count) {
            throw new Error(`goToSheet: there is no sheet at index ${index}, of ${count}`);
        }
        const visibility = state.planeVisibility[index];
        if (visibility !== "visible") {
            throw new Error(
                `goToSheet: the sheet at index ${index} is ${visibility === "hidden" ? "hidden" : "very hidden"}`,
            );
        }
        await this.shell.goToPlane(index);
    }

    /**
     * Follow a PDF `destination`, as clicking a link to it does: a named one
     * resolves through the document's named destinations, and the view lands
     * as its view asks — the point it lands where `options.scrollAlignment`
     * says, else where {@link setNavigationScrollAlignment} does. Resolves
     * once it has landed, or not: a name the document doesn't define, or a
     * document that isn't a PDF, leaves the view.
     */
    goToDestination(destination: Destination, options?: { scrollAlignment?: ScrollAlignment }): Promise<void> {
        return this.shell.goToDestination(destination, options?.scrollAlignment);
    }

    /** Set where a followed link or outline item, or a chosen comment, lands; see the `navigationScrollAlignment` option. */
    setNavigationScrollAlignment(alignment: ScrollAlignment): void {
        this.shell.setNavigationScrollAlignment(alignment);
    }

    /**
     * Serialize this one's CRDT for sync with a peer — feed the bytes to the
     * peer's {@link merge}. The unit of collaboration; the transport
     * is the caller's concern.
     */
    snapshot(): Promise<Uint8Array> {
        return this.shell.snapshot();
    }

    /**
     * Save the open document as `format`, faithfully — the bytes reopen as the
     * same document. `format` is one of the open doc type's own (a PDF saves to
     * `"pdf"`, a presentation to `"pptx"`); {@link sourceFormat} is what
     * saving it back means. `strategy` is how much of the file it was opened
     * from, the original, the saved bytes keep: a `"delta"` or `"incremental"`
     * save writes over it, which a document opened with {@link openRemote}
     * doesn't hold; without it, the one keeping the most of it that `format`
     * saves by (`"incremental"` for a PDF, `"rewrite"` for a CSV, a TSV, a PSV
     * or an image, else `"delta"`). Rejects for a format its doc type doesn't
     * save to, a format that never saves by `strategy`, no original to write
     * over, or a save that isn't built yet.
     */
    saveToBytes(format: FileFormat, strategy?: SaveStrategy): Promise<Uint8Array> {
        return this.shell.saveToBytes(format, strategy);
    }

    /**
     * Save the open document as a udoc package — the bytes of a `.udoc` zip,
     * which {@link open} reopens. It records the source format, so a reopened
     * package can still be saved back to it. `version` makes it a checkpoint,
     * baseline `v<version>`, which keeps the edit log a reopen replays; without
     * it the package is a flat baseline — the whole document and no log.
     */
    saveToPackage(version?: number): Promise<Uint8Array> {
        return this.shell.saveToPackage(version);
    }

    /**
     * Ask the udoc server the open document was opened from
     * ({@link openRemote}) for a copy of it, saved as its source format by
     * `strategy`, else by the engine's for it — a `"delta"` or `"incremental"`
     * copy is the server's to save, since only it holds the original. Resolves
     * with the copy's bytes. Rejects for a document not opened with
     * {@link openRemote}, or one that records no source format, and with the
     * server's message for what it refuses.
     */
    requestRemoteCopy(strategy?: SaveStrategy): Promise<Uint8Array> {
        return this.shell.requestRemoteCopy(strategy);
    }

    /**
     * Save the open document as its source format and hand it to the browser
     * as a download named `filename` — default the name {@link open} was given,
     * else `document.<format>`. What the toolbar's Download does.
     *
     * It saves by the strategy that keeps the most of the original the format
     * can: a PDF appends its edits as a new revision, so its signatures stay
     * valid; an OOXML document writes its modified parts over the original; an
     * image rewrites. A document opened with {@link openRemote} asks its server
     * for that copy ({@link requestRemoteCopy}). Rejects as
     * {@link saveToBytes} does.
     */
    download(filename?: string): Promise<void> {
        return this.shell.download(filename);
    }

    /**
     * Print the open document through the browser's print dialog. Without
     * `options` it opens its own print dialog first, to choose the pages
     * and quality — what the toolbar's Print does; with them it prints as
     * they say.
     *
     * Every page of a PDF at `"standard"` quality prints as the PDF itself,
     * saved as {@link download} saves it, through the browser's own viewer.
     * Anything else prints rendered: each page rendered at the quality's DPI,
     * one sheet each, with input held while they render — Cancel there
     * stops the print. The print job is named after the file {@link open} was
     * given. Rejects with no document open, one without pages (a
     * spreadsheet), or a page index past its last page.
     */
    print(options?: PrintOptions): Promise<void> {
        return this.shell.print(options);
    }

    /**
     * Render page `page` — a 0-based index, as {@link goToPage} takes it — to an
     * image, as the document now stands, at {@link RenderPageOptions}'
     * `scale`. It renders off the viewport, so nothing on screen changes; a
     * page not yet composed is composed first. Rejects with no document open,
     * one without pages (a spreadsheet), or a page past its last.
     */
    renderPage(page: number, options: RenderPageOptions = {}): Promise<ImageBitmap> {
        return this.shell.renderPage(page, options.scale ?? 1);
    }

    /**
     * Search the open document for `query`, matching letter case only with
     * `caseSensitive`, and — with `fuzzy` — comparing with separators dropped
     * and typographic punctuation folded, so a quotation from another source
     * still finds its text. `scope` limits the search to part of the document
     * (a PDF's pages, a deck's slides, a workbook's sheet); without it the whole
     * document is searched.
     *
     * The matches arrive in document order, batch by batch, each firing
     * `"search:changed"`; their highlights show on the pages, and the first match
     * becomes current and is brought into view. Resolves with every match once
     * the search has found them all — or with none when a newer search,
     * {@link clearSearch} or an edit retires it. The search stays in force: an
     * edit runs it again, and `"search:changed"` carries what that run finds.
     * Each match carries its page, its highlight and the words around it.
     */
    search(query: string, options?: SearchOptions & { scope?: UDocSearchScope }): Promise<readonly SearchMatch[]> {
        return this.shell.search(query, options);
    }

    /**
     * Make the next match current, wrapping past the last, and bring it into
     * view — where `options.scrollAlignment` says, else where
     * {@link setSearchScrollAlignment} does.
     */
    searchNext(options?: { scrollAlignment?: ScrollAlignment }): void {
        this.shell.searchNext(options?.scrollAlignment);
    }

    /** Make the previous match current, wrapping past the first, and bring it into view, as {@link searchNext} does. */
    searchPrev(options?: { scrollAlignment?: ScrollAlignment }): void {
        this.shell.searchPrev(options?.scrollAlignment);
    }

    /** Make match `index` of {@link searchMatches} current and bring it into view, as {@link searchNext} does. */
    setSearchActiveIndex(index: number, options?: { scrollAlignment?: ScrollAlignment }): void {
        this.shell.setSearchActiveIndex(index, options?.scrollAlignment);
    }

    /** Set where a search match lands when it becomes current; see the `searchScrollAlignment` option. */
    setSearchScrollAlignment(alignment: ScrollAlignment): void {
        this.shell.setSearchScrollAlignment(alignment);
    }

    /** Drop the search: no query, no matches, no highlights. */
    clearSearch(): void {
        this.shell.clearSearch();
    }

    /** The matches the search has found so far, in document order. */
    get searchMatches(): readonly SearchMatch[] {
        return this.shell.getState().searchMatches;
    }

    /** The index of the current match in {@link searchMatches}; -1 for none. */
    get searchActiveIndex(): number {
        return this.shell.getState().searchActiveIndex;
    }

    /**
     * The selection naming `match`'s text — hand it to {@link setSelection} to
     * select the match. Resolves null when nothing there can be selected (text
     * inside a PDF group, a document changed since the search).
     */
    searchMatchSelection(match: SearchMatch): Promise<UDocSelection | null> {
        return this.shell.searchMatchSelection(match);
    }

    /**
     * Ask the udoc server the open document was opened from
     * ({@link openRemote}) to checkpoint it: save its document as a new
     * baseline. Resolves with that baseline's version. Nothing reopens: the
     * document stays open as it was. Rejects for a document not opened with
     * {@link openRemote}, and with the server's message for what it refuses.
     */
    requestRemoteCheckpoint(): Promise<RemoteCheckpointResponse> {
        return this.shell.requestRemoteCheckpoint();
    }

    /**
     * Read this one's version vector — the per-peer op counts it holds. Hand
     * the bytes to a peer's {@link patchSince} so it returns only the ops this
     * one is missing; that delta goes to {@link merge}. The incremental
     * counterpart to shipping a whole {@link snapshot}.
     */
    versionVector(): Promise<Uint8Array> {
        return this.shell.versionVector();
    }

    /**
     * Compute the ops this one holds that a peer — identified by its
     * {@link versionVector} bytes — does not. Feed the returned patch to that
     * peer's {@link merge}.
     */
    patchSince(peer: Uint8Array): Promise<Uint8Array> {
        return this.shell.patchSince(peer);
    }

    /** Merge a peer's {@link snapshot} or {@link patchSince} and refresh the layout. */
    merge(data: Uint8Array): Promise<void> {
        return this.shell.merge(data);
    }

    /**
     * The content of every opaque part — an inserted picture's image, which the
     * CRDT names but does not carry — this one holds whose write a peer,
     * identified by its {@link versionVector} bytes, lacks. Send it ahead of
     * the {@link patchSince} patch that names them, to the peer's
     * {@link mergeOpaqueParts}; empty when there is nothing to send.
     */
    opaquePartsSince(peer: Uint8Array): Promise<Uint8Array> {
        return this.shell.opaquePartsSince(peer);
    }

    /** Hold a peer's {@link opaquePartsSince} content and refresh the layout. */
    mergeOpaqueParts(data: Uint8Array): Promise<void> {
        return this.shell.mergeOpaqueParts(data);
    }

    /**
     * Serialize this one's presence — its selection — for sync with a peer:
     * the transient channel beside {@link snapshot} (last-write-wins, no
     * history, never part of a save). Feed the bytes to a peer's
     * {@link mergePresence}; see the `"selection:changed"` event for when.
     */
    presence(): Promise<Uint8Array> {
        return this.shell.presence();
    }

    /**
     * Merge a peer's {@link presence}. The peer's selection appears in the
     * selection overlay, in a stable per-peer color. Does not fire
     * `"selection:changed"`, so a sync listener can't loop.
     */
    mergePresence(data: Uint8Array): Promise<void> {
        return this.shell.mergePresence(data);
    }

    /**
     * Set the local user's info — currently a display name, the label peers
     * draw on this one's selection (beside the per-peer color), and the
     * author of the annotations drawn here. Sticky: it
     * survives a re-open and applies even when set before a document is open.
     * Rides the presence channel, so it fires `"selection:changed"` (the cue to
     * broadcast {@link presence}) and collaborators pick the name up on the next
     * merge. An avatar and other fields can join the signature later.
     */
    setUserInfo(name: string): void {
        this.shell.setUserInfo(name);
    }

    /**
     * Join the collaboration a udoc server keeps for the open document, as
     * `name` — the label peers draw on this one's selection, set as
     * {@link setUserInfo} sets it. `url` is its collaboration resource,
     * `…/documents/{documentId}/collaboration`. This one's edits and
     * selection reach everyone else in it, and theirs reach this one; a lost
     * connection is rejoined. The `collaboration:*` events say how it goes.
     *
     * Leaves any collaboration already joined. The collaboration belongs to the
     * open document: opening another or closing this one leaves it. Throws with
     * no document open.
     */
    joinRemoteCollaboration(url: string, name: string): void {
        this.shell.joinRemoteCollaboration(url, name);
    }

    /**
     * Join the collaboration of the local collaboration service `id`, as
     * `name` — as {@link joinRemoteCollaboration} joins a server's, with the
     * document {@link openLocal} opened from it. Over the page, not a network,
     * so it is never interrupted.
     *
     * Leaves any collaboration already joined; opening another document or
     * closing this one leaves it. Throws with no document open, or no service
     * `id` — never started, or ended.
     */
    joinLocalCollaboration(id: string, name: string): void {
        this.shell.joinLocalCollaboration(id, name);
    }

    /**
     * Leave the collaboration, local or remote — joined or paused; fires
     * `"collaboration:left"` if joined. This one's selection and pointer leave
     * the others' views at once, and theirs this one's. The last one joined to
     * a local collaboration service leaving ends the service.
     */
    leaveCollaboration(): void {
        this.shell.leaveCollaboration();
    }

    /**
     * Pause co-editing — what the people button's Pause does: leave the
     * collaboration as {@link leaveCollaboration} does, firing
     * `"collaboration:left"`, but keep how to join it again; a local
     * collaboration service stays up for it. Edits go on here, and there, apart.
     * Does nothing unless joined.
     */
    pauseCollaboration(): void {
        this.shell.pauseCollaboration();
    }

    /**
     * Resume co-editing paused: join the collaboration again, firing
     * `"collaboration:joined"` once answered. What each side edited meanwhile
     * merges both ways, so a pause loses no edit. Does nothing unless paused.
     */
    resumeCollaboration(): void {
        this.shell.resumeCollaboration();
    }

    /**
     * Share this one's pointer with the collaboration it joins, or stop sharing
     * it — when it stops, the others' copy of it disappears. The initial value
     * is set at construction via `enablePointerSharing`; the people button's
     * menu switches it too.
     */
    setEnablePointerSharing(enabled: boolean): void {
        this.shell.setEnablePointerSharing(enabled);
    }

    /**
     * Register (or replace) a page-anchored HTML overlay under `id`: DOM
     * chrome (corner buttons, inter-page dividers, comment pins) positioned
     * over the canvas and kept pinned to the pages as they scroll and zoom.
     * The viewport is painted in Rust; this is how a host adds interactive
     * HTML on top of it. Multiple overlays render at once, stacked in
     * registration order. The built-in chrome — the annotation bar and the
     * comment popup among it — registers through this same surface under
     * `udoc:`-prefixed ids, so a host can
     * {@link removeOverlay} or replace the built-ins exactly like its own.
     * Write an {@link OverlaySource} mapping each frame's pages to elements.
     *
     * An overlay paints under the selection's boxes and handles, as the page
     * chrome does; `aboveSelection` puts it over them, for chrome that belongs
     * over the selected object — as the built-in annotation bar and comment
     * popup do.
     */
    setOverlay(id: string, source: OverlaySource, options?: OverlayOptions): void {
        this.shell.setOverlay(id, source, options);
    }

    /**
     * Remove the overlay registered under `id` — including the built-ins
     * (e.g. `"udoc:annotation-bar"`). Returns false if unknown.
     */
    removeOverlay(id: string): boolean {
        return this.shell.removeOverlay(id);
    }

    /**
     * Set the color theme: `"light"`, `"dark"`, or `"system"` (follows the OS
     * `prefers-color-scheme`). Restyles the chrome and recolors the
     * engine-painted viewport backdrop to match.
     */
    setTheme(theme: ThemeMode): void {
        this.shell.setTheme(theme);
    }

    /**
     * Fill the screen with the document UI, or leave it, as the toolbar menu's
     * Fullscreen button does. The browser enters fullscreen only in answer to a
     * user gesture, so call it from the host's own click handler; the promise
     * rejects when the browser refuses. Leaving resolves at once when it isn't
     * fullscreen.
     */
    setFullscreen(fullscreen: boolean): Promise<void> {
        return this.shell.setFullscreen(fullscreen);
    }

    /**
     * Scroll one spread at a time (`"spread"`) or continuously
     * (`"continuous"`) — the view settings' Scroll section.
     */
    setScrollMode(mode: ScrollMode): void {
        this.shell.setScrollMode(mode);
    }

    /**
     * Group the pages into spreads, shown side by side, as `mode` says — the
     * view settings' Layout section. PDF and Word documents only; any other
     * shows single pages.
     */
    setLayoutMode(mode: LayoutMode): void {
        this.shell.setLayoutMode(mode);
    }

    /**
     * Turn every page `rotation` degrees clockwise on top of its own — the view
     * settings' Rotation section. A view setting: the document is unchanged,
     * and nothing is saved or shared with collaborators. PDF and Word documents
     * only; any other shows its pages upright.
     */
    setPageRotation(rotation: 0 | 90 | 180 | 270): void {
        this.shell.setPageRotation(rotation);
    }

    /**
     * Set the gaps between pages, in document points — `horizontal` between
     * the pages of a spread, `vertical` from one spread to the next; `null`
     * restores the built-in gaps.
     */
    setPageGap(gap: PageGap | null): void {
        this.shell.setPageGap(gap);
    }

    /**
     * Fit the open document by `fit`, and open every later one by it; `null`
     * restores each doc type's default fit. The zoom menu still picks a fit for
     * the open document alone.
     */
    setFit(fit: Fit | null): void {
        this.shell.setFit(fit);
    }

    /**
     * Zoom the open document to `zoom` — `1` is 100% — dropping its fit, as the
     * zoom menu does. Clamped to the bounds {@link setMinZoom} and
     * {@link setMaxZoom} set.
     */
    setZoom(zoom: number): void {
        this.shell.setZoom(zoom);
    }

    /** Zoom to the next zoom step above the zoom on screen; a no-op at the top step. */
    zoomIn(): void {
        this.shell.zoomIn();
    }

    /** Zoom to the next zoom step below the zoom on screen; a no-op at the bottom step. */
    zoomOut(): void {
        this.shell.zoomOut();
    }

    /** Set the lowest explicit zoom; an explicit zoom below it rises to it. */
    setMinZoom(zoom: number): void {
        this.shell.setMinZoom(zoom);
    }

    /** Set the highest explicit zoom; an explicit zoom above it drops to it. */
    setMaxZoom(zoom: number): void {
        this.shell.setMaxZoom(zoom);
    }

    /**
     * Set the screen's CSS px per physical inch, which 100% is measured
     * against — the `dpi` option, for a calibration made while it
     * runs. The zoom stays, so the page shows at the same zoom in its new size.
     */
    setDpi(dpi: number): void {
        this.shell.setDpi(dpi);
    }

    /**
     * Open the side panel `panel`, in place of whichever is open.
     * Ignored for a panel the options hide — or the open document's type
     * offers none of, or whose whole side is hidden.
     */
    openPanel(panel: PanelTab): void {
        this.shell.openPanel(panel);
    }

    /** Close the open side panel, if any. */
    closePanel(): void {
        this.shell.closePanel();
    }

    /** The open document's doc type, or `null` with no document open. */
    get docType(): UDocType | null {
        return this.shell.getState().docType;
    }

    /**
     * The file format the open document came from — what saving it back
     * means — or `null` with no document open, or for a package that recorded
     * none.
     */
    get sourceFormat(): FileFormat | null {
        return this.shell.getState().sourceFormat;
    }

    /**
     * The pages composed so far — not the document's total until composing
     * finishes, so it grows as pages compose ahead. `0` with no document
     * open, or for a doc type without pages.
     */
    get pageCount(): number {
        return this.shell.getState().composedPageCount;
    }

    /** The current page's 0-based index, as {@link goToPage} takes it; `"currentPage:changed"` fires when it changes. */
    get currentPage(): number {
        return this.shell.getState().pageIndex;
    }

    /**
     * How many sheets the open workbook has, hidden ones included, so that an
     * index counts the workbook's own sheets in order. `0` with no
     * document open, or one without sheets.
     */
    get sheetCount(): number {
        return sheetCountOf(this.shell.getState());
    }

    /**
     * The sheet shown: its 0-based index, as {@link goToSheet} takes it, or
     * `-1` with no document open, or one without sheets.
     * `"currentSheet:changed"` fires when it changes.
     */
    get currentSheet(): number {
        return currentSheetOf(this.shell.getState());
    }

    /**
     * The open workbook's sheets, in its own order — hidden ones too —
     * so that a sheet's index here is the one {@link goToSheet} takes and
     * {@link currentSheet} reports. Empty with no document open, or one
     * without sheets. The same array until it changes, when
     * `"sheets:changed"` fires.
     */
    get sheets(): readonly SheetInfo[] {
        return this.#sheetsOf(this.shell.getState());
    }

    /** The roster {@link sheets} last listed, and the list, kept while the roster is unchanged. */
    #sheetList: {
        names: readonly string[];
        visibility: readonly SheetState[];
        colors: readonly (string | null | undefined)[];
        sheets: readonly SheetInfo[];
    } | null = null;

    #sheetsOf(state: UIState): readonly SheetInfo[] {
        const count = sheetCountOf(state);
        if (count === 0) return NO_SHEETS;
        const { planeNames: names, planeVisibility: visibility, planeColors: colors } = state;
        const kept = this.#sheetList;
        if (kept?.names === names && kept.visibility === visibility && kept.colors === colors) return kept.sheets;
        const sheets = Array.from({ length: count }, (_, i) => ({
            name: names[i] ?? "",
            visibility: visibility[i] ?? "visible",
            color: colors[i],
        }));
        this.#sheetList = { names, visibility, colors, sheets };
        return sheets;
    }

    /** The color theme, as {@link setTheme} or the toolbar's theme button last set it. */
    get theme(): ThemeMode {
        return this.shell.getState().theme;
    }

    /** Whether the document UI fills the screen, by {@link setFullscreen} or the toolbar menu's Fullscreen button. */
    get isFullscreen(): boolean {
        return this.shell.getState().isFullscreen;
    }

    /** How the view scrolls, as {@link setScrollMode} or the view settings last set it. */
    get scrollMode(): ScrollMode {
        return this.shell.getState().scrollMode;
    }

    /** How the pages group into spreads, as {@link setLayoutMode} or the view settings last set it. */
    get layoutMode(): LayoutMode {
        return this.shell.getState().layoutMode;
    }

    /** The turn every page is shown at, as {@link setPageRotation} or the view settings last set it. */
    get pageRotation(): 0 | 90 | 180 | 270 {
        return this.shell.getState().pageRotation;
    }

    /** The gaps between pages, as {@link setPageGap} last set them; `null` for the built-in gaps. */
    get pageGap(): PageGap | null {
        return this.shell.getState().pageGap;
    }

    /**
     * The fit the open document is shown by, as {@link setFit}, the zoom menu,
     * or an explicit zoom (`"none"`) last set it.
     */
    get fit(): Fit {
        return this.shell.getState().fit;
    }

    /** The zoom on screen, `1` being 100% — the fit's derived zoom while one is active. */
    get zoom(): number {
        return renderZoom(this.shell.getState());
    }

    /** The CSS px per inch the open document shows at: the `dpi` option or
     *  {@link setDpi}'s, else its doc type's default. */
    get dpi(): number {
        return viewDpi(this.shell.getState());
    }

    /** The open side panel, or `null` for none; `"panel:changed"` fires when it changes. */
    get activePanel(): PanelTab | null {
        return this.shell.getState().activePanel;
    }

    /** Where a followed link or outline item, or a chosen comment, lands, as {@link setNavigationScrollAlignment} last set it. */
    get navigationScrollAlignment(): ScrollAlignment {
        return this.shell.getState().navigationScrollAlignment;
    }

    /** Where a search match lands, as {@link setSearchScrollAlignment} last set it. */
    get searchScrollAlignment(): ScrollAlignment {
        return this.shell.getState().searchScrollAlignment;
    }

    /**
     * Dock the view-state controls (page nav + zoom + view settings) in the top
     * toolbar (`"top-toolbar"`), the bottom floating bar (`"floating"`, the
     * default), or the bottom status bar (`"status-bar"`). The initial value is
     * set at construction via `viewControlsPlacement`.
     */
    setViewControlsPlacement(placement: ViewControlsPlacement): void {
        this.shell.setViewControlsPlacement(placement);
    }

    /**
     * Subscribe to an event (e.g. `"currentPage:changed"`). Returns an
     * unsubscribe function. See {@link UDocEvents} for events + payloads.
     */
    on<K extends keyof E>(event: K, handler: EventHandler<E, K>): () => void {
        let handlers = this.#eventHandlers.get(event);
        if (!handlers) {
            handlers = new Set();
            this.#eventHandlers.set(event, handlers);
        }
        handlers.add(handler as EventHandler<E, keyof E>);
        this.#watchAnnotationChanges();
        return () => this.off(event, handler);
    }

    /** Unsubscribe a handler previously registered with {@link on}. */
    off<K extends keyof E>(event: K, handler: EventHandler<E, K>): void {
        this.#eventHandlers.get(event)?.delete(handler as EventHandler<E, keyof E>);
        this.#watchAnnotationChanges();
    }

    /** Read the annotations after each change only while a host listens for what changed. */
    #watchAnnotationChanges(): void {
        const listening = (["annotation:inserted", "annotation:updated", "annotation:removed"] as const).some(
            (event) => (this.#eventHandlers.get(event)?.size ?? 0) > 0,
        );
        this.shell.pageAnnotations.watch(listening);
    }

    /**
     * Fire `"viewport:changed"` for a painted frame that shows the view
     * otherwise than the last one it fired for. Returns the unsubscribe.
     */
    #watchViewport(): () => void {
        let last: Viewport | null = null;
        return this.shell.onPageViews((frame) => {
            // A frame painted for a viewport since moved on from is stale.
            if (!frame.fresh || this.shell.getState().status !== "ready") return;
            const next = viewportOf(frame, viewDpi(this.shell.getState()));
            if (last !== null && sameViewport(last, next)) return;
            last = next;
            this.#emit("viewport:changed", next);
        });
    }

    /** Fire one of the common events — the bridge above. */
    #emit<K extends keyof UDocEvents>(event: K, payload: UDocEvents[K]): void {
        this.emit(event, payload as E[K]);
    }

    /** Fire `event` to its handlers — a package's own events too. */
    protected emit<K extends keyof E>(event: K, payload: E[K]): void {
        const handlers = this.#eventHandlers.get(event);
        if (!handlers) return;
        for (const handler of handlers) {
            try {
                handler(payload);
            } catch (error) {
                console.error(`Error in "${String(event)}" handler:`, error);
            }
        }
    }

    /** Close the current document. */
    close(): void {
        this.shell.close();
    }

    /** Tear down components, listeners, and the render worker. */
    destroy(): void {
        for (const unsub of this.#unsubscribes) unsub();
        this.#unsubscribes.length = 0;
        this.#eventHandlers.clear();
        this.shell.destroy();
    }
}
