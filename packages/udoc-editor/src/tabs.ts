// Edit mode's tab strips, by doc type. A tab names its commands by id — udoc-ui's
// catalog's, or the editor's own (see `commands.ts`); the order is the render
// order. A strip opens folded, a PDF's on its Page tab, a deck's on its Slide tab,
// an image's on its Image tab, a word document's on its Text tab and a workbook's on
// its Cell tab, and a selection opens the tab it is for.
import type { UDocType } from "@docmentis/udoc-ui";
import {
    allowsEdit,
    allowsTableEdit,
    allowsTextEdit,
    ANNOTATE_TAB,
    presentTab,
    REVIEW_TAB,
    viewTab,
} from "@docmentis/udoc-ui/internal";
import type { CommandId, SelectionCapabilities, ToolbarTab } from "@docmentis/udoc-ui/internal";
import type { MessageKey } from "./i18n/index.js";
import {
    ICON_TAB_CELL,
    ICON_TAB_IMAGE,
    ICON_TAB_OBJECT,
    ICON_TAB_PAGE,
    ICON_TAB_SHAPE,
    ICON_TAB_SLIDE,
    ICON_TAB_TABLE,
    ICON_TAB_TEXT,
} from "./icons.js";
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
    | "changeShape"
    | "shapeFillColor"
    | "shapeStrokeColor"
    | "shapeOrder"
    | "shapeAlign"
    | "shapeRotate"
    | "shapeGroup"
    | "shapeUngroup"
    | "objectFillColor"
    | "objectStrokeColor"
    | "objectOpacity"
    | "objectOrder"
    | "objectAlign"
    | "objectRotate"
    | "objectGroup"
    | "objectUngroup"
    | "tableSelect"
    | "tableInsert"
    | "tableDelete"
    | "tableCells"
    | "tableDistribute"
    | "tableShading"
    | "tableBorderColor"
    | "tableBorder"
    | "tableAlign"
    | "tableStyle"
    | "tableProperties"
    | "cellFill"
    | "cellBorderColor"
    | "cellBorder"
    | "cellAlign"
    | "cellWrap"
    | "cellMerge"
    | "cellNumberFormat"
    | "cellDecimalsUp"
    | "cellDecimalsDown"
    | "cellClearFormats"
    | "ruler"
    | "createSlide"
    | "deleteSlide"
    | "changeLayout"
    | "insertImage"
    | "insertTable"
    | "insertPageImage"
    | "insertShape"
    | "insertGalleryShape"
    | "insertTextBox"
    | "pageCreate"
    | "pageDelete"
    | "pageRotateLeft"
    | "pageRotateRight"
    | "pageResize"
    | "rotatePageLeft"
    | "rotatePageRight"
    | "flipPageHorizontal"
    | "flipPageVertical"
    | "cropPage"
    | "resizePage"
    | "cropAspect"
    | "cropReset"
    | "cropCancel"
    | "cropApply"
    | "acceptRevisions"
    | "rejectRevisions";

/** A tab of edit mode's. */
type EditTab = ToolbarTab<MessageKey>;

/** Whether `caps` is a selection in text: a caret or a range — in a shape's
 *  text too, which a selection reports with the shape's own edits, and in a
 *  table's cell, which reports the cell's text edits. */
function inText(caps: SelectionCapabilities): boolean {
    return allowsTextEdit(caps, "insertText");
}

/** Whether `caps` is in a table: a caret in a cell, or a block of cells. */
function inTable(caps: SelectionCapabilities): boolean {
    return allowsTableEdit(caps, "insertRows");
}

/** Whether `caps` holds a workbook's cells: a block of them, whole rows or
 *  columns, or the whole sheet. */
