// The busy hold — the UI refusing input while something it started finishes.
//
// Modal on purpose, and the font change is the case that forces it. Applying a
// family the document has never used loads it *before* it applies it, so one
// click becomes two moments with a download in between. Left interactive, the
// selection can move in that gap and the font lands on whatever is selected when
// the bytes arrive — not on the text it was picked for. Held, the selection the
// wait began with is the selection it ends with, which is the whole point: the
// fix is refusing the input, not tracking the selection through it.
//
// Nothing is drawn at first. Most holds are over in a couple of hundred
// milliseconds — two cached HTTP round trips, and only the first use of a family
// waits at all — and an indicator that flashes for 50ms reads worse than no
// indicator. Past {@link SHOW_AFTER_MS} the wait is real, so it gets a face and
// a way out: a spinner, what is being waited for, and Cancel.
//
// What refuses the input is `inert` on the rest of the UI; the scrim is only
// how that looks. A scrim alone would stop the pointer, which is the easy half:
// the canvas keeps a hidden textarea focused as its keyboard sink and *re-takes*
// focus on every selection report (Canvas `syncTextInput`), so blocking by focus
// alone loses the keyboard back the first time the worker reports anything.
// Inert blocks pointer and keyboard together, un-focuses what it covers, and
// makes that reclaim a no-op — the block holds without anyone cooperating.
//
// Storeless and imperative, like the other dialogs (NewSlideModal,
// PageSettingsModal): mounted once by the shell, reused, owning no document
// state of its own.

import { on } from "../../framework/index.js";
import { trapFocus } from "../a11y.js";
import type { I18n } from "../i18n/index.js";

/**
 * How long the UI is held silently before the indicator appears.
 *
 * Set just clear of the common hold rather than by the usual "don't show a
 * spinner under a second" rule, and deliberately: that rule is about a slow
 * *result*, and this is a slow result the user cannot click around. The
 * indicator is the explanation for the refused input as much as it is a wait,
 * so the silent window is kept to what a fast fetch actually needs — a css2
 * response and one woff2 off a warm CDN connection — instead of to a threshold
 * measured for a UI that was still answering.
 */
const SHOW_AFTER_MS = 300;

/**
 * Build the busy hold. The returned handle is mounted once by the shell; every
 * hold reuses the same scrim and dialog.
 */
