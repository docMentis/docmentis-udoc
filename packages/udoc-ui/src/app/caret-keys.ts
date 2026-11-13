// Which caret move a key asks for at a live text caret.
//
// The arrows step a character or a line, Home and End go to the line's start
// and end. The word, paragraph and story moves take a modifier, the one each
// platform's own text fields use: on a Mac, Option with an arrow steps by word
// or paragraph, and Cmd with an arrow goes to the line's or the text's start
// or end; elsewhere Ctrl with an arrow steps by word or paragraph, and Ctrl
// with Home or End goes to the text's start or end. Every move is in the
// text's order, whichever way its lines run. Shift extends the selection, a
// thing of the caller's.

import type { TextCaretMove } from "../geometry.js";

/** The modifier keys of a key press, and which key it is. */
export interface CaretKeyPress {
    key: string;
    ctrlKey: boolean;
    altKey: boolean;
    metaKey: boolean;
}

const PLAIN: Record<string, TextCaretMove> = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
    Home: "lineStart",
    End: "lineEnd",
};

const BY_WORD_OR_PARAGRAPH: Record<string, TextCaretMove> = {
    ArrowLeft: "wordStart",
    ArrowRight: "wordEnd",
    ArrowUp: "paragraphStart",
    ArrowDown: "paragraphEnd",
};

const MAC_TO_EDGES: Record<string, TextCaretMove> = {
    ArrowLeft: "lineStart",
    ArrowRight: "lineEnd",
    ArrowUp: "storyStart",
    ArrowDown: "storyEnd",
};

const CTRL: Record<string, TextCaretMove> = {
    ...BY_WORD_OR_PARAGRAPH,
    Home: "storyStart",
    End: "storyEnd",
};

/** The caret move `press` asks for on a Mac (`mac`) or elsewhere, or `null`
 *  for a key that moves no caret — a shortcut, or a modifier the platform
 *  keeps for itself, as a Mac keeps Ctrl with an arrow. Alt alone, outside a
 *  Mac, moves as the bare key does. */
export function caretKeyMove(press: CaretKeyPress, mac: boolean): TextCaretMove | null {
    const { key, ctrlKey, altKey, metaKey } = press;
    if (mac) {
        if (ctrlKey) return null;
        if (metaKey) return altKey ? null : (MAC_TO_EDGES[key] ?? null);
        return (altKey ? BY_WORD_OR_PARAGRAPH[key] : PLAIN[key]) ?? null;
    }
    if (metaKey) return null;
    return (ctrlKey ? CTRL[key] : PLAIN[key]) ?? null;
}
