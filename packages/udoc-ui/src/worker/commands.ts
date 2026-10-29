// Builders for the doc-type-tagged `UDocCommand` the `execute` seam takes — the
// single edit path that replaced the per-verb wall. They return the typed
// command object; serialization to JSON happens once, at the wasm boundary
// (`session.execute(JSON.stringify(cmd))`). The command shapes are typed against
// the types tsify declares from the Rust source in the wasm's `udoc.d.ts`, so a
// command that drifts from the Rust serde — a
// renamed field, a new required field, a changed variant — fails to compile here
// instead of erroring at the wasm boundary at runtime.

import type {
    AcroFormField,
    AcroFormFieldFill,
    Annotation,
    PortableCommand,
    PresentationCommand,
    SpreadsheetCommand,
    StandardFont,
    UDocCommand,
} from "@docmentis/udoc-wasm";

/** A large insert index that clamps to "append on top" in the engine (kept well
 *  inside the safe-integer range so it serializes as a plain `usize`). */
const APPEND_INDEX = 0x7fff_ffff;

/** Wrap a portable command in the doc-type-tagged `UDocCommand`. */
function portable(command: PortableCommand): UDocCommand {
    return { portable: command };
}

/** Wrap a presentation command in the doc-type-tagged `UDocCommand`. */
function presentation(command: PresentationCommand): UDocCommand {
    return { presentation: command };
}

/** Wrap a spreadsheet command in the doc-type-tagged `UDocCommand`. */
function spreadsheet(command: SpreadsheetCommand): UDocCommand {
    return { spreadsheet: command };
}

/** Command builders for the document-structure edits the host issues by index —
 *  annotation insert, update and text, form fill-in, a deck's section names,
 *  and a spreadsheet's column / row sizes.
 *
 *  Selection-relative object/shape edits (move, delete, align, group, flip, …)
 *  are **not** here: the caller emits those format-blind, the worker tags them
 *  with the open doc type into a `UDocSelectionEdit` for `session.executeOnSelection`,
 *  and the open document's engine binds them to the right command in Rust (the id
 *  resolution the worker's old `runOnSelection` did). */
export const Command = {
    /** Insert host-built `annotations` on top of `pageId`'s — each with no id and
     *  no appearance, which the engine mints and generates. */
    insertAnnotations: (pageId: string, annotations: Annotation[]): UDocCommand =>
        portable({
            editAnnotation: {
                page: pageId,
                command: { insertAnnotations: { index: APPEND_INDEX, annotations } },
            },
        }),

    /** Replace the annotations on `pageId` that `annotations` name by id with
     *  those values — one sent without an appearance gets one generated. */
    updateAnnotations: (pageId: string, annotations: Annotation[]): UDocCommand =>
        portable({ editAnnotation: { page: pageId, command: { updateAnnotations: { annotations } } } }),

    /** Delete the annotations on `pageId` that `ids` name, with what answers
     *  them — their replies, state notes and group members, and theirs in turn.
     *  A locked one is skipped. */
    deleteAnnotations: (pageId: string, ids: string[]): UDocCommand =>
        portable({ editAnnotation: { page: pageId, command: { deleteAnnotations: { ids } } } }),

    /** Add the standard font `font` to the document's font list as the font
     *  `id`, which the host minted — before a free text names it in its `/DA`. */
    addStandardFont: (id: string, font: StandardFont): UDocCommand => portable({ addStandardFont: { id, font } }),

    /** Set the text of annotation `id` on `pageId` from `richContents` (XHTML):
     *  its `/RC` and `/Contents` together, modified at `modified` (a PDF date).
     *  Its appearance is generated afresh where it shows the text. */
    setAnnotationRichContents: (pageId: string, id: string, richContents: string, modified: string): UDocCommand =>
        portable({
            editAnnotation: {
                page: pageId,
                command: { setAnnotationRichContents: { id, richContents: richContents, modified } },
            },
        }),

    /** Fill in each of `fields` — the form's field its id names takes the
     *  value given — and show it on its widgets. A read-only field and a value
     *  of another type than its field's are skipped. */
    fillAcroFormFields: (fields: AcroFormFieldFill[]): UDocCommand => portable({ fillAcroFormFields: { fields } }),

    /** Replace each of `fields` — the form's field its id names — with the
     *  field given, whole, and show it on its widgets. A read-only field and a
     *  signature field are skipped. */
    updateAcroFormFields: (fields: AcroFormField[]): UDocCommand => portable({ updateAcroFormFields: { fields } }),

    /** Rename the deck's section `id` to `name`. */
    renameSlideSection: (id: string, name: string): UDocCommand =>
        presentation({ editSlideSection: { command: { renameSlideSection: { id, name } } } }),

    /** Delete the deck's sections `ids`, and with them their slides where
     *  `withSlides` is set; kept, each section's slides join the one before
     *  it. Every section, keeping the slides, is Remove All Sections. */
    deleteSlideSections: (ids: string[], withSlides: boolean): UDocCommand =>
        presentation({ editSlideSection: { command: { deleteSlideSections: { ids, withSlides } } } }),

    /** Resize columns `first..=last` (0-based inclusive) on sheet `sheetId` to
     *  `points` document points (PostScript points, 1/72 inch — *not* pixels): a
     *  header-boundary drag, the pixel drag divided by the viewport's
     *  CSS-px-per-point scale. The engine converts to the model's stored character
     *  units. */
    resizeColumns: (sheetId: string, first: number, last: number, points: number): UDocCommand =>
        spreadsheet({ resizeColumns: { sheet: sheetId, first, last, width: { points: points } } }),

    /** Resize rows `first..=last` (0-based inclusive) on sheet `sheetId` to
     *  `points` document points (1/72 inch) — the row twin of
     *  {@link resizeColumns}. Row heights are already points, stored as an exact
     *  (custom) height. */
    resizeRows: (sheetId: string, first: number, last: number, points: number): UDocCommand =>
        spreadsheet({ resizeRows: { sheet: sheetId, first, last, height: { exact: points } } }),
};
