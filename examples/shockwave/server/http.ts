// The API's failures: a route throws a `Refusal`, and every failure, a route's,
// udoc-server's or Fastify's own, answers its status and `{ error, message }`,
// a `Failure`.
import type { DatabaseSync } from "node:sqlite";

import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

import type { Role, User } from "../shared/api.ts";
import { userOf } from "./auth.ts";
import { UdocFailure } from "./udoc.ts";

/** The longest name a folder, a file, a collection or a deal room is given. */
const MAX_NAME = 200;

/** The longest note a version's event keeps, or a description or instructions. */
const MAX_NOTE = 2000;

/** A request a route turns down: its status, its error's code, and why. */
export class Refusal extends Error {
    readonly status: number;
    readonly error: string;

    constructor(status: number, error: string, message: string) {
        super(message);
        this.status = status;
        this.error = error;
    }
}

/** The user `request` is signed in as; a `401` for no one. */
export function signedIn(db: DatabaseSync, request: FastifyRequest): User {
    const user = userOf(db, request.raw);
    if (!user) throw new Refusal(401, "signedOut", "no one is signed in");
    return user;
}

/** The user `request` is signed in as, whose role `may` do this; a `401` for no one, and a `403` for one who may not. */
export function signedInAs(db: DatabaseSync, request: FastifyRequest, may: (role: Role) => boolean): User {
    const user = signedIn(db, request);
    if (!may(user.role)) throw new Refusal(403, "forbidden", "your role doesn't let you do this");
    return user;
}

/** `value`, a name, trimmed; a `400` for none, or one too long. */
export function nameOf(value: unknown): string {
    const name = typeof value === "string" ? value.trim() : "";
    if (!name) throw new Refusal(400, "badRequest", "a name is needed");
    if (name.length > MAX_NAME) throw new Refusal(400, "badRequest", `a name is at most ${MAX_NAME} characters`);
    return name;
}

/** `value`, a note, trimmed; `null` for none, and a `400` for one too long. */
export function noteOf(value: unknown): string | null {
    const note = typeof value === "string" ? value.trim() : "";
    if (note.length > MAX_NOTE) throw new Refusal(400, "badRequest", `a note is at most ${MAX_NOTE} characters`);
    return note || null;
}

/**
 * The image `bytes` are, by what they start with rather than what the browser
 * says: a PNG, a JPEG, a WebP or an SVG; `undefined` for another.
 */
export function imageTypeOf(bytes: Buffer): string | undefined {
    if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
    if (bytes.toString("latin1", 0, 4) === "RIFF" && bytes.toString("latin1", 8, 12) === "WEBP") return "image/webp";
    const head = bytes.toString("utf8", 0, 1024).trimStart();
    if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head))
        return "image/svg+xml";
    return undefined;
}

/** `value`, a request's list of ids; a `400` for anything else. */
export function idsOf(value: unknown): string[] {
    if (!Array.isArray(value) || !value.every((id) => typeof id === "string"))
        throw new Refusal(400, "badRequest", "a list is needed");
    return value as string[];
}

/** A color a request gives: `#rrggbb`. */
export const COLOR = /^#[0-9a-f]{6}$/i;

/** Answer with an image someone uploaded, perhaps an SVG: opened as a page, it runs no script. */
export function sendImage(reply: FastifyReply, type: string, image: Uint8Array): FastifyReply {
    reply.header("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'");
    return reply.type(type).send(Buffer.from(image));
}

/** Fastify's error handler: each failure as a `Failure`. */
export function answerFailure(error: FastifyError, request: FastifyRequest, reply: FastifyReply): FastifyReply {
    if (error instanceof Refusal) return reply.code(error.status).send({ error: error.error, message: error.message });
    // udoc-server turning an upload down is the user's to hear; its own failing isn't.
    if (error instanceof UdocFailure) return reply.code(error.status < 500 ? error.status : 502).send(error.failure);
    if (error.statusCode !== undefined && error.statusCode < 500) {
        const code = error.statusCode === 413 ? "payloadTooLarge" : "badRequest";
        return reply.code(error.statusCode).send({ error: code, message: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: "internal", message: "something went wrong" });
}
