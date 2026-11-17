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
import type { UDocFragment, UDocType } from "@docmentis/udoc-wasm";
import {
    allowsEdit,
    allowsTableEdit,
    allowsTextEdit,
    fragmentFromHtml,
    parseFragment,
    UDOC_FRAGMENT_FORMAT,
} from "@docmentis/udoc-ui/internal";
import type { CommandContext } from "@docmentis/udoc-ui/internal";
import type { EditHost } from "./edit-client.js";
import { editsDocument } from "./mode.js";

/**
 * Whether a cut deletes what it copied — what Cut does beyond Copy, from the
 * keyboard as from the menu.
 *
 * A range of text deletes as text, in a workbook's cell being typed into
 * too, and objects, annotations, shapes, slides, sections or pages picked
 * whole delete as they are. A caret, or a pick in a table, only copies: the
 * shape or table holding it keeps its own delete live, but a cut of what is in
 * it must not take it. Nor does anything picked in a workbook's grid delete —
 * Excel's cut moves cells when they are pasted, and clears nothing before —
 * nor, yet, its objects.
 */
export function cutDeletes({
    docType,
    cellEntry,
    selection,
}: Pick<CommandContext, "docType" | "cellEntry" | "selection">): boolean {
    if (docType === "spreadsheet") return cellEntry;
    if (allowsTextEdit(selection, "deleteText")) return true;
    if (allowsTextEdit(selection, "insertText") || allowsTableEdit(selection, "insertRows")) return false;
    return allowsEdit(
        selection,
        "deleteObjects",
        "deleteAnnotations",
        "deleteShapes",
        "deleteSlides",
        "deleteSlideSectionsWithSlides",
        "deletePages",
    );
}

/** Edit mode's clipboard verbs, for a menu row — a keyboard cut or paste rides
 *  the native event on the sink instead, and a copy is the shell's. */
export interface Clipboard {
    cut(): void;
    paste(): Promise<void>;
    /** Stop listening on the sink. */
    destroy(): void;
}

/**
 * Whether an open document of `docType` pastes `fragment` as itself: one of its
 * own doc type's. Any other pastes as its text, as one copied from another app
 * does — the engine takes a fragment only into its own doc type, and into a
 * workbook none yet, which loses nothing there: a workbook's fragment is only
 * its text.
 */
function pastesFragment(fragment: UDocFragment, docType: UDocType | null): boolean {
    return docType !== null && docType !== "spreadsheet" && docType in fragment;
}

/** The clipboard over `host`'s sink. */
export function createClipboard(host: EditHost): Clipboard {
    const { edit } = host;

    function isEditReady(): boolean {
        const st = host.store.getState();
        return st.status === "ready" && editsDocument(st.mode);
    }

    // The native `cut`: copy, then delete — only what a cut deletes (see
    // `cutDeletes`), and only once the copy reached the clipboard. A
    // copyable-but-locked object is copied without being removed.
    function onCutEvent(event: ClipboardEvent): void {
        if (!isEditReady()) return;
        const state = host.store.getState();
        const deletes = cutDeletes({
            docType: state.docType,
            cellEntry: state.activeCell?.entry != null,
            selection: state.selectionCaps,
        });
        void host.clipboard.write(event).then((copied) => {
            if (copied && deletes) void deleteCut();
        });
    }

    // What a cut deletes once its copy landed: the selection, as Delete takes
    // it — except sections, whose copy carries their slides, so their cut
    // takes the slides too, where Delete hands them to the section before.
    function deleteCut(): Promise<void> {
        if (host.store.getState().selectedSlideSections.length > 0)
            return host.commit(() => host.client.executeOnSelection({ kind: "deleteSlideSectionsWithSlides" }));
        return host.deleteSelection();
    }

    // The native `paste`: read the clipboard (the source of truth). Prefer our own
    // flavor, then the fragment in the HTML envelope (what a clipboard written by
    // the copy's async fallback carries — it has no custom format), where the
    // open document pastes it (see `pastesFragment`); else fall through to
    // `text/plain`, which routes as typing does — to the text caret when one is
    // live, or a workbook's cell — and is otherwise a no-op (a text box from a
    // string is a later increment).
    function onPasteEvent(event: ClipboardEvent): void {
        if (!isEditReady()) return;
        event.preventDefault();
        const data = event.clipboardData;
        if (!data) return;
        const own = parseFragment(data.getData(UDOC_FRAGMENT_FORMAT)) ?? fragmentFromHtml(data.getData("text/html"));
        if (own && pastesFragment(own, host.store.getState().docType)) {
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
    // exists. Prefers our fragment where the open document pastes it, else
    // routes the text as typing does.
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
        if (frag && pastesFragment(frag, host.store.getState().docType)) void host.commit(() => edit.paste(frag));
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
