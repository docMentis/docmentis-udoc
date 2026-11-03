// A viewer filling its element, on a document: a file from the user's own disk,
// opened in the browser before it's uploaded, or one udoc-server keeps, opened
// part by part through the gate with the session's cookie. Made as the
// react-vite example makes one, StrictMode's second effect run included.
import { useEffect, useRef } from "react";
import { UDocViewer } from "@docmentis/udoc-viewer";

/** What the viewer opens: a file's own bytes, or the id of a document udoc-server keeps. */
export type ViewerSource = { file: File; documentId?: never } | { documentId: string; file?: never };

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
    const opened = useRef(onOpened);
    opened.current = onOpened;
    const closed = useRef(onClosed);
    closed.current = onClosed;
    const failed = useRef(onFailed);
    failed.current = onFailed;
    const { file, documentId } = source;
    useEffect(() => {
        let viewer: UDocViewer | undefined;
        // An effect that is cleaned up before `create` resolves, as StrictMode's
        // first run is, destroys the viewer it made.
        let gone = false;
        let open = false;
        const started = performance.now();
        UDocViewer.create(ref.current!, { showToolbar })
            .then(async (created) => {
                if (gone) return created.destroy();
                viewer = created;
                if (file) await viewer.open(file);
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
            viewer?.destroy();
            if (open) closed.current?.();
        };
    }, [file, documentId, showToolbar]);
    return <div ref={ref} className="viewer" />;
}
