---
description: Show the docMentis viewer or editor in a web page with no framework, bundled with Vite or webpack, or with no build step at all.
---

# Without a framework

The viewer and the editor work with no framework: create them in an element,
and destroy them when you're done. How you load the packages depends on how
you build your page.

## With Vite

Vite needs no setup: it bundles the packages and puts the engine's binary and
fonts beside your app.

<<< @/../../examples/vanilla/src/main.ts

The viewer fills its element, so give the element a height.

## With webpack

webpack 5 puts the engine's binary beside your app too. The binary is far
larger than webpack's size hints allow, so turn them off, or webpack warns
about it on every build:

<<< @/../../examples/webpack/webpack.config.js

## With no build step

The packages are plain ES modules, so a page with no build step can load them
from jsDelivr through an import map:

<<< @/../../examples/no-bundler/index.html

Keep the versions in the import map in step: `@docmentis/udoc-ui` at the
viewer's and the editor's version, and `@docmentis/udoc-wasm` at the version
that `@docmentis/udoc-ui` depends on. The engine's binary and fonts load from
jsDelivr too.

## The examples

[`examples/vanilla`](https://github.com/docMentis/docmentis-udoc/tree/main/examples/vanilla),
[`examples/webpack`](https://github.com/docMentis/docmentis-udoc/tree/main/examples/webpack)
and
[`examples/no-bundler`](https://github.com/docMentis/docmentis-udoc/tree/main/examples/no-bundler)
show the viewer and the editor side by side each of these ways.
