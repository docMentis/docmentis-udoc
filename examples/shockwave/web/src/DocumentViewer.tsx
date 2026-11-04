// A viewer filling its element, on a document: a file from the user's own disk,
// opened in the browser before it's uploaded; one udoc-server keeps, opened
// part by part through the gate with the session's cookie; or a sample at a
// URL. Made as the react-vite example makes one, StrictMode's second effect
// run included. It is in the app's theme, and in the workspace's viewer
// colors (Settings, Brand; app.css), and follows both as they change.
import { useEffect, useRef } from "react";
import { UDocViewer } from "@docmentis/udoc-viewer";

import { DEFAULT_VIEWER_COLORS } from "../../shared/api.ts";
import { useSession } from "./session";
import { useTheme } from "./theme";

/** What the viewer opens: a file's own bytes, the id of a document udoc-server keeps, or a document at a URL. */
export type ViewerSource =
    | { file: File; documentId?: never; url?: never }
    | { documentId: string; file?: never; url?: never }
    | { url: string; file?: never; documentId?: never };

/** What a viewer opened: its format, and how long it took from the viewer's making. */
export interface Opened {
    format: string | null;
    ms: number;
}

/**
 * A viewer on `source`, with its top toolbar unless `showToolbar` is false;
 * `onOpened` hears when it's open, `onClosed` when it closes, opened, and
 * `onFailed` when it doesn't open, which the viewer shows itself.
 */
export function DocumentViewer({
    showToolbar = true,
    onOpened,
    onClosed,
    onFailed,
    ...source
}: ViewerSource & {
    showToolbar?: boolean;
    onOpened?: (opened: Opened) => void;
    onClosed?: () => void;
    onFailed?: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<UDocViewer>(undefined);
    const theme = useTheme();
    const themeRef = useRef(theme);
    themeRef.current = theme;
    const colors = useSession().user?.tenant.viewerColors ?? DEFAULT_VIEWER_COLORS;
    const opened = useRef(onOpened);
    opened.current = onOpened;
    const closed = useRef(onClosed);
    closed.current = onClosed;
    const failed = useRef(onFailed);
    failed.current = onFailed;
    const { file, documentId, url } = source;
    useEffect(() => {
        let viewer: UDocViewer | undefined;
        // An effect that is cleaned up before `create` resolves, as StrictMode's
        // first run is, destroys the viewer it made.
        let gone = false;
        let open = false;
        const started = performance.now();
        UDocViewer.create(ref.current!, { showToolbar, theme: themeRef.current })
            .then(async (created) => {
                if (gone) return created.destroy();
                viewer = created;
                viewerRef.current = created;
                if (file) await viewer.open(file);
                else if (url) await viewer.open(url);
                else await viewer.openRemote(new URL(`/udoc/documents/${documentId}/package`, location.href).href);
                if (gone) return;
                open = true;
                opened.current?.({ format: viewer.sourceFormat, ms: performance.now() - started });
            })
            .catch((error: unknown) => {
                if (gone) return;
                console.error("The viewer didn't open the document:", error);
                failed.current?.();
            });
        return () => {
            gone = true;
            viewerRef.current = undefined;
            viewer?.destroy();
            if (open) closed.current?.();
        };
    }, [file, documentId, url, showToolbar]);

    useEffect(() => viewerRef.current?.setTheme(theme), [theme]);

    // The viewer hands the background under its pages to the engine, which
    // paints it, only as it applies a theme (GAPS.md): so, the background
    // changed, it applies one that looks the same, the system's or the one
    // the system shows, and its own again, a microtask apart.
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer) return;
        const chosen = themeRef.current;
        const shown = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        viewer.setTheme(chosen === "system" ? shown : "system");
        queueMicrotask(() => viewer.setTheme(chosen));
    }, [colors.background]);

    return (
        <div
            ref={ref}
            className="viewer"
            data-toolbar={colors.toolbar}
            data-background={colors.background}
            data-primary={colors.primary}
        />
    );
}
