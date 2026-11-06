// Signing in and out: `/api/session`.
import type { FastifyInstance } from "fastify";

import { signedIn } from "../http.ts";
import type { Access } from "../scope.ts";

export function sessionRoutes(app: FastifyInstance, access: Access): void {
    /** `{ user }`, the user signed in, or `401` for none. */
    app.get("/api/session", async (request) => {
        return { user: signedIn(access, request).user };
    });

    /** Sign in with `{ email, password }`, ending any session before: `{ user }`, or `401`. */
    app.post<{ Body: { email?: unknown; password?: unknown } | undefined }>("/api/session", async (request, reply) => {
        const { email, password } = request.body ?? {};
        if (typeof email !== "string" || typeof password !== "string")
            return reply.code(400).send({ error: "invalidRequest", message: "an email and a password are needed" });
        const started = await access.signIn(email, password);
        if (!started)
            return reply.code(401).send({ error: "wrongCredentials", message: "the email or password is wrong" });
        access.endSession(request.raw);
        reply.header("set-cookie", started.cookie);
        return { user: started.user };
    });

    /** Sign out: `204`. */
    app.delete("/api/session", async (request, reply) => {
        reply.header("set-cookie", access.endSession(request.raw));
        return reply.code(204).send();
    });
}
