import type { TextCaretMove } from "../../geometry.js";
import type { I18n } from "../i18n/index.js";

/** The edits and moves the hidden field routes out — insert/delete travel the
 *  shell's edit path (relayout + sync broadcast), the caret move is presence
 *  and goes straight to the worker. */
export interface HiddenTextInputHooks {
    insertText: (text: string) => void;
    deleteText: (forward: boolean) => void;
    moveCaret: (movement: TextCaretMove, extend: boolean) => void;
}

/** Keyboard → caret-move vocabulary (arrows, Home/End). */
const CARET_MOVES: Record<string, TextCaretMove> = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
    Home: "lineStart",
    End: "lineEnd",
};

/**
 * The hidden field that is the UI's **keyboard and clipboard sink** — the
 * classic text-editing pattern: a real, focusable `<textarea>` gives the browser (and
 * the IME) an editable element to talk to, while the document renders its own
 * text and caret. It holds keyboard focus for the whole of edit mode (see
 * [`setFocused`]), so the browser fires native `copy`/`cut`/`paste` events on it
 * — the cross-browser way to put custom clipboard formats on, and read them off,
 * the system clipboard. Whoever wires those events lives outside this field (the
 * shell, via the canvas).
 *
 * Two modes, tracked separately:
 * - **focused** ([`setFocused`]) — the field owns the keyboard. On for all of
 *   edit mode, and in view mode while the selection is copyable, so clipboard
 *   events land here whether or not a caret is live.
 * - **editing text** ([`setEditingText`]) — a text caret is live. Only then does
 *   the field consume keystrokes (caret moves, edits, IME); otherwise it's a
 *   pure sink and lets every key bubble to the document shortcuts (object
 *   delete, arrows, escape), swallowing nothing but stray typed characters.
 *
 * Positioned at the caret (see `SelectionLayer.caretViewportRect`) so the IME's
 * candidate window opens beside the text being composed. During a composition
 * nothing is sent — the IME owns the provisional text — and the whole
 * composition commits as one insert on `compositionend` (no inline preview yet).
 */
export function createHiddenTextInput(i18n: I18n, hooks: HiddenTextInputHooks) {
    const el = document.createElement("textarea");
    el.className = "udoc-ui__text-input";
    el.tabIndex = -1;
    // This is the focus target that captures keystrokes and IME composition,
    // so it must NOT be aria-hidden (a focused element can't be hidden from
    // assistive tech) nor inert (that would block the focus it needs). It's
    // kept invisible via CSS; for AT we expose it with a plain label instead.
    el.setAttribute("aria-label", i18n.t("textInput.label"));
    el.autocapitalize = "off";
    el.autocomplete = "off";
    el.spellcheck = false;
    el.rows = 1;

    let focused = false;
    let editingText = false;
    let composing = false;

    el.addEventListener("keydown", (ev) => {
        // The IME owns its keystrokes (229 = "Process").
        if (composing || ev.isComposing) return;
        if (ev.metaKey || ev.ctrlKey) return; // shortcuts (undo, zoom) + native clipboard events
        // No caret: a pure sink. Consume nothing — every key bubbles to the
        // document-level object shortcuts (Delete, arrows, Escape). Stray typed
        // characters that reach the textarea are dropped by the input handler.
        if (!editingText) return;
        const move = CARET_MOVES[ev.key];
        if (move) {
            hooks.moveCaret(move, ev.shiftKey);
            ev.preventDefault();
            ev.stopPropagation();
            return;
        }
        if (ev.key === "Backspace" || ev.key === "Delete") {
            hooks.deleteText(ev.key === "Delete");
            ev.preventDefault();
            ev.stopPropagation();
        }
        // Everything else (printable keys, Enter as "\n") flows into the
        // textarea's value and drains through the input event below.
    });

    el.addEventListener("input", () => {
        // Provisional composition text stays in the field until it commits.
        if (composing) return;
        const value = el.value;
        el.value = "";
        // Only a live caret turns typed text into a document edit; in the
        // pure-sink mode a stray character is just cleared and ignored.
        if (editingText && value) hooks.insertText(value);
    });

    el.addEventListener("compositionstart", () => {
        composing = true;
    });
    el.addEventListener("compositionend", () => {
        // Commit the whole composition as one insert. Clearing the value
        // first keeps the trailing `input` some browsers fire a no-op.
        composing = false;
        const value = el.value;
        el.value = "";
        if (editingText && value) hooks.insertText(value);
    });

    el.addEventListener("blur", (ev) => {
        // A press on the canvas (or its focusable host) blurs this field —
        // reclaim the keyboard while the canvas still wants it. Focus moving to
        // a real control (a toolbar field, a panel input, a ribbon button) is
        // respected.
        const target = ev.relatedTarget;
        const withinCanvas = target == null || (target instanceof Node && el.parentElement?.contains(target) === true);
        if (focused && withinCanvas) {
            requestAnimationFrame(() => {
                if (focused) reclaim();
            });
        }
    });

    /** Whether this field may (re)take the keyboard: it holds it already, or
     *  nothing else editable does — never steal from a real text control, from
     *  a list a form field's items are picked from, or from a list whose arrow
     *  keys pick its items, as the thumbnails' do. */
    function mayTakeKeyboard(): boolean {
        const active = document.activeElement;
        if (active === el) return true;
        if (!(active instanceof HTMLElement)) return true;
        const editable =
            active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            active.tagName === "SELECT" ||
            active.isContentEditable ||
            active.getAttribute("role") === "listbox";
        return !editable;
    }

    /** Focus the field if allowed — idempotent when it already has focus. Also
     *  the re-entry point a ribbon clipboard button uses before `execCommand`,
     *  so the synthetic copy/cut lands on this focused sink. */
    function reclaim(): void {
        if (mayTakeKeyboard()) el.focus({ preventScroll: true });
    }

    /**
     * Take or release the keyboard for the whole of edit mode. While focused,
     * every call re-asserts focus — each selection update passes through here,
     * so a canvas press that stole the keyboard (the host is focusable) hands it
     * back at once. Releasing blurs and clears any provisional text.
     */
    function setFocused(next: boolean): void {
        if (next) {
            focused = true;
            reclaim();
        } else if (focused) {
            focused = false;
            editingText = false;
            composing = false;
            el.value = "";
            el.blur();
        }
    }

    /** Whether a text caret is live — gates whether keystrokes edit text or just
     *  bubble. Independent of [`setFocused`]: the field stays focused as the
     *  clipboard sink even with no caret. */
    function setEditingText(next: boolean): void {
        editingText = next;
        if (!next) {
            composing = false;
            el.value = "";
        }
    }

    /** Park the field at the caret's viewport spot (CSS px); `null` (caret
     *  off-screen) leaves it where it was — harmless, it is invisible. */
    function setPosition(rect: { x: number; y: number; height: number } | null): void {
        if (!rect) return;
        el.style.left = `${rect.x}px`;
        el.style.top = `${rect.y}px`;
        el.style.height = `${Math.max(1, rect.height)}px`;
    }

    return { el, setFocused, setEditingText, focus: reclaim, setPosition };
}
