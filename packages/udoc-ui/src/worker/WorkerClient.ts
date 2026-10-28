import type { PerfSummary } from "../performance/index.js";
import type {
    DocumentLayout,
    PlaneInfo,
    HistoryState,
    PageView,
    PageViewsFrame,
    GridCellSelectOptions,
    ContentPadding,
    ScrollAlignment,
    ScrollMode,
    Fit,
    LayoutMode,
    PageGap,
    Peer,
    PeerPointer,
    Rect,
    RgbColor,
    SelectMode,
    SelectionGeometry,
    SelectionState,
    TableSelectOptions,
    TextCaretMove,
    TextSelectOptions,
    Size,
    Viewport,
} from "../geometry.js";
import { entitledCapabilities } from "../geometry.js";
import { CSS2_ENDPOINT } from "@docmentis/udoc-wasm/font-fulfill";
import type {
    AcroForm,
    ActionHideTarget,
    Annotation,
    Destination,
    DestinationView,
    Entitlements,
    Feature,
    FontInfoList,
    OptionalContentProperties,
    Outline,
    PageMode,
    SessionConfig,
    ExportFormat,
    FileFormat,
    PageExportFormat,
    SaveStrategy,
    GoogleFontFamily,
    ComposedShapeMedia,
    UDocCommand,
    UDocFragment,
    UDocHit,
    UDocSearchScope,
    UDocSelection,
    SearchContinuation,
    SearchMatchLocation,
    SearchOptions,
    UrlFont,
} from "@docmentis/udoc-wasm";
import { UDocError } from "@docmentis/udoc-wasm/error";
import type {
    FormWidget,
    MediaFile,
    PageAnnotations,
    PageComments,
    PageViewsReport,
    SearchReply,
    SelectedAnnotations,
    SelectionEdit,
    ThumbnailResult,
    WorkerOutbound,
    ExtensionRequest,
    WorkerRequest,
} from "./protocol.js";
import { resolveWasmCandidates } from "./wasm-loader.js";
import type { WasmCandidate, WasmLocateOptions } from "./wasm-loader.js";

interface Pending {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
}

/** Floats per page in a {@link PageViewsReport} buffer:
 *  `[index, x, y, w, h, rotation]`. */
const PAGE_VIEW_STRIDE = 6;

/**
 * Most decoded thumbnail bitmaps kept at once. Thumbnails are small, so the
 * cache is count-bounded (not byte-bounded like the viewer's page cache); the
 * least-recently-used is evicted past this. Comfortably covers a long strip's
 * visible window plus overscan plus recently-scrolled-away pages.
 */
const THUMBNAIL_CACHE_LIMIT = 256;

/**
 * The least time between two {@link WorkerClient.noteActivity} pings posted.
 * The worker's background work waits 300 ms past the last, so a ping this
 * often keeps it as good as exact, at a message per frame or three.
 */
const ACTIVITY_PING_MS = 50;

/** Message carried by a rejected thumbnail request the panel skips silently
 *  (a superseded scale or a cancelled / invalidated render — not an error). */
export const THUMBNAIL_DROPPED = "thumbnail dropped";

/**
 * Request types that change document pixels, so every cached thumbnail may be
 * stale after one. {@link WorkerClient.#send} drops the thumbnail cache after
 * posting any of these. `updateLayout` is **not** here — it only composes *new*
 * pages; already-rendered thumbnails stay valid.
 */
const MUTATING_REQUESTS: ReadonlySet<string> = new Set<WorkerRequest["type"]>([
    "open",
    "openRemote",
    "history", // undo / redo
    "execute", // every addressed write (page edits, object inserts, host commands)
    "executeOnSelection", // every selection-relative write (move / rotate / delete / …)
    "merge",
]);

/** A thumbnail render queued in the worker and not yet answered, keyed by page index. */
interface ThumbnailRequest {
    /** Cache key `page:scale` — distinguishes a re-request at a new scale. */
    key: string;
    promise: Promise<ImageBitmap>;
}

/**
 * What the engine is told about who is running it, and under what license.
 *
 * The domain is read here rather than in the worker, whose own location is the
 * worker script's rather than the embedding page's. Everything else is the
 * embedder's to declare.
 */
export interface LicenseOptions {
    /** Commercial license key. Absent is free/unlicensed usage, which is
     *  metered and needs the engine to reach the permit service. */
    license?: string;
    /** Ask for the "Powered by docMentis" decal not to be painted. Honored only
     *  with a license; otherwise ignored. */
    hideAttribution?: boolean;
    /** Ask for usage not to be reported. Honored only with a license;
     *  otherwise ignored. */
    disableTelemetry?: boolean;
}

/** The fonts every session offers beyond the package's own. */
export interface FontOptions {
    /** The host's own fonts, as {@link WorkerClient.registerFonts} takes them.
     *  Absent is none. */
    fonts?: ReadonlyArray<Uint8Array | UrlFont>;
    /** Offer Google Fonts at all. Absent is `true`. */
    enableGoogleFonts?: boolean;
    /** The families offered. Absent is the catalog `startSession` offers. */
    googleFontFamilies?: GoogleFontFamily[];
    /** Where css2 is asked for them. Absent is Google's own. */
    googleFontEndpoint?: string | URL;
    /** Use the fonts available to the user's browser for a family nothing
     *  registered or served online has. Absent is `true`. */
    enableCanvasFonts?: boolean;
}

/** The features the embedder offers its users, of those the license grants. */
export interface FeatureOptions {
    /** Offer annotating. Absent is `true`. */
    enableAnnotation?: boolean;
    /** Offer form filling. Absent is `true`. */
    enableFormFilling?: boolean;
}

/** The docMentis component embedding the engine, reported with every permit
 *  and usage report so the service can tell the wrappers apart. Not an
 *  embedder's option: each docMentis package names itself through the
 *  `./internal` entry. */
export interface Wrapper {
    name: string;
    version: string;
}

/** Where the anonymous per-user id is kept between visits. */
const DISTINCT_ID_KEY = "udoc_distinct_id";

/** Everything {@link WorkerClient.create} needs: where to find the WASM, the
 *  license, the fonts and the features offered. */
export type CreateClientOptions = { wasm?: WasmLocateOptions } & LicenseOptions & FontOptions & FeatureOptions;

function isSupported(): boolean {
    return (
        typeof Worker !== "undefined" &&
        typeof OffscreenCanvas !== "undefined" &&
        typeof HTMLCanvasElement !== "undefined" &&
        typeof HTMLCanvasElement.prototype.transferControlToOffscreen === "function"
    );
}

/**
 * The anonymous per-user id reported with every permit and usage event,
 * persisted so a returning visitor stays one person.
 *
 * Where storage is blocked the id lasts for this page only. Where there is no
 * `crypto.randomUUID` — an insecure origin — there is none, and the service
 * attributes the event to its domain instead.
 */
function getOrCreateDistinctId(): string | undefined {
    const mint = () => (typeof crypto.randomUUID === "function" ? crypto.randomUUID() : undefined);
    try {
        const stored = localStorage.getItem(DISTINCT_ID_KEY);
        if (stored) return stored;
        const id = mint();
        if (id !== undefined) localStorage.setItem(DISTINCT_ID_KEY, id);
        return id;
    } catch {
        return mint();
    }
}

/**
 * What a session this page starts is started with: `options`, as the embedder
 * declared them, the page's own domain, and the `wrapper` it runs in.
 */
export function sessionConfigOf(options: LicenseOptions, wrapper: Wrapper): SessionConfig {
    const distinctId = options.disableTelemetry ? undefined : getOrCreateDistinctId();
    return {
        domain: typeof window === "undefined" ? "unknown" : window.location.hostname,
        wrapper: wrapper.name,
        wrapperVersion: wrapper.version,
        ...(options.license !== undefined ? { license: options.license } : {}),
        ...(distinctId !== undefined ? { distinctId } : {}),
        hideAttribution: options.hideAttribution ?? false,
        disableTelemetry: options.disableTelemetry ?? false,
    };
}

/**
 * The main thread's handle on the render worker. Its whole job is to talk to the
 * worker: it owns no pixels.
 *
 * `attach` transfers the canvas into the worker (which then owns the
 * OffscreenCanvas, the compositor, and the rAF loop); everything else is a
 * `postMessage`. Viewport/invalidate/close are fire-and-forget (latest wins);
 * `open` is request/response, correlated by an incrementing id.
 */
export class WorkerClient {
    readonly #worker: Worker;
    readonly #pending = new Map<number, Pending>();
    /** What each session is started with. Fixed for the client's life — a
     *  license change means a new client. */
    readonly #config: SessionConfig;
    /** The features the embedder turned off, taken out of what each session
     *  is entitled to. Fixed for the client's life. */
    readonly #withheld: ReadonlySet<Feature>;
    /** The Google font families every session offers — `[]` with Google Fonts
     *  off, and `undefined` for the catalog `startSession` offers unless told
     *  otherwise. */
    readonly #googleFontFamilies: GoogleFontFamily[] | undefined;
    /** Where the worker asks css2 for a Google family's faces. */
    readonly #googleFontEndpoint: string;
    readonly #enableCanvasFonts: boolean;
    /** What the license granted the most recently started session. `null`
     *  until the first document is opened. */
    #entitlements: Entitlements | null = null;
    readonly #pageViewListeners = new Set<(frame: PageViewsFrame) => void>();
    readonly #selectionListeners = new Set<(state: SelectionState) => void>();
    readonly #peersListeners = new Set<(peers: Peer[]) => void>();
    readonly #peerPointersListeners = new Set<(pointers: PeerPointer[]) => void>();
    readonly #historyListeners = new Set<(state: HistoryState) => void>();
    readonly #resizedListeners = new Set<(size: { width: number; height: number }) => void>();
    readonly #brandingRectListeners = new Set<(rect: Rect | null) => void>();
    /** Last branding rect seen, replayed to late subscribers (it's posted only
     *  on resize, so a subscriber mounting after the resize would otherwise miss
     *  it). `undefined` until the first report arrives. */
    #lastBrandingRect: Rect | null | undefined = undefined;
    readonly #perfListeners = new Set<(summary: PerfSummary) => void>();
    #nextId = 1;
    /** Seq of the latest viewport sent; reports echoing it are `fresh`. */
    #viewportSeq = 0;
    /** The `anchorShift` of the latest fresh report — what the host's scroll,
     *  adopted from it, was read against. Sent with each viewport. */
    #anchorShift = 0;

