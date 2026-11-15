// The tags written in a document's text — `{{customer.name}}`, `{{#fund in
// funds}}` — as the right panel's Data tab lists them: found by a search of the
// text, and gathered by what is written inside their braces.
import type { SearchMatch, SearchOptions } from "@docmentis/udoc-wasm";

/** What the text is searched for: two braces, then anything but a brace or a
 *  quote, or text in quotes — which may hold braces, as `{{"{{"}}` does — then
 *  two braces again. */
export const DATA_TAG_PATTERN = '\\{\\{(?:[^{}"]|"[^"]*")*\\}\\}';

/** How {@link DATA_TAG_PATTERN} is searched for: as a regular expression, over
 *  the text as it is written. */
export const DATA_TAG_SEARCH: SearchOptions = { caseSensitive: true, fuzzy: false, regex: true };

/** One tag the text holds, and every place it is written. */
export interface DataTag {
    /** What is written inside its braces, without the spaces around it:
     *  `customer.name` for `{{ customer.name }}`. */
    tag: string;
    /** The matches it is written at, in the order the search found them. */
    matches: readonly SearchMatch[];
}

/** What `match` holds inside its braces, without the spaces around it. */
export function tagText(match: SearchMatch): string {
    return match.context[1].slice(2, -2).trim();
}

/**
 * The tags `matches` are of, each once, in the order the text first holds them,
 * each with its matches in the order they came. Two matches are of one tag when
 * what is written inside their braces is the same but for the spaces around it.
 */
export function groupDataTags(matches: readonly SearchMatch[]): DataTag[] {
    const byTag = new Map<string, SearchMatch[]>();
    for (const match of matches) {
        const tag = tagText(match);
        const at = byTag.get(tag);
        if (at) at.push(match);
        else byTag.set(tag, [match]);
    }
    return [...byTag].map(([tag, at]) => ({ tag, matches: at }));
}
