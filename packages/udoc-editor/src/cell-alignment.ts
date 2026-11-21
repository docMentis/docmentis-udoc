// The Format Cell Alignment dialog, mounted into edit mode: seeded from the
// active cell on each open, its OK sending one alignment edit of what changed.
import { sheetCellFormat } from "@docmentis/udoc-ui/internal";
import { cellAlignmentPatch, cellAlignmentSeed } from "./cell-alignment-edits.js";
import { createCellAlignmentModal } from "./components/CellAlignmentModal.js";
import type { EditHost } from "./edit-client.js";
import type { I18n } from "./i18n/index.js";
import { editState } from "./state.js";

/** The Format Cell Alignment dialog, mounted into a shell. */
export interface CellAlignment {
    /** Open the dialog on the active cell's alignment. */
    open(): void;
    destroy(): void;
}

/** Mount the Format Cell Alignment dialog into `host` — once, seeded from the
 *  active cell each open. Its OK sends one edit, of what changed. */
export function mountCellAlignment(host: EditHost, i18n: I18n): CellAlignment {
    const modal = createCellAlignmentModal(i18n);
    modal.mount(host.root);
    return {
        open() {
            const format = sheetCellFormat(editState(host.store.getState()).selectionProperties);
            if (!format) return;
            const seed = cellAlignmentSeed(format);
            modal.open(seed, (values) => {
                const alignment = cellAlignmentPatch(seed, values);
                if (!alignment) return;
                void host.commit(() =>
                    host.client.executeOnSelection({ family: "worksheet", kind: "patchCellAlignment", alignment }),
                );
            });
        },
        destroy: () => modal.destroy(),
    };
}
