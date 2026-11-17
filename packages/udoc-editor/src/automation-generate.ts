// A template's Generate, from its Automation tab: the Generate dialog, seeded with
// the template's sample data, which fills a copy of the template with the data
// the author gives and downloads it — an instance, the template left as it is.
// An instance's Refresh opens the same dialog, on the data its Data panel
// holds — as changed there, else as the instance was last filled with — and
// fills the instance again where it is, the panel's changes then gone with it. The udoc server keeping a document opened with `openRemote` fills
// it there: a copy it saves for the download and deletes, or the instance
// itself, as an edit every editor of it gets.
import { deleteRemoteDocument, filledDataOf, remoteCopy, remoteFill } from "@docmentis/udoc-ui/internal";
import type { BindingData } from "@docmentis/udoc-wasm";
import { copyName, downloadBytes, filledCopy, instanceFormat, serverCopy } from "./automation-copy.js";
import { previewData, templateFormat } from "./automation-preview.js";
import { createGenerateModal } from "./components/GenerateModal.js";
import type { EditHost } from "./edit-client.js";
import type { UDocEditorOptions } from "./editor.js";
import type { I18n } from "./i18n/index.js";

/** The Generate dialog, mounted into a shell. */
export interface AutomationGenerate {
    /** Open the dialog on the template's sample data. */
    open(): Promise<void>;
    /** Open the dialog to refresh an instance: on the data it was last filled
     *  with, or none, which fills the instance again in place, one undo step. */
    refresh(): Promise<void>;
    destroy(): void;
}

/** Fill a copy of the template `host` holds with `data`, under an editor's
 *  `options`, and download it as an instance: "Deck (generated).pptx". */
async function generate(host: EditHost, options: UDocEditorOptions, data: BindingData): Promise<void> {
    const format = templateFormat(host);
    const instance = instanceFormat(format);
    const name = copyName(host.filename(), "generated", instance);
    const remote = host.remotePackage();
    if (remote !== undefined) {
        const { url } = await serverCopy(remote, data);
        try {
            downloadBytes(await remoteCopy(url, instance), name);
        } finally {
            await deleteRemoteDocument(url).catch((error: unknown) => {
                console.error("udoc: the generated copy couldn't be deleted", error);
            });
        }
        return;
    }
    const copy = await filledCopy(await host.client.saveToBytes(format), null, options, data);
    try {
        downloadBytes(await copy.saveToBytes({ format: instance }), name);
    } finally {
        copy.destroy();
    }
}

/** Fill the instance `host` holds again with `data`, one undo step — or have
 *  the udoc server keeping it fill it there. */
async function refreshInstance(host: EditHost, data: BindingData): Promise<void> {
    const remote = host.remotePackage();
    if (remote !== undefined) return remoteFill(remote, data);
    return host.commit(() => host.client.execute({ automation: { applyData: { data } } }));
}

/** Mount the Generate dialog into `host` — once, re-seeded with the template's
 *  sample data each open. */
export function mountGenerate(host: EditHost, i18n: I18n, options: UDocEditorOptions): AutomationGenerate {
    const modal = createGenerateModal(i18n);
    modal.mount(host.root);
    return {
        async open() {
            const data = previewData(host);
            modal.open({
                json: JSON.stringify(data, null, 2),
                onGenerate: (chosen) => generate(host, options, chosen),
            });
        },
        async refresh() {
            // The data the Data panel holds: as changed there, or as the
            // instance was last filled with.
            const state = host.store.getState();
            const data = state.dataDraft ?? filledDataOf(state.automation) ?? previewData(host);
            modal.open({
                action: "command.refresh",
                json: JSON.stringify(data, null, 2),
                onGenerate: async (chosen) => {
                    await refreshInstance(host, chosen);
                    host.store.dispatch({ type: "SET_DATA_DRAFT", data: null });
                },
            });
        },
        destroy: () => modal.destroy(),
    };
}
