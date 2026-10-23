import { UDocError } from "@docmentis/udoc-wasm/error";
import type { UDocErrorCode } from "@docmentis/udoc-wasm/error";

import type { Channel, ChannelEvents } from "../app/collaboration.js";
import { signaturelessFormat } from "../app/source.js";
import type { LocalServiceDocument, LocalServiceOutbound, LocalServiceRequest } from "./protocol.js";
import { sessionConfigOf } from "./WorkerClient.js";
import type { Wrapper } from "./WorkerClient.js";
import { resolveWasmCandidates } from "./wasm-loader.js";
import type { WasmCandidate, WasmLocateOptions } from "./wasm-loader.js";

/**
 * Options for {@link startLocalCollaborationService}: the license the service's
 * session is started under, and where to find the WASM — as a client's are —
 * and the name of the document's file.
 */
export interface LocalCollaborationServiceOptions {
    /** Commercial license key. Default none: free usage, which is metered and
     *  needs the engine to reach the permit service. */
    license?: string;
    /** Ask for the "Powered by docMentis" decal not to be painted. Honored only
     *  with a license. Default `false`. */
    hideAttribution?: boolean;
    /** Ask for usage not to be reported. Honored only with a license. Default
     *  `false`. */
    disableTelemetry?: boolean;
    /** Where to load the WASM from, for a host that serves it itself. Default
     *  the copy bundled with `@docmentis/udoc-wasm`, then jsDelivr's. */
    wasm?: WasmLocateOptions;
    /** The document's file name, whose extension names a CSV's, a TSV's or a
     *  PSV's format, which has no signature. Default none: the format is
     *  detected from the bytes. */
    filename?: string;
}

/** The close code for a service whose worker failed — its session gone, as udoc-server's 1011 says. */
const CLOSE_SERVICE_ENDED = 1011;

/** The services started in this page and not yet ended, by id. */
const services = new Map<string, LocalCollaborationService>();
let lastServiceId = 0;

/**
 * Start a local collaboration service on the document in `bytes`, its session
 * run as `wrapper`, and resolve with its id: see each package's
 * `startLocalCollaborationService`.
 */
export async function startLocalCollaborationService(
    bytes: Uint8Array,
    options: LocalCollaborationServiceOptions,
    wrapper: Wrapper,
): Promise<string> {
    const id = String(++lastServiceId);
    services.set(id, await LocalCollaborationService.start(bytes, options, wrapper, () => services.delete(id)));
    return id;
}

/** The local collaboration service `id`. Throws when there is none — never started, or ended. */
export function localCollaborationService(id: string): LocalCollaborationService {
    const service = services.get(id);
    if (!service) throw new Error(`no local collaboration service ${id}: it never started, or it has ended`);
    return service;
}

interface Pending {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
}

/**
 * The main thread's handle on a local collaboration service's worker, which
 * holds the document's session and serves its collaboration. It lasts until
 * the last client joined to it leaves — one paused out of its collaboration,
 * its channel closed, still {@link hold}s it — or its worker fails, which ends
 * every client still connected.
 */
export class LocalCollaborationService {
    readonly #worker: Worker;
    readonly #onEnd: () => void;
    readonly #pending = new Map<number, Pending>();
    #nextRequest = 1;
    /** Each connected client's channel events, by the number its connection was given. */
    readonly #connections = new Map<number, ChannelEvents>();
    #nextConnection = 1;
    /** The holds taken and not yet released — clients joined, connected or paused. */
    #holds = 0;
    #ended = false;

    private constructor(worker: Worker, onEnd: () => void) {
        this.#worker = worker;
        this.#onEnd = onEnd;
        worker.onmessage = (ev: MessageEvent<LocalServiceOutbound>) => this.#onMessage(ev.data);
        worker.onerror = (ev) =>
            this.#end(ev instanceof ErrorEvent ? ev.message : "the service's worker failed", "crashed");
    }

