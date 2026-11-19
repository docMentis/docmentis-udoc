// udoc-server, which keeps the documents, behind the gate
// (docs/design/examples-shockwave.md). Each tenant has its own: its own store, at
// `data/udoc/:tenantId`, and its own sessions, so one tenant's document isn't there
// to be found by another's request, whatever the gate lets through, and one tenant's
// load doesn't close another's sessions. Their routes sit under `/udoc` on the
// backend's own HTTP server, and a request goes to the server of the tenant it's for.
//
// udoc-server has no end-user authentication, so a request reaches it only past the
// gate, which guards its URL as a whole, by document, not route by route: the
// backend's own, with this process's token, for the tenant it names; a signed-in
// user's, reading a document their tenant has an asset for, all of it if they read
// the library and only its published version if not; one who changes the library,
// editing its working copy, `main` — joining the collaboration that edits it, or
// asking udoc-server to change it, fill it or make a copy of it; those who enter a
// deal room, doing either with its files, and a reviewer, reading the versions sent
// to them and the branches they're reviewed in, and editing a branch while its
// version waits on them, which those who edit the file do once they've decided;
// one who made a document through the gate, a template's
// filled copy, doing what they like with it; and a buyer's, with no account,
// reading a file a frontstage's link shows, at the version it shows. Deleting a
// document an asset holds, or a branch of it, is the backend's alone.
import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { Duplex } from "node:stream";

import { UDocNode } from "@docmentis/udoc-node";
import type { Automation, BindingData, BindingReport, PresentationBindingEntry } from "@docmentis/udoc-node";
import { DirectoryDocumentStore, MAIN_BRANCH, createUDocServer } from "@docmentis/udoc-server";
import type { KeptDocument, UDocServer } from "@docmentis/udoc-server";

import { managesLibrary, readsLibrary } from "../shared/api.ts";
import type { Failure, User } from "../shared/api.ts";
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

/** A document itself, `/udoc/documents/:id`, nothing under it. */
const DOCUMENT_ONLY_PATH = new RegExp(`^${BASE}/documents/[^/]+/?$`);

/** One checkpoint's routes: `/udoc/documents/:id/checkpoints/:version`, and those under it. */
const CHECKPOINT_PATH = new RegExp(`^${BASE}/documents/[^/]+/checkpoints/(\\d+)(?:/|$)`);

/** One branch's routes: `/udoc/documents/:id/branches/:branch`, and those under it. */
const BRANCH_PATH = new RegExp(`^${BASE}/documents/[^/]+/branches/([^/]+)(?:/|$)`);

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
    /**
     * Save document `id`'s working copy as it is now as a new checkpoint, or with
     * `branch`, that branch as it is now: the checkpoint's number.
     */
    checkpoint(id: string, branch?: string): Promise<number>;
    /** Start a branch of document `id` at checkpoint `checkpoint`: the branch's id. */
    startBranch(id: string, checkpoint: number): Promise<string>;
    /**
     * Merge branch `branch` of document `id` into its working copy: each edit made
     * in it the copy lacks reaches the copy's editors and its log. Merged again, it
     * brings what's been made since.
     */
    mergeBranch(id: string, branch: string): Promise<void>;
    /**
     * Document `id`'s pages as PNGs, in order, `scale` pixels to a point, up to
     * the first udoc-server turns down: none for a workbook, whose first page is
     * all of its first sheet (GAPS.md). Its working copy's, or with `branch`, that
     * branch's.
     */
    renderPages(id: string, scale: number, branch?: string): Promise<Uint8Array[]>;
    /**
     * Fill a copy of document `id`, a template — at checkpoint `checkpoint`, or as
     * it is now — with `data`, filled by udoc-server and kept as a new document of
     * its own, its first checkpoint the filled deck: the id it keeps it as.
     */
    instanceOf(id: string, data: BindingData, checkpoint?: number): Promise<{ id: string; size: number }>;
    /**
     * Document `id`'s automation at checkpoint `checkpoint`, as udoc-server reads
     * it: whether it's a template, and what it binds. Read once a checkpoint,
     * which never changes after.
     */
    automationAt(id: string, checkpoint: number): Promise<KeptAutomation>;
}

/** What udoc-server reads of a document's automation. */
export interface KeptAutomation {
    /** Its automation part: none for a plain document. */
    automation: Automation | null;
    /** What a deck's slides bind: none for any other document. */
    bindings: BindingReport<PresentationBindingEntry> | null;
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

/** What the gate makes of a request: the tenant it's let through for, and the user, if it's one's; or why it's turned away. */
type Passage = { tenantId: string; user?: Maker } | { status: number; failure: Failure };

/** Who made a document through the gate: a user at a tenant. */
interface Maker {
    tenantId: string;
    userId: string;
}

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
    // The user a request udoc-server is answering is for, which a document it
    // keeps while answering was made by.
    const asking = new AsyncLocalStorage<Maker>();
    // Each document made through the gate, by its id, and who made it: kept no
    // longer than this process, which the documents outlive (GAPS.md).
    const made = new Map<string, Maker>();

