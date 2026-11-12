// The package routes (docs/design/node-streaming.md): a kept document opened
// part by part. What a client streaming a branch fetches under
// `/documents/:id/package` (`main`) or `/documents/:id/branches/:branch/package`,
// and what a session this server opens over its store reads — both answered
// here, from the store, with no session opened.
//
// One version is served the same way, under
// `/documents/:id/versions/:version/package`: the document as it was at that
// version, with no log, for a client to read and never to change.
//
// Each body but the description is sent deflated — raw DEFLATE, which the
// engine inflates — so none of the document's content crosses as it is.

import { promisify } from "node:util";
import { deflateRaw } from "node:zlib";

import { HttpFailure, bytes, json, notFound } from "./http.ts";
import type { Reply } from "./http.ts";
import { match, route } from "./route.ts";
import type { Params, Route } from "./route.ts";
import { BLOB_KEY, KINDS, PART_ID } from "./store.ts";
import type { At, DocumentStore } from "./store.ts";

/**
 * What answers a package route: document `id`'s resource in `store`, by its
 * route's `params` and `query`, read at `at`.
 */
type PackageHandler = (
    store: DocumentStore,
    id: string,
    params: Params,
    query: URLSearchParams,
    at: At,
) => Promise<Reply>;

/** The routes of one part or one blob: what a batch names. */
const ENTRY_ROUTES: Route<PackageHandler>[] = [
    route("GET", "blobs/:key", blob, { params: { key: BLOB_KEY } }),
    route("GET", ":kinds/:partId", part, { params: { kinds: KINDS, partId: PART_ID } }),
];

/** Every route under `…/package`. */
const PACKAGE_ROUTES: Route<PackageHandler>[] = [
    route("GET", "", description),
    route("GET", "crdt", log),
    route("GET", "batch", batch),
    route("GET", "cuts", cuts),
    route("GET", "cuts/:version/crdt", cutLog, { params: { version: /\d+/ } }),
    ...ENTRY_ROUTES,
];

/** Every route under one version's `…/package`: it has no log to read, and is no cut's. */
const VERSION_ROUTES: Route<PackageHandler>[] = [
    route("GET", "", description),
    route("GET", "batch", batch),
    ...ENTRY_ROUTES,
];

/** Every route under one version's package with its own log, as an editor that opened it reads it. */
const OPENED_VERSION_ROUTES: Route<PackageHandler>[] = [
    route("GET", "", description),
    route("GET", "crdt", log),
    route("GET", "batch", batch),
    ...ENTRY_ROUTES,
];

/** The most parts or blobs one `…/package/batch` names — as many as the engine asks in one. */
const BATCH_LIMIT = 64;

/** The length a batch body gives an entry the package doesn't have. */
const BATCH_ABSENT = 0xffff_ffff;

const OCTETS = "application/octet-stream";

const deflate = promisify(deflateRaw);

/** Document `id`'s resource at `path` under the `…/package` of what is at `at` in `store`, as its route answers it. */
export async function readPackage(
    store: DocumentStore,
    id: string,
    path: string,
    query: URLSearchParams,
    at: At,
): Promise<Reply> {
    const table = "branch" in at ? PACKAGE_ROUTES : at.withLog ? OPENED_VERSION_ROUTES : VERSION_ROUTES;
    const [{ handle }, params] = match(table, "GET", path);
    return handle(store, id, params, query, at);
}

/** What is at `at`, for a message saying it isn't there. */
function named(id: string, at: At): string {
    return "branch" in at ? `document ${id}'s branch ${at.branch}` : `document ${id}'s v${at.version}`;
}

/**
 * The package's description, `{ docType, sourceFormat?, sourceDelimiter?,
 * baselineVersion, baselineFrontier? }`: a branch's head's, with
 * `baselineFrontier` present exactly when the branch has an edit log; or one
 * version's, with none, or, as it was opened, with its own.
 */
async function description(
    store: DocumentStore,
    id: string,
    _params: Params,
    _query: URLSearchParams,
    at: At,
): Promise<Reply> {
    const description = await store.getDescription(id, at);
    if (!description) throw notFound(`${named(id, at)} has no package`);
    return json(200, description, bigintsWhole);
}

/** The branch's edit log, once it has been edited; or the one a version opened with its log holds. */
async function log(store: DocumentStore, id: string, _params: Params, _query: URLSearchParams, at: At): Promise<Reply> {
    const log = "branch" in at ? await store.getLog(id, at.branch) : await store.getVersionLog(id, at.version);
    if (!log) throw notFound(`${named(id, at)} has no edit log`);
    // Kept whole, not in the package's zip, so deflated here.
    return bytes(await deflate(log), OCTETS);
}

