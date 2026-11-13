# Changelog

The published packages release together, at one version: each release is
listed once, by package. Its major and minor version are those of the
`@docmentis/udoc-wasm` it is built on, and its patch is its own.

## [Unreleased]

### All packages

#### Fixed

- Text a PDF both fills and outlines, as Word's PDFs draw bold, is outlined
  at the width the PDF sets, where small text came out heavy, its letters
  filled in.
- A picture turned on its side in a line of a Word document takes the room
  of its turned shape in the line, as Word lays it out.

### udoc-viewer and udoc-editor

#### Added

- `--udoc-formula-bar-background` sets the fill of a spreadsheet's formula
  bar, which `--udoc-status-bar-background` set before.
- `saveToBytes`, `requestRemoteCopy`, `saveToPackage` and `download` take
  their options as an object: `SaveOptions`, `SavePackageOptions` and
  `DownloadOptions`. `saveToBytes` and `requestRemoteCopy` take the same
  `SaveOptions`, so the server saves a copy as any format `saveToBytes`
  saves to. Without a `format`, both save as the document's source format.
  `SaveOptions.delimiter` sets the character a CSV's fields are split by
  when it is saved. The earlier forms still work and are deprecated:
  `saveToBytes(format, strategy)`, `requestRemoteCopy(strategy)`,
  `saveToPackage(version)` and `download(filename)`.
- A slide show can cover the browser window. Set Up Presentation's Show in
  chooses Fullscreen, Browser Window or In Place, in place of its Fullscreen
  switch: Browser Window covers the browser window, over everything on the
  page, or the iframe the page is in; In Place covers the viewer or the
  editor, as a show with Fullscreen off did. `startSlideShow` takes its
  options as an object, `SlideShowOptions`: `slide`, the slide it starts
  from; `fill`, `"screen"`, `"window"` or `"container"`; and `presenterView`,
  which opens the presenter view. `fill` and `presenterView` left out play as
  Set Up Presentation has it. The earlier `startSlideShow(slide)` still works
  and is deprecated. The `translations` keys `slideShowSetup.showIn`,
  `slideShowSetup.browserWindow` and `slideShowSetup.inPlace` are new.
- `SlideShowOptions.noExit` keeps the user from ending a slide show from its
  own screen: Escape, and a click or a key past the last slide, do nothing.
  A show that filled the screen covers the browser window once the user
  leaves the full screen. The presenter view and `endSlideShow()` still end
  it.
- A Word document's Review tab steps through its tracked changes: Next and
  Previous select the change after the selection or before it, round past
  either end, and bring it into view. In Simple Markup they pass by a
  deletion it hides; from No Markup or Original they turn to All Markup
  first, as Word's do.
- A Word document's tracked changes are listed in the right panel's
  Revisions tab, opened by Revisions on the Review tab or in the toolbar's
  menu: a card per change under the page it is on, as the Comments tab's,
  with its kind, author, date and text, those the selection touches marked
  and joined by a line to the start of its text. Choosing a
  card selects its change, and choosing the selected card again clears the
  selection. `showRevisionsPanel: false` hides the tab, and
  `showRevisionTether: false` the line. The
  `translations` keys `rightPanel.revisions`, `toolbar.revisions`, those
  under `revisions.`, `command.previousRevisionGroup` and
  `command.nextRevisionGroup` are new.
- In udoc-editor, the Review tab's Accept and Reject are split buttons.
  Pressed, each settles the change the selection touches and selects the
  next, as Word's Accept and Move to Next does; its menu settles that change
  alone, every change the view shows, or every change. Each settle is one
  undo step, and each card of the Revisions tab offers both on its change.
- udoc-editor has a review mode, beside view and edit mode, which records
  each edit to a Word document as a tracked change under the name
  `setUserInfo` gives, or "Author" without one. An edit that can't be
  recorded, such as moving a picture or merging cells, isn't offered. Review
  mode opens on the Review tab. Only a
  Word document opens in review mode: another opens in edit mode where
  `allowedModes` has it, else in view mode. `EditorMode` takes `"review"`,
  and the `translations` key `mode.review` is new.
- The text caret moves by word, by paragraph, and to the start or end of the
  text it is in: on a Mac, Option with an arrow steps by word or paragraph,
  and Cmd with an arrow goes to the line's or the text's start or end;
  elsewhere, Ctrl with an arrow steps by word or paragraph, and Ctrl with
  Home or End goes to the text's start or end. Shift extends the selection,
  and every move follows the text's order, right to left included.
- In udoc-editor, the arrow keys reach all of a Word document's text, as
  Word's do: they go on into a table, from each cell to the next and out the
  other side, and from one section into the next. A selection Shift extends
  stays in its section.

#### Changed

- The toolbar's More menu draws a divider between the panels it opens,
  Search and Comments, and its other actions.

- A spreadsheet's formula bar draws its Name Box and contents as the other
  fields are drawn: outlined, with no fill of their own. The contents field's
  border darkens under the pointer, takes your primary color on focus, and
  the error color while a refused entry is shown. The page and zoom fields
  take your primary color on focus too, where they darkened.

- A Word, Excel or PowerPoint document's comments are written as a PDF's are,
  wherever the user may annotate: in the viewer, and in the editor's view mode
  as in its edit mode, the Comments panel replies to, edits, resolves, reopens
  and deletes them, and its New Comment opens a thread. A Word document's
  Review tab has New Comment in view mode too, and undo and redo show
  wherever comments may be written. `enableAnnotation: false` leaves them to
  be read, as it does a PDF's, and takes New Comment away.

- A PowerPoint document in view mode selects as edit mode does: a press on a
  shape's text places the caret or selects text within that shape, a press
  on another shape picks it, and a drag from the bare slide picks the shapes
  it sweeps. Nothing picked moves or resizes. Text is no longer selected from
  one shape into the next. New Comment opens a thread on the selected text or
  shape, as in edit mode.

- New Comment opens a thread on text selected in a Word document in view
  mode, including text that runs from one section into the next. A comment on
  text that spans sections, made here or in Word, is highlighted through each
  section.

- udoc-editor's mode switch shows the current mode's icon, named in its
  tooltip, where it showed the mode's name, so the tabs beside it stay put
  as the mode changes. Its menu says what each mode is for under its name.
  The `translations` keys `modeSwitch.current`, `mode.viewDescription`,
  `mode.editDescription` and `mode.reviewDescription` are new.

- On a Word document's Review tab, Show Markup is now Markup Options, an
  icon, and New Comment is named beside its icon.

- The line from the current search match to its result in the Search tab
  starts at the top-left corner of the match, as a tracked change's line
  does. The search, comment and tracked change lines show as long as any of
  what they start from is in view, starting at the view's edge where it is
  cut off, as at the top of the view.

- A Word document with tracked changes opens in Simple Markup, the final
  version with a bar beside each change, where it opened in All Markup,
  unless it was saved with markup off.

- A slide show the browser won't fill the screen with covers the browser
  window, where it covered the viewer or the editor: one started without a
  user gesture, in an iframe that doesn't allow full screen, or with the
  presenter view where the screens aren't set up. A show filling the screen
  covers the browser window in black as the screen fills.

#### Fixed

- After New Comment, the Comments panel opened on its field for a new
  comment each time it was opened again, whether that comment was saved,
  cancelled or left open as the panel closed. It now opens on New Comment
  again.
- The view follows the text caret: an arrow key, Home or End that moves it out
  of view, or typing or deleting that carries it there, scrolls the view just
  far enough to show it, where the caret could leave the view behind. A
  selection Shift extends is followed at the end it grows from.
- Up and Down reach the line above or below across a page or column break
  and past tall spacing or a picture, and hold their place across a run of
  shorter lines, where the caret could stay put or land at the start of the
  section. Left and Right no longer stop inside an emoji, between a letter
  and its accent, or between the halves of a flag. At a line that wraps
  inside a word, End and a click past its text leave the caret at that
  line's end, where it showed at the start of the next.
- In udoc-editor, Delete removes a picture selected in a Word document's
  text, where it did nothing, and a picture turned there is saved with the
  room Word gives a turned picture.

### udoc-server

#### Added

- A kept document has branches, and each branch versions. Importing makes
  `main` and its first version; `POST /documents/:id/versions/:version/branches`
  starts a branch at any version, of any branch; and
  `POST /documents/:id/branches/:branch/merge?from=` merges one branch into
  another: each edit the target lacks reaches it, its editors and its log,
  beside its own edits, whether either's log was cut meanwhile or not. A
  comment made in a branch lands on what it was made on, wherever that has
  moved. A merge that moved the source's edits onto the target's log isn't
  repeated.
- `/documents/:id/branches/:branch/…` serves a branch as `/documents/:id/…`
  serves `main`: its package, collaboration, copies, pages and checkpoints.
  `GET /documents/:id/branches` lists a document's branches, and `DELETE` on
  one forgets it. `GET /documents/:id/versions` lists every branch's versions,
  numbered across the document, and `/documents/:id/versions/:version/…`
  serves one as `/documents/:id/checkpoints/:version/…` does.

#### Changed

- `DocumentStore` keeps branches and versions. Its reads take a branch or a
  version (`At`); it keeps versions (`getVersions`, `putVersion`,
  `getVersionLog`), branches (`getBranches`, `putBranch`, `deleteBranch`) and
  merges (`getMerge`, `putMerge`), in place of `getCheckpoint`,
  `putCheckpoint`, `getCheckpointVersions`, `getCheckpointLog` and `getCuts`.
  Each branch keeps its own edit log; an opaque part is kept for the document,
  every branch's.

### udoc-node

#### Added

- `UDocNode.open` and `openRemote`, and `UDocSession.saveToBytes`,
  `requestRemoteCopy` and `saveToPackage`, take their options as an object:
  `OpenOptions`, `OpenRemoteOptions`, `SaveOptions` and `SavePackageOptions`.
  `saveToBytes` and `requestRemoteCopy` take the same `SaveOptions`, so the
  server saves a copy as any format `saveToBytes` saves to. Without a
  `format`, both save as the document's source format.
  The earlier forms still work and are deprecated:
  `open(bytes, format, delimiter)`,
  `openRemote(url, fetch, { withOriginal })`,
  `saveToBytes(format, strategy, delimiter)`, `requestRemoteCopy(strategy)`
  and `saveToPackage(version)`.

## [0.8.20] - 2026-11-11

Built on `@docmentis/udoc-wasm` 0.8.23.

### All packages

#### Added

- Right-to-left text, such as Arabic and Hebrew, is laid out right to left in
  Word, PowerPoint and Excel documents, as Office lays it out: mixed with
  left-to-right text in the order the Unicode Bidirectional Algorithm gives,
  its numerals, list numbers and punctuation where Office stands them, its
  paragraphs aligned as each application reads a stated left or right, and a
  right-to-left table's columns running from the right. Selection, Home and
  End, justification, underlines and highlights follow it.

#### Fixed

- Saving keeps a document's comments: an edited Word document no longer loses
  the text each comment is on, and a `"rewrite"` save of a Word, Excel or
  PowerPoint document writes its comments, as Office 365 writes them, where it
  wrote none. A sheet's notes, where the save writes its comments, become
  threaded comments, as Excel's Convert to Comments makes them.
- A saved Word, Excel or PowerPoint document keeps the data newer versions of
  Office add to its slides, sheets, charts, diagrams, shapes, tables, text and
  themes, though it isn't shown, where a save dropped some of it and a
  `"rewrite"` save all of it.
- A Word paragraph with an exact line height of zero is spaced as single lines,
  as Word draws it, where its lines collapsed, and table rows with them.
- A Word table's columns take the widths its cells ask for, as Word sizes them,
  where they took the widths of the table's grid.
- A Word run, paragraph or table cell shaded with a fill but no pattern paints
  its fill, where it painted nothing.
- A Word run sets its text in its complex-script font, size, bold and italic
  where Word does, when it's marked right-to-left or complex script, and never
  takes them from its other formatting: a right-to-left title marked bold only
  for Latin text draws regular, as in Word, where it drew bold.
- A picture wider than its line just after a bookmark in a Word document stays
  on that line, where it left an empty line before it and, taller than the
  page, an empty page.
- Accents and other marks a font raises or lowers are drawn where it places
  them, where they were mirrored about the baseline: an Arabic letter's dots
  and hamza drew on the wrong side of it.
- Arabic text in Sakkal Majalla or Simplified Arabic draws in a Naskh face, as
  those fonts are, where it drew in a sans, and in Univers Next Arabic in a
  sans. Latin text and empty paragraphs in these or Office's other Arabic fonts
  are spaced as Word spaces them, where they took the Arabic stand-in's far
  taller lines. Franklin Gothic Book takes Franklin Gothic Medium's stand-in.

