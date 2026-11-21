// The Cell tab's own commands: a workbook's cells formatted as Excel's Home tab
// formats them — their fill and borders, where their text sits and how it
// turns, their indents, how their values show, their merges, and Clear Formats.
// The tab's font controls are the Text tab's, which edit the selected cells'
// font in a workbook (`text-format.ts`).
import type {
    GridBorderProperties,
    GridBorderStyle,
    GridCellAlignment,
    GridCellFormatProperties,
    WorksheetSelectionEditType,
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
    ICON_INDENT_DECREASE,
    ICON_INDENT_INCREASE,
    ICON_MERGE_CELLS,
    ICON_NUMBER_FORMAT,
    ICON_PARAGRAPH_CENTER,
    ICON_PARAGRAPH_LEFT,
    ICON_PARAGRAPH_RIGHT,
    ICON_TEXT_ANGLE_DOWN,
    ICON_TEXT_ANGLE_UP,
    ICON_TEXT_ROTATE_270,
    ICON_TEXT_ROTATE_90,
    ICON_TEXT_STACKED,
    ICON_UNMERGE_CELLS,
    ICON_WRAP_TEXT,
} from "./icons.js";
import { STACKED_TEXT } from "./cell-alignment-edits.js";
import { editAction } from "./menu-action.js";
import { paintToGridColor } from "./paint.js";
import { editState, editStateOf } from "./state.js";
import { ICON_CELL_ALIGN_BOTTOM, ICON_CELL_ALIGN_CENTER, ICON_CELL_ALIGN_TOP } from "./table.js";
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

/** Where the Horizontal Alignment dropdown's rows set a cell's text across. */
export type CellAcross = "left" | "center" | "right";

/** Where the Vertical Alignment dropdown's rows set a cell's text down. */
export type CellDown = "top" | "center" | "bottom";

/** Live where the selection takes a worksheet edit of `kind`. */
const whenCellEdit =
    (kind: WorksheetSelectionEditType): EnabledWhen =>
    (c) =>
        allowsEdit(c.selection, `worksheet.${kind}`);

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
                            family: "worksheet",
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
        void runCellEdit(host, {
            family: "worksheet",
            kind: "patchCellBorders",
            edges,
            line: pen ? cellBorderLine(pen) : null,
        });
}

/**
 * Set the selected cells' text `across`, as Excel's Align Left, Center and
 * Align Right buttons do: pressed again where the active cell is already so,
 * back to General. Left and Right keep each cell's indent; Center and General,
 * which take none, clear it.
 */
export function alignCellsAcross(host: UIShellHost, across: CellAcross): Promise<void> {
    const pressed = cellFormatIn(host.store.getState())?.horizontal === across;
    const alignment: GridCellAlignment = pressed
        ? { horizontal: "general", indent: 0 }
        : across === "center"
          ? { horizontal: across, indent: 0 }
          : { horizontal: across };
    return runCellEdit(host, { family: "worksheet", kind: "patchCellAlignment", alignment });
}

/** Set the selected cells' text `down`, as Excel's Top, Middle and Bottom Align
 *  buttons do: pressed again where the active cell is already so, back to
 *  Bottom, a cell's default. */
export function alignCellsDown(host: UIShellHost, down: CellDown): Promise<void> {
    const pressed = cellFormatIn(host.store.getState())?.vertical === down;
    const vertical = pressed ? "bottom" : down;
    return runCellEdit(host, { family: "worksheet", kind: "patchCellAlignment", alignment: { vertical } });
}

/** Turn the selected cells' text to `rotation`, an `@textRotation`, as Excel's
 *  Orientation rows do: chosen again where the active cell is already so,
 *  level. */
export function turnCellText(host: UIShellHost, rotation: number): Promise<void> {
    const chosen = cellFormatIn(host.store.getState())?.textRotation === rotation;
    const textRotation = chosen ? 0 : rotation;
    return runCellEdit(host, { family: "worksheet", kind: "patchCellAlignment", alignment: { textRotation } });
}

/** Live where the selection takes an alignment. */
const whenAlign = whenCellEdit("patchCellAlignment");

/** Format Cell Alignment: the dialog with every alignment a cell takes. */
const FORMAT_ALIGNMENT_ROW: MenuItem<MessageKey> = {
    action: editAction({ kind: "formatCellAlignment" }),
    label: "cell.formatAlignment",
    enabledWhen: whenAlign,
    separatorBefore: true,
};

/** A vertical alignment row, marked where the active cell's text sits so. */
function verticalRow(down: CellDown, label: MessageKey, icon: string): MenuItem<MessageKey> {
    return {
        action: editAction({ kind: "cellAlignDown", down }),
        label,
        icon,
        enabledWhen: whenAlign,
        activeWhen: (c) => cellFormatOf(c)?.vertical === down,
    };
}

