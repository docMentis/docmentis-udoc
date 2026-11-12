// The udoc server: keeps documents, and serves them over HTTP through sessions
// opened over what it keeps.
//
// A document is imported once — the upload opened, its ids minted — and kept in
// a `DocumentStore` as its original, the upload as it arrived, and its
// checkpoints, the udoc packages a later session reopens the latest of: `v0`
// from the import, then one more each time it is checkpointed. What is kept is
// the document; a session is a cache over it, one per document on a thread of
// its own (see `@docmentis/udoc-node`): opened when a request needs it, kept
// while requests keep coming, closed once idle or once too many are open, and
// reopened from the store the next time. That is what lets a document outlive
// the process, and what bounds how much the process holds. Streaming a
// document's parts reads the store alone. Co-editing it is a collaboration: the
// clients editing it together over its pooled session, held open while any is
// connected, and every edit kept in the store as the document's edit log.
//
// Each piece is a file of its own: the store (`store.ts`), the session pool
// over it (`session-pool.ts`), the collaborations over the pool
// (`collaboration.ts`), and the routes — each family a table of its own, the
// document routes (`document.ts`) and the package routes beneath them
// (`package.ts`), matched by `route.ts`. Here they are built over one store.
//
// The server answers requests and WebSocket upgrades; it doesn't listen. Its
// host hands it each one — `main.ts` from an HTTP server of its own, an
// embedder from theirs — and answers itself any whose path no route has.

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Duplex } from "node:stream";

import { UDocError } from "@docmentis/udoc-node";
import type { UDocNode, UDocSession } from "@docmentis/udoc-node";

import { Collaborations } from "./collaboration.ts";
import { documentRoutes, noDocument } from "./document.ts";
import { HttpFailure, LICENSE_CODES, notFound } from "./http.ts";
import { logCutter } from "./log-cut.ts";
import { readPackage } from "./package.ts";
import { answerRequest, answerUpgrade, has, targetOf } from "./route.ts";
import type { Route } from "./route.ts";
import { SessionPool } from "./session-pool.ts";
import type { DocumentStore } from "./store.ts";

export interface UDocServerOptions {
    /** Opens each document. The embedder builds it, so the license — and
     *  whether usage is metered — is theirs to decide. */
    udoc: Pick<UDocNode, "open" | "openRemote">;
    /** Where each document is kept between sessions. */
    store: DocumentStore;
    /** The largest document accepted, in bytes. Defaults to 256 MiB. */
    maxUploadBytes?: number;
    /** How long a session stays open with no request for it, in milliseconds.
     *  Defaults to 5 minutes. */
    sessionTimeoutMs?: number;
    /** The session pool's size: how many sessions stay open once their
     *  requests finish. Past it, the least recently used idle ones close.
     *  Defaults to 32. */
    sessionPool?: number;
    /** The smallest saving worth cutting a document's edit log for, in bytes,
     *  when its idle session closes: the cut drops the history before a new
     *  checkpoint, so later opens hold less. Defaults to 128 KiB. */
    cutMinSavedBytes?: number;
    /** The path the routes sit beneath: `"/udoc"` serves `/udoc/documents/…`.
     *  Defaults to `""`, the root. */
    basePath?: string;
}

export interface UDocServer {
    /**
     * Answer `request` if a route has its path, for any method, and return
     * true; return false, leaving it untouched, if none does.
     */
    handleRequest(request: IncomingMessage, response: ServerResponse): boolean;
    /**
     * Take the WebSocket upgrade of `request` if a route takes upgrades at its
     * path, for any method, and return true; return false, leaving `socket`
     * untouched, if none does.
     */
    handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): boolean;
    /**
     * End every collaboration once its edits are kept, and close every open
     * session. What is kept stays kept. The host's HTTP server is the host's
     * to close.
     */
    close(): Promise<void>;
}

const DEFAULT_MAX_UPLOAD_BYTES = 256 * 1024 * 1024;
const DEFAULT_SESSION_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_SESSION_POOL = 32;
const DEFAULT_CUT_MIN_SAVED_BYTES = 128 * 1024;

/**
 * The base a session this server opens over its store fetches its package
 * from. It names no host: every URL under it is answered in-process, from the
 * store, by the same code that answers the package routes.
 */
