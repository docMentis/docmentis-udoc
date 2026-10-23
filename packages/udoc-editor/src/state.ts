// Edit mode's own state, kept in the shell's store as `UIState.extension`, so it
// changes and is read as the rest of the state is.
import type { FontFamilySummary } from "@docmentis/udoc-wasm";
import { EMPTY_SELECTION_PAINT, EMPTY_SELECTION_TEXT_FORMAT } from "@docmentis/udoc-ui/internal";
import type {
    Action,
    CommandContext,
    SelectionPaint,
    SelectionTextFormat,
    Store,
    ThemePalette,
    UIState,
} from "@docmentis/udoc-ui/internal";
import { ALL_MODES } from "./mode.js";
import type { EditorMode } from "./mode.js";

export interface EditState {
    /**
     * Whether formatting marks (`¶`, a dot per space, a tab's arrow, `↵`) are
     * drawn over the text — the ribbon's Show Formatting Marks toggle. A user
     * preference, off by default; the marks are editing chrome, so what reaches
     * the engine is `showFormattingMarks` in edit mode on a wordprocessing
     * document.
     */
    showFormattingMarks: boolean;

    /**
     * Whether the page ruler is shown (paged doc types — PDF / DOCX / PPTX). A
     * user preference the host toggles; the ruler is additionally suppressed in
     * `view` mode (a reading pose needs no measurement chrome). A spreadsheet's
     * row/column headers are essential and never gated by this.
     */
    showRuler: boolean;

    /**
     * The current slide's resolved theme color palette (the picker's "Theme
     * Colors"), or null with no document open or for doc types without a theme
     * (only presentations carry one). Pulled on open and on slide change; the
     * color dropdowns map it to swatches for the picker.
     */
    themePalette: ThemePalette | null;

    /**
     * Every available font family, sorted by name — the Text tab's font picker
     * list. Each carries its name and its `sourceType`, which is what a picker
     * showing specimens needs: the browser can draw a `Local` / `Url` /
     * `Google` family in its own face, and the rest have no bytes outside wasm.
     * Not the faces — nothing here reads them, and at ~1800 families they are
     * three quarters of what would cross.
     *
     * Stable across the session (only opening a document changes it), so it's
     * pulled **once** on open and cached. Empty with no document open or for a
     * doc type with no text font registry (PDF/image).
     */
    fontFamilies: readonly FontFamilySummary[];

    /**
     * The subset of {@link fontFamilies} that is loaded — parsed and in hand —
     * which the picker lists first, above a divider.
     *
     * Re-pulled whenever the picker opens rather than cached with the full list:
     * fonts materialize lazily, so this grows through the session as the
     * document composes and as fonts are picked, while the full list stays put.
     */
    loadedFontFamilyNames: readonly string[];

    /**
     * The current selection's resolved character format (font / bold / italic)
     * — the Text tab mirrors it. Pushed from the worker's selection reports,
     * projected from the engine's selection properties; never derived here.
     * `EMPTY_SELECTION_TEXT_FORMAT` with no document open, a non-text
     * selection, or none.
     */
    selectionText: SelectionTextFormat;

    /**
     * The current selection's resolved color per channel (fill / stroke / text)
     * — the Fill / Line / Text Color dropdowns swatch it. Pushed from the
     * worker's selection reports, projected from the engine's selection
     * properties; never derived here. `EMPTY_SELECTION_PAINT` with no document
     * open, a channel the doc type doesn't surface, or none.
     */
    selectionPaint: SelectionPaint;

    /** The modes the host lets the user switch between (drives the mode
     *  switcher, which offers those the session is entitled to —
     *  `modeEntitled`). */
    allowedModes: readonly EditorMode[];

    /** Whether the mode switcher is shown (host override; default
     *  `allowedModes.length > 1`). */
    showModeSwitch: boolean;

    /** Whether the Align dropdown aligns to the page/slide instead of the
     *  selection's own bounds (the "Align to page" toggle). Sticky across menu
     *  opens so the chosen reference persists. */
    alignToPage: boolean;
}

/** Edit mode's state at start. */
export const INITIAL_EDIT_STATE: EditState = {
    showFormattingMarks: false,
    showRuler: true,
    themePalette: null,
    fontFamilies: [],
    loadedFontFamilyNames: [],
    selectionText: EMPTY_SELECTION_TEXT_FORMAT,
    selectionPaint: EMPTY_SELECTION_PAINT,
    allowedModes: ALL_MODES,
    showModeSwitch: true,
    alignToPage: false,
};

/** Edit mode's state in `state`. */
export function editState(state: UIState): EditState {
    return state.extension as EditState;
}

/** Edit mode's state in a command's context — what its predicates read. */
export function editStateOf(context: CommandContext): EditState {
    return context.extension as EditState;
}

/** Change edit mode's state in `store` by `change`. */
export function updateEditState(store: Store<UIState, Action>, change: Partial<EditState>): void {
    store.dispatch({ type: "SET_EXTENSION_STATE", extension: { ...editState(store.getState()), ...change } });
}
