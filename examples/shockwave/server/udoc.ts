// udoc-server, which keeps the library's documents, behind the gate
// (docs/design/examples-shockwave.md). Its routes sit under `/udoc` on the
// backend's own HTTP server. udoc-server has no end-user authentication, and
// its ids are global, so a request reaches it only past the gate: the
// backend's own, with this process's token; a signed-in user's, reading a
// document their tenant has an asset for, all of it if they read the library
// and only its published version if not; or one who changes the library,
// joining the collaboration that edits it.
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { Duplex } from "node:stream";

import { UDocNode } from "@docmentis/udoc-node";
import { DirectoryDocumentStore, createUDocServer } from "@docmentis/udoc-server";

import { managesLibrary, readsLibrary } from "../shared/api.ts";
import type { Failure } from "../shared/api.ts";
import { userOf } from "./auth.ts";
import { config } from "./config.ts";

/** The path udoc-server's routes sit beneath. */
const BASE = "/udoc";

/** The header the backend's own requests carry this process's token in. */
const TOKEN_HEADER = "x-shockwave-token";

/** A document's routes: `/udoc/documents/:id`, and those under it. */
const DOCUMENT_PATH = new RegExp(`^${BASE}/documents/([^/]+)(?:/|$)`);

/** One checkpoint's routes: `/udoc/documents/:id/checkpoints/:version`, and those under it. */
const CHECKPOINT_PATH = new RegExp(`^${BASE}/documents/[^/]+/checkpoints/(\\d+)(?:/|$)`);

/** udoc-server, refusing what it was asked: its status, and its failure. */
export class UdocFailure extends Error {
    readonly status: number;
    readonly failure: Failure;

    constructor(status: number, failure: Failure) {
        super(failure.message);
        this.status = status;
        this.failure = failure;
    }
}

export interface Udoc {
    /** Answer `request`, past the gate, if it's for udoc-server, and return true; false if it isn't. */
    handleRequest(request: IncomingMessage, response: ServerResponse): boolean;
    /** Answer a WebSocket upgrade, past the gate, if it's for udoc-server, and return true; false if it isn't. */
    handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): boolean;
    /** Import `bytes`, an upload: the id udoc-server keeps it as, and the format it was read as. */
    importDocument(bytes: Uint8Array): Promise<{ id: string; format: string }>;
    /** Forget document `id`; one udoc-server doesn't keep is forgotten already. */
    deleteDocument(id: string): Promise<void>;
    /** Save document `id` as it is now as a new checkpoint: the checkpoint's number. */
    checkpoint(id: string): Promise<number>;
    /**
     * Document `id`'s first page as a PNG, `scale` pixels to a point; `null`
     * for one udoc-server turns down, as a workbook's, all of its first sheet
     * (GAPS.md).
     */
    renderFirstPage(id: string, scale: number): Promise<Uint8Array | null>;
    close(): Promise<void>;
}

/**
 * udoc-server over the documents in `data/udoc/`, opening them with a
 * `UDocNode` under `UDOC_LICENSE` and `UDOC_DOMAIN` when they're set, as
 * udoc-server's own command does; without them, usage is free and metered.
 */
