// The document routes: a document imported once and kept, then served from
// what is kept — its original and its package read from the store, its pages
// and its copies from a session over it — edited together, checkpointed,
// branched and merged back, and forgotten.

import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

import { UDocError, isFileFormat } from "@docmentis/udoc-node";
import type { FileFormat, PageExportFormat, SaveStrategy, UDocNode, UDocSession } from "@docmentis/udoc-node";

import type { Collaborations } from "./collaboration.ts";
import { HttpFailure, bytes, failureOf, json, noContent, notFound } from "./http.ts";
import type { Reply, Upgrade } from "./http.ts";
import { readPackage } from "./package.ts";
import { route } from "./route.ts";
import type { Params, Route, RouteRequest } from "./route.ts";
import type { SessionPool } from "./session-pool.ts";
import type { DocumentStore, KeptDocument } from "./store.ts";

export interface DocumentRoutesOptions {
    /** Opens each upload. */
    udoc: Pick<UDocNode, "open">;
    /** Where each document is kept. */
    store: DocumentStore;
    /** The sessions open over what is kept. */
    sessions: SessionPool;
    /** The clients editing each document together. */
    collaborations: Collaborations;
    /** The largest document accepted, in bytes. */
    maxUploadBytes: number;
    /**
     * Opens a session of its own over what is kept of a document, apart from its
     * pooled one: as it is now, or checkpoint `version` as it was.
     */
    openKept: (id: string, version?: number) => Promise<UDocSession>;
}

/** The ids this server mints — `randomUUID`'s. Nothing else names a document. */
const DOCUMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The header an upload's password is sent in. */
const PASSWORD_HEADER = "X-UDoc-Password";

/** The strategies a copy saves by (docs/design/core-save.md). */
const SAVE_STRATEGIES: readonly SaveStrategy[] = ["rewrite", "delta", "incremental"];

/**
 * The document routes. A failure answers `{ error, message }`, where `error`
 * is a code: a license refusal's own type (`invalidLicense`, `permitRefused`,
 * `cannotVerify`), `unreadableDocument`, `passwordRequired`,
 * `incorrectPassword`, `cannotImportPackage`, `pageNotFound`, `cannotSave`,
 * `upgradeRequired`, `notFound`, `badRequest`, `methodNotAllowed`,
 * `payloadTooLarge`, `notABranch`, `serverClosing` or `internal`.
 */
