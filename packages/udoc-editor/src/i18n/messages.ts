import type { Messages as UIMessages } from "@docmentis/udoc-ui";

/**
 * Every string the editor's chrome shows, by key: udoc-ui's, and the ones edit
 * mode adds — the shape of the `translations` option. As in udoc-ui's, a
 * `{name}` in a string is a value the editor fills in.
 */
export interface Messages extends UIMessages {
    // Modes
    /** View */
    "mode.view": string;
    /** Edit */
    "mode.edit": string;

    // Mode switcher
    /** Editor Mode */
    "modeSwitch.label": string;

    // Page controls
    /** Page {page} controls */
    "pageControls.label": string;
    /** Move Page Up */
    "pageControls.moveUp": string;
    /** Move Page {page} Up */
    "pageControls.moveUpLabel": string;
    /** Move Page Down */
    "pageControls.moveDown": string;
    /** Move Page {page} Down */
    "pageControls.moveDownLabel": string;
    /** Rotate Page Right */
    "pageControls.rotate": string;
    /** Rotate Page {page} Right */
    "pageControls.rotateLabel": string;
    /** Page Settings */
    "pageControls.settings": string;
    /** Page {page} Settings */
    "pageControls.settingsLabel": string;
    /** Delete Page */
    "pageControls.delete": string;
    /** Delete Page {page} */
    "pageControls.deleteLabel": string;
    /** Insert Page Here */
    "pageControls.insert": string;
    /** Insert Page at the End */
    "pageControls.insertAtEnd": string;
    /** Insert Page Before Page {page} */
    "pageControls.insertBefore": string;

    // Page settings dialog
    /** Page {page} */
    "pageSettings.title": string;
    /** Page {page} settings */
    "pageSettings.label": string;
    /** Page Size */
    "pageSettings.pageSize": string;
    /** Page size preset */
    "pageSettings.preset": string;
    /** Width */
    "pageSettings.width": string;
    /** Height */
    "pageSettings.height": string;
    /** Page width */
    "pageSettings.pageWidth": string;
    /** Page height */
    "pageSettings.pageHeight": string;
    /** Units */
    "pageSettings.units": string;
    /** in */
    "pageSettings.inches": string;
    /** mm */
    "pageSettings.millimeters": string;
    /** pt */
    "pageSettings.points": string;
    /** Portrait */
    "pageSettings.portrait": string;
    /** Landscape */
    "pageSettings.landscape": string;
    /** Rotation */
    "pageSettings.rotation": string;
    /** Rotate Left */
    "pageSettings.rotateLeft": string;
    /** Rotate Page Left */
    "pageSettings.rotatePageLeft": string;
    /** Rotate Right */
    "pageSettings.rotateRight": string;
    /** Rotate Page Right */
    "pageSettings.rotatePageRight": string;
    /** Apply Size */
    "pageSettings.applySize": string;

    // Page sizes
    /** Letter */
    "pageSize.letter": string;
    /** Legal */
    "pageSize.legal": string;
    /** Tabloid */
    "pageSize.tabloid": string;
    /** A3 */
    "pageSize.a3": string;
    /** A4 */
    "pageSize.a4": string;
    /** A5 */
    "pageSize.a5": string;
    /** Custom */
    "pageSize.custom": string;

    // Ribbon tabs
    /** Home */
    "ribbon.home": string;
    /** Insert */
    "ribbon.insert": string;
    /** Text */
    "ribbon.text": string;
    /** Shape */
    "ribbon.shape": string;
    /** Object */
    "ribbon.object": string;

    // Commands
    /** Show Formatting Marks */
    "command.formattingMarks": string;
    /** New Slide */
    "command.createSlide": string;
    /** Image */
    "command.insertImage": string;
    /** Shapes */
    "command.insertShape": string;
    /** Crop */
    "command.cropPage": string;
    /** Image Size */
    "command.resizePage": string;
    /** Font */
    "command.fontFamily": string;
    /** Size */
    "command.fontSize": string;
    /** Bold */
    "command.bold": string;
    /** Italic */
    "command.italic": string;
    /** Underline */
    "command.underline": string;
    /** Strikethrough */
    "command.strikethrough": string;
    /** Superscript */
    "command.superscript": string;
    /** Subscript */
    "command.subscript": string;
    /** Scale */
    "command.widthScale": string;
    /** Text Color */
    "command.textFill": string;
    /** Highlight */
    "command.textHighlight": string;
    /** Align & Indent */
    "command.paragraphAlign": string;
    /** Line & Paragraph Spacing */
    "command.lineSpacing": string;
    /** Bulleted List */
    "command.bulletList": string;
    /** Numbered List */
    "command.numberList": string;
    /** Fill */
    "command.shapeFillColor": string;
    /** Line */
    "command.shapeStrokeColor": string;
    /** Arrange */
    "command.shapeArrange": string;
    /** Fill */
    "command.objectFillColor": string;
    /** Line */
    "command.objectStrokeColor": string;
    /** Arrange */
    "command.objectArrange": string;

    // New Slide dialog
    /** New slide layout */
    "newSlide.label": string;
    /** Slide layouts */
    "newSlide.layouts": string;
    /** Layout {index} */
    "newSlide.layout": string;

    // Shared
    /** Done */
    "common.done": string;

    // Ribbon
    /** No matching fonts */
    "ribbon.noMatchingFonts": string;
    /** {label} Options */
    "ribbon.listOptions": string;
    /** {label} styles */
    "ribbon.listStyles": string;

