// What the end-to-end suites share (scripts/e2e.mjs): their result, the real
// udoc-server, and editors on the real engine that open remotely and collaborate
// over its WebSocket as udoc-ui's do.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { initSync, startSession } from "@docmentis/udoc-wasm";
import { bundledFontUrls, bundledGeographyUrl, bundledWasmUrl } from "@docmentis/udoc-wasm/meta-url";
import WebSocket from "ws";
import yauzl from "yauzl";
import { root } from "./packages.mjs";

/** The demo's sample documents, which the suites edit. */
export const SAMPLES = join(root, "packages/udoc-demo/public");

/** The collaboration's message kinds, as udoc-ui's `collaboration.ts` has them. */
const JOIN = 1;
const PATCH = 2;
const OPAQUE_PARTS = 4;

// --- the result

let failed = 0;

/** Report one check. A failed one fails the suite, which goes on to the next. */
export function check(name, ok, detail = "") {
    console.log(`[e2e] ${ok ? "ok" : "FAILED"}  ${name}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failed++;
    return ok;
}

/** End the suite, with the line scripts/e2e.mjs reads as its result. */
export function finish() {
    console.log(`[e2e] ${failed} failed`);
    process.exit(failed ? 1 : 0);
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Resolves with whether `condition` came true in about six seconds. */
export async function until(condition, tries = 40) {
    for (let i = 0; i < tries; i++) {
        if (await condition()) return true;
        await sleep(150);
    }
    return false;
}

// --- the server

/** Start the real server over store `directory`, with its `options`. */
export async function serve(directory, options = {}) {
    const child = spawn(process.execPath, [join(root, "scripts/e2e-server.mjs"), directory, JSON.stringify(options)], {
        stdio: ["pipe", "pipe", "inherit"],
    });
    const port = await new Promise((resolve, reject) => {
        let out = "";
        child.stdout.on("data", (data) => {
            out += data;
            const printed = /PORT (\d+)/.exec(out);
            if (printed) resolve(printed[1]);
        });
        child.once("exit", (code) => reject(new Error(`the server exited with ${code}`)));
    });
    return {
        base: `http://127.0.0.1:${port}`,
        close: () =>
            new Promise((resolve) => {
                child.removeAllListeners("exit");
                child.once("exit", () => resolve());
                child.kill("SIGTERM");
            }),
    };
}

/** A new store directory, and a way to delete it. */
export async function temporaryStore() {
    const directory = await mkdtemp(join(tmpdir(), "udoc-e2e-"));
    return { directory, remove: () => rm(directory, { recursive: true, force: true }) };
}

/** Upload document `t`, from scripts/e2e-documents.mjs, resolving with its id. */
export async function upload(base, t) {
    const body = t.bytes ?? (await readFile(join(SAMPLES, t.file)));
    const response = await fetch(`${base}/documents`, { method: "POST", body });
    return (await response.json()).id;
}

/** What the document's package description says. */
export async function descriptionOf(base, id) {
    return (await fetch(`${base}/documents/${id}/package`)).json();
}

/** The server's copy of the document, as a package. */
export async function served(base, id) {
    const response = await fetch(`${base}/documents/${id}/file.udoc`);
    const body = new Uint8Array(await response.arrayBuffer());
    if (!response.ok) {
        throw new Error(`file.udoc: ${response.status} ${new TextDecoder().decode(body).slice(0, 300)}`);
    }
    return body;
}

// --- editors

let engineLoaded = false;

/** A new session on the real engine, loaded on the first call. */
export async function newSession() {
    if (!engineLoaded) {
        initSync({ module: new WebAssembly.Module(await readFile(new URL(bundledWasmUrl))) });
        engineLoaded = true;
    }
    return startSession(
        { domain: "unknown", wrapper: "udoc-node", wrapperVersion: null },
        bundledFontUrls,
        [],
        bundledGeographyUrl,
    );
}

/** Where the fetch worker answers: its state and length, then the body. */
const fetchFlags = new SharedArrayBuffer(8);
const fetchBody = new SharedArrayBuffer(1 << 28);
const fetcher = new Worker(join(root, "scripts/e2e-fetch-worker.mjs"), {
    workerData: { signal: fetchFlags, data: fetchBody },
});
fetcher.unref();

/** Fetch `url` with this thread waiting, as the engine's remote open asks. */
function fetchSync(url) {
    const flags = new Int32Array(fetchFlags);
    Atomics.store(flags, 0, 0);
    fetcher.postMessage(url);
    Atomics.wait(flags, 0, 0, 60_000);
    if (flags[0] !== 1) throw new Error(`fetch failed: ${url}`);
    return new Uint8Array(fetchBody, 0, flags[1]).slice();
}

/** An editor's session, opened on the document as a browser opens it; on one checkpoint when `version` says so. */
export async function remote(base, id, version) {
    const session = await newSession();
    const resource = version === undefined ? "package" : `checkpoints/${version}/package`;
    session.openRemote(`${base}/documents/${id}/${resource}`, fetchSync);
    return session;
}

/** The versions of the document's checkpoints, as the server lists them. */
export async function checkpointVersions(base, id) {
    return (await (await fetch(`${base}/documents/${id}/checkpoints`)).json()).versions;
}

