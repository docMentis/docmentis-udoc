# Examples

Each folder is an app of its own that puts
[`@docmentis/udoc-viewer`](https://www.npmjs.com/package/@docmentis/udoc-viewer)
and [`@docmentis/udoc-editor`](https://www.npmjs.com/package/@docmentis/udoc-editor)
side by side in a framework or a bundler: the viewer opens a PDF, the editor a
Word document.

| Example                                | Framework and bundler        | What it takes beyond installing the packages                                                                                                                   |
| -------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`vanilla`](vanilla)                   | None, with Vite              | Nothing.                                                                                                                                                       |
| [`react-vite`](react-vite)             | React, with Vite             | An effect that destroys a viewer its cleanup ran before, as StrictMode's first run does.                                                                       |
| [`vue-vite`](vue-vite)                 | Vue, with Vite               | Nothing.                                                                                                                                                       |
| [`svelte-vite`](svelte-vite)           | Svelte 5, with Vite          | Nothing.                                                                                                                                                       |
| [`angular`](angular)                   | Angular, with its builder    | The engine's binary and fonts copied into the app (`angular.json`) and `wasm.baseUrl` pointed at them: Angular's esbuild leaves `new URL(…, import.meta.url)`. |
| [`nuxt`](nuxt)                         | Nuxt, rendered on the server | `.client.vue` components, which run in the browser alone, and an `await nextTick()` before their template is there.                                            |
| [`nextjs-webpack`](nextjs-webpack)     | Next.js, with webpack        | `"use client"` components.                                                                                                                                     |
| [`nextjs-turbopack`](nextjs-turbopack) | Next.js, with Turbopack      | `"use client"` components.                                                                                                                                     |
| [`webpack`](webpack)                   | None, with webpack 5         | Nothing but the size hints off: the engine's binary is far over them.                                                                                          |
| [`no-bundler`](no-bundler)             | None, and no build step      | An import map onto jsDelivr, its versions in step with each other.                                                                                             |

## Running one

```sh
cd examples/react-vite
npm install
npm run dev
```

An example installs the packages from npm; `no-bundler` needs only a static
server for its folder.

## How they're tested

From the repo root, after `npm run build`:

```sh
npx playwright install chromium   # once
npm run examples                  # every example, or name some: npm run examples -- react-vite angular
```

`scripts/examples.mjs` packs udoc-ui, the viewer and the editor as this
checkout builds them, and for each example installs them in a copy outside the
repo, as an app installs them from npm. It builds the copy for production,
serves it and opens it in headless Chromium. An example passes when the viewer
and the editor each show a rendered page, with no console error, no uncaught
error, no failed request, and the engine's binary fetched from the app rather
than from its fallback on the CDN, which would hide a bundler that didn't emit
it. The Examples workflow runs it for each example on every pull request.

A new example is a folder here with a `package.json` whose `build` script
writes a static site: `dist/`, or a folder `SITE` in `scripts/examples.mjs`
names.
