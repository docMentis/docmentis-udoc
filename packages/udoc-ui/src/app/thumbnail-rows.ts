// The rows of the thumbnail strip: each page's thumbnail and, in a deck with
// sections, each section's header above its slides.

import type { SlideSectionRun } from "../worker/protocol.js";

/** One row of the strip: page `page`'s thumbnail, or the header of section
 *  `section` — its index in the deck's sections. */
export type ThumbnailRow = { kind: "page"; page: number } | { kind: "section"; section: number };

/**
 * The strip's rows for `pageCount` pages grouped in `sections`, in page order:
 * each section's header above the first of its pages, an empty one's where it
 * sits, and the pages of a section in `collapsed` left out. A page no section
 * holds is a row of its own.
 */
export function thumbnailRows(
    pageCount: number,
    sections: readonly SlideSectionRun[],
    collapsed: ReadonlySet<string>,
): ThumbnailRow[] {
    const rows: ThumbnailRow[] = [];
    let next = 0;
    /** The pages from here up to `hiddenEnd` are a collapsed section's. */
    let hiddenEnd = 0;
    for (let page = 0; page <= pageCount; page++) {
        // The headers of the sections starting here, and at the end those of
        // any that start past the last page.
        while (next < sections.length && (sections[next]!.start <= page || page === pageCount)) {
            const section = sections[next]!;
            rows.push({ kind: "section", section: next });
            if (collapsed.has(section.id)) hiddenEnd = Math.max(hiddenEnd, section.start + section.count);
            next++;
        }
        if (page < pageCount && page >= hiddenEnd) rows.push({ kind: "page", page });
    }
    return rows;
}

/**
 * Where each page shows in `rows`: the index of its row, or of the header of
 * the collapsed section that hides it — for each of `pageCount` pages. `-1`
 * for a page no row shows.
 */
export function pageRows(
    pageCount: number,
    rows: readonly ThumbnailRow[],
    sections: readonly SlideSectionRun[],
): number[] {
    const at = new Array<number>(pageCount).fill(-1);
    rows.forEach((row, index) => {
        if (row.kind === "page") {
            at[row.page] = index;
            return;
        }
        const { start, count } = sections[row.section]!;
        for (let page = start; page < Math.min(start + count, pageCount); page++) {
            if (at[page] === -1) at[page] = index;
        }
    });
    return at;
}