/** Check checkpoint `version`, opened on its own, is the document as it was: `model`. */
export async function checkpointHolds(base, id, version, model) {
    const parts = differ(model, await modelOf((await remote(base, id, version)).saveToPackage()));
    check(
        `checkpoint v${version} opened on its own: the document as it was then`,
        parts.length === 0,
        parts.join(", "),
    );
}

/** An editor joined over the WebSocket: `join`, then patches and opaque parts each way. */
export class Peer {
    /** What the far side holds, as far as this editor knows. */
    held;
    /** Merges the far side sent that this editor refused. */
    errors = [];

    constructor(base, id, session) {
        this.session = session;
        this.socket = new WebSocket(`${base.replace("http", "ws")}/documents/${id}/collaboration`);
        this.socket.binaryType = "nodebuffer";
        this.closed = new Promise((resolve) =>
            this.socket.once("close", (code, reason) => resolve({ code, reason: reason.toString() })),
        );
        /** Settles when the far side answers the join, or rejects with the close that refused it. */
        this.joined = new Promise((resolve, reject) => {
            this.socket.on("open", () => this.socket.send(message(JOIN, session.versionVector())));
            this.socket.on("error", reject);
            this.closed.then(({ code, reason }) => reject(new Error(`closed ${code} ${reason}`)));
            this.socket.on("message", (data) => {
                const payload = new Uint8Array(data.subarray(1));
                if (data[0] === JOIN) {
                    this.held = payload;
                    resolve();
                    return;
                }
                try {
                    if (data[0] === PATCH) session.mergePatch(payload);
                    else if (data[0] === OPAQUE_PARTS) session.mergeOpaqueParts(payload);
                } catch (error) {
                    this.errors.push(String(error?.message ?? error).slice(0, 200));
                }
            });
        });
        this.joined.catch(() => {});
    }

    /** Whether the connection is open. */
    get connected() {
        return this.socket.readyState === WebSocket.OPEN;
    }

    /** Send all the far side lacks. */
    send() {
        const next = this.session.versionVector();
        const held = this.held ?? new Uint8Array();
        const parts = this.session.opaquePartsSince(held);
        if (parts.byteLength > 0) this.socket.send(message(OPAQUE_PARTS, parts));
        this.socket.send(message(PATCH, this.session.patchSince(held)));
        this.held = next;
    }

    /** Send every edit again, from nothing, as a client that lost track of what was taken would. */
    sendEverything() {
        this.socket.send(message(PATCH, this.session.patchSince(new Uint8Array())));
    }

    close() {
        this.socket.close();
        return this.closed;
    }
}

function message(kind, payload) {
    return Buffer.concat([Buffer.from([kind]), payload]);
}

// --- comparing documents

/** A package's entries, by name. */
export function unzip(bytes) {
    return new Promise((resolve, reject) => {
        yauzl.fromBuffer(Buffer.from(bytes), { lazyEntries: true, decodeStrings: true }, (openError, zip) => {
            if (openError) return reject(openError);
            const entries = new Map();
            zip.on("error", reject);
            zip.on("end", () => resolve(entries));
            zip.on("entry", (entry) => {
                zip.openReadStream(entry, (readError, stream) => {
                    if (readError) return reject(readError);
                    const chunks = [];
                    stream.on("data", (chunk) => chunks.push(chunk));
                    stream.on("end", () => {
                        entries.set(entry.fileName, Buffer.concat(chunks));
                        zip.readEntry();
                    });
                });
            });
            zip.readEntry();
        });
    });
}

/** JSON in one form: its keys in order, and its numbers past rounding error. */
function canonical(value) {
    if (typeof value === "number") return Number(value.toPrecision(12));
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.keys(value)
                .sort()
                .map((key) => [key, canonical(value[key])]),
        );
    }
    return value;
}

/** What a package's model is, part by part, leaving out how it got there: its metadata and log. */
export async function modelOf(pkg) {
    const model = new Map();
    for (const [name, bytes] of await unzip(pkg)) {
        const history =
            name === "metadata.json" ||
            name.endsWith(".loro") ||
            name === "modified_part_ids.json" ||
            name === "original_id_map.json";
        if (history) continue;
        const text = name.endsWith(".json")
            ? JSON.stringify(canonical(JSON.parse(bytes.toString())))
            : bytes.toString("latin1");
        model.set(name, createHash("sha1").update(text).digest("hex"));
    }
    return model;
}

/** The names of the parts two models differ in. */
export function differ(a, b) {
    return [...new Set([...a.keys(), ...b.keys()])].filter((name) => a.get(name) !== b.get(name));
}

/** Check two editors come to hold the same model. */
export async function converge(label, a, b) {
    const parts = async () => differ(await modelOf(a.saveToPackage()), await modelOf(b.saveToPackage()));
    const same = await until(async () => (await parts()).length === 0);
    check(label, same, same ? "" : (await parts()).slice(0, 4).join(", "));
}

/** Check the server comes to hold `model`. */
export async function onServer(label, base, id, model) {
    let parts = [];
    await until(async () => {
        parts = differ(model, await modelOf(await served(base, id)));
        return parts.length === 0;
    });
    check(label, parts.length === 0, parts.slice(0, 4).join(", "));
}

/** Undo `session`'s own edits, as far as document `t` can, resolving with how many it undid. */
export function undoOwnEdits(session, t) {
    let undos = 0;
    while (session.canUndo() && undos < (t.undoSteps ?? 20)) {
        session.undo();
        undos++;
    }
    return undos;
}
