// The Cell tab's own commands: a workbook's cells formatted as Excel's Home tab
// formats them — their fill and borders, where their text sits, how their
// values show, their merges, and Clear Formats. The tab's font controls are the
// Text tab's, which edit the selected cells' font in a workbook
// (`text-format.ts`).
import type {
    GridBorderProperties,
    GridBorderStyle,
    GridCellFormatProperties,
    GridHorizontalAlignment,
    GridVerticalAlignment,
} from "@docmentis/udoc-wasm";
import {
    allowsEdit,
    applyPaintBar,
    buildMenuInto,
    buildPaintPanel,
    commandContext,
    createDropdownButton,
    createSplitButton,
    displayToActivePaint,
    ICON_FILL,
    paintSwatch,
    sheetCellFormat,
    sheetCellMerged,
} from "@docmentis/udoc-ui/internal";
import type {
    CommandContext,
    CommandDef,
    EnabledWhen,
    MenuAction,
    MenuItem,
    PaintDisplay,
    RibbonControl,
    RibbonControlEnv,
    SelectionEdit,
    SelectionEditKind,
    UIShellHost,
    UIState,
} from "@docmentis/udoc-ui/internal";
import type { MessageKey } from "./i18n/index.js";
import {
    ICON_BORDER_ALL,
    ICON_BORDER_COLOR,
    ICON_CLEAR_FORMAT,
    ICON_DECIMAL_DECREASE,
    ICON_DECIMAL_INCREASE,
    ICON_MERGE_CELLS,
    ICON_NUMBER_FORMAT,
    ICON_PARAGRAPH_CENTER,
    ICON_PARAGRAPH_LEFT,
    ICON_PARAGRAPH_RIGHT,
    ICON_WRAP_TEXT,
} from "./icons.js";
import { paintToGridColor } from "./paint.js";
import { editState, editStateOf } from "./state.js";
import { ICON_CELL_ALIGN_BOTTOM, ICON_CELL_ALIGN_CENTER, ICON_CELL_ALIGN_TOP, ICON_UNMERGE_CELLS } from "./table.js";
import { borderColorControl, borderControl, createBorderState, themeOf } from "./table-format.js";
import type { BorderPen, LayBorder } from "./table-format.js";
import type { EditTools } from "./tools.js";

type Def = CommandDef<MessageKey>;

/** The format of the workbook's active cell in `state`, or `null` outside a
 *  worksheet's grid. */
function cellFormatIn(state: UIState): GridCellFormatProperties | null {
    return sheetCellFormat(editState(state).selectionProperties);
}

/** {@link cellFormatIn} for a command's context. */
function cellFormatOf(c: CommandContext): GridCellFormatProperties | null {
    return sheetCellFormat(editStateOf(c).selectionProperties);
}

/** Live where the selection takes a cell edit of `kind`. */
const whenCellEdit =
    (kind: SelectionEditKind): EnabledWhen =>
    (c) =>
        allowsEdit(c.selection, kind);

/** Run `edit` on the selected cells — one committing edit. */
function runCellEdit(host: UIShellHost, edit: SelectionEdit): Promise<void> {
    return host.commit(() => host.client.executeOnSelection(edit));
}

/** A menu row's intent: `edit` on the selection, which the shell runs — a
 *  merge Excel refuses showing its reason under the formula bar. */
function cellEditAction(edit: SelectionEdit): MenuAction {
    return { kind: "selectionEdit", edit };
}

/**
 * The Fill Color dropdown: the selected cells' fill. The swatch is the active
 * cell's fill, and the caret opens the color panel, whose No Fill row takes the
 * fill away.
 */
