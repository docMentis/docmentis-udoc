/**
 * What a client asks of the udoc server it opened a document from — a copy
 * the server saves, and a checkpoint (docs/design/core-save.md). Each is a
 * resource of the document beside its package, `…/documents/{id}/package`, so
 * each is resolved against that URL.
 */

import type { FileFormat, SaveStrategy } from "@docmentis/udoc-wasm";
import { UDocError } from "@docmentis/udoc-wasm/error";
import type { UDocErrorCode } from "@docmentis/udoc-wasm/error";

/** A server's answer to a checkpoint: the version of the baseline it wrote. */
export interface RemoteCheckpointResponse {
    version: number;
}

/**
 * Whether `packageUrl` is one checkpoint's package,
 * `…/documents/{id}/checkpoints/{version}/package`, not the document's: the
 * document as it was at that version, for this client to read and never change.
 */
export function isCheckpointPackage(packageUrl: string): boolean {
    return /\/checkpoints\/\d+\/package\/?$/.test(new URL(packageUrl).pathname);
}

/**
 * Ask the server keeping the document whose package is at `packageUrl` for a
 * copy of it, saved as `format` by `strategy`, else by the engine's for
 * `format`, a CSV split by `delimiter`; resolves with its bytes.
 */
export async function remoteCopy(
    packageUrl: string,
    format: FileFormat,
    { strategy, delimiter }: { strategy?: SaveStrategy | undefined; delimiter?: string | undefined } = {},
): Promise<Uint8Array> {
    const url = new URL(`file.${format}`, packageUrl);
    if (strategy !== undefined) url.searchParams.set("strategy", strategy);
    if (delimiter !== undefined) url.searchParams.set("delimiter", delimiter);
    const response = await fetch(url);
    if (!response.ok) throw await refusalOf(response);
    return new Uint8Array(await response.arrayBuffer());
}

/** Ask the server keeping the document whose package is at `packageUrl` to checkpoint it. */
export async function remoteCheckpoint(packageUrl: string): Promise<RemoteCheckpointResponse> {
    const response = await fetch(new URL("checkpoints", packageUrl), { method: "POST" });
    if (!response.ok) throw await refusalOf(response);
    return (await response.json()) as RemoteCheckpointResponse;
}

/**
 * What a server's failed answer says: its `{ error, message }` body, the code
 * its `error` — or, for a body that isn't one, its status, as `io`. The codes
 * udoc-server keeps of its own answer requests this side never makes, so what
 * comes back is one of the engine's.
 */
async function refusalOf(response: Response): Promise<UDocError> {
    const body = (await response.json().catch(() => undefined)) as { error?: unknown; message?: unknown } | undefined;
    const message = typeof body?.message === "string" ? `: ${body.message}` : "";
    const code = typeof body?.error === "string" ? (body.error as UDocErrorCode) : "io";
    return new UDocError(code, `HTTP ${response.status}${message}`);
}
