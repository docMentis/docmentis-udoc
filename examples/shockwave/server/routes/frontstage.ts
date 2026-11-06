// A deal room's frontstage, what its buyers read: `/api/frontstage/:token`. The
// token is the link a seller shares, and all a buyer has, with no account: it says
// which tenant the request is for. These routes read only what was put on the
// frontstage, a copy of what the room said of itself, and each file at the version
// put there, so nothing in preparation backstage can reach them. A token that's no
// frontstage's is as unknown as a frontstage taken down.
//
// A buyer's browser also reports what it reads: the one thing here anyone can write,
// with no account. So a report is held to what the frontstage shows, small, and
// counted, per link, so that a flood at one link slows no other. A browser is known
// by a cookie for this link alone, which says nothing of who it is, and can't be
// followed from one frontstage to another. Those at the tenant, opening their own
// link, aren't counted.
import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";

import type { Frontstage, FrontstageReport } from "../../shared/api.ts";
import { cookieOf, viewerColorsOf } from "../auth.ts";
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

/** The cookie a browser is known by, at one link. */
const VISITOR_COOKIE = "shockwave_visitor";

/** How long a browser is known by it, in seconds. */
const VISITOR_SECONDS = 365 * 24 * 60 * 60;

/** How many reports one address may send one link in a minute: far more than reading takes. */
const REPORTS_PER_MINUTE = 120;

/** The largest report, in bytes. */
const MAX_REPORT_BYTES = 16 * 1024;

/** The most pages one report tells of. */
const MAX_PAGES_IN_REPORT = 64;

/** The highest page a report tells of. */
const MAX_PAGE = 99_999;

/** The longest one page is read for, in one report, in milliseconds: a browser reports far more often than this. */
const MAX_MS_IN_REPORT = 2 * 60 * 1000;

/** Whether `key` may do something again this minute. */
function limiter(perMinute: number): (key: string) => boolean {
    let minute = 0;
    let counts = new Map<string, number>();
    return (key) => {
        const now = Math.floor(Date.now() / 60000);
        if (now !== minute) {
            minute = now;
            counts = new Map();
        }
        const count = (counts.get(key) ?? 0) + 1;
        counts.set(key, count);
        return count <= perMinute;
    };
}

/** `body`, a report; a `400` for anything else. */
function reportOf(body: unknown): FrontstageReport {
    const refuse = () => new Refusal(400, "badRequest", "that isn't a report");
    if (typeof body !== "object" || body === null) throw refuse();
    const { kind, fileId, pages } = body as { kind?: unknown; fileId?: unknown; pages?: unknown };
    if (kind === "visited") return { kind };
    if (typeof fileId !== "string") throw refuse();
    if (kind === "opened") return { kind, fileId };
    if (kind !== "read" || !Array.isArray(pages) || pages.length === 0 || pages.length > MAX_PAGES_IN_REPORT)
        throw refuse();
    const valid = pages.every(
        ({ page, ms }: { page?: unknown; ms?: unknown }) =>
            Number.isInteger(page) &&
            (page as number) >= 0 &&
            (page as number) <= MAX_PAGE &&
            Number.isInteger(ms) &&
            (ms as number) > 0 &&
            (ms as number) <= MAX_MS_IN_REPORT,
    );
    if (!valid) throw refuse();
    return { kind, fileId, pages: pages as { page: number; ms: number }[] };
}

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

    const mayReport = limiter(REPORTS_PER_MINUTE);

    /**
     * What a buyer's browser reads, a `FrontstageReport`: `204`, kept against the
     * browser, which this tells who it is the first time, or not at all for one
     * signed in at this tenant. `404` for a file the frontstage doesn't show, `400`
     * for what isn't a report, `413` for one too large and `429` for too many.
     */
    app.post<{ Params: { token: string }; Body: unknown }>(
        "/api/frontstage/:token/activity",
        { bodyLimit: MAX_REPORT_BYTES },
        async (request, reply) => {
            const { token } = request.params;
            const db = tenantOf(token);
            if (!mayReport(`${token} ${request.ip}`))
                throw new Refusal(429, "tooManyReports", "too many reports from this address");
            const report = reportOf(request.body);
            if (access.scopeOf(request.raw)?.user.tenant.id === db.tenantId) return reply.code(204).send();
            const stage = db
                .prepare("SELECT room_id FROM frontstages WHERE tenant_id = :tenant AND token = ?")
                .get(token) as { room_id: string } | undefined;
            if (!stage) throw GONE();
            const shown =
                report.kind === "visited"
                    ? undefined
                    : (db
                          .prepare(
                              `SELECT assets.published_version AS version FROM frontstage_files AS file
                              JOIN assets ON assets.tenant_id = file.tenant_id AND assets.id = file.asset_id
                              WHERE file.tenant_id = :tenant AND file.room_id = ? AND file.asset_id = ?
                                  AND assets.published_version IS NOT NULL`,
                          )
                          .get(stage.room_id, report.fileId) as { version: number } | undefined);
            if (report.kind !== "visited" && !shown) throw GONE();

            // Known only by a cookie this answered with: any other is a browser new here.
            const sent = cookieOf(request.raw, VISITOR_COOKIE);
            const known =
                sent !== undefined &&
                db
                    .prepare("SELECT 1 FROM frontstage_visitors WHERE tenant_id = :tenant AND room_id = ? AND id = ?")
                    .get(stage.room_id, sent) !== undefined;
            const visitorId = known ? sent : randomUUID();
            if (!known)
                reply.header(
                    "set-cookie",
                    `${VISITOR_COOKIE}=${visitorId}; Path=/api/frontstage/${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Max-Age=${VISITOR_SECONDS}`,
                );
            const at = Date.now();
            db.transaction(() => {
                db.prepare(
                    `INSERT INTO frontstage_visitors (tenant_id, room_id, id, first_at, last_at)
                    VALUES (:tenant, :room, :id, :at, :at)
                    ON CONFLICT (tenant_id, room_id, id) DO UPDATE SET last_at = excluded.last_at`,
                ).run({ room: stage.room_id, id: visitorId, at });
                if (report.kind === "opened")
                    db.prepare(
                        `INSERT INTO frontstage_file_opens (tenant_id, room_id, visitor_id, asset_id, opens, last_at)
                        VALUES (:tenant, :room, :visitor, :asset, 1, :at)
                        ON CONFLICT (tenant_id, asset_id, visitor_id) DO UPDATE
                            SET opens = opens + 1, last_at = excluded.last_at`,
                    ).run({ room: stage.room_id, visitor: visitorId, asset: report.fileId, at });
                if (report.kind === "read") {
                    const add = db.prepare(
                        `INSERT INTO frontstage_page_reads (tenant_id, room_id, visitor_id, asset_id, version, page, ms)
                        VALUES (:tenant, :room, :visitor, :asset, :version, :page, :ms)
                        ON CONFLICT (tenant_id, asset_id, version, page, visitor_id) DO UPDATE SET ms = ms + excluded.ms`,
                    );
                    for (const { page, ms } of report.pages)
                        add.run({
                            room: stage.room_id,
                            visitor: visitorId,
                            asset: report.fileId,
                            version: shown!.version,
                            page,
                            ms,
                        });
                }
            });
            return reply.code(204).send();
        },
    );

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
