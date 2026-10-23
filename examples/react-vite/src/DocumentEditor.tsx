import { useEffect, useRef } from "react";
import { UDocEditor } from "@docmentis/udoc-editor";

/** An editor filling its element, opening `src`. */
export function DocumentEditor({ src }: { src: string }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        let editor: UDocEditor | undefined;
        // An effect that is cleaned up before `create` resolves, as StrictMode's
        // first run is, destroys the editor it made.
        let gone = false;
        UDocEditor.create(ref.current!)
            .then(async (created) => {
                if (gone) return created.destroy();
                editor = created;
                await editor.open(src);
            })
            .catch((error: unknown) => console.error("The editor didn't open the document:", error));
        return () => {
            gone = true;
            editor?.destroy();
        };
    }, [src]);
    return <div ref={ref} className="pane" />;
}