### udoc-viewer and udoc-editor

#### Added

- A `visiblePages:changed` event lists the pages on screen each time they
  change, for tracking which pages a reader sees when continuous scrolling shows
  several at once. It fires only when the pages change, not for each scroll, and
  leaves out a page side by side with them that's scrolled off. `visiblePages`
  lists them at any time with how much of each shows, for counting a page as
  read only once enough of it has been on screen.
- A PDF that asks to be opened with its thumbnails or its layers showing opens
  with that panel, as one that asks for its outline does; Layers opens only when
  the PDF has some. A host's `activePanel`, given, `null` included, holds over
  what any document asks for.
- Search finds text by regular expression, with the Search panel's `.*` toggle
  or `regex: true` in `search`'s options. Fuzzy matching doesn't apply to a
  regular expression, so the panel turns one off as the other comes on. A
  pattern that isn't a regular expression shows as invalid in the panel, and
  `search` rejects with an `invalidRequest` `UDocError`.
- The Comments panel lists a Word, Excel or PowerPoint document's comments, as
  it does a PDF's, Excel's notes among them: each thread with its replies, their
  authors and times, and whether it's resolved, under its page, its sheet and
  cell, or its slide. On the document, a marker stands at each thread: beside
  its text, which is highlighted, at the corner of the shape or slide it's on,
  or as a flag in its cell's corner. Choosing a marker or a thread opens it,
  and choosing it again closes it.
- The View tab's Hide Comment Markup hides a Word, Excel or PowerPoint
  document's comment markers and highlights, and `showCommentMarkup: false`
  opens documents with them hidden.
- A line joins the current search match on the document to its result in the
  Search panel, in the selection's colour, and follows both as the document and
  the results scroll. It hides while either end is out of sight, and on a
  narrow screen, where the panel slides over the document.
  `showSearchTether: false` leaves it out.
- A line, alike, joins the open comment on the document to its card in the
  Comments panel: a Word, Excel or PowerPoint thread's marker, or a PDF's
  annotation, when one is selected. `showCommentTether: false` leaves it out.
  Choosing the current result, or the selected card, again hides its line, and
  once more shows it.

#### Changed

- The View tab's Gap is Gapless, turned the other way: on, it butts the pages
  together, and it starts off, so the gaps show as before. It shows a crossed-out
  grid with no text beside it, its name in its tooltip. Its `translations` key is
  `command.gapless`, where it was `command.pageGap`.
- A comment chosen in the Comments panel comes into view by the least scroll
  that shows it, none where it already shows, as a search result does, where it
  landed where `navigationScrollAlignment` put it, at the top-left by default.
  That option now sets where a followed link or outline item lands alone.
- An `Annotation`'s `modified` and `created` are ISO 8601 date-time strings, in
  what the annotation calls take and their events give, where they were PDF
  date strings.

#### Fixed

- A panel the host hid, or whose side it hid, no longer opens out of sight. With
  `showLeftPanel: false`, a PDF that asks for its outline set `activePanel` to
  `"outline"` and fired `panel:changed`; with `showRightPanel: false`, Ctrl+F
  (Cmd+F on macOS) did the same for Search.
- The View tab's Layers shows only when the Layers panel can open, and not with
  `showLeftPanel: false` or `showLayersPanel: false`, where pressing it showed
  nothing.
- On macOS, the input-source indicator no longer shows up on the document with
  each click. With nothing to type into, such as a selected shape or text
  selected for copying, it doesn't show at all.

### udoc-editor

#### Added

- In edit mode, the Comments panel replies to, edits, resolves, reopens and
  deletes a Word, Excel or PowerPoint document's comments, and its New Comment
  opens a thread: on the text selected in a Word document's body or a table
  cell; on the text selected in a slide's shape, on the shape, or, with nothing
  selected, on the slide; or at a sheet's active cell. New Comment also ends
  the Slide tab and the Cell tab, and joins a Word document's Review tab, and
  greys where the selection takes no comment. Deleting a thread's first comment
  deletes the thread.

#### Changed

- The icons that draw a table are Pictogrammers' Material Design Icons: the Table
  tab's own, Insert Table, Table Style and Table Properties, and those for
  inserting and deleting rows and columns, deleting the table, and merging and
  splitting cells, on the ribbon and in the menus, a workbook's included.
  Select's Row, Column and Table rows show an icon each, and Delete Table shows
  a table where it showed a trash can.
- Group, Ungroup, Bring to Front, Bring Forward, Send Backward and Send to Back
  show Pictogrammers' Material Design Icons, which draw the shapes they stack,
  where they showed arrows and outlines. The Order button shows Bring Forward's.
- The Image button that inserts a picture shows Pictogrammers' Material Design
  Icons' picture with a plus, as the Table button that inserts a table shows
  its table with one.
- Change Shape shows a circle and a square joined by a line, where it showed
  three shapes side by side.

#### Fixed

- Backspace while an input method is composing text edits only the text being
  composed, where it also deleted what was selected and the caret was lost.

## [0.8.19] - 2026-11-09

Built on `@docmentis/udoc-wasm` 0.8.22.

### All packages

#### Fixed

- A workbook's conditional formatting computes Excel's text, lookup and
  reference, array, date and time, financial, engineering, database and
  information functions in its rules' formulas, so a rule calling one such as
  `XLOOKUP`, `TEXT` or `NETWORKDAYS` formats the cells it picks, where it
  formatted none. Text such as `3/15/2026` or `9:30 AM` reads in them as the
  date or time Excel reads it.

### udoc-editor

#### Added

- A workbook's rows and columns can be inserted and deleted from the context
  menu on its grid and its headers, as a table's: Insert ▸ Row Above, Row
  Below, Column Left and Column Right, as many as the selection spans, and
  Delete ▸ Rows and Columns. Its Select ▸ Row, Column and Sheet widen the
  selection to whole rows, whole columns or the whole sheet. New rows and
  columns take the format of the ones above or to the left, and the sheet
  keeps its size. Formulas, merges, conditional formatting, tables, pictures
  and charts follow their cells, a range losing its first or last row
  shrinking as Excel shrinks it, and a save moves the hyperlinks, validations,
  filter, notes and other content the file places by row and column. Editors
  inserting and deleting at once in a shared session end up with the same
  sheet. What Excel refuses is refused, its reason shown under the formula
  bar, and so for now is a sheet holding a PivotTable, a slicer, a form
  control, scenarios or a custom view.
- A workbook has a Cell tab, which its edit mode opens on, to format the
  selected cells, whole rows and columns or the whole sheet as Excel's Home
  tab does: their font, size, bold, italic, underline, strikethrough and
  color; their fill and borders; their alignment and Wrap Text; their number
  format, with more or fewer decimals; Merge & Center, Merge Across, Merge
  Cells and Unmerge Cells; and Clear Formats. A merge keeps its top-left
  cell's contents, as Excel does, and is one undo step. The formats save to
  the workbook's styles, and editors in a shared session see each other's.
- A workbook's formulas recompute the same functions as it is edited —
  `VLOOKUP`, `XLOOKUP`, `INDEX` and `MATCH`, `FILTER`, `SORT` and `UNIQUE`,
  `TEXT`, `IFS` and `SWITCH`, `SUBTOTAL` and `AGGREGATE`, `PMT`, `RAND` and
  the rest — where a formula calling one kept the value saved in the file
  however the cells it reads changed.

#### Changed

- The canvas context menu leaves Delete out where the selection deletes
  nothing, where it showed it greyed.

## [0.8.18] - 2026-11-09

Built on `@docmentis/udoc-wasm` 0.8.21.

### All packages

#### Changed

- The commands that change only the properties they're given are named for it:
  `setCharacterProperties`, `setParagraphProperties` and
  `setShapeTextBodyProperties` are `patchCharacterProperties`,
  `patchParagraphProperties` and `patchShapeTextBodyProperties`, as commands and
  as selection edits, and the section selection edit `setSectionPageMargins` is
  `patchSectionPageMargins`. A `set…` command replaces what it names, as the word
  document command `setSectionPageMargins` does, which keeps its name.

#### Fixed

- A table cell's diagonal borders show, in word documents and decks, where they
  were missing.
- A workbook's conditional formatting computes Excel's math and trigonometry,
  statistical, logical, information, text and date functions in its rules'
  formulas, so a rule calling one such as `MEDIAN`, `STDEV` or `LARGE` formats
  the cells it picks, where it formatted none.

### udoc-viewer and udoc-editor

#### Added

- A word document's formatting marks show an anchor in the margin beside the
  paragraph each floating picture or shape is anchored in, with a padlock on
  one locked there.

#### Changed

- The formula bar shows an array formula in braces on every cell of its range,
  as Excel does, and an edit starts from the formula without them.

### udoc-editor

#### Added

- A floating picture or shape selected in a word document shows its anchor
  beside the paragraph it's anchored in. Dragging the anchor onto another
  paragraph anchors the drawing there without moving it on the page; a locked
  anchor stays where it is.
- The Table tab formats the table the selection is in. Shading fills the selected
  cells. Border draws on the edges chosen — all, outside, inside, one side or a
  diagonal — with the color, weight and dash Border Color sets, or takes the
  borders away. Align sets where the cells' text sits, top to bottom and left to
  right, and the direction it runs. Style turns the table style's header row,
  total row, first and last column and banding on or off. Distribute Columns
  gives the selected columns equal widths that keep their total. Table
  Properties sets the rows' height, the columns' width, the cells' margins and,
  in a word document, whether rows repeat at the top of each page. A table can
  be deleted from the tab or its context menu.
- Insert Table sizes a table on a grid and puts it where it's wanted, with the
  caret in its first cell: centred on a deck's slide, from its Slide or Table
  tab, in PowerPoint's default table style; centred over an image, from its
  Image or Table tab, in docMentis's colors and at the size of the image's text
  boxes; and at the caret in a word document, from its Table tab, as wide as the
  text.
- An image has a Table tab, which edits and formats a table drawn over it as a
  deck's Table tab does a slide's.
- Tab types a tab at the caret. In a table it moves to the next cell instead,
  and Shift+Tab to the one before, selecting the cell's text; Tab in the last
  cell adds a row. Ctrl+Tab, or Option/Alt+Tab where the browser keeps
  Ctrl+Tab, types a tab in a cell.
- With a block of cells selected, or whole rows, columns or the table, the font
  and paragraph controls format all the text of every cell in it, and show
  what the cells' text has in common.
- A workbook recalculates as it's edited, as Excel does: a formula typed into a
  cell shows its result, and each edit, undo or redo recomputes the formulas
  that depend on the cells it changed, on any sheet. Excel's math and
  trigonometry, statistical, logical, information, text and date functions are
  computed as Excel computes them; a formula calling one not computed yet, such
  as a lookup or financial function, keeps the value it has. Every editor in a
  shared session computes the same results, `NOW()` and `TODAY()` included.

#### Changed

- The Table tab holds its inserts, deletes and merges in Insert, Delete and Cells
  dropdowns, leaving the band room for the controls that format the table.
- The Shape tab starts with Text Box and Shapes, on a deck's slides and over an
  image, so a new one can be drawn without leaving the tab; a PDF's Object tab
  starts with its Text Box and Shapes too.
- A formula typed with more or fewer arguments than its function takes is
  refused, as Excel refuses `=ABS(1,2)` and `=SUM()`, and the formula bar says
  so.

#### Fixed

- Resizing a table on a slide resizes its columns and rows, its text keeping its
  size, where the table stayed as it was and its box snapped back.
- A row or column inserted into a table takes the format of the one beside it —
  its height, shading, borders, margins and text formatting — where it took the
  defaults. A row inserted inside a cell merged down joins that cell, which
  grows by a row.
- Deleting whole paragraphs from a word document closes up the space they took,
  where the text below could stay where it was.

## [0.8.17] - 2026-11-07

Built on `@docmentis/udoc-wasm` 0.8.20.

### All packages

#### Fixed

- A word document's VML drawings, Word's older drawing format, show on its pages,
  where they were missing and the text around them didn't wrap: text boxes with
  their text and pictures, shapes, WordArt, a text watermark and horizontal rules,
  with their gradients, dashes and arrowheads. A save keeps them.
- A word document's text boxes follow Word's rules, where they followed a deck's:
  one set to resize to its text fits it on open, text that doesn't fit is cut at the
  box's bottom, and a box's outline insets its text.
- Text set to Automatic color in a word document shows in it, black on a light
  background and white on a dark one, where its style's color showed through, and a
  save keeps it.
- A vertically flipped shape's text is drawn upside down, as Word, PowerPoint and
  Excel draw it, where it stood upright.
- A shape's double, thick-thin or triple line draws as its separate lines, where it
  drew as one solid line of the full width.
