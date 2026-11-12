// The document routes: a document imported once and kept, then served from
// what is kept — its original and its packages read from the store, its pages
// and its copies from a session over one of its branches — edited together on
// a branch, versioned, branched and merged (docs/design/node-branches.md), and
// forgotten. `main`'s routes are the document's own; any branch's, beneath
// `branches/:branch`.

import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

import { UDocError, isFileFormat } from "@docmentis/udoc-node";
import type { FileFormat, PageExportFormat, SaveStrategy, UDocNode, UDocSession } from "@docmentis/udoc-node";

import { BRANCH_ID, MINTED_ID, branchKey } from "./branch.ts";
import type { VersionNumbers } from "./branch.ts";
import type { Collaborations } from "./collaboration.ts";
import { HttpFailure, bytes, failureOf, json, noContent, notFound } from "./http.ts";
import type { Reply, Upgrade } from "./http.ts";
import { readPackage } from "./package.ts";
import { route } from "./route.ts";
import type { Params, Route, RouteOptions, RouteRequest } from "./route.ts";
import type { SessionPool } from "./session-pool.ts";
import { MAIN_BRANCH } from "./store.ts";
import type { At, DocumentStore, KeptDocument, KeptVersion } from "./store.ts";

export interface DocumentRoutesOptions {
    /** Opens each upload. */
    udoc: Pick<UDocNode, "open">;
    /** Where each document is kept. */
    store: DocumentStore;
    /** The sessions open over what is kept, one per branch, by its key. */
    sessions: SessionPool;
    /** The clients editing each branch together. */
    collaborations: Collaborations;
    /** The largest document accepted, in bytes. */
    maxUploadBytes: number;
    /** The version numbers each document's checkpoints and cuts take. */
    numbers: VersionNumbers;
    /** Opens a session of its own over what is kept of a document at `at`, apart from the pooled ones. */
    openKept: (id: string, at: At) => Promise<UDocSession>;
}

/** The ids this server mints for a document. Nothing else names one. */
const DOCUMENT_ID = new RegExp(`^${MINTED_ID.source}$`);

/** The header an upload's password is sent in. */
const PASSWORD_HEADER = "X-UDoc-Password";

/** The strategies a copy saves by (docs/design/core-save.md). */
const SAVE_STRATEGIES: readonly SaveStrategy[] = ["rewrite", "delta", "incremental"];

/** A version's number in a path. */
const VERSION = /\d+/;

/**
 * The document routes. A failure answers `{ error, message }`, where `error`
 * is a code: a license refusal's own type (`invalidLicense`, `permitRefused`,
 * `cannotVerify`), `unreadableDocument`, `passwordRequired`,
 * `incorrectPassword`, `cannotImportPackage`, `pageNotFound`, `cannotSave`,
 * `upgradeRequired`, `notFound`, `badRequest`, `methodNotAllowed`,
 * `payloadTooLarge`, `cannotMergeAgain`, `serverClosing` or `internal`.
 */
