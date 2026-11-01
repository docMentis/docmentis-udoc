// A deck's slide show: the deck played a slide at a time, filling the screen,
// as PowerPoint's Slide Show plays it — each slide's transition on the way in,
// its animations a click at a time — on a canvas of the show's own, which the
// worker draws on as the engine composites each frame.
//
// It fills the screen when the browser lets it, else the whole UI. It takes
// PowerPoint's keys: a click, Space, →, ↓, Enter, Page Down or N steps on; ←,
// ↑, Backspace, Page Up or P steps back; Home and End go to the first and last
// slide it shows, a slide's number then Enter to that slide; Escape ends it,
// as leaving the full screen does. A swipe steps on or back. Past its last
// slide it shows black, and a step on from there ends it. The view then shows
// the slide the show was on, as PowerPoint's does.

import { subscribeSelector } from "../../framework/index.js";
import type { Store } from "../../framework/index.js";
import type { WorkerClient } from "../../worker/WorkerClient.js";
import type { Action } from "../actions.js";
import type { UIState } from "../state.js";
import type { I18n } from "../i18n/index.js";

/** How long the pointer rests before it hides, ms. */
const POINTER_REST_MS = 2000;
/** How far a touch travels across, CSS px, for a swipe rather than a tap. */
const SWIPE_PX = 50;
/** Animation frames the screen holds its size for, once full, before the
 *  show draws on it. */
const SETTLE_FRAMES = 3;
/** The longest the show waits for the screen to fill and hold its size, ms. */
const SETTLE_MS = 1500;
/** How far short of the screen's available area, CSS px, a full screen's page
 *  may fall: the camera housing of a notched screen keeps it below. A window's
 *  page falls further short, by its own title and tool bars. */
const SCREEN_SLACK_PX = 48;

const NEXT_KEYS: ReadonlySet<string> = new Set([" ", "ArrowRight", "ArrowDown", "Enter", "PageDown", "n", "N"]);
const PREVIOUS_KEYS: ReadonlySet<string> = new Set(["ArrowLeft", "ArrowUp", "Backspace", "PageUp", "p", "P"]);

/** The show playing. */
interface Show {
    el: HTMLElement;
    canvas: HTMLCanvasElement;
    /** "End of slide show, click to exit.", over the black past its last slide. */
    end: HTMLElement;
    /** Whether the worker plays it: its start resolved. */
    started: boolean;
    /** The slide it shows, by its index in the deck, as the worker last said. */
    slide: number;
    /** Whether it has gone past its last slide, as the worker last said. */
    ended: boolean;
    /** The digits of a slide number typed so far, for Enter to go to. */
    typed: string;
    /** The document it plays, by the store's `docGeneration`. */
    generation: number;
    /** What had the keyboard before it, to have it back after. */
    focused: Element | null;
    cleanups: Array<() => void>;
}