const KEPT_ORIGIN = "udoc-server://kept";

/** Build the server over `options.store`: its routes are the document routes (see `documentRoutes`), beneath `options.basePath`. */
export function createUDocServer(options: UDocServerOptions): UDocServer {
    const { udoc, store, basePath = "" } = options;
    const maxUploadBytes = options.maxUploadBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
    const sessions = new SessionPool(
        (id) => reopen(udoc, store, id),
        options.sessionTimeoutMs ?? DEFAULT_SESSION_TIMEOUT_MS,
        options.sessionPool ?? DEFAULT_SESSION_POOL,
        logCutter(store, options.cutMinSavedBytes ?? DEFAULT_CUT_MIN_SAVED_BYTES),
    );
    const collaborations = new Collaborations(store, sessions, maxUploadBytes);
    /** Every route the server answers: each family's, in turn. */
    const routes: Route[] = [
        ...documentRoutes({
            udoc,
            store,
            sessions,
            collaborations,
            maxUploadBytes,
            openCheckpoint: (id, version) => reopen(udoc, store, id, version),
        }),
    ];
    const upgradeRoutes = routes.filter((route) => route.upgrade !== undefined);

    return {
        handleRequest(request, response) {
            const target = targetOf(request, basePath);
            if (!target || !has(routes, target.path)) return false;
            void answerRequest(routes, target, request, response);
            return true;
        },
        handleUpgrade(request, socket, head) {
            const target = targetOf(request, basePath);
            if (!target || !has(upgradeRoutes, target.path)) return false;
            answerUpgrade(routes, target, { request, socket, head }).catch(() => socket.destroy());
            return true;
        },
        async close() {
            await collaborations.close();
            await sessions.closeAll();
        },
    };
}

/**
 * Open document `id` again from what is kept of it in `store`: its package,
 * over the store — the latest checkpoint's parts and blobs read as the
 * document needs them, the way a browser streams it, and the edit log applied
 * by the open. With `version`, checkpoint `version` as it was, with no log. Either
 * way the original is kept behind it, for a save that writes over it to read.
 */
async function reopen(
    udoc: Pick<UDocNode, "openRemote">,
    store: DocumentStore,
    id: string,
    version?: number,
): Promise<UDocSession> {
    try {
        if (!(await store.getDescription(id, version))) {
            throw version === undefined ? noDocument(id) : notFound(`document ${id} has no v${version}`);
        }
        return await udoc.openRemote(`${KEPT_ORIGIN}${keptPackage(id, version)}`, {
            fetch: (url) => kept(store, id, url, version),
            withOriginal: true,
        });
    } catch (error) {
        if (error instanceof HttpFailure) throw error;
        const failure = UDocError.from(error);
        if (LICENSE_CODES.has(failure.code)) throw failure;
        // It opened once to be kept, so a failure now is this server's,
        // not the caller's: it answers as one.
        throw new UDocError("internal", failure.message, undefined, { cause: failure });
    }
}

/** The path of document `id`'s package, or checkpoint `version`'s. */
function keptPackage(id: string, version?: number): string {
    return `/documents/${id}/${version === undefined ? "package" : `checkpoints/${version}/package`}`;
}

/**
 * What a session this server opened over document `id`'s store asks for at `url`,
 * read from the store. Beyond the package's routes, what only this session reads,
 * to write over the original, as the engine's `with_original` loader asks for it:
 * the original, and the three records that pair with it, empty for none.
 */
async function kept(store: DocumentStore, id: string, url: string, version?: number): Promise<Uint8Array> {
    const base = keptPackage(id, version);
    const { pathname, searchParams } = new URL(url);
    if (pathname !== base && !pathname.startsWith(`${base}/`)) throw notFound();
    const route = pathname.slice(base.length);
    if (route === "/original") {
        const original = await store.getOriginal(id);
        if (!original) throw noDocument(id);
        return original.bytes;
    }
    if (route === "/original-id-map") return (await store.getOriginalIdMap(id, version)) ?? new Uint8Array();
    if (route === "/modified-part-ids") return (await store.getModifiedPartIds(id, version)) ?? new Uint8Array();
    if (route === "/removed-part-ids") return (await store.getRemovedPartIds(id, version)) ?? new Uint8Array();
    return (await readPackage(store, id, route, searchParams, version)).body;
}
