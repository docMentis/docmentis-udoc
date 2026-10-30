// Dev orchestrator: keep the compiled output of udoc-ui and the two packages
// built on it fresh while the demo's Vite server is running, so source edits
// live-reload into the demo.
//
// The demo imports `@docmentis/udoc-editor` and `@docmentis/udoc-viewer`, and
// through them `@docmentis/udoc-ui`, by their built `dist/` (not their
// source), and Vite watches that linked output — but nothing recompiles
// `src` -> `dist` on its own. So we:
//
//   1. Build udoc-ui, then the editor and the viewer, once — each package's
//      `tsc --watch` needs the `dist/` of the one it is built on. Each one's
//      `compile`, into the `dist/` already there: its `build` cleans that
//      first, as a release's must hold nothing a source no longer makes, but
//      a file a deleted source left costs a dev session nothing.
//   2. Run each one's `tsc --watch` (src -> dist) alongside the demo's Vite
//      server. Each recompile updates `dist`, and Vite reloads the demo.
//
// All of them share this one terminal, so none may clear it. By default the
// `tsc --watch`es clear the screen and scrollback whenever they start
// compiling — once at startup, after Vite has printed its URL, and again on
// every source change — and Vite clears it on startup and on every page
// reload or HMR update, which each editor recompile triggers. Hence
// `--preserveWatchOutput` and `--clearScreen false`.
import { spawn } from "node:child_process";

const npm = (...args) => spawn("npm", args, { stdio: "inherit" });

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

// 1. One-time build: udoc-ui, then the two packages built on it.
const UI_PACKAGES = ["@docmentis/udoc-ui", "@docmentis/udoc-editor", "@docmentis/udoc-viewer"];
inTurn(
    UI_PACKAGES.map((workspace) => ["run", "compile", "--workspace", workspace]),
    () => {
        // 2. Watch the UI packages' source -> dist and serve the demo. If any
        //    of them exits, tear the others down too.
        for (const workspace of UI_PACKAGES) {
            supervise(npm("run", "dev", "--workspace", workspace, "--", "--preserveWatchOutput"));
        }
        supervise(npm("run", "dev", "--workspace", "@docmentis/udoc-demo", "--", "--clearScreen", "false"));
    },
);
