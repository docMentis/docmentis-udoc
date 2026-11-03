// A tenant's own things, for its users alone: `/api/tenants/:id/…`.
import type { DatabaseSync } from "node:sqlite";

import type { FastifyInstance } from "fastify";

import { userOf } from "../auth.ts";

export function tenantRoutes(app: FastifyInstance, db: DatabaseSync): void {
    /** The tenant's logo; `404` when it has none, or isn't the user's tenant. */
    app.get<{ Params: { id: string } }>("/api/tenants/:id/logo", async (request, reply) => {
        const user = userOf(db, request.raw);
        if (!user) return reply.code(401).send({ error: "signedOut", message: "no one is signed in" });
        const logo =
            user.tenant.id === request.params.id
                ? (db
                      .prepare("SELECT logo, logo_type FROM tenants WHERE id = ? AND logo IS NOT NULL")
                      .get(user.tenant.id) as { logo: Uint8Array; logo_type: string } | undefined)
                : undefined;
        if (!logo) return reply.code(404).send({ error: "notFound", message: "no such logo" });
        // A tenant's image, perhaps an SVG: opened as a page, it runs no script.
        reply.header("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'");
        return reply.type(logo.logo_type).send(Buffer.from(logo.logo));
    });
}
