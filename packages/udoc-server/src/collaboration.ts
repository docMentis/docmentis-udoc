// Clients editing a kept document together (docs/design/node-collaboration.md):
// a collaboration is the document's pooled session, held open while any client
// is connected; each client's edits are merged into it, sent on to every other
// client, and kept in the store as the document's edit log. The engine does
// the merging, and the server only carries its bytes, over a WebSocket.

import type { UDocSession } from "@docmentis/udoc-node";
import { WebSocketServer } from "ws";
import type { RawData, WebSocket } from "ws";

import { LICENSE_CODES, failureOf, messageOf } from "./http.ts";
import type { Upgrade } from "./http.ts";
import type { SessionPool } from "./session-pool.ts";
import type { DocumentStore } from "./store.ts";

/**
 * A collaboration message is a binary frame: one byte saying what it is, then
 * its payload — the engine's own bytes, crossed as they are.
 */
const JOIN = 1;
const PATCH = 2;
const PRESENCE = 3;
/** The content of opaque parts a client's next patch names — kept before that patch is merged. */
const OPAQUE_PARTS = 4;

/**
 * Why the server ends a client's connection: the WebSocket close codes it
 * sends — WebSocket's own where it defines the meaning, and this server's from
 * 4000.
 */
const CLOSE_SERVER_CLOSING = 1001;
const CLOSE_PROTOCOL_ERROR = 1002;
const CLOSE_NOT_BINARY = 1003;
const CLOSE_DID_NOT_MERGE = 1008;
const CLOSE_SESSION_ENDED = 1011;
const CLOSE_NO_DOCUMENT = 4000;
const CLOSE_LICENSE_REFUSED = 4001;
const CLOSE_CANNOT_OPEN = 4002;

/** The collaboration on each document being edited now, and the clients arriving at them. */
export class Collaborations {
    readonly #store: DocumentStore;
    readonly #sessions: SessionPool;
    readonly #collaborations = new Map<string, Collaboration>();
    readonly #sockets: WebSocketServer;
    #closing = false;

    /** Over the documents `store` keeps and the sessions `sessions` holds open; no message larger than `maxPayload` bytes. */
    constructor(store: DocumentStore, sessions: SessionPool, maxPayload: number) {
        this.#store = store;
        this.#sessions = sessions;
        this.#sockets = new WebSocketServer({ noServer: true, maxPayload });
    }

    /**
     * Take `upgrade` into document `id`'s collaboration, once its session is
     * open. What refuses it — the server closing, a session that can't be
     * opened — takes the upgrade and closes it with the code saying why.
     */
    async join(id: string, upgrade: Upgrade): Promise<void> {
        if (this.#closing) {
            this.#refuse(upgrade, CLOSE_SERVER_CLOSING, "the server is closing");
            return;
        }
        const collaboration = this.#collaborationOf(id);
        const arrival = collaboration.arrive();
        // A client that goes before it is admitted leaves nothing held.
        upgrade.socket.once("close", () => arrival.leave());
        try {
            await collaboration.session;
        } catch (error) {
            arrival.leave();
            this.refuse(upgrade, error);
            return;
        }
        this.#sockets.handleUpgrade(upgrade.request, upgrade.socket, upgrade.head, (client) => arrival.admit(client));
    }

    /**
     * Take `upgrade` and close it with the code `error` calls for: no such
     * document, a license refusal, or a document that can't be opened.
     */
    refuse(upgrade: Upgrade, error: unknown): void {
        this.#refuse(upgrade, ...closeOf(error, false));
    }

    /** End document `id`'s collaboration, if one is under way: the document is no longer kept. */
    end(id: string): void {
        this.#collaborations.get(id)?.end(CLOSE_NO_DOCUMENT, "the document was deleted");
    }

    /** Refuse every client arriving from now on, and end every collaboration once its log is kept. */
    async close(): Promise<void> {
        this.#closing = true;
        const ending = [...this.#collaborations.values()];
        for (const collaboration of ending) collaboration.end(CLOSE_SERVER_CLOSING, "the server is closing");
        await Promise.all(ending.map((collaboration) => collaboration.done));
        this.#sockets.close();
    }

    /** Document `id`'s collaboration: the one under way, or a new one. */
    #collaborationOf(id: string): Collaboration {
        let collaboration = this.#collaborations.get(id);
        if (!collaboration || collaboration.ended) {
            collaboration = new Collaboration(id, this.#store, this.#sessions, (ended) => {
                if (this.#collaborations.get(id) === ended) this.#collaborations.delete(id);
            });
            this.#collaborations.set(id, collaboration);
        }
        return collaboration;
    }

