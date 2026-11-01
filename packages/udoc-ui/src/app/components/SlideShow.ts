// A deck's slide show: the deck played a slide at a time, filling the screen,
// as PowerPoint's Slide Show plays it — each slide's transition on the way in,
// its animations a click at a time — on a canvas of the show's own, which the
// worker draws on as the engine composites each frame.
//
// It fills the screen when the browser lets it, else the whole UI. With Use
// Presenter View, where there is a screen for the audience, it plays in a
// window of its own instead — dragged to that screen, a click fills it — and
// the presenter view shows over the UI here. With the screens set up, it fills
// the screen Set Up Screens chose from here at the press, and the presenter
// view opens in a window of its own on another. Swap Screens trades the two:
// each window keeps its screen, and the one pressed in fills it with the show.
//
// It takes PowerPoint's keys: a click, Space, →, ↓, Enter, Page Down or N
// steps on; ←, ↑, Backspace, Page Up or P steps back; Home and End go to the
// first and last slide it shows, a slide's number then Enter to that slide;
// Escape ends it, as leaving the full screen does when it plays alone. A swipe
// steps on or back. Past its last slide it shows black, and a step on from
// there ends it. The view then shows the slide the show was on, as
// PowerPoint's does.

import { subscribeSelector } from "../../framework/index.js";
import type { Store } from "../../framework/index.js";
import type { Size } from "../../geometry.js";
import type { WorkerClient } from "../../worker/WorkerClient.js";
import type { Action } from "../actions.js";
import { planeOfView, viewDpi } from "../state.js";
import type { UIState } from "../state.js";
import type { I18n } from "../i18n/index.js";
import { audienceScreen, presenterScreen, readScreens } from "../screens.js";
import type { ScreenDetailed } from "../screens.js";
import { uiStyles } from "../styles.js";
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

/** The names of the windows a show plays in for the audience's screen, and
 *  the presenter view opens in on the presenter's. */
const SHOW_WINDOW = "udoc-slide-show";
const PRESENTER_WINDOW = "udoc-presenter-view";
/** The slides' size, points, where the deck's won't read: 16:9. */
const FALLBACK_SLIDE: Size = { width: 960, height: 540 };

/**
 * A window a show plays in — the UI's, over its root, or one of its own — and
 * the stage in it the show or the presenter view stands on: what fills the
 * screen there.
 */
interface Place {
    view: Window;
    stage: HTMLElement;
    /** Whether the window is the show's own, which it closes as it ends. */
    own: boolean;
    /** Take the stage down, or close the window. */
    close(): void;
}

