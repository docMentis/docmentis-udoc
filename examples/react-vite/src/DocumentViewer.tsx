import { useEffect, useRef } from "react";
import { UDocViewer } from "@docmentis/udoc-viewer";

/** A viewer filling its element, opening `src`. */
export function DocumentViewer({ src }: { src: string }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        let viewer: UDocViewer | undefined;
        // An effect that is cleaned up before `create` resolves, as StrictMode's
        // first run is, destroys the viewer it made.
        let gone = false;
        UDocViewer.create(ref.current!)
            .then(async (created) => {
                if (gone) return created.destroy();
                viewer = created;
                await viewer.open(src);
            })
            .catch((error: unknown) => console.error("The viewer didn't open the document:", error));
        return () => {
            gone = true;
            viewer?.destroy();
        };
    }, [src]);
    return <div ref={ref} className="pane" />;
}
