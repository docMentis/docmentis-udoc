// Edit mode's tab strips, by doc type. A tab names its commands by id — udoc-ui's
// catalog's, or the editor's own (see `commands.ts`); the order is the render
// order, and a strip opens on its Home.
import type { UDocType } from "@docmentis/udoc-ui";
import { ANNOTATE_TAB, VIEW_TAB, WORDPROCESSING_VIEW_TAB } from "@docmentis/udoc-ui/internal";
import type { CommandId, ToolbarTab } from "@docmentis/udoc-ui/internal";
import type { MessageKey } from "./i18n/index.js";

/** A command edit mode's tabs name: udoc-ui's, or the editor's own. */
export type EditCommandId =
    | CommandId
    | "fontFamily"
    | "fontSize"
    | "bold"
    | "italic"
    | "underline"
    | "strikethrough"
    | "superscript"
    | "subscript"
    | "widthScale"
    | "textFill"
    | "textHighlight"
    | "paragraphAlign"
    | "lineSpacing"
    | "bulletList"
    | "numberList"
    | "shapeFillColor"
    | "shapeStrokeColor"
    | "shapeArrange"
    | "objectFillColor"
    | "objectStrokeColor"
    | "objectArrange"
    | "formattingMarks"
    | "createSlide"
    | "insertImage"
    | "insertShape"
    | "rotatePageLeft"
    | "rotatePageRight"
    | "flipPageHorizontal"
    | "flipPageVertical"
    | "cropPage"
    | "resizePage"
    | "cropAspect"
    | "cropReset"
    | "cropCancel"
    | "cropApply";

/** A tab of edit mode's. */
type EditTab = ToolbarTab<MessageKey>;

/**
 * The text-formatting commands — the character half first (the font family /
 * size fields, the Bold / Italic / Underline / Strikethrough / Superscript /
 * Subscript toggles, the Scale dropdown, the Text Color / Highlight pickers),
 * then the paragraph half (the Align + Indent dropdown, the Line & Paragraph
 * Spacing dropdown, and the two list split buttons). Shared by the doc-type Text
 * tab (always shown, greyed when the selection can't take them) and the
 * contextual Home tab (shown only when the selection is editable text). One
 * source of truth so the two never drift.
 *
 * The paragraph controls stay a **short** band on purpose: four entries, each
 * dropping its long tail into its own menu. The exact measures — indents and
 * spacing in points, first-line vs hanging, borders and shading, the pagination
 * keeps — belong in a Paragraph dialog, not in toolbar width.
 */
const TEXT_COMMANDS: readonly EditCommandId[] = [
    "fontFamily",
    "fontSize",
    "bold",
    "italic",
    "underline",
    "strikethrough",
    "superscript",
    "subscript",
    "widthScale",
    "textFill",
    "textHighlight",
    "paragraphAlign",
    "lineSpacing",
    "bulletList",
    "numberList",
];

/**
 * The shape-appearance commands — the Fill / Line color pickers and the
 * Arrange dropdown (order / align / rotate / group) over a drawing's shapes. On
 * the Shape tab and the contextual Home tab, like {@link TEXT_COMMANDS}.
 */
const SHAPE_COMMANDS: readonly EditCommandId[] = ["shapeFillColor", "shapeStrokeColor", "shapeArrange"];

/**
 * The object-appearance commands — the {@link SHAPE_COMMANDS} of a PDF's page
 * objects, gated on the object edits. On the portable profile's Object tab and
 * its contextual Home tab.
 */
const OBJECT_COMMANDS: readonly EditCommandId[] = ["objectFillColor", "objectStrokeColor", "objectArrange"];

/**
 * The Home tab, **contextual** (see {@link ToolbarTab.contextual}): it carries
 * the full text ({@link TEXT_COMMANDS}) and shape ({@link SHAPE_COMMANDS})
 * control sets but shows only the ones the current selection can take, so it
 * reads as a selection-driven property band — empty with nothing selected, the
 * text controls for editable text, the shape controls for a graphics object. The
 * clipboard + format-copy group it once held moved to the canvas context menu
 * (`CONTEXT_MENU` in udoc-ui's `commands.ts`) — those act on the selection and
 * mean the same thing for every selection type, so they don't earn toolbar
 * width.
 */
const HOME_TAB: EditTab = {
    id: "home",
    label: "ribbon.home",
    commands: [...TEXT_COMMANDS, ...SHAPE_COMMANDS],
    contextual: true,
};

/** The portable Insert tab: Shapes, dragged out as the page's own objects. */
const PORTABLE_INSERT_TAB: EditTab = { id: "insert", label: "ribbon.insert", commands: ["insertShape"] };

/** The image Insert tab: Shapes, drawn over the page. */
const IMAGE_INSERT_TAB: EditTab = { id: "insert", label: "ribbon.insert", commands: ["insertShape"] };

/** The presentation Insert tab: Image, a picture on the current slide. */
const PRESENTATION_INSERT_TAB: EditTab = { id: "insert", label: "ribbon.insert", commands: ["insertImage"] };

/**
 * The Shape tab — appearance + arrangement for graphics objects. Fill / Line
 * split buttons (color per channel), then the `arrange` dropdown whose fly-outs
 * cover Order (z-order), Align (align / distribute to the selection or the page),
 * and Rotate (quarter-turn rotations + flips), plus Group / Ungroup. On the
 * presentation strip, not the default one.
 */
const SHAPE_TAB: EditTab = { id: "shape", label: "ribbon.shape", commands: SHAPE_COMMANDS };

