// Edit mode's canvas context menu rows: the clipboard and Delete over any
// selection, and over a table the Select, Insert, Delete and Merge rows. The
// shell opens the menu (`UIExtension.contextMenuItems`).
import {
    allowsEdit,
    allowsTableEdit,
    COPY_MENU_ITEM,
    ICON_DELETE,
    ICON_TOOL_POINTER,
} from "@docmentis/udoc-ui/internal";
import type { EnabledWhen, MenuItem, TableEditKind } from "@docmentis/udoc-ui/internal";
import type { MessageKey } from "./i18n/index.js";
import {
    ICON_CUT,
    ICON_INSERT_COLUMN_LEFT,
    ICON_INSERT_COLUMN_RIGHT,
    ICON_INSERT_ROW_ABOVE,
    ICON_INSERT_ROW_BELOW,
    ICON_MERGE_CELLS,
    ICON_PASTE,
} from "./icons.js";
import { editAction } from "./menu-action.js";

/** A clipboard operation of edit mode's on the current selection / caret — a
 *  copy is the shell's (`COPY_MENU_ITEM`). */
export type ClipboardOp = "cut" | "paste";

/** What a Select ▸ … row widens the current table selection to. Named for the
 *  verbs (`selectTableRows` / `selectTableColumns` / `selectTable`) rather than
 *  the row labels: the commands widen to *every* row or column the selection
 *  touches, which the singular menu wording (Office's) understates. */
export type TableSelectScope = "rows" | "columns" | "table";

/** Enabled whenever a document is open — the rows that act on the document at
 *  large rather than on the selection. */
const whenReady: EnabledWhen = (c) => c.ready;

/** A table structural edit on the selection's table — the context menu's
 *  Insert / Delete / Merge rows. Carries the sub-domain edit verbatim, so edit
 *  mode hands it straight to `executeOnSelection` under the `table` arm. */
const whenTableEdit =
    (kind: TableEditKind): EnabledWhen =>
    (c) =>
        allowsTableEdit(c.selection, kind);

const TABLE_SELECT_MENU: readonly MenuItem<MessageKey>[] = [
    { action: editAction({ kind: "selectTable", scope: "rows" }), label: "table.selectRow", enabledWhen: whenReady },
    {
        action: editAction({ kind: "selectTable", scope: "columns" }),
        label: "table.selectColumn",
        enabledWhen: whenReady,
    },
    { action: editAction({ kind: "selectTable", scope: "table" }), label: "table.selectTable", enabledWhen: whenReady },
];

/**
 * The canvas context menu in edit mode — what a right-click offers for the
 * current selection: the shell's Copy row among edit mode's own. These are
 * *acts on the selection*, not properties of it: they mean the same thing for a
 * shape, a slide, or a range of text, so they belong beside the selection
 * rather than on a toolbar tab competing for width with the controls that do
 * vary by type.
 *
 * Cut and Copy gate on the engine's `copyable` verdict (Cut additionally on a
 * delete kind — cut is copy-then-delete, so a copyable-but-locked object is only
 * copied). Paste needs a document, not a selection: it reads the system
 * clipboard, which may hold something to paste even when nothing is selected.
 *
 * Paste pastes the object, not merely its text: the copy path carries the
 * fragment in a `text/html` envelope precisely so this row's async clipboard read
 * can recover it (udoc-ui's `clipboard.ts` has the why). Ctrl/Cmd+V is still
 * the quieter path — the async read is permission-gated, and Safari fronts it
 * with its own paste-confirmation UI.
 */
export const CONTEXT_MENU: readonly MenuItem<MessageKey>[] = [
    {
        action: editAction({ kind: "clipboard", op: "cut" }),
        label: "contextMenu.cut",
        icon: ICON_CUT,
        enabledWhen: (c) => c.selection.copyable && allowsEdit(c.selection, "deleteObjects", "deleteShapes"),
    },
    COPY_MENU_ITEM,
    {
        action: editAction({ kind: "clipboard", op: "paste" }),
        label: "contextMenu.paste",
        icon: ICON_PASTE,
        enabledWhen: whenReady,
    },
    {
        action: editAction({ kind: "delete" }),
        label: "contextMenu.delete",
        icon: ICON_DELETE,
        enabledWhen: (c) => allowsEdit(c.selection, "deleteObjects", "deleteAnnotations", "deleteShapes"),
        separatorBefore: true,
    },
];

const TABLE_INSERT_MENU: readonly MenuItem<MessageKey>[] = [
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

const TABLE_DELETE_MENU: readonly MenuItem<MessageKey>[] = [
    {
        action: editAction({ kind: "tableEdit", edit: "deleteRows" }),
        label: "table.deleteRows",
        enabledWhen: whenTableEdit("deleteRows"),
    },
    {
        action: editAction({ kind: "tableEdit", edit: "deleteColumns" }),
        label: "table.deleteColumns",
        enabledWhen: whenTableEdit("deleteColumns"),
    },
];

/**
 * The context menu as it reads over a **table** — the rows above plus the
 * Select fly-out that widens the pick to whole rows, whole columns, or the
 * whole table.
 *
 * A separate list rather than a conditional row, because the condition is not a
 * property of the selection: it is *where the right-click landed*, which the
 * canvas knows from the hit it already ran and nothing in the editor state
 * records. So the menu is handed its list at open (see `ContextMenu.open`), and
 * the Select rows simply do not exist anywhere but over a table — which is also
 * how Office shows them. Their own `enabledWhen` is therefore just "a document
 * is open": the right-click that produced this list already placed a selection
 * inside the table, so all three have something to widen.
 */
export const TABLE_CONTEXT_MENU: readonly MenuItem<MessageKey>[] = [
    ...CONTEXT_MENU,
    {
        submenu: TABLE_SELECT_MENU,
        label: "table.select",
        icon: ICON_TOOL_POINTER,
        enabledWhen: whenReady,
        separatorBefore: true,
    },
    { submenu: TABLE_INSERT_MENU, label: "table.insert", icon: ICON_INSERT_ROW_BELOW, enabledWhen: whenReady },
    { submenu: TABLE_DELETE_MENU, label: "table.delete", enabledWhen: whenReady },
    // Merge / unmerge are one gesture each, not a family, so they sit flat
    // rather than behind a third fly-out — and each greys on its own gate: a
    // caret in one cell has no block to merge, an unmerged block none to split.
    {
        action: editAction({ kind: "tableEdit", edit: "mergeCells" }),
        label: "table.mergeCells",
        icon: ICON_MERGE_CELLS,
        enabledWhen: whenTableEdit("mergeCells"),
        separatorBefore: true,
    },
    {
        action: editAction({ kind: "tableEdit", edit: "unmergeCells" }),
        label: "table.unmergeCells",
        enabledWhen: whenTableEdit("unmergeCells"),
    },
];
