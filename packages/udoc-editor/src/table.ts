// A table's edits: the rows the context menu shows over a table, and the Table
// tab's commands, which offer the same edits on the ribbon.
import { allowsTableEdit, ICON_TOOL_POINTER } from "@docmentis/udoc-ui/internal";
import type { CommandDef, EnabledWhen, MenuItem, TableEditKind } from "@docmentis/udoc-ui/internal";
import type { TableSelectionEdit } from "@docmentis/udoc-wasm";
import type { MessageKey } from "./i18n/index.js";
import {
    ICON_INSERT_COLUMN_LEFT,
    ICON_INSERT_COLUMN_RIGHT,
    ICON_INSERT_ROW_ABOVE,
    ICON_INSERT_ROW_BELOW,
    ICON_MERGE_CELLS,
} from "./icons.js";
import { editAction, runEditMenuAction } from "./menu-action.js";
import type { EditTools } from "./tools.js";

// The table glyphs Material Symbols has no symbol for, each drawn from the one it
// is the opposite of, which keeps its frame and strokes. Modified from Material
// Symbols, © Google LLC, licensed under the Apache License 2.0:
// https://www.apache.org/licenses/LICENSE-2.0

/** Delete Rows: `add_row_below` with its plus an × of the same size and strokes.
 *  Not the trash can, which on the same menu deletes the whole shape. */
export const ICON_DELETE_ROWS = `<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M216-540h528v-228H216v228Zm-72 372v-672h672v672H672V-240.49h72V-468H216v228h72v72H144ZM411-84l-51-51 69-69-69-69 51-51 69 69 69-69 51 51-69 69 69 69-51 51-69-69-69 69Z"/></svg>`;

/** Delete Columns: `add_column_right`, as {@link ICON_DELETE_ROWS} is `add_row_below`. */
const ICON_DELETE_COLUMNS = `<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M192-744v528h228v-528H192Zm-72 600v-672h672v144H719.51v-72H492v528h228v-72h72v144H120ZM687-360l-51-51 69-69-69-69 51-51 69 69 69-69 51 51-69 69 69 69-51 51-69-69-69 69Z"/></svg>`;

/** Unmerge: `cell_merge` with its arrows turned outward. They are shorter, their
 *  heads clear of the frame's sides, and their tails meet where the merge arrows'
 *  tips do. */
export const ICON_UNMERGE_CELLS = `<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M144-144v-240h72v168h168v72H144Zm432 0v-72h168v-168h72v240H576ZM312-336L168-480l144-144 51 51-57 57H432v72H306l57 57-51 51Zm336 0l-51-51 57-57H528v-72h126l-57-57 51-51 144 144-144 144ZM144-576v-240h240v72H216v168h-72Zm600 0v-168H576v-72h240v240h-72Z"/></svg>`;

/** What a Select ▸ … row widens the current table selection to. Named for the
 *  verbs (`selectTableRows` / `selectTableColumns` / `selectTable`) rather than
 *  the row labels: the commands widen to *every* row or column the selection
 *  touches, which the singular menu wording (Office's) understates. */
export type TableSelectScope = "rows" | "columns" | "table";

/** Enabled whenever a document is open — the Select rows, which only show where
 *  there is a table to widen in: a right-click on one, or the Table tab's
 *  Select, which {@link inTable} greys. */
const whenReady: EnabledWhen = (c) => c.ready;

/** A table structural edit on the selection's table. Carries the sub-domain edit
 *  verbatim, so edit mode hands it straight to `executeOnSelection` under the
 *  `table` arm. */
export const whenTableEdit =
    (kind: TableEditKind): EnabledWhen =>
    (c) =>
        allowsTableEdit(c.selection, kind);

/** Whether the selection is in a table: a caret in a cell, or a block of cells.
 *  Inserting is live wherever the selection names a row to insert beside. */
const inTable: EnabledWhen = whenTableEdit("insertRows");

export const TABLE_SELECT_MENU: readonly MenuItem<MessageKey>[] = [
    { action: editAction({ kind: "selectTable", scope: "rows" }), label: "table.selectRow", enabledWhen: whenReady },
    {
        action: editAction({ kind: "selectTable", scope: "columns" }),
        label: "table.selectColumn",
        enabledWhen: whenReady,
    },
    { action: editAction({ kind: "selectTable", scope: "table" }), label: "table.selectTable", enabledWhen: whenReady },
];