export async function createUdoc(db: DatabaseSync): Promise<Udoc> {
    const license = process.env.UDOC_LICENSE;
    const domain = process.env.UDOC_DOMAIN;
    const udoc = await UDocNode.create({ ...(license ? { license } : {}), ...(domain ? { domain } : {}) });
    const store = new DirectoryDocumentStore(join(config.dataDir, "udoc"));
    const server = createUDocServer({ udoc, store, basePath: BASE });
    const token = randomBytes(32).toString("base64url");
    const origin = `http://127.0.0.1:${config.port}`;

    /** Whether `request` carries this process's token: the backend's own. */
    function fromBackend(request: IncomingMessage): boolean {
        const sent = Buffer.from(String(request.headers[TOKEN_HEADER] ?? ""));
        const expected = Buffer.from(token);
        return sent.length === expected.length && timingSafeEqual(sent, expected);
    }

    /** Whether document `id` is one tenant `tenantId` has an asset for. */
    function keptFor(id: string | undefined, tenantId: string): boolean {
        if (id === undefined) return false;
        return (
            db.prepare("SELECT 1 FROM assets WHERE document_id = ? AND tenant_id = ?").get(id, tenantId) !== undefined
        );
    }

    /** Whether checkpoint `checkpoint` of document `id` is its file's published version. */
    function published(id: string, checkpoint: number): boolean {
        const row = db
            .prepare(
                `SELECT 1 FROM assets JOIN versions ON versions.asset_id = assets.id
                    AND versions.number = assets.published_version
                WHERE assets.document_id = ? AND versions.checkpoint = ?`,
            )
            .get(id, checkpoint);
        return row !== undefined;
    }

    /** Why the gate turns `request` away, or `undefined` to let it through. */
    function refusal(request: IncomingMessage): [number, Failure] | undefined {
        if (fromBackend(request)) return undefined;
        const user = userOf(db, request);
        if (!user) return [401, { error: "signedOut", message: "no one is signed in" }];
        const path = pathOf(request);
        const id = DOCUMENT_PATH.exec(path)?.[1];
        // Another tenant's document is as unknown as one that isn't kept.
        const unknown: [number, Failure] = [404, { error: "notFound", message: "no such document" }];
        if (!keptFor(id, user.tenant.id)) return unknown;
        // Reading alone: the backend imports, checkpoints and deletes.
        if (request.method !== "GET" && request.method !== "HEAD")
            return [403, { error: "forbidden", message: "a document is read here, not changed" }];
        if (readsLibrary(user.role)) return undefined;
        // Anyone else reads the version published, and nothing of the document around it.
        const checkpoint = CHECKPOINT_PATH.exec(path)?.[1];
        return checkpoint !== undefined && published(id!, Number(checkpoint)) ? undefined : unknown;
    }

    /** Whether `request`, a WebSocket upgrade, joins the collaboration of a document the user changes. */
    function mayEdit(request: IncomingMessage): boolean {
        const user = userOf(db, request);
        if (!user || !managesLibrary(user.role)) return false;
        return keptFor(DOCUMENT_PATH.exec(pathOf(request))?.[1], user.tenant.id);
    }

    /** Ask udoc-server for `path`, as the backend: its answer, or a `UdocFailure`. */
    async function ask(method: string, path: string, body?: Uint8Array): Promise<Response> {
        const response = await fetch(`${origin}${BASE}${path}`, {
            method,
            headers: { [TOKEN_HEADER]: token },
            body,
        });
        if (response.ok) return response;
        const failure = (await response.json().catch(() => undefined)) as Failure | undefined;
        throw new UdocFailure(response.status, failure ?? { error: "internal", message: response.statusText });
    }

    return {
        handleRequest(request, response) {
            if (!isUdocPath(pathOf(request))) return false;
            const refused = refusal(request);
            if (refused) {
                const [status, failure] = refused;
                response.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(failure));
            } else if (!server.handleRequest(request, response)) {
                response
                    .writeHead(404, { "content-type": "application/json" })
                    .end(JSON.stringify({ error: "notFound", message: "no such resource" }));
            }
            return true;
        },

        // Collaboration, udoc-server's one upgrade, is how a document is
        // edited, and only those who change the library edit one.
        handleUpgrade(request, socket, head) {
            if (!isUdocPath(pathOf(request))) return false;
            if (!mayEdit(request)) socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
            else if (!server.handleUpgrade(request, socket, head))
                socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
            return true;
        },

        // udoc-server imports only over HTTP, so the backend asks it as a
        // client would, over loopback (GAPS.md).
        async importDocument(bytes) {
            const { id } = (await (await ask("POST", "/documents", bytes)).json()) as { id: string };
            const description = await store.getDescription(id);
            return { id, format: description?.sourceFormat ?? "unknown" };
        },

        async deleteDocument(id) {
            try {
                await ask("DELETE", `/documents/${encodeURIComponent(id)}`);
            } catch (error) {
                if (!(error instanceof UdocFailure && error.status === 404)) throw error;
            }
        },

        async checkpoint(id) {
            const response = await ask("POST", `/documents/${encodeURIComponent(id)}/checkpoints`);
            return ((await response.json()) as { version: number }).version;
        },

        async renderFirstPage(id, scale) {
            try {
                const page = await ask("GET", `/documents/${encodeURIComponent(id)}/layout/pages/0.png?scale=${scale}`);
                return new Uint8Array(await page.arrayBuffer());
            } catch (error) {
                // A page it won't render is the request's fault; its own failing isn't.
                if (error instanceof UdocFailure && error.status < 500) return null;
                throw error;
            }
        },

        close: () => server.close(),
    };
}

function pathOf(request: IncomingMessage): string {
    return new URL(request.url ?? "/", "http://localhost").pathname;
}

function isUdocPath(path: string): boolean {
    return path === BASE || path.startsWith(`${BASE}/`);
}
