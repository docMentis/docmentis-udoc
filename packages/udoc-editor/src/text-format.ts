// Text formatting: the Text tab's character and paragraph controls over the
// current text selection — a shape's text on a slide, the body caret in a doc —
// the edits they make, and the paragraph menus.
import type { TextCharacterProperty, TextNumberFormat, TextParagraphProperty, UDocType } from "@docmentis/udoc-wasm";
import { allowsTextEdit, profileFor } from "@docmentis/udoc-ui/internal";
import type { EnabledWhen, Message, MenuItem, PaintSpec, UIShellHost } from "@docmentis/udoc-ui/internal";
import { facesToLoad } from "./fonts/faces.js";
import type { I18n, MessageKey } from "./i18n/index.js";
import {
    ICON_INDENT_DECREASE,
    ICON_INDENT_INCREASE,
    ICON_PARAGRAPH_CENTER,
    ICON_PARAGRAPH_JUSTIFY,
    ICON_PARAGRAPH_LEFT,
    ICON_PARAGRAPH_RIGHT,
} from "./icons.js";
import { editAction } from "./menu-action.js";
import { paintToDrawingColor, paintToDrawingFill } from "./paint.js";
import { editState, editStateOf } from "./state.js";

/** A boolean character-style the Text tab toggles — the `b` / `i` / `u` /
 *  `strike` of a span's character properties, and the two directions of its
 *  `baseline`. Superscript and subscript are one field, so turning one on
 *  replaces the other. */
export type TextFormatProperty = "bold" | "italic" | "underline" | "strikethrough" | "superscript" | "subscript";

/** Which of the two list split buttons a command / gallery belongs to. A bullet
 *  and an auto-number are one model field (the numbering level a paragraph
 *  renders) but two toolbar controls, read apart by the level's format — the same
 *  split the engine's `bulleted` / `numbered` consensus makes. */
export type ListKind = "bulleted" | "numbered";

/**
 * One entry in a list split button's gallery — a marker style a paragraph can be
 * put in. Carries the **model** pieces (a numbering level's format and its
 * `%1`-style pattern), not a UI token the shell would have to translate: the host
 * builds the numbering the edit carries.
 */
export interface ListStyle {
    /** Stable key for the split button's last-used memory. */
    id: string;
    /** The row's accessible name. */
    label: MessageKey;
    /** The row's visible sample — the first markers as the list renders them. */
    preview: string;
    format: TextNumberFormat;
    /** The auto-number pattern (`"%1."` → `1.`). Empty for a bullet, whose
     *  character *is* its text. */
    pattern: string;
}

/** The bullet gallery — the characters PowerPoint and Word offer first. The
 *  first entry is what the main button applies until one is picked. */
export const BULLET_STYLES: readonly ListStyle[] = [
    { id: "disc", label: "list.disc", preview: "•", format: { bullet: "•" }, pattern: "" },
    { id: "circle", label: "list.circle", preview: "○", format: { bullet: "○" }, pattern: "" },
    { id: "square", label: "list.square", preview: "▪", format: { bullet: "▪" }, pattern: "" },
    { id: "diamond", label: "list.diamond", preview: "◆", format: { bullet: "◆" }, pattern: "" },
    { id: "arrow", label: "list.arrow", preview: "➤", format: { bullet: "➤" }, pattern: "" },
    { id: "dash", label: "list.dash", preview: "–", format: { bullet: "–" }, pattern: "" },
];

