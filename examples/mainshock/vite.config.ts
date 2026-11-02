import { realpathSync } from "node:fs";
import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { config } from "./server/config.ts";

/** The repo's root, whose packages mainshock links to. */
const repo = resolve(import.meta.dirname, "../..");

const backend = `http://127.0.0.1:${config.port}`;

// The udoc packages are linked from the repo, and find the engine's binary,
// fonts and workers by `import.meta.url`, as the demo's do
// (packages/udoc-demo/vite.config.ts): so they're left out of pre-bundling,
// which would rewrite it, and Vite may read the repo, and the engine where
// it really is, which is outside the repo when a local build is linked in.
export default defineConfig({
    root: "web",
    plugins: [react()],
    optimizeDeps: {
        exclude: ["@docmentis/udoc-editor", "@docmentis/udoc-viewer", "@docmentis/udoc-ui", "@docmentis/udoc-wasm"],
    },
    build: { outDir: "../dist", emptyOutDir: true, target: "es2022" },
    server: {
        port: config.webPort,
        strictPort: true,
        proxy: { "/api": backend },
        fs: { allow: [repo, realpathSync(resolve(repo, "node_modules/@docmentis/udoc-wasm"))] },
    },
});
