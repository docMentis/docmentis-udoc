// Where udoc-server keeps each document between sessions.
//
// A document is kept as its original — the upload, byte for byte, in the
// format it was imported as — and its checkpoints, each the udoc package one
// checkpoint saved: `v0`, the baseline its import produced with every id
// already minted, then one more each time it is checkpointed
// (docs/design/core-save.md). Every later session reopens the latest.
//
// The latest checkpoint is also read an entry at a time, for streaming: its
// description, a part, a blob, each addressed by its route — the server API's
// own terms (see docs/design/node-streaming.md), which a store maps to
// wherever it keeps them. A part or a blob is read deflated, the form it is
// sent in.
//
// Once the document is edited, it also has an edit log: every edit made, which
// is a package's own `crdt` entity — opening applies it — but kept apart from
// the checkpoints, because it is written on every edit and a checkpoint only
// once. It holds every edit since the import, so it replays over any
// checkpoint, and a checkpoint leaves it as it is.
//
// An edit that inserts a picture also brings the picture's image: an opaque
// part, whose id the edit log carries but not its content
// (docs/design/core-editor-opaque-part.md). Each such part, and each blob it
// carries, is kept beside the checkpoints by its route — written once, since
// an opaque part never changes and a blob's key is its content — until a
// checkpoint holds it.

