---
description: Show the docMentis viewer or editor in a Nuxt app, in a client-only component that creates it in the browser while the server renders the rest of the page.
---

# Nuxt

The viewer and the editor run in the browser. In Nuxt, they go in a component
that renders only there, while the server renders the page around it.

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

Name the component's file with `.client.vue`, so Nuxt renders it only in the
browser:

::: code-group

<<< @/../../examples/nuxt/app/components/DocumentViewer.client.vue [Viewer]

<<< @/../../examples/nuxt/app/components/DocumentEditor.client.vue [Editor]

:::

- `onMounted` creates the viewer, and `onBeforeUnmount` destroys it. Nuxt
  renders a client component's template only once it has mounted, so
  `await nextTick()` waits for the element to be there first.
- `create` is asynchronous, so the component can unmount before it resolves.
  `gone` records that, and the viewer created after it is destroyed at once.
- The watcher opens each new `src` in the same viewer.

## Use it

Nuxt registers the component under its name, without the `.client`. The viewer
fills its element, so give the element a height, here through its `pane`
class:

```vue
<DocumentViewer src="/report.pdf" />
```

```css
.pane {
    height: 100vh;
}
```

## The engine's files

Nuxt builds with Vite, which puts the engine's binary and fonts beside your
app, so there's nothing to set up.
[Quick start](./quick-start#where-the-engine-loads-from) says where else they
can come from.

## The example

[`examples/nuxt`](https://github.com/docMentis/docmentis-udoc/tree/main/examples/nuxt)
shows the viewer and the editor side by side in a Nuxt app, generated as a
static site.
