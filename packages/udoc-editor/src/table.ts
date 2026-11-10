// A table's edits: the rows the context menu shows over a table, and the Table
// tab's commands, which offer the same edits on the ribbon.
import { allowsEdit, allowsTableEdit, ICON_FILL, ICON_TOOL_POINTER } from "@docmentis/udoc-ui/internal";
import type { CommandContext, CommandDef, EnabledWhen, MenuItem, TableEditKind } from "@docmentis/udoc-ui/internal";
import type { TableLook, TableSelectionEdit, TextAnchor, TextDirection } from "@docmentis/udoc-wasm";
import type { MessageKey } from "./i18n/index.js";
import {
    ICON_BORDER_ALL,
    ICON_BORDER_COLOR,
    ICON_DELETE_COLUMNS,
    ICON_DELETE_ROWS,
    ICON_DELETE_TABLE,
    ICON_DISTRIBUTE_H,
    ICON_INSERT_COLUMN_LEFT,
    ICON_INSERT_COLUMN_RIGHT,
    ICON_INSERT_ROW_ABOVE,
    ICON_INSERT_ROW_BELOW,
    ICON_MERGE_CELLS,
    ICON_SELECT_COLUMNS,
    ICON_SELECT_ROWS,
    ICON_SELECT_TABLE,
    ICON_TABLE_PROPERTIES,
    ICON_TABLE_STYLE,
    ICON_TEXT_HORIZONTAL,
    ICON_TEXT_ROTATE_270,
    ICON_TEXT_ROTATE_90,
    ICON_TEXT_STACKED,
    ICON_UNMERGE_CELLS,
} from "./icons.js";
import { editAction, runEditMenuAction } from "./menu-action.js";
import { editStateOf } from "./state.js";
import { consensusValue } from "./table-edits.js";
import {
    borderColorControl,
    borderControl,
    createBorderState,
    layTableBorder,
    selectionTable,
    tableShadingControl,
} from "./table-format.js";
import { ALIGN_CENTER_ROW, ALIGN_LEFT_ROW, ALIGN_RIGHT_ROW } from "./text-format.js";
import type { EditTools } from "./tools.js";

// The three cell alignments Material Symbols has no symbol for, drawn from
// `position_top_right`: its frame, and its block centred left to right and set
// where the cell's text sits — as far below the frame's top as the symbol sets
// it, mirrored at the bottom, or midway. Modified from Material Symbols,
// © Google LLC, licensed under the Apache License 2.0:
// https://www.apache.org/licenses/LICENSE-2.0

/** Top: the block at the top of the frame — and the Align dropdown's own glyph. */
export const ICON_CELL_ALIGN_TOP = `<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M312-576h336v-96H312v96ZM216-144q-29.7 0-50.85-21.15Q144-186.3 144-216v-528q0-29.7 21.15-50.85Q186.3-816 216-816h528q29.7 0 50.85 21.15Q816-773.7 816-744v528q0 29.7-21.15 50.85Q773.7-144 744-144H216Zm0-72h528v-528H216v528Zm0-528v528-528Z"/></svg>`;

/** Center: the block midway. */
export const ICON_CELL_ALIGN_CENTER = `<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M312-432h336v-96H312v96ZM216-144q-29.7 0-50.85-21.15Q144-186.3 144-216v-528q0-29.7 21.15-50.85Q186.3-816 216-816h528q29.7 0 50.85 21.15Q816-773.7 816-744v528q0 29.7-21.15 50.85Q773.7-144 744-144H216Zm0-72h528v-528H216v528Zm0-528v528-528Z"/></svg>`;

