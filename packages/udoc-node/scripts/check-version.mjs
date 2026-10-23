// Fail the build when this package doesn't depend on exactly the installed
// engine.
//
// udoc-node runs the binary of the `@docmentis/udoc-wasm` installed beside it,
// and the engine's commands and model types change between its releases, so a
// range would let an install pair this host with an engine it was never built
// against. Depending on exactly the engine it is built against means every
// engine release is a udoc-node release: a build that finds the pin behind the
// installed engine — the npm release, or a newer local build linked in by
// scripts/link-engine.mjs — fails here, rather than shipping a host that loads
// another version's binary.
//
// Run by `npm run build`.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(here, "../package.json"), "utf8"));
// The package's root is the parent of `dist/`, where its entry resolves.
const wasmRoot = join(dirname(fileURLToPath(import.meta.resolve("@docmentis/udoc-wasm"))), "..");
const wasm = JSON.parse(readFileSync(join(wasmRoot, "package.json"), "utf8"));

const pin = manifest.dependencies?.[wasm.name];
if (pin !== wasm.version) {
    console.error(
        `[check-version] ${manifest.name} must depend on exactly ${wasm.name} ${wasm.version} ` +
            `(depends on ${JSON.stringify(pin)})`,
    );
    process.exit(1);
}
