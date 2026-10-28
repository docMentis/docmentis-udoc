// Edit mode: the editor's extension of udoc-ui's shell.
import { selectionPaint, selectionTextFormat, subscribeSelector } from "@docmentis/udoc-ui/internal";
import type { UIExtension, UIState } from "@docmentis/udoc-ui/internal";
import type { UDocEditorOptions } from "./editor.js";
import { formatCommands } from "./commands.js";
import { CONTEXT_MENU, TABLE_CONTEXT_MENU } from "./context-menu.js";
import { createGrips } from "./grips.js";
import { createModeSwitch } from "./components/ModeSwitch.js";
import { createPaintOptionsModal } from "./components/PaintOptionsModal.js";
import { EditClient } from "./edit-client.js";
import type { EditHost } from "./edit-client.js";
import {
    FORMATTING_MARKS_COMMAND,
    formattingMarksKey,
    mountFormattingMarks,
    setShowFormattingMarks,
} from "./formatting-marks.js";
import { createI18n, MESSAGE_PACKS } from "./i18n/index.js";
import { insertCommands, insertImage, pickImage, place, placedShape } from "./insert.js";
import { runEditMenuAction } from "./menu-action.js";
import type { EditMenuAction } from "./menu-action.js";
import { mountNewSlide, newSlideCommand } from "./new-slide.js";
import type { NewSlide } from "./new-slide.js";
import { mountPageControls, PAGE_CONTROLS_SPACING, pageControlsShown } from "./page-controls.js";
import { ALL_MODES, EDIT_MODE } from "./mode.js";
import type { EditorMode } from "./mode.js";
import { editState, INITIAL_EDIT_STATE, updateEditState } from "./state.js";
import { createRuler, rulerShown, setShowRuler } from "./ruler.js";
import { selectionRuler } from "./ruler-edits.js";
import { editorStyles } from "./styles.js";
import { editTabs } from "./tabs.js";
import { createEditTools } from "./tools.js";
import type { EditTools } from "./tools.js";

/** Edit mode: the shell's extension, and the calls `UDocEditor` makes of it once mounted. */
export interface EditMode extends UIExtension {
    /** Show or hide formatting marks; see `UDocEditor.setShowFormattingMarks`. */
    setShowFormattingMarks(visible: boolean): void;
    /** Show or hide the page ruler; see `UDocEditor.setShowRuler`. */
    setShowRuler(visible: boolean): void;
    /** The mode the editor is in; see `UDocEditor.mode`. */
    currentMode(): EditorMode;
    /** Switch to `mode`; see `UDocEditor.setMode`. */
    setMode(mode: EditorMode): void;
    /** Insert an image file as a picture; see `UDocEditor.insertImage`. */
    insertImage(bytes: Uint8Array, contentType: string): Promise<void>;
}

/**
 * Keep the document-derived parts of edit mode's state in step with the open
 * document: the theme palette and font families pulled on open, the palette
 * again per slide, both cleared while nothing is open, and the selection's
 * resolved format mirrored from each selection report. Returns the teardown.
 */
function mountDocumentState(host: EditHost): () => void {
    const { store, client, edit } = host;

    // Pull the current slide's resolved theme palette from the engine (the color
    // picker's "Theme Colors"; the color dropdowns map it to swatches). Null for
    // doc types without a theme, which keeps the picker's stand-in.
    const refreshThemePalette = async (): Promise<void> => {
        updateEditState(store, { themePalette: await edit.themePalette() });
    };

    // Pull the open document's available font families (the engine's font
    // registry) — the Text tab's font picker lists them. Empty for a doc type
    // with no text font registry (PDF/image). Per-document, so pulled once on
    // open (unlike the theme palette, which re-pulls per slide), and the whole
    // list is stable across the session, so it's cached from there.
    const refreshFontFamilies = async (): Promise<void> => {
        updateEditState(store, { fontFamilies: await edit.fontFamilySummaries() });
        updateEditState(store, { loadedFontFamilyNames: await edit.loadedFontFamilyNames() });
    };

    const unsubs = [
        // A document opening or closing drops the last one's palette and fonts.
        subscribeSelector(
            store,
            (s) => s.status,
            (status) => {
                if (status === "loading" || status === "empty") {
                    updateEditState(store, { themePalette: null, fontFamilies: [], loadedFontFamilyNames: [] });
                }
            },
        ),
        // Each opened document: its palette and its font list — async, off the
        // open's critical path.
        subscribeSelector(
            store,
            (s) => s.docGeneration,
            () => {
                void refreshThemePalette();
                void refreshFontFamilies();
            },
        ),
        // Re-pull the theme palette when the viewed slide changes: a
        // multi-master deck (or a slide with a `clrMapOvr`) re-themes per slide,
        // so the picker's "Theme Colors" must track the current slide.
        // Presentations only — a word document carries one theme, pulled once
        // at open; it never re-themes per page.
        subscribeSelector(
            store,
            (s) => s.pageIndex,
            () => {
                if (store.getState().docType === "presentation") void refreshThemePalette();
            },
        ),
        // Mirror the selection's resolved character format onto the Text tab,
        // and its color per channel onto the Fill / Line / Text Color dropdowns
        // — projected from the engine's selection properties, every report.
        client.onSelection((state) =>
            updateEditState(store, {
                selectionText: selectionTextFormat(state.properties),
                selectionPaint: selectionPaint(state.properties),
                selectionRuler: selectionRuler(state.properties),
            }),
        ),
    ];
    return () => {
        for (const unsub of unsubs) unsub();
    };
}

