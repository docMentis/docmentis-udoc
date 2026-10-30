// Formatting marks: `¶` at each paragraph end, a dot in each space, an arrow in
// each tab, `↵` at each line break — Word's toggle, on a wordprocessing
// document in edit mode. The ribbon's Show Formatting Marks button and Word's
// Ctrl+Shift+8 flip it; the engine draws them.
import type { Action, CommandDef, Store, UIState } from "@docmentis/udoc-ui/internal";
import { subscribeSelector } from "@docmentis/udoc-ui/internal";
import type { EditHost } from "./edit-client.js";
import type { MessageKey } from "./i18n/index.js";
import { ICON_FORMATTING_MARKS } from "./icons.js";
import { editState, updateEditState } from "./state.js";

/** Whether the engine draws the marks in `s`: editing chrome like the
 *  placeholder prompts, so edit mode only; and only on the doc type carrying
 *  the toggle, since a deck's or a spreadsheet's text composes through the same
 *  engine and would show marks with no toggle to hide them. */
function marksShown(s: UIState): boolean {
    return editState(s).showFormattingMarks && s.mode === "edit" && s.docType === "wordprocessing";
}

/** Show or hide the marks in `store` — a user preference, kept across documents. */
export function setShowFormattingMarks(store: Store<UIState, Action>, visible: boolean): void {
    updateEditState(store, { showFormattingMarks: visible });
}

/**
 * The Show Formatting Marks toggle — a view toggle, not an edit, so it sits on a
 * word document's View tab, in a group of its own after Pages and Pageless, live
 * whatever is selected. Gated on the doc type: the toggle is Word's, and only
 * wordprocessing text shows marks.
 */
export const FORMATTING_MARKS_COMMAND: CommandDef<MessageKey> = {
    id: "formattingMarks",
    label: "command.formattingMarks",
    icon: ICON_FORMATTING_MARKS,
    group: "formattingMarks",
    run: {
        kind: "toggle",
        pressed: (s) => editState(s).showFormattingMarks,
        press: (store) => setShowFormattingMarks(store, !editState(store.getState()).showFormattingMarks),
    },
    shortcut: { key: "8", shift: true },
    enabledWhen: (c) => c.ready && c.docType === "wordprocessing",
};

/**
 * Word's Ctrl+Shift+8, flipping the marks where the ribbon's toggle is: edit
 * mode on a wordprocessing document. Matched by the key's place rather than its
 * character, which Shift makes `*` on a US layout and something else elsewhere.
 */
export function formattingMarksKey(e: KeyboardEvent, store: Store<UIState, Action>): void {
    if (!((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "Digit8")) return;
    const state = store.getState();
    if (state.mode !== "edit" || state.docType !== "wordprocessing") return;
    e.preventDefault();
    setShowFormattingMarks(store, !editState(state).showFormattingMarks);
}

/** Keep the engine drawing the marks while {@link marksShown}; returns the
 *  teardown. Sticky in the worker across re-opens, so pushed at once too. */
export function mountFormattingMarks(host: EditHost): () => void {
    host.edit.setFormattingMarks(marksShown(host.store.getState()));
    return subscribeSelector(host.store, marksShown, (on) => host.edit.setFormattingMarks(on));
}
