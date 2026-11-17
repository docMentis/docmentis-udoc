// A template's Generate, from its Automation tab: the Generate dialog, seeded with
// the template's sample data, every value it lacks made up, which fills a copy
// of the template with the data the author gives and downloads it — an instance,
// the template left as it is. An instance's Refresh opens the same dialog, on
// the data the instance was last filled with — or, where it keeps none, data
// its places make up — and fills the instance again where it is.
import { filledDataOf } from "@docmentis/udoc-ui/internal";
import type { BindingData } from "@docmentis/udoc-wasm";
import { copyName, downloadBytes, filledCopy, instanceFormat } from "./automation-copy.js";
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
     *  with, or data its places make up, which fills the instance again in
     *  place, one undo step. */
    refresh(): Promise<void>;
    destroy(): void;
}

/** Fill a copy of the template `host` holds with `data`, under an editor's
 *  `options`, and download it as an instance: "Deck (generated).pptx". */
async function generate(host: EditHost, options: UDocEditorOptions, data: BindingData): Promise<void> {
    const format = templateFormat(host);
    const copy = await filledCopy(await host.client.saveToBytes(format), null, options, data);
    try {
        const instance = instanceFormat(format);
        downloadBytes(await copy.saveToBytes({ format: instance }), copyName(host.filename(), "generated", instance));
    } finally {
        copy.destroy();
    }
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
            const data = filledDataOf(host.store.getState().automation) ?? previewData(host);
            modal.open({
                action: "command.refresh",
                json: JSON.stringify(data, null, 2),
                onGenerate: (chosen) =>
                    host.commit(() => host.client.execute({ automation: { applyData: { data: chosen } } })),
            });
        },
        destroy: () => modal.destroy(),
    };
}
