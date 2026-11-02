// `npm run mainshock`: run examples/mainshock, the sales enablement app, in
// development, from the repo's root (docs/design/examples-mainshock.md).
//
// Mainshock is an app of its own, linked to the packages this checkout builds
// by `file:` dependencies. So first:
//
//   1. Install its dependencies, when it has none, or its package.json has
//      changed since they were installed.
//   2. Build each package it runs on that has no build yet, each after the
//      ones it's built on. A package built already is left as it is: the
//      root's `npm run dev` keeps the browser packages' builds fresh as their
//      source changes, its watchers may be writing them now, and
//      `npm run build` rebuilds the rest.
//
// Then run mainshock's own `npm run dev`: its backend, and Vite serving its
// pages on http://localhost:5280.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { root } from "./packages.mjs";

const app = join(root, "examples", "mainshock");

/** The packages mainshock runs on, each after the ones it's built on. */
const PACKAGES = ["udoc-ui", "udoc-editor", "udoc-viewer", "udoc-node", "udoc-server"];

/** Run npm with `args` in `cwd`; exit if it fails. */
function npm(cwd, ...args) {
    const { status } = spawnSync("npm", args, { cwd, stdio: "inherit" });
    if (status !== 0) process.exit(status ?? 1);
}

// What the linked packages import resolves from the repo's own install.
if (!existsSync(join(root, "node_modules"))) {
    console.error("[mainshock] the repo's dependencies aren't installed: run `npm install` first");
    process.exit(1);
}

// npm writes this beside what it installs.
const installed = join(app, "node_modules", ".package-lock.json");
if (!existsSync(installed) || statSync(join(app, "package.json")).mtimeMs > statSync(installed).mtimeMs) {
    console.log("[mainshock] installing its dependencies");
    npm(app, "install", "--no-audit", "--no-fund");
}

for (const name of PACKAGES) {
    if (existsSync(join(root, "packages", name, "dist", "index.js"))) continue;
    console.log(`[mainshock] building @docmentis/${name}, which isn't built yet`);
    npm(root, "run", "build", "--workspace", `@docmentis/${name}`);
}

const dev = spawn("npm", ["run", "dev"], { cwd: app, stdio: "inherit" });
// Ctrl-C reaches mainshock's processes as well as this one, which waits for
// them to stop.
process.on("SIGINT", () => {});
process.on("SIGTERM", () => dev.kill("SIGTERM"));
dev.on("exit", (code) => process.exit(code ?? 0));
