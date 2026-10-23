// Cut a release of the published packages: `npm run release -- patch` (or
// `minor`, `major`, or the version itself, such as 0.8.0 or 0.9.0-beta.1).
//
// The packages release together, at one version, on the major and minor of
// the `@docmentis/udoc-wasm` they pin: a release here needs no engine release,
// and one on a new engine minor (`npm run update-engine`) is that minor's
// first. docs/design/releasing.md has the why.
//
// It sets the version in every published package and in their pins on each
// other, dates the changelog's Unreleased section, builds and runs the checks,
// commits, tags `v<version>` and pushes. The tag is the release:
// .github/workflows/release.yml publishes it to npm, and nothing else does, as
// a build here may run a linked engine checkout (scripts/link-engine.mjs)
// rather than the release the packages pin. Nothing changes until the repo and
// npm pass every check; if a later step fails, this says what is left.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { publishedPackages, root } from "./packages.mjs";

const wasm = "@docmentis/udoc-wasm";
const semver = /^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?$/;

let stage = "check";
let tag;
process.on("exit", (code) => {
    if (code === 0) return;
    const left = {
        change: "Nothing is committed: `git checkout -- .` discards the release's changes.",
        commit: "The release commit is local only: `git reset --hard origin/main` abandons it.",
        push:
            `The release commit and ${tag} are local only: \`git push --atomic origin main ${tag}\` releases them, ` +
            `or \`git tag -d ${tag} && git reset --hard origin/main\` abandons them.`,
    }[stage];
    if (left) console.error(`[release] ${left}`);
});

