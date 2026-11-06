// A deal room's frontstage, what its buyers read: `/api/frontstage/:token`. The
// token is the link a seller shares, and all a buyer has, with no account. These
// routes read only what was put on the frontstage, a copy of what the room said
// of itself, and each file at the version put there, so nothing in preparation
// backstage can reach them. A token that's no frontstage's is as unknown as a
// frontstage taken down.
import type { DatabaseSync } from "node:sqlite";

import type { FastifyInstance, FastifyReply } from "fastify";

import type { Frontstage } from "../../shared/api.ts";
import { viewerColorsOf } from "../auth.ts";
import { Refusal, sendImage } from "../http.ts";
import { frontstagePackagePath } from "../udoc.ts";

interface StageRow {
    room_id: string;
    title: string;
    description: string | null;
    banner_color: string | null;
    /** 1 for one with a banner image. */
    has_banner_image: number;
    staged_at: number;
    tenant_name: string;
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

/** Those a link was shared with keep what its address names for good: a change makes a new address. */
function keepForGood(reply: FastifyReply): void {
    reply.header("cache-control", "private, max-age=31536000, immutable");
}

export function frontstageRoutes(app: FastifyInstance, db: DatabaseSync): void {
    /** The frontstage at `token`; a `404` for none. */
    function stageOf(token: string): StageRow {
        const row = db
            .prepare(
                `SELECT stage.room_id, stage.title, stage.description, stage.banner_color,
                    stage.banner_image IS NOT NULL AS has_banner_image, stage.staged_at,
                    tenants.name AS tenant_name, tenants.logo IS NOT NULL AS has_logo, tenants.logo_changed_at,
                    tenants.brand_color, tenants.viewer_colors
                FROM frontstages AS stage
                JOIN deal_rooms ON deal_rooms.id = stage.room_id
                JOIN tenants ON tenants.id = deal_rooms.tenant_id
                WHERE stage.token = ?`,
            )
            .get(token) as StageRow | undefined;
        if (!row) throw GONE();
        return row;
    }

    /** A `Frontstage`. */
    app.get<{ Params: { token: string } }>("/api/frontstage/:token", async (request): Promise<Frontstage> => {
        const { token } = request.params;
        const stage = stageOf(token);
        const address = `/api/frontstage/${encodeURIComponent(token)}`;
        const files = db
            .prepare(
                `SELECT assets.id, file.name, file.description, assets.format, assets.published_version AS number,
                    thumbnails.png IS NOT NULL AS has_thumbnail
                FROM frontstage_files AS file
                JOIN assets ON assets.id = file.asset_id AND assets.published_version IS NOT NULL
                LEFT JOIN thumbnails ON thumbnails.asset_id = assets.id AND thumbnails.number = assets.published_version
                WHERE file.room_id = ? ORDER BY file.position`,
            )
            .all(stage.room_id) as unknown as StagedFileRow[];
        return {
            from: {
                name: stage.tenant_name,
                logo: stage.has_logo ? `${address}/logo?v=${stage.logo_changed_at}` : null,
                brandColor: stage.brand_color,
                viewerColors: viewerColorsOf(stage.viewer_colors),
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
        const image = db
            .prepare(
                "SELECT banner_image, banner_image_type FROM frontstages WHERE token = ? AND banner_image IS NOT NULL",
            )
            .get(request.params.token) as { banner_image: Uint8Array; banner_image_type: string } | undefined;
        if (!image) throw GONE();
        keepForGood(reply);
        return sendImage(reply, image.banner_image_type, image.banner_image);
    });

    /** The logo of the tenant the frontstage is from; `404` when it has none. */
    app.get<{ Params: { token: string } }>("/api/frontstage/:token/logo", async (request, reply) => {
        const logo = db
            .prepare(
                `SELECT tenants.logo, tenants.logo_type FROM frontstages AS stage
                JOIN deal_rooms ON deal_rooms.id = stage.room_id
                JOIN tenants ON tenants.id = deal_rooms.tenant_id
                WHERE stage.token = ? AND tenants.logo IS NOT NULL`,
            )
            .get(request.params.token) as { logo: Uint8Array; logo_type: string } | undefined;
        if (!logo) throw GONE();
        keepForGood(reply);
        return sendImage(reply, logo.logo_type, logo.logo);
    });

    /** The first page of a file on the frontstage, at the version shown; `404` for anything else. */
    app.get<{ Params: { token: string; assetId: string; number: string } }>(
        "/api/frontstage/:token/thumbnails/:assetId/:number",
        async (request, reply) => {
            const { token, assetId, number } = request.params;
            const row = db
                .prepare(
                    `SELECT thumbnails.png FROM frontstages AS stage
                    JOIN frontstage_files AS file ON file.room_id = stage.room_id
                    JOIN assets ON assets.id = file.asset_id
                    JOIN thumbnails ON thumbnails.asset_id = assets.id AND thumbnails.number = assets.published_version
                    WHERE stage.token = ? AND file.asset_id = ? AND assets.published_version = ?`,
                )
                .get(token, assetId, Number(number)) as { png: Uint8Array | null } | undefined;
            if (!row?.png) throw GONE();
            keepForGood(reply);
            return reply.type("image/png").send(Buffer.from(row.png));
        },
    );
}
