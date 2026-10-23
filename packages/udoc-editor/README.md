# @docmentis/udoc-editor

**Embeddable document editing and collaboration for the web.**

Bring rich document interaction and editing directly into your application. udoc-editor builds on the same document experience as udoc-viewer, adding content editing, undo and redo, and collaborative authoring for supported document formats.

[![npm version](https://img.shields.io/npm/v/@docmentis/udoc-editor)](https://www.npmjs.com/package/@docmentis/udoc-editor)
[![license](https://img.shields.io/npm/l/@docmentis/udoc-editor)](https://github.com/docMentis/docmentis-udoc#open-source-packages-shared-runtime)

**[Live Demo](https://www.docmentis.com/editor/demo)** · **[Docs](https://www.docmentis.com/docs)** · **[API Reference](https://www.docmentis.com/docs/api/udoc-editor)** · **[Changelog](https://github.com/docMentis/docmentis-udoc/blob/main/CHANGELOG.md)** · **[Report Issue](https://github.com/docMentis/docmentis-udoc/issues)**

---

## Why udoc-editor?

- **Viewing and editing together.** Open documents, navigate them, and switch between viewing and editing workflows in one component.
- **Document-native editing.** Work with text, images, shapes, pages, annotations, and form fields as supported by each format.
- **Collaboration.** Multiple participants can work on the same document and see each other's changes and selections.
- **Embeddable experience.** Integrate document editing into your application instead of sending users to a separate office product.

## Quick start

```sh
npm install @docmentis/udoc-editor
```

```html
<div id="editor" style="height: 600px"></div>
```

```ts
import { UDocEditor } from "@docmentis/udoc-editor";

const editor = await UDocEditor.create(document.getElementById("editor")!);
await editor.open(file);
```

The editing modes and operations available in a session depend on the document format and runtime entitlement. See the API documentation for saving, editing commands, and collaboration setup.

## Part of the udoc ecosystem

Use [`@docmentis/udoc-viewer`](https://www.npmjs.com/package/@docmentis/udoc-viewer) for view-only experiences. For persistent shared documents and remote collaboration, pair the editor with [`@docmentis/udoc-server`](https://www.npmjs.com/package/@docmentis/udoc-server).

## Licensing

The editor's source code is open source under **MIT OR Apache-2.0**. The underlying [`@docmentis/udoc-wasm`](https://www.npmjs.com/package/@docmentis/udoc-wasm) runtime is proprietary and separately licensed. Free runtime use requires online authorization; commercial licensing is available for offline and other licensed use cases.

[Source and documentation](https://github.com/docMentis/docmentis-udoc) · [docMentis](https://www.docmentis.com/)