function die(message) {
    console.error(`[release] ${message}`);
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

/** Run a command where its output shows, and stop the release if it fails. */
function run(command, ...args) {
    try {
        execFileSync(command, args, { cwd: root, stdio: "inherit" });
    } catch {
        die(`\`${[command, ...args].join(" ")}\` failed`);
    }
}

const minorOf = (version) => version.split(".").slice(0, 2).join(".");
/** Whether a's major.minor.patch is above b's, prereleases aside. */
function newer(a, b) {
    const [x, y] = [a, b].map((version) => version.split("-")[0].split(".").map(Number));
    const i = x.findIndex((part, j) => part !== y[j]);
    return i >= 0 && x[i] > y[i];
}

const level = process.argv[2];
if (!level) die("say which release: patch, minor, major, or a version such as 0.9.0");

if (output("git", "branch", "--show-current") !== "main") die("not on main");
if (output("git", "status", "--porcelain") !== "") die("the working tree isn't clean");
run("git", "fetch", "--quiet", "origin", "main");
if (output("git", "rev-parse", "HEAD") !== output("git", "rev-parse", "origin/main")) {
    die("main isn't in step with origin/main");
}

const packages = publishedPackages();
const names = new Set(packages.map(({ manifest }) => manifest.name));
const versions = [...new Set(packages.map(({ manifest }) => manifest.version))];
if (versions.length !== 1) die(`the packages are at different versions (${versions.join(", ")})`);
const current = versions[0];

const engines = [...new Set(packages.map(({ manifest }) => manifest.dependencies?.[wasm]).filter(Boolean))];
if (engines.length !== 1) die(`the packages pin different engines (${engines.join(", ")}): npm run update-engine`);
const engine = engines[0];
if (output("npm", "view", `${wasm}@${engine}`, "version") !== engine) {
    die(`${wasm} ${engine}, which the packages pin, isn't on npm`);
}

let next;
if (["patch", "minor", "major"].includes(level)) {
    const [, major, minor, patch, prerelease] = current.match(semver);
    if (prerelease) die(`${current} is a prerelease: give the version that follows it`);
    const bumped = { patch: [major, minor, +patch + 1], minor: [major, +minor + 1, 0], major: [+major + 1, 0, 0] };
    next = bumped[level].join(".");
} else if (semver.test(level)) {
    next = level;
} else {
    die(`"${level}" isn't patch, minor, major or a version`);
}
if (minorOf(next) !== minorOf(engine)) {
    die(
        newer(`${minorOf(engine)}.0`, next)
            ? `the packages pin ${wasm} ${engine}, so the release is on ${minorOf(engine)}: ` +
                  `\`npm run release -- ${minorOf(engine)}.0\``
            : `${next} is past ${minorOf(engine)}, the major and minor of the engine the packages pin ` +
                  `(${wasm} ${engine}): a new one here waits for one there, and \`npm run update-engine\``,
    );
}

for (const { manifest } of packages) {
    if (output("npm", "view", `${manifest.name}@${next}`, "version") === next) {
        die(`${manifest.name} ${next} is on npm already`);
    }
    const latest = output("npm", "view", manifest.name, "dist-tags.latest");
    if (latest && !newer(next, latest)) die(`${manifest.name} is at ${latest} on npm, and ${next} isn't newer`);
}
tag = `v${next}`;
if (output("git", "rev-parse", "-q", "--verify", `refs/tags/${tag}`) !== null) die(`tag ${tag} already exists`);
if (output("git", "ls-remote", "--tags", "origin", `refs/tags/${tag}`)) die(`tag ${tag} already exists on origin`);

const changelogFile = join(root, "CHANGELOG.md");
const changelog = readFileSync(changelogFile, "utf8");
const unreleased = changelog.match(/^## \[Unreleased\]\n([\s\S]*?)(?=^## |(?![\s\S]))/m);
if (!unreleased?.[1].trim()) die("CHANGELOG.md has nothing under ## [Unreleased] to release");

console.log(`[release] releasing ${current === next ? next : `${current} -> ${next}`} on ${wasm} ${engine}`);

stage = "change";
for (const pkg of packages) {
    pkg.manifest.version = next;
    for (const name of Object.keys(pkg.manifest.dependencies ?? {})) {
        if (names.has(name)) pkg.manifest.dependencies[name] = next;
    }
    writeFileSync(pkg.file, `${JSON.stringify(pkg.manifest, null, 4)}\n`);
}
// Set in place: only the packages' own entries change, which an install would
// redo along with node_modules, linked engine and all.
const lockFile = join(root, "package-lock.json");
const lock = JSON.parse(readFileSync(lockFile, "utf8"));
for (const { dir } of packages) {
    const entry = lock.packages[dir];
    entry.version = next;
    for (const name of Object.keys(entry.dependencies ?? {})) {
        if (names.has(name)) entry.dependencies[name] = next;
    }
}
writeFileSync(lockFile, `${JSON.stringify(lock, null, 4)}\n`);
const now = new Date();
const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, "0")).join("-");
writeFileSync(
    changelogFile,
    changelog.replace(
        "## [Unreleased]\n",
        `## [Unreleased]\n\n## [${next}] - ${date}\n\nBuilt on \`${wasm}\` ${engine}.\n`,
    ),
);

// The build also writes the version each package reports into its src/version.ts.
for (const script of ["build", "typecheck", "test", "lint", "format:check"]) run("npm", "run", script);
const changed = [
    ...(output("git", "diff", "--name-only", "HEAD")?.split("\n") ?? []),
    ...(output("git", "ls-files", "--others", "--exclude-standard")?.split("\n") ?? []),
].filter(Boolean);
const released = new Set([
    "CHANGELOG.md",
    "package-lock.json",
    ...packages.flatMap(({ dir }) => [`${dir}/package.json`, `${dir}/src/version.ts`]),
]);
const stray = changed.filter((file) => !released.has(file));
if (stray.length > 0) die(`the build changed ${stray.join(", ")}, which a release doesn't`);

run("git", "add", "--", ...changed);
run("git", "commit", "--quiet", "-m", `chore: Release ${next}`, "-m", `Built on ${wasm} ${engine}.`);
stage = "commit";
run("git", "tag", "-a", tag, "-m", `udoc ${next}`);
stage = "push";
run("git", "push", "--atomic", "origin", "main", tag);
console.log(`[release] pushed ${tag}: the Release workflow publishes it to npm.`);
