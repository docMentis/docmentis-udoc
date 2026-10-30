# Changelog

The published packages release together, at one version: each release is
listed once, by package. Its major and minor version are those of the
`@docmentis/udoc-wasm` it is built on, and its patch is its own.

## [Unreleased]

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
