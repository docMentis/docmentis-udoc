---
description: Install the docMentis udoc viewer or editor, show a document in your web page, and choose where the engine loads from.
---

# Quick start

Show documents in your web page with `@docmentis/udoc-viewer`, or let people
edit them too with `@docmentis/udoc-editor`. Both open PDF, Word, PowerPoint and
Excel files and images, render them in the browser, and work with any framework
or none.

## Install

Install the viewer, or the editor if people will edit documents:

::: code-group

```sh [Viewer]
npm install @docmentis/udoc-viewer
```

```sh [Editor]
npm install @docmentis/udoc-editor
```

:::

Either one brings the docMentis engine with it, `@docmentis/udoc-wasm`, which
does the rendering.

## Show a document

Add an element for the viewer to fill. It takes the element's whole size, so
give the element a height:

```html
<div id="udoc" style="height: 100vh"></div>
```

Then create the viewer in that element, and open a document:

::: code-group

<<< @/snippets/quick-start/viewer.ts [Viewer]

<<< @/snippets/quick-start/editor.ts [Editor]

:::

`open` takes a URL, a `File` or any other `Blob`, or the file's bytes as a
`Uint8Array`. It tells the format from the file's content, not its name. If the
document can't be opened, `open` rejects with a
[`UDocError`](/api/Common/classes/UDocError), and the viewer shows the reason as
well.

The editor opens a document in edit mode, with a switch to view mode.

Call `destroy()` when you no longer need it, for example when the component that
holds it unmounts. That removes its UI and stops the worker the engine runs in.

## Where the engine loads from

The engine is a WebAssembly binary, with fonts that stand in for the common
Office fonts. The viewer fetches the binary when it starts, and a font only when
a document uses it. It looks for them in three places, in order:

1. `wasm.baseUrl`, if you set it.
2. The copy your bundler put beside your app. Vite and webpack 5 do this with
   no configuration.
3. jsDelivr, at the exact engine version your package was built against.

So most apps need no setup. To serve the files yourself, for example where the
CDN can't be reached, copy `node_modules/@docmentis/udoc-wasm/dist/` to your
server and point `wasm.baseUrl` at that folder:

<<< @/snippets/quick-start/self-hosted-engine.ts

## Browser support

Chrome and Edge 91, Firefox 105, and Safari 16.4 (iOS 16.4) or later. The engine
draws in a worker, on an `OffscreenCanvas`; in a browser without one, `create`
rejects with a `UDocError` whose `code` is `"unsupported"`.

## License key

Both packages work without a license key, as free usage. Free usage is metered,
so the engine has to be able to reach `https://www.docmentis.com`. With a
commercial license, pass its key when you create the viewer:

<<< @/snippets/quick-start/license.ts

## Next

- [`UDocOptions`](/api/Common/interfaces/UDocOptions) lists every option
  `create` takes, each with its default.
- [`UDocViewer`](/api/udoc-viewer/classes/UDocViewer) and
  [`UDocEditor`](/api/udoc-editor/classes/UDocEditor) list everything you can do
  with one once it's created.