- A save keeps a word document's, deck's or workbook's custom XML parts, and a
  deck's tags, where a save that rewrote the file dropped them.

### udoc-editor

#### Fixed

- An SVG, EMF or WMF picture inserted into a deck lands at its own size and shape,
  where it took half the slide in each direction and was stretched to fill it.

## [0.8.16] - 2026-11-06

Built on `@docmentis/udoc-wasm` 0.8.19.

### All packages

#### Changed

- A word document's tracked changes are drawn into its pages, unless it was saved
  with markup off: a render, a PDF export and a print show each insertion and
  deletion in its author's colour, with a change bar beside its line.

#### Fixed

- Text inserted as a tracked change in a word document shows on its page, where it
  was missing, and a save keeps the document's tracked changes, where it lost them.
  A Markdown or HTML save writes the final text.
- Text held in custom XML or a smart tag in a word document shows on its page and
  lasts through an edit and a save, where it was missing and the save lost it.
- A tab on a hanging line lands on the indent, and a tab after a right, centred or
  decimal one looks for its stop from where that text ended, in a word document, a
  deck and a workbook's text box. A form's rows line up, where a value sat at the
  margin and a second leader ran off the page.
- A word document's lines hold to the height of their words, so a form whose tabs
  are in a taller font than its words keeps to Word's length, where it ran long.
- Line spacing under single tightens a word document's lines as Word does, where it
  had no effect and what followed sat too low.
- A picture taller than its line in a word document stops at the line's top, as in
  Word, where it covered the text above.
- A word document's links keep their link style below a table of contents that runs
  on from its section's page, and after an edit above them that opens or closes a
  field, where they showed without it.

### udoc-viewer and udoc-editor

#### Added

- A word document's tracked changes show as Word draws them, with a Review tab to
  choose what shows: All Markup marks each insertion and deletion in its author's
  colour, with a change bar beside its line, Simple Markup keeps only the bar, No
  Markup shows the final text and Original the text before the changes. Show
  Markup turns insertions and deletions, and formatting, on or off. The
  `revisionView` option, `setRevisionView`, the `revisionView` getter and
  `"revisionView:changed"` do the same for a host. A document opens on what it
  was saved to show, which is All Markup unless it was saved with markup off.
- A view chosen on the Review tab stays for the word documents opened after it. The
  `translations` keys are `ribbon.review`, `command.revisionView`,
  `command.showMarkup`, `revisionView.*` and `showMarkup.*`.
- On a word document, Find and Copy follow the Review tab's view: Find matches what
  shows, across what's hidden, and the text Copy takes is what shows.
- A word document has an Outline panel, listing its headings as Word's Navigation
  pane does, with their numbers. Clicking one goes to it, and the list follows the
  document's edits.
- A word document's Formatting Marks also show hidden text, under a dotted rule in
  its colour, a page or column break, as a labelled dotted rule, and the end of a
  section, as a double rule naming how the next one begins. Hidden text stays out of
  an export.

#### Changed

- The ribbon's tabs show as icons, each with its name in a tooltip, which leaves
  the toolbar more room. `"text"`, through the `ribbonTabStyle` option or
  `setRibbonTabStyle`, shows them by name.
- `TextCharacterProperties` and `TextParagraphProperties`, in the commands `execute`
  takes, are objects, `{ props, propertiesChange? }`, in place of arrays, and a
  paragraph's mark is a `TextParagraphMark` holding its properties.

#### Fixed

- Clipping the UI to rounded corners no longer makes Chrome flicker after the
  selection changes, where the caret and the previous selection showed in turn
  for a few seconds, and the ruler's markers moved with them.
- In single-page view, a trackpad swipe turns one page, and its momentum leaves
  the new page where it landed. A swipe during the last one's momentum turns
  another page, in either direction, a light touch or a sideways swipe turns none,
  and a swipe through a page taller than the view stops at the page's end, for the
  next swipe to turn it.
- A color picker's thumbs stay inside their sliders at either end, on the hue and
  opacity strips and the color square, and still reach the full range.

### udoc-editor

#### Added

- A PDF's Page tab has a Text Box: dragged out, or dropped with a click, it puts
  text on the page as the page's own content, in Helvetica, that wraps at the box's
  width. Its placeholder comes selected, so the first key types over it.
- A PDF's Page tab has an Image: it asks for a file and puts it on the current page
  as the page's own content, centred, scaled down to fit and selected, reading
  upright on a turned page, with any transparency the file has. `insertImage` does
  the same on a PDF.
- The Shape tab has Change Shape: it gives the selected shapes and pictures, and
  those in a selected group, another outline from the shape gallery, keeping their
  text, fill and line.
- A deck has Change Layout, on its Slide tab: it puts the current slide, or the
  slides or sections selected in the thumbnails, on the slide layout picked from
  New Slide's thumbnails, with the layout in use marked. Placeholders move to the
  new layout's slots and keep their content.
- A deck has Delete Slide, on its Slide tab: it deletes the current slide, or the
  slides selected in the thumbnails.
- The Fill and Line panels have an Opacity, for a shape's solid fill or line and for
  a PDF path's line. It sets the opacity alone, and picking another color keeps it.
- The Object tab has an Opacity button, for a PDF path's fill, an image, a shading or
  a text object. It offers preset values, a slider and a percentage field for any
  other.
- The custom color picker behind More Colors has an opacity slider and a percentage
  field where its panel has an Opacity, and lists the colors picked lately.
- A deck has a Text Box, on its Slide tab: dragged out, or dropped with a click, it
  puts a text box on the slide that wraps at its width. Its text comes selected, so
  the first key types over it.
- An image has a Text Box, on its Image tab, that does the same over the page, in
  docMentis's indigo.
- Editing a word document under a view that hides tracked text stays off what's
  hidden: the caret steps over it, Backspace and Delete take what shows, and typing
  lands before it. Text typed inside a tracked change comes out as plain text.
- A paste into a word document keeps the tracked changes it copied, where such a
  paste failed.

#### Changed

- A deck's Slide tab replaces its Insert tab. It offers New Slide, Delete Slide and
  Change Layout, then Text Box, Shapes and Image, as icons named by their tooltips.
  A deck's ribbon opens on it in edit mode, and goes back to it when slides or
  sections are picked or nothing is selected.
- An image's Insert tab is gone: its Image tab offers Text Box and Shapes after its
  own tools, as icons named by their tooltips. An image's ribbon opens on it in edit
  mode, and goes back to it when pages are picked or nothing is selected.
- A PDF's Page tab replaces its Insert tab. It offers Insert Page, Delete Page,
  Rotate Left, Rotate Right and Resize Page, on the current page or those picked in
  the thumbnails, then Text Box, Shapes and Image, as icons named by their tooltips.
  Resize Page opens a dialog of the current page's size. A PDF's ribbon opens on it
  in edit mode, and goes back to it when pages are picked or nothing is selected.
- A new shape takes the fill color, line color and opacity last set in the Fill and
  Line panels and the Opacity button, for as long as the editor is open. Until then a
  deck's shape takes its theme, and a PDF's or an image's a pale indigo fill and an
  indigo line at full opacity, in place of a translucent blue fill on a PDF and a red
  outline on an image.
- The Annotate tab's Opacity takes any value, with a slider and a percentage field
  below its presets.
- The Object and Annotate tabs order their paint buttons Line, Fill, Opacity.
- A word document's ribbon opens on its Text tab in edit mode.
- A box you're typing in looks different from a shape you've picked: its outline is
  dashed. A PDF's text box also shows only two side handles, as resizing it rewraps
  its text and changes only its width.
- A collaborator's selection is outlined in dots, so it can't be mistaken for your own
  dashed box.
- The controls beside and between a PDF's pages in edit mode are off by default:
  `showPageControls: true` turns them on. Their rail rotates a page either way, and
  its Page Settings button is now Resize Page.
- The page rail's Move Up and Move Down keep the moved page in view, with the button
  still under the pointer, and its icons are larger, in round buttons on a rounded
  bar.
- The page settings dialog closes on Apply Size, labels its Units and Layout, and
  no longer rotates the page, which the Page tab does.
- The ruler's margin edges, indent markers and tab stops respond to the pointer:
  one that can be dragged tints when the pointer is over it, and more strongly
  while pressed, along with any markers the drag moves with it.
- The ruler measures from the column the caret is in, as Word and PowerPoint do, and
  shows each column as text, with the gutters between them as margin. An indent
  marker dropped over paragraphs whose indents disagree sets that indent on all of
  them.
- A shape being dragged out shows half transparent in the outline and colors it will
  land with, on a deck, on an image and on a PDF's page, in place of a plain
  rectangle or ellipse.
- The `translations` keys `ribbon.insert`, `pageControls.settings`,
  `pageControls.settingsLabel`, `pageSettings.label`, `pageSettings.rotation`,
  `pageSettings.rotateLeft`, `pageSettings.rotateRight`,
  `pageSettings.rotatePageLeft` and `pageSettings.rotatePageRight` are gone.
  `ribbon.page`, `ribbon.slide`, `command.changeLayout`, `command.changeShape`,
  `command.pageResize`, `pageControls.resizeLabel`, `pageControls.rotateLeft`,
  `pageControls.rotateLeftLabel` and `pageSettings.layout` are new.

#### Fixed

- No Fill and No Line work on a PDF's paths, and their swatches show them. A path with
  both turned off paints nothing, so it isn't kept once the PDF is saved and reopened.
- Changing a line's weight or dash no longer changes its color, and picking a color
  no longer changes its weight or dash. The Line panel marks the weight and dash the
  line has.
- Keys pressed in New Slide's layout picker stay in it: Delete or Backspace no longer
  deletes what is selected behind it, and Escape closes only the picker, leaving the
  side panel open. Undo works from the keyboard straight after a pick.
- Indent markers take a press as soon as the caret lands in a paragraph after a
  selection whose indents disagreed, where they refused it until the next repaint
  and the press fell through to the margin's edge.
- Text running past its column, by a negative indent or a line that doesn't wrap,
  repaints whole as it's edited, in a word document and a deck, where it was cut at
  the column's edge with old pixels left beyond it.

### udoc-node

#### Changed

- `UDocSession.cutLog` and `catchUp` reject on a session not entitled to
  collaboration. `baselineVersion` doesn't.

## [0.8.15] - 2026-11-05

Built on `@docmentis/udoc-wasm` 0.8.18.

### All packages

#### Fixed

- Justified text in a PDF set in a two-byte font, as mPDF writes it, stays in its
  column, where its word gaps rendered too wide and the line ran past it.
- `saveToBytes` naming no strategy rewrites when nothing of the original can be
  kept, where it was refused: as another format than the source's, such as a DOCX
  saved as a DOTX, or with no original held, such as a PPTX from a package.
- A slide or sheet deleted from a deck or workbook leaves the file in a `"delta"`
  save, with its relationships and what only it reached. A package leaves out
  whatever was deleted, and an undo brings it back.
- An image opened from a `.udoc` package and left unedited saves as the file it
  came from: a JPEG, a PNG or an SVG comes back byte for byte, where a JPEG was
  recompressed and an SVG refused.
- A deck in a `.udoc` package can be saved back to a PPTX, where the save failed,
  and a slide show opened from one plays by the deck's own settings, where it
  played by the defaults. A chart in a word document's footnote or endnote keeps
  its workbook in a package. A package written before this stays as it was,
  without them.
- Undoing a font added to a PDF leaves every editor in a collaboration agreeing
  it's gone, where the editor that undid it and one opened later disagreed.

### udoc-viewer and udoc-editor

#### Added

- `openRemote` opens one checkpoint of a document a server keeps, given
  `…/documents/{id}/checkpoints/{version}/package`: the document as it was at
  that version, read-only. It stays in view mode, its editing tools aren't
  offered, an edit rejects and it can't join a collaboration. It can still be
  saved, downloaded, exported and printed.

#### Changed

- A UI joined to a server's collaboration that comes back after the document's
  edit log was cut catches up and rejoins by itself. With no edits unsent it
  keeps its undo stack. With edits unsent it sends them, and its undo stack
  empties.

#### Fixed

- `download` and `requestRemoteCopy` on a document opened with `openRemote` write
  over its original, by the strategy keeping the most of it: a PDF appends its
  edits as a new revision, and a DOCX, a PPTX or an XLSX writes its modified parts
  over the original. They rewrote it, and `requestRemoteCopy("delta")` and
  `requestRemoteCopy("incremental")` were refused.

### udoc-server

#### Added

- When a document's idle session closes and doing so would save enough, set by
  `cutMinSavedBytes`, the server cuts its edit log: the log then holds the state
  at a new checkpoint plus the edits after it, so later opens of the document
  hold less memory. The cut's checkpoint takes the next version number.
  `GET /documents/:id/package/cuts` lists the versions cut at, and
  `GET /documents/:id/package/cuts/:version/crdt` serves the log each one holds.
