/**
 * The server over the documents it keeps: what each request answers, which
 * failure becomes which status, that an upload is kept as itself and as the
 * form that reopens it, that a copy saves by the strategy asked, that a
 * checkpoint keeps the session as the next baseline, which the package answers
 * from, without reopening it, that a package streams part by part with no session,
 * that a session is only a cache over what is kept — reopened once it idles
 * out, is evicted past the cap, loses its engine, or outlives the server, and
 * never closed under a request that is using it, and always opened over the
 * store — and that a collaboration sends each client's edits on to the others,
 * keeps them as the edit log a reopen applies, and keeps a client's opaque
 * parts before the patch naming them.
 *
 * The `UDocNode` and its sessions are stand-ins, so no engine is loaded, no real
 * session is started and no permit is spent; the HTTP and the store's
 * directory are real.
 */

import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import type { IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { inflateRawSync } from "node:zlib";

import { UDocError } from "@docmentis/udoc-node";
import type {
    ExportFormat,
    FileFormat,
    PageExportFormat,
    SaveStrategy,
    UDocNode,
    UDocSession,
    UDocType,
} from "@docmentis/udoc-node";

import { createUDocServer } from "../src/server.ts";
import type { UDocServerOptions } from "../src/server.ts";
import { DirectoryDocumentStore } from "../src/store.ts";
import { IMAGE_BLOB, PEER, checkpointEntries, packageZip } from "./package-zip.ts";

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const bytesOf = (value: string) => new TextEncoder().encode(value);

/** What a `locked` upload opens with: not Latin-1, so it has to cross percent-encoded. */
const PASSWORD = "sésame ключ";

/** The package an import saves, unless a test gives its own: a real zip, which a session opened over the store reads. */
const PACKAGE = await packageZip();

/** The edits a fake patch carries: the JSON list of their names. */
function editsOf(patch: Uint8Array): string[] {
    let edits: unknown;
    try {
        edits = JSON.parse(text(patch));
    } catch {
        throw new UDocError("malformed", "not a patch");
    }
    if (!Array.isArray(edits) || !edits.every((edit) => typeof edit === "string")) {
        throw new UDocError("malformed", "not a patch");
    }
    return edits;
}

/**
 * A session over a three-page document, whose page `i` exports as the byte `i`.
 * A PDF saves as PDF (`%PDF`) by rewrite — it holds no original to save over,
 * as a session opened over the store doesn't — and as a package (`PK`, unless
 * it is given one), or, given a version, as that checkpoint. While `hold` is
 * set, an export waits on it.
 *
 * Its editing state is the set of edits it holds, named: a patch, a snapshot
 * and a version vector are each the JSON list of the edits in it, and presence
 * is a JSON object of each peer's.
 */
class FakeSession {
    readonly closed: Promise<UDocError>;
    readonly docType: UDocType;
    readonly sourceFormat: FileFormat;
    readonly fromPackage: boolean;
    readonly package: Uint8Array;
    readonly renders: { index: number; scale: number }[] = [];
    /** The page of every export as an SVG. */
    readonly svgs: number[] = [];
    /** The format of every export of the whole document. */
    readonly exports: ExportFormat[] = [];
    /** The strategy of every save as its own format, and the version of every save as a package. */
    readonly saves: (SaveStrategy | undefined)[] = [];
    readonly packageSaves: (number | undefined)[] = [];
    /** The password it opens with, while it is waiting for one. */
    locked: string | undefined;
    /** Every password it was given. */
    readonly passwords: string[] = [];
    hold: Promise<void> | undefined;
    isClosed = false;
    readonly edits = new Set<string>();
    readonly peers: Record<string, unknown> = {};
    #end!: (reason: UDocError) => void;

    constructor(
        docType: UDocType,
        sourceFormat: FileFormat,
        fromPackage: boolean,
        udocPackage: Uint8Array,
        locked?: string,
    ) {
        this.docType = docType;
        this.sourceFormat = sourceFormat;
        this.fromPackage = fromPackage;
        this.package = udocPackage;
        this.locked = locked;
        this.closed = new Promise((resolve) => (this.#end = resolve));
    }
    get needsPassword(): boolean {
        return this.locked !== undefined;
    }
    async authenticate(password: string): Promise<boolean> {
        this.passwords.push(password);
        if (password !== this.locked) return false;
        this.locked = undefined;
        return true;
    }
    async pageCount(): Promise<number> {
        return 3;
    }
    async exportPageToBytes(index: number, format: PageExportFormat): Promise<Uint8Array> {
        if (format === "svg") this.svgs.push(index);
        else this.renders.push({ index, scale: format.png.scale });
        await this.hold;
        if (index >= 3) throw new UDocError("notFound", "the document has 3 page(s)");
        return format === "svg" ? bytesOf(`<svg>${index}</svg>`) : new Uint8Array([index]);
    }
    async exportToBytes(format: ExportFormat): Promise<Uint8Array> {
        this.exports.push(format);
        if (this.docType === "spreadsheet") throw new UDocError("unsupported", "its sheets have no print pages");
        return bytesOf("%PDF");
    }
    async saveToBytes(format: FileFormat, strategy?: SaveStrategy): Promise<Uint8Array> {
        this.saves.push(strategy);
        if (this.docType !== "portable" || format !== "pdf") {
            throw new UDocError("invalidRequest", `can't be saved as ${format}`);
        }
        // Absent, it is the engine's for a PDF: incremental.
        if (strategy !== "rewrite") {
            throw new UDocError("invalidRequest", "this session holds no original to save over");
        }
        return bytesOf("%PDF");
    }
    async saveToPackage(version?: number): Promise<Uint8Array> {
        this.packageSaves.push(version);
        return version === undefined ? this.package : packageZip(checkpointEntries(version));
    }
    async snapshot(): Promise<Uint8Array> {
        return bytesOf(JSON.stringify([...this.edits]));
    }
    async versionVector(): Promise<Uint8Array> {
        return this.snapshot();
    }
    async patchSince(peer: Uint8Array): Promise<Uint8Array> {
        const held = editsOf(peer);
        return bytesOf(JSON.stringify([...this.edits].filter((edit) => !held.includes(edit))));
    }
    async merge(patch: Uint8Array): Promise<void> {
        for (const edit of editsOf(patch)) this.edits.add(edit);
    }
    async presence(): Promise<Uint8Array> {
        return bytesOf(JSON.stringify(this.peers));
    }
    async mergePresence(presence: Uint8Array): Promise<void> {
        Object.assign(this.peers, JSON.parse(text(presence)));
    }
    async close(): Promise<void> {
        this.isClosed = true;
        this.#end(new UDocError("invalidRequest", "the session is closed"));
    }
    /** The engine going away under it. */
    crash(): void {
        this.#end(new UDocError("crashed", "the engine crashed"));
    }
}

/** What a refused permit refuses with. */
function permitRefused(): UDocError {
    return new UDocError("permitRefused", "Permit refused: Cap reached.", { message: "Cap reached." });
}

/**
 * Opens `pdf` as a PDF, `locked` as one that opens with {@link PASSWORD}, a
 * package — `PK` — as one made from a PDF, `refuse` as a refused permit, and
 * anything else not at all; the hint `pdf` opens anything as
 * a PDF. A remote open reads the package's description and,
 * when it says there is one, its edit log through the fetch it is given, as the
 * engine does. Once `refusing`, everything is a refused permit. Records every open
 * — a remote one under its URL. Its sessions save `udocPackage` as their
 * package.
 */
class FakeUDoc {
    readonly opened: { bytes: string; format: FileFormat | undefined; session: FakeSession }[] = [];
    refusing = false;
    readonly #package: Uint8Array;

    constructor(udocPackage: Uint8Array = PACKAGE) {
        this.#package = udocPackage;
    }

    async openRemote(url: string, fetch: (url: string) => Promise<Uint8Array>): Promise<UDocSession> {
        if (this.refusing) throw permitRefused();
        const description = JSON.parse(text(await fetch(url))) as {
            docType: UDocType;
            sourceFormat?: FileFormat;
            baselineFrontier?: unknown[];
        };
        const session = new FakeSession(description.docType, description.sourceFormat ?? "pdf", true, this.#package);
        if (description.baselineFrontier) await session.merge(inflateRawSync(await fetch(`${url}/crdt`)));
        this.opened.push({ bytes: url, format: undefined, session });
        return session as unknown as UDocSession;
    }

    async open(bytes: Uint8Array, format?: FileFormat): Promise<UDocSession> {
        const given = text(bytes);
        if (given === "refuse" || this.refusing) throw permitRefused();
        if (!(format === "pdf" || given === "pdf" || given === "PK" || given === "locked")) {
            throw new UDocError("unsupported", "unrecognized document format");
        }
        const session = new FakeSession(
            "portable",
            "pdf",
            format === undefined && given === "PK",
            this.#package,
            given === "locked" ? PASSWORD : undefined,
        );
        this.opened.push({ bytes: given, format, session });
        return session as unknown as UDocSession;
    }
}

type Context = { after(fn: () => Promise<void>): void };

async function temporaryDirectory(t: Context): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), "udoc-server-test-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    return directory;
}

/** What the host answers a request, or an upgrade, the server doesn't take: its own. */
const HOST_STATUS = 418;
const HOST_BODY = JSON.stringify({ error: "host" });

/**
 * A server over `directory`, embedded in a host's HTTP server, listening —
 * `origin` the host's, `base` the server's routes beneath `basePath`; the host
 * answers what the server doesn't take with `HOST_STATUS` and `HOST_BODY`. `close` stops it
 * early, as a restart would.
 */
async function serve(
    t: Context,
    directory: string,
    options: Omit<UDocServerOptions, "udoc" | "store"> = {},
    udoc = new FakeUDoc(),
) {
    const server = createUDocServer({
        udoc: udoc as unknown as Pick<UDocNode, "open" | "openRemote">,
        store: new DirectoryDocumentStore(directory),
        ...options,
    });
    const http = createServer((request, response) => {
        if (!server.handleRequest(request, response)) response.writeHead(HOST_STATUS).end(HOST_BODY);
    });
    http.on("upgrade", (request, socket, head) => {
        if (!server.handleUpgrade(request, socket, head)) {
            socket.end(`HTTP/1.1 ${HOST_STATUS} Host\r\nconnection: close\r\n\r\n${HOST_BODY}`);
        }
    });
    await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
    const close = async () => {
        if (!http.listening) return;
        const stopped = new Promise<void>((resolve) => http.close(() => resolve()));
        await server.close();
        await stopped;
    };
    t.after(close);
    const { port } = http.address() as AddressInfo;
    const origin = `http://127.0.0.1:${port}`;
    const base = origin + (options.basePath ?? "");
    const request = (method: string, path: string, body?: string, headers?: Record<string, string>) =>
        fetch(base + path, { method, ...(body !== undefined ? { body } : {}), ...(headers ? { headers } : {}) });
    const upload = async (body = "pdf") =>
        ((await (await request("POST", "/documents", body)).json()) as { id: string }).id;
    return { udoc, origin, base, request, upload, close };
}

/** A collaboration message's kinds (docs/design/node-collaboration.md, docs/design/core-editor-opaque-part.md). */
const JOIN = 1;
const PATCH = 2;
const PRESENCE = 3;
const OPAQUE_PARTS = 4;

/** The URL a session the server opens over document `id`'s store is opened at. */
const keptUrl = (id: string) => `udoc-server://kept/documents/${id}/package`;

/**
 * A client of document `id`'s collaboration on the server at `base`: every
 * message it receives, as its kind and its payload's text, and how its
 * connection ended.
 */
async function collaborator(t: Context, base: string, id: string) {
    const socket = new WebSocket(`${base.replace("http:", "ws:")}/documents/${id}/collaboration`);
    socket.binaryType = "arraybuffer";
    const received: [kind: number, payload: string][] = [];
    socket.addEventListener("message", (event) => {
        const message = new Uint8Array(event.data as ArrayBuffer);
        received.push([message[0]!, text(message.subarray(1))]);
    });
    const closed = new Promise<{ code: number; reason: string }>((resolve) =>
        socket.addEventListener("close", ({ code, reason }) => resolve({ code, reason })),
    );
    t.after(async () => {
        socket.close();
        await closed;
    });
    await new Promise((resolve, reject) => {
        socket.addEventListener("open", resolve);
        socket.addEventListener("error", reject);
    });
    const send = (kind: number, payload: string | Uint8Array) => {
        const bytes = typeof payload === "string" ? bytesOf(payload) : payload;
        const message = new Uint8Array(bytes.byteLength + 1);
        message[0] = kind;
        message.set(bytes, 1);
        socket.send(message);
    };
    return { received, closed, send, socket };
}

/** How the server answers a WebSocket upgrade for `path` that it refuses. */
async function refusedUpgrade(base: string, path: string): Promise<[number, string]> {
    const request = httpRequest(base + path, {
        headers: {
            connection: "Upgrade",
            upgrade: "websocket",
            "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
            "sec-websocket-version": "13",
        },
    });
    request.end();
    const [response] = (await once(request, "response")) as [IncomingMessage];
    const chunks: Buffer[] = [];
    for await (const chunk of response) chunks.push(chunk as Buffer);
    return [response.statusCode!, (JSON.parse(Buffer.concat(chunks).toString()) as { error: string }).error];
}

async function errorOf(response: Response): Promise<[number, string]> {
    return [response.status, ((await response.json()) as { error: string }).error];
}

/** The files kept for document `id`, by their path in its directory. */
async function kept(directory: string, id: string): Promise<Record<string, string>> {
    const root = join(directory, id);
    const names = (await readdir(root, { recursive: true, withFileTypes: true }))
        .filter((entry) => entry.isFile())
        .map((entry) => relative(root, join(entry.parentPath, entry.name)))
        .sort();
    return Object.fromEntries(
        await Promise.all(names.map(async (name) => [name, text(await readFile(join(root, name)))])),
    );
}

async function until(condition: () => boolean | Promise<boolean>): Promise<void> {
    for (let tries = 0; tries < 200 && !(await condition()); tries++) await sleep(5);
    assert.ok(await condition());
}

test("an upload is kept as its original and its first checkpoint, served, and deleted with what was kept", async (t) => {
    const directory = await temporaryDirectory(t);
    const { udoc, request } = await serve(t, directory);

    const created = await request("POST", "/documents", "pdf");
    assert.equal(created.status, 201);
    const { id } = (await created.json()) as { id: string };
    assert.deepEqual(await kept(directory, id), { "checkpoints/v0.udoc": text(PACKAGE), "original.pdf": "pdf" });

    // The import's session, opened from the upload's bytes, is not kept: a
    // request opens one over what was kept.
    assert.equal(udoc.opened[0]!.session.isClosed, true);
    assert.deepEqual(await (await request("GET", `/documents/${id}/layout/page-count`)).json(), { pageCount: 3 });
    const page = await request("GET", `/documents/${id}/layout/pages/2.png?scale=1.5`);
    assert.equal(page.status, 200);
    assert.equal(page.headers.get("content-type"), "image/png");
    assert.deepEqual([...new Uint8Array(await page.arrayBuffer())], [2]);
    assert.equal(udoc.opened[1]!.bytes, keptUrl(id));
    assert.deepEqual(udoc.opened[1]!.session.renders, [{ index: 2, scale: 1.5 }]);

    assert.equal((await request("DELETE", `/documents/${id}`)).status, 204);
    assert.deepEqual(await readdir(directory), []);
    assert.deepEqual(await errorOf(await request("GET", `/documents/${id}/layout/pages/0.png`)), [404, "notFound"]);
    assert.deepEqual(await errorOf(await request("DELETE", `/documents/${id}`)), [404, "notFound"]);
});

test("a page exports as an SVG, and the document as a PDF of its pages", async (t) => {
    const directory = await temporaryDirectory(t);
    const { udoc, request } = await serve(t, directory);
    const { id } = (await (await request("POST", "/documents", "pdf")).json()) as { id: string };

    const svg = await request("GET", `/documents/${id}/layout/pages/1.svg`);
    assert.equal(svg.status, 200);
    assert.equal(svg.headers.get("content-type"), "image/svg+xml");
    assert.equal(await svg.text(), "<svg>1</svg>");
    const pdf = await request("GET", `/documents/${id}/layout/pages.pdf`);
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get("content-type"), "application/pdf");
    assert.equal(await pdf.text(), "%PDF");
    const { session } = udoc.opened.find(({ bytes }) => bytes === keptUrl(id))!;
    assert.deepEqual(session.svgs, [1]);
    assert.deepEqual(session.exports, ["pdf"]);
    assert.deepEqual(session.renders, [], "an SVG is no PNG render");

    assert.deepEqual(await errorOf(await request("GET", `/documents/${id}/layout/pages/1.svg?scale=2`)), [
        400,
        "invalidRequest",
    ]);
    assert.deepEqual(await errorOf(await request("GET", `/documents/${id}/layout/pages/3.svg`)), [404, "notFound"]);
    assert.equal((await request("GET", `/documents/${id}/layout/pages/1.jpg`)).status, HOST_STATUS);
});

test("an encrypted upload opens with the password its header sends, and nothing is kept without it", async (t) => {
    const directory = await temporaryDirectory(t);
    const { udoc, request } = await serve(t, directory);
    const sending = (password: string) => ({ "X-UDoc-Password": encodeURIComponent(password) });

    assert.deepEqual(await errorOf(await request("POST", "/documents", "locked")), [422, "passwordRequired"]);
    assert.deepEqual(await errorOf(await request("POST", "/documents", "locked", sending("sesame"))), [
        422,
        "incorrectPassword",
    ]);
    assert.deepEqual(await errorOf(await request("POST", "/documents", "locked", { "X-UDoc-Password": "%E0%A4" })), [
        400,
        "invalidRequest",
    ]);
    assert.deepEqual(await readdir(directory), [], "a refused upload keeps nothing");

    const created = await request("POST", "/documents", "locked", sending(PASSWORD));
    assert.equal(created.status, 201);
    const { id } = (await created.json()) as { id: string };
    assert.deepEqual(await kept(directory, id), { "checkpoints/v0.udoc": text(PACKAGE), "original.pdf": "locked" });
    // Asked of the upload alone: every import session closed, and the one a
    // request opens over what was kept needs none.
    assert.deepEqual(
        udoc.opened.map(({ session }) => [session.passwords, session.isClosed]),
        [
            [[], true],
            [["sesame"], true],
            [[PASSWORD], true],
        ],
    );
    assert.deepEqual(await (await request("GET", `/documents/${id}/layout/page-count`)).json(), { pageCount: 3 });
    assert.equal(udoc.opened[3]!.session.needsPassword, false);
});

test("a kept package streams part by part, with no session opened for it", async (t) => {
    const directory = await temporaryDirectory(t);
    const { udoc, request, upload } = await serve(t, directory, {}, new FakeUDoc());
    const id = await upload();
    // A part or a blob comes deflated, so its body is not its content as it is.
    const body = async (response: Response) => text(inflateRawSync(new Uint8Array(await response.arrayBuffer())));

    const description = await request("GET", `/documents/${id}/package`);
    assert.deepEqual(await description.json(), { docType: "portable", sourceFormat: "pdf", baselineVersion: 0 });
    const part = await request("GET", `/documents/${id}/package/soft-masks/0-1a`);
    assert.equal(part.headers.get("content-type"), "application/octet-stream");
    assert.equal(await body(part), "soft mask");
    const blob = await request("GET", `/documents/${id}/package/blobs/${IMAGE_BLOB}`);
    assert.equal(blob.headers.get("cache-control"), "private, max-age=31536000, immutable");
    assert.equal(await body(blob), "image blob");

    assert.deepEqual(
        [
            await errorOf(await request("GET", `/documents/${id}/package/soft-mask/0-1a`)),
            await errorOf(await request("GET", `/documents/${id}/package/pages/9-9`)),
            await errorOf(await request("GET", `/documents/${id}/package/blobs/ffff`)),
            await errorOf(await request("GET", `/documents/${id}/package/pages/not-an-id`)),
            await errorOf(await request("GET", "/documents/00000000-0000-4000-8000-000000000000/package")),
            await errorOf(await request("POST", `/documents/${id}/package/pages/0-1`)),
        ],
        [
            [404, "notFound"],
            [404, "notFound"],
            [404, "notFound"],
            [404, "notFound"],
            [404, "notFound"],
            [405, "methodNotAllowed"],
        ],
    );
    // Only the upload opened a session; streaming read the store.
    assert.equal(udoc.opened.length, 1);
});

test("a batch answers each of its routes in turn, and marks the ones the package doesn't have", async (t) => {
    const directory = await temporaryDirectory(t);
    const { request, upload } = await serve(t, directory, {}, new FakeUDoc());
    const id = await upload();
    // Each entry: its 4-byte big-endian length and its deflated bytes, or the
    // absent length alone.
    const entries = async (response: Response) => {
        const bytes = Buffer.from(await response.arrayBuffer());
        const read: (string | undefined)[] = [];
        for (let at = 0; at < bytes.length; ) {
            const length = bytes.readUInt32BE(at);
            at += 4;
            if (length === 0xffff_ffff) {
                read.push(undefined);
                continue;
            }
            read.push(text(inflateRawSync(bytes.subarray(at, at + length))));
            at += length;
        }
        return read;
    };

    const batch = await request(
        "GET",
        `/documents/${id}/package/batch?p=soft-masks/0-1a&p=pages/9-9&p=blobs/${IMAGE_BLOB}&p=pages/0-1`,
    );
    assert.equal(batch.headers.get("cache-control"), null);
    assert.deepEqual(await entries(batch), ["soft mask", undefined, "image blob", "page"]);

    const tooMany = Array.from({ length: 65 }, () => "p=pages/0-1").join("&");
    assert.deepEqual(
        [
            await errorOf(await request("GET", `/documents/${id}/package/batch?${tooMany}`)),
            await errorOf(await request("GET", `/documents/${id}/package/batch?p=crdt`)),
        ],
        [
            [400, "invalidRequest"],
            [400, "invalidRequest"],
        ],
    );
});

test("a kept document outlives the server that imported it", async (t) => {
    const directory = await temporaryDirectory(t);
    const first = await serve(t, directory);
    const id = await first.upload();
    await first.close();

    const second = await serve(t, directory);
    const original = await second.request("GET", `/documents/${id}/original`);
    assert.equal(text(new Uint8Array(await original.arrayBuffer())), "pdf");
    assert.equal(second.udoc.opened.length, 0, "the original is read from the store, not a session");

    const page = await second.request("GET", `/documents/${id}/layout/pages/1.png`);
    assert.equal(page.status, 200);
    assert.deepEqual([...new Uint8Array(await page.arrayBuffer())], [1]);
    // Reopened over the kept package, not from the original.
    assert.deepEqual(
        second.udoc.opened.map(({ bytes, format }) => ({ bytes, format })),
        [{ bytes: keptUrl(id), format: undefined }],
    );
});

test("requests that arrive together for a closed document open it once", async (t) => {
    const directory = await temporaryDirectory(t);
    const first = await serve(t, directory);
    const id = await first.upload();
    await first.close();

    const second = await serve(t, directory);
    const pages = await Promise.all(
        [0, 1, 2].map((index) => second.request("GET", `/documents/${id}/layout/pages/${index}.png`)),
    );
    assert.deepEqual(
        pages.map((page) => page.status),
        [200, 200, 200],
    );
    assert.equal(second.udoc.opened.length, 1);
});

test("a session that idles out, or loses its engine, is reopened from what was kept", async (t) => {
    const directory = await temporaryDirectory(t);
    const { udoc, request, upload } = await serve(t, directory, { sessionTimeoutMs: 20 });
    const id = await upload();

    assert.equal((await request("GET", `/documents/${id}/layout/pages/0.png`)).status, 200);
    await until(() => udoc.opened[1]!.session.isClosed);
    assert.equal((await request("GET", `/documents/${id}/layout/pages/0.png`)).status, 200);
    assert.equal(udoc.opened.length, 3);

    udoc.opened[2]!.session.crash();
    await udoc.opened[2]!.session.closed;
    assert.equal((await request("GET", `/documents/${id}/layout/pages/0.png`)).status, 200);
    assert.deepEqual(
        udoc.opened.map(({ bytes }) => bytes),
        ["pdf", keptUrl(id), keptUrl(id), keptUrl(id)],
    );
});

test("past the cap the least recently used idle session closes, and never one in use", async (t) => {
    const directory = await temporaryDirectory(t);
    const { udoc, request, upload } = await serve(t, directory, { sessionPool: 1 });
    const a = await upload();
    const b = await upload();
    assert.equal((await request("GET", `/documents/${a}/layout/pages/0.png`)).status, 200);
    assert.equal((await request("GET", `/documents/${b}/layout/pages/0.png`)).status, 200);
    assert.equal(udoc.opened[2]!.session.isClosed, true, "a, idle and older, made room for b");
    assert.equal(udoc.opened[3]!.session.isClosed, false);

    // b is in use while a is reopened: two open, one over the cap.
    const busy = udoc.opened[3]!.session;
    let release!: () => void;
    busy.hold = new Promise((resolve) => (release = resolve));
    const waiting = request("GET", `/documents/${b}/layout/pages/0.png`);
    await until(() => busy.renders.length === 2);

    assert.equal((await request("GET", `/documents/${a}/layout/pages/1.png`)).status, 200);
    assert.equal(udoc.opened[4]!.session.isClosed, true, "a, idle again, is the one that can go");
    assert.equal(busy.isClosed, false, "b's request is still using it");

    release();
    assert.equal((await waiting).status, 200);
    assert.equal(busy.isClosed, false);
});

test("a copy is saved as its own format by the strategy asked, or as a package, and nothing of it is kept", async (t) => {
    const directory = await temporaryDirectory(t);
    const { udoc, request, upload } = await serve(t, directory);
    const id = await upload();
    const body = async (response: Response) => text(new Uint8Array(await response.arrayBuffer()));

    assert.equal(await body(await request("GET", `/documents/${id}/file.pdf?strategy=rewrite`)), "%PDF");
    assert.equal(await body(await request("GET", `/documents/${id}/file.udoc`)), text(PACKAGE));
    // What the session's save refuses, the copy does, saying why — asked by
    // no strategy too, which leaves it to the engine.
    for (const query of ["", "?strategy=delta"]) {
        const refused = await request("GET", `/documents/${id}/file.pdf${query}`);
        assert.deepEqual(await refused.json(), {
            error: "invalidRequest",
            message: "this session holds no original to save over",
        });
    }
    assert.deepEqual(await errorOf(await request("GET", `/documents/${id}/file.pptx`)), [400, "invalidRequest"]);
    assert.deepEqual(await errorOf(await request("GET", `/documents/${id}/file.pdf?strategy=sideways`)), [
        400,
        "invalidRequest",
    ]);
    assert.deepEqual(await errorOf(await request("GET", `/documents/${id}/file.udoc?strategy=rewrite`)), [
        400,
        "invalidRequest",
    ]);
    assert.deepEqual(await errorOf(await request("GET", `/documents/${id}/file.txt`)), [404, "notFound"]);
    assert.deepEqual(await errorOf(await request("PUT", `/documents/${id}/file.pdf`)), [405, "methodNotAllowed"]);
    // Each reached the session by the strategy asked, none past a refused
    // request; and a copy is a flat baseline, kept nowhere.
    const session = udoc.opened[1]!.session;
    assert.deepEqual(session.saves, ["rewrite", undefined, "delta", undefined]);
    assert.deepEqual(session.packageSaves, [undefined]);
    assert.deepEqual(Object.keys(await kept(directory, id)), ["checkpoints/v0.udoc", "original.pdf"]);
});

test("a checkpoint keeps the session as the next baseline, which the package answers from, and reopens nothing", async (t) => {
    const directory = await temporaryDirectory(t);
    const first = await serve(t, directory);
    const id = await first.upload();

    const created = await first.request("POST", `/documents/${id}/checkpoints`);
    assert.equal(created.status, 201);
    assert.deepEqual(await created.json(), { version: 1 });
    // Asked together, each waits for the one before, and takes the version after.
    const together = await Promise.all([
        first.request("POST", `/documents/${id}/checkpoints`),
        first.request("POST", `/documents/${id}/checkpoints`),
    ]);
    assert.deepEqual(await Promise.all(together.map((response) => response.json())), [{ version: 2 }, { version: 3 }]);

    // Saved in the one session, which goes on; every checkpoint kept.
    assert.equal(first.udoc.opened.length, 2, "the import, and the session a checkpoint saved");
    assert.deepEqual(first.udoc.opened[1]!.session.packageSaves, [1, 2, 3]);
    assert.equal(first.udoc.opened[1]!.session.isClosed, false);
    assert.deepEqual(Object.keys(await kept(directory, id)), [
        "checkpoints/v0.udoc",
        "checkpoints/v1.udoc",
        "checkpoints/v2.udoc",
        "checkpoints/v3.udoc",
        "original.pdf",
    ]);

    // The package is the latest's, its frontier's peer whole.
    const description = await first.request("GET", `/documents/${id}/package`);
    assert.equal(
        await description.text(),
        `{"docType":"portable","sourceFormat":"pdf","baselineVersion":3,"baselineFrontier":[[${PEER},7]]}`,
    );
    const page = await first.request("GET", `/documents/${id}/package/pages/0-1`);
    assert.equal(text(inflateRawSync(new Uint8Array(await page.arrayBuffer()))), "page v3");

    assert.deepEqual(
        [
            await errorOf(await first.request("POST", "/documents/00000000-0000-4000-8000-000000000000/checkpoints")),
            await errorOf(await first.request("GET", `/documents/${id}/checkpoints`)),
        ],
        [
            [404, "notFound"],
            [405, "methodNotAllowed"],
        ],
    );
    await first.close();

    // A session opened later opens the latest.
    const second = await serve(t, directory);
    assert.equal((await second.request("POST", `/documents/${id}/checkpoints`)).status, 201);
    assert.deepEqual(second.udoc.opened[0]!.session.packageSaves, [4]);
});

test("the format hint reaches the import, and a name that isn't a format is refused", async (t) => {
    const directory = await temporaryDirectory(t);
    const { udoc, request } = await serve(t, directory);

    assert.equal((await request("POST", "/documents?format=pdf", "%PDF-ish")).status, 201);
    assert.deepEqual(await errorOf(await request("POST", "/documents?format=doc", "pdf")), [400, "invalidRequest"]);
    assert.equal((await request("POST", "/documents", "pdf")).status, 201);
    // The refused request never reached the engine.
    assert.deepEqual(
        udoc.opened.map(({ format }) => format),
        ["pdf", undefined],
    );
});

test("each failure answers its own status and code, and keeps nothing", async (t) => {
    const directory = await temporaryDirectory(t);
    const { udoc, request, upload } = await serve(t, directory, { maxUploadBytes: 16 });
    const id = await upload();

    const answers = [
        await errorOf(await request("POST", "/documents", "refuse")),
        await errorOf(await request("POST", "/documents", "docx?")),
        await errorOf(await request("POST", "/documents", "PK")),
        await errorOf(await request("POST", "/documents", "x".repeat(17))),
        await errorOf(await request("GET", `/documents/${id}/layout/pages/3.png`)),
        await errorOf(await request("GET", `/documents/${id}/layout/pages/0.png?scale=0`)),
        // A path no route has is the host's.
        await errorOf(await request("GET", `/documents/${id}/layout/pages/one.png`)),
        // Never minted here, so never a file name: nothing is read.
        await errorOf(await request("GET", "/documents/nobody/layout/pages/0.png")),
        await errorOf(await request("GET", "/documents/..%2F..%2Fescape/layout/page-count")),
        // Well formed, and kept nowhere.
        await errorOf(await request("GET", "/documents/00000000-0000-4000-8000-000000000000/layout/page-count")),
        await errorOf(await request("GET", "/documents/00000000-0000-4000-8000-000000000000/original")),
        await errorOf(await request("PUT", "/documents")),
        await errorOf(await request("POST", `/documents/${id}`)),
        // The document itself does not answer with the count: that costs.
        await errorOf(await request("GET", `/documents/${id}`)),
        await errorOf(await request("POST", `/documents/${id}/layout/page-count`)),
        await errorOf(await request("POST", `/documents/${id}/original`)),
        await errorOf(await request("GET", "/elsewhere")),
    ];
    assert.deepEqual(answers, [
        [503, "permitRefused"],
        [422, "unsupported"],
        [422, "cannotImportPackage"],
        [413, "payloadTooLarge"],
        [404, "notFound"],
        [400, "invalidRequest"],
        [HOST_STATUS, "host"],
        [404, "notFound"],
        [404, "notFound"],
        [404, "notFound"],
        [404, "notFound"],
        [405, "methodNotAllowed"],
        [405, "methodNotAllowed"],
        [405, "methodNotAllowed"],
        [405, "methodNotAllowed"],
        [405, "methodNotAllowed"],
        [HOST_STATUS, "host"],
    ]);
    // Only the well-formed request reached the session, the refused package's
    // session was closed, and only the one upload that opened was kept.
    assert.deepEqual(udoc.opened.find(({ bytes }) => bytes === keptUrl(id))?.session.renders, [{ index: 3, scale: 1 }]);
    assert.equal(udoc.opened.find(({ bytes }) => bytes === "PK")?.session.isClosed, true);
    assert.deepEqual(await readdir(directory), [id]);
});

test("beneath a base path the routes are the server's, and every other path is its host's", async (t) => {
    const directory = await temporaryDirectory(t);
    const { origin, base, request, upload } = await serve(t, directory, { basePath: "/udoc/" });
    const id = await upload();

    assert.deepEqual(await (await request("GET", `/documents/${id}/layout/page-count`)).json(), { pageCount: 3 });
    // Its path compared by segments, as a route's is.
    assert.equal(await (await fetch(`${origin}/udoc//documents/${id}/original/`)).text(), "pdf");
    // Taken: the client is let in.
    await collaborator(t, base, id);

    assert.deepEqual(
        [
            await errorOf(await fetch(`${origin}/documents/${id}/layout/page-count`)),
            await errorOf(await fetch(`${origin}/udocx/documents/${id}/layout/page-count`)),
            await errorOf(await fetch(`${origin}/udoc`)),
            await refusedUpgrade(origin, `/documents/${id}/collaboration`),
        ],
        [
            [HOST_STATUS, "host"],
            [HOST_STATUS, "host"],
            [HOST_STATUS, "host"],
            [HOST_STATUS, "host"],
        ],
    );
});

test("a collaboration sends each edit on to the others, keeps it as the edit log, and answers a joiner with what it lacks", async (t) => {
    const directory = await temporaryDirectory(t);
    const { base, request, upload } = await serve(t, directory, {}, new FakeUDoc());
    const id = await upload();

    const alex = await collaborator(t, base, id);
    alex.send(JOIN, "[]");
    await until(() => alex.received.length === 3);
    assert.deepEqual(alex.received, [
        [JOIN, "[]"],
        [PATCH, "[]"],
        [PRESENCE, "{}"],
    ]);
    alex.send(PATCH, '["alex 1"]');
    await until(async () => (await kept(directory, id))["crdt.loro"] === '["alex 1"]');

    // A joiner that holds nothing gets what is held: the server's version, the
    // edits it lacks, and every peer's presence.
    const robin = await collaborator(t, base, id);
    robin.send(JOIN, "[]");
    await until(() => robin.received.length === 3);
    assert.deepEqual(robin.received, [
        [JOIN, '["alex 1"]'],
        [PATCH, '["alex 1"]'],
        [PRESENCE, "{}"],
    ]);

    // Each edit and presence goes on to every client but its sender.
    robin.send(PATCH, '["robin 1"]');
    alex.send(PRESENCE, '{"alex":"page 1"}');
    await until(() => alex.received.length === 4 && robin.received.length === 4);
    assert.deepEqual(alex.received[3], [PATCH, '["robin 1"]']);
    assert.deepEqual(robin.received[3], [PRESENCE, '{"alex":"page 1"}']);

    // The log is every edit, served beside the package, whose description now
    // says it has one to replay.
    await until(async () => (await kept(directory, id))["crdt.loro"] === '["alex 1","robin 1"]');
    assert.equal(
        text(
            inflateRawSync(new Uint8Array(await (await request("GET", `/documents/${id}/package/crdt`)).arrayBuffer())),
        ),
        '["alex 1","robin 1"]',
    );
    assert.deepEqual(await (await request("GET", `/documents/${id}/package`)).json(), {
        docType: "portable",
        sourceFormat: "pdf",
        baselineVersion: 0,
        baselineFrontier: [],
    });
});

test("a client's opaque parts are kept before its patch, served by route, and never sent on", async (t) => {
    const directory = await temporaryDirectory(t);
    const { base, request, upload } = await serve(t, directory, {}, new FakeUDoc());
    const id = await upload();
    const body = async (response: Response) => text(inflateRawSync(new Uint8Array(await response.arrayBuffer())));

    const alex = await collaborator(t, base, id);
    const robin = await collaborator(t, base, id);
    alex.send(JOIN, "[]");
    robin.send(JOIN, "[]");
    await until(() => alex.received.length === 3 && robin.received.length === 3);

    // An inserted picture's image, as the engine sends it: the part and its
    // blob, and the list the server doesn't keep — ahead of the patch naming it.
    alex.send(
        OPAQUE_PARTS,
        await packageZip({
            "parts/image_0-2a.json": "image part",
            "blobs/e7e7e7.png": "image pixels",
            "opaque_parts.json": "[]",
        }),
    );
    alex.send(PATCH, '["alex inserts a picture"]');
    await until(() => robin.received.length === 4);
    // The others get the patch alone, and the sender nothing: a peer loads the
    // part from here.
    assert.deepEqual(robin.received[3], [PATCH, '["alex inserts a picture"]']);
    assert.equal(alex.received.length, 3);

    assert.equal(await body(await request("GET", `/documents/${id}/package/images/0-2a`)), "image part");
    assert.equal(await body(await request("GET", `/documents/${id}/package/blobs/e7e7e7`)), "image pixels");
    assert.equal(await body(await request("GET", `/documents/${id}/package/blobs/${IMAGE_BLOB}`)), "image blob");
    assert.deepEqual(await errorOf(await request("GET", `/documents/${id}/package/images/0-2b`)), [404, "notFound"]);
});

test("a collaboration holds its session while anyone is connected, and its log outlives both", async (t) => {
    const directory = await temporaryDirectory(t);
    const first = await serve(t, directory, { sessionTimeoutMs: 20 });
    const id = await first.upload();
    assert.deepEqual(await errorOf(await first.request("GET", `/documents/${id}/package/crdt`)), [404, "notFound"]);

    const alex = await collaborator(t, first.base, id);
    alex.send(JOIN, "[]");
    alex.send(PATCH, '["alex 1"]');
    await sleep(100);
    assert.equal(first.udoc.opened[1]!.session.isClosed, false, "held past its idle timeout");

    // A server that closes ends its collaborations, once their edits are kept.
    await first.close();
    assert.deepEqual(await alex.closed, { code: 1001, reason: "the server is closing" });
    assert.equal((await kept(directory, id))["crdt.loro"], '["alex 1"]');

    // Reopened, the document is its package with the log merged.
    const second = await serve(t, directory);
    assert.equal((await second.request("GET", `/documents/${id}/layout/page-count`)).status, 200);
    assert.deepEqual([...second.udoc.opened[0]!.session.edits], ["alex 1"]);
});

test("what a client shouldn't send ends that client alone, and nothing of it is sent on or kept", async (t) => {
    const directory = await temporaryDirectory(t);
    const { base, upload } = await serve(t, directory);
    const id = await upload();
    const alex = await collaborator(t, base, id);
    alex.send(JOIN, "[]");
    await until(() => alex.received.length === 3);

    const unjoined = await collaborator(t, base, id);
    unjoined.send(PATCH, '["early"]');
    assert.deepEqual(await unjoined.closed, { code: 1002, reason: "join first" });

    const malformed = await collaborator(t, base, id);
    malformed.send(JOIN, "[]");
    malformed.send(PATCH, "not a patch");
    assert.deepEqual(await malformed.closed, { code: 1008, reason: "not a patch" });

    const texting = await collaborator(t, base, id);
    texting.socket.send("hello");
    assert.equal((await texting.closed).code, 1003);

    const unzipped = await collaborator(t, base, id);
    unzipped.send(JOIN, "[]");
    unzipped.send(OPAQUE_PARTS, "not a zip");
    assert.equal((await unzipped.closed).code, 1008);

    await sleep(20);
    assert.equal(alex.received.length, 3, "nothing was sent on");
    assert.equal((await kept(directory, id))["crdt.loro"], undefined, "nothing was kept");
    assert.equal(alex.socket.readyState, WebSocket.OPEN);
});

test("deleting a document ends its collaboration, and one not kept can't be joined", async (t) => {
    const directory = await temporaryDirectory(t);
    const { base, request, upload } = await serve(t, directory);
    const id = await upload();
    const alex = await collaborator(t, base, id);
    alex.send(JOIN, "[]");

    assert.equal((await request("DELETE", `/documents/${id}`)).status, 204);
    assert.deepEqual(await alex.closed, { code: 4000, reason: "the document was deleted" });
    // Refused the way a browser can read: taken, then closed.
    assert.deepEqual(await (await collaborator(t, base, id)).closed, {
        code: 4000,
        reason: `no document "${id}"`,
    });
    assert.deepEqual(await (await collaborator(t, base, "not-an-id")).closed, {
        code: 4000,
        reason: 'no document "not-an-id"',
    });
    // A path that names no collaboration is no WebSocket's to close: it is the host's.
    assert.deepEqual(await refusedUpgrade(base, `/documents/${id}/elsewhere`), [HOST_STATUS, "host"]);

    const other = await upload();
    assert.deepEqual(await errorOf(await request("GET", `/documents/${other}/collaboration`)), [
        426,
        "upgradeRequired",
    ]);
});

test("a client whose document can't be opened is closed saying why", async (t) => {
    const directory = await temporaryDirectory(t);
    const first = await serve(t, directory);
    const id = await first.upload();
    await first.close();

    // A license refusal, which a request is answered as a 503.
    const refusing = new FakeUDoc();
    refusing.refusing = true;
    const second = await serve(t, directory, {}, refusing);
    assert.deepEqual(await errorOf(await second.request("GET", `/documents/${id}/layout/page-count`)), [
        503,
        "permitRefused",
    ]);
    assert.deepEqual(await (await collaborator(t, second.base, id)).closed, {
        code: 4001,
        reason: "Permit refused: Cap reached.",
    });
    await second.close();

    // A kept edit log the engine can't take.
    await new DirectoryDocumentStore(directory).putLog(id, bytesOf("not a patch"));
    const third = await serve(t, directory);
    assert.deepEqual(await (await collaborator(t, third.base, id)).closed, { code: 4002, reason: "not a patch" });
});
