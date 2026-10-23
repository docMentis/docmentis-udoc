// Publish a release to npm: every published package at the version its tag
// names, each after the packages it depends on, so that no install finds a
// package it pins missing. One npm has at that version already is skipped, so
// a run that stopped part-way finishes when run again. A prerelease goes out
// under the `next` dist-tag, leaving `latest` on the last release.
//
// Run by .github/workflows/release.yml, after the build and the checks, as
// `node scripts/publish.mjs <version>`. With --dry-run it packs each package
// and uploads nothing.
import { execFileSync } from "node:child_process";
import { publishedPackages, root } from "./packages.mjs";

function die(message) {
    console.error(`[publish] ${message}`);
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

const [version, ...flags] = process.argv.slice(2);
if (!version) die("give the version to publish");
const dryRun = flags.includes("--dry-run");

const packages = publishedPackages();
const others = packages.filter(({ manifest }) => manifest.version !== version);
if (others.length > 0) {
    die(`${others.map(({ manifest }) => `${manifest.name} is at ${manifest.version}`).join(", ")}, not ${version}`);
}

const distTag = version.includes("-") ? "next" : "latest";
for (const { manifest } of packages) {
    if (output("npm", "view", `${manifest.name}@${version}`, "version") === version) {
        console.log(`[publish] ${manifest.name} ${version} is on npm already`);
        continue;
    }
    try {
        const args = ["publish", "-w", manifest.name, "--tag", distTag, ...(dryRun ? ["--dry-run"] : [])];
        execFileSync("npm", args, { cwd: root, stdio: "inherit" });
    } catch {
        die(`publishing ${manifest.name} failed: run this again to publish it and the packages after it`);
    }
}