export function createBusyModal(i18n: I18n) {
    const el = document.createElement("div");
    el.className = "udoc-busy";
    el.style.display = "none";
    // Focusable so the hold can take the keyboard the moment it starts, before
    // there is any visible dialog to put focus in.
    el.tabIndex = -1;

    const backdrop = document.createElement("div");
    backdrop.className = "udoc-busy__backdrop";

    const dialog = document.createElement("div");
    dialog.className = "udoc-busy__dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");

    const spinner = document.createElement("div");
    spinner.className = "udoc-busy__spinner";

    const message = document.createElement("p");
    message.className = "udoc-busy__message";
    // Filled at reveal, not at hold, so the announcement matches what is on
    // screen: a wait short enough to stay silent is short enough not to announce.
    message.setAttribute("aria-live", "polite");

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "udoc-busy__cancel";
    cancelBtn.textContent = i18n.t("common.cancel");

    dialog.append(spinner, message, cancelBtn);
    el.append(backdrop, dialog);

    /**
     * Settles the hold in flight: `true` when the work finished, `false` when the
     * user gave up on it. Null when nothing is held — which is also the answer to
     * {@link held}, so there is one source of truth rather than a flag to keep in
     * step with one.
     */
    let settle: ((finished: boolean) => void) | null = null;
    let showTimer: ReturnType<typeof setTimeout> | null = null;
    /** What the current hold is waiting for, shown once it is revealed. */
    let waitingFor = "";
    /** Who had the keyboard before the hold took it. */
    let returnFocus: HTMLElement | null = null;
    const unsubEvents: Array<() => void> = [];

    /** Is the UI being held right now? */
    function held(): boolean {
        return settle !== null;
    }

    /**
     * Everything the hold covers: every sibling of the scrim, which is the whole
     * UI — the shell mounts this on the root, so the siblings are the
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

    function reveal(): void {
        showTimer = null;
        message.textContent = waitingFor;
        el.classList.add("udoc-busy--shown");
        cancelBtn.focus();
    }

    function release(): void {
        if (showTimer !== null) {
            clearTimeout(showTimer);
            showTimer = null;
        }
        el.classList.remove("udoc-busy--shown");
        el.style.display = "none";
        message.textContent = "";
        // Before the focus below: an inert element cannot take focus, so
        // restoring it first would silently do nothing.
        setInert(false);
        const back = returnFocus;
        returnFocus = null;
        // Hand the keyboard back to whoever had it — the ribbon's font button,
        // the hidden text sink. Without this focus falls to <body> and the next
        // keystroke goes nowhere.
        if (back?.isConnected) back.focus();
    }

    /**
     * Hold the UI until `work` settles, refusing input for the whole of it.
     *
     * Resolves `true` when `work` settled — *including* when it failed, which is
     * not this dialog's business: a font that couldn't be fetched is still an
     * answered wait, and the caller goes ahead. `false` means only one thing, the
     * one the caller must respect: the user cancelled.
     *
     * Cancelling does not stop `work`, and nothing here could. A download already
     * in flight lands and installs — a font the user is likely to pick again —
     * and the promise is simply no longer being waited on.
     */
    function hold(label: string, work: Promise<unknown>): Promise<boolean> {
        // An outstanding hold is abandoned rather than stacked. It shouldn't
        // arise (input is refused, so nothing can start a second one), but two
        // holds sharing one scrim would have the first to settle close it.
        settle?.(false);

        waitingFor = label;
        dialog.setAttribute("aria-label", label);
        el.style.display = "";
        returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        // Refuse input from here, not from the reveal: the whole hold is blocked,
        // and only its *appearance* waits. Focus is taken first so it lands
        // somewhere deliberate — going inert around a focused element leaves
        // focus on <body>, where a screen reader has nothing to read.
        el.focus();
        setInert(true);
        showTimer = setTimeout(reveal, SHOW_AFTER_MS);

        return new Promise<boolean>((resolve) => {
            const mine = (finished: boolean): void => {
                if (settle !== mine) return; // superseded, or already settled
                settle = null;
                release();
                resolve(finished);
            };
            settle = mine;
            void work.then(
                () => mine(true),
                () => mine(true),
            );
        });
    }

    /** Say what the hold in flight is waiting for now — the step a longer wait has reached. */
    function relabel(label: string): void {
        if (!held()) return;
        waitingFor = label;
        dialog.setAttribute("aria-label", label);
        if (showTimer === null) message.textContent = label;
    }

    on(cancelBtn, "click", () => settle?.(false));

    function mount(parent: HTMLElement): void {
        parent.appendChild(el);
        // Fires only while focus is inside the scrim, i.e. only while held.
        // Inert already keeps Tab out of the UI; this keeps it out of the
        // browser's own chrome too, so the one thing to press stays under the
        // cursor rather than three tabs away in the address bar.
        unsubEvents.push(trapFocus(el));
        const onKeydown = (e: KeyboardEvent) => {
            if (held() && e.key === "Escape") {
                e.stopPropagation();
                settle?.(false);
            }
        };
        document.addEventListener("keydown", onKeydown);
        unsubEvents.push(() => document.removeEventListener("keydown", onKeydown));
    }

    function destroy(): void {
        settle?.(false);
        for (const off of unsubEvents) off();
        el.remove();
    }

    return { el, mount, hold, relabel, held, destroy };
}

export type BusyModal = ReturnType<typeof createBusyModal>;
