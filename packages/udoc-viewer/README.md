# @docmentis/udoc-viewer

**A full-featured, embeddable document viewer for the web.**

Bring PDF, Word, PowerPoint, Excel, SVG, images, and other documents directly into your application with a consistent viewing experience. Built on the docMentis document engine, udoc-viewer combines high-fidelity rendering with the tools people expect from a modern document viewer.

## Why udoc-viewer?

- **One viewer for many formats.** Display PDF, DOCX, PPTX, XLSX, and other supported document and image formats without switching components.
- **Complete viewing experience.** Navigation, zoom, thumbnails, outlines, search, printing, and downloading, with annotation and comment capabilities.
- **Embeddable and customizable.** Integrate with your framework of choice, or with plain JavaScript, and customize the interface to fit your application.
- **Client-side document rendering.** View documents in the browser without requiring server-side document conversion.

## Quick start

```sh
npm install @docmentis/udoc-viewer
```

Give the viewer a container with a height:

```html
<div id="viewer" style="height: 600px"></div>
```

```ts
import { UDocViewer } from "@docmentis/udoc-viewer";

const viewer = await UDocViewer.create(document.getElementById("viewer")!);
await viewer.open("/example.pdf");

// Call viewer.destroy() when the viewer is no longer needed.
```

`open` also accepts local files and document bytes. See the package's API documentation for configuration and available methods.

## Viewer or editor?

Use **udoc-viewer** when your application needs document viewing, navigation, search, comments, or annotations without content editing. For content editing and collaborative authoring, use [`@docmentis/udoc-editor`](https://www.npmjs.com/package/@docmentis/udoc-editor).

## Licensing

The viewer's source code is open source under **MIT OR Apache-2.0**. It uses the separately licensed, proprietary [`@docmentis/udoc-wasm`](https://www.npmjs.com/package/@docmentis/udoc-wasm) runtime. Free runtime use requires online authorization; commercial licensing is available for offline use and applicable licensed options.

[Source and documentation](https://github.com/docMentis/docmentis-udoc) · [docMentis](https://www.docmentis.com/)