export const TABLE_INSERT_MENU: readonly MenuItem<MessageKey>[] = [
    {
        action: editAction({ kind: "tableEdit", edit: { insertRows: { before: true, count: 1 } } }),
        label: "table.rowAbove",
        icon: ICON_INSERT_ROW_ABOVE,
        enabledWhen: whenTableEdit("insertRows"),
    },
    {
        action: editAction({ kind: "tableEdit", edit: { insertRows: { before: false, count: 1 } } }),
        label: "table.rowBelow",
        icon: ICON_INSERT_ROW_BELOW,
        enabledWhen: whenTableEdit("insertRows"),
    },
    {
        action: editAction({ kind: "tableEdit", edit: { insertColumns: { before: true, count: 1 } } }),
        label: "table.columnLeft",
        icon: ICON_INSERT_COLUMN_LEFT,
        enabledWhen: whenTableEdit("insertColumns"),
        separatorBefore: true,
    },
    {
        action: editAction({ kind: "tableEdit", edit: { insertColumns: { before: false, count: 1 } } }),
        label: "table.columnRight",
        icon: ICON_INSERT_COLUMN_RIGHT,
        enabledWhen: whenTableEdit("insertColumns"),
    },
];

export const TABLE_DELETE_MENU: readonly MenuItem<MessageKey>[] = [
    {
        action: editAction({ kind: "tableEdit", edit: "deleteRows" }),
        label: "table.deleteRows",
        icon: ICON_DELETE_ROWS,
        enabledWhen: whenTableEdit("deleteRows"),
    },
    {
        action: editAction({ kind: "tableEdit", edit: "deleteColumns" }),
        label: "table.deleteColumns",
        icon: ICON_DELETE_COLUMNS,
        enabledWhen: whenTableEdit("deleteColumns"),
    },
];

/**
 * The Table tab's commands, over the {@link EditTools} once edit mode is mounted,
 * in the order of the context menu's rows over a table: the Select dropdown, the
 * four inserts, the two deletes, then Merge and Unmerge.
 *
 * The inserts and deletes stand on the band where the menu puts them behind
 * fly-outs: they are the edits made over and over, and the band has room for them,
 * so a row more or less is a press rather than a dropdown's two, and each delete
 * greys on its own. Select stays a dropdown, its rows named by words that no glyph
 * on the band could tell apart.
 */
export function tableCommands(tools: () => EditTools): Readonly<Record<string, CommandDef<MessageKey>>> {
    const button = (
        id: string,
        group: string,
        label: MessageKey,
        icon: string,
        edit: TableSelectionEdit,
        kind: TableEditKind,
    ): CommandDef<MessageKey> => ({
        id,
        label,
        icon,
        group,
        run: {
            kind: "action",
            cluster: "table",
            press: () => runEditMenuAction(tools(), { kind: "tableEdit", edit }),
        },
        enabledWhen: whenTableEdit(kind),
    });
    const insert = (id: string, label: MessageKey, icon: string, edit: TableSelectionEdit, kind: TableEditKind) =>
        button(id, "tableInsert", label, icon, edit, kind);
    return {
        tableSelect: {
            id: "tableSelect",
            label: "table.select",
            icon: ICON_TOOL_POINTER,
            group: "tableSelect",
            run: { kind: "menu", menu: TABLE_SELECT_MENU },
            enabledWhen: inTable,
        },
        tableInsertRowAbove: insert(
            "tableInsertRowAbove",
            "table.insertRowAbove",
            ICON_INSERT_ROW_ABOVE,
            { insertRows: { before: true, count: 1 } },
            "insertRows",
        ),
        tableInsertRowBelow: insert(
            "tableInsertRowBelow",
            "table.insertRowBelow",
            ICON_INSERT_ROW_BELOW,
            { insertRows: { before: false, count: 1 } },
            "insertRows",
        ),
        tableInsertColumnLeft: insert(
            "tableInsertColumnLeft",
            "table.insertColumnLeft",
            ICON_INSERT_COLUMN_LEFT,
            { insertColumns: { before: true, count: 1 } },
            "insertColumns",
        ),
        tableInsertColumnRight: insert(
            "tableInsertColumnRight",
            "table.insertColumnRight",
            ICON_INSERT_COLUMN_RIGHT,
            { insertColumns: { before: false, count: 1 } },
            "insertColumns",
        ),
        tableDeleteRows: button(
            "tableDeleteRows",
            "tableDelete",
            "table.deleteRowsButton",
            ICON_DELETE_ROWS,
            "deleteRows",
            "deleteRows",
        ),
        tableDeleteColumns: button(
            "tableDeleteColumns",
            "tableDelete",
            "table.deleteColumnsButton",
            ICON_DELETE_COLUMNS,
            "deleteColumns",
            "deleteColumns",
        ),
        tableMerge: button(
            "tableMerge",
            "tableMerge",
            "table.mergeCells",
            ICON_MERGE_CELLS,
            "mergeCells",
            "mergeCells",
        ),
        tableUnmerge: button(
            "tableUnmerge",
            "tableMerge",
            "table.unmergeCells",
            ICON_UNMERGE_CELLS,
            "unmergeCells",
            "unmergeCells",
        ),
    };
}
