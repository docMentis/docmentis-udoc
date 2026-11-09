// The Table tab's two paint controls: Shading, the cells' fill, and Border, a pen
// laid on the edges of the selected block.
import type {
    PaintLine,
    TableBorder,
    TableCellBorderEdge,
    TableLook,
    TableSelectionEdit,
    TableSelectionProperties,
    UDocSelectionProperties,
} from "@docmentis/udoc-wasm";
import {
    applyPaintBar,
    buildPaintPanel,
    createDropdownButton,
    createMenuItem,
    createSplitButton,
    displayToActivePaint,
    drawingProperties,
    ICON_FILL as ICON_SHADING,
    paintSwatch,
    tableShadingDisplay,
} from "@docmentis/udoc-ui/internal";
import type {
    LineDash,
    PaintDisplay,
    PaintSpec,
    RibbonControl,
    RibbonControlEnv,
    UIShellHost,
} from "@docmentis/udoc-ui/internal";
import type { MessageKey } from "./i18n/index.js";
import {
    ICON_BORDER_ALL,
    ICON_BORDER_BOTTOM,
    ICON_BORDER_COLOR,
    ICON_BORDER_INSIDE,
    ICON_BORDER_INSIDE_HORIZONTAL,
    ICON_BORDER_INSIDE_VERTICAL,
    ICON_BORDER_LEFT,
    ICON_BORDER_NONE,
    ICON_BORDER_OUTSIDE,
    ICON_BORDER_RIGHT,
    ICON_BORDER_TOP,
} from "./icons.js";
import { changedDrawingLine } from "./line-edit.js";
import { mapThemeColors, paintToDrawingFill, THEMED } from "./paint.js";
import { editState } from "./state.js";
import { consensusValue, wordTableSelection } from "./table-edits.js";
import type { EditTools } from "./tools.js";

/** The selection's table properties — what the Table tab's controls mirror —
 *  or `null` outside a table. */
export function selectionTable(properties: UDocSelectionProperties | null): TableSelectionProperties | null {
    return drawingProperties(properties)?.table ?? null;
}

/** Turn one of the Table Style Options on or off — the rest of the look as the
 *  table has it, since the look is set whole. */
export function toggleTableLook(host: UIShellHost, flag: keyof TableLook): Promise<void> {
    const look = consensusValue(selectionTable(editState(host.store.getState()).selectionProperties)?.look);
    if (!look) return Promise.resolve();
    return runTableEdit(host, { patchTableProperties: { properties: { look: { ...look, [flag]: !look[flag] } } } });
}

/**
 * Delete the table the selection is in. A deck's table is its frame, a shape
 * like any other, so it goes as the selected shape does. A word document's
 * takes one position in its story, so that position is selected and deleted as
 * text — the paragraphs either side stay apart, as a table's own position is
 * all a delete of it covers.
 */
export async function deleteTable(host: UIShellHost): Promise<void> {
    if (host.store.getState().docType === "wordprocessing") {
        const selection = await host.client.selection();
        const slot = selection && wordTableSelection(selection);
        if (!slot) return;
        host.client.setSelection(slot);
        await host.commit(() => host.client.executeOnSelection({ kind: "deleteText", forward: true }));
        return;
    }
    await host.commit(() => host.client.executeOnSelection({ kind: "deleteShapes" }));
}

/** Run `edit` on the table the selection is in — one committing edit. */
export function runTableEdit(host: UIShellHost, edit: TableSelectionEdit): Promise<void> {
    return host.commit(() => host.client.executeOnSelection(edit));
}

/** The theme block the color panels show: the document's palette for an Office
 *  document, none for a PDF. */
function themeOf(env: RibbonControlEnv) {
    const state = env.store.getState();
    return state.docType !== null && THEMED.has(state.docType) ? mapThemeColors(editState(state).themePalette) : null;
}

/**
 * The Shading dropdown: the cells' fill. Like the Shape tab's Fill it mirrors
 * the selection — the swatch is the shading of the cells it covers, the one a
 * table style's banding gives them included — and the caret opens the color
 * panel, whose No Fill row takes the shading away.
 */
export function tableShadingControl(env: RibbonControlEnv, tools: EditTools): RibbonControl {
    const { i18n } = tools;
    const shading = (): PaintDisplay => tableShadingDisplay(editState(env.store.getState()).selectionProperties);
    const dd = createDropdownButton(
        { icon: paintSwatch(ICON_SHADING, shading()), label: env.label },
        {
            menuLabel: i18n.t("ribbon.paintOptions", { label: env.label }),
            onOpen: () =>
                buildPaintPanel(dd.menu, {
                    i18n,
                    variant: "fill",
                    theme: themeOf(env),
                    recent: env.recentPaint.fill,
                    active: displayToActivePaint(shading()),
                    stroke: null,
                    onPick: (paint) => {
                        if (paint.kind !== "none") env.pushRecent("fill", paint.hex);
                        dd.controller.close();
                        void runTableEdit(tools.host, {
                            patchCellProperties: { properties: { fill: paintToDrawingFill(paint) } },
                        });
                    },
                }),
        },
    );
    dd.trigger.dataset.command = "tableShading";
    return {
        el: dd.el,
        sync: (state) => applyPaintBar(dd.trigger, tableShadingDisplay(editState(state).selectionProperties)),
        close: () => dd.controller.close(),
        destroy: () => dd.destroy(),
    };
}

