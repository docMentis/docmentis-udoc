import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const root = resolve(import.meta.dirname, "../..");

// The WASM binary + glue live in @docmentis/udoc-wasm's dist, resolved via
// import.meta.url (from its `meta-url` module). Exclude that package, udoc-ui
// (whose worker sources resolve the same way) and the two packages built on it
// from dep pre-bundling so those URLs resolve to the real dist
// locations (esbuild pre-bundling would rewrite import.meta.url and break it),
// and allow Vite to read the workspace root so it can serve those files from
// the symlinked packages — and the engine's real location, which is outside
// this repo when scripts/link-engine.mjs has linked in a local build.
export default defineConfig({
    // Relative asset paths so the built demo works when served from a
    // subdirectory (e.g. embedded in an iframe at /demo/ on the site).
    base: "./",
    optimizeDeps: {
        exclude: ["@docmentis/udoc-editor", "@docmentis/udoc-viewer", "@docmentis/udoc-ui", "@docmentis/udoc-wasm"],
    },
    // The build leaves the engine out. The packages' lookup of a bundled copy
    // (`@docmentis/udoc-wasm/meta-url`) stays an import the browser can't
    // resolve, so Vite copies in neither the binary nor the fonts, and the
    // packages go on to where the demo's host serves them (`ENGINE` in
    // src/stage/Stage.ts), then to jsDelivr. Dev serves the installed engine.
    build: { target: "es2022", rollupOptions: { external: ["@docmentis/udoc-wasm/meta-url"] } },
    server: {
        fs: { allow: [root, realpathSync(resolve(root, "node_modules/@docmentis/udoc-wasm"))] },
    },
});
