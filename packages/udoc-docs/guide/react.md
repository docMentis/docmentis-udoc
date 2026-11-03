---
description: Show the docMentis viewer or editor in a React component, created when the component mounts and destroyed when it unmounts.
---

# React

The viewer and the editor each fill an element you give them. In React, that's
an element your component renders, and the viewer is created in it once React
has put it on the page.

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

<<< @/../../examples/react-vite/src/DocumentViewer.tsx [Viewer]

<<< @/../../examples/react-vite/src/DocumentEditor.tsx [Editor]

:::

- The effect runs once the element is on the page, and creates the viewer in
  it. Its cleanup destroys the viewer.
- `create` is asynchronous, so the cleanup can run before it resolves. In
  development, StrictMode mounts each component, unmounts it and mounts it
  again, which does exactly that. `gone` records it, and the viewer created
  after it is destroyed at once.
- A new `src` runs the effect again, which destroys the viewer and creates
  another for the new document. To keep one viewer and open each new document
  in it, keep the viewer in a ref and call its `open` when `src` changes.

## Use it

The viewer fills its element, so give the element a height, here through its
`pane` class:

```tsx
<DocumentViewer src="/report.pdf" />
```

```css
.pane {
    height: 100vh;
}
```

## The engine's files

Vite puts the engine's binary and fonts beside your app as it builds it, so
there's nothing to set up. [Quick start](./quick-start#where-the-engine-loads-from)
says where else they can come from.

## The example

[`examples/react-vite`](https://github.com/docMentis/docmentis-udoc/tree/main/examples/react-vite)
shows the viewer and the editor side by side in a React app built with Vite.
