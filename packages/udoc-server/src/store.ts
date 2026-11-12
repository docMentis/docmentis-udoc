// Where udoc-server keeps each document between sessions
// (docs/design/node-branches.md).
//
// A document is kept as its original — the upload, byte for byte, in the
// format it was imported as — its versions and its branches. A version is the
// udoc package one checkpoint saved (docs/design/core-save.md): `v0`, the
// baseline its import produced with every id already minted, on `main`, its
// first branch; then each branch's, numbered across the document. A version
// records its branch, and its parent: the version before it on its branch, or
// the one its branch starts from, its base. A branch's head is its latest
// version, or its base while it has none.
//
// A branch's head is read an entry at a time, for streaming: its description, a
// part, a blob, each addressed by its route — the server API's own terms (see
// docs/design/node-streaming.md), which a store maps to wherever it keeps them.
// One version as it was is read the same way. A part or a blob is read
// deflated, the form it is sent in.
//
// Once a branch is edited, it also has an edit log: every edit made on it, which
// is a package's own `crdt` entity — opening applies it — but kept apart from
// the versions, because it is written on every edit and a version only once. It
// holds the state at its last cut and every edit since
// (docs/design/node-log-cut.md), so it replays over any version of the branch
// since that cut, and a checkpoint leaves it as it is.
//
// An edit that inserts a picture also brings the picture's image: an opaque
// part, whose id the edit log carries but not its content
// (docs/design/core-editor-opaque-part.md). Each such part, and each blob it
// carries, is kept for the document by its route — written once, since an
// opaque part never changes and a blob's key is its content — and read by
// every branch.

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

/** The branch importing a document makes. */
export const MAIN_BRANCH = "main";

/** A document's upload, as it arrived, and the format it was imported as. */
export interface Original {
    bytes: Uint8Array;
    format: FileFormat;
}

/** What is kept of one document when it is imported. */
export interface KeptDocument {
    original: Original;
    /** Its first version, `v0`, on `main`: the udoc package its import saved. */
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
    /** The version it describes. */
    baselineVersion: number;
    /**
     * Where the edit log replays from — present exactly when there is one:
     * the version's own frontier, or, over `v0`, a flat baseline the whole log
     * was made over, the empty frontier.
     */
    baselineFrontier?: Frontier;
}

/**
 * Where a read is made: a branch, as it is now — its head, and its log — or
 * one version, as it was, with no log; or, `withLog`, as an editor that opened
 * it holds it, its own log replaying over it.
 */
export type At = { branch: string } | { version: number; withLog?: boolean };

/** One version of a document, as it is kept. */
export interface KeptVersion {
    version: number;
    /** The branch it was taken on. */
    branch: string;
    /** The version before it on its branch, or the one its branch starts from; none for `v0`. */
    parent?: number;
    /** Present when it is a cut of its branch's log (docs/design/node-log-cut.md). */
    cut?: true;
}

/** One branch of a document, as it is kept. */
export interface KeptBranch {
    branch: string;
    /** The version it starts from; none for `main`. */
    base?: number;
}