/** A horizontal alignment row, marked where the active cell's text sits so. */
function horizontalRow(across: CellAcross, label: MessageKey, icon: string): MenuItem<MessageKey> {
    return {
        action: editAction({ kind: "cellAlignAcross", across }),
        label,
        icon,
        enabledWhen: whenAlign,
        activeWhen: (c) => cellFormatOf(c)?.horizontal === across,
    };
}

/** Excel's horizontal alignment buttons, each by where it sets a cell's text
 *  across. */
const ACROSS: readonly (readonly [across: CellAcross, label: MessageKey, icon: string])[] = [
    ["left", "paragraph.alignLeft", ICON_PARAGRAPH_LEFT],
    ["center", "paragraph.center", ICON_PARAGRAPH_CENTER],
    ["right", "paragraph.alignRight", ICON_PARAGRAPH_RIGHT],
];

/** Excel's vertical alignment buttons, each by where it sets a cell's text top
 *  to bottom. */
const DOWN: readonly (readonly [down: CellDown, label: MessageKey, icon: string])[] = [
    ["top", "cell.alignTop", ICON_CELL_ALIGN_TOP],
    ["center", "cell.alignMiddle", ICON_CELL_ALIGN_CENTER],
    ["bottom", "cell.alignBottom", ICON_CELL_ALIGN_BOTTOM],
];

/** The Horizontal Alignment dropdown: where the cells' text sits across —
 *  Excel's three buttons — and the dialog with the rest (Fill, Justify, Center
 *  Across Selection, Distributed). */
export const CELL_ACROSS_MENU: readonly MenuItem<MessageKey>[] = [
    ...ACROSS.map(([across, label, icon]) => horizontalRow(across, label, icon)),
    FORMAT_ALIGNMENT_ROW,
];

/** The Vertical Alignment dropdown: where the cells' text sits top to bottom —
 *  Excel's three buttons. */
export const CELL_DOWN_MENU: readonly MenuItem<MessageKey>[] = DOWN.map(([down, label, icon]) =>
    verticalRow(down, label, icon),
);

/** What the Horizontal Alignment dropdown shows: the active cell's alignment
 *  across, or Align Left's icon for any other — General's included, which sets
 *  text to the left. */
function acrossShown(state: UIState): { icon: string; label: MessageKey } {
    const across = cellFormatIn(state)?.horizontal;
    const shown = ACROSS.find(([a]) => a === across) ?? ACROSS[0]!;
    return { icon: shown[2], label: shown[1] };
}

/** What the Vertical Alignment dropdown shows: the active cell's alignment top
 *  to bottom, or Bottom's, a cell's default, for any other. */
function downShown(state: UIState): { icon: string; label: MessageKey } {
    const down = cellFormatIn(state)?.vertical;
    const shown = DOWN.find(([d]) => d === down) ?? DOWN[2]!;
    return { icon: shown[2], label: shown[1] };
}

/** The Orientation dropdown's turns, Excel's, each by its `@textRotation`:
 *  45 degrees up, 45 down, stacked, 90 up and 90 down. */
const ORIENTATIONS: readonly (readonly [rotation: number, label: MessageKey, icon: string])[] = [
    [45, "cell.angleCounterclockwise", ICON_TEXT_ANGLE_UP],
    [135, "cell.angleClockwise", ICON_TEXT_ANGLE_DOWN],
    [STACKED_TEXT, "cell.verticalText", ICON_TEXT_STACKED],
    [90, "cell.rotateTextUp", ICON_TEXT_ROTATE_270],
    [180, "cell.rotateTextDown", ICON_TEXT_ROTATE_90],
];

/** The Orientation dropdown, Excel's: the turns, the active cell's marked, and
 *  Format Cell Alignment. As Excel's, the angles are greyed while the active
 *  cell is indented, which only stacked text goes with. */
export const CELL_ORIENTATION_MENU: readonly MenuItem<MessageKey>[] = [
    ...ORIENTATIONS.map(
        ([rotation, label, icon]): MenuItem<MessageKey> => ({
            action: editAction({ kind: "cellTurn", rotation }),
            label,
            icon,
            enabledWhen: (c) => whenAlign(c) && (rotation === STACKED_TEXT || (cellFormatOf(c)?.indent ?? 0) === 0),
            activeWhen: (c) => cellFormatOf(c)?.textRotation === rotation,
        }),
    ),
    FORMAT_ALIGNMENT_ROW,
];

/** Live where the selection takes a merge: a block of cells. */
const whenMerge: EnabledWhen = (c) => allowsEdit(c.selection, "worksheet.mergeCells");

