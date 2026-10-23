// A session — one open document: the handle an embedder holds, over the worker
// thread that runs it.
//
// The one sibling it imports at runtime is `@docmentis/udoc-wasm/error`, which
// loads no engine, so the tests can load it straight from `src` (see
// `tsconfig.test.json`).

import { MessageChannel, Worker } from "node:worker_threads";
import type { MessagePort, TransferListItem } from "node:worker_threads";

import type {
    Entitlements,
    ExportFormat,
    FileFormat,
    PageExportFormat,
    SaveStrategy,
    UDocType,
} from "@docmentis/udoc-wasm";
import { UDocError } from "@docmentis/udoc-wasm/error";
import type { UDocErrorCode } from "@docmentis/udoc-wasm/error";

import type { FontCache } from "./font-cache.js";
import type {
    FetchAnswer,
    FontFileAnswer,
    FontFileRequest,
    Opened,
    WorkerFailure,
    WorkerInit,
    WorkerReply,
    WorkerRequest,
    WorkerResult,
} from "./protocol.js";

/** The largest page index the engine takes: it indexes with a wasm32 `usize`,
 *  and a larger number would wrap on the way in. */
const MAX_PAGE_INDEX = 2 ** 32 - 1;

/** The largest baseline version the engine takes: a `u32`, for the same reason. */
const MAX_VERSION = 2 ** 32 - 1;

/** How long one part of a remote document, or one font file, may take to
 *  arrive before its load fails — so a server that stops answering fails the
 *  call that needed it, rather than leaving the worker waiting for good. */
const FETCH_TIMEOUT_MS = 60_000;

interface Pending {
    resolve(result: WorkerResult[keyof WorkerResult]): void;
    reject(error: Error): void;
}

/** A server's answer to {@link UDocSession.requestRemoteCheckpoint}: the version of the baseline it wrote. */
export interface RemoteCheckpointResponse {
    version: number;
}

/**
 * A session: one open document, driven on a worker thread of its own, so every
 * call is asynchronous and none blocks the caller's event loop while the engine
 * composes or rasterizes. As in the engine, the session is its document —
 * opening one is the open, closing it is the close.
 *
 * The thread is held until {@link close}. An idle session does not keep the
 * process alive; a call in flight does.
 */
export class UDocSession {
    /**
     * Settles once the session can take no more calls, with why: it was
     * {@link close}d, or its engine crashed or its thread exited on its own —
     * `crashed`. A host holding sessions watches this to let go of one that
     * died.
     */
    readonly closed: Promise<UDocError>;

    readonly #worker: Worker;
    readonly #pending = new Map<number, Pending>();
    #nextId = 1;
    /** Why no further call can succeed, once none can. */
    #ended: UDocError | null = null;
    #settleClosed!: (reason: UDocError) => void;
    /** What the document opened as; set once it has opened. */
    #opened: Opened | null = null;
    /** The package resource {@link UDocNode.openRemote} opened the document from; `undefined` for any other open. */
    #remotePackage: string | undefined;

