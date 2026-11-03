// A deck's slide show: the deck played a slide at a time, as PowerPoint's
// Slide Show plays it — each slide's transition on the way in, its animations
// a click at a time — on a canvas of the show's own, which the worker draws on
// as the engine composites each frame. A PDF plays alike, a page at a time,
// each page as the worker rasterizes it.
//
// It stands on a stage: a black layer over the UI — the viewer or the editor,
// not the page around it — or over a window of its own. As Set Up Presentation
// has it, the stage fills the screen — the one Display on chose, where the
// screens are set up — or stays over the UI, in window mode, a button in its
// corner filling the screen with it. One the browser won't fill the screen
// with plays in window mode. Leaving the full screen ends a show that filled
// it as it started; one the button filled goes back to window mode.
//
// With the presenter view, the view opens on a stage in a window of its own,
// which never fills its screen of itself — the view has a button for that:
// on another screen where the screens are set up, the window opened in the
// press that fills the screen Display on chose; else opened first, in the
// press that starts the show, which the browser then won't fill the screen
// at. Swap Screens trades the stages the show and the presenter view stand
// on, each stage keeping its window, and the screen it fills or doesn't.
//
// It takes PowerPoint's keys: a click, Space, →, ↓, Enter, Page Down or N
// steps on; ←, ↑, Backspace, Page Up or P steps back; Home and End go to the
// first and last slide it shows, a slide's number then Enter to that slide;
// Escape ends it. A swipe steps on or back. Past its last slide it shows
// black, and a step on from there ends it. The view then shows the slide the
// show was on, as PowerPoint's does.

import { subscribeSelector } from "../../framework/index.js";
import type { Store } from "../../framework/index.js";
import type { Size } from "../../geometry.js";
import type { WorkerClient } from "../../worker/WorkerClient.js";
import type { Action } from "../actions.js";
import { profileFor } from "../profiles.js";
import { planeOfView, viewDpi } from "../state.js";
import type { UIState } from "../state.js";
import type { I18n } from "../i18n/index.js";
import { ICON_FULLSCREEN } from "../icons.js";
import { audienceScreen, presenterScreen, readScreens } from "../screens.js";
import type { ScreenDetailed } from "../screens.js";
import { uiStyles } from "../styles.js";
import { nameButton } from "./controls.js";
import { createPresenterView } from "./PresenterView.js";
import type { PresenterActions, PresenterDeck } from "./PresenterView.js";

/** How long the pointer rests before it hides, ms. */
const POINTER_REST_MS = 2000;
/** How long the button that fills the screen shows in window mode, once the
 *  pointer stops moving, before it fades, ms. */
const FILL_SHOWN_MS = 3000;
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

/** The name of the window the presenter view opens in, and the smallest it
 *  opens at, CSS px: room for its panes side by side. */
