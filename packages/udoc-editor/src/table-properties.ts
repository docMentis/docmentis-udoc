// The Table Properties dialog, mounted into edit mode: seeded from the selection's
// table on each open, its OK sending the edits of what changed.
import { createTablePropertiesModal } from "./components/TablePropertiesModal.js";
import type { EditHost } from "./edit-client.js";
import type { I18n } from "./i18n/index.js";
import { editState } from "./state.js";
import { tablePropertiesEdits, tablePropertiesSeed } from "./table-edits.js";
import { runTableEdit, selectionTable } from "./table-format.js";

/** The Table Properties dialog, mounted into a shell. */
export interface TableProperties {
    /** Open the dialog on the table the selection is in. */
    open(): void;
    destroy(): void;
}

/** Mount the Table Properties dialog into `host` — once, seeded from the
 *  selection each open. Its OK sends one edit per kind that changed, in turn. */
export function mountTableProperties(host: EditHost, i18n: I18n): TableProperties {
    const modal = createTablePropertiesModal(i18n);
    modal.mount(host.root);
    return {
        open() {
            const state = host.store.getState();
            const table = selectionTable(editState(state).selectionProperties);
            if (!table) return;
            const seed = tablePropertiesSeed(table, state.docType === "wordprocessing");
            modal.open(seed, async (values) => {
                for (const edit of tablePropertiesEdits(seed, values)) await runTableEdit(host, edit);
            });
        },
        destroy: () => modal.destroy(),
    };
}
