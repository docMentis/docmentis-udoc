// The API's failures: a route throws a `Refusal`, and every failure, a route's,
// udoc-server's or Fastify's own, answers its status and `{ error, message }`,
// a `Failure`.
import type { DatabaseSync } from "node:sqlite";

import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

import type { User } from "../shared/api.ts";
import { userOf } from "./auth.ts";
import { UdocFailure } from "./udoc.ts";

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
