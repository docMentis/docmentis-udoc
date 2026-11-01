// A deck's slide show: the deck played a slide at a time, filling the screen,
// as PowerPoint's Slide Show plays it — each slide's transition on the way in,
// its animations a click at a time — on a canvas of the show's own, which the
// worker draws on as the engine composites each frame.
//
// It fills the screen when the browser lets it, else the whole UI. With Use
// Presenter View, where there is a screen for the audience, it plays in a
// window of its own instead — dragged to that screen, a click fills it — and
// the presenter view shows over the UI here. It takes PowerPoint's keys: a
// click, Space, →, ↓, Enter, Page Down or N steps on; ←, ↑, Backspace, Page Up
// or P steps back; Home and End go to the first and last slide it shows, a
// slide's number then Enter to that slide; Escape ends it, as leaving the full
// screen does here. A swipe steps on or back. Past its last slide it shows
// black, and a step on from there ends it. The view then shows the slide the
// show was on, as PowerPoint's does.

import { subscribeSelector } from "../../framework/index.js";
import type { Store } from "../../framework/index.js";
import type { Size } from "../../geometry.js";
import type { WorkerClient } from "../../worker/WorkerClient.js";
import type { Action } from "../actions.js";
import { planeOfView, viewDpi } from "../state.js";
import type { UIState } from "../state.js";
import type { I18n } from "../i18n/index.js";
import { createPresenterView } from "./PresenterView.js";
import type { PresenterActions, PresenterDeck } from "./PresenterView.js";

/** How long the pointer rests before it hides, ms. */
const POINTER_REST_MS = 2000;
/** How far a touch travels across, CSS px, for a swipe rather than a tap. */
const SWIPE_PX = 50;
/** Animation frames the screen holds its new size for, once full, before
 *  the show draws on it. */
const SETTLE_FRAMES = 3;
/** The longest the show waits for the screen to take and hold a new size, ms:
 *  one already as large as the screen takes none. */
const SETTLE_MS = 1500;

const NEXT_KEYS: ReadonlySet<string> = new Set([" ", "ArrowRight", "ArrowDown", "Enter", "PageDown", "n", "N"]);
const PREVIOUS_KEYS: ReadonlySet<string> = new Set(["ArrowLeft", "ArrowUp", "Backspace", "PageUp", "p", "P"]);

/** The name of the window a show plays in for the audience's screen. */
const SHOW_WINDOW = "udoc-slide-show";
/** The slides' size, points, where the deck's won't read: 16:9. */
const FALLBACK_SLIDE: Size = { width: 960, height: 540 };

/** The show window's own styles: its document has none of the UI's. */
const SHOW_WINDOW_STYLE = `
html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
.show { position: fixed; inset: 0; outline: none; touch-action: none; user-select: none; }
.show.resting { cursor: none; }
canvas { display: block; width: 100%; height: 100%; object-fit: contain; }
.end, .hint { position: absolute; left: 0; right: 0; text-align: center; color: #fff;
    font: 14px system-ui, sans-serif; pointer-events: none; }
.end { top: 12px; }
.hint { bottom: 16px; padding: 0 16px; }
.hint span { display: inline-block; padding: 8px 12px; border-radius: 6px; background: rgba(0, 0, 0, 0.7); }
[hidden] { display: none; }
`;

