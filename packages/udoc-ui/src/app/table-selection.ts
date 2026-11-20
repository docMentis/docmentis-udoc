// What Delete and Cut take out of a table, as Word and PowerPoint cut it,
// by the innermost `TableSelection`: `Cells` their text, `Rows` or `Columns`
// those tracks, `All` the table. Pure but for `deleteTableSelection`, which
// issues the one edit the selection calls for.
import type { ShapeSelection, TableSelection, TextSelection, UDocSelection, UDocType } from "@docmentis/udoc-wasm";
import { allowsTableEdit } from "../geometry.js";
import type { DocumentLayout, SelectionCapabilities } from "../geometry.js";
import type { WorkerClient } from "../worker/WorkerClient.js";

/** The innermost `TableSelection` of cells, rows, columns or the whole table
 *  that `selection` holds — through a caret in a cell, a table in a shape or a
 *  shape in text — or `null` where it holds none: a caret or a range of text,
 *  in a cell too, is none. */
export function innerTableSelection(selection: UDocSelection): TableSelection | null {
    if ("presentation" in selection) {
        const deck = selection.presentation;
        return typeof deck === "object" && "shapes" in deck ? inShapeSelection(deck.shapes.selection) : null;
    }
    if ("image" in selection) {
        const image = selection.image;
        return typeof image === "object" && "shapes" in image ? inShapeSelection(image.shapes.selection) : null;
    }
    if ("wordprocessing" in selection) {
        const word = selection.wordprocessing;
        if (typeof word !== "object") return null;
        if ("sectionText" in word) return inTextSelection(word.sectionText.selection);
        if ("headerText" in word) return inTextSelection(word.headerText.selection);
        if ("footerText" in word) return inTextSelection(word.footerText.selection);
    }
    return null;
}

function inShapeSelection(selection: ShapeSelection): TableSelection | null {
    if ("shapeTable" in selection) return inTableSelection(selection.shapeTable[1]);
    if ("shapeText" in selection) return inTextSelection(selection.shapeText[1]);
    return null;
}

function inTextSelection(selection: TextSelection): TableSelection | null {
    if ("table" in selection) return inTableSelection(selection.table.table);
    if ("drawing" in selection) return inShapeSelection(selection.drawing.shape);
    return null;
}

function inTableSelection(table: TableSelection): TableSelection | null {
    return "cellText" in table ? inTextSelection(table.cellText.text) : table;
}

/** The one position the innermost table `text` is in takes in its story, as a
 *  range over it — what a delete of that table deletes. `null` outside a table. */
export function tableSlotSelection(text: TextSelection): TextSelection | null {
    if (!("table" in text)) return null;
    const { story, offset, table } = text.table;
    // A table in a cell of this one is the innermost: descend through the cell.
    if ("cellText" in table) {
        const inner = tableSlotSelection(table.cellText.text);
        if (inner) return { table: { story, offset, table: { cellText: { ...table.cellText, text: inner } } } };
    }
    return { range: { story, anchor: { offset }, focus: { offset: offset + 1 } } };
}

/** A word document's selection with the table it is in selected as text — the
 *  body's, a header's or a footer's — or `null` where it isn't in one. */
export function wordTableSelection(selection: UDocSelection): UDocSelection | null {
    if (!("wordprocessing" in selection)) return null;
    const word = selection.wordprocessing;
    if (typeof word !== "object") return null;
    if ("sectionText" in word) {
        const slot = tableSlotSelection(word.sectionText.selection);
        return slot && { wordprocessing: { sectionText: { ...word.sectionText, selection: slot } } };
    }
    if ("headerText" in word) {
        const slot = tableSlotSelection(word.headerText.selection);
        return slot && { wordprocessing: { headerText: { ...word.headerText, selection: slot } } };
    }
    if ("footerText" in word) {
        const slot = tableSlotSelection(word.footerText.selection);
        return slot && { wordprocessing: { footerText: { ...word.footerText, selection: slot } } };
    }
    return null;
}

/** What a delete lends: the worker, the shell's committing wrapper, and the
 *  open document's type. */
export interface TableDeleteHost {
    client: WorkerClient;
    commit(run: () => Promise<DocumentLayout>): Promise<void>;
    docType: UDocType | null;
}

/**
 * Delete the table the selection is in. A deck's table is its frame, a shape
 * like any other, so it goes as the selected shape does. A word document's
 * takes one position in its story, so that position is selected and deleted as
 * text — the paragraphs either side stay apart, as a table's own position is
 * all a delete of it covers.
 */
export async function deleteTable({ client, commit, docType }: TableDeleteHost): Promise<void> {
    if (docType === "wordprocessing") {
        const selection = await client.selection();
        const slot = selection && wordTableSelection(selection);
        if (!slot) return;
        client.setSelection(slot);
        await commit(() => client.executeOnSelection({ kind: "deleteText", forward: true }));
        return;
    }
    await commit(() => client.executeOnSelection({ kind: "deleteShapes" }));
}

/**
 * Delete what the innermost `TableSelection` selects, as Delete and Cut take
 * it: `Cells` lose their text, `Rows` or `Columns` go — the table where they
 * are all of it, since a table with none is no table — and `All` takes the
 * table. `capabilities` are the selection's, which say whether its rows or
 * columns may go.
 */
export async function deleteTableSelection(host: TableDeleteHost, capabilities: SelectionCapabilities): Promise<void> {
    const selection = await host.client.selection();
    const table = selection && innerTableSelection(selection);
    if (!table) return;
    const { client, commit } = host;
    if ("cells" in table) return commit(() => client.executeOnSelection("clearCellText"));
    if ("rows" in table && allowsTableEdit(capabilities, "deleteRows"))
        return commit(() => client.executeOnSelection("deleteRows"));
    if ("columns" in table && allowsTableEdit(capabilities, "deleteColumns"))
        return commit(() => client.executeOnSelection("deleteColumns"));
    return deleteTable(host);
}
