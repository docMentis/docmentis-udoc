# API Comparison

Every export of the legacy `@docmentis/udoc-viewer` 0.7.20, beside what the new
`@docmentis/udoc-viewer` offers in its place.

- **Legacy** — `docmentis-udoc-viewer` at `17b22f4`, read from its built
  declarations (`packages/udoc-viewer/dist/src/*.d.ts`), one row per exported
  member.
- **New** — this repo's `UDocViewer` ([index.ts](src/index.ts)), on udoc-ui's
  `UDocBase` ([base.ts](../udoc-ui/src/base.ts)).

When a commit closes a gap or changes a counterpart, it updates the row. Where a
status takes more than a few words, a note under the table says the rest.

| Status            | Meaning for an embedder                                        |
| ----------------- | -------------------------------------------------------------- |
| same              | unchanged: name, signature and meaning                         |
| renamed           | the same thing under another name                              |
| different shape   | a counterpart exists; the call or its values change            |
| not built         | the viewer has the UI slot or a placeholder, nothing behind it |
| not in the viewer | no counterpart                                                 |
| dropped           | no counterpart, by decision: none is planned                   |

## Construction — `UDocClient`

| Legacy                             | New                                      | Status                                     |
| ---------------------------------- | ---------------------------------------- | ------------------------------------------ |
| `UDocClient.create(options?)`      | `UDocViewer.create(container, options?)` | different shape: one call, no client       |
| `static version`                   | `UDocViewer.version`                     | renamed: on the viewer                     |
| `get license(): LicenseInfo`       | —                                        | dropped                                    |
| `hasFeature(feature)`              | —                                        | dropped                                    |
| `registerFonts(fonts)`             | `registerFonts(fonts)`                   | different shape: bytes or a `UrlFont`      |
| `enableGoogleFonts()`              | `enableGoogleFonts` option               | different shape: an option, default `true` |
| `createViewer(options?)`           | `UDocViewer.create(container, options?)` | different shape                            |
| `compose(compositions)`            | —                                        | dropped                                    |
| `splitByOutline(source, options?)` | —                                        | dropped                                    |
| `extractImages(source, options?)`  | —                                        | dropped                                    |
| `extractFonts(source)`             | —                                        | dropped                                    |
| `parseFontInfo(data)`              | —                                        | dropped                                    |
| `compress(source)`                 | —                                        | dropped                                    |
| `decompress(source)`               | —                                        | dropped                                    |
| `destroy()`                        | `destroy()` (on the viewer)              | different shape: no client to destroy      |
| `getWorkerClient()`                | —                                        | dropped                                    |
| `getRenderCacheStats()`            | —                                        | dropped                                    |
| `getWasmMemoryBytes()`             | —                                        | dropped                                    |
| `onOOM(callback)`                  | —                                        | dropped                                    |
| `assetUrl(file, baseUrl, version)` | —                                        | dropped                                    |

- `version` — there is no client; the viewer carries it.
- `registerFonts` — each font is a file's bytes, which name their own family
  and faces, or a `UrlFont` (see `FontEntry`); it reaches documents opened
  after the call, not the one already open.

### `ClientOptions`

| Legacy               | New                 | Status                                |
| -------------------- | ------------------- | ------------------------------------- |
| `license`            | `license`           | same                                  |
| `baseUrl`            | `wasm.baseUrl`      | different shape: under `wasm`         |
| `locale`             | `locale`            | same                                  |
| `__experimentalGpu`  | —                   | dropped                               |
| `googleFonts`        | `enableGoogleFonts` | renamed                               |
| `fonts`              | `fonts`             | different shape: bytes or a `UrlFont` |
| `disableTelemetry`   | `disableTelemetry`  | same: honored only with a license     |
| `disableUpdateCheck` | —                   | dropped: no update check              |

- `baseUrl` — a directory laid out as `@docmentis/udoc-wasm`'s `dist/`. `wasm` also
  takes `cdnUrl`, by default jsDelivr's copy of the engine the viewer was built
  against.
- `locale` — a BCP 47 tag such as `"zh-CN"`, the browser's by default. The
  viewer ships legacy's eleven languages; a tag with no pack of its own reads
  the one in its language and script (`zh-HK` Traditional Chinese, `pt-PT`
  Brazilian Portuguese), then English. `translations` supplies any other
  language.

