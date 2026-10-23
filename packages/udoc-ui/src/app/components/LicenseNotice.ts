// What the reader is told when the engine would not start a session.
//
// Three things can stop one — an unusable key, the permit server declining, a
// check that could not be made — and this is the whole of what any of them puts
// on screen. Everything finer is on the console, addressed to the embedder: why
// the server declined, which claim failed, what to go and look at. None of it belongs
// here, because this is read by whoever happens to be looking at the viewer,
// and on a deployed site that is someone who has never heard of docMentis and
// can act on none of it.
//
// Which is also why it says nothing about the software. The document is fine
// and the engine is fine; what is missing is permission, and the person who can
// restore it is the one running the site.
//
// It covers the **whole** component, not just the viewport. Nothing the UI
// offers works without a session — every ribbon control, every panel, every
// keystroke goes to a document that does not exist — so leaving the chrome live
// would be offering a working UI that answers nothing. As with the busy
// hold, what actually refuses the input is `inert` on its siblings; the scrim
// is only how that looks. That also means this has to be mounted on the root:
// what it holds is its own siblings, so anything deeper would leave the ribbon
// and the panels live.
//
// Terminal, and deliberately so. The UI is a component and has no way to
// open a document, so there is no next thing for the reader to try and nothing
// here to dismiss; only the host can move on from it.

import type { StartError } from "@docmentis/udoc-wasm";
import type { UDocErrorCode } from "@docmentis/udoc-wasm/error";

import { subscribeSelector } from "../../framework/index.js";
import type { Store } from "../../framework/index.js";
import type { Action } from "../actions.js";
import type { UIState } from "../state.js";
import type { I18n, MessageKey } from "../i18n/index.js";

/**
 * The heading for each refusal. One line each, naming the state rather than
 * demanding anything of the reader.
 */
const HEADINGS: Record<StartError["code"], MessageKey> = {
    invalidLicense: "license.invalidLicense",
    permitRefused: "license.permitRefused",
    cannotVerify: "license.cannotVerify",
};

/** Whether `code` is a refusal to start a session — what the notice draws. */
export function isRefusal(code: UDocErrorCode): code is StartError["code"] {
    return Object.hasOwn(HEADINGS, code);
}

export function createLicenseNotice(i18n: I18n) {
    const el = document.createElement("div");
    el.className = "udoc-ui__license-notice";
    el.style.display = "none";
    // Focusable so the block can take the keyboard: going inert around a
    // focused element leaves focus on <body>, where a screen reader has nothing
    // to read.
    el.tabIndex = -1;

    const backdrop = document.createElement("div");
    backdrop.className = "udoc-ui__license-notice-backdrop";

    const panel = document.createElement("div");
    panel.className = "udoc-ui__license-notice-panel";
    // A refusal is an alert the reader did not ask for and cannot dismiss, so
    // it is announced rather than merely rendered.
    panel.setAttribute("role", "alert");

    const heading = document.createElement("h2");
    heading.className = "udoc-ui__license-notice-title";

    const body = document.createElement("p");
    body.className = "udoc-ui__license-notice-body";
    // What to do about it, which is the same whichever of the three it was.
    body.textContent = i18n.t("license.contactOwner");

    panel.append(heading, body);
    el.append(backdrop, panel);

    const cleanups: Array<() => void> = [];

    /**
     * Everything the block covers: every sibling of the scrim, which is the
     * whole UI — the shell mounts this on the root, so the siblings are the
     * toolbar, the ribbon, the body and the other dialogs.
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

    function apply(refusal: StartError["code"] | null): void {
        if (!refusal) {
            el.style.display = "none";
            heading.textContent = "";
            setInert(false);
            return;
        }
        heading.textContent = i18n.t(HEADINGS[refusal]);
        el.style.display = "";
        // Focus first, then inert: an inert element cannot take focus, so doing
        // it the other way round silently leaves focus wherever it was.
        el.focus();
        setInert(true);
    }

    function mount(host: HTMLElement, store: Store<UIState, Action>): void {
        host.appendChild(el);
        cleanups.push(
            subscribeSelector(
                store,
                (s) => s.refusal,
                (refusal) => apply(refusal),
            ),
        );
        // subscribeSelector only fires on change, and a refusal can predate the
        // mount (a document opened before this panel existed).
        apply(store.getState().refusal);
    }

    function destroy(): void {
        for (const off of cleanups) off();
        setInert(false);
        el.remove();
    }

    return { el, mount, destroy };
}

export type LicenseNotice = ReturnType<typeof createLicenseNotice>;
