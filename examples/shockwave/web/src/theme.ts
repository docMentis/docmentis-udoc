// The app's theme, as the user chose it: the system's, light, or dark, kept in
// this browser. The root's data-theme says light or dark, for app.css's
// color scheme; the system's has none. index.html sets it before the page
// shows, so that it opens in the theme chosen. Switched to the one the system
// shows, it's the system's again, and follows it.
import { useSyncExternalStore } from "react";

export type Theme = "system" | "light" | "dark";

const KEY = "shockwave.theme";

function saved(): Theme {
    try {
        const theme = localStorage.getItem(KEY);
        if (theme === "light" || theme === "dark") return theme;
    } catch {
        // Not kept; the system's it is.
    }
    return "system";
}

let current = saved();
const listeners = new Set<() => void>();

/** Choose `theme`, keep it, and show it. */
export function chooseTheme(theme: Theme): void {
    current = theme;
    try {
        if (theme === "system") localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, theme);
    } catch {
        // Kept for this visit alone.
    }
    if (theme === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    for (const listener of listeners) listener();
}

/** The theme chosen, again as it changes. */
export function useTheme(): Theme {
    return useSyncExternalStore(
        (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        () => current,
    );
}

const systemDark = matchMedia("(prefers-color-scheme: dark)");

/** The theme shown, light or dark: the one chosen, or the system's; and switching it to the other. */
export function useShownTheme(): { shown: "light" | "dark"; switchTheme: () => void } {
    const theme = useTheme();
    const system = useSyncExternalStore(
        (listener) => {
            systemDark.addEventListener("change", listener);
            return () => systemDark.removeEventListener("change", listener);
        },
        () => (systemDark.matches ? "dark" : "light"),
    );
    const shown = theme === "system" ? system : theme;
    const other = shown === "dark" ? "light" : "dark";
    return { shown, switchTheme: () => chooseTheme(other === system ? "system" : other) };
}
