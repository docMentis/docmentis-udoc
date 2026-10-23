// Put a local engine build in place of the npm one, when there is one.
//
// The packages here depend on an exact `@docmentis/udoc-wasm` from npm: the
// engine is built and released from the private docmentis-udoc-engine repo.
// When that repo is checked out beside this one, its udoc-wasm package — the
// `dist/` its `just build-wasm` refreshes — is linked in at
// `node_modules/@docmentis/udoc-wasm`, so UI work runs against the engine as
// it is being built, without a release in between. Without the checkout this
// does nothing, and everything builds against the npm release.
//
// Run by `npm install` (postinstall), and by `npm run link-engine` to relink
// after anything that put the npm copy back.
import { existsSync, lstatSync, mkdirSync, rmSync, symlinkSync, unlinkSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const engine = join(root, "../docmentis-udoc-engine/packages/udoc-wasm");
const installed = join(root, "node_modules/@docmentis/udoc-wasm");

if (!existsSync(join(engine, "package.json"))) {
    console.log("[link-engine] no ../docmentis-udoc-engine checkout; using @docmentis/udoc-wasm from npm.");
    process.exit(0);
}

mkdirSync(dirname(installed), { recursive: true });
// What npm installed, or an earlier link — which may dangle, so it is
// unlinked rather than removed through what it points at.
const previous = lstatSync(installed, { throwIfNoEntry: false });
if (previous?.isSymbolicLink()) unlinkSync(installed);
else if (previous) rmSync(installed, { recursive: true });
symlinkSync(relative(dirname(installed), engine), installed, "dir");
console.log(`[link-engine] node_modules/@docmentis/udoc-wasm -> ${relative(root, engine)}`);

if (!existsSync(join(engine, "dist/wasm/udoc_bg.wasm"))) {
    console.warn("[link-engine] the engine checkout has no build yet: run `just build-wasm` there.");
}
