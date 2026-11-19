// An editor filling its element, on a document udoc-server keeps, its working copy
// or a branch as it is now, joined to the collaboration that keeps its edits and
// shares them with anyone else editing it, through the gate with the session's
// cookie, in the modes the page allows it. Made as DocumentViewer makes a viewer,
// in the same theme and colors.
import { useEffect, useRef } from "react";
import { UDocEditor } from "@docmentis/udoc-editor";
import type { EditorMode } from "@docmentis/udoc-editor";

import { useDocumentLook } from "./DocumentViewer";

/** How editing stands: its edits being kept, or, for a lost connection, not until it's back, or not at all. */
export type EditingState = "joined" | "interrupted" | "failed";

/** Editing what's there: the working copy, or a review taken up. */
export const EDIT_MODES: readonly EditorMode[] = ["edit"];

/**
 * Reviewing: a Word document's edits, each a tracked change, in review mode, and
 * comments; any other document opens in view mode, to comment on, and a PDF's
 * annotations. Never edit mode, whose changes aren't tracked.
 */
export const REVIEW_MODES: readonly EditorMode[] = ["review", "view"];

/**
 * An editor on document `documentId`, its working copy or branch `branch`, as
 * `userName`, in `modes`, opening in the first of them the document is open to:
 * one of the constants here, since another array makes another editor.
 * `onState` hears how editing stands as it changes, and `undefined` as it ends.
 */
export function DocumentEditor({
    documentId,
    branch,
    userName,
    modes = EDIT_MODES,
    onState,
}: {
    documentId: string;
    branch?: string;
    userName: string;
    modes?: readonly EditorMode[];
    onState?: (state: EditingState | undefined) => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const editorRef = useRef<UDocEditor>(undefined);
    const { themeRef, attributes } = useDocumentLook(editorRef);
    const state = useRef(onState);
    state.current = onState;

    useEffect(() => {
        let editor: UDocEditor | undefined;
        // An effect that is cleaned up before `create` resolves, as StrictMode's
        // first run is, destroys the editor it made.
        let gone = false;
        const path = `/udoc/documents/${documentId}${branch ? `/branches/${branch}` : ""}`;
        UDocEditor.create(ref.current!, { theme: themeRef.current, allowedModes: modes, initialMode: modes[0] })
            .then(async (created) => {
                if (gone) return created.destroy();
                editor = created;
                editorRef.current = created;
                created.on("collaboration:joined", () => state.current?.("joined"));
                created.on("collaboration:interrupted", () => state.current?.("interrupted"));
                created.on("collaboration:failed", () => state.current?.("failed"));
                await created.openRemote(new URL(`${path}/package`, location.href).href);
                if (gone) return;
                created.joinRemoteCollaboration(new URL(`${path}/collaboration`, location.href).href, userName);
            })
            .catch((error: unknown) => {
                if (gone) return;
                console.error("The editor didn't open the document:", error);
                state.current?.("failed");
            });
        return () => {
            gone = true;
            editorRef.current = undefined;
            editor?.destroy();
            state.current?.(undefined);
        };
    }, [documentId, branch, userName, modes, themeRef]);

    return <div ref={ref} className="viewer" {...attributes} />;
}
