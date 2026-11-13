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
    /** OK */
    "common.ok": string;

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
    /** Speaker notes */
    "shell.regionNotes": string;

    // Toolbar
    /** Document toolbar */
    "toolbar.label": string;
    /** Show Side Panel */
    "toolbar.showSidePanel": string;
    /** Hide Side Panel */
    "toolbar.hideSidePanel": string;
    /** Menu */
    "toolbar.menu": string;
    /** Search */
    "toolbar.search": string;
    /** Comments */
    "toolbar.comments": string;
    /** Revisions */
    "toolbar.revisions": string;
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
    /** Show Collaborators' Pointers */
    "collaboration.showPeerPointers": string;
    /** Show My Pointer */
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
    /** Present — the tab that plays a deck or a PDF over the screen */
    "ribbon.slideShow": string;
    /** View */
    "ribbon.review": string;
    "ribbon.view": string;

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
    /** Normal */
    "command.normalView": string;
    /** Notes Page */
    "command.notesPageView": string;
    /** Slide Master — a deck's view of its slide masters and their slide layouts */
    "command.slideMasterView": string;
    /** Pages */
    "command.pagesView": string;
    /** Pageless */
    "command.pagelessView": string;
    /** Page Layout — a workbook's view of a sheet as the paper it prints on */
    "command.pageLayoutView": string;
    /** Notes */
    "command.notes": string;
    /** From Beginning — a deck's slide show, from the first slide it shows */
    "command.slideShowFromBeginning": string;
    /** From Current Slide — a deck's slide show, from the slide shown */
    "command.slideShowFromCurrent": string;
    /** From Current Page — a PDF's presentation, from the page shown */
    "command.slideShowFromCurrentPage": string;
    /** Presenter View — a deck's slide show, from the first slide it shows,
     *  with the presenter view in a window of its own */
    "command.presenterView": string;
    /** Set Up Presentation — how a deck's or a PDF's presentation plays: with
     *  the presenter view or not, full screen or over the UI, and on which
     *  screen */
    "command.setUpSlideShow": string;
    /** Preview */
    "command.previewSlide": string;
    /** Stop — Preview, while a slide preview plays */
    "command.stopSlidePreview": string;
    /** Single */
    "command.singleScroll": string;
    /** Continuous */
    "command.continuousScroll": string;
    /** Page Layout */
    "command.pageLayout": string;
    /** One Page */
    "pageLayout.onePage": string;
    /** Two Pages */
    "pageLayout.twoPages": string;
    /** Cover on the Right */
    "pageLayout.coverRight": string;
    /** Cover on the Left */
    "pageLayout.coverLeft": string;
    "command.trackChanges": string;
    "command.revisionView": string;
    "revisionView.allMarkup": string;
    "revisionView.simpleMarkup": string;
    "revisionView.noMarkup": string;
    "revisionView.original": string;
    "command.markupOptions": string;
    "markupOptions.insertionsAndDeletions": string;
    "markupOptions.formatting": string;
    /** Previous */
    "command.previousRevisionGroup": string;
    /** Next */
    "command.nextRevisionGroup": string;
    /** Rotate View Left */
    "command.rotateViewLeft": string;
    /** Rotate View Right */
    "command.rotateViewRight": string;
    /** Gapless */
    "command.gapless": string;
    /** Formatting Marks */
    "command.formattingMarks": string;
    "command.hideCommentMarkup": string;
    /** Formula Bar */
    "command.formulaBar": string;

    // Formula bar
    /** Formula bar */
    "formulaBar.label": string;
    /** Name Box */
    "formulaBar.nameBox": string;
    /** Cancel */
    "formulaBar.cancel": string;
    /** Enter */
    "formulaBar.enter": string;
    /** Contents */
    "formulaBar.input": string;
    /** Resize formula bar */
    "formulaBar.resize": string;

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
    /** More Colors… */
    "paint.moreColors": string;
    /** Custom Color */
    "paint.customColor": string;
    /** Saturation and brightness */
    "paint.saturationBrightness": string;
    /** Saturation {saturation}%, brightness {brightness}% */
    "paint.saturationBrightnessValue": string;
    /** Hue */
    "paint.hue": string;
    /** Hex */
    "paint.hex": string;
    /** Eyedropper */
    "paint.eyedropper": string;
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
    /** New sheet */
    "sheet.new": string;
    /** Insert Sheet */
    "sheet.insert": string;
    /** Delete */
    "sheet.delete": string;
    /** Rename */
    "sheet.rename": string;
    /** Sheet name */
    "sheet.nameInput": string;
    /** Tab Color */
    "sheet.tabColor": string;
    /** No Color */
    "sheet.noColor": string;
    /** Hide */
    "sheet.hide": string;
    /** Unhide */
    "sheet.unhide": string;
    /** {name} — a hidden sheet, in the Unhide menu */
    "sheet.hiddenName": string;

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

    // Notes pane
    /** Resize notes */
    "notes.resizeHandle": string;

    // Presentation
    /** End of presentation, click to exit. — over the black past a
     *  presentation's last slide or page */
    "slideShow.end": string;
    /** Presentation — what the screen a presentation fills shows, and the
     *  title of a window of its own it plays in */
    "slideShow.window": string;

    // Presenter view
    /** Presenter View */
    "presenter.label": string;
    /** Slide {slide} of {count} */
    "presenter.slideOf": string;
    /** Page {page} of {count} — a PDF's */
    "presenter.pageOf": string;
    /** Previous — the step or slide before */
    "presenter.previous": string;
    /** Next — the next step or slide */
    "presenter.next": string;
    /** End Show */
    "presenter.endShow": string;
    /** Next Slide — over the picture of the slide the show goes to next */
    "presenter.nextSlide": string;
    /** Next Page — a PDF's, over the picture of the page the show goes to next */
    "presenter.nextPage": string;
    /** End of presentation — where the next slide or page would be, after the last */
    "presenter.endOfShow": string;
    /** Pause Timer */
    "presenter.pauseTimer": string;
    /** Resume Timer */
    "presenter.resumeTimer": string;
    /** Restart Timer */
    "presenter.restartTimer": string;
    /** Swap Screens — the show onto the presenter view's screen, and the
     *  presenter view onto the show's */
    "presenter.swap": string;
    /** Make the Text Larger — the notes' */
    "presenter.largerText": string;
    /** Make the Text Smaller — the notes' */
    "presenter.smallerText": string;

    // Set Up Presentation
    /** Screens — the dialog's screens, which one is picked from */
    "screens.label": string;
    /** Only one screen is connected. */
    "screens.oneScreen": string;
    /** Show in — what a presentation covers: the screen, the browser window,
     *  or the viewer's or the editor's own box */
    "slideShowSetup.showIn": string;
    /** Browser Window — Show in's choice of a presentation covering the
     *  browser window the page shows in */
    "slideShowSetup.browserWindow": string;
    /** In Place — Show in's choice of a presentation covering the viewer or
     *  the editor, over its own box on the page */
    "slideShowSetup.inPlace": string;
    /** Display on — the screen a presentation that fills the screen fills */
    "slideShowSetup.displayOn": string;
    /** Set Up Screens — let the UI place windows on each of the computer's
     *  screens, so a presentation fills the one chosen at a press */
    "slideShowSetup.setUpScreens": string;
    /** Let the browser place windows on your screens to choose the one the presentation fills. */
    "slideShowSetup.screensMessage": string;
    /** The browser didn't allow it. Allow window management in the site's settings, then try again. */
    "slideShowSetup.screensRefused": string;

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
    /** Slide master thumbnails — the strip in a deck's Slide Master view */
    "thumbnails.slideMasters": string;
    /** Slide Master {number} — a slide master's thumbnail, numbered in the deck's order */
    "thumbnails.slideMaster": string;
    /** {name} Layout — a slide layout's thumbnail, by its name ("Title Slide") */
    "thumbnails.slideLayout": string;
    /** Layout — a slide layout's thumbnail, where it has no name */
    "thumbnails.untitledSlideLayout": string;
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
    /** Section {name} */
    "thumbnails.section": string;
    /** Collapse Section */
    "thumbnails.collapseSection": string;
    /** Expand Section */
    "thumbnails.expandSection": string;
    /** Section name */
    "thumbnails.sectionName": string;
    /** Add Section */
    "thumbnails.addSection": string;
    /** Untitled Section */
    "thumbnails.untitledSection": string;
    /** Rename Section */
    "thumbnails.renameSection": string;
    /** Move Section Up */
    "thumbnails.moveSectionUp": string;
    /** Move Section Down */
    "thumbnails.moveSectionDown": string;
    /** Collapse All */
    "thumbnails.collapseAll": string;
    /** Expand All */
    "thumbnails.expandAll": string;
    /** Remove Section */
    "thumbnails.removeSection": string;
    /** Remove Section & Slides */
    "thumbnails.removeSectionAndSlides": string;
    /** Remove All Sections */
    "thumbnails.removeAllSections": string;

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
    /** Revisions */
    "rightPanel.revisions": string;
    /** Resize panel */
    "rightPanel.resizeHandle": string;
    /** Close Panel */
    "rightPanel.close": string;

    // Revisions panel
    /** Changes: {count} */
    "revisions.count": string;
    /** No tracked changes */
    "revisions.none": string;
    /** Inserted */
    "revisions.insertion": string;
    /** Deleted */
    "revisions.deletion": string;
    /** Moved */
    "revisions.move": string;
    /** Formatted */
    "revisions.formatting": string;
    /** Formatted paragraph */
    "revisions.paragraphFormatting": string;
    /** Inserted row */
    "revisions.rowInsertion": string;
    /** Deleted row */
    "revisions.rowDeletion": string;
    /** Inserted cell */
    "revisions.cellInsertion": string;
    /** Deleted cell */
    "revisions.cellDeletion": string;
    /** Merged cells */
    "revisions.cellMerge": string;
    /** Formatted table */
    "revisions.tableFormatting": string;

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
    /** Use Regular Expression */
    "search.regex": string;
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
    /** Invalid regular expression */
    "search.invalidPattern": string;
    /** Page {page} */
    "search.page": string;
    /** Slide {page} */
    "search.slide": string;

    // Comments panel
    /** Page {page} */
    "comments.page": string;
    /** Slide {slide} */
    "comments.slide": string;
    /** {sheet}!{cell} — a sheet's cell, as Excel names it */
    "comments.cell": string;
    /** New comment — opens a field for a new comment thread */
    "comments.new": string;
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
    /** Resolved — an Office comment's status */
    "comment.resolved": string;
    /** Closed — an Office comment's status */
    "comment.closed": string;
    /** Resolve — mark a comment thread resolved */
    "comment.resolve": string;
    /** Reopen — mark a resolved comment thread active again */
    "comment.reopen": string;

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

    // Delimiter dialog
    /** Choose a Delimiter */
    "delimiter.title": string;
    /** Choose the character that separates the fields in this file. */
    "delimiter.message": string;
    /** The file's first lines */
    "delimiter.preview": string;
    /** Comma */
    "delimiter.comma": string;
    /** Semicolon */
    "delimiter.semicolon": string;
    /** Tab */
    "delimiter.tab": string;
    /** Vertical bar */
    "delimiter.pipe": string;
    /** Other */
    "delimiter.other": string;
    /** Other delimiter */
    "delimiter.otherLabel": string;
    /** Enter one ASCII character other than a double quote. */
    "delimiter.otherInvalid": string;
    /** Open */
    "delimiter.open": string;

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

    // Media
    /** Open on {site} — a YouTube or Vimeo video that won't play here, on its own site */
    "media.openOnSite": string;

    // Web page
    /** Open in new tab — the page a web page document frames, in a tab of its own */
    "webpage.openInNewTab": string;

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
