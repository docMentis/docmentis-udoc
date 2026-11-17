// The Table tab's pure halves, which touch neither the DOM nor the engine: the
// value a reported property holds, the selection a word document's Delete Table
// deletes, and what the Table Properties dialog opens on and sends.
import type {
    TableCellMargins,
    TableRowProperties,
    TableSelectionEdit,
    TableSelectionProperties,
} from "@docmentis/udoc-wasm";

/** The value a consensus holds, `null` where it holds several or none. */
export function consensusValue<T>(consensus: "absent" | "mixed" | { value: T } | undefined): T | null {
    return typeof consensus === "object" ? consensus.value : null;
}

// The selection a word document's Delete Table deletes, shared with the
// shell's Delete of a selection in a table.
export { tableSlotSelection, wordTableSelection } from "@docmentis/udoc-ui/internal";

/** The four sides of a cell's margins, by name. */
export type MarginSide = "top" | "bottom" | "left" | "right";
export const MARGIN_SIDES: readonly MarginSide[] = ["top", "bottom", "left", "right"];

/** What the dialog shows: each value the selection holds one of, `null` where
 *  it holds several (or none) — a blank field. In points. */
export interface TablePropertiesValues {
    rowHeight: number | null;
    columnWidth: number | null;
    margins: Record<MarginSide, number | null>;
    /** Repeat Header Rows — a word document's alone. */
    header: boolean | null;
}

/** What the dialog opens on: the selection's values, and how its rows declare
 *  their height, which an edited height keeps. */
export interface TablePropertiesSeed {
    values: TablePropertiesValues;
    /** `exact` where every selected row is exactly its height; `atLeast` — a
     *  minimum, a deck's only rule and a word document's default — otherwise. */
    heightRule: "atLeast" | "exact";
    /** Whether Repeat Header Rows shows — in a word document, which repeats a
     *  table's header rows across pages; a deck's table never splits. */
    showHeader: boolean;
}

/** The dialog's opening values for `table`, the selection's table properties. */
export function tablePropertiesSeed(table: TableSelectionProperties, wordprocessing: boolean): TablePropertiesSeed {
    const height = consensusValue(table.height);
    const margins = consensusValue(table.margins);
    return {
        values: {
            // An automatic height states no measure: the field opens blank.
            rowHeight: height === null || height === "auto" ? null : "exact" in height ? height.exact : height.atLeast,
            columnWidth: consensusValue(table.width),
            margins: {
                top: margins?.top ?? null,
                bottom: margins?.bottom ?? null,
                left: margins?.left ?? null,
                right: margins?.right ?? null,
            },
            header: consensusValue(table.header),
        },
        heightRule: height !== null && height !== "auto" && "exact" in height ? "exact" : "atLeast",
        showHeader: wordprocessing,
    };
}

/** Whether `next` is a value other than `was` — a blank field never is, and a
 *  measure differs once it moves by a hundredth of a point. */
function changed(next: number | null, was: number | null): next is number {
    return next !== null && (was === null || Math.abs(next - was) >= 0.005);
}

/**
 * The edits OK sends for `values` against what the dialog opened on: only what
 * changed, at most one per kind — the rows' height and header together, the
 * columns' width, the cells' margins with only the sides that moved — so a
 * field left as it was stays as each cell has it.
 */
export function tablePropertiesEdits(seed: TablePropertiesSeed, values: TablePropertiesValues): TableSelectionEdit[] {
    const was = seed.values;
    const edits: TableSelectionEdit[] = [];

    const row: TableRowProperties = {};
    if (changed(values.rowHeight, was.rowHeight)) {
        row.height = seed.heightRule === "exact" ? { exact: values.rowHeight } : { atLeast: values.rowHeight };
    }
    if (seed.showHeader && values.header !== null && values.header !== was.header) row.header = values.header;
    if (Object.keys(row).length > 0) edits.push({ patchRowProperties: { properties: row } });

    if (changed(values.columnWidth, was.columnWidth)) edits.push({ setColumnWidth: { width: values.columnWidth } });

    const margins: TableCellMargins = {};
    for (const side of MARGIN_SIDES) {
        const next = values.margins[side];
        if (changed(next, was.margins[side])) margins[side] = next;
    }
    if (Object.keys(margins).length > 0) edits.push({ patchCellProperties: { properties: { margins } } });

    return edits;
}