- A client behind a cut is closed with `4003`, and catches up from those routes.
- `GET /documents/:id/checkpoints` lists a document's checkpoints, and
  `GET /documents/:id/checkpoints/:version/package` serves one as it was, part by
  part, with no session opened. `GET /documents/:id/checkpoints/:version/file.:format`
  saves a copy of it.

#### Changed

- `DocumentStore` has more methods for a host's own store to implement: `putCut`,
  `getCuts`, `getCheckpointLog`, `getCheckpointVersions`, `getOriginalIdMap`,
  `getModifiedPartIds` and `getRemovedPartIds`. Its `getDescription`, `getPart` and
  `getBlob` take a checkpoint's `version`.
- The edit log is kept as `crdt_delta.loro`, in a store and in a package, in place
  of `crdt.loro`. A log kept under the old name isn't read.

#### Fixed

- `GET /documents/:id/file.:format` writes over the original, as it says: naming
  `delta` or `incremental` was refused, since the server's sessions never read the
  original, and naming no strategy rewrote. Named no strategy it now keeps the most
  of the original it can, and a PDF that needs a password still rewrites.
- A slide, page or sheet deleted from a document is left out of later checkpoints
  and of a `delta` copy, with what only it reached, and `…/package` answers `404`
  for it. A checkpoint from before the delete still has it, and an undo brings it
  back. An `incremental` copy of a PDF keeps its original bytes, so a deleted page's
  content stays in that file.

### udoc-node

#### Added

- `UDocSession.cutLog`, `catchUp` and `baselineVersion` cut a document's edit log
  and bring a session left open across a cut back onto it.
- `UDocNode.openRemote` takes `{ withOriginal: true }`, for a host that keeps the
  document's original behind its `fetch`: the session can then save by `"delta"`
  or `"incremental"`, reading the file only when a save needs it.

## [0.8.14] - 2026-11-04

Built on `@docmentis/udoc-wasm` 0.8.17.

### All packages

#### Fixed

- A deck or word document saved keeps its GIFs as they came, where each was
  saved as a still PNG of its first frame.
- A document with a long edit log opens in a fraction of the memory it took: a
  `.udoc` package saved as a checkpoint, or a document a udoc server keeps.

### udoc-viewer and udoc-editor

#### Added

- `setWatermarks` draws text, a shape or an image over the whole document or
  chosen pages, on screen, in thumbnails and slide shows, in print and in every
  export. It is never saved: `saveToBytes` and the Download button give the
  document as it is. See the Watermarks guide for exactly where one lands.
- `setWordprocessingView(view)` shows a word document as `"pages"` or
  `"pageless"`, as the View tab's Pages and Pageless do, with a
  `wordprocessingView` getter and option and a `wordprocessingView:changed`
  event. Once a view is chosen, by any of these or the View tab, each word
  document after opens in it. Until then each opens in the view it was saved
  in, as before.
- `setSheetView(view)` shows the sheet shown as `"normal"` or `"pageLayout"`, as
  the View tab's Normal and Page Layout do, with a `sheetView` getter and a
  `sheetView:changed` event. It sets that sheet's view alone: each sheet opens
  in its own, as its file left it.
- A slide show plays a slide's animated GIFs as PowerPoint does, a layout's or
  master's too, where each showed its first frame alone: at the GIF's own frame
  delays and loop count, holding its last frame, and from the start again when
  the slide is shown afresh.

#### Fixed

- The presenter view shows the next slide every time it opens, where from the
  second time on Chrome showed a broken image in its place.
- What is translucent over a clear part of a PDF or word document's page keeps
  its colour in a print, a thumbnail, `renderPage` and a PNG export, where it
  read too dark.
- A character no available font covers draws in whatever the browser falls back
  to, where it rendered blank, while its font downloads and for good if none is
  found. `enableCanvasFonts`, on by default, governs it, and it leaves out emoji
  and the scripts that join, reorder or run right to left.
- A slide show no longer stops at a slide with On Mouse Click unchecked and no
  After time: Space, the right arrow, Enter and the toolbar's next button move
  past it, where none could. A mouse click still doesn't advance it, and still
  plays its on-click animations, triggers and links.

### udoc-editor

#### Added

- A slide deck and a word document have a Table tab, with the edits the context
  menu offers over a table: Select row, column or table, Insert Row Above or
  Below, Insert Column Left or Right, Delete Rows or Columns, and Merge and
  Unmerge Cells. Selecting a block of cells opens it, and it stays open while
  the selection stays in the table.

### udoc-node

#### Added

- `UDocSession.setWatermarks` draws text, a shape or an image over the whole
  document or chosen pages in `exportToBytes` and `exportPageToBytes`.

#### Fixed

- What is translucent over a clear part of a PDF or word document's page keeps
  its colour in a PNG export, where it read too dark.

## [0.8.13] - 2026-11-03

Built on `@docmentis/udoc-wasm` 0.8.16.

### All packages

#### Fixed

- A deck saved keeps its 3D models, where each was read as the picture
  PowerPoint saves beside it, and PowerPoint opens the save. A page still shows
  that picture.
- A PNG or SVG of a worksheet's grid covers A1 to the far edge of what the sheet
  holds, text spilling past its cells and its drawings included, where the PNG
  was refused for its size and the SVG came to over 50 MB that Chrome drew
  blank. A blank sheet exports A1 alone. A page in Page Layout view and a
  chartsheet still export whole.
- On a slide, the text after a bullet with no indent follows the bullet, and a
  bullet on a first line indented past the margin stands at the margin, as
  PowerPoint draws them, where the text started at the next tab stop.

### udoc-viewer and udoc-editor

#### Added

- Headless: `create` takes `null` for its container, for a viewer or an editor
  that puts nothing on the page and is driven by its calls alone, to render,
  export, search, edit and save documents in the browser. No call waits on a
  person: `open` rejects a protected document with a `passwordRequired`
  `UDocError` unless its `password` opens it, and a CSV with an unclear split
  opens on the likeliest delimiter; `print()` prints every page; `open` rejects
  an extension document with an `unsupported` `UDocError`.
- Built-in Canva and Google documents: `open` takes a link to a Canva design,
  `docType` `"canva"`, or to a Google Docs, Sheets or Slides file, `docType`
  `"google"` and `sourceFormat` `"google-docs"`, `"google-sheets"` or
  `"google-slides"`, known by its address, with no `format` and nothing fetched.
  Each opens view only: it frames the service's own read-only page, for an
  `/edit` link too, under a bar with the link and "Open in new tab". They show
  what the reader can already open, and a private file depends on the reader's
  own sign-in reaching the frame. A host with a Content Security Policy allows
  `www.canva.com` and `docs.google.com` as frames. Registering an extension
  document of either doc type replaces that one.
- The keyboard moves through a document once it has focus: an arrow scrolls a
  line, Page Up and Page Down or Shift+Space and Space scroll a view's height,
  and Home and End go to the first and last page. In single-page view, moving
  past a page's edge turns the page, and Left and Right turn it where the page
  fits across. A workbook's grid and a text caret keep their own keys, so only
  Page Up and Page Down scroll there.
- A slide show draws a deck's 3D models from the models themselves, lit and
  shadowed, where it showed the picture PowerPoint saves with each. A morph
  between two views of one model turns it, where one picture faded into the
  other, and an animation that turns a model's view turns it. A model in a
  group, or one that won't draw, shows its picture.
- A click in a slide show acts on what it lands on: a shape with a trigger plays
  its effects, the show staying on its step, and a link on text or a shape goes
  to the next, previous, first, last or last viewed slide, to a given slide, or
  ends the show. A click on a link to a web page, a file or a program does
  nothing, and anywhere else a click steps the show on, as before.
- A slide show plays fourteen effects that change a shape's colour, Darken,
  Lighten, Desaturate, Complementary and Color Reveal among them, each from the
  shape's own colour. Change Line Color on a shape with no line of its own shows
  the line its style gives.
- A slide show plays the effects that restyle a shape's text, its lines breaking
  afresh as the text changes: Change Font, Change Font Style, Change Font Size,
  Bold Reveal, Bold Flash, Brush On Underline, Style Emphasis and Grow with
  Color.
- Flash Once and Transparency play in a slide show, and an animation that shears
  a shape leans it along the slide, a turned shape too.
- A Random Effects entrance plays one of twenty entrance effects, the same one
  each time the show plays it, where PowerPoint picks another each time.

#### Fixed

- `destroy` no longer sets off uncaught `worker destroyed` errors. The reads the
  UI starts after an open or an edit each rejected with one when it was
  destroyed before they answered. A call you're waiting on still rejects.
- A viewer or an editor placed inside a `<form>` no longer submits it: its
  buttons are `type="button"`, and Enter in one of its fields stays in that
  field, where a click on Next Page or Zoom In, or Enter in a print range radio
  or a page size list, submitted the form. Enter in the form's own fields now
  presses the form's own submit button, where it pressed the viewer's first
  button. The password and CSV delimiter dialogs still submit their own forms.
- The viewer's and the editor's fields stay out of a `<form>` around them: its
  `FormData` no longer holds `udoc-print-range`, a page number out of range left
  in the print dialog no longer stops it submitting, and resetting it leaves the
  page and zoom fields showing their values, where it blanked them.
- A viewer or an editor in a `display: flex` container fills it, where it
  collapsed to no width.
- A viewer or an editor also fills a grid that centers its items, and a host's
  border or padding on it stays inside the container, where it overflowed the
  bottom.
- The "Skip to document" link stays out of sight until Tab focuses it, then shows
  in the viewer's top-left corner, where it showed 100 pixels above a viewer in a
  container that doesn't clip. Activating it moves focus to the document, where
  focus stayed on the link.
- A click that moves to the next slide by morph starts at once, the morph made
  ahead once the slide has played all its steps, where the click paused while it
  was made.
- A morph starts a shape from where its slide's animations left it, where it
  started from where the slide was saved, and stacks its shapes as PowerPoint
  does: as the first slide has them until they are halfway, then as the second,
  where the second's order held throughout.
- The slide a show starts on plays whole, however long it takes to prepare.
- Bounce, Flash Bulb and Vertical Grow play at PowerPoint's pace, and Bounce's
  exit bounces from where its fall leaves it.
- Whip, and any effect that plays a shape's text by word or letter over a
  background its build animates, plays the background first, where the
  background stood still and only the letters played.
- A held effect stays at its end, where late in a show it could snap back to
  where it began on its last frame.
- A motion path whose numbers are written with an exponent moves its shape, where
  the shape stood still.
- A group of nothing but straight connectors appears as its entrance plays, where
  it never appeared.

## [0.8.12] - 2026-11-02

Built on `@docmentis/udoc-wasm` 0.8.15.

### udoc-viewer and udoc-editor

#### Added

- Extension documents: kinds of document the engine doesn't read, which a
  host registers with the `extensionDocuments` option or
  `registerExtensionDocument` and which then open view only. An
  `ExtensionDocument` has a `docType`, the source `formats` it opens, a
  `canOpen` that `open` asks ahead of the engine when given no `format`, and
  an `open` that renders the source into a `<div>` filling the document area
  and resolves with an `ExtensionDocumentViewer` (`sourceFormat`, `close`,
  `setTheme`). While one is open, `docType` and `sourceFormat` are its, the
  page chrome and the side panels hide, and the calls that need pages reject.
  An open is licensed and metered as any other. `OpenOptions.format` now
  takes an extension document's formats too, and `docType` and
  `sourceFormat` are typed to include them.
- A built-in media document plays video and audio: a file — MP4, M4V, MOV,
  WebM, MP3, M4A, AAC, WAV, Ogg, Opus or FLAC, by URL, Blob or bytes — an HLS
  stream, or a YouTube or Vimeo video by its address. It opens as any document
  does, `docType` `"media"` and `sourceFormat` the format, on Video.js 10's
  player, which loads only when a media document opens; a file with no picture
  plays in its audio player. A YouTube or Vimeo video that won't play here
  offers a link to it on its site. A host with a Content Security Policy
  allows inline styles, YouTube's IFrame API script and the sites' frames.
  Video.js is bundled into `@docmentis/udoc-ui`, so a host installs none of it,
  and a page without a bundler plays media too; `dist/THIRD-PARTY-NOTICES.md`
  lists what it bundles, with their licenses.
- A built-in web page document, `docType` `"webpage"`, frames a page:
  `open(url, { format: "url" })`. A URL given no `format` is never taken for
  one, as taking every URL would frame a PDF; to frame some without one — a
  host's Figma or Loom embeds, say — register `webpageDocument({ canOpen })`
  with a rule saying which, which replaces the built-in one. The page shows in
  a sandboxed iframe under a bar with its address and an "Open in new tab"
  link, which always shows, for a site that refuses to be framed. It follows
  the theme through its `prefers-color-scheme`.
