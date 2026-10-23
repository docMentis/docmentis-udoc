// The clipboard: cut / paste of the selection, as a fragment of the document,
// over the canvas's hidden text input and the context menu's rows — on top of
// the shell's copy (`@docmentis/udoc-ui`'s clipboard), which writes every
// native `copy`, in view mode as in edit, and has the why of the flavors.
//
// The system clipboard is the single source of truth: every paste reads it,
// so an external copy (another app, another udoc tab) always wins — there is
// no in-memory fragment shadowing it.
//
// Cut/paste ride the *native* clipboard events on the focused hidden sink (see
// HiddenTextInput) — no read-permission prompt, and a custom format
// round-trips there on every browser. A UI-invoked paste has no native event
// to ride, so it reads the async Clipboard API, recovering our fragment from
// the `text/html` envelope the copy writes.
//
// (Cross-document paste — carrying the referenced images/fonts — and turning
// foreign `text/plain` into a text box are later increments.)
import type { UDocFragment } from "@docmentis/udoc-wasm";
import { allowsEdit, fragmentFromHtml, parseFragment, UDOC_FRAGMENT_FORMAT } from "@docmentis/udoc-ui/internal";
import type { EditHost } from "./edit-client.js";

/** Edit mode's clipboard verbs, for a menu row — a keyboard cut or paste rides
 *  the native event on the sink instead, and a copy is the shell's. */
export interface Clipboard {
    cut(): void;
    paste(): Promise<void>;
    /** Stop listening on the sink. */
    destroy(): void;
}

/** The clipboard over `host`'s sink. */
export function createClipboard(host: EditHost): Clipboard {
    const { edit } = host;

    function isEditReady(): boolean {
        const st = host.store.getState();
        return st.status === "ready" && st.mode === "edit";
    }

    // The native `cut`: copy, then delete — but only when the selection is
    // deletable (cut = copy + delete), and only once something was copied. A
    // copyable-but-locked object is copied without being removed.
    function onCutEvent(event: ClipboardEvent): void {
        if (!isEditReady()) return;
        const deletable = allowsEdit(
            host.store.getState().selectionCaps,
            "deleteObjects",
            "deleteAnnotations",
            "deleteShapes",
        );
        void host.clipboard.write(event).then((copied) => {
            if (copied && deletable) void host.deleteSelection();
        });
    }

    // The native `paste`: read the clipboard (the source of truth). Prefer our own
    // flavor, then the fragment in the HTML envelope (what a clipboard written by
    // the copy's async fallback carries — it has no custom format); else fall
    // through to `text/plain`, which routes to the text caret when one is live and
    // is otherwise a no-op (a text box from a string is a later increment).
    function onPasteEvent(event: ClipboardEvent): void {
        if (!isEditReady()) return;
        event.preventDefault();
        const data = event.clipboardData;
        if (!data) return;
        const own = parseFragment(data.getData(UDOC_FRAGMENT_FORMAT)) ?? fragmentFromHtml(data.getData("text/html"));
        if (own) {
            void host.commit(() => edit.paste(own));
            return;
        }
        const text = data.getData("text/plain");
        if (text) void host.insertSelectionText(text);
    }

    // The context menu's Cut row: a click fires no native clipboard event, so
    // re-enter the native path — focus the sink and let `execCommand` dispatch a
    // synthetic cut the handler catches (custom format and all, on every
    // browser).
    function menuCut(): void {
        if (!isEditReady()) return;
        host.focusClipboardSink();
        document.execCommand("cut");
    }

    // The menu's Paste row can't trigger a native paste (`execCommand("paste")` is
    // blocked), so it reads the clipboard asynchronously. That read can't see our
    // custom format (see the flavor note in udoc-ui's clipboard) — it recovers
    // the fragment from the HTML envelope, which is exactly why the envelope
    // exists. Prefers our fragment, else routes text to the caret.
    //
    // Still not the equal of Ctrl/Cmd+V: the read is permission-gated, and Safari
    // fronts it with its own paste-confirmation UI. It pastes the same object,
    // just not as quietly.
    async function menuPaste(): Promise<void> {
        if (!isEditReady()) return;
        let fragment: UDocFragment | null = null;
        let text = "";
        try {
            for (const item of await navigator.clipboard.read()) {
                if (!fragment && item.types.includes("text/html")) {
                    fragment = fragmentFromHtml(await (await item.getType("text/html")).text());
                }
                if (!text && item.types.includes("text/plain")) {
                    text = await (await item.getType("text/plain")).text();
                }
            }
        } catch {
            return; // read unsupported / denied
        }
        const frag = fragment;
        if (frag) void host.commit(() => edit.paste(frag));
        else if (text) void host.insertSelectionText(text);
    }

    const sink = host.clipboardSink;
    const listeners: ReadonlyArray<readonly ["cut" | "paste", (event: ClipboardEvent) => void]> = [
        ["cut", onCutEvent],
        ["paste", onPasteEvent],
    ];
    for (const [type, listener] of listeners) sink.addEventListener(type, listener);
    return {
        cut: menuCut,
        paste: menuPaste,
        destroy() {
            for (const [type, listener] of listeners) sink.removeEventListener(type, listener);
        },
    };
}