    /** A tenant's store, which notes who made each document it keeps. */
    class TenantStore extends DirectoryDocumentStore {
        override async put(id: string, document: KeptDocument): Promise<void> {
            await super.put(id, document);
            const maker = asking.getStore();
            if (maker) made.set(id, maker);
        }
    }
    // What each checkpoint's automation reads, by tenant, document and checkpoint.
    const automations = new Map<string, Promise<KeptAutomation>>();

    /** Tenant `tenantId`'s server and store, made the first time they're needed. */
    function tenantUdoc(tenantId: string): { server: UDocServer; store: DirectoryDocumentStore } {
        let kept = tenants.get(tenantId);
        if (!kept) {
            const store = new TenantStore(join(config.dataDir, "udoc", tenantId));
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
     * Whether branch `branch` of document `id` is the one a version sent to `userId`
     * is reviewed in; `waiting`, while it's still waiting on them, submitted.
     */
    function branchSentToReview(
        tenant: TenantDb,
        id: string,
        branch: string,
        userId: string,
        waiting: boolean,
    ): boolean {
        const row = tenant
            .prepare(
                `SELECT 1 FROM versions JOIN assets ON assets.tenant_id = versions.tenant_id
                    AND assets.id = versions.asset_id
                WHERE versions.tenant_id = :tenant AND assets.document_id = ? AND versions.review_branch = ?
                    AND versions.reviewer_id = ? AND (? = 0 OR versions.status = 'submitted')`,
            )
            .get(id, branch, userId, waiting ? 1 : 0);
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
        const asUser: Passage = { tenantId, user: { tenantId, userId: user.id } };
        // A document made through the gate, its maker's alone.
        const maker = id === undefined ? undefined : made.get(id);
        if (maker?.tenantId === tenantId && maker.userId === user.id) {
            if (request.method === "DELETE" && DOCUMENT_ONLY_PATH.test(path)) made.delete(id!);
            return asUser;
        }
        if (!keptFor(tenant, id)) return unknown;
        const checkpoint = CHECKPOINT_PATH.exec(path)?.[1];
        const branch = BRANCH_PATH.exec(path)?.[1];
        if (request.method !== "GET" && request.method !== "HEAD") {
            // An asset's document goes with the asset, and a review's branch with the review.
            if (request.method === "DELETE")
                return { status: 403, failure: { error: "forbidden", message: "the backend deletes this" } };
            if (edits(tenant, user, id!, branch ?? MAIN_BRANCH)) return asUser;
            return { status: 403, failure: { error: "forbidden", message: "a document is read here, not changed" } };
        }
        const room = roomOfDocument(tenant, id!);
        if (room) {
            // Those on a deal room read all of its file; a reviewer, the versions sent
            // to them, and the branches they're reviewed in.
            if (entersDealRoom(tenant, user, room.roomId)) return { tenantId };
            const sent =
                (checkpoint !== undefined &&
                    checkpointSentToReview(tenant, room.assetId, Number(checkpoint), user.id)) ||
                (branch !== undefined && branchSentToReview(tenant, id!, branch, user.id, false));
            return sent ? { tenantId } : unknown;
        }
        if (readsLibrary(user.role)) return { tenantId };
        // Anyone else reads the version published, and nothing of the document around it.
        return checkpoint !== undefined && published(tenant, id!, Number(checkpoint)) ? { tenantId } : unknown;
    }

    /** Whether branch `branch` of document `id` is the one a version was reviewed in, and its reviewer has decided it. */
    function reviewDecided(tenant: TenantDb, id: string, branch: string): boolean {
        const row = tenant
            .prepare(
                `SELECT 1 FROM versions JOIN assets ON assets.tenant_id = versions.tenant_id
                    AND assets.id = versions.asset_id
                WHERE versions.tenant_id = :tenant AND assets.document_id = ? AND versions.review_branch = ?
                    AND versions.status IN ('approved', 'returned')`,
            )
            .get(id, branch);
        return row !== undefined;
    }

    /**
     * Whether `user` edits document `id`'s branch `branch`: its working copy,
     * `main`, if they change it; a review branch, if they're the reviewer it waits
     * on, and once they've decided, if they change the working copy. No one else
     * writes in a review.
     */
    function edits(tenant: TenantDb, user: User, id: string, branch: string): boolean {
        const room = roomOfDocument(tenant, id);
        const changes = room ? entersDealRoom(tenant, user, room.roomId) : managesLibrary(user.role);
        if (branch === MAIN_BRANCH) return changes;
        return branchSentToReview(tenant, id, branch, user.id, true) || (changes && reviewDecided(tenant, id, branch));
    }

    /** The tenant of the document `request`, a WebSocket upgrade, joins a collaboration of, if the user {@link edits} it. */
    function editorsTenant(request: IncomingMessage): string | undefined {
        const user = userOf(db, request);
        if (!user) return undefined;
        const tenant = new TenantDb(db, user.tenant.id);
        const path = pathOf(request);
        const id = DOCUMENT_PATH.exec(path)?.[1];
        if (!keptFor(tenant, id)) return undefined;
        const branch = BRANCH_PATH.exec(path)?.[1] ?? MAIN_BRANCH;
        return edits(tenant, user, id!, branch) ? user.tenant.id : undefined;
    }

    /** Have udoc-server answer `request`, let through as `passed`, a document it makes the user's: false for no such route. */
    function answer(passed: { tenantId: string; user?: Maker }, request: IncomingMessage, response: ServerResponse) {
        const { server } = tenantUdoc(passed.tenantId);
        if (!passed.user) return server.handleRequest(request, response);
        return asking.run(passed.user, () => server.handleRequest(request, response));
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
            } else if (!answer(passed, request, response)) {
                response
                    .writeHead(404, { "content-type": "application/json" })
                    .end(JSON.stringify({ error: "notFound", message: "no such resource" }));
            }
            return true;
        },

        // Collaboration, udoc-server's one upgrade, is how a document is edited live:
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
                    const description = await tenantUdoc(tenantId).store.getDescription(id, { branch: MAIN_BRANCH });
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

                async checkpoint(id, branch) {
                    const document = `/documents/${encodeURIComponent(id)}`;
                    const path = branch
                        ? `${document}/branches/${encodeURIComponent(branch)}/versions`
                        : `${document}/checkpoints`;
                    const response = await ask(tenantId, "POST", path);
                    return ((await response.json()) as { version: number }).version;
                },

                async startBranch(id, checkpoint) {
                    const path = `/documents/${encodeURIComponent(id)}/versions/${checkpoint}/branches`;
                    const response = await ask(tenantId, "POST", path);
                    return ((await response.json()) as { branch: string }).branch;
                },

                async mergeBranch(id, branch) {
                    const from = encodeURIComponent(branch);
                    await ask(
                        tenantId,
                        "POST",
                        `/documents/${encodeURIComponent(id)}/branches/${MAIN_BRANCH}/merge?from=${from}`,
                    );
                },

                // udoc-server fills a template beside the documents it keeps, so the
                // browser never loads all of one to fill it.
                async instanceOf(id, data, checkpoint) {
                    const at = checkpoint === undefined ? "" : `/checkpoints/${checkpoint}`;
                    const path = `/documents/${encodeURIComponent(id)}${at}/instances`;
                    const answer = await ask(tenantId, "POST", path, json({ data }));
                    const { id: copy } = (await answer.json()) as { id: string };
                    const original = await tenantUdoc(tenantId).store.getOriginal(copy);
                    return { id: copy, size: original?.bytes.length ?? 0 };
                },

                automationAt(id, checkpoint) {
                    const key = `${tenantId}/${id}/${checkpoint}`;
                    let read = automations.get(key);
                    if (!read) {
                        const path = `/documents/${encodeURIComponent(id)}/checkpoints/${checkpoint}/automation`;
                        read = ask(tenantId, "GET", path).then((answer) => answer.json() as Promise<KeptAutomation>);
                        // A failure is read again next time.
                        read.catch(() => automations.delete(key));
                        automations.set(key, read);
                    }
                    return read;
                },

                async renderPages(id, scale, branch) {
                    const document = `/documents/${encodeURIComponent(id)}${branch ? `/branches/${encodeURIComponent(branch)}` : ""}`;
                    const counted = await ask(tenantId, "GET", `${document}/layout/page-count`);
                    const { pageCount } = (await counted.json()) as { pageCount: number };
                    const pages: Uint8Array[] = [];
                    for (let index = 0; index < pageCount; index++) {
                        try {
                            const page = await ask(
                                tenantId,
                                "GET",
                                `${document}/layout/pages/${index}.png?scale=${scale}`,
                            );
                            pages.push(new Uint8Array(await page.arrayBuffer()));
                        } catch (error) {
                            // A page it won't render is the request's fault; its own failing isn't.
                            if (error instanceof UdocFailure && error.status < 500) break;
                            throw error;
                        }
                    }
                    return pages;
                },
            };
        },

        async close() {
            await Promise.all([...tenants.values()].map(({ server }) => server.close()));
        },
    };
}

/** `value` as the bytes of a JSON body. */
function json(value: unknown): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(value));
}

function pathOf(request: IncomingMessage): string {
    return new URL(request.url ?? "/", "http://localhost").pathname;
}

function isUdocPath(path: string): boolean {
    return path === BASE || path.startsWith(`${BASE}/`);
}
