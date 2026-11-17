// What a pick in a table deletes — Delete and Cut alike, as Word and
// PowerPoint cut it: a block of cells its text, whole rows or columns those
// tracks, the whole table the table. Pure but for `deleteTablePick`, which
// issues the one edit the pick calls for.
import type { ShapeSelection, TableSelection, TextSelection, UDocSelection, UDocType } from "@docmentis/udoc-wasm";
import { allowsTableEdit } from "../geometry.js";
import type { DocumentLayout, SelectionCapabilities } from "../geometry.js";
import type { WorkerClient } from "../worker/WorkerClient.js";

/** What is picked in a table: a block of cells, whole rows, whole columns, or
 *  the whole table. */
export type TablePick = "cells" | "rows" | "columns" | "all";

/** The innermost pick in a table `selection` holds — through a caret in a
 *  cell, a table in a shape or a shape in text — or `null` where it holds none:
 *  a caret or a range of text is no pick. */
export function tablePick(selection: UDocSelection): TablePick | null {
    if ("presentation" in selection) {
        const deck = selection.presentation;
        return typeof deck === "object" && "shapes" in deck ? shapePick(deck.shapes.selection) : null;
    }
    if ("image" in selection) {
        const image = selection.image;
        return typeof image === "object" && "shapes" in image ? shapePick(image.shapes.selection) : null;
    }
    if ("wordprocessing" in selection) {
        const word = selection.wordprocessing;
        if (typeof word !== "object") return null;
        if ("sectionText" in word) return textPick(word.sectionText.selection);
        if ("headerText" in word) return textPick(word.headerText.selection);
        if ("footerText" in word) return textPick(word.footerText.selection);
    }
    return null;
}

function shapePick(selection: ShapeSelection): TablePick | null {
    if ("shapeTable" in selection) return pickIn(selection.shapeTable[1]);
    if ("shapeText" in selection) return textPick(selection.shapeText[1]);
    return null;
}

function textPick(selection: TextSelection): TablePick | null {
    if ("table" in selection) return pickIn(selection.table.table);
    if ("drawing" in selection) return shapePick(selection.drawing.shape);
    return null;
}

function pickIn(table: TableSelection): TablePick | null {
    if ("cellText" in table) return textPick(table.cellText.text);
    if ("cells" in table) return "cells";
    if ("rows" in table) return "rows";
    if ("columns" in table) return "columns";
    return "all";
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
    return { range: { story, anchor: offset, focus: offset + 1 } };
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
 * Delete what is picked in a table, as Delete and Cut take it: a block of
 * cells loses its text, whole rows or columns go — the table where they are
 * all of it, since a table with none is no table — and the whole table goes.
 * `capabilities` are the selection's, which say whether its rows or columns
 * may go.
 */
export async function deleteTablePick(host: TableDeleteHost, capabilities: SelectionCapabilities): Promise<void> {
    const selection = await host.client.selection();
    const pick = selection && tablePick(selection);
    if (pick === null) return;
    const { client, commit } = host;
    if (pick === "cells") return commit(() => client.executeOnSelection("clearCellText"));
    if (pick === "rows" && allowsTableEdit(capabilities, "deleteRows"))
        return commit(() => client.executeOnSelection("deleteRows"));
    if (pick === "columns" && allowsTableEdit(capabilities, "deleteColumns"))
        return commit(() => client.executeOnSelection("deleteColumns"));
    return deleteTable(host);
}