/**
 * The Object tab — the portable (PDF) counterpart of {@link SHAPE_TAB}: its own
 * {@link OBJECT_COMMANDS}, over the page's content objects (paths, text, images)
 * rather than DrawingML shapes.
 */
const OBJECT_TAB: EditTab = { id: "object", label: "ribbon.object", commands: OBJECT_COMMANDS };

/**
 * The Text tab — character formatting for the current text selection. The font
 * dropdown (typeface) then the Bold / Italic toggles. For the doc types whose
 * text edits through the shared text engine (presentation + wordprocessing);
 * PDF (line-structured, read-oriented text) and spreadsheets don't carry it.
 */
const TEXT_TAB: EditTab = { id: "text", label: "ribbon.text", commands: TEXT_COMMANDS };

/** The presentation Text tab — {@link TEXT_TAB} without the control a deck has
 *  no use for: Scale (`w:w` is docx's, and DrawingML has no horizontal glyph
 *  scale). The tab drops it rather than greying it for good. */
const PRESENTATION_TEXT_TAB: EditTab = {
    ...TEXT_TAB,
    commands: TEXT_COMMANDS.filter((id) => id !== "widthScale"),
};

/** The wordprocessing View tab — udoc-ui's (Pages or Pageless), then Show
 *  Formatting Marks, which shows what the text holds rather than changing it. */
const WORDPROCESSING_EDIT_VIEW_TAB: EditTab = {
    ...WORDPROCESSING_VIEW_TAB,
    commands: [...WORDPROCESSING_VIEW_TAB.commands, "formattingMarks"],
};

/**
 * The portable Home tab. Like {@link HOME_TAB}, but with the
 * {@link OBJECT_COMMANDS} a PDF's page objects take in place of the shape ones.
 */
const PORTABLE_HOME_TAB: EditTab = {
    id: "home",
    label: "ribbon.home",
    commands: [...TEXT_COMMANDS, ...OBJECT_COMMANDS],
    contextual: true,
};

/**
 * The presentation Home tab. Like {@link HOME_TAB} (text controls for a text
 * selection, shape controls for a graphics object) but with **New Slide**
 * prepended — shown only with nothing selected (see `whenNoSelection`), so the
 * empty canvas offers "add a slide" where a selection would offer its property
 * controls. Slide delete / reorder stay in the Thumbnails navigator.
 */
const PRESENTATION_HOME_TAB: EditTab = {
    id: "home",
    label: "ribbon.home",
    commands: ["createSlide", ...TEXT_COMMANDS, ...SHAPE_COMMANDS],
    contextual: true,
};

/**
 * The image Home tab. Like {@link PRESENTATION_HOME_TAB}, its document-level
 * actions — the current page's Rotate Left / Right, Flip Horizontal /
 * Vertical, Crop and Image Size — show with no shape drawn over a page
 * selected, or pages in the thumbnails, and yield to the text and shape
 * controls the moment one is. While a page is cropped, crop mode's own
 * controls show in their place: the aspect the box keeps, Reset, Cancel and
 * Apply.
 */
const IMAGE_HOME_TAB: EditTab = {
    id: "home",
    label: "ribbon.home",
    commands: [
        "rotatePageLeft",
        "rotatePageRight",
        "flipPageHorizontal",
        "flipPageVertical",
        "cropPage",
        "resizePage",
        "cropAspect",
        "cropReset",
        "cropCancel",
        "cropApply",
        ...PRESENTATION_TEXT_TAB.commands,
        ...SHAPE_COMMANDS,
    ],
    contextual: true,
};

/** The strip of a doc type with none of its own: Home. */
const DEFAULT_TABS: readonly EditTab[] = [HOME_TAB];

/** The portable (PDF) strip: its own Home and Insert, then Object (the page's
 *  content objects) and Annotate, but no Text tab. */
const PORTABLE_TABS: readonly EditTab[] = [PORTABLE_HOME_TAB, PORTABLE_INSERT_TAB, OBJECT_TAB, ANNOTATE_TAB];

/** The presentation strip: the slide-aware Home and its own Insert, then Text
 *  (character formatting) and Shape (free-floating graphics), and udoc-ui's
 *  View last (the notes pane), as view mode has it. */
const PRESENTATION_TABS: readonly EditTab[] = [
    PRESENTATION_HOME_TAB,
    PRESENTATION_INSERT_TAB,
    PRESENTATION_TEXT_TAB,
    SHAPE_TAB,
    VIEW_TAB,
];

/** The wordprocessing strip: Home plus Text, then View last (its pages or
 *  pageless, as view mode has it, and the formatting marks). No Shape tab yet —
 *  the flow document has no free-floating shapes. */
const WORDPROCESSING_TABS: readonly EditTab[] = [HOME_TAB, TEXT_TAB, WORDPROCESSING_EDIT_VIEW_TAB];

/** The image strip: its own Home and Insert, then the Text and Shape tabs of
 *  the shapes drawn over its pages — a deck's, as they are a slide's shapes. */
const IMAGE_TABS: readonly EditTab[] = [IMAGE_HOME_TAB, IMAGE_INSERT_TAB, PRESENTATION_TEXT_TAB, SHAPE_TAB];

/** Edit mode's tab strip for a document of `docType`. */
export function editTabs(docType: UDocType | null): readonly EditTab[] {
    switch (docType) {
        case "portable":
            return PORTABLE_TABS;
        case "presentation":
            return PRESENTATION_TABS;
        case "wordprocessing":
            return WORDPROCESSING_TABS;
        case "image":
            return IMAGE_TABS;
        default:
            return DEFAULT_TABS;
    }
}
