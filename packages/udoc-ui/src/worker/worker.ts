// The render worker. It loads the WASM and hands a `WasmSession` the
// transferred OffscreenCanvas — from then on Rust owns the whole render path
// (canvas, dirty-rect compositor, scroll-blit, rasterization). The worker is a
// thin pump: it forwards resize/scroll/zoom and ticks render_frame() on rAF.
//
// A library, not an entry: each product's own worker entry calls
// `serveEngine` with the request handlers it adds to these, and bundles the
// two together, so a product's worker carries only the requests its UI sends.
//
// The DOM lib (not WebWorker) is loaded for this package, so the worker global
// is typed locally rather than pulling in conflicting WebWorker globals. Every
// API the worker actually touches lives in the DOM lib.

import { NoOpPerformanceCounter, PerformanceCounter } from "../performance/index.js";
import type { IPerformanceCounter, PerfEvent } from "../performance/index.js";
import { EMPTY_SELECTION_CAPABILITIES, cssPxPerPt } from "../geometry.js";
import type { DocumentLayout, Fit, Peer, PeerPointer, ScrollMode, SelectionGeometry, Viewport } from "../geometry.js";
import { createCanvasText } from "../fonts/canvas-text.js";
import { createFontPump } from "../fonts/pump.js";
import { defaultDpiForDocType, defaultFitForDocType, defaultScrollModeForDocType } from "./protocol.js";
import type {
    ExtensionRequest,
    FormWidget,
    HistoryOp,
    MediaFile,
    PageAnnotations,
    PageComments,
    SelectedAnnotations,
    SelectionEdit,
    SelectionReport,
    ThumbnailFocusRequest,
    ThumbnailResult,
    WorkerOutbound,
    WorkerRequest,
    WorkerRequestEnvelope,
} from "./protocol.js";
import initEngine, { createFontFetchMemory, fetchFontBinaries, startSession } from "@docmentis/udoc-wasm";
import type {
    CanvasText,
    FontLocation,
    GoogleFontFamily,
    SheetState,
    UrlFont,
    WasmSession,
} from "@docmentis/udoc-wasm";
import { UDocError } from "@docmentis/udoc-wasm/error";
import type {
    AcroForm,
    ShapeSelectionEditType,
    TextSelectionEditType,
    UDocCommand,
    UDocSelectionEdit,
    UDocType,
} from "@docmentis/udoc-wasm";
import { createLanes } from "./lanes.js";
import type { Job, Task } from "./lanes.js";
import { Selection } from "./selection.js";

