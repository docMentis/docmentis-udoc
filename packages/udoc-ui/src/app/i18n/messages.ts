/**
 * Every string the chrome shows, by key: the shape of a language pack, and of
 * the `translations` option. A `{name}` in a string is a value filled in. A key ending in a plural category — `.one`, `.few`,
 * `.other`, … — is one form of a counted message, chosen by the count's
 * category in the language; `.other` is the one every language has, and the
 * rest are given where the language has them.
 */
export interface Messages {
    // Shared
    /** Cancel */
    "common.cancel": string;
    /** Save */
    "common.save": string;
    /** Close */
    "common.close": string;
    /** Delete */
    "common.delete": string;

    // Numbers
    /** {percent}% */
    "format.percent": string;
    /** {points} pt */
    "format.points": string;

    // A key that runs a command, as a tooltip names it off a Mac
    /** Ctrl+{key} */
    "shortcut.control": string;
    /** Ctrl+Shift+{key} */
    "shortcut.controlShift": string;
    /** {label} ({shortcut}) */
    "shortcut.tooltip": string;

    // Regions
    /** Skip to document */
    "shell.skipToDocument": string;
    /** Toolbar */
    "shell.regionToolbar": string;
    /** Side panel */
    "shell.regionSidePanel": string;
    /** Document */
    "shell.regionDocument": string;
    /** Search and comments */
    "shell.regionSearchComments": string;

    // Toolbar
    /** Document toolbar */
    "toolbar.label": string;
    /** Menu */
    "toolbar.menu": string;
    /** More */
    "toolbar.more": string;
    /** Search */
    "toolbar.search": string;
    /** Comments */
    "toolbar.comments": string;
    /** Print */
    "toolbar.print": string;
    /** Download */
    "toolbar.download": string;
    /** Dark Mode */
    "toolbar.darkMode": string;
    /** System Theme */
    "toolbar.systemTheme": string;
    /** Light Mode */
    "toolbar.lightMode": string;
    /** Fullscreen */
    "toolbar.fullscreen": string;
    /** Exit Fullscreen */
    "toolbar.exitFullscreen": string;
    /** Developer */
    "toolbar.developer": string;

    // The people button: the collaboration the document is in
    /** Co-editing */
    "collaboration.label": string;
    /** Co-editing Paused */
    "collaboration.paused": string;
    /** Reconnecting… */
    "collaboration.reconnecting": string;
    /** {name} (you) */
    "collaboration.you": string;
    /** Share My Pointer */
    "collaboration.sharePointer": string;
    /** Pause Co-editing */
    "collaboration.pause": string;
    /** Resume Co-editing */
    "collaboration.resume": string;

    // Pointer tools
    /** Select */
    "pointerTool.select": string;
    /** Pan */
    "pointerTool.pan": string;
    /** Zoom */
    "pointerTool.zoom": string;
    /** Pointer Tool Options */
    "pointerTool.options": string;
    /** Pointer tools */
    "pointerTool.menu": string;
    /** Tool: {tool} */
    "pointerTool.tooltip": string;
    /** Pointer Tool: {tool} */
    "pointerTool.label": string;

    // Ribbon tabs
    /** Annotate */
    "ribbon.annotate": string;

    // Ribbon
    /** Tool options */
    "ribbon.label": string;
    /** Tool tabs */
    "ribbon.tabs": string;
    /** More tools */
    "ribbon.more": string;
    /** More tabs */
    "ribbon.moreTabs": string;
    /** {label} options */
    "ribbon.paintOptions": string;