/** The pen a Border lays: a color, a weight in points and a dash. */
export interface BorderPen {
    paint: PaintSpec;
    weight: number;
    dash: LineDash;
}

/** The pen a Border starts with: Office's, a 1pt solid black line. */
export const DEFAULT_BORDER_PEN: BorderPen = { paint: { kind: "solid", hex: "#000000" }, weight: 1, dash: "solid" };

// The two diagonal borders Material Symbols has no symbol for, drawn from
// `border_clear`, the no-border glyph: its dotted frame, less the dotted cross
// inside it — a diagonal is a cell's own, and the cross's centre would sit on
// it — with one solid diagonal corner to corner, as thick across as Material's
// own diagonals. Modified from Material Symbols, © Google LLC, licensed under
// the Apache License 2.0: https://www.apache.org/licenses/LICENSE-2.0

/** Diagonal Down Border: the top-left to bottom-right diagonal. */
export const ICON_BORDER_DIAGONAL_DOWN = `<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M144-144v-72h72v72h-72ZM144-294v-72h72v72h-72ZM144-444v-72h72v72h-72ZM144-594v-72h72v72h-72ZM144-744v-72h72v72h-72ZM744-144v-72h72v72h-72ZM744-294v-72h72v72h-72ZM744-444v-72h72v72h-72ZM744-594v-72h72v72h-72ZM744-744v-72h72v72h-72ZM294-744v-72h72v72h-72ZM444-744v-72h72v72h-72ZM594-744v-72h72v72h-72ZM294-144v-72h72v72h-72ZM444-144v-72h72v72h-72ZM594-144v-72h72v72h-72Z"/><path d="M144-816h51l621 621v51h-51L144-765v-51Z"/></svg>`;

/** Diagonal Up Border: the bottom-left to top-right diagonal. */
export const ICON_BORDER_DIAGONAL_UP = `<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M144-144v-72h72v72h-72ZM144-294v-72h72v72h-72ZM144-444v-72h72v72h-72ZM144-594v-72h72v72h-72ZM144-744v-72h72v72h-72ZM744-144v-72h72v72h-72ZM744-294v-72h72v72h-72ZM744-444v-72h72v72h-72ZM744-594v-72h72v72h-72ZM744-744v-72h72v72h-72ZM294-744v-72h72v72h-72ZM444-744v-72h72v72h-72ZM594-744v-72h72v72h-72ZM294-144v-72h72v72h-72ZM444-144v-72h72v72h-72ZM594-144v-72h72v72h-72Z"/><path d="M144-144h51l621-621v-51h-51L144-195v51Z"/></svg>`;

/** One of the Border menu's edge choices: what it lays the pen on, its name, and
 *  its glyph. */
export interface EdgeChoice {
    edges: TableCellBorderEdge;
    label: MessageKey;
    icon: string;
}

/** The edge choices, in Word's and PowerPoint's order. */
export const BORDER_EDGES: readonly EdgeChoice[] = [
    { edges: "all", label: "table.borderAll", icon: ICON_BORDER_ALL },
    { edges: "outside", label: "table.borderOutside", icon: ICON_BORDER_OUTSIDE },
    { edges: "inside", label: "table.borderInside", icon: ICON_BORDER_INSIDE },
    { edges: "top", label: "table.borderTop", icon: ICON_BORDER_TOP },
    { edges: "bottom", label: "table.borderBottom", icon: ICON_BORDER_BOTTOM },
    { edges: "left", label: "table.borderLeft", icon: ICON_BORDER_LEFT },
    { edges: "right", label: "table.borderRight", icon: ICON_BORDER_RIGHT },
    { edges: "insideHorizontal", label: "table.borderInsideHorizontal", icon: ICON_BORDER_INSIDE_HORIZONTAL },
    { edges: "insideVertical", label: "table.borderInsideVertical", icon: ICON_BORDER_INSIDE_VERTICAL },
    { edges: "diagonalDown", label: "table.borderDiagonalDown", icon: ICON_BORDER_DIAGONAL_DOWN },
    { edges: "diagonalUp", label: "table.borderDiagonalUp", icon: ICON_BORDER_DIAGONAL_UP },
];

/** The border `pen` draws as: its `DrawingML` line alone, which the renderer
 *  strokes and a save of either format writes. */
export function borderOfPen(pen: BorderPen): TableBorder {
    const line: PaintLine = changedDrawingLine(
        null,
        {},
        { fill: paintToDrawingFill(pen.paint), weight: pen.weight, dash: pen.dash },
    );
    return { line };
}

