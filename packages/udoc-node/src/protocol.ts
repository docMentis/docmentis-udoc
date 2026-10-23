// Messages between a session and the worker thread that runs it.

import type { MessagePort } from "node:worker_threads";

import type {
    Entitlements,
    ExportFormat,
    FileFormat,
    GoogleFontFamily,
    PageExportFormat,
    SaveStrategy,
    SessionConfig,
    UDocError,
    UDocType,
    UrlFont,
} from "@docmentis/udoc-wasm";

/**
 * What a session's worker is started with.
 *
 * @internal Kept out of the published declarations: `WebAssembly` is declared
 * only by the DOM lib, which a Node project need not load.
 */
export interface WorkerInit {
    /** The compiled engine; see `compileEngine`. */
    module: WebAssembly.Module;
    /** Who is starting the session, and under what license. */
    config: SessionConfig;
    /** The host's own fonts, each a font file's bytes or offered by URL. */
    fonts: ReadonlyArray<Uint8Array | UrlFont>;
    /** The Google font families offered in place of the catalog `startSession`
     *  offers — `[]` with Google Fonts off. Absent keeps that catalog. */
    googleFontFamilies?: GoogleFontFamily[];
    /** Where css2 is asked for a Google family's faces. */
    googleFontEndpoint: string;
}

/**
 * What a remote document's parts come to its worker over. The engine asks for a
 * part the moment it needs one, and waits for it, and Node has no synchronous
 * HTTP: so the worker posts the part's URL on `port` and blocks until the
 * session's side has fetched it, posted a {@link FetchAnswer} back, and counted
 * it in `answered[0]`.
 */
export interface FetchChannel {
    port: MessagePort;
    answered: Int32Array;
}

/** The session side's answer to one URL posted on a {@link FetchChannel}. */
export type FetchAnswer = { ok: true; body: ArrayBuffer } | { ok: false; message: string };

/**
 * A font file a worker asks its session's side for, on the port its open
 * carried, from the cache every session of its `UDocNode` shares. `id` pairs it
 * with its {@link FontFileAnswer}: the worker asks for several at once.
 */
export interface FontFileRequest {
    id: number;
    url: string;
}

/** The session side's answer to a {@link FontFileRequest}: the file, or why it didn't come. */
export type FontFileAnswer = { id: number; ok: true; body: ArrayBuffer } | { id: number; ok: false; message: string };

/** A request to the worker. `id` pairs it with its {@link WorkerReply}. */
export type WorkerRequest =
    | { id: number; type: "open"; bytes: Uint8Array; format?: FileFormat; delimiter?: string; fontFiles: MessagePort }
    | { id: number; type: "openRemote"; url: string; fetches: FetchChannel; fontFiles: MessagePort }
    | { id: number; type: "authenticate"; password: string }
    | { id: number; type: "pageCount" }
    | { id: number; type: "saveToBytes"; format: FileFormat; strategy?: SaveStrategy; delimiter?: string }
    | { id: number; type: "saveToPackage"; version?: number }
    | { id: number; type: "exportToBytes"; format: ExportFormat }
    | { id: number; type: "exportPageToBytes"; index: number; format: PageExportFormat }
    | { id: number; type: "snapshot" }
    | { id: number; type: "versionVector" }
    | { id: number; type: "patchSince"; peer: Uint8Array }
    | { id: number; type: "merge"; patch: Uint8Array }
    | { id: number; type: "presence" }
    | { id: number; type: "mergePresence"; presence: Uint8Array };

/**
 * What the document opened as: its doc type, the format it came from, whether
 * it came as a package, and whether it needs a password before it can be read.
 */
export interface Opened {
    docType: UDocType;
    /** Absent for a package that recorded none. */
    sourceFormat?: FileFormat;
    fromPackage: boolean;
    needsPassword: boolean;
    /** What the license, or with none the permit, entitled the session to. */
    entitlements: Entitlements;
}

/** What each request's reply carries when it succeeds. */
export interface WorkerResult {
    open: Opened;
    openRemote: Opened;
    authenticate: boolean;
    pageCount: number;
    saveToBytes: Uint8Array;
    saveToPackage: Uint8Array;
    exportToBytes: Uint8Array;
    exportPageToBytes: Uint8Array;
    snapshot: Uint8Array;
    versionVector: Uint8Array;
    patchSince: Uint8Array;
    merge: undefined;
    presence: Uint8Array;
    mergePresence: undefined;
}

/**
 * A failure, as it crosses the thread boundary: an `Error` loses its class on
 * the way, so the {@link UDocError} the session side rebuilds travels as its
 * fields. A `crashed` one finishes the session — a wasm instance is not usable
 * after a trap, since a panic aborts mid-call and can leave a session borrowed
 * for good; after any other, the session is still good.
 */
export type WorkerFailure = Pick<UDocError, "code" | "message" | "detail">;

/** The worker's answer to a {@link WorkerRequest}. */
export type WorkerReply =
    | { id: number; ok: true; result: WorkerResult[keyof WorkerResult] }
    | { id: number; ok: false; failure: WorkerFailure };