export function documentRoutes({
    udoc,
    store,
    sessions,
    collaborations,
    maxUploadBytes,
    openKept,
}: DocumentRoutesOptions): Route[] {
    /** The checkpoint each document is writing now, which its next one waits for, to take the version after. */
    const checkpointing = new Map<string, Promise<number>>();
    /** The merge of each branch under way, which another merge of it waits for. */
    const merging = new Map<string, Promise<void>>();

    return [
        route("POST", "/documents", importDocument),
        route("DELETE", "/documents/:id", deleteDocument),
        route("GET", "/documents/:id/original", original),
        route("GET", "/documents/:id/layout/page-count", pageCount),
        route("GET", "/documents/:id/layout/pages.pdf", pages),
        route("GET", "/documents/:id/layout/pages/:index.:format", page, {
            params: { index: /\d+/, format: /png|svg/ },
        }),
        route("GET", "/documents/:id/file.:format", file, { params: { format: /\w+/ } }),
        route("POST", "/documents/:id/checkpoints", checkpoint),
        route("GET", "/documents/:id/checkpoints", checkpointVersions),
        route("GET", "/documents/:id/checkpoints/:version/package", checkpointResource, { params: { version: /\d+/ } }),
        route("GET", "/documents/:id/checkpoints/:version/package/*route", checkpointResource, {
            params: { version: /\d+/ },
        }),
        route("GET", "/documents/:id/checkpoints/:version/file.:format", checkpointFile, {
            params: { version: /\d+/, format: /\w+/ },
        }),
        route("POST", "/documents/:id/checkpoints/:version/branch", branch, { params: { version: /\d+/ } }),
        route("POST", "/documents/:id/merge", merge),
        route("GET", "/documents/:id/package", packageResource),
        route("GET", "/documents/:id/package/*route", packageResource),
        route("GET", "/documents/:id/collaboration", upgradeRequired, { upgrade: collaboration }),
    ];

    /**
     * The body is a document's bytes: import it and keep it; `201 { id }`.
     * `?format=` (`pdf`, `pptx`, …) is for bytes detection gets wrong; absent,
     * the format is detected. `?delimiter=` is the character a CSV's fields
     * are split by; absent, the comma, semicolon, tab or vertical bar that
     * splits the first records alike, else the one that splits the first into
     * the most fields. A udoc package is refused: it is a document
     * already imported, not one to import. A PDF encrypted with a user password
     * opens with the one sent in `X-UDoc-Password`, percent-encoded
     * (`encodeURIComponent`), its user or its owner password. It is asked for
     * here alone: the package the document is kept as reopens without it, and
     * the password itself is not kept.
     */
    async function importDocument({ query, incoming }: RouteRequest): Promise<Reply> {
        const format = openFormatOf(query.get("format"));
        const delimiter = query.get("delimiter") ?? undefined;
        const password = passwordOf(incoming);
        const uploaded = await readBody(incoming, maxUploadBytes);
        const session = await openUpload(uploaded, format, delimiter, password);
        const created = randomUUID();
        try {
            await store.put(created, await keptDocumentOf(session, uploaded));
        } finally {
            // Opened from the upload's bytes, it could load no opaque part an
            // edit adds to the document, so a session over what is kept is
            // opened when a request needs one (docs/design/core-editor-opaque-part.md).
            await session.close();
        }
        return json(201, { id: created });
    }

    /** Close the document and forget it; `204`. */
    async function deleteDocument({ params }: RouteRequest): Promise<Reply> {
        const id = documentId(params);
        // Forgotten before its session closes, so no request in between
        // can reopen what is being deleted.
        const kept = await store.delete(id);
        collaborations.end(id);
        await sessions.close(id);
        if (!kept) throw noDocument(id);
        return noContent();
    }

    /** The upload, byte for byte. Read from the store; no session is opened. */
    async function original({ params }: RouteRequest): Promise<Reply> {
        const id = documentId(params);
        const original = await store.getOriginal(id);
        if (!original) throw noDocument(id);
        return bytes(original.bytes, "application/octet-stream");
    }

    /**
     * `{ pageCount }`. Its own resource because it can be costly: the first ask
     * composes the whole document, since a page is known only once composed.
     */
    async function pageCount({ params }: RouteRequest): Promise<Reply> {
        const pageCount = await sessions.use(documentId(params), (session) => session.pageCount());
        return json(200, { pageCount });
    }

    /**
     * Composed page `index`, counting from 0, as a PNG or an SVG, as its
     * extension names. A PNG's `?scale=` is output pixels per point, `1` if
     * absent; an SVG, sized in points, takes none.
     */
    async function page({ params, query }: RouteRequest): Promise<Reply> {
        const id = documentId(params);
        const index = Number(params.index);
        const svg = params.format === "svg";
        if (svg && query.has("scale")) throw new HttpFailure(400, "invalidRequest", "scale is for a PNG");
        const format: PageExportFormat = svg ? "svg" : { png: { scale: scaleOf(query.get("scale")) } };
        const exported = await sessions.use(id, (session) =>
            session.exportPageToBytes(index, format).catch((error: unknown) => {
                // The path only matches digits and the scale is checked above,
                // so `notFound` here means there is no such page — whose
                // address is ours to word.
                throw error instanceof UDocError && error.code === "notFound"
                    ? new UDocError("notFound", `page index ${index} is out of range: ${error.message}`)
                    : error;
            }),
        );
        return bytes(exported, svg ? "image/svg+xml" : "image/png");
    }

    /**
     * The document exported as a PDF of its laid-out pages: a rendering, fixed
     * and one-way, apart from the copy `file.pdf` saves of a PDF. A spreadsheet,
     * whose sheets have no print pages yet, `422 unsupported`.
     */
    async function pages({ params }: RouteRequest): Promise<Reply> {
        const pdf = await sessions.use(documentId(params), (session) => session.exportToBytes("pdf"));
        return bytes(pdf, "application/pdf");
    }

    /**
     * A copy of the document, saved faithfully in its session: as `format`,
     * one of its doc type's own (`pdf`, `pptx`, …), by `?strategy=` —
     * `rewrite`, `delta` or `incremental` (docs/design/core-save.md), if
     * absent the engine's for `format` — or as a udoc package for `udoc`,
     * which takes no strategy. A CSV's
     * fields are split by `?delimiter=`, or the one it was imported with, else
     * a comma. Nothing of it is kept.
     */
    async function file({ params, query }: RouteRequest): Promise<Reply> {
        const save = copyAsked(params, query);
        return bytes(await sessions.use(documentId(params), save), "application/octet-stream");
    }

    /**
     * A copy of one checkpoint, as {@link file} saves one of the document: saved
     * in a session of its own, closed after, since the pool's is the document's,
     * current one. It spends a permit like any open.
     */
    async function checkpointFile({ params, query }: RouteRequest): Promise<Reply> {
        const save = copyAsked(params, query);
        const session = await openKept(documentId(params), Number(params.version));
        try {
            return bytes(await save(session), "application/octet-stream");
        } finally {
            await session.close();
        }
    }

    /**
     * Branch the document at checkpoint `version`: keep it as it stood there as a
     * new document, `201 { id }`, edited apart from it and served, checkpointed
     * and deleted as any other, until it is merged back ({@link merge}). Nothing
     * is saved or opened, and no permit spent: the branch shares what is kept of
     * the document up to that checkpoint, edit ids included, so each edit made
     * in it since can be merged back.
     */
    async function branch({ params }: RouteRequest): Promise<Reply> {
        const id = documentId(params);
        const version = Number(params.version);
        const versions = await store.getCheckpointVersions(id);
        if (versions.length === 0) throw noDocument(id);
        if (!versions.includes(version)) throw notFound(`document ${id} has no v${version}`);
        const branched = randomUUID();
        await store.branch(id, version, branched);
        return json(201, { id: branched });
    }

    /**
     * Merge the branch back into the document it was taken from, `204`: every
     * edit made in it since its checkpoint, and merged into it by now, reaches
     * the document as an editor's edits do — its editors and its log — each
     * where its ids place it, beside the document's own edits since — through
     * any cuts of either's log since the branch point. It opens a session of
     * its own over the branch, spending a permit. The branch is then a document
     * like any other: an edit made in it later stays in it.
     * A document that isn't a branch, or a branch merged already, `409
     * notABranch`; one taken from a document no longer kept, `404`.
     */
    async function merge({ params }: RouteRequest): Promise<Reply> {
        const id = documentId(params);
        // One at a time: a merge waiting on another finds the branch merged.
        const next = (merging.get(id) ?? Promise.resolve()).catch(() => {}).then(() => mergeBranch(id));
        merging.set(id, next);
        const forget = () => {
            if (merging.get(id) === next) merging.delete(id);
        };
        next.then(forget, forget);
        await next;
        return noContent();
    }

    async function mergeBranch(id: string): Promise<void> {
        const point = await store.getBranchPoint(id);
        if (!point) {
            if ((await store.getCheckpointVersions(id)).length === 0) throw noDocument(id);
            throw new HttpFailure(409, "notABranch", `document ${id} is no branch waiting to be merged back`);
        }
        if ((await store.getCheckpointVersions(point.id)).length === 0) {
            throw notFound(`document ${point.id}, which ${id} was branched from, is no longer kept`);
        }
        // The branch's edits merged so far, kept, so a session over what is kept holds them.
        await collaborations.kept(id);
        // The opaque parts its edits brought, kept before the patch naming them
        // is merged, as a client's are: a session over what is kept loads them
        // through the store, so it holds none to send.
        await store.shareOpaqueParts(id, point.id);
        const branched = await openBranched(id, point.version);
        try {
            await collaborations.merge(point.id, async (document) => {
                // A cut of the document's log since the branch point dropped the
                // history the branch's edits depend on, so it refuses them; and
                // past a cut of the branch's, its editors copied pages on that
                // cut, as the document's never did. Either way its edits move
                // onto the document's log as it is now, its pages copied there,
                // as an editor's unsent edits do when it comes back from behind
                // a cut.
                const cuts = (await store.getCuts(point.id)).filter((cut) => cut > point.version);
                if (cuts.length > 0 || branched.cut) {
                    const logs = await Promise.all(cuts.map((cut) => cutLogOf(point.id, cut)));
                    const latest = (await store.getCheckpointVersions(point.id)).at(-1)!;
                    await branched.session.catchUp([...logs, await document.snapshot()], latest);
                }
                return branched.session.patchSince(await document.versionVector());
            });
        } finally {
            await branched.close();
        }
        await store.deleteBranchPoint(id);
    }

    /**
     * A session of its own over branch `id` holding every edit made in it since
     * checkpoint `version`, its branch point, as edits. Opened at its head, it
     * would hold those before a cut of its log only as the state they left; so
     * it opens as the branch stood when it was taken — a branch of it there, which
     * opens as an editor that opened at that checkpoint, kept until the session
     * closes — and catches up through each cut since, whose package holds what
     * that cut dropped, then the branch's log. `cut` says whether there was one.
     */
    async function openBranched(
        id: string,
        version: number,
    ): Promise<{ session: UDocSession; cut: boolean; close(): Promise<void> }> {
        const asTaken = randomUUID();
        await store.branch(id, version, asTaken);
        const forget = async () => void (await store.delete(asTaken));
        let session: UDocSession;
        try {
            session = await openKept(asTaken);
        } catch (error) {
            await forget();
            throw error;
        }
        const close = async () => {
            await session.close();
            await forget();
        };
        try {
            const cuts = (await store.getCuts(id)).filter((cut) => cut > version);
            const log = await store.getLog(id);
            if (cuts.length > 0) {
                const logs = await Promise.all(cuts.map((cut) => cutLogOf(id, cut)));
                await session.catchUp([...logs, log!], cuts.at(-1)!);
            } else if (log) {
                await session.merge(log);
            }
            return { session, cut: cuts.length > 0, close };
        } catch (error) {
            await close();
            throw error;
        }
    }

    /** The log document `id`'s cut at `version` holds. */
    async function cutLogOf(id: string, version: number): Promise<Uint8Array> {
        const log = await store.getCheckpointLog(id, version);
        if (!log) throw new UDocError("internal", `document ${id}'s cut at v${version} holds no log`);
        return log;
    }

    /**
     * Checkpoint the document once the checkpoint it is writing, if any, is
     * done: its session saved as baseline `v<version>`, one past the latest,
     * kept beside the earlier ones, from then on the package's;
     * `201 { version }`.
     */
    async function checkpoint({ params }: RouteRequest): Promise<Reply> {
        const id = documentId(params);
        const next = (checkpointing.get(id) ?? Promise.resolve(0))
            .catch(() => 0)
            .then(() =>
                // Read in the session's use, which no log cut's checkpoint runs
                // beside, since one runs only on a session with none.
                sessions.use(id, async (session) => {
                    const description = await store.getDescription(id);
                    if (!description) throw noDocument(id);
                    const version = description.baselineVersion + 1;
                    await store.putCheckpoint(id, version, await session.saveToPackage({ version }));
                    return version;
                }),
            );
        checkpointing.set(id, next);
        const forget = () => {
            if (checkpointing.get(id) === next) checkpointing.delete(id);
        };
        next.then(forget, forget);
        return json(201, { version: await next });
    }

    /** The versions of the document's checkpoints, oldest first, `{ versions }`. A cut uses up a number, so they have gaps. */
    async function checkpointVersions({ params }: RouteRequest): Promise<Reply> {
        const id = documentId(params);
        const versions = await store.getCheckpointVersions(id);
        if (versions.length === 0) throw noDocument(id);
        return json(200, { versions });
    }

    /**
     * One checkpoint's package: its description, or one resource under it (see
     * `package.ts`). What is kept of a version never changes, so unlike the
     * package it waits for no log being cut.
     */
    function checkpointResource({ params, query }: RouteRequest): Promise<Reply> {
        return readPackage(store, documentId(params), params.route ?? "", query, Number(params.version));
    }

    /**
     * The package: the latest checkpoint, with the edit log and the opaque
     * parts edits brought on top — its description, or one resource under it
     * (see `package.ts`).
     */
    async function packageResource({ params, query }: RouteRequest): Promise<Reply> {
        const id = documentId(params);
        // A log being cut is answered once it is, whole.
        await sessions.retired(id);
        return readPackage(store, id, params.route ?? "", query);
    }

    /** A collaboration is a WebSocket: without the upgrade, `426`. */
    async function upgradeRequired({ params }: RouteRequest): Promise<Reply> {
        documentId(params);
        throw new HttpFailure(426, "upgradeRequired", "a collaboration is a WebSocket; ask for the upgrade");
    }

    /**
     * Edit the document together with every other client connected to it
     * (docs/design/node-collaboration.md). An id this server didn't mint is
     * refused as every refusal of a collaboration is: the upgrade taken, and
     * closed with a code.
     */
    async function collaboration({ params }: RouteRequest, upgrade: Upgrade): Promise<void> {
        const id = params.id!;
        if (!DOCUMENT_ID.test(id)) {
            collaborations.refuse(upgrade, noDocument(id));
            return;
        }
        await collaborations.join(id, upgrade);
    }

    /**
     * Open an upload — the one open that mints the document's ids — a CSV split
     * by `delimiter` if one is given, unlocked with `password` if it needs one.
     */
    async function openUpload(
        uploaded: Uint8Array,
        format: FileFormat | undefined,
        delimiter: string | undefined,
        password: string | undefined,
    ): Promise<UDocSession> {
        const session = await udoc.open(uploaded, {
            ...(format !== undefined && { format }),
            ...(delimiter !== undefined && { delimiter }),
        });
        // A package's ids were minted by whatever imported it, and it has no
        // original to keep: it is a document already imported, not one to import.
        if (session.fromPackage) {
            await session.close();
            throw new HttpFailure(422, "cannotImportPackage", "a udoc package is not a document to import");
        }
        if (session.needsPassword) {
            const refusal = await unlock(session, password);
            if (refusal) {
                await session.close();
                throw refusal;
            }
        }
        return session;
    }
}