- A PDF plays as a presentation, as a deck does: its Present tab, in view
  mode and in edit mode, has From Beginning, From Current Page, Presenter
  View and Set Up Presentation, and plays its pages a page at a time over
  the screen, each as large as fits on black, taking the same keys, clicks
  and swipes. Its presenter view shows the page, the next one and the
  timer. `startSlideShow(slide?)` plays a PDF from page `slide`. The
  `translations` keys `command.slideShowFromCurrentPage`, `presenter.pageOf`
  and `presenter.nextPage` are new.
- A slide show and Preview play the transitions that cut to the next slide
  before: Doors, Window, Switch, Gallery, Conveyor, Ferris Wheel, Blinds,
  Checkerboard, Glitter, Ripple, Vortex, Shred, Honeycomb, and the sheets
  that bend, fold and fly — Page Curl, Peel Off, Fall Over, Drape, Curtains,
  Wind, Prestige, Fracture, Crush, Airplane and Origami.
- Morph's By Word and By Character carry each word or letter two texts share
  from where it stands to where it goes, the rest fading in or out, where the
  whole text moved as one.

#### Changed

- The Slide Show tab has From Beginning, From Current Slide and Presenter
  View, then Set Up Slide Show, then Preview, in place of Use Presenter View
  and Set Up Screens. Presenter View plays the show from its first slide
  with the presenter view, whatever the setup says. Set Up Slide Show opens a
  dialog of how From Beginning and From Current Slide play it: Presenter
  View, off at first; Fullscreen, on at first; and, in Chrome and Edge,
  Display on — Set Up Screens, which lets the UI place windows on each
  screen as the browser asks once and remembers, then the screens as they
  stand, to choose the one the show fills. `startSlideShow(slide?)` plays it
  as the dialog has it. The `translations` keys `command.usePresenterView`,
  `command.setUpScreens`, `slideShow.windowHint` and `screens.message` are
  gone; `command.presenterView`, `command.setUpSlideShow` and
  `slideShowSetup.*` are new.
- A slide show with Fullscreen off, or one the browser won't fill the
  screen with, plays over the viewer or the editor, in window mode, a faint
  button in its top right corner filling the screen with it; the button
  fades a few seconds after the pointer stops moving over the show, and
  comes back as it moves. Leaving the full screen ends a show that filled it
  as it started, and takes one the button filled back to window mode.
- The presenter view opens in a window of its own, and the show stays in
  the UI's window, filling its screen or in window mode, where the show
  opened in a window of its own and the presenter view covered the UI. The
  presenter view's window never fills its screen of itself; its Fullscreen
  button does. With the screens set up, the show fills the screen Display on
  chose and the presenter view's window opens on another, at the one press;
  without, the window takes the press and the show plays in window mode.
  Swap Screens trades the windows the show and the presenter view stand in,
  each still filling its screen or not.
- The Slide Show tab is Present, and its Set Up Slide Show is Set Up
  Presentation; the line past the last slide, the presenter view's and the
  show's own window say presentation where they said slide show. Their
  `translations` keys are as they were.

#### Fixed

- Morph pairs shapes as PowerPoint does where they faded: a picture with
  one of the same image, even saved smaller or a little brighter, its crop
  moving as its box does; text on its words, however it is formatted; and
  plain rectangles, which stretch from box to box.
- A morph whose slide takes a while to prepare plays whole, where it could
  be skipped after a pause.
- A slide that names no transition plays its slide layout's, or its slide
  master's, as PowerPoint does; its thumbnail is marked and Preview plays
  it.
- Reveal moves the slides' shapes as it hides and shows them, as
  PowerPoint's does, and Smoothly no longer plays as a plain fade.
- Preview, where the view shows the slide, shows black under it as a
  transition uncovers it, as the show does, where the view's backdrop
  showed through.

### udoc-demo

#### Added

- Open File takes a video or audio file — `.mp4`, `.m4v`, `.mov`, `.webm`,
  `.mp3`, `.m4a`, `.aac`, `.wav`, `.ogg`, `.oga`, `.ogv`, `.opus` or `.flac` —
  which plays in the media document.
- Open URL hands the URL to the viewer or the editor, which fetches it, or
  streams it — a YouTube or Vimeo address, an HLS stream — where the demo
  fetched it first; Open File hands over the file as picked. Co-edit still
  reads either first, for its local collaboration service.
- Open Web Page frames a page by its URL in the web page document, in View,
  Edit and Co-edit alike — where Co-edit's two editors each frame it, as a
  page has nothing to co-edit.
- A Video sample category: two NASA videos streamed from their sites,
  Webb's first images on YouTube and the Parker Solar Probe on Vimeo.
  Co-edit's two editors each play one, as a video has nothing to co-edit.
- A credit at the foot of the sidebar: the samples courtesy of NASA, the Webb
  images NASA's, ESA's, CSA's and STScI's, and NASA's endorsement of
  docMentis disclaimed.

## [0.8.11] - 2026-11-01

Built on `@docmentis/udoc-wasm` 0.8.14.

### udoc-viewer and udoc-editor

#### Added

- A deck plays as a slide show, as PowerPoint's Slide Show does: a Slide
  Show tab before its View tab, in the viewer and the editor, has From
  Beginning and From Current Slide, which fill the screen with it, a slide
  at a time, each slide's transition and animations playing — Morph among
  them — and a slide timed to move on doing so. A click, Space, → or
  Enter steps on, ← or Backspace steps back, Home and End go to the first and
  last slide shown, a slide's number then Enter to that slide, and a swipe
  steps on or back; Escape ends it, as does a click on the black past the
  last slide, and the view then shows the slide it was on. Where the browser
  won't fill the screen, the show fills the UI. `startSlideShow(slide?)` and
  `endSlideShow()` play and end it, `isSlideShowPlaying` says whether one
  plays, and `"slideShow:changed"` fires as one starts and ends.
- The Slide Show tab's Preview plays the slide shown where the view shows
  it, as PowerPoint's Preview does: its transition from the slide before it,
  then its animations one after another, the view first turned to Normal, a
  slide at a time. Preview turns to Stop as it plays, and Stop, Escape, a
  click on the slide, or another slide or view ends it. It greys on a slide
  that plays nothing; a slide that plays something carries a mark on its
  thumbnail, a click on which previews it.
- A slide show and Preview play PowerPoint's transitions: Fade, Cut through
  black, Push, Wipe, Split, Reveal, Random Bars, Shape, Uncover, Cover,
  Flash, Dissolve, Clock, Zoom, Random, Flip, Cube, Box, Rotate, Orbit, Pan,
  Fly Through, and Morph, which moves, stretches and cross-fades the shapes
  two slides share. The rest — Blinds, Checkerboard, Vortex, Curtains and the
  like — cut to the next slide for now.
- A slide show and Preview play PowerPoint's animations: entrances and exits
  that appear, fade, fly, zoom, grow and turn or spiral, or come and go
  through a wipe, split, shape, wheel, wedge, blinds, checkerboard, strips,
  random bars or dissolve; Grow/Shrink, Spin and Teeter; and motion paths.
  Each repeats and reverses as it is set to, plays by paragraph, by word or
  by letter, and plays on a shape inside a group by itself.
- A slide show plays as the deck's Set Up Show has it: a range of its slides
  or a custom show, looping until Escape, browsed at a kiosk (no clicks or
  keys to step it, starting over after the last slide), without animation,
  or advancing manually, its slides' timings aside. A slide timed to move on
  plays its animations of itself, spread over its time, as PowerPoint does.
- A slide show plays with PowerPoint's presenter view where there is a
  second screen, as the Slide Show tab's Use Presenter View has it, on at
  first: the show opens in a window of its own, which a click fills the
  audience's screen with once it is dragged there, and the presenter view
  covers the UI here — the slide as the audience sees it, transitions and
  animations playing, the next slide, the slide's notes with their text
  made larger or smaller, a timer to pause and restart, the time, and
  buttons to step the show and end it, a line between each two of its panes
  that a drag moves to resize them. Closing the show's window ends the
  show. A browser that can't tell of a second screen (any but Chrome and
  Edge) plays the show alone, as it did.
- The Slide Show tab's Set Up Screens, in Chrome and Edge, lets the UI
  place windows on each of the computer's screens, as the browser asks once
  and remembers, and opens a dialog of the screens as they stand, each
  named, to choose the one the slide show plays on. A slide show with the presenter
  view then fills that screen at the press that starts it, and opens the
  presenter view in a window of its own filling another, with no window to
  drag. Closing the presenter view's window ends the show.
- The presenter view's Swap Screens trades the screens the show and the
  presenter view show on, the show playing on: each window keeps its
  screen, and the one pressed in fills it with the show.

#### Changed

- A deck's thumbnails number its slides in a column to their left, as
  PowerPoint does, where they numbered them underneath; every other document
  still numbers its pages under them.
- Slide Master is on a deck's View tab in the editor's edit mode alone, where
  slide masters and slide layouts are edited: the viewer's View tab, and the
  editor's in view mode, leave it off.

## [0.8.10] - 2026-10-31

Built on `@docmentis/udoc-wasm` 0.8.13.

### All packages

#### Changed

- A large workbook opens in a fraction of the memory it took — a sheet of a
  few hundred thousand cells in a quarter of it or less — and its cells take
  about a fifth less once laid out.

#### Fixed

- A deck saved keeps its slides' transitions that PowerPoint 2010 and later
  added — Morph, Vortex, Ripple, Curtains and the rest — and their duration,
  where it could save a Morph as a fade and the others as no transition at
  all; and an animation saved keeps its bounce.

### udoc-viewer and udoc-editor

#### Added

- A workbook's View tab shows the current sheet as Normal, its grid, or as
  Page Layout, the pages it prints on, as Excel names them: each sheet
  keeps its own view, and a sheet saved in Page Layout view opens in it. A
  sheet on paper shows no row and column headers, and the view controls
  offer its pages to go to and the fits; a cell is selected and typed into
  on its page. A switch starts the sheet from its top-left, and the views
  grey while a cell is typed into.
- Print prints a workbook's current sheet on the pages its Page Layout view
  shows, whichever view it is shown in, as Excel prints the active sheet;
  the print dialog and `print({ pages })` count those pages. It printed the
  first sheet's grid before, as one page, whatever sheet was shown.
- A deck's View tab adds Slide Master to Normal and Notes Page, as
  PowerPoint names it: its slide masters, each followed by its slide layouts,
  to look through but not yet edit. The thumbnails show each slide master
  numbered and its slide layouts indented under it, named by their layout.
  The view opens on the slide layout of the slide shown, and Normal or Notes
  Page goes back to that slide. `setPresentationView("slideMaster")` and the
  `presentationView` option show it too. New Slide greys in it, and Print
  still prints the deck's slides.
- `exportToBytes("pdf")` exports a workbook, every worksheet on the pages it
  prints on, where it rejected one as `unsupported`.

#### Changed

- A word document's View tab no longer offers Rotate View, and its pages
  show upright: the `pageRotation` option and `setPageRotation` turn a PDF's
  pages alone.
- The View tab's choices of one setting — the views, how the pages scroll —
  sit inside one light border, so each set reads as one control.

#### Fixed

- As the document's pane resizes — a side panel opening, the ribbon
  unfolding — the page moves once, and the selection and rulers with it,
  where before it could move twice or slide over and back: a page centred at
  its zoom moves straight to where it settles, a page fitted to the pane
  holds still until it re-fits, and a page wider or taller than the pane
  keeps its place. The page re-fits a frame or two after the pane settles
  rather than after a fixed wait, and the scrollbars resize with the pane at
  once rather than after the page. Nor does the page, or a deck's notes,
  squeeze or stretch for a frame as it re-fits and spring back.
- View mode shows Undo and Redo for a PDF alone, whose annotations it
  edits, where since the View tab they showed, greyed, for every document.
- A large worksheet keeps only the rows around its view laid out as it is
  scrolled, letting those far behind go and laying them out again on the way
  back, where it laid the whole sheet out ahead and kept it: past 2 GB of
  memory for a sheet of 460,000 cells.

### udoc-editor

#### Added

- Insert ▸ Shapes on a slide or over an image offers every preset shape
  PowerPoint draws, in its groups — lines and connectors with their arrowed
  forms, rectangles, basic shapes, block arrows, equation shapes, flowchart,
  stars and banners, callouts and action buttons — in a gallery of icons
  named by their tooltips. A slide takes Insert ▸ Shapes for the first time:
  a shape is drawn in the deck's theme, as PowerPoint draws one it inserts,
  holding centred text to type, and a line is a connector. Over an image a
  shape is drawn in the markup red as before. A PDF keeps its four shapes.