    /** Take `upgrade` and close it at once with `code` and `reason`. */
    #refuse({ request, socket, head }: Upgrade, code: number, reason: string): void {
        this.#sockets.handleUpgrade(request, socket, head, (client) => client.close(code, truncateReason(reason)));
    }
}

/** A client arriving at a collaboration, until it is admitted or leaves first. */
interface Arrival {
    /** It is connected: from now its connection's close is its leaving. */
    admit(client: WebSocket): void;
    /** It went without being admitted. Does nothing once admitted. */
    leave(): void;
}

/**
 * Document `id`'s collaboration: the clients editing it together over its
 * pooled session, which it holds busy — so neither idled out nor evicted — for
 * as long as any client is connected or arriving. A client's edits are merged
 * into the session, sent on to every other client, and kept as the document's
 * edit log; its presence is merged and sent on, and never kept.
 *
 * The log is the session's whole editing state, written after every merge —
 * one write at a time, the next taking in everything merged meanwhile — and
 * once more before the session is let go.
 */
class Collaboration {
    /** The session, once the pool has it open; rejects when it can't be opened. */
    readonly session: Promise<UDocSession>;
    /** Settles once the collaboration is over and its log is kept. */
    readonly done: Promise<void>;
    readonly #id: string;
    readonly #store: DocumentStore;
    readonly #onEnd: (collaboration: Collaboration) => void;
    /** Every connected client; the joined ones are those edits are sent on to. */
    readonly #clients = new Set<WebSocket>();
    readonly #joined = new Set<WebSocket>();
    #arriving = 0;
    #ended = false;
    #finish!: () => void;
    /** Whether something merged since the log was last written. */
    #logBehind = false;
    #logWriting: Promise<void> | undefined;

