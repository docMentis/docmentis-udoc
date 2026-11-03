---
description: Show the docMentis viewer or editor in a Vue component, created when the component mounts, opening each new document it's given, and destroyed when it unmounts.
---

# Vue

The viewer and the editor each fill an element you give them. In Vue, that's
an element in your component's template, and the viewer is created in it once
the component has mounted.

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

<<< @/../../examples/vue-vite/src/components/DocumentViewer.vue [Viewer]

<<< @/../../examples/vue-vite/src/components/DocumentEditor.vue [Editor]

:::

- `onMounted` creates the viewer once its element is on the page, and
  `onBeforeUnmount` destroys it.
- `create` is asynchronous, so the component can unmount before it resolves.
  `gone` records that, and the viewer created after it is destroyed at once.
- The watcher opens each new `src` in the same viewer.

## Use it

The viewer fills its element, so give the element a height, here through its
`pane` class:

```vue
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

[`examples/vue-vite`](https://github.com/docMentis/docmentis-udoc/tree/main/examples/vue-vite)
shows the viewer and the editor side by side in a Vue app built with Vite.
