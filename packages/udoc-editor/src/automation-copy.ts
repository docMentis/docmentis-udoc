// A template's filled copy, which Preview shows and Generate saves: the template's
// bytes, opened in a document UI of its own with a worker of its own, and filled
// there with Apply Data, so the template and its editor are left alone — or, for
// a template opened with `openRemote`, a copy the udoc server keeping it filled,
// opened from where it is kept.
import { createAs, deleteRemoteDocument, remoteInstance } from "@docmentis/udoc-ui/internal";
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

/** A copy of a template the udoc server keeping it filled, kept there as a
 *  document of its own. */
export interface ServerCopy {
    /** The copy's package URL. */
    url: string;
    /** Delete the copy where it is kept. */
    close(): void;
}

/**
 * A copy the server filled, kept at the package URL `url`, opened in a document
 * UI of its own as {@link filledCopy} opens its own, and streamed from where it
 * is kept. The caller destroys it.
 */
export async function openedCopy(url: string, container: HTMLElement, options: UDocEditorOptions): Promise<UIShell> {
    const shell = await createAs(
        container,
        { ...options, showToolbar: false, showLeftPanel: false, showRightPanel: false },
        EDITOR_WRAPPER,
        startRenderWorker,
        () => null,
        (created) => created,
    );
    try {
        await shell.openRemote(url);
    } catch (error) {
        shell.destroy();
        throw error;
    }
    return shell;
}

/**
 * A copy of the template the server keeps at `packageUrl` filled with `data` on
 * that server, as a document of its own, which closing deletes there.
 */
export async function serverCopy(packageUrl: string, data: BindingData): Promise<ServerCopy> {
    const url = await remoteInstance(packageUrl, data);
    return {
        url,
        close: () => {
            deleteRemoteDocument(url).catch((error: unknown) => {
                console.error("udoc: the filled copy couldn't be deleted", error);
            });
        },
    };
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