    // Ribbon commands, by command id
    /** Undo */
    "command.undo": string;
    /** Redo */
    "command.redo": string;
    /** Highlight */
    "command.annotateHighlight": string;
    /** Underline */
    "command.annotateUnderline": string;
    /** Strikethrough */
    "command.annotateStrikeOut": string;
    /** Squiggly */
    "command.annotateSquiggly": string;
    /** Note */
    "command.annotateNote": string;
    /** Text Box */
    "command.annotateTextBox": string;
    /** Stamp */
    "command.annotateStamp": string;
    /** Pen */
    "command.annotatePen": string;
    /** Shapes */
    "command.annotateShape": string;
    /** Color */
    "command.annotationColor": string;
    /** Fill */
    "command.annotationFill": string;
    /** Opacity */
    "command.annotationOpacity": string;

    // Shape pickers
    /** Rectangle */
    "shape.rectangle": string;
    /** Ellipse */
    "shape.ellipse": string;
    /** Line */
    "shape.line": string;
    /** Arrow */
    "shape.arrow": string;
    /** Polygon */
    "shape.polygon": string;
    /** Polyline */
    "shape.polyline": string;
    /** Cloud */
    "shape.cloud": string;

    // Standard stamps
    /** Approved */
    "stamp.approved": string;
    /** Experimental */
    "stamp.experimental": string;
    /** Not Approved */
    "stamp.notApproved": string;
    /** As Is */
    "stamp.asIs": string;
    /** Expired */
    "stamp.expired": string;
    /** Not for Public Release */
    "stamp.notForPublicRelease": string;
    /** Confidential */
    "stamp.confidential": string;
    /** Final */
    "stamp.final": string;
    /** Sold */
    "stamp.sold": string;
    /** Departmental */
    "stamp.departmental": string;
    /** For Comment */
    "stamp.forComment": string;
    /** Top Secret */
    "stamp.topSecret": string;
    /** Draft */
    "stamp.draft": string;
    /** For Public Release */
    "stamp.forPublicRelease": string;

    // Color and line panel
    /** No Fill */
    "paint.noFill": string;
    /** No Line */
    "paint.noLine": string;
    /** No Color */
    "paint.noColor": string;
    /** More Fill Options… */
    "paint.moreFillOptions": string;
    /** More Line Options… */
    "paint.moreLineOptions": string;
    /** More Color Options… */
    "paint.moreColorOptions": string;
    /** Theme Colors */
    "paint.themeColors": string;
    /** Standard Colors */
    "paint.standardColors": string;
    /** Recent Colors */
    "paint.recentColors": string;
    /** Text 1 */
    "paint.text1": string;
    /** Background 1 */
    "paint.background1": string;
    /** Text 2 */
    "paint.text2": string;
    /** Background 2 */
    "paint.background2": string;
    /** Accent 1 */
    "paint.accent1": string;
    /** Accent 2 */
    "paint.accent2": string;
    /** Accent 3 */
    "paint.accent3": string;
    /** Accent 4 */
    "paint.accent4": string;
    /** Accent 5 */
    "paint.accent5": string;
    /** Accent 6 */
    "paint.accent6": string;
    /** Lighter {percent}% */
    "paint.lighter": string;
    /** Darker {percent}% */
    "paint.darker": string;
    /** {color}, {variant} */
    "paint.themeVariant": string;
    /** Weight */
    "paint.weight": string;
    /** Dashes */
    "paint.dashes": string;
    /** Solid */
    "paint.solid": string;
    /** Dashed */
    "paint.dashed": string;
    /** Dotted */
    "paint.dotted": string;
    /** Dash Dot */
    "paint.dashDot": string;
    /** Start */
    "paint.start": string;
    /** End */
    "paint.end": string;

    // Standard colors
    /** Dark Red */
    "color.darkRed": string;
    /** Red */
    "color.red": string;
    /** Orange */
    "color.orange": string;
    /** Yellow */
    "color.yellow": string;
    /** Light Green */
    "color.lightGreen": string;
    /** Green */
    "color.green": string;
    /** Light Blue */
    "color.lightBlue": string;
    /** Blue */
    "color.blue": string;
    /** Dark Blue */
    "color.darkBlue": string;
    /** Purple */
    "color.purple": string;