/** The auto-number gallery — the six numberings both suites lead with. */
export const NUMBER_STYLES: readonly ListStyle[] = [
    { id: "decimal", label: "list.decimal", preview: "1. 2. 3.", format: "decimal", pattern: "%1." },
    { id: "decimalParen", label: "list.decimalParen", preview: "1) 2) 3)", format: "decimal", pattern: "%1)" },
    { id: "lowerLetter", label: "list.lowerLetter", preview: "a. b. c.", format: "lowerLetter", pattern: "%1." },
    { id: "upperLetter", label: "list.upperLetter", preview: "A. B. C.", format: "upperLetter", pattern: "%1." },
    { id: "lowerRoman", label: "list.lowerRoman", preview: "i. ii. iii.", format: "lowerRoman", pattern: "%1." },
    { id: "upperRoman", label: "list.upperRoman", preview: "I. II. III.", format: "upperRoman", pattern: "%1." },
];

/** The gallery a list split button's caret opens. */
export function listStyles(list: ListKind): readonly ListStyle[] {
    return list === "bulleted" ? BULLET_STYLES : NUMBER_STYLES;
}

/** The Text tab's character-format controls (font / size / the style toggles /
 *  text color) all write character properties, so they enable exactly when
 *  the selection accepts a text `setCharacterProperties` edit — a non-empty
 *  range in editable text. A bare caret (no spans to restyle) or a non-text
 *  selection leaves them greyed. */
export const whenTextFormat: EnabledWhen = (c) => allowsTextEdit(c.selection, "setCharacterProperties");

/** The Text tab's *paragraph* controls (align / indent / spacing / the two list
 *  toggles). Deliberately **not** {@link whenTextFormat}: a character format
 *  needs spans to cover, so a bare caret leaves it greyed, while a caret is
 *  always *inside* a paragraph — clicking in a line and pressing Center is the
 *  ordinary gesture, so these gate on the paragraph edit instead. */
export const whenParagraphFormat: EnabledWhen = (c) => allowsTextEdit(c.selection, "setParagraphProperties");

/** The Scale dropdown: a character format like {@link whenTextFormat}, on the
 *  one doc type that can hold it — `w:w` is docx's, and DrawingML has no
 *  horizontal glyph scale to write it to. */
export const whenWidthScale: EnabledWhen = (c) => whenTextFormat(c) && c.docType === "wordprocessing";

/** The `TextCharacterProperty` a Text-tab toggle sets for `property` at `on` —
 *  bold / italic / strikethrough are plain booleans; underline carries a style,
 *  where *off* is the explicit "None" that overrides an inherited style.
 *
 *  Superscript and subscript write the `docType`'s own encoding of a
 *  `TextBaselineAlign`: docx's categorical `Superscript` / `Subscript`, pptx's
 *  `Percent` at PowerPoint's values — what a deck's own super/subscripts load
 *  as. *Off* is the explicit `Baseline`, overriding an inherited shift. */
export function textFormatProperty(
    property: TextFormatProperty,
    on: boolean,
    docType: UDocType | null,
): TextCharacterProperty {
    const categorical = docType === "wordprocessing";
    switch (property) {
        case "bold":
            return { bold: on };
        case "italic":
            return { italic: on };
        case "underline":
            return { underline: { style: on ? "single" : "none" } };
        case "strikethrough":
            return { strike: on };
        case "superscript":
            return { baselineAlign: on ? (categorical ? "superscript" : { percent: 0.3 }) : "baseline" };
        case "subscript":
            return { baselineAlign: on ? (categorical ? "subscript" : { percent: -0.25 }) : "baseline" };
    }
}

/** Which side of a paragraph the Line & Paragraph Spacing menu's space switches
 *  govern — `w:spacing@before` / `@after`. */
export type ParagraphSpaceEdge = "before" | "after";

/**
 * The Align & Indent dropdown: the four text alignments as one exclusive set
 * (the row the selection already holds is marked, none when its paragraphs
 * disagree), then the two indent steps below a divider.
 *
 * They share a menu because they answer the same question — *where does this
 * paragraph sit across the column* — and because neither half alone earns a
 * trigger. Every row runs on a bare caret, so the whole menu is
 * {@link whenParagraphFormat}: unlike the character controls beside it, nothing
 * here needs a range.
 */
