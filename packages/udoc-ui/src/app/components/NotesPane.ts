import { EMPTY_SELECTION_CAPABILITIES, cssPxPerPt } from "../../geometry.js";
import type {
    ContentPadding,
    PageGap,
    PageViewsFrame,
    PeerSelectionGeometry,
    RgbColor,
    SelectionGeometry,
    SelectionState,
    TextSelectOptions,
} from "../../geometry.js";
import { subscribeSelector } from "../../framework/index.js";
import type { Store } from "../../framework/index.js";
import type { WorkerClient } from "../../worker/WorkerClient.js";
import type { ViewerClient } from "../../worker/ViewerClient.js";
import type { Action } from "../actions.js";
import type { UIState } from "../state.js";
import { VIEW_MODE, viewDpi } from "../state.js";
import type { I18n } from "../i18n/index.js";
import { CLICK_CHAIN_MS, CLICK_CHAIN_RADIUS, granularityFor } from "./Canvas.js";
import { SCROLLBAR_THICKNESS_PX, thumbPlacement } from "./Scrollbar.js";
import { SelectionLayer } from "./SelectionLayer.js";

/** The zoom the notes show at: their text at its own size, as PowerPoint's
 *  notes pane opens. */
const NOTES_ZOOM = 1;

/** No room around the notes text: the body's own insets keep it off the edges. */
const NOTES_PADDING: ContentPadding = { top: { px: 0 }, right: { px: 0 }, bottom: { px: 0 }, left: { px: 0 } };
const NOTES_GAP: PageGap = { horizontal: 0, vertical: 0 };

/** The pane's height, CSS px: open at first and when opened again, a few
 *  lines of notes; closed, an edge the splitter drags it open from; and the
 *  most it opens to, as a share of the viewport it splits with the slides. */
const DEFAULT_HEIGHT = 32;
const MIN_HEIGHT = 4;
const MAX_SHARE = 0.7;
/** How far an arrow key on the splitter moves it, CSS px. */
const RESIZE_STEP = 20;

/** The shortest pane that shows its scrollbar, CSS px: one closed to its edge,
 *  or near it, would show only the end of the thumb. */
const SCROLLBAR_MIN_TRACK_PX = 2 * SCROLLBAR_THICKNESS_PX;

/** CSS px of a wheel tick that counts lines rather than pixels. */
const WHEEL_LINE_PX = 16;
/** How far into view a caret is brought when it leaves the pane, CSS px. */
const CARET_MARGIN_PX = 4;

/** What the shell lends the notes pane. */
export interface NotesPaneHooks {
    /** Give the keyboard to the canvas's hidden text input — where a caret
     *  placed in the notes types, as a caret on a slide does. */
    focusTextInput(): void;
    /** A right-click landed in the pane, at viewport `(clientX, clientY)`: open
     *  the shell's context menu there, on the selection the press settled. */
    onContextMenu(clientX: number, clientY: number): void;
}

/** `geometry` as the pane draws it: the text and its caret, without the box of
 *  the notes body they lie in, which the pane is all of. */
function textOnly(geometry: SelectionGeometry): SelectionGeometry {
    return { ...geometry, objects: [], annotations: [], handles: [] };
}

/** `peers` as the pane draws them — each one's text and caret, as
 *  {@link textOnly}. */
function peersTextOnly(peers: readonly PeerSelectionGeometry[]): PeerSelectionGeometry[] {
    return peers.map((peer) => ({ ...peer, selection: textOnly(peer.selection) }));
}

/**
 * A deck's notes pane, under its slides while they show one at a time: the
 * current slide's speaker notes, as a second viewer of the engine's shows them
 * — the notes text plane, its pages as wide as the pane, one at a time, on the
 * canvas's ground. A press places a caret there, which types through the
 * canvas's hidden text input as a caret on a slide does; in edit mode a press
 * into notes not written yet writes them. A splitter along its top resizes it,
 * down to an edge: the pane closed, which the View tab's Notes opens again.
 */
