// Insert Table: a grid to size the table on — the rows and columns pointed at
// lit, their count above — and a click inserting it, with the caret in its
// first cell: on a deck's slide from its Slide tab, at the caret in a word
// document's body from its Insert tab.

import { allowsTextEdit, createDropdownButton } from "@docmentis/udoc-ui/internal";
import type { CommandContext, CommandDef, RibbonControl, RibbonControlEnv } from "@docmentis/udoc-ui/internal";
import type { EditHost } from "./edit-client.js";
import type { MessageKey } from "./i18n/index.js";
import { ICON_TAB_TABLE } from "./icons.js";
import { whenTableEdit } from "./table.js";
import { inSize, PICKER_COLUMNS, PICKER_ROWS, pickedSize } from "./table-picker.js";
import type { TableSize } from "./table-picker.js";
import type { EditTools } from "./tools.js";

/** Where a table can go: a deck's slide shown, or a caret in a word document's
 *  body — text, not a cell's, which nests none yet. */
export function canInsertTable(c: CommandContext): boolean {
    if (!c.ready) return false;
    if (c.docType === "presentation") return c.presentationView === "normal" && c.pageCount > 0;
    if (c.docType !== "wordprocessing") return false;
    return allowsTextEdit(c.selection, "insertText") && !whenTableEdit("insertRows")(c);
}

/** Insert a `size` table and put the caret in its first cell — one committing
 *  edit. */
export function insertTable(host: EditHost, size: TableSize): Promise<void> {
    return host.commit(() => host.edit.insertTable(size.rows, size.columns));
}

/**
 * The Insert Table dropdown: a table glyph opening a grid of
 * {@link PICKER_ROWS} × {@link PICKER_COLUMNS} cells. Pointing at a cell lights
 * the table it stands for and names its size above — columns by rows, as Word
 * and PowerPoint write it — and a click inserts it. The arrows move the lit
 * corner and Enter inserts, for a grid opened from the keyboard.
 */
export function insertTableControl(env: RibbonControlEnv, tools: EditTools): RibbonControl {
    const { i18n } = tools;
    const dd = createDropdownButton(
        { icon: ICON_TAB_TABLE, label: env.label },
        { menuLabel: env.label, onOpen: () => fill() },
    );
    dd.trigger.dataset.command = "insertTable";
    dd.menu.classList.add("udoc-table-picker");

    let caption: HTMLElement | null = null;
    let cells: HTMLButtonElement[] = [];

    const show = (next: TableSize | null): void => {
        if (caption) {
            caption.textContent = next
                ? i18n.t("command.insertTableSize", { columns: next.columns, rows: next.rows })
                : env.label;
        }
        cells.forEach((cell, index) => {
            const row = Math.floor(index / PICKER_COLUMNS);
            cell.classList.toggle("udoc-table-picker__cell--lit", inSize(next, row, index % PICKER_COLUMNS));
        });
    };
    const insert = (picked: TableSize): void => {
        dd.controller.close();
        void insertTable(tools.host, picked);
    };

    function fill(): void {
        dd.menu.innerHTML = "";
        caption = document.createElement("div");
        caption.className = "udoc-table-picker__caption";
        const grid = document.createElement("div");
        grid.className = "udoc-table-picker__grid";
        grid.setAttribute("role", "grid");
        grid.style.gridTemplateColumns = `repeat(${PICKER_COLUMNS}, auto)`;
        cells = [];
        for (let row = 0; row < PICKER_ROWS; row++) {
            for (let column = 0; column < PICKER_COLUMNS; column++) {
                const picked = pickedSize(row, column);
                const cell = document.createElement("button");
                cell.type = "button";
                cell.className = "udoc-table-picker__cell";
                cell.tabIndex = row === 0 && column === 0 ? 0 : -1;
                cell.setAttribute(
                    "aria-label",
                    i18n.t("command.insertTableSize", { columns: picked.columns, rows: picked.rows }),
                );
                cell.addEventListener("pointerenter", () => show(picked));
                cell.addEventListener("focus", () => show(picked));
                cell.addEventListener("click", (e) => {
                    e.stopPropagation();
                    insert(picked);
                });
                cell.addEventListener("keydown", (e) => move(e, row, column));
                cells.push(cell);
                grid.append(cell);
            }
        }
        grid.addEventListener("pointerleave", () => show(null));
        dd.menu.append(caption, grid);
        show(null);
    }

    /** Arrow keys walk the lit corner across the grid; Enter is the click. */
    function move(e: KeyboardEvent, row: number, column: number): void {
        const step: Record<string, [number, number]> = {
            ArrowUp: [-1, 0],
            ArrowDown: [1, 0],
            ArrowLeft: [0, -1],
            ArrowRight: [0, 1],
        };
        const delta = step[e.key];
        if (!delta) return;
        e.preventDefault();
        e.stopPropagation();
        const next = {
            row: Math.min(PICKER_ROWS - 1, Math.max(0, row + delta[0])),
            column: Math.min(PICKER_COLUMNS - 1, Math.max(0, column + delta[1])),
        };
        const target = cells[next.row * PICKER_COLUMNS + next.column];
        cells.forEach((cell) => (cell.tabIndex = -1));
        if (target) {
            target.tabIndex = 0;
            target.focus();
        }
    }

    return {
        el: dd.el,
        close: () => dd.controller.close(),
        destroy: () => dd.destroy(),
    };
}

/** The Insert Table command — a control, as its panel is a grid of its own. */
export function insertTableCommand(tools: () => EditTools): CommandDef<MessageKey> {
    return {
        id: "insertTable",
        label: "command.insertTable",
        icon: ICON_TAB_TABLE,
        group: "insert",
        run: { kind: "control", create: (env) => insertTableControl(env, tools()) },
        enabledWhen: canInsertTable,
    };
}
