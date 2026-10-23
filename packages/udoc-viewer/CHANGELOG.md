# Changelog

## [0.8.0] - Unreleased

The viewer is rebuilt on the docMentis engine's new architecture: each
document renders in a worker, on one canvas, and the viewer is built on
`@docmentis/udoc-ui`, the document UI the docMentis packages share. Its API
changed;
[API-COMPARISON.md](API-COMPARISON.md) maps every export of 0.7 to what 0.8
offers in its place.

### Added

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

### Changed

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

### Removed

- ico, tga, ppm, hdr, exr and qoi images.
- The fonts panel, slide transitions and animations, and the spreadsheet's
  paged view.
- `getOutline`, `getPageText`, `getPageInfo`, `getFontUsage`, `metadata`,
  `renderThumbnail` and `renderRegion`.
- The document utilities: `compose`, `splitByOutline`, `extractImages`,
  `extractFonts`, `parseFontInfo`, `compress` and `decompress`.
- The setters for chrome the options now fix at creation, such as
  `setToolbarVisible`.
