// udoc-server, which keeps the documents, behind the gate
// (docs/design/examples-shockwave.md). Each tenant has its own: its own store, at
// `data/udoc/:tenantId`, and its own sessions, so one tenant's document isn't there
// to be found by another's request, whatever the gate lets through, and one tenant's
// load doesn't close another's sessions. Their routes sit under `/udoc` on the
// backend's own HTTP server, and a request goes to the server of the tenant it's for.
//
// udoc-server has no end-user authentication, so a request reaches it only past the
// gate: the backend's own, with this process's token, for the tenant it names; a
// signed-in user's, reading a document their tenant has an asset for, all of it if
// they read the library and only its published version if not; one who changes the
// library, joining the collaboration that edits it; those who enter a deal room,
// doing either with its files, and a reviewer, reading the versions sent to them; and
// a buyer's, with no account, reading a file a frontstage's link shows, at the version
// it shows.
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { Duplex } from "node:stream";

import { UDocNode } from "@docmentis/udoc-node";
import { DirectoryDocumentStore, createUDocServer } from "@docmentis/udoc-server";
import type { UDocServer } from "@docmentis/udoc-server";

import { managesLibrary, readsLibrary } from "../shared/api.ts";
import type { Failure } from "../shared/api.ts";
import { tenantOfFrontstage, userOf } from "./auth.ts";
import { config } from "./config.ts";
import { TenantDb } from "./db.ts";
import { entersDealRoom } from "./dealRooms.ts";

/** The path udoc-server's routes sit beneath. */
const BASE = "/udoc";

/** The header the backend's own requests carry this process's token in. */
const TOKEN_HEADER = "x-shockwave-token";

/** The header the backend's own requests name the tenant they're for in. */
const TENANT_HEADER = "x-shockwave-tenant";

/** A document's routes: `/udoc/documents/:id`, and those under it. */
const DOCUMENT_PATH = new RegExp(`^${BASE}/documents/([^/]+)(?:/|$)`);

/** One checkpoint's routes: `/udoc/documents/:id/checkpoints/:version`, and those under it. */
const CHECKPOINT_PATH = new RegExp(`^${BASE}/documents/[^/]+/checkpoints/(\\d+)(?:/|$)`);

/**
 * Where a frontstage's file opens: `/udoc/frontstage/:token/files/:assetId/versions/:number/package`,
 * and what's under it. The buyer's viewer asks for no more than a version's package
 * names, and never learns what document holds it.
 */
const FRONTSTAGE_PATH = new RegExp(`^${BASE}/frontstage/([^/]+)/files/([^/]+)/versions/(\\d+)/package(/.*)?$`);

/** Where the viewer opens version `number` of frontstage `token`'s file `assetId` from. */
export function frontstagePackagePath(token: string, assetId: string, number: number): string {
    return `${BASE}/frontstage/${encodeURIComponent(token)}/files/${encodeURIComponent(assetId)}/versions/${number}/package`;
}

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

/** What the backend asks of one tenant's udoc-server. */
export interface TenantDocuments {
    /** Import `bytes`, an upload: the id udoc-server keeps it as, and the format it was read as. */
    importDocument(bytes: Uint8Array): Promise<{ id: string; format: string }>;
    /** Forget document `id`; one udoc-server doesn't keep is forgotten already. */
    deleteDocument(id: string): Promise<void>;
    /**
     * Keep a copy of checkpoint `checkpoint` of document `id`, read as `format`, as
     * a new document of its own, with no history: the id udoc-server keeps it as, and
     * how many bytes it is.
     */
    copyCheckpoint(id: string, checkpoint: number, format: string): Promise<{ id: string; size: number }>;
    /** Save document `id` as it is now as a new checkpoint: the checkpoint's number. */
    checkpoint(id: string): Promise<number>;
    /**
     * Document `id`'s first page as a PNG, `scale` pixels to a point; `null`
     * for one udoc-server turns down, as a workbook's, all of its first sheet
     * (GAPS.md).
     */
    renderFirstPage(id: string, scale: number): Promise<Uint8Array | null>;
}