    /**
     * Spawn the service's worker, load the WASM in it, and import `bytes` in a
     * session started with `options`, as the format `options.filename` names
     * when the bytes can't say it. Rejects — with a licensing
     * {@link UDocError} when the license refuses the session — and leaves
     * nothing running.
     */
    static async start(
        bytes: Uint8Array,
        options: LocalCollaborationServiceOptions,
        wrapper: Wrapper,
        onEnd: () => void,
    ): Promise<LocalCollaborationService> {
        const candidates = await resolveWasmCandidates(options.wasm);
        // Loaded only now, so a host that never starts a service never loads its worker.
        const { startLocalCollaborationWorker } = await import("./local-collaboration-worker-source.js");
        const worker = startLocalCollaborationWorker();
        const service = new LocalCollaborationService(worker, onEnd);
        try {
            await service.#init(candidates);
            // Sliced to a fresh buffer, so transferring it never detaches the caller's.
            const buffer = bytes.slice().buffer;
            const format = signaturelessFormat(options.filename);
            await service.#send(
                {
                    type: "start",
                    config: sessionConfigOf(options, wrapper),
                    bytes: buffer,
                    ...(format !== undefined ? { format } : {}),
                },
                [buffer],
            );
        } catch (error) {
            worker.terminate();
            throw error;
        }
        return service;
    }

    /**
     * The document as the service keeps it: its udoc package, the edit log over
     * it, and the content of the opaque parts the log names.
     */
    async document(): Promise<{ package: Uint8Array; log: Uint8Array; opaqueParts: Uint8Array }> {
        const document = (await this.#send({ type: "document" })) as LocalServiceDocument;
        return {
            package: new Uint8Array(document.package),
            log: new Uint8Array(document.log),
            opaqueParts: new Uint8Array(document.opaqueParts),
        };
    }

    /**
     * Open one client's channel to the collaboration: a port to the service's
     * worker, speaking udoc-server's messages. It is never lost, so never
     * rejoined; closing it from this side is the client leaving, or pausing —
     * which keeps its {@link hold}.
     */
    openChannel(events: ChannelEvents): Channel {
        // Ended while a client was paused out of it: closed as its worker's end
        // closed those connected.
        if (this.#ended) {
            queueMicrotask(() =>
                events.closed(CLOSE_SERVICE_ENDED, "the local collaboration service has ended", false),
            );
            return { send: () => {}, close: () => {} };
        }
        const connection = this.#nextConnection++;
        const { port1, port2 } = new MessageChannel();
        port1.onmessage = (ev: MessageEvent<Uint8Array>) => events.received(ev.data);
        this.#connections.set(connection, events);
        this.#worker.postMessage({ type: "connect", connection, port: port2 }, [port2]);
        // Open as soon as it is made, but reported once it has been returned.
        queueMicrotask(() => {
            if (this.#connections.has(connection)) events.opened();
        });
        return {
            send: (message) => port1.postMessage(message),
            close: () => {
                port1.close();
                this.#disconnect(connection);
            },
        };
    }

    /**
     * Hold the service until the returned release is called: a client holds it
     * from its join until it leaves, so pausing — its channel closed — doesn't
     * end the service with its last connection. A release called again does
     * nothing.
     */
    hold(): () => void {
        this.#holds++;
        let released = false;
        return () => {
            if (released) return;
            released = true;
            this.#holds--;
            if (this.#unused()) this.#end("the last client joined to it left", "invalidRequest");
        };
    }

    /** Try each candidate in turn until one loads in the worker. */
    async #init(candidates: WasmCandidate[]): Promise<void> {
        let lastError: unknown;
        for (const candidate of candidates) {
            try {
                await this.#send({ type: "init", wasmUrl: candidate.wasmUrl, fonts: candidate.fonts });
                return;
            } catch (err) {
                lastError = err;
            }
        }
        throw lastError instanceof UDocError
            ? lastError
            : new UDocError("io", "startLocalCollaborationService: WASM failed to load from all candidate URLs.");
    }

    /** Connection `connection` is gone; the last one gone, with nothing held, ends the service. */
    #disconnect(connection: number): void {
        if (!this.#connections.delete(connection)) return;
        if (this.#unused()) this.#end("the last client joined to it left", "invalidRequest");
        else this.#worker.postMessage({ type: "disconnect", connection });
    }

    /** Whether nothing keeps the service: no connection, and no hold. */
    #unused(): boolean {
        return this.#connections.size === 0 && this.#holds === 0;
    }

    /**
     * End the service: its worker stops, every client still connected is closed
     * with `reason`, and a request still waiting rejects with `code` — `crashed`
     * when its worker failed.
     */
    #end(reason: string, code: UDocErrorCode): void {
        if (this.#ended) return;
        this.#ended = true;
        this.#onEnd();
        this.#worker.terminate();
        for (const { reject } of this.#pending.values())
            reject(new UDocError(code, `the local collaboration service ended: ${reason}`));
        this.#pending.clear();
        const connected = [...this.#connections.values()];
        this.#connections.clear();
        for (const events of connected) events.closed(CLOSE_SERVICE_ENDED, reason, false);
    }

    #send(msg: LocalServiceRequest, transfer?: Transferable[]): Promise<unknown> {
        // A worker that failed takes nothing more, so nothing would answer.
        if (this.#ended) {
            return Promise.reject(new UDocError("invalidRequest", "the local collaboration service has ended"));
        }
        const _id = this.#nextRequest++;
        return new Promise((resolve, reject) => {
            this.#pending.set(_id, { resolve, reject });
            this.#worker.postMessage({ ...msg, _id }, transfer ?? []);
        });
    }

    #onMessage(msg: LocalServiceOutbound): void {
        if ("type" in msg) {
            // The worker closed a connection: an edit its engine couldn't take.
            const events = this.#connections.get(msg.connection);
            if (!events) return;
            this.#disconnect(msg.connection);
            events.closed(msg.code, msg.reason, false);
            return;
        }
        const pending = this.#pending.get(msg._id);
        if (!pending) return;
        this.#pending.delete(msg._id);
        if (msg.ok) pending.resolve(msg.result);
        else pending.reject(new UDocError(msg.error.code, msg.error.message, msg.error.detail));
    }
}
