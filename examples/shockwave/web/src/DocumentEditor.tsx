// An editor filling its element, on a document udoc-server keeps as it is now,
// joined to the collaboration that keeps its edits and shares them with anyone
// else editing it, through the gate with the session's cookie. Made as
// DocumentViewer makes a viewer, in the same theme and colors.
import { useEffect, useRef } from "react";
import { UDocEditor } from "@docmentis/udoc-editor";

import { useDocumentLook } from "./DocumentViewer";
import type { CollaborationState } from "./DocumentViewer";

/** How editing stands: its edits being kept, or, for a lost connection, not until it's back, or not at all. */
export type EditingState = CollaborationState;

/** An editor on document `documentId`, as `userName`; `onState` hears how editing stands as it changes, and `undefined` as it ends. */
export function DocumentEditor({
    documentId,
    userName,
    onState,
}: {
    documentId: string;
    userName: string;
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
        const path = `/udoc/documents/${documentId}`;
        UDocEditor.create(ref.current!, { theme: themeRef.current, allowedModes: ["edit"] })
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
    }, [documentId, userName, themeRef]);

    return <div ref={ref} className="viewer" {...attributes} />;
}
