---
description: Show the docMentis viewer or editor in an Angular component, and serve the engine's files from your app, which Angular's builder doesn't copy by itself.
---

# Angular

The viewer and the editor each fill an element you give them. In Angular, that
can be the component's own host element, and the viewer is created in it once
the component's view is ready.

## Install

::: code-group

```sh [Viewer]
npm install @docmentis/udoc-viewer
```

```sh [Editor]
npm install @docmentis/udoc-editor
```

:::

## The engine's files

Angular's builder bundles your app with esbuild, which doesn't copy the
engine's binary and fonts beside it as Vite and webpack do. Copy them from
`@docmentis/udoc-wasm` yourself, among the build's assets in `angular.json`:

```json
"assets": [
    { "glob": "**/*", "input": "public" },
    { "glob": "wasm/*.wasm", "input": "node_modules/@docmentis/udoc-wasm/dist", "output": "udoc-wasm" },
    { "glob": "fonts/**/*", "input": "node_modules/@docmentis/udoc-wasm/dist", "output": "udoc-wasm" },
    { "glob": "geography/**/*", "input": "node_modules/@docmentis/udoc-wasm/dist", "output": "udoc-wasm" }
]
```

Then point the viewer at them with `wasm.baseUrl`:

<<< @/../../examples/angular/src/app/wasm.ts

Without this, the viewer still works, but loads the engine from jsDelivr.

## The component

::: code-group

<<< @/../../examples/angular/src/app/document-viewer.ts [Viewer]

<<< @/../../examples/angular/src/app/document-editor.ts [Editor]

:::

- The component has no template: its host element is the viewer's container,
  and takes the `pane` class.
- `ngAfterViewInit` creates the viewer, and `ngOnDestroy` destroys it.
- `create` is asynchronous, so the component can be destroyed before it
  resolves. `#gone` records that, and the viewer created after it is destroyed
  at once.

## Use it

The viewer fills its element, so give the element a height, here through the
`pane` class. A host element is inline by default, so make it a block too:

```html
<app-document-viewer src="/report.pdf" />
```

```css
.pane {
    display: block;
    height: 100vh;
}
```

## The example

[`examples/angular`](https://github.com/docMentis/docmentis-udoc/tree/main/examples/angular)
shows the viewer and the editor side by side in an Angular app.
