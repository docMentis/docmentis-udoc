import type { EditMessages } from "./messages.js";

/** English — the pack every other is translated from, and the one a tag
 *  with no pack of its own reads. */
export const en: EditMessages = {
    // Modes
    "mode.view": "View",
    "mode.edit": "Edit",

    // Mode switcher
    "modeSwitch.label": "Editor Mode",

    // Page controls
    "pageControls.label": "Page {page} controls",
    "pageControls.moveUp": "Move Page Up",
    "pageControls.moveUpLabel": "Move Page {page} Up",
    "pageControls.moveDown": "Move Page Down",
    "pageControls.moveDownLabel": "Move Page {page} Down",
    "pageControls.rotate": "Rotate Page Right",
    "pageControls.rotateLabel": "Rotate Page {page} Right",
    "pageControls.settings": "Page Settings",
    "pageControls.settingsLabel": "Page {page} Settings",
    "pageControls.delete": "Delete Page",
    "pageControls.deleteLabel": "Delete Page {page}",
    "pageControls.insert": "Insert Page Here",
    "pageControls.insertAtEnd": "Insert Page at the End",
    "pageControls.insertBefore": "Insert Page Before Page {page}",

    // Page settings dialog
    "pageSettings.title": "Page {page}",
    "pageSettings.label": "Page {page} settings",
    "pageSettings.pageSize": "Page Size",
    "pageSettings.preset": "Page size preset",
    "pageSettings.width": "Width",
    "pageSettings.height": "Height",
    "pageSettings.pageWidth": "Page width",
    "pageSettings.pageHeight": "Page height",
    "pageSettings.units": "Units",
    "pageSettings.inches": "in",
    "pageSettings.millimeters": "mm",
    "pageSettings.points": "pt",
    "pageSettings.portrait": "Portrait",
    "pageSettings.landscape": "Landscape",
    "pageSettings.rotation": "Rotation",
    "pageSettings.rotateLeft": "Rotate Left",
    "pageSettings.rotatePageLeft": "Rotate Page Left",
    "pageSettings.rotateRight": "Rotate Right",
    "pageSettings.rotatePageRight": "Rotate Page Right",
    "pageSettings.applySize": "Apply Size",

    // Page sizes
    "pageSize.letter": "Letter",
    "pageSize.legal": "Legal",
    "pageSize.tabloid": "Tabloid",
    "pageSize.a3": "A3",
    "pageSize.a4": "A4",
    "pageSize.a5": "A5",
    "pageSize.custom": "Custom",

    // Ribbon tabs
    "ribbon.home": "Home",
    "ribbon.insert": "Insert",
    "ribbon.text": "Text",
    "ribbon.shape": "Shape",
    "ribbon.object": "Object",

    // Commands
    "command.ruler": "Ruler",
    "command.createSlide": "New Slide",
    "command.insertImage": "Image",
    "command.insertShape": "Shapes",
    "command.cropPage": "Crop",
    "command.resizePage": "Image Size",
    "command.fontFamily": "Font",
    "command.fontSize": "Size",
    "command.bold": "Bold",
    "command.italic": "Italic",
    "command.underline": "Underline",
    "command.strikethrough": "Strikethrough",
    "command.superscript": "Superscript",
    "command.subscript": "Subscript",
    "command.widthScale": "Scale",
    "command.textFill": "Text Color",
    "command.textHighlight": "Highlight",
    "command.paragraphAlign": "Align & Indent",
    "command.lineSpacing": "Line & Paragraph Spacing",
    "command.bulletList": "Bulleted List",
    "command.numberList": "Numbered List",
    "command.shapeFillColor": "Fill",
    "command.shapeStrokeColor": "Line",
    "command.shapeArrange": "Arrange",
    "command.objectFillColor": "Fill",
    "command.objectStrokeColor": "Line",
    "command.objectArrange": "Arrange",

    // New Slide dialog
    "newSlide.label": "New slide layout",
    "newSlide.layouts": "Slide layouts",
    "newSlide.layout": "Layout {index}",

    // Shared
    "common.done": "Done",

    // Ribbon
    "ribbon.noMatchingFonts": "No matching fonts",
    "ribbon.listOptions": "{label} Options",
    "ribbon.listStyles": "{label} styles",

    // Align & Indent, Line & Paragraph Spacing
    "paragraph.alignLeft": "Align Left",
    "paragraph.center": "Center",
    "paragraph.alignRight": "Align Right",
    "paragraph.justify": "Justify",
    "paragraph.increaseIndent": "Increase Indent",
    "paragraph.decreaseIndent": "Decrease Indent",
    "paragraph.lineSpacingSingle": "Single",
    "paragraph.lineSpacingDouble": "Double",
    "paragraph.lineSpacingLines": "{lines}",
    "paragraph.spaceBefore": "Space Before Paragraph",
    "paragraph.spaceAfter": "Space After Paragraph",

    // Bullet and numbering galleries, by style id
    "list.disc": "Filled Round Bullets",
    "list.circle": "Hollow Round Bullets",
    "list.square": "Filled Square Bullets",
    "list.diamond": "Diamond Bullets",
    "list.arrow": "Arrow Bullets",
    "list.dash": "Dash Bullets",
    "list.decimal": "Numbers Followed by a Period",
    "list.decimalParen": "Numbers Followed by a Parenthesis",
    "list.lowerLetter": "Lowercase Letters",
    "list.upperLetter": "Uppercase Letters",
    "list.lowerRoman": "Lowercase Roman Numerals",
    "list.upperRoman": "Uppercase Roman Numerals",

    // Arrange
    "arrange.bringToFront": "Bring to Front",
    "arrange.bringForward": "Bring Forward",
    "arrange.sendBackward": "Send Backward",
    "arrange.sendToBack": "Send to Back",
    "arrange.alignLeft": "Align Left",
    "arrange.alignCenter": "Align Center",
    "arrange.alignRight": "Align Right",
    "arrange.alignTop": "Align Top",
    "arrange.alignMiddle": "Align Middle",
    "arrange.alignBottom": "Align Bottom",
    "arrange.distributeHorizontally": "Distribute Horizontally",
    "arrange.distributeVertically": "Distribute Vertically",
    "arrange.alignToPage": "Align to Page",
    "arrange.rotateRight": "Rotate 90° Right",
    "arrange.rotateLeft": "Rotate 90° Left",
    "arrange.flipHorizontal": "Flip Horizontal",
    "arrange.flipVertical": "Flip Vertical",
    "arrange.order": "Order",
    "arrange.align": "Align",
    "arrange.rotate": "Rotate",
    "arrange.group": "Group",
    "arrange.ungroup": "Ungroup",

    // Fill / Line options dialog
    "paintOptions.fillTitle": "Fill Options",
    "paintOptions.lineTitle": "Line Options",
    "paintOptions.textColorTitle": "Text Color Options",
    "paintOptions.highlightTitle": "Highlight Options",
    "paintOptions.fillBlurb": "Custom colors and gradient, pattern, and picture fills will live here.",
    "paintOptions.lineBlurb": "Custom colors, compound lines, caps and joins, and arrow ends will live here.",
    "paintOptions.textColorBlurb": "Custom colors and more text-color options will live here.",
    "paintOptions.highlightBlurb": "Custom colors and more highlight options will live here.",

    // Busy hold
    "busy.loadingFont": "Loading {font}…",

    // Context menu
    "contextMenu.cut": "Cut",
    "contextMenu.paste": "Paste",
    "contextMenu.delete": "Delete",

    // Context menu over a table
    "table.selectRow": "Row",
    "table.selectColumn": "Column",
    "table.selectTable": "Table",
    "table.rowAbove": "Row Above",
    "table.rowBelow": "Row Below",
    "table.columnLeft": "Column Left",
    "table.columnRight": "Column Right",
    "table.deleteRows": "Rows",
    "table.deleteColumns": "Columns",
    "table.select": "Select",
    "table.insert": "Insert",
    "table.delete": "Delete",
    "table.mergeCells": "Merge Cells",
    "table.unmergeCells": "Unmerge Cells",

    // Crop mode and the Image Size dialog
    "image.aspectRatio": "Aspect Ratio",
    "image.free": "Free",
    "image.original": "Original",
    "image.square": "Square",
    "image.ratio": "{ratio}",
    "image.cropSize": "{width} × {height} px",
    "image.reset": "Reset",
    "image.apply": "Apply",
    "image.keepRatio": "Keep Aspect Ratio",
    "image.originalSize": "Original: {width} × {height} px",
    "image.pixels": "px",

    // Toolbar
    "toolbar.label": "Editor toolbar",
};