/** The show playing. */
interface Show {
    /** What the show is drawn on — its canvas, the line over the black past
     *  its last slide, and how to put a window of its own on the audience's
     *  screen — standing on its place's stage. */
    surface: HTMLElement;
    canvas: HTMLCanvasElement;
    end: HTMLElement;
    hint: HTMLElement;
    /** Where the show stands, and where the presenter view does, if one
     *  shows; every window it opened. */
    place: Place;
    presenterPlace: Place | null;
    places: Place[];
    /** Whether the worker plays it: its start resolved. */
    started: boolean;
    /** The size last handed the show, device pixels. */
    sent: { width: number; height: number };
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
    /** Stop watching its canvas's size, in the window it was in. */
    unwatchSize: (() => void) | null;
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
        const state = store.getState();
        const presenting = state.usePresenterView && hasOtherScreen();
        // The screens set up: filling the screen chosen from here, with the
        // presenter view in a window of its own on another.
        if (presenting && state.screensSetUp) {
            const screens = await readScreens();
            const audience = screens ? audienceScreen(screens, state.audienceScreen) : undefined;
            const there = screens && audience ? presenterScreen(screens, audience) : undefined;
            if (audience && there) {
                await presentAcross(slide, audience, there);
                return;
            }
        }
        // Else in a window of its own for the audience's screen, with the
        // presenter view here — opened first, in the press. One the browser
        // blocks plays here, alone.
        const own = presenting ? ownPlace(SHOW_WINDOW, showWindowFeatures(), i18n.t("slideShow.window")) : null;
        if (own) await present(slide, own);
        else await playAlone(slide);
    }

    /** Play the show alone over the UI, filling the screen when the browser
     *  lets it; leaving the full screen ends it. */
    async function playAlone(slide: number | null): Promise<void> {
        const place = mainPlace();
        if (!place) return;
        const current = begin(slide, place);
        const full = await fill(current);
        if (show !== current) return;
        if (full) {
            const { stage } = place;
            const onFullscreenChange = (): void => {
                if (document.fullscreenElement !== stage) endShow();
            };
            document.addEventListener("fullscreenchange", onFullscreenChange);
            current.cleanups.push(() => document.removeEventListener("fullscreenchange", onFullscreenChange));
        }
        await startShow(current, slide);
    }

    /** Play the show in `own`, a window of its own for the audience's screen,
     *  with the presenter view over the UI here. */
    async function present(slide: number | null, own: Place): Promise<void> {
        const here = mainPlace();
        if (!here) {
            own.close();
            return;
        }
        const current = begin(slide, own, here);
        const deck = await readDeck();
        if (show !== current) return;
        const mirror = openPresenter(current, here, deck, slide);
        await startShow(current, slide, mirror);
    }

    /**
     * Play the show filling `audience` from the UI's window, and open the
     * presenter view in a window of its own filling `there` — in the one
     * press, as the browser lets a page with its screens set up open a window
     * in the press that filled another screen.
     */
    async function presentAcross(slide: number | null, audience: ScreenDetailed, there: ScreenDetailed): Promise<void> {
        const place = mainPlace();
        if (!place) return;
        const current = begin(slide, place);
        let own: Place | null = null;
        const full = await fill(current, audience, () => {
            own = ownPlace(PRESENTER_WINDOW, screenFeatures(there), i18n.t("presenter.label"));
        });
        const opened = own as Place | null;
        if (show !== current) {
            opened?.close();
            return;
        }
        if (!full || !opened) {
            // The show plays alone.
            await startShow(current, slide);
            return;
        }
        addPlace(current, opened);
        current.presenterPlace = opened;
        const deck = await readDeck();
        if (show !== current) return;
        const mirror = openPresenter(current, opened, deck, slide);
        await startShow(current, slide, mirror);
    }

    /** The UI's window as a place: a stage over its root. */
    function mainPlace(): Place | null {
        if (!host) return null;
        const stage = document.createElement("div");
        stage.className = "udoc-ui__slide-show-stage";
        stage.tabIndex = -1;
        host.appendChild(stage);
        return {
            view: window,
            stage,
            own: false,
            close: () => {
                if (document.fullscreenElement === stage) void document.exitFullscreen().catch(() => {});
                stage.remove();
            },
        };
    }

    /**
     * A window of its own, named `name`, opened by `features` and titled
     * `title`, as a place — `null` where the browser won't open one — styled
     * as the UI is: its stylesheet, and the root's classes and settings, the
     * theme's among them.
     */
    function ownPlace(name: string, features: string, title: string): Place | null {
        if (!host) return null;
        let view: Window | null;
        try {
            view = window.open("", name, features);
        } catch {
            return null;
        }
        if (!view) return null;
        const doc = view.document;
        const style = doc.createElement("style");
        style.textContent = uiStyles;
        doc.head.replaceChildren(style);
        doc.title = title;
        const root = doc.createElement("div");
        root.className = host.className;
        root.style.cssText = host.style.cssText;
        Object.assign(root.style, { position: "fixed", inset: "0" });
        const stage = doc.createElement("div");
        stage.className = "udoc-ui__slide-show-stage";
        stage.tabIndex = -1;
        root.append(stage);
        doc.body.style.margin = "0";
        doc.body.replaceChildren(root);
        // Leaving the page closes the window.
        const opened = view;
        const onLeave = (): void => opened.close();
        window.addEventListener("pagehide", onLeave);
        return {
            view,
            stage,
            own: true,
            close: () => {
                window.removeEventListener("pagehide", onLeave);
                opened.close();
            },
        };
    }

    /**
     * A show from `slide`, its surface standing on `place`'s stage, and the
     * presenter view to stand on `presenterPlace`'s, if given: listening to
     * both places, and their windows.
     */
    function begin(slide: number | null, place: Place, presenterPlace: Place | null = null): Show {
        const surface = document.createElement("div");
        surface.className = "udoc-ui__slide-show";
        const canvas = document.createElement("canvas");
        canvas.className = "udoc-ui__slide-show-canvas";
        canvas.setAttribute("aria-hidden", "true");
        const end = document.createElement("div");
        end.className = "udoc-ui__slide-show-end";
        end.textContent = i18n.t("slideShow.end");
        end.hidden = true;
        const hint = document.createElement("div");
        hint.className = "udoc-ui__slide-show-hint";
        const hintText = document.createElement("span");
        hintText.textContent = i18n.t("slideShow.windowHint");
        hint.append(hintText);
        surface.append(canvas, end, hint);
        place.stage.append(surface);
        const current: Show = {
            surface,
            canvas,
            end,
            hint,
            place,
            presenterPlace,
            places: [],
            started: false,
            sent: { width: 0, height: 0 },
            slide: slide ?? 0,
            ended: false,
            typed: "",
            generation: store?.getState().docGeneration ?? 0,
            focused: document.activeElement,
            cleanups: [],
            unwatchSize: null,
        };
        show = current;
        addPlace(current, place);
        if (presenterPlace) addPlace(current, presenterPlace);
        listenPointer(current);
        place.stage.focus({ preventScroll: true });
        return current;
    }

    /** Take in `place`'s keys and its window's for `current`: the show's keys,
     *  its full screen, and its closing, which ends the show. */
    function addPlace(current: Show, place: Place): void {
        current.places.push(place);
        const { stage, view } = place;
        const onKey = keys(current);
        const onPointerDown = (): void => stage.focus({ preventScroll: true });
        const onFullscreenChange = (): void => showHint(current);
        const onClose = (): void => endShow();
        stage.addEventListener("keydown", onKey);
        stage.addEventListener("pointerdown", onPointerDown);
        view.document.addEventListener("fullscreenchange", onFullscreenChange);
        if (place.own) view.addEventListener("pagehide", onClose);
        current.cleanups.push(() => {
            stage.removeEventListener("keydown", onKey);
            stage.removeEventListener("pointerdown", onPointerDown);
            view.document.removeEventListener("fullscreenchange", onFullscreenChange);
            view.removeEventListener("pagehide", onClose);
        });
        showHint(current);
    }

    /** How to put the show's window on the audience's screen, shown while a
     *  window of its own doesn't fill it. */
    function showHint(current: Show): void {
        const { own, view, stage } = current.place;
        current.hint.hidden = !own || view.document.fullscreenElement === stage;
    }

    /**
     * Fill the screen with `current`'s place's stage — `screen`, when given —
     * black until the show could draw at the screen's size, and resolve with
     * whether it does. `granted` runs the moment the browser says it does.
     */
    async function fill(current: Show, screen?: ScreenDetailed, granted?: () => void): Promise<boolean> {
        const { view, stage } = current.place;
        if (view.document.fullscreenElement === stage) return true;
        const { canvas } = current;
        canvas.style.visibility = "hidden";
        try {
            // The show's black on screen before the screen fills: the browser
            // grows into the full screen from a picture of the page as last
            // painted — macOS stretches it to the screen as it moves into a
            // Space of its own — which would otherwise be what showed before.
            await painted(view);
            const before = devicePixels(canvas);
            await stage.requestFullscreen({ navigationUI: "hide", screen } as FullscreenOptions);
            granted?.();
            // Drawn once the screen has filled: the browser says it is full
            // before it is — macOS grows the window over its animation and
            // gives the page its new size only at the end — and a frame drawn
            // before would show at the window's size.
            await settled(canvas, before);
            resize(current);
            await painted(view);
            return true;
        } catch {
            // It stays as it is.
            return false;
        } finally {
            canvas.style.visibility = "";
        }
    }

    /** Start `current` from `slide` at its canvas's size, the worker copying
     *  its slide onto `mirror`, if given; then follow its canvas's size. */
    async function startShow(
        current: Show,
        slide: number | null,
        mirror?: { canvas: HTMLCanvasElement; width: number; height: number; slide: Size },
    ): Promise<void> {
        const size = devicePixels(current.canvas);
        current.sent = size;
        try {
            await client.startSlideShow(current.canvas, slide, size.width, size.height, mirror);
        } catch {
            if (show === current) endShow();
            return;
        }
        if (show !== current) return;
        current.started = true;
        current.cleanups.push(() => current.unwatchSize?.());
        watchSize(current);
        resize(current);
    }

    /** Hand the show its canvas's new size, if it has one — its window
     *  resized, filling its screen, or on a screen of another scale. */
    function resize(current: Show): void {
        if (!current.started) return;
        const next = devicePixels(current.canvas);
        if (next.width === current.sent.width && next.height === current.sent.height) return;
        current.sent = next;
        client.slideShowInput({ resize: next });
    }

    /** Follow `current`'s canvas's size in the window it is in. */
    function watchSize(current: Show): void {
        current.unwatchSize?.();
        const view = current.place.view as Window & typeof globalThis;
        const onResize = (): void => resize(current);
        const observer = new view.ResizeObserver(onResize);
        observer.observe(current.canvas);
        view.addEventListener("resize", onResize);
        current.unwatchSize = () => {
            observer.disconnect();
            view.removeEventListener("resize", onResize);
        };
    }

    /**
     * Open the presenter view on `place` for `current`, a show of `deck` from
     * `slide`, and return the canvas it copies the show's slide onto, for the
     * show to transfer. In a window of its own — the screens set up — its
     * first click or key fills its screen with it; in the UI's, it stays as
     * it is, the show's window still to be dragged to the audience's screen.
     */
    function openPresenter(
        current: Show,
        place: Place,
        deck: PresenterDeck,
        slide: number | null,
    ): { canvas: HTMLCanvasElement; width: number; height: number; slide: Size } {
        const actions: PresenterActions = {
            next: () => step(current),
            previous: () => client.slideShowInput("previous"),
            end: endShow,
            swap: () => void swap(current),
        };
        const copy = presenter.open(place.stage, deck, actions, place.own);
        current.cleanups.push(() => presenter.close());
        current.slide = slide ?? deck.shown[0] ?? 0;
        presenter.update({ slide: current.slide, ended: false });
        return { ...copy, slide: deck.slideSize };
    }

    /**
     * Swap the screens `current` and the presenter view show on: each window
     * keeps its screen, the show standing where the presenter view stood and
     * the presenter view where the show stood. Pressed in the presenter view,
     * whose window then fills its screen with the show.
     */
    async function swap(current: Show): Promise<void> {
        const there = current.presenterPlace;
        if (!there || !current.started) return;
        const here = current.place;
        current.place = there;
        current.presenterPlace = here;
        current.canvas.style.visibility = "hidden";
        there.stage.append(current.surface);
        presenter.move(here.stage);
        there.stage.focus({ preventScroll: true });
        showHint(current);
        watchSize(current);
        resize(current);
        await fill(current);
        current.canvas.style.visibility = "";
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

    /**
     * Take in `current`'s clicks and swipes on its surface, and hide the
     * pointer while it rests. With the presenter view, a click on a show whose
     * window doesn't fill its screen fills it instead.
     */
    function listenPointer(current: Show): void {
        const { surface, canvas } = current;
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
            const { view, stage } = current.place;
            if (current.presenterPlace && view.document.fullscreenElement !== stage) {
                void fill(current);
                return;
            }
            if (current.ended) {
                endShow();
                return;
            }
            const rect = canvas.getBoundingClientRect();
            const dpr = view.devicePixelRatio || 1;
            client.slideShowInput({ click: { x: (ev.clientX - rect.left) * dpr, y: (ev.clientY - rect.top) * dpr } });
        };
        const onPointerCancel = (): void => {
            down = null;
        };
        const onContextMenu = (ev: Event): void => ev.preventDefault();

        let rest: ReturnType<typeof setTimeout> | null = null;
        const onPointerMove = (): void => {
            surface.classList.remove("udoc-ui__slide-show--resting");
            if (rest !== null) clearTimeout(rest);
            rest = setTimeout(() => surface.classList.add("udoc-ui__slide-show--resting"), POINTER_REST_MS);
        };
        onPointerMove();

        const listeners: Array<[string, EventListener]> = [
            ["pointerdown", onPointerDown as EventListener],
            ["pointerup", onPointerUp as EventListener],
            ["pointercancel", onPointerCancel],
            ["pointermove", onPointerMove],
            ["contextmenu", onContextMenu],
        ];
        for (const [type, listener] of listeners) surface.addEventListener(type, listener);
        current.cleanups.push(() => {
            for (const [type, listener] of listeners) surface.removeEventListener(type, listener);
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
        // Newest first; then its places, the presenter view gone from them.
        for (const off of current.cleanups.reverse()) off();
        current.surface.remove();
        for (const place of current.places) place.close();
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

/** A window of its own for the audience's screen: half the screen's width
 *  at most, 16:9, where the browser places it. */
function showWindowFeatures(): string {
    const width = Math.round(Math.min(960, screen.availWidth / 2));
    const height = Math.round((width * 9) / 16);
    return `popup,width=${width},height=${height}`;
}

/** A window of its own filling `screen` — full screen where the browser opens
 *  a window so for a page that may place windows (`fullscreen`, a Chrome
 *  trial), else its available area. */
function screenFeatures(screen: ScreenDetailed): string {
    const { availLeft: left, availTop: top, availWidth: width, availHeight: height } = screen;
    return `popup,fullscreen,left=${left},top=${top},width=${width},height=${height}`;
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
