// The keys that move through a document, as a PDF reader takes them: what a key
// pressed while the document has the keyboard does to the view.
//
// An arrow scrolls a line, Page Up and Page Down a view's height, as do Shift
// with Space and Space, and Home and End go to the first and last page. A
// workbook's grid keeps the arrows, Home, End and Space, and a live caret keeps
// them too, so only the page keys act there. With Ctrl, Cmd or Alt a key is a
// shortcut, and Shift with anything but Space is a selection's.

/** What a key does to the view. */
export type ScrollKeyAction =
    /** Scroll along `axis` by a line or a view's length, forward where `by` is 1. */
    | { kind: "scroll"; axis: "x" | "y"; step: "line" | "view"; by: 1 | -1 }
    /** Go to the first or the last page. */
    | { kind: "edge"; page: "first" | "last" };

/** The parts of a key press the view reads. */
export interface ScrollKey {
    key: string;
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
}

/** What the document is doing with its keys. */
export interface ScrollKeyContext {
    /** A workbook's grid is showing. */
    grid: boolean;
    /** A caret is live, so that a key types or moves it. */
    typing: boolean;
}

/** What `ev` does in `context`; `null` for a key the view leaves to everything else. */
export function scrollKeyAction(ev: ScrollKey, context: ScrollKeyContext): ScrollKeyAction | null {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return null;
    const keptByDocument = context.grid || context.typing;
    if (ev.key === " ") {
        return keptByDocument ? null : { kind: "scroll", axis: "y", step: "view", by: ev.shiftKey ? -1 : 1 };
    }
    if (ev.shiftKey) return null;
    switch (ev.key) {
        case "PageDown":
            return { kind: "scroll", axis: "y", step: "view", by: 1 };
        case "PageUp":
            return { kind: "scroll", axis: "y", step: "view", by: -1 };
    }
    if (keptByDocument) return null;
    switch (ev.key) {
        case "ArrowDown":
            return { kind: "scroll", axis: "y", step: "line", by: 1 };
        case "ArrowUp":
            return { kind: "scroll", axis: "y", step: "line", by: -1 };
        case "ArrowRight":
            return { kind: "scroll", axis: "x", step: "line", by: 1 };
        case "ArrowLeft":
            return { kind: "scroll", axis: "x", step: "line", by: -1 };
        case "Home":
            return { kind: "edge", page: "first" };
        case "End":
            return { kind: "edge", page: "last" };
    }
    return null;
}
