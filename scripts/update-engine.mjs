// Move the packages to an engine release: the latest `@docmentis/udoc-wasm` on
// npm, or the version given.
//
// The packages that run the engine depend on exactly the udoc-wasm they are
// built against, so moving to another release changes each of those pins, the
// lockfile, the engine version udoc-ui generates into `src/version.ts`, and the
// CDN URLs the docs write out with it. This changes all of them, and leaves the
// commit to you: a new engine often needs code here to change with it.
//
// Only a release is taken. The published packages name the engine they pin, so
// a pin to a build that isn't on npm would install nowhere; to work against one,
// link it in (scripts/link-engine.mjs).
//
// Run by `npm run update-engine`, or `npm run update-engine -- <version>`.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wasm = "@docmentis/udoc-wasm";

function die(message) {
    console.error(`[update-engine] ${message}`);
    process.exit(1);
}

/** What a command prints, or null when it fails. */
function output(command, ...args) {
    try {
        return execFileSync(command, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
        return null;
    }
}

const target = process.argv[2] ?? output("npm", "view", wasm, "dist-tags.latest");
if (target === null) die(`can't read ${wasm}'s latest version from npm`);
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(target)) die(`"${target}" isn't a version, such as 0.8.2`);
if (output("npm", "view", `${wasm}@${target}`, "version") !== target) die(`${wasm} ${target} isn't on npm`);

const dependents = readdirSync(join(root, "packages"))
    .map((dir) => join(root, "packages", dir, "package.json"))
    .filter((file) => existsSync(file))
    .map((file) => ({ file, manifest: JSON.parse(readFileSync(file, "utf8")) }))
    .filter(({ manifest }) => manifest.dependencies?.[wasm]);
const pins = [...new Set(dependents.map(({ manifest }) => manifest.dependencies[wasm]))];
if (pins.length === 1 && pins[0] === target) {
    console.log(`[update-engine] already on ${wasm} ${target}.`);
    process.exit(0);
}

for (const { file, manifest } of dependents) {
    manifest.dependencies[wasm] = target;
    writeFileSync(file, `${JSON.stringify(manifest, null, 4)}\n`);
}
console.log(
    `[update-engine] ${wasm} ${pins.join(", ")} -> ${target} in ` +
        dependents.map(({ manifest }) => manifest.name).join(", "),
);

// A copy of a CDN URL written out in the docs, such as an import map's. Not the
// changelogs', which say what a past release shipped with.
const url = /@docmentis\/udoc-wasm@\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?\//g;
const documents = output("git", "grep", "-l", "-E", "udoc-wasm@[0-9]", "--", ":!**/CHANGELOG.md")?.split("\n") ?? [];
for (const file of documents) {
    const text = readFileSync(join(root, file), "utf8");
    const updated = text.replace(url, `${wasm}@${target}/`);
    if (updated !== text) {
        writeFileSync(join(root, file), updated);
        console.log(`[update-engine] updated the CDN URLs in ${file}`);
    }
}

// The lockfile and node_modules. The engine's entries leave the lockfile first:
// npm, finding the old release at the top, would install the new one under each
// package instead, where the copies would hide an engine checkout linked in at
// the top. Without them it resolves the release afresh and installs it once, at
// the top, where the install's postinstall links a checkout back in.
const lockfile = join(root, "package-lock.json");
const lock = JSON.parse(readFileSync(lockfile, "utf8"));
for (const path of Object.keys(lock.packages)) {
    if (path.endsWith(`node_modules/${wasm}`)) delete lock.packages[path];
}
writeFileSync(lockfile, `${JSON.stringify(lock, null, 4)}\n`);
execFileSync("npm", ["install"], { cwd: root, stdio: "inherit" });

// udoc-ui generates the engine's version from the one installed, which is the
// checkout when one is linked in: that has to be at the release too.
const engine = JSON.parse(readFileSync(join(root, "node_modules", wasm, "package.json"), "utf8")).version;
if (engine === target) {
    execFileSync("npm", ["run", "gen:version", "-w", "@docmentis/udoc-ui"], { cwd: root, stdio: "inherit" });
} else {
    console.warn(
        `[update-engine] the engine linked in from ../docmentis-udoc-engine is ${engine}, not ${target}: ` +
            `bring it to the release, then run \`npm run gen:version -w @docmentis/udoc-ui\`.`,
    );
}

// The packages release on the engine's major and minor version, so a new one
// moves them too.
const minor = (version) => version.split(".").slice(0, 2).join(".");
if (pins.some((pin) => minor(pin) !== minor(target))) {
    console.log(`[update-engine] the engine is on a new minor: the next release here is ${minor(target)}.0.`);
}