- A word document's Text tab opens with a paragraph style picker: it shows
  the style the selected paragraphs are in and offers the document's style
  gallery, as Word lists it. A pick puts the paragraphs in that style and
  clears their direct formatting, as Word does, and Enter at the end of a
  heading starts body text. A Markdown or HTML document offers body text,
  the headings, a quote and a code block; a text file has no styles to
  offer, and a deck's Text tab has no picker.

#### Changed

- The Insert tab names its commands beside their icons, and Shapes has a
  glyph of its own.
- The ribbon opens folded, its tabs alone showing, and the Home tab is gone:
  what is selected opens its tab — text the Text tab, a shape the Shape tab,
  a PDF's page objects the Object tab and its annotations the Annotate tab,
  an image's pages its Image tab — while a tab picked stays open as the
  selection moves within the same kind. New Slide moves to the Insert tab,
  an image's Rotate, Flip, Crop and Image Size to its new Image tab, and a
  word document's drawings take their Fill, Line and arrangement from a
  Shape tab.
- The Shape and Object tabs show Order, Align and Rotate as dropdowns of
  their own, side by side, and Group and Ungroup as buttons beside them, in
  place of the one Arrange dropdown they nested in. The `translations` keys
  `command.shapeArrange` and `command.objectArrange` are gone.

### udoc-node

#### Added

- `exportToBytes("pdf")` exports a workbook, every worksheet on the pages it
  prints on, as Excel prints a workbook, where it rejected one as
  `unsupported`.

#### Changed

- A workbook whose first sheet was saved in Page Layout view opens in it:
  `pageCount` and `exportPageToBytes` count and render that sheet's pages of
  paper, where it was one page, its whole grid.

### udoc-cli

#### Added

- `udoc export` exports a workbook or CSV to a PDF, every worksheet on the
  pages it prints on, where it failed as unsupported.

#### Changed

- A workbook whose first sheet was saved in Page Layout view opens in it:
  `udoc page-count` and `udoc render` count and render that sheet's pages of
  paper, where it was one page, its whole grid.

### udoc-server

#### Added

- `GET /documents/:id/layout/pages.pdf` exports a workbook, every worksheet
  on the pages it prints on, where it answered `422 unsupported`.

#### Changed

- A workbook whose first sheet was saved in Page Layout view opens in it:
  `layout/page-count` and `layout/pages/:index` count and render that sheet's
  pages of paper, where it was one page, its whole grid.

## [0.8.9] - 2026-10-30

Built on `@docmentis/udoc-wasm` 0.8.12.

### All packages

#### Added

- An Excel region map whose file carries no geography of its own, as one
  written by an app other than Excel may not, draws its countries from
  Natural Earth's, where it drew only its title and legend. They are a file
  `@docmentis/udoc-wasm` ships, `geography/countries.json`, fetched only for
  a document with such a map.
- A waterfall, histogram, pareto, box & whisker, funnel, treemap, sunburst
  or region map chart draws its axis titles and its tick marks.

#### Fixed

- Office's newer charts (waterfall, histogram, pareto, box & whisker,
  funnel, treemap, sunburst and region map) lay out as Office lays them out:
  their text, axis labels and legends stand where Office stands them, a
  legend too wide for its chart wraps, and a legend that sizes no text draws
  it at 9pt, where a workbook's drew its keys with no names.
- A pareto chart whose line names no series draws, its axes with it, where
  it drew nothing.
- A box & whisker chart's legend that names no side stands above the chart,
  as Office stands it, where it stood at the right.
- A treemap labels every leaf, the label wrapped to the leaf and cut at the
  chart's edge, where it dropped each label that didn't fit.
- A region map's colour scale above or below the map lies on its side, a
  waterfall's connectors draw where its style gives them no line, and a
  treemap's or sunburst's name that comes back after another is a group of
  its own, as in Office.
- A slide's bullet takes its colour, size and font each from the master,
  layout or slide that gives it, where a layout giving the master's bullet
  a colour drew it in the text's colour; and the bullet stays out of its
  text's underline.
- A slide's linked text is painted in the theme's hyperlink colour,
  underlined once, as PowerPoint paints it, and a link set to keep its
  text's colour keeps it.
- A shape with no fill casts no inner shadow, where it drew a dark edge along
  its outline.
- A table cell whose text runs vertically turns it, where it lay flat and
  wrapped at the cell's width.
- A WMF picture fills its frame, where one could shrink into its corner, and
  draws with every fill it makes.
- A SmartArt diagram spaces its lines of text by its font's own line
  height, as Office does.
- A bevelled 3D shape or text lit by the Chilly rig, or made of Translucent
  Powder, is lit as in PowerPoint, where Chilly lit it upside down and
  Translucent Powder drew harsh bands.

### udoc-viewer and udoc-editor

#### Added

- A `.md` or `.markdown` file opens, as a word document shown pageless:
  CommonMark, with GitHub's tables and strikethrough.
- An `.html` or `.htm` file opens, as a word document shown pageless, styled
  by its `<style>` rules and `style` attributes, and the editor's download
  saves it back as HTML.
- An `.eml` email message opens, as a word document.
- A Word, PowerPoint or Excel template, slide show or macro-enabled file is
  told from the `.docx`, `.pptx` or `.xlsx` it varies: `sourceFormat` names
  it (`"docm"`, `"dotx"`, `"dotm"`, `"pptm"`, `"potx"`, `"potm"`, `"ppsx"`,
  `"ppsm"`, `"xlsm"`, `"xltx"` or `"xltm"`), where it named the format it
  varies, and the editor's download saves it as one, a macro-enabled file
  with its macros.
- Every document has a View tab, its last tab in view mode and edit mode
  alike. In order, where the document has them: a deck's or a word
  document's own views; Single or Continuous; Page Layout, a dropdown of One
  Page, Two Pages, Cover on the Right and Cover on the Left, its button
  showing the current one's icon; Rotate View Left and Right; Gap; then what
  shows beside the document — a PDF's Layers, only for a PDF that has some,
  a deck's Notes, a word document's Formatting Marks and a workbook's
  Formula Bar. The editor adds Ruler among them for a PDF, a deck and a word
  document. The views, the scroll, Gap, Layers, Notes and Formula Bar show
  their names beside their icons. Word's page controls grey out while it
  shows pageless.
- A word document's formatting marks show in view mode too, from the View
  tab or Ctrl+Shift+8, and `setShowFormattingMarks` is the viewer's as well
  as the editor's.
- A `.csv` opened without a `delimiter` whose first records no delimiter
  splits alike, or more than one does, asks the reader what splits its
  fields before it opens: a dialog shows its first lines, the delimiter
  picked marked in them, and offers Comma, Semicolon, Tab, Vertical bar and
  Other, the likeliest picked. Its `translations` keys are `delimiter.*`.

#### Changed

- A host serving the engine itself, at `wasm.baseUrl`, serves its
  `geography/` too, beside `wasm/` and `fonts/`: without it, a region map with
  no geography of its own draws no countries.
- A `.csv` opened without a `delimiter` is split by the comma, semicolon, tab or vertical bar that
  splits its first records alike, else the one that splits its first record
  into the most fields, where only a comma or a semicolon was tried, on the
  first record alone.
- The ribbon's commands show their icons alone, each named in its tooltip,
  where the Insert tab's tools, New Slide and the crop controls showed their
  names beside their icons. The View tab's controls keep their names.
- The Annotate tab's Highlight, and a highlight's comments, show a highlighter
  pen alone, where it stood over a bar like the Color dropdown beside it.
- The Annotate tab's Fill, Color and Opacity sit in one group, in that order,
  where Color led and Opacity stood apart from the other two.
- A dropdown's or split button's chevron sits 4px from its icon and meets its
  right edge, where it kept 3px clear on each side, so the button is 5px
  narrower.
- The View tab's views, Normal and Notes Page or Pages and Pageless, and how
  the pages scroll are each one segment button: its choices butt together,
  square but for its two rounded ends, one of them pressed.
- The view controls (page navigation and zoom) no longer carry the view
  settings button: its Scroll, Layout, Rotation and Page Gap are on the View
  tab, and with the toolbar hidden only the options and calls set them. Its
  `translations` keys, `viewMode.*`, are gone; the View tab's are
  `command.*` and `pageLayout.*`.
- The toolbar's first button, which shows or hides the side panel, shows a
  window with its panel and an arrow the way a click moves it, and is named
  Show Side Panel or Hide Side Panel, where it was a ☰ named Menu. Its last
  button, the menu of Search, Comments, Print and the rest, is the ☰ named
  Menu, where it was a ⋯ named More. The `translations` keys
  `toolbar.showSidePanel` and `toolbar.hideSidePanel` name the first,
  `toolbar.menu` the last; `toolbar.more` is gone.

#### Fixed

- A text file, or a word document opened pageless, keeps the gaps between
  its pages once shown in Pages, where they butted together until the gaps
  were turned off and on again.

### udoc-node

#### Added

- A Markdown file opens as a word document, its format named `"md"`, and
  `saveToBytes("md")` saves it, or any word document, as Markdown.
- An HTML file opens as a word document, its format named `"html"`, and
  `saveToBytes("html")` saves it, or any word document, as HTML.
- An email message opens as a word document, its format named `"eml"`.
- A Word, PowerPoint or Excel template, slide show or macro-enabled file
  opens as one: `sourceFormat` names it (`"docm"`, `"dotx"`, `"dotm"`,
  `"pptm"`, `"potx"`, `"potm"`, `"ppsx"`, `"ppsm"`, `"xlsm"`, `"xltx"` or
  `"xltm"`), where it named the `.docx`, `.pptx` or `.xlsx` it varies, and
  `saveToBytes` saves a document as any of its doc type's: a `"delta"` keeps
  a macro-enabled file's macros, a `"rewrite"` drops them.

#### Changed

- A CSV opened without a `delimiter` is split by the comma, semicolon, tab or vertical bar that
  splits its first records alike, else the one that splits its first record
  into the most fields, where only a comma or a semicolon was tried, on the
  first record alone.

### udoc-cli

#### Added

- A `.md` or `.markdown` input opens as a word document, and `udoc save`
  saves a word document to a `.md` or `.markdown` `--out`.
- An `.html` or `.htm` input opens as a word document, and `udoc save`
  saves a word document to an `.html` or `.htm` `--out`.
- An `.eml` input opens as a word document.
- `udoc save` saves to a template's, a slide show's or a macro-enabled file's
  `--out`: `.docm`, `.dotx`, `.dotm`, `.pptm`, `.potx`, `.potm`, `.ppsx`,
  `.ppsm`, `.xlsm`, `.xltx` or `.xltm`.

#### Changed

- A `.csv` input without `--delimiter` is split by the comma, semicolon, tab or vertical bar that
  splits its first records alike, else the one that splits its first record
  into the most fields, where only a comma or a semicolon was tried, on the
  first record alone.

#### Fixed

- `udoc save` rewrites a document whose `--out` names another of its doc
  type's formats — a `.docx` saved as a `.dotx`, a `.csv` as an `.xlsx`, a
  `.md` as a `.docx` — where it failed, trying to save over the original.

### udoc-server

#### Added

- `GET /documents/:id/file.md` saves a copy of a word document as Markdown.
- `GET /documents/:id/file.html` saves a copy of a word document as HTML,
  and `POST /documents?format=html` imports one.
- `GET /documents/:id/file.<ext>` saves a copy as a template, a slide show
  or a macro-enabled file, `<ext>` one of `docm`, `dotx`, `dotm`, `pptm`,
  `potx`, `potm`, `ppsx`, `ppsm`, `xlsm`, `xltx` and `xltm`.

#### Changed

- A CSV imported without `?delimiter=` is split by the comma, semicolon, tab or vertical bar that
  splits its first records alike, else the one that splits its first record
  into the most fields, where only a comma or a semicolon was tried, on the
  first record alone.

### udoc-demo

#### Added

- Open File takes a `.md` or `.markdown` file, an `.html` or `.htm` file,
  an `.eml` file, and a Word, PowerPoint or Excel template, slide show or
  macro-enabled file.

#### Removed

- `?document=<id>`, which opened a document udoc-server keeps and joined its
  collaboration through the dev server's `/documents` proxy. `npm run dev` no
  longer runs udoc-server beside the demo.

## [0.8.8] - 2026-10-29

Built on `@docmentis/udoc-wasm` 0.8.10.

### All packages

#### Added

- A word document's footnotes and endnotes show, numbered as Word numbers
  them: a page's footnotes under a separator at its foot, and endnotes after
  their section or at the end of the document.

#### Fixed

