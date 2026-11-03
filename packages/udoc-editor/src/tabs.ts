// Edit mode's tab strips, by doc type. A tab names its commands by id — udoc-ui's
// catalog's, or the editor's own (see `commands.ts`); the order is the render
// order. A strip opens folded, and a selection opens the tab it is for.
import type { UDocType } from "@docmentis/udoc-ui";
import {
    allowsEdit,
    allowsTableEdit,
    allowsTextEdit,
    ANNOTATE_TAB,
    presentTab,
    viewTab,
} from "@docmentis/udoc-ui/internal";
import type { CommandId, SelectionCapabilities, ToolbarTab } from "@docmentis/udoc-ui/internal";
import type { MessageKey } from "./i18n/index.js";
import { RULED } from "./ruler.js";

/** A command edit mode's tabs name: udoc-ui's, or the editor's own. */
export type EditCommandId =
    | CommandId
    | "paragraphStyle"
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
    | "shapeOrder"
    | "shapeAlign"
    | "shapeRotate"
    | "shapeGroup"
    | "shapeUngroup"
    | "objectFillColor"
    | "objectStrokeColor"
    | "objectOrder"
    | "objectAlign"
    | "objectRotate"
    | "objectGroup"
    | "objectUngroup"
    | "ruler"
    | "createSlide"
    | "insertImage"
    | "insertShape"
    | "insertGalleryShape"
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

/** Whether `caps` is a selection in text: a caret or a range — in a shape's
 *  text too, which a selection reports with the shape's own edits — or a
 *  table's cells, a block of them as well, so a drag across cells keeps the
 *  tab a caret in one opened. */
function inText(caps: SelectionCapabilities): boolean {
    return allowsTextEdit(caps, "insertText") || allowsTableEdit(caps, "insertRows");
}

/** Whether `caps` holds picked shapes: a slide's, a word document's drawings,
 *  those drawn over an image. */
function pickedShapes(caps: SelectionCapabilities): boolean {
    return allowsEdit(caps, "setShapeFill");
}

/** Whether `caps` holds a PDF's page objects, or a caret in one's text. */
function pageObjects(caps: SelectionCapabilities): boolean {
    return allowsEdit(caps, "translateObjects");
}

/** Whether `caps` holds a PDF's annotations, or a caret in a free text's. */
function annotations(caps: SelectionCapabilities): boolean {
    return allowsEdit(caps, "deleteAnnotations", "translateAnnotations", "resizeAnnotations", "reorderAnnotations");
}

/** Whether `caps` holds an image's pages, picked in the thumbnails. */
function imagePages(caps: SelectionCapabilities): boolean {
    return allowsEdit(caps, "rotatePages");
}

/**
 * The Text tab — the paragraph style picker first, the broadest control and the
 * one the rest refine; then the character half (the font family / size fields,
 * the Bold / Italic / Underline / Strikethrough / Superscript / Subscript
 * toggles, the Scale dropdown, the Text Color / Highlight pickers), then the
 * paragraph half (the Align + Indent dropdown, the Line & Paragraph Spacing
 * dropdown, and the two list split buttons). For the doc types whose text edits
 * through the shared text engine — a deck's, a word document's, the shapes'
 * over an image; a PDF's text and a spreadsheet's cells don't carry it. A
 * selection in text opens it.
 *
 * The paragraph controls stay a **short** band on purpose: four entries, each
 * dropping its long tail into its own menu. The exact measures — indents and
 * spacing in points, first-line vs hanging, borders and shading, the pagination
 * keeps — belong in a Paragraph dialog, not in toolbar width.
 */
const TEXT_TAB: EditTab = {
    id: "text",
    label: "ribbon.text",
    commands: [
        "paragraphStyle",
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
    ] satisfies EditCommandId[],
    opensFor: inText,
};

/** The presentation Text tab — {@link TEXT_TAB} without the controls a deck has
 *  no use for: the style picker (a slide's paragraphs inherit by outline level,
 *  naming no style) and Scale (`w:w` is docx's, and DrawingML has no horizontal
 *  glyph scale). The tab drops them rather than greying them for good. */
const PRESENTATION_TEXT_TAB: EditTab = {
    ...TEXT_TAB,
    commands: TEXT_TAB.commands.filter((id) => id !== "paragraphStyle" && id !== "widthScale"),
};

/**
 * The Shape tab — appearance + arrangement for graphics objects. Fill / Line
 * split buttons (color per channel), then a button group of the arrangement
 * dropdowns — Order (z-order), Align (align / distribute to the selection or the
 * page) and Rotate (quarter-turn rotations + flips) — and one of Group and
 * Ungroup. Picked shapes open it.
 */
