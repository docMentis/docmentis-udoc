// The document routes: a document imported once and kept, then served from
// what is kept — its original and its package read from the store, its pages
// and its copies from a session over it — edited together, checkpointed, and
// forgotten.

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
 * `payloadTooLarge` or `internal`.
 */
export function documentRoutes({
    udoc,
    store,
    sessions,
    collaborations,
    maxUploadBytes,
}: DocumentRoutesOptions): Route[] {
    /** The checkpoint each document is writing now, which its next one waits for, to take the version after. */
    const checkpointing = new Map<string, Promise<number>>();

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
        const id = documentId(params);
        const format = params.format!;
        if (format !== "udoc" && !isFileFormat(format)) throw notFound();
        const strategy = strategyOf(format, query.get("strategy"));
        const delimiter = query.get("delimiter") ?? undefined;
        if (format === "udoc" && delimiter !== undefined) {
            throw new HttpFailure(400, "invalidRequest", "a udoc copy is a package, split by no delimiter");
        }
        const saved = await sessions.use(id, (session) =>
            format === "udoc" ? session.saveToPackage() : session.saveToBytes(format, strategy, delimiter),
        );
        return bytes(saved, "application/octet-stream");
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
            .then(async () => {
                const description = await store.getDescription(id);
                if (!description) throw noDocument(id);
                const version = description.baselineVersion + 1;
                const saved = await sessions.use(id, (session) => session.saveToPackage(version));
                await store.putCheckpoint(id, version, saved);
                return version;
            });
        checkpointing.set(id, next);
        const forget = () => {
            if (checkpointing.get(id) === next) checkpointing.delete(id);
        };
        next.then(forget, forget);
        return json(201, { version: await next });
    }

    /**
     * The package: the latest checkpoint, with the edit log and the opaque
     * parts edits brought on top — its description, or one resource under it
     * (see `package.ts`).
     */
    function packageResource({ params, query }: RouteRequest): Promise<Reply> {
        return readPackage(store, documentId(params), params.route ?? "", query);
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
        const session = await udoc.open(uploaded, format, delimiter);
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
