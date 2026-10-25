# @docmentis/udoc-demo

**The docMentis viewer and editor demo, ready to host.**

Open PDF, Word, PowerPoint, Excel, and image files in the browser, then view, edit, and co-edit them. This is the demo behind docmentis.com, published prebuilt so you can host it on your own site with no bundler or build step.

[![npm version](https://img.shields.io/npm/v/@docmentis/udoc-demo)](https://www.npmjs.com/package/@docmentis/udoc-demo)
[![license](https://img.shields.io/npm/l/@docmentis/udoc-demo)](https://github.com/docMentis/docmentis-udoc#open-source-packages-shared-runtime)

**[Viewer Demo](https://www.docmentis.com/viewer/demo)** · **[Editor Demo](https://www.docmentis.com/editor/demo)** · **[Docs](https://www.docmentis.com/docs)** · **[Changelog](https://github.com/docMentis/docmentis-udoc/blob/main/CHANGELOG.md)** · **[Report Issue](https://github.com/docMentis/docmentis-udoc/issues)**

---

## What it provides

- **A complete demo application.** The viewer and the editor with sample documents, opening a file or a URL, and an options panel to try their settings.
- **View, Edit, and Co-edit modes.** Co-edit shows two editors side by side, kept in sync as you type.
- **Self-contained.** `dist/` is a static site with the viewer and the editor built in. There is nothing to compile.
- **Hosts anywhere.** Its paths are relative, so it can be served from any folder or embedded in an iframe.

## Quick start

```sh
npm install @docmentis/udoc-demo
```

Copy the demo to a folder your site serves, and the engine it runs on beside it:

```sh
mkdir -p public/demo/udoc-wasm
cp -r node_modules/@docmentis/udoc-demo/dist/. public/demo/
cp -r node_modules/@docmentis/udoc-wasm/dist/wasm node_modules/@docmentis/udoc-wasm/dist/fonts public/demo/udoc-wasm/
```

Then open it or embed it:

```html
<iframe src="/demo/index.html?mode=view" style="width: 100%; height: 600px; border: 0"></iframe>
```

`?mode=` opens it in `view`, `edit`, `coedit`, or `ai`; without it, the demo opens in View mode. If you skip copying the engine, the demo loads it from jsDelivr instead.

## Part of the udoc ecosystem

The demo is built from [`@docmentis/udoc-viewer`](https://www.npmjs.com/package/@docmentis/udoc-viewer) and [`@docmentis/udoc-editor`](https://www.npmjs.com/package/@docmentis/udoc-editor). To build document viewing or editing into your own application, use those packages directly.

## Licensing

The demo's source code is open source under **MIT OR Apache-2.0**. It runs on the proprietary, separately licensed [`@docmentis/udoc-wasm`](https://www.npmjs.com/package/@docmentis/udoc-wasm) engine. Free runtime use requires online authorization; commercial licensing is available for offline use.

[Source and documentation](https://github.com/docMentis/docmentis-udoc) · [docMentis](https://www.docmentis.com/)
