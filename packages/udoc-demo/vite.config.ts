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
    // subdirectory (e.g. embedded in an iframe at /editor-demo/ on the site).
    base: "./",
    optimizeDeps: {
        exclude: ["@docmentis/udoc-editor", "@docmentis/udoc-viewer", "@docmentis/udoc-ui", "@docmentis/udoc-wasm"],
    },
    build: { target: "es2022" },
    server: {
        fs: { allow: [root, realpathSync(resolve(root, "node_modules/@docmentis/udoc-wasm"))] },
        // `?document=<id>` opens a document udoc-server keeps, part by part,
        // and joins its collaboration — the server `npm run dev` runs beside this
        // one, on its default address. Proxied, WebSocket upgrades too, so the
        // page and the server share an origin and the server needs no CORS.
        // `UDOC_SERVER` points it at another.
        proxy: { "/documents": { target: process.env.UDOC_SERVER ?? "http://127.0.0.1:8080", ws: true } },
    },
});
