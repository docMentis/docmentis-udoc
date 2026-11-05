// The log cut with the real editor, its real worker and the real server, in
// headless Chrome (scripts/e2e.mjs). The checks are scripts/e2e-browser-page.mjs,
// which Vite serves on the packages as `npm run build` left them, with the server
// behind it so that the page reaches both from one origin.
//
// The browser is the machine's Chrome, as scripts/headless.mjs says, or else
// Playwright's Chromium.
/* global window */
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { check, finish, serve, temporaryStore, upload } from "./e2e-harness.mjs";
import { root } from "./packages.mjs";

/** A document of each type whose count of pages or sheets an edit changes, and that edit. */
const DOCUMENTS = {
    portable: {
        file: "pdf/nasa-hubble-fact-sheet-mission-operations.pdf",
        insert: { portable: { editPage: { command: { insertPage: { index: 0 } } } } },
    },
    presentation: {
        file: "pptx/james-webb-space-telescope.pptx",
        insert: { presentation: { editSlide: { command: { insertSlide: { index: 0 } } } } },
    },
    spreadsheet: {
        file: "xlsx/nasa_asp_schedule_2026_01.xlsx",
        insert: { spreadsheet: {} },
    },
};

const only = process.argv[2];
const store = await temporaryStore();
const backend = await serve(store.directory, { sessionTimeoutMs: 400, cutMinSavedBytes: 0 });

// A Vite cache of its own, so that this can't disturb a running `npm run dev`.
const cacheDir = mkdtempSync(join(tmpdir(), "udoc-e2e-vite-"));
const vite = await createServer({
    configFile: false,
    root: join(root, "scripts"),
    publicDir: false,
    cacheDir,
    logLevel: "warn",
    // As the demo's config says: their import.meta.urls find the engine's files.
    optimizeDeps: {
        noDiscovery: true,
        exclude: ["@docmentis/udoc-editor", "@docmentis/udoc-ui", "@docmentis/udoc-wasm"],
    },
    server: {
        host: "127.0.0.1",
        port: 5301,
        hmr: false,
        watch: null,
        fs: { allow: [root, realpathSync(join(root, "node_modules/@docmentis/udoc-wasm"))] },
        proxy: { "/documents": { target: backend.base, ws: true } },
    },
});
await vite.listen();

const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
try {
    for (const [type, { file, insert }] of Object.entries(DOCUMENTS)) {
        if (only && only !== type) continue;
        console.log(`\n[e2e] === ${type} (${file})`);
        const id = await upload(backend.base, { file });
        const context = await browser.newContext();
        const page = await context.newPage();
        const fetched = new Set();
        const uncaught = [];
        page.on("request", (request) => {
            const route = /\/package\/(.+)$/.exec(new URL(request.url()).pathname)?.[1];
            if (route) fetched.add(route);
        });
        page.on("pageerror", (error) => uncaught.push(error.message));
        await page.goto(`${vite.resolvedUrls.local[0]}e2e-browser.html`);
        await page.waitForFunction("window.cutReady === true", null, { timeout: 120_000 });
        const results = await page.evaluate(([document, command]) => window.runCut(document, command), [id, insert]);
        for (const { name, ok, detail } of results) check(name, ok, detail);
        // Fetched by the browser itself, on its way back from behind each cut.
        for (const route of ["cuts", "cuts/1/crdt", "cuts/2/crdt"]) {
            check(`the browser fetched package/${route}`, fetched.has(route));
        }
        check("nothing uncaught in the page", uncaught.length === 0, uncaught.slice(0, 4).join(" | "));
        await context.close();
    }
} finally {
    await browser.close();
    await vite.close();
    await backend.close();
    await store.remove();
    rmSync(cacheDir, { recursive: true, force: true });
}
finish();