/** What a branch was last merged from another: how much of it, and whether its edits were moved onto the log. */
export interface KeptMerge {
    /** The source's version vector, as the engine writes it, when it was merged. */
    versionVector: Uint8Array;
    /** Whether the source's edits were moved onto the target's log, under ids of their own. */
    moved: boolean;
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
    /** Keep a new document as `id`: its original, and `v0` on `main`. Refused when `id` is already kept. */
    put(id: string, document: KeptDocument): Promise<void>;
    /** Document `id`'s original, or `undefined` when nothing is kept. */
    getOriginal(id: string): Promise<Original | undefined>;
    /** Document `id`'s versions, oldest first; none when nothing is kept. */
    getVersions(id: string): Promise<KeptVersion[]>;
    /**
     * Keep `checkpoint`, the udoc package of document `id`'s version `version`,
     * as branch `branch`'s latest, its head its parent. Refused when there is no
     * such branch, or `version` is kept already.
     */
    putVersion(id: string, branch: string, version: number, checkpoint: Uint8Array): Promise<void>;
    /** The edit log version `version` of document `id` holds, or `undefined` when it holds none, or isn't kept. */
    getVersionLog(id: string, version: number): Promise<Uint8Array | undefined>;
    /** Document `id`'s branches, `main` first; none when nothing is kept. */
    getBranches(id: string): Promise<KeptBranch[]>;
    /**
     * Keep a new branch of document `id`, `branch`, starting from version `base`,
     * with no log of its own: its head's own is its log. Refused when `base`
     * isn't kept, or `branch` is kept already.
     */
    putBranch(id: string, branch: string, base: number): Promise<void>;
    /** Forget branch `branch` of document `id` — its log and what it was merged from; its versions stay. Answers whether it was kept. */
    deleteBranch(id: string, branch: string): Promise<boolean>;
    /**
     * Document `id`'s package description at `at`, or `undefined` when there is
     * nothing there: at a branch, its head's, with `baselineFrontier` exactly when
     * the branch has a log; at a version, that one's, with none — its parts are
     * the document at that version, and no log replays over them — or, `withLog`,
     * with its own frontier.
     */
    getDescription(id: string, at: At): Promise<PackageDescription | undefined>;
    /**
     * One part of document `id` at `at`, as its JSON deflated — raw DEFLATE (RFC
     * 1951) — by its route: `kinds`, its kind in kebab-case and plural, and
     * `partId`, its id's key. The head's, or that version's; else, unless that
     * one records it as removed, an opaque part an edit brought; else the newest
     * in its ancestry that holds it. `undefined` when there is no such part, or
     * nothing at `at`.
     */
    getPart(id: string, kinds: string, partId: string, at: At): Promise<Uint8Array | undefined>;
    /** One blob of document `id` at `at`, deflated, by its key — found as a part is — or `undefined` when it has none. */
    getBlob(id: string, key: string, at: At): Promise<Uint8Array | undefined>;
    /**
     * Keep every part and blob of `parts` — a client's `opaque parts`, a zip in a
     * package's own layout — for document `id`, every branch's, by route. What is
     * kept already stays as it was. Refused when nothing is kept as `id`.
     */
    putOpaqueParts(id: string, parts: Uint8Array): Promise<void>;
    /**
     * Branch `branch`'s edit log, or `undefined` when it has none: the one kept,
     * or, for a branch with no edit kept since its head, its head's own.
     */
    getLog(id: string, branch: string): Promise<Uint8Array | undefined>;
    /** Keep `log` as branch `branch`'s edit log, in place of the one kept — whole or not at all. Refused when there is no such branch. */
    putLog(id: string, branch: string, log: Uint8Array): Promise<void>;
    /**
     * Keep `checkpoint` as branch `branch`'s version `version`, a cut of its log,
     * then `log`, the log cut there, in place of the one kept: in that order, so a
     * failure part-way leaves a log that still replays over the branch's head. The
     * log kept has to hold that version's frontier already. Refused as
     * {@link putVersion} and {@link putLog} are.
     */
    putCut(id: string, branch: string, version: number, checkpoint: Uint8Array, log: Uint8Array): Promise<void>;
    /**
     * Where each id of document `id` sits in its original, as the JSON the
     * version read at `at` holds — a branch's head, or that version; `undefined`
     * when it holds none. What a session reads to write over the original, which
     * no route serves.
     */
    getOriginalIdMap(id: string, at: At): Promise<Uint8Array | undefined>;
    /** The parts of document `id` that differ from its original, as the JSON the version read at `at` holds. Read as {@link getOriginalIdMap} is. */
    getModifiedPartIds(id: string, at: At): Promise<Uint8Array | undefined>;
    /**
     * The parts of document `id` its model had removed, as the JSON the version
     * read at `at` holds. Read as {@link getOriginalIdMap} is. {@link getPart}
     * answers `undefined` for each, whatever its ancestry holds.
     */
    getRemovedPartIds(id: string, at: At): Promise<Uint8Array | undefined>;
    /** What branch `target` of document `id` was last merged from branch `source`, or `undefined` when it never was. */
    getMerge(id: string, target: string, source: string): Promise<KeptMerge | undefined>;
    /** Keep `merge` as what branch `target` was last merged from `source`. Refused when there is no branch `target`. */
    putMerge(id: string, target: string, source: string, merge: KeptMerge): Promise<void>;
    /** Forget document `id`; answers whether anything was kept. */
    delete(id: string): Promise<boolean>;
}