    // Align & Indent, Line & Paragraph Spacing
    /** Align Left */
    "paragraph.alignLeft": string;
    /** Center */
    "paragraph.center": string;
    /** Align Right */
    "paragraph.alignRight": string;
    /** Justify */
    "paragraph.justify": string;
    /** Increase Indent */
    "paragraph.increaseIndent": string;
    /** Decrease Indent */
    "paragraph.decreaseIndent": string;
    /** Single */
    "paragraph.lineSpacingSingle": string;
    /** Double */
    "paragraph.lineSpacingDouble": string;
    /** {lines} */
    "paragraph.lineSpacingLines": string;
    /** Space Before Paragraph */
    "paragraph.spaceBefore": string;
    /** Space After Paragraph */
    "paragraph.spaceAfter": string;

    // Bullet and numbering galleries, by style id
    /** Filled Round Bullets */
    "list.disc": string;
    /** Hollow Round Bullets */
    "list.circle": string;
    /** Filled Square Bullets */
    "list.square": string;
    /** Diamond Bullets */
    "list.diamond": string;
    /** Arrow Bullets */
    "list.arrow": string;
    /** Dash Bullets */
    "list.dash": string;
    /** Numbers Followed by a Period */
    "list.decimal": string;
    /** Numbers Followed by a Parenthesis */
    "list.decimalParen": string;
    /** Lowercase Letters */
    "list.lowerLetter": string;
    /** Uppercase Letters */
    "list.upperLetter": string;
    /** Lowercase Roman Numerals */
    "list.lowerRoman": string;
    /** Uppercase Roman Numerals */
    "list.upperRoman": string;

    // Arrange
    /** Bring to Front */
    "arrange.bringToFront": string;
    /** Bring Forward */
    "arrange.bringForward": string;
    /** Send Backward */
    "arrange.sendBackward": string;
    /** Send to Back */
    "arrange.sendToBack": string;
    /** Align Left */
    "arrange.alignLeft": string;
    /** Align Center */
    "arrange.alignCenter": string;
    /** Align Right */
    "arrange.alignRight": string;
    /** Align Top */
    "arrange.alignTop": string;
    /** Align Middle */
    "arrange.alignMiddle": string;
    /** Align Bottom */
    "arrange.alignBottom": string;
    /** Distribute Horizontally */
    "arrange.distributeHorizontally": string;
    /** Distribute Vertically */
    "arrange.distributeVertically": string;
    /** Align to Page */
    "arrange.alignToPage": string;
    /** Rotate 90° Right */
    "arrange.rotateRight": string;
    /** Rotate 90° Left */
    "arrange.rotateLeft": string;
    /** Flip Horizontal */
    "arrange.flipHorizontal": string;
    /** Flip Vertical */
    "arrange.flipVertical": string;
    /** Order */
    "arrange.order": string;
    /** Align */
    "arrange.align": string;
    /** Rotate */
    "arrange.rotate": string;
    /** Group */
    "arrange.group": string;
    /** Ungroup */
    "arrange.ungroup": string;

    // Fill / Line options dialog
    /** Fill Options */
    "paintOptions.fillTitle": string;
    /** Line Options */
    "paintOptions.lineTitle": string;
    /** Text Color Options */
    "paintOptions.textColorTitle": string;
    /** Highlight Options */
    "paintOptions.highlightTitle": string;
    /** Custom colors and gradient, pattern, and picture fills will live here. */
    "paintOptions.fillBlurb": string;
    /** Custom colors, compound lines, caps and joins, and arrow ends will live here. */
    "paintOptions.lineBlurb": string;
    /** Custom colors and more text-color options will live here. */
    "paintOptions.textColorBlurb": string;
    /** Custom colors and more highlight options will live here. */
    "paintOptions.highlightBlurb": string;

    // Busy hold
    /** Loading {font}… */
    "busy.loadingFont": string;

    // Context menu
    /** Cut */
    "contextMenu.cut": string;
    /** Paste */
    "contextMenu.paste": string;
    /** Delete */
    "contextMenu.delete": string;

    // Context menu over a table
    /** Row */
    "table.selectRow": string;
    /** Column */
    "table.selectColumn": string;
    /** Table */
    "table.selectTable": string;
    /** Row Above */
    "table.rowAbove": string;
    /** Row Below */
    "table.rowBelow": string;
    /** Column Left */
    "table.columnLeft": string;
    /** Column Right */
    "table.columnRight": string;
    /** Rows */
    "table.deleteRows": string;
    /** Columns */
    "table.deleteColumns": string;
    /** Select */
    "table.select": string;
    /** Insert */
    "table.insert": string;
    /** Delete */
    "table.delete": string;
    /** Merge Cells */
    "table.mergeCells": string;
    /** Unmerge Cells */
    "table.unmergeCells": string;

    // Crop mode and the Image Size dialog
    /** Aspect Ratio */
    "image.aspectRatio": string;
    /** Free */
    "image.free": string;
    /** Original */
    "image.original": string;
    /** Square */
    "image.square": string;
    /** {ratio} — a preset aspect, `4:3` */
    "image.ratio": string;
    /** {width} × {height} px */
    "image.cropSize": string;
    /** Reset */
    "image.reset": string;
    /** Apply */
    "image.apply": string;
    /** Keep Aspect Ratio */
    "image.keepRatio": string;
    /** Original: {width} × {height} px */
    "image.originalSize": string;
    /** px */
    "image.pixels": string;
}

/** The strings edit mode adds, and udoc-ui's it words its own way — the
 *  toolbar's label: the shape of each of the editor's language packs. */
export type EditMessages = Omit<Messages, keyof UIMessages> & Pick<UIMessages, "toolbar.label">;