/** Bottom: the block at the bottom of the frame. */
export const ICON_CELL_ALIGN_BOTTOM = `<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M312-288h336v-96H312v96ZM216-144q-29.7 0-50.85-21.15Q144-186.3 144-216v-528q0-29.7 21.15-50.85Q186.3-816 216-816h528q29.7 0 50.85 21.15Q816-773.7 816-744v528q0 29.7-21.15 50.85Q773.7-144 744-144H216Zm0-72h528v-528H216v528Zm0-528v528-528Z"/></svg>`;

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
    {
        action: editAction({ kind: "selectTable", scope: "rows" }),
        label: "table.row",
        icon: ICON_SELECT_ROWS,
        enabledWhen: whenReady,
    },
    {
        action: editAction({ kind: "selectTable", scope: "columns" }),
        label: "table.column",
        icon: ICON_SELECT_COLUMNS,
        enabledWhen: whenReady,
    },
    {
        action: editAction({ kind: "selectTable", scope: "table" }),
        label: "table.table",
        icon: ICON_SELECT_TABLE,
        enabledWhen: whenReady,
    },
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

/** Delete the table: a deck's frame goes as a selected shape does, which a
 *  placeholder that refuses deletion keeps. A word document's goes as the one
 *  position it takes in its story, a delete of text wherever its rows can be
 *  edited. */
const canDeleteTable: EnabledWhen = (c) =>
    inTable(c) && (c.docType === "wordprocessing" || allowsEdit(c.selection, "deleteShapes"));

export const TABLE_DELETE_MENU: readonly MenuItem<MessageKey>[] = [
    {
        action: editAction({ kind: "tableEdit", edit: "deleteRows" }),
        label: "table.rows",
        icon: ICON_DELETE_ROWS,
        enabledWhen: whenTableEdit("deleteRows"),
    },
    {
        action: editAction({ kind: "tableEdit", edit: "deleteColumns" }),
        label: "table.columns",
        icon: ICON_DELETE_COLUMNS,
        enabledWhen: whenTableEdit("deleteColumns"),
    },
    {
        action: editAction({ kind: "deleteTable" }),
        label: "table.table",
        icon: ICON_DELETE_TABLE,
        enabledWhen: canDeleteTable,
        separatorBefore: true,
    },
];

/**
 * `menu` with its rows' labels spelled whole by `labels` — the Table tab's
 * dropdowns, whose button shows only an icon, where the context menu's
 * fly-outs sit under a row already saying Select, Insert or Delete.
 */
function spelledOut(
    menu: readonly MenuItem<MessageKey>[],
    labels: Partial<Record<MessageKey, MessageKey>>,
): readonly MenuItem<MessageKey>[] {
    return menu.map((item) => ({
        ...item,
        label: (typeof item.label === "string" && labels[item.label]) || item.label,
    }));
}

const TOOLBAR_SELECT_MENU = spelledOut(TABLE_SELECT_MENU, {
    "table.row": "table.selectRow",
    "table.column": "table.selectColumn",
    "table.table": "table.selectTable",
});

const TOOLBAR_INSERT_MENU = spelledOut(TABLE_INSERT_MENU, {
    "table.rowAbove": "table.insertRowAbove",
    "table.rowBelow": "table.insertRowBelow",
    "table.columnLeft": "table.insertColumnLeft",
    "table.columnRight": "table.insertColumnRight",
});

const TOOLBAR_DELETE_MENU = spelledOut(TABLE_DELETE_MENU, {
    "table.rows": "table.deleteRows",
    "table.columns": "table.deleteColumns",
    "table.table": "table.deleteTable",
});

/** Merge and Unmerge, the Cells dropdown's two rows. */
export const TABLE_CELLS_MENU: readonly MenuItem<MessageKey>[] = [
    {
        action: editAction({ kind: "tableEdit", edit: "mergeCells" }),
        label: "table.mergeCells",
        icon: ICON_MERGE_CELLS,
        enabledWhen: whenTableEdit("mergeCells"),
    },
    {
        action: editAction({ kind: "tableEdit", edit: "unmergeCells" }),
        label: "table.unmergeCells",
        icon: ICON_UNMERGE_CELLS,
        enabledWhen: whenTableEdit("unmergeCells"),
    },
];

/** What the selection's cells hold, read off its table properties. */
function tableOf(c: CommandContext) {
    return selectionTable(editStateOf(c).selectionProperties);
}