export const PARAGRAPH_ALIGN_MENU: readonly MenuItem<MessageKey>[] = [
    {
        action: editAction({ kind: "paragraphAlign", align: "left" }),
        label: "paragraph.alignLeft",
        icon: ICON_PARAGRAPH_LEFT,
        enabledWhen: whenParagraphFormat,
        activeWhen: (c) => editStateOf(c).selectionText.align === "left",
    },
    {
        action: editAction({ kind: "paragraphAlign", align: "center" }),
        label: "paragraph.center",
        icon: ICON_PARAGRAPH_CENTER,
        enabledWhen: whenParagraphFormat,
        activeWhen: (c) => editStateOf(c).selectionText.align === "center",
    },
    {
        action: editAction({ kind: "paragraphAlign", align: "right" }),
        label: "paragraph.alignRight",
        icon: ICON_PARAGRAPH_RIGHT,
        enabledWhen: whenParagraphFormat,
        activeWhen: (c) => editStateOf(c).selectionText.align === "right",
    },
    {
        action: editAction({ kind: "paragraphAlign", align: "justify" }),
        label: "paragraph.justify",
        icon: ICON_PARAGRAPH_JUSTIFY,
        enabledWhen: whenParagraphFormat,
        activeWhen: (c) => editStateOf(c).selectionText.align === "justify",
    },
    // Never marked: an indent is a step, not a state — there is no "current"
    // increase for a row to wear. Both stay live at the margin, as in Word: the
    // engine no-ops a step that would move nothing.
    {
        action: editAction({ kind: "indent", delta: 1 }),
        label: "paragraph.increaseIndent",
        icon: ICON_INDENT_INCREASE,
        enabledWhen: (c) => allowsTextEdit(c.selection, "indentParagraphs"),
        separatorBefore: true,
    },
    {
        action: editAction({ kind: "indent", delta: -1 }),
        label: "paragraph.decreaseIndent",
        icon: ICON_INDENT_DECREASE,
        enabledWhen: (c) => allowsTextEdit(c.selection, "indentParagraphs"),
    },
];

/** The line-spacing multiples the spacing menu offers — the Word / Google Docs
 *  set. A paragraph spaced in *points* matches none of them and marks nothing;
 *  the exact measure belongs in the (later) Paragraph dialog. */
const LINE_SPACINGS: readonly number[] = [1, 1.15, 1.5, 2];

/** The gap the Space Before / After switches turn *on*, in points — Word's own
 *  default for its Add Space commands. Off writes zero, not a clear (see
 *  {@link LINE_SPACING_MENU}). */
export const PARAGRAPH_SPACE_POINTS = 10;

/** One line-spacing row: `1.5` reads as "1.5", `1` as "Single" and `2` as
 *  "Double" — the names those two multiples go by in every office suite. */
function lineSpacingItem(lines: number): MenuItem<MessageKey> {
    const label: Message<MessageKey> =
        lines === 1
            ? "paragraph.lineSpacingSingle"
            : lines === 2
              ? "paragraph.lineSpacingDouble"
              : ["paragraph.lineSpacingLines", { lines }];
    return {
        action: editAction({ kind: "lineSpacing", lines }),
        label,
        enabledWhen: whenParagraphFormat,
        activeWhen: (c) => editStateOf(c).selectionText.lineSpacing === lines,
    };
}

/** The scales the Scale dropdown offers, as factors — Word's own list. */
const WIDTH_SCALES: readonly number[] = [2, 1.5, 1, 0.9, 0.8, 0.66, 0.5, 0.33];

/** The Scale dropdown: the horizontal glyph scales as one exclusive set, the
 *  one the selection shares marked. */
export const WIDTH_SCALE_MENU: readonly MenuItem<MessageKey>[] = WIDTH_SCALES.map((scale) => ({
    action: editAction({ kind: "widthScale", scale }),
    label: ["format.percent", { percent: Math.round(scale * 100) }],
    enabledWhen: whenWidthScale,
    activeWhen: (c) => editStateOf(c).selectionText.widthScale === scale,
}));