    // Line endings
    /** None */
    "lineEnding.none": string;
    /** Open Arrow */
    "lineEnding.openArrow": string;
    /** Closed Arrow */
    "lineEnding.closedArrow": string;
    /** Circle */
    "lineEnding.circle": string;
    /** Square */
    "lineEnding.square": string;
    /** Diamond */
    "lineEnding.diamond": string;

    // Page navigation
    /** Page navigation and zoom */
    "viewControls.pageNavigation": string;
    /** Slide navigation and zoom */
    "viewControls.slideNavigation": string;
    /** Previous Page */
    "viewControls.previousPage": string;
    /** Next Page */
    "viewControls.nextPage": string;
    /** Page number */
    "viewControls.pageNumber": string;
    /** Previous Slide */
    "viewControls.previousSlide": string;
    /** Next Slide */
    "viewControls.nextSlide": string;
    /** Slide number */
    "viewControls.slideNumber": string;

    // Zoom
    /** Zoom */
    "zoom.label": string;
    /** Zoom In */
    "zoom.zoomIn": string;
    /** Zoom Out */
    "zoom.zoomOut": string;
    /** Zoom Level */
    "zoom.level": string;
    /** Zoom Options */
    "zoom.options": string;
    /** Zoom levels */
    "zoom.levels": string;
    /** Fit Width */
    "zoom.fitWidth": string;
    /** Fit Height */
    "zoom.fitHeight": string;
    /** Fit Page */
    "zoom.fitPage": string;
    /** Fit Slide */
    "zoom.fitSlide": string;

    // View settings
    /** View Settings */
    "viewMode.label": string;
    /** Scroll */
    "viewMode.scroll": string;
    /** Spread */
    "viewMode.spread": string;
    /** Continuous */
    "viewMode.continuous": string;
    /** Layout */
    "viewMode.layout": string;
    /** Single */
    "viewMode.single": string;
    /** Double */
    "viewMode.double": string;
    /** Cover Right */
    "viewMode.coverRight": string;
    /** Cover Left */
    "viewMode.coverLeft": string;
    /** Rotation */
    "viewMode.rotation": string;
    /** {degrees}° */
    "viewMode.degrees": string;
    /** Page Gap */
    "viewMode.pageGap": string;
    /** On */
    "viewMode.on": string;
    /** Off */
    "viewMode.off": string;

    // Status bar
    /** Status bar */
    "statusBar.label": string;

    // Sheets
    /** Sheets */
    "sheet.tabs": string;
    /** All sheets */
    "sheet.all": string;
    /** Scroll tabs left */
    "sheet.scrollLeft": string;
    /** Scroll tabs right */
    "sheet.scrollRight": string;
    /** Sheet {sheet} */
    "sheet.unnamed": string;

    // Left panel
    /** Panel tabs */
    "leftPanel.tabs": string;
    /** Thumbnails */
    "leftPanel.thumbnails": string;
    /** Outline */
    "leftPanel.outline": string;
    /** Layers */
    "leftPanel.layers": string;
    /** Attachments */
    "leftPanel.attachments": string;
    /** Resize side panel */
    "leftPanel.resizeHandle": string;
    /** {panel} — nothing here yet */
    "leftPanel.placeholder": string;

    // Thumbnails
    /** Page thumbnails */
    "thumbnails.pages": string;
    /** Slide thumbnails */
    "thumbnails.slides": string;
    /** Page {page} */
    "thumbnails.page": string;
    /** Slide {page} */
    "thumbnails.slide": string;
    /** Slide {page}, hidden */
    "thumbnails.hiddenSlide": string;
    /** Insert Page */
    "thumbnails.insertPage": string;
    /** Duplicate Page */
    "thumbnails.duplicatePage": string;
    /** Rotate Right */
    "thumbnails.rotateRight": string;
    /** Rotate Left */
    "thumbnails.rotateLeft": string;
    /** Delete Page */
    "thumbnails.deletePage": string;
    /** New Slide */
    "thumbnails.newSlide": string;
    /** Duplicate Slide */
    "thumbnails.duplicateSlide": string;
    /** Hide Slide */
    "thumbnails.hideSlide": string;
    /** Delete Slide */
    "thumbnails.deleteSlide": string;