    // --- thumbnail rendering (cache here, queue in the worker) ------------
    /** Decoded thumbnail bitmaps, keyed `page:scale`, LRU-evicted. */
    readonly #thumbnailCache = new Map<string, { bitmap: ImageBitmap; lastAccess: number }>();
    /** The renders queued in the worker and not yet answered, by page index. */
    readonly #thumbnailRequests = new Map<number, ThumbnailRequest>();
    /** The page the strip is looking at, as the worker was last told. */
    #thumbnailFocus = 0;
    /** Bumped on every {@link invalidateThumbnails}; an in-flight render whose
     *  epoch is stale on return is discarded rather than cached. */
    #thumbnailEpoch = 0;
    /** When the last {@link noteActivity} ping was posted. */
    #activityPostedAt = -Infinity;
    /** Notified when the thumbnail cache is dropped, so the strip can refresh
     *  its visible window against the changed document. */
    readonly #thumbnailInvalidatedListeners = new Set<() => void>();
    /** Notified when a request that changes the document is sent. */
    readonly #documentChangedListeners = new Set<() => void>();
    /** Notified when landed fonts re-shaped the composed pages. */
    readonly #fontsRefreshedListeners = new Set<() => void>();
    /** Notified when a sheet loaded in the background, with its tab's colour. */
    readonly #planeLoadedListeners = new Set<(plane: number, color: string | null, chartsheet: boolean) => void>();
    /** Notified when the worker composed more of the document ahead of the reader. */
    readonly #composedListeners = new Set<(layout: DocumentLayout) => void>();