export function createSlideShow(i18n: I18n, client: WorkerClient) {
    let store: Store<UIState, Action> | null = null;
    let host: HTMLElement | null = null;
    let show: Show | null = null;
    const cleanups: Array<() => void> = [];

    /** End the show playing, through the store, whose `slideShowPlaying`
     *  takes it down. */
    const endShow = (): void => store?.dispatch({ type: "END_SLIDE_SHOW" });

    /**
     * Play the deck from slide `slide` — the first slide it shows when `null`
     * — in place of any show playing. Called in the press that starts it, or
     * just after: the browser fills the screen only in answer to one, for a
     * few seconds after it.
     */
    async function play(slide: number | null): Promise<void> {
        if (!store || !host) return;
        takeDown(false);
        const el = document.createElement("div");
        el.className = "udoc-ui__slide-show";
        el.tabIndex = -1;
        const canvas = document.createElement("canvas");
        canvas.className = "udoc-ui__slide-show-canvas";
        canvas.setAttribute("aria-hidden", "true");
        const end = document.createElement("div");
        end.className = "udoc-ui__slide-show-end";
        end.textContent = i18n.t("slideShow.end");
        end.hidden = true;
        el.append(canvas, end);
        host.appendChild(el);
        const current: Show = {
            el,
            canvas,
            end,
            started: false,
            slide: slide ?? 0,
            ended: false,
            typed: "",
            generation: store.getState().docGeneration,
            focused: document.activeElement,
            cleanups: [],
        };
        show = current;
        el.focus({ preventScroll: true });
        listen(current);

        // The show's black on screen before the screen fills: the browser grows
        // into the full screen from a picture of the page as last painted —
        // macOS stretches it to the screen as it moves into a Space of its
        // own — which would otherwise be the view and its slide.
        await painted();
        if (show !== current) return;

        // The whole screen, when the browser lets it — not in an iframe
        // without `allow="fullscreen"`, nor on an iPhone; else the UI.
        let full = false;
        try {
            await el.requestFullscreen({ navigationUI: "hide" });
            full = true;
        } catch {
            // Fills the UI.
        }
        if (show !== current) {
            if (full && document.fullscreenElement === el) void document.exitFullscreen().catch(() => {});
            return;
        }
        if (full) {
            const onFullscreenChange = (): void => {
                if (document.fullscreenElement !== el) endShow();
            };
            document.addEventListener("fullscreenchange", onFullscreenChange);
            current.cleanups.push(() => document.removeEventListener("fullscreenchange", onFullscreenChange));
            // Drawn once the screen has filled: the browser says it is full
            // before it is — macOS grows the window over its animation and
            // gives the page its new size only at the end — and a frame drawn
            // before would show at the window's size.
            await settled(canvas);
            if (show !== current) return;
        }

        const size = devicePixels(canvas);
        try {
            await client.startSlideShow(canvas, slide, size.width, size.height);
        } catch {
            if (show === current) endShow();
            return;
        }
        if (show !== current) return;
        current.started = true;
        // Its canvas's new size, as the screen turns or the UI resizes.
        let sent = size;
        const resizeObserver = new ResizeObserver(() => {
            const next = devicePixels(canvas);
            if (next.width === sent.width && next.height === sent.height) return;
            sent = next;
            client.slideShowInput({ resize: next });
        });
        resizeObserver.observe(canvas);
        current.cleanups.push(() => resizeObserver.disconnect());
    }

    /** Take in `current`'s keys, clicks and swipes, and hide the pointer
     *  while it rests. */
    function listen(current: Show): void {
        const { el, canvas } = current;
        /** Step on: past the black after the last slide, out of the show. */
        const next = (): void => {
            if (current.ended) endShow();
            else client.slideShowInput("next");
        };
        const onKey = (ev: KeyboardEvent): void => {
            // The show's keys are the show's: none reaches the UI's shortcuts.
            ev.stopPropagation();
            if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
            const { key } = ev;
            if (/^[0-9]$/.test(key)) {
                current.typed += key;
                ev.preventDefault();
                return;
            }
            const typed = current.typed;
            current.typed = "";
            if (key === "Enter" && typed !== "") {
                const slide = Number(typed) - 1;
                if (slide >= 0) client.slideShowInput({ goToSlide: slide });
            } else if (key === "Escape") endShow();
            else if (NEXT_KEYS.has(key)) next();
            else if (PREVIOUS_KEYS.has(key)) client.slideShowInput("previous");
            else if (key === "Home") client.slideShowInput("firstSlide");
            else if (key === "End") client.slideShowInput("lastSlide");
            // Tab would take the keyboard off the show.
            else if (key !== "Tab") return;
            ev.preventDefault();
        };

        // A tap or a click is a click on the slide; a swipe across steps on
        // or back.
        let down: { id: number; x: number; y: number } | null = null;
        const onPointerDown = (ev: PointerEvent): void => {
            el.focus({ preventScroll: true });
            if (ev.button !== 0) return;
            down = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
        };
        const onPointerUp = (ev: PointerEvent): void => {
            if (down?.id !== ev.pointerId) return;
            const dx = ev.clientX - down.x;
            const dy = ev.clientY - down.y;
            down = null;
            if (ev.pointerType !== "mouse" && Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
                if (dx < 0) next();
                else client.slideShowInput("previous");
                return;
            }
            if (current.ended) {
                endShow();
                return;
            }
            const rect = canvas.getBoundingClientRect();
            const dpr = globalThis.devicePixelRatio || 1;
            client.slideShowInput({
                click: { x: (ev.clientX - rect.left) * dpr, y: (ev.clientY - rect.top) * dpr },
            });
        };
        const onPointerCancel = (): void => {
            down = null;
        };
        const onContextMenu = (ev: Event): void => ev.preventDefault();

        let rest: ReturnType<typeof setTimeout> | null = null;
        const onPointerMove = (): void => {
            el.classList.remove("udoc-ui__slide-show--resting");
            if (rest !== null) clearTimeout(rest);
            rest = setTimeout(() => el.classList.add("udoc-ui__slide-show--resting"), POINTER_REST_MS);
        };
        onPointerMove();

        el.addEventListener("keydown", onKey);
        el.addEventListener("pointerdown", onPointerDown);
        el.addEventListener("pointerup", onPointerUp);
        el.addEventListener("pointercancel", onPointerCancel);
        el.addEventListener("pointermove", onPointerMove);
        el.addEventListener("contextmenu", onContextMenu);
        current.cleanups.push(() => {
            if (rest !== null) clearTimeout(rest);
        });
    }

    /**
     * Take the show playing down, if one plays, and, when `land` says so and
     * it played the document still open, show the slide it was on.
     */
    function takeDown(land: boolean): void {
        const current = show;
        if (!current) return;
        show = null;
        for (const off of current.cleanups) off();
        client.endSlideShow();
        if (document.fullscreenElement === current.el) void document.exitFullscreen().catch(() => {});
        current.el.remove();
        if (current.focused instanceof HTMLElement) current.focused.focus({ preventScroll: true });
        const state = store?.getState();
        if (
            land &&
            current.started &&
            state?.status === "ready" &&
            state.docGeneration === current.generation &&
            state.presentationView !== "slideMaster"
        ) {
            store?.dispatch({ type: "NAVIGATE_TO_PAGE", pageIndex: current.slide });
        }
    }

    function mount(root: HTMLElement, s: Store<UIState, Action>): void {
        host = root;
        store = s;
        cleanups.push(
            // Each start bumps `slideShowRequest`: play the deck from its slide.
            subscribeSelector(
                s,
                (st) => st.slideShowRequest.seq,
                () => void play(s.getState().slideShowRequest.slide),
                { phase: "effect" },
            ),
            subscribeSelector(
                s,
                (st) => st.slideShowPlaying,
                (playing) => {
                    if (!playing) takeDown(true);
                },
            ),
            client.onSlideShowStatus(({ slide, ended }) => {
                if (!show?.started) return;
                show.slide = slide;
                show.ended = ended;
                show.end.hidden = !ended;
            }),
            // A show that could draw no further ends. One not yet started
            // hears of the preview it took the place of.
            client.onSlideShowEnded(() => {
                if (show?.started) endShow();
            }),
        );
    }

    function destroy(): void {
        for (const off of cleanups) off();
        cleanups.length = 0;
        takeDown(false);
    }

    return { mount, destroy };
}

