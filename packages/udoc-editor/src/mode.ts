// The editor's modes: view mode, udoc-ui's, and edit mode, the one it adds.
import type { Feature } from "@docmentis/udoc-wasm";

/**
 * The editor's top-level mode — what the user is doing *to* the document. Mode
 * scopes which commands the toolbar offers and how the pointer behaves; it is
 * usually fixed by the host before the editor is shown.
 *
 * - `view` — reading: navigation, filling in a form, and a PDF's annotations
 *   (its Annotate tab).
 * - `edit` — full content authoring (Office "select + insert" model).
 */
export type EditorMode = "view" | "edit";

/** Canonical render order for the mode switcher. */
export const ALL_MODES: readonly EditorMode[] = ["view", "edit"];

/** The feature each mode needs, or null for one every session may use. View's
 *  own edits — a form's fields, a PDF's annotations — are gated where they
 *  start, not by the mode. */
const MODE_FEATURES: Record<EditorMode, Feature | null> = {
    view: null,
    edit: "editing",
};

/** Whether a session entitled to `features` may be in `mode`. */
export function modeEntitled(mode: EditorMode, features: readonly Feature[]): boolean {
    const feature = MODE_FEATURES[mode];
    return feature === null || features.includes(feature);
}

/** Edit mode, as the shell knows it: its id and the feature it needs. */
export const EDIT_MODE = { id: "edit", feature: MODE_FEATURES.edit! } as const;
