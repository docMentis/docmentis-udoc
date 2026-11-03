---
description: Show the docMentis viewer or editor in a Next.js app, in a client component that creates it in the browser, with Turbopack or webpack.
---

# Next.js

The viewer and the editor run in the browser. In Next.js, they go in a client
component, which a page can render whether it's a server component or not.

## Install

::: code-group

```sh [Viewer]
npm install @docmentis/udoc-viewer
```

```sh [Editor]
npm install @docmentis/udoc-editor
```

:::

## The component

::: code-group

<<< @/../../examples/nextjs-turbopack/src/components/DocumentViewer.tsx [Viewer]

<<< @/../../examples/nextjs-turbopack/src/components/DocumentEditor.tsx [Editor]

:::

- `"use client"` makes it a client component. Next.js still renders it on the
  server for the page's first HTML, but an effect runs only in the browser, so
  the viewer is created only there.
- The effect creates the viewer once the element is on the page, and its
  cleanup destroys it. `create` is asynchronous, so the cleanup can run before
  it resolves, as StrictMode's first mount does in development. `gone` records
  it, and the viewer created after it is destroyed at once.
- A new `src` runs the effect again, which destroys the viewer and creates
  another for the new document.

## Use it

A page renders the component like any other. The viewer fills its element, so
give the element a height, here through its `pane` class:

<<< @/../../examples/nextjs-turbopack/src/app/page.tsx

```css
.pane {
    height: 100vh;
}
```

## The engine's files

Turbopack, which `next dev` and `next build` use, and webpack, with
`--webpack`, both put the engine's binary and fonts beside your app, so
there's nothing to set up. The viewer needs no server of its own, so a static
export (`output: "export"`) works as well as an app with a server.

## The examples

[`examples/nextjs-turbopack`](https://github.com/docMentis/docmentis-udoc/tree/main/examples/nextjs-turbopack)
and
[`examples/nextjs-webpack`](https://github.com/docMentis/docmentis-udoc/tree/main/examples/nextjs-webpack)
show the viewer and the editor side by side in a Next.js app, the same code
built each way.