export function createNotesPane(i18n: I18n, client: WorkerClient, hooks: NotesPaneHooks) {
    const el = document.createElement("div");
    el.className = "udoc-ui__notes";
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", i18n.t("shell.regionNotes"));

    const splitter = document.createElement("div");
    splitter.className = "udoc-ui__notes-splitter";
    splitter.setAttribute("role", "separator");
    splitter.setAttribute("aria-orientation", "horizontal");
    splitter.setAttribute("aria-label", i18n.t("notes.resizeHandle"));
    splitter.tabIndex = 0;

    const host = document.createElement("div");
    host.className = "udoc-ui__notes-host";
    const canvas = document.createElement("canvas");
    canvas.className = "udoc-ui__notes-canvas";
    // The caret and the text highlights, drawn as the canvas's are; no edit
    // chrome — the notes body's box is the pane itself.
    const selectionHost = document.createElement("div");
    selectionHost.className = "udoc-ui__selection";
    const selection = new SelectionLayer(selectionHost);
    selection.setEditable(false);
    // The vertical scrollbar, along the strip the engine keeps clear for it.
    const track = document.createElement("div");
    track.className = "udoc-ui__scrollbar udoc-ui__scrollbar--y";
    const thumb = document.createElement("div");
    thumb.className = "udoc-ui__scrollbar-thumb";
    track.appendChild(thumb);
    host.append(canvas, selectionHost, track);
    el.append(splitter, host);

    const viewer: ViewerClient = client.addViewer(canvas);
    viewer.setPageBorder(null);
    viewer.setSpacing(NOTES_PADDING, NOTES_GAP);
    // One slide's notes at a time, scrolled within.
    viewer.setScrollMode("spread");
    viewer.setScrollbarSize(SCROLLBAR_THICKNESS_PX);

    let store: Store<UIState, Action> | null = null;
    const cleanups: Array<() => void> = [];

    // The pane's size (CSS px) as last measured, and whether it shows.
    let width = 0;
    let height = 0;
    let shown = false;
    // The view: its scroll down the notes page (document points), adopted from
    // the frames it paints, and the latest frame.
    let scrollY = 0;
    let frame: PageViewsFrame | null = null;
    // The page width last sent, so a resize that keeps it sends nothing.
    let pageWidth = Number.NaN;
    // The caret last drawn, so only a caret that moved is brought into view —
    // and whether it is still owed that: a caret typed onto a new line lies
    // below the page the last frame showed, which only the frame that shows
    // the page grown has room to scroll to.
    let caretKey: string | null = null;
    let followingCaret = false;
    // The press under way: where it began, and what it selects by.
    let gesture: { pointerId: number; x: number; y: number; options: TextSelectOptions } | null = null;
    // The presses chained into a double or triple click.
    let clickChain = { x: 0, y: 0, count: 0, time: -Infinity };
    // The text the pane's selection holds — a range keeps itself under a
    // right-click.
    let selectsText = false;

    /** Whether the pane shows in `state`: a deck open, its slides shown one at
     *  a time — scrolled through, no one slide is the current one. */
    function showsIn(state: UIState): boolean {
        return state.status === "ready" && state.docType === "presentation" && state.scrollMode === "spread";
    }

    /** How tall the pane is in `state`, CSS px: as the splitter left it, or
     *  its default, while open; its edge while closed. */
    function heightIn(state: UIState): number {
        return state.notesOpen ? (state.notesHeight ?? DEFAULT_HEIGHT) : MIN_HEIGHT;
    }

    /** CSS px per document point at the pane's zoom. */
    function scale(): number {
        return NOTES_ZOOM * cssPxPerPt(store ? viewDpi(store.getState()) : 96);
    }

    /** Send the pane's view to its viewer — no area while it is hidden, which
     *  stops it painting. */
    function sendViewport(): void {
        viewer.setViewport({
            scrollX: 0,
            scrollY,
            zoom: NOTES_ZOOM,
            dpr: globalThis.devicePixelRatio || 1,
            width: shown ? width : 0,
            height: shown ? height : 0,
        });
    }

    /** Lay the notes out as wide as the pane, less the scrollbar's strip, so a
     *  bar showing never turns a line. */
    function sendPageWidth(): void {
        if (!shown || width <= SCROLLBAR_THICKNESS_PX) return;
        const next = (width - SCROLLBAR_THICKNESS_PX) / scale();
        if (next === pageWidth) return;
        pageWidth = next;
        viewer.setPageWidth(next);
    }

    /** The scroll the notes page allows, document points: its height past the
     *  pane's. */
    function maxScroll(): number {
        if (!frame) return 0;
        return Math.max(0, frame.scrollSize.height - height / frame.scale);
    }

    /** Scroll the pane to `y` (document points) as the reader asks, which
     *  stops following the caret. */
    function scrollAsked(y: number): void {
        followingCaret = false;
        scrollTo(y);
    }

    function scrollTo(y: number): void {
        const next = Math.min(Math.max(0, y), maxScroll());
        if (next === scrollY) return;
        scrollY = next;
        sendViewport();
    }

    /** Commit the canvas's CSS box to the size its backing store was painted
     *  at, on the device-pixel grid — once the worker has painted it there, so
     *  the browser never stretches stale pixels. */
    function commitCanvasSize(cssW: number, cssH: number): void {
        const dpr = globalThis.devicePixelRatio || 1;
        canvas.style.width = `${Math.max(1, Math.round(cssW * dpr)) / dpr}px`;
        canvas.style.height = `${Math.max(1, Math.round(cssH * dpr)) / dpr}px`;
    }

    /** Draw the scrollbar from the latest frame: shown where the engine kept
     *  its strip clear. */
    function renderScrollbar(): void {
        const g = scrollbarGeometry();
        track.style.display = g ? "" : "none";
        if (!g) return;
        thumb.style.height = `${g.thumbPx}px`;
        thumb.style.transform = `translateY(${g.thumbStartPx}px)`;
    }

    /** The scrollbar's thumb, CSS px, or null with no bar showing — none on a
     *  pane too short to hold one. */
    function scrollbarGeometry(): { thumbPx: number; thumbStartPx: number; travelPx: number } | null {
        if (!frame || !frame.scrollbars.y || height < SCROLLBAR_MIN_TRACK_PX) return null;
        const content = frame.scrollSize.height;
        const fraction = content > 0 ? Math.min(1, height / frame.scale / content) : 1;
        return thumbPlacement(height, fraction, scrollY, maxScroll());
    }

    /** Bring the caret into view when it moved out of it — typing past the
     *  pane's last line, or a caret key stepping above its first — as far as
     *  the latest frame's page lets the pane scroll, owing the rest to the
     *  frames after it. */
    function followCaret(): void {
        if (!followingCaret) return;
        const caret = selection.caretViewportRect();
        if (!caret || !frame) {
            followingCaret = false;
            return;
        }
        let target = scrollY;
        if (caret.y < 0) target = scrollY + (caret.y - CARET_MARGIN_PX) / frame.scale;
        else if (caret.y + caret.height > height) {
            target = scrollY + (caret.y + caret.height + CARET_MARGIN_PX - height) / frame.scale;
        }
        followingCaret = target > maxScroll();
        scrollTo(target);
    }

    /** Adopt the selection as the pane's viewer projects it. */
    function adoptSelection(state: SelectionState): void {
        const own = state.viewers.find((entry) => entry.viewer === viewer.index);
        const geometry = textOnly(
            own?.geometry ?? { objects: [], annotations: [], cells: [], text: [], caret: null, headers: null },
        );
        selectsText = geometry.text.length > 0;
        selection.setState({
            local: geometry,
            peers: peersTextOnly(own?.peers ?? []),
            capabilities: EMPTY_SELECTION_CAPABILITIES,
            properties: null,
            slideSections: [],
            viewers: [],
            localChanged: state.localChanged,
        });
        const key = geometry.caret ? JSON.stringify(geometry.caret) : null;
        if (key !== caretKey) {
            caretKey = key;
            followingCaret = true;
            followCaret();
        }
    }

    /** `ev`'s point, local to the pane's canvas (CSS px). */
    function local(ev: MouseEvent): { x: number; y: number } {
        const rect = host.getBoundingClientRect();
        return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    }

    /** Count a press at `(x, y)` into the click chain, and return its place. */
    function chainClick(x: number, y: number): number {
        const now = performance.now();
        const linked =
            now - clickChain.time <= CLICK_CHAIN_MS &&
            Math.hypot(x - clickChain.x, y - clickChain.y) <= CLICK_CHAIN_RADIUS;
        clickChain = { x, y, count: linked ? clickChain.count + 1 : 1, time: now };
        return clickChain.count;
    }

    /** Whether a press is a view-mode one, which reads the notes and writes none. */
    function viewing(): boolean {
        return store?.getState().mode === VIEW_MODE;
    }

    const onPointerDown = (ev: PointerEvent) => {
        if (ev.button !== 0 || ev.target === track || ev.target === thumb) return;
        // Keep the keyboard where it types — the canvas's hidden text input —
        // and the browser's own selection out of the pane.
        ev.preventDefault();
        const { x, y } = local(ev);
        const options: TextSelectOptions = {
            granularity: granularityFor(chainClick(x, y)),
            extend: ev.shiftKey,
            global: viewing(),
        };
        gesture = { pointerId: ev.pointerId, x, y, options };
        host.setPointerCapture(ev.pointerId);
        viewer.selectText({ x, y }, { x, y }, options);
        hooks.focusTextInput();
    };
    const onPointerMove = (ev: PointerEvent) => {
        if (!gesture || gesture.pointerId !== ev.pointerId) return;
        viewer.selectText({ x: gesture.x, y: gesture.y }, local(ev), gesture.options);
    };
    const onPointerUp = (ev: PointerEvent) => {
        if (!gesture || gesture.pointerId !== ev.pointerId) return;
        viewer.selectText({ x: gesture.x, y: gesture.y }, local(ev), gesture.options);
        gesture = null;
        if (host.hasPointerCapture(ev.pointerId)) host.releasePointerCapture(ev.pointerId);
    };
    const onPointerCancel = (ev: PointerEvent) => {
        if (gesture?.pointerId === ev.pointerId) gesture = null;
    };
    // A right-click keeps a range it lands near, as the canvas's does, and
    // otherwise places the caret where it landed; the menu acts on either.
    const onContextMenu = (ev: MouseEvent) => {
        ev.preventDefault();
        if (!selectsText) {
            const at = local(ev);
            viewer.selectText(at, at, { global: viewing() });
        }
        hooks.focusTextInput();
        hooks.onContextMenu(ev.clientX, ev.clientY);
    };
    const onWheel = (ev: WheelEvent) => {
        ev.preventDefault();
        if (!frame) return;
        const px = ev.deltaMode === 1 ? ev.deltaY * WHEEL_LINE_PX : ev.deltaMode === 2 ? ev.deltaY * height : ev.deltaY;
        scrollAsked(scrollY + px / frame.scale);
    };

    const onThumbDown = (ev: PointerEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        const g = scrollbarGeometry();
        if (!g || g.travelPx <= 0) return;
        const startY = ev.clientY;
        const startScroll = scrollY;
        const max = maxScroll();
        thumb.setPointerCapture(ev.pointerId);
        const onMove = (e: PointerEvent) => scrollAsked(startScroll + ((e.clientY - startY) / g.travelPx) * max);
        const onUp = () => {
            thumb.removeEventListener("pointermove", onMove);
            thumb.removeEventListener("pointerup", onUp);
            thumb.removeEventListener("pointercancel", onUp);
        };
        thumb.addEventListener("pointermove", onMove);
        thumb.addEventListener("pointerup", onUp);
        thumb.addEventListener("pointercancel", onUp);
    };
    // A press on the track, off the thumb, pages toward it.
    const onTrackDown = (ev: PointerEvent) => {
        if (ev.target !== track || !frame) return;
        ev.preventDefault();
        const g = scrollbarGeometry();
        if (!g) return;
        const at = ev.clientY - track.getBoundingClientRect().top;
        scrollAsked(scrollY + (height / frame.scale) * 0.9 * (at > g.thumbStartPx + g.thumbPx / 2 ? 1 : -1));
    };

    /** The tallest the pane may be: a share of the viewport it splits. */
    function maxHeight(): number {
        const container = el.parentElement;
        return container ? Math.max(MIN_HEIGHT, container.clientHeight * MAX_SHARE) : Infinity;
    }

    function setHeight(next: number): number {
        const clamped = Math.round(Math.max(MIN_HEIGHT, Math.min(maxHeight(), next)));
        el.style.height = `${clamped}px`;
        splitter.setAttribute("aria-valuenow", String(clamped));
        return clamped;
    }

    /** Keep the height the splitter left: down at its edge the pane closes,
     *  anywhere above it the pane is open at that height. */
    function settleHeight(next: number): void {
        store?.dispatch(
            next <= MIN_HEIGHT ? { type: "SET_NOTES_OPEN", open: false } : { type: "SET_NOTES_HEIGHT", height: next },
        );
    }

    const onSplitterDown = (ev: PointerEvent) => {
        if (ev.button !== 0) return;
        ev.preventDefault();
        const startY = ev.clientY;
        const startHeight = el.offsetHeight;
        let dragged = startHeight;
        el.classList.add("udoc-ui__notes--resizing");
        splitter.setPointerCapture(ev.pointerId);
        const onMove = (e: PointerEvent) => {
            dragged = setHeight(startHeight - (e.clientY - startY));
        };
        const onUp = () => {
            splitter.removeEventListener("pointermove", onMove);
            splitter.removeEventListener("pointerup", onUp);
            splitter.removeEventListener("pointercancel", onUp);
            el.classList.remove("udoc-ui__notes--resizing");
            settleHeight(dragged);
        };
        splitter.addEventListener("pointermove", onMove);
        splitter.addEventListener("pointerup", onUp);
        splitter.addEventListener("pointercancel", onUp);
    };
    const onSplitterKey = (ev: KeyboardEvent) => {
        if (ev.key !== "ArrowUp" && ev.key !== "ArrowDown") return;
        ev.preventDefault();
        settleHeight(setHeight(el.offsetHeight + (ev.key === "ArrowUp" ? RESIZE_STEP : -RESIZE_STEP)));
    };

    function listen<K extends keyof HTMLElementEventMap>(
        target: HTMLElement,
        type: K,
        listener: (ev: HTMLElementEventMap[K]) => void,
        options?: AddEventListenerOptions,
    ): void {
        target.addEventListener(type, listener, options);
        cleanups.push(() => target.removeEventListener(type, listener, options));
    }

    function mount(container: HTMLElement, s: Store<UIState, Action>): void {
        store = s;
        container.appendChild(el);

        listen(host, "pointerdown", onPointerDown);
        listen(host, "pointermove", onPointerMove);
        listen(host, "pointerup", onPointerUp);
        listen(host, "pointercancel", onPointerCancel);
        listen(host, "contextmenu", onContextMenu);
        listen(host, "wheel", onWheel, { passive: false });
        listen(thumb, "pointerdown", onThumbDown);
        listen(track, "pointerdown", onTrackDown);
        listen(splitter, "pointerdown", onSplitterDown);
        listen(splitter, "keydown", onSplitterKey);

        // Shown or hidden, and open or closed to its edge. The viewport the
        // slides keep above it lifts the floating toolbar by its height.
        const applyShown = (state: UIState) => {
            shown = showsIn(state);
            el.style.display = shown ? "" : "none";
            el.style.height = `${heightIn(state)}px`;
            splitter.setAttribute("aria-valuenow", String(heightIn(state)));
        };
        applyShown(s.getState());
        cleanups.push(
            subscribeSelector(
                s,
                (state) => ({ shown: showsIn(state), height: heightIn(state) }),
                () => applyShown(s.getState()),
                { equality: (a, b) => a.shown === b.shown && a.height === b.height },
            ),
        );

        // The pane's size: the viewer's viewport, and the width its notes lay
        // out at. A hidden pane measures nothing, and its viewer stops painting.
        let sized = false;
        const measure = () => {
            const rect = host.getBoundingClientRect();
            width = rect.width;
            height = rect.height;
            if (!sized && width > 0 && height > 0) {
                commitCanvasSize(width, height);
                sized = true;
            }
            container.style.setProperty("--udoc-notes-height", `${shown ? el.offsetHeight : 0}px`);
            sendPageWidth();
            sendViewport();
            renderScrollbar();
        };
        const resizeObserver = new ResizeObserver(measure);
        resizeObserver.observe(host);
        resizeObserver.observe(el);
        cleanups.push(() => resizeObserver.disconnect());
        cleanups.push(() => container.style.removeProperty("--udoc-notes-height"));

        // Each deck opened: show its notes text, at the slide the slides show.
        // Its viewer joined the session with no view, so it is sent one.
        cleanups.push(
            subscribeSelector(
                s,
                (state) => state.planeKinds,
                (kinds) => {
                    const plane = kinds.indexOf("notesText");
                    if (plane < 0) return;
                    scrollY = 0;
                    frame = null;
                    void viewer.goToPlane(plane);
                    viewer.goToPage(s.getState().pageIndex);
                    pageWidth = Number.NaN;
                    sendPageWidth();
                    sendViewport();
                },
            ),
        );
        // The slide shown changed: its notes, from their top.
        cleanups.push(
            subscribeSelector(
                s,
                (state) => state.pageIndex,
                (page) => {
                    if (s.getState().planeKinds.indexOf("notesText") < 0) return;
                    scrollY = 0;
                    viewer.goToPage(page);
                },
            ),
        );
        // The screen's scale changed what a point is in pixels.
        cleanups.push(
            subscribeSelector(
                s,
                (state) => viewDpi(state),
                () => sendPageWidth(),
            ),
        );

        cleanups.push(
            viewer.onPageViews((next) => {
                frame = next;
                if (next.fresh) scrollY = next.scroll.y;
                selection.render({ views: next.views, scale: next.scale });
                renderScrollbar();
                followCaret();
            }),
        );
        cleanups.push(viewer.onResized(({ width: w, height: h }) => commitCanvasSize(w, h)));
        cleanups.push(client.onSelection(adoptSelection));
    }

    /**
     * Lay the notes on `color`, the canvas's ground, as the slides are. On a
     * `dark` one the notes canvas shows inverted (the styles' dark theme), so
     * the deck's dark notes text reads light, as in PowerPoint's dark notes
     * pane — and the engine paints the ground inverted, to show as `color`.
     */
    function setBackdrop(color: RgbColor, dark: boolean): void {
        viewer.setBackdrop(dark ? { r: 255 - color.r, g: 255 - color.g, b: 255 - color.b } : color);
    }

    function destroy(): void {
        for (const off of cleanups) off();
        cleanups.length = 0;
        el.remove();
    }

    return { el, mount, setBackdrop, destroy };
}
