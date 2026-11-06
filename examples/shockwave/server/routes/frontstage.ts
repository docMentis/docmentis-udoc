// A deal room's frontstage, what its buyers read: `/api/frontstage/:token`. The
// token is the link a seller shares, and all a buyer has, with no account: it says
// which tenant the request is for. These routes read only what was put on the
// frontstage, a copy of what the room said of itself, and each file at the version
// put there, so nothing in preparation backstage can reach them. A token that's no
// frontstage's is as unknown as a frontstage taken down.
import type { FastifyInstance } from "fastify";

import type { Frontstage } from "../../shared/api.ts";
import { viewerColorsOf } from "../auth.ts";
import type { TenantDb } from "../db.ts";
import { Refusal, sendImage, sendKept } from "../http.ts";
import type { Access } from "../scope.ts";
import { frontstagePackagePath } from "../udoc.ts";

interface StageRow {
    room_id: string;
    title: string;
    description: string | null;
    banner_color: string | null;
    /** 1 for one with a banner image. */
    has_banner_image: number;
    staged_at: number;
}

interface TenantRow {
    name: string;
    /** 1 for a tenant with a logo. */
    has_logo: number;
    logo_changed_at: number;
    brand_color: string | null;
    viewer_colors: string | null;
}

interface StagedFileRow {
    id: string;
    name: string;
    description: string | null;
    format: string;
    number: number;
    /** 1 for a version with a thumbnail. */
    has_thumbnail: number;
}

const GONE = () => new Refusal(404, "notFound", "no such frontstage");

export function frontstageRoutes(app: FastifyInstance, access: Access): void {
    /** The data of the tenant whose frontstage is at `token`; a `404` for none. */
    function tenantOf(token: string): TenantDb {
        const db = access.frontstage(token);
        if (!db) throw GONE();
        return db;
    }

    /** A `Frontstage`. */
    app.get<{ Params: { token: string } }>("/api/frontstage/:token", async (request): Promise<Frontstage> => {
        const { token } = request.params;
        const db = tenantOf(token);
        const stage = db
            .prepare(
                `SELECT room_id, title, description, banner_color, banner_image IS NOT NULL AS has_banner_image,
                    staged_at
                FROM frontstages WHERE tenant_id = :tenant AND token = ?`,
            )
            .get(token) as StageRow | undefined;
        if (!stage) throw GONE();
        const tenant = db
            .prepare(
                `SELECT name, logo IS NOT NULL AS has_logo, logo_changed_at, brand_color, viewer_colors
                FROM tenants WHERE id = :tenant`,
            )
            .get() as unknown as TenantRow;
        const address = `/api/frontstage/${encodeURIComponent(token)}`;
        const files = db
            .prepare(
                `SELECT assets.id, file.name, file.description, assets.format, assets.published_version AS number,
                    thumbnails.png IS NOT NULL AS has_thumbnail
                FROM frontstage_files AS file
                JOIN assets ON assets.tenant_id = file.tenant_id AND assets.id = file.asset_id
                    AND assets.published_version IS NOT NULL
                LEFT JOIN thumbnails ON thumbnails.tenant_id = assets.tenant_id AND thumbnails.asset_id = assets.id
                    AND thumbnails.number = assets.published_version
                WHERE file.tenant_id = :tenant AND file.room_id = ? ORDER BY file.position`,
            )
            .all(stage.room_id) as unknown as StagedFileRow[];
        return {
            from: {
                name: tenant.name,
                logo: tenant.has_logo ? `${address}/logo?v=${tenant.logo_changed_at}` : null,
                brandColor: tenant.brand_color,
                viewerColors: viewerColorsOf(tenant.viewer_colors),
            },
            title: stage.title,
            description: stage.description,
            banner: {
                color: stage.banner_color,
                image: stage.has_banner_image ? `${address}/banner?v=${stage.staged_at}` : null,
            },
            files: files.map((file) => ({
                id: file.id,
                name: file.name,
                description: file.description,
                format: file.format,
                thumbnail: file.has_thumbnail ? `${address}/thumbnails/${file.id}/${file.number}` : null,
                package: frontstagePackagePath(token, file.id, file.number),
            })),
        };
    });

    /** The frontstage's banner image; `404` when it has none. */
    app.get<{ Params: { token: string } }>("/api/frontstage/:token/banner", async (request, reply) => {
        const { token } = request.params;
        const image = tenantOf(token)
            .prepare(
                `SELECT banner_image, banner_image_type, staged_at FROM frontstages
                WHERE tenant_id = :tenant AND token = ? AND banner_image IS NOT NULL`,
            )
            .get(token) as { banner_image: Uint8Array; banner_image_type: string; staged_at: number } | undefined;
        if (!image) throw GONE();
        const tag = `banner-${image.staged_at}`;
        return sendImage(request, reply, tag, image.banner_image_type, image.banner_image);
    });

    /** The logo of the tenant the frontstage is from; `404` when it has none. */
    app.get<{ Params: { token: string } }>("/api/frontstage/:token/logo", async (request, reply) => {
        const logo = tenantOf(request.params.token)
            .prepare("SELECT logo, logo_type, logo_changed_at FROM tenants WHERE id = :tenant AND logo IS NOT NULL")
            .get() as { logo: Uint8Array; logo_type: string; logo_changed_at: number } | undefined;
        if (!logo) throw GONE();
        return sendImage(request, reply, `logo-${logo.logo_changed_at}`, logo.logo_type, logo.logo);
    });

    /** The first page of a file on the frontstage, at the version shown; `404` for anything else. */
    app.get<{ Params: { token: string; assetId: string; number: string } }>(
        "/api/frontstage/:token/thumbnails/:assetId/:number",
        async (request, reply) => {
            const { token, assetId, number } = request.params;
            const row = tenantOf(token)
                .prepare(
                    `SELECT thumbnails.png FROM frontstages AS stage
                    JOIN frontstage_files AS file ON file.tenant_id = stage.tenant_id AND file.room_id = stage.room_id
                    JOIN assets ON assets.tenant_id = file.tenant_id AND assets.id = file.asset_id
                    JOIN thumbnails ON thumbnails.tenant_id = assets.tenant_id AND thumbnails.asset_id = assets.id
                        AND thumbnails.number = assets.published_version
                    WHERE stage.tenant_id = :tenant AND stage.token = ? AND file.asset_id = ?
                        AND assets.published_version = ?`,
                )
                .get(token, assetId, Number(number)) as { png: Uint8Array | null } | undefined;
            if (!row?.png) throw GONE();
            return sendKept(request, reply, `${assetId}-${number}`, "image/png", row.png);
        },
    );
}
