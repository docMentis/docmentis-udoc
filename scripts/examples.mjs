// Build each example in examples/ against the packages this checkout builds,
// installed the way an app installs them, and open it in a browser.
//
// An example is an app of its own, which installs @docmentis/udoc-viewer and
// @docmentis/udoc-editor from npm. Here each one is copied out of the repo, so
// that nothing resolves through the workspace's node_modules, and installed
// with udoc-ui, the viewer and the editor packed from this checkout in npm's
// place; the engine, @docmentis/udoc-wasm, comes from npm at the version they
// pin. It is built for production, served, and opened in headless Chromium.
// It passes when the viewer and the editor each show a rendered page, with no
// console error, no uncaught error and no failed request: the bundler kept the
// engine's binary, its fonts and the workers where the packages find them.
//
// Run by `npm run examples` (every example) or `npm run examples -- <name>…`,
// after `npm run build`, and by .github/workflows/examples.yml, an example a
// job. A run here packs the dist/ as built, so with an engine checkout linked
// in (scripts/link-engine.mjs) the workers carry that checkout's glue. The
// browser is the machine's Chrome, which CI's runners have, or else
// Playwright's Chromium, which `npx playwright install chromium` fetches.
import { execFileSync } from "node:child_process";
import {
    cpSync,
    createReadStream,
    existsSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    statSync,
    writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { basename, extname, join, normalize, sep } from "node:path";
import { chromium } from "playwright";
import { root } from "./packages.mjs";

const examples = join(root, "examples");

/** What an example installs of this checkout's, packed. */
const PACKED = ["@docmentis/udoc-ui", "@docmentis/udoc-viewer", "@docmentis/udoc-editor"];

/** Where an example's production build leaves its static site, when not `dist/`. */
const SITE = {
    angular: "dist/angular/browser",
    nuxt: ".output/public",
    "nextjs-turbopack": "out",
    "nextjs-webpack": "out",
    "no-bundler": ".",
};

/** What an install or a build leaves in an example, which its copy leaves out. */
const LEFT_OUT = new Set(["node_modules", "dist", "out", ".next", ".nuxt", ".output", ".angular", "package-lock.json"]);

/** How long the viewer and the editor have to show a page. */
const TIMEOUT_MS = 90_000;

/** The share of a canvas's pixels that must differ from its background. */
const INKED = 0.05;

const TYPES = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".map": "application/json",
    ".wasm": "application/wasm",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".txt": "text/plain",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function die(message) {
    console.error(`[examples] ${message}`);
    process.exit(1);
}

/** The frameworks' telemetry, and the Angular CLI's question about it, off. */
const QUIET = { NEXT_TELEMETRY_DISABLED: "1", NUXT_TELEMETRY_DISABLED: "1", NG_CLI_ANALYTICS: "false" };

/** Run a command in `cwd` where its output shows; throws when it fails. */
function run(cwd, command, ...args) {
    execFileSync(command, args, { cwd, stdio: "inherit", env: { ...process.env, ...QUIET } });
}

/** Pack the packages an example installs into `into`, and return the tarballs. */
function pack(into) {
    for (const name of PACKED) {
        if (!existsSync(join(root, "packages", name.split("/")[1], "dist"))) {
            die(`${name} isn't built: run \`npm run build\` first`);
        }
    }
    const args = ["pack", ...PACKED.flatMap((name) => ["--workspace", name]), "--pack-destination", into, "--json"];
    const packed = JSON.parse(execFileSync("npm", args, { cwd: root, encoding: "utf8" }));
    return packed.map(({ filename }) => join(into, filename));
}

/**
 * Point a page that maps the packages to a CDN, as the no-bundler example's
 * import map does, at what was installed instead: the packages packed here
 * aren't on any CDN.
 */
function localize(dir) {
    const cdn = /https:\/\/cdn\.jsdelivr\.net\/npm\/(@docmentis\/udoc-[a-z]+)@[^/"]+\//g;
    for (const file of readdirSync(dir).filter((name) => name.endsWith(".html"))) {
        const text = readFileSync(join(dir, file), "utf8");
        writeFileSync(join(dir, file), text.replace(cdn, "/node_modules/$1/"));
    }
}

/** Serve `dir` on a free port of the loopback address. */
function serve(dir) {
    const server = createServer((request, response) => {
        const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
        let file = normalize(join(dir, path));
        if (file !== dir && !file.startsWith(dir + sep)) return void response.writeHead(403).end();
        if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
        // Chrome asks every page for an icon; a site that has none isn't wrong.
        if (!existsSync(file) && path === "/favicon.ico") return void response.writeHead(204).end();
        if (!existsSync(file)) return void response.writeHead(404).end();
        response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
        createReadStream(file).pipe(response);
    });
    return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

/* global document, Image -- inked runs in the page, which has them. */
/** The share of a PNG's pixels that aren't its commonest colour. Runs in the page. */
async function inked(png) {
    const image = new Image();
    image.src = `data:image/png;base64,${png}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, image.width, image.height);
    const counts = new Map();
    for (let i = 0; i < data.length; i += 4) {
        const colour = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
        counts.set(colour, (counts.get(colour) ?? 0) + 1);
    }
    return 1 - Math.max(...counts.values()) / (data.length / 4);
}

/** How many of the page's viewers and editors show a rendered page. */
async function rendered(page) {
    let count = 0;
    for (const ui of await page.locator(".udoc-ui-root").all()) {
        const loading = ui.locator(".udoc-loading");
        if ((await loading.count()) > 0 && (await loading.first().isVisible())) continue;
        const canvas = ui.locator(".udoc-ui__canvas");
        if ((await canvas.count()) === 0) continue;
        const shot = await canvas.first().screenshot();
        if ((await page.evaluate(inked, shot.toString("base64"))) > INKED) count++;
    }
    return count;
}

/**
 * Open `url`, and return what went wrong (nothing when both show a page) and
 * the hosts besides its own that it fetched from.
 */
async function check(browser, url) {
    const problems = [];
    const elsewhere = new Set();
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const origin = new URL(url).origin;
    let engine = false;
    page.on("request", (request) => {
        const from = new URL(request.url());
        if (from.origin === origin) engine ||= from.pathname.endsWith(".wasm");
        if (from.origin === origin || from.protocol === "data:" || from.protocol === "blob:") return;
        // The engine falls back to its copy on a CDN when it can't find the
        // one the bundler emitted: a page would work, but the bundling didn't.
        if (from.hostname === "cdn.jsdelivr.net") problems.push(`fetched from the CDN, not the app: ${from}`);
        else elsewhere.add(from.hostname);
    });
    page.on("console", (message) => {
        const where = message.location().url;
        if (message.type() === "error") problems.push(`console error: ${message.text()}${where ? ` (${where})` : ""}`);
    });
    page.on("pageerror", (error) => problems.push(`uncaught: ${error.message}`));
    page.on("requestfailed", (request) => problems.push(`failed: ${request.url()} (${request.failure()?.errorText})`));
    page.on("response", (response) => {
        if (response.status() >= 400) problems.push(`${response.status()}: ${response.url()}`);
    });
    await page.goto(url);
    const deadline = Date.now() + TIMEOUT_MS;
    let shown = 0;
    while (shown < 2 && problems.length === 0 && Date.now() < deadline) {
        await page.waitForTimeout(500);
        shown = await rendered(page);
    }
    // What a page fetches once it is drawn, such as another font, fails late.
    await page.waitForTimeout(1000);
    if (shown < 2 && problems.length === 0) problems.push(`${shown} of the viewer and the editor showed a page`);
    if (!engine) problems.push("the engine's binary wasn't fetched from the app");
    await page.close();
    return { problems, elsewhere: [...elsewhere].sort() };
}

const names =
    process.argv.length > 2
        ? process.argv.slice(2)
        : readdirSync(examples).filter((name) => existsSync(join(examples, name, "package.json")));
for (const name of names) {
    if (!existsSync(join(examples, name, "package.json"))) die(`examples/${name} isn't an example`);
}

const work = mkdtempSync(join(tmpdir(), "udoc-examples-"));
const tarballs = pack(work);
const browser = await chromium
    .launch({ channel: "chrome" })
    .catch(() => chromium.launch())
    .catch((error) => die(`${error.message}\nInstall Chrome, or run \`npx playwright install chromium\`.`));
const failed = [];
for (const name of names) {
    console.log(`[examples] ${name}`);
    const dir = join(work, name);
    try {
        cpSync(join(examples, name), dir, { recursive: true, filter: (source) => !LEFT_OUT.has(basename(source)) });
        run(dir, "npm", "install", "--no-audit", "--no-fund", ...tarballs);
        run(dir, "npm", "run", "build", "--if-present");
        localize(dir);
        const server = await serve(join(dir, SITE[name] ?? "dist"));
        const { problems, elsewhere } = await check(browser, `http://127.0.0.1:${server.address().port}/`);
        server.close();
        if (problems.length > 0) throw new Error(problems.join("\n"));
        const also = elsewhere.length > 0 ? `, fetching from ${elsewhere.join(", ")} too` : "";
        console.log(`[examples] ${name}: the viewer and the editor each showed a page${also}`);
    } catch (error) {
        failed.push(name);
        console.error(`[examples] ${name} failed:\n${error.message}`);
    }
}
await browser.close();
if (failed.length > 0) die(`${failed.join(", ")} failed; their copies are in ${work}`);
rmSync(work, { recursive: true, force: true });