/**
 * The document `params` names. Checked before anything reaches the store,
 * where an id becomes a file name: a string this server did not mint names no
 * document.
 */
function documentId({ id }: Params): string {
    if (!DOCUMENT_ID.test(id!)) throw noDocument(id!);
    return id!;
}

export function noDocument(id: string): HttpFailure {
    return new HttpFailure(404, "notFound", `no document ${JSON.stringify(id)}`);
}

/**
 * What is kept of `session`'s document, just imported from `uploaded`: the
 * upload itself, and its first checkpoint, `v0`, a flat baseline.
 */
async function keptDocumentOf(session: UDocSession, uploaded: Uint8Array): Promise<KeptDocument> {
    // Imported from a file, not opened from a package, so the format is known.
    const original = { bytes: uploaded, format: session.sourceFormat! };
    return { original, checkpoint: await session.saveToPackage() };
}

/** Why `session`, an upload that needs a password, doesn't open with `password`; null once it does. */
async function unlock(session: UDocSession, password: string | undefined): Promise<HttpFailure | null> {
    if (password === undefined) {
        return new HttpFailure(422, "passwordRequired", `the document needs a password: send it in ${PASSWORD_HEADER}`);
    }
    try {
        if (await session.authenticate(password)) return null;
        return new HttpFailure(422, "incorrectPassword", "the password sent doesn't open the document");
    } catch (error) {
        return failureOf(error);
    }
}