    /**
     * Start a worker on the compiled engine and open `bytes` in it, answering
     * each font file it asks for from `fontCache`. `UDocNode.open` is the way
     * in; this is what it runs.
     *
     * @internal
     */
    static open(
        init: WorkerInit,
        fontCache: FontCache,
        bytes: Uint8Array,
        format?: FileFormat,
        delimiter?: string,
    ): Promise<UDocSession> {
        const fontFiles = new MessageChannel();
        answerFontFiles(fontFiles.port1, fontCache);
        return UDocSession.#start(
            init,
            (id) => ({
                id,
                type: "open",
                bytes,
                ...(format !== undefined ? { format } : {}),
                ...(delimiter !== undefined ? { delimiter } : {}),
                fontFiles: fontFiles.port2,
            }),
            [fontFiles.port2],
        );
    }

    /**
     * Start a worker on the compiled engine and open the package a server keeps
     * at `url` in it, answering each part its engine asks for from here, and
     * each font file from `fontCache`. `UDocNode.openRemote` is the way in;
     * this is what it runs.
     *
     * @internal
     */
    static openRemote(
        init: WorkerInit,
        fontCache: FontCache,
        url: string,
        fetch: (url: string) => Promise<Uint8Array> = fetchWhole,
    ): Promise<UDocSession> {
        // Refused before a thread starts or a permit is spent: a Node host has
        // no page to resolve a relative URL against.
        if (!URL.canParse(url)) {
            return Promise.reject(
                new UDocError("invalidRequest", `a remote document's URL must be absolute, got ${JSON.stringify(url)}`),
            );
        }
        const { port1, port2 } = new MessageChannel();
        const answered = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
        answerFetches(port1, answered, fetch);
        const fontFiles = new MessageChannel();
        answerFontFiles(fontFiles.port1, fontCache);
        return UDocSession.#start(
            init,
            (id) => ({ id, type: "openRemote", url, fetches: { port: port2, answered }, fontFiles: fontFiles.port2 }),
            [port2, fontFiles.port2],
        ).then((session) => {
            session.#remotePackage = url;
            return session;
        });
    }

    /** Start a worker on the compiled engine and send it `request`, the open. */
    static async #start<R extends WorkerRequest & { type: "open" | "openRemote" }>(
        init: WorkerInit,
        request: (id: number) => R,
        transfer: readonly TransferListItem[] = [],
    ): Promise<UDocSession> {
        const worker = new Worker(new URL("./worker.js", import.meta.url), { workerData: init });
        const session = new UDocSession(worker);
        try {
            session.#opened = await session.#call(request, transfer);
        } catch (error) {
            // A session that failed to open has spent its permit on nothing it
            // can use again, so the thread goes with it.
            await session.close();
            throw error;
        }
        return session;
    }

    /** Drive `worker`, which runs `worker.ts`. See {@link UDocSession.open}. */
    constructor(worker: Worker) {
        this.closed = new Promise((resolve) => (this.#settleClosed = resolve));
        this.#worker = worker;
        worker.unref();
        worker.on("message", (reply: WorkerReply) => this.#settle(reply));
        worker.on("error", (error: Error) =>
            this.#end(
                new UDocError("crashed", `the session's engine thread failed: ${error.message}`, undefined, {
                    cause: error,
                }),
            ),
        );
        worker.on("exit", (code: number) =>
            this.#end(new UDocError("crashed", `the session's engine thread exited (code ${code})`)),
        );
    }

    /** The open document's doc type (`"portable"`, `"presentation"`, …). */
    get docType(): UDocType | undefined {
        return this.#opened?.docType;
    }

    /**
     * The file format the document came from (`"pdf"`, `"pptx"`, …) — what
     * saving it back means — or `undefined` for a package that recorded none.
     */
    get sourceFormat(): FileFormat | undefined {
        return this.#opened?.sourceFormat;
    }

    /**
     * Whether the document was opened from a udoc package rather than
     * imported from a file — which {@link sourceFormat} alone can't tell,
     * since a package reports the format it recorded.
     */
    get fromPackage(): boolean {
        return this.#opened?.fromPackage ?? false;
    }

    /**
     * Whether the document needs a password before it can be read — a PDF
     * encrypted with a user password. Until {@link authenticate} unlocks it,
     * every other call rejects; {@link docType} and {@link sourceFormat} are
     * already known.
     */
    get needsPassword(): boolean {
        return this.#opened?.needsPassword ?? false;
    }

    /**
     * What the license, or with none the permit, entitled the session to — the
     * `features` a host checks before a call that needs one (the sync calls
     * need `collaboration`). Advisory: the engine enforces each at the call it
     * guards, rejecting with a `notEntitled` {@link UDocError}.
     */
    get entitlements(): Entitlements | undefined {
        return this.#opened?.entitlements;
    }

    /**
     * Unlock the document, which {@link needsPassword needs a password}, with
     * `password` — its user or its owner password. Resolves `true` once it is
     * open, and `false` when `password` is refused, the document waiting for
     * another: try as often as it takes. Not a second open — no further permit
     * is spent.
     */
    async authenticate(password: string): Promise<boolean> {
        const unlocked = await this.#call((id) => ({ id, type: "authenticate", password }));
        if (unlocked && this.#opened) this.#opened.needsPassword = false;
        return unlocked;
    }

    /**
     * How many pages the document's primary plane has.
     *
     * A page is known only once it is composed, so this composes the whole
     * plane — for a long flowing document, the cost of laying out all of it.
     * Once paid it is not paid again: asking twice, or rendering any page
     * after, reuses the composed pages. Rejects when a page fails to compose,
     * since the count is then unknown.
     */
    pageCount(): Promise<number> {
        return this.#call((id) => ({ id, type: "pageCount" }));
    }

    /**
     * Save the document as `format`, faithfully — the bytes reopen as the same
     * document. `format` is one of its doc type's own (a PDF saves to `"pdf"`, a
     * presentation to `"pptx"`); {@link sourceFormat} is what saving it back
     * means. `strategy` is how much of the file it was opened from, the
     * original, the saved bytes keep: a `"delta"` or `"incremental"` save
     * writes over it, which a session opened with `UDocNode.openRemote` doesn't
     * hold; without it, the one keeping the most of it that `format` saves by
     * (`"incremental"` for a PDF, `"rewrite"` for a CSV, a TSV, a PSV or an
     * image, else `"delta"`). `delimiter` is the character a CSV's fields are
     * split by; without it, the one the document was opened with, else a comma.
     * Rejects for a format its doc type doesn't save to, a format that never
     * saves by `strategy`, a delimiter for a format that takes none, no
     * original to write over, or a save that isn't built yet.
     */
    saveToBytes(format: FileFormat, strategy?: SaveStrategy, delimiter?: string): Promise<Uint8Array> {
        return this.#call((id) => ({
            id,
            type: "saveToBytes",
            format,
            ...(strategy !== undefined ? { strategy } : {}),
            ...(delimiter !== undefined ? { delimiter } : {}),
        }));
    }

    /**
     * Save the document as a udoc package — the bytes of a `.udoc` zip, which
     * `UDocNode.open` reopens. It records the source format, so a reopened package
     * can still be saved back to it. `version` makes it a checkpoint, baseline
     * `v<version>`, which keeps the edit log a reopen replays; without it the
     * package is a flat baseline — the whole document and no log.
     */
    saveToPackage(version?: number): Promise<Uint8Array> {
        if (version !== undefined && (!Number.isInteger(version) || version < 0 || version > MAX_VERSION)) {
            return Promise.reject(
                new UDocError(
                    "invalidRequest",
                    `version must be a whole number from 0 to ${MAX_VERSION}, got ${version}`,
                ),
            );
        }
        return this.#call((id) => ({ id, type: "saveToPackage", ...(version !== undefined ? { version } : {}) }));
    }

    /**
     * Ask the udoc server the document was opened from (`UDocNode.openRemote`)
     * for a copy of it, saved as its {@link sourceFormat} by `strategy`, else
     * by the engine's for it — a `"delta"` or `"incremental"` copy is the
     * server's to save, since only it holds the original. Resolves with the
     * copy's bytes. Asked with the global
     * `fetch`, not the one the open was given, which only reads. Rejects for a
     * document not opened with `UDocNode.openRemote`, or one that records no source
     * format, and with the server's message for what it refuses.
     */
    async requestRemoteCopy(strategy?: SaveStrategy): Promise<Uint8Array> {
        const format = this.sourceFormat;
        if (format === undefined) {
            throw new UDocError(
                "invalidRequest",
                "requestRemoteCopy: the document records no source format to copy as",
            );
        }
        const query = strategy === undefined ? "" : `?strategy=${encodeURIComponent(strategy)}`;
        const response = await fetch(this.#remote("requestRemoteCopy", `file.${format}${query}`));
        if (!response.ok) throw await refusalOf(response);
        return new Uint8Array(await response.arrayBuffer());
    }

    /**
     * Ask the udoc server the document was opened from (`UDocNode.openRemote`) to
     * checkpoint it: save its document as a new baseline. Resolves with that
     * baseline's version. Nothing reopens: this session goes on as it was.
     * Asked with the global `fetch`, as {@link requestRemoteCopy} is. Rejects
     * for a document not opened with `UDocNode.openRemote`, and with the server's
     * message for what it refuses.
     */
    async requestRemoteCheckpoint(): Promise<RemoteCheckpointResponse> {
        const response = await fetch(this.#remote("requestRemoteCheckpoint", "checkpoints"), { method: "POST" });
        if (!response.ok) throw await refusalOf(response);
        return (await response.json()) as RemoteCheckpointResponse;
    }

    /**
     * `route`, a resource of the document a server keeps, for `call`, which
     * asks it: resolved against the package resource the document was opened
     * from, `…/documents/{id}/package`, so beside it.
     */
    #remote(call: string, route: string): URL {
        if (this.#remotePackage === undefined) {
            throw new UDocError("invalidRequest", `${call}: the document wasn't opened from a server`);
        }
        return new URL(route, this.#remotePackage);
    }

    /**
     * Export the whole document as `format` — a rendering of its laid-out
     * pages, fixed and one-way. Rejects until PDF export is built.
     */
    exportToBytes(format: ExportFormat): Promise<Uint8Array> {
        return this.#call((id) => ({ id, type: "exportToBytes", format }));
    }

    /**
     * Export page `index` (0-based) of the document's primary plane as
     * `format` — `{ png: { scale } }`, where `scale` is output pixels per
     * document point (`1` is 72 DPI).
     *
     * Composes the document through that page first — not past it. Rejects
     * `notFound` when the document turns out to have fewer pages; its message
     * is the page count.
     */
    exportPageToBytes(index: number, format: PageExportFormat): Promise<Uint8Array> {
        if (!Number.isInteger(index) || index < 0 || index > MAX_PAGE_INDEX) {
            return Promise.reject(
                new UDocError(
                    "invalidRequest",
                    `page index must be a whole number from 0 to ${MAX_PAGE_INDEX}, got ${index}`,
                ),
            );
        }
        if (format !== "svg" && (!Number.isFinite(format.png.scale) || format.png.scale <= 0)) {
            return Promise.reject(
                new UDocError("invalidRequest", `scale must be a positive number, got ${format.png.scale}`),
            );
        }
        return this.#call((id) => ({ id, type: "exportPageToBytes", index, format }));
    }

    /**
     * The document's whole editing state — every edit since its baseline — for
     * a peer that has none of it, to {@link merge}. For a peer that has some,
     * {@link patchSince} sends only the rest.
     */
    snapshot(): Promise<Uint8Array> {
        return this.#call((id) => ({ id, type: "snapshot" }));
    }

    /**
     * Which edits this session holds, as the token a peer's {@link patchSince}
     * takes to answer with only the ones this session lacks.
     */
    versionVector(): Promise<Uint8Array> {
        return this.#call((id) => ({ id, type: "versionVector" }));
    }

    /**
     * The edits this session holds that a peer — named by its
     * {@link versionVector} — lacks, for that peer's {@link merge}.
     */
    patchSince(peer: Uint8Array): Promise<Uint8Array> {
        return this.#call((id) => ({ id, type: "patchSince", peer }));
    }

    /**
     * Apply a peer's edits — its {@link snapshot} or {@link patchSince} — to the
     * document. Edits this session already holds are skipped, so merging the
     * same patch twice changes nothing the second time. Rejects when the bytes
     * aren't a patch.
     */
    merge(patch: Uint8Array): Promise<void> {
        return this.#call((id) => ({ id, type: "merge", patch }));
    }

    /**
     * Every peer's presence this session knows of — each one's selection and
     * name — for a peer's {@link mergePresence}. Transient: no history, never
     * part of a save.
     */
    presence(): Promise<Uint8Array> {
        return this.#call((id) => ({ id, type: "presence" }));
    }

    /** Take in a peer's {@link presence}, each peer's latest winning. */
    mergePresence(presence: Uint8Array): Promise<void> {
        return this.#call((id) => ({ id, type: "mergePresence", presence }));
    }

    /** Release the document and its thread. Calls still in flight reject. */
    async close(): Promise<void> {
        this.#end(new UDocError("invalidRequest", "the session is closed"));
        await this.#worker.terminate();
    }

    /**
     * Send `request`, handing over `transfer` with it, and answer with what the
     * worker replies to its type.
     */
    #call<R extends WorkerRequest>(
        request: (id: number) => R,
        transfer: readonly TransferListItem[] = [],
    ): Promise<WorkerResult[R["type"]]> {
        if (this.#ended) return Promise.reject(this.#ended);
        const id = this.#nextId++;
        return new Promise((resolve, reject) => {
            if (this.#pending.size === 0) this.#worker.ref();
            // The worker answers each request with its own type's result, which
            // the reply's shape cannot say for itself.
            this.#pending.set(id, { resolve: resolve as Pending["resolve"], reject });
            this.#worker.postMessage(request(id), transfer);
        });
    }

    #settle(reply: WorkerReply): void {
        const pending = this.#pending.get(reply.id);
        if (!pending) return;
        this.#pending.delete(reply.id);
        if (this.#pending.size === 0) this.#worker.unref();
        if (reply.ok) {
            pending.resolve(reply.result);
            return;
        }
        const error = errorOf(reply.failure);
        if (error.code === "crashed") {
            this.#end(error);
            void this.#worker.terminate();
        }
        pending.reject(error);
    }

    #end(error: UDocError): void {
        if (this.#ended) return;
        this.#ended = error;
        for (const pending of this.#pending.values()) pending.reject(error);
        this.#pending.clear();
        this.#worker.unref();
        this.#settleClosed(error);
    }
}

/**
 * Fetch each URL a worker posts on `port` — a part of the remote document its
 * engine is blocked waiting for — through `fetch`, the global one unless an
 * embedder answers the URLs itself, and post the answer back, counting it in
 * `answered[0]` to wake the worker. The fetch happens here, on the embedder's
 * thread, because the worker's own event loop is stopped while it waits; here
 * it is asynchronous and blocks nothing.
 *
 * Nothing closes `port`: it closes with the worker's end, when the session's
 * thread goes.
 *
 * @internal Exported for the tests.
 */
export function answerFetches(
    port: MessagePort,
    answered: Int32Array,
    fetch: (url: string) => Promise<Uint8Array> = fetchWhole,
): void {
    port.on("message", (url: string) => {
        void fetch(url)
            .then(
                // Its own buffer, whole, so it can be transferred.
                (bytes): FetchAnswer => ({ ok: true, body: bytes.slice().buffer }),
                (error: unknown): FetchAnswer => ({ ok: false, message: reasonOf(error) }),
            )
            .then((answer) => {
                port.postMessage(answer, answer.ok ? [answer.body] : []);
                Atomics.add(answered, 0, 1);
                Atomics.notify(answered, 0);
            });
    });
    // As with the thread: an idle session does not keep the process alive, and
    // a fetch in flight does.
    port.unref();
}

/**
 * Answer each font file a worker asks for on `port` from `cache`, which keeps
 * it for every session of the same `UDocNode` and fetches it only on a miss.
 * Unlike {@link answerFetches}, the worker is not blocked: it awaits the
 * answer, so nothing needs waking.
 *
 * Nothing closes `port`: it closes with the worker's end, when the session's
 * thread goes.
 */
function answerFontFiles(port: MessagePort, cache: FontCache): void {
    port.on("message", ({ id, url }: FontFileRequest) => {
        void cache
            .get(url)
            .then(
                // A copy: the cache keeps its own, and this one is transferred.
                (bytes): FontFileAnswer => ({ id, ok: true, body: bytes.slice().buffer }),
                (error: unknown): FontFileAnswer => ({ id, ok: false, message: reasonOf(error) }),
            )
            .then((answer) => port.postMessage(answer, answer.ok ? [answer.body] : []));
    });
    port.unref();
}

/** The whole body `url` answers with, or a throw saying why it didn't come. */
export async function fetchWhole(url: string): Promise<Uint8Array> {
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
}

/**
 * What a server's failed answer says: its `{ error, message }` body, the code
 * its `error` — or, for a body that isn't one, its status, as `io`. The codes
 * udoc-server keeps of its own answer requests this side never makes, so what
 * comes back is one of the engine's.
 */
async function refusalOf(response: Response): Promise<UDocError> {
    const body = (await response.json().catch(() => undefined)) as { error?: unknown; message?: unknown } | undefined;
    const message = typeof body?.message === "string" ? `: ${body.message}` : "";
    const code = typeof body?.error === "string" ? (body.error as UDocErrorCode) : "io";
    return new UDocError(code, `HTTP ${response.status}${message}`);
}

/** What a failed fetch says. Node's own says only "fetch failed", and why beside it. */
function reasonOf(error: unknown): string {
    if (!(error instanceof Error)) return String(error);
    return error.cause instanceof Error ? `${error.message}: ${error.cause.message}` : error.message;
}

/** The {@link UDocError} `failure` crossed the thread boundary as. */
function errorOf({ code, message, detail }: WorkerFailure): UDocError {
    if (code === "crashed") return new UDocError(code, `the engine crashed, and the session is closed: ${message}`);
    return new UDocError(code, message, detail);
}