interface WorkerScope {
    onmessage: ((ev: MessageEvent<EngineRequestEnvelope>) => void) | null;
    postMessage(message: WorkerOutbound, transfer?: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

// Where the office-compatible fonts are, beside the binary `init` loaded —
// null until it has.
let fonts: FontLocation | null = null;
// The Google font families offered to every session, where the host's
// `googleFontFamilies` replaced the catalog `startSession` offers (`[]` with Google
// Fonts off); `undefined` keeps that catalog.
let googleFontFamilies: GoogleFontFamily[] | undefined;
// Where css2 is asked for a Google family's faces, as `init` gave it;
// `undefined` is Google's own.
let googleFontEndpoint: string | undefined;
// The browser's text stack, measuring and drawing a family nothing serves
// from the viewer's own installed copy — when `init` turned canvas fonts on
// and this browser can; `null` otherwise. Given to every session started.
let canvasText: CanvasText | null = null;
// The host's own fonts (`registerFonts`), offered to every session
// started after they were registered.
const hostLocalFonts: Uint8Array[] = [];
const hostUrlFonts: UrlFont[] = [];
let session: WasmSession | null = null;
// The transferred canvas, held for the life of the worker. A canvas can only be
// transferred once, so the main thread hands it over at mount and every session
// after that is attached to this same one.
let canvas: OffscreenCanvas | null = null;

// Host presentation state that has to outlive a session.
//
// A session is now one document long, so everything the shell pushed before
// this document existed — and everything it pushes while one is open — has to
// be replayed into the next session. Recorded by message type (latest wins) and
// replayed through this same handler, so a new sticky setting needs no second
// implementation here and cannot silently stop surviving an open.
const STICKY_REQUESTS: ReadonlySet<string> = new Set<WorkerRequest["type"]>([
    "setBackdrop",
    "setPageBorder",
    "setBrandingInset",
    "setSpacing",
    "setScrollbarSize",
    "setFit",
    "setDefaultFit",
    "setDpi",
    "setScrollMode",
    "setLayoutMode",
    "setPageRotation",
    "setUserInfo",
]);
const sticky = new Map<string, EngineRequestEnvelope>();

// Repaint timing. A real counter only while `setPerf` has it on; otherwise a
// no-op so the hot path stays branchless. The summary is posted to the main
// thread roughly once per second, then the window is reset.
let perf: IPerformanceCounter = new NoOpPerformanceCounter();
let perfReportAt = 0;
const PERF_REPORT_INTERVAL_MS = 1000;
// The report armed for when the current window is due, if any.
let perfReportTimer: ReturnType<typeof setTimeout> | null = null;
let rafId: number | null = null;

// Last view pushed to Rust, so we only call resize() / set_view() on real
// changes (the main thread sends a full Viewport each time).
let lastW = Number.NaN;
let lastH = Number.NaN;
let lastDpr = Number.NaN;
let lastScrollX = Number.NaN;
let lastScrollY = Number.NaN;
let lastZoom = Number.NaN;
// How far, in document points, the engine has moved the view down by itself
// — a running total. A page composed above the one in view (after a jump past
// pages not composed yet) moves it, and the engine moves the view with it.
// Each report carries the total, and a viewport the client sends carries the
// total of the report its scroll was read from, so `applyViewport` adds the
// moves the client hadn't seen: its scroll was meant for the plane before them.
let anchorShift = 0;
// The screen's CSS px per physical inch (`setDpi`), which the engine's scale
// is measured against — `null` for each doc type's default.
let dpi: number | null = null;

// A resize that hasn't been acked yet. Set when `applyViewport` resizes the
// backing store; cleared (and posted) once the next frame has run, so the main
// thread only grows the canvas's CSS box after the pixels behind it are fresh.
let resizeAck: { width: number; height: number } | null = null;

// Sequence number of the latest viewport message consumed (0 before any),
// echoed in each pageViews report so the client can tell which frames reflect
// its newest viewport.
let viewportSeq = 0;

// Set on `open`, cleared on the first `setSpacing`: holds the opening paint
// until the host has applied this document's spacing. The padding is
// doc-type-specific and only known after `open`, so any frame that paints first
// (a `setFit` / `setViewport` arriving before `setSpacing`) would show the wrong
// padding, then flash to the correct one. Gating every `scheduleFrame` — not
// just the open handler's — guarantees the first painted frame is already
// correctly padded regardless of message order.
let awaitingSpacing = false;

// The fit every document opens with in place of its doc type's default — the
// host's, from `setDefaultFit`. `null` keeps the doc type's.
let defaultFit: Fit | null = null;
// The explicit zoom a document opens at while that fit is `none` — the host's,
// from `setDefaultZoom`.
let defaultZoom = 1;
// The scroll mode every document opens in in place of its doc type's default —
// the host's, from `setDefaultScrollMode`. `null` keeps the doc type's.
let defaultScrollMode: ScrollMode | null = null;

// Set if `render_frame` ever throws: the wasm session is then poisoned (an
// export that unwound on a JS throw leaked its `WasmRefCell` borrow, so every
// later frame would throw "recursive use of an object detected"). We stop
// ticking rAF instead of spinning a per-frame error loop; cleared on the next
// `attach`/`open` (a fresh session).
let renderPoisoned = false;

/**
 * Schedule a paint on the next animation frame, coalescing multiple viewport
 * messages into one render. `render_frame` clears the whole dirty rect, so a
 * single frame always drains it — no need to reschedule.
 */
function scheduleFrame(): void {
    if (rafId !== null || !session || awaitingSpacing || renderPoisoned) return;
    rafId = requestAnimationFrame(() => {
        rafId = null;
        // Re-check at fire time, not just at schedule time: a frame scheduled
        // before `open` (e.g. the mount-time `setSpacing` painting an empty
        // session) can fire *after* open has set `awaitingSpacing` and
        // reconciled the new document at its provisional spacing — painting it
        // at the wrong gap/padding for one frame before the host's post-open
        // `setSpacing` lands. Holding here keeps the gate honest; that
        // `setSpacing` reschedules the paint.
        if (!awaitingSpacing) renderFrame();
        // Painted or held, the frame is no longer pending: background work,
        // which waits for it, may run.
        lanes.framed();
    });
}

/** Paint one frame, timing the repaint and periodically reporting a summary. */
function renderFrame(): void {
    if (!session || renderPoisoned) return;
    // The frame's reconcile composes what the view needs, and a page composed
    // above the one in view moves the view with it.
    const scrollBefore = session.viewState()[2];
    let painted: boolean;
    try {
        if (!perf.enabled) {
            painted = session.renderFrame();
        } else {
            const start = performance.now();
            painted = session.renderFrame();
            const now = performance.now();
            // Only count frames that actually painted — idle no-op frames are ~0ms
            // and would skew the average toward zero.
            if (painted) {
                perf.record("repaint", now - start);
                // Pull the engine's in-frame phase split (reconcile / record /
                // rasterize / composite) so the HUD shows where the time went.
                const t = session.frameTimings();
                perf.record("reconcile", t.reconcile);
                perf.record("record", t.record);
                perf.record("rasterize", t.rasterize);
                perf.record("composite", t.composite);
            }
            reportPerf();
        }
    } catch (err) {
        // A throw out of `render_frame` means a wasm export unwound on a JS
        // exception and leaked its `WasmRefCell` borrow: the session is now
        // poisoned and every later frame would throw "recursive use of an
        // object detected". Report it once and stop the rAF pump — there's no
        // recovery short of a fresh session (re-attach/open) — rather than
        // spinning an exception every frame.
        renderPoisoned = true;
        scope.postMessage({
            type: "renderError",
            message: err instanceof Error ? err.message : String(err),
        });
        return;
    }
    followView(session, scrollBefore);
    if (painted || viewportSeq !== emittedSeq) emitPageViews(session);
    if (painted && backgroundAfterPaint) {
        backgroundAfterPaint = false;
        startBackground(session);
    }
    // Ack any pending resize now that the backing store has been repainted at
    // the new size — this is the main thread's cue to commit the CSS size
    // without scaling stale pixels. Fired even on a no-op frame (e.g. no
    // document open): there are no painted pixels to stretch, and the canvas
    // still needs to track the container.
    flushResizeAck(session);
}

/**
 * Post the perf summary and start the next window, once the current window has
 * run its length — or, before then, arm a report for when it will have: a
 * background step can be the last thing to happen for a while, and its time is
 * still worth seeing.
 */
function reportPerf(): void {
    const now = performance.now();
    const due = perfReportAt + PERF_REPORT_INTERVAL_MS - now;
    if (due > 0) {
        if (perfReportTimer === null) {
            perfReportTimer = setTimeout(() => {
                perfReportTimer = null;
                if (perf.enabled) reportPerf();
            }, due);
        }
        return;
    }
    scope.postMessage({ type: "perf", summary: perf.getSummary() });
    perf.reset();
    perfReportAt = now;
}

/** Post the pending resize ack (if any) so the main thread commits the CSS size. */
function flushResizeAck(s: WasmSession): void {
    if (!resizeAck) return;
    scope.postMessage({ type: "resized", width: resizeAck.width, height: resizeAck.height });
    resizeAck = null;
    // The brand decal is screen-fixed, so its CSS rect changes only with the
    // viewport — re-post it on the same beat as the resize ack so the host can
    // reposition the attribution click target over the freshly-placed mark.
    emitBrandingRect(s);
}

/**
 * Stream the brand decal's CSS-px rect so the main thread can place the
 * attribution link over it. `null` when no viewport is known yet (the host
 * hides the link). Posted on resize and on an inset change — the mark is
 * otherwise screen-fixed.
 */
function emitBrandingRect(s: WasmSession): void {
    const r = s.brandingRect();
    scope.postMessage({
        type: "brandingRect",
        rect: r.length === 4 ? { x: r[0]!, y: r[1]!, width: r[2]!, height: r[3]! } : null,
    });
}

/** Seq last echoed in a pageViews frame — see the emit rule in `renderFrame`. */
let emittedSeq = -1;

/**
 * JSON of the guide render list last posted on a frame — the change gate for
 * {@link refreshChrome}. The ruler counts its figures from the selection (its
 * "0" rides the text frame a caret edits), so a presence-only select can move
 * the guide with nothing painted; comparing against this posts a frame only when
 * it actually shifts. `null` before the first frame and for a doc with no chrome.
 */
let lastGuideKey: string | null = null;

/**
 * Stream the freshly-painted pages' viewport rects — plus the frame's
 * authoritative view metrics (zoom, clamped scroll, content extent) and the
 * viewport seq it reflects — to the main thread for the HTML overlay layer
 * and the view-state adoption (see {@link PageViewsReport}). Emitted on
 * painted frames (scroll/zoom/relayout), so a still document stops the
 * stream and overlays hold position — but also whenever the latest consumed
 * viewport seq hasn't been echoed yet, even from a no-op paint: the client
 * gates view-state adoption on a frame echoing its newest seq, so every seq
 * must come back exactly once or the adoption gate jams shut (e.g. a
 * setViewport that changes nothing visible after an open-time fit already
 * painted under the previous seq). `pageViewRects` returns a Float64Array in
 * JS memory (copied out of wasm), so its buffer is transferred, not cloned.
 * Empty (zero-length) frames still post — that's how the host clears overlays
 * when the last page scrolls off.
 */
function emitPageViews(s: WasmSession): void {
    const rects = s.pageViewRects();
    // [zoom, scrollX, scrollY, scrollWidth, scrollHeight, currentPage,
    // scrollUsedWidth, scrollUsedHeight, scrollbarX, scrollbarY]; empty before open.
    // currentPage is -1 when no page is arranged; the scrollbar slots are 1 / 0.
    const state = s.viewState();
    emittedSeq = viewportSeq;
    // The guide render list (ruler / row-column headers) for this frame, pulled
    // beside the view state so the bands track scroll/zoom — and the selection,
    // whose text frame the ruler counts from. Already CSS px — the wasm boundary
    // divides out the dpr. `null` for a doc with no chrome. Its JSON is cached so
    // a later presence-only select can tell whether the guide moved (`refreshChrome`).
    const guide = s.guide() ?? null;
    lastGuideKey = guide === null ? null : JSON.stringify(guide);
    // The box this frame repainted ([x, y, w, h] CSS px, empty when it painted
    // nothing) — the developer repaint-area overlay's source. Four numbers on a
    // frame the host already receives, so it needs no toggle down here: whether
    // to draw is the host's call.
    const painted = s.paintedArea();
    scope.postMessage(
        {
            type: "pageViews",
            rects,
            repaintArea:
                painted.length === 4
                    ? { x: painted[0]!, y: painted[1]!, width: painted[2]!, height: painted[3]! }
                    : null,
            seq: viewportSeq,
            scale: state[0] ?? 1,
            scrollX: state[1] ?? 0,
            scrollY: state[2] ?? 0,
            anchorShift,
            scrollWidth: state[3] ?? 0,
            scrollHeight: state[4] ?? 0,
            currentPage: state[5] ?? -1,
            plane: s.currentPlane(),
            scrollUsedWidth: state[6] ?? 0,
            scrollUsedHeight: state[7] ?? 0,
            scrollbarX: state[8] === 1,
            scrollbarY: state[9] === 1,
            guide,
        },
        [rects.buffer],
    );
}

/**
 * Republish the frame after a presence-only selection change that painted
 * nothing but can still move the view chrome the frame carries: the current page
 * the ruler and page-number control track (a pointer select pins the touched
 * page via `focus_page_at`), and — now that the ruler counts its figures from the
 * selection — the text frame its "0" sits on (entering / leaving / crossing a
 * text edit). Without this the chrome would keep tracking the old page and page
 * origin until the next scroll. The post-select frame carries the unchanged
 * viewport seq, so the client treats it as fresh: the ruler (`guide`) re-renders
 * and the page index adopts, while the scroll/zoom sync no-ops because nothing
 * moved. Gated on an actual change — the pinned page moved, or the guide render
 * list differs from the last posted one — so a marquee drag (re-selecting per
 * pointer move with neither changing) posts no frame. `beforePage`, when given,
 * is the `viewState` current-page slot (index 5) read before the select; omit it
 * for a change that cannot move the page (a keyboard caret move, a clear).
 */
function refreshChrome(s: WasmSession, beforePage?: number): void {
    const pageMoved = beforePage !== undefined && (s.viewState()[5] ?? -1) !== beforePage;
    const guide = s.guide() ?? null;
    const guideMoved = (guide === null ? null : JSON.stringify(guide)) !== lastGuideKey;
    if (pageMoved || guideMoved) emitPageViews(s);
}

/** The selection state a {@link SelectionReport} carries. */
type SelectionReportBody = Omit<SelectionReport, "type" | "localChanged">;

/**
 * The selection state last posted — the change gate for
 * {@link emitChangedSelection}. `null` before the first report.
 */
let lastSelection: SelectionReportBody | null = null;

/**
 * Post the current selection state: the local geometry plus every peer's
 * projected selection (both empty without a session). Called after anything
 * that may change either: a select/clear request (`localChanged: true` — the
 * host's cue to broadcast presence), any edit / undo / redo / merge, and
 * open/close; a compose-ahead step and a presence merge go through
 * {@link emitChangedSelection}. `geometry` short-circuits the wasm read when
 * the caller already holds the fresh value (a select's return).
 */
function emitSelection(localChanged: boolean, geometry?: SelectionGeometry): void {
    postSelection(readSelection(geometry), localChanged);
}

/**
 * Post the selection state only when it changed — after a compose-ahead step,
 * or a presence merge, refresh or withdrawal. Newly composed pages can resolve
 * more of a selection — a peer's, or a host's by-id one naming a page this side
 * hadn't composed — and a presence merge most often carries a pointer and no
 * selection, but most of either change nothing, and an unchanged report would
 * still re-run every selection listener on the main thread (a PDF's annotation
 * read-back, a worker round trip of its own, among them) each time.
 */
function emitChangedSelection(): void {
    const selection = readSelection();
    if (JSON.stringify(selection) === JSON.stringify(lastSelection)) return;
    postSelection(selection, false);
}

/** The current selection state, read from the session. */
function readSelection(geometry?: SelectionGeometry): SelectionReportBody {
    return {
        geometry: geometry ??
            session?.selectionGeometry() ?? {
                objects: [],
                annotations: [],
                cells: [],
                text: [],
                caret: null,
                headers: null,
            },
        peers: session?.peerSelectionGeometry() ?? [],
        capabilities: session?.selectionCapabilities() ?? EMPTY_SELECTION_CAPABILITIES,
        properties: session?.selectionProperties() ?? null,
    };
}

/** Post `selection`, keeping it as the state {@link emitChangedSelection} compares against. */
function postSelection(selection: SelectionReportBody, localChanged: boolean): void {
    lastSelection = selection;
    scope.postMessage({ type: "selection", ...selection, localChanged });
}

/**
 * The peers last posted — the change gate for {@link emitPeers}. Empty before
 * the first report, as with no session.
 */
let lastPeers: Peer[] = [];

/**
 * Post the remote peers present, only when they changed. Called after anything
 * that may change them: a presence merge, refresh or withdrawal, and
 * open/close. Most merges carry a pointer or a selection of a peer already
 * present, and are posted nothing.
 */
function emitPeers(): void {
    const peers = session?.peers() ?? [];
    if (JSON.stringify(peers) === JSON.stringify(lastPeers)) return;
    lastPeers = peers;
    scope.postMessage({ type: "peers", peers });
}

/**
 * The peer pointers last posted — the change gate for {@link emitPeerPointers}.
 * Empty before the first report, as with no session.
 */
let lastPeerPointers: PeerPointer[] = [];

/**
 * Post every peer's pointer on the plane shown, only when they changed. Called
 * after anything that may change them: a presence merge, refresh or
 * withdrawal, a plane switch, and open/close. A merge carrying a selection or a
 * name changes no pointer, and is posted nothing.
 */
function emitPeerPointers(): void {
    const pointers = session?.peerPointers() ?? [];
    if (JSON.stringify(pointers) === JSON.stringify(lastPeerPointers)) return;
    lastPeerPointers = pointers;
    scope.postMessage({ type: "peerPointers", pointers });
}

/**
 * Post the current undo / redo availability so the host can enable or disable
 * its history controls. Called after anything that may change the edit history:
 * open (all-false), any committing edit (page edit, object move, undo, redo),
 * and a merge. Both false without a session.
 */
function emitHistory(): void {
    scope.postMessage({
        type: "history",
        canUndo: session?.canUndo() ?? false,
        canRedo: session?.canRedo() ?? false,
    });
}

// --- message handling -----------------------------------------------------
//
// Touch the session one job at a time. `init` is async; serializing guarantees
// an `open`/`set_view` can't interleave with it (and, once a future GPU render
// path awaits mid-frame, can't trigger a concurrent `&mut self` borrow on the
// Rust session). Reference: docmentis-udoc-viewer worker `processQueue`.
//
// A job is usually one message, but not always: the font pump installs what it
// fetched as a job of its own, so that the *waiting* on the network happens
// outside the lanes while the `&mut self` calls stay inside them. That is the
// rule the lanes really enforce — one thing at a time on the session — and
// anything that would hold it across an `await` on the network does not belong
// in a handler.
//
// Two lanes (`lanes.ts`): a reader's requests run before background work, which
// comes from the tasks below, in order of priority — the font pump's installs,
// the thumbnail strip's renders, compose-ahead and the sheet walk — and waits,
// too, for a pending frame to paint and for the reader to have been quiet a
// moment.

/**
 * How long the reader must have been quiet before any background work takes a
 * step — a font install, a thumbnail, compose-ahead, the sheet walk — in ms. Each of the
 * reader's inputs can ask the worker something — a hover hit-test, a pick, a
 * keystroke's edit — and one that lands behind a step waits out the whole step.
 * Longer than the gap between keystrokes, so typing doesn't render thumbnails
 * that its next keystroke's edit throws away.
 */
const BACKGROUND_QUIET_MS = 300;

/**
 * How many pages each compose-ahead step composes on a paged plane, and how
 * many rows on a worksheet's grid — whatever size of block the engine composes
 * them in, about 30 ms of composing on a large sheet. Kept small: composition
 * is synchronous, so a request that arrives during a step waits out the whole
 * step. Tune up for faster background fill, down for a quicker answer; each
 * step also costs a turn of the event loop, which a chain of them clamps to
 * 4 ms.
 */
const COMPOSE_BATCH = 2;
const COMPOSE_ROWS = 64;

/**
 * How many times a compose-ahead step on a grid asks for its rows at most,
 * passing over those already composed — the view's, which each frame composes —
 * to reach some that aren't. Rows already composed cost the engine a bit-check.
 */
const ROW_ASKS_PER_STEP = 256;

/**
 * Excel's row count. Compose-ahead on a grid ends here even when the grid
 * hasn't reported itself complete: the engine doesn't say how many rows a grid
 * has, so this is the walk's safety net.
 */
const SHEET_ROWS = 1_048_576;

/** The font pump's installs, waiting their turn. */
const fontInstalls: Job[] = [];

const fontTask: Task = {
    // A family landing re-shapes every composed page against it, which on a
    // long document takes a few hundred ms: worth waiting for a pause for.
    quietMs: BACKGROUND_QUIET_MS,
    pending: () => fontInstalls.length > 0,
    take: () => fontInstalls.shift()!,
};

/** The thumbnail strip's renders, queued and not yet run, by page: the scale, and the request to answer. */
const thumbnails = new Map<number, { id: number | undefined; scale: number }>();

/** The page the strip is centred on: the queued render nearest it runs first. */
let thumbnailFocus = 0;

const thumbnailTask: Task = {
    quietMs: BACKGROUND_QUIET_MS,
    pending: () => thumbnails.size > 0,
    take: () => {
        // Nearest the focus first — what the reader is looking at.
        let index = -1;
        let best = Infinity;
        for (const page of thumbnails.keys()) {
            const distance = Math.abs(page - thumbnailFocus);
            if (distance < best) {
                best = distance;
                index = page;
            }
        }
        const { id, scale } = thumbnails.get(index)!;
        thumbnails.delete(index);
        return () => renderQueuedThumbnail(id, index, scale);
    },
};

/**
 * Where compose-ahead has reached, or `null` with nothing left for it to
 * compose: on a paged plane, the composed page count its last step left; on a
 * worksheet's grid, the next row it asks for.
 */
let composeAt: { pages: number } | { rows: number } | null = null;

const composeTask: Task = {
    quietMs: BACKGROUND_QUIET_MS,
    pending: () => composeAt !== null,
    take: () => composeAhead,
};

/** The next sheet the walk loads, by plane, or `null` with no walk. */
let walkFrom: number | null = null;

const walkTask: Task = {
    quietMs: BACKGROUND_QUIET_MS,
    pending: () => walkFrom !== null,
    take: () => walkSheet,
};

const lanes = createLanes(
    {
        framePending: () => rafId !== null,
        now: () => performance.now(),
        schedule: (callback, ms) => {
            const timer = setTimeout(callback, ms);
            return () => clearTimeout(timer);
        },
        report: (error) => console.error("udoc: a worker job failed", error),
    },
    [
        timed("fontInstall", fontTask),
        timed("thumbnail", thumbnailTask),
        timed("composeAhead", composeTask),
        timed("sheetWalk", walkTask),
    ],
);

/** `task`, each of its steps timed into the perf counter as `event` while the counter is on. */
function timed(event: PerfEvent, task: Task): Task {
    return {
        quietMs: task.quietMs,
        pending: () => task.pending(),
        take: () => {
            const step = task.take();
            return async () => {
                if (!perf.enabled) return step();
                const start = performance.now();
                try {
                    await step();
                } finally {
                    perf.record(event, performance.now() - start);
                    reportPerf();
                }
            };
        },
    };
}

/** A request as posted to the worker: one of the engine's own, or a product's. */
type EngineRequestEnvelope = WorkerRequestEnvelope | (ExtensionRequest & { readonly _id?: number });

/** What the engine worker lends a request handler a product adds to it. */
export interface EngineWorker {
    /** The open document's session, or null with none open. */
    readonly session: WasmSession | null;
    /**
     * Finish a committing edit just made on `session`, as the engine's own
     * edits finish: re-post the selection and the history, repaint, and return
     * the layout to reply with.
     */
    committed(session: WasmSession): DocumentLayout;
    /** Repaint on the next frame — after a setting changed what is drawn. */
    scheduleFrame(): void;
}

/** A request a product's worker answers beyond the engine's own. */
export interface WorkerHandler<R extends ExtensionRequest = ExtensionRequest> {
    /**
     * Whether the request is a setting rather than a question: recorded (latest
     * wins) and replayed into each new session, as the engine's own settings
     * are.
     */
    readonly sticky?: boolean;
    /** Answer `request`; what it returns, or resolves to, is the reply. */
    handle(request: R, worker: EngineWorker): unknown;
}

/** A reply whose buffers move to the main thread rather than being copied. */
export class Transferring {
    constructor(
        readonly value: unknown,
        readonly transfer: Transferable[],
    ) {}
}

/** The requests the product serving the engine adds, by type. */
let handlers: Readonly<Record<string, WorkerHandler<never>>> = {};

const engineWorker: EngineWorker = {
    get session() {
        return session;
    },
    committed(s) {
        const layout = layoutOf(s);
        emitSelection(false);
        emitHistory();
        scheduleFrame();
        startComposeAhead(s);
        return layout;
    },
    scheduleFrame,
};

/**
 * Serve the engine on this worker: answer the engine's own requests and, by
 * type, `extra`'s. A product's worker entry calls this once.
 */
export function serveEngine(extra: Readonly<Record<string, WorkerHandler<never>>> = {}): void {
    handlers = extra;
    scope.onmessage = (ev: MessageEvent<EngineRequestEnvelope>) => {
        const request = ev.data;
        // Two hints, taken as they arrive rather than in turn: neither touches
        // the session, and what each says is about now. The reader's activity is
        // what the host reports of its inputs, and not the view requests: a
        // scroll is a run of inputs too, but the host also moves the view on its
        // own — a relayout re-clamping the scroll, the frame's view adopted
        // back — and none of that is the reader.
        if (request.type === "readerActivity") {
            lanes.active();
            return;
        }
        if (request.type === "thumbnailFocus") {
            thumbnailFocus = (request as ThumbnailFocusRequest).page;
            return;
        }
        enqueue(() => handle(request));
    };
}

/** Run `job` once the session is free, after the requests already waiting, before any background work. */
function enqueue(job: Job): void {
    lanes.request(job);
}

/**
 * The web-font pump. Kicking it starts fetches and returns — the waiting happens
 * on the event loop, and each batch installs as a job of its own, so nothing the
 * host sends ever waits behind a download. See `fonts/pump.ts`.
 */
/**
 * What the fulfiller remembers across orders: which css2 responses it has read,
 * and which woff2 files it has already handed the engine. Shared by both paths
 * that fetch — the pump below and `ensureFont` — because they fetch for the same
 * engine, and a file one of them installed is installed for the other too.
 *
 * One per worker, living as long as the worker: entry ids are minted from a
 * process-global counter and never reused, so a document change can only ever
 * miss in it, never hit the wrong font.
 */
const fontMemory = createFontFetchMemory();

const fetchFontOrders = createFontPump({
    session: () => session,
    // An install re-shapes what waited on its family: background work, after
    // what the reader asked for.
    enqueue: (job) => {
        fontInstalls.push(job);
        lanes.wake();
    },
    repaint: () => {
        scheduleFrame();
        fontsReshaped();
        // Text may sit elsewhere now; what the host placed by it is placed again.
        scope.postMessage({ type: "fontsRefreshed" });
    },
    fetch: (order) => fetchFontBinaries(order, fetch, fontMemory, googleFontEndpoint),
    schedule: (callback, ms) => void setTimeout(callback, ms),
});

/** Run `job` on the session and resolve with what it returned. */
function onSession<T>(job: (live: WasmSession) => T): Promise<T | undefined> {
    return new Promise((resolve) => {
        enqueue(() => resolve(session ? job(session) : undefined));
    });
}

/**
 * Whether the document just opened has yet to paint: its first frame starts
 * its background work, so what it shows is on screen before any other part of
 * it composes or loads.
 */
let backgroundAfterPaint = false;

/**
 * The open workbook's sheets loaded so far, by plane: those whose tab colour
 * the engine can read, and the host has been told.
 */
const loadedSheets = new Set<number>();

/** A document was just opened on `s`: drop the last one's background work, and start its own once it paints. */
function opened(s: WasmSession): void {
    stopBackground();
    backgroundAfterPaint = true;
    // The open loaded the sheet it shows, and no other yet.
    loadedSheets.add(s.currentPlane());
}

/** Start the background work `s`'s document leaves: composing ahead, and loading a workbook's other sheets. */
function startBackground(s: WasmSession): void {
    // A document still waiting for its password has nothing to compose yet;
    // `authenticate` opens it again.
    if (s.needsPassword()) return;
    if (s.docType() === "spreadsheet") walkFrom = 0;
    startComposeAhead(s);
}

/** Drop the open document's background work: compose-ahead and the sheet walk. */
function stopBackground(): void {
    backgroundAfterPaint = false;
    composeAt = null;
    walkFrom = null;
    loadedSheets.clear();
}

/**
 * Compose ahead on `s`'s current plane, a step at a time, as background work,
 * until it is complete. Pages compose lazily, so an open, an edit or a sheet
 * switch only lays out the visible window; this fills in the rest — a paged
 * plane's pages, growing the page count and content extent (and the
 * scrollbar) the host is told of ({@link ComposedReport}), or a worksheet's
 * rows, so a scroll finds them laid out.
 */
function startComposeAhead(s: WasmSession): void {
    composeAgain(s);
    // Web families a document references aren't bundled; the engine renders
    // them in a stand-in and puts them on order. Kicked now, so the visible
    // window's fonts start downloading at once rather than a step later.
    fetchFontOrders();
}

/** Start compose-ahead on `s`'s current plane over: a grid from its first row, a paged plane from its composed pages. */
function composeAgain(s: WasmSession): void {
    composeAt = composesByRows(s) ? { rows: 0 } : { pages: s.firstUncomposedPage() };
    lanes.wake();
}

/** Whether `s` shows a worksheet's grid, which composes by rows, rather than pages. */
function composesByRows(s: WasmSession): boolean {
    return s.docType() === "spreadsheet" && !s.planeIsChartsheet(s.currentPlane());
}

/**
 * Fonts landed and the document was re-shaped against them: a page break may
 * have moved, and a worksheet's composed rows were dropped, so compose ahead
 * again — once the document has painted, as after an open.
 */
function fontsReshaped(): void {
    if (!session || backgroundAfterPaint || session.docType() === undefined || session.needsPassword()) return;
    composeAgain(session);
}

/** Compose-ahead's next step, on a paged plane or a worksheet's grid. */
function composeAhead(): void {
    const at = composeAt;
    // Off before the step, so one that throws ends compose-ahead rather than
    // repeating.
    composeAt = null;
    if (!session || at === null) return;
    if ("rows" in at) composeRowsAhead(session, at.rows);
    else composePagesAhead(session, at.pages);
}

/** A paged plane's compose-ahead step: a few pages more, and the layout they grew posted. */
function composePagesAhead(s: WasmSession, from: number): void {
    const layout = composeThrough(s, from, from + COMPOSE_BATCH - 1);
    // `complete` is the engine saying there is nothing left to compose. The
    // no-growth check is the safety net: a page that fails to compose is left
    // out and never reports complete, and without it compose-ahead would spin
    // on it forever.
    if (!layout.complete && layout.firstUncomposedPage > from) composeAt = { pages: layout.firstUncomposedPage };
    scope.postMessage({ type: "composed", layout });
}

/**
 * A worksheet grid's compose-ahead step, from row `from` down: past the rows
 * already composed — the view's among them, which each frame composes with a
 * view below — to the next that aren't, which it composes. A grid's extent is
 * known before its rows are, so there is no layout to post. It ends once the
 * grid reports every row composed.
 */
function composeRowsAhead(s: WasmSession, from: number): void {
    const before = s.composedRowCount();
    let row = from;
    let done = false;
    for (let asked = 0; asked < ROW_ASKS_PER_STEP && !done; asked++) {
        done = s.updateLayout({ rows: { start: row, limit: row + COMPOSE_ROWS - 1 } });
        row += COMPOSE_ROWS;
        done ||= row >= SHEET_ROWS;
        if (s.composedRowCount() !== before) break;
    }
    if (!done) composeAt = { rows: row };
    // The rows just composed may name families nothing has asked for yet.
    fetchFontOrders();
}

/**
 * Compose `s`'s pages `start` through `pageLimit`, as an `updateLayout` request
 * or a paged compose-ahead step asks, and read its layout after, with
 * `complete`. A request asks from the first page — every page up to its
 * limit, and a worksheet's grid whole, which a pages scope covering it
 * composes: what a print or a page render needs. A compose-ahead step asks for
 * only the pages it adds, which a doc type with independent pages (PDF,
 * slides) composes alone.
 */
function composeThrough(s: WasmSession, start: number, pageLimit: number): DocumentLayout {
    // The pages composed are off-screen, so normally only the layout (page
    // count + extent) grows and no repaint is needed. But a fit derives its
    // zoom against the largest loaded page, so composing a larger page ahead
    // can shrink the fit zoom — changing the visible rendering even though the
    // new pages are off-screen. And a page composed above the one in view —
    // after a jump past pages not composed yet — moves it down the plane, and
    // the engine moves the view with it. Capture the scale and scroll across
    // the step and repaint only when one moved, so the frame hands the host
    // the scroll to adopt.
    const before = s.viewState();
    const complete = s.updateLayout({ pages: { start, limit: pageLimit } });
    const layout = { ...layoutOf(s), complete };
    followView(s, before[2]);
    const after = s.viewState();
    // A peer's selection can reference a page this side hadn't composed yet;
    // newly composed pages may resolve more of it.
    emitChangedSelection();
    if (after[0] !== before[0] || after[1] !== before[1] || after[2] !== before[2]) scheduleFrame();
    // The pages just composed may name families nothing has asked for yet.
    // Without this the pump would only ever see what the *visible* window
    // ordered, and a family first used on page 40 would sit on order until the
    // next edit. A no-op when nothing is on order, which is the common case.
    fetchFontOrders();
    return layout;
}

/**
 * The sheet walk's next step: load the open workbook's next sheet not loaded
 * yet, in tab order — the one the open showed, and any shown since, already
 * are — and post its tab colour and kind, so each tab shows its colour, and the
 * host knows each chartsheet, before its sheet is first shown.
 */
function walkSheet(): void {
    let plane = walkFrom;
    // Off before the step, as compose-ahead's is.
    walkFrom = null;
    if (!session || plane === null) return;
    const count = session.planeCount();
    while (plane < count && loadedSheets.has(plane)) plane++;
    if (plane >= count) return;
    loadSheet(session, plane);
    if (plane + 1 < count) walkFrom = plane + 1;
}

/** Load sheet `plane` of the open workbook, and post its tab colour and kind. */
function loadSheet(s: WasmSession, plane: number): void {
    s.spreadsheet.loadSheet(plane);
    loadedSheets.add(plane);
    scope.postMessage({
        type: "planeLoaded",
        plane,
        color: tabColorHex(s, plane),
        chartsheet: s.planeIsChartsheet(plane),
    });
}

/** Render the strip's queued thumbnail of page `index` at `scale`, and answer request `id` with it. */
function renderQueuedThumbnail(id: number | undefined, index: number, scale: number): void {
    if (!session) {
        reply(id, null);
        return;
    }
    try {
        const raster = rasterPage(session, 0, index, scale, true);
        reply(id, raster, undefined, [raster.rgba]);
    } catch (error) {
        reply(id, undefined, error);
    }
}

/** Answer every queued thumbnail render with nothing, and forget them. */
function dropThumbnails(): void {
    for (const { id } of thumbnails.values()) reply(id, null);
    thumbnails.clear();
}

/**
 * Rasterize page `index` of `plane` off the viewport: wholly separate from the
 * painted frame, so no repaint and no selection/history churn. The pixels move
 * out of the PageImage (so they aren't cloned) into a standalone, transferable
 * buffer — the binding copies them out of wasm memory, and `slice()` detaches
 * them, as the snapshot reads do — and the wasm-side handle is freed.
 */
function rasterPage(s: WasmSession, plane: number, index: number, scale: number, ephemeral: boolean): ThumbnailResult {
    const img = s.renderPageToRgba(plane, index, scale, ephemeral);
    const width = img.width;
    const height = img.height;
    const rgba = img.takeData().slice().buffer;
    img.free();
    return { rgba, width, height };
}

/** Plane `plane`'s tab colour as `#rrggbb`, or `null` for a tab in none. */
function tabColorHex(s: WasmSession, plane: number): string | null {
    const color = s.planeTabColor(plane);
    if (!color) return null;
    return `#${[color.r, color.g, color.b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * How long a font change spends fetching before going ahead without the rest.
 *
 * Checked between rounds, so it bounds the walk down the vendor chain rather
 * than any one fetch — a request already out is always waited for. Past it the
 * change applies with whatever landed and the faces that didn't fall back to the
 * old behaviour: a stand-in now, the real font when it arrives.
 *
 * It used to be the answer to "never leave the user's click unanswered", and was
 * short (1.5s) for that reason. The host now holds the UI visibly while this
 * runs, with a Cancel button (see `BusyModal`), so the user's way out no longer
 * depends on a timer — which frees this to be long enough for a slow connection
 * to actually finish instead of giving up just as the indicator appears.
 */
const FONT_WAIT_CAP_MS = 10_000;

/**
 * Get a family here, in every face the edit will produce, before applying it.
 *
 * These requests go straight to in-flight on the engine side, so the pump never
 * takes them and **nothing re-shapes**: no composed text is waiting on a family
 * the document doesn't use yet, and the edit that follows is the only thing that
 * composes. That is the whole reason this doesn't just kick the pump.
 *
 * `faces` is usually one pair, and more when the selection spans faces — a
 * paragraph with a bold word in it needs both binaries, or the bold word reflows
 * on its own later. Each round asks for the first face that still needs
 * something, so one loop covers all of them, and settling walks the vendor chain
 * a step at a time until nothing is left to ask.
 *
 * Only the engine calls go through the queue; the fetch itself never holds it.
 */
async function ensureFont(family: string, faces: Array<[boolean, boolean]>): Promise<boolean> {
    const deadline = performance.now() + FONT_WAIT_CAP_MS;
    for (;;) {
        const request = await onSession((live) => {
            // The characters the font will have to render. Nothing selected
            // means nothing on screen is about to change — no reflow to avoid.
            const characters = live.selectedText();
            if (characters === "") return null;
            for (const [bold, italic] of faces) {
                const next = live.requestFont(family, bold, italic, characters);
                if (next) return next;
            }
            return null;
        });
        if (!request) return true;
        if (performance.now() > deadline) return false;
        const binaries = await fetchFontBinaries(request, fetch, fontMemory, googleFontEndpoint);
        await onSession((live) => live.completeFontRequest(BigInt(request.id), binaries));
    }
}

async function handle(request: EngineRequestEnvelope): Promise<void> {
    const id = request._id;
    const handler = handlers[request.type];
    // Recorded before it is applied, so the state survives even if this session
    // is the one being replaced. Latest wins.
    if (STICKY_REQUESTS.has(request.type) || handler?.sticky) sticky.set(request.type, request);
    try {
        if (handler) {
            const result = await handler.handle(request as never, engineWorker);
            if (result instanceof Transferring) reply(id, result.value, undefined, result.transfer);
            else reply(id, result);
            return;
        }
        const msg = request as WorkerRequestEnvelope;
        switch (msg.type) {
            case "init": {
                await initEngine({ module_or_path: msg.wasmUrl });
                fonts = msg.fonts;
                if (msg.googleFontFamilies) googleFontFamilies = msg.googleFontFamilies;
                googleFontEndpoint = msg.googleFontEndpoint;
                if (msg.enableCanvasFonts) canvasText = await createCanvasText();
                reply(id, undefined);
                break;
            }
            case "start": {
                if (!fonts) throw new Error("engine worker: start before init");
                // Start first, release second. A refusal — a spent quota, an
                // unreachable permit service — must leave whatever is already
                // open exactly as it was, so the previous session is only
                // dropped once its replacement exists. The two overlap for one
                // statement, and the new one holds no document yet.
                //
                // Freeing is explicit because dropping the JS handle does not
                // release the Rust side, and a session holds a whole parsed
                // document.
                //
                // The package's own fonts go in with the session itself — the
                // office-compatible fonts by URL, and the Google font catalog,
                // which is what makes a referenced web family orderable at all.
                // A catalog of the wrong shape is a refusal like any other.
                const started = await startSession(msg.config, fonts, googleFontFamilies);
                // The host's own fonts go in before the swap, for the same
                // reason: a URL font of the wrong shape rejects here, and the
                // open document stays as it was.
                try {
                    for (const bytes of hostLocalFonts) started.registerLocalFont(bytes);
                    started.registerUrlFonts(hostUrlFonts);
                    if (canvasText) started.setCanvasText(canvasText);
                } catch (error) {
                    started.free();
                    throw error;
                }
                session?.free();
                session = started;
                // Nothing of the last session's background work carries over.
                stopBackground();
                dropThumbnails();
                // Nor does the last view pushed to Rust: the new session has
                // no viewport yet, so the host's next `setViewport` (the open
                // path sends one) must reach it even at an unchanged size —
                // deduped against the old session's, it never would, and the
                // document would paint nothing until the viewport resized.
                lastW = lastH = lastDpr = Number.NaN;
                lastScrollX = lastScrollY = lastZoom = Number.NaN;
                if (canvas) session.attach(canvas);
                // A fresh session clears any prior poisoned-render state.
                renderPoisoned = false;
                // Carry the perf toggle onto the new session, so its
                // per-frame phase timing matches the active counter.
                if (perf.enabled) session.setPerf(true);
                // Replay the host's presentation state into it. Stripped of its
                // correlation id: the client was answered when the message
                // first arrived, and answering twice would resolve a promise
                // that is already settled.
                for (const recorded of sticky.values()) {
                    const replay = { ...recorded };
                    delete replay._id;
                    await handle(replay);
                }
                reply(id, session.entitlements());
                break;
            }
            case "attach": {
                // Held, not handed straight on: a canvas transfers once, and
                // the session that paints into it is replaced per document.
                canvas = msg.canvas;
                session?.attach(canvas);
                reply(id, undefined);
                break;
            }
            case "registerFonts": {
                // Held, not registered on the open session: its font system
                // was built when its document opened, so they reach the
                // sessions `start` starts from here on.
                hostLocalFonts.push(...msg.local);
                hostUrlFonts.push(...msg.url);
                break;
            }
            case "open":
            case "openRemote": {
                if (!session) throw new Error(`engine worker: ${msg.type} before start`);
                // Hold the first paint until the host applies this document's
                // spacing (see `awaitingSpacing`).
                awaitingSpacing = true;
                if (msg.type === "open") session.open(new Uint8Array(msg.bytes), msg.format, msg.delimiter);
                else session.openRemote(msg.url, fetchSync);
                reply(id, openedLayout(session));
                opened(session);
                break;
            }
            case "authenticate": {
                if (!session) throw new Error("engine worker: authenticate before start");
                // A refused password leaves the document waiting for another,
                // which the layout says; the host asks again.
                session.authenticate(msg.password);
                reply(id, openedLayout(session));
                opened(session);
                break;
            }
            case "setViewport": {
                viewportSeq = msg.seq;
                if (session) applyViewport(session, msg.viewport, msg.anchorShift);
                scheduleFrame();
                break;
            }
            case "goToPage": {
                viewportSeq = msg.seq;
                if (session) {
                    session.goToPage(msg.index);
                    // Adopt the viewer's resulting (clamped) scroll as our
                    // last-known view, so the setViewport the main thread
                    // echoes once it mirrors this scroll is a no-op rather than
                    // a redundant re-send. The next frame streams the new
                    // scroll + centered page back (see emitPageViews).
                    const st = session.viewState();
                    lastScrollX = st[1] ?? lastScrollX;
                    lastScrollY = st[2] ?? lastScrollY;
                }
                scheduleFrame();
                break;
            }
            case "goToRect": {
                viewportSeq = msg.seq;
                if (session) {
                    const { x0, y0, x1, y1 } = msg.rect;
                    session.goToRect(msg.index, x0, y0, x1, y1, msg.alignment);
                    // Adopt the resulting scroll, as `goToPage` does.
                    const st = session.viewState();
                    lastScrollX = st[1] ?? lastScrollX;
                    lastScrollY = st[2] ?? lastScrollY;
                }
                scheduleFrame();
                break;
            }
            case "goToDestination": {
                viewportSeq = msg.seq;
                // A destination the document can't resolve leaves the view; one
                // that lands may set the zoom as well as the scroll, so adopt
                // both, as `zoomToRect` does.
                const view = safeRead(
                    () => session?.portable.goToDestination(msg.destination, msg.alignment) ?? null,
                    null,
                );
                if (session) adoptView(session);
                reply(id, view);
                scheduleFrame();
                break;
            }
            case "goToBookmark": {
                viewportSeq = msg.seq;
                if (session) {
                    session.wordprocessing.goToBookmark(msg.name, msg.alignment);
                    // Adopt the resulting scroll, as `goToRect` does.
                    const st = session.viewState();
                    lastScrollX = st[1] ?? lastScrollX;
                    lastScrollY = st[2] ?? lastScrollY;
                }
                scheduleFrame();
                break;
            }
            case "zoomAtPoint": {
                viewportSeq = msg.seq;
                if (session) {
                    session.zoomAtPoint(msg.zoom, msg.x, msg.y);
                    adoptView(session);
                }
                scheduleFrame();
                break;
            }
            case "zoomToRect": {
                viewportSeq = msg.seq;
                if (session) {
                    session.zoomToRect(msg.x, msg.y, msg.width, msg.height);
                    adoptView(session);
                }
                scheduleFrame();
                break;
            }
            case "invalidate": {
                if (msg.rect) session?.invalidateRect(msg.rect.x, msg.rect.y, msg.rect.width, msg.rect.height);
                else session?.invalidate();
                scheduleFrame();
                break;
            }
            case "setBackdrop": {
                // Sticky in Rust: re-applied to every subsequent open, so a
                // document opened later keeps the host's backdrop.
                session?.setBackdropColor(msg.color.r, msg.color.g, msg.color.b);
                scheduleFrame();
                break;
            }
            case "setPageBorder": {
                // Sticky in Rust, like the backdrop. Pure paint: the next frame
                // reconciles and repaints the frame around each page, or drops it.
                if (msg.color) session?.setPageBorderColor(msg.color.r, msg.color.g, msg.color.b);
                else session?.clearPageBorder();
                scheduleFrame();
                break;
            }
            case "setBrandingInset": {
                // Sticky in Rust, like the backdrop. The decal moves, so re-post
                // its rect for the attribution link as well as repainting it.
                if (session) {
                    session.setBrandingInset(msg.inset);
                    emitBrandingRect(session);
                }
                scheduleFrame();
                break;
            }
            // NOTE: `setGuideColors` / `setRulerVisible` were removed — guide
            // chrome is now host-rendered (colors are CSS, visibility is DOM), so
            // these messages are no longer sent. The guide render list is pulled
            // via `session.guide()` (to be wired into the frame). The unused
            // request variants and their `WorkerClient` senders are cleaned up in
            // the guide-render pass.
            case "setSpacing": {
                // Padding edges are CSS px and the gaps document points — the
                // wasm boundary multiplies the `px` edges by the dpr into the
                // viewer's device px. Sticky in Rust, like the backdrop.
                session?.setSpacing(msg.contentPadding, msg.pageGap);
                // The document's spacing is now applied — release the opening
                // paint held since `open` so the first frame is correctly padded.
                awaitingSpacing = false;
                scheduleFrame();
                break;
            }
            case "setScrollbarSize": {
                // CSS px; the wasm boundary multiplies by the dpr. Sticky in
                // Rust, like the spacing.
                session?.setScrollbarSize(msg.size);
                scheduleFrame();
                break;
            }
            case "setFit": {
                // Sticky in Rust: the derived zoom re-fits on every resize.
                session?.setFit(msg.fit);
                scheduleFrame();
                break;
            }
            case "setDefaultFit": {
                // Read at the next open, which fits by it before the first frame.
                defaultFit = msg.fit;
                break;
            }
            case "setDpi": {
                // Sticky: replayed into every session `start` starts.
                dpi = msg.dpi;
                if (session) session.setDpi(viewDpiOf(session));
                scheduleFrame();
                break;
            }
            case "setDefaultZoom": {
                // Read at the next open, like the default fit.
                defaultZoom = msg.zoom;
                break;
            }
            case "setScrollMode": {
                // Sticky in Rust, until the next open applies the default.
                session?.setScrollMode(msg.mode);
                scheduleFrame();
                break;
            }
            case "setDefaultScrollMode": {
                // Read at the next open, like the default fit.
                defaultScrollMode = msg.mode;
                break;
            }
            case "setLayoutMode": {
                // Sticky in Rust, like the spacing; the next frame re-stacks.
                session?.setLayoutMode(msg.mode);
                scheduleFrame();
                break;
            }
            case "setPageRotation": {
                // Sticky in Rust, like the spacing; the next frame re-stacks.
                session?.setPageRotation(msg.quarterTurns);
                scheduleFrame();
                break;
            }
            case "setPerf": {
                // Toggle of the perf counter. Swap the counter and tell the
                // engine to (stop) timing each frame's phases, then paint one
                // frame so an enabled HUD gets a first sample promptly.
                perf = msg.enabled ? new PerformanceCounter() : new NoOpPerformanceCounter();
                perfReportAt = performance.now();
                session?.setPerf(msg.enabled);
                if (msg.enabled) scheduleFrame();
                break;
            }
            case "updateLayout": {
                if (!session) throw new Error("engine worker: updateLayout before open");
                // What can't wait for compose-ahead — a print, a page render —
                // composes through the page it needs now.
                reply(id, composeThrough(session, 0, msg.pageLimit));
                break;
            }
            case "ensureFont": {
                if (!session) throw new Error("engine worker: ensureFont before open");
                // Fire and reply later: `ensureFont` re-enters the queue for each
                // engine call and does its fetching outside it, so the handler
                // itself has nothing to wait for and holds nothing up.
                void ensureFont(msg.family, msg.faces).then((here) => reply(id, here));
                break;
            }
            case "fetchFontOrders": {
                if (!session) throw new Error("engine worker: fetchFontOrders before open");
                // A kick, not a round: this starts the fetches and returns. They
                // land on the event loop and install as jobs of their own, so
                // nothing waits behind the network — see "the font pump" above.
                fetchFontOrders();
                reply(id, undefined);
                break;
            }
            case "settleFonts": {
                if (!session) throw new Error("engine worker: settleFonts before open");
                // Answered once the pump is quiet, not waited for here: the
                // fonts land on the event loop and install as jobs of their
                // own, so this request holds nothing up behind it.
                void fetchFontOrders.settled().then((waited) => reply(id, waited));
                break;
            }
            case "planeInfo": {
                if (!session) throw new Error("engine worker: planeInfo before open");
                // The plane roster (sheet tabs): count + active + each plane's
                // name, tab colour, kind and visibility — the
                // colour and kind of the sheets loaded so far, the rest following
                // from the sheet walk. A pure read — no compose, no repaint.
                const count = session.planeCount();
                const names: string[] = [];
                const colors: (string | null | undefined)[] = [];
                const chartsheets: boolean[] = [];
                const visibility: SheetState[] = [];
                for (let i = 0; i < count; i++) {
                    names.push(session.planeName(i) ?? "");
                    colors.push(loadedSheets.has(i) ? tabColorHex(session, i) : undefined);
                    chartsheets.push(session.planeIsChartsheet(i));
                    visibility.push(session.planeSheetState(i) ?? "visible");
                }
                reply(id, { count, current: session.currentPlane(), names, colors, chartsheets, visibility });
                break;
            }
            case "goToPlane": {
                if (!session) throw new Error("engine worker: goToPlane before open");
                // Switch the active sheet: the viewer resets to the new plane's
                // top; refresh the selection (a new plane has its own), and
                // repaint. The frame composes the sheet, as after an open, so
                // the layout replied is the one known before it — the frame
                // reports the sheet's extent once it has painted.
                session.goToPlane(msg.plane);
                // A sheet shown before the walk reached it loads now, and the
                // host learns its tab's colour at once.
                if (session.docType() === "spreadsheet" && !loadedSheets.has(msg.plane)) loadSheet(session, msg.plane);
                const layout = layoutOf(session);
                emitSelection(false);
                // The peers' pointers on the plane now shown.
                emitPeerPointers();
                scheduleFrame();
                // After the frame that paints it, the rest of the sheet.
                startComposeAhead(session);
                reply(id, layout);
                break;
            }
            case "renderThumbnail": {
                if (!session) throw new Error("engine worker: renderThumbnail before open");
                // A one-off preview, now — a slide layout's, a page to print.
                const raster = rasterPage(session, msg.plane, msg.index, msg.scale, msg.ephemeral ?? true);
                reply(id, raster, undefined, [raster.rgba]);
                break;
            }
            case "queueThumbnail": {
                // The strip's render, queued for the background, to run nearest
                // the strip's focus once the reader is quiet. One that replaces
                // an earlier request for the page answers that one with nothing.
                const earlier = thumbnails.get(msg.index);
                if (earlier) reply(earlier.id, null);
                thumbnails.set(msg.index, { id, scale: msg.scale });
                lanes.wake();
                break;
            }
            case "cancelThumbnail": {
                const queued = thumbnails.get(msg.index);
                if (queued) {
                    thumbnails.delete(msg.index);
                    reply(queued.id, null);
                }
                break;
            }
            case "dropThumbnails": {
                dropThumbnails();
                break;
            }
            case "history": {
                if (!session) throw new Error("engine worker: history before open");
                applyHistory(session, msg.op);
                const layout = layoutOf(session);
                // The edit (or its undo/redo) may have moved or deleted
                // selected objects — refresh the selection overlay.
                emitSelection(false);
                emitHistory();
                scheduleFrame();
                startComposeAhead(session);
                reply(id, layout);
                break;
            }
            case "selectText": {
                // Selection is presence, not an edit: nothing in the document
                // changes, so no repaint — only the overlay geometry updates. The
                // host has already routed the gesture's domain on a `hitTest`, so
                // it calls the matching per-domain picker; the session carries the
                // two points + options to the open document's engine, which
                // hit-tests its own layout and lands the caret / range.
                if (session) {
                    const before = session.viewState()[5] ?? -1;
                    emitSelection(
                        true,
                        session.selectText(msg.anchor.x, msg.anchor.y, msg.focus.x, msg.focus.y, msg.options),
                    );
                    refreshChrome(session, before);
                }
                break;
            }
            case "selectObjects": {
                if (session) {
                    const before = session.viewState()[5] ?? -1;
                    emitSelection(
                        true,
                        session.selectObjects(
                            msg.anchor.x,
                            msg.anchor.y,
                            msg.focus.x,
                            msg.focus.y,
                            msg.mode,
                            msg.enclose,
                        ),
                    );
                    refreshChrome(session, before);
                }
                break;
            }
            case "selectSheetCells": {
                if (session) {
                    emitSelection(
                        true,
                        session.selectSheetCells(msg.anchor.x, msg.anchor.y, msg.focus.x, msg.focus.y, msg.options),
                    );
                }
                break;
            }
            case "selectTableCells": {
                // A block inside a graphic frame's table — the drawing cousin of
                // `selectSheetCells`. Presence like every picker; `refreshChrome`
                // because leaving a shape's text moves the ruler origin back off
                // that frame (a caret in a *cell* anchors no ruler).
                if (session) {
                    const before = session.viewState()[5] ?? -1;
                    emitSelection(
                        true,
                        session.selectTableCells(msg.anchor.x, msg.anchor.y, msg.focus.x, msg.focus.y, msg.options),
                    );
                    refreshChrome(session, before);
                }
                break;
            }
            case "selectTableRows":
            case "selectTableColumns":
            case "selectTable": {
                // The three point-free widenings of a table selection. Grouped
                // because they differ only in which verb runs: same presence-only
                // shape, same chrome refresh, and each declines on its own when
                // the selection is not in a table.
                if (session) {
                    const before = session.viewState()[5] ?? -1;
                    emitSelection(
                        true,
                        msg.type === "selectTableRows"
                            ? session.selectTableRows()
                            : msg.type === "selectTableColumns"
                              ? session.selectTableColumns()
                              : session.selectTable(),
                    );
                    refreshChrome(session, before);
                }
                break;
            }
            case "selectSheetColumns": {
                // A header-band gesture: whole columns (x resolves them, y ignored)
                // — like `selectSheetCells`, presence only, no repaint.
                if (session) {
                    emitSelection(
                        true,
                        session.selectSheetColumns(msg.anchor.x, msg.anchor.y, msg.focus.x, msg.focus.y, msg.options),
                    );
                }
                break;
            }
            case "selectSheetRows": {
                if (session) {
                    emitSelection(
                        true,
                        session.selectSheetRows(msg.anchor.x, msg.anchor.y, msg.focus.x, msg.focus.y, msg.options),
                    );
                }
                break;
            }
            case "selectSheet": {
                // The corner box: the whole sheet.
                if (session) {
                    emitSelection(true, session.selectSheet());
                    // Selecting all leaves any text edit, so the ruler's "0"
                    // returns from the frame to the page origin.
                    refreshChrome(session);
                }
                break;
            }
            case "moveTextCaret": {
                // A caret-move key: presence only, like a text drag — the
                // session re-lands the caret and returns the fresh geometry.
                if (session) {
                    // `movement` is the declared `TextCaretMove` string; it decodes
                    // straight into the engine's caret-move enum at the boundary.
                    emitSelection(true, session.moveTextCaret(msg.movement, msg.extend));
                    // A caret that crosses into another text frame moves the
                    // ruler's "0"; within one frame this no-ops on the gate.
                    refreshChrome(session);
                }
                break;
            }
            case "clearSelection": {
                if (session) {
                    emitSelection(true, session.clearSelection());
                    // Clearing a text edit returns the ruler's "0" to the page origin.
                    refreshChrome(session);
                }
                break;
            }
            case "hitTest": {
                // Pick: the whole hit under this viewport point (entity + text
                // caret), the read behind the host's hover cursor and click
                // routing. A pure read over the live layout — no edit, no repaint.
                // The wasm returns the doc-tagged `UDocHit` object directly (like
                // `selection`) — the typed boundary, no parse.
                reply(id, session ? session.hitTest(msg.x, msg.y) : "none");
                break;
            }
            case "mintId": {
                // Allocate a fresh CRDT-safe id for a host building a new object
                // to insert — a pure read, no edit. `null` with no open document
                // or a doc type that mints no ids.
                reply(id, session ? (session.mintId() ?? null) : null);
                break;
            }
            case "pageIdByIndex": {
                // A pure read: one page's id. Undefined past the last page, or
                // with no open / non-portable doc.
                reply(
                    id,
                    safeRead(() => session?.portable.model.root.pageIdByIndex(msg.index), undefined),
                );
                break;
            }
            case "pageIds": {
                // A pure read: every page's id, in page order. Empty with no
                // open / non-portable doc.
                reply(
                    id,
                    safeRead(() => session?.portable.model.root.pageIds(), []),
                );
                break;
            }
            case "pageMode": {
                // A pure read: the document's `/PageMode`. Null when it gives
                // none, or with no open / non-portable doc.
                reply(
                    id,
                    safeRead(() => session?.portable.model.root.pageMode() ?? null, null),
                );
                break;
            }
            case "search": {
                if (!session) throw new Error("engine worker: search before open");
                // Stateless: the batch comes back with its continuation, and
                // the layout after it — a search lays out the pages its
                // matches are drawn on.
                const batch = session.search(msg.query, msg.options, msg.scope ?? undefined, msg.from ?? undefined);
                reply(id, { batch, layout: layoutOf(session) });
                break;
            }
            case "searchMatchSelection": {
                // A pure read — null with no open doc or nothing to select.
                reply(
                    id,
                    safeRead(() => session?.searchMatchSelection(msg.location) ?? null, null),
                );
                break;
            }
            case "outline": {
                // A read that loads the outline part on first use. One with no
                // items with no open / non-portable doc.
                reply(
                    id,
                    safeRead(() => session?.portable.model.outline.dump(), { items: [] }),
                );
                break;
            }
            case "fontInfoList": {
                // A read that walks the document's fonts on first use. One with
                // no fonts with no open / non-portable doc.
                reply(
                    id,
                    safeRead(() => session?.portable.model.fontInfoList.dump(), { fonts: [] }),
                );
                break;
            }
            case "acroForm": {
                // A read that loads the form part on first use. One with no
                // fields with no open / non-portable doc.
                reply(
                    id,
                    safeRead(() => session?.portable.model.acroForm.dump(), EMPTY_ACRO_FORM),
                );
                break;
            }
            case "formWidget": {
                // A read of the field a widget belongs to, with the widget.
                // Null with no open / non-portable doc.
                reply(id, session ? formWidget(session, msg.page, msg.widget) : null);
                break;
            }
            case "optionalContentProperties": {
                // A read that loads the optional content properties part on
                // first use. Null with no open / non-portable doc.
                reply(
                    id,
                    safeRead(() => session?.portable.model.optionalContentProperties.dump() ?? null, null),
                );
                break;
            }
            case "optionalContentOff": {
                reply(
                    id,
                    safeRead(() => session?.portable.optionalContentOff(), []),
                );
                break;
            }
            case "setOptionalContentGroupOn": {
                // Session state, not an edit: no history, no document change.
                // The switch recomposes what was composed, so the selection's
                // geometry re-posts and a repaint redraws.
                const changed = safeRead(() => session?.portable.setOptionalContentGroupOn(msg.id, msg.on), false);
                if (changed) {
                    emitSelection(false);
                    scheduleFrame();
                }
                reply(id, changed);
                break;
            }
            case "hideAnnotations": {
                // Session state, not an edit, as a layer switch is.
                const changed = safeRead(() => session?.portable.hideAnnotations(msg.targets, msg.hide), false);
                if (changed) {
                    emitSelection(false);
                    scheduleFrame();
                }
                reply(id, changed);
                break;
            }
            case "pageSize": {
                // A doc-type-agnostic pure read: the page's size in document
                // points (for the thumbnail strip). Zero when there's no doc or
                // the page is out of range / not composed — a read degrades to
                // "unknown" rather than rejecting.
                let size = { width: 0, height: 0 };
                try {
                    // The strip only ever sizes slide-plane pages — plane 0.
                    if (session) size = session.pageSize(0, msg.index);
                } catch {
                    // out of range / not composed — fall through to zero.
                }
                reply(id, size);
                break;
            }
            case "selectObjectsById": {
                // Selection by id: presence, not an edit (like a pointer select),
                // so the new geometry rides back with localChanged: true — the cue
                // to broadcast presence — and nothing repaints.
                // Resolve the page index to its stable id (a portable selection is
                // page-scoped, addressed by id) from the catalog, like
                // `insertObject` does. An empty id list clears, so it needs no page.
                if (session) {
                    const pageId = msg.ids.length === 0 ? "" : session.portable.model.root.pageIdByIndex(msg.page);
                    if (pageId !== undefined) {
                        emitSelection(true, session.setSelection(Selection.objects(pageId, msg.ids)));
                        // An object selection leaves any text edit, so the ruler's
                        // "0" returns from the frame to the page origin.
                        refreshChrome(session);
                    }
                }
                break;
            }
            case "selectedObjects": {
                // A pure read — the ids of the current selection, so a host can
                // act on it by id.
                reply(id, session ? Selection.objectIds(session.selection()) : []);
                break;
            }
            case "selectionGeometry": {
                // A pure read — the local selection's geometry now, after every
                // select sent before it.
                reply(
                    id,
                    safeRead(() => session?.selectionGeometry(), EMPTY_SELECTION_GEOMETRY),
                );
                break;
            }
            case "selectedAnnotations": {
                // A pure read — the selected annotations' values, found in their
                // page's annotations part, in its paint order.
                reply(id, session ? selectedAnnotations(session) : null);
                break;
            }
            case "pageComments": {
                // A read that loads what it reads: each page's annotations part,
                // reached through the page list, composed or not.
                reply(id, session ? pageComments(session, msg.pages) : []);
                break;
            }
            case "pageAnnotations": {
                // A read that loads what it reads, as pageComments.
                reply(id, session ? pageAnnotations(session, msg.pages) : []);
                break;
            }
            case "annotation": {
                const page = msg.page;
                reply(
                    id,
                    safeRead(() => session?.portable.model.page(page).annotation(msg.id).dump() ?? null, null),
                );
                break;
            }
            case "pageMedia": {
                // A read of one composed page's media elements. Empty with no
                // open / non-presentation doc, or a page not composed.
                reply(
                    id,
                    safeRead(() => session?.presentation.layout.page(msg.page).media(), []),
                );
                break;
            }
            case "mediaData": {
                // A read that loads the one media part on first use. Null with
                // no open / non-presentation doc, or no such file.
                const file = session ? mediaData(session, msg.media) : null;
                reply(id, file, undefined, file ? [file.bytes] : undefined);
                break;
            }
            case "sheetIdByIndex": {
                // A pure read: one sheet's id. Undefined past the last sheet, or
                // with no open / non-spreadsheet doc.
                reply(
                    id,
                    safeRead(() => session?.spreadsheet.model.root.sheetIdByIndex(msg.index), undefined),
                );
                break;
            }
            case "setSelection": {
                // Agnostic id-addressed selection set (presentation shapes, etc.):
                // presence, not an edit — the new geometry rides back with
                // localChanged: true (the cue to broadcast presence) and nothing
                // repaints. The doc-type-neutral twin of `selectObjectsById`.
                if (session) {
                    emitSelection(true, session.setSelection(msg.selection));
                    // The set selection may enter or leave a text edit, moving the
                    // ruler's "0" between the frame and the page origin.
                    refreshChrome(session);
                }
                break;
            }
            case "selection": {
                // A pure read — the current selection as the tagged UDocSelection
                // (or null), so a host can see the selection whatever the
                // doc type.
                reply(id, session ? (session.selection() ?? null) : null);
                break;
            }
            case "copy": {
                // Capture the selection as a doc-tagged `UDocFragment` for the
                // system clipboard — a pure read, no edit. The wasm returns the
                // fragment directly, or `undefined` when nothing copyable is
                // selected; `null` with no open document.
                reply(id, session ? (session.copy() ?? null) : null);
                break;
            }
            case "plainText": {
                // Project a copied fragment to its `text/plain` flavor — a pure
                // read over the passed fragment; `""` with no open document.
                reply(id, session ? session.plainText(msg.fragment) : "");
                break;
            }
            case "executeOnSelection": {
                if (!session) throw new Error("engine worker: executeOnSelection before open");
                // A committing edit on the current selection. The edit names no
                // ids: the open document's engine binds it to the live selection
                // and the matching command (a portable object or annotation
                // command, a shape command) — the id resolution the worker used
                // to do (`runOnSelection`) now lives in Rust. Tag the caller's
                // edit with the open doc type for the typed boundary (see
                // {@link taggedSelectionEdit}). A delete edit additionally clears
                // the now-dangling selection.
                session.executeOnSelection(taggedSelectionEdit(msg.edit, session.docType()));
                const layout = layoutOf(session);
                const kind = typeof msg.edit === "object" && "kind" in msg.edit ? msg.edit.kind : undefined;
                if (kind === "deleteObjects" || kind === "deleteAnnotations" || kind === "deleteShapes") {
                    session.clearSelection();
                }
                emitSelection(false);
                emitHistory();
                scheduleFrame();
                startComposeAhead(session);
                reply(id, layout);
                break;
            }
            case "execute": {
                if (!session) throw new Error("engine worker: execute before open");
                // The generic write seam: run a host-crafted UDocCommand
                // straight through the wasm `execute` ABI. Page edits, object
                // inserts, and host commands all arrive here as built commands; the
                // selection edits are the only writes that don't (they need
                // server-side selection resolution — see `executeOnSelection`). A
                // committing edit, so the layout rides back, the selection
                // geometry re-posts, history updates, and a repaint redraws.
                exec(session, msg.command);
                const layout = layoutOf(session);
                emitSelection(false);
                emitHistory();
                scheduleFrame();
                startComposeAhead(session);
                reply(id, layout);
                break;
            }
            case "snapshot": {
                if (!session) throw new Error("engine worker: snapshot before open");
                // Copy the CRDT bytes out of wasm memory into a standalone
                // buffer we can transfer to the main thread without a clone.
                const buffer = session.snapshot().slice().buffer;
                reply(id, buffer, undefined, [buffer]);
                break;
            }
            case "saveToBytes": {
                if (!session) throw new Error("engine worker: saveToBytes before open");
                // Out of wasm memory into a standalone, transferable buffer.
                const buffer = session.saveToBytes(msg.format, msg.strategy).slice().buffer;
                reply(id, buffer, undefined, [buffer]);
                break;
            }
            case "originalBytes": {
                if (!session) throw new Error("engine worker: originalBytes before open");
                const buffer = session.originalBytes().slice().buffer;
                reply(id, buffer, undefined, [buffer]);
                break;
            }
            case "saveToPackage": {
                if (!session) throw new Error("engine worker: saveToPackage before open");
                const buffer = session.saveToPackage(msg.version).slice().buffer;
                reply(id, buffer, undefined, [buffer]);
                break;
            }
            case "exportToBytes": {
                if (!session) throw new Error("engine worker: exportToBytes before open");
                const buffer = session.exportToBytes(msg.format).slice().buffer;
                reply(id, buffer, undefined, [buffer]);
                break;
            }
            case "exportPageToBytes": {
                if (!session) throw new Error("engine worker: exportPageToBytes before open");
                // Plane 0 — the document's primary plane (the deck for a
                // presentation).
                const buffer = session.exportPageToBytes(0, msg.index, msg.format).slice().buffer;
                reply(id, buffer, undefined, [buffer]);
                break;
            }
            case "setUserInfo": {
                // Sticky in Rust (re-applied on every open). Re-post the
                // selection with localChanged: true so the host broadcasts
                // presence — peers learn the name even without a selection
                // change. No document state changes, so no repaint.
                session?.setUserInfo(msg.name);
                emitSelection(true);
                break;
            }
            case "presence": {
                if (!session) throw new Error("engine worker: presence before open");
                const buffer = session.presence().slice().buffer;
                reply(id, buffer, undefined, [buffer]);
                break;
            }
            case "mergePresence": {
                if (!session) throw new Error("engine worker: mergePresence before open");
                // Engine- and repaint-free: only the peer overlay changes, so
                // no frame is scheduled — the refreshed peer geometry rides
                // the selection report (localChanged: false, no ping-pong),
                // and the pointers their own. A pointer moving is most of what
                // merges, so each report is posted only when it changed.
                session.mergePresence(new Uint8Array(msg.data));
                emitChangedSelection();
                emitPeers();
                emitPeerPointers();
                reply(id, undefined);
                break;
            }
            case "setPointer": {
                if (!session) throw new Error("engine worker: setPointer before open");
                // Presence only, and never a selection: no report.
                const buffer = session.setPointer(msg.x, msg.y).slice().buffer;
                reply(id, buffer, undefined, [buffer]);
                break;
            }
            case "clearPointer": {
                if (!session) throw new Error("engine worker: clearPointer before open");
                const buffer = session.clearPointer().slice().buffer;
                reply(id, buffer, undefined, [buffer]);
                break;
            }
            case "refreshPresence": {
                if (!session) throw new Error("engine worker: refreshPresence before open");
                // Peers that vanished drop out of both overlays.
                session.refreshPresence();
                emitChangedSelection();
                emitPeers();
                emitPeerPointers();
                reply(id, undefined);
                break;
            }
            case "withdrawPresence": {
                if (!session) throw new Error("engine worker: withdrawPresence before open");
                // Every peer is forgotten here, so both overlays empty.
                const buffer = session.withdrawPresence().slice().buffer;
                emitChangedSelection();
                emitPeers();
                emitPeerPointers();
                reply(id, buffer, undefined, [buffer]);
                break;
            }
            case "versionVector": {
                if (!session) throw new Error("engine worker: versionVector before open");
                // Pure read — no engine work, no repaint.
                const buffer = session.versionVector().slice().buffer;
                reply(id, buffer, undefined, [buffer]);
                break;
            }
            case "patchSince": {
                if (!session) throw new Error("engine worker: patchSince before open");
                // Pure read: the delta the peer (by its version vector) is
                // missing. No engine work, no repaint.
                const buffer = session.patchSince(new Uint8Array(msg.peer)).slice().buffer;
                reply(id, buffer, undefined, [buffer]);
                break;
            }
            case "merge": {
                if (!session) throw new Error("engine worker: merge before open");
                session.mergePatch(new Uint8Array(msg.data));
                const layout = layoutOf(session);
                // Remote edits may have moved or deleted selected objects.
                emitSelection(false);
                // Merged remote edits land on the local undo history.
                emitHistory();
                scheduleFrame();
                startComposeAhead(session);
                reply(id, layout);
                break;
            }
            case "opaquePartsSince": {
                if (!session) throw new Error("engine worker: opaquePartsSince before open");
                // Pure read: the content the peer (by its version vector) lacks.
                const buffer = session.opaquePartsSince(new Uint8Array(msg.peer)).slice().buffer;
                reply(id, buffer, undefined, [buffer]);
                break;
            }
            case "mergeOpaqueParts": {
                if (!session) throw new Error("engine worker: mergeOpaqueParts before open");
                // Content, not an edit: no history entry. A picture whose image
                // just arrived repaints.
                session.mergeOpaqueParts(new Uint8Array(msg.data));
                const layout = layoutOf(session);
                scheduleFrame();
                reply(id, layout);
                break;
            }
            case "close": {
                session?.close();
                stopBackground();
                emitSelection(false);
                emitPeers();
                emitPeerPointers();
                emitHistory();
                scheduleFrame();
                break;
            }
        }
    } catch (err) {
        if (id !== undefined) reply(id, undefined, err);
    }
}

/**
 * Read the session's current layout — page count, first uncomposed page and
 * content extent — into a plain {@link DocumentLayout}. All are synchronous
 * reads of live session state, so calling this right after a mutation (open /
 * edit / merge / updateLayout) reflects that mutation. The extent rides
 * `viewState` (indices 3–4 = `scroll_extent`), so this is its one home;
 * `pageCount` and `firstUncomposedPage` are their own pulls. `complete`
 * belongs to a compose *pass*, so only the `updateLayout` reply adds it.
 */
function layoutOf(s: WasmSession): DocumentLayout {
    const st = s.viewState();
    const pageCount = s.pageCount();
    return {
        ...(pageCount !== undefined && { pageCount }),
        firstUncomposedPage: s.firstUncomposedPage(),
        scrollSize: { width: st[3] ?? 0, height: st[4] ?? 0 },
    };
}

/**
 * The layout the document `s` just opened has, carrying what the host reads
 * off an open, after setting the document up as a fresh one starts. A document
 * that needs a password opens twice this way: empty at the open, and whole
 * once `authenticate` unlocks it.
 */
function openedLayout(s: WasmSession): DocumentLayout {
    const layout = layoutOf(s);
    // The doc type drives the host's default fit, and the source format is
    // what saving back means; read both off the freshly-opened session and
    // ride them back on the open reply. The theme palette is pulled separately
    // (per current slide) via the `themePalette` request, on open and on slide
    // change.
    const docType = s.docType();
    if (docType !== undefined) layout.docType = docType;
    const sourceFormat = s.sourceFormat();
    if (sourceFormat !== undefined) layout.sourceFormat = sourceFormat;
    if (s.needsPassword()) layout.needsPassword = true;
    // Empty-placeholder prompts are a setting a product's worker pushes
    // (sticky in the session across opens), not opened here — a document
    // opened with none set shows none.
    // Apply that default fit here, *before* the first frame: a fresh session
    // has no fit, so waiting for the host to round-trip its setFit would paint
    // the opening frames at 100% — the open flash. The host's follow-up (same
    // fit, or its own choice) dedupes in Rust.
    // The doc type's dpi too, unless the host set one: a spreadsheet's 100% is
    // Excel's, so its first frame must already be at that size.
    s.setDpi(dpi ?? defaultDpiForDocType(layout.docType));
    // Its scroll mode too, unless the host set one: a deck's first frame
    // already shows one slide.
    s.setScrollMode(defaultScrollMode ?? defaultScrollModeForDocType(layout.docType));
    const fit = defaultFit ?? defaultFitForDocType(layout.docType);
    s.setFit(fit);
    // Without a fit the zoom is the host's explicit one, applied here for the
    // same reason; anchored at the top-left, which the opening scroll shows.
    if (fit.mode === "none") s.zoomAtPoint(defaultZoom, 0, 0);
    // A fresh document starts unselected; clear any stale overlay.
    emitSelection(false);
    emitPeers();
    emitPeerPointers();
    // Fresh history (no undo/redo yet) → reset the host's controls.
    emitHistory();
    // Deliberately *no* `scheduleFrame` here: the opening padding is
    // doc-type-specific (the edit page-controls frame vs. read padding), and
    // the host only knows the doc type from this reply. Painting now would
    // flash the read padding before the host's post-open `setSpacing` lands.
    // The host drives the first paint from `applyModeChrome` once it has the
    // doc type (every `setSpacing` schedules a frame), so the opening frame is
    // already at the final spacing.
    return layout;
}

/**
 * Fetch `url` whole, synchronously — how the engine reaches a part of a remote
 * document the moment it needs one (see `openRemote`). A synchronous request is
 * allowed in a worker, which this is, so it blocks the engine's thread and never
 * the page's. Throws when the request fails, and the engine reports that part's
 * load as failed.
 */
function fetchSync(url: string): Uint8Array {
    const request = new XMLHttpRequest();
    request.open("GET", url, false);
    request.responseType = "arraybuffer";
    request.send();
    if (request.status < 200 || request.status >= 300) throw new Error(`HTTP ${request.status}`);
    return new Uint8Array(request.response as ArrayBuffer);
}

/**
 * Run a typed read `fn`, falling back to `fallback` when there is no open
 * document (`fn` returns `undefined`) or the read fails (a non-portable doc, an
 * out-of-range / not-yet-composed page — the wasm throws). Lenient by design — a
 * perception read degrades to "nothing here" rather than rejecting, mirroring
 * the old enumerate. The boundary is typed, so there is no `JSON.parse` here.
 */
function safeRead<T>(fn: () => T | undefined, fallback: T): T {
    try {
        const value = fn();
        return value === undefined ? fallback : value;
    } catch {
        return fallback;
    }
}

/** The geometry of an empty selection — what a geometry read answers with no
 *  document open. */
const EMPTY_SELECTION_GEOMETRY: SelectionGeometry = {
    objects: [],
    annotations: [],
    cells: [],
    text: [],
    caret: null,
    headers: null,
};

/** The annotations the selection holds and their page, or `null` when it holds
 *  none — or their page's annotations aren't loaded, which a selection on a
 *  page that composed never meets. */
function selectedAnnotations(s: WasmSession): SelectedAnnotations | null {
    const selected = Selection.annotations(s.selection());
    if (!selected) return null;
    const part = safeRead(() => s.portable.model.page(selected.page).annotations.dump(), undefined);
    if (!part) return null;
    const index = s.portable.model.root.pageIndexById(selected.page);
    if (index === undefined) return null;
    const ids = new Set(selected.ids);
    const annotations = part.annotations.flatMap((id) => {
        if (!ids.has(id)) return [];
        const annotation = safeRead(() => s.portable.model.page(selected.page).annotation(id).dump(), undefined);
        return annotation ? [annotation] : [];
    });
    return {
        page: selected.page,
        index,
        annotations,
        richContents: annotations.map((a) =>
            safeRead(
                () =>
                    a.id === undefined
                        ? undefined
                        : s.portable.model.page(selected.page).annotation(a.id).richContents(),
                "",
            ),
        ),
    };
}

/** The form of a document that has none — what a form read answers with no
 *  PDF open. */
const EMPTY_ACRO_FORM: AcroForm = {
    fields: [],
    needAppearances: false,
    signatureFlags: { signaturesExist: false, appendOnly: false },
    calculationOrder: [],
    defaultAppearance: null,
    justification: null,
};

/** The field the widget annotation `widget` on page `page` belongs to, as the
 *  form holds it, with the widget's page index, its rect and its on state —
 *  or `null` when no field lists it, or the page's annotations don't. */
/** The media file `media` names, its bytes copied out of wasm memory into a
 *  standalone buffer the reply transfers — `null` when it doesn't load. */
function mediaData(s: WasmSession, media: string): MediaFile | null {
    const bytes = safeRead(() => s.presentation.model.mediaData(media).bytes(), undefined);
    const contentType = safeRead(() => s.presentation.model.mediaData(media).contentType(), undefined);
    if (bytes === undefined || contentType === undefined) return null;
    return { bytes: bytes.slice().buffer, contentType };
}

function formWidget(s: WasmSession, page: string, widget: string): FormWidget | null {
    const form = safeRead(() => s.portable.model.acroForm.dump(), EMPTY_ACRO_FORM);
    const field = form.fields.find((field) => Object.values(field)[0]!.shared.widgets.includes(widget));
    const index = safeRead(() => s.portable.model.root.pageIndexById(page), undefined);
    const annotation = safeRead(() => s.portable.model.page(page).annotation(widget).dump(), undefined);
    if (!field || index === undefined || !annotation) return null;
    const normal = annotation.appearance?.normal;
    const on =
        normal && "states" in normal ? (normal.states.find((state) => state.name !== "Off")?.name ?? null) : null;
    return { field, index, rect: annotation.rect, on };
}

/** The annotations of each page in `pages`, with their rich contents — each
 *  page's annotations part loaded through the page list, and each annotation it
 *  lists, whether or not the page has composed — skipping a page that has none.
 *  Their appearances are dropped: a comment shows its text, not its artwork. */
function pageComments(s: WasmSession, pages: string[]): PageComments[] {
    const comments: PageComments[] = [];
    for (const page of pages) {
        const index = s.portable.model.root.pageIndexById(page);
        const part = safeRead(() => s.portable.model.page(page).annotations.dump(), undefined);
        if (index === undefined || !part) continue;
        const annotations = part.annotations.flatMap((id) => {
            const annotation = safeRead(() => s.portable.model.page(page).annotation(id).dump(), undefined);
            return annotation ? [annotation] : [];
        });
        comments.push({
            page,
            index,
            annotations: annotations.map((a) => ({ ...a, appearance: null })),
            richContents: annotations.map((a) =>
                safeRead(
                    () =>
                        a.id === undefined ? undefined : s.portable.model.page(page).annotation(a.id).richContents(),
                    "",
                ),
            ),
        });
    }
    return comments;
}

function pageAnnotations(s: WasmSession, pages: string[]): PageAnnotations[] {
    const read: PageAnnotations[] = [];
    for (const page of pages) {
        const index = s.portable.model.root.pageIndexById(page);
        const part = safeRead(() => s.portable.model.page(page).annotations.dump(), undefined);
        if (index === undefined || !part) continue;
        const annotations = part.annotations.flatMap((id) => {
            const annotation = safeRead(() => s.portable.model.page(page).annotation(id).dump(), undefined);
            return annotation ? [annotation] : [];
        });
        read.push({ page, index, annotations: annotations.map((a) => ({ ...a, appearance: null })) });
    }
    return read;
}

/** Run a `UDocCommand` through the wasm `execute` ABI. The boundary is typed
 *  (`execute(command: UDocCommand)`), so the command crosses as an object the
 *  wasm side deserializes — no hand-serialization here. The layout it relaid
 *  out is pulled separately (see {@link layoutOf}). */
function exec(s: WasmSession, command: UDocCommand): void {
    s.execute(command);
}

/** Tag a format-blind {@link SelectionEdit} with the open document's doc-type
 *  variant, producing the `UDocSelectionEdit` the typed `executeOnSelection` boundary
 *  takes — the selection-edit twin of {@link exec}'s command marshalling and of
 *  {@link Selection.objects}'s `{ portable: … }` tag. The open doc type fixes
 *  the variant — it *is* the tag: the shell emits an inner edit valid for that
 *  doc type (a slide `setFill`, a PDF `setNonstrokingStyle`), so the tag the old
 *  `runOnSelection` resolved in Rust is stamped here, at the boundary.
 *
 *  The wire form is externally tagged at every level, so this also turns the
 *  shell's flat `{ kind, …fields }` into it: the kind becomes the key, and a
 *  drawing edit is wrapped in its family — `{ common: { text: { insertText:
 *  { text } } } }` for a slide. An edit still names what to do, never where:
 *  the engine binds it to its own selection, however deep the caret sits — in a
 *  shape's text, a table cell, a text box in a word document. */
function taggedSelectionEdit(edit: SelectionEdit, docType: UDocType | undefined): UDocSelectionEdit {
    switch (docType) {
        case "presentation":
            return { presentation: { common: drawingEdit(edit) } } as UDocSelectionEdit;
        case "wordprocessing":
            return { wordprocessing: { common: drawingEdit(edit) } } as UDocSelectionEdit;
        case "spreadsheet":
            return { spreadsheet: edit } as UDocSelectionEdit;
        case "image":
            return { image: edit } as UDocSelectionEdit;
        default:
            return { portable: portableEdit(edit) } as UDocSelectionEdit;
    }
}

/** The family each drawing kind belongs to, the tag its wire form is wrapped
 *  in. Typed against the gate unions tsify declares, so a kind Rust adds fails
 *  to compile here until it is placed. Table edits need no entry: they travel
 *  as the tsify type already. */
const TEXT_KINDS: Record<TextSelectionEditType, "text"> = {
    insertText: "text",
    pasteText: "text",
    deleteText: "text",
    setCharacterProperties: "text",
    clearCharacterProperties: "text",
    setParagraphProperties: "text",
    clearParagraphProperties: "text",
    indentParagraphs: "text",
};
const SHAPE_KINDS: Record<ShapeSelectionEditType, "shape"> = {
    translateShapes: "shape",
    rotateEachShape: "shape",
    scaleEachShape: "shape",
    deleteShapes: "shape",
    reorderShapes: "shape",
    groupShapes: "shape",
    ungroupShapes: "shape",
    alignShapes: "shape",
    distributeShapes: "shape",
    flipShapes: "shape",
    setShapeFill: "shape",
    setShapeLine: "shape",
    adjustShapeHandle: "shape",
    pasteShapes: "shape",
};
const DRAWING_FAMILY: Record<string, "text" | "shape"> = { ...TEXT_KINDS, ...SHAPE_KINDS };

/** A flat `{ kind, …fields }` edit in its wire form: keyed by its kind —
 *  `{ insertText: { text } }` — or the bare kind when it carries no fields. */
function byKind(edit: { kind: string }): unknown {
    const { kind, ...fields } = edit;
    return Object.keys(fields).length === 0 ? kind : { [kind]: fields };
}

/** A drawing edit wrapped in its family: `{ text: … }`, `{ shape: … }`, or
 *  `{ table: … }` for the table edit the shell sends as the tsify type. */
function drawingEdit(edit: SelectionEdit): unknown {
    if (typeof edit === "string" || !("kind" in edit)) return { table: edit };
    const family = DRAWING_FAMILY[edit.kind];
    if (!family) throw new Error(`engine worker: ${edit.kind} is not a drawing edit`);
    return { [family]: byKind(edit) };
}

/** A PDF's edit, which the shell already sends in its family's wrapper —
 *  `{ kind: "object", edit }` or `{ kind: "annotation", edit }` — and, for a
 *  free text's text, a `{ kind: "common", edit }` inside the annotation one. */
function portableEdit(edit: SelectionEdit): unknown {
    if (typeof edit !== "string" && "kind" in edit && "edit" in edit) {
        switch (edit.kind) {
            case "object":
                return { object: { edit: byKind(edit.edit as { kind: string }) } };
            case "annotation":
                return { annotation: { edit: annotationEdit(edit.edit) } };
        }
    }
    throw new Error("engine worker: a PDF edit travels in its family's wrapper");
}

function annotationEdit(edit: SelectionEdit): unknown {
    if (typeof edit !== "string" && "kind" in edit && edit.kind === "common" && "edit" in edit) {
        return { common: { edit: drawingEdit(edit.edit) } };
    }
    return byKind(edit as { kind: string });
}

/** Dispatch a document-wide history op to the matching Rust session method. */
function applyHistory(s: WasmSession, op: HistoryOp): void {
    switch (op) {
        case "undo":
            s.undo();
            break;
        case "redo":
            s.redo();
            break;
    }
}

/** The CSS px per inch `s`'s document shows at: the host's, else its doc type's default. */
function viewDpiOf(s: WasmSession): number {
    return dpi ?? defaultDpiForDocType(s.docType());
}

/**
 * Adopt the engine's resulting scroll + zoom as our last-known view after an
 * engine-driven camera move (zoomAtPoint / zoomToRect). Without this the
 * setViewport the main thread echoes once `SYNC_VIEW` mirrors the new scroll
 * and zoom would re-run `set_view` and clobber the engine's anchoring. Mirrors
 * the scroll adoption in the `goToPage` handler, plus the zoom these intents
 * also change. `viewState` reports the scale (`zoom × cssPxPerPt(dpi)`);
 * divide back to the faithful zoom `lastZoom` tracks.
 */
function adoptView(s: WasmSession): void {
    const st = s.viewState();
    lastScrollX = st[1] ?? lastScrollX;
    lastScrollY = st[2] ?? lastScrollY;
    if (st[0] !== undefined) lastZoom = st[0] / cssPxPerPt(viewDpiOf(s));
}

/**
 * Route a full viewport into Rust's `resize` (size/dpr) and `set_view`
 * (scroll/zoom), its scroll carried over the view's moves since `shift`, the
 * {@link anchorShift} it was read against.
 */
function applyViewport(s: WasmSession, v: Viewport, shift: number): void {
    if (v.width !== lastW || v.height !== lastH || v.dpr !== lastDpr) {
        s.resize(v.width, v.height, v.dpr);
        lastW = v.width;
        lastH = v.height;
        lastDpr = v.dpr;
        // Hold the CSS-px size for the ack the next frame posts (latest wins).
        resizeAck = { width: v.width, height: v.height };
    }
    const scrollY = v.scrollY + anchorShift - shift;
    if (v.scrollX !== lastScrollX || scrollY !== lastScrollY || v.zoom !== lastZoom) {
        s.setView(v.scrollX, scrollY, v.zoom);
        lastScrollX = v.scrollX;
        lastScrollY = scrollY;
        lastZoom = v.zoom;
    }
}

/**
 * Add the scroll the engine moved by itself since it read `before` to
 * {@link anchorShift}, and adopt the view it moved to ({@link adoptView}).
 */
function followView(s: WasmSession, before: number | undefined): void {
    const after = s.viewState()[2];
    if (after === undefined || before === undefined || after === before) return;
    anchorShift += after - before;
    adoptView(s);
}

function reply(id: number | undefined, result: unknown, error?: unknown, transfer?: Transferable[]): void {
    if (id === undefined) return;
    if (error !== undefined) {
        // An `Error` loses its class crossing to the main thread, so the
        // `UDocError` crosses as its fields, for the client to rebuild.
        const { code, message, detail } = UDocError.from(error);
        scope.postMessage({ _id: id, ok: false, error: { code, message, ...(detail && { detail }) } });
    } else {
        scope.postMessage({ _id: id, ok: true, result }, transfer ?? []);
    }
}