/** An id that is safe as a file name. No dot, so no id can name a staged write. */
const FILE_SAFE_ID = /^[A-Za-z0-9_-]+$/;

/**
 * A document's original is `original.<format>`; its versions are
 * `versions/v<version>.udoc`, each with its record, `{ branch, parent?, cut? }`,
 * beside it as `v<version>.json`; a branch is `branches/<branch>/`, holding
 * `branch.json`, `{ base? }`, its edit log once it has one, as
 * `crdt_delta.loro` — the name a package's own entry for it has — and what it
 * was merged from, as `merges/<source>.json`.
 */
const ORIGINAL = "original";
const VERSIONS_DIR = "versions";
const VERSION_FILE = /^v(\d+)\.udoc$/;
const BRANCHES_DIR = "branches";
const BRANCH_FILE = "branch.json";
const MERGES_DIR = "merges";
const LOG_FILE = "crdt_delta.loro";
const ORIGINAL_ID_MAP_FILE = "original_id_map.json";
const MODIFIED_PART_IDS_FILE = "modified_part_ids.json";
const REMOVED_PART_IDS_FILE = "removed_part_ids.json";

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

/** A version's record as its file keeps it: the version is the file's name. */
type VersionRecord = Omit<KeptVersion, "version">;

/** What a read at `at` reads: the version it reads first, and its ancestry after it, newest first. */
interface Lineage {
    /** The branch's head, or the version asked for. */
    head: number;
    /** The versions after it, parent by parent, back to `v0`. */
    ancestry: number[];
}

/**
 * A {@link DocumentStore} over a directory: one directory per document, named
 * by its id, holding its original, its versions and its branches.
 */
export class DirectoryDocumentStore implements DocumentStore {
    readonly #directory: string;
    /** Each document's version records read so far: they never change once kept. */
    readonly #records = new Map<string, Map<number, VersionRecord>>();

    constructor(directory: string) {
        this.#directory = directory;
    }

