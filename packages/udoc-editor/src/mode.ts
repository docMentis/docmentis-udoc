// The editor's modes: view mode, udoc-ui's, and edit and review mode, the ones
// it adds.
import type { Feature, UDocType } from "@docmentis/udoc-wasm";
import type { ExtensionMode } from "@docmentis/udoc-ui/internal";

/**
 * The editor's top-level mode — what the user is doing *to* the document. Mode
 * scopes which commands the toolbar offers and how the pointer behaves; it is
 * usually fixed by the host before the editor is shown.
 *
 * - `view` — reading: navigation, filling in a form, a PDF's annotations
 *   (its Annotate tab), and a document's comments.
 * - `edit` — full content authoring (Office "select + insert" model).
 * - `review` — a Word document's edits, each recorded as a tracked change
 *   under the user's name, which others accept or reject. An edit that can't
 *   be recorded isn't offered. Only a Word document opens in it: another
 *   opens in `edit` where the host allows it, else in `view`.
 */
export type EditorMode = "view" | "edit" | "review";

/** Canonical render order for the mode switcher. */
export const ALL_MODES: readonly EditorMode[] = ["view", "edit", "review"];

/** The feature each mode needs, or null for one every session may use. View's
 *  own edits — a form's fields, a PDF's annotations, a document's comments —
 *  are gated where they start, not by the mode. */
const MODE_FEATURES: Record<EditorMode, Feature | null> = {
    view: null,
    edit: "editing",
    review: "editing",
};

/** The doc types each mode is open to, or null for every one: review records
 *  tracked changes, which only a word document has. */
const MODE_DOC_TYPES: Record<EditorMode, readonly UDocType[] | null> = {
    view: null,
    edit: null,
    review: ["wordprocessing"],
};

/** Whether a session entitled to `features` may be in `mode`. */
export function modeEntitled(mode: EditorMode, features: readonly Feature[]): boolean {
    const feature = MODE_FEATURES[mode];
    return feature === null || features.includes(feature);
}

/** Whether `mode` is open to a document of `docType`, or with none open. */
export function modeOpen(mode: EditorMode, docType: UDocType | null): boolean {
    const docTypes = MODE_DOC_TYPES[mode];
    return docType === null || docTypes === null || docTypes.includes(docType);
}

/** Whether `mode` edits the document: edit and review mode. */
export function editsDocument(mode: string): boolean {
    return mode === "edit" || mode === "review";
}

/** Edit and review mode, as the shell knows them, in a session `allowed`
 *  these modes: review gives way to edit where it isn't open, if edit is
 *  allowed, else to view. */
export function extensionModes(allowed: readonly EditorMode[]): readonly ExtensionMode[] {
    return [
        { id: "edit", feature: MODE_FEATURES.edit! },
        {
            id: "review",
            feature: MODE_FEATURES.review!,
            docTypes: MODE_DOC_TYPES.review!,
            ...(allowed.includes("edit") ? { otherwise: "edit" } : {}),
        },
    ];
}