/** A cell format row: patches `properties` onto the cells the selection covers. */
const cellPatch = (properties: { anchor: TextAnchor } | { direction: TextDirection }): TableSelectionEdit => ({
    patchCellProperties: { properties },
});

/** A vertical alignment row, marked where the selected cells all sit so. */
function anchorRow(anchor: TextAnchor, label: MessageKey, icon: string): MenuItem<MessageKey> {
    return {
        action: editAction({ kind: "tableEdit", edit: cellPatch({ anchor }) }),
        label,
        icon,
        enabledWhen: whenTableEdit("patchCellProperties"),
        activeWhen: (c) => consensusValue(tableOf(c)?.anchor) === anchor,
    };
}

/** A text direction row, marked where the selected cells' text all runs so. */
function directionRow(
    direction: TextDirection,
    label: MessageKey,
    icon: string,
    enabledWhen: EnabledWhen = whenTableEdit("patchCellProperties"),
): MenuItem<MessageKey> {
    return {
        action: editAction({ kind: "tableEdit", edit: cellPatch({ direction }) }),
        label,
        icon,
        enabledWhen,
        activeWhen: (c) => consensusValue(tableOf(c)?.direction) === direction,
    };
}

/** The directions a cell's text runs in. Stacked is a deck's: a word document
 *  has no stacked text, and a save would drop it. */
const TEXT_DIRECTION_MENU: readonly MenuItem<MessageKey>[] = [
    directionRow("lrTb", "table.directionHorizontal", ICON_TEXT_HORIZONTAL),
    directionRow("tbRl", "table.directionRotate90", ICON_TEXT_ROTATE_90),
    directionRow("btLr", "table.directionRotate270", ICON_TEXT_ROTATE_270),
    directionRow(
        "wordArtVert",
        "table.directionStacked",
        ICON_TEXT_STACKED,
        (c) => c.docType !== "wordprocessing" && whenTableEdit("patchCellProperties")(c),
    ),
];

/** The Align dropdown: where the cells' text sits, top to bottom, then across
 *  — the paragraph alignments the Text tab sets — then the direction it runs in. */
export const TABLE_ALIGN_MENU: readonly MenuItem<MessageKey>[] = [
    anchorRow("top", "table.alignTop", ICON_CELL_ALIGN_TOP),
    anchorRow("center", "table.alignCenter", ICON_CELL_ALIGN_CENTER),
    anchorRow("bottom", "table.alignBottom", ICON_CELL_ALIGN_BOTTOM),
    { ...ALIGN_LEFT_ROW, separatorBefore: true },
    ALIGN_CENTER_ROW,
    ALIGN_RIGHT_ROW,
    {
        submenu: TEXT_DIRECTION_MENU,
        label: "table.textDirection",
        icon: ICON_TEXT_HORIZONTAL,
        enabledWhen: whenTableEdit("patchCellProperties"),
        separatorBefore: true,
    },
];

/** One of the Table Style Options: a switch that keeps the panel open, so the
 *  next can be flipped at once. */
function lookRow(flag: keyof TableLook, label: MessageKey): MenuItem<MessageKey> {
    return {
        action: editAction({ kind: "toggleTableLook", flag }),
        label,
        enabledWhen: whenTableEdit("patchTableProperties"),
        checked: (c) => consensusValue(tableOf(c)?.look)?.[flag] === true,
        keepsOpen: true,
    };
}

/** The Style dropdown: the six regions of the table's style that apply. */
export const TABLE_STYLE_MENU: readonly MenuItem<MessageKey>[] = [
    lookRow("firstRow", "table.headerRow"),
    lookRow("lastRow", "table.totalRow"),
    lookRow("rowBanding", "table.bandedRows"),
    lookRow("firstColumn", "table.firstColumn"),
    lookRow("lastColumn", "table.lastColumn"),
    lookRow("columnBanding", "table.bandedColumns"),
];

/**
 * The Table tab's commands, over the {@link EditTools} once edit mode is mounted,
 * and `openProperties`, which opens the Table Properties dialog. One tab, kept
 * short: Select, then Insert, Delete and Cells as dropdowns beside Distribute
 * Columns; Shading, Border Color and Border; the Align and Style dropdowns; and
 * the dialog, which holds the measures — height, width, margins — that would
 * cost the band a field each.
 */
