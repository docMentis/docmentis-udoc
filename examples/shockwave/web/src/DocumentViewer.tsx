// A viewer filling its element, on a document: a file from the user's own disk,
// opened in the browser before it's uploaded; one udoc-server keeps, its working
// copy or a branch as it is now, or one checkpoint, opened part by part through
// the gate with the session's cookie, and, to comment in a review, joined to the
// branch's collaboration; one on a frontstage, opened through the gate at the
// address a buyer's link gives; or a sample at a URL. Made as the react-vite example makes
// one, StrictMode's second effect run included. It is in the app's theme, and
// in the workspace's viewer colors (Settings, Brand; app.css), and follows both
// as they change.
import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { UDocViewer } from "@docmentis/udoc-viewer";

import { DEFAULT_VIEWER_COLORS } from "../../shared/api.ts";
import type { ViewerColors } from "../../shared/api.ts";
import { useSession } from "./session";
import { useTheme } from "./theme";
import type { Theme } from "./theme";

/**
 * What the viewer opens: a file's own bytes; the id of a document udoc-server
 * keeps, its working copy or branch `branch` as it is now, or, read-only, its
 * checkpoint `version`; a package at the path `packagePath`, read-only; or a
 * document at a URL.
 */
export type ViewerSource =
    | { file: File; documentId?: never; version?: never; branch?: never; packagePath?: never; url?: never }
    | { documentId: string; version?: number; branch?: never; file?: never; packagePath?: never; url?: never }
    | { documentId: string; branch: string; version?: never; file?: never; packagePath?: never; url?: never }
    | { packagePath: string; file?: never; documentId?: never; version?: never; branch?: never; url?: never }
    | { url: string; file?: never; documentId?: never; version?: never; branch?: never; packagePath?: never };

/** How a collaboration stands: its edits being kept, or, for a lost connection, not until it's back, or not at all. */
export type CollaborationState = "joined" | "interrupted" | "failed";

/** What a viewer opened: its format, and how long it took from the viewer's making. */
export interface Opened {
    format: string | null;
    ms: number;
}

/**
 * Keep `ui`, a viewer or an editor, in the app's theme and the workspace's
 * viewer colors, as both change: the theme to make it in, and the attributes
 * of the element it fills, by which app.css colors it: `given`, for one with no
 * one signed in to say them.
 */
export function useDocumentLook(ui: RefObject<{ setTheme(theme: Theme): void } | undefined>, given?: ViewerColors) {
    const theme = useTheme();
    const themeRef = useRef(theme);
    themeRef.current = theme;
    const session = useSession();
    const colors = given ?? session.user?.tenant.viewerColors ?? DEFAULT_VIEWER_COLORS;

    useEffect(() => ui.current?.setTheme(theme), [ui, theme]);

    // The viewer hands the background under its pages to the engine, which
    // paints it, only as it applies a theme (GAPS.md): so, the background
    // changed, it applies one that looks the same, the system's or the one
    // the system shows, and its own again, a microtask apart.
    useEffect(() => {
        const current = ui.current;
        if (!current) return;
        const chosen = themeRef.current;
        const shown = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        current.setTheme(chosen === "system" ? shown : "system");
        queueMicrotask(() => current.setTheme(chosen));
    }, [ui, colors.background]);

    return {
        themeRef,
        attributes: {
            "data-toolbar": colors.toolbar,
            "data-background": colors.background,
            "data-primary": colors.primary,
        },
    };
}

/**
 * A viewer on `source`, with its top toolbar unless `showToolbar` is false, and
 * its left and right side panels unless `showLeftPanel` or `showRightPanel` is,
 * in `colors`, for one with no one signed in to say them; when `readsOnly`, for a
 * buyer, with no download or print button, so that the source stays here; a
 * deck's notes and hidden slides still show (GAPS.md). With `collaborateAs`, a
 * kept document's working copy or branch is joined to its collaboration as that
 * name, and comments and annotations can be written, kept there; without, they
 * can't, since they'd go nowhere. `comments` hides the document's comments, for
 * those it isn't for. `onState` hears how the
 * collaboration stands as it changes. `onOpened` hears when it's open, `onClosed` when it closes,
 * opened, `onFailed` when it doesn't open, which the viewer shows itself, `onPages`
 * when other pages come on screen, those on it now, 0-based, a workbook's the
 * sheet shown, and `onSlideShow` when a slide show starts or ends.
 */