/** The strategy a copy as `format` saves by: the one `value` names, else none, for the engine's; none for a udoc copy. */
/** What saves the copy a request's route and query ask for, once it has a session; refuses a request that can't be one. */
function copyAsked(params: Params, query: URLSearchParams): (session: UDocSession) => Promise<Uint8Array> {
    const format = params.format!;
    if (format !== "udoc" && !isFileFormat(format)) throw notFound();
    const strategy = strategyOf(format, query.get("strategy"));
    const delimiter = query.get("delimiter") ?? undefined;
    if (format === "udoc" && delimiter !== undefined) {
        throw new HttpFailure(400, "invalidRequest", "a udoc copy is a package, split by no delimiter");
    }
    return async (session) => {
        if (format === "udoc") return session.saveToPackage();
        try {
            return await session.saveToBytes({
                format,
                ...(strategy !== undefined && { strategy }),
                ...(delimiter !== undefined && { delimiter }),
            });
        } catch (error) {
            // Asked for no strategy, the engine takes the one keeping the most of
            // the original, which it can't always write over: a PDF that needs a
            // password. A rewrite keeps nothing of it, and is still a copy.
            if (strategy !== undefined || failureOf(error).code !== "unsupported") throw error;
            return session.saveToBytes({
                format,
                strategy: "rewrite",
                ...(delimiter !== undefined && { delimiter }),
            });
        }
    };
}

