# @docmentis/udoc-demo

**The docMentis udoc demo, built and ready to serve.**

The viewer and the editor on sample documents: open a file or a URL, view it, edit it, or co-edit it in two editors side by side. It is the demo docmentis.com runs, published built so a site can serve it as it is.

[![npm version](https://img.shields.io/npm/v/@docmentis/udoc-demo)](https://www.npmjs.com/package/@docmentis/udoc-demo)
[![license](https://img.shields.io/npm/l/@docmentis/udoc-demo)](https://github.com/docMentis/docmentis-udoc#open-source-packages-shared-runtime)

**[Viewer Demo](https://www.docmentis.com/viewer/demo)** · **[Editor Demo](https://www.docmentis.com/editor/demo)** · **[Docs](https://www.docmentis.com/docs)** · **[Report Issue](https://github.com/docMentis/docmentis-udoc/issues)**

---

## Serve it

The package is the demo, built: `dist/` holds its page, its code with the viewer and the editor built in, and its sample documents. It needs no bundler, and nothing else installed but the engine it runs on, which it leaves out of `dist/`.

1. `npm install @docmentis/udoc-demo`, which installs the `@docmentis/udoc-wasm` it depends on with it.
2. Copy `node_modules/@docmentis/udoc-demo/dist/` to a folder your site serves, such as `public/demo/`. Its paths are relative, so any folder works.
3. Copy that `@docmentis/udoc-wasm`'s `dist/wasm/` and `dist/fonts/` into `udoc-wasm/` in the same folder, as `public/demo/udoc-wasm/`. Skip this, and the demo loads the engine from jsDelivr.
4. Open it, or embed it, at `index.html`: `<iframe src="/demo/index.html?mode=view"></iframe>`. `?mode=view`, `edit`, `coedit` or `ai` opens it in that mode, View when none is named.

The engine is under its own license, which `@docmentis/udoc-wasm` carries.

## Run it from source

In the [docMentis udoc monorepo](https://github.com/docMentis/docmentis-udoc), from the repository root:

```sh
npm install
npm run dev
```
