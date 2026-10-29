// A workbook's keys, as Excel takes them: what a key pressed on the grid does
// to the cell selection and to the text being typed into the active cell.
//
// Ready — no cell being typed into — an arrow moves the active cell (Shift
// extends the block, Ctrl or Cmd jumps to the edge of the data), Enter and Tab
// step down and right (Shift back), and in edit mode F2 edits the cell's
// contents, Backspace starts an empty entry and Delete clears the cells. A
// typed character starts an entry in Enter mode in place of what the cell
// holds; that is the hidden text input's, not a key's.
//
// While a cell is typed into, Enter saves the entry and steps down (Shift up),
// Tab right (Shift left), Ctrl or Cmd with Enter saves it into every selected
// cell, Alt with Enter breaks the line, F2 switches between Enter and Edit
// mode, and Escape drops it. An arrow in Enter mode saves the entry and moves;
// in Edit mode it moves the caret, which is the hidden text input's own.

import type { CellEntryMode, GridCellSelectionMove } from "@docmentis/udoc-wasm";

/** What a key on the grid does. */
export type CellKeyAction =
    /** Move the cell selection — `extend` moves the block's focus corner. */
    | { kind: "move"; movement: GridCellSelectionMove; extend: boolean }
    /** Begin typing into the active cell in `mode`: `text` in place of what it
     *  holds, or with none its contents (Edit) or nothing (Enter). */
    | { kind: "begin"; mode: CellEntryMode; text: string | null }
    /** Clear the selected cells' contents. */
    | { kind: "clear" }
    /** Save what is typed — into every selected cell with `fill` — and move
     *  `then`, or keep the selection. */
    | { kind: "commit"; fill: boolean; then: GridCellSelectionMove | null }
    /** Break the line in what is typed. */
    | { kind: "lineBreak" }
    /** Switch between Enter and Edit mode. */
    | { kind: "switchMode" }
    /** Drop what is typed. */
    | { kind: "cancel" };

/** The parts of a key press the grid reads. */
export interface CellKey {
    key: string;
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
}

/** Each arrow's move, and with Ctrl or Cmd its jump to the edge of the data. */
const ARROWS: Readonly<Record<string, readonly [GridCellSelectionMove, GridCellSelectionMove]>> = {
    ArrowLeft: ["left", "leftEnd"],
    ArrowRight: ["right", "rightEnd"],
    ArrowUp: ["up", "upEnd"],
    ArrowDown: ["down", "downEnd"],
};

/** The move an arrow `key` makes, jumping with `jump`; `null` for any other
 *  key. */
function arrowMove(key: string, jump: boolean): GridCellSelectionMove | null {
    const moves = ARROWS[key];
    return moves ? moves[jump ? 1 : 0] : null;
}

/**
 * What `ev` does on a workbook's grid whose active cell is being typed into in
 * `entry` mode, or isn't (`null`); `editable` where the mode edits. `null` for
 * a key the grid leaves to everything else — a shortcut, a typed character,
 * a caret move in Edit mode.
 */
export function cellKeyAction(ev: CellKey, entry: CellEntryMode | null, editable: boolean): CellKeyAction | null {
    const jump = ev.ctrlKey || ev.metaKey;
    const arrow = arrowMove(ev.key, jump);
    if (entry !== null) {
        switch (ev.key) {
            case "Enter":
                if (ev.altKey) return { kind: "lineBreak" };
                if (jump) return { kind: "commit", fill: true, then: null };
                return { kind: "commit", fill: false, then: ev.shiftKey ? "up" : "down" };
            case "Tab":
                return { kind: "commit", fill: false, then: ev.shiftKey ? "left" : "right" };
            case "Escape":
                return { kind: "cancel" };
            case "F2":
                return { kind: "switchMode" };
        }
        return arrow && entry === "enter" ? { kind: "commit", fill: false, then: arrow } : null;
    }
    if (arrow) return { kind: "move", movement: arrow, extend: ev.shiftKey };
    if (jump || ev.altKey) return null;
    switch (ev.key) {
        case "Enter":
            return { kind: "move", movement: ev.shiftKey ? "up" : "down", extend: false };
        case "Tab":
            return { kind: "move", movement: ev.shiftKey ? "left" : "right", extend: false };
    }
    if (!editable) return null;
    switch (ev.key) {
        case "F2":
            return { kind: "begin", mode: "edit", text: null };
        case "Backspace":
            return { kind: "begin", mode: "enter", text: "" };
        case "Delete":
            return { kind: "clear" };
    }
    return null;
}