## `ViewerOptions`

| Legacy                             | New                                | Status                                             |
| ---------------------------------- | ---------------------------------- | -------------------------------------------------- |
| `container`                        | `create`'s `container`             | different shape: an element, no selector           |
| `scrollMode`                       | `scrollMode`                       | same                                               |
| `layoutMode`                       | `layoutMode`                       | different shape: camelCase; PDF and Word only      |
| `zoomMode`                         | `fit`                              | different shape: a `Fit` (see `ZoomMode`)          |
| `zoom`                             | `zoom`                             | same: under `fit` mode `"none"`                    |
| `zoomSteps`                        | `zoomSteps`                        | same                                               |
| `pageSpacing`                      | `pageGap.horizontal`               | different shape: points, not pixels                |
| `spreadSpacing`                    | `pageGap.vertical`                 | different shape: points, not pixels                |
| `navigationScrollAlignment`        | `navigationScrollAlignment`        | same                                               |
| `searchScrollAlignment`            | `searchScrollAlignment`            | same                                               |
| `thumbnailWidth`                   | —                                  | dropped: thumbnails fill the resizable panel       |
| `activePanel`                      | `activePanel`                      | same                                               |
| `dpi`                              | `dpi`                              | same: CSS px per physical inch, default `96`       |
| `enablePerformanceCounter`         | —                                  | dropped                                            |
| `onPerformanceLog`                 | —                                  | dropped                                            |
| `hideAttribution`                  | `hideAttribution`                  | same: honored only with a license                  |
| `hideLoadingOverlay`               | `showLoadingOverlay`               | different shape: inverse, default `true`; licensed |
| `hideToolbar`                      | `showToolbar`                      | different shape: inverse, default `true`           |
| `hideFloatingToolbar`              | —                                  | dropped                                            |
| `disableFullscreen`                | `showFullscreenButton`             | different shape: inverse, default `true`           |
| `disableLeftPanel`                 | `showLeftPanel`                    | different shape: inverse, default `true`           |
| `disableRightPanel`                | `showRightPanel`                   | different shape: inverse, default `true`           |
| `disableThumbnails`                | `showThumbnailPanel`               | different shape: inverse, default `true`           |
| `disableOutline`                   | `showOutlinePanel`                 | different shape: inverse, default `true`           |
| `disableBookmarks`                 | —                                  | not in the viewer                                  |
| `disableLayers`                    | `showLayersPanel`                  | different shape: inverse, default `true`           |
| `disableAttachments`               | —                                  | not in the viewer yet: the panel isn't built       |
| `disableFonts`                     | —                                  | not in the viewer                                  |
| `disableSearch`                    | `showSearchPanel`                  | different shape: inverse, default `true`           |
| `disableComments`                  | `showCommentsPanel`                | different shape: inverse, default `true`           |
| `theme`                            | `theme`                            | same                                               |
| `disableThemeSwitching`            | `showThemeButton`                  | different shape: inverse, default `true`           |
| `disableTextSelection`             | —                                  | dropped                                            |
| `disableDownload`                  | `showDownloadButton`               | different shape: inverse, default `true`           |
| `disablePrint`                     | `showPrintButton`                  | different shape: inverse, default `true`           |
| `pageRotation`                     | `pageRotation`                     | same: PDF and Word only                            |
| `spacingMode`                      | —                                  | not in the viewer: `pageGap` sets the sizes        |
| `minZoom`                          | `minZoom`                          | same: default `0.02` (legacy `0.1`)                |
| `maxZoom`                          | `maxZoom`                          | same: default `16` (legacy `5`)                    |
| `disableViewTools`                 | —                                  | dropped                                            |
| `disableAnnotateTools`             | —                                  | dropped                                            |
| `__experimentalDisableMarkupTools` | —                                  | dropped                                            |
| `enableTransitions`                | —                                  | dropped                                            |
| `enableAnimations`                 | —                                  | dropped                                            |
| `locale`                           | `locale`                           | same: one option on `create`                       |
| `translations`                     | `translations`                     | different shape: the viewer's own keys             |
| `customPageOverlay`                | `setOverlay(id, source, options?)` | different shape: many, set after `create`          |

- `locale`, `translations` — see `ClientOptions`. `translations` is a
  `Partial<Messages>`: legacy's keys where the viewer shows the same string
  (`toolbar.search`, `zoom.fitWidth`, `password.title`), its own elsewhere.

