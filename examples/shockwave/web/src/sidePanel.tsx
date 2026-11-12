// The side panel beside a document, in its card: shown, or hidden, as this
// browser remembers.
import { useState } from "react";

import { PanelRightIcon } from "./icons";

const PANEL_KEY = "shockwave.file.panel";

/** Whether the side panel is shown: unless this browser hid it. */
function savedPanel(): boolean {
    try {
        return localStorage.getItem(PANEL_KEY) !== "folded";
    } catch {
        return true;
    }
}

/**
 * Whether the side panel is shown, `show` to show or hide it, and `toggle`, the
 * icon button that does, for the card's title bar. The panel has the id
 * `document-panel`.
 */
export function useSidePanel() {
    const [open, setOpen] = useState(savedPanel);

    function show(next: boolean) {
        setOpen(next);
        try {
            localStorage.setItem(PANEL_KEY, next ? "open" : "folded");
        } catch {
            // Kept for this visit alone.
        }
    }

    const toggle = (
        <button
            type="button"
            className="icon-button"
            aria-label={open ? "Hide the side panel" : "Show the side panel"}
            aria-expanded={open}
            aria-controls="document-panel"
            onClick={() => show(!open)}
        >
            <PanelRightIcon />
        </button>
    );

    return { open, show, toggle };
}