/** No Border's line: one with no fill, which draws nothing — laid on every
 *  edge, the diagonals included. */
export function noBorder(): TableBorder {
    return { line: changedDrawingLine(null, { fill: "none" }, { fill: "none", weight: 1, dash: "solid" }) };
}

/** The edit that lays `border` on `edges` of the selected block. */
export function borderEdit(edges: TableCellBorderEdge, border: TableBorder): TableSelectionEdit {
    return { patchCellBorders: { edges, border } };
}

/** The pen the Border control lays, and the edges it laid last — what the
 *  Border Color and Border controls share, made once for edit mode and kept
 *  across the ribbon's rebuilds. */
export interface BorderState {
    pen: BorderPen;
    last: EdgeChoice;
}

/** A border state at Office's starting pen, All Borders chosen. */
export function createBorderState(): BorderState {
    return { pen: { ...DEFAULT_BORDER_PEN }, last: BORDER_EDGES[0] as EdgeChoice };
}

/**
 * The Border Color dropdown: the pen the Border control lays — its color, and
 * its weight and dash in the panel's fly-outs. It sets the pen and nothing else,
 * as Word's Pen Color does: the borders already drawn keep theirs, and the next
 * Border draws with it. The swatch shows the pen's color.
 */
export function tableBorderColorControl(env: RibbonControlEnv, tools: EditTools, state: BorderState): RibbonControl {
    const { i18n } = tools;
    const dd = createDropdownButton(
        { icon: paintSwatch(ICON_BORDER_COLOR, displayOfPen(state.pen)), label: env.label },
        {
            menuLabel: i18n.t("ribbon.paintOptions", { label: env.label }),
            onOpen: () => {
                buildPaintPanel(dd.menu, {
                    i18n,
                    variant: "stroke",
                    theme: themeOf(env),
                    recent: env.recentPaint.stroke,
                    active: state.pen.paint,
                    stroke: { weight: state.pen.weight, dash: state.pen.dash },
                    onPick: (paint) => {
                        if (paint.kind !== "none") env.pushRecent("stroke", paint.hex);
                        setPen({ ...state.pen, paint });
                    },
                    onWeight: (weight) => setPen({ ...state.pen, weight }),
                    onDash: (dash) => setPen({ ...state.pen, dash }),
                });
                // A pen has a color; taking the borders away is the Border
                // menu's No Border.
                dd.menu.querySelector(".udoc-paintpanel__none")?.remove();
            },
        },
    );
    dd.trigger.dataset.command = "tableBorderColor";

    function setPen(pen: BorderPen): void {
        state.pen = pen;
        applyPaintBar(dd.trigger, displayOfPen(pen));
        dd.controller.close();
    }

    return {
        el: dd.el,
        close: () => dd.controller.close(),
        destroy: () => dd.destroy(),
    };
}

/**
 * The Border split button: the main part lays the pen on the edges chosen last
 * — All Borders to start — and shows them; the caret lists the edge choices,
 * then No Border, each laying the pen (or taking the borders away) at once.
 */
export function tableBorderControl(env: RibbonControlEnv, tools: EditTools, state: BorderState): RibbonControl {
    const { i18n } = tools;
    const face = (): string => state.last.icon;
    const split = createSplitButton({
        mainLabel: env.label,
        mainIcon: face(),
        caretLabel: i18n.t("table.borderOptions"),
        menuLabel: i18n.t("table.borderOptions"),
        onOpen: () => fill(),
    });
    split.main.dataset.command = "tableBorder";
    split.caret.dataset.command = "tableBorder";

    const lay = (choice: EdgeChoice): void => {
        state.last = choice;
        split.main.innerHTML = face();
        void runTableEdit(tools.host, borderEdit(choice.edges, borderOfPen(state.pen)));
    };
    split.main.addEventListener("click", () => lay(state.last));

    function fill(): void {
        split.menu.innerHTML = "";
        const row = (icon: string, label: MessageKey, run: () => void): HTMLButtonElement => {
            const item = createMenuItem({ icon, text: i18n.t(label) });
            item.addEventListener("click", (e) => {
                e.stopPropagation();
                split.controller.close();
                run();
            });
            return item;
        };
        for (const choice of BORDER_EDGES) split.menu.append(row(choice.icon, choice.label, () => lay(choice)));
        const none = row(ICON_BORDER_NONE, "table.borderNone", () => {
            void runTableEdit(tools.host, borderEdit("allAndDiagonals", noBorder()));
        });
        none.classList.add("udoc-toolbar__menu-item--divider");
        split.menu.append(none);
    }

    return {
        el: split.el,
        close: () => split.controller.close(),
        destroy: () => split.destroy(),
    };
}

/** The bar a pen's color shows as under the Border Color glyph. */
function displayOfPen(pen: BorderPen): PaintDisplay {
    return pen.paint.kind === "none" ? { kind: "none" } : { kind: "solid", hex: pen.paint.hex };
}
