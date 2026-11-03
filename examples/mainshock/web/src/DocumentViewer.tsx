// A viewer filling its element, on a document: a file from the user's own disk,
// opened in the browser before it's uploaded, or one udoc-server keeps, opened
// part by part through the gate with the session's cookie. Made as the
// react-vite example makes one, StrictMode's second effect run included.
import { useEffect, useRef } from "react";
import { UDocViewer } from "@docmentis/udoc-viewer";

/** What the viewer opens: a file's own bytes, or the id of a document udoc-server keeps. */
export type ViewerSource = { file: File; documentId?: never } | { documentId: string; file?: never };

/** A viewer on `source`; `onFailed` hears when it doesn't open, which the viewer shows itself. */
export function DocumentViewer({ onFailed, ...source }: ViewerSource & { onFailed?: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    const failed = useRef(onFailed);
    failed.current = onFailed;
    const { file, documentId } = source;
    useEffect(() => {
        let viewer: UDocViewer | undefined;
        // An effect that is cleaned up before `create` resolves, as StrictMode's
        // first run is, destroys the viewer it made.
        let gone = false;
        UDocViewer.create(ref.current!)
            .then(async (created) => {
                if (gone) return created.destroy();
                viewer = created;
                if (file) await viewer.open(file);
                else await viewer.openRemote(new URL(`/udoc/documents/${documentId}/package`, location.href).href);
            })
            .catch((error: unknown) => {
                if (gone) return;
                console.error("The viewer didn't open the document:", error);
                failed.current?.();
            });
        return () => {
            gone = true;
            viewer?.destroy();
        };
    }, [file, documentId]);
    return <div ref={ref} className="viewer" />;
}