export type SlideShow = ReturnType<typeof createSlideShow>;

/** Resolves once what the page shows now has reached the screen: at the
 *  animation frame after the next. */
function painted(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

/** Resolves once the page covers the screen and `canvas` has held its size
 *  for {@link SETTLE_FRAMES} animation frames — or after {@link SETTLE_MS},
 *  however they stand. */
function settled(canvas: HTMLCanvasElement): Promise<void> {
    return new Promise((resolve) => {
        const start = performance.now();
        let last = devicePixels(canvas);
        let held = 0;
        const check = (now: number): void => {
            const size = devicePixels(canvas);
            held = size.width === last.width && size.height === last.height && coversScreen() ? held + 1 : 0;
            last = size;
            if (held >= SETTLE_FRAMES || now - start > SETTLE_MS) resolve();
            else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
    });
}

/** Whether the page covers the screen's available area, as only a full
 *  screen's does, whichever way the screen says it is turned. */
function coversScreen(): boolean {
    const [pageShort, pageLong] = [innerWidth, innerHeight].sort((a, b) => a - b);
    const [areaShort, areaLong] = [screen.availWidth, screen.availHeight].sort((a, b) => a - b);
    return pageShort! >= areaShort! - SCREEN_SLACK_PX && pageLong! >= areaLong! - SCREEN_SLACK_PX;
}

/** `canvas`'s size in device pixels, at least one each way. */
function devicePixels(canvas: HTMLCanvasElement): { width: number; height: number } {
    const rect = canvas.getBoundingClientRect();
    const dpr = globalThis.devicePixelRatio || 1;
    return { width: Math.max(1, Math.round(rect.width * dpr)), height: Math.max(1, Math.round(rect.height * dpr)) };
}
