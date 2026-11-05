// Check collaboration end to end: the real udoc-server, the real engine, and
// editors that open a document and join over its WebSocket as a browser's do.
// The packages' own tests run the server on a fake session, so this is the only
// place an edit log, a checkpoint or a log cut meets the engine.
//
// Each suite is a process of its own:
//
//   scripts/e2e-collaboration.mjs   no log cut: editors, checkpoints, undo, restarts
//   scripts/e2e-log-cut.mjs         the server's own cuts, and editors back from behind them
//   scripts/e2e-copies.mjs          the server's copies: what each keeps of the original
//   scripts/e2e-browser.mjs         those cuts with the real editor, in headless Chrome
//
// usage: npm run e2e -- [suite] [document type], after a build. It runs on the
// packages as `npm run build` left them, and on the engine they link or pin. Run
// by .github/workflows/e2e.yml.
import { spawn } from "node:child_process";
import { join } from "node:path";
import { root } from "./packages.mjs";

const SUITES = ["collaboration", "log-cut", "copies", "browser"];

/** A suite with no result by then has stalled, which its own waits should rule out long before. */
const TIMEOUT_MS = 20 * 60_000;

/**
 * How long a suite that has printed its result has to exit. Node can hang in
 * `process.exit` once wasm has run on its main thread, so the result is what a
 * suite printed, not how it ended: with no result printed, it failed.
 */
const EXIT_GRACE_MS = 5000;

const [only, type] = process.argv.slice(2);
if (only && !SUITES.includes(only)) {
    console.error(`[e2e] no suite "${only}": ${SUITES.join(", ")}`);
    process.exit(2);
}

/** Run suite `name`, resolving with whether it printed that nothing failed. */
function runSuite(name) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [join(root, `scripts/e2e-${name}.mjs`), ...(type ? [type] : [])], {
            stdio: ["ignore", "pipe", "inherit"],
        });
        let tail = "";
        let failed;
        const stalled = setTimeout(() => {
            console.error(`[e2e] ${name}: no result after ${TIMEOUT_MS / 60_000} minutes`);
            child.kill("SIGKILL");
        }, TIMEOUT_MS);
        child.stdout.on("data", (chunk) => {
            process.stdout.write(chunk);
            tail = (tail + chunk).slice(-200);
            const result = /^\[e2e\] (\d+) failed$/m.exec(tail);
            if (result && failed === undefined) {
                failed = Number(result[1]);
                setTimeout(() => child.kill("SIGKILL"), EXIT_GRACE_MS).unref();
            }
        });
        child.on("close", () => {
            clearTimeout(stalled);
            resolve(failed === 0);
        });
    });
}

const failedSuites = [];
for (const name of only ? [only] : SUITES) {
    console.log(`\n[e2e] suite: ${name}`);
    if (!(await runSuite(name))) failedSuites.push(name);
}
if (failedSuites.length > 0) {
    console.error(`\n[e2e] FAILED: ${failedSuites.join(", ")}`);
    process.exit(1);
}
console.log("\n[e2e] every suite passed");
