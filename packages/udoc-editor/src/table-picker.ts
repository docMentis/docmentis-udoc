// The sizing behind Insert Table's grid, apart from the grid itself: which
// table a cell of it stands for, and which cells light for a size.

/** The grid's size: the largest table it inserts, as Word's and PowerPoint's. */
export const PICKER_ROWS = 8;
export const PICKER_COLUMNS = 10;

/** A table's size, in rows and columns. */
export interface TableSize {
    rows: number;
    columns: number;
}

/** The size the grid's cell at `row`, `column` (0-based) stands for: every cell
 *  up to it and left of it, inclusive. */
export function pickedSize(row: number, column: number): TableSize {
    return { rows: row + 1, columns: column + 1 };
}

/** Whether the grid's cell at `row`, `column` lies inside `size`, so it lights. */
export function inSize(size: TableSize | null, row: number, column: number): boolean {
    return size !== null && row < size.rows && column < size.columns;
}
