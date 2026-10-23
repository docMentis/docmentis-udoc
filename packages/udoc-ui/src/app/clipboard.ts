// The copy half of the clipboard: the selection, as a fragment of the
// document, onto the system clipboard — in view mode as in edit, so a viewer
// copies the text it selects. Edit mode's cut and paste build on it (see
// `@docmentis/udoc-editor`'s clipboard).
//
// A copy writes three flavors: our own format and `text/html` (both carrying
// the full-fidelity fragment) plus `text/plain` (readable text for any other
// app — never our JSON).
//
// Copy rides the *native* `copy` event on the focused hidden sink (see
// HiddenTextInput) — no permission prompt, and a custom format round-trips
// there on every browser. A native copy event must fill the clipboard
// synchronously, but our fragment comes from an async worker round-trip, so it
// is precomputed into `pendingCopy` on every selection/edit report.
//
// **Why the fragment also rides in `text/html`.** The two clipboard APIs
// cannot see each other's custom formats (measured in Chromium): a format
// written synchronously (`setData`) reaches a native `paste` event and is
// invisible to `navigator.clipboard.read()`, while one written through
// `navigator.clipboard.write` — which demands a `web ` prefix and throws
// without it — is the exact reverse. Since only the sync path can serve
// Ctrl/Cmd+V, a UI-invoked paste (which has no native event to ride) could
// never recover a custom-format fragment.
//
// `text/html` is the one carrier both readers see, so it is the envelope: the
// fragment JSON on a `data-` attribute (Chromium's sanitizer preserves it on
// both paths), wrapping the readable text so a paste into another app still
// lands something. The same trick Google Docs/Slides use to smuggle a lookup
// id across — minus the id, because our fragment is self-contained and needs
// no store behind it.
//
// (A *rich* HTML body — real formatting for a paste into Word/Gmail, rather
// than the plain text projection below — is a later increment.)
import type { UDocFragment } from "@docmentis/udoc-wasm";
import type { Store } from "../framework/index.js";
import type { WorkerClient } from "../worker/WorkerClient.js";
import type { Action } from "./actions.js";
import { copyAllowed } from "./state.js";
import type { UIState } from "./state.js";

/** Our own clipboard flavor: the fragment as JSON. */
export const UDOC_FRAGMENT_FORMAT = "application/x-udoc-fragment+json";

/** The attribute carrying the fragment JSON on the `text/html` flavor. */
const UDOC_FRAGMENT_ATTRIBUTE = "data-udoc-fragment";

/** A copyable selection's clipboard payload: the fragment and its text. */
interface ClipboardPayload {
    fragment: UDocFragment;
    text: string;
}