function cellFillControl(env: RibbonControlEnv, tools: EditTools): RibbonControl {
    const { i18n } = tools;
    const fill = (): PaintDisplay => editState(env.store.getState()).selectionPaint.fill;
    const dd = createDropdownButton(
        { icon: paintSwatch(ICON_FILL, fill()), label: env.label },
        {
            menuLabel: i18n.t("ribbon.paintOptions", { label: env.label }),
            onOpen: () =>
                buildPaintPanel(dd.menu, {
                    i18n,
                    variant: "fill",
                    theme: themeOf(env),
                    recent: env.recentPaint.fill,
                    active: displayToActivePaint(fill()),
                    stroke: null,
                    onPick: (paint) => {
                        if (paint.kind !== "none") env.pushRecent("fill", paint.hex);
                        dd.controller.close();
                        const color = paintToGridColor(paint);
                        void runCellEdit(tools.host, {
                            kind: "setCellFill",
                            fill: color ? { pattern: { pattern: "solid", foreground: color } } : null,
                        });
                    },
                }),
        },
    );
    dd.trigger.dataset.command = "cellFill";
    return {
        el: dd.el,
        sync: (state) => applyPaintBar(dd.trigger, editState(state).selectionPaint.fill),
        close: () => dd.controller.close(),
        destroy: () => dd.destroy(),
    };
}

/** The line style of Excel's nearest `pen`: thin, medium or thick by its
 *  weight — Excel's 1, 2 and 3 pixels — and dashed, dotted or dash-dotted as
 *  it is, in the weights Excel has them in. */
export function cellBorderStyle(pen: BorderPen): GridBorderStyle {
    const medium = pen.weight >= 1.125;
    switch (pen.dash) {
        case "solid":
            return pen.weight >= 1.875 ? "thick" : medium ? "medium" : "thin";
        case "dash":
            return medium ? "mediumDashed" : "dashed";
        case "dot":
            return "dotted";
        case "dashDot":
            return medium ? "mediumDashDot" : "dashDot";
    }
}

/** The cell border line `pen` draws. */
export function cellBorderLine(pen: BorderPen): GridBorderProperties {
    const color = paintToGridColor(pen.paint);
    return color ? { style: cellBorderStyle(pen), color } : { style: cellBorderStyle(pen) };
}

/** A workbook's {@link LayBorder}: the selected cells' borders. */
function layCellBorder(host: UIShellHost): LayBorder {
    return (edges, pen) =>
        void runCellEdit(host, { kind: "patchSheetCellBorders", edges, line: pen ? cellBorderLine(pen) : null });
}

/** A vertical alignment row, marked where the active cell's text sits so. */
function verticalRow(vertical: GridVerticalAlignment, label: MessageKey, icon: string): MenuItem<MessageKey> {
    return {
        action: cellEditAction({ kind: "patchCellAlignment", alignment: { vertical } }),
        label,
        icon,
        enabledWhen: whenCellEdit("patchCellAlignment"),
        activeWhen: (c) => cellFormatOf(c)?.vertical === vertical,
    };
}

/** A horizontal alignment row, marked where the active cell's text sits so. */
function horizontalRow(horizontal: GridHorizontalAlignment, label: MessageKey, icon: string): MenuItem<MessageKey> {
    return {
        action: cellEditAction({ kind: "patchCellAlignment", alignment: { horizontal } }),
        label,
        icon,
        enabledWhen: whenCellEdit("patchCellAlignment"),
        activeWhen: (c) => cellFormatOf(c)?.horizontal === horizontal,
    };
}

/** The Alignment dropdown: where the cells' text sits, top to bottom, then
 *  across — Excel's six alignment buttons. */
export const CELL_ALIGN_MENU: readonly MenuItem<MessageKey>[] = [
    verticalRow("top", "cell.alignTop", ICON_CELL_ALIGN_TOP),
    verticalRow("center", "cell.alignMiddle", ICON_CELL_ALIGN_CENTER),
    verticalRow("bottom", "cell.alignBottom", ICON_CELL_ALIGN_BOTTOM),
    { ...horizontalRow("left", "paragraph.alignLeft", ICON_PARAGRAPH_LEFT), separatorBefore: true },
    horizontalRow("center", "paragraph.center", ICON_PARAGRAPH_CENTER),
    horizontalRow("right", "paragraph.alignRight", ICON_PARAGRAPH_RIGHT),
];

/** Live where the selection takes a merge: a block of cells. */
const whenMerge: EnabledWhen = (c) => allowsEdit(c.selection, "mergeSheetCells");

/** Merge & Center: the selected block made one cell, its contents centered. */
const MERGE_AND_CENTER: SelectionEdit = { kind: "mergeSheetCells", across: false, center: true };

/** The Merge & Center menu, Excel's. A merge keeps only its top-left cell's
 *  contents, emptying the rest. */
