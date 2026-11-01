// A deck's presenter view, as PowerPoint's: what the presenter sees while a
// slide show plays on the audience's screen, over the whole UI — the slide as
// they see it, the slide after it, the slide's notes, a timer and the time,
// and the buttons that step the show and end it.
//
// The slide is the show's own: the worker copies the slide of each frame it
// draws onto a canvas of the view's. The next slide is a picture of it, as a
// thumbnail is. The notes are a viewer of the deck's notes text, as the notes
// pane shows them, their text made larger or smaller here; the view keeps its
// viewer from one show to the next, as a viewer added stays, and hands it a
// canvas of its own each time.
//
// It opens in the UI's window, or in a window of its own on the presenter's
// screen, its elements moved there: what it measures, observes and fills the
// screen with is that window's.

import { cssPxPerPt } from "../../geometry.js";
import type { ContentPadding, PageGap, PageViewsFrame, RgbColor, Size } from "../../geometry.js";
import type { ViewerClient } from "../../worker/ViewerClient.js";
import type { WorkerClient } from "../../worker/WorkerClient.js";
import type { I18n } from "../i18n/index.js";
import {
    ICON_CHEVRON_LEFT,
    ICON_CHEVRON_RIGHT,
    ICON_FULLSCREEN,
    ICON_FULLSCREEN_EXIT,
    ICON_SWAP_SCREENS,
    ICON_TEXT_LARGER,
    ICON_TEXT_SMALLER,
    ICON_TIMER_PAUSE,
    ICON_TIMER_RESTART,
    ICON_TIMER_RESUME,
} from "../icons.js";
import { createButton, nameButton } from "./controls.js";

/** The sizes the notes' text shows at, as zooms of its own size, and the one
 *  each show opens them at: larger than the notes pane's, to be read at a
 *  glance. */
const NOTES_ZOOMS = [1, 1.25, 1.5, 2, 2.5, 3] as const;
const NOTES_ZOOM_OPEN = 2;

/** No room around the notes text: the body's own insets keep it off the edges. */
const NOTES_PADDING: ContentPadding = { top: { px: 0 }, right: { px: 0 }, bottom: { px: 0 }, left: { px: 0 } };
const NOTES_GAP: PageGap = { horizontal: 0, vertical: 0 };

/** CSS px of a wheel tick that counts lines rather than pixels. */
const WHEEL_LINE_PX = 16;
/** How often the timer and the clock are read, ms. */
const TICK_MS = 250;

/** The deck a presenter view shows. */
export interface PresenterDeck {
    /** How many slides it has. */
    slideCount: number;
    /** The slides the show steps through, by their indices, in order. */
    shown: readonly number[];
    /** Its slides' size, points. */
    slideSize: Size;
    /** The plane of its slides, which the next slide's picture is rendered
     *  from, and of its notes text — `-1` for none. */
    slidesPlane: number;
    notesPlane: number;
    /** The screen's CSS px per inch, which 100% is measured against. */
    dpi: number;
}

/** What the presenter view's buttons do to the show. Its keys are the
 *  show's, which the stage it stands on takes. */
export interface PresenterActions {
    next(): void;
    previous(): void;
    end(): void;
    /** Swap the screens the show and the presenter view show on. */
    swap(): void;
}

/** Where the show is, as the presenter view shows it. */
export interface PresenterPosition {
    /** The slide it shows, by its index in the deck. */
    slide: number;
    /** Whether it has gone past its last slide. */
    ended: boolean;
}

