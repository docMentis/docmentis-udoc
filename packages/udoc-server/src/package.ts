// The package routes (docs/design/node-streaming.md): a kept document opened
// part by part. What a client streaming it fetches under
// `/documents/:id/package`, and what a session this server opens over its
// store reads — both answered here, from the store, with no session opened.
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
import type { DocumentStore } from "./store.ts";

/** What answers a package route: document `id`'s resource in `store`, by its route's `params` and `query`. */
type PackageHandler = (store: DocumentStore, id: string, params: Params, query: URLSearchParams) => Promise<Reply>;

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
    ...ENTRY_ROUTES,
];

/** The most parts or blobs one `…/package/batch` names — as many as the engine asks in one. */
const BATCH_LIMIT = 64;

/** The length a batch body gives an entry the package doesn't have. */
const BATCH_ABSENT = 0xffff_ffff;

const OCTETS = "application/octet-stream";

const deflate = promisify(deflateRaw);

/** Document `id`'s resource at `path` under `…/package` in `store`, as its route answers it. */
export async function readPackage(
    store: DocumentStore,
    id: string,
    path: string,
    query: URLSearchParams,
): Promise<Reply> {
    const [{ handle }, params] = match(PACKAGE_ROUTES, "GET", path);
    return handle(store, id, params, query);
}

/**
 * The package's description, `{ docType, sourceFormat?, sourceDelimiter?,
 * baselineVersion, baselineFrontier? }`: the latest checkpoint's, with `baselineFrontier`
 * present exactly when there is an edit log.
 */
async function description(store: DocumentStore, id: string): Promise<Reply> {
    const description = await store.getDescription(id);
    if (!description) throw notFound(`document ${id} has no package`);
    return json(200, description, bigintsWhole);
}

/** The edit log, once the document has been edited. */
async function log(store: DocumentStore, id: string): Promise<Reply> {
    const log = await store.getLog(id);
    if (!log) throw notFound(`document ${id} has no edit log`);
    // Kept whole, not in the package's zip, so deflated here.
    return bytes(await deflate(log), OCTETS);
}

/** One blob, by its key. What is served there never changes: a blob's key is its content. */
async function blob(store: DocumentStore, id: string, { key }: Params): Promise<Reply> {
    const body = await store.getBlob(id, key!);
    if (!body) throw notFound(`document ${id}'s package has no blob ${key}`);
    return bytes(body, OCTETS, { "cache-control": "private, max-age=31536000, immutable" });
}

/**
 * One part, as its JSON, by its kind in kebab-case and plural and its id's
 * key: the latest checkpoint's, or an opaque part an edit brought, kept beside
 * it (docs/design/core-editor-opaque-part.md), or, held by neither, an earlier
 * checkpoint's.
 */
async function part(store: DocumentStore, id: string, { kinds, partId }: Params): Promise<Reply> {
    const body = await store.getPart(id, kinds!, partId!);
    if (!body) throw notFound(`document ${id}'s package has no ${kinds} part ${partId}`);
    return bytes(body, OCTETS);
}

/**
 * Up to 64 parts or blobs at once, each `p` of `query` one's route under
 * `…/package`. The body is each entry in turn: its 4-byte big-endian length
 * and its bytes, deflated as its own route sends it, or the length 0xffffffff
 * alone for one the package doesn't have.
 */
async function batch(store: DocumentStore, id: string, _params: Params, query: URLSearchParams): Promise<Reply> {
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
            const { body } = await handle(store, id, params, new URLSearchParams());
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