    constructor(
        id: string,
        store: DocumentStore,
        sessions: SessionPool,
        onEnd: (collaboration: Collaboration) => void,
    ) {
        this.#id = id;
        this.#store = store;
        this.#onEnd = onEnd;
        this.done = new Promise((resolve) => (this.#finish = resolve));
        this.session = new Promise((resolve, reject) => {
            // The collaboration is one long use of the pooled session.
            sessions
                .use(id, (session) => {
                    resolve(session);
                    // However it goes — closed, or its engine gone — the
                    // clients can't go on with it.
                    void session.closed.then((reason) =>
                        this.end(CLOSE_SESSION_ENDED, `the document's session ended: ${reason.message}`),
                    );
                    return this.done;
                })
                .catch((error: unknown) => {
                    reject(error);
                    this.#ended = true;
                    this.#finish();
                    this.#onEnd(this);
                });
        });
        // Its failure is each arrival's to answer, not an unhandled rejection.
        this.session.catch(() => {});
    }

    /** Whether it is over, so an arriving client needs a new one. */
    get ended(): boolean {
        return this.#ended;
    }

    /** Count a client arriving, so the collaboration lasts until it is admitted or leaves. */
    arrive(): Arrival {
        this.#arriving++;
        let settled = false;
        const settle = () => {
            if (settled) return false;
            settled = true;
            this.#arriving--;
            return true;
        };
        return {
            admit: (client) => {
                if (!settle()) {
                    client.close(CLOSE_SESSION_ENDED, "the collaboration ended");
                    return;
                }
                if (this.#ended) {
                    client.close(CLOSE_SESSION_ENDED, "the collaboration ended");
                    this.#settleIfEmpty();
                    return;
                }
                this.#admit(client);
            },
            leave: () => {
                if (settle()) this.#settleIfEmpty();
            },
        };
    }

    /** End it now: close every client with `code` and `reason`, keep the log, let the session go. */
    end(code: number, reason: string): void {
        if (this.#ended) return;
        this.#ended = true;
        this.#onEnd(this);
        for (const client of this.#clients) client.close(code, reason);
        void this.#logKept().then(() => this.#finish());
    }

    #admit(client: WebSocket): void {
        this.#clients.add(client);
        // One message at a time per client, in the order it sent them.
        let received = Promise.resolve();
        client.on("message", (data: RawData, isBinary: boolean) => {
            received = received.then(() => this.#receive(client, data, isBinary));
        });
        client.on("close", () => {
            this.#clients.delete(client);
            this.#joined.delete(client);
            this.#settleIfEmpty();
        });
    }

    async #receive(client: WebSocket, data: RawData, isBinary: boolean): Promise<void> {
        const message = isBinary && Buffer.isBuffer(data) ? data : undefined;
        if (!message || message.byteLength === 0) {
            client.close(CLOSE_NOT_BINARY, "a message is a binary frame: its kind's byte, then its payload");
            return;
        }
        const kind = message[0];
        const payload = new Uint8Array(message.subarray(1));
        const joined = this.#joined.has(client);
        if (kind !== JOIN && !joined) {
            client.close(CLOSE_PROTOCOL_ERROR, "join first");
            return;
        }
        const session = await this.session;
        try {
            switch (kind) {
                case JOIN: {
                    if (joined) {
                        client.close(CLOSE_PROTOCOL_ERROR, "already joined");
                        return;
                    }
                    // Joined before it is answered, so an edit merged while the
                    // answer is made is sent on to it too: it may get one
                    // twice, which merging makes harmless, but never not at all.
                    this.#joined.add(client);
                    const missing = await session.patchSince(payload);
                    const held = await session.versionVector();
                    const presence = await session.presence();
                    send(client, JOIN, held);
                    send(client, PATCH, missing);
                    send(client, PRESENCE, presence);
                    return;
                }
                case OPAQUE_PARTS:
                    // Kept before the patch that names them is merged or sent on,
                    // so no client learns of a part it can't load.
                    await this.#store.putOpaqueParts(this.#id, payload);
                    return;
                case PATCH:
                    await session.merge(payload);
                    this.#sendOn(client, PATCH, payload);
                    this.#keepLog();
                    return;
                case PRESENCE:
                    await session.mergePresence(payload);
                    this.#sendOn(client, PRESENCE, payload);
                    return;
                default:
                    client.close(CLOSE_PROTOCOL_ERROR, `no message is of kind ${kind}`);
            }
        } catch (error) {
            // What a client sent that the engine can't take ends that client
            // alone; nothing of it was sent on or kept.
            if (this.#ended) return;
            const [code, reason] = closeOf(error, true);
            client.close(code, truncateReason(reason));
        }
    }

    /** Send `payload` as `kind` to every joined client but `from`. */
    #sendOn(from: WebSocket, kind: number, payload: Uint8Array): void {
        for (const client of this.#joined) if (client !== from) send(client, kind, payload);
    }

    /** Once no client is connected or arriving, end it — unless one arrives while its log is written. */
    #settleIfEmpty(): void {
        if (this.#ended || this.#clients.size > 0 || this.#arriving > 0) return;
        void this.#logKept().then(() => {
            if (this.#ended || this.#clients.size > 0 || this.#arriving > 0) return;
            this.#ended = true;
            this.#onEnd(this);
            this.#finish();
        });
    }

    /** Write the log, now or after the write under way, which then takes this merge in too. */
    #keepLog(): void {
        this.#logBehind = true;
        this.#logWriting ??= this.#writeLog().finally(() => (this.#logWriting = undefined));
    }

    async #writeLog(): Promise<void> {
        const session = await this.session;
        while (this.#logBehind) {
            this.#logBehind = false;
            try {
                await this.#store.putLog(this.#id, await session.snapshot());
            } catch (error) {
                // A document deleted meanwhile has nothing to keep it for.
                if (!this.#ended) {
                    console.error(`udoc-server: document ${this.#id}'s edits could not be kept: ${messageOf(error)}`);
                }
            }
        }
    }

    /** Settles once every merge so far is in the kept log. */
    async #logKept(): Promise<void> {
        while (this.#logWriting) await this.#logWriting;
    }
}

/** Send `payload` to `client` as a message of `kind`. */
function send(client: WebSocket, kind: number, payload: Uint8Array): void {
    const message = new Uint8Array(payload.byteLength + 1);
    message[0] = kind;
    message.set(payload, 1);
    client.send(message);
}

/** A close reason fits in a control frame: at most 123 bytes of UTF-8. */
function truncateReason(reason: string): string {
    const bytes = new TextEncoder().encode(reason);
    return bytes.byteLength <= 123 ? reason : `${new TextDecoder().decode(bytes.subarray(0, 120))}...`;
}

/**
 * The close code and reason `error` calls for, picked by its code: a license
 * refusal, or no such document; then, for a document that couldn't be opened,
 * that; and once it is open, its session failing — `internal` or `crashed` —
 * or else a payload the engine couldn't merge.
 */
function closeOf(error: unknown, opened: boolean): [code: number, reason: string] {
    const { code, message } = failureOf(error);
    if (LICENSE_CODES.has(code)) return [CLOSE_LICENSE_REFUSED, message];
    if (code === "notFound") return [CLOSE_NO_DOCUMENT, message];
    if (!opened) return [CLOSE_CANNOT_OPEN, message];
    if (code === "internal" || code === "crashed") return [CLOSE_SESSION_ENDED, message];
    return [CLOSE_DID_NOT_MERGE, message];
}
