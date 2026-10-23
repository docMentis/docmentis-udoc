# docMentis udoc

**Document infrastructure for humans and agents.**

[docMentis](https://www.docmentis.com/) enables developers to build rich document experiences directly into their applications. With udoc, applications can view, edit, render, process, and collaborate on documents across browser and server environments.

**We provide the infrastructure. You build the experience.**

## Choose a package

| Package                                                                      | Use it to                                                                    |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [`@docmentis/udoc-viewer`](packages/udoc-viewer)                             | Embed a full-featured document viewer in your application.                   |
| [`@docmentis/udoc-editor`](packages/udoc-editor)                             | Add document editing and collaborative authoring to your application.        |
| [`@docmentis/udoc-node`](packages/udoc-node)                                 | Read, render, and process documents programmatically in Node.js.             |
| [`@docmentis/udoc-cli`](packages/udoc-cli)                                   | Inspect and render documents from the command line.                          |
| [`@docmentis/udoc-server`](packages/udoc-server)                             | Self-host document services for remote access and collaboration.             |
| [`@docmentis/udoc-ui`](packages/udoc-ui)                                     | Shared UI foundation used by the viewer and editor; not a standalone viewer. |
| [`@docmentis/udoc-wasm`](https://www.npmjs.com/package/@docmentis/udoc-wasm) | The document engine powering the ecosystem.                                  |

The repository also contains the [demo application](packages/udoc-demo) and [developer documentation site](packages/udoc-docs).

## One engine, multiple ways to work with documents

udoc brings PDF, Word, PowerPoint, Excel, and other document formats into a consistent developer ecosystem. Choose a ready-to-embed interface, integrate document functionality into Node.js, use command-line tools, or host document services yourself.

### Get started with the viewer

```sh
npm install @docmentis/udoc-viewer
```

```ts
import { UDocViewer } from "@docmentis/udoc-viewer";

const viewer = await UDocViewer.create(document.getElementById("viewer")!);
await viewer.open("/example.pdf");
```

### Get started with the editor

```sh
npm install @docmentis/udoc-editor
```

```ts
import { UDocEditor } from "@docmentis/udoc-editor";

const editor = await UDocEditor.create(document.getElementById("editor")!);
await editor.open(file);
```

See each package's README for its setup, supported capabilities, and usage examples.

## Open-source packages, shared runtime

The code in this repository is available under your choice of the **MIT** or **Apache-2.0** license.

These packages use [`@docmentis/udoc-wasm`](https://www.npmjs.com/package/@docmentis/udoc-wasm), a separately distributed **proprietary** document runtime subject to the docMentis WASM Runtime License. Free runtime use requires online authorization; commercial licensing is available for offline and other licensed use cases. The open-source licenses of the packages in this repository do not change the runtime's license.

## Development

```sh
npm install
npm run build
npm run dev
npm test
```

For project documentation and additional information, visit [docmentis.com](https://www.docmentis.com/).
