# @docmentis/udoc-demo

**The docMentis udoc demo, built and ready to serve.**

The viewer and the editor on sample documents: open a file or a URL, view it, edit it, or co-edit it in two editors side by side. It is the demo docmentis.com runs, published built so a site can serve it as it is.

[![npm version](https://img.shields.io/npm/v/@docmentis/udoc-demo)](https://www.npmjs.com/package/@docmentis/udoc-demo)
[![license](https://img.shields.io/npm/l/@docmentis/udoc-demo)](https://github.com/docMentis/docmentis-udoc#open-source-packages-shared-runtime)

**[Viewer Demo](https://www.docmentis.com/viewer/demo)** · **[Editor Demo](https://www.docmentis.com/editor/demo)** · **[Docs](https://www.docmentis.com/docs)** · **[Report Issue](https://github.com/docMentis/docmentis-udoc/issues)**

---

## Serve it

`dist/` is the demo. Its paths are relative, so it can be served from any directory.

It leaves the engine out. Serve the `@docmentis/udoc-wasm` this package depends on beside it, in `udoc-wasm/`, laid out as that package's `dist/`; without it, the demo loads the engine from jsDelivr. The engine is under its own license, which `@docmentis/udoc-wasm` carries.

```text
demo/
├── index.html, assets/, pdf/, …    @docmentis/udoc-demo/dist/
└── udoc-wasm/
    ├── wasm/udoc_bg.wasm           @docmentis/udoc-wasm/dist/wasm/udoc_bg.wasm
    └── fonts/                      @docmentis/udoc-wasm/dist/fonts/
```

It opens in View mode, on the viewer. `?mode=view`, `edit`, `coedit` or `ai` opens it in that mode, and the address follows the mode you switch to.

## Run it from source

In the [docMentis udoc monorepo](https://github.com/docMentis/docmentis-udoc), from the repository root:

```sh
npm install
npm run dev
```
