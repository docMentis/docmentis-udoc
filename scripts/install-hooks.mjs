// Turn on this repo's hooks in `.githooks/`, so the pre-commit check runs.
//
// Belt-and-suspenders, as in docmentis-udoc-engine's `just setup-hooks`: point
// core.hooksPath at `.githooks`, AND link the hook into the default
// `.git/hooks/pre-commit`. External Git GUIs and IDEs reset core.hooksPath to
// `.git/hooks` now and then, which would silently turn `.githooks` off; the
// link keeps the hook firing whichever path wins. A `pre-commit` of the user's
// own already there is left alone, with a warning.
//
// Run by `npm install` (prepare). Outside a git checkout — a downloaded archive
// — there is nothing to commit and it does nothing.
import { execFileSync } from "node:child_process";
import { lstatSync, mkdirSync, symlinkSync, unlinkSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

try {
    git("rev-parse", "--git-dir");
} catch {
    process.exit(0);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
git("config", "core.hooksPath", ".githooks");

// The default hooks directory, not `--git-path hooks`, which follows
// core.hooksPath.
const hooks = join(resolve(root, git("rev-parse", "--git-common-dir")), "hooks");
const link = join(hooks, "pre-commit");
const existing = lstatSync(link, { throwIfNoEntry: false });
if (existing && !existing.isSymbolicLink()) {
    console.warn(`[install-hooks] ${relative(root, link)} is a hook of your own; not linking .githooks/pre-commit.`);
} else {
    mkdirSync(hooks, { recursive: true });
    if (existing) unlinkSync(link);
    symlinkSync(relative(hooks, join(root, ".githooks/pre-commit")), link);
}