export const CELL_MERGE_MENU: readonly MenuItem<MessageKey>[] = [
    {
        action: cellEditAction(MERGE_AND_CENTER),
        label: "cell.mergeAndCenter",
        enabledWhen: whenMerge,
    },
    {
        action: cellEditAction({ kind: "mergeSheetCells", across: true, center: false }),
        label: "cell.mergeAcross",
        enabledWhen: whenMerge,
    },
    {
        action: cellEditAction({ kind: "mergeSheetCells", across: false, center: false }),
        label: "table.mergeCells",
        icon: ICON_MERGE_CELLS,
        enabledWhen: whenMerge,
    },
    {
        action: cellEditAction({ kind: "unmergeSheetCells" }),
        label: "table.unmergeCells",
        icon: ICON_UNMERGE_CELLS,
        enabledWhen: whenCellEdit("unmergeSheetCells"),
    },
];

/**
 * The Merge & Center split button, Excel's: the main part reads pressed while
 * the active cell is in a merge, and takes it away there, else merges the
 * selected block and centers it; the caret opens {@link CELL_MERGE_MENU}.
 */
function cellMergeControl(env: RibbonControlEnv, tools: EditTools): RibbonControl {
    const { i18n, host } = tools;
    const merged = (state: UIState): boolean => sheetCellMerged(editState(state).selectionProperties);
    const split = createSplitButton({
        mainLabel: env.label,
        mainIcon: ICON_MERGE_CELLS,
        caretLabel: i18n.t("ribbon.listOptions", { label: env.label }),
        menuLabel: i18n.t("ribbon.listOptions", { label: env.label }),
        onOpen: () =>
            buildMenuInto(split.menu, CELL_MERGE_MENU, {
                i18n,
                context: () => commandContext(env.store.getState()),
                action: (action) => host.runMenuAction(action),
                close: () => split.controller.close(),
            }),
    });
    split.main.dataset.command = "cellMerge";
    split.caret.dataset.command = "cellMerge";
    split.main.addEventListener("click", () => {
        const edit: SelectionEdit = merged(env.store.getState()) ? { kind: "unmergeSheetCells" } : MERGE_AND_CENTER;
        host.runMenuAction(cellEditAction(edit));
    });
    return {
        el: split.el,
        sync: (state) => {
            const on = merged(state);
            split.setActive(on);
            split.main.setAttribute("aria-pressed", String(on));
            // Off a merge the main part merges, which only a block of cells
            // takes — not whole rows, columns or the sheet.
            if (!on && !allowsEdit(state.selectionCaps, "mergeSheetCells")) split.main.disabled = true;
        },
        close: () => split.controller.close(),
        destroy: () => split.destroy(),
    };
}

/** The number formats the Number Format dropdown offers — Excel's, but for
 *  its currency, accounting and long date, which differ by locale — each by
 *  its en-US code. */
const NUMBER_FORMATS: readonly (readonly [code: string, label: MessageKey])[] = [
    ["General", "cell.formatGeneral"],
    ["0.00", "cell.formatNumber"],
    ["m/d/yyyy", "cell.formatShortDate"],
    ["h:mm:ss AM/PM", "cell.formatTime"],
    ["0.00%", "cell.formatPercentage"],
    ["# ?/?", "cell.formatFraction"],
    ["0.00E+00", "cell.formatScientific"],
    ["@", "cell.formatText"],
];

/** The Number Format dropdown: the formats as one exclusive set, the active
 *  cell's marked. */
export const CELL_NUMBER_FORMAT_MENU: readonly MenuItem<MessageKey>[] = NUMBER_FORMATS.map(([code, label]) => ({
    action: cellEditAction({ kind: "setCellNumberFormat", format: { code } }),
    label,
    enabledWhen: whenCellEdit("setCellNumberFormat"),
    activeWhen: (c) => cellFormatOf(c)?.numberFormat === code,
}));

/** The name the Number Format dropdown shows for the active cell's format:
 *  one of its own, else Custom. */
function numberFormatName(state: UIState): MessageKey {
    const code = cellFormatIn(state)?.numberFormat ?? "General";
    return NUMBER_FORMATS.find(([offered]) => offered === code)?.[1] ?? "cell.formatCustom";
}