/** Merge & Center: the selected block made one cell, its contents centered. */
const MERGE_AND_CENTER: SelectionEdit = { family: "worksheet", kind: "mergeCells", across: false, center: true };

/** The Merge & Center menu, Excel's. A merge keeps only its top-left cell's
 *  contents, emptying the rest. */
export const CELL_MERGE_MENU: readonly MenuItem<MessageKey>[] = [
    {
        action: cellEditAction(MERGE_AND_CENTER),
        label: "cell.mergeAndCenter",
        enabledWhen: whenMerge,
    },
    {
        action: cellEditAction({ family: "worksheet", kind: "mergeCells", across: true, center: false }),
        label: "cell.mergeAcross",
        enabledWhen: whenMerge,
    },
    {
        action: cellEditAction({ family: "worksheet", kind: "mergeCells", across: false, center: false }),
        label: "table.mergeCells",
        icon: ICON_MERGE_CELLS,
        enabledWhen: whenMerge,
    },
    {
        action: cellEditAction({ family: "worksheet", kind: "unmergeCells" }),
        label: "table.unmergeCells",
        icon: ICON_UNMERGE_CELLS,
        enabledWhen: whenCellEdit("unmergeCells"),
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
        const edit: SelectionEdit = merged(env.store.getState())
            ? { family: "worksheet", kind: "unmergeCells" }
            : MERGE_AND_CENTER;
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
            if (!on && !allowsEdit(state.selectionCaps, "worksheet.mergeCells")) split.main.disabled = true;
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
    action: cellEditAction({ family: "worksheet", kind: "setCellNumberFormat", format: { code } }),
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
 * their own; the Alignment and Orientation dropdowns, the indent steps, Wrap
 * Text and Merge & Center; the Number Format dropdown and the decimal steps;
 * and Clear Formats.
 */
export function cellCommands(tools: () => EditTools): Readonly<Record<string, Def>> {
    const border = createBorderState();
    const action = (
        id: string,
        label: MessageKey,
        icon: string,
        group: string,
        edit: Extract<SelectionEdit, { family: "worksheet" }>,
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
            enabledWhen: whenCellEdit("patchCellBorders"),
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
            enabledWhen: whenCellEdit("patchCellBorders"),
        },
        cellAlignAcross: {
            id: "cellAlignAcross",
            label: "cell.horizontalAlignment",
            icon: ICON_PARAGRAPH_LEFT,
            group: "cellAlignment",
            run: { kind: "menu", menu: CELL_ACROSS_MENU, current: acrossShown },
            enabledWhen: whenAlign,
        },
        cellAlignDown: {
            id: "cellAlignDown",
            label: "cell.verticalAlignment",
            icon: ICON_CELL_ALIGN_BOTTOM,
            group: "cellAlignment",
            run: { kind: "menu", menu: CELL_DOWN_MENU, current: downShown },
            enabledWhen: whenAlign,
        },
        cellOrientation: {
            id: "cellOrientation",
            label: "cell.orientation",
            icon: ICON_TEXT_ANGLE_UP,
            group: "cellAlignment",
            run: { kind: "menu", menu: CELL_ORIENTATION_MENU },
            enabledWhen: whenAlign,
        },
        cellIndentDown: action("cellIndentDown", "paragraph.decreaseIndent", ICON_INDENT_DECREASE, "cellAlignment", {
            family: "worksheet",
            kind: "stepCellIndent",
            increase: false,
        }),
        cellIndentUp: action("cellIndentUp", "paragraph.increaseIndent", ICON_INDENT_INCREASE, "cellAlignment", {
            family: "worksheet",
            kind: "stepCellIndent",
            increase: true,
        }),
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
                    void runCellEdit(tools().host, {
                        family: "worksheet",
                        kind: "patchCellAlignment",
                        alignment: { wrapText },
                    });
                },
            },
            enabledWhen: whenAlign,
        },
        cellMerge: {
            id: "cellMerge",
            label: "cell.mergeAndCenter",
            icon: ICON_MERGE_CELLS,
            group: "cellAlignment",
            run: { kind: "control", create: (env) => cellMergeControl(env, tools()) },
            enabledWhen: (c) => allowsEdit(c.selection, "worksheet.mergeCells", "worksheet.unmergeCells"),
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
            family: "worksheet",
            kind: "stepCellDecimals",
            increase: true,
        }),
        cellDecimalsDown: action("cellDecimalsDown", "cell.decreaseDecimal", ICON_DECIMAL_DECREASE, "cellNumber", {
            family: "worksheet",
            kind: "stepCellDecimals",
            increase: false,
        }),
        cellClearFormats: action("cellClearFormats", "cell.clearFormats", ICON_CLEAR_FORMAT, "cellClear", {
            family: "worksheet",
            kind: "clearCellFormats",
        }),
    };
}