/** Whether the engine draws edit mode's authoring view in `s`. */
function editing(s: UIState): boolean {
    return s.mode === "edit";
}

/**
 * Keep the engine drawing what only editing shows: objects that run off the
 * page, and the prompts in empty placeholders. Both are sticky in the worker
 * and start off, so pushed at once too. Returns the teardown.
 */
function mountEditingView(host: EditHost): () => void {
    const { store, edit } = host;
    const show = (on: boolean): void => {
        // Objects that run off the page show only while editing; the engine
        // applies it only in single-page view (where a stray object has no
        // neighbours to spill over), so the other modes — and continuous —
        // read as a clean page.
        edit.setOverflowVisible(on);
        // Empty-placeholder prompts (dashed frame + "Click to add …") are an
        // editing affordance, so a document opened for reading shows none.
        // Only presentations draw prompts, so this is a no-op for other doc
        // types.
        edit.setPlaceholderPrompts(on);
    };
    show(editing(store.getState()));
    return subscribeSelector(store, editing, show);
}

/** Edit mode, as `options` configure it. */
export function editMode(options: UDocEditorOptions): EditMode {
    const i18n = createI18n(options.locale, options.translations);
    // The modes the host allows — every one unless it narrows them — and the
    // one the editor opens in: the host's, if allowed, else the first allowed.
    const allowedModes = options.allowedModes && options.allowedModes.length > 0 ? options.allowedModes : ALL_MODES;
    const requestedMode = options.initialMode ?? "edit";
    const initialMode = allowedModes.includes(requestedMode) ? requestedMode : allowedModes[0]!;
    const showPageControls = options.showPageControls ?? true;
    // What the shell lends, and what edit mode builds on it, from the mount on.
    let host: EditHost | null = null;
    let tools: EditTools | null = null;
    let newSlide: NewSlide | null = null;
    const grips = createGrips(() => tools);
    const ruler = createRuler(() => host);
    const mountedTools = (): EditTools => {
        if (!tools) throw new Error("udoc: edit mode is not mounted");
        return tools;
    };
    return {
        styles: editorStyles,
        messages: MESSAGE_PACKS,
        mode: EDIT_MODE,
        initialMode,
        initialState: {
            ...INITIAL_EDIT_STATE,
            showRuler: options.showRuler ?? INITIAL_EDIT_STATE.showRuler,
            allowedModes,
            showModeSwitch: options.showModeSwitch ?? allowedModes.length > 1,
        },
        tabs: editTabs,
        commands: {
            ...formatCommands(mountedTools),
            formattingMarks: FORMATTING_MARKS_COMMAND,
            createSlide: newSlideCommand(() => void newSlide?.open()),
            ...insertCommands(() => {
                if (host) pickImage(host);
            }),
        },
        spacing: (state) => (showPageControls && pageControlsShown(state) ? PAGE_CONTROLS_SPACING : null),
        keydown(e) {
            if (host) formattingMarksKey(e, host.store);
        },
        menuAction(action) {
            if (tools) runEditMenuAction(tools, action as EditMenuAction);
        },
        // Edit mode's acts on the selection, a table's rows added over one; view
        // mode keeps the shell's.
        contextMenuItems: (state, inTable) => (editing(state) ? (inTable ? TABLE_CONTEXT_MENU : CONTEXT_MENU) : null),
        guideBand: (state) => (rulerShown(state) ? ruler : null),
        placedShape,
        selectionChrome: grips.chrome,
        pressCanvas: (x, y, _ev, canvas) => grips.press(x, y, canvas),
        canvasCursor: (x, y) => grips.cursor(x, y),
        place: (tool, page, p0, p1) => (host ? place(host, tool, page, p0, p1) : Promise.resolve()),
        mount(lent) {
            // What the shell lends, with edit mode's own client over the worker.
            const mounted: EditHost = { ...lent, edit: new EditClient(lent.client) };
            host = mounted;
            tools = createEditTools(mounted, i18n);
            const modeSwitch = createModeSwitch(i18n);
            modeSwitch.mount(mounted.modeSlot, mounted.store);
            const paintOptionsModal = createPaintOptionsModal(i18n);
            paintOptionsModal.mount(mounted.root);
            const unmountDocumentState = mountDocumentState(mounted);
            const unmountEditingView = mountEditingView(mounted);
            const unmountPageControls = showPageControls ? mountPageControls(mounted, i18n) : null;
            const unmountFormattingMarks = mountFormattingMarks(mounted);
            newSlide = mountNewSlide(mounted, i18n);
            return () => {
                newSlide?.destroy();
                newSlide = null;
                unmountFormattingMarks();
                unmountPageControls?.();
                unmountEditingView();
                unmountDocumentState();
                tools?.clipboard.destroy();
                paintOptionsModal.destroy();
                modeSwitch.destroy();
                tools = null;
                host = null;
            };
        },
        setShowFormattingMarks(visible) {
            if (host) setShowFormattingMarks(host.store, visible);
        },
        setShowRuler(visible) {
            if (host) setShowRuler(host.store, visible);
        },
        currentMode() {
            return (host?.store.getState().mode ?? initialMode) as EditorMode;
        },
        setMode(mode) {
            // Ignored outside the host's modes; the shell ignores one the
            // session isn't entitled to.
            if (host && editState(host.store.getState()).allowedModes.includes(mode)) {
                host.store.dispatch({ type: "SET_MODE", mode });
            }
        },
        insertImage(bytes, contentType) {
            return host ? insertImage(host, bytes, contentType) : Promise.resolve();
        },
    };
}