## `UDocViewer`

### Lifecycle and document

| Legacy                         | New                             | Status                                            |
| ------------------------------ | ------------------------------- | ------------------------------------------------- |
| `constructor(workerClient, …)` | —                               | not in the viewer: `create` builds one            |
| `load(source, options?)`       | `open(source, options?)`        | different shape: renamed; `format` a `FileFormat` |
| `close()`                      | `close()`                       | same                                              |
| `destroy()`                    | `destroy()`                     | same                                              |
| `get isLoaded`                 | `docType !== null`              | different shape                                   |
| `needsPassword()`              | —                               | dropped                                           |
| `authenticate(password)`       | `open`'s `password`             | different shape: given at open                    |
| `get pageCount`                | `pageCount`                     | different shape: the pages composed so far        |
| `get metadata`                 | —                               | dropped                                           |
| `get performanceCounter`       | —                               | dropped                                           |
| `getDocumentId()`              | —                               | dropped                                           |
| `initializeFromDocId(docId)`   | —                               | dropped                                           |
| `toBytes()`                    | `saveToBytes(format, strategy)` | different shape: names format and strategy        |
| `download(filename?)`          | `download(filename?)`           | same: saves as edited, in its source format       |
| `print(options?)`              | `print(options?)`               | different shape: takes a `PrintOptions`           |

- `load` — the source is a URL, which the viewer fetches, a `Blob` (legacy's
  `File` is one), or bytes; `options` holds `format`, `filename` and
  `password`, the format a `FileFormat`, with images named by codec.
- `pageCount` — it grows until the compose completes.

### Reads

| Legacy                               | New                          | Status                            |
| ------------------------------------ | ---------------------------- | --------------------------------- |
| `getOutline()`                       | —                            | dropped                           |
| `getFontUsage()`                     | —                            | dropped                           |
| `getPageInfo(page)`                  | —                            | dropped                           |
| `getLayoutPage(page)`                | —                            | dropped                           |
| `getPageText(page)`                  | —                            | dropped                           |
| `renderPage(page, options?)`         | `renderPage(page, options?)` | different shape: an `ImageBitmap` |
| `renderThumbnail(page, options?)`    | —                            | dropped                           |
| `renderRegion(page, rect, options?)` | —                            | dropped                           |

- `renderPage` — `options` holds only `scale`, default `1` (72 DPI); the image
  is always an `ImageBitmap`, where legacy also gave `ImageData`, a `Blob` or a
  data URL.

### Annotations