export function createPresenterView(i18n: I18n, client: WorkerClient) {
    const el = document.createElement("div");
    el.className = "udoc-ui__presenter";
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", i18n.t("presenter.label"));
    el.tabIndex = -1;

    // The timer, and the time.
    const bar = document.createElement("div");
    bar.className = "udoc-ui__presenter-bar";
    const timer = document.createElement("span");
    timer.className = "udoc-ui__presenter-timer";
    timer.setAttribute("role", "timer");
    const pause = createButton({ icon: ICON_TIMER_PAUSE, label: i18n.t("presenter.pauseTimer") });
    const restart = createButton({ icon: ICON_TIMER_RESTART, label: i18n.t("presenter.restartTimer") });
    const clock = document.createElement("span");
    clock.className = "udoc-ui__presenter-clock";
    const swap = createButton({ icon: ICON_SWAP_SCREENS, label: i18n.t("presenter.swap") });
    const fullscreen = createButton({ icon: ICON_FULLSCREEN, label: i18n.t("toolbar.fullscreen") });
    bar.append(timer, pause, restart, spacer(), clock, swap, fullscreen);

    // The slide as the audience sees it, and the buttons that step it.
    const stage = document.createElement("div");
    stage.className = "udoc-ui__presenter-stage";
    const slideBox = document.createElement("div");
    slideBox.className = "udoc-ui__presenter-slide";
    const slideEnd = document.createElement("div");
    slideEnd.className = "udoc-ui__presenter-end";
    slideEnd.textContent = i18n.t("slideShow.end");
    slideEnd.hidden = true;
    slideBox.append(slideEnd);
    const nav = document.createElement("div");
    nav.className = "udoc-ui__presenter-nav";
    const previous = createButton({ icon: ICON_CHEVRON_LEFT, label: i18n.t("presenter.previous") });
    const counter = document.createElement("span");
    counter.className = "udoc-ui__presenter-counter";
    const next = createButton({ icon: ICON_CHEVRON_RIGHT, label: i18n.t("presenter.next") });
    const end = createButton({ text: i18n.t("presenter.endShow"), label: i18n.t("presenter.endShow") });
    nav.append(previous, counter, next, spacer(), end);
    stage.append(slideBox, nav);

    // The slide after it, and the notes.
    const side = document.createElement("div");
    side.className = "udoc-ui__presenter-side";
    const nextHeading = document.createElement("div");
    nextHeading.className = "udoc-ui__presenter-heading";
    nextHeading.textContent = i18n.t("presenter.nextSlide");
    const nextBox = document.createElement("div");
    nextBox.className = "udoc-ui__presenter-next";
    const nextCanvas = document.createElement("canvas");
    nextCanvas.className = "udoc-ui__presenter-next-canvas";
    nextCanvas.setAttribute("aria-hidden", "true");
    const nextEnd = document.createElement("div");
    nextEnd.className = "udoc-ui__presenter-end";
    nextEnd.textContent = i18n.t("presenter.endOfShow");
    nextBox.append(nextCanvas, nextEnd);
    const notesBar = document.createElement("div");
    notesBar.className = "udoc-ui__presenter-heading";
    const notesHeading = document.createElement("span");
    notesHeading.textContent = i18n.t("command.notes");
    const smaller = createButton({ icon: ICON_TEXT_SMALLER, label: i18n.t("presenter.smallerText") });
    const larger = createButton({ icon: ICON_TEXT_LARGER, label: i18n.t("presenter.largerText") });
    notesBar.append(notesHeading, spacer(), smaller, larger);
    const notesHost = document.createElement("div");
    notesHost.className = "udoc-ui__presenter-notes";
    side.append(nextHeading, nextBox, notesBar, notesHost);

    const main = document.createElement("div");
    main.className = "udoc-ui__presenter-main";
    main.append(stage, side);
    el.append(bar, main);

    // The notes' viewer, added the first time a deck with notes shows here,
    // the canvas it paints into while the view shows, and the ground it draws
    // them on.
    let viewer: ViewerClient | null = null;
    let notesCanvas: HTMLCanvasElement | null = null;
    let backdrop: RgbColor | null = null;

    // The show shown, while one plays.
    let deck: PresenterDeck | null = null;
    let actions: PresenterActions | null = null;
    let position: PresenterPosition | null = null;
    let mirror: HTMLCanvasElement | null = null;
    const cleanups: Array<() => void> = [];
    // What is bound to the window the view shows in, let go as it moves.
    const windowCleanups: Array<() => void> = [];

    // The notes' view: the box they show in (CSS px), their zoom, their scroll
    // down the page (document points) and the latest frame.
    let notesWidth = 0;
    let notesHeight = 0;
    let notesZoom = NOTES_ZOOM_OPEN;
    let notesScroll = 0;
    let notesFrame: PageViewsFrame | null = null;

    // The timer: when it started, on `performance.now()`, and what it read
    // when paused, while it is.
    let timerStart = 0;
    let timerPaused: number | null = null;
    let tick: ReturnType<typeof setInterval> | null = null;
    const clockFormat = new Intl.DateTimeFormat(i18n.locale, { hour: "numeric", minute: "2-digit" });

    // The next slide's picture: which slide, at what scale, the latest asked.
    let nextShown: { slide: number; scale: number } | null = null;
    let nextGeneration = 0;

    /** The window the view shows in. */
    const view = (): Window => el.ownerDocument.defaultView ?? window;

    /**
     * Show the presenter view on `host` — a stage in the UI's window, or in
     * one of its own, as large as its screen — for a show of `deck`, whose
     * buttons do `todo`. Returns the canvas the worker copies the show's slide
     * onto, and its size in device pixels, for the show to transfer.
     */
    function open(
        host: HTMLElement,
        shown: PresenterDeck,
        todo: PresenterActions,
    ): { canvas: HTMLCanvasElement; width: number; height: number } {
        close();
        deck = shown;
        actions = todo;
        host.appendChild(el);
        el.focus({ preventScroll: true });

        const canvas = document.createElement("canvas");
        canvas.className = "udoc-ui__presenter-slide-canvas";
        canvas.setAttribute("aria-hidden", "true");
        slideBox.prepend(canvas);
        mirror = canvas;
        const size = fitMirror();
        if (shown.notesPlane >= 0) {
            notesCanvas = document.createElement("canvas");
            notesCanvas.className = "udoc-ui__presenter-notes-canvas";
            notesHost.append(notesCanvas);
            attachNotes(notesCanvas);
        }

        notesZoom = NOTES_ZOOM_OPEN;
        smaller.disabled = larger.disabled = false;
        listen();
        listenWindow();
        showNotes();
        timerPaused = null;
        restartTimer();
        renderTimer();
        tick = setInterval(renderTimer, TICK_MS);
        return { canvas, ...size };
    }

    /** Show the show at `at`: the slide, its number, the next slide and the
     *  slide's notes. */
    function update(at: PresenterPosition): void {
        const was = position;
        position = at;
        if (!deck) return;
        counter.textContent = i18n.t("presenter.slideOf", { slide: at.slide + 1, count: deck.slideCount });
        slideEnd.hidden = !at.ended;
        renderNext();
        if (was?.slide !== at.slide) {
            notesScroll = 0;
            if (viewer && deck.notesPlane >= 0) viewer.goToPage(at.slide);
            sendNotesViewport();
        }
    }

    /** Stand the view on `host` instead — the show's stage, its screens
     *  swapped — in its window. */
    function move(host: HTMLElement): void {
        if (!deck) return;
        for (const off of windowCleanups) off();
        windowCleanups.length = 0;
        host.appendChild(el);
        el.focus({ preventScroll: true });
        listenWindow();
    }

    /** Take the view down, if it shows. */
    function close(): void {
        if (!deck) return;
        for (const off of [...cleanups, ...windowCleanups]) off();
        cleanups.length = windowCleanups.length = 0;
        if (tick !== null) clearInterval(tick);
        tick = null;
        mirror?.remove();
        mirror = null;
        deck = actions = position = nextShown = null;
        nextGeneration++;
        notesFrame = null;
        // Its viewer stops painting.
        notesWidth = notesHeight = 0;
        sendNotesViewport();
        notesCanvas?.remove();
        notesCanvas = null;
        el.remove();
    }

    /** Take in the view's buttons for the show shown. */
    function listen(): void {
        const on = <K extends keyof HTMLElementEventMap>(
            target: HTMLElement,
            type: K,
            handler: (ev: HTMLElementEventMap[K]) => void,
            options?: AddEventListenerOptions,
        ): void => {
            target.addEventListener(type, handler, options);
            cleanups.push(() => target.removeEventListener(type, handler, options));
        };
        on(previous, "click", () => actions?.previous());
        on(next, "click", () => actions?.next());
        on(slideBox, "click", () => actions?.next());
        on(end, "click", () => actions?.end());
        on(pause, "click", () => {
            if (timerPaused === null) timerPaused = performance.now() - timerStart;
            else {
                timerStart = performance.now() - timerPaused;
                timerPaused = null;
            }
            renderTimer();
        });
        on(restart, "click", () => {
            restartTimer();
            renderTimer();
        });
        on(swap, "click", () => actions?.swap());
        // The stage the view stands on fills the screen, or leaves it.
        on(fullscreen, "click", () => {
            const doc = el.ownerDocument;
            if (doc.fullscreenElement) void doc.exitFullscreen().catch(() => {});
            else void el.parentElement?.requestFullscreen().catch(() => {});
        });
        on(smaller, "click", () => zoomNotes(-1));
        on(larger, "click", () => zoomNotes(1));
        on(
            notesHost,
            "wheel",
            (ev) => {
                ev.preventDefault();
                if (!notesFrame) return;
                const px =
                    ev.deltaMode === 1
                        ? ev.deltaY * WHEEL_LINE_PX
                        : ev.deltaMode === 2
                          ? ev.deltaY * notesHeight
                          : ev.deltaY;
                scrollNotes(notesScroll + px / notesFrame.scale);
            },
            { passive: false },
        );
    }

    /** Take in the sizes and the full screen of the window the view shows in,
     *  and lay it out there. */
    function listenWindow(): void {
        const doc = el.ownerDocument;
        const onFullscreenChange = (): void => {
            const full = doc.fullscreenElement !== null;
            fullscreen.innerHTML = full ? ICON_FULLSCREEN_EXIT : ICON_FULLSCREEN;
            nameButton(fullscreen, i18n.t(full ? "toolbar.exitFullscreen" : "toolbar.fullscreen"));
        };
        doc.addEventListener("fullscreenchange", onFullscreenChange);
        windowCleanups.push(() => doc.removeEventListener("fullscreenchange", onFullscreenChange));
        onFullscreenChange();

        // Observed in the view's own window, where it lays out — which also
        // tells of a screen of another scale, a resize there.
        const relayout = (): void => {
            const size = fitMirror();
            client.resizeSlideShowMirror(size.width, size.height);
            renderNext();
            measureNotes();
        };
        const win = view() as Window & typeof globalThis;
        const resizeObserver = new win.ResizeObserver(relayout);
        resizeObserver.observe(slideBox);
        resizeObserver.observe(nextBox);
        resizeObserver.observe(notesHost);
        win.addEventListener("resize", relayout);
        windowCleanups.push(() => {
            resizeObserver.disconnect();
            win.removeEventListener("resize", relayout);
        });
        measureNotes();
    }

    /** Stand the slide's copy in its box, centred, as large as fits, and
     *  return its size in device pixels. */
    function fitMirror(): { width: number; height: number } {
        if (!mirror || !deck) return { width: 1, height: 1 };
        return fitCanvas(mirror, slideBox, deck.slideSize);
    }

    /** Picture the slide the show goes to next — none past the last — at the
     *  size its box shows it. */
    function renderNext(): void {
        if (!deck || !position) return;
        const at = position;
        const slide = at.ended ? undefined : deck.shown.find((index) => index > at.slide);
        nextEnd.hidden = slide !== undefined;
        nextCanvas.hidden = slide === undefined;
        if (slide === undefined) {
            nextShown = null;
            return;
        }
        const { width } = fitCanvas(nextCanvas, nextBox, deck.slideSize);
        const scale = width / deck.slideSize.width;
        if (nextShown?.slide === slide && nextShown.scale === scale) return;
        nextShown = { slide, scale };
        const generation = ++nextGeneration;
        void client
            .renderPagePreview(deck.slidesPlane, slide, scale)
            .then((picture) => {
                if (generation === nextGeneration) {
                    const context = nextCanvas.getContext("2d");
                    Object.assign(nextCanvas, { width: picture.width, height: picture.height });
                    context?.drawImage(picture, 0, 0);
                }
                picture.close();
            })
            .catch(() => {
                // The document closed, or the slide went: no picture.
            });
    }

    /** Paint the notes into `canvas` — the viewer added the first time,
     *  handed the canvas after. */
    function attachNotes(canvas: HTMLCanvasElement): void {
        if (viewer) {
            viewer.attach(canvas);
            return;
        }
        const added = client.addViewer(canvas);
        added.setPageBorder(null);
        added.setSpacing(NOTES_PADDING, NOTES_GAP);
        // One slide's notes at a time, scrolled within.
        added.setScrollMode("spread");
        added.setScrollbarSize(0);
        if (backdrop) added.setBackdrop(backdrop);
        added.onPageViews((frame) => {
            notesFrame = frame;
            if (frame.fresh) notesScroll = frame.scroll.y;
        });
        // The canvas's CSS box, once the worker has painted it at its new
        // size, on the device-pixel grid, as the notes pane's.
        added.onResized(({ width, height }) => {
            if (!notesCanvas) return;
            const dpr = view().devicePixelRatio || 1;
            notesCanvas.style.width = `${Math.max(1, Math.round(width * dpr)) / dpr}px`;
            notesCanvas.style.height = `${Math.max(1, Math.round(height * dpr)) / dpr}px`;
        });
        viewer = added;
    }

    /** Show the current slide's notes, from their top. */
    function showNotes(): void {
        const notes = viewer;
        if (!deck || deck.notesPlane < 0 || !notes) return;
        notesScroll = 0;
        notesFrame = null;
        void notes.goToPlane(deck.notesPlane);
        notes.goToPage(position?.slide ?? deck.shown[0] ?? 0);
        sendNotesWidth();
        sendNotesViewport();
    }

    /** Measure the notes' box, and lay them out to it. */
    function measureNotes(): void {
        const rect = notesHost.getBoundingClientRect();
        notesWidth = rect.width;
        notesHeight = rect.height;
        sendNotesWidth();
        sendNotesViewport();
    }

    /** CSS px per document point at the notes' zoom. */
    function notesScale(): number {
        return NOTES_ZOOMS[notesZoom]! * cssPxPerPt(deck?.dpi ?? 96);
    }

    /** Lay the notes out as wide as their box. */
    function sendNotesWidth(): void {
        if (!viewer || notesWidth <= 0) return;
        viewer.setPageWidth(notesWidth / notesScale());
    }

    /** Send the notes' view to their viewer — no area while the view is down,
     *  which stops it painting. */
    function sendNotesViewport(): void {
        viewer?.setViewport({
            scrollX: 0,
            scrollY: notesScroll,
            zoom: NOTES_ZOOMS[notesZoom]!,
            dpr: view().devicePixelRatio || 1,
            width: deck ? notesWidth : 0,
            height: deck ? notesHeight : 0,
        });
    }

    /** Make the notes' text larger (`by` 1) or smaller (−1), a size at a time. */
    function zoomNotes(by: 1 | -1): void {
        const zoom = Math.min(NOTES_ZOOMS.length - 1, Math.max(0, notesZoom + by));
        if (zoom === notesZoom) return;
        notesZoom = zoom;
        smaller.disabled = zoom === 0;
        larger.disabled = zoom === NOTES_ZOOMS.length - 1;
        notesScroll = 0;
        sendNotesWidth();
        sendNotesViewport();
    }

    /** Scroll the notes to `y`, document points, within their page. */
    function scrollNotes(y: number): void {
        const frame = notesFrame;
        if (!frame) return;
        const next = Math.min(Math.max(0, y), Math.max(0, frame.scrollSize.height - notesHeight / frame.scale));
        if (next === notesScroll) return;
        notesScroll = next;
        sendNotesViewport();
    }

    function restartTimer(): void {
        timerStart = performance.now();
        if (timerPaused !== null) timerPaused = 0;
    }

    /** Show the timer, its pause button and the time. */
    function renderTimer(): void {
        const seconds = Math.floor((timerPaused ?? performance.now() - timerStart) / 1000);
        const [h, m, s] = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60];
        timer.textContent = `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
        const paused = timerPaused !== null;
        pause.innerHTML = paused ? ICON_TIMER_RESUME : ICON_TIMER_PAUSE;
        nameButton(pause, i18n.t(paused ? "presenter.resumeTimer" : "presenter.pauseTimer"));
        clock.textContent = clockFormat.format(new Date());
    }

    /**
     * Lay the notes on `color`, the canvas's ground, as the notes pane does:
     * on a `dark` one the notes show inverted (the styles' dark theme), and
     * the engine paints the ground inverted, to show as `color`.
     */
    function setBackdrop(color: RgbColor, dark: boolean): void {
        backdrop = dark ? { r: 255 - color.r, g: 255 - color.g, b: 255 - color.b } : color;
        viewer?.setBackdrop(backdrop);
    }

    function destroy(): void {
        close();
    }

    return { el, open, update, move, close, setBackdrop, destroy };
}

export type PresenterView = ReturnType<typeof createPresenterView>;

/** A space that pushes what follows it to the end of its row. */
function spacer(): HTMLElement {
    const el = document.createElement("span");
    el.className = "udoc-ui__presenter-spacer";
    return el;
}

/**
 * Stand `canvas` in `box`, centred, as large as fits with `slide`'s
 * proportions, on the device-pixel grid, and return its size in device
 * pixels.
 */
function fitCanvas(canvas: HTMLCanvasElement, box: HTMLElement, slide: Size): { width: number; height: number } {
    const rect = box.getBoundingClientRect();
    const dpr = canvas.ownerDocument.defaultView?.devicePixelRatio || 1;
    const scale = Math.min(rect.width / slide.width, rect.height / slide.height);
    const width = Math.max(1, Math.round(slide.width * scale * dpr));
    const height = Math.max(1, Math.round(slide.height * scale * dpr));
    canvas.style.width = `${width / dpr}px`;
    canvas.style.height = `${height / dpr}px`;
    return { width, height };
}
