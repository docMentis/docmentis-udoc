# Changelog

The published packages release together, at one version: each release is
listed once, by package. Its major and minor version are those of the
`@docmentis/udoc-wasm` it is built on, and its patch is its own.

## [Unreleased]

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