function sheetCells(caps: SelectionCapabilities): boolean {
    return allowsEdit(caps, "patchCellFont");
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

/** Whether `caps` holds a PDF's or an image's pages, picked in the thumbnails, or
 *  nothing. */
function pagesOrNothing(caps: SelectionCapabilities): boolean {
    return caps.count === 0 || allowsEdit(caps, "rotatePages");
}

/** Whether `caps` holds a deck's slides or sections, picked in the thumbnails, or
 *  nothing. */
function slidesOrNothing(caps: SelectionCapabilities): boolean {
    return caps.count === 0 || allowsEdit(caps, "deleteSlides", "deleteSlideSections");
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
    icon: ICON_TAB_TEXT,
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

/** The wordprocessing Text tab — {@link TEXT_TAB}, which its strip opens on: a word
 *  document is edited as text. */
const WORDPROCESSING_TEXT_TAB: EditTab = { ...TEXT_TAB, opensOnEntry: true };

/** The presentation Text tab — {@link TEXT_TAB} without the controls a deck has
 *  no use for: the style picker (a slide's paragraphs inherit by outline level,
 *  naming no style) and Scale (`w:w` is docx's, and DrawingML has no horizontal
 *  glyph scale). The tab drops them rather than greying them for good. */
const PRESENTATION_TEXT_TAB: EditTab = {
    ...TEXT_TAB,
    commands: TEXT_TAB.commands.filter((id) => id !== "paragraphStyle" && id !== "widthScale"),
};

/**
 * The Shape tab — new shapes, then outline + appearance + arrangement for
 * graphics objects. Text Box and the gallery's shapes first, dragged out as the
 * Slide and Image tabs' are, as PowerPoint's Shape Format starts with its Insert
 * Shapes; then Change Shape's gallery, then Fill / Line split buttons (color per
 * channel), then a button group of the arrangement dropdowns — Order (z-order),
 * Align (align / distribute to the selection or the page) and Rotate
 * (quarter-turn rotations + flips) — and one of Group and Ungroup. Picked shapes
 * open it.
 */
const SHAPE_TAB: EditTab = {
    id: "shape",
    label: "ribbon.shape",
    icon: ICON_TAB_SHAPE,
    commands: [
        "insertTextBox",
        "insertGalleryShape",
        "changeShape",
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

/** The wordprocessing Shape tab — {@link SHAPE_TAB} without Text Box and the
 *  gallery's shapes: nothing places a drawing in a word document's flow yet,
 *  and the tab drops them rather than greying them for good. */
const WORDPROCESSING_SHAPE_TAB: EditTab = {
    ...SHAPE_TAB,
    commands: SHAPE_TAB.commands.filter((id) => id !== "insertTextBox" && id !== "insertGalleryShape"),
};

/**
 * The Table tab — a new table, then the edits and the format of the table the
 * selection is in, on one short band, as an embedded editor has room for: Insert
 * Table — on a deck's slide or over an image's page, as their Slide and Image
 * tabs have it too, or at a caret in a word document's body, not a cell's; then
 * the Select, Insert, Delete and Cells dropdowns and Distribute Columns; Shading,
 * Border Color and Border; the Align and Style dropdowns; and Properties, the
 * dialog holding the measures. A block of cells opens it, a selection with no
 * text of its own to format. A caret in a cell opens the Text tab ahead of it, as
 * a caret in a shape's text does ahead of Shape, but leaves this tab open if it
 * is: selecting a row, deleting it and clicking a cell goes from a block to a
 * caret and back, all of it this tab's work.
 */
const TABLE_TAB: EditTab = {
    id: "table",
    label: "ribbon.table",
    icon: ICON_TAB_TABLE,
    commands: [
        "insertTable",
        "tableSelect",
        "tableInsert",
        "tableDelete",
        "tableCells",
        "tableDistribute",
        "tableShading",
        "tableBorderColor",
        "tableBorder",
        "tableAlign",
        "tableStyle",
        "tableProperties",
    ] satisfies EditCommandId[],
    opensFor: inTable,
    staysOpen: true,
};

/**
 * The Object tab — the portable (PDF) counterpart of {@link SHAPE_TAB}: the Page
 * tab's Text Box and Shapes first, then its own Line, Fill, Opacity and
 * arrangement, gated on the object edits, over the page's content objects
 * (paths, text, images) rather than DrawingML shapes. Picked objects open it, as
 * does a caret in one's text.
 */
const OBJECT_TAB: EditTab = {
    id: "object",
    label: "ribbon.object",
    icon: ICON_TAB_OBJECT,
    commands: [
        "insertTextBox",
        "insertShape",
        "objectStrokeColor",
        "objectFillColor",
        "objectOpacity",
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
 * Horizontal / Vertical, Crop and Image Size, the turns and flips the pages picked
 * in the thumbnails instead, then what is drawn over the page: a text box and the
 * gallery's shapes, dragged out on it, and a table sized on a grid. All icons,
 * named by their tooltips. An image's strip opens on it, and pages picked or
 * nothing selected open it. **Contextual** (see {@link ToolbarTab.contextual}):
 * while a page is cropped, crop mode's own controls show in their place — the
 * aspect the box keeps, Reset, Cancel and Apply — and a page that takes no markup
 * leaves out the text box, the shapes and the table.
 */
const IMAGE_TAB: EditTab = {
    id: "image",
    label: "ribbon.image",
    icon: ICON_TAB_IMAGE,
    commands: [
        "rotatePageLeft",
        "rotatePageRight",
        "flipPageHorizontal",
        "flipPageVertical",
        "cropPage",
        "resizePage",
        "insertTextBox",
        "insertGalleryShape",
        "insertTable",
        "cropAspect",
        "cropReset",
        "cropCancel",
        "cropApply",
    ] satisfies EditCommandId[],
    contextual: true,
    opensOnEntry: true,
    opensFor: pagesOrNothing,
};

/**
 * The portable Page tab: the pages' edits — a blank page after the current one,
 * and Delete, the two turns and Resize of the current page, or of those picked
 * in the thumbnails — then what goes on a page as its own objects: a text box,
 * shapes and an image. All icons, named by their tooltips. A PDF's strip opens on
 * it, the tools a PDF is usually edited with, and pages picked or nothing selected
 * open it.
 */
const PORTABLE_PAGE_TAB: EditTab = {
    id: "page",
    label: "ribbon.page",
    icon: ICON_TAB_PAGE,
    commands: [
        "pageCreate",
        "pageDelete",
        "pageRotateLeft",
        "pageRotateRight",
        "pageResize",
        "insertTextBox",
        "insertShape",
        "insertPageImage",
    ] satisfies EditCommandId[],
    opensOnEntry: true,
    opensFor: pagesOrNothing,
};

/**
 * The presentation Slide tab: the slides' edits — New Slide, after the current
 * slide, then Delete Slide and Change Layout, of the current slide or those
 * picked in the thumbnails — then what goes on a slide: a text box and the
 * gallery's shapes, dragged out on it, a picture, and a table sized on a grid —
 * then New Comment, on what is selected or else the slide. All icons, named by
 * their tooltips. A deck's strip opens on it, and slides or sections picked or
 * nothing selected open it.
 */
const PRESENTATION_SLIDE_TAB: EditTab = {
    id: "slide",
    label: "ribbon.slide",
    icon: ICON_TAB_SLIDE,
    commands: [
        "createSlide",
        "deleteSlide",
        "changeLayout",
        "insertTextBox",
        "insertGalleryShape",
        "insertImage",
        "insertTable",
        "newComment",
    ] satisfies EditCommandId[],
    opensOnEntry: true,
    opensFor: slidesOrNothing,
};

/**
 * The spreadsheet Cell tab — the selected cells formatted as Excel's Home tab
 * formats them: the Text tab's font fields, Bold, Italic, Underline and
 * Strikethrough, and Text Color, with Fill Color beside it; Border Color and
 * Border; the Alignment dropdown, Wrap Text and Merge & Center; the Number
 * Format dropdown and the two decimal steps; Clear Formats; and New Comment, on
 * the active cell. A workbook's strip opens on it, and a selection of cells
 * opens it.
 */
const CELL_TAB: EditTab = {
    id: "cell",
    label: "ribbon.cell",
    icon: ICON_TAB_CELL,
    commands: [
        "fontFamily",
        "fontSize",
        "bold",
        "italic",
        "underline",
        "strikethrough",
        "textFill",
        "cellFill",
        "cellBorderColor",
        "cellBorder",
        "cellAlign",
        "cellWrap",
        "cellMerge",
        "cellNumberFormat",
        "cellDecimalsUp",
        "cellDecimalsDown",
        "cellClearFormats",
        "newComment",
    ] satisfies EditCommandId[],
    opensOnEntry: true,
    opensFor: sheetCells,
};

/** `docType`'s View tab, as edit mode has it: with the views edit mode alone
 *  offers, and the ruler among its guides where edit mode draws one — over a
 *  PDF's pages, a deck's slides and a word document's pages. */
function editViewTab(docType: UDocType): EditTab {
    return viewTab(docType, { guides: RULED.has(docType) ? ["ruler"] : [] });
}

/** The strip of a doc type with none of its own: no tabs. */
const DEFAULT_TABS: readonly EditTab[] = [];

/** The portable (PDF) strip: its own Page, then Object (the page's content
 *  objects) and Annotate, but no Text tab, then Present, and its View last. */
const PORTABLE_TABS: readonly EditTab[] = [
    PORTABLE_PAGE_TAB,
    OBJECT_TAB,
    PORTABLE_ANNOTATE_TAB,
    presentTab("portable"),
    editViewTab("portable"),
];

/** The presentation strip: its own Slide, then Text (character formatting),
 *  Table and Shape (free-floating graphics), then Present, and its View last.
 *  Table goes ahead of Shape as Text does: a block of cells also reports the
 *  edits of the frame around them, and the first tab holding for it opens. */
const PRESENTATION_TABS: readonly EditTab[] = [
    PRESENTATION_SLIDE_TAB,
    PRESENTATION_TEXT_TAB,
    TABLE_TAB,
    SHAPE_TAB,
    presentTab("presentation"),
    editViewTab("presentation"),
];

/** A word document's Review tab in edit mode: view mode's, with Accept and
 *  Reject after its markup controls, where Word's Changes group stands. */
const WORDPROCESSING_REVIEW_TAB: EditTab = {
    ...REVIEW_TAB,
    commands: ["trackChanges", "revisionView", "markupOptions", "acceptRevisions", "rejectRevisions", "newComment"],
};

/** The wordprocessing strip: Text, then Table, then Shape for the drawings in
 *  its flow, then Review, and its View last. */
const WORDPROCESSING_TABS: readonly EditTab[] = [
    WORDPROCESSING_TEXT_TAB,
    TABLE_TAB,
    WORDPROCESSING_SHAPE_TAB,
    WORDPROCESSING_REVIEW_TAB,
    editViewTab("wordprocessing"),
];

/** The image strip: its own Image, then the Text, Table and Shape tabs of what
 *  is drawn over its pages — a deck's, as they are a slide's shapes and tables —
 *  and its View last. Table goes ahead of Shape, as on a deck. */
const IMAGE_TABS: readonly EditTab[] = [IMAGE_TAB, PRESENTATION_TEXT_TAB, TABLE_TAB, SHAPE_TAB, editViewTab("image")];

/** The spreadsheet strip: its Cell tab, and its View. */
const SPREADSHEET_TABS: readonly EditTab[] = [CELL_TAB, editViewTab("spreadsheet")];

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
