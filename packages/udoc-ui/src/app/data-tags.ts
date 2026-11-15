// The tags written in a deck's text, as the right panel's Data tab lists them:
// read by the engine (`presentation.model.automation.tags`), then gathered by
// what each binds — a variable by its path, a repeat, a condition or a choice by
// its opening tag — with the tags that are wrong apart.
import type { SlideTag } from "@docmentis/udoc-wasm";

/** One binding the text holds — a variable, or a pair's opening tag — and every
 *  tag that writes it. */
export interface DataEntry {
    /** How the panel names it: a variable's path, `customer.name`, or a pair's
     *  opening tag inside its braces, `#fund in funds`, `#if not fund.closed`,
     *  `#choose fund.rating`. */
    name: string;
    /** The tags that write it, in the order the text holds them. */
    tags: readonly SlideTag[];
}

/** The text's tags as the Data panel lists them. */
export interface DataTags {
    /** Each binding once, in the order the text first holds it. */
    entries: readonly DataEntry[];
    /** Each tag that is wrong, as written or where it stands, in order. */
    errors: readonly SlideTag[];
}

/**
 * What the panel names `tag` by — or null for a tag it doesn't list: a pair's
 * closing tag or an option, which belong to the pair they're in, and a literal,
 * which binds nothing.
 */
export function entryName(tag: SlideTag): string | null {
    const read = tag.tag;
    // `otherwise`, the one tag that says nothing more, crosses as a string.
    if (!read || typeof read !== "object") return null;
    if ("variable" in read) return read.variable.path;
    if ("repeat" in read) return `#${read.repeat.item} in ${read.repeat.path}`;
    if ("condition" in read) return `#if ${read.condition.not ? "not " : ""}${read.condition.path}`;
    if ("choice" in read) return `#choose ${read.choice.path}`;
    return null;
}

/** `tags`, as the engine reads them, gathered for the panel: each binding once
 *  with the tags that write it, and the tags that are wrong apart. */
export function groupDataTags(tags: readonly SlideTag[]): DataTags {
    const byName = new Map<string, SlideTag[]>();
    const errors: SlideTag[] = [];
    for (const tag of tags) {
        if (tag.error) {
            errors.push(tag);
            continue;
        }
        const name = entryName(tag);
        if (name === null) continue;
        const at = byName.get(name);
        if (at) at.push(tag);
        else byName.set(name, [tag]);
    }
    return { entries: [...byName].map(([name, at]) => ({ name, tags: at })), errors };
}
