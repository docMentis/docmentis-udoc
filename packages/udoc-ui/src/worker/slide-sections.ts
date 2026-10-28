// A deck's sections as the thumbnails group its slides — each the run of the
// slide order it holds.

import type { SlideSection } from "@docmentis/udoc-wasm";
import type { SlideSectionRun } from "./protocol.js";

/**
 * Each of `sections`, in order, as the run of the slide order `slideIds` it
 * holds: the index of its first slide and how many it holds. An empty section
 * sits where the one before it ends, the first at the start. A slide the deck
 * doesn't list is left out.
 */
export function slideSectionRuns(sections: readonly SlideSection[], slideIds: readonly string[]): SlideSectionRun[] {
    const index = new Map(slideIds.map((id, i) => [id, i]));
    let end = 0;
    return sections.map((section) => {
        const pages = section.slideIds.flatMap((id) => index.get(id) ?? []);
        const start = pages.length > 0 ? Math.min(...pages) : end;
        end = start + pages.length;
        return { id: section.id, name: section.name, start, count: pages.length };
    });
}
