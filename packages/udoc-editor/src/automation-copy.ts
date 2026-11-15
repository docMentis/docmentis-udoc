// A template's filled copy, which Preview shows and Generate saves: the template's
// bytes, opened in a document UI of its own with a worker of its own, and filled
// there with Apply Data, so the template and its editor are left alone.
import { createAs } from "@docmentis/udoc-ui/internal";
import type { UIShell } from "@docmentis/udoc-ui/internal";
import type { BindingData, FileFormat } from "@docmentis/udoc-wasm";
import type { UDocEditorOptions } from "./editor.js";
import { startRenderWorker } from "./worker/worker-source.js";
import { EDITOR_WRAPPER } from "./wrapper.js";

/**
 * `bytes`, a template saved as it is now, opened in a document UI of its own —
 * mounted into `container`, without its chrome, or headless with `null` — under
 * an editor's `options`, and filled with `data`. The caller destroys it.
 */
export async function filledCopy(
    bytes: Uint8Array,
    container: HTMLElement | null,
    options: UDocEditorOptions,
    data: BindingData,
): Promise<UIShell> {
    const shell = await createAs(
        container,
        { ...options, showToolbar: false, showLeftPanel: false, showRightPanel: false },
        EDITOR_WRAPPER,
        startRenderWorker,
        () => null,
        (created) => created,
    );
    try {
        await shell.openSource(bytes);
        await shell.execute({ automation: { applyData: { data } } });
    } catch (error) {
        shell.destroy();
        throw error;
    }
    return shell;
}

/** The format an instance of a template opened as `source` is saved as: its
 *  own, a PowerPoint template's as a presentation. */
export function instanceFormat(source: FileFormat): FileFormat {
    switch (source) {
        case "potx":
            return "pptx";
        case "potm":
            return "pptm";
        default:
            return source;
    }
}

/** The file name a copy of `filename`, the template's, takes, `kind` in
 *  brackets after its own name — "Deck (preview).pptx" — as `format`. */
export function copyName(filename: string | undefined, kind: string, format: FileFormat): string {
    const name = filename?.replace(/\.[^./\\]*$/, "") ?? "document";
    return `${name} (${kind}).${format}`;
}

/** Hand `bytes` to the browser as a download named `filename`. */
export function downloadBytes(bytes: Uint8Array, filename: string): void {
    const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/octet-stream" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    // Revoked once the click has started the download, not under it.
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