/** Escape a string for an HTML attribute value / text node. */
function escapeHtml(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * The `text/html` flavor for `payload`: the fragment JSON on a data attribute
 * (the fidelity), wrapping the readable text (what any other app renders).
 *
 * A pure-shape copy has no text, so its body is a `&nbsp;` — HTML can't
 * express a shape, and there is nothing to say about it; the envelope exists
 * only to carry the attribute. That is what a Google Slides shape copy puts on
 * the clipboard too, and why pasting one into a text editor yields a space.
 */
function fragmentHtml(payload: ClipboardPayload): string {
    const body = payload.text ? escapeHtml(payload.text) : "&nbsp;";
    const json = escapeHtml(JSON.stringify(payload.fragment));
    return `<span ${UDOC_FRAGMENT_ATTRIBUTE}="${json}">${body}</span>`;
}

/**
 * The fragment carried by an HTML flavor, or null when it isn't ours (foreign
 * HTML, or none). Parsed rather than pattern-matched: the clipboard's HTML
 * arrives wrapped in whatever markup the source and the browser's sanitizer
 * put around it (`<html><body><!--StartFragment-->…`), so the attribute is
 * found by query, and `DOMParser` un-escapes the JSON on the way out. Inert by
 * construction — a `text/html` parse runs no scripts and loads no subresources.
 */
export function fragmentFromHtml(html: string): UDocFragment | null {
    if (!html) return null;
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const json = parsed.querySelector(`[${UDOC_FRAGMENT_ATTRIBUTE}]`)?.getAttribute(UDOC_FRAGMENT_ATTRIBUTE);
    return json ? parseFragment(json) : null;
}

/** The fragment our own flavor's `text` carries, or null when it isn't one. */
export function parseFragment(text: string): UDocFragment | null {
    try {
        const value: unknown = JSON.parse(text);
        // Our own clipboard flavor is a doc-type-tagged UDocFragment; accept any
        // known tag. A mismatched-doc-type paste is rejected worker-side.
        return value &&
            typeof value === "object" &&
            ("portable" in value || "presentation" in value || "spreadsheet" in value || "wordprocessing" in value)
            ? (value as UDocFragment)
            : null;
    } catch {
        return null;
    }
}

// Write our flavors into a native copy/cut event synchronously.
function writeFragmentToEvent(event: ClipboardEvent, payload: ClipboardPayload): void {
    event.clipboardData?.setData(UDOC_FRAGMENT_FORMAT, JSON.stringify(payload.fragment));
    // The same fragment again, in the flavor an async read can reach.
    event.clipboardData?.setData("text/html", fragmentHtml(payload));
    // Only when there is text: a pure-shape copy leaves any existing clipboard
    // text alone (our own flavors still replace the item).
    if (payload.text) event.clipboardData?.setData("text/plain", payload.text);
    event.preventDefault();
}

/** The copy half of the clipboard, over the canvas's hidden sink. */
export interface ClipboardCopy {
    /**
     * Write the selection into the native copy / cut `event`: its precomputed
     * payload, at once, or — when that hasn't landed — through the async
     * Clipboard API. Resolves whether anything was copied, which a cut deletes
     * after.
     */
    write(event: ClipboardEvent): Promise<boolean>;
    /** A menu row's Copy: re-enter the native path, as a click fires no clipboard event. */
    copy(): void;
    /** Stop listening on the sink and to the selection. */
    destroy(): void;
}

/**
 * The copy half of the clipboard over `sink`, which `focusSink` focuses: every
 * native `copy` on it, in either mode, writes the selection.
 */
export function createClipboardCopy(
    client: WorkerClient,
    store: Store<UIState, Action>,
    sink: HTMLElement,
    focusSink: () => void,
): ClipboardCopy {
    // The copyable selection's precomputed clipboard payload, kept ready so a
    // native copy/cut can write it synchronously (it can't await the worker).
    // Null when nothing is copyable or the async refresh hasn't landed.
    // `copyGeneration` discards a refresh a newer selection has superseded.
    let pendingCopy: ClipboardPayload | null = null;
    let copyGeneration = 0;

    function refreshPendingCopy(copyable: boolean): void {
        const generation = ++copyGeneration;
        pendingCopy = null;
        if (!copyable) return;
        void (async () => {
            const fragment = await client.copy();
            if (!fragment) return;
            // Project the text off the fragment so the native event has it in
            // hand; the HTML flavor is built from the two synchronously at write
            // time (see `fragmentHtml`), so it needs no round-trip of its own.
            const text = await client.plainText(fragment);
            if (generation === copyGeneration) pendingCopy = { fragment, text };
        })();
    }

    // The async fallback used only when a native copy/cut fires before the
    // precompute has landed: the event already preventDefault'd with nothing set,
    // so this write is the whole clipboard. Carries the fragment in the HTML
    // envelope — the async API rejects a custom type outright unless it is `web `
    // prefixed, and a `web ` format is in turn invisible to the native paste
    // event, so `text/html` is the only spelling both readers can follow back.
    async function asyncCopyFallback(): Promise<boolean> {
        const fragment = await client.copy();
        if (!fragment) return false;
        const text = await client.plainText(fragment);
        const item: Record<string, Blob> = {
            "text/html": new Blob([fragmentHtml({ fragment, text })], { type: "text/html" }),
        };
        if (text) item["text/plain"] = new Blob([text], { type: "text/plain" });
        try {
            await navigator.clipboard.write([new ClipboardItem(item)]);
        } catch {
            try {
                if (text)
                    await navigator.clipboard.write([
                        new ClipboardItem({ "text/plain": new Blob([text], { type: "text/plain" }) }),
                    ]);
            } catch {
                /* no clipboard access — nothing more to try */
            }
        }
        return true;
    }

    function write(event: ClipboardEvent): Promise<boolean> {
        if (pendingCopy) {
            writeFragmentToEvent(event, pendingCopy);
            return Promise.resolve(true);
        }
        // Rare: every settled selection precomputes `pendingCopy`.
        event.preventDefault();
        return asyncCopyFallback();
    }

    // Where the host turns copy off for view mode, a copy there writes nothing.
    function copyReady(): boolean {
        const state = store.getState();
        return state.status === "ready" && copyAllowed(state);
    }

    function onCopyEvent(event: ClipboardEvent): void {
        if (!copyReady()) return;
        void write(event);
    }

    // The menu's Copy row: a click fires no native clipboard event, so focus the
    // sink and let `execCommand` dispatch a synthetic copy the handler above
    // catches (custom format and all, on every browser).
    function copy(): void {
        if (!copyReady()) return;
        focusSink();
        document.execCommand("copy");
    }

    sink.addEventListener("copy", onCopyEvent);
    // Precompute the clipboard payload for the new (copyable) selection so a
    // native copy/cut event can write it synchronously — every report, since
    // an edit echo can change what's selected or copyable.
    const unsubSelection = client.onSelection((state) => refreshPendingCopy(state.capabilities.copyable));
    return {
        write,
        copy,
        destroy() {
            unsubSelection();
            sink.removeEventListener("copy", onCopyEvent);
        },
    };
}