- A word document's superscript and subscript text, a note's number among
  them, takes the size and the rise its font gives it, as in Word, where every
  font's was set alike.
- A slide's picture background takes the colour effects the deck gives it, a
  duotone in the slide's colour among them, where it showed the plain picture.
- A workbook's chart saved with no values cached for its data draws them from
  the cells it names, where it drew nothing.

### udoc-viewer and udoc-editor

#### Added

- A workbook has a formula bar above its grid: the Name Box, the active cell's
  reference, and its contents, `=` and its formula or its value. Its bottom
  edge drags it taller, the contents wrapping in it while the Name Box stays
  at the top. The `showFormulaBar` option hides it.
- A workbook's active cell moves with the keyboard: an arrow moves it, Shift
  extends the selection, Ctrl or Cmd jumps to the edge of the data, and Enter
  and Tab step down and right (Shift back). A workbook opens with its active
  cell selected, and a sheet shown from its tab comes back scrolled as it was
  left, with the cells it was left with selected, or, the first time, from its
  top with the active cell its file keeps, A1 where it keeps none.
- The people button's menu has a Show Collaborators' Pointers switch, on to
  start with, that hides the pointers the others share. The
  `showPeerPointers` option and `setShowPeerPointers` set it.
- A colour menu's More Colors… shows a picker in place of its swatches, for
  any colour: a saturation and brightness square over a hue strip, the hex
  they make, which can be typed instead, and an eyedropper where the browser
  has one. OK applies it and adds it to Recent Colors; Cancel goes back to the
  swatches.
- A word document has a View tab that shows it as Pages, or Pageless: its body
  flowed to the pane's width on one page as tall as its text, with no headers,
  footers or page breaks, wrapping again as the pane or the zoom changes. A
  document saved in Word's Web Layout opens pageless. While it shows pageless
  the view controls are zoom alone: the page navigation, the view settings and
  the fit options come back with its pages.
- A `.txt` file opens, as a word document shown pageless, in Courier New.

#### Changed

- The people button's Share My Pointer switch is named Show My Pointer.
- A word document's Show Formatting Marks is on its View tab in the editor,
  after Pages and Pageless, where it was on its Text and Home tabs.

#### Fixed

- The selection moves with what it selects when a web font the document uses
  lands after it is shown: text that reflows, or a workbook's cells, whose
  columns and rows the font sizes.
- A menu's on/off switch stands clear of its label, where it sat almost
  against it in a menu no wider than that row.
- A workbook's sheet tabs end on one line, where a tab filled in its sheet's
  colour stood a pixel lower than the open one, and the open tab's colour
  tints its folds too.

### udoc-editor

#### Added

- A workbook's cells are typed into as in Excel. A typed character starts an
  entry in place of what the cell holds, and F2, a double-click or a click in
  the formula bar edits its contents. What is typed shows over the cell in its
  font, widening across the columns beside it, and in the formula bar; an arrow
  saves it and moves, or in an edit moves the caret, F2 switches between the
  two. Enter saves and steps down, Tab right, Ctrl or Cmd with Enter saves into
  every selected cell, Alt with Enter breaks the line, and Escape drops it.
  Showing another sheet saves it too. Each save is one undo step, and a
  formula that doesn't parse says so under the formula bar, the entry left
  open and its sheet shown. Delete clears the selected cells, and
  Backspace starts an empty entry.
- A workbook's sheets are edited from their tabs. ⊕, beside the list of
  sheets, inserts a worksheet after the current one and shows it, and Shift
  with F11 inserts one before it. A
  right-click on a tab opens its menu: Insert Sheet, Delete, Rename, Tab Color
  in Excel's standard colours, Hide, and Unhide for each hidden sheet. A
  double-click on a tab renames it there, a name Excel refuses saying why above
  it, and a tab dragged along the strip moves its sheet. Each is one undo step,
  a delete's too, and the sheet shown stays shown or, deleted or hidden, gives
  way to the next one. A rename rewrites the formulas naming the sheet, and a
  delete turns them to `#REF!`.
- An image is edited in place. Its Home tab turns the current page, or the
  pages picked in the thumbnails, left or right, and flips them horizontally
  or vertically. Crop frames the part of the
  page to keep, dragged by its corners, edges and middle and kept to an aspect
  ratio if one is picked (Original, Square, 4:3 or 16:9); Apply or Enter crops
  it, Cancel or Escape leaves it, and Reset takes an earlier crop away to show
  the whole image again. Image Size sets the size in pixels the page shows and
  saves at, its aspect ratio kept unless unlocked. Each is one undo step, and
  a save writes the image with them applied.
- Shapes are drawn over an image from its Insert tab: a rectangle, an ellipse,
  a line or an arrow, outlined in red and unfilled. The Shape tab colours and
  arranges them, a double-click in a rectangle or an ellipse types a label in
  it, which the Text tab formats and a double-click selects a word of, and a
  save draws them into the image. Turning, flipping, cropping or resizing the
  image carries them with it, a label still reading forwards.
- An image's thumbnails pick whole pages, as a PDF's do: a right-click rotates
  or deletes them, or in a TIFF duplicates them, a drag moves them, and Delete
  deletes them, an image keeping one page.

#### Fixed

- A Line colour, weight or dash picked for a shape keeps its arrowheads, where
  it took them away.
- Fill and Line colour a word document's drawing, where they did nothing.
- New Slide shows the slide layouts again, where it showed the slides' notes
  pages in their place, stretched, and nothing past the deck's last slide.
  Each shows in the shape of the deck's slides, where a deck that isn't 16:9,
  a 4:3 or a portrait one, had them stretched to 16:9.

### udoc-node

#### Added

- A plain text file opens as a word document, its format named `"txt"`, and
  `saveToBytes("txt")` saves it as text again, a line for each paragraph.

### udoc-cli

#### Added

- A `.txt` input opens as a word document, and `udoc save` saves it to a
  `.txt` `--out`.

### udoc-server

#### Added

- `GET /documents/:id/file.txt` saves a copy of a text document as text.

#### Changed

- A collaboration answers a join with its version and the edits the client
  lacks, and no presence: the server is no peer, and a joiner learns the
  others from their own, each sent whole within its 10 s refresh.

## [0.8.7] - 2026-10-28

Built on `@docmentis/udoc-wasm` 0.8.9.

### All packages

#### Fixed

- A presentation saved by `"rewrite"` keeps its speaker notes, its notes
  master and its sections, and its hidden slides stay hidden, where the save
  dropped them all and showed every slide.

### udoc-viewer and udoc-editor

#### Added

- A presentation's hidden slides, which its slide show skips, show faded in
  the thumbnails, their number struck through.
- A presentation's sections head their slides in the thumbnails. Each header
  folds its slides away or back, and counts them while they're folded; Left
  and Right fold the section of the slide the arrow keys are on.
- A presentation's speaker notes show in a panel under its slides while they
  show one at a time, the current slide's, and their text is selected and
  copied there. Dragging its top edge resizes it, down to the edge itself,
  which closes it. A click on that edge, or the View tab's Notes, opens it at
  its default height and closes it to its edge. It starts closed; the
  `showNotesPanel` option starts it open, `openNotesPanel()` and
  `closeNotesPanel()` open and close it, `notesPanelOpen` says whether it is
  open, and `notesPanel:changed` fires when that changes.
- A presentation shows as notes pages, the page each slide's notes print on
  with the slide drawn above them, from the View tab's Notes Page, and as its
  slides again from Normal, each opening on the slide the other showed. The
  thumbnails stay its slides, and the notes panel shows in Normal only. The
  `presentationView` option opens decks in either, `setPresentationView()`
  switches, `presentationView` says which shows, and
  `presentationView:changed` fires when it changes.

#### Fixed

- Escape closes an open menu and nothing else, where it also closed the side
  panel, or put down the armed tool, behind it.
- A turned page's thumbnail shows the page turned, in its turned shape, where
  it was squeezed into the shape of the upright page: a PDF page with its own
  rotation, and every page while the view is rotated.
- A thumbnail under the pointer is ringed in gray, as a selected one is in the
  primary color: the hover tint alone was lost beside the page.
- Hovering a thumbnail shows in dark mode. The UI's text took the host page's
  color wherever a part of it set none of its own, and the thumbnails' hover
  was tinted with it, which on a host with dark text showed nothing in dark
  mode.

### udoc-editor

#### Added

- A PDF's pages and a presentation's slides are selected and edited in the
  thumbnails: a click selects a page, Ctrl+click (Cmd+click on a Mac) adds or
  removes one, and Shift+click selects the run from the last click, the arrow
  keys with Shift extending it. A right-click offers Insert Page, Duplicate
  Page, Rotate Right, Rotate Left and Delete Page (for a deck New Slide,
  Duplicate Slide and Delete Slide) on the selection, Delete deletes it, and
  dragging lifts the selected pages out of the thumbnails, stacked, and moves
  them to where they're dropped, in order. Each edit is one undo step, and the
  view follows the pages it leaves selected.
- New Slide shows with slides selected in the thumbnails, and adds the slide
  after the last of them.
- A presentation's speaker notes are edited in the notes panel: a click places
  the caret, writing a slide's notes if it has none yet, as one undo step, and
  the Text tab formats them. They're edited on the notes pages alike, where
  Insert Image is off: it inserts onto the slide.
- Hide Slide in the thumbnails' menu hides the selected slides from the slide
  show, and shows them again when every one is hidden, in one undo step.
- A presentation's sections are edited in the thumbnails. A click on a
  section's header selects it, Ctrl+click and Shift+click as on slides, and a
  double-click edits its name. A right-click offers Rename Section, Move
  Section Up and Down, which take its slides along, Collapse All, Expand All,
  Remove Section, which leaves its slides to the section before it, as Delete
  does (so not on the first section while others remain), Remove Section &
  Slides, and Remove All Sections, which keeps every slide. Add Section in the
  slide menu starts an untitled section at the selected slides and edits its
  name. Dragging a header lifts the selected sections out of the thumbnails
  and moves them, with their slides, to where they're dropped between two
  others. Each edit is one undo step.
- Slides dropped just under a section's header join that section, at its top,
  and slides dropped on an empty section's header join it.
- New Slide with a section selected adds the slide at the end of that section,
  an empty one too.

#### Fixed

- Duplicate Slide copies the slide's speaker notes, where the copy had none.
- A presentation saved after slides are added, duplicated, deleted or moved
  keeps its sections in step with them, where an added slide was saved in no
  section and a deleted one stayed listed in its own.

## [0.8.6] - 2026-10-27

Built on `@docmentis/udoc-wasm` 0.8.8.

### All packages

#### Fixed

- Text in an SVG, EMF or WMF image draws in the fonts the image names, where
  the viewer and the editor drew none of it, leaving a metafile's tables and
  an SVG's labels blank, and udoc-node drew it in whatever font the machine
  had installed.
- A shape's text set in columns, once it overflows them, is leveled across
  them as PowerPoint does, each column as deep as its share needs, where the
  first column filled to the foot of the box and the rest of the text spilled
  into the last, far past it.
- A doughnut chart's data label moved from its place on the ring lands where
  PowerPoint puts it, where it landed farther out, as if moved from the ring's
  outer edge.

### udoc-viewer and udoc-editor

#### Fixed

- With several pages to a screen, `currentPage` and the page box give the
  first page at the top of the scroll and the last at its end, and the first
  page of a document that fits the screen, where they gave the page nearest
  the middle of the screen: a presentation opened in a tall pane started on
  slide 2, and the editor inserted, pasted and added slides there.

### udoc-editor

#### Added

- The ruler lights up the span the selection covers, across the top and down
  the side: a selected object's, an annotation's or a block of table cells'.
  It follows a move or a resize as it's dragged.
- While text is being edited, the ruler measures from its margins, as Word's
  does: the text area lights up between the darker margins of the page or the
  text box, and the paragraph the caret is in shows its indents (the first
  line's marker along the top edge, the left and right indents' along the
  bottom) and its tab stops, a mark for each by its alignment. Word documents
  and presentations show indents and tabs; a PDF text object shows its
  margins. Text turned on the page shows none of them.
- The ruler's margin edges, indent markers and tab stops can be dragged, as
  in Word: a dashed line follows the drag across the page, the drop lands on
  the nearest sixteenth of an inch (hold Alt to place it freely), and each
  drop is one undo step. A margin edge sets a Word section's page margins, a
  slide shape's text insets or a PDF text box's side; the indent markers and
  tab stops set the paragraphs'. A marker the selected paragraphs disagree on
  stays put.

#### Changed

- The ruler ticks eighths of an inch where the zoom leaves room for them, and
  thins its figures out to every 2, 5 or more inches as it zooms out, where it
  ticked quarters and numbered every inch at any zoom. Its ticks land whole on
  the screen's pixels, each as sharp as the next at any zoom or display scale.
