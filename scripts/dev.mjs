// Dev orchestrator: keep the compiled output of udoc-ui and the two packages
// built on it fresh while the demo's Vite server is running, so source edits
// live-reload into the demo, and run udoc-server beside them.
//
// The demo imports `@docmentis/udoc-editor` and `@docmentis/udoc-viewer`, and
// through them `@docmentis/udoc-ui`, by their built `dist/` (not their
// source), and Vite watches that linked output — but nothing recompiles
// `src` -> `dist` on its own. So we:
//
//   1. Build udoc-ui, then the editor and the viewer, once — each package's
//      `tsc --watch` needs the `dist/` of the one it is built on.
//   2. Run each one's `tsc --watch` (src -> dist) alongside the demo's Vite
//      server. Each recompile updates `dist`, and Vite reloads the demo.
//   3. Run udoc-server on its default address, keeping documents in
//      `target/udoc-data/`, beside the build output and as disposable: the
//      demo's Vite server proxies `/documents` to it (see its
//      `vite.config.ts`), so `?document=<id>` opens one it keeps. Its own
//      `tsc --watch` recompiles it, and `node --watch` restarts it on each
//      recompile. `node --watch` starts only once that watcher's first
//      compile is in: started on the `dist/` already there, it would restart
//      the server the moment that compile rewrote it. udoc-server is built
//      on udoc-node, whose `tsc --watch` runs first, for the same reason:
//      the server's watcher compiles against udoc-node's `dist/`, which a
//      fresh clone doesn't have until that watcher's first compile is in.
//
// All of them share this one terminal, so none may clear it. By default the
// `tsc --watch`es clear the screen and scrollback whenever they start
// compiling — once at startup, after Vite has printed its URL, and again on
// every source change — Vite clears it on startup and on every page reload
// or HMR update, which each editor recompile triggers, and `node --watch`
// resets the terminal on every server restart. Hence `--preserveWatchOutput`,
// `--clearScreen false`, and `--watch-preserve-output`.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const npm = (...args) => spawn("npm", args, { stdio: "inherit" });
const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));

const children = [];
let shuttingDown = false;

function shutdown(code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of children) child.kill("SIGINT");
    process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

/** Run each of `builds` in turn, then `then`; exit on the first that fails. */
function inTurn(builds, then) {
    const [first, ...rest] = builds;
    if (!first) return then();
    npm(...first).on("exit", (code) => (code === 0 ? inTurn(rest, then) : process.exit(code ?? 1)));
}

/** Run `child` with the others: if it exits, tear them all down. */
function supervise(child) {
    child.on("exit", (code) => shutdown(code ?? 0));
    children.push(child);
}

/**
 * Run `workspace`'s `tsc --watch`, passing its output through, and call
 * `then` once its first compile is in — tsc ends every compile, errors or
 * not, with "… Watching for file changes.".
 */
function tscWatch(workspace, then) {
    // Piped, tsc no longer sees a terminal; `--pretty` keeps its colours.
    const child = spawn("npm", ["run", "dev", "--workspace", workspace, "--", "--preserveWatchOutput", "--pretty"], {
        stdio: ["inherit", "pipe", "inherit"],
    });
    child.stdout.setEncoding("utf8");
    child.stdout.pipe(process.stdout);
    let output = "";
    child.stdout.on("data", function firstCompile(chunk) {
        output += chunk;
        if (!output.includes("Watching for file changes.")) return;
        child.stdout.off("data", firstCompile);
        then();
    });
    return child;
}

// 1. One-time build: udoc-ui, then the two packages built on it.
const UI_PACKAGES = ["@docmentis/udoc-ui", "@docmentis/udoc-editor", "@docmentis/udoc-viewer"];
inTurn(
    UI_PACKAGES.map((workspace) => ["run", "build", "--workspace", workspace]),
    () => {
        // 2 and 3. Watch the UI packages', udoc-node's and the server's source ->
        //    dist, serve the demo, and run the server once its first compile is
        //    in, which waits on udoc-node's. If any of them exits, tear the
        //    others down too.
        for (const workspace of UI_PACKAGES) {
            supervise(npm("run", "dev", "--workspace", workspace, "--", "--preserveWatchOutput"));
        }
        supervise(npm("run", "dev", "--workspace", "@docmentis/udoc-demo", "--", "--clearScreen", "false"));
        supervise(
            tscWatch("@docmentis/udoc-node", () =>
                supervise(
                    tscWatch("@docmentis/udoc-server", () =>
                        supervise(
                            spawn(
                                process.execPath,
                                [
                                    "--watch",
                                    "--watch-preserve-output",
                                    root("packages/udoc-server/dist/main.js"),
                                    "--data-dir",
                                    root("target/udoc-data"),
                                ],
                                { stdio: "inherit" },
                            ),
                        ),
                    ),
                ),
            ),
        );
    },
);