function strategyOf(format: string, value: string | null): SaveStrategy | undefined {
    if (value === null) return undefined;
    if (format === "udoc") {
        throw new HttpFailure(400, "invalidRequest", "a udoc copy is a package, saved by no strategy");
    }
    const strategy = SAVE_STRATEGIES.find((known) => known === value);
    if (strategy === undefined) {
        throw new HttpFailure(
            400,
            "invalidRequest",
            `strategy must be one of ${SAVE_STRATEGIES.join(", ")}, got ${JSON.stringify(value)}`,
        );
    }
    return strategy;
}

function openFormatOf(value: string | null): FileFormat | undefined {
    if (value === null) return undefined;
    if (!isFileFormat(value)) {
        throw new HttpFailure(
            400,
            "invalidRequest",
            `format must be a file format's name, got ${JSON.stringify(value)}`,
        );
    }
    return value;
}

/**
 * The password `request` sends for its upload, if any. A header carries only
 * Latin-1, and a PDF password may be any Unicode, so it travels percent-encoded.
 */
function passwordOf(request: IncomingMessage): string | undefined {
    const header = request.headers[PASSWORD_HEADER.toLowerCase()];
    if (typeof header !== "string") return undefined;
    try {
        return decodeURIComponent(header);
    } catch {
        throw new HttpFailure(400, "invalidRequest", `${PASSWORD_HEADER} must be percent-encoded UTF-8`);
    }
}

function scaleOf(value: string | null): number {
    if (value === null) return 1;
    const scale = Number(value);
    if (!Number.isFinite(scale) || scale <= 0) {
        throw new HttpFailure(400, "invalidRequest", `scale must be a positive number, got ${JSON.stringify(value)}`);
    }
    return scale;
}

async function readBody(request: IncomingMessage, limit: number): Promise<Uint8Array> {
    const tooLarge = () => new HttpFailure(413, "payloadTooLarge", `a document may be at most ${limit} bytes`);
    if (Number(request.headers["content-length"]) > limit) throw tooLarge();
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request as AsyncIterable<Buffer>) {
        size += chunk.byteLength;
        if (size > limit) throw tooLarge();
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}