    // Outline panel
    /** Loading outline… */
    "outline.loading": string;
    /** Couldn't read the outline */
    "outline.readFailed": string;
    /** No outline in this document */
    "outline.empty": string;

    // Layers panel
    /** Loading layers… */
    "layers.loading": string;
    /** Couldn't read the layers */
    "layers.readFailed": string;
    /** No layers in this document */
    "layers.empty": string;
    /** Locked */
    "layers.locked": string;
    /** Hide Layer */
    "layers.hide": string;
    /** Show Layer */
    "layers.show": string;

    // Right panel
    /** Search */
    "rightPanel.search": string;
    /** Comments */
    "rightPanel.comments": string;
    /** Resize panel */
    "rightPanel.resizeHandle": string;
    /** Close Panel */
    "rightPanel.close": string;

    // Search panel
    /** Search in document */
    "search.placeholder": string;
    /** Search text */
    "search.label": string;
    /** Clear Search */
    "search.clear": string;
    /** Match Case */
    "search.matchCase": string;
    /** Fuzzy Match */
    "search.fuzzyMatch": string;
    /** Previous Match */
    "search.previousMatch": string;
    /** Previous Match (Shift+Enter) */
    "search.previousMatchTooltip": string;
    /** Next Match */
    "search.nextMatch": string;
    /** Next Match (Enter) */
    "search.nextMatchTooltip": string;
    /** Search results */
    "search.results": string;
    /** {current} of {total} */
    "search.status": string;
    /** {current} of {total}+ */
    "search.statusRunning": string;
    /** Searching… */
    "search.searching": string;
    /** No results */
    "search.noResults": string;
    /** Page {page} */
    "search.page": string;
    /** Slide {page} */
    "search.slide": string;

    // Comments panel
    /** Page {page} */
    "comments.page": string;
    /** No comments in this document */
    "comments.empty": string;
    /** Loading comments… */
    "comments.loading": string;

    // A comment thread
    /** Comment */
    "comment.label": string;
    /** Add a comment */
    "comment.placeholder": string;
    /** Reply */
    "comment.reply": string;
    /** Edit */
    "comment.edit": string;
    /** Cancel Editing */
    "comment.cancelEditing": string;
    /** Save Comment */
    "comment.save": string;
    /** Reply */
    "comment.replyField": string;
    /** Cancel Reply */
    "comment.cancelReply": string;
    /** Save Reply */
    "comment.saveReply": string;
    "comment.replies.zero"?: string;
    /** {count} reply */
    "comment.replies.one"?: string;
    "comment.replies.two"?: string;
    "comment.replies.few"?: string;
    "comment.replies.many"?: string;
    /** {count} replies */
    "comment.replies.other": string;
    /** Locked: can't be deleted or moved */
    "comment.locked": string;
    /** Locked: text can't be edited */
    "comment.lockedContents": string;
    /** Locked: can't be deleted, moved or edited */
    "comment.lockedBoth": string;

    // An annotation's kind, as a comment names it
    /** Note */
    "annotationKind.note": string;
    /** Text Box */
    "annotationKind.textBox": string;
    /** Line */
    "annotationKind.line": string;
    /** Rectangle */
    "annotationKind.rectangle": string;
    /** Ellipse */
    "annotationKind.ellipse": string;
    /** Polygon */
    "annotationKind.polygon": string;
    /** Polyline */
    "annotationKind.polyline": string;
    /** Highlight */
    "annotationKind.highlight": string;
    /** Underline */
    "annotationKind.underline": string;
    /** Squiggly */
    "annotationKind.squiggly": string;
    /** Strikethrough */
    "annotationKind.strikethrough": string;
    /** Stamp */
    "annotationKind.stamp": string;
    /** Pen */
    "annotationKind.pen": string;
    /** Attachment */
    "annotationKind.attachment": string;
    /** Caret */
    "annotationKind.caret": string;
    /** Sound */
    "annotationKind.sound": string;
    /** Redaction */
    "annotationKind.redaction": string;

