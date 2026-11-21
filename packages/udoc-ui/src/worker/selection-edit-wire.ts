// A selection edit as the engine's `executeOnSelection` takes it: the shell's
// flat, family-named edit wrapped in its doc type's own tags.

import type { UDocSelectionEdit, UDocType } from "@docmentis/udoc-wasm";
import type { SelectionEdit, SelectionEditFamily } from "./protocol.js";

/** Tag a format-blind {@link SelectionEdit} with the open document's doc-type
 *  variant, producing the `UDocSelectionEdit` the typed `executeOnSelection`
 *  boundary takes — the selection-edit twin of the worker's command
 *  marshalling. The open doc type fixes the variant — it *is* the tag.
 *
 *  The wire form is externally tagged at every level, so this also turns the
 *  shell's flat `{ family, kind, …fields }` into it: the kind becomes the key,
 *  wrapped in whatever the doc type holds the family under ({@link FAMILY_WRAPS})
 *  — `{ presentation: { common: { text: { insertText: { text } } } } }` for a
 *  slide's text, the same text edit under a PDF's annotation for a free text's.
 *  An edit still names what to do, never where: the engine binds it to its own
 *  selection, however deep the caret sits. */
export function taggedSelectionEdit(edit: SelectionEdit, docType: UDocType | undefined): UDocSelectionEdit {
    const tag = docType ?? "portable";
    let wire = byKind(edit);
    if ("family" in edit) {
        const wraps = FAMILY_WRAPS[tag][edit.family];
        if (!wraps) throw new Error(`engine worker: a ${tag} document takes no ${edit.family} edit`);
        wire = wraps.reduceRight((inner, wrap) => wrap(inner), wire);
    }
    return { [tag]: wire } as UDocSelectionEdit;
}

/** A flat `{ family, kind, …fields }` edit's own wire form: keyed by its kind —
 *  `{ insertText: { text } }` — or the bare kind when it carries no fields. */
function byKind(edit: SelectionEdit): unknown {
    const { kind, ...fields } = edit as { kind: string; family?: string };
    delete fields.family;
    return Object.keys(fields).length === 0 ? kind : { [kind]: fields };
}

/** One level of a doc type's selection edit around a family's: a struct
 *  variant's `{ tag: { edit } }` or a newtype's `{ tag: … }`, as the engine's
 *  enums declare it. */
type Wrap = (inner: unknown) => unknown;
const field =
    (tag: string): Wrap =>
    (inner) => ({ [tag]: { edit: inner } });
const newtype =
    (tag: string): Wrap =>
    (inner) => ({ [tag]: inner });

/** The drawing families, each under its own tag inside the `common` union,
 *  which `outer` wraps. */
function drawing(...outer: Wrap[]): Record<"text" | "table" | "shape", Wrap[]> {
    return {
        text: [...outer, newtype("text")],
        table: [...outer, newtype("table")],
        shape: [...outer, newtype("shape")],
    };
}

/** Where each doc type holds each family it takes, outermost first. A family a
 *  doc type has no entry for is one it takes no edit of. */
const FAMILY_WRAPS: Record<UDocType, Partial<Record<SelectionEditFamily, readonly Wrap[]>>> = {
    portable: {
        page: [field("page")],
        object: [field("object")],
        annotation: [field("annotation")],
        ...drawing(field("annotation"), field("common")),
    },
    image: { page: [field("page")], ...drawing(field("common")) },
    presentation: {
        slide: [newtype("slide")],
        slideSection: [newtype("slideSection")],
        ...drawing(newtype("common")),
    },
    wordprocessing: { section: [newtype("section")], ...drawing(newtype("common")) },
    spreadsheet: { worksheet: [field("worksheet")] },
};