    private constructor(worker: Worker, options: LicenseOptions & FontOptions & FeatureOptions, wrapper: Wrapper) {
        this.#worker = worker;
        this.#config = sessionConfigOf(options, wrapper);
        this.#withheld = new Set<Feature>([
            ...(options.enableAnnotation === false ? (["annotation"] as const) : []),
            ...(options.enableFormFilling === false ? (["formFilling"] as const) : []),
        ]);
        this.#googleFontFamilies = options.enableGoogleFonts === false ? [] : options.googleFontFamilies;
        this.#googleFontEndpoint =
            options.googleFontEndpoint === undefined ? CSS2_ENDPOINT : new URL(options.googleFontEndpoint).href;
        this.#enableCanvasFonts = options.enableCanvasFonts !== false;
        worker.onmessage = (ev: MessageEvent<WorkerOutbound>) => this.#onMessage(ev.data);
        worker.onerror = (ev) =>
            this.#failAll(new UDocError("crashed", ev instanceof ErrorEvent ? ev.message : "worker error"));
    }

    /**
     * Spawn the render worker and load + initialize the WASM, returning a ready
     * client.
     *
     * Throws an `unsupported` {@link UDocError} on runtimes without
     * OffscreenCanvas (Safari < 16.4, old iOS WebViews). The WASM artifacts are
     * located by trying a candidate URL list (explicit host → `import.meta.url`
     * → CDN) until one initializes — the fix for "wasm not found" across
     * bundlers/hosts.
     */
    static async create(
        options: CreateClientOptions,
        wrapper: Wrapper,
        startWorker: () => Worker,
    ): Promise<WorkerClient> {
        if (!isSupported()) {
            throw new UDocError(
                "unsupported",
                "This browser lacks OffscreenCanvas-in-worker support (needs Safari 16.4+, " +
                    "or a current Chrome/Firefox). udoc cannot render here.",
            );
        }

        const candidates = await resolveWasmCandidates(options.wasm);
        const worker = startWorker();
        const client = new WorkerClient(worker, options, wrapper);

        let lastError: unknown;
        for (const candidate of candidates) {
            try {
                await client.#init(candidate);
                // Sent as `registerFonts` sends them, before anything can open.
                if (options.fonts) client.registerFonts(options.fonts);
                return client;
            } catch (err) {
                lastError = err;
            }
        }

        client.destroy();
        throw lastError instanceof UDocError
            ? lastError
            : new UDocError("io", "WorkerClient.create: WASM failed to load from all candidate URLs.");
    }

    /** Hand the worker the canvas it paints into (transferred as an OffscreenCanvas). */
    attach(canvas: HTMLCanvasElement): void {
        const offscreen = canvas.transferControlToOffscreen();
        this.#post({ type: "attach", canvas: offscreen }, [offscreen]);
    }

    /**
     * Offer the host's own fonts to every document opened after this — each a
     * font file's bytes, or a {@link UrlFont} fetched once a document's text
     * asks for it. Fire-and-forget: the worker takes messages in order, so a
     * later {@link open} sees them.
     */
    registerFonts(fonts: ReadonlyArray<Uint8Array | UrlFont>): void {
        const local: Uint8Array[] = [];
        const url: UrlFont[] = [];
        for (const font of fonts) {
            if (font instanceof Uint8Array) local.push(font);
            else url.push(font);
        }
        this.#post({ type: "registerFonts", local, url });
    }

    /**
     * Open a document from raw bytes into the session {@link start} started —
     * as `format` when given, which skips detection, and a CSV split by
     * `delimiter` when given. Resolves with the
     * document's initial layout (page count + content size). Both are dynamic
     * and may change later as the document is edited — this is just the layout
     * at open time.
     */
    async open(bytes: Uint8Array, format?: FileFormat, delimiter?: string): Promise<DocumentLayout> {
        // Transfer the bytes' buffer to avoid a structured-clone copy. Slice to a
        // fresh buffer first so we never detach memory the caller still holds.
        const buffer = bytes.slice().buffer;
        return (await this.#send(
            {
                type: "open",
                bytes: buffer,
                ...(format !== undefined ? { format } : {}),
                ...(delimiter !== undefined ? { delimiter } : {}),
            },
            [buffer],
        )) as DocumentLayout;
    }

    /**
     * Open the package a server keeps at `url` — its package resource,
     * `…/documents/{documentId}/package` — fetching each part the first time
     * the document needs it, into the session {@link start} started. Resolves
     * with the initial layout, as {@link open} does. `url` resolves against the
     * page, since the worker can't.
     */
    async openRemote(url: string): Promise<DocumentLayout> {
        const absolute = new URL(url, location.href).href;
        return (await this.#send({ type: "openRemote", url: absolute })) as DocumentLayout;
    }

    /**
     * Unlock the open document, which needs a password (its layout said
     * `needsPassword`), with `password`. Resolves with the layout, as
     * {@link open} does: still `needsPassword` when `password` was refused,
     * the document's own once it opens. Not a second open — the document's
     * session is the one {@link open} started.
     */
    async authenticate(password: string): Promise<DocumentLayout> {
        return (await this.#send({ type: "authenticate", password })) as DocumentLayout;
    }

    /**
     * Start the session the next document opens in — before its bytes are
     * even read, so a refusal comes before a download. A session is one
     * document long, so every open starts a fresh one: this is where the
     * license is checked and, unlicensed, where the engine gets its permit. It
     * rejects with the refusal — a quota, or an unreachable service — and no
     * document is opened.
     */
    async start(): Promise<void> {
        const entitlements = (await this.#send({
            type: "start",
            config: this.#config,
        })) as Entitlements;
        const features = entitlements.features.filter((feature) => !this.#withheld.has(feature));
        this.#entitlements = { ...entitlements, features };
    }

    /** What the license granted the open document's session, less the
     *  features the embedder turned off, or `null` before the first
     *  {@link start}. What the UI offers; the engine enforces the license's
     *  own at the call each guards, so the host's API still has the rest. */
    get entitlements(): Entitlements | null {
        return this.#entitlements;
    }

    /** Where css2 is asked for a Google family's faces — the host's
     *  `googleFontEndpoint`, else Google's own. Fixed for the client's life. */
    get googleFontEndpoint(): string {
        return this.#googleFontEndpoint;
    }

    /** Update the painted window (scroll / zoom / resize). Latest-wins. */
    setViewport(viewport: Viewport): void {
        this.#post({ type: "setViewport", viewport, anchorShift: this.#anchorShift, seq: ++this.#viewportSeq });
    }

    /**
     * Scroll so page `index` (0-based) is brought to the top of the viewport —
     * the "go to page N" intent. The worker composes the target page, moves the
     * camera, and streams the resulting scroll + current page back in the next
     * {@link PageViewsFrame} (which the shell adopts when `frame.fresh`). Shares
     * the viewport seq so that frame is recognized as fresh. Latest-wins,
     * fire-and-forget.
     */
    goToPage(index: number): void {
        this.#post({ type: "goToPage", index, seq: ++this.#viewportSeq });
    }

    /**
     * Bring `rect` (page-local points) on page `index` (0-based) into view as
     * `alignment` says, keeping the zoom — `"top"` is a PDF `/XYZ`
     * destination's landing. The worker composes the target page and moves
     * the camera; the resulting scroll streams back as {@link goToPage}'s
     * does. Latest-wins, fire-and-forget.
     */
    goToRect(index: number, rect: Annotation["rect"], alignment: ScrollAlignment): void {
        this.#post({ type: "goToRect", index, rect, alignment, seq: ++this.#viewportSeq });
    }

    /**
     * Zoom to `zoom` keeping the content under the CSS-px viewport point
     * (`x`, `y`) fixed on screen — cursor-anchored zoom. The engine owns the
     * resulting scroll, so it's exact at any step (no host-side drift), and
     * streams scroll + zoom back in the next {@link PageViewsFrame}. Shares the
     * viewport seq so that frame is recognized as fresh. Latest-wins.
     */
    zoomAtPoint(zoom: number, x: number, y: number): void {
        this.#post({ type: "zoomAtPoint", zoom, x, y, seq: ++this.#viewportSeq });
    }

    /**
     * Fit a CSS-px viewport rectangle to the viewport and centre it — the
     * marquee zoom. The engine derives the zoom and resolves the scroll after
     * re-arranging (correct across screen-fixed page spacing), streaming the
     * result back in the next {@link PageViewsFrame}. Latest-wins.
     */
    zoomToRect(x: number, y: number, width: number, height: number): void {
        this.#post({ type: "zoomToRect", x, y, width, height, seq: ++this.#viewportSeq });
    }

    /** Mark a document-space region dirty; omit `rect` for the whole window. */
    invalidate(rect?: Rect): void {
        this.#post(rect ? { type: "invalidate", rect } : { type: "invalidate" });
    }

    /**
     * Set the viewport backdrop color (the gaps around and between pages).
     * Sticky: the worker re-applies it to every document opened afterwards, so
     * call it once after {@link attach} (or any time to recolor live).
     * Latest-wins, fire-and-forget.
     */
    setBackdrop(color: RgbColor): void {
        this.#post({ type: "setBackdrop", color });
    }

    /**
     * Set the page-border color: the 1-device-pixel frame the engine paints just
     * outside each page (typically the theme's outline), or `null` to draw none
     * where the pages touch. Sticky across opens like the backdrop, so call it
     * once after {@link attach} (or any time to recolor live). Latest-wins,
     * fire-and-forget.
     */
    setPageBorder(color: RgbColor | null): void {
        this.#post({ type: "setPageBorder", color });
    }

    /**
     * Set how far, in CSS px, the brand decal sits in from the viewport's bottom
     * and right edges — the thickness of scrollbars floating over the canvas, or
     * `0` to tuck it flush into the corner. Sticky across opens like the
     * backdrop. Latest-wins, fire-and-forget; the moved rect arrives through
     * {@link onBrandingRect}.
     */
    setBrandingInset(inset: number): void {
        this.#post({ type: "setBrandingInset", inset });
    }

    // NOTE: `setGuideColors` / `setRulerVisible` were removed — guide chrome is
    // host-rendered now (colors are CSS, visibility is DOM). The guide render
    // list arrives per frame on {@link PageViewsFrame.guide}.

    /**
     * Set the page arrangement's spacing: the `pageGap` between adjacent pages
     * (document points, page-fixed — scales with zoom; across a spread and down
     * from one spread to the next) and the `contentPadding` on each edge of the
     * content block (page-fixed `{ pt }` or screen-fixed `{ px }`, constant on
     * screen — sized for screen chrome living in the margins, like the
     * page-controls rail). Sticky across opens like the backdrop. Latest-wins,
     * fire-and-forget.
     */
    setSpacing(contentPadding: ContentPadding, pageGap: PageGap): void {
        this.#post({ type: "setSpacing", contentPadding, pageGap });
    }

    /**
     * Set the scrollbar size, in CSS px: the strip the engine keeps clear along
     * the right edge while the vertical bar shows and along the bottom while
     * the horizontal one does ({@link PageViewsFrame.scrollbars} says which
     * show), or `0` for bars that float over the content. Sticky across opens
     * like the spacing. Latest-wins, fire-and-forget.
     */
    setScrollbarSize(size: number): void {
        this.#post({ type: "setScrollbarSize", size });
    }

    /**
     * Set the fit: the viewer derives its own zoom to fit the current spread
     * into the viewport and re-derives it on resize. Its `mode` is `"none"`,
     * `"width"`, `"height"`, `"both"` (contain) or `"either"` (cover); its
     * `zoomCap` caps the derived zoom (`null` uncapped, `1` to never enlarge
     * past natural size). While a fit is active the per-frame viewport zoom is
     * ignored; the derived zoom rides back in each {@link PageViewsFrame}'s
     * `scale`. Sticky across resizes in the worker. Latest-wins,
     * fire-and-forget.
     */
    setFit(fit: Fit): void {
        this.#post({ type: "setFit", fit });
    }

    /**
     * Set the fit every document opens with in place of its doc type's
     * default; `null` restores the doc type's. Sticky across opens in the
     * worker. Latest-wins, fire-and-forget.
     */
    setDefaultFit(fit: Fit | null): void {
        this.#post({ type: "setDefaultFit", fit });
    }

    /**
     * Set the screen's CSS px per physical inch, which 100% is measured
     * against; `null` keeps each doc type's default. Sticky across opens in the
     * worker. Latest-wins, fire-and-forget.
     */
    setDpi(dpi: number | null): void {
        this.#post({ type: "setDpi", dpi });
    }

    /**
     * Set the explicit zoom every document opens at while the fit it opens
     * with is `none`. Latest-wins, fire-and-forget.
     */
    setDefaultZoom(zoom: number): void {
        this.#post({ type: "setDefaultZoom", zoom });
    }

    /**
     * Switch the open document's scroll mode: `"spread"` (one spread at a
     * time) or `"continuous"` (the scrolling stack); the next opens in the
     * default scroll mode ({@link setDefaultScrollMode}). A live switch keeps
     * the current page in view (the resulting scroll/extent rides back in the
     * next {@link PageViewsFrame}). Latest-wins, fire-and-forget.
     */
    setScrollMode(mode: ScrollMode): void {
        this.#post({ type: "setScrollMode", mode });
    }

    /**
     * Set the scroll mode every document opens in in place of its doc type's
     * default; `null` restores the doc type's. Sticky across opens in the
     * worker. Latest-wins, fire-and-forget.
     */
    setDefaultScrollMode(mode: ScrollMode | null): void {
        this.#post({ type: "setDefaultScrollMode", mode });
    }

    /**
     * Set how the layout groups pages into spreads. Sticky across opens in the
     * worker like the spacing; the re-stacked arrangement rides back in the
     * next {@link PageViewsFrame}. Latest-wins, fire-and-forget.
     */
    setLayoutMode(mode: LayoutMode): void {
        this.#post({ type: "setLayoutMode", mode });
    }

    /**
     * Turn every page `quarterTurns` quarter turns clockwise (`0`–`3`) on top of
     * its own rotation — a view setting, never a document edit. Sticky across
     * opens in the worker like the spacing; the re-stacked arrangement rides
     * back in the next {@link PageViewsFrame}. The thumbnails render turned
     * alike, so they redraw ({@link invalidateThumbnails}). Latest-wins,
     * fire-and-forget.
     */
    setPageRotation(quarterTurns: number): void {
        this.#post({ type: "setPageRotation", quarterTurns });
        // After the post, as `#send` does for an edit, so a thumbnail the
        // strip re-requests queues behind the turn.
        this.invalidateThumbnails();
    }

    /**
     * Toggle the worker's performance counter. When enabled, repaint timings
     * stream to every {@link onPerformance} listener roughly once per second.
     * Latest-wins, fire-and-forget.
     */
    setPerf(enabled: boolean): void {
        this.#post({ type: "setPerf", enabled });
    }

    /**
     * Subscribe to the worker's performance summaries (repaint timings),
     * streamed roughly once per second while {@link setPerf} has the counter
     * enabled. Returns an unsubscribe function.
     */
    onPerformance(listener: (summary: PerfSummary) => void): () => void {
        this.#perfListeners.add(listener);
        return () => this.#perfListeners.delete(listener);
    }

    /**
     * Compose through page index `pageLimit` (inclusive), now. Resolves with
     * the document's grown layout (composed page count + content size) and
     * `complete` — whether the document is now fully composed. Pages compose
     * lazily, and the worker composes ahead of the reader on its own
     * ({@link onComposed}); this is for what can't wait for it — a print, which
     * composes with a rising limit until `complete` to learn the page count,
     * or a render of a page not composed yet.
     */
    async updateLayout(pageLimit: number): Promise<DocumentLayout> {
        return (await this.#send({ type: "updateLayout", pageLimit })) as DocumentLayout;
    }

    /**
     * The next batch of `query`'s matches in `scope` (null for the whole
     * document), from `from` — the continuation the batch before handed back —
     * or from the start. Stateless; each match carries its page, its highlight
     * quads and its context. Resolves with the batch and the layout after it,
     * since a search lays out the pages its matches are drawn on.
     */
    async search(
        query: string,
        options: SearchOptions,
        scope: UDocSearchScope | null,
        from: SearchContinuation | null,
    ): Promise<SearchReply> {
        return (await this.#send({ type: "search", query, options, scope, from })) as SearchReply;
    }

    /**
     * The selection naming the text of the match found at `location` — the
     * separate step from a match to a selection — or null when nothing there
     * can be selected. A pure read: hand it to {@link setSelection} to select.
     */
    async searchMatchSelection(location: SearchMatchLocation): Promise<UDocSelection | null> {
        return (await this.#send({ type: "searchMatchSelection", location })) as UDocSelection | null;
    }

    /**
     * Kick the worker's font pump — start fetching whatever the engine has on
     * order. Resolves once the fetches are *started*, so this holds nothing up
     * and is safe to send mid-gesture.
     *
     * There is no round to drive and no result to wait for: the worker installs
     * each batch as it lands, repaints, and re-arms itself while anything is
     * still on order (a re-shape can reveal more families, and a vendor that
     * turned out not to have the characters advances the chain). Send it after a
     * layout change; the rest happens without the host.
     */
    async fetchFontOrders(): Promise<void> {
        await this.#send({ type: "fetchFontOrders" });
    }

    /**
     * Fetch what is on order, and resolve once nothing is: `true` if anything
     * was, so the composed pages may have been laid out again — and composing
     * further may put more on order — else `false` at once.
     */
    async settleFonts(): Promise<boolean> {
        return (await this.#send({ type: "settleFonts" })) as boolean;
    }

    /**
     * Get `family` here before you apply it, so the text changes once.
     *
     * A family the document has never used lays out in a stand-in, gets
     * requested then, and reflows when it lands — two jumps for one click. Await
     * this before applying the change and there is only one: the request goes
     * straight to in-flight, so the pump never takes it and nothing re-shapes.
     * Pass every `(bold, italic)` face the change will produce — a selection
     * spanning faces needs each binary, or the parts it didn't cover reflow on
     * their own later.
     *
     * Resolves `true` once the font covers the selection — at once when it
     * already did, or nothing is selected. Resolves `false` when nothing is left
     * to try or the wait ran past its cap; **apply the change either way**,
     * since `false` only means it will look the way it always did.
     */
    async ensureFont(family: string, faces: Array<[boolean, boolean]>): Promise<boolean> {
        return (await this.#send({ type: "ensureFont", family, faces })) as boolean;
    }

    /**
     * Read the document's plane roster — the source of the spreadsheet sheet
     * tabs: the plane count, the active plane, and each plane's name. Planes are
     * workbook structure (stable until an edit), so the host pulls this once on
     * open. A single-plane doc type resolves to `{ count: 1, current: 0, names:
     * [""] }`.
     */
    async planeInfo(): Promise<PlaneInfo> {
        return (await this.#send({ type: "planeInfo" })) as PlaneInfo;
    }

    /**
     * Switch the active plane — the current sheet of a multi-sheet spreadsheet
     * (0-based). The viewer resets to the new plane's top; resolves with the
     * layout known before the frame composes it (page count + content size) —
     * the frame that paints the plane reports its extent, and the worker
     * composes ahead on it from there. A no-op for a single-plane doc type.
     */
    async goToPlane(plane: number): Promise<DocumentLayout> {
        return (await this.#send({ type: "goToPlane", plane })) as DocumentLayout;
    }

    /**
     * Undo the last edit — document-wide and doc-type-agnostic, so it lives on
     * the client root, not {@link portable}. Resolves with the document's new
     * layout (the undo may have changed the page count) so the caller can
     * refresh scroll bounds.
     */
    async undo(): Promise<DocumentLayout> {
        return (await this.#send({ type: "history", op: "undo" })) as DocumentLayout;
    }

    /** Redo the last undone edit (see {@link undo}). */
    async redo(): Promise<DocumentLayout> {
        return (await this.#send({ type: "history", op: "redo" })) as DocumentLayout;
    }

    /**
     * Mint one fresh, CRDT-safe id (its 32-char hex key) for a host building a
     * new object to insert — the host stamps it into the object, then commits it
     * in an `InsertObjects` command via {@link execute}. Id allocation is the
     * session's, so a drawn / pasted id can't collide. Resolves to `null` with no
     * open document or a doc type that mints no ids. Doc-type-agnostic, so it
     * lives on the client root, not {@link portable}.
     */
    async mintId(): Promise<string | null> {
        return (await this.#send({ type: "mintId" })) as string | null;
    }

    /**
     * Send `request`, which a handler the product's worker adds answers (see
     * `serveEngine`), and resolve with its reply. `transfer` moves buffers
     * rather than copying them; `changesDocument` marks a request that edits
     * the document, so the thumbnails redraw and the document-changed cue fires
     * as they do for the engine's own edits.
     */
    request<T>(
        request: ExtensionRequest,
        options: { readonly transfer?: Transferable[]; readonly changesDocument?: boolean } = {},
    ): Promise<T> {
        return this.#send(request, options.transfer, options.changesDocument ?? false) as Promise<T>;
    }

    /** Post `request` to a handler the product's worker adds, with no reply
     *  wanted — a setting, latest wins. */
    post(request: ExtensionRequest): void {
        this.#post(request);
    }

    /**
     * Execute one arbitrary, doc-type-tagged {@link UDocCommand} directly — the
     * generic write seam beneath the named {@link portable} verbs, for a host
     * that builds its own commands. A committing edit (one undo step), so it
     * resolves with the document's new layout; selection/geometry changes
     * follow via {@link onSelection}. Doc-type-agnostic, so it lives on the
     * client root, not {@link portable}.
     */
    async execute(command: UDocCommand): Promise<DocumentLayout> {
        return (await this.#send({ type: "execute", command })) as DocumentLayout;
    }

    /**
     * Apply a {@link SelectionEdit} to the current selection — the move / rotate /
     * scale / delete / reorder / group / ungroup the canvas and ribbon drive.
     * Unlike {@link execute} (an addressed command), the edit names no ids: the
     * worker resolves the live selection and open doc type to the right command,
     * so a hot-path drag-commit needs no selection round-trip and the caller
     * stays format-agnostic. Doc-type-agnostic, so it lives on the client root,
     * not {@link portable}. A committing edit (one undo step), so it resolves with
     * the document's new layout; the refreshed selection geometry follows via
     * {@link onSelection}.
     */
    async executeOnSelection(edit: SelectionEdit): Promise<DocumentLayout> {
        return (await this.#send({ type: "executeOnSelection", edit })) as DocumentLayout;
    }

    /**
     * Set a **text** selection from a pointer gesture between two points (CSS px,
     * canvas-relative): `anchor` where the press began, `focus` its live end
     * (equal for a plain click). `options` ({@link TextSelectOptions} —
     * `granularity`, `extend`, `global`) is optional per field. The host routes
     * here after a {@link hitTest} says the anchor is over text (a doc's body
     * caret, or a text object being edited). The resulting geometry arrives via
     * {@link onSelection}. Latest-wins, fire-and-forget.
     */
    selectText(
        anchor: { x: number; y: number },
        focus: { x: number; y: number },
        options: TextSelectOptions = {},
    ): void {
        this.#post({ type: "selectText", anchor, focus, options });
    }

    /**
     * Set an **object** selection from a pointer gesture (CSS px): a click picks
     * the topmost object, a drag sweeps a marquee. `mode` is how the pick
     * combines with the current selection; `enclose` is the marquee's window rule
     * (`true` fully-contained only, `false` any-overlap — a click ignores it).
     * The object domain has no options struct, so these cross directly. The host
     * routes here when a {@link hitTest} says the anchor is over an object or bare
     * canvas. Distinct from {@link portable.selectObjects}, which selects by id;
     * this is the pointer pick. Geometry arrives via {@link onSelection}.
     * Latest-wins, fire-and-forget.
     */
    selectObjects(
        anchor: { x: number; y: number },
        focus: { x: number; y: number },
        mode: SelectMode,
        enclose = false,
    ): void {
        this.#post({ type: "selectObjects", anchor, focus, mode, enclose });
    }

    /**
     * Set a **page** selection from a thumbnail gesture — the whole pages (a
     * deck's slides) from page `anchor` to page `focus`, indices in the page
     * order, either way round. `mode` is how they combine with the current
     * selection: a press is `(i, i, "replace")`, a Ctrl/Cmd press
     * `(i, i, "toggle")`, a Shift press `(anchor, i, "replace")` from the
     * caller's own anchor. Only a PDF and a deck respond. Geometry arrives via
     * {@link onSelection}, its `pages` the indices to tint. Latest-wins,
     * fire-and-forget.
     */
    selectPages(anchor: number, focus: number, mode: SelectMode): void {
        this.#post({ type: "selectPages", anchor, focus, mode });
    }

    /**
     * Set a **cell** selection from a pointer gesture (CSS px) — a block on the
     * active sheet of a spreadsheet, `anchor` the active cell and `focus` the
     * live corner. `options` ({@link GridCellSelectOptions} — `extend`) is optional.
     * Geometry arrives via {@link onSelection}. Latest-wins, fire-and-forget.
     */
    selectSheetCells(
        anchor: { x: number; y: number },
        focus: { x: number; y: number },
        options: GridCellSelectOptions = {},
    ): void {
        this.#post({ type: "selectSheetCells", anchor, focus, options });
    }

    /**
     * Set a **table cell** selection from a pointer gesture (CSS px) — a block
     * inside one graphic frame's table, `anchor` the cell the gesture began in
     * and `focus` the live corner. `options` ({@link TableSelectOptions} —
     * `extend`) is optional.
     *
     * The drawing cousin of {@link selectSheetCells}, and routed to on the same
     * evidence: a {@link hitTest} that reports a table cell. Which of the two
     * verbs a table gesture takes is the *gesture's* question, not the hit's — a
     * press and a drag that stay inside one cell mean that cell's text, so they
     * go to {@link selectText}; crossing into another cell means the block, and
     * comes here. Geometry arrives via {@link onSelection}. Latest-wins,
     * fire-and-forget.
     */
    selectTableCells(
        anchor: { x: number; y: number },
        focus: { x: number; y: number },
        options: TableSelectOptions = {},
    ): void {
        this.#post({ type: "selectTableCells", anchor, focus, options });
    }

    /**
     * Widen the current table selection to the whole **rows** it touches — the
     * right-click Select ▸ Row command. Point-free: a table has no header band
     * to press, so this acts on whatever is already picked (a caret in a cell
     * widens to its row). A no-op outside a table. Geometry arrives via
     * {@link onSelection}. Fire-and-forget.
     */
    selectTableRows(): void {
        this.#post({ type: "selectTableRows" });
    }

    /** Widen to the whole **columns** — Select ▸ Column, the twin of
     *  {@link selectTableRows}. */
    selectTableColumns(): void {
        this.#post({ type: "selectTableColumns" });
    }

    /** Widen to the **whole table** — Select ▸ Table. */
    selectTable(): void {
        this.#post({ type: "selectTable" });
    }

    /**
     * Select whole **columns** from a header gesture (CSS px) — a press / drag on
     * the top header band. The x resolves the column run (`anchor` the active
     * column, `focus` the live end); the y is ignored. `options`
     * ({@link GridCellSelectOptions} — `extend`) is optional. Spreadsheet only.
     * Geometry arrives via {@link onSelection}. Latest-wins, fire-and-forget.
     */
    selectSheetColumns(
        anchor: { x: number; y: number },
        focus: { x: number; y: number },
        options: GridCellSelectOptions = {},
    ): void {
        this.#post({ type: "selectSheetColumns", anchor, focus, options });
    }

    /**
     * Select whole **rows** from a header gesture (CSS px) — a press / drag on the
     * left header band. The y resolves the row run; the x is ignored. The row
     * mirror of {@link selectSheetColumns}.
     */
    selectSheetRows(
        anchor: { x: number; y: number },
        focus: { x: number; y: number },
        options: GridCellSelectOptions = {},
    ): void {
        this.#post({ type: "selectSheetRows", anchor, focus, options });
    }

    /**
     * Select the whole sheet — a press on the header corner box. Spreadsheet only.
     * Geometry arrives via {@link onSelection}. Fire-and-forget.
     */
    selectSheet(): void {
        this.#post({ type: "selectSheet" });
    }

    /**
     * Move the text caret per a keyboard `movement` (arrows / Home / End),
     * extending the selection instead of collapsing when Shift is held.
     * Presence only — not an edit, not undoable; the fresh geometry arrives
     * via {@link onSelection}. Fire-and-forget.
     */
    moveTextCaret(movement: TextCaretMove, extend: boolean): void {
        this.#post({ type: "moveTextCaret", movement, extend });
    }

    /**
     * Clear the selection (e.g. on leaving edit mode). Doc-type-agnostic
     * presence, so it stays on the root. The now-empty geometry arrives via
     * {@link onSelection}. Fire-and-forget.
     */
    clearSelection(): void {
        this.#post({ type: "clearSelection" });
    }

    /**
     * Pick at a viewport point (CSS px, canvas-relative): the whole hit as a
     * {@link UDocHit} — the entity under the point and, for a text object, its
     * caret — the read behind the host's hover cursor (the I-beam over text) and
     * click routing. A pure read over the live layout (the same pick a
     * click-to-edit runs), so it can't disagree with what a click does and needs
     * no cached set that edits / collaborators could stale. Resolves `"none"` with no
     * open document. Cheap enough to call per pointer-move; the caller coalesces
     * it latest-wins.
     */
    async hitTest(x: number, y: number): Promise<UDocHit> {
        return (await this.#send({ type: "hitTest", x, y })) as UDocHit;
    }

    /**
     * The portable-document surface — the catalog read and id-addressed
     * selection that only apply to a PDF/portable document, grouped off the
     * agnostic client surface, mirroring the facade's `session.portable()`.
     * Writes are agnostic and stay on the client root ({@link execute},
     * {@link executeOnSelection}), as do {@link undo} / {@link redo}, the pointer
     * pickers ({@link selectText} / {@link selectObjects} / {@link selectSheetCells}),
     * and {@link clearSelection}.
     */
    readonly portable = {
        /**
         * The id (hex key) of the page at `index`, or `undefined` past the last
         * page — a pure read. The host maps a page index to its id with it
         * before issuing a content edit.
         */
        pageIdByIndex: (index: number): Promise<string | undefined> =>
            this.#send({ type: "pageIdByIndex", index }) as Promise<string | undefined>,

        /** The ids (hex keys) of every page, in page order — a pure read. */
        pageIds: (): Promise<string[]> => this.#send({ type: "pageIds" }) as Promise<string[]>,

        /**
         * The document's `/PageMode` — how it asks to be shown when it opens —
         * or `null` when it gives none. A pure read.
         */
        pageMode: (): Promise<PageMode | null> => this.#send({ type: "pageMode" }) as Promise<PageMode | null>,

        /**
         * The document's outline — its bookmarks, the whole tree — loaded on
         * first read; one with no items when it has none. A read: what the
         * outline panel draws.
         */
        outline: (): Promise<Outline> => this.#send({ type: "outline" }) as Promise<Outline>,

        /**
         * The document's font list — every font it has, and each an edit added
         * — loaded on first read; one with no fonts with no PDF open. A read: a
         * free text names its font by an entry's id.
         */
        fontInfoList: (): Promise<FontInfoList> => this.#send({ type: "fontInfoList" }) as Promise<FontInfoList>,

        /**
         * The document's interactive form — its terminal fields, each naming
         * its widget annotations — loaded on first read; one with no fields
         * when it has none. A read: which annotations are a field's widgets.
         */
        acroForm: (): Promise<AcroForm> => this.#send({ type: "acroForm" }) as Promise<AcroForm>,

        /**
         * The field the widget annotation `widget` on page `page` (hex keys)
         * belongs to, as the form holds it now, with the widget — or `null`
         * when no field lists it. A read: what filling the field in, with a
         * `FillAcroFormFields` command, starts from.
         */
        formWidget: (page: string, widget: string): Promise<FormWidget | null> =>
            this.#send({ type: "formWidget", page, widget }) as Promise<FormWidget | null>,

        /**
         * The document's optional content properties — its layers and the
         * configurations that set them — loaded on first read; `null` with no
         * PDF open. A read: the default configuration's `order` is the tree the
         * layers panel draws.
         */
        optionalContentProperties: (): Promise<OptionalContentProperties | null> =>
            this.#send({ type: "optionalContentProperties" }) as Promise<OptionalContentProperties | null>,

        /**
         * The ids (hex keys) of the optional content groups that are OFF now;
         * every other group is ON. Session state, not the document's — a read.
         */
        optionalContentOff: (): Promise<string[]> => this.#send({ type: "optionalContentOff" }) as Promise<string[]>,

        /**
         * Switch the optional content group `id` ON or OFF, as a layers panel
         * does: a locked group doesn't switch, and turning one ON turns the
         * others of its radio groups OFF. Resolves to whether any group changed.
         * Not an edit — no history, no document change — but the pixels change,
         * so the thumbnails redraw.
         */
        setOptionalContentGroupOn: (id: string, on: boolean): Promise<boolean> => {
            const changed = this.#send({ type: "setOptionalContentGroupOn", id, on }) as Promise<boolean>;
            // After the post, as `#send` does for an edit, so a thumbnail the
            // strip re-requests queues behind the switch.
            this.invalidateThumbnails();
            return changed;
        },

        /**
         * Run a hide action: hide each of `targets` — its `/T` — or show it
         * where `hide` is `false`. Resolves to whether any annotation changed.
         * Not an edit, as a layer switch isn't, but the pixels change, so the
         * thumbnails redraw.
         */
        hideAnnotations: (targets: ActionHideTarget[], hide: boolean): Promise<boolean> => {
            const changed = this.#send({ type: "hideAnnotations", targets, hide }) as Promise<boolean>;
            this.invalidateThumbnails();
            return changed;
        },

        /**
         * Follow `destination` — an outline item's or a link's: a named one
         * resolves through the document's named destinations, the worker
         * composes the target page, and the view lands as the destination's view
         * asks, its point by `alignment`. Resolves to the view it landed by — a named destination's,
         * resolved — so the caller can tell whether the zoom was set; `null` when
         * it didn't land, leaving the view. The resulting zoom and scroll stream
         * back as {@link goToPage}'s do.
         */
        goToDestination: (destination: Destination, alignment: ScrollAlignment): Promise<DestinationView | null> => {
            return this.#send({
                type: "goToDestination",
                destination,
                alignment,
                seq: ++this.#viewportSeq,
            }) as Promise<DestinationView | null>;
        },

        /**
         * The 32-char hex keys of the currently-selected graphics objects (empty
         * when nothing is selected) — a read, the inverse of
         * {@link portable.selectObjects}. Lets a host act on the current
         * selection by id (e.g. adopt a peer's selection).
         */
        selectedObjectIds: (): Promise<string[]> => this.#send({ type: "selectedObjects" }) as Promise<string[]>,

        /**
         * The annotations the selection holds, their values with their page's
         * hex key — or `null` when it holds none. A read: what the Annotate
         * tab's Format controls show, and the values a restyle edits and sends
         * back in an `UpdateAnnotations` command.
         */
        selectedAnnotations: (): Promise<SelectedAnnotations | null> =>
            this.#send({ type: "selectedAnnotations" }) as Promise<SelectedAnnotations | null>,

        /**
         * The annotations of each page in `pages` (hex keys), with their rich
         * contents — one entry per page that has any, each page's annotations
         * loaded whether or not it has composed. A read: what the comment
         * threads of the popup and the comments panel are built from.
         */
        pageComments: (pages: string[]): Promise<PageComments[]> =>
            this.#send({ type: "pageComments", pages }) as Promise<PageComments[]>,

        /**
         * The annotations of each page in `pages` (hex keys), without their
         * appearances — one entry per page that has any, each page's
         * annotations loaded whether or not it has composed. A read: what the
         * host's page-annotation calls and events are built from.
         */
        pageAnnotations: (pages: string[]): Promise<PageAnnotations[]> =>
            this.#send({ type: "pageAnnotations", pages }) as Promise<PageAnnotations[]>,

        /** Annotation `id` of page `page` whole, its appearance with it, or `null` for none of that id. */
        annotation: (page: string, id: string): Promise<Annotation | null> =>
            this.#send({ type: "annotation", page, id }) as Promise<Annotation | null>,

        /**
         * The local selection's geometry once every select sent before this
         * read has applied — unlike {@link onSelection}'s reports, which a drag
         * streams and the last of which may still be on its way. A read: the
         * final text quads a markup marks.
         */
        selectionGeometry: (): Promise<SelectionGeometry> =>
            this.#send({ type: "selectionGeometry" }) as Promise<SelectionGeometry>,

        /**
         * Select the graphics objects named by `ids` (their 32-char hex keys) on
         * the page at index `page` — id-addressed selection, the programmatic
         * counterpart of the pointer {@link select}. A portable selection is
         * confined to one page, so the page rides with the ids. Presence only, so
         * the new geometry arrives via {@link onSelection} with
         * `localChanged: true` (the cue to broadcast {@link presence}); unknown ids
         * are skipped, an empty list clears the selection. Fire-and-forget.
         */
        selectObjects: (page: number, ids: string[]): void => {
            this.#post({ type: "selectObjectsById", page, ids });
        },
    };

    /**
     * Reads shaped for a presentation (pptx) document, grouped off the agnostic
     * client surface like {@link portable}.
     */
    readonly presentation = {
        /**
         * The elements of page `page` on the current plane that play media,
         * each with its box in page-local points — empty for a page not
         * composed, or one that plays nothing. A read: what the players stand
         * over.
         */
        pageMedia: (page: number): Promise<ComposedShapeMedia[]> =>
            this.#send({ type: "pageMedia", page }) as Promise<ComposedShapeMedia[]>,

        /**
         * The media file `media` (hex key) an element's `media.data` names —
         * its bytes and content type — loaded on first read; `null` with no
         * presentation open or no such file. A read: what a player is handed.
         */
        mediaData: (media: string): Promise<MediaFile | null> =>
            this.#send({ type: "mediaData", media }) as Promise<MediaFile | null>,
    };

    /**
     * Reads shaped for a spreadsheet (xlsx) document, grouped off the agnostic
     * client surface like {@link portable}.
     */
    readonly spreadsheet = {
        /**
         * The id (hex key) of the sheet at tab position `index`, or `undefined`
         * past the last sheet — a pure read. A plane is a sheet, in tab order,
         * so the host maps its current plane to the id a spreadsheet command
         * ({@link Command.resizeColumns} / {@link Command.resizeRows}) names.
         */
        sheetIdByIndex: (index: number): Promise<string | undefined> =>
            this.#send({ type: "sheetIdByIndex", index }) as Promise<string | undefined>,
    };

    /**
     * Verbs shaped for a word-processing (docx) document, grouped off the
     * agnostic client surface like {@link portable}.
     */
    readonly wordprocessing = {
        /**
         * Follow a link to bookmark `name` (`w:hyperlink@w:anchor`): the worker
         * lays the document out as far as the bookmark and lands the view on
         * its start, its point by `alignment` — or on the document's start
         * where no bookmark has the name. The resulting scroll streams back as
         * {@link goToPage}'s does. Latest-wins, fire-and-forget.
         */
        goToBookmark: (name: string, alignment: ScrollAlignment): void => {
            this.#post({ type: "goToBookmark", name, alignment, seq: ++this.#viewportSeq });
        },
    };

    /**
     * Set the selection to a doc-type-tagged {@link UDocSelection} — the agnostic,
     * id-addressed presence path (used for presentation shapes and any doc type
     * whose selection the portable-only {@link portable.selectObjects} can't
     * express). Presence only, so the new geometry arrives via {@link onSelection}
     * with `localChanged: true` (the cue to broadcast {@link presence}).
     * Fire-and-forget.
     */
    setSelection(selection: UDocSelection): void {
        this.#post({ type: "setSelection", selection });
    }

    /**
     * Read the current selection as the tagged {@link UDocSelection} (or `null`) —
     * the doc-type-agnostic counterpart of {@link portable.selectedObjectIds},
     * letting a host read its own or a peer's selection whatever the doc type.
     */
    selection(): Promise<UDocSelection | null> {
        return this.#send({ type: "selection" }) as Promise<UDocSelection | null>;
    }

    /**
     * Capture the current selection as a {@link UDocFragment} for the system
     * clipboard — a pure read, no edit, in view mode as in edit. Resolves with
     * the doc-type-tagged fragment, or `null` when nothing copyable is selected
     * (the caller then leaves the clipboard untouched). The caller writes it as
     * our own flavor and projects the others (see {@link plainText}).
     */
    copy(): Promise<UDocFragment | null> {
        return this.#send({ type: "copy" }) as Promise<UDocFragment | null>;
    }

    /**
     * Project a copied {@link UDocFragment} to plain text — the `text/plain`
     * clipboard flavor beside our own format, so a paste into any other app gets
     * readable text, not our JSON. Resolves with the string (empty when the
     * fragment has no text). Pairs with {@link copy}.
     */
    plainText(fragment: UDocFragment): Promise<string> {
        return this.#send({ type: "plainText", fragment }) as Promise<string>;
    }

    /**
     * Subscribe to selection updates: the local selection's page-anchored
     * rectangles plus every remote peer's projected selection, posted
     * whenever either changes — after {@link select} /
     * {@link clearSelection} (with `localChanged: true`, the cue to broadcast
     * {@link presence}), after a {@link mergePresence}, any edit/undo/merge,
     * compose-ahead growth, and open/close. Camera-independent: the selection
     * layer projects it against the per-frame {@link onPageViews} rects, so
     * scroll/zoom never re-post it. Returns an unsubscribe function.
     */
    onSelection(listener: (state: SelectionState) => void): () => void {
        this.#selectionListeners.add(listener);
        return () => this.#selectionListeners.delete(listener);
    }

    /**
     * Subscribe to the remote peers present — each one's id and name — posted
     * when they change: after a {@link mergePresence}, {@link refreshPresence}
     * or {@link withdrawPresence}, and on open/close. Returns an unsubscribe
     * function.
     */
    onPeers(listener: (peers: Peer[]) => void): () => void {
        this.#peersListeners.add(listener);
        return () => this.#peersListeners.delete(listener);
    }

    /**
     * Subscribe to the remote peers' pointers on the plane shown, posted when
     * they change — after a {@link mergePresence}, {@link refreshPresence} or
     * {@link withdrawPresence}, a plane switch, and open/close. Page-anchored
     * like a selection box, so scroll and zoom never re-post them. Returns an
     * unsubscribe function.
     */
    onPeerPointers(listener: (pointers: PeerPointer[]) => void): () => void {
        this.#peerPointersListeners.add(listener);
        return () => this.#peerPointersListeners.delete(listener);
    }

    /**
     * Subscribe to undo / redo availability, pushed whenever the edit history
     * may have changed — on open (resets to all-false), after any committing
     * edit (page edit, object move, undo, redo), and after a merge. The host
     * enables or disables its history controls from this; it never polls.
     * Returns an unsubscribe function.
     */
    onHistory(listener: (state: HistoryState) => void): () => void {
        this.#historyListeners.add(listener);
        return () => this.#historyListeners.delete(listener);
    }

    /**
     * Set this client's collaborator user info (currently a display name) — the
     * label peers draw on its selection. Sticky in the worker (re-applied to
     * every document opened later), so it survives a re-open. Triggers a
     * selection report with `localChanged: true`, so a presence-sync host
     * re-broadcasts and peers pick the name up. Fire-and-forget.
     */
    setUserInfo(name: string): void {
        this.#post({ type: "setUserInfo", name });
    }

    /**
     * Serialize the session's presence (its selection) for sync with a peer —
     * the transient channel beside {@link snapshot}: last-write-wins, no
     * history, never part of a save. Feed the bytes to another client's
     * {@link mergePresence}.
     */
    async presence(): Promise<Uint8Array> {
        const buffer = (await this.#send({ type: "presence" })) as ArrayBuffer;
        return new Uint8Array(buffer);
    }

    /**
     * Merge a peer's {@link presence} bytes. The refreshed peer selections
     * arrive via {@link onSelection} with `localChanged: false`, so a
     * presence-sync listener can't ping-pong.
     */
    async mergePresence(data: Uint8Array): Promise<void> {
        // Transfer a fresh copy of the buffer to avoid detaching the caller's.
        const buffer = data.slice().buffer;
        await this.#send({ type: "mergePresence", data: buffer }, [buffer]);
    }

    /**
     * Set where this client's pointer rests from canvas-local CSS px `(x, y)`,
     * or delete it when the point is off every page. Resolves with the bytes of
     * that one presence entry, to send to peers as a presence.
     */
    async setPointer(x: number, y: number): Promise<Uint8Array> {
        const buffer = (await this.#send({ type: "setPointer", x, y })) as ArrayBuffer;
        return new Uint8Array(buffer);
    }

    /** Delete this client's pointer. Resolves with the bytes of the deletion, as {@link setPointer}. */
    async clearPointer(): Promise<Uint8Array> {
        const buffer = (await this.#send({ type: "clearPointer" })) as ArrayBuffer;
        return new Uint8Array(buffer);
    }

    /**
     * Keep this client present: stamp its own presence entries anew and drop
     * the peers' that went quiet past the presence timeout. Peers dropped arrive
     * via {@link onSelection} and {@link onPeerPointers}.
     */
    async refreshPresence(): Promise<void> {
        await this.#send({ type: "refreshPresence" });
    }

    /**
     * Leave the presence channel: resolves with the bytes deleting this
     * client's entries, for the peers, and forgets every peer's here.
     */
    async withdrawPresence(): Promise<Uint8Array> {
        const buffer = (await this.#send({ type: "withdrawPresence" })) as ArrayBuffer;
        return new Uint8Array(buffer);
    }

    /**
     * Serialize the session's CRDT for sync with a peer. Resolves with the
     * bytes to feed another client's {@link merge}.
     */
    async snapshot(): Promise<Uint8Array> {
        const buffer = (await this.#send({ type: "snapshot" })) as ArrayBuffer;
        return new Uint8Array(buffer);
    }

    /**
     * Save the open document as `format`, faithfully — the bytes reopen as the
     * same document. A `strategy` other than `"rewrite"` writes over the
     * original the session's loader holds; without one, the engine's for
     * `format`.
     */
    async saveToBytes(format: FileFormat, strategy?: SaveStrategy): Promise<Uint8Array> {
        const buffer = (await this.#send({
            type: "saveToBytes",
            format,
            ...(strategy !== undefined ? { strategy } : {}),
        })) as ArrayBuffer;
        return new Uint8Array(buffer);
    }

    /** Export the open document as `format` — a rendering of its laid-out pages, fixed and one-way. */
    async exportToBytes(format: ExportFormat): Promise<Uint8Array> {
        const buffer = (await this.#send({ type: "exportToBytes", format })) as ArrayBuffer;
        return new Uint8Array(buffer);
    }

    /** Export page `page` (0-based) of the primary plane as `format`, the page composed already. */
    async exportPageToBytes(page: number, format: PageExportFormat): Promise<Uint8Array> {
        const buffer = (await this.#send({ type: "exportPageToBytes", index: page, format })) as ArrayBuffer;
        return new Uint8Array(buffer);
    }

    /**
     * Read the file the open document was opened from, byte for byte, whatever
     * has been edited since — the original the session's loader holds.
     */
    async originalBytes(): Promise<Uint8Array> {
        const buffer = (await this.#send({ type: "originalBytes" })) as ArrayBuffer;
        return new Uint8Array(buffer);
    }

    /**
     * Save the open document as a udoc package — the bytes of a `.udoc` zip. A
     * `version` makes it a checkpoint, which keeps the edit log a reopen
     * replays; without one the package is a flat baseline.
     */
    async saveToPackage(version?: number): Promise<Uint8Array> {
        const buffer = (await this.#send({
            type: "saveToPackage",
            ...(version !== undefined ? { version } : {}),
        })) as ArrayBuffer;
        return new Uint8Array(buffer);
    }

    /**
     * Read this session's version vector — the per-peer op counts it holds.
     * Hand the bytes to a peer's {@link patchSince} so it returns only the ops
     * this session is missing.
     */
    async versionVector(): Promise<Uint8Array> {
        const buffer = (await this.#send({ type: "versionVector" })) as ArrayBuffer;
        return new Uint8Array(buffer);
    }

    /**
     * Compute the ops this session holds that a peer — identified by its
     * {@link versionVector} bytes — lacks. Resolves with a patch to feed that
     * peer's {@link merge}: the incremental alternative to a full {@link snapshot}.
     */
    async patchSince(peer: Uint8Array): Promise<Uint8Array> {
        // Transfer a fresh copy of the buffer to avoid detaching the caller's.
        const buffer = peer.slice().buffer;
        const out = (await this.#send({ type: "patchSince", peer: buffer }, [buffer])) as ArrayBuffer;
        return new Uint8Array(out);
    }

    /**
     * Merge a peer's {@link snapshot} or {@link patchSince} bytes into this
     * session. Resolves with the document's new layout (the remote edits may
     * have changed the page count).
     */
    async merge(data: Uint8Array): Promise<DocumentLayout> {
        // Transfer a fresh copy of the buffer to avoid detaching the caller's.
        const buffer = data.slice().buffer;
        return (await this.#send({ type: "merge", data: buffer }, [buffer])) as DocumentLayout;
    }

    /**
     * The content of every opaque part — an inserted picture's image — a peer,
     * identified by its {@link versionVector} bytes, lacks. Send it ahead of
     * the {@link patchSince} patch that names them; empty when there is
     * nothing to send.
     */
    async opaquePartsSince(peer: Uint8Array): Promise<Uint8Array> {
        // Transfer a fresh copy of the buffer to avoid detaching the caller's.
        const buffer = peer.slice().buffer;
        const out = (await this.#send({ type: "opaquePartsSince", peer: buffer }, [buffer])) as ArrayBuffer;
        return new Uint8Array(out);
    }

    /**
     * Hold a peer's {@link opaquePartsSince} content. Resolves with the
     * document's layout — a picture whose image just arrived repaints.
     */
    async mergeOpaqueParts(data: Uint8Array): Promise<DocumentLayout> {
        // Transfer a fresh copy of the buffer to avoid detaching the caller's.
        const buffer = data.slice().buffer;
        return (await this.#send({ type: "mergeOpaqueParts", data: buffer }, [buffer])) as DocumentLayout;
    }

    /**
     * Subscribe to the per-frame {@link PageViewsFrame} stream: the on-screen
     * pages in viewport (CSS px) space plus the frame's authoritative view
     * metrics (scale, scroll, content extent). The worker re-emits after every
     * painted frame (scroll/zoom/edit), so this is what the HTML overlay layer
     * tracks to keep page chrome pinned to the moving pages, and what the
     * shell adopts view metrics from (when `frame.fresh`). The views array is
     * fresh each frame — empty when no page is on screen. Returns an
     * unsubscribe function.
     */
    onPageViews(listener: (frame: PageViewsFrame) => void): () => void {
        this.#pageViewListeners.add(listener);
        return () => this.#pageViewListeners.delete(listener);
    }

    /**
     * Subscribe to the worker's resize acks: fired after the worker has resized
     * the backing store and run a frame at the new size, carrying that size in
     * CSS px. The canvas host waits for this to set the canvas's CSS size, so
     * the displayed box never runs ahead of the painted pixels (the resize
     * "stretch"). Returns an unsubscribe function.
     */
    onResized(listener: (size: { width: number; height: number }) => void): () => void {
        this.#resizedListeners.add(listener);
        return () => this.#resizedListeners.delete(listener);
    }

    /**
     * Subscribe to the brand decal's CSS-px rect — where the engine paints the
     * "Powered by docMentis" mark, so the host can lay an attribution click
     * target over it. Posted only on viewport changes (the mark is
     * screen-fixed); `null` clears it. A late subscriber is replayed the last
     * rect immediately. Returns an unsubscribe function.
     */
    onBrandingRect(listener: (rect: Rect | null) => void): () => void {
        this.#brandingRectListeners.add(listener);
        if (this.#lastBrandingRect !== undefined) listener(this.#lastBrandingRect);
        return () => this.#brandingRectListeners.delete(listener);
    }

    /**
     * The size page `index` (0-based) takes as displayed, in document points —
     * turned by its rotation, the page's own and the view's, the shape its
     * {@link requestThumbnail} comes out in. Doc-type-agnostic (slides, PDF
     * pages, image frames all answer), so the thumbnail strip can shape and
     * scale a preview of any open document. A pure read; resolves to a zero
     * size when the page is out of range or not yet composed.
     */
    async pageDisplaySize(index: number): Promise<Size> {
        return (await this.#send({ type: "pageDisplaySize", index })) as Size;
    }

    /**
     * Render a thumbnail of page `index` (0-based) at `scale` (output pixels
     * per document point), resolving with a decoded {@link ImageBitmap}. Served
     * from an in-process LRU cache when warm; otherwise queued in the worker,
     * which rasterizes it off the viewport as background work — **only once the
     * reader has been quiet a moment**, so the strip never stutters live
     * scrolling — nearest-{@link boostThumbnails}-focus first, one at a time.
     * Rejects with a benign {@link THUMBNAIL_DROPPED} error when the request is
     * superseded (a newer scale for the same page), cancelled
     * ({@link cancelThumbnail}), or invalidated ({@link invalidateThumbnails});
     * callers skip those silently.
     */
    requestThumbnail(index: number, scale: number): Promise<ImageBitmap> {
        const key = `${index}:${scale.toFixed(3)}`;
        const cached = this.#thumbnailCache.get(key);
        if (cached) {
            cached.lastAccess = performance.now();
            return Promise.resolve(cached.bitmap);
        }
        // A pending request for the same page+scale shares its promise; one at
        // a different scale (the panel re-requested at a new size) is replaced
        // in the worker by this one, and answers as dropped.
        const queued = this.#thumbnailRequests.get(index);
        if (queued?.key === key) return queued.promise;
        const epoch = this.#thumbnailEpoch;
        const promise = (this.#send({ type: "queueThumbnail", index, scale }) as Promise<ThumbnailResult | null>)
            .then(async (result) => {
                if (result === null) throw new Error(THUMBNAIL_DROPPED);
                // The page is opaque (a white media box), so the premultiplied
                // bytes equal straight-alpha bytes; `ImageData` reads them as-is.
                const image = new ImageData(new Uint8ClampedArray(result.rgba), result.width, result.height);
                const bitmap = await createImageBitmap(image);
                // A new document / edit landed while this rendered: the pixels
                // are stale, so discard them rather than caching against a
                // cleared map.
                if (epoch !== this.#thumbnailEpoch) {
                    bitmap.close();
                    throw new Error(THUMBNAIL_DROPPED);
                }
                this.#cacheThumbnail(key, bitmap);
                return bitmap;
            })
            .finally(() => {
                if (this.#thumbnailRequests.get(index)?.promise === promise) this.#thumbnailRequests.delete(index);
            });
        this.#thumbnailRequests.set(index, { key, promise });
        return promise;
    }

    /**
     * Render a one-shot preview of page `page` on `plane` at `scale`, resolving
     * with a decoded {@link ImageBitmap} — for the New-Slide layout picker, which
     * previews slide layouts on their slide-master planes (plane `1..`), and for
     * printing, which renders each page to print at its quality's DPI. Unlike
     * {@link requestThumbnail} this bypasses the slide-plane strip's queue and
     * cache, and runs as a request rather than as background work: the picker
     * renders a small fixed set on open, off the slide-plane navigator's
     * scheduling. The caller owns the returned bitmap.
     * `ephemeral` draws the ephemeral annotations, which a print leaves out.
     */
    async renderPagePreview(plane: number, page: number, scale: number, ephemeral = true): Promise<ImageBitmap> {
        const result = (await this.#send({
            type: "renderThumbnail",
            index: page,
            scale,
            plane,
            ephemeral,
        })) as ThumbnailResult;
        const image = new ImageData(new Uint8ClampedArray(result.rgba), result.width, result.height);
        return createImageBitmap(image);
    }

    /**
     * Bias the thumbnail render order toward `page` — the page the strip is
     * centred on. Queued requests nearest it render first, so what the user is
     * looking at fills before off-window pages. Cheap to call on every scroll.
     */
    boostThumbnails(page: number): void {
        if (page === this.#thumbnailFocus) return;
        this.#thumbnailFocus = page;
        this.#post({ type: "thumbnailFocus", page });
    }

    /**
     * Cancel a queued thumbnail request for `index` (a page that scrolled out of
     * the window before it rendered). A no-op if it already rendered or was
     * never queued; a render the worker already ran is left to answer (its
     * result still caches). Otherwise the pending promise rejects with
     * {@link THUMBNAIL_DROPPED}.
     */
    cancelThumbnail(index: number): void {
        if (!this.#thumbnailRequests.delete(index)) return;
        this.#post({ type: "cancelThumbnail", index });
    }

    /**
     * Drop every cached and queued thumbnail — the document changed (open,
     * close, any edit/undo/redo/merge), so every page's pixels may be stale.
     * In-flight renders are discarded on return (an epoch bump) rather than
     * caching a stale frame. The strip re-requests its visible window.
     */
    invalidateThumbnails(): void {
        this.#thumbnailEpoch++;
        for (const { bitmap } of this.#thumbnailCache.values()) bitmap.close();
        this.#thumbnailCache.clear();
        // Every render still queued answers as dropped; one that already ran
        // answers stale, and is discarded by its epoch.
        if (this.#thumbnailRequests.size > 0) this.#post({ type: "dropThumbnails" });
        this.#thumbnailRequests.clear();
        for (const listener of this.#thumbnailInvalidatedListeners) listener();
    }

    /**
     * Subscribe to thumbnail-cache invalidations — fired whenever the document
     * changes (open, edit, undo/redo, merge, close), so the strip re-requests
     * its visible window instead of showing pixels from before the change.
     * Returns an unsubscribe function.
     */
    onThumbnailsInvalidated(listener: () => void): () => void {
        this.#thumbnailInvalidatedListeners.add(listener);
        return () => this.#thumbnailInvalidatedListeners.delete(listener);
    }

    /**
     * Subscribe to changes of the document — an open, an edit, an undo or redo,
     * a merge — heard as the request that makes one is sent, so a read the
     * listener sends queues behind it in the worker and sees the change.
     * Returns an unsubscribe function.
     */
    onDocumentChanged(listener: () => void): () => void {
        this.#documentChangedListeners.add(listener);
        return () => this.#documentChangedListeners.delete(listener);
    }

    /**
     * Subscribe to font refreshes — fired when fonts the engine ordered have
     * landed and the composed pages were re-shaped against them, so text may
     * sit elsewhere than it did. Returns an unsubscribe function.
     */
    onFontsRefreshed(listener: () => void): () => void {
        this.#fontsRefreshedListeners.add(listener);
        return () => this.#fontsRefreshedListeners.delete(listener);
    }

    /**
     * Subscribe to sheet loads — fired as the worker loads a workbook's sheets
     * in the background after an open, one sheet at a time in tab order, with
     * the plane, its tab's `#rrggbb` colour (`null` for none) and whether it is
     * a chartsheet. The sheet shown at the open isn't among them:
     * {@link planeInfo} reads it. Returns an unsubscribe function.
     */
    onPlaneLoaded(listener: (plane: number, color: string | null, chartsheet: boolean) => void): () => void {
        this.#planeLoadedListeners.add(listener);
        return () => this.#planeLoadedListeners.delete(listener);
    }

    /**
     * Subscribe to compose-ahead — fired as the worker composes more of the
     * document ahead of the reader, in the background, with the layout that
     * grew: composed page count, content size, and whether it is complete. It
     * starts once an opened document has painted, and again after each edit,
     * sheet switch and font re-shape. A worksheet composes ahead by its rows,
     * which grows nothing the host keeps, so it fires none. Returns an
     * unsubscribe function.
     */
    onComposed(listener: (layout: DocumentLayout) => void): () => void {
        this.#composedListeners.add(listener);
        return () => this.#composedListeners.delete(listener);
    }

    /**
     * Tell the worker the reader touched the shell — a pointer, a key, a wheel —
     * so its background work (compose-ahead, thumbnails, loading a workbook's
     * sheets) waits until they have been quiet a moment, and what they do next
     * doesn't land behind it. Cheap to call on every input: posts at most every
     * {@link ACTIVITY_PING_MS}.
     */
    noteActivity(): void {
        const now = performance.now();
        if (now - this.#activityPostedAt < ACTIVITY_PING_MS) return;
        this.#activityPostedAt = now;
        this.#post({ type: "readerActivity" });
    }

    /** Release the open document, keeping the worker ready for the next open. */
    close(): void {
        this.invalidateThumbnails();
        this.#post({ type: "close" });
    }

    /** Tear down the worker. Not reusable afterwards. */
    destroy(): void {
        this.invalidateThumbnails();
        this.#failAll(new UDocError("invalidRequest", "worker destroyed"));
        this.#worker.terminate();
    }

    // --- internals --------------------------------------------------------

    /** Load + initialize WASM from one resolved candidate (used by `create`). */
    #init(candidate: WasmCandidate): Promise<void> {
        return this.#send({
            type: "init",
            wasmUrl: candidate.wasmUrl,
            fonts: candidate.fonts,
            ...(this.#googleFontFamilies ? { googleFontFamilies: this.#googleFontFamilies } : {}),
            googleFontEndpoint: this.#googleFontEndpoint,
            ...(this.#enableCanvasFonts ? { enableCanvasFonts: true } : {}),
        }) as Promise<void>;
    }

    #post(msg: WorkerRequest | ExtensionRequest, transfer?: Transferable[]): void {
        this.#worker.postMessage(msg, transfer ?? []);
    }

    #send(
        msg: WorkerRequest | ExtensionRequest,
        transfer?: Transferable[],
        changesDocument = MUTATING_REQUESTS.has(msg.type),
    ): Promise<unknown> {
        const _id = this.#nextId++;
        const promise = new Promise<unknown>((resolve, reject) => {
            this.#pending.set(_id, { resolve, reject });
            this.#worker.postMessage({ ...msg, _id }, transfer ?? []);
        });
        // The executor (hence the post) ran synchronously above; dropping the
        // cache *after* it queues any refresh-driven thumbnail render behind
        // this edit in the worker, so it rasters the new pixels.
        if (changesDocument) {
            this.invalidateThumbnails();
            for (const listener of this.#documentChangedListeners) listener();
        }
        return promise;
    }

    #onMessage(msg: WorkerOutbound): void {
        // Unsolicited reports carry a `type`; correlated replies are keyed by
        // `_id`.
        if ("type" in msg) {
            switch (msg.type) {
                case "perf":
                    for (const listener of this.#perfListeners) listener(msg.summary);
                    return;
                case "pageViews":
                    this.#emitPageViews(msg);
                    return;
                case "selection": {
                    const state: SelectionState = {
                        local: msg.geometry,
                        peers: msg.peers,
                        // What the selection allows, less what the session is
                        // not entitled to — so no control offers a refused edit.
                        capabilities: entitledCapabilities(msg.capabilities, this.#entitlements?.features ?? []),
                        properties: msg.properties,
                        localChanged: msg.localChanged,
                    };
                    for (const listener of this.#selectionListeners) listener(state);
                    return;
                }
                case "peers":
                    for (const listener of this.#peersListeners) listener(msg.peers);
                    return;
                case "peerPointers":
                    for (const listener of this.#peerPointersListeners) listener(msg.pointers);
                    return;
                case "history": {
                    const state: HistoryState = { canUndo: msg.canUndo, canRedo: msg.canRedo };
                    for (const listener of this.#historyListeners) listener(state);
                    return;
                }
                case "resized":
                    for (const listener of this.#resizedListeners) {
                        listener({ width: msg.width, height: msg.height });
                    }
                    return;
                case "brandingRect":
                    this.#lastBrandingRect = msg.rect;
                    for (const listener of this.#brandingRectListeners) listener(msg.rect);
                    return;
                case "fontsRefreshed":
                    for (const listener of this.#fontsRefreshedListeners) listener();
                    return;
                case "planeLoaded":
                    for (const listener of this.#planeLoadedListeners) {
                        listener(msg.plane, msg.color, msg.chartsheet);
                    }
                    return;
                case "composed":
                    for (const listener of this.#composedListeners) listener(msg.layout);
                    return;
            }
            return;
        }
        const pending = this.#pending.get(msg._id);
        if (!pending) return;
        this.#pending.delete(msg._id);
        if (msg.ok) pending.resolve(msg.result);
        else pending.reject(new UDocError(msg.error.code, msg.error.message, msg.error.detail));
    }

    /** Parse a report's flat `[index, x, y, w, h, …]` buffer into a
     *  {@link PageViewsFrame} and fan it out to subscribers. */
    #emitPageViews(report: PageViewsReport): void {
        // Before the listeners: adopting this frame's scroll sends the viewport
        // back at once, and it was read against this report.
        if (report.seq === this.#viewportSeq) this.#anchorShift = report.anchorShift;
        if (this.#pageViewListeners.size === 0) return;
        const rects = report.rects;
        const views: PageView[] = [];
        for (let i = 0; i + PAGE_VIEW_STRIDE <= rects.length; i += PAGE_VIEW_STRIDE) {
            views.push({
                index: rects[i]!,
                x: rects[i + 1]!,
                y: rects[i + 2]!,
                width: rects[i + 3]!,
                height: rects[i + 4]!,
                rotation: rects[i + 5]!,
            });
        }
        const frame: PageViewsFrame = {
            views,
            scale: report.scale,
            scrollSize: { width: report.scrollWidth, height: report.scrollHeight },
            scrollUsedSize: { width: report.scrollUsedWidth, height: report.scrollUsedHeight },
            scrollbars: { x: report.scrollbarX, y: report.scrollbarY },
            scroll: { x: report.scrollX, y: report.scrollY },
            currentPage: report.currentPage >= 0 ? report.currentPage : null,
            plane: report.plane,
            guide: report.guide,
            repaintArea: report.repaintArea,
            // Reflects the latest viewport we sent — older frames painted
            // mid-burst must not be adopted as view state.
            fresh: report.seq === this.#viewportSeq,
        };
        for (const listener of this.#pageViewListeners) listener(frame);
    }

    /** Insert a decoded bitmap, evicting the least-recently-used past the cap. */
    #cacheThumbnail(key: string, bitmap: ImageBitmap): void {
        this.#thumbnailCache.set(key, { bitmap, lastAccess: performance.now() });
        if (this.#thumbnailCache.size <= THUMBNAIL_CACHE_LIMIT) return;
        let oldestKey: string | null = null;
        let oldest = Infinity;
        for (const [k, entry] of this.#thumbnailCache) {
            if (entry.lastAccess < oldest) {
                oldest = entry.lastAccess;
                oldestKey = k;
            }
        }
        if (oldestKey !== null) {
            this.#thumbnailCache.get(oldestKey)!.bitmap.close();
            this.#thumbnailCache.delete(oldestKey);
        }
    }

    #failAll(error: UDocError): void {
        for (const [, pending] of this.#pending) pending.reject(error);
        this.#pending.clear();
    }
}