/**
 * The Line & Paragraph Spacing dropdown: the line-spacing multiples as one
 * exclusive set, then the space-above / space-below switches below a divider.
 *
 * The two halves are one control because they are one question asked at two
 * scales — the gap *inside* a paragraph and the gaps *around* it. The switches
 * are genuinely independent on/off state (unlike the multiples), so they draw a
 * switch rather than a mark: on writes {@link PARAGRAPH_SPACE_POINTS}, off writes
 * zero, which is the explicit "no gap" a style's own spacing must be overridden
 * with — not a clear back to it.
 */
export const LINE_SPACING_MENU: readonly MenuItem<MessageKey>[] = [
    ...LINE_SPACINGS.map(lineSpacingItem),
    {
        action: editAction({ kind: "paragraphSpace", edge: "before" }),
        label: "paragraph.spaceBefore",
        enabledWhen: whenParagraphFormat,
        separatorBefore: true,
        checked: (c) => (editStateOf(c).selectionText.spaceBefore ?? 0) > 0,
    },
    {
        action: editAction({ kind: "paragraphSpace", edge: "after" }),
        label: "paragraph.spaceAfter",
        enabledWhen: whenParagraphFormat,
        checked: (c) => (editStateOf(c).selectionText.spaceAfter ?? 0) > 0,
    },
];

/** The text edits of the selection, on the shell `host` lends; `i18n` names
 *  the busy hold a font download waits under. */