const SHAPE_TAB: EditTab = {
    id: "shape",
    label: "ribbon.shape",
    commands: [
        "shapeFillColor",
        "shapeStrokeColor",
        "shapeOrder",
        "shapeAlign",
        "shapeRotate",
        "shapeGroup",
        "shapeUngroup",
    ] satisfies EditCommandId[],
    opensFor: pickedShapes,
};

/**
 * The Object tab — the portable (PDF) counterpart of {@link SHAPE_TAB}: its own
 * Fill / Line and arrangement, gated on the object edits, over the page's content
 * objects (paths, text, images) rather than DrawingML shapes. Picked objects
 * open it, as does a caret in one's text.
 */
const OBJECT_TAB: EditTab = {
    id: "object",
    label: "ribbon.object",
    commands: [
        "objectFillColor",
        "objectStrokeColor",
        "objectOrder",
        "objectAlign",
        "objectRotate",
        "objectGroup",
        "objectUngroup",
    ] satisfies EditCommandId[],
    opensFor: pageObjects,
};

/** The Annotate tab, as view mode has it, opened by picked annotations — its
 *  Format group styles them. */
const PORTABLE_ANNOTATE_TAB: EditTab = { ...ANNOTATE_TAB, opensFor: annotations };

/**
 * The image Image tab — the current page's Rotate Left / Right, Flip
 * Horizontal / Vertical, Crop and Image Size; the turns and flips the pages
 * picked in the thumbnails instead, which open it. **Contextual** (see
 * {@link ToolbarTab.contextual}): while a page is cropped, crop mode's own
 * controls show in their place — the aspect the box keeps, Reset, Cancel and
 * Apply.
 */
const IMAGE_TAB: EditTab = {
    id: "image",
    label: "ribbon.image",
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
    ] satisfies EditCommandId[],
    contextual: true,
    opensFor: imagePages,
};

/** The portable Insert tab: Shapes, dragged out as the page's own objects. */
const PORTABLE_INSERT_TAB: EditTab = { id: "insert", label: "ribbon.insert", commands: ["insertShape"] };

/** The image Insert tab: the gallery's Shapes, drawn over the page. */
const IMAGE_INSERT_TAB: EditTab = { id: "insert", label: "ribbon.insert", commands: ["insertGalleryShape"] };

/** The presentation Insert tab: New Slide, after the current slide; Image, a
 *  picture on it; and the gallery's Shapes, dragged out on it. */
const PRESENTATION_INSERT_TAB: EditTab = {
    id: "insert",
    label: "ribbon.insert",
    commands: ["createSlide", "insertImage", "insertGalleryShape"],
};

/** `docType`'s View tab, as edit mode has it: with the views edit mode alone
 *  offers, and the ruler among its guides where edit mode draws one — over a
 *  PDF's pages, a deck's slides and a word document's pages. */
function editViewTab(docType: UDocType): EditTab {
    return viewTab(docType, { guides: RULED.has(docType) ? ["ruler"] : [] });
}

/** The strip of a doc type with none of its own: no tabs. */
const DEFAULT_TABS: readonly EditTab[] = [];

/** The portable (PDF) strip: its own Insert, then Object (the page's content
 *  objects) and Annotate, but no Text tab, then Present, and its View last. */
const PORTABLE_TABS: readonly EditTab[] = [
    PORTABLE_INSERT_TAB,
    OBJECT_TAB,
    PORTABLE_ANNOTATE_TAB,
    presentTab("portable"),
    editViewTab("portable"),
];

/** The presentation strip: its own Insert, then Text (character formatting)
 *  and Shape (free-floating graphics), then Present, and its View last. */
const PRESENTATION_TABS: readonly EditTab[] = [
    PRESENTATION_INSERT_TAB,
    PRESENTATION_TEXT_TAB,
    SHAPE_TAB,
    presentTab("presentation"),
    editViewTab("presentation"),
];

/** The wordprocessing strip: Text, then Shape for the drawings in its flow,
 *  and its View last. */
const WORDPROCESSING_TABS: readonly EditTab[] = [TEXT_TAB, SHAPE_TAB, editViewTab("wordprocessing")];

/** The image strip: its own Image and Insert, then the Text and Shape tabs of
 *  the shapes drawn over its pages — a deck's, as they are a slide's shapes —
 *  and its View last. */
const IMAGE_TABS: readonly EditTab[] = [
    IMAGE_TAB,
    IMAGE_INSERT_TAB,
    PRESENTATION_TEXT_TAB,
    SHAPE_TAB,
    editViewTab("image"),
];

/** The spreadsheet strip: its View. */
const SPREADSHEET_TABS: readonly EditTab[] = [editViewTab("spreadsheet")];

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
        case "spreadsheet":
            return SPREADSHEET_TABS;
        default:
            return DEFAULT_TABS;
    }
}
