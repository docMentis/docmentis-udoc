// A tenant's own things, for its users alone: `/api/tenants/:id/…`. Its
// logo, which any of them sees and an admin replaces or removes; its brand's
// color and its viewer's colors, which an admin sets; and its users, whom an
// admin lists.
import type { DatabaseSync } from "node:sqlite";

import type { FastifyInstance, FastifyRequest } from "fastify";

import { isViewerColors, managesWorkspace } from "../../shared/api.ts";
import type { Person, Tenant, User } from "../../shared/api.ts";
import { userOf } from "../auth.ts";
import { COLOR, Refusal, imageTypeOf, sendImage, signedIn } from "../http.ts";

/** The largest logo, in bytes. */
const MAX_LOGO_BYTES = 1024 * 1024;

export function tenantRoutes(app: FastifyInstance, db: DatabaseSync): void {
    /** The user signed in, of tenant `id`; a `404` for another tenant's. */
    function memberOf(request: FastifyRequest<{ Params: { id: string } }>): User {
        const user = signedIn(db, request);
        if (user.tenant.id !== request.params.id) throw new Refusal(404, "notFound", "no such tenant");
        return user;
    }

    /** The admin signed in, of tenant `id`; a `403` for anyone else of it. */
    function adminOf(request: FastifyRequest<{ Params: { id: string } }>): User {
        const user = memberOf(request);
        if (!managesWorkspace(user.role)) throw new Refusal(403, "forbidden", "only an admin keeps the workspace");
        return user;
    }

    /** The tenant, as its users see it now. */
    function tenantFor(request: FastifyRequest): Tenant {
        return userOf(db, request.raw)!.tenant;
    }

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
        return sendImage(reply, logo.logo_type, logo.logo);
    });

    /** Replace the logo with the body, a PNG, JPEG, WebP or SVG of at most 1 MB: `{ tenant }`. */
    app.put<{ Params: { id: string }; Body: unknown }>(
        "/api/tenants/:id/logo",
        { bodyLimit: MAX_LOGO_BYTES },
        async (request) => {
            const user = adminOf(request);
            const bytes = request.body;
            if (!(bytes instanceof Buffer) || bytes.length === 0)
                throw new Refusal(400, "badRequest", "the body is the logo's bytes, as application/octet-stream");
            const type = imageTypeOf(bytes);
            if (!type) throw new Refusal(415, "unsupportedImage", "a logo is a PNG, a JPEG, a WebP or an SVG");
            db.prepare("UPDATE tenants SET logo = ?, logo_type = ?, logo_changed_at = ? WHERE id = ?").run(
                bytes,
                type,
                Date.now(),
                user.tenant.id,
            );
            return { tenant: tenantFor(request) };
        },
    );

    /** Remove the logo: `{ tenant }`. */
    app.delete<{ Params: { id: string } }>("/api/tenants/:id/logo", async (request) => {
        const user = adminOf(request);
        db.prepare("UPDATE tenants SET logo = NULL, logo_type = NULL, logo_changed_at = ? WHERE id = ?").run(
            Date.now(),
            user.tenant.id,
        );
        return { tenant: tenantFor(request) };
    });

    /**
     * Set what's given of `{ brandColor, viewerColors }`: the brand's color,
     * `#rrggbb` or `null` for none, and the viewer's colors: `{ tenant }`.
     */
    app.patch<{ Params: { id: string }; Body: { brandColor?: unknown; viewerColors?: unknown } | undefined }>(
        "/api/tenants/:id",
        async (request) => {
            const user = adminOf(request);
            const body = request.body ?? {};
            if ("brandColor" in body) {
                const color = body.brandColor;
                if (color !== null && (typeof color !== "string" || !COLOR.test(color)))
                    throw new Refusal(400, "badRequest", "a brand's color is #rrggbb, or null for none");
                db.prepare("UPDATE tenants SET brand_color = ? WHERE id = ?").run(
                    color?.toLowerCase() ?? null,
                    user.tenant.id,
                );
            }
            if ("viewerColors" in body) {
                const colors = body.viewerColors;
                if (!isViewerColors(colors))
                    throw new Refusal(
                        400,
                        "badRequest",
                        "the viewer's colors are a toolbar, a background and a primary",
                    );
                const { toolbar, background, primary } = colors;
                db.prepare("UPDATE tenants SET viewer_colors = ? WHERE id = ?").run(
                    JSON.stringify({ toolbar, background, primary }),
                    user.tenant.id,
                );
            }
            return { tenant: tenantFor(request) };
        },
    );

    /** `{ users }`: the tenant's users, by name. */
    app.get<{ Params: { id: string } }>("/api/tenants/:id/users", async (request): Promise<{ users: Person[] }> => {
        const user = adminOf(request);
        const users = db
            .prepare("SELECT id, email, name, title, role FROM users WHERE tenant_id = ? ORDER BY name COLLATE NOCASE")
            .all(user.tenant.id) as unknown as Person[];
        return { users };
    });
}
