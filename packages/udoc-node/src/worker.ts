// The worker thread that holds one document's session.
//
// One document, one worker, one wasm instance. The session's calls are
// synchronous and CPU-bound — composing and rasterizing a page holds the thread
// for as long as it takes — so they run here, off the embedder's event loop.
// And since a trap leaves an instance unusable, an instance per document means
// a document that brings the engine down takes nothing else with it.

import { readFile } from "node:fs/promises";
import { parentPort, workerData } from "node:worker_threads";
import type { MessagePort } from "node:worker_threads";

import {
    UDocError,
    createFontFetchMemory,
    fetchFontBinaries,
    initSync,
    officeCompatibleFontsAt,
    startSession,
} from "@docmentis/udoc-wasm";
import type { UrlFont, WasmSession } from "@docmentis/udoc-wasm";
import { bundledFontUrls } from "@docmentis/udoc-wasm/meta-url";

import { blockingFetch } from "./blocking-fetch.js";
import type {
    FontFileAnswer,
    FontFileRequest,
    Opened,
    WorkerFailure,
    WorkerInit,
    WorkerReply,
    WorkerRequest,
} from "./protocol.js";

const init = workerData as WorkerInit;
initSync({ module: init.module });

const port = parentPort!;

/** The document's session, once `open` has started one. */
let session: WasmSession | null = null;

/** The page limit that composes every page: the largest wasm32 `usize`. */
const WHOLE_DOCUMENT = 2 ** 32 - 1;

/** What the fulfiller remembers across this document's font orders: the css2
 *  responses it has read, and the files it has handed over. */
const fontMemory = createFontFetchMemory();

/** Where a font file is asked for, once the open has carried it: the session's
 *  side, which keeps the files for every document of its `UDocNode`. */
let fontFiles: MessagePort | null = null;
/** The font files asked for and not answered yet, by their request's id. */
const fontFilesPending = new Map<number, { resolve(body: ArrayBuffer): void; reject(error: Error): void }>();
let nextFontFileId = 1;

/** The request being handled, which the next one waits behind. */
let handling: Promise<void> = Promise.resolve();

port.on("message", (request: WorkerRequest) => {
    // One at a time. A call that composes waits for its fonts partway through,
    // and nothing else may touch the session while it does.
    handling = handling.then(async () => {
        const reply = await handle(request);
        // Saved or exported bytes are a fresh copy out of wasm memory, so their
        // buffer is this reply's alone to hand over.
        const transfer = reply.ok && reply.result instanceof Uint8Array ? [reply.result.buffer as ArrayBuffer] : [];
        port.postMessage(reply, transfer);
    });
});

async function handle(request: WorkerRequest): Promise<WorkerReply> {
    const { id } = request;
    try {
        switch (request.type) {
            case "open":
            case "openRemote":
                fontFiles = request.fontFiles;
                fontFiles.on("message", settleFontFile);
                // Permitted first, then the permit is spent on this document
                // whether or not it parses: one session, one permit, one document.
                session = await startSession(init.config, bundledFontUrls, init.googleFontFamilies);
                // The host's own fonts first: of two faces on one descriptor,
                // the first registered answers, so a host's face outranks the
                // package's — as in a browser, where the package's go in by URL
                // and every face given as bytes outranks those.
                registerHostFonts(session);
                // The office-compatible fonts are files beside the engine, not
                // inside it. By URL, nearly every office document would compose
                // once in a stand-in and again when they landed, so they go in
                // as bytes, before the document opens.
                for (const bytes of await officeCompatibleFonts()) session.registerLocalFont(bytes);
                if (request.type === "open") session.open(request.bytes, request.format, request.delimiter);
                // The session keeps the fetch: a page composed later may need a
                // part not fetched yet.
                else session.openRemote(request.url, blockingFetch(request.fetches));
                return { id, ok: true, result: openedAs(session) };
            case "authenticate":
                // Not a second open: the permit was spent on this document by
                // the open that found it needs a password.
                if (!session) throw new UDocError("invalidRequest", "no document is open");
                return { id, ok: true, result: session.authenticate(request.password) };
            case "pageCount": {
                const s = opened();
                // Nothing is known about a page until it is composed, so the
                // count is known only once every page is: compose the whole
                // primary plane. A pass that falls short had a page fail, and
                // then the count is not known at all.
                if (!(await updateLayoutSettled(s, WHOLE_DOCUMENT))) {
                    throw new UDocError(
                        "malformed",
                        `the page count is unknown: a page failed to compose after ${s.composedPageCount()} page(s)`,
                    );
                }
                return { id, ok: true, result: s.composedPageCount() };
            }
            case "saveToBytes":
                return {
                    id,
                    ok: true,
                    result: opened().saveToBytes(request.format, request.strategy, request.delimiter),
                };
            case "saveToPackage":
                return { id, ok: true, result: opened().saveToPackage(request.version) };
            case "exportToBytes":
                return { id, ok: true, result: opened().exportToBytes(request.format) };
            case "exportPageToBytes": {
                const s = opened();
                // A page is known only once composed, so compose through the
                // one asked for — not the whole document. If the pass finishes
                // the document short of it, the page doesn't exist.
                const complete = await updateLayoutSettled(s, request.index);
                const count = s.composedPageCount();
                if (request.index >= count) {
                    if (complete) {
                        // Says what the document has, not which page was asked
                        // for: a host numbers pages its own way (the CLI from
                        // 1) and words the address itself.
                        const message = `the document has ${count} page(s)`;
                        return { id, ok: false, failure: { code: "notFound", message } };
                    }
                    throw new UDocError(
                        "malformed",
                        `page index ${request.index} is not composed: the document composed ${count} page(s)`,
                    );
                }
                // Plane 0 — the document's primary plane (the deck for a
                // presentation).
                return { id, ok: true, result: s.exportPageToBytes(0, request.index, request.format) };
            }
            case "snapshot":
                return { id, ok: true, result: opened().snapshot() };
            case "versionVector":
                return { id, ok: true, result: opened().versionVector() };
            case "patchSince":
                return { id, ok: true, result: opened().patchSince(request.peer) };
            case "merge":
                opened().mergePatch(request.patch);
                return { id, ok: true, result: undefined };
            case "presence":
                return { id, ok: true, result: opened().presence() };
            case "mergePresence":
                opened().mergePresence(request.presence);
                return { id, ok: true, result: undefined };
        }
    } catch (error) {
        return { id, ok: false, failure: failureOf(error) };
    }
}