/** The show playing. */
interface Show {
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

/** The window a show plays in for the audience's screen, and what it shows. */
interface ShowWindow {
    view: Window;
    root: HTMLElement;
    canvas: HTMLCanvasElement;
    end: HTMLElement;
    /** How to put the window on the audience's screen, while it isn't full. */
    hint: HTMLElement;
}

export function createSlideShow(i18n: I18n, client: WorkerClient) {
    let store: Store<UIState, Action> | null = null;
    let host: HTMLElement | null = null;
    let show: Show | null = null;
    const presenter = createPresenterView(i18n, client);
    const cleanups: Array<() => void> = [];

    /** End the show playing, through the store, whose `slideShowPlaying`
     *  takes it down. */
    const endShow = (): void => store?.dispatch({ type: "END_SLIDE_SHOW" });

    /**
     * Play the deck from slide `slide` — the first slide it shows when `null`
     * — in place of any show playing. Called in the press that starts it, or
     * just after: the browser fills the screen, or opens a window, only in
     * answer to one, for a few seconds after it.
     */
    async function play(slide: number | null): Promise<void> {
        if (!store || !host) return;
        takeDown(false);
        // In a window of its own for the audience's screen, with the presenter
        // view here — opened first, in the press. One the browser blocks
        // plays here.
        const presenting = store.getState().usePresenterView && hasOtherScreen();
        const shown = presenting ? openShowWindow(i18n) : null;
        if (shown) await present(slide, shown);
        else await playHere(slide);
    }

    /** A show from `slide`, its end line `end`. */
    function newShow(slide: number | null, end: HTMLElement): Show {
        return {
            end,
            started: false,
            slide: slide ?? 0,
            ended: false,
            typed: "",
            generation: store?.getState().docGeneration ?? 0,
            focused: document.activeElement,
            cleanups: [],
        };
    }

    /** Play the show over the UI, filling the screen when the browser lets it. */
    async function playHere(slide: number | null): Promise<void> {
        if (!host) return;
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
        const current = newShow(slide, end);
        show = current;
        current.cleanups.push(() => {
            if (document.fullscreenElement === el) void document.exitFullscreen().catch(() => {});
            el.remove();
        });
        el.focus({ preventScroll: true });
        listen(current, el, el);
        listenPointer(current, el, canvas, "udoc-ui__slide-show--resting");

        // The show's black on screen before the screen fills: the browser grows
        // into the full screen from a picture of the page as last painted —
        // macOS stretches it to the screen as it moves into a Space of its
        // own — which would otherwise be the view and its slide.
        await painted(window);
        if (show !== current) return;

        // The whole screen, when the browser lets it — not in an iframe
        // without `allow="fullscreen"`, nor on an iPhone; else the UI.
        const before = devicePixels(canvas);
        let full = false;
        try {
            await el.requestFullscreen({ navigationUI: "hide" });
            full = true;
        } catch {
            // Fills the UI.
        }
        if (show !== current) return;
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
            await settled(canvas, before);
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

    /**
     * Play the show in `shown`, the window for the audience's screen, with the
     * presenter view over the UI here. Closing the window ends the show.
     */
    async function present(slide: number | null, shown: ShowWindow): Promise<void> {
        if (!host) return;
        const { view, root, canvas, end, hint } = shown;
        const current = newShow(slide, end);
        show = current;
        // Closing the window ends the show; leaving the page closes the window.
        const onClose = (): void => endShow();
        const onLeave = (): void => view.close();
        view.addEventListener("pagehide", onClose);
        window.addEventListener("pagehide", onLeave);
        current.cleanups.push(() => {
            view.removeEventListener("pagehide", onClose);
            window.removeEventListener("pagehide", onLeave);
            view.close();
        });
        let sent = devicePixels(canvas);
        /** Hand the show its window's new size — resized, filling its
         *  screen, or moved to a screen of another scale. */
        const resize = (): void => {
            const next = devicePixels(canvas);
            if (!current.started || (next.width === sent.width && next.height === sent.height)) return;
            sent = next;
            client.slideShowInput({ resize: next });
        };
        listen(current, view.document, null);
        listenPointer(current, root, canvas, "resting", async () => {
            // A window that doesn't fill its screen fills it at a click, black
            // until the show has drawn at the screen's size, as here.
            if (view.document.fullscreenElement) return false;
            canvas.style.visibility = "hidden";
            try {
                await painted(view);
                const before = devicePixels(canvas);
                await root.requestFullscreen({ navigationUI: "hide" });
                await settled(canvas, before);
                resize();
                await painted(view);
            } catch {
                // The window stays as it is.
            } finally {
                canvas.style.visibility = "";
            }
            return true;
        });
        const onFullscreenChange = (): void => {
            hint.hidden = view.document.fullscreenElement !== null;
        };
        view.document.addEventListener("fullscreenchange", onFullscreenChange);
        current.cleanups.push(() => view.document.removeEventListener("fullscreenchange", onFullscreenChange));

        const deck = await readDeck();
        if (show !== current || !host) return;
        const actions: PresenterActions = {
            next: () => step(current),
            previous: () => client.slideShowInput("previous"),
            end: endShow,
            key: keys(current),
        };
        const copy = presenter.open(host, deck, actions);
        current.cleanups.push(() => presenter.close());
        current.slide = slide ?? deck.shown[0] ?? 0;
        presenter.update({ slide: current.slide, ended: false });

        sent = devicePixels(canvas);
        try {
            await client.startSlideShow(canvas, slide, sent.width, sent.height, { ...copy, slide: deck.slideSize });
        } catch {
            if (show === current) endShow();
            return;
        }
        if (show !== current) return;
        current.started = true;
        resize();
        view.addEventListener("resize", resize);
        current.cleanups.push(() => view.removeEventListener("resize", resize));
    }

    /** What the presenter view shows of the open deck. */
    async function readDeck(): Promise<PresenterDeck> {
        const state = store!.getState();
        const slidesPlane = Math.max(0, planeOfView(state.planeKinds, "normal"));
        const slideCount = await client.presentation.slideCount();
        const indices = Array.from({ length: slideCount }, (_, index) => index);
        const [shows, size] = await Promise.all([
            client.presentation.slidesShow(indices),
            client.pageDisplaySize(slidesPlane, 0),
        ]);
        return {
            slideCount,
            shown: indices.filter((index) => shows[index]),
            slideSize: size.width > 0 && size.height > 0 ? size : FALLBACK_SLIDE,
            slidesPlane,
            notesPlane: state.planeKinds.indexOf("notesText"),
            dpi: viewDpi(state),
        };
    }

    /** Step `current` on: past the black after the last slide, out of the show. */
    function step(current: Show): void {
        if (current.ended) endShow();
        else client.slideShowInput("next");
    }

    /** `current`'s keys, as it takes them wherever they are pressed. */
    function keys(current: Show): (ev: KeyboardEvent) => void {
        return (ev) => {
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
            else if (NEXT_KEYS.has(key)) step(current);
            else if (PREVIOUS_KEYS.has(key)) client.slideShowInput("previous");
            else if (key === "Home") client.slideShowInput("firstSlide");
            else if (key === "End") client.slideShowInput("lastSlide");
            // Tab would take the keyboard off the show.
            else if (key !== "Tab") return;
            ev.preventDefault();
        };
    }

    /** Take in `current`'s keys on `target`, and, on `focus`, have them back
     *  at a press. */
    function listen(current: Show, target: HTMLElement | Document, focus: HTMLElement | null): void {
        const onKey = keys(current);
        target.addEventListener("keydown", onKey as EventListener);
        current.cleanups.push(() => target.removeEventListener("keydown", onKey as EventListener));
        if (!focus) return;
        const onPointerDown = (): void => focus.focus({ preventScroll: true });
        focus.addEventListener("pointerdown", onPointerDown);
        current.cleanups.push(() => focus.removeEventListener("pointerdown", onPointerDown));
    }

    /**
     * Take in `current`'s clicks and swipes on `el`, over its `canvas`, and
     * hide the pointer while it rests, by `resting`. A press `first` answers
     * true for is its alone, not the show's.
     */
    function listenPointer(
        current: Show,
        el: HTMLElement,
        canvas: HTMLCanvasElement,
        resting: string,
        first?: () => Promise<boolean>,
    ): void {
        const view = el.ownerDocument.defaultView ?? window;
        // A tap or a click is a click on the slide; a swipe across steps on
        // or back.
        let down: { id: number; x: number; y: number } | null = null;
        const onPointerDown = (ev: PointerEvent): void => {
            if (ev.button !== 0) return;
            down = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
        };
        const onPointerUp = (ev: PointerEvent): void => {
            if (down?.id !== ev.pointerId) return;
            const dx = ev.clientX - down.x;
            const dy = ev.clientY - down.y;
            down = null;
            if (ev.pointerType !== "mouse" && Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
                if (dx < 0) step(current);
                else client.slideShowInput("previous");
                return;
            }
            void (first?.() ?? Promise.resolve(false)).then((taken) => {
                if (taken || show !== current) return;
                if (current.ended) {
                    endShow();
                    return;
                }
                const rect = canvas.getBoundingClientRect();
                const dpr = view.devicePixelRatio || 1;
                client.slideShowInput({
                    click: { x: (ev.clientX - rect.left) * dpr, y: (ev.clientY - rect.top) * dpr },
                });
            });
        };
        const onPointerCancel = (): void => {
            down = null;
        };
        const onContextMenu = (ev: Event): void => ev.preventDefault();

        let rest: ReturnType<typeof setTimeout> | null = null;
        const onPointerMove = (): void => {
            el.classList.remove(resting);
            if (rest !== null) clearTimeout(rest);
            rest = setTimeout(() => el.classList.add(resting), POINTER_REST_MS);
        };
        onPointerMove();

        const listeners: Array<[string, EventListener]> = [
            ["pointerdown", onPointerDown as EventListener],
            ["pointerup", onPointerUp as EventListener],
            ["pointercancel", onPointerCancel],
            ["pointermove", onPointerMove],
            ["contextmenu", onContextMenu],
        ];
        for (const [type, listener] of listeners) el.addEventListener(type, listener);
        current.cleanups.push(() => {
            for (const [type, listener] of listeners) el.removeEventListener(type, listener);
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
                presenter.update({ slide, ended });
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
        presenter.destroy();
    }

    return { mount, setBackdrop: presenter.setBackdrop, destroy };
}

export type SlideShow = ReturnType<typeof createSlideShow>;

/** Whether the computer has a screen besides the one the UI is on, as the
 *  browser says where it can (`screen.isExtended`, Chrome's and Edge's);
 *  none where it can't. */
function hasOtherScreen(): boolean {
    return (screen as Screen & { isExtended?: boolean }).isExtended === true;
}

/** Open the window a show plays in for the audience's screen — `null` where
 *  the browser won't — black, with how to put it on that screen. */
function openShowWindow(i18n: I18n): ShowWindow | null {
    const width = Math.round(Math.min(960, screen.availWidth / 2));
    const height = Math.round((width * 9) / 16);
    let view: Window | null;
    try {
        view = window.open("", SHOW_WINDOW, `popup,width=${width},height=${height}`);
    } catch {
        return null;
    }
    if (!view) return null;
    const doc = view.document;
    const style = doc.createElement("style");
    style.textContent = SHOW_WINDOW_STYLE;
    doc.head.replaceChildren(style);
    doc.title = i18n.t("slideShow.window");
    const root = doc.createElement("div");
    root.className = "show";
    root.tabIndex = -1;
    const canvas = doc.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    const end = doc.createElement("div");
    end.className = "end";
    end.textContent = i18n.t("slideShow.end");
    end.hidden = true;
    const hint = doc.createElement("div");
    hint.className = "hint";
    const hintText = doc.createElement("span");
    hintText.textContent = i18n.t("slideShow.windowHint");
    hint.append(hintText);
    root.append(canvas, end, hint);
    doc.body.replaceChildren(root);
    root.focus({ preventScroll: true });
    return { view, root, canvas, end, hint };
}

/** Resolves once what `view` shows now has reached the screen: at the
 *  animation frame after the next. */
function painted(view: Window): Promise<void> {
    return new Promise((resolve) => view.requestAnimationFrame(() => view.requestAnimationFrame(() => resolve())));
}

/**
 * Resolves once `canvas`, `before` device pixels as its window was asked to
 * fill the screen, has taken a new size and held it for {@link SETTLE_FRAMES}
 * animation frames — or after {@link SETTLE_MS}, however it stands. Its size
 * is what tells: a page's against its screen's misleads at a browser zoom,
 * which scales the one and not the other.
 */
function settled(canvas: HTMLCanvasElement, before: { width: number; height: number }): Promise<void> {
    const view = canvas.ownerDocument.defaultView ?? window;
    return new Promise((resolve) => {
        // The window's own clock: each window's counts from its own start.
        const start = view.performance.now();
        let last = devicePixels(canvas);
        let held = 0;
        const check = (): void => {
            const size = devicePixels(canvas);
            const grown = size.width !== before.width || size.height !== before.height;
            held = grown && size.width === last.width && size.height === last.height ? held + 1 : 0;
            last = size;
            if (held >= SETTLE_FRAMES || view.performance.now() - start > SETTLE_MS) resolve();
            else view.requestAnimationFrame(check);
        };
        view.requestAnimationFrame(check);
    });
}

/** `canvas`'s size in device pixels, at least one each way, at the scale of
 *  the screen its window is on. */
function devicePixels(canvas: HTMLCanvasElement): { width: number; height: number } {
    const rect = canvas.getBoundingClientRect();
    const dpr = canvas.ownerDocument.defaultView?.devicePixelRatio || 1;
    return { width: Math.max(1, Math.round(rect.width * dpr)), height: Math.max(1, Math.round(rect.height * dpr)) };
}
