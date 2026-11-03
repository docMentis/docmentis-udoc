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
//      `npm run build` rebuilds the rest. With one exception: a browser
//      package's worker carries a copy of the engine's glue, while the
//      engine's binary is loaded as it is now, so one built before the engine
//      last was is built again, or its worker calls what the binary no longer
//      has. A restart after the engine's rebuilt brings them level.
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

/** The engine's glue, through the repo's link to the engine. */
const GLUE = join(root, "node_modules", "@docmentis", "udoc-wasm", "dist", "wasm", "udoc.js");

/** Each browser package's worker that carries a copy of the engine's glue. */
const WORKERS = {
    "udoc-ui": "dist/worker/local-collaboration-worker-source.js",
    "udoc-editor": "dist/worker/worker-source.js",
    "udoc-viewer": "dist/worker/worker-source.js",
};

/** Why package `name` is built now, or nothing for one left as it is. */
function needsBuild(name) {
    const dir = join(root, "packages", name);
    if (!existsSync(join(dir, "dist", "index.js"))) return "which isn't built yet";
    const worker = WORKERS[name] && join(dir, WORKERS[name]);
    if (worker && (!existsSync(worker) || statSync(worker).mtimeMs < statSync(GLUE).mtimeMs))
        return "whose worker is older than the engine";
    return undefined;
}

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
    const why = needsBuild(name);
    if (!why) continue;
    console.log(`[mainshock] building @docmentis/${name}, ${why}`);
    npm(root, "run", "build", "--workspace", `@docmentis/${name}`);
}

const dev = spawn("npm", ["run", "dev"], { cwd: app, stdio: "inherit" });
// Ctrl-C reaches mainshock's processes as well as this one, which waits for
// them to stop.
process.on("SIGINT", () => {});
process.on("SIGTERM", () => dev.kill("SIGTERM"));
dev.on("exit", (code) => process.exit(code ?? 0));
