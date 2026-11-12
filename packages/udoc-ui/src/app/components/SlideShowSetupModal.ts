// Set Up Presentation's dialog: how the Present tab's From Beginning and
// From Current Slide play a deck or a PDF — with the presenter view, in a window of its
// own, or not; Show in, what the show covers: the screen, the browser window
// or the UI's own box — and Display on, the screen a show that fills the screen fills: the
// computer's screens drawn as they stand, each named, to choose from once its
// Set Up Screens has let the UI place windows on each. Display on is there
// only where the browser can place windows (Chrome's and Edge's), and greys
// while the show doesn't fill the screen.
//
// It covers the whole component, as the other dialogs do, and for the same
// reason; what refuses the input is `inert` on its siblings, so it is mounted
// on the root. Cancel, or Escape, leaves the setup as it was.
//
// Storeless and imperative, like the other dialogs: the shell asks it for a
// setup and keeps the one it hands back.

import { on } from "../../framework/index.js";
import { trapFocus } from "../a11y.js";
import type { I18n, MessageKey } from "../i18n/index.js";
import { audienceScreen, presenterScreen, screenKey } from "../screens.js";
import type { ScreenDetailed, ScreenDetails } from "../screens.js";
import type { SlideShowFill } from "../state.js";
import { createSegmentButton } from "./controls.js";

/** The box the screens are drawn in, CSS px, and the gap between two. */
const AREA_WIDTH = 400;
const AREA_HEIGHT = 180;
const GAP_PX = 6;

/** Show in's choices, in order, each named. */
const FILLS: readonly { value: SlideShowFill; label: MessageKey }[] = [
    { value: "screen", label: "toolbar.fullscreen" },
    { value: "window", label: "slideShowSetup.browserWindow" },
    { value: "container", label: "slideShowSetup.inPlace" },
];

/** How a slide show plays, as the dialog sets it up. */
export interface SlideShowSetup {
    /** With the presenter view, in a window of its own. */
    presenterView: boolean;
    /** What it covers: the screen, the browser window, or the UI's own box. */
    fill: SlideShowFill;
    /** The screen it fills, by its key — `null` for the first but the one the
     *  UI's window is on. */
    audienceScreen: string | null;
}

/** What the dialog asks with. */
export interface SlideShowSetupContext {
    /** The setup as it stands. */
    setup: SlideShowSetup;
    /** The computer's screens, where they are set up; else `null`. */
    screens: ScreenDetails | null;
    /** Whether the browser can place windows on each screen: Display on shows
     *  only then. */
    canPlaceWindows: boolean;
    /** Set up the screens — the browser asked, in Set Up Screens' press, to
     *  let the UI place windows on each — resolving with them, or `null`
     *  where it won't. */
    setUpScreens(): Promise<ScreenDetails | null>;
}

/**
 * Build the Set Up Presentation dialog. The returned handle is mounted once by
 * the shell and asked for a setup at each Set Up Presentation.
 */
