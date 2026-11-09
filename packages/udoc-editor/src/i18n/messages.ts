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
    /** Rotate Page Left */
    "pageControls.rotateLeft": string;
    /** Rotate Page {page} Left */
    "pageControls.rotateLeftLabel": string;
    /** Rotate Page Right */
    "pageControls.rotate": string;
    /** Rotate Page {page} Right */
    "pageControls.rotateLabel": string;
    /** Resize Page {page} */
    "pageControls.resizeLabel": string;
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
    /** Layout */
    "pageSettings.layout": string;
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
    /** Image */
    "ribbon.image": string;
    /** Page */
    "ribbon.page": string;
    /** Insert */
    "ribbon.insert": string;
    /** Slide */
    "ribbon.slide": string;
    /** Text */
    "ribbon.text": string;
    /** Shape */
    "ribbon.shape": string;
    /** Table */
    "ribbon.table": string;
    /** Object */
    "ribbon.object": string;

    // Commands
    /** Ruler */
    "command.ruler": string;
    /** New Slide */
    "command.createSlide": string;
    /** Image */
    "command.insertImage": string;
    /** Table */
    "command.insertTable": string;
    /** {columns} × {rows} Table — the size Insert Table's grid points at */
    "command.insertTableSize": string;
    /** Shapes */
    "command.insertShape": string;
    /** Change Shape */
    "command.changeShape": string;
    /** Change Layout */
    "command.changeLayout": string;
    /** Crop */
    "command.cropPage": string;
    /** Image Size */
    "command.resizePage": string;
    /** Resize Page */
    "command.pageResize": string;
    /** Paragraph Style */
    "command.paragraphStyle": string;
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
    /** Fill */
    "command.objectFillColor": string;
    /** Line */
    "command.objectStrokeColor": string;

    // The layout picker, New Slide's and Change Layout's
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

    // Paragraph Style — Word's built-in styles, by the names Word gives them
    /** Normal */
    "paragraphStyle.normal": string;
    /** No Spacing */
    "paragraphStyle.noSpacing": string;
    /** Heading {level} */
    "paragraphStyle.heading": string;
    /** Title */
    "paragraphStyle.title": string;
    /** Subtitle */
    "paragraphStyle.subtitle": string;
    /** Quote */
    "paragraphStyle.quote": string;
    /** Intense Quote */
    "paragraphStyle.intenseQuote": string;
    /** List Paragraph */
    "paragraphStyle.listParagraph": string;
    /** Normal (Web) */
    "paragraphStyle.normalWeb": string;
    /** HTML Preformatted */
    "paragraphStyle.htmlPreformatted": string;

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
    "table.row": string;
    /** Column */
    "table.column": string;
    /** Table */
    "table.table": string;
    /** Row Above */
    "table.rowAbove": string;
    /** Row Below */
    "table.rowBelow": string;
    /** Column Left */
    "table.columnLeft": string;
    /** Column Right */
    "table.columnRight": string;
    /** Rows */
    "table.rows": string;
    /** Columns */
    "table.columns": string;
    /** Select */
    "table.select": string;
    /** Insert */
    "table.insert": string;
    /** Delete */
    "table.delete": string;

    // The Table tab's dropdowns, whose buttons show only an icon
    /** Select Row */
    "table.selectRow": string;
    /** Select Column */
    "table.selectColumn": string;
    /** Select Table */
    "table.selectTable": string;
    /** Insert Row Above */
    "table.insertRowAbove": string;
    /** Insert Row Below */
    "table.insertRowBelow": string;
    /** Insert Column Left */
    "table.insertColumnLeft": string;
    /** Insert Column Right */
    "table.insertColumnRight": string;
    /** Delete Rows */
    "table.deleteRows": string;
    /** Delete Columns */
    "table.deleteColumns": string;
    /** Delete Table */
    "table.deleteTable": string;
    /** Merge Cells */
    "table.mergeCells": string;
    /** Unmerge Cells */
    "table.unmergeCells": string;
    /** Cells */
    "table.cells": string;
    /** Distribute Columns */
    "table.distributeColumns": string;
    /** Shading */
    "table.shading": string;
    /** Border */
    "table.border": string;
    /** Border Options */
    "table.borderOptions": string;
    /** Border Color */
    "table.borderColor": string;
    /** All Borders */
    "table.borderAll": string;
    /** Outside Borders */
    "table.borderOutside": string;
    /** Inside Borders */
    "table.borderInside": string;
    /** Top Border */
    "table.borderTop": string;
    /** Bottom Border */
    "table.borderBottom": string;
    /** Left Border */
    "table.borderLeft": string;
    /** Right Border */
    "table.borderRight": string;
    /** Inside Horizontal Border */
    "table.borderInsideHorizontal": string;
    /** Inside Vertical Border */
    "table.borderInsideVertical": string;
    /** Diagonal Down Border */
    "table.borderDiagonalDown": string;
    /** Diagonal Up Border */
    "table.borderDiagonalUp": string;
    /** No Border */
    "table.borderNone": string;
    /** Cell Alignment */
    "table.cellAlignment": string;
    /** Top */
    "table.alignTop": string;
    /** Center */
    "table.alignCenter": string;
    /** Bottom */
    "table.alignBottom": string;
    /** Text Direction */
    "table.textDirection": string;
    /** Horizontal */
    "table.directionHorizontal": string;
    /** Rotate 90° */
    "table.directionRotate90": string;
    /** Rotate 270° */
    "table.directionRotate270": string;
    /** Stacked */
    "table.directionStacked": string;
    /** Style Options */
    "table.styleOptions": string;
    /** Header Row */
    "table.headerRow": string;
    /** Total Row */
    "table.totalRow": string;
    /** Banded Rows */
    "table.bandedRows": string;
    /** First Column */
    "table.firstColumn": string;
    /** Last Column */
    "table.lastColumn": string;
    /** Banded Columns */
    "table.bandedColumns": string;
    /** Table Properties */
    "table.properties": string;
    /** Size */
    "table.size": string;
    /** Row height */
    "table.rowHeight": string;
    /** Column width */
    "table.columnWidth": string;
    /** Cell margins */
    "table.cellMargins": string;
    /** Top */
    "table.marginTop": string;
    /** Bottom */
    "table.marginBottom": string;
    /** Left */
    "table.marginLeft": string;
    /** Right */
    "table.marginRight": string;
    /** Repeat as header row on each page */
    "table.repeatHeaderRow": string;

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

    // The shape gallery (a deck's Slide tab, an image's Image tab): each
    // group's heading, and each shape's name, its tooltip
    /** Lines */
    "shapeGroup.lines": string;
    /** Rectangles */
    "shapeGroup.rectangles": string;
    /** Basic Shapes */
    "shapeGroup.basicShapes": string;
    /** Block Arrows */
    "shapeGroup.blockArrows": string;
    /** Equation Shapes */
    "shapeGroup.equationShapes": string;
    /** Flowchart */
    "shapeGroup.flowchart": string;
    /** Stars and Banners */
    "shapeGroup.starsAndBanners": string;
    /** Callouts */
    "shapeGroup.callouts": string;
    /** Action Buttons */
    "shapeGroup.actionButtons": string;
    /** Line */
    "shapeName.line": string;
    /** Line Arrow */
    "shapeName.lineArrow": string;
    /** Line Arrow: Double */
    "shapeName.lineDoubleArrow": string;
    /** Connector: Elbow */
    "shapeName.bentConnector3": string;
    /** Connector: Elbow Arrow */
    "shapeName.bentConnector3Arrow": string;
    /** Connector: Elbow Double-Arrow */
    "shapeName.bentConnector3DoubleArrow": string;
    /** Connector: Curved */
    "shapeName.curvedConnector3": string;
    /** Connector: Curved Arrow */
    "shapeName.curvedConnector3Arrow": string;
    /** Connector: Curved Double-Arrow */
    "shapeName.curvedConnector3DoubleArrow": string;
    /** Connector: Elbow, One Bend */
    "shapeName.bentConnector2": string;
    /** Connector: Elbow, Three Bends */
    "shapeName.bentConnector4": string;
    /** Connector: Elbow, Four Bends */
    "shapeName.bentConnector5": string;
    /** Connector: Curved, One Bend */
    "shapeName.curvedConnector2": string;
    /** Connector: Curved, Three Bends */
    "shapeName.curvedConnector4": string;
    /** Connector: Curved, Four Bends */
    "shapeName.curvedConnector5": string;
    /** Rectangle */
    "shapeName.rect": string;
    /** Rectangle: Rounded Corners */
    "shapeName.roundRect": string;
    /** Rectangle: Single Corner Snipped */
    "shapeName.snip1Rect": string;
    /** Rectangle: Top Corners Snipped */
    "shapeName.snip2SameRect": string;
    /** Rectangle: Diagonal Corners Snipped */
    "shapeName.snip2DiagRect": string;
    /** Rectangle: Top Corners One Rounded and One Snipped */
    "shapeName.snipRoundRect": string;
    /** Rectangle: Single Corner Rounded */
    "shapeName.round1Rect": string;
    /** Rectangle: Top Corners Rounded */
    "shapeName.round2SameRect": string;
    /** Rectangle: Diagonal Corners Rounded */
    "shapeName.round2DiagRect": string;
    /** Oval */
    "shapeName.ellipse": string;
    /** Isosceles Triangle */
    "shapeName.triangle": string;
    /** Right Triangle */
    "shapeName.rtTriangle": string;
    /** Parallelogram */
    "shapeName.parallelogram": string;
    /** Trapezoid */
    "shapeName.trapezoid": string;
    /** Trapezoid: Non-isosceles */
    "shapeName.nonIsoscelesTrapezoid": string;
    /** Diamond */
    "shapeName.diamond": string;
    /** Regular Pentagon */
    "shapeName.pentagon": string;
    /** Hexagon */
    "shapeName.hexagon": string;
    /** Heptagon */
    "shapeName.heptagon": string;
    /** Octagon */
    "shapeName.octagon": string;
    /** Decagon */
    "shapeName.decagon": string;
    /** Dodecagon */
    "shapeName.dodecagon": string;
    /** Partial Circle */
    "shapeName.pie": string;
    /** Pie Wedge */
    "shapeName.pieWedge": string;
    /** Chord */
    "shapeName.chord": string;
    /** Teardrop */
    "shapeName.teardrop": string;
    /** Frame */
    "shapeName.frame": string;
    /** Half Frame */
    "shapeName.halfFrame": string;
    /** L-Shape */
    "shapeName.corner": string;
    /** Diagonal Stripe */
    "shapeName.diagStripe": string;
    /** Cross */
    "shapeName.plus": string;
    /** Plaque */
    "shapeName.plaque": string;
    /** Cylinder */
    "shapeName.can": string;
    /** Cube */
    "shapeName.cube": string;
    /** Rectangle: Beveled */
    "shapeName.bevel": string;
    /** Circle: Hollow */
    "shapeName.donut": string;
    /** “Not Allowed” Symbol */
    "shapeName.noSmoking": string;
    /** Block Arc */
    "shapeName.blockArc": string;
    /** Rectangle: Folded Corner */
    "shapeName.foldedCorner": string;
    /** Smiley Face */
    "shapeName.smileyFace": string;
    /** Heart */
    "shapeName.heart": string;
    /** Lightning Bolt */
    "shapeName.lightningBolt": string;
    /** Sun */
    "shapeName.sun": string;
    /** Moon */
    "shapeName.moon": string;
    /** Cloud */
    "shapeName.cloud": string;
    /** Arc */
    "shapeName.arc": string;
    /** Double Bracket */
    "shapeName.bracketPair": string;
    /** Double Brace */
    "shapeName.bracePair": string;
    /** Left Bracket */
    "shapeName.leftBracket": string;
    /** Right Bracket */
    "shapeName.rightBracket": string;
    /** Left Brace */
    "shapeName.leftBrace": string;
    /** Right Brace */
    "shapeName.rightBrace": string;
    /** Gear: 6 Teeth */
    "shapeName.gear6": string;
    /** Gear: 9 Teeth */
    "shapeName.gear9": string;
    /** Funnel */
    "shapeName.funnel": string;
    /** Corner Tabs */
    "shapeName.cornerTabs": string;
    /** Square Tabs */
    "shapeName.squareTabs": string;
    /** Plaque Tabs */
    "shapeName.plaqueTabs": string;
    /** Chart: X */
    "shapeName.chartX": string;
    /** Chart: Star */
    "shapeName.chartStar": string;
    /** Chart: Plus */
    "shapeName.chartPlus": string;
    /** Arrow: Right */
    "shapeName.rightArrow": string;
    /** Arrow: Left */
    "shapeName.leftArrow": string;
    /** Arrow: Up */
    "shapeName.upArrow": string;
    /** Arrow: Down */
    "shapeName.downArrow": string;
    /** Arrow: Left-Right */
    "shapeName.leftRightArrow": string;
    /** Arrow: Up-Down */
    "shapeName.upDownArrow": string;
    /** Arrow: Quad */
    "shapeName.quadArrow": string;
    /** Arrow: Left-Right-Up */
    "shapeName.leftRightUpArrow": string;
    /** Arrow: Bent */
    "shapeName.bentArrow": string;
    /** Arrow: U-Turn */
    "shapeName.uTurnArrow": string;
    /** Arrow: Left-Up */
    "shapeName.leftUpArrow": string;
    /** Arrow: Bent-Up */
    "shapeName.bentUpArrow": string;
    /** Arrow: Curved Right */
    "shapeName.curvedRightArrow": string;
    /** Arrow: Curved Left */
    "shapeName.curvedLeftArrow": string;
    /** Arrow: Curved Up */
    "shapeName.curvedUpArrow": string;
    /** Arrow: Curved Down */
    "shapeName.curvedDownArrow": string;
    /** Arrow: Striped Right */
    "shapeName.stripedRightArrow": string;
    /** Arrow: Notched Right */
    "shapeName.notchedRightArrow": string;
    /** Arrow: Pentagon */
    "shapeName.homePlate": string;
    /** Arrow: Chevron */
    "shapeName.chevron": string;
    /** Callout: Right Arrow */
    "shapeName.rightArrowCallout": string;
    /** Callout: Down Arrow */
    "shapeName.downArrowCallout": string;
    /** Callout: Left Arrow */
    "shapeName.leftArrowCallout": string;
    /** Callout: Up Arrow */
    "shapeName.upArrowCallout": string;
    /** Callout: Left-Right Arrow */
    "shapeName.leftRightArrowCallout": string;
    /** Callout: Up-Down Arrow */
    "shapeName.upDownArrowCallout": string;
    /** Callout: Quad Arrow */
    "shapeName.quadArrowCallout": string;
    /** Arrow: Circular */
    "shapeName.circularArrow": string;
    /** Arrow: Circular Left */
    "shapeName.leftCircularArrow": string;
    /** Arrow: Circular Left-Right */
    "shapeName.leftRightCircularArrow": string;
    /** Arrow: Swoosh */
    "shapeName.swooshArrow": string;
    /** Plus Sign */
    "shapeName.mathPlus": string;
    /** Minus Sign */
    "shapeName.mathMinus": string;
    /** Multiplication Sign */
    "shapeName.mathMultiply": string;
    /** Division Sign */
    "shapeName.mathDivide": string;
    /** Equals */
    "shapeName.mathEqual": string;
    /** Not Equal */
    "shapeName.mathNotEqual": string;
    /** Flowchart: Process */
    "shapeName.flowChartProcess": string;
    /** Flowchart: Alternate Process */
    "shapeName.flowChartAlternateProcess": string;
    /** Flowchart: Decision */
    "shapeName.flowChartDecision": string;
    /** Flowchart: Data */
    "shapeName.flowChartInputOutput": string;
    /** Flowchart: Predefined Process */
    "shapeName.flowChartPredefinedProcess": string;
    /** Flowchart: Internal Storage */
    "shapeName.flowChartInternalStorage": string;
    /** Flowchart: Document */
    "shapeName.flowChartDocument": string;
    /** Flowchart: Multidocument */
    "shapeName.flowChartMultidocument": string;
    /** Flowchart: Terminator */
    "shapeName.flowChartTerminator": string;
    /** Flowchart: Preparation */
    "shapeName.flowChartPreparation": string;
    /** Flowchart: Manual Input */
    "shapeName.flowChartManualInput": string;
    /** Flowchart: Manual Operation */
    "shapeName.flowChartManualOperation": string;
    /** Flowchart: Connector */
    "shapeName.flowChartConnector": string;
    /** Flowchart: Off-page Connector */
    "shapeName.flowChartOffpageConnector": string;
    /** Flowchart: Card */
    "shapeName.flowChartPunchedCard": string;
    /** Flowchart: Punched Tape */
    "shapeName.flowChartPunchedTape": string;
    /** Flowchart: Summing Junction */
    "shapeName.flowChartSummingJunction": string;
    /** Flowchart: Or */
    "shapeName.flowChartOr": string;
    /** Flowchart: Collate */
    "shapeName.flowChartCollate": string;
    /** Flowchart: Sort */
    "shapeName.flowChartSort": string;
    /** Flowchart: Extract */
    "shapeName.flowChartExtract": string;
    /** Flowchart: Merge */
    "shapeName.flowChartMerge": string;
    /** Flowchart: Stored Data */
    "shapeName.flowChartOnlineStorage": string;
    /** Flowchart: Offline Storage */
    "shapeName.flowChartOfflineStorage": string;
    /** Flowchart: Delay */
    "shapeName.flowChartDelay": string;
    /** Flowchart: Sequential Access Storage */
    "shapeName.flowChartMagneticTape": string;
    /** Flowchart: Magnetic Disk */
    "shapeName.flowChartMagneticDisk": string;
    /** Flowchart: Direct Access Storage */
    "shapeName.flowChartMagneticDrum": string;
    /** Flowchart: Display */
    "shapeName.flowChartDisplay": string;
    /** Explosion: 8 Points */
    "shapeName.irregularSeal1": string;
    /** Explosion: 14 Points */
    "shapeName.irregularSeal2": string;
    /** Star: 4 Points */
    "shapeName.star4": string;
    /** Star: 5 Points */
    "shapeName.star5": string;
    /** Star: 6 Points */
    "shapeName.star6": string;
    /** Star: 7 Points */
    "shapeName.star7": string;
    /** Star: 8 Points */
    "shapeName.star8": string;
    /** Star: 10 Points */
    "shapeName.star10": string;
    /** Star: 12 Points */
    "shapeName.star12": string;
    /** Star: 16 Points */
    "shapeName.star16": string;
    /** Star: 24 Points */
    "shapeName.star24": string;
    /** Star: 32 Points */
    "shapeName.star32": string;
    /** Ribbon: Tilted Up */
    "shapeName.ribbon2": string;
    /** Ribbon: Tilted Down */
    "shapeName.ribbon": string;
    /** Ribbon: Curved and Tilted Up */
    "shapeName.ellipseRibbon2": string;
    /** Ribbon: Curved and Tilted Down */
    "shapeName.ellipseRibbon": string;
    /** Ribbon: Left-Right */
    "shapeName.leftRightRibbon": string;
    /** Scroll: Vertical */
    "shapeName.verticalScroll": string;
    /** Scroll: Horizontal */
    "shapeName.horizontalScroll": string;
    /** Wave */
    "shapeName.wave": string;
    /** Double Wave */
    "shapeName.doubleWave": string;
    /** Speech Bubble: Rectangle */
    "shapeName.wedgeRectCallout": string;
    /** Speech Bubble: Rectangle with Corners Rounded */
    "shapeName.wedgeRoundRectCallout": string;
    /** Speech Bubble: Oval */
    "shapeName.wedgeEllipseCallout": string;
    /** Thought Bubble: Cloud */
    "shapeName.cloudCallout": string;
    /** Callout: Line */
    "shapeName.borderCallout1": string;
    /** Callout: Bent Line */
    "shapeName.borderCallout2": string;
    /** Callout: Double Bent Line */
    "shapeName.borderCallout3": string;
    /** Callout: Line with Accent Bar */
    "shapeName.accentCallout1": string;
    /** Callout: Bent Line with Accent Bar */
    "shapeName.accentCallout2": string;
    /** Callout: Double Bent Line with Accent Bar */
    "shapeName.accentCallout3": string;
    /** Callout: Line with No Border */
    "shapeName.callout1": string;
    /** Callout: Bent Line with No Border */
    "shapeName.callout2": string;
    /** Callout: Double Bent Line with No Border */
    "shapeName.callout3": string;
    /** Callout: Line with Border and Accent Bar */
    "shapeName.accentBorderCallout1": string;
    /** Callout: Bent Line with Border and Accent Bar */
    "shapeName.accentBorderCallout2": string;
    /** Callout: Double Bent Line with Border and Accent Bar */
    "shapeName.accentBorderCallout3": string;
    /** Action Button: Back or Previous */
    "shapeName.actionButtonBackPrevious": string;
    /** Action Button: Forward or Next */
    "shapeName.actionButtonForwardNext": string;
    /** Action Button: Beginning */
    "shapeName.actionButtonBeginning": string;
    /** Action Button: End */
    "shapeName.actionButtonEnd": string;
    /** Action Button: Home */
    "shapeName.actionButtonHome": string;
    /** Action Button: Information */
    "shapeName.actionButtonInformation": string;
    /** Action Button: Return */
    "shapeName.actionButtonReturn": string;
    /** Action Button: Video */
    "shapeName.actionButtonMovie": string;
    /** Action Button: Document */
    "shapeName.actionButtonDocument": string;
    /** Action Button: Sound */
    "shapeName.actionButtonSound": string;
    /** Action Button: Help */
    "shapeName.actionButtonHelp": string;
    /** Action Button: Blank */
    "shapeName.actionButtonBlank": string;
}

/** The strings edit mode adds, and udoc-ui's it words its own way — the
 *  toolbar's label: the shape of each of the editor's language packs. */
export type EditMessages = Omit<Messages, keyof UIMessages> & Pick<UIMessages, "toolbar.label">;
