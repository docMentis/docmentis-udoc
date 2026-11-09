// What Tab does at a text caret, as Word and PowerPoint take it.
//
// In a table, Tab moves to the next cell and Shift+Tab to the one before — a
// caret's or a block of cells' — and past the last cell Tab adds a row. A tab
// typed into a cell takes a modifier: Ctrl+Tab, Word's on Windows, or
// Option/Alt+Tab, Word's on a Mac and the one a Mac browser passes on, since
// every browser keeps Ctrl+Tab for its own tabs. Elsewhere in text Tab types a
// tab, and Shift+Tab is taken and does nothing, so the keyboard stays in the
// document rather than moving on to the page's controls.

/** What a Tab key does. */
export type TabKeyAction = "nextCell" | "previousCell" | "insertTab" | "none";

/** What the key's target is. */
export interface TabKeyTarget {
    /** The selection is in a table: a caret in a cell, or a block of cells. */
    inTable: boolean;
    /** A text caret is live, where typing goes in. */
    typing: boolean;
}

/** The modifier keys of a key press, and which key it is. */
export interface TabKeyPress {
    key: string;
    shiftKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    metaKey: boolean;
}

/** What `press` does at `target`, or `null` where it is no Tab of the
 *  document's — another key, Cmd+Tab, or a Tab with nowhere in text to go,
 *  which is left to the page. */
export function tabKeyAction(press: TabKeyPress, target: TabKeyTarget): TabKeyAction | null {
    if (press.key !== "Tab" || press.metaKey) return null;
    if (press.ctrlKey || press.altKey) return target.typing ? "insertTab" : null;
    if (target.inTable) return press.shiftKey ? "previousCell" : "nextCell";
    if (target.typing) return press.shiftKey ? "none" : "insertTab";
    return null;
}
