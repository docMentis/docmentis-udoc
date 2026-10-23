# @docmentis/udoc-viewer

A document viewer for the web. It opens PDF, Word, PowerPoint and Excel files
and images in the page, rendered by the docMentis engine — WebAssembly, on a
canvas, in a worker — with thumbnails, outline, search, comments, annotation,
print and download. It works with any framework, or none.

Upgrading from 0.7? See [Migrating from 0.7](#migrating-from-07).

## Supported formats

| Kind     | Formats                         |
| -------- | ------------------------------- |
| Document | PDF, DOCX, PPTX, XLSX           |
| Image    | JPEG, PNG, GIF, BMP, TIFF, WebP |
| Vector   | SVG, EMF, WMF                   |

A format is detected from the file's content, never its name.

## Quick start

```sh
npm install @docmentis/udoc-viewer
```

```ts
import { UDocViewer } from "@docmentis/udoc-viewer";

const viewer = await UDocViewer.create(document.getElementById("viewer")!);
await viewer.open("https://example.com/report.pdf");
```

The viewer fills the element it's given, so give that element a height.
`open` takes a URL, a `Blob` (a `File` is one) or the bytes, and options:

```ts
await viewer.open(file, {
    filename: "report.pdf", // what a download is named; default the File's or URL's own
    password: "secret", // for a protected PDF; without it the viewer asks the user
    format: "pdf", // only for bytes detection gets wrong
    delimiter: ";", // only for a CSV whose delimiter detection gets wrong
});
```

`open` rejects with a `UDocError` when the document doesn't open; the viewer
shows why as well. `viewer.destroy()` tears the viewer and its worker down.

### React

```tsx
import { useEffect, useRef } from "react";
import { UDocViewer } from "@docmentis/udoc-viewer";

export function Viewer({ src }: { src: string }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        let viewer: UDocViewer | undefined;
        let gone = false;
        void UDocViewer.create(ref.current!).then((created) => {
            if (gone) return created.destroy();
            viewer = created;
            void viewer.open(src);
        });
        return () => {
            gone = true;
            viewer?.destroy();
        };
    }, [src]);
    return <div ref={ref} style={{ height: "100vh" }} />;
}
```

### Without a bundler

The packages are plain ES modules. A page with no build step maps them to a
CDN with an import map; keep the versions in step — `@docmentis/udoc-ui` at the
viewer's version, `@docmentis/udoc-wasm` at the version udoc-ui depends on:

```html
<script type="importmap">
    {
        "imports": {
            "@docmentis/udoc-viewer": "https://cdn.jsdelivr.net/npm/@docmentis/udoc-viewer@0.8.0/dist/index.js",
            "@docmentis/udoc-ui": "https://cdn.jsdelivr.net/npm/@docmentis/udoc-ui@0.8.0/dist/index.js",
            "@docmentis/udoc-ui/internal": "https://cdn.jsdelivr.net/npm/@docmentis/udoc-ui@0.8.0/dist/internal.js",
            "@docmentis/udoc-wasm/error": "https://cdn.jsdelivr.net/npm/@docmentis/udoc-wasm@0.8.1/dist/error.js",
            "@docmentis/udoc-wasm/font-fulfill": "https://cdn.jsdelivr.net/npm/@docmentis/udoc-wasm@0.8.1/dist/font-fulfill.js",
            "@docmentis/udoc-wasm/meta-url": "https://cdn.jsdelivr.net/npm/@docmentis/udoc-wasm@0.8.1/dist/meta-url.js"
        }
    }
</script>
<div id="viewer" style="height: 100vh"></div>
<script type="module">
    import { UDocViewer } from "@docmentis/udoc-viewer";
    const viewer = await UDocViewer.create(document.getElementById("viewer"));
    await viewer.open("report.pdf");
</script>
```

### Where the engine comes from

The viewer's worker carries everything it runs but the engine's binary and its
fonts, which it fetches. It tries, in order:

1. `wasm.baseUrl`, when you serve them yourself — copy
   `node_modules/@docmentis/udoc-wasm/dist/` to your server and point it there:
   `UDocViewer.create(el, { wasm: { baseUrl: "https://example.com/udoc-wasm/" } })`;
2. the copy your bundler emitted beside your app — a bundler that follows
   `new URL(…, import.meta.url)`, as Vite and webpack 5 do, emits it from
   `@docmentis/udoc-wasm` without configuration;
3. a CDN: `wasm.cdnUrl`, default jsDelivr's copy of exactly the
   `@docmentis/udoc-wasm` the viewer was built against.

The fonts are the office-compatible faces (Liberation, Carlito, Caladea) that
stand in for Arial, Times New Roman, Courier New, Calibri and Cambria; a
document fetches only the ones it uses.

## Options

`UDocViewer.create(container, options)`. Every option is optional.

**Licensing** — see [Licensing](#licensing).

| Option             | Default | What it does                                               |
| ------------------ | ------- | ---------------------------------------------------------- |
| `license`          | none    | Your license key. Without one, usage is free and metered.  |
| `hideAttribution`  | `false` | Don't paint the "Powered by docMentis" mark. License only. |
| `disableTelemetry` | `false` | Don't report usage. License only.                          |

**Look**

| Option  | Default   | What it does                       |
| ------- | --------- | ---------------------------------- |
| `theme` | `"light"` | `"light"`, `"dark"` or `"system"`. |

**Chrome**

| Option                  | Default      | What it does                                                                                 |
| ----------------------- | ------------ | -------------------------------------------------------------------------------------------- |
| `showToolbar`           | `true`       | The top toolbar.                                                                             |
| `showLeftPanel`         | `true`       | The left panel: thumbnails, outline, layers.                                                 |
| `showRightPanel`        | `true`       | The right panel: search, comments.                                                           |
| `showThumbnailPanel`    | `true`       | Each panel, where the document type has it.                                                  |
| `showOutlinePanel`      | `true`       |                                                                                              |
| `showLayersPanel`       | `true`       |                                                                                              |
| `showSearchPanel`       | `true`       |                                                                                              |
| `showCommentsPanel`     | `true`       |                                                                                              |
| `activePanel`           | `null`       | The panel open at start: `"thumbnail"`, `"outline"`, `"layers"`, `"search"` or `"comments"`. |
| `showThemeButton`       | `true`       | Each item in the toolbar's menu.                                                             |
| `showFullscreenButton`  | `true`       |                                                                                              |
| `showPrintButton`       | `true`       |                                                                                              |
| `showDownloadButton`    | `true`       |                                                                                              |
| `showDeveloperButton`   | `false`      | Diagnostics: the performance counter, the repaint area.                                      |
| `showLoadingOverlay`    | `true`       | Cover the document while it opens. `false` is license only.                                  |
| `viewControlsPlacement` | `"floating"` | Page and zoom controls: `"floating"`, `"top-toolbar"` or `"status-bar"`.                     |

**View**

| Option                      | Default        | What it does                                                                            |
| --------------------------- | -------------- | --------------------------------------------------------------------------------------- |
| `fit`                       | per type       | `{ mode, zoomCap }`; `mode` is `"width"`, `"height"`, `"both"`, `"either"` or `"none"`. |
| `zoom`                      | `1`            | The zoom while `fit.mode` is `"none"`; `1` is 100%.                                     |
| `zoomSteps`                 | 10% … 500%     | What zoom in and out step through.                                                      |
| `minZoom`, `maxZoom`        | `0.02`, `16`   | The bounds of the zoom.                                                                 |
| `scrollMode`                | `"continuous"` | Or `"spread"`, one spread at a time.                                                    |
| `layoutMode`                | `"singlePage"` | Or `"doublePage"`, `"doublePageOddRight"`, `"doublePageOddLeft"`. PDF and Word.         |
| `pageRotation`              | `0`            | `90`, `180` or `270` degrees clockwise. PDF and Word.                                   |
| `pageGap`                   | the viewer's   | `{ horizontal, vertical }` between pages, in points.                                    |
| `dpi`                       | `96`           | CSS px per physical inch, so 100% can show a page at its real size.                     |
| `navigationScrollAlignment` | `"top"`        | Where a followed link lands: `"top"`, `"center"`, `"bottom"`, `"nearest"`.              |
| `searchScrollAlignment`     | `"nearest"`    | Where a search match lands.                                                             |
| `onLinkClick`               | open a tab     | `(url) => void`, in place of opening a clicked web link.                                |

**Fonts and engine**

| Option               | Default     | What it does                                                                        |
| -------------------- | ----------- | ----------------------------------------------------------------------------------- |
| `fonts`              | none        | Your own fonts: a file's bytes, or `{ descriptor, url }`.                           |
| `enableGoogleFonts`  | `true`      | Fetch from Google Fonts a family a document names and nothing covers.               |
| `googleFontFamilies` | the catalog | The Google families offered.                                                        |
| `googleFontEndpoint` | Google's    | Where the css2 API is asked for them — a mirror's URL, in place of Google's.        |
| `enableCanvasFonts`  | `true`      | Use the user's installed fonts for a family nothing serves; renders vary by device. |
| `wasm`               | see above   | `{ baseUrl, cdnUrl }`: [where the engine comes from](#where-the-engine-comes-from). |

The viewer only views. It may annotate, fill in forms and follow a
collaboration, as its license allows, but it never edits a document's content,
whatever its options or license say.

## Methods

Pages are numbered from 1, except in the annotation calls, which take a page
index from 0, as 0.7's did.

**Document**

| Method                          | What it does                                                                |
| ------------------------------- | --------------------------------------------------------------------------- |
| `open(source, options?)`        | Open a document, replacing the one open.                                    |
| `close()`                       | Close it.                                                                   |
| `destroy()`                     | Tear the viewer down.                                                       |
| `download(filename?)`           | Save it, as edited, and hand it to the browser.                             |
| `print(options?)`               | Print: `{ pages, quality }`, or the print dialog without them.              |
| `renderPage(page, { scale })`   | Render a page to an `ImageBitmap`; `scale` `1` is 72 DPI.                   |
| `saveToBytes(format, strategy)` | The document's bytes; `strategy` `"rewrite"`, `"delta"` or `"incremental"`. |
| `docType`, `sourceFormat`       | What opened.                                                                |
| `pageCount`                     | The pages laid out so far; it grows until the document is.                  |

**Navigation and view**

| Method                                                                                                  | What it does                                  |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `goToPage(page)`, `currentPage`                                                                         | The current page.                             |
| `goToNextPage()`, `goToPrevPage()`                                                                      | Step a page, or a spread in spread scrolling. |
| `goToDestination(destination, options?)`                                                                | Go to a PDF destination.                      |
| `setZoom(zoom)`, `zoomIn()`, `zoomOut()`, `zoom`                                                        | The zoom.                                     |
| `setFit(fit)`, `fit`                                                                                    | The fit.                                      |
| `setScrollMode`, `setLayoutMode`, `setPageRotation`, `setPageGap`, `setDpi`, `setMinZoom`, `setMaxZoom` | As the options.                               |
| `setTheme(theme)`, `theme`                                                                              | The theme.                                    |
| `setFullscreen(on)`, `isFullscreen`                                                                     | Fullscreen.                                   |
| `openPanel(panel)`, `closePanel()`, `activePanel`                                                       | The side panel.                               |
| `setViewControlsPlacement`                                                                              | As the option.                                |

**Search**

| Method                                    | What it does                        |
| ----------------------------------------- | ----------------------------------- |
| `search(query, { caseSensitive, fuzzy })` | Search; resolves with every match.  |
| `searchNext()`, `searchPrev()`            | Move to the next or previous match. |
| `setSearchActiveIndex(index)`             | Move to a match.                    |
| `searchMatches`, `searchActiveIndex`      | The matches, and the current one.   |
| `clearSearch()`                           | End the search.                     |

**Annotations** (PDF)

| Method                                              | What it does                                            |
| --------------------------------------------------- | ------------------------------------------------------- |
| `getPageAnnotations(pageIndex)`                     | A page's annotations.                                   |
| `addPageAnnotation(pageIndex, annotation)`          | Add one; also `addPageAnnotations`.                     |
| `updatePageAnnotation(pageIndex, name, annotation)` | Replace one; also `updatePageAnnotations`.              |
| `patchPageAnnotation(pageIndex, name, patch)`       | Change some of its fields; also `patchPageAnnotations`. |
| `removePageAnnotation(pageIndex, name)`             | Remove one, with its replies.                           |

An annotation is the engine's `Annotation` type, and the calls find it by its
`name` (a PDF's `/NM`), which stays the same when the document is saved and
opened again. `add` gives one without a name a fresh one. An annotation with
`ephemeral: true` is shown but never saved or printed.

```ts
const [first] = await viewer.getPageAnnotations(0);
if (first?.name) await viewer.patchPageAnnotation(0, first.name, { contents: "Reviewed" });
```

**Overlays and fonts**

| Method                             | What it does                                                              |
| ---------------------------------- | ------------------------------------------------------------------------- |
| `setOverlay(id, source, options?)` | Draw your own HTML over the pages, kept in place as they scroll and zoom. |
| `removeOverlay(id)`                | Remove it.                                                                |
| `registerFonts(fonts)`             | Offer more fonts to documents opened after the call.                      |

## Events

```ts
const off = viewer.on("currentPage:changed", ({ page, previousPage }) => {
    console.log(`page ${previousPage} → ${page}`);
});
off(); // or viewer.off(event, handler)
```

| Event                 | Payload                                                  | Fires when                                    |
| --------------------- | -------------------------------------------------------- | --------------------------------------------- |
| `document:loading`    | `{ loaded, total, percent }`                             | `open` reads the document's bytes.            |
| `document:downloaded` | `{ filename }`                                           | A download is handed to the browser.          |
| `document:printed`    | `{ pageCount }`                                          | Pages are handed to the print dialog.         |
| `currentPage:changed` | `{ page, previousPage }`                                 | The current page changes.                     |
| `viewport:changed`    | `{ firstVisiblePage, lastVisiblePage, zoom, scrollTop }` | The view scrolls, zooms or is laid out again. |
| `panel:changed`       | `{ panel, previousPanel }`                               | A side panel opens, closes or switches.       |
| `search:changed`      | `{ matches, activeIndex }`                               | Matches arrive, or the current one moves.     |
| `annotation:inserted` | `{ pageIndex, annotation }`                              | An annotation is added.                       |
| `annotation:updated`  | `{ pageIndex, annotation }`                              | An annotation changes.                        |
| `annotation:removed`  | `{ pageIndex, annotation }`                              | An annotation is removed.                     |
| `annotation:selected` | `{ pageIndex, annotation }` or `null`                    | The selected annotation changes.              |
| `annotation:hovered`  | `{ pageIndex, annotation, clientX, clientY }` or `null`  | The pointer comes to rest on one, or leaves.  |
| `annotation:clicked`  | `{ pageIndex, annotation, clientX, clientY }`            | One is clicked, before the viewer handles it. |

`annotation:inserted`, `updated` and `removed` fire for every change, whoever
made it: the user, your calls, undo, redo or a collaborator. `viewport:changed` reports page
indices from 0 and `scrollTop` in CSS px.

## Theming

The chrome is neutral gray, in light and dark. Every color it uses is a CSS
variable on `.udoc-ui-root`, and a variable you set there wins. Your brand
color is `--udoc-color-primary`, which marks focus, selection and the filled
buttons, with `--udoc-color-on-primary` for the text on it. A region of the
frame takes its own fill: `--udoc-toolbar-background`,
`--udoc-ribbon-background`, `--udoc-panel-background`,
`--udoc-status-bar-background` and `--udoc-canvas-background`.

```css
.udoc-ui-root {
    --udoc-color-primary: #0f766e;
    --udoc-color-on-primary: #ffffff;
}
.udoc-ui-root.udoc-ui-dark {
    --udoc-color-primary: #5eead4;
    --udoc-color-on-primary: #04312c;
}
```

## Browser support

Chrome and Edge 91, Firefox 105, Safari 16.4 (iOS 16.4) and later. The viewer
needs `OffscreenCanvas` in a worker and WebAssembly SIMD. On a browser without
`OffscreenCanvas`, `create` rejects with a `UDocError` whose `code` is
`"unsupported"`.

## Content Security Policy

A page with a Content Security Policy needs to allow:

| Directive     | Value                                                    | For                                                                |
| ------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| `script-src`  | `'wasm-unsafe-eval'`                                     | Compiling the engine.                                              |
| `worker-src`  | `blob:`                                                  | The viewer's worker, which starts from a blob.                     |
| `style-src`   | `'unsafe-inline'`                                        | The viewer's stylesheet.                                           |
| `connect-src` | where the engine is served from                          | The binary and fonts — your origin, or `https://cdn.jsdelivr.net`. |
| `connect-src` | `https://www.docmentis.com`                              | Free-usage permits and usage reports.                              |
| `connect-src` | `https://fonts.googleapis.com https://fonts.gstatic.com` | Google Fonts, unless `enableGoogleFonts: false`.                   |

With a `googleFontEndpoint`, the Google Fonts row names that endpoint's origin
and the origins of the font files it serves instead.

## Licensing

**Free usage** needs no key. Each document opened asks the docMentis permit
service at `www.docmentis.com` for a permit, and the service counts the opens
per site. Pages served from localhost, `127.*` and private networks aren't
counted. When the service declines, or can't be reached, the viewer shows a
notice and the console says why.

**A license** is checked inside the engine, offline — never over the network.
It names the domains it covers — in a pattern, `*` stands for one label and
`**` for one or more, so `*.example.com` covers `app.example.com`,
`**.example.com` covers `a.b.example.com` too, and neither covers `example.com`
itself; localhost always counts — and the features it unlocks:

| Feature         | Allows                                     |
| --------------- | ------------------------------------------ |
| `annotation`    | Adding, changing and deleting annotations. |
| `formFilling`   | Filling in a PDF's form fields.            |
| `collaboration` | Working on a document together.            |

A licensee may also hide the "Powered by docMentis" mark (`hideAttribution`),
turn off usage reports (`disableTelemetry`) and the loading overlay
(`showLoadingOverlay: false`). An invalid key refuses to open documents rather
than falling back to free usage.

### Usage reports

Each document opened sends one report to `www.docmentis.com`: the site's
domain, the viewer and engine versions, the document's format, its size
rounded to 100 KB, whether it opened and the error when it didn't, a random id
the viewer keeps in `localStorage` (`udoc_distinct_id`), and with a license, a
hash of the key and its id, organization, validity and expiry. Never the
document, its name or its content. A licensee can turn them off with
`disableTelemetry: true`.

## Migrating from 0.7

0.8 is a new viewer, built on a new engine, and its API changed:

- `UDocClient.create` and `client.createViewer` are one call,
  `UDocViewer.create(container, options)`, and `load` is `open`.
- Options say what they show (`showToolbar: false`) rather than what they hide
  (`hideToolbar: true`).
- Events are named for what happened, ending in `ed` or `ing`:
  `page:change` is `currentPage:changed`, `annotation:add` is
  `annotation:inserted`, and so on.
- Annotations are the engine's `Annotation` type, found by their `name`.
- ico, tga, ppm, hdr, exr and qoi images are no longer opened.

[API-COMPARISON.md](API-COMPARISON.md) maps every export of 0.7, row by row, to
what 0.8 offers in its place, and [CHANGELOG.md](CHANGELOG.md) lists what
changed.