export function createSlideShowSetupModal(i18n: I18n) {
    const el = document.createElement("div");
    el.className = "udoc-slide-show-setup";
    el.style.display = "none";

    const backdrop = document.createElement("div");
    backdrop.className = "udoc-slide-show-setup__backdrop";

    const dialog = document.createElement("div");
    dialog.className = "udoc-slide-show-setup__dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");

    const heading = document.createElement("h2");
    heading.className = "udoc-slide-show-setup__heading";
    heading.id = "udoc-slide-show-setup-heading";
    heading.textContent = i18n.t("command.setUpSlideShow");
    dialog.setAttribute("aria-labelledby", heading.id);

    const body = document.createElement("div");
    body.className = "udoc-slide-show-setup__body";
    const presenter = option("udoc-slide-show-setup-presenter", "presenter.label");

    // Show in: one of its choices pressed, the one `fill` holds.
    let fill: SlideShowFill = "screen";
    const showIn = document.createElement("div");
    showIn.className = "udoc-slide-show-setup__option udoc-slide-show-setup__option--choice";
    const showInLabel = document.createElement("span");
    showInLabel.className = "udoc-slide-show-setup__option-label";
    showInLabel.textContent = i18n.t("slideShowSetup.showIn");
    const fills = createSegmentButton(
        FILLS.map(({ value, label }) => ({ value, label: i18n.t(label) })),
        {
            label: i18n.t("slideShowSetup.showIn"),
            onSelect: (value) => {
                fill = value;
                render();
            },
        },
    );
    showIn.append(showInLabel, fills.el);

    // Display on: Set Up Screens until the screens are set up, then the
    // screens as they stand.
    const display = document.createElement("div");
    display.className = "udoc-slide-show-setup__display";
    display.setAttribute("role", "group");
    const displayHeading = document.createElement("div");
    displayHeading.className = "udoc-slide-show-setup__display-heading";
    displayHeading.id = "udoc-slide-show-setup-display";
    displayHeading.textContent = i18n.t("slideShowSetup.displayOn");
    display.setAttribute("aria-labelledby", displayHeading.id);
    const message = document.createElement("p");
    message.className = "udoc-slide-show-setup__message";
    const setUp = document.createElement("button");
    setUp.type = "button";
    setUp.className = "udoc-slide-show-setup__set-up";
    setUp.textContent = i18n.t("slideShowSetup.setUpScreens");
    const area = document.createElement("div");
    area.className = "udoc-slide-show-setup__screens";
    area.setAttribute("role", "radiogroup");
    area.setAttribute("aria-label", i18n.t("screens.label"));
    area.style.width = `${AREA_WIDTH}px`;
    area.style.height = `${AREA_HEIGHT}px`;
    display.append(displayHeading, message, setUp, area);
    body.append(presenter.row, showIn, display);

    const footer = document.createElement("div");
    footer.className = "udoc-slide-show-setup__footer";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "udoc-slide-show-setup__cancel";
    cancel.textContent = i18n.t("common.cancel");
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "udoc-slide-show-setup__ok";
    ok.textContent = i18n.t("common.ok");
    footer.append(cancel, ok);

    dialog.append(heading, body, footer);
    el.append(backdrop, dialog);

    /** Hands the setup chosen to the shell — `undefined` for none; null while
     *  nothing is asked. */
    let answer: ((setup: SlideShowSetup | undefined) => void) | null = null;
    /** What is asked with, the screens once set up, the one chosen, and
     *  whether the browser refused to set them up. */
    let context: SlideShowSetupContext | null = null;
    let details: ScreenDetails | null = null;
    let chosen: ScreenDetailed | undefined;
    let refused = false;
    const unsubEvents: Array<() => void> = [];

    /** A row of the dialog: `label` and its switch. */
    function option(id: string, label: MessageKey): { row: HTMLElement; input: HTMLInputElement } {
        const row = document.createElement("label");
        row.className = "udoc-slide-show-setup__option";
        row.htmlFor = id;
        const text = document.createElement("span");
        text.className = "udoc-slide-show-setup__option-label";
        text.textContent = i18n.t(label);
        const input = document.createElement("input");
        input.type = "checkbox";
        input.id = id;
        input.className = "udoc-switch";
        input.setAttribute("role", "switch");
        row.append(text, input);
        return { row, input };
    }

    /** Show Display on as it stands: Set Up Screens, or the screens drawn,
     *  each named, the one chosen marked, and what each shows — greyed while
     *  the show doesn't fill the screen. */
    function render(): void {
        fills.select(fill);
        const greyed = fill !== "screen";
        display.classList.toggle("udoc-slide-show-setup__display--greyed", greyed);
        display.setAttribute("aria-disabled", String(greyed));
        setUp.hidden = details !== null;
        setUp.disabled = greyed;
        area.hidden = details === null;
        const words: MessageKey | null =
            details === null
                ? refused
                    ? "slideShowSetup.screensRefused"
                    : "slideShowSetup.screensMessage"
                : details.screens.length < 2
                  ? "screens.oneScreen"
                  : null;
        message.hidden = words === null;
        message.textContent = words === null ? "" : i18n.t(words);
        if (!details) {
            area.replaceChildren();
            return;
        }
        const { screens } = details;
        const presenterOn = chosen && presenter.input.checked ? presenterScreen(details, chosen) : undefined;
        const left = Math.min(...screens.map((screen) => screen.left));
        const top = Math.min(...screens.map((screen) => screen.top));
        const right = Math.max(...screens.map((screen) => screen.left + screen.width));
        const bottom = Math.max(...screens.map((screen) => screen.top + screen.height));
        const scale = Math.min(AREA_WIDTH / (right - left), AREA_HEIGHT / (bottom - top));
        // Centred in the box.
        const x = (AREA_WIDTH - (right - left) * scale) / 2;
        const y = (AREA_HEIGHT - (bottom - top) * scale) / 2;
        area.replaceChildren(
            ...screens.map((screen) => {
                const tile = document.createElement("button");
                tile.type = "button";
                tile.className = "udoc-slide-show-setup__screen";
                tile.setAttribute("role", "radio");
                tile.setAttribute("aria-checked", String(screen === chosen));
                tile.disabled = greyed;
                Object.assign(tile.style, {
                    left: `${x + (screen.left - left) * scale + GAP_PX / 2}px`,
                    top: `${y + (screen.top - top) * scale + GAP_PX / 2}px`,
                    width: `${Math.max(0, screen.width * scale - GAP_PX)}px`,
                    height: `${Math.max(0, screen.height * scale - GAP_PX)}px`,
                });
                const name = document.createElement("span");
                name.className = "udoc-slide-show-setup__screen-name";
                name.textContent = screen.label;
                const size = document.createElement("span");
                size.className = "udoc-slide-show-setup__screen-size";
                size.textContent = `${screen.width} × ${screen.height}`;
                tile.append(name, size);
                const role =
                    screen === chosen
                        ? i18n.t("slideShow.window")
                        : screen === presenterOn
                          ? i18n.t("presenter.label")
                          : null;
                if (role && screens.length > 1) {
                    const shows = document.createElement("span");
                    shows.className = "udoc-slide-show-setup__screen-role";
                    shows.textContent = role;
                    tile.append(shows);
                }
                tile.addEventListener("click", () => {
                    if (screens.length < 2) return;
                    chosen = screen;
                    render();
                    area.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
                });
                return tile;
            }),
        );
    }

    /** Take in the screens set up — `null` where the browser refused. */
    function takeScreens(screens: ScreenDetails | null): void {
        details = screens;
        refused = screens === null;
        chosen = screens && context ? audienceScreen(screens, context.setup.audienceScreen) : undefined;
        render();
    }

    /** Everything the dialog covers: every sibling of the scrim, which is the
     *  whole UI — the shell mounts this on the root. */
    function covered(): HTMLElement[] {
        const parent = el.parentElement;
        if (!parent) return [];
        return Array.from(parent.children).filter(
            (child): child is HTMLElement => child !== el && child instanceof HTMLElement,
        );
    }

    function setInert(inert: boolean): void {
        for (const element of covered()) element.inert = inert;
    }

    /** Take the dialog down, handing `setup` to the one asking. */
    function finish(setup: SlideShowSetup | undefined): void {
        const give = answer;
        answer = null;
        context = details = null;
        chosen = undefined;
        area.replaceChildren();
        if (el.style.display !== "none") {
            el.style.display = "none";
            setInert(false);
        }
        give?.(setup);
    }

    on(presenter.input, "change", render);
    on(setUp, "click", () => {
        const asked = context;
        // Asked in the press, which the browser's question needs.
        void asked?.setUpScreens().then((screens) => {
            if (context === asked) takeScreens(screens);
        });
    });
    on(cancel, "click", () => finish(undefined));
    on(ok, "click", () => {
        if (!context) return;
        finish({
            presenterView: presenter.input.checked,
            fill,
            audienceScreen:
                chosen && details && details.screens.length > 1 ? screenKey(chosen) : context.setup.audienceScreen,
        });
    });
    on(el, "keydown", (ev: KeyboardEvent) => {
        if (ev.key !== "Escape") return;
        ev.preventDefault();
        ev.stopPropagation();
        finish(undefined);
    });

    /**
     * Ask how a slide show plays, from `asked`'s setup. Resolves with the
     * setup chosen, or `undefined` once the dialog is cancelled or
     * {@link dismiss dismissed}.
     */
    function ask(asked: SlideShowSetupContext): Promise<SlideShowSetup | undefined> {
        // An outstanding ask is abandoned rather than stacked.
        answer?.(undefined);
        context = asked;
        presenter.input.checked = asked.setup.presenterView;
        fill = asked.setup.fill;
        display.hidden = !asked.canPlaceWindows;
        details = asked.screens;
        refused = false;
        chosen = details ? audienceScreen(details, asked.setup.audienceScreen) : undefined;
        render();
        const shown = el.style.display !== "none";
        el.style.display = "";
        // Focus first, then inert: an inert element cannot take focus.
        ok.focus();
        if (!shown) setInert(true);
        return new Promise((resolve) => {
            answer = resolve;
        });
    }

    /** Take the dialog down, answering an outstanding {@link ask} with none. */
    function dismiss(): void {
        finish(undefined);
    }

    function mount(parent: HTMLElement): void {
        parent.appendChild(el);
        unsubEvents.push(trapFocus(el));
    }

    function destroy(): void {
        dismiss();
        for (const off of unsubEvents) off();
        el.remove();
    }

    return { el, mount, ask, dismiss, destroy };
}

export type SlideShowSetupModal = ReturnType<typeof createSlideShowSetupModal>;