    // Annotation bar
    /** Annotation */
    "annotationBar.label": string;

    // Print dialog
    /** Print */
    "print.title": string;
    /** Print */
    "print.print": string;
    /** Pages */
    "print.pages": string;
    /** Slides */
    "print.slides": string;
    /** All Pages */
    "print.allPages": string;
    /** All Slides */
    "print.allSlides": string;
    /** Current Page ({page}) */
    "print.currentPage": string;
    /** Current Slide ({page}) */
    "print.currentSlide": string;
    /** to */
    "print.to": string;
    /** First page */
    "print.firstPage": string;
    /** First slide */
    "print.firstSlide": string;
    /** Last page */
    "print.lastPage": string;
    /** Last slide */
    "print.lastSlide": string;
    /** Custom */
    "print.custom": string;
    /** e.g. 1,3,5-8 */
    "print.customPlaceholder": string;
    /** Custom pages */
    "print.customPages": string;
    /** Custom slides */
    "print.customSlides": string;
    /** Quality */
    "print.quality": string;
    /** Draft (150 DPI) */
    "print.qualityDraft": string;
    /** Standard (300 DPI) */
    "print.qualityStandard": string;
    /** High (600 DPI) */
    "print.qualityHigh": string;
    /** Enter pages from 1 to {count}. */
    "print.pagesFromToInvalid": string;
    /** Enter slides from 1 to {count}. */
    "print.slidesFromToInvalid": string;
    /** The first page can't come after the last. */
    "print.pagesFromAfterTo": string;
    /** The first slide can't come after the last. */
    "print.slidesFromAfterTo": string;
    /** Enter pages and ranges from 1 to {count}, like 1,3,5-8. */
    "print.pagesCustomInvalid": string;
    /** Enter slides and ranges from 1 to {count}, like 1,3,5-8. */
    "print.slidesCustomInvalid": string;

    // Password dialog
    /** Password Required */
    "password.title": string;
    /** This document is protected. Please enter the password to open it. */
    "password.message": string;
    /** Enter password */
    "password.placeholder": string;
    /** Password */
    "password.label": string;
    /** Show Password */
    "password.show": string;
    /** Hide Password */
    "password.hide": string;
    /** Unlock */
    "password.unlock": string;
    /** Incorrect password */
    "password.incorrect": string;

    // Busy hold
    /** Preparing to print… */
    "busy.preparingPrint": string;
    /** Preparing page {page} of {count}… */
    "busy.preparingPage": string;
    /** Preparing slide {page} of {count}… */
    "busy.preparingSlide": string;

    // Loading overlay
    /** Opening… */
    "loading.opening": string;
    /** Downloading… */
    "loading.downloading": string;
    /** {loaded} / {total} MB */
    "loading.progress": string;

    // License notice
    /** Invalid License */
    "license.invalidLicense": string;
    /** Free Usage Unavailable */
    "license.permitRefused": string;
    /** Cannot Verify Free Usage */
    "license.cannotVerify": string;
    /** Please contact the site owner. */
    "license.contactOwner": string;

    // The docMentis decal's link
    /** Powered by docMentis */
    "branding.title": string;
    /** Powered by docMentis — opens docmentis.com */
    "branding.label": string;

    // The text input that takes typing
    /** Document text */
    "textInput.label": string;

    // Context menu
    /** Document actions */
    "contextMenu.label": string;
    /** Copy */
    "contextMenu.copy": string;
}