const PRESENTER_WINDOW = "udoc-presenter-view";
const PRESENTER_MIN_WIDTH = 720;
const PRESENTER_MIN_HEIGHT = 480;
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
     *  its last slide, and the button that fills the screen with it in
     *  window mode — standing on its place's stage. */
    surface: HTMLElement;
    canvas: HTMLCanvasElement;
    end: HTMLElement;
    fillButton: HTMLButtonElement;
    /** Where the show stands, and where the presenter view does, if one
     *  shows; every window it opened. */
    place: Place;
    presenterPlace: Place | null;
    places: Place[];
    /** The place whose stage filled the screen as the show started, until it
     *  leaves the full screen: with the show on it, that ends the show. */
    filledAtStart: Place | null;
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
     * — with the presenter view when `presenting`, as Set Up Presentation has
     * it, in place of any show playing. Called in the press that starts it,
     * or just after: the browser fills the screen, or opens a window, only in
     * answer to one, for a few seconds after it.
     */
    async function play(slide: number | null, presenting: boolean): Promise<void> {
        if (!store || !host) return;
        takeDown(false);
        const state = store.getState();
        // A frame that doesn't allow the full screen plays in window mode,
        // asking the browser for nothing a refusal would spend the press on.
        const full = state.slideShowFullScreen && document.fullscreenEnabled;
        // The screens, where they're set up: the one the show fills, as
        // Display on chose it, and another for the presenter view.
        const screens = state.screensSetUp ? await readScreens() : null;
        const audience = full && screens ? audienceScreen(screens, state.audienceScreen) : undefined;
        const there = screens ? presenterScreen(screens, audience ?? screens.currentScreen) : undefined;
        const features = windowFeatures(there, host);
        const place = mainPlace();
        if (!place) return;
        // The presenter view's window: opened in the press that fills the
        // screen Display on chose — the browser lets a page that may place
        // windows open one then — else first, in the press, before the show
        // tries to fill the screen, which the browser then won't.
        let own: Place | null = null;
        let opening = presenting;
        const openOwn = (): void => {
            if (!opening) return;
            opening = false;
            own = ownPlace(PRESENTER_WINDOW, features, i18n.t("presenter.label"));
        };
        if (!audience) openOwn();
        const current = begin(slide, place);
        const filled = full && (await fill(current, audience, openOwn));
        // The screen not filled, the window not yet opened: opened now.
        openOwn();
        const opened = own as Place | null;
        if (show !== current) {
            opened?.close();
            return;
        }
        if (filled) current.filledAtStart = place;
        if (!opened) {
            // The show plays alone: the browser blocked the window, or none
            // was asked for.
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
        carryFont(host, root);
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

    /** A show from `slide`, its surface standing on `place`'s stage: listening
     *  to the place, and its window. */
    function begin(slide: number | null, place: Place): Show {
        const surface = document.createElement("div");
        surface.className = "udoc-ui__slide-show";
        const canvas = document.createElement("canvas");
        canvas.className = "udoc-ui__slide-show-canvas";
        canvas.setAttribute("aria-hidden", "true");
        const end = document.createElement("div");
        end.className = "udoc-ui__slide-show-end";
        end.textContent = i18n.t("slideShow.end");
        end.hidden = true;
        const fillButton = document.createElement("button");
        fillButton.type = "button";
        fillButton.className = "udoc-ui__slide-show-fill";
        fillButton.innerHTML = ICON_FULLSCREEN;
        nameButton(fillButton, i18n.t("toolbar.fullscreen"));
        surface.append(canvas, end, fillButton);
        place.stage.append(surface);
        const current: Show = {
            surface,
            canvas,
            end,
            fillButton,
            place,
            presenterPlace: null,
            places: [],
            filledAtStart: null,
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
        // Leaving the full screen ends a show that filled it as it started,
        // standing on it still; else the stage is in window mode.
        const onFullscreenChange = (): void => {
            if (view.document.fullscreenElement !== stage && current.filledAtStart === place) {
                current.filledAtStart = null;
                if (current.place === place) {
                    endShow();
                    return;
                }
            }
            showFill(current);
        };
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
        showFill(current);
    }

    /** Show the button that fills the screen with the show while its stage
     *  doesn't — in window mode — where the browser lets it. */
    function showFill(current: Show): void {
        const { document: doc } = current.place.view;
        current.fillButton.hidden = doc.fullscreenElement === current.place.stage || !doc.fullscreenEnabled;
    }

    /**
     * Fill the screen with `current`'s place's stage — `screen`, when given —
     * black until the show could draw at the screen's size, and resolve with
     * whether it does. `granted` runs the moment the browser says it does.
     */
    async function fill(current: Show, screen?: ScreenDetailed, granted?: () => void): Promise<boolean> {
        const { view, stage } = current.place;
        if (view.document.fullscreenElement === stage) return true;
        // Only in answer to a press, which a window opened in it has taken.
        if (view.navigator.userActivation?.isActive === false) return false;
        const { canvas, fillButton } = current;
        canvas.style.visibility = "hidden";
        fillButton.hidden = true;
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
            showFill(current);
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
     * show to transfer.
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
            swap: () => swap(current),
        };
        const copy = presenter.open(place.stage, deck, actions);
        current.cleanups.push(() => presenter.close());
        current.slide = slide ?? deck.shown[0] ?? 0;
        presenter.update({ slide: current.slide, ended: false });
        return { ...copy, slide: deck.slideSize };
    }

    /**
     * Swap the stages `current` and the presenter view stand on: the show
     * standing where the presenter view stood and the presenter view where
     * the show stood, each stage keeping its window, and the screen it fills
     * or doesn't. Pressed in the presenter view.
     */
    function swap(current: Show): void {
        const there = current.presenterPlace;
        if (!there || !current.started) return;
        const here = current.place;
        current.place = there;
        current.presenterPlace = here;
        there.stage.append(current.surface);
        presenter.move(here.stage);
        there.stage.focus({ preventScroll: true });
        // A window of its own is named for what stands in it.
        if (there.own) there.view.document.title = i18n.t("slideShow.window");
        if (here.own) here.view.document.title = i18n.t("presenter.label");
        showFill(current);
        watchSize(current);
        resize(current);
    }

    /** What the presenter view shows of the open deck — or PDF, whose pages
     *  are its slides, every one shown. */
    async function readDeck(): Promise<PresenterDeck> {
        const state = store!.getState();
        const deck = state.docType === "presentation";
        const slidesPlane = Math.max(0, planeOfView(state.planeKinds, "normal"));
        const slideCount = deck ? await client.presentation.slideCount() : state.pageCount;
        const indices = Array.from({ length: slideCount }, (_, index) => index);
        const [shows, size] = await Promise.all([
            deck ? client.presentation.slidesShow(indices) : indices.map(() => true),
            client.pageDisplaySize(slidesPlane, 0),
        ]);
        return {
            slideCount,
            shown: indices.filter((index) => shows[index]),
            slideSize: size.width > 0 && size.height > 0 ? size : FALLBACK_SLIDE,
            slidesPlane,
            notesPlane: state.planeKinds.indexOf("notesText"),
            pageNoun: profileFor(state.docType).pageNoun,
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
     * pointer while it rests. In window mode, the button that fills the
     * screen shows at first, and again as the pointer moves.
     */
    function listenPointer(current: Show): void {
        const { surface, canvas, fillButton } = current;
        // A tap or a click is a click on the slide; a swipe across steps on
        // or back.
        let down: { id: number; x: number; y: number } | null = null;
        const onPointerDown = (ev: PointerEvent): void => {
            down = null;
            if (ev.button !== 0 || fillButton.contains(ev.target as Node)) return;
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
            if (current.ended) {
                endShow();
                return;
            }
            const rect = canvas.getBoundingClientRect();
            const dpr = current.place.view.devicePixelRatio || 1;
            client.slideShowInput({ click: { x: (ev.clientX - rect.left) * dpr, y: (ev.clientY - rect.top) * dpr } });
        };
        const onPointerCancel = (): void => {
            down = null;
        };
        const onContextMenu = (ev: Event): void => ev.preventDefault();
        const onFill = (): void => void fill(current);

        let fade: ReturnType<typeof setTimeout> | null = null;
        const revealFill = (): void => {
            fillButton.classList.add("udoc-ui__slide-show-fill--shown");
            if (fade !== null) clearTimeout(fade);
            fade = setTimeout(() => fillButton.classList.remove("udoc-ui__slide-show-fill--shown"), FILL_SHOWN_MS);
        };
        revealFill();
        let rest: ReturnType<typeof setTimeout> | null = null;
        const onPointerMove = (): void => {
            surface.classList.remove("udoc-ui__slide-show--resting");
            if (rest !== null) clearTimeout(rest);
            rest = setTimeout(() => surface.classList.add("udoc-ui__slide-show--resting"), POINTER_REST_MS);
            revealFill();
        };
        rest = setTimeout(() => surface.classList.add("udoc-ui__slide-show--resting"), POINTER_REST_MS);

        const listeners: Array<[string, EventListener]> = [
            ["pointerdown", onPointerDown as EventListener],
            ["pointerup", onPointerUp as EventListener],
            ["pointercancel", onPointerCancel],
            ["pointermove", onPointerMove],
            ["contextmenu", onContextMenu],
        ];
        for (const [type, listener] of listeners) surface.addEventListener(type, listener);
        fillButton.addEventListener("click", onFill);
        current.cleanups.push(() => {
            for (const [type, listener] of listeners) surface.removeEventListener(type, listener);
            fillButton.removeEventListener("click", onFill);
            if (rest !== null) clearTimeout(rest);
            if (fade !== null) clearTimeout(fade);
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
                () => {
                    const { slide, presenterView } = s.getState().slideShowRequest;
                    void play(slide, presenterView);
                },
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

/** The text properties the UI's root inherits from the page it stands on. */
const FONT_PROPERTIES = [
    "font-family",
    "font-size",
    "font-style",
    "font-weight",
    "line-height",
    "letter-spacing",
    "-webkit-font-smoothing",
    "-moz-osx-font-smoothing",
];

/** Give `root`, a window of its own's, the text `host` inherits from the page
 *  the UI stands on, which the window's blank page has none of: the browser's
 *  serif in its place. A web font the page loads stays the page's: the window
 *  falls back past it. */
function carryFont(host: HTMLElement, root: HTMLElement): void {
    const style = getComputedStyle(host);
    for (const name of FONT_PROPERTIES) {
        const value = style.getPropertyValue(name);
        if (value) root.style.setProperty(name, value);
    }
}

/** A window of its own for the presenter view: filling `on`'s available area
 *  — never the full screen, which the view's own button fills — else two
 *  thirds the size of `ui`, the UI, and no smaller than the view needs,
 *  where the browser places it. */
function windowFeatures(on: ScreenDetailed | undefined, ui: HTMLElement): string {
    if (on) {
        const { availLeft: left, availTop: top, availWidth: width, availHeight: height } = on;
        return `popup,left=${left},top=${top},width=${width},height=${height}`;
    }
    const rect = ui.getBoundingClientRect();
    const width = Math.max(PRESENTER_MIN_WIDTH, Math.round((rect.width * 2) / 3));
    const height = Math.max(PRESENTER_MIN_HEIGHT, Math.round((rect.height * 2) / 3));
    return `popup,width=${width},height=${height}`;
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
