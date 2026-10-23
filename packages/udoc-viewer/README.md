# @docmentis/udoc-viewer

A document viewer for the web. It opens PDF, Word, PowerPoint and Excel files,
CSV and images in the page, rendered by the docMentis udoc engine —
WebAssembly, on a canvas, in a worker — with thumbnails, outline, search,
comments, annotation, print and download. It works with any framework, or none.

Upgrading from 0.7? See [Migrating from 0.7](#migrating-from-07).

## Supported formats

| Kind           | Formats                         |
| -------------- | ------------------------------- |
| Document       | PDF, DOCX, PPTX, XLSX           |
| Delimited text | CSV, TSV, PSV                   |
| Image          | JPEG, PNG, GIF, BMP, TIFF, WebP |
| Vector         | SVG, EMF, WMF                   |

A format is detected from the file's content, but for CSV, TSV and PSV, which
have no signature to detect and are known by the file's name. A `.udoc`
package opens too.

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

## Options, methods and events

`UDocViewer.create(container, options)` takes
[options](https://www.docmentis.com/docs/api/udoc-viewer/type-aliases/UDocViewerOptions)
for the chrome, the view, fonts and the engine, every one optional. The
viewer's [methods](https://www.docmentis.com/docs/api/udoc-viewer/classes/UDocViewer)
open, navigate, search, annotate, render, print and download, and its
[events](https://www.docmentis.com/docs/api/Common/interfaces/UDocEvents) say
what happened:

```ts
const viewer = await UDocViewer.create(element, { theme: "system", activePanel: "outline" });
const off = viewer.on("currentPage:changed", ({ page, previousPage }) => {
    console.log(`page ${previousPage} → ${page}`);
});
off(); // or viewer.off(event, handler)
```

Pages are numbered from 1, except in the annotation calls, which take a page
index from 0, as 0.7's did. An annotation is the engine's `Annotation` type,
and the calls find it by its `name` (a PDF's `/NM`), which stays the same when
the document is saved and opened again.

The viewer only views. It may annotate, fill in forms and follow a
collaboration, as its license allows, but it never edits a document's content,
whatever its options or license say.

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

## License keys

**Free usage** needs no key. Each document opened asks the docMentis permit
service at `www.docmentis.com` for a permit, and the service counts the opens
per site. Pages served from localhost, `127.*` and private networks aren't
counted. When the service declines, or can't be reached, the viewer shows a
notice and the console says why.

**A license**, given as the `license` option, is checked inside the engine,
offline — never over the network. It names the domains it covers — in a
pattern, `*` stands for one label and `**` for one or more, so `*.example.com`
covers `app.example.com`, `**.example.com` covers `a.b.example.com` too, and
neither covers `example.com` itself; localhost always counts — and the
features it unlocks:

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

[API-COMPARISON.md](https://github.com/docMentis/docmentis-udoc/blob/main/packages/udoc-viewer/API-COMPARISON.md)
maps every export of 0.7, row by row, to what 0.8 offers in its place, and the
[changelog](https://github.com/docMentis/docmentis-udoc/blob/main/CHANGELOG.md)
lists what changed.

## Documentation

The guides and the API reference are at
[docmentis.com/docs](https://www.docmentis.com/docs).

## License

MIT OR Apache-2.0, at your option. That covers this package, not the
`@docmentis/udoc-wasm` engine it runs on, which is proprietary, under its own
license.