import { randomUUID } from "node:crypto";
import { link, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { buffer } from "node:stream/consumers";
import { promisify } from "node:util";
import { deflateRaw } from "node:zlib";

import { UDocError, isFileFormat } from "@docmentis/udoc-node";
import type { FileFormat, UDocType } from "@docmentis/udoc-node";
import { fromBufferPromise, openPromise } from "yauzl";
import type { Entry, ZipFile } from "yauzl";

/** A document's upload, as it arrived, and the format it was imported as. */
export interface Original {
    bytes: Uint8Array;
    format: FileFormat;
}

/** What is kept of one document when it is imported. */
export interface KeptDocument {
    original: Original;
    /** Its first checkpoint, `v0`: the udoc package its import saved. */
    checkpoint: Uint8Array;
}

/**
 * A CRDT frontier as the engine writes it: `[peer, counter]` pairs, each a
 * `u64`. A peer is random, past what a JS number holds exactly, so each is a
 * `bigint`.
 */
export type Frontier = [peer: bigint, counter: bigint][];

/** What a client opening a package needs to know of it. */
export interface PackageDescription {
    docType: UDocType;
    /** Absent for a document not imported from a file. */
    sourceFormat?: FileFormat;
    /** The character a CSV source split its fields by; absent for any other source. */
    sourceDelimiter?: string;
    /** The latest checkpoint's version. */
    baselineVersion: number;
    /**
     * Where the edit log replays from — present exactly when there is one:
     * the latest checkpoint's own frontier, or, over `v0`, a flat baseline the
     * whole log was made over, the empty frontier.
     */
    baselineFrontier?: Frontier;
}

/**
 * A route's segments under `…/package` (docs/design/node-streaming.md): a
 * part's kind in kebab-case and plural, its id's key — `replica-counter` in
 * hex — and a blob's key. A route is held to them before it reaches a store,
 * so none names a path outside.
 */
export const KINDS = /[a-z0-9]+(?:-[a-z0-9]+)*/;
export const PART_ID = /[0-9a-f]+-[0-9a-f]+/;
export const BLOB_KEY = /[0-9a-f]+/;

/** Where the server keeps each document, by id. */
export interface DocumentStore {
    /** Keep a new document as `id`. Refused when `id` is already kept. */
    put(id: string, document: KeptDocument): Promise<void>;
    /** Document `id`'s original, or `undefined` when nothing is kept. */
    getOriginal(id: string): Promise<Original | undefined>;
    /** Document `id`'s latest checkpoint, or `undefined` when nothing is kept. */
    getCheckpoint(id: string): Promise<Uint8Array | undefined>;
    /**
     * Keep `checkpoint`, the udoc package of document `id`'s checkpoint
     * `version`, beside the earlier ones, as its latest; then forget each
     * opaque part and blob kept beside them that it holds. Refused when no
     * checkpoint is kept as `id`, or `version` is kept already.
     */
    putCheckpoint(id: string, version: number, checkpoint: Uint8Array): Promise<void>;
    /** Document `id`'s package description, from its latest checkpoint, or `undefined` when it has none. */
    getDescription(id: string): Promise<PackageDescription | undefined>;
    /**
     * One part of document `id`, as its JSON deflated — raw DEFLATE (RFC
     * 1951) — by its route: `kinds`, its kind in kebab-case and plural, and
     * `partId`, its id's key. Its latest checkpoint's, or an opaque part an
     * edit brought, kept beside the checkpoints, or, held by neither, the
     * newest earlier checkpoint's. `undefined` when there is no such part, or
     * no checkpoint.
     */
    getPart(id: string, kinds: string, partId: string): Promise<Uint8Array | undefined>;
    /**
     * One blob of document `id`, deflated, by its key — found as a part is —
     * or `undefined` when it has none.
     */
    getBlob(id: string, key: string): Promise<Uint8Array | undefined>;
    /**
     * Keep every part and blob of `parts` — a client's `opaque parts`,
     * a zip in a package's own layout — beside document `id`'s checkpoints, by
     * route. What is kept already stays as it was. Refused when nothing is
     * kept as `id`.
     */
    putOpaqueParts(id: string, parts: Uint8Array): Promise<void>;
    /**
     * Document `id`'s edit log, or `undefined` when it has none: the one kept,
     * or, for a document checkpointed before any edit was kept, its latest
     * checkpoint's own.
     */
    getLog(id: string): Promise<Uint8Array | undefined>;
    /**
     * Keep `log` as document `id`'s edit log, in place of the one kept — whole
     * or not at all. Refused when nothing is kept as `id`.
     */
    putLog(id: string, log: Uint8Array): Promise<void>;
    /** Forget document `id`; answers whether anything was kept. */
    delete(id: string): Promise<boolean>;
}

/** An id that is safe as a file name. No dot, so no id can name a staged write. */
const FILE_SAFE_ID = /^[A-Za-z0-9_-]+$/;

/**
 * A document's original is `original.<format>`; its checkpoints are
 * `checkpoints/v<version>.udoc`, the latest the highest; its edit log, once it
 * has one, is `crdt.loro`, the name a package's own entry for it has.
 */
const ORIGINAL = "original";
const CHECKPOINTS_DIR = "checkpoints";
const CHECKPOINT_FILE = /^v(\d+)\.udoc$/;
const LOG_FILE = "crdt.loro";

/**
 * Where the opaque parts edits brought are kept, each deflated at
 * `opaque-parts/<kinds>/<partId>`; the blobs they carry are at `blobs/<key>`.
 */
const OPAQUE_PARTS_DIR = "opaque-parts";
const BLOBS_DIR = "blobs";

/**
 * A part's entry in a package, `parts/<snake_kind>_<id-key>.json`, and a
 * blob's, `blobs/<key>` with whatever extension it was written with. The key
 * holds no `_`, so the kind is everything before the last one.
 */
const PART_ENTRY = new RegExp(`^parts/([a-z0-9]+(?:_[a-z0-9]+)*)_(${PART_ID.source})\\.json$`);
const BLOB_ENTRY = new RegExp(`^blobs/(${BLOB_KEY.source})(?:\\.[^/]*)?$`);

/** The compression method of a zip entry kept deflated. */
const DEFLATE = 8;

const deflate = promisify(deflateRaw);

/**
 * A {@link DocumentStore} over a directory: one directory per document, named
 * by its id, holding its original, its checkpoints and its edit log.
 */
export class DirectoryDocumentStore implements DocumentStore {
    readonly #directory: string;

    constructor(directory: string) {
        this.#directory = directory;
    }

    async put(id: string, document: KeptDocument): Promise<void> {
        const path = this.#path(id);
        await mkdir(this.#directory, { recursive: true });
        // Both are written into a directory aside and renamed into place
        // together, so a reader never meets half a document, and a crash
        // mid-write leaves none. A directory can't be renamed over one that
        // holds files, so an id already kept stays as it was.
        const staged = `${path}.${randomUUID()}.partial`;
        try {
            await mkdir(staged);
            await writeFile(join(staged, `${ORIGINAL}.${document.original.format}`), document.original.bytes);
            await mkdir(join(staged, CHECKPOINTS_DIR));
            await writeFile(join(staged, CHECKPOINTS_DIR, "v0.udoc"), document.checkpoint);
            await rename(staged, path);
        } catch (error) {
            await rm(staged, { recursive: true, force: true });
            throw error;
        }
    }

    async getOriginal(id: string): Promise<Original | undefined> {
        const path = this.#path(id);
        let names: string[];
        try {
            names = await readdir(path);
        } catch (error) {
            if (isNotFound(error)) return undefined;
            throw error;
        }
        for (const name of names) {
            const format = name.startsWith(`${ORIGINAL}.`) ? name.slice(ORIGINAL.length + 1) : undefined;
            if (format !== undefined && isFileFormat(format)) {
                return { bytes: await readFile(join(path, name)), format };
            }
        }
        throw new Error(`document ${id} is kept without its original`);
    }

    async getCheckpoint(id: string): Promise<Uint8Array | undefined> {
        const [latest] = await this.#checkpoints(id);
        return latest === undefined ? undefined : readFile(latest);
    }

    async putCheckpoint(id: string, version: number, checkpoint: Uint8Array): Promise<void> {
        const path = this.#path(id);
        const kept = join(path, CHECKPOINTS_DIR, `v${version}.udoc`);
        // Written aside, then linked into place, which refuses a version kept
        // already: once there, it is the latest, whole.
        const staged = `${kept}.${randomUUID()}.partial`;
        try {
            await writeFile(staged, checkpoint, { flag: "wx" });
            await link(staged, kept);
        } catch (error) {
            if (isNotFound(error)) throw new Error(`no document ${JSON.stringify(id)} with checkpoints is kept`);
            if (isAlreadyKept(error))
                throw new Error(`document ${JSON.stringify(id)} keeps checkpoint v${version} already`);
            throw error;
        } finally {
            await rm(staged, { force: true });
        }
        // What it holds is served from it now. Forgotten only after it is in
        // place, so a crash between leaves an opaque part kept twice, never
        // one kept nowhere.
        const zip = await fromBufferPromise(
            Buffer.from(checkpoint.buffer, checkpoint.byteOffset, checkpoint.byteLength),
            {
                lazyEntries: true,
            },
        );
        try {
            for await (const entry of zip.eachEntry()) {
                const route = keptRouteOf(entry.fileName);
                if (route !== undefined) await rm(join(path, route), { force: true });
            }
        } finally {
            zip.close();
        }
    }

    async getDescription(id: string): Promise<PackageDescription | undefined> {
        const metadata = await this.#readCheckpointEntry(id, "");
        if (!metadata) return undefined;
        // The checkpoint's own envelope, written by the engine this server runs.
        // Every number is read whole, as a `bigint`, so a frontier's peers
        // keep every bit.
        const { documentType, sourceFormat, sourceDelimiter, baselineVersion, baselineFrontier } = JSON.parse(
            new TextDecoder().decode(metadata),
            (_key, value: unknown, context?: { source?: string }) =>
                typeof value === "number" && context?.source !== undefined ? BigInt(context.source) : value,
        ) as {
            documentType: UDocType;
            sourceFormat?: FileFormat;
            sourceDelimiter?: string;
            baselineVersion: bigint;
            baselineFrontier?: Frontier;
        };
        const frontier = baselineFrontier ?? ((await this.#hasLog(id)) ? [] : undefined);
        return {
            docType: documentType,
            ...(sourceFormat !== undefined ? { sourceFormat } : {}),
            ...(sourceDelimiter !== undefined ? { sourceDelimiter } : {}),
            baselineVersion: Number(baselineVersion),
            ...(frontier !== undefined ? { baselineFrontier: frontier } : {}),
        };
    }

    async getPart(id: string, kinds: string, partId: string): Promise<Uint8Array | undefined> {
        return this.#readPart(id, `${kinds}/${partId}`, join(OPAQUE_PARTS_DIR, kinds, partId));
    }

    async getBlob(id: string, key: string): Promise<Uint8Array | undefined> {
        return this.#readPart(id, `blobs/${key}`, join(BLOBS_DIR, key));
    }

    /**
     * Document `id`'s part or blob at `route`, deflated: its latest
     * checkpoint's; else the one kept beside the checkpoints at `kept`; else
     * the newest earlier checkpoint's that has it. Once a checkpoint holds an
     * opaque part, it is kept beside them no longer, and a later checkpoint
     * holds it only if something showed it then — yet an undo can show it
     * again.
     */
    async #readPart(id: string, route: string, kept: string): Promise<Uint8Array | undefined> {
        const [latest, ...earlier] = await this.#checkpoints(id);
        if (latest !== undefined) {
            const entry = await this.#readEntry(latest, route, true);
            if (entry) return entry;
        }
        const keptBeside = await this.#readKept(id, kept);
        if (keptBeside) return keptBeside;
        for (const checkpoint of earlier) {
            const entry = await this.#readEntry(checkpoint, route, true);
            if (entry) return entry;
        }
        return undefined;
    }

    async putOpaqueParts(id: string, parts: Uint8Array): Promise<void> {
        const path = this.#path(id);
        // Nothing here creates the document's directory, so a document
        // forgotten meanwhile stays forgotten.
        try {
            await stat(path);
        } catch (error) {
            if (isNotFound(error)) throw new UDocError("notFound", `no document ${JSON.stringify(id)} is kept`);
            throw error;
        }
        // Sent by a client: bytes that aren't a zip are its to answer for.
        const zip = await fromBufferPromise(Buffer.from(parts.buffer, parts.byteOffset, parts.byteLength), {
            lazyEntries: true,
        }).catch((error: unknown) => {
            const reason = error instanceof Error ? error.message : String(error);
            throw new UDocError("malformed", `the opaque parts aren't a zip: ${reason}`, undefined, { cause: error });
        });
        try {
            for await (const entry of zip.eachEntry()) {
                const route = keptRouteOf(entry.fileName);
                if (route === undefined) continue;
                const kept = join(path, route);
                await mkdir(dirname(kept), { recursive: true });
                // Written aside and renamed into place, so a reader meets the
                // whole entry or none. A route names its content, so one kept
                // already is the same bytes, renamed over.
                const staged = `${kept}.${randomUUID()}.partial`;
                try {
                    await writeFile(staged, await deflatedEntry(zip, entry), { flag: "wx" });
                    await rename(staged, kept);
                } catch (error) {
                    await rm(staged, { force: true });
                    throw error;
                }
            }
        } finally {
            zip.close();
        }
    }

    /** The file kept at `route` beside document `id`'s checkpoints, or `undefined` when there is none. */
    async #readKept(id: string, route: string): Promise<Uint8Array | undefined> {
        try {
            return await readFile(join(this.#path(id), route));
        } catch (error) {
            if (isNotFound(error)) return undefined;
            throw error;
        }
    }

    /** The paths of document `id`'s checkpoints, the latest first; none when it has none. */
    async #checkpoints(id: string): Promise<string[]> {
        const directory = join(this.#path(id), CHECKPOINTS_DIR);
        let names: string[];
        try {
            names = await readdir(directory);
        } catch (error) {
            if (isNotFound(error)) return [];
            throw error;
        }
        return names
            .flatMap((name) => {
                const version = CHECKPOINT_FILE.exec(name)?.[1];
                return version === undefined ? [] : [{ version: Number(version), path: join(directory, name) }];
            })
            .sort((a, b) => b.version - a.version)
            .map(({ path }) => path);
    }

    /**
     * The entry of document `id`'s latest checkpoint at `route`, read as
     * `#readEntry` reads one, or `undefined` when it has none or there is no
     * checkpoint.
     */
    async #readCheckpointEntry(id: string, route: string, deflated = false): Promise<Uint8Array | undefined> {
        const [latest] = await this.#checkpoints(id);
        return latest === undefined ? undefined : this.#readEntry(latest, route, deflated);
    }

    /**
     * The entry of the checkpoint at `checkpoint` at `route` (see
     * {@link routeOf}), or `undefined` when it has none. Reads the zip's
     * central directory and that one entry: inflated, or — `deflated` — as the
     * zip keeps it, deflated, so nothing is compressed again; one kept stored
     * is deflated now.
     */
    async #readEntry(checkpoint: string, route: string, deflated = false): Promise<Uint8Array | undefined> {
        let zip;
        try {
            zip = await openPromise(checkpoint, { lazyEntries: true, autoClose: false });
        } catch (error) {
            if (isNotFound(error)) return undefined;
            throw error;
        }
        try {
            for await (const entry of zip.eachEntry()) {
                if (routeOf(entry.fileName) !== route) continue;
                if (deflated && entry.compressionMethod === DEFLATE) {
                    return await buffer(await zip.openReadStreamPromise(entry, { decodeFileData: false }));
                }
                const bytes = await buffer(await zip.openReadStreamPromise(entry));
                return deflated ? await deflate(bytes) : bytes;
            }
            return undefined;
        } finally {
            zip.close();
        }
    }

    async getLog(id: string): Promise<Uint8Array | undefined> {
        try {
            return await readFile(join(this.#path(id), LOG_FILE));
        } catch (error) {
            if (!isNotFound(error)) throw error;
        }
        return this.#readCheckpointEntry(id, LOG_FILE);
    }

    async putLog(id: string, log: Uint8Array): Promise<void> {
        const path = join(this.#path(id), LOG_FILE);
        // Written aside and renamed over the one kept, so a reader meets the old
        // log or the new, never part of one. Neither creates the document's
        // directory, so a document forgotten meanwhile stays forgotten.
        const staged = `${path}.${randomUUID()}.partial`;
        try {
            await writeFile(staged, log, { flag: "wx" });
            await rename(staged, path);
        } catch (error) {
            await rm(staged, { force: true });
            if (isNotFound(error)) throw new Error(`no document ${JSON.stringify(id)} is kept`);
            throw error;
        }
    }

    async #hasLog(id: string): Promise<boolean> {
        try {
            await stat(join(this.#path(id), LOG_FILE));
            return true;
        } catch (error) {
            if (isNotFound(error)) return false;
            throw error;
        }
    }

    async delete(id: string): Promise<boolean> {
        try {
            await rm(this.#path(id), { recursive: true });
            return true;
        } catch (error) {
            if (isNotFound(error)) return false;
            throw error;
        }
    }

    #path(id: string): string {
        if (!FILE_SAFE_ID.test(id)) throw new Error(`not a document id: ${JSON.stringify(id)}`);
        return join(this.#directory, id);
    }
}

/**
 * The route a package entry is served at, relative to the package: `""` for
 * `metadata.json`, `<kinds>/<partId>` for a part, `blobs/<key>` for a blob,
 * `crdt.loro` for the edit log, and `undefined` for anything not served.
 */
function routeOf(entry: string): string | undefined {
    if (entry === "metadata.json") return "";
    if (entry === LOG_FILE) return LOG_FILE;
    const part = PART_ENTRY.exec(entry);
    if (part) return `${pluralKebab(part[1]!)}/${part[2]!}`;
    const blob = BLOB_ENTRY.exec(entry);
    if (blob) return `blobs/${blob[1]!}`;
    return undefined;
}

/**
 * Where an entry of an `opaque parts` zip is kept, relative to the document's
 * directory: a part's entry at `opaque-parts/<kinds>/<partId>`, and a blob at
 * `blobs/<key>`. Anything else — the zip's own list of what it carries — is not
 * kept. Every segment is checked against its pattern, so no entry names a path
 * outside.
 */
function keptRouteOf(entry: string): string | undefined {
    const part = PART_ENTRY.exec(entry);
    if (part) return join(OPAQUE_PARTS_DIR, pluralKebab(part[1]!), part[2]!);
    const blob = BLOB_ENTRY.exec(entry);
    if (blob) return join(BLOBS_DIR, blob[1]!);
    return undefined;
}

/** `entry` of `zip`, deflated: as the zip keeps it when it keeps it deflated, else deflated now. */
async function deflatedEntry(zip: ZipFile, entry: Entry): Promise<Uint8Array> {
    if (entry.compressionMethod === DEFLATE) {
        return buffer(await zip.openReadStreamPromise(entry, { decodeFileData: false }));
    }
    return deflate(await buffer(await zip.openReadStreamPromise(entry)));
}

/**
 * A kind's route segment from its snake_case entry name: kebab-case, plural. A
 * kind already plural stays as it is, and so does a `…data` kind, whose noun is
 * uncounted — the rule the engine's `RemotePackageLoader` applies to the same
 * kind (docs/design/node-streaming.md).
 */
function pluralKebab(snakeKind: string): string {
    const kebab = snakeKind.replaceAll("_", "-");
    const uncounted = kebab.endsWith("s") || kebab.split("-").at(-1) === "data";
    return uncounted ? kebab : `${kebab}s`;
}

function isNotFound(error: unknown): boolean {
    return codeOf(error) === "ENOENT";
}

function isAlreadyKept(error: unknown): boolean {
    return codeOf(error) === "EEXIST";
}

function codeOf(error: unknown): unknown {
    return typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
}
