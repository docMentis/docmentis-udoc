---
description: Move an app from @docmentis/udoc-viewer 0.7 to 0.8, creating the viewer in one call, updating its options and events, counting pages from 0, and restyling it with the new CSS variables.
---

# Migrate from 0.7

`@docmentis/udoc-viewer` 0.8 is built on a new architecture of the docMentis
engine: each document renders in a worker, on one canvas, and the viewer
shares its UI with the new editor. The package keeps its name, but its API
changed. This guide takes an app from 0.7 to the latest 0.8. The viewer's
[API comparison](https://github.com/docMentis/docmentis-udoc/blob/main/packages/udoc-viewer/API-COMPARISON.md)
lists every export of 0.7 beside what 0.8 has in its place.

## Update the package

```sh
npm install @docmentis/udoc-viewer@latest
```

0.8 runs in Chrome and Edge 91, Firefox 105, and Safari 16.4 or later, where
0.7 ran in Chrome 80, Firefox 80 and Safari 15.

If people should edit documents in your app, install `@docmentis/udoc-editor`
instead: it's the viewer with an edit mode added, and everything here applies
to it too.

## Create the viewer in one call

0.7 created a client, then a viewer from it:

```ts
// 0.7
const client = await UDocClient.create({ license: "YOUR-LICENSE-KEY" });
const viewer = await client.createViewer({
    container: "#viewer",
    hideToolbar: true,
    disableThumbnails: true,
});
await viewer.load("https://example.com/report.pdf");

viewer.destroy();
client.destroy();
```

0.8 has no client. `create` makes the viewer in one call and takes the
client's options and the viewer's together:

<<< @/snippets/migrate-from-0-7/create.ts

- `create` takes the container element itself, not a selector. For a viewer
  with no container, 0.7's headless mode, pass
  [`null`](/api/udoc-viewer/classes/UDocViewer#create).
- `load` is `open`. It takes a URL, a `Blob` or bytes, as before, and its
  options are `format`, `filename`, `delimiter` and `password`. A format is
  named by its file extension, an image's too: `"jpg"`, `"png"`.
- `needsPassword()` and `authenticate()` are gone. The viewer asks for a
  document's password itself, or `open` takes it as its `password` option.
- `isLoaded` is `docType !== null`.
- `destroy()` removes the UI and stops the worker the engine runs in. There's
  no client left to destroy.
- `UDocClient.version` is `UDocViewer.version`.

## Where the engine loads from

0.7's `baseUrl` named a folder holding its `worker.js` and `udoc_bg.wasm`. In
0.8 the worker is part of the viewer, and the engine's files are found without
any setting: beside your app, where your bundler puts them, or else on
jsDelivr. To serve them yourself, copy `node_modules/@docmentis/udoc-wasm/dist/`
to your server and point `wasm.baseUrl` at that folder:

<<< @/snippets/quick-start/self-hosted-engine.ts

The worker starts from a `blob:` URL, so a Content Security Policy needs
`worker-src blob:`.

## Options

Most options keep their names. Those that hid or disabled something now say
what they show, so their values flip:

| 0.7                                                                                        | 0.8                                                                                                 |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `hideToolbar: true`                                                                        | `showToolbar: false`                                                                                |
| `disableLeftPanel`, `disableRightPanel`                                                    | `showLeftPanel`, `showRightPanel`                                                                   |
| `disableThumbnails`, `disableOutline`, `disableLayers`, `disableSearch`, `disableComments` | `showThumbnailPanel`, `showOutlinePanel`, `showLayersPanel`, `showSearchPanel`, `showCommentsPanel` |
| `disableFullscreen`, `disableThemeSwitching`                                               | `showFullscreenButton`, `showThemeButton`                                                           |
| `disableDownload`, `disablePrint`                                                          | `showDownloadButton`, `showPrintButton`                                                             |
| `hideLoadingOverlay`                                                                       | `showLoadingOverlay`                                                                                |
| `zoomMode`                                                                                 | `fit` (see [Zoom](#zoom))                                                                           |
| `pageSpacing`, `spreadSpacing`                                                             | `pageGap: { horizontal, vertical }`, in points rather than pixels                                   |
| `layoutMode: "double-page"` and the rest                                                   | `layoutMode: "doublePage"` and the rest, in camel case                                              |
| `baseUrl`                                                                                  | `wasm: { baseUrl }`                                                                                 |
| `googleFonts`                                                                              | `enableGoogleFonts`                                                                                 |
| `customPageOverlay`                                                                        | `setOverlay()`, after `create` (see [Overlays](#overlays))                                          |

<<< @/snippets/migrate-from-0-7/view.ts

These keep their names and meaning: `license`, `disableTelemetry`,
`hideAttribution`, `locale`, `theme`, `scrollMode`, `zoom`, `zoomSteps`,
`dpi`, `activePanel`, `navigationScrollAlignment` and `pageRotation`. A few
defaults changed: `minZoom` is `0.02` (it was `0.1`), `maxZoom` is `16` (it was
`5`), and `searchScrollAlignment` is `"nearest"` (it was `"center"`).

These are gone:

- `thumbnailWidth`: the thumbnails fill their panel, which people can resize.
- `hideFloatingToolbar`: `viewControlsPlacement` moves page navigation and zoom
  into the toolbar or the status bar instead.
- `disableTextSelection`: `enableCopy: false` lets text be selected but not
  copied.
- `spacingMode`: `pageGap` sets the gaps' sizes.
- `enablePerformanceCounter` and `onPerformanceLog`: `showDeveloperButton`
  shows the performance counter in the toolbar's menu.
- `disableBookmarks`, `disableAttachments`, `disableFonts`,
  `enableTransitions`, `enableAnimations`, `disableUpdateCheck` and the
  `__experimental` options.

[`UDocOptions`](/api/Common/interfaces/UDocOptions) lists every option 0.8
takes.

## Zoom

`zoomMode` is `fit`, a [`Fit`](/api/Common/interfaces/Fit) of a `mode` and a
`zoomCap`, the zoom it never goes past:

| 0.7 `zoomMode`           | 0.8 `fit`                                      |
| ------------------------ | ---------------------------------------------- |
| `"fit-spread-width"`     | `{ mode: "width", zoomCap: null }`             |
| `"fit-spread-width-max"` | `{ mode: "width", zoomCap: 1 }`                |
| `"fit-spread-height"`    | `{ mode: "height", zoomCap: null }`            |
| `"fit-spread"`           | `{ mode: "both", zoomCap: null }`              |
| `"custom"`               | `{ mode: "none", zoomCap: null }`, with `zoom` |

`setZoomMode()` is `setFit()`, and `setFit(null)` goes back to each document
type's own fit: the width, up to 100%, for a PDF or a Word document, and the
whole page for slides and images. `setZoom()` drops the fit, as before.

## Pages count from 0

A page is a 0-based index everywhere: `currentPage`, `goToPage()`, the
`currentPage:changed` event, `renderPage()` and the pages `print()` takes. 0.7
counted these from 1, and its annotation calls from 0.

<<< @/snippets/migrate-from-0-7/pages.ts

- `nextPage()` and `previousPage()` are `goToNextPage()` and `goToPrevPage()`.
- `pageCount` is a PDF's or a presentation's total from the start. Other
  documents count their pages as they're laid out, so their count grows until
  the layout is done.
- `pageRotation` turns a PDF's pages, and `layoutMode` sets two pages side by
  side for a PDF or a Word document. Other documents ignore them.
- `setSpacingMode()` is `setPageGap()`, which takes the gaps' sizes in points,
  or `null` for the default gaps.

## Events

`on()` still returns the function that unsubscribes. Every event is named for
what happened:

| 0.7                                                         | 0.8                                                                     |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| `document:load`                                             | `open()` resolving                                                      |
| `error`                                                     | `open()` rejecting, with a [`UDocError`](/api/Common/classes/UDocError) |
| `page:change`                                               | `currentPage:changed`, its pages 0-based                                |
| `viewport:change`, `panel:change`, `search:change`          | `viewport:changed`, `panel:changed`, `search:changed`                   |
| `download`, `print`                                         | `document:downloaded`, `document:printed`                               |
| `annotation:add`, `annotation:update`, `annotation:remove`  | `annotation:inserted`, `annotation:updated`, `annotation:removed`       |
| `annotation:select`, `annotation:hover`, `annotation:click` | `annotation:selected`, `annotation:hovered`, `annotation:clicked`       |

`document:loading` is unchanged. `document:close`, `ui:visibilityChange` and
`font:usageChange` are gone. The annotation events now fire for undo and redo
too, and for a collaborator's changes.

## Calls that changed the UI

The calls that showed, hid or disabled parts of the UI while it ran are gone:
`setToolbarVisible`, `setFloatingToolbarVisible`, `setFullscreenEnabled`,
`setDownloadEnabled`, `setPrintEnabled`, `setThemeSwitchingEnabled`,
`setTextSelectionEnabled`, `setLeftPanelEnabled`, `setRightPanelEnabled` and
`setPanelEnabled`. Set the options for them when you create the viewer
instead. `setActiveTool()` and `activeTool` are gone too.

`setTheme()`, `openPanel()`, `closePanel()`, the zoom calls and the scroll and
layout calls work as before. `setFullscreen()` now returns a promise, which
rejects when the browser refuses, as it does outside a click or a key press.

## Annotations

The annotation calls are the same, call for call, still find an annotation by
its `name`, and still take a 0-based page. The annotation is now the engine's
[`Annotation`](/api/Common/interfaces/Annotation), which follows the PDF:

- `bounds` is `rect`, with corners `x0`, `y0`, `x1` and `y1` in PDF points.
- `type` is the key of `kind`, and what belongs to that type is under it:
  `kind.highlight.quadPoints`.
- `metadata`'s author, subject and opacity are under the type's `markup`:
  `kind.highlight.markup.author`. `contents` is on the annotation itself.
- A color is `{ components, colorSpace }`, not `{ r, g, b }`.
- A reply is an annotation of its own, naming the one it answers in its
  markup's `inReplyTo`.
- `patchPageAnnotation()` merges the patch all the way down, where 0.7 merged
  `metadata` one level deep.

<<< @/snippets/migrate-from-0-7/annotations.ts

## Search

`search(query, options)` takes a `scope` in place of a page range, and
resolves with the matches once it has found them all. A
[`SearchMatch`](/api/Common/interfaces/SearchMatch) holds its `page`, its
highlight's `quads` and the words around it in `context`, and its `location`
in place of `charOffset`. `searchNext()`, `searchPrev()`, `clearSearch()`,
`searchMatches` and `searchActiveIndex` are as before.

## Overlays

0.7's `customPageOverlay(pageIndex, container, scale)` was called once for each
page as it mounted. 0.8's `setOverlay(id, source)` takes a function called each
time the view is painted, with every page on screen, which returns the
elements to show and where. You can add any number of them, each under its own
id.

<<< @/snippets/customize-the-ui/overlay.ts

The layer still lets the pointer through, so an element that takes clicks sets
`pointer-events: auto`. [Customize the UI](./customize-the-ui#draw-over-the-pages)
explains the rest.

## Fonts

A font in `fonts` is a [`UrlFont`](/api/Common/interfaces/UrlFont): 0.7's
`typeface`, `bold` and `italic` are its `descriptor`'s `family`, `bold` and
`italic`. `registerFonts()` takes the same, or a font file's bytes, and reaches
the documents opened after it's called.

<<< @/snippets/migrate-from-0-7/fonts.ts

## Saving and printing

- `toBytes()` is [`saveToBytes()`](/api/Common/classes/UDocBase#savetobytes),
  which saves as the format the document was opened from, or as the one it
  names: `saveToBytes({ format: "pdf" })`.
- `download()` is as before.
- `print()` takes a [`PrintOptions`](/api/Common/interfaces/PrintOptions), its
  pages a list of 0-based indices.

## Words

`locale` works as before, with the same eleven languages; a Traditional
Chinese tag such as `zh-HK` now reads Traditional Chinese. `translations` is an
option of `create`, and its keys are the UI's own, many of them new. Check
yours against [`Messages`](/api/Common/interfaces/Messages).

## Styling

The UI's root element is `.udoc-ui-root`, where it was `.udoc-viewer-root`,
and in the dark theme it also has `.udoc-ui-dark`, where it had
`.udoc-viewer-dark`. The CSS variables are renamed:

| 0.7                                                                     | 0.8                                                   |
| ----------------------------------------------------------------------- | ----------------------------------------------------- |
| `--udoc-primary`                                                        | `--udoc-color-primary`                                |
| `--udoc-text-on-primary`                                                | `--udoc-color-on-primary`                             |
| `--udoc-bg-viewport`                                                    | `--udoc-canvas-background`                            |
| `--udoc-bg-panel`, `--udoc-bg-panel-tabs`                               | `--udoc-panel-background`                             |
| `--udoc-bg-surface`                                                     | `--udoc-color-surface-container-high`                 |
| `--udoc-bg-overlay`                                                     | `--udoc-color-scrim`                                  |
| `--udoc-text-primary`                                                   | `--udoc-color-on-surface`                             |
| `--udoc-text-secondary`, `--udoc-text-muted`, `--udoc-text-placeholder` | `--udoc-color-on-surface-variant`                     |
| `--udoc-text-disabled`                                                  | `--udoc-state-disabled-opacity`                       |
| `--udoc-border`, `--udoc-border-light`                                  | `--udoc-color-outline-variant`                        |
| `--udoc-border-input`                                                   | `--udoc-color-outline`                                |
| `--udoc-search-highlight`, `--udoc-search-highlight-active`             | `--udoc-canvas-search`, `--udoc-canvas-search-active` |
| `--udoc-text-selection`                                                 | `--udoc-canvas-selection`                             |
| `--udoc-scrollbar-thumb`, `--udoc-scrollbar-thumb-hover`                | The same                                              |
| `--udoc-error-text`                                                     | `--udoc-color-error`                                  |

`--udoc-primary-hover` and `--udoc-primary-focus-ring` have no counterpart: a
control's hover and pressed looks are opacities of its own color, and the
focus ring is the primary color. Nor do `--udoc-bg-input`, the shadows, the
error box's background and border, or the progress bar's colors.

The UI is neutral gray now, its primary color near black in the light theme.
To keep 0.7's blue:

```css
.udoc-ui-root {
    --udoc-color-primary: #0066cc;
    --udoc-color-on-primary: #ffffff;
}

.udoc-ui-root.udoc-ui-dark {
    --udoc-color-primary: #4da6ff;
    --udoc-color-on-primary: #ffffff;
}
```

[Customize the UI](./customize-the-ui#colors) lists every variable.

## Removed

These have no counterpart in 0.8:

- The document utilities: `compose`, `splitByOutline`, `extractImages`,
  `extractFonts`, `parseFontInfo`, `compress` and `decompress`.
- `getOutline`, `getPageText`, `getPageInfo`, `getLayoutPage`, `getFontUsage`,
  `metadata`, `renderThumbnail`, `renderRegion`, `getDocumentId`,
  `initializeFromDocId` and `performanceCounter`.
- The client's `license`, `hasFeature`, `getWorkerClient`,
  `getRenderCacheStats`, `getWasmMemoryBytes`, `onOOM` and `assetUrl`.
- The bookmarks, attachments and fonts panels.
- ICO, TGA, PPM, PGM, PBM, HDR, EXR and QOI images.

## What's new

0.8 does a good deal 0.7 didn't: it opens Word templates, Markdown, HTML,
email, video and audio, and web pages; it fills in PDF forms; it plays
presentations, and PDFs, as slide shows with the presenter view; it saves and
exports documents; and with `@docmentis/udoc-editor`, people edit them, on
their own or together. [Supported formats](./supported-formats) covers what
opens and what can be done with it, and the
[changelog](https://github.com/docMentis/docmentis-udoc/blob/main/CHANGELOG.md)
every release since 0.8.0.
