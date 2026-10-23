// What every route answers with: a reply, or a failure — its status and a code
// to branch on — and how either reaches the client: written as a response, or,
// for an upgrade the server won't take, written on its socket.

import { STATUS_CODES } from "node:http";
import type { IncomingMessage, OutgoingHttpHeaders, ServerResponse } from "node:http";
import type { Duplex } from "node:stream";

import { UDocError } from "@docmentis/udoc-node";
import type { UDocErrorCode } from "@docmentis/udoc-node";

/**
 * A request answered with a failure: its status, and a code to branch on —
 * the engine's (docs/design/errors.md), or one only HTTP knows:
 * `methodNotAllowed`, `payloadTooLarge`, `upgradeRequired`,
 * `incorrectPassword`, `cannotImportPackage`.
 */
export class HttpFailure extends Error {
    readonly status: number;
    readonly code: string;

    constructor(status: number, code: string, message: string, options?: ErrorOptions) {
        super(message, options);
        this.status = status;
        this.code = code;
    }
}

/** What a route answers: its status, its headers, and its body. */
export interface Reply {
    status: number;
    headers: OutgoingHttpHeaders;
    body: Uint8Array;
}

/** A WebSocket upgrade: its request, its socket, and what was read past the request's head. */
export interface Upgrade {
    request: IncomingMessage;
    socket: Duplex;
    head: Buffer;
}

/** `value` as JSON, written by `replacer` when it is given. */
export function json(status: number, value: unknown, replacer?: (key: string, value: unknown) => unknown): Reply {
    return {
        status,
        headers: { "content-type": "application/json; charset=utf-8" },
        body: Buffer.from(JSON.stringify(value, replacer)),
    };
}

/** `body`, of media type `type`, as a 200 — with `headers` beside. */
export function bytes(body: Uint8Array, type: string, headers: OutgoingHttpHeaders = {}): Reply {
    return { status: 200, headers: { "content-type": type, ...headers }, body };
}

/** A 204: done, and nothing to send. */
export function noContent(): Reply {
    return { status: 204, headers: {}, body: new Uint8Array() };
}

/** Write `reply` as `response`. */
export function writeReply(response: ServerResponse, { status, headers, body }: Reply): void {
    // A 204 has no body, so it has no length either.
    if (status === 204) {
        response.writeHead(status, headers).end();
        return;
    }
    response.writeHead(status, { ...headers, "content-length": body.byteLength });
    response.end(body);
}

/** `failure` as the JSON every failure answers: `{ error, message }`, `error` its code. */
export function failureReply(failure: HttpFailure): Reply {
    return json(failure.status, { error: failure.code, message: failure.message });
}

/** Answer an upgrade the server won't take as a request would be answered, and hang up. */
export function refuseUpgrade(socket: Duplex, failure: HttpFailure): void {
    const { body } = failureReply(failure);
    socket.write(
        `HTTP/1.1 ${failure.status} ${STATUS_CODES[failure.status] ?? ""}\r\n` +
            "content-type: application/json; charset=utf-8\r\n" +
            `content-length: ${body.byteLength}\r\n` +
            "connection: close\r\n\r\n",
    );
    socket.end(body);
}

export function notFound(message = "no such resource"): HttpFailure {
    return new HttpFailure(404, "notFound", message);
}

/** The status each engine code answers with. A license refusal is `503`: this
 *  server can't open documents, whatever is asked of it. */
const STATUS: Record<UDocErrorCode, number> = {
    invalidRequest: 400,
    notEntitled: 403,
    notFound: 404,
    unsupported: 422,
    malformed: 422,
    passwordRequired: 422,
    internal: 500,
    crashed: 500,
    io: 502,
    invalidLicense: 503,
    permitRefused: 503,
    cannotVerify: 503,
};

/** The codes a license refuses under: starting a session, or a call it isn't entitled to. */
export const LICENSE_CODES: ReadonlySet<string> = new Set<UDocErrorCode>([
    "invalidLicense",
    "permitRefused",
    "cannotVerify",
    "notEntitled",
]);

/** `error`, whatever a route threw, as the failure it answers with: its own, or the engine's code at its status. */
export function failureOf(error: unknown): HttpFailure {
    if (error instanceof HttpFailure) return error;
    const failure = UDocError.from(error);
    return new HttpFailure(STATUS[failure.code], failure.code, failure.message, { cause: failure });
}

export function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