Legacy's calls, call for call — a page by its 0-based index, an annotation by
its `name` (`/NM`), which a save writes and a reopen reads back — over the
engine's own `Annotation` in place of legacy's
([page-annotations.ts](../udoc-ui/src/app/page-annotations.ts)). Every
write needs the session's `annotation` feature, which the license or, with
none, the permit grants
(the engine's Wasm Licensing design).

| Legacy                                         | New                                            | Status                                     |
| ---------------------------------------------- | ---------------------------------------------- | ------------------------------------------ |
| `getPageAnnotations(page)`                     | `getPageAnnotations(page)`                     | different shape: the engine's `Annotation` |
| `addPageAnnotation(page, annotation)`          | `addPageAnnotation(page, annotation)`          | different shape: the engine's `Annotation` |
| `addPageAnnotations(page, annotations)`        | `addPageAnnotations(page, annotations)`        | different shape: the engine's `Annotation` |
| `updatePageAnnotation(page, name, annotation)` | `updatePageAnnotation(page, name, annotation)` | different shape: the engine's `Annotation` |
| `updatePageAnnotations(page, updates)`         | `updatePageAnnotations(page, updates)`         | different shape: the engine's `Annotation` |
| `patchPageAnnotation(page, name, patch)`       | `patchPageAnnotation(page, name, patch)`       | different shape: the engine's `Annotation` |
| `patchPageAnnotations(page, patches)`          | `patchPageAnnotations(page, patches)`          | different shape: the engine's `Annotation` |
| `removePageAnnotation(page, name)`             | `removePageAnnotation(page, name)`             | different shape: the engine's `Annotation` |

- `Annotation` — the model's, as `udoc.d.ts` declares it: `rect` (`x0`, `y0`,
  `x1`, `y1`) for `bounds`; the subtype a key of `kind`, its entries under it
  (`kind.highlight.quadPoints`, the quads in the file's order); the markup
  entries (`author`, `subject`, `opacity`, …) under `kind.*.markup`; `contents`
  on the annotation; a colour as `{ components, colorSpace }`. Every subtype a
  PDF holds, popups and widgets too. A reply is an annotation of its own,
  naming the one it answers in its markup's `inReplyTo`, not nested in a
  `replies`.
- A read carries no appearance (`null`); one written without one has it
  generated, but a stamp updated without one keeps its picture while its icon
  and colour stay as they were.
- `patchPageAnnotation` merges an object field all the way down, where
  legacy's merged `metadata` one level; `id` and `name` stay the annotation's.
- `addPageAnnotation` assigns an `id` and, as legacy, a UUID `name` where
  they're missing, and leaves the selection as it was.
- `removePageAnnotation` removes what answers the annotation — its replies,
  state notes and group members — and its popup with it.
- `ephemeral: true` — shown, never saved or printed, as legacy's.

### Navigation

| Legacy                                   | New                                      | Status                                                 |
| ---------------------------------------- | ---------------------------------------- | ------------------------------------------------------ |
| `get currentPage`                        | `currentPage`                            | different shape: a 0-based index                       |
| `goToPage(page)`                         | `goToPage(page)`                         | different shape: a 0-based index                       |
| `goToDestination(destination, options?)` | `goToDestination(destination, options?)` | different shape: the engine's `Destination`; a promise |
| `nextPage()`                             | `goToNextPage()`                         | different shape: renamed; a spread in spread scrolling |
| `previousPage()`                         | `goToPrevPage()`                         | different shape: renamed; a spread in spread scrolling |

### Zoom and view

| Legacy                                    | New                                       | Status                                        |
| ----------------------------------------- | ----------------------------------------- | --------------------------------------------- |
| `get zoom`                                | `zoom`                                    | same                                          |
| `get zoomMode`                            | `fit`                                     | different shape: a `Fit`                      |
| `zoomIn()`                                | `zoomIn()`                                | same                                          |
| `zoomOut()`                               | `zoomOut()`                               | same                                          |
| `setZoom(zoom)`                           | `setZoom(zoom)`                           | same: drops the fit                           |
| `setZoomMode(mode)`                       | `setFit(fit)`                             | different shape: a `Fit`                      |
| `setMinZoom(zoom)`                        | `setMinZoom(zoom)`                        | same                                          |
| `setMaxZoom(zoom)`                        | `setMaxZoom(zoom)`                        | same                                          |
| `get viewMode` / `getViewMode()`          | —                                         | not in the viewer: a sheet is always a grid   |
| `setViewMode(mode)`                       | —                                         | not in the viewer                             |
| `get scrollMode`                          | `scrollMode`                              | same                                          |
| `setScrollMode(mode)`                     | `setScrollMode(mode)`                     | same                                          |
| `get layoutMode`                          | `layoutMode`                              | different shape: camelCase; PDF and Word only |
| `setLayoutMode(mode)`                     | `setLayoutMode(mode)`                     | different shape: camelCase; PDF and Word only |
| `get pageRotation`                        | `pageRotation`                            | same: PDF and Word only                       |
| `setPageRotation(rotation)`               | `setPageRotation(rotation)`               | same: PDF and Word only                       |
| `get spacingMode`                         | `pageGap`                                 | different shape: the gaps' sizes              |
| `setSpacingMode(mode)`                    | `setPageGap(gap)`                         | different shape: the gaps' sizes              |
| `get navigationScrollAlignment`           | `navigationScrollAlignment`               | same                                          |
| `setNavigationScrollAlignment(alignment)` | `setNavigationScrollAlignment(alignment)` | same                                          |
| `get searchScrollAlignment`               | `searchScrollAlignment`                   | same                                          |
| `setSearchScrollAlignment(alignment)`     | `setSearchScrollAlignment(alignment)`     | same                                          |

- `setZoomMode` — every later document opens by the fit too; `null` restores
  each doc type's own.
- `viewMode` — `paged` or `continuous`.
- `spacingMode` — `pageGap` sets each gap's size in document points, not which
  gaps show; `null` restores the built-in gaps.

### Chrome

| Legacy                               | New                         | Status                             |
| ------------------------------------ | --------------------------- | ---------------------------------- |
| `get isFullscreen`                   | `isFullscreen`              | same                               |
| `setFullscreen(fullscreen)`          | `setFullscreen(fullscreen)` | different shape: returns a promise |
| `setFullscreenEnabled(enabled)`      | —                           | dropped                            |
| `setToolbarVisible(visible)`         | —                           | dropped                            |
| `setFloatingToolbarVisible(visible)` | —                           | dropped                            |
| `setDownloadEnabled(enabled)`        | —                           | dropped                            |
| `setPrintEnabled(enabled)`           | —                           | dropped                            |
| `get theme`                          | `theme`                     | same                               |
| `setTheme(theme)`                    | `setTheme(theme)`           | same                               |
| `setThemeSwitchingEnabled(enabled)`  | —                           | dropped                            |
| `setTextSelectionEnabled(enabled)`   | —                           | dropped                            |
| `get activeTool`                     | —                           | dropped                            |
| `setActiveTool(tool)`                | —                           | dropped                            |

- `setFullscreen` — the browser enters fullscreen only in answer to a user
  gesture; the promise rejects when it refuses, where legacy failed silently.

### Panels

| Legacy                                              | New                | Status                |
| --------------------------------------------------- | ------------------ | --------------------- |
| `setLeftPanelEnabled(enabled)`                      | —                  | not in the viewer     |
| `setRightPanelEnabled(enabled)`                     | —                  | not in the viewer     |
| `setPanelEnabled(panel, enabled)`                   | —                  | not in the viewer     |
| `openPanel(panel)`                                  | `openPanel(panel)` | same                  |
| `closePanel()`                                      | `closePanel()`     | same                  |
| panels `thumbnail`, `outline`, `layers`, `comments` | the same tabs      | same                  |
| panels `bookmarks`, `fonts`                         | —                  | not in the viewer     |
| panel `attachments`                                 | —                  | not in the viewer yet |
| panel `search`                                      | the same tab       | same                  |

### Search

| Legacy                                  | New                                     | Status                                     |
| --------------------------------------- | --------------------------------------- | ------------------------------------------ |
| `search(query, options?)`               | `search(query, options?)`               | different shape: a `scope` for `pageRange` |
| `searchNext(options?)`                  | `searchNext(options?)`                  | same                                       |
| `searchPrev(options?)`                  | `searchPrev(options?)`                  | same                                       |
| `clearSearch()`                         | `clearSearch()`                         | same                                       |
| `get searchMatches`                     | `get searchMatches`                     | different shape: `SearchMatch` changed     |
| `get searchActiveIndex`                 | `get searchActiveIndex`                 | same                                       |
| `setSearchActiveIndex(index, options?)` | `setSearchActiveIndex(index, options?)` | same                                       |
| —                                       | `searchMatchSelection(match)`           | new: the selection over a match's text     |

- `search` — the `scope` is the doc type's pages, slides or sheet; the call
  resolves with the matches.
- `searchMatchSelection` — its selection is for `setSelection`.

### Events

| Legacy                | New                   | Status                                              |
| --------------------- | --------------------- | --------------------------------------------------- |
| `on(event, handler)`  | `on(event, handler)`  | same: the event names differ                        |
| `off(event, handler)` | `off(event, handler)` | same: the event names differ                        |
| `document:loading`    | `document:loading`    | same                                                |
| `document:load`       | `open` resolving      | different shape                                     |
| `document:close`      | —                     | dropped                                             |
| `download`            | `document:downloaded` | renamed                                             |
| `print`               | `document:printed`    | renamed                                             |
| `error`               | `open` rejecting      | different shape: with the `UDocError`               |
| `page:change`         | `currentPage:changed` | renamed: its pages are 0-based indices              |
| `viewport:change`     | `viewport:changed`    | renamed                                             |
| `panel:change`        | `panel:changed`       | renamed                                             |
| `ui:visibilityChange` | —                     | dropped                                             |
| `font:usageChange`    | —                     | dropped                                             |
| `search:change`       | `search:changed`      | renamed                                             |
| `annotation:add`      | `annotation:inserted` | different shape: renamed; the engine's `Annotation` |
| `annotation:update`   | `annotation:updated`  | different shape: renamed; the engine's `Annotation` |
| `annotation:remove`   | `annotation:removed`  | different shape: renamed; the engine's `Annotation` |
| `annotation:select`   | `annotation:selected` | different shape: renamed; the engine's `Annotation` |
| `annotation:hover`    | `annotation:hovered`  | different shape: renamed; the engine's `Annotation` |
| `annotation:click`    | `annotation:clicked`  | different shape: renamed; the engine's `Annotation` |

- Every event's name ends in `ed` or `ing`.
- `document:printed` — fires once the pages are handed to the browser's print
  dialog, so not for a print cancelled while its pages render.
- `annotation:inserted` / `updated` / `removed` — fire for every change to the
  document's annotations, an undo's, a redo's and a collaborator's too, one
  event per annotation, a reply's included.

## Exported types

| Legacy                                  | New                                | Status                                             |
| --------------------------------------- | ---------------------------------- | -------------------------------------------------- |
| `ClientOptions`, `ViewerOptions`        | `UDocViewerOptions`                | different shape: the option tables                 |
| `ThemeMode`                             | `ThemeMode`                        | same                                               |
| `ViewMode`                              | —                                  | not in the viewer                                  |
| `DocumentFormat`                        | `FileFormat`                       | different shape: `tsv` and `psv`, images per codec |
| `LoadOptions`, `LoadProgress`           | `OpenOptions`, the event's payload | different shape                                    |
| `ScrollMode`                            | `ScrollMode`                       | same                                               |
| `LayoutMode`                            | `LayoutMode`                       | different shape: camelCase values                  |
| `ZoomMode`                              | `Fit`, `FitMode`                   | different shape                                    |
| `SpacingMode`                           | `PageGap`                          | different shape: the gaps' sizes                   |
| `ScrollAlignment`                       | `ScrollAlignment`                  | same                                               |
| `PageRotation`                          | —                                  | not in the viewer: no exported type                |
| `PanelTab`                              | `PanelTab`                         | different shape: no `bookmarks` or `fonts`         |
| `LeftPanelTab`, `RightPanelTab`         | —                                  | not in the viewer: no exported type                |
| `ActiveTool`, `ToolKind`, `SubTool`     | —                                  | not in the viewer: no exported type                |
| `AnnotateSubTool`, `MarkupSubTool`      | —                                  | not in the viewer: no exported type                |
| `Annotation`                            | `Annotation`                       | different shape: the engine's model                |
| `SearchMatch`                           | `SearchMatch`                      | different shape                                    |
| `Destination`                           | `Destination`                      | different shape: the engine's                      |
| `OutlineItem`                           | —                                  | dropped                                            |
| `DestinationDisplay`                    | `DestinationView`                  | different shape: the engine's, per PDF view        |
| `RenderOptions`, `RenderedPage`         | `RenderPageOptions`                | different shape: an `ImageBitmap`                  |
| `DocumentMetadata`                      | —                                  | dropped                                            |
| `ViewerEventMap`                        | `UDocEvents`                       | renamed: the events differ                         |
| `UIComponent`                           | —                                  | not in the viewer                                  |
| `PrintDialogResult`, `PrintPageRange`   | `PrintOptions`                     | different shape: a page list                       |
| `PrintQuality`                          | `PrintQuality`                     | same                                               |
| `TranslationKeys`, `I18n`, `createI18n` | `Messages`, `I18n`, `createI18n`   | different shape: the viewer's own keys             |
| `DocumentSource`, `Pick`                | —                                  | dropped                                            |
| `Composition`, `ComposePick`            | —                                  | dropped                                            |
| `LicenseInfo`, `LicenseResult`          | —                                  | dropped                                            |
| `FontEntry`                             | `UrlFont`, `FontDescriptor`        | different shape                                    |
| `FontInfo`                              | —                                  | dropped                                            |
| `FontSource`                            | —                                  | not in the viewer                                  |
| `ResolvedFontInfo`, `FontUsageEntry`    | —                                  | dropped                                            |
| `CustomPageOverlayRenderer`             | `OverlaySource`, `OverlayOptions`  | different shape                                    |
| `PageInfo`                              | —                                  | dropped                                            |
| `WorkerRequest`, `WorkerResponse`       | —                                  | dropped                                            |
| `RenderCacheStats`, `RenderCacheBucket` | —                                  | dropped                                            |
| `IPerformanceCounter`, `Performance*`   | —                                  | dropped                                            |

- `UDocViewerOptions` — the same type as udoc-ui's `UDocOptions`.
- `ZoomMode` — `fit-spread-width`, `fit-spread-height`, `fit-spread` and
  `custom` are the `FitMode`s `width`, `height`, `both` and `none`;
  `fit-spread-width-max` is `width` with a `zoomCap` of `1`.
- `SpacingMode` — `PageGap` holds the gaps' sizes, not which gaps show.
- `SearchMatch` — `page`, `plane`, page-local `quads` and `context`; `location`
  in place of `charOffset`.
- `PrintPageRange` — `PrintOptions` lists the pages, as 0-based indices.
- `FontEntry` — its `typeface`, `bold` and `italic` are a `UrlFont`'s
  `descriptor`, a `FontDescriptor` of `family`, `bold` and `italic`; `url` is
  the same, and an optional `scripts` narrows which text asks for it.
- `CustomPageOverlayRenderer` — the overlay types also include `OverlayFrame`
  and `OverlayItem`.
- `Performance*` — `PerformanceEventType`, `PerformanceEventContext`,
  `PerformanceLogEntry`, `PerformanceLogCallback`, `PerformanceEventStats` and
  `PerformanceCounterSummary`.

## Only in the new viewer

What the new viewer offers that the legacy one has no row for.

| New                                                | What it is                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| `openRemote(url)`                                  | a document a udoc server keeps, parts fetched on demand             |
| `openLocal(id)`                                    | a document shared by the instances in one page                      |
| `UDocViewer.startLocalCollaborationService`        | as above: the service that shares it                                |
| `saveToPackage(version?)`                          | the document as a `.udoc` package                                   |
| `requestRemoteCopy(strategy)`                      | a save the server holding the document makes                        |
| `requestRemoteCheckpoint()`                        | as above                                                            |
| `execute(command)`, `undo()`, `redo()`             | editing                                                             |
| `mintId()`                                         | editing                                                             |
| `selection()`, `setSelection(selection)`           | id-addressed selection                                              |
| `selectObjects(page, ids)`                         | id-addressed selection                                              |
| `selectedObjectIds()`, `clearSelection()`          | id-addressed selection                                              |
| `snapshot()`, `versionVector()`                    | CRDT sync with a peer                                               |
| `patchSince(peer)`, `merge(data)`                  | CRDT sync with a peer                                               |
| `opaquePartsSince(peer)`, `mergeOpaqueParts(data)` | CRDT sync with a peer                                               |
| `presence()`, `mergePresence(data)`                | CRDT sync with a peer                                               |
| `setUserInfo(name)`, `leaveCollaboration()`        | collaboration                                                       |
| `joinRemoteCollaboration(url, name)`               | collaboration                                                       |
| `joinLocalCollaboration(id, name)`                 | collaboration                                                       |
| `docType`, `sourceFormat`                          | the open document's type, and the format it saves to                |
| `setViewControlsPlacement(placement)`              | where page nav and zoom dock                                        |
| option `viewControlsPlacement`                     | the starting chrome                                                 |
| option `onLinkClick`                               | opens the URL of a clicked link or outline item                     |
| option `googleFontFamilies`                        | the Google font families offered, in place of `GOOGLE_FONT_CATALOG` |
| option `showDeveloperButton`                       | the menu's Developer item: performance counter, repaint area        |
| `setDpi(dpi)`, `dpi`                               | the screen's CSS px per inch, calibrated while the viewer runs      |
| `activePanel`                                      | the open side panel, which `panel:changed` reports                  |
| `openNotes()`, `closeNotes()`, `notesOpen`         | a deck's speaker notes, in a pane under the slides                  |
| option `showNotes`, event `notes:changed`          | as above                                                            |
| `removeOverlay(id)`                                | drop an overlay, the built-ins included                             |
| event `document:edited`                            |                                                                     |
| event `selection:changed`                          |                                                                     |
| events `collaboration:*`                           | `joined`, `interrupted`, `failed`, `left`                           |
| form filling, audio and video playback             | UI with no legacy counterpart                                       |
| Annotate tools: note, text box, stamp, cloud       | UI with no legacy counterpart                                       |
