// A viewer install never contains the editor: viewer licenses have been sold,
// and those customers must not receive it. What a viewer install holds is this
// package and udoc-ui as npm packs them — each one's `package.json`, README,
// the files its `files` lists and its `dist` — and the engine, udoc-wasm,
// which this does not cover. Every file shipped there is read for the editor's
// name and for the calls only edit mode makes, but the two worker bundles:
// each is a worker's own modules, read here one by one, and the engine's glue,
// which names every call the engine has.
//
// Reads the built `dist`s: run `npm run build` first.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const packages = join(import.meta.dirname, "../..");

/** The editor's name, and the worker messages and calls only edit mode sends. */
const FORBIDDEN =
    /udoc-editor|UDocEditor|\beditors?\b|\binsertImage\b|type: "paste"|\bselectionHandlePreview\b|\bslideMastersSummary\b|\bfontFamilySummaries\b/i;

const PACKED = ["udoc-viewer", "udoc-ui"];

/** The worker bundles, relative to a package's `dist` — the viewer's render
 *  worker and udoc-ui's local collaboration worker: see the header. */
const WORKER_BUNDLES = new Set(["worker/worker-source.js", "worker/local-collaboration-worker-source.js"]);

/** Every file npm packs of package `name`: its manifest and README, and the
 *  files its `files` lists — of `dist`, the code and its declarations, not the
 *  source maps or the worker bundles. */
function shipped(name: string): string[] {
    const root = join(packages, name);
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const listed: string[] = manifest.files ?? [];
    const files = [join(root, "package.json"), join(root, "README.md")].filter(existsSync);
    for (const entry of listed) {
        if (entry !== "dist") {
            files.push(join(root, entry));
            continue;
        }
        const dist = join(root, "dist");
        assert.ok(existsSync(dist), `${name}/dist is missing: build first`);
        for (const file of readdirSync(dist, { recursive: true, encoding: "utf8" })) {
            if (WORKER_BUNDLES.has(file)) continue;
            if (file.endsWith(".js") || file.endsWith(".d.ts")) files.push(join(dist, file));
        }
    }
    return files;
}

test("neither the viewer nor udoc-ui depends on the editor", () => {
    for (const name of PACKED) {
        const manifest = JSON.parse(readFileSync(join(packages, name, "package.json"), "utf8"));
        for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
            assert.equal(manifest[field]?.["@docmentis/udoc-editor"], undefined, `${name} ${field}`);
        }
    }
});

test("no file a viewer install ships names the editor or carries edit mode", () => {
    const matching = PACKED.flatMap(shipped)
        .filter((file) => FORBIDDEN.test(readFileSync(file, "utf8")))
        .map((file) => relative(packages, file))
        .sort();
    assert.deepEqual(matching, [], "files that name the editor or carry edit mode");
});