/**
 * The Cell tab's commands, over the {@link EditTools} once edit mode is
 * mounted: Fill Color, then Border Color and Border, which share a pen of
 * their own; the Alignment dropdown, Wrap Text and Merge & Center; the Number Format
 * dropdown and the decimal steps; and Clear Formats.
 */
export function cellCommands(tools: () => EditTools): Readonly<Record<string, Def>> {
    const border = createBorderState();
    const action = (
        id: string,
        label: MessageKey,
        icon: string,
        group: string,
        edit: SelectionEdit & { kind: SelectionEditKind },
    ): Def => ({
        id,
        label,
        icon,
        group,
        run: { kind: "action", press: () => void runCellEdit(tools().host, edit) },
        enabledWhen: whenCellEdit(edit.kind),
    });
    return {
        cellFill: {
            id: "cellFill",
            label: "cell.fillColor",
            icon: ICON_FILL,
            group: "font",
            run: { kind: "control", cluster: "paint", create: (env) => cellFillControl(env, tools()) },
            enabledWhen: whenCellEdit("setCellFill"),
        },
        cellBorderColor: {
            id: "cellBorderColor",
            label: "table.borderColor",
            icon: ICON_BORDER_COLOR,
            group: "font",
            run: {
                kind: "control",
                cluster: "paint",
                create: (env) => borderColorControl(env, tools(), border, "cellBorderColor"),
            },
            enabledWhen: whenCellEdit("patchSheetCellBorders"),
        },
        cellBorder: {
            id: "cellBorder",
            label: "table.border",
            icon: ICON_BORDER_ALL,
            group: "font",
            run: {
                kind: "control",
                cluster: "paint",
                create: (env) => borderControl(env, tools(), border, "cellBorder", layCellBorder(tools().host)),
            },
            enabledWhen: whenCellEdit("patchSheetCellBorders"),
        },
        cellAlign: {
            id: "cellAlign",
            label: "cell.alignment",
            icon: ICON_PARAGRAPH_LEFT,
            group: "cellAlignment",
            run: { kind: "menu", menu: CELL_ALIGN_MENU },
            enabledWhen: whenCellEdit("patchCellAlignment"),
        },
        cellWrap: {
            id: "cellWrap",
            label: "cell.wrapText",
            icon: ICON_WRAP_TEXT,
            group: "cellAlignment",
            run: {
                kind: "toggle",
                pressed: (state) => cellFormatIn(state)?.wrapText === true,
                press: (store) => {
                    const wrapText = cellFormatIn(store.getState())?.wrapText !== true;
                    void runCellEdit(tools().host, { kind: "patchCellAlignment", alignment: { wrapText } });
                },
            },
            enabledWhen: whenCellEdit("patchCellAlignment"),
        },
        cellMerge: {
            id: "cellMerge",
            label: "cell.mergeAndCenter",
            icon: ICON_MERGE_CELLS,
            group: "cellAlignment",
            run: { kind: "control", create: (env) => cellMergeControl(env, tools()) },
            enabledWhen: (c) => allowsEdit(c.selection, "mergeSheetCells", "unmergeSheetCells"),
        },
        cellNumberFormat: {
            id: "cellNumberFormat",
            label: "cell.numberFormat",
            icon: ICON_NUMBER_FORMAT,
            group: "cellNumber",
            // Named, as Excel's box is: the format a cell shows its value
            // through isn't seen in the value.
            labeled: true,
            run: {
                kind: "menu",
                menu: CELL_NUMBER_FORMAT_MENU,
                current: (state) => ({ icon: ICON_NUMBER_FORMAT, label: numberFormatName(state) }),
            },
            enabledWhen: whenCellEdit("setCellNumberFormat"),
        },
        cellDecimalsUp: action("cellDecimalsUp", "cell.increaseDecimal", ICON_DECIMAL_INCREASE, "cellNumber", {
            kind: "stepCellDecimals",
            increase: true,
        }),
        cellDecimalsDown: action("cellDecimalsDown", "cell.decreaseDecimal", ICON_DECIMAL_DECREASE, "cellNumber", {
            kind: "stepCellDecimals",
            increase: false,
        }),
        cellClearFormats: action("cellClearFormats", "cell.clearFormats", ICON_CLEAR_FORMAT, "cellClear", {
            kind: "clearCellFormats",
        }),
    };
}