- A presentation's ruler counts from the left edge of the text, inside the
  text box's margin, while that text is being edited, and a PDF's from the
  text object's own box, where they counted from the shape's or the object's
  origin.

## [0.8.5] - 2026-10-27

Built on `@docmentis/udoc-wasm` 0.8.7.

### udoc-viewer and udoc-editor

#### Fixed

- The search results group a presentation's matches by slide, where they
  named each group for a sheet, and a workbook's by sheet, where one with a
  single sheet grouped them by page.
- In a presentation's warped text, bent into an arch or a wave, a selection
  and a search match highlight the glyphs, the editor's caret sits among them,
  and a click or a drag picks the text under the pointer, where all of them
  landed on the text as laid out before the bend. A line that doesn't wrap
  highlights across all its text, even where it hangs past its box.
- Text in a font installed on the user's machine (`enableCanvasFonts`) bends
  with a text warp and draws its effects, 3-D and perspective, where a warped
  box in that font drew straight, a run of it among other fonts vanished, and
  its effects drew nothing.

### udoc-editor

#### Added

- A shape's text warp shows its adjust handles beside its outline's, and a
  drag on one reshapes the warp: an arch's sweep, a wave's height. A shape's
  adjust handles also stay, and drag, while its text is being edited.

## [0.8.4] - 2026-10-26

Built on `@docmentis/udoc-wasm` 0.8.6.

### udoc-viewer and udoc-editor

#### Added

- `enableAnnotation: false` keeps the user from annotating a PDF, and
  `enableFormFilling: false` from filling in its form, where the license
  allows both: the Annotate tab is gone, comments and annotations are there to
  read, and a press on a form field selects as on the page.
  `addPageAnnotation` and the rest still change the annotations.
- `--udoc-canvas-guide-background` sets the fill of the guide, the ruler or a
  spreadsheet's row and column headers, and
  `--udoc-canvas-scrollbar-background` that of the scrollbars beside a page.

#### Changed

- The guide and the scrollbars beside a page take the toolbar's color,
  `--udoc-color-surface-container`, by default, where they took the canvas's,
  so `--udoc-canvas-background` no longer recolors them.
- A scrollbar's thumb keeps 2px clear of its track's ends, as it does of its
  sides, so it no longer touches the view's edge or the corner where the two
  scrollbars meet.
- In a PDF or a presentation, the page count beside the page number, the
  pages it accepts and the thumbnails cover every page from the open, where
  they grew as pages composed ahead, and `pageCount` is the document's total.
- A presentation opens one slide at a time, in the `"spread"` scroll mode,
  where it opened scrolling continuously. The `scrollMode` option and
  `setScrollMode` set the scroll mode every document opens in, `null`
  restoring each doc type's own, and the view settings' Scroll section picks
  one for the open document alone, where its pick held for every document
  opened after.
- `document:edited` carries `pageCount`, the document's page count, for
  `composedPageCount`, and udoc-editor's `pageActions` and `pageInserts` take
  a `pageCount` option for `composedPageCount`.

#### Fixed

- In a PDF or a presentation, following a link, an outline item or a page
  number to a page not composed yet lands at once, where the viewer froze
  until every page before it had composed. Composing ahead asks for only the
  pages it adds, so its steps no longer slow down as a long document fills in.
- In a PDF whose text is set in a Type 3 font, as bitmap text often is, a
  selection highlights the lines it covers and a drag from between two lines
  selects them, where its lines had no height to highlight or to pick.
- A PDF page drawn from thousands of small pieces of text scrolls smoothly
  with the pointer resting on it, where each frame stalled on finding the text
  under the pointer.
- A link still being followed when the viewer is destroyed no longer logs
  "following a link failed".

### udoc-demo

#### Added

- `?sample=` opens the demo on a sample, by its file's name
  (`?sample=james-webb-space-telescope.pptx`), and the address keeps it in
  step as the sample changes.
- Co-edit shows it is preparing while it loads the whole document into the
  collaboration service both editors share, which takes longer than opening
  it in View or Edit.
- The Options dialog turns annotating and form filling off, under Features
  with copy, and groups the toolbar and view items under UI.

#### Changed

- Switching the mode or the document adds an entry to the browser's history,
  so Back returns to the one before.

## [0.8.3] - 2026-10-25

Built on `@docmentis/udoc-wasm` 0.8.5.

### udoc-viewer and udoc-editor

#### Fixed

- A document opened where another was open draws at once, where it stayed
  blank until the view changed size.
- A document opened where another was open scrolls whole, where a scroll
  redrew only the strip it brought into view and left the rest as it was.

### udoc-demo

#### Fixed

- The docMentis logo opens the site in the whole window, not inside the frame
  a page embeds the demo in.

## [0.8.2] - 2026-10-25

Built on `@docmentis/udoc-wasm` 0.8.4.

### All packages

#### Added

- A map chart shades its regions through a three-color scale, its middle color
  shown in the legend's bar as well, and labels each region with its name,
  placed as PowerPoint places it.

### udoc-viewer and udoc-editor

#### Added

- `exportToBytes("pdf")` exports the document as a PDF of its laid-out pages,
  and `exportPageToBytes(page, format)` a page as the bytes of a PNG,
  `{ png: { scale } }`, or an SVG, `"svg"`, as udoc-node's do. Both fetch the
  fonts the document names first, so none is drawn in a stand-in. A
  spreadsheet can't be exported to PDF yet.

### udoc-node

#### Added

- `exportToBytes("pdf")` exports the document as a PDF of its laid-out pages,
  in its own fonts, and `exportPageToBytes(index, "svg")` exports a page as
  SVG; both rejected before. A spreadsheet can't be exported to PDF yet.

#### Fixed

- `openRemote` with a `fetch` that answers in a Node `Buffer` gets the bytes it
  answered, where it threw, and stopped the process, on Node 21 and later.

### udoc-cli

#### Added

- `udoc render` writes a page as an SVG for an `--out` ending in `.svg`, and
  `udoc export <input> --out <file.pdf>` exports the document as a PDF of its
  laid-out pages.

#### Changed

- `udoc render` refuses an `--out` that isn't a `.png` or a `.svg`, where it
  wrote a PNG whatever the name.

### udoc-server

#### Added

- `GET /documents/:id/layout/pages/:index.svg` answers a page as an SVG, and
  `GET /documents/:id/layout/pages.pdf` the document exported as a PDF of its
  laid-out pages, `422 unsupported` for a spreadsheet.

#### Fixed

- A request that opens a kept document, for a page image, its page count or a
  saved copy, no longer stops the server.

### udoc-demo

#### Added

- Published to npm: a demo app showcasing udoc-viewer and udoc-editor.
- `?mode=view`, `edit`, `coedit` or `ai` opens the demo in that mode.

## [0.8.1] - 2026-10-24

Built on `@docmentis/udoc-wasm` 0.8.3.

### All packages

#### Added

- Emoji draw in color, from a font's color glyphs; one the document's fonts
  lack, or sets in Segoe UI Emoji or Apple Color Emoji, draws in Noto Color
  Emoji.
- Saving a DOCX, PPTX or XLSX keeps its edits, by `"delta"`, over the
  original, or `"rewrite"`, as a new file. A delta save gave back the original
  unchanged, and a rewrite was refused.

#### Changed

- A web font one provider can't supply is ordered from the next at once,
  without laying every page out again first.
- A `.udoc` package saved by 0.8.0 from a PPTX no longer loads a slide holding
  a link that jumps to a slide by its number, and a link into another deck
  opens it a slide later.

#### Fixed

- An emoji with a variation selector, such as ❤️, draws instead of leaving a
  gap, and a keycap such as 1️⃣ draws its digit once, not twice.

### udoc-viewer and udoc-editor

#### Added

- `goToSheet(sheet)` shows a workbook's sheet, by its 0-based index or its
  name, and resolves once it has painted; `sheetCount`, `currentSheet` and the
  `currentSheet:changed` event follow it, and an overlay frame's `sheet` says
  which sheet the frame shows.
- `sheets` lists a workbook's sheets, each with its name, visibility and tab
  color; `sheets:changed` fires as each sheet's color becomes known.

#### Changed

- A page is a 0-based index throughout the API: `goToPage`, `currentPage`,
  `currentPage:changed`, `renderPage` and `PrintOptions.pages` now count from
  0, as the annotation calls and `viewport:changed` already did.
- A hidden sheet has no tab, as in Excel, where only a very hidden one had
  none; and a workbook opens on the sheet it was saved showing, or its first
  visible one, rather than always its first.
- What the reader does — a sheet tab, a page turn, an edit — runs ahead of
  background work: web fonts, thumbnails, composing ahead and loading a
  workbook's other sheets, in that order. Background work waits, too, until the
  reader has paused for a moment, so scrolling, hovering or typing never lands
  behind it. A reader waits at most for the one background step already
  running, and its paint comes before the next.
- A large worksheet paints once it has loaded, without laying out every row
  first: the rows on screen are laid out for the first paint, and the rest in
  the background while the reader pauses. Issue #2's 32,863-row sheet paints
  in about 2 seconds, from about 20.
- A large worksheet no longer lays out every row again when a web font changes
  its rows' or columns' sizes, or before a jump into it.

#### Fixed

- A page narrower than the view, which shows centred, paints once per wheel
  step and relayout, not twice.

## [0.8.0] - 2026-10-23

Built on `@docmentis/udoc-wasm` 0.8.2.

### udoc-viewer

The viewer is rebuilt on the docMentis engine's new architecture: each
document renders in a worker, on one canvas, and the viewer is built on
`@docmentis/udoc-ui`, the document UI the docMentis packages share. Its API
changed;
[API-COMPARISON.md](packages/udoc-viewer/API-COMPARISON.md) maps every export
of 0.7 to what 0.8 offers in its place.

#### Added

- Form filling in PDFs, and audio and video playback.
- TSV and PSV files, opened as CSV is, and CSV files split by semicolons.
- Annotate tools: highlight, underline, strikeout, squiggly, note, text box, 14
  standard stamps, pen, and the rectangle, ellipse, line, arrow, polygon,
  polyline and cloud shapes.
- Comment replies, edits and deletion in the Comments panel.
- `renderPage(page, { scale })`, `goToNextPage()`, `goToPrevPage()`,
  `setFullscreen()` and `isFullscreen`.
- `open`'s `password` option, for a host that holds a document's password.
- An annotation with `ephemeral: true` is shown but never saved or printed.
- `setOverlay` draws any number of overlays over the pages.
- `showDeveloperButton`: diagnostics in the toolbar's menu.

#### Changed

- `UDocViewer.create(container, options)` replaces `UDocClient.create` and
  `client.createViewer`; `load` is `open`, which takes a URL, a `Blob` or
  bytes.
- Options say what they show rather than what they hide: `showToolbar: false`
  for `hideToolbar: true`, `showDownloadButton: false` for
  `disableDownload: true`, and so on.
- Events are named for what happened, ending in `ed` or `ing`: `page:change`
  is `currentPage:changed`, `download` is `document:downloaded`, `print` is
  `document:printed`, `annotation:add` is `annotation:inserted`, and so on.
- `currentPage` keeps its name; `pageCount` counts the pages laid out so far.
- The annotation calls and events take the engine's `Annotation` type and find
  an annotation by its `name`. Their events fire for undo and redo too.
- The engine is located with `wasm: { baseUrl, cdnUrl }`, and falls back to
  jsDelivr by default. The worker starts from a blob, so a Content Security
  Policy needs `worker-src blob:`.
- `locale` and `translations` are options of `create`, and `translations`
  takes the UI's keys (`Messages`). The built-in languages are 0.7's
  eleven; a Traditional Chinese tag such as `zh-HK` now reads Traditional
  Chinese rather than Simplified.
- Supported browsers: Chrome and Edge 91, Firefox 105, Safari 16.4 and later.
- The chrome is neutral gray, and its CSS variables are renamed:
  `--udoc-color-*` for every color it uses, `--udoc-color-primary` for your
  brand color, and a fill per region such as `--udoc-toolbar-background`.

#### Removed

- ico, tga, ppm, hdr, exr and qoi images.
- The fonts panel, slide transitions and animations, and the spreadsheet's
  paged view.
- `getOutline`, `getPageText`, `getPageInfo`, `getFontUsage`, `metadata`,
  `renderThumbnail` and `renderRegion`.
- The document utilities: `compose`, `splitByOutline`, `extractImages`,
  `extractFonts`, `parseFontInfo`, `compress` and `decompress`.
- The setters for chrome the options now fix at creation, such as
  `setToolbarVisible`.

### udoc-ui, udoc-editor, udoc-node, udoc-cli and udoc-server

The first release of each.
