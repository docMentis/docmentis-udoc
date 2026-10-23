// Editor theme. The light/dark control in the demo header toggles only the
// *editor's* theme — `main.ts` mirrors each change into the editor(s) via
// `UDocEditor.setTheme` so the editor UI and its engine-painted backdrop follow
// along. The demo's own chrome is deliberately not themed here: it stays light
// regardless of this setting or the system preference.

export type Theme = "light" | "dark";

const STORAGE_KEY = "udoc-editor-theme";

export function getTheme(): Theme {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
    // Default to light — the editor doesn't follow the OS dark-mode preference;
    // the user opts into dark via the header toggle (persisted above).
    return "light";
}

/** Flip the current editor theme and persist it. Returns the new value. */
export function toggleTheme(): Theme {
    const next: Theme = getTheme() === "dark" ? "light" : "dark";
    localStorage.setItem(STORAGE_KEY, next);
    return next;
}
