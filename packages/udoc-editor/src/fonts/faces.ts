/**
 * Which faces a font change will actually have to render in.
 *
 * A selection is rarely one face. Applying a family to a paragraph with a bold
 * word in it produces text in *two* faces, and each is a separate binary — get
 * only the regular one and the bold word still lays out in a stand-in and
 * reflows when its own download lands, which is the whole thing the preload
 * exists to avoid.
 *
 * The engine already answers this, in the form the ribbon's B / I buttons show:
 * it folds the selection's resolved runs into a consensus per axis, and
 * `"mixed"` means both values are present. That fold is a real walk over the
 * composed runs, so `"mixed"` is a fact about the text, not a guess.
 */

import type { TextFormatState } from "@docmentis/udoc-ui/internal";

/**
 * The `(bold, italic)` faces to get here before applying a family.
 *
 * One face for a uniform selection, two when one axis is mixed, four when both
 * are. Four is an **over-approximation**: a selection that is mixed on both axes
 * need not contain all four combinations (bold text and italic text, but nothing
 * bold-italic). Narrowing it would mean a new engine read of the distinct faces
 * rather than the per-axis fold, and the cost of being wrong is one extra font
 * fetched — the same fetch that would have happened anyway if the selection did
 * span it.
 */
export function facesToLoad(bold: TextFormatState, italic: TextFormatState): Array<[boolean, boolean]> {
    const faces: Array<[boolean, boolean]> = [];
    for (const isBold of values(bold)) {
        for (const isItalic of values(italic)) faces.push([isBold, isItalic]);
    }
    return faces;
}

/** The values one axis takes across the selection. */
function values(state: TextFormatState): boolean[] {
    return state === "mixed" ? [false, true] : [state === "on"];
}
