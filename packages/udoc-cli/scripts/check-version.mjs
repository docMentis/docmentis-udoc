// Fail the build when this package and `@docmentis/udoc-node` disagree on a
// version.
//
// The CLI is built on udoc-node, and the two release as one: the same version,
// with the CLI depending on exactly the udoc-node of that version. A build that
// finds them apart fails here, rather than shipping a CLI that reports one
// version and runs another host.
//
// Run by `npm run build`.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(here, "../package.json"), "utf8"));
const node = JSON.parse(readFileSync(join(here, "../../udoc-node/package.json"), "utf8"));

const pin = manifest.dependencies?.[node.name];
if (manifest.version !== node.version || pin !== node.version) {
    console.error(
        `[check-version] ${manifest.name} ${manifest.version} must match ${node.name} ${node.version} ` +
            `and depend on exactly it (depends on ${JSON.stringify(pin)})`,
    );
    process.exit(1);
}
