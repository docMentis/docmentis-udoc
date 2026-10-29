// Where a drag drops the selected pages in the thumbnails — the `to` a
// page or slide reorder edit names.

/**
 * Where the `selected` pages land when dropped at `gap` — the index of the
 * page the drop sits above, the page count for the end — as `to`, the index
 * the first of them takes in the resulting order: the gap less the selected
 * pages above it, since they land as one run in document order. `null` when the
 * drop leaves them where they are: one run, with the gap inside it or at
 * either end of it — unless it `regroups` them, into a deck's other section,
 * which moves them even there.
 */
export function reorderTo(selected: readonly number[], gap: number, regroups = false): number | null {
    if (selected.length === 0) return null;
    const first = Math.min(...selected);
    const last = Math.max(...selected);
    if (!regroups && last - first + 1 === selected.length && gap >= first && gap <= last + 1) return null;
    return gap - selected.filter((page) => page < gap).length;
}
