// A template's preview, which the Automation tab's Preview turns on and off: the
// template copied, filled with its sample data and shown read-only over the
// document's body, in place of the template, until it's turned off.
//
// The copy is the template saved as it is now and opened in a document UI of its
// own, with a worker of its own, so filling it leaves the template and its
// editor alone; Apply Data fills it, with the template's sample data, every value
// it lacks made up from the schema its bindings make. The preview is made anew
// each time it's turned on, and gone when it's turned off, when the deck stops
// being a template, or when edit mode is left.
import { completedSample, createAs, subscribeSelector } from "@docmentis/udoc-ui/internal";
import type { UIShell } from "@docmentis/udoc-ui/internal";
import type { BindingData } from "@docmentis/udoc-wasm";
import type { EditHost } from "./edit-client.js";
import type { UDocEditorOptions } from "./editor.js";
import { editState, updateEditState } from "./state.js";
import { startRenderWorker } from "./worker/worker-source.js";
import { EDITOR_WRAPPER } from "./wrapper.js";

/** A template's preview, turned on and off. */
export interface AutomationPreview {
    /** Turn the preview on, or off where it's on or on its way. */
    toggle(host: EditHost): void;
}

/** The preview a shown preview is: its document UI, what holds it, and what
 *  it watches to go. */
interface Shown {
    shell: UIShell;
    overlay: HTMLElement;
    unsubscribe: () => void;
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
            shown.unsubscribe();
            shown.shell.destroy();
            shown.overlay.remove();
            shown = null;
        }
        if (editState(host.store.getState()).automationPreview) {
            updateEditState(host.store, { automationPreview: false });
        }
    }

    async function open(host: EditHost): Promise<void> {
        const at = ++turn;
        updateEditState(host.store, { automationPreview: true });
        const [bindings, bytes] = await Promise.all([
            host.client.presentation.automationBindings(),
            host.client.saveToBytes("pptx"),
        ]);
        if (!wanted(host, at)) return;
        const sample = host.store.getState().automation?.sampleData;
        const data: BindingData = bindings ? completedSample(sample, bindings.schema) : (sample ?? {});
        const body = host.root.querySelector<HTMLElement>(".udoc-body-slot") ?? host.root;
        const overlay = document.createElement("div");
        overlay.className = "udoc-automation-preview";
        body.append(overlay);
        const shell = await createAs(
            overlay,
            { ...options, showToolbar: false, showLeftPanel: false, showRightPanel: false },
            EDITOR_WRAPPER,
            startRenderWorker,
            () => null,
            (created) => created,
        );
        // Gone with the template, or with edit mode.
        const unsubscribe = subscribeSelector(
            host.store,
            (s) => s.mode !== "view" && s.automation !== null && "template" in s.automation.role,
            (template) => {
                if (!template) close(host);
            },
        );
        shown = { shell, overlay, unsubscribe };
        if (!wanted(host, at)) {
            close(host);
            return;
        }
        await shell.openSource(bytes);
        await shell.execute({ automation: { applyData: { data } } });
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
