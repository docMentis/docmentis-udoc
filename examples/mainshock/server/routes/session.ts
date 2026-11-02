// Signing in and out: `/api/session`.
import type { DatabaseSync } from "node:sqlite";

import type { FastifyInstance } from "fastify";

import { endSession, signIn, userOf } from "../auth.ts";

export function sessionRoutes(app: FastifyInstance, db: DatabaseSync): void {
    /** `{ user }`, the user signed in, or `401` for none. */
    app.get("/api/session", async (request, reply) => {
        const user = userOf(db, request.raw);
        if (!user) return reply.code(401).send({ error: "signedOut", message: "no one is signed in" });
        return { user };
    });

    /** Sign in with `{ username, password }`, ending any session before: `{ user }`, or `401`. */
    app.post<{ Body: { username?: unknown; password?: unknown } | undefined }>(
        "/api/session",
        async (request, reply) => {
            const { username, password } = request.body ?? {};
            if (typeof username !== "string" || typeof password !== "string")
                return reply
                    .code(400)
                    .send({ error: "invalidRequest", message: "a username and a password are needed" });
            const signedIn = await signIn(db, username, password);
            if (!signedIn)
                return reply
                    .code(401)
                    .send({ error: "wrongCredentials", message: "the username or password is wrong" });
            endSession(db, request.raw);
            reply.header("set-cookie", signedIn.cookie);
            return { user: signedIn.user };
        },
    );

    /** Sign out: `204`. */
    app.delete("/api/session", async (request, reply) => {
        reply.header("set-cookie", endSession(db, request.raw));
        return reply.code(204).send();
    });
}
