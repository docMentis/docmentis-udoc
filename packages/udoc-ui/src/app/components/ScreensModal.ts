// Set Up Screens' dialog: the computer's screens drawn as they stand, each
// named, to choose the one a slide show with the presenter view plays on —
// the audience's. The presenter view then shows on the screen the UI's window
// is on, or, that one chosen, on another; each screen says which it shows.
//
// It covers the whole component, as the other dialogs do, and for the same
// reason; what refuses the input is `inert` on its siblings, so it is mounted
// on the root. Cancel, or Escape, leaves the choice as it was.
//
// Storeless and imperative, like the other dialogs: the shell asks it for a
// screen and keeps the one it hands back.

import { on } from "../../framework/index.js";
import { trapFocus } from "../a11y.js";
import type { I18n } from "../i18n/index.js";
import { audienceScreen, presenterScreen, screenKey } from "../screens.js";
import type { ScreenDetailed, ScreenDetails } from "../screens.js";

/** The box the screens are drawn in, CSS px, and the gap between two. */
const AREA_WIDTH = 400;
const AREA_HEIGHT = 180;
const GAP_PX = 6;

/**
 * Build the screens dialog. The returned handle is mounted once by the shell
 * and asked for the screen a slide show plays on at each Set Up Screens.
 */
export function createScreensModal(i18n: I18n) {
    const el = document.createElement("div");
    el.className = "udoc-screens-modal";
    el.style.display = "none";

    const backdrop = document.createElement("div");
    backdrop.className = "udoc-screens-modal__backdrop";

    const dialog = document.createElement("div");
    dialog.className = "udoc-screens-modal__dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");

    const heading = document.createElement("h2");
    heading.className = "udoc-screens-modal__heading";
    heading.id = "udoc-screens-modal-heading";
    heading.textContent = i18n.t("command.setUpScreens");
    dialog.setAttribute("aria-labelledby", heading.id);

    const body = document.createElement("div");
    body.className = "udoc-screens-modal__body";
    const message = document.createElement("p");
    message.className = "udoc-screens-modal__message";
    const area = document.createElement("div");
    area.className = "udoc-screens-modal__screens";
    area.setAttribute("role", "radiogroup");
    area.setAttribute("aria-label", i18n.t("screens.label"));
    area.style.width = `${AREA_WIDTH}px`;
    area.style.height = `${AREA_HEIGHT}px`;
    body.append(message, area);

    const footer = document.createElement("div");
    footer.className = "udoc-screens-modal__footer";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "udoc-screens-modal__cancel";
    cancel.textContent = i18n.t("common.cancel");
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "udoc-screens-modal__ok";
    ok.textContent = i18n.t("common.ok");
    footer.append(cancel, ok);

    dialog.append(heading, body, footer);
    el.append(backdrop, dialog);

    /** Hands the screen chosen to the shell — `undefined` for none chosen;
     *  null while nothing is asked. */
    let answer: ((key: string | undefined) => void) | null = null;
    /** The screens asked about, and the one chosen. */
    let details: ScreenDetails | null = null;
    let chosen: ScreenDetailed | undefined;
    const unsubEvents: Array<() => void> = [];

    /** Draw the screens as they stand, each named, the one chosen marked, and
     *  what each shows. */
    function render(): void {
        if (!details) return;
        const { screens } = details;
        const presenter = chosen && presenterScreen(details, chosen);
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
                tile.className = "udoc-screens-modal__screen";
                tile.setAttribute("role", "radio");
                tile.setAttribute("aria-checked", String(screen === chosen));
                Object.assign(tile.style, {
                    left: `${x + (screen.left - left) * scale + GAP_PX / 2}px`,
                    top: `${y + (screen.top - top) * scale + GAP_PX / 2}px`,
                    width: `${Math.max(0, screen.width * scale - GAP_PX)}px`,
                    height: `${Math.max(0, screen.height * scale - GAP_PX)}px`,
                });
                const name = document.createElement("span");
                name.className = "udoc-screens-modal__screen-name";
                name.textContent = screen.label;
                const size = document.createElement("span");
                size.className = "udoc-screens-modal__screen-size";
                size.textContent = `${screen.width} × ${screen.height}`;
                tile.append(name, size);
                const role =
                    screen === chosen
                        ? i18n.t("slideShow.window")
                        : screen === presenter
                          ? i18n.t("presenter.label")
                          : null;
                if (role && screens.length > 1) {
                    const shows = document.createElement("span");
                    shows.className = "udoc-screens-modal__screen-role";
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

    /** Take the dialog down, handing `key` to the one asking. */
    function finish(key: string | undefined): void {
        const give = answer;
        answer = null;
        details = null;
        chosen = undefined;
        area.replaceChildren();
        if (el.style.display !== "none") {
            el.style.display = "none";
            setInert(false);
        }
        give?.(key);
    }

    on(cancel, "click", () => finish(undefined));
    on(ok, "click", () => finish(chosen && details && details.screens.length > 1 ? screenKey(chosen) : undefined));
    on(el, "keydown", (ev: KeyboardEvent) => {
        if (ev.key !== "Escape") return;
        ev.preventDefault();
        ev.stopPropagation();
        finish(undefined);
    });

    /**
     * Ask which of `screens` a slide show plays on, the one `key` chose before
     * marked. Resolves with the key of the one chosen, or `undefined` once the
     * dialog is cancelled or {@link dismiss dismissed}.
     */
    function ask(screens: ScreenDetails, key: string | null): Promise<string | undefined> {
        // An outstanding ask is abandoned rather than stacked.
        answer?.(undefined);
        details = screens;
        chosen = audienceScreen(screens, key);
        message.textContent = i18n.t(screens.screens.length > 1 ? "screens.message" : "screens.oneScreen");
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

export type ScreensModal = ReturnType<typeof createScreensModal>;
