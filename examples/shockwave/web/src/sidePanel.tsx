// The side panel beside a document: open, or folded to a strip, as this browser
// remembers.
import { useState } from "react";

import { PanelRightIcon } from "./icons";

const PANEL_KEY = "shockwave.file.panel";

/** Whether the side panel is open: unless this browser folded it. */
function savedPanel(): boolean {
    try {
        return localStorage.getItem(PANEL_KEY) !== "folded";
    } catch {
        return true;
    }
}

/**
 * Whether the side panel is open, `show` to open or fold it, and `toggle`, the
 * button that does, for its top right, open or folded. The panel's open form has
 * the id `document-panel`.
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
            aria-label={open ? "Fold the side panel" : "Unfold the side panel"}
            aria-expanded={open}
            aria-controls="document-panel"
            onClick={() => show(!open)}
        >
            <PanelRightIcon />
        </button>
    );

    return { open, show, toggle };
}
