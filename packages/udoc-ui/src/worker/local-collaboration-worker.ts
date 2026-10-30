// A local collaboration service's worker: one document's session, headless,
// kept open to serve the clients in this page that open and join it.
//
// It is what udoc-server is to a document it keeps, in the page. The session
// imports the document once and keeps its udoc package, so every client that
// opens the package holds the same ids — the loaders mint ids in the order
// parts load, so two clients opening the bytes themselves would not (the core
// design's "Bootstrap and identity"). Then it serves the collaboration as
// udoc-server does (docs/design/node-collaboration.md): each client connects
// through a MessagePort speaking the server's messages, a join is answered with
// what the client lacks, and a patch or a presence is merged and sent on to the
// others. It sends no presence of its own: a joiner learns the peers from their
// own, which each refreshes and sends whole on its period.
//
// Unlike udoc-server it keeps no opaque parts a loader could read back — a
// client here opened the package's bytes — so it acknowledges none. It holds
// them in its own session instead, sends them on as it does a patch, and hands
// them to a client that opens or joins (the core design's opaque parts).

import initEngine, { startSession } from "@docmentis/udoc-wasm";
import type { FontLocation, WasmSession } from "@docmentis/udoc-wasm";
import { UDocError } from "@docmentis/udoc-wasm/error";

import { JOIN, OPAQUE_PARTS, PATCH, PRESENCE } from "../app/collaboration.js";
import type { LocalServiceDocument, LocalServiceOutbound, LocalServiceRequestEnvelope } from "./protocol.js";

interface WorkerScope {
    onmessage: ((ev: MessageEvent<LocalServiceRequestEnvelope>) => void) | null;
    postMessage(message: LocalServiceOutbound, transfer?: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

/** The close code for a message the engine couldn't take — udoc-server's, for the same. */
const CLOSE_DID_NOT_MERGE = 1008;

/** Where the office-compatible fonts are, beside the binary `init` loaded — null until it has. */
let fonts: FontLocation | null = null;
let session: WasmSession | null = null;
/** The document's udoc package, saved once it was imported. */
let documentPackage: Uint8Array | null = null;
/** Each connected client's port, by the service's number for its connection. */
const ports = new Map<number, MessagePort>();
/** The ports whose join has been answered: what an edit or a presence is sent on to. */
const joined = new Set<MessagePort>();

scope.onmessage = (ev) => void handle(ev.data);

async function handle(msg: LocalServiceRequestEnvelope): Promise<void> {
    const id = msg._id;
    try {
        switch (msg.type) {
            case "init": {
                await initEngine({ module_or_path: msg.wasmUrl });
                fonts = msg.fonts;
                reply(id, undefined);
                break;
            }
            case "start": {
                if (!fonts) throw new Error("local collaboration service: start before init");
                session = await startSession(msg.config, fonts);
                session.open(new Uint8Array(msg.bytes), msg.format);
                documentPackage = session.saveToPackage();
                reply(id, undefined);
                break;
            }
            case "document": {
                const s = opened();
                // The package as imported, and every edit merged since: what
                // udoc-server keeps as a document's package and its log.
                const document: LocalServiceDocument = {
                    package: documentPackage!.slice().buffer,
                    log: s.snapshot().slice().buffer,
                    // An empty version vector lacks every write: all of them.
                    opaqueParts: s.opaquePartsSince(new Uint8Array()).slice().buffer,
                };
                reply(id, document, undefined, [document.package, document.log, document.opaqueParts]);
                break;
            }
            case "connect": {
                const { connection, port } = msg;
                ports.set(connection, port);
                port.onmessage = (ev: MessageEvent<Uint8Array>) => receive(connection, port, ev.data);
                break;
            }
            case "disconnect":
                leave(msg.connection);
                break;
        }
    } catch (err) {
        if (id !== undefined) reply(id, undefined, err);
    }
}

/**
 * Take one message from the client on `connection`, as udoc-server takes one
 * from a client. Every call here is synchronous, so nothing is merged between
 * a join and its answer. What the engine can't take closes that client's
 * connection alone, and nothing of it is sent on.
 */
function receive(connection: number, port: MessagePort, message: Uint8Array): void {
    const s = opened();
    const payload = message.subarray(1);
    try {
        switch (message[0]) {
            case JOIN: {
                joined.add(port);
                send(port, JOIN, s.versionVector());
                // Ahead of the patch that names them, as a client sends its own.
                const parts = s.opaquePartsSince(payload);
                if (parts.byteLength > 0) send(port, OPAQUE_PARTS, parts);
                send(port, PATCH, s.patchSince(payload));
                break;
            }
            case OPAQUE_PARTS:
                s.mergeOpaqueParts(payload);
                sendOn(port, OPAQUE_PARTS, payload);
                break;
            case PATCH:
                s.mergePatch(payload);
                sendOn(port, PATCH, payload);
                break;
            case PRESENCE:
                s.mergePresence(payload);
                sendOn(port, PRESENCE, payload);
                break;
        }
    } catch (error) {
        // A trap leaves the instance unusable for every client, not this one:
        // thrown on, it fails the worker, which ends the service.
        const failure = UDocError.from(error);
        if (failure.code === "crashed") throw error;
        disconnect(connection);
        scope.postMessage({ type: "closed", connection, code: CLOSE_DID_NOT_MERGE, reason: failure.message });
    }
}

/** Send `payload` as `kind` to every joined client but `from`. */
function sendOn(from: MessagePort, kind: number, payload: Uint8Array): void {
    for (const port of joined) if (port !== from) send(port, kind, payload);
}

/** Send `payload` to `port` as a message of `kind`. */
function send(port: MessagePort, kind: number, payload: Uint8Array): void {
    const message = new Uint8Array(payload.byteLength + 1);
    message[0] = kind;
    message.set(payload, 1);
    port.postMessage(message);
}

/** Close the client on `connection` from this side: what it sends after is not taken. */
function disconnect(connection: number): void {
    const port = leave(connection);
    port?.close();
}

/**
 * Take the client on `connection` out of what is sent on, as it leaves. It
 * closed its end, which ends the port for both sides, so this side's is left
 * open: what the client sent just before it left — its last edits, the
 * withdrawal of its presence — comes over that port and may arrive after this,
 * and is still taken. Returns its port, if it was still connected.
 */
function leave(connection: number): MessagePort | undefined {
    const port = ports.get(connection);
    if (!port) return undefined;
    ports.delete(connection);
    joined.delete(port);
    return port;
}

function opened(): WasmSession {
    if (!session) throw new Error("local collaboration service: no document is open");
    return session;
}

function reply(id: number | undefined, result: unknown, error?: unknown, transfer?: Transferable[]): void {
    if (id === undefined) return;
    if (error !== undefined) {
        // An `Error` loses its class crossing to the main thread, so the
        // `UDocError` crosses as its fields, for the service to rebuild.
        const { code, message, detail } = UDocError.from(error);
        scope.postMessage({ _id: id, ok: false, error: { code, message, ...(detail && { detail }) } });
    } else {
        scope.postMessage({ _id: id, ok: true, result }, transfer ?? []);
    }
}
