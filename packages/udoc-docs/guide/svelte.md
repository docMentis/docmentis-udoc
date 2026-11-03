---
description: Show the docMentis viewer or editor in a Svelte 5 component, created when the component mounts and destroyed when it's removed.
---

# Svelte

The viewer and the editor each fill an element you give them. In Svelte,
that's an element in your component, bound with `bind:this`, and the viewer is
created in it once the component has mounted.

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

<<< @/../../examples/svelte-vite/src/DocumentViewer.svelte [Viewer]

<<< @/../../examples/svelte-vite/src/DocumentEditor.svelte [Editor]

:::

- `onMount` creates the viewer once its element is on the page. The function
  it returns runs when the component is removed, and destroys the viewer.
- `create` is asynchronous, so the component can be removed before it
  resolves. `gone` records that, and the viewer created after it is destroyed
  at once.
- The viewer opens the `src` the component mounted with. To open each new
  `src` in it, keep the viewer where an `$effect` can reach it, and call its
  `open` there.

## Use it

The viewer fills its element, so give the element a height, here through its
`pane` class:

```svelte
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

[`examples/svelte-vite`](https://github.com/docMentis/docmentis-udoc/tree/main/examples/svelte-vite)
shows the viewer and the editor side by side in a Svelte 5 app built with
Vite.
