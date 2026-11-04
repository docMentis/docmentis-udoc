// Check the viewer and the editor headless, created with `null` for their
// container, in a browser: everything a `null` changes is out of the reach of
// the packages' `node --test` tests, which have no DOM.
//
// The checks are scripts/headless-page.mjs, which Vite serves with the demo's
// sample documents, as it serves the demo, so this runs on the packages as
// `npm run build` or `npm run dev` left them. It passes when each check does,
// with no uncaught error.
//
// Run by `npm run headless`, after a build, and by
// .github/workflows/examples.yml. The browser is the machine's Chrome, which
// CI's runners have, or else Playwright's Chromium, which
// `npx playwright install chromium` fetches.
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { root } from "./packages.mjs";

/** The whole run, which a stalled check's own timeout should end long before. */
const TIMEOUT_MS = 480_000;

let failed = 0;

// Outside a browser, where `null` is the only container there can be: `create`
// says it can't run here, by a rejection.
for (const [name, load] of [
    ["viewer", async () => (await import("@docmentis/udoc-viewer")).UDocViewer],
    ["editor", async () => (await import("@docmentis/udoc-editor")).UDocEditor],
]) {
    const Class = await load();
    const code = await Class.create(null).then(
        () => "nothing: it resolved",
        (error) => error.code ?? error.message,
    );
    const ok = code === "unsupported";
    console.log(
        `[headless] ${ok ? "ok" : "FAILED"}  ${name}: create(null) in Node rejects${ok ? "" : ` with ${code}`}`,
    );
    if (!ok) failed++;
}

// A Vite cache of its own, so that this can't disturb a running `npm run dev`.
const cacheDir = mkdtempSync(join(tmpdir(), "udoc-headless-"));
const server = await createServer({
    configFile: false,
    root: join(root, "scripts"),
    publicDir: join(root, "packages/udoc-demo/public"),
    cacheDir,
    logLevel: "warn",
    // As the demo's config says: their import.meta.urls find the engine's files.
    optimizeDeps: {
        noDiscovery: true,
        exclude: ["@docmentis/udoc-editor", "@docmentis/udoc-viewer", "@docmentis/udoc-ui", "@docmentis/udoc-wasm"],
    },
    server: {
        host: "127.0.0.1",
        port: 5300,
        hmr: false,
        watch: null,
        fs: { allow: [root, realpathSync(join(root, "node_modules/@docmentis/udoc-wasm"))] },
    },
});
await server.listen();

const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
const page = await browser.newPage();
const uncaught = [];
page.on("pageerror", (error) => uncaught.push(error.message));
page.setDefaultTimeout(TIMEOUT_MS);

try {
    await page.goto(`${server.resolvedUrls.local[0]}headless.html`);
    await page.waitForFunction("window.headlessReady === true");
    for (const { name, ok, error } of await page.evaluate("window.runHeadless()")) {
        console.log(`[headless] ${ok ? "ok" : "FAILED"}  ${name}${ok ? "" : `: ${error}`}`);
        if (!ok) failed++;
    }
    for (const message of uncaught) {
        console.error(`[headless] uncaught: ${message}`);
        failed++;
    }
} finally {
    await browser.close();
    await server.close();
    rmSync(cacheDir, { recursive: true, force: true });
}
if (failed > 0) {
    console.error(`[headless] ${failed} failed`);
    process.exit(1);
}
console.log("[headless] every check passed");