export function tableCommands(
    tools: () => EditTools,
    openProperties: () => void,
): Readonly<Record<string, CommandDef<MessageKey>>> {
    // The pen and the edges laid last, which Border Color and Border share.
    const border = createBorderState();
    const dropdown = (
        id: string,
        group: string,
        label: MessageKey,
        icon: string,
        menu: readonly MenuItem<MessageKey>[],
        enabledWhen: EnabledWhen,
    ): CommandDef<MessageKey> => ({
        id,
        label,
        icon,
        group,
        run: { kind: "menu", menu, cluster: "table" },
        enabledWhen,
    });
    return {
        tableSelect: {
            id: "tableSelect",
            label: "table.select",
            icon: ICON_TOOL_POINTER,
            group: "tableSelect",
            run: { kind: "menu", menu: TOOLBAR_SELECT_MENU },
            enabledWhen: inTable,
        },
        tableInsert: dropdown(
            "tableInsert",
            "tableEdit",
            "table.insert",
            ICON_INSERT_ROW_BELOW,
            TOOLBAR_INSERT_MENU,
            inTable,
        ),
        tableDelete: dropdown(
            "tableDelete",
            "tableEdit",
            "table.delete",
            ICON_DELETE_ROWS,
            TOOLBAR_DELETE_MENU,
            inTable,
        ),
        tableCells: dropdown("tableCells", "tableEdit", "table.cells", ICON_MERGE_CELLS, TABLE_CELLS_MENU, inTable),
        tableDistribute: {
            id: "tableDistribute",
            label: "table.distributeColumns",
            icon: ICON_DISTRIBUTE_H,
            group: "tableEdit",
            run: {
                kind: "action",
                cluster: "table",
                press: () => runEditMenuAction(tools(), { kind: "tableEdit", edit: "distributeColumns" }),
            },
            enabledWhen: whenTableEdit("distributeColumns"),
        },
        tableShading: {
            id: "tableShading",
            label: "table.shading",
            icon: ICON_FILL,
            group: "tablePaint",
            run: { kind: "control", cluster: "paint", create: (env) => tableShadingControl(env, tools()) },
            enabledWhen: whenTableEdit("patchCellProperties"),
        },
        tableBorder: {
            id: "tableBorder",
            label: "table.border",
            icon: ICON_BORDER_ALL,
            group: "tablePaint",
            run: {
                kind: "control",
                cluster: "paint",
                create: (env) => borderControl(env, tools(), border, "tableBorder", layTableBorder(tools().host)),
            },
            enabledWhen: whenTableEdit("patchCellBorders"),
        },
        tableBorderColor: {
            id: "tableBorderColor",
            label: "table.borderColor",
            icon: ICON_BORDER_COLOR,
            group: "tablePaint",
            run: {
                kind: "control",
                cluster: "paint",
                create: (env) => borderColorControl(env, tools(), border, "tableBorderColor"),
            },
            enabledWhen: whenTableEdit("patchCellBorders"),
        },
        tableAlign: {
            id: "tableAlign",
            label: "table.cellAlignment",
            icon: ICON_CELL_ALIGN_TOP,
            group: "tableFormat",
            run: { kind: "menu", menu: TABLE_ALIGN_MENU },
            enabledWhen: whenTableEdit("patchCellProperties"),
        },
        tableStyle: {
            id: "tableStyle",
            label: "table.styleOptions",
            icon: ICON_TABLE_STYLE,
            group: "tableFormat",
            run: { kind: "menu", menu: TABLE_STYLE_MENU },
            enabledWhen: whenTableEdit("patchTableProperties"),
        },
        tableProperties: {
            id: "tableProperties",
            label: "table.properties",
            icon: ICON_TABLE_PROPERTIES,
            group: "tableProperties",
            run: { kind: "action", press: openProperties },
            enabledWhen: inTable,
        },
    };
}