export interface Udoc {
    /** Answer `request`, past the gate, if it's for udoc-server, and return true; false if it isn't. */
    handleRequest(request: IncomingMessage, response: ServerResponse): boolean;
    /** Answer a WebSocket upgrade, past the gate, if it's for udoc-server, and return true; false if it isn't. */
    handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): boolean;
    /** What the backend asks of tenant `tenantId`'s udoc-server. */
    documentsOf(tenantId: string): TenantDocuments;
    close(): Promise<void>;
}

/** What the gate makes of a request: the tenant it's let through for, or why it's turned away. */
type Passage = { tenantId: string } | { status: number; failure: Failure };

/**
 * A udoc-server for each tenant over its documents, opening them with one
 * `UDocNode` under `UDOC_LICENSE` and `UDOC_DOMAIN` when they're set, as
 * udoc-server's own command does; without them, usage is free and metered.
 */
export async function createUdoc(db: DatabaseSync): Promise<Udoc> {
    const license = process.env.UDOC_LICENSE;
    const domain = process.env.UDOC_DOMAIN;
    const udoc = await UDocNode.create({ ...(license ? { license } : {}), ...(domain ? { domain } : {}) });
    const token = randomBytes(32).toString("base64url");
    const origin = `http://127.0.0.1:${config.port}`;
    const tenants = new Map<string, { server: UDocServer; store: DirectoryDocumentStore }>();

    /** Tenant `tenantId`'s server and store, made the first time they're needed. */
    function tenantUdoc(tenantId: string): { server: UDocServer; store: DirectoryDocumentStore } {
        let kept = tenants.get(tenantId);
        if (!kept) {
            const store = new DirectoryDocumentStore(join(config.dataDir, "udoc", tenantId));
            kept = { store, server: createUDocServer({ udoc, store, basePath: BASE }) };
            tenants.set(tenantId, kept);
        }
        return kept;
    }

    /** The tenant `request` names, if it carries this process's token: the backend's own. */
    function backendTenant(request: IncomingMessage): string | undefined {
        const sent = Buffer.from(String(request.headers[TOKEN_HEADER] ?? ""));
        const expected = Buffer.from(token);
        if (sent.length !== expected.length || !timingSafeEqual(sent, expected)) return undefined;
        const tenantId = request.headers[TENANT_HEADER];
        return typeof tenantId === "string" ? tenantId : undefined;
    }

    /** Whether document `id` is one the tenant has an asset for. */
    function keptFor(tenant: TenantDb, id: string | undefined): boolean {
        if (id === undefined) return false;
        const row = tenant.prepare("SELECT 1 FROM assets WHERE tenant_id = :tenant AND document_id = ?").get(id);
        return row !== undefined;
    }

    /** Whether checkpoint `checkpoint` of document `id` is its file's published version. */
    function published(tenant: TenantDb, id: string, checkpoint: number): boolean {
        const row = tenant
            .prepare(
                `SELECT 1 FROM assets JOIN versions ON versions.tenant_id = assets.tenant_id
                    AND versions.asset_id = assets.id AND versions.number = assets.published_version
                WHERE assets.tenant_id = :tenant AND assets.document_id = ? AND versions.checkpoint = ?`,
            )
            .get(id, checkpoint);
        return row !== undefined;
    }

    /** The deal room whose file document `id` is; `undefined` for one in the library. */
    function roomOfDocument(tenant: TenantDb, id: string): { assetId: string; roomId: string } | undefined {
        const row = tenant
            .prepare(
                `SELECT assets.id, room_file.room_id FROM assets
                JOIN deal_room_files AS room_file ON room_file.tenant_id = assets.tenant_id
                    AND room_file.asset_id = assets.id
                WHERE assets.tenant_id = :tenant AND assets.document_id = ?`,
            )
            .get(id) as { id: string; room_id: string } | undefined;
        return row && { assetId: row.id, roomId: row.room_id };
    }

    /** Whether checkpoint `checkpoint` of file `assetId` is a version sent to `userId` to review. */
    function checkpointSentToReview(tenant: TenantDb, assetId: string, checkpoint: number, userId: string): boolean {
        const row = tenant
            .prepare(
                "SELECT 1 FROM versions WHERE tenant_id = :tenant AND asset_id = ? AND checkpoint = ? AND reviewer_id = ?",
            )
            .get(assetId, checkpoint, userId);
        return row !== undefined;
    }

    /**
     * What `request` asks of udoc-server, if it reads a file on a frontstage at the
     * version the frontstage shows: whose it is, and its address there. Nothing else
     * gets a buyer in.
     */
    function frontstageTarget(request: IncomingMessage): { tenantId: string; url: string } | undefined {
        if (request.method !== "GET" && request.method !== "HEAD") return undefined;
        const { pathname, search } = new URL(request.url ?? "/", "http://localhost");
        const match = FRONTSTAGE_PATH.exec(pathname);
        if (!match) return undefined;
        const [, stageToken, assetId, number, rest = ""] = match;
        const tenantId = tenantOfFrontstage(db, stageToken);
        if (tenantId === undefined) return undefined;
        const row = new TenantDb(db, tenantId)
            .prepare(
                `SELECT assets.document_id, versions.checkpoint FROM frontstages AS stage
                JOIN frontstage_files AS file ON file.tenant_id = stage.tenant_id AND file.room_id = stage.room_id
                JOIN assets ON assets.tenant_id = file.tenant_id AND assets.id = file.asset_id
                JOIN versions ON versions.tenant_id = assets.tenant_id AND versions.asset_id = assets.id
                    AND versions.number = assets.published_version
                WHERE stage.tenant_id = :tenant AND stage.token = ? AND file.asset_id = ? AND versions.number = ?`,
            )
            .get(stageToken, assetId, Number(number)) as { document_id: string; checkpoint: number } | undefined;
        if (!row) return undefined;
        const document = encodeURIComponent(row.document_id);
        return { tenantId, url: `${BASE}/documents/${document}/checkpoints/${row.checkpoint}/package${rest}${search}` };
    }

    /** Whether the gate lets `request` through, and for which tenant. */
    function passage(request: IncomingMessage): Passage {
        const own = backendTenant(request);
        if (own !== undefined) return { tenantId: own };
        const staged = frontstageTarget(request);
        if (staged) {
            request.url = staged.url;
            return { tenantId: staged.tenantId };
        }
        const user = userOf(db, request);
        if (!user) return { status: 401, failure: { error: "signedOut", message: "no one is signed in" } };
        const tenantId = user.tenant.id;
        const tenant = new TenantDb(db, tenantId);
        const path = pathOf(request);
        const id = DOCUMENT_PATH.exec(path)?.[1];
        // Another tenant's document is as unknown as one that isn't kept.
        const unknown: Passage = { status: 404, failure: { error: "notFound", message: "no such document" } };
        if (!keptFor(tenant, id)) return unknown;
        // Reading alone: the backend imports, checkpoints and deletes.
        if (request.method !== "GET" && request.method !== "HEAD")
            return { status: 403, failure: { error: "forbidden", message: "a document is read here, not changed" } };
        const checkpoint = CHECKPOINT_PATH.exec(path)?.[1];
        const room = roomOfDocument(tenant, id!);
        if (room) {
            // Those on a deal room read all of its file; a reviewer, the versions sent to them.
            if (entersDealRoom(tenant, user, room.roomId)) return { tenantId };
            return checkpoint !== undefined && checkpointSentToReview(tenant, room.assetId, Number(checkpoint), user.id)
                ? { tenantId }
                : unknown;
        }
        if (readsLibrary(user.role)) return { tenantId };
        // Anyone else reads the version published, and nothing of the document around it.
        return checkpoint !== undefined && published(tenant, id!, Number(checkpoint)) ? { tenantId } : unknown;
    }

    /** The tenant of the document `request`, a WebSocket upgrade, joins the collaboration of, if the user changes it. */
    function editorsTenant(request: IncomingMessage): string | undefined {
        const user = userOf(db, request);
        if (!user) return undefined;
        const tenant = new TenantDb(db, user.tenant.id);
        const id = DOCUMENT_PATH.exec(pathOf(request))?.[1];
        if (!keptFor(tenant, id)) return undefined;
        const room = roomOfDocument(tenant, id!);
        const edits = room ? entersDealRoom(tenant, user, room.roomId) : managesLibrary(user.role);
        return edits ? user.tenant.id : undefined;
    }

    /** Ask tenant `tenantId`'s udoc-server for `path`, as the backend: its answer, or a `UdocFailure`. */
    async function ask(tenantId: string, method: string, path: string, body?: Uint8Array): Promise<Response> {
        const response = await fetch(`${origin}${BASE}${path}`, {
            method,
            headers: { [TOKEN_HEADER]: token, [TENANT_HEADER]: tenantId },
            body,
        });
        if (response.ok) return response;
        const failure = (await response.json().catch(() => undefined)) as Failure | undefined;
        throw new UdocFailure(response.status, failure ?? { error: "internal", message: response.statusText });
    }

    return {
        handleRequest(request, response) {
            if (!isUdocPath(pathOf(request))) return false;
            const passed = passage(request);
            if ("status" in passed) {
                response
                    .writeHead(passed.status, { "content-type": "application/json" })
                    .end(JSON.stringify(passed.failure));
            } else if (!tenantUdoc(passed.tenantId).server.handleRequest(request, response)) {
                response
                    .writeHead(404, { "content-type": "application/json" })
                    .end(JSON.stringify({ error: "notFound", message: "no such resource" }));
            }
            return true;
        },

        // Collaboration, udoc-server's one upgrade, is how a document is edited:
        // a library's by those who change it, a deal room's by those who enter it.
        handleUpgrade(request, socket, head) {
            if (!isUdocPath(pathOf(request))) return false;
            const tenantId = editorsTenant(request);
            if (tenantId === undefined) socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
            else if (!tenantUdoc(tenantId).server.handleUpgrade(request, socket, head))
                socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
            return true;
        },

        documentsOf(tenantId) {
            return {
                // udoc-server imports only over HTTP, so the backend asks it as a
                // client would, over loopback (GAPS.md).
                async importDocument(bytes) {
                    const answer = await ask(tenantId, "POST", "/documents", bytes);
                    const { id } = (await answer.json()) as { id: string };
                    const description = await tenantUdoc(tenantId).store.getDescription(id);
                    return { id, format: description?.sourceFormat ?? "unknown" };
                },

                // udoc-server has no route that copies a document, and a udoc package
                // isn't a document to import, so a copy is the checkpoint saved in its
                // own format, and imported (GAPS.md). A format it can't save is one no
                // edit changes, so what was uploaded is that checkpoint.
                async copyCheckpoint(id, checkpoint, format) {
                    const document = encodeURIComponent(id);
                    const saved = await ask(
                        tenantId,
                        "GET",
                        `/documents/${document}/checkpoints/${checkpoint}/file.${encodeURIComponent(format)}`,
                    ).catch((error: unknown) => {
                        if (error instanceof UdocFailure && error.status === 404)
                            return ask(tenantId, "GET", `/documents/${document}/original`);
                        throw error;
                    });
                    const bytes = new Uint8Array(await saved.arrayBuffer());
                    const answer = await ask(tenantId, "POST", "/documents", bytes);
                    const { id: copy } = (await answer.json()) as { id: string };
                    return { id: copy, size: bytes.length };
                },

                async deleteDocument(id) {
                    try {
                        await ask(tenantId, "DELETE", `/documents/${encodeURIComponent(id)}`);
                    } catch (error) {
                        if (!(error instanceof UdocFailure && error.status === 404)) throw error;
                    }
                },

                async checkpoint(id) {
                    const response = await ask(tenantId, "POST", `/documents/${encodeURIComponent(id)}/checkpoints`);
                    return ((await response.json()) as { version: number }).version;
                },

                async renderFirstPage(id, scale) {
                    try {
                        const page = await ask(
                            tenantId,
                            "GET",
                            `/documents/${encodeURIComponent(id)}/layout/pages/0.png?scale=${scale}`,
                        );
                        return new Uint8Array(await page.arrayBuffer());
                    } catch (error) {
                        // A page it won't render is the request's fault; its own failing isn't.
                        if (error instanceof UdocFailure && error.status < 500) return null;
                        throw error;
                    }
                },
            };
        },

        async close() {
            await Promise.all([...tenants.values()].map(({ server }) => server.close()));
        },
    };
}

function pathOf(request: IncomingMessage): string {
    return new URL(request.url ?? "/", "http://localhost").pathname;
}

function isUdocPath(path: string): boolean {
    return path === BASE || path.startsWith(`${BASE}/`);
}
