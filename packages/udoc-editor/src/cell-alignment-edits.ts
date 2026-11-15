// The Format Cell Alignment dialog's pure half, which touches neither the DOM
// nor the engine: what it opens on, how it shows a turn, and the alignment its
// OK lays over the selected cells.
import type {
    GridCellAlignment,
    GridCellFormatProperties,
    GridHorizontalAlignment,
    GridVerticalAlignment,
} from "@docmentis/udoc-wasm";

/** `@textRotation` for stacked text, its letters one above another. */
export const STACKED_TEXT = 255;

/** The most indent a cell takes in the dialog, as in Excel's. */
export const MAX_INDENT = 250;

/** The horizontal alignments that take an indent — Excel's "(Indent)" ones. */
export const INDENTED: ReadonlySet<GridHorizontalAlignment> = new Set(["left", "right", "distributed"]);

/** A cell's alignment as the dialog shows it, each part resolved. */
export interface CellAlignmentValues {
    horizontal: GridHorizontalAlignment;
    /** In steps of three spaces of the Normal style's font. */
    indent: number;
    vertical: GridVerticalAlignment;
    /** Whether a distributed cell spreads its last line too. */
    justifyLastLine: boolean;
    wrapText: boolean;
    shrinkToFit: boolean;
    /** 0 by the text's first strong letter, 1 left-to-right, 2 right-to-left. */
    readingOrder: number;
    /** `@textRotation`: 0 to 90 degrees up, 91 to 180 that less 90 down, 255
     *  stacked. */
    textRotation: number;
}

/** The degrees a turn shows, up positive and down negative; none for stacked
 *  text, which has its own box. */
export function degreesOf(rotation: number): number {
    if (rotation === STACKED_TEXT) return 0;
    return rotation > 90 ? 90 - rotation : rotation;
}

/** The `@textRotation` of `degrees`, -90 to 90. */
export function rotationOf(degrees: number): number {
    return degrees < 0 ? 90 - degrees : degrees;
}

/** What the dialog shows for a cell of `format`. */
export function cellAlignmentSeed(format: GridCellFormatProperties): CellAlignmentValues {
    return {
        horizontal: format.horizontal,
        indent: format.indent,
        vertical: format.vertical,
        justifyLastLine: format.justifyLastLine,
        wrapText: format.wrapText,
        shrinkToFit: format.shrinkToFit,
        readingOrder: format.readingOrder,
        textRotation: format.textRotation,
    };
}

/**
 * The alignment `values` lays over the selected cells: the parts that differ
 * from `seed`, the active cell's, or `null` where none does. An indent goes
 * only with Left, Right and Distributed, and Justify distributed only with
 * Distributed, as in Excel's dialog, so any other alignment takes them away.
 */
export function cellAlignmentPatch(seed: CellAlignmentValues, values: CellAlignmentValues): GridCellAlignment | null {
    const indent = INDENTED.has(values.horizontal) ? values.indent : 0;
    const justifyLastLine = values.horizontal === "distributed" && values.justifyLastLine;
    const patch: GridCellAlignment = {};
    if (values.horizontal !== seed.horizontal) patch.horizontal = values.horizontal;
    if (indent !== seed.indent) patch.indent = indent;
    if (values.vertical !== seed.vertical) patch.vertical = values.vertical;
    if (justifyLastLine !== seed.justifyLastLine) patch.justifyLastLine = justifyLastLine;
    if (values.wrapText !== seed.wrapText) patch.wrapText = values.wrapText;
    if (values.shrinkToFit !== seed.shrinkToFit) patch.shrinkToFit = values.shrinkToFit;
    if (values.readingOrder !== seed.readingOrder) patch.readingOrder = values.readingOrder;
    if (values.textRotation !== seed.textRotation) patch.textRotation = values.textRotation;
    return Object.keys(patch).length > 0 ? patch : null;
}