export function createTextEdits(host: UIShellHost, i18n: I18n) {
    const { store, client, commit, hold } = host;

    // Text character formatting — the Text tab's controls over the current text
    // selection (a shape's text on a slide, the body caret in a doc). Each rides
    // the same `executeOnSelection` seam as Fill / typing: the shell emits a
    // format-blind character-property edit, the worker tags it (`Presentation` /
    // `Wordprocessing` / `Image`), and the editor overlays it on the selected
    // range, keeping the selection so toggles chain. Only the doc types whose
    // shapes are a drawing's carry a character-property edit, so this no-ops for
    // the rest (their `SelectionEdit` has no such kind); the Text tab is likewise
    // gated to them (see `profiles.ts`).
    function textDocType(): boolean {
        return profileFor(store.getState().docType).drawingShapes;
    }

    /** Overlay set-value character `properties` on the text selection. */
    function setCharacterProperties(properties: TextCharacterProperty[]): Promise<void> {
        if (!textDocType()) return Promise.resolve();
        return commit(() => client.executeOnSelection({ kind: "setCharacterProperties", properties }));
    }

    /** Toggle a character style (bold / italic / underline / strikethrough): set
     *  the explicit value, so turning a style *off* overrides an inherited one. */
    function formatTextSelection(property: TextFormatProperty, on: boolean): Promise<void> {
        return setCharacterProperties([textFormatProperty(property, on, store.getState().docType)]);
    }

    /** Apply a typeface to the text selection (the Latin / default script slot). */
    async function fontFamilySelection(font: string): Promise<void> {
        if (!textDocType()) return;
        // Load first, apply second. A family the document has never used lays out
        // in a stand-in and reflows when the real one lands, so applying first
        // makes one click move the text twice. Every face the change will
        // produce is fetched, not just one — a selection with a bold word in it
        // renders in two binaries, and getting one still leaves the other to
        // reflow on its own.
        //
        // The wait returns at once for a family already here — every use after
        // the first — so the hold below usually costs nothing and shows nothing.
        //
        // It is held because the wait splits one click into two moments. Left
        // interactive, a selection moved in between is what the font lands on:
        // the faces were read from one range and applied to another. Refusing
        // input for the wait makes those the same range, which is the fix — not
        // carrying the old selection through, which would yank it back under a
        // user who has already moved on.
        //
        // Cancelling abandons the pick. Nothing is applied and the document is as
        // it was; the download it was waiting on still lands and installs, so
        // picking the same family again is instant.
        const { bold, italic } = editState(store.getState()).selectionText;
        const proceed = await hold(
            i18n.t("busy.loadingFont", { font }),
            client.ensureFont(font, facesToLoad(bold, italic)),
        );
        if (!proceed) return;
        await setCharacterProperties([{ fontLatin: { named: { name: font } } }]);
    }

    /** Apply a point size to the text selection. */
    function fontSizeSelection(size: number): Promise<void> {
        return setCharacterProperties([{ size: size }]);
    }

    /** Apply a text color (the span fill) to the text selection. */
    function textFillSelection(paint: PaintSpec): Promise<void> {
        return setCharacterProperties([{ fill: paintToDrawingFill(paint) }]);
    }

    /** Overlay set-value paragraph `properties` on every paragraph the text
     *  selection touches — the paragraph half of the Text tab. A caret is inside
     *  a paragraph, so unlike {@link setCharacterProperties} this needs no range. */
    function setParagraphProperties(properties: TextParagraphProperty[]): Promise<void> {
        if (!textDocType()) return Promise.resolve();
        return commit(() => client.executeOnSelection({ kind: "setParagraphProperties", properties }));
    }

    /** Step the touched paragraphs' indent by `delta` levels — the Align & Indent
     *  menu's two steps. Relative, so the engine (not the toolbar) decides what a
     *  step means for each paragraph and stops at the margin. */
    function indentSelection(delta: number): Promise<void> {
        if (!textDocType()) return Promise.resolve();
        return commit(() => client.executeOnSelection({ kind: "indentParagraphs", delta }));
    }

    /** Flip the space above / below the touched paragraphs. Off writes an explicit
     *  zero rather than clearing the key: the gap the switch is turning off is
     *  usually the paragraph *style's*, which only a specified zero overrides. */
    function toggleParagraphSpace(edge: ParagraphSpaceEdge): Promise<void> {
        const format = editState(store.getState()).selectionText;
        const current = edge === "before" ? format.spaceBefore : format.spaceAfter;
        const points = (current ?? 0) > 0 ? 0 : PARAGRAPH_SPACE_POINTS;
        return setParagraphProperties([
            edge === "before" ? { spacingBefore: { points } } : { spacingAfter: { points } },
        ]);
    }

    /** Put the touched paragraphs into `style`'s list, or take them out when it is
     *  `null`. Off writes `"none"` — the explicit no-bullet — not a clear: a
     *  placeholder's own list style is what a paragraph falls back to, and only a
     *  specified suppression overrides it. */
    function listSelection(style: ListStyle | null): Promise<void> {
        if (!style) return setParagraphProperties([{ numbering: "none" }]);
        return setParagraphProperties([
            { numbering: { inline: { format: style.format, textPattern: style.pattern } } },
        ]);
    }

    /** Apply a highlight to the text selection. The highlight is a bare color, so
     *  "no fill" clears the highlight key (back to un-highlighted). */
    function textHighlightSelection(paint: PaintSpec): Promise<void> {
        if (!textDocType()) return Promise.resolve();
        const color = paintToDrawingColor(paint);
        if (!color) {
            return commit(() => client.executeOnSelection({ kind: "clearCharacterProperties", keys: ["highlight"] }));
        }
        return setCharacterProperties([{ highlight: color }]);
    }

    return {
        setCharacterProperties,
        formatTextSelection,
        fontFamilySelection,
        fontSizeSelection,
        textFillSelection,
        setParagraphProperties,
        indentSelection,
        toggleParagraphSpace,
        listSelection,
        textHighlightSelection,
    };
}

/** The text edits {@link createTextEdits} makes. */
export type TextEdits = ReturnType<typeof createTextEdits>;
