// Public API — the common surface every docMentis document UI shares, and the
// viewer's class. A viewer only views: it opens in view mode, its only one,
// under the viewer's own name. It may annotate, fill in forms and follow a
// collaboration, as its license or permit allows.
import { UDocBase } from "@docmentis/udoc-ui";
import type { LocalCollaborationServiceOptions, UDocOptions } from "@docmentis/udoc-ui";
import { createAs, startLocalCollaborationService } from "@docmentis/udoc-ui/internal";
import type { UIShell, Wrapper } from "@docmentis/udoc-ui/internal";
import { WRAPPER_VERSION } from "./version.js";
import { startRenderWorker } from "./worker/worker-source.js";

export * from "@docmentis/udoc-ui";

/** This package, as the wrapper it reports to the engine. */
const VIEWER_WRAPPER: Wrapper = { name: "udoc-viewer", version: WRAPPER_VERSION };

/** Options for {@link UDocViewer.create}. Every field is optional; each says its default. */
export type UDocViewerOptions = UDocOptions;

/**
 * The document viewer — construct it with {@link UDocViewer.create} and drive
 * it with `open` / `close` / `destroy`.
 */
export class UDocViewer extends UDocBase {
    /** This package's version, from its `package.json`. */
    static readonly version: string = WRAPPER_VERSION;

    private constructor(shell: UIShell) {
        super(shell);
    }

    /**
     * Create a viewer mounted into `container`. Spawns the render worker and
     * loads the WASM (async), then mounts the UI. Rejects with an
     * `unsupported` `UDocError` on runtimes without OffscreenCanvas-in-worker
     * support.
     */
    static create(container: HTMLElement, options: UDocViewerOptions = {}): Promise<UDocViewer> {
        return createAs(container, options, VIEWER_WRAPPER, startRenderWorker, null, (shell) => new UDocViewer(shell));
    }

    /**
     * Start a local collaboration service on the document in `bytes`, and
     * resolve with its id — the page's own udoc server for one document, for
     * viewers in this page to {@link openLocal} and
     * {@link joinLocalCollaboration}.
     *
     * Viewers that each {@link open} the same bytes can't collaborate: a
     * document's ids are minted as its parts load, so two that load them in a
     * different order hold different ids for the same content. The service
     * imports the document once, in a worker of its own, and keeps its udoc
     * package, which every viewer opening it shares; then it serves their
     * collaboration, as udoc-server serves one for a document it keeps. It ends
     * when the last viewer joined to it leaves.
     *
     * Its session is started as a viewer's is, under `options`: it rejects
     * when the license refuses it.
     */
    static startLocalCollaborationService(
        bytes: Uint8Array,
        options: LocalCollaborationServiceOptions = {},
    ): Promise<string> {
        return startLocalCollaborationService(bytes, options, VIEWER_WRAPPER);
    }
}