function opened(): WasmSession {
    if (!session) throw new UDocError("invalidRequest", "no document is open");
    // Said here, for every call, rather than as whichever call it was failing
    // for want of a document.
    if (session.needsPassword()) {
        throw new UDocError("passwordRequired", "the document needs a password: authenticate it first");
    }
    return session;
}

/** The office-compatible fonts `@docmentis/udoc-wasm` ships, read from its
 *  `dist/fonts/` — `file:` URLs under Node. */
function officeCompatibleFonts(): Promise<Uint8Array[]> {
    return Promise.all(officeCompatibleFontsAt(bundledFontUrls).map((font) => readFile(new URL(font.url))));
}

/** Offer `s` the host's own fonts: bytes as they are, the rest by URL. */
function registerHostFonts(s: WasmSession): void {
    const urlFonts: UrlFont[] = [];
    for (const font of init.fonts) {
        if (font instanceof Uint8Array) s.registerLocalFont(font);
        else urlFonts.push(font);
    }
    s.registerUrlFonts(urlFonts);
}

/**
 * Compose through page `index`, then fill every font order the composing
 * placed and compose again, until none is left — so what a call answers with
 * is drawn in the document's fonts, never in the stand-in a font still on order
 * is drawn in. Whether the document composed to its end, as `updateLayout`
 * says it.
 *
 * It ends: each settled order installs its font or retires its characters from
 * that vendor — putting the next one on order — and a family's chain of vendors
 * is finite.
 */
async function updateLayoutSettled(s: WasmSession, index: number): Promise<boolean> {
    let complete = s.updateLayout({ pages: { start: 0, limit: index } });
    for (let orders = s.takeFontRequests(); orders.length > 0; orders = s.takeFontRequests()) {
        const settled = await Promise.all(
            orders.map(
                async (order) =>
                    [order.id, await fetchFontBinaries(order, fetchFont, fontMemory, init.googleFontEndpoint)] as const,
            ),
        );
        for (const [id, binaries] of settled) s.completeFontRequest(BigInt(id), binaries);
        // A round of nothing but refusals installed nothing, so there is nothing
        // to re-shape; the next vendors are already on order.
        if (settled.every(([, binaries]) => binaries.length === 0)) continue;
        s.refreshFonts();
        // Re-shaping can move page breaks, so the page asked for may sit
        // beyond what is composed now.
        complete = s.updateLayout({ pages: { start: 0, limit: index } });
    }
    return complete;
}

/** How the fulfiller fetches under Node: a `file:` URL — the package's fonts,
 *  or a host's — read from disk, which Node's `fetch` can't; a css2 stylesheet
 *  by `fetch`, each time; any other file from the cache every session of this
 *  document's `UDocNode` shares. */
async function fetchFont(url: string, requestInit?: RequestInit): Promise<Response> {
    if (url.startsWith("file:")) return new Response(await readFile(new URL(url)));
    if (url.startsWith(`${init.googleFontEndpoint}?`)) return fetch(url, requestInit);
    return new Response(await fetchCachedFont(url));
}

/** The font file at `url`, asked of the session's side, which keeps it. */
function fetchCachedFont(url: string): Promise<ArrayBuffer> {
    const files = fontFiles;
    if (!files) return Promise.reject(new Error("no document is open"));
    const id = nextFontFileId++;
    return new Promise((resolve, reject) => {
        fontFilesPending.set(id, { resolve, reject });
        files.postMessage({ id, url } satisfies FontFileRequest);
    });
}

/** Settle the font file `answer` is for. */
function settleFontFile(answer: FontFileAnswer): void {
    const pending = fontFilesPending.get(answer.id);
    if (!pending) return;
    fontFilesPending.delete(answer.id);
    if (answer.ok) pending.resolve(answer.body);
    else pending.reject(new Error(answer.message));
}

/** What `s`, just opened, opened as. */
function openedAs(s: WasmSession): Opened {
    const docType = s.docType();
    if (docType === undefined) throw new UDocError("internal", "the document opened, but its doc type is unknown");
    const sourceFormat = s.sourceFormat();
    return {
        docType,
        ...(sourceFormat !== undefined ? { sourceFormat } : {}),
        fromPackage: s.fromPackage(),
        needsPassword: s.needsPassword(),
        entitlements: s.entitlements(),
    };
}

/** `error` as it crosses to the session's side. A panic aborts, and an abort
 *  in wasm is a trap, which `UDocError.from` reads as `crashed`. */
function failureOf(error: unknown): WorkerFailure {
    const { code, message, detail } = UDocError.from(error);
    return { code, message, ...(detail && { detail }) };
}