    async put(id: string, document: KeptDocument): Promise<void> {
        const path = this.#path(id);
        await mkdir(this.#directory, { recursive: true });
        // Written into a directory aside and renamed into place whole, so a
        // reader never meets half a document, and a crash mid-write leaves none.
        // A directory can't be renamed over one that holds files, so an id
        // already kept stays as it was.
        const staged = `${path}.${randomUUID()}.partial`;
        try {
            await mkdir(join(staged, VERSIONS_DIR), { recursive: true });
            await mkdir(join(staged, BRANCHES_DIR, MAIN_BRANCH), { recursive: true });
            await writeFile(join(staged, `${ORIGINAL}.${document.original.format}`), document.original.bytes);
            const record: VersionRecord = { branch: MAIN_BRANCH };
            await writeFile(join(staged, VERSIONS_DIR, "v0.json"), JSON.stringify(record));
            await writeFile(join(staged, VERSIONS_DIR, "v0.udoc"), document.checkpoint);
            await writeFile(join(staged, BRANCHES_DIR, MAIN_BRANCH, BRANCH_FILE), "{}");
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

    async getVersions(id: string): Promise<KeptVersion[]> {
        return [...(await this.#versionRecords(id))].map(([version, record]) => ({ version, ...record }));
    }

    async putVersion(id: string, branch: string, version: number, checkpoint: Uint8Array): Promise<void> {
        await this.#putVersion(id, branch, version, checkpoint, false);
    }

    async getVersionLog(id: string, version: number): Promise<Uint8Array | undefined> {
        return this.#readEntry(this.#versionPath(id, version), LOG_FILE);
    }

    async getBranches(id: string): Promise<KeptBranch[]> {
        let names: string[];
        try {
            names = await readdir(join(this.#path(id), BRANCHES_DIR));
        } catch (error) {
            if (isNotFound(error)) return [];
            throw error;
        }
        const branches: KeptBranch[] = [];
        for (const branch of names.filter((name) => FILE_SAFE_ID.test(name)).sort()) {
            const kept = await this.#branch(id, branch);
            if (kept) branches.push(kept);
        }
        return branches.sort((a, b) => Number(b.branch === MAIN_BRANCH) - Number(a.branch === MAIN_BRANCH));
    }

    async putBranch(id: string, branch: string, base: number): Promise<void> {
        const path = this.#branchPath(id, branch);
        if (!(await this.#versionRecords(id)).has(base)) {
            throw new Error(`document ${JSON.stringify(id)} keeps no version v${base}`);
        }
        // Staged aside and renamed into place, which refuses a branch kept already.
        const staged = `${path}.${randomUUID()}.partial`;
        try {
            await mkdir(staged);
            const record: Omit<KeptBranch, "branch"> = { base };
            await writeFile(join(staged, BRANCH_FILE), JSON.stringify(record));
            await rename(staged, path);
        } catch (error) {
            await rm(staged, { recursive: true, force: true });
            if (codeOf(error) === "ENOTEMPTY" || isAlreadyKept(error)) {
                throw new Error(`document ${JSON.stringify(id)} keeps branch ${branch} already`);
            }
            throw error;
        }
    }

    async deleteBranch(id: string, branch: string): Promise<boolean> {
        const path = this.#branchPath(id, branch);
        try {
            await stat(path);
        } catch (error) {
            if (isNotFound(error)) return false;
            throw error;
        }
        // Renamed out of the way first, so the branch is gone at once, whole.
        const gone = `${path}.${randomUUID()}.partial`;
        await rename(path, gone);
        await rm(gone, { recursive: true, force: true });
        return true;
    }

    async getDescription(id: string, at: At): Promise<PackageDescription | undefined> {
        const lineage = await this.#lineage(id, at);
        if (!lineage) return undefined;
        const metadata = await this.#readEntry(this.#versionPath(id, lineage.head), "");
        if (!metadata) return undefined;
        // The version's own envelope, written by the engine this server runs.
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
        const frontier =
            "branch" in at
                ? (baselineFrontier ?? ((await this.#hasLog(id, at.branch)) ? [] : undefined))
                : at.withLog
                  ? baselineFrontier
                  : undefined;
        return {
            docType: documentType,
            ...(sourceFormat !== undefined ? { sourceFormat } : {}),
            ...(sourceDelimiter !== undefined ? { sourceDelimiter } : {}),
            baselineVersion: Number(baselineVersion),
            ...(frontier !== undefined ? { baselineFrontier: frontier } : {}),
        };
    }

    async getPart(id: string, kinds: string, partId: string, at: At): Promise<Uint8Array | undefined> {
        const removed = (head: number) => this.#isRemoved(id, kinds, partId, head);
        return this.#readPart(id, `${kinds}/${partId}`, join(OPAQUE_PARTS_DIR, kinds, partId), at, removed);
    }

    async getBlob(id: string, key: string, at: At): Promise<Uint8Array | undefined> {
        return this.#readPart(id, `blobs/${key}`, join(BLOBS_DIR, key), at);
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

    async getLog(id: string, branch: string): Promise<Uint8Array | undefined> {
        try {
            return await readFile(join(this.#branchPath(id, branch), LOG_FILE));
        } catch (error) {
            if (!isNotFound(error)) throw error;
        }
        const lineage = await this.#lineage(id, { branch });
        return lineage && this.#readEntry(this.#versionPath(id, lineage.head), LOG_FILE);
    }

    async putLog(id: string, branch: string, log: Uint8Array): Promise<void> {
        await this.#replace(this.#branchPath(id, branch), LOG_FILE, log);
    }

    async putCut(id: string, branch: string, version: number, checkpoint: Uint8Array, log: Uint8Array): Promise<void> {
        await this.#putVersion(id, branch, version, checkpoint, true);
        await this.putLog(id, branch, log);
    }

    async getOriginalIdMap(id: string, at: At): Promise<Uint8Array | undefined> {
        return this.#readRecord(id, ORIGINAL_ID_MAP_FILE, at);
    }

    async getModifiedPartIds(id: string, at: At): Promise<Uint8Array | undefined> {
        return this.#readRecord(id, MODIFIED_PART_IDS_FILE, at);
    }

    async getRemovedPartIds(id: string, at: At): Promise<Uint8Array | undefined> {
        return this.#readRecord(id, REMOVED_PART_IDS_FILE, at);
    }

    async getMerge(id: string, target: string, source: string): Promise<KeptMerge | undefined> {
        let kept: { versionVector: string; moved: boolean };
        try {
            kept = JSON.parse(await readFile(this.#mergePath(id, target, source), "utf8")) as typeof kept;
        } catch (error) {
            if (isNotFound(error)) return undefined;
            throw error;
        }
        return { versionVector: new Uint8Array(Buffer.from(kept.versionVector, "base64")), moved: kept.moved };
    }

    async putMerge(id: string, target: string, source: string, merge: KeptMerge): Promise<void> {
        const path = this.#mergePath(id, target, source);
        if (!(await this.#branch(id, target)))
            throw new Error(`document ${JSON.stringify(id)} keeps no branch ${target}`);
        await mkdir(dirname(path), { recursive: true });
        const kept = { versionVector: Buffer.from(merge.versionVector).toString("base64"), moved: merge.moved };
        await this.#replace(dirname(path), `${source}.json`, new TextEncoder().encode(JSON.stringify(kept)));
    }

    async delete(id: string): Promise<boolean> {
        const path = this.#path(id);
        try {
            await rm(path, { recursive: true });
            return true;
        } catch (error) {
            if (isNotFound(error)) return false;
            throw error;
        } finally {
            this.#records.delete(id);
        }
    }

    /**
     * Keep `checkpoint` as branch `branch`'s version `version`: its record first,
     * then its package, which makes it kept. A record with no package, which a
     * crash between can leave, is no version, and the next written there
     * replaces it.
     */
    async #putVersion(id: string, branch: string, version: number, checkpoint: Uint8Array, cut: boolean) {
        const lineage = await this.#lineage(id, { branch });
        if (!lineage) throw new Error(`document ${JSON.stringify(id)} keeps no branch ${branch}`);
        const kept = this.#versionPath(id, version);
        const refused = () => new Error(`document ${JSON.stringify(id)} keeps version v${version} already`);
        if (await exists(kept)) throw refused();
        const record: VersionRecord = { branch, parent: lineage.head, ...(cut ? { cut: true as const } : {}) };
        await this.#replace(dirname(kept), `v${version}.json`, new TextEncoder().encode(JSON.stringify(record)));
        // Written aside, then linked into place, which refuses a version kept
        // meanwhile: once there, it is the branch's head, whole.
        const staged = `${kept}.${randomUUID()}.partial`;
        try {
            await writeFile(staged, checkpoint, { flag: "wx" });
            await link(staged, kept);
        } catch (error) {
            if (isAlreadyKept(error)) throw refused();
            throw error;
        } finally {
            await rm(staged, { force: true });
        }
    }

    /** Document `id`'s versions' records, by version, oldest first: each whose package is kept. */
    async #versionRecords(id: string): Promise<Map<number, VersionRecord>> {
        const directory = join(this.#path(id), VERSIONS_DIR);
        let names: string[];
        try {
            names = await readdir(directory);
        } catch (error) {
            if (isNotFound(error)) return new Map();
            throw error;
        }
        let known = this.#records.get(id);
        if (!known) this.#records.set(id, (known = new Map()));
        const versions = names
            .flatMap((name) => {
                const version = VERSION_FILE.exec(name)?.[1];
                return version === undefined ? [] : [Number(version)];
            })
            .sort((a, b) => a - b);
        const records = new Map<number, VersionRecord>();
        for (const version of versions) {
            let record = known.get(version);
            if (!record) {
                try {
                    record = JSON.parse(await readFile(join(directory, `v${version}.json`), "utf8")) as VersionRecord;
                } catch (error) {
                    if (isNotFound(error)) continue;
                    throw error;
                }
                known.set(version, record);
            }
            records.set(version, record);
        }
        return records;
    }

    /** Branch `branch` of document `id`, or `undefined` when it has none. */
    async #branch(id: string, branch: string): Promise<KeptBranch | undefined> {
        try {
            const { base } = JSON.parse(
                await readFile(join(this.#branchPath(id, branch), BRANCH_FILE), "utf8"),
            ) as Omit<KeptBranch, "branch">;
            return { branch, ...(base !== undefined ? { base } : {}) };
        } catch (error) {
            if (isNotFound(error)) return undefined;
            throw error;
        }
    }

    /** What a read at `at` reads, or `undefined` when nothing is there. */
    async #lineage(id: string, at: At): Promise<Lineage | undefined> {
        const records = await this.#versionRecords(id);
        let head: number | undefined;
        if ("branch" in at) {
            const branch = await this.#branch(id, at.branch);
            if (!branch) return undefined;
            for (const [version, record] of records) if (record.branch === at.branch) head = version;
            head ??= branch.base;
        } else if (records.has(at.version)) {
            head = at.version;
        }
        if (head === undefined) return undefined;
        const ancestry: number[] = [];
        for (let parent = records.get(head)?.parent; parent !== undefined; parent = records.get(parent)?.parent) {
            ancestry.push(parent);
        }
        return { head, ancestry };
    }

    /**
     * Document `id`'s part or blob at `route`, deflated, as read at `at`: the
     * head's; unless `removed` says the head has removed it, the one kept at
     * `kept`, for the document; else the newest in its ancestry that has it. An
     * opaque part never changes, so what is kept for the document can't differ
     * from a version's, and reading it never shows another branch's.
     */
    async #readPart(
        id: string,
        route: string,
        kept: string,
        at: At,
        removed?: (head: number) => Promise<boolean>,
    ): Promise<Uint8Array | undefined> {
        const lineage = await this.#lineage(id, at);
        if (!lineage) return undefined;
        const entry = await this.#readEntry(this.#versionPath(id, lineage.head), route, true);
        if (entry) return entry;
        if (await removed?.(lineage.head)) return undefined;
        const keptForDocument = await this.#readKept(id, kept);
        if (keptForDocument) return keptForDocument;
        for (const version of lineage.ancestry) {
            const earlier = await this.#readEntry(this.#versionPath(id, version), route, true);
            if (earlier) return earlier;
        }
        return undefined;
    }

    /** Whether version `head` records this part as removed. */
    async #isRemoved(id: string, kinds: string, partId: string, head: number): Promise<boolean> {
        const record = await this.#readEntry(this.#versionPath(id, head), REMOVED_PART_IDS_FILE);
        if (!record) return false;
        const removed = JSON.parse(new TextDecoder().decode(record)) as Record<string, string[]>;
        return Object.entries(removed).some(
            ([kind, ids]) => pluralKebab(snakeCase(kind)) === kinds && ids.includes(partId),
        );
    }

    /** The entry `name` of the version read at `at`. */
    async #readRecord(id: string, name: string, at: At): Promise<Uint8Array | undefined> {
        const lineage = await this.#lineage(id, at);
        return lineage && this.#readEntry(this.#versionPath(id, lineage.head), name);
    }

    /** The file kept at `route` for document `id`, or `undefined` when there is none. */
    async #readKept(id: string, route: string): Promise<Uint8Array | undefined> {
        try {
            return await readFile(join(this.#path(id), route));
        } catch (error) {
            if (isNotFound(error)) return undefined;
            throw error;
        }
    }

    /**
     * The entry of the package at `path` at `route` (see {@link routeOf}), or
     * `undefined` when it has none. Reads the zip's central directory and that
     * one entry: inflated, or — `deflated` — as the zip keeps it, deflated, so
     * nothing is compressed again; one kept stored is deflated now.
     */
    async #readEntry(path: string, route: string, deflated = false): Promise<Uint8Array | undefined> {
        let zip;
        try {
            zip = await openPromise(path, { lazyEntries: true, autoClose: false });
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

    /** Keep `bytes` as the file `name` in `directory`, in place of any kept. */
    async #replace(directory: string, name: string, bytes: Uint8Array): Promise<void> {
        const path = join(directory, name);
        // Written aside and renamed over the one kept, so a reader meets the old
        // file or the new, never part of one. Neither creates the directory, so
        // a document or branch forgotten meanwhile stays forgotten.
        const staged = `${path}.${randomUUID()}.partial`;
        try {
            await writeFile(staged, bytes, { flag: "wx" });
            await rename(staged, path);
        } catch (error) {
            await rm(staged, { force: true });
            if (isNotFound(error)) throw new Error(`nothing is kept at ${JSON.stringify(directory)}`);
            throw error;
        }
    }

    async #hasLog(id: string, branch: string): Promise<boolean> {
        return exists(join(this.#branchPath(id, branch), LOG_FILE));
    }

    #versionPath(id: string, version: number): string {
        return join(this.#path(id), VERSIONS_DIR, `v${version}.udoc`);
    }

    #branchPath(id: string, branch: string): string {
        if (!FILE_SAFE_ID.test(branch)) throw new Error(`not a branch id: ${JSON.stringify(branch)}`);
        return join(this.#path(id), BRANCHES_DIR, branch);
    }

    #mergePath(id: string, target: string, source: string): string {
        if (!FILE_SAFE_ID.test(source)) throw new Error(`not a branch id: ${JSON.stringify(source)}`);
        return join(this.#branchPath(id, target), MERGES_DIR, `${source}.json`);
    }

    #path(id: string): string {
        if (!FILE_SAFE_ID.test(id)) throw new Error(`not a document id: ${JSON.stringify(id)}`);
        return join(this.#directory, id);
    }
}

/**
 * The route a package entry is served at, relative to the package: `""` for
 * `metadata.json`, `<kinds>/<partId>` for a part, `blobs/<key>` for a blob,
 * the entry's own name for the edit log and the three records a session pairs with
 * the original, and `undefined` for anything not served.
 */
function routeOf(entry: string): string | undefined {
    if (entry === "metadata.json") return "";
    if (
        entry === LOG_FILE ||
        entry === ORIGINAL_ID_MAP_FILE ||
        entry === MODIFIED_PART_IDS_FILE ||
        entry === REMOVED_PART_IDS_FILE
    ) {
        return entry;
    }
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
 * A kind's entry name from the kind as the engine stores it, `PageContents` to
 * `page_contents`: the rule the engine applies to name a package's entries.
 */
function snakeCase(kind: string): string {
    return kind
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
        .toLowerCase();
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

async function exists(path: string): Promise<boolean> {
    try {
        await stat(path);
        return true;
    } catch (error) {
        if (isNotFound(error)) return false;
        throw error;
    }
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