export function documentRoutes({
    udoc,
    store,
    sessions,
    collaborations,
    maxUploadBytes,
    numbers,
    openKept,
}: DocumentRoutesOptions): Route[] {
    /** The merge into each branch under way, which another into it waits for. */
    const merging = new Map<string, Promise<void>>();

    return [
        route("POST", "/documents", importDocument),
        route("DELETE", "/documents/:id", deleteDocument),
        route("GET", "/documents/:id/original", original),
        route("GET", "/documents/:id/branches", branchList),
        route("POST", "/documents/:id/versions/:version/branches", createBranch, { params: { version: VERSION } }),
        route("DELETE", "/documents/:id/branches/:branch", deleteBranch, { params: { branch: BRANCH_ID } }),
        route("POST", "/documents/:id/branches/:branch/merge", merge, { params: { branch: BRANCH_ID } }),
        ...onBranches("GET", "/layout/page-count", pageCount),
        ...onBranches("GET", "/layout/pages.pdf", pages),
        ...onBranches("GET", "/layout/pages/:index.:format", page, { params: { index: /\d+/, format: /png|svg/ } }),
        ...onBranches("GET", "/file.:format", file, { params: { format: /\w+/ } }),
        ...onBranches("GET", "/package", packageResource),
        ...onBranches("GET", "/package/*route", packageResource),
        ...onBranches("GET", "/collaboration", upgradeRequired, { upgrade: collaboration }),
        route("POST", "/documents/:id/branches/:branch/versions", checkpoint, { params: { branch: BRANCH_ID } }),
        route("POST", "/documents/:id/checkpoints", checkpoint),
        route("GET", "/documents/:id/versions", versionList),
        route("GET", "/documents/:id/checkpoints", mainVersionList),
        ...onVersions("/package", versionResource),
        ...onVersions("/package/*route", versionResource),
        ...onVersions("/file.:format", versionFile, { params: { format: /\w+/ } }),
    ];

    /** A route of a branch's: `main`'s beneath the document, and every branch's beneath `branches/:branch`. */
    function onBranches<H>(method: string, path: string, handle: H, options: RouteOptions = {}): Route<H>[] {
        const params = { ...options.params, branch: BRANCH_ID };
        return [
            route(method, `/documents/:id${path}`, handle, options),
            route(method, `/documents/:id/branches/:branch${path}`, handle, { ...options, params }),
        ];
    }

    /** A route of one version's, beneath `versions/:version`, and beneath `checkpoints/:version`, as it was named before. */
    function onVersions<H>(path: string, handle: H, options: RouteOptions = {}): Route<H>[] {
        const params = { ...options.params, version: VERSION };
        return ["versions", "checkpoints"].map((under) =>
            route("GET", `/documents/:id/${under}/:version${path}`, handle, { ...options, params }),
        );
    }

    /**
     * The body is a document's bytes: import it and keep it, with its branch
     * `main` and its version `v0`; `201 { id }`. `?format=` (`pdf`, `pptx`, …)
     * is for bytes detection gets wrong; absent, the format is detected.
     * `?delimiter=` is the character a CSV's fields are split by; absent, the
     * comma, semicolon, tab or vertical bar that splits the first records
     * alike, else the one that splits the first into the most fields. A udoc
     * package is refused: it is a document already imported, not one to
     * import. A PDF encrypted with a user password opens with the one sent in
     * `X-UDoc-Password`, percent-encoded (`encodeURIComponent`), its user or its
     * owner password. It is asked for here alone: the package the document is
     * kept as reopens without it, and the password itself is not kept.
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

    /** Close every branch of the document and forget it; `204`. */
    async function deleteDocument({ params }: RouteRequest): Promise<Reply> {
        const id = documentId(params);
        const branches = await store.getBranches(id);
        // Forgotten before its sessions close, so no request in between
        // can reopen what is being deleted.
        const kept = await store.delete(id);
        for (const { branch } of branches) {
            collaborations.end(id, branch, "the document was deleted");
            await sessions.close(branchKey(id, branch));
        }
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

    /** The document's branches, `main` first: `{ branches: [{ branch, base? }] }`, `base` the version each starts from. */
    async function branchList({ params }: RouteRequest): Promise<Reply> {
        const id = documentId(params);
        const branches = await store.getBranches(id);
        if (branches.length === 0) throw noDocument(id);
        return json(200, { branches });
    }

    /**
     * Start a branch at version `version`, of whichever branch: `201 { branch }`,
     * its id, which the server mints. Nothing is saved or opened: it is the
     * document as it stood there, its edits to come kept in a log of its own.
     */
    async function createBranch({ params }: RouteRequest): Promise<Reply> {
        const id = documentId(params);
        const version = Number(params.version);
        await versionOf(id, version);
        const branch = randomUUID();
        await store.putBranch(id, branch, version);
        return json(201, { branch });
    }

    /**
     * Forget a branch — its log, and what it was merged from — ending its
     * collaboration and closing its session; `204`. Its versions stay: another
     * branch may start from one. `main` is the document's, deleted with it.
     */
    async function deleteBranch({ params }: RouteRequest): Promise<Reply> {
        const id = documentId(params);
        const branch = params.branch!;
        if (branch === MAIN_BRANCH) {
            throw new HttpFailure(400, "invalidRequest", "main is deleted with its document");
        }
        const kept = await store.deleteBranch(id, branch);
        collaborations.end(id, branch, "the branch was deleted");
        await sessions.close(branchKey(id, branch));
        if (!kept) throw await noBranch(id, branch);
        return noContent();
    }

    /** `{ pageCount }`. Its own resource because it can be costly: the first ask composes the whole branch. */
    async function pageCount({ params }: RouteRequest): Promise<Reply> {
        const pageCount = await sessions.use(keyOf(params), (session) => session.pageCount());
        return json(200, { pageCount });
    }

    /**
     * Composed page `index`, counting from 0, as a PNG or an SVG, as its
     * extension names. A PNG's `?scale=` is output pixels per point, `1` if
     * absent; an SVG, sized in points, takes none.
     */
    async function page({ params, query }: RouteRequest): Promise<Reply> {
        const key = keyOf(params);
        const index = Number(params.index);
        const svg = params.format === "svg";
        if (svg && query.has("scale")) throw new HttpFailure(400, "invalidRequest", "scale is for a PNG");
        const format: PageExportFormat = svg ? "svg" : { png: { scale: scaleOf(query.get("scale")) } };
        const exported = await sessions.use(key, (session) =>
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
     * The branch exported as a PDF of its laid-out pages: a rendering, fixed and
     * one-way, apart from the copy `file.pdf` saves of a PDF. A spreadsheet,
     * whose sheets have no print pages yet, `422 unsupported`.
     */
    async function pages({ params }: RouteRequest): Promise<Reply> {
        const pdf = await sessions.use(keyOf(params), (session) => session.exportToBytes("pdf"));
        return bytes(pdf, "application/pdf");
    }

    /**
     * A copy of the branch, saved faithfully in its session: as `format`, one
     * of its doc type's own (`pdf`, `pptx`, …), by `?strategy=` — `rewrite`,
     * `delta` or `incremental` (docs/design/core-save.md), if absent the
     * engine's for `format` — or as a udoc package for `udoc`, which takes no
     * strategy. A CSV's fields are split by `?delimiter=`, or the one it was
     * imported with, else a comma. Nothing of it is kept.
     */
    async function file({ params, query }: RouteRequest): Promise<Reply> {
        const save = copyAsked(params, query);
        return bytes(await sessions.use(keyOf(params), save), "application/octet-stream");
    }

    /**
     * A copy of one version, as {@link file} saves one of a branch: saved in a
     * session of its own, closed after, since a pooled one is a branch's,
     * current one. It spends a permit like any open.
     */
    async function versionFile({ params, query }: RouteRequest): Promise<Reply> {
        const save = copyAsked(params, query);
        const session = await openKept(documentId(params), { version: Number(params.version) });
        try {
            return bytes(await save(session), "application/octet-stream");
        } finally {
            await session.close();
        }
    }

    /**
     * Checkpoint the branch: its session saved as the document's next version,
     * kept as the branch's head, the one before its parent; `201 { version }`.
     * Versions are numbered across the document, one at a time.
     */
    async function checkpoint({ params }: RouteRequest): Promise<Reply> {
        const id = documentId(params);
        const branch = params.branch ?? MAIN_BRANCH;
        const version = await sessions.use(branchKey(id, branch), (session) =>
            numbers.next(id, async (version) => {
                await store.putVersion(id, branch, version, await session.saveToPackage({ version }));
                return version;
            }),
        );
        return json(201, { version });
    }

    /** The document's versions, oldest first: `{ versions: [{ version, branch, parent? }] }`. A cut uses up a number, so a branch's have gaps. */
    async function versionList({ params }: RouteRequest): Promise<Reply> {
        const id = documentId(params);
        const versions = await store.getVersions(id);
        if (versions.length === 0) throw noDocument(id);
        return json(200, { versions: versions.map(({ version, branch, parent }) => ({ version, branch, parent })) });
    }

    /** `main`'s versions, oldest first, `{ versions }`, as the document's checkpoints were listed before it had branches. */
    async function mainVersionList({ params }: RouteRequest): Promise<Reply> {
        const id = documentId(params);
        const versions = await store.getVersions(id);
        if (versions.length === 0) throw noDocument(id);
        return json(200, {
            versions: versions.filter(({ branch }) => branch === MAIN_BRANCH).map(({ version }) => version),
        });
    }

    /**
     * One version's package: its description, or one resource under it (see
     * `package.ts`). What is kept of a version never changes, so unlike a
     * branch's package it waits for no log being cut.
     */
    function versionResource({ params, query }: RouteRequest): Promise<Reply> {
        return readPackage(store, documentId(params), params.route ?? "", query, { version: Number(params.version) });
    }

    /**
     * The branch's package: its head, with its edit log and the opaque parts
     * edits brought on top — its description, or one resource under it (see
     * `package.ts`).
     */
    async function packageResource({ params, query }: RouteRequest): Promise<Reply> {
        const id = documentId(params);
        const branch = params.branch ?? MAIN_BRANCH;
        // A log being cut is answered once it is, whole.
        await sessions.retired(branchKey(id, branch));
        return readPackage(store, id, params.route ?? "", query, { branch });
    }

    /** A collaboration is a WebSocket: without the upgrade, `426`. */
    async function upgradeRequired({ params }: RouteRequest): Promise<Reply> {
        documentId(params);
        throw new HttpFailure(426, "upgradeRequired", "a collaboration is a WebSocket; ask for the upgrade");
    }

    /**
     * Edit the branch together with every other client connected to it
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
        await collaborations.join(id, params.branch ?? MAIN_BRANCH, upgrade);
    }

    /**
     * Merge branch `?from=` into the branch, `204`: each edit of its the branch
     * lacks reaches it as an editor's does — its editors and its log — where its
     * ids place it, beside the branch's own edits. Through any cut of either's
     * log since the latest version both start from, the edits are moved onto
     * the branch's log first, under ids of their own; a branch they were moved
     * into from a source is merged from it no more, `409 cannotMergeAgain`. It
     * opens a session of its own over the source, spending a permit.
     */
    async function merge({ params, query }: RouteRequest): Promise<Reply> {
        const id = documentId(params);
        const target = params.branch!;
        const source = query.get("from");
        if (source === null || !new RegExp(`^(?:${BRANCH_ID.source})$`).test(source)) {
            throw new HttpFailure(400, "invalidRequest", "name the branch to merge from in ?from=");
        }
        if (source === target) throw new HttpFailure(400, "invalidRequest", "a branch is no merge of itself");
        // Into one branch, one at a time.
        const key = branchKey(id, target);
        const next = (merging.get(key) ?? Promise.resolve()).catch(() => {}).then(() => mergeInto(id, target, source));
        merging.set(key, next);
        const forget = () => {
            if (merging.get(key) === next) merging.delete(key);
        };
        next.then(forget, forget);
        await next;
        return noContent();
    }

    async function mergeInto(id: string, target: string, source: string): Promise<void> {
        const branches = await store.getBranches(id);
        for (const branch of [target, source]) {
            if (!branches.some((kept) => kept.branch === branch)) throw await noBranch(id, branch);
        }
        const previous = await store.getMerge(id, target, source);
        if (previous?.moved) {
            throw new HttpFailure(
                409,
                "cannotMergeAgain",
                `${source}'s edits were moved onto ${target}'s log when it was merged before, so merging it again would add them twice`,
            );
        }
        const lines = new Lines(await store.getVersions(id), branches);
        const base = lines.mergeBase(source, target);
        // The source's edits since the merge base, as edits: opened as an
        // editor that opened it there, then through each cut of its line since,
        // whose package keeps what it dropped, and its log.
        await collaborations.kept(id, source);
        const merged = await openKept(id, { version: base, withLog: true });
        try {
            const sourceCuts = lines.cutsSince(source, base);
            const sourceLog = await store.getLog(id, source);
            if (sourceCuts.length > 0) {
                await merged.catchUp([...(await logsOf(id, sourceCuts)), sourceLog!], sourceCuts.at(-1)!);
            } else if (sourceLog) {
                await merged.merge(sourceLog);
            }
            const versionVector = await merged.versionVector();
            let moved = false;
            await collaborations.merge(id, target, async (session) => {
                // Read again inside the hold: the target's session may have
                // idled out, and its log been cut, since.
                const versions = await store.getVersions(id);
                const targetCuts = new Lines(versions, branches).cutsSince(target, base);
                // A cut of the target's line since the merge base dropped the
                // history the source's edits depend on, so it refuses them; and
                // past a cut of the source's, its editors copied pages on that
                // cut, under the ids the target's copies have and with other
                // dependencies. Either way they move onto the target's log as it
                // is now, its pages copied there, as an editor's unsent edits do
                // when it comes back from behind a cut.
                moved = targetCuts.length > 0 || sourceCuts.length > 0;
                if (moved) {
                    const logs = [...(await logsOf(id, targetCuts)), await session.snapshot()];
                    await merged.catchUp(logs, versions.at(-1)!.version);
                }
                return merged.patchSince(await session.versionVector());
            });
            await store.putMerge(id, target, source, { versionVector, moved });
        } finally {
            await merged.close();
        }
    }

    /** The log each version of `versions` holds, in turn: what the cut there dropped. */
    async function logsOf(id: string, versions: number[]): Promise<Uint8Array[]> {
        return Promise.all(
            versions.map(async (version) => {
                const log = await store.getVersionLog(id, version);
                if (!log) throw new UDocError("internal", `document ${id}'s cut at v${version} holds no log`);
                return log;
            }),
        );
    }

    /** Version `version` of document `id`; refused, `404`, when it isn't kept. */
    async function versionOf(id: string, version: number): Promise<KeptVersion> {
        const versions = await store.getVersions(id);
        if (versions.length === 0) throw noDocument(id);
        const kept = versions.find((kept) => kept.version === version);
        if (!kept) throw notFound(`document ${id} has no v${version}`);
        return kept;
    }

    /** Why branch `branch` of document `id` can't be had: no such document, or no such branch. */
    async function noBranch(id: string, branch: string): Promise<HttpFailure> {
        if ((await store.getVersions(id)).length === 0) return noDocument(id);
        return notFound(`document ${id} has no branch ${branch}`);
    }

    /** The key of the branch a route's `params` name: its own, or `main`. */
    function keyOf(params: Params): string {
        return branchKey(documentId(params), params.branch ?? MAIN_BRANCH);
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

/** A document's lines of versions: each branch's head, and each version's ancestry back to `v0`. */
class Lines {
    readonly #versions: Map<number, KeptVersion>;
    readonly #heads = new Map<string, number>();

    constructor(versions: KeptVersion[], branches: { branch: string; base?: number }[]) {
        this.#versions = new Map(versions.map((version) => [version.version, version]));
        for (const { branch, base } of branches) if (base !== undefined) this.#heads.set(branch, base);
        for (const { version, branch } of versions) this.#heads.set(branch, version);
    }

    /** Branch `branch`'s head and its ancestry, newest first. */
    line(branch: string): number[] {
        const line: number[] = [];
        for (
            let version = this.#heads.get(branch);
            version !== undefined;
            version = this.#versions.get(version)?.parent
        ) {
            line.push(version);
        }
        return line;
    }

    /** The latest version both branches' lines hold: where both start from. */
    mergeBase(source: string, target: string): number {
        const inTarget = new Set(this.line(target));
        return this.line(source).find((version) => inTarget.has(version)) ?? 0;
    }

    /** The cuts in branch `branch`'s line after version `base`, oldest first. */
    cutsSince(branch: string, base: number): number[] {
        const line = this.line(branch);
        return line
            .slice(0, line.indexOf(base) < 0 ? line.length : line.indexOf(base))
            .filter((version) => this.#versions.get(version)?.cut)
            .reverse();
    }
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