/** The versions the branch's edit log was cut at, `{ versions }`: what an editor behind a cut catches up through. */
async function cuts(
    store: DocumentStore,
    id: string,
    _params: Params,
    _query: URLSearchParams,
    at: At,
): Promise<Reply> {
    if (!(await store.getDescription(id, at))) throw notFound(`${named(id, at)} has no package`);
    return json(200, { versions: await cutsOf(store, id, at) });
}

/** The edit log of the version the branch's log was cut at: what led up to that cut. */
async function cutLog(
    store: DocumentStore,
    id: string,
    { version }: Params,
    _query: URLSearchParams,
    at: At,
): Promise<Reply> {
    const cut = Number(version);
    const log = (await cutsOf(store, id, at)).includes(cut) ? await store.getVersionLog(id, cut) : undefined;
    if (!log) throw notFound(`${named(id, at)}'s log wasn't cut at version ${version}`);
    return bytes(await deflate(log), OCTETS);
}

/** The versions the log of the branch at `at` was cut at, oldest first. */
async function cutsOf(store: DocumentStore, id: string, at: At): Promise<number[]> {
    if (!("branch" in at)) return [];
    return (await store.getVersions(id))
        .filter(({ branch, cut }) => branch === at.branch && cut)
        .map(({ version }) => version);
}

/** One blob, by its key. What is served there never changes: a blob's key is its content. */
async function blob(
    store: DocumentStore,
    id: string,
    { key }: Params,
    _query: URLSearchParams,
    at: At,
): Promise<Reply> {
    const body = await store.getBlob(id, key!, at);
    if (!body) throw notFound(`document ${id}'s package has no blob ${key}`);
    return bytes(body, OCTETS, { "cache-control": "private, max-age=31536000, immutable" });
}

/**
 * One part, as its JSON, by its kind in kebab-case and plural and its id's
 * key: the head's, or an opaque part an edit brought, kept for the document
 * (docs/design/core-editor-opaque-part.md), or, held by neither, the newest in
 * its ancestry's.
 */
async function part(
    store: DocumentStore,
    id: string,
    { kinds, partId }: Params,
    _query: URLSearchParams,
    at: At,
): Promise<Reply> {
    const body = await store.getPart(id, kinds!, partId!, at);
    if (!body) throw notFound(`document ${id}'s package has no ${kinds} part ${partId}`);
    return bytes(body, OCTETS);
}

/**
 * Up to 64 parts or blobs at once, each `p` of `query` one's route under
 * `…/package`. The body is each entry in turn: its 4-byte big-endian length
 * and its bytes, deflated as its own route sends it, or the length 0xffffffff
 * alone for one the package doesn't have.
 */
async function batch(
    store: DocumentStore,
    id: string,
    _params: Params,
    query: URLSearchParams,
    at: At,
): Promise<Reply> {
    const routes = query.getAll("p");
    if (routes.length > BATCH_LIMIT) {
        throw new HttpFailure(
            400,
            "invalidRequest",
            `a batch names at most ${BATCH_LIMIT} routes, got ${routes.length}`,
        );
    }
    const entries: Uint8Array[] = [];
    for (const path of routes) {
        let entry: [Route<PackageHandler>, Params];
        try {
            entry = match(ENTRY_ROUTES, "GET", path);
        } catch {
            throw new HttpFailure(400, "invalidRequest", `${JSON.stringify(path)} is no part's or blob's route`);
        }
        const [{ handle }, params] = entry;
        const length = Buffer.alloc(4);
        try {
            const { body } = await handle(store, id, params, new URLSearchParams(), at);
            length.writeUInt32BE(body.byteLength);
            entries.push(length, body);
        } catch (error) {
            if (!(error instanceof HttpFailure) || error.status !== 404) throw error;
            length.writeUInt32BE(BATCH_ABSENT);
            entries.push(length);
        }
    }
    return bytes(Buffer.concat(entries), OCTETS);
}

/** `JSON.rawJSON` (ES2026): in every Node this package runs on, not yet in TypeScript's lib. */
const rawJSON = (JSON as JSON & { rawJSON(text: string): unknown }).rawJSON;

/** A frontier's `bigint`s written whole. */
function bigintsWhole(_key: string, value: unknown): unknown {
    return typeof value === "bigint" ? rawJSON(value.toString()) : value;
}
