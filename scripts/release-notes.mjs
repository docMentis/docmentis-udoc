// Print a release's section of the changelog, for its GitHub Release: what
// follows its `## [<version>]` heading, up to the next release's. Links to the
// repo's files are made absolute, to the files at the release's tag, as a
// release's page would resolve them against itself.
//
// Run by .github/workflows/release.yml, as `node scripts/release-notes.mjs <version>`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { publishedPackages, root } from "./packages.mjs";

const version = process.argv[2];
if (!version) {
    console.error("[release-notes] give the version whose notes to print");
    process.exit(1);
}

const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
const heading = `## [${version}]`;
const start = changelog.split("\n").findIndex((line) => line.startsWith(`${heading} `) || line === heading);
if (start < 0) {
    console.error(`[release-notes] CHANGELOG.md has no ${heading}`);
    process.exit(1);
}
const lines = changelog.split("\n").slice(start + 1);
const end = lines.findIndex((line) => line.startsWith("## "));
const section = lines
    .slice(0, end < 0 ? undefined : end)
    .join("\n")
    .trim();

// The repository every published package names, as https://github.com/<owner>/<repo>.
const repository = publishedPackages()[0]
    .manifest.repository.url.replace(/^git\+/, "")
    .replace(/\.git$/, "");
const notes = section.replace(/\]\((?![a-z][a-z+.-]*:|#)([^)]+)\)/g, `](${repository}/blob/v${version}/$1)`);
process.stdout.write(`${notes}\n`);
