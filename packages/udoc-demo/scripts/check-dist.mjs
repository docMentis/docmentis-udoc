// Refuse to pack a dist/ that holds the engine, or no demo at all.
//
// The build leaves the engine out (vite.config.ts), but only when udoc-ui, the
// viewer and the editor are built for release. Their dev builds (`npm run dev`)
// start each worker from a file of its own, which Vite bundles with the
// engine's glue, and with it the binary the glue names by default. The engine
// is under its own license, not this package's.
//
// Run by `npm pack` and `npm publish` (prepack).
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");

function die(message) {
    console.error(`[check-dist] ${message}`);
    process.exit(1);
}

if (!existsSync(join(dist, "index.html"))) die("dist/ holds no demo: build it first, `npm run build` at the root");
const engine = readdirSync(dist, { recursive: true }).filter((file) => /\.(wasm|ttf)$/.test(file));
if (engine.length > 0) {
    die(
        `dist/ holds the engine (${engine.join(", ")}): build udoc-ui, the viewer and the editor ` +
            "for release, then the demo, with `npm run build` at the root",
    );
}
