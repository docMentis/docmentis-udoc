// The password a protected document needs before it opens — a PDF encrypted
// with a user password. Ported from the viewer's PasswordDialog: the same
// copy, the same show/hide toggle, the same retry on a refused password.
//
// It covers the **whole** component, as the licensing notice does, and for the
// same reason: until the document opens there is no document, so every ribbon
// control, panel and keystroke would go to nothing. What refuses the input is
// `inert` on its siblings — the scrim is only how that looks — so it has to be
// mounted on the root.
//
// Nothing here dismisses it. The UI is a component and has no way to open
// another document, so a reader without the password has no next thing to try;
// the host moves on by opening one, which dismisses it.
//
// Storeless and imperative, like the other dialogs: the shell asks it for a
// password, as often as the engine refuses one, and never keeps what it hands
// back.

import { on } from "../../framework/index.js";
import { trapFocus } from "../a11y.js";
import { ICON_LOCK, ICON_PASSWORD_HIDE, ICON_PASSWORD_SHOW } from "../icons.js";
import type { I18n } from "../i18n/index.js";

/**
 * Build the password dialog. The returned handle is mounted once by the shell
 * and asked for a password per protected document.
 */
export function createPasswordModal(i18n: I18n) {
    const el = document.createElement("div");
    el.className = "udoc-password-modal";
    el.style.display = "none";

    const backdrop = document.createElement("div");
    backdrop.className = "udoc-password-modal__backdrop";

    const dialog = document.createElement("div");
    dialog.className = "udoc-password-modal__dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");

    const header = document.createElement("div");
    header.className = "udoc-password-modal__header";
    const icon = document.createElement("span");
    icon.className = "udoc-password-modal__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = ICON_LOCK;
    const heading = document.createElement("h2");
    heading.className = "udoc-password-modal__heading";
    heading.id = "udoc-password-modal-heading";
    heading.textContent = i18n.t("password.title");
    header.append(icon, heading);
    dialog.setAttribute("aria-labelledby", heading.id);

    const form = document.createElement("form");
    form.className = "udoc-password-modal__body";

    const message = document.createElement("p");
    message.className = "udoc-password-modal__message";
    message.textContent = i18n.t("password.message");

    const field = document.createElement("div");
    field.className = "udoc-password-modal__field";
    const input = document.createElement("input");
    input.type = "password";
    input.className = "udoc-password-modal__input";
    input.placeholder = i18n.t("password.placeholder");
    input.autocomplete = "off";
    input.setAttribute("aria-label", i18n.t("password.label"));
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "udoc-password-modal__toggle";
    field.append(input, toggle);

    const error = document.createElement("p");
    error.className = "udoc-password-modal__error";
    error.id = "udoc-password-modal-error";
    error.setAttribute("aria-live", "polite");
    input.setAttribute("aria-describedby", error.id);

    const footer = document.createElement("div");
    footer.className = "udoc-password-modal__footer";
    const unlock = document.createElement("button");
    unlock.type = "submit";
    unlock.className = "udoc-password-modal__unlock";
    unlock.textContent = i18n.t("password.unlock");
    footer.appendChild(unlock);

    form.append(message, field, error, footer);
    dialog.append(header, form);
    el.append(backdrop, dialog);

    /** Hands the password in flight to the shell; null when nothing is asked. */
    let answer: ((password: string | null) => void) | null = null;
    const unsubEvents: Array<() => void> = [];

    /** Show the password as typed, or masked. */
    function reveal(shown: boolean): void {
        input.type = shown ? "text" : "password";
        toggle.innerHTML = shown ? ICON_PASSWORD_HIDE : ICON_PASSWORD_SHOW;
        const label = i18n.t(shown ? "password.hide" : "password.show");
        toggle.title = label;
        toggle.setAttribute("aria-label", label);
    }

    /** Take input, or refuse it while the engine tries the last password. */
    function setWaiting(waiting: boolean): void {
        input.disabled = waiting;
        toggle.disabled = waiting;
        unlock.disabled = waiting;
        dialog.setAttribute("aria-busy", String(waiting));
    }

    /**
     * Everything the dialog covers: every sibling of the scrim, which is the
     * whole UI — the shell mounts this on the root.
     */
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

    on(form, "submit", (e) => {
        e.preventDefault();
        const password = input.value;
        if (!password || !answer) return;
        // Not kept past the hand-off, not even in the field.
        input.value = "";
        setWaiting(true);
        const give = answer;
        answer = null;
        give(password);
    });
    on(input, "input", () => {
        error.textContent = "";
    });
    on(toggle, "click", () => reveal(input.type === "password"));

    /**
     * Ask for the password: `refused` when the last one given was wrong.
     * Resolves with what the reader typed, or null once the dialog is
     * {@link dismiss dismissed} instead. Stays up, refusing input, after it
     * resolves — until the shell asks again or dismisses it.
     */
    function ask(refused: boolean): Promise<string | null> {
        // An outstanding ask is abandoned rather than stacked.
        answer?.(null);
        const shown = el.style.display !== "none";
        el.style.display = "";
        error.textContent = refused ? i18n.t("password.incorrect") : "";
        setWaiting(false);
        if (!shown) {
            reveal(false);
            // Focus first, then inert: an inert element cannot take focus, so
            // doing it the other way round leaves focus wherever it was.
            input.focus();
            setInert(true);
        } else {
            input.focus();
        }
        return new Promise((resolve) => {
            answer = resolve;
        });
    }

    /** Take the dialog down, answering an outstanding {@link ask} with null. */
    function dismiss(): void {
        const pending = answer;
        answer = null;
        pending?.(null);
        if (el.style.display === "none") return;
        el.style.display = "none";
        input.value = "";
        error.textContent = "";
        setInert(false);
    }

    function mount(parent: HTMLElement): void {
        parent.appendChild(el);
        // Inert keeps Tab out of the UI; this keeps it out of the browser's
        // own chrome too.
        unsubEvents.push(trapFocus(el));
    }

    function destroy(): void {
        dismiss();
        for (const off of unsubEvents) off();
        el.remove();
    }

    return { el, mount, ask, dismiss, destroy };
}

export type PasswordModal = ReturnType<typeof createPasswordModal>;
