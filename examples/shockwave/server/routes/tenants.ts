// A tenant's own things, for its users alone: `/api/tenants/:id/…`. Its
// logo, which any of them sees and an admin replaces or removes; its brand's
// color and its viewer's colors, which an admin sets; and its users, whom an
// admin lists.
import type { FastifyInstance, FastifyRequest } from "fastify";

import { isViewerColors, managesWorkspace } from "../../shared/api.ts";
import type { Person, Tenant } from "../../shared/api.ts";
import { COLOR, Refusal, imageTypeOf, sendImage, signedIn } from "../http.ts";
import type { Access, Scope } from "../scope.ts";

/** The largest logo, in bytes. */
const MAX_LOGO_BYTES = 1024 * 1024;

export function tenantRoutes(app: FastifyInstance, access: Access): void {
    /** What's the user's signed in, of tenant `id`; a `404` for another tenant's. */
    function memberOf(request: FastifyRequest<{ Params: { id: string } }>): Scope {
        const scope = signedIn(access, request);
        if (scope.user.tenant.id !== request.params.id) throw new Refusal(404, "notFound", "no such tenant");
        return scope;
    }

    /** What's the admin's signed in, of tenant `id`; a `403` for anyone else of it. */
    function adminOf(request: FastifyRequest<{ Params: { id: string } }>): Scope {
        const scope = memberOf(request);
        if (!managesWorkspace(scope.user.role))
            throw new Refusal(403, "forbidden", "only an admin keeps the workspace");
        return scope;
    }

    /** The tenant, as its users see it now. */
    function tenantFor(request: FastifyRequest): Tenant {
        return signedIn(access, request).user.tenant;
    }

    /** The tenant's logo; `404` when it has none, or isn't the user's tenant. */
    app.get<{ Params: { id: string } }>("/api/tenants/:id/logo", async (request, reply) => {
        const { user, db } = signedIn(access, request);
        const logo =
            user.tenant.id === request.params.id
                ? (db
                      .prepare(
                          "SELECT logo, logo_type, logo_changed_at FROM tenants WHERE id = :tenant AND logo IS NOT NULL",
                      )
                      .get() as { logo: Uint8Array; logo_type: string; logo_changed_at: number } | undefined)
                : undefined;
        if (!logo) throw new Refusal(404, "notFound", "no such logo");
        return sendImage(request, reply, `logo-${logo.logo_changed_at}`, logo.logo_type, logo.logo);
    });

    /** Replace the logo with the body, a PNG, JPEG, WebP or SVG of at most 1 MB: `{ tenant }`. */
    app.put<{ Params: { id: string }; Body: unknown }>(
        "/api/tenants/:id/logo",
        { bodyLimit: MAX_LOGO_BYTES },
        async (request) => {
            const { db } = adminOf(request);
            const bytes = request.body;
            if (!(bytes instanceof Buffer) || bytes.length === 0)
                throw new Refusal(400, "badRequest", "the body is the logo's bytes, as application/octet-stream");
            const type = imageTypeOf(bytes);
            if (!type) throw new Refusal(415, "unsupportedImage", "a logo is a PNG, a JPEG, a WebP or an SVG");
            db.prepare("UPDATE tenants SET logo = ?, logo_type = ?, logo_changed_at = ? WHERE id = :tenant").run(
                bytes,
                type,
                Date.now(),
            );
            return { tenant: tenantFor(request) };
        },
    );

    /** Remove the logo: `{ tenant }`. */
    app.delete<{ Params: { id: string } }>("/api/tenants/:id/logo", async (request) => {
        const { db } = adminOf(request);
        db.prepare("UPDATE tenants SET logo = NULL, logo_type = NULL, logo_changed_at = ? WHERE id = :tenant").run(
            Date.now(),
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
            const { db } = adminOf(request);
            const body = request.body ?? {};
            if ("brandColor" in body) {
                const color = body.brandColor;
                if (color !== null && (typeof color !== "string" || !COLOR.test(color)))
                    throw new Refusal(400, "badRequest", "a brand's color is #rrggbb, or null for none");
                db.prepare("UPDATE tenants SET brand_color = ? WHERE id = :tenant").run(color?.toLowerCase() ?? null);
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
                db.prepare("UPDATE tenants SET viewer_colors = ? WHERE id = :tenant").run(
                    JSON.stringify({ toolbar, background, primary }),
                );
            }
            return { tenant: tenantFor(request) };
        },
    );

    /** `{ users }`: the tenant's users, by name. */
    app.get<{ Params: { id: string } }>("/api/tenants/:id/users", async (request): Promise<{ users: Person[] }> => {
        const { db } = adminOf(request);
        const users = db
            .prepare(
                "SELECT id, email, name, title, role FROM users WHERE tenant_id = :tenant ORDER BY name COLLATE NOCASE",
            )
            .all() as unknown as Person[];
        return { users };
    });
}
