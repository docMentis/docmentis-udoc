// The packages a release publishes: every workspace not marked private.
//
// Used by scripts/release.mjs, which moves them to the release's version, and
// scripts/publish.mjs, which publishes them.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Each published package's directory (as the lockfile keys it), manifest file
 * and manifest, after the published packages it depends on or is built from:
 * the demo, built from the viewer and the editor, goes after them.
 */
export function publishedPackages() {
    const packages = readdirSync(join(root, "packages"))
        .map((dir) => ({ dir: `packages/${dir}`, file: join(root, "packages", dir, "package.json") }))
        .filter(({ file }) => existsSync(file))
        .map((pkg) => ({ ...pkg, manifest: JSON.parse(readFileSync(pkg.file, "utf8")) }))
        .filter(({ manifest }) => !manifest.private);
    const byName = new Map(packages.map((pkg) => [pkg.manifest.name, pkg]));
    const ordered = [];
    const visit = (pkg) => {
        if (ordered.includes(pkg)) return;
        for (const name of Object.keys({ ...pkg.manifest.dependencies, ...pkg.manifest.devDependencies })) {
            if (byName.has(name)) visit(byName.get(name));
        }
        ordered.push(pkg);
    };
    packages.forEach(visit);
    return ordered;
}