export function DocumentViewer({
    showToolbar = true,
    showLeftPanel = true,
    showRightPanel = true,
    colors,
    readsOnly = false,
    collaborateAs,
    comments,
    onState,
    onOpened,
    onClosed,
    onFailed,
    onPages,
    onSlideShow,
    ...source
}: ViewerSource & {
    showToolbar?: boolean;
    showLeftPanel?: boolean;
    showRightPanel?: boolean;
    colors?: ViewerColors;
    readsOnly?: boolean;
    collaborateAs?: string;
    comments?: "hidden";
    onState?: (state: CollaborationState | undefined) => void;
    onOpened?: (opened: Opened) => void;
    onClosed?: () => void;
    onFailed?: () => void;
    onPages?: (pages: readonly number[]) => void;
    onSlideShow?: (playing: boolean) => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<UDocViewer>(undefined);
    const { themeRef, attributes } = useDocumentLook(viewerRef, colors);
    const opened = useRef(onOpened);
    opened.current = onOpened;
    const closed = useRef(onClosed);
    closed.current = onClosed;
    const failed = useRef(onFailed);
    failed.current = onFailed;
    const seen = useRef(onPages);
    seen.current = onPages;
    const presenting = useRef(onSlideShow);
    presenting.current = onSlideShow;
    const state = useRef(onState);
    state.current = onState;
    const { file, documentId, version, branch, packagePath, url } = source;
    useEffect(() => {
        let viewer: UDocViewer | undefined;
        // An effect that is cleaned up before `create` resolves, as StrictMode's
        // first run is, destroys the viewer it made.
        let gone = false;
        let open = false;
        const started = performance.now();
        const allows = !readsOnly;
        // A kept document's own path: its working copy's, or a branch's.
        const kept = documentId && `/udoc/documents/${documentId}${branch ? `/branches/${branch}` : ""}`;
        const collaborates = kept !== undefined && version === undefined && collaborateAs !== undefined;
        UDocViewer.create(ref.current!, {
            showToolbar,
            showLeftPanel,
            showRightPanel,
            showDownloadButton: allows,
            showPrintButton: allows,
            enableAnnotation: collaborates,
            ...(comments === "hidden" && { showCommentsPanel: false, showCommentMarkup: false }),
            theme: themeRef.current,
        })
            .then(async (created) => {
                if (gone) return created.destroy();
                viewer = created;
                viewerRef.current = created;
                // A workbook's pages are its sheets' print pages; what's on screen is the sheet shown.
                created.on(
                    "visiblePages:changed",
                    ({ pages }) => created.docType !== "spreadsheet" && seen.current?.(pages),
                );
                created.on("currentSheet:changed", ({ sheet }) => seen.current?.(sheet >= 0 ? [sheet] : []));
                created.on("slideShow:changed", ({ playing }) => presenting.current?.(playing));
                created.on("collaboration:joined", () => state.current?.("joined"));
                created.on("collaboration:interrupted", () => state.current?.("interrupted"));
                created.on("collaboration:failed", () => state.current?.("failed"));
                if (file) await viewer.open(file);
                else if (url) await viewer.open(url);
                else {
                    const path =
                        packagePath ??
                        (version === undefined
                            ? `${kept}/package`
                            : `/udoc/documents/${documentId}/checkpoints/${version}/package`);
                    await viewer.openRemote(new URL(path, location.href).href);
                }
                if (gone) return;
                if (collaborates)
                    viewer.joinRemoteCollaboration(new URL(`${kept}/collaboration`, location.href).href, collaborateAs);
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
            if (collaborates) state.current?.(undefined);
            if (open) closed.current?.();
        };
    }, [
        file,
        documentId,
        version,
        branch,
        packagePath,
        url,
        showToolbar,
        showLeftPanel,
        showRightPanel,
        readsOnly,
        collaborateAs,
        comments,
        themeRef,
    ]);

    return <div ref={ref} className="viewer" {...attributes} />;
}
