// A template's preview, which the Automation tab's Preview turns on and off: the
// template copied, filled with its sample data and shown read-only over the
// document's body, in place of the template, until it's turned off.
//
// The copy is filled with the template's sample data as the Data panel shows
// it. The udoc server keeping a template opened with `openRemote` fills it
// there, as a document of its own it deletes once the preview goes; a template
// opened from its bytes is saved as it is now and filled in a document UI of its
// own (automation-copy.ts). It opens at the page the template shows. While it's
// shown it stands in the template's place: the toolbar's Download and Print act
// on it — what is downloaded or printed is what is seen — the ribbon shows the
// Automation tab alone, every command but Preview's is disabled, and the Data
// panel is read only. The preview is made anew
// each time it's turned on, and gone when it's turned off, when the deck stops
// being a template, or in view mode.
import { sampleDataOf, subscribeSelector } from "@docmentis/udoc-ui/internal";
import type { UIShell } from "@docmentis/udoc-ui/internal";
import type { BindingData, FileFormat } from "@docmentis/udoc-wasm";
import { copyName, downloadBytes, filledCopy, instanceFormat, openedCopy, serverCopy } from "./automation-copy.js";
import type { EditHost } from "./edit-client.js";
import type { UDocEditorOptions } from "./editor.js";
import { editState, updateEditState } from "./state.js";

/** A template's preview, turned on and off. */
export interface AutomationPreview {
    /** Turn the preview on, or off where it's on or on its way. */
    toggle(host: EditHost): void;
}

/** A shown preview: its document UI, what holds it, what it watches to go,
 *  and what deletes a copy the server filled. */
interface Shown {
    shell: UIShell;
    overlay: HTMLElement;
    unsubscribe: () => void;
    release?: (() => void) | undefined;
}

/** The format the open template is saved as to copy it. */
export function templateFormat(host: EditHost): FileFormat {
    return (host.store.getState().sourceFormat as FileFormat | null) ?? "pptx";
}

/** The template's sample data, as the Data panel shows it: what a preview
 *  fills the template with, and Generate offers first. A value it lacks is
 *  filled as Generate fills it, made up nowhere. */
export function previewData(host: EditHost): BindingData {
    return sampleDataOf(host.store.getState().automation) ?? {};
}

/** A template preview for an editor made with `options`, whose license, look
 *  and language the preview's document UI takes, with none of its chrome. */
export function createAutomationPreview(options: UDocEditorOptions): AutomationPreview {
    let shown: Shown | null = null;
    // Each turn on, counted, so one turned off on its way stops where it is.
    let turn = 0;

    function wanted(host: EditHost, at: number): boolean {
        return at === turn && editState(host.store.getState()).automationPreview;
    }

    function close(host: EditHost): void {
        turn++;
        if (shown) {
            host.setStandIn(null);
            shown.unsubscribe();
            shown.shell.destroy();
            shown.overlay.remove();
            shown.release?.();
            shown = null;
        }
        if (editState(host.store.getState()).automationPreview) {
            updateEditState(host.store, { automationPreview: false });
        }
    }

    async function open(host: EditHost): Promise<void> {
        const at = ++turn;
        updateEditState(host.store, { automationPreview: true });
        const format = templateFormat(host);
        const data = previewData(host);
        // Filled by the server keeping the template, where it's kept there.
        const remote = host.remotePackage();
        const copy = remote !== undefined ? await serverCopy(remote, data) : undefined;
        const bytes = copy ? undefined : await host.client.saveToBytes(format);
        if (!wanted(host, at)) {
            copy?.close();
            return;
        }
        const body = host.root.querySelector<HTMLElement>(".udoc-body-slot") ?? host.root;
        const overlay = document.createElement("div");
        overlay.className = "udoc-automation-preview";
        body.append(overlay);
        let shell: UIShell;
        try {
            shell = copy
                ? await openedCopy(copy.url, overlay, options)
                : await filledCopy(bytes!, overlay, options, data);
        } catch (error) {
            overlay.remove();
            copy?.close();
            throw error;
        }
        // Open at the page the template shows.
        shell.dispatch({ type: "NAVIGATE_TO_PAGE", pageIndex: host.store.getState().pageIndex });
        // Gone with the template, or in view mode.
        const unsubscribe = subscribeSelector(
            host.store,
            (s) => s.mode !== "view" && s.automation !== null && "template" in s.automation.role,
            (template) => {
                if (!template) close(host);
            },
        );
        shown = { shell, overlay, unsubscribe, release: copy?.close };
        if (!wanted(host, at)) {
            close(host);
            return;
        }
        const instance = instanceFormat(format);
        host.setStandIn({
            // A copy kept elsewhere is saved where it is kept.
            download: async () =>
                downloadBytes(
                    copy
                        ? await shell.requestRemoteCopy({ format: instance })
                        : await shell.saveToBytes({ format: instance }),
                    copyName(host.filename(), "preview", instance),
                ),
            print: () => shell.print(),
        });
    }

    return {
        toggle(host) {
            if (editState(host.store.getState()).automationPreview) {
                close(host);
                return;
            }
            open(host).catch((error: unknown) => {
                close(host);
                console.error("udoc: the template preview failed", error);
            });
        },
    };
}
