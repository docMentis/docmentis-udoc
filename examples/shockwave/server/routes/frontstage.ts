// A deal room's frontstage, what its buyers read: `/api/frontstage/:token`. The
// token is the link a seller shares, and all a buyer has, with no account: it says
// which tenant the request is for. These routes read only what was put on the
// frontstage, a copy of what the room said of itself, and each file at the version
// put there, so nothing in preparation backstage can reach them. A token that's no
// frontstage's is as unknown as a frontstage taken down.
//
// A buyer's browser also reports what it reads: a session for each file it opens, and
// in it, each stretch of time a page was on screen. It's the one thing here anyone can
// write, with no account. So a report is held to what the frontstage shows and to the
// browser's own sessions, small, no later than now, and counted, per link, so that a
// flood at one link slows no other. A browser is known by a cookie for this link
// alone, which says nothing of who it is, and can't be followed from one frontstage to
// another. Those at the tenant, opening their own link, aren't counted.
import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";

import type { Frontstage, FrontstageReport, FrontstageSession, PageView } from "../../shared/api.ts";
import { cookieOf, viewerColorsOf } from "../auth.ts";
import type { TenantDb } from "../db.ts";
import { Refusal, sendImage, sendKept } from "../http.ts";
import type { Access } from "../scope.ts";
import { frontstagePackagePath } from "../udoc.ts";
import { thumbnailCount } from "./thumbnails.ts";

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
    /** How many thumbnails the version has. */
    thumbnail_count: number;
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

/** The most page views one report tells of. */
const MAX_VIEWS_IN_REPORT = 64;

/** The most page views a session keeps: past them, those it has may still grow. */
const MAX_VIEWS_IN_SESSION = 5000;

/** The highest page a report tells of. */
const MAX_PAGE = 99_999;

/**
 * How far past the time since a session began, by the backend's clock, a view may
 * end, in milliseconds: the browser counts from before its opening reached here.
 */
const CLOCK_SLACK_MS = 60 * 1000;

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
    const { kind, fileId, session, views } = body as {
        kind?: unknown;
        fileId?: unknown;
        session?: unknown;
        views?: unknown;
    };
    if (kind === "visited") return { kind };
    if (kind === "opened") {
        if (typeof fileId !== "string") throw refuse();
        return { kind, fileId };
    }
    if (
        kind !== "read" ||
        typeof session !== "string" ||
        !Array.isArray(views) ||
        views.length === 0 ||
        views.length > MAX_VIEWS_IN_REPORT
    )
        throw refuse();
    const valid = views.every(
        (view: unknown) =>
            typeof view === "object" &&
            view !== null &&
            Number.isInteger((view as PageView).page) &&
            (view as PageView).page >= 0 &&
            (view as PageView).page <= MAX_PAGE &&
            Number.isInteger((view as PageView).from) &&
            Number.isInteger((view as PageView).to) &&
            (view as PageView).from >= 0 &&
            (view as PageView).to > (view as PageView).from,
    );
    if (!valid) throw refuse();
    return {
        kind,
        session,
        views: (views as PageView[]).map(({ page, from, to }) => ({ page, from, to })),
    };
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
                    ${thumbnailCount("assets.published_version")} AS thumbnail_count
                FROM frontstage_files AS file
                JOIN assets ON assets.tenant_id = file.tenant_id AND assets.id = file.asset_id
                    AND assets.published_version IS NOT NULL
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
                thumbnails:
                    file.thumbnail_count === 0
                        ? null
                        : { path: `${address}/thumbnails/${file.id}/${file.number}`, pageCount: file.thumbnail_count },
                package: frontstagePackagePath(token, file.id, file.number),
            })),
        };
    });

    const mayReport = limiter(REPORTS_PER_MINUTE);

    /**
     * What a buyer's browser reads, a `FrontstageReport`, kept against the
     * browser, which this tells who it is the first time, or not at all for one
     * signed in at this tenant: `204`, or for a file opened, `201` and the
     * `FrontstageSession` to report its page views in. `404` for a file the
     * frontstage doesn't show, or a session that isn't the browser's of one it
     * does; `400` for what isn't a report, or a view that ends after now; `413`
     * for one too large and `429` for too many.
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

            // Known only by a cookie this answered with: any other is a browser new here.
            const sent = cookieOf(request.raw, VISITOR_COOKIE);
            const known =
                sent !== undefined &&
                db
                    .prepare("SELECT 1 FROM frontstage_visitors WHERE tenant_id = :tenant AND room_id = ? AND id = ?")
                    .get(stage.room_id, sent) !== undefined;
            const at = Date.now();
            const seen = (visitorId: string) =>
                db
                    .prepare(
                        `INSERT INTO frontstage_visitors (tenant_id, room_id, id, first_at, last_at)
                        VALUES (:tenant, :room, :id, :at, :at)
                        ON CONFLICT (tenant_id, room_id, id) DO UPDATE SET last_at = excluded.last_at`,
                    )
                    .run({ room: stage.room_id, id: visitorId, at });

            if (report.kind === "read") {
                // A session of this browser's, of a file the frontstage still shows.
                const session = known
                    ? (db
                          .prepare(
                              `SELECT session.started_at FROM frontstage_sessions AS session
                              JOIN frontstage_files AS file ON file.tenant_id = session.tenant_id
                                  AND file.room_id = session.room_id AND file.asset_id = session.asset_id
                              WHERE session.tenant_id = :tenant AND session.id = ? AND session.room_id = ?
                                  AND session.visitor_id = ?`,
                          )
                          .get(report.session, stage.room_id, sent) as { started_at: number } | undefined)
                    : undefined;
                if (!session) throw new Refusal(404, "notFound", "no such session");
                const latest = at - session.started_at + CLOCK_SLACK_MS;
                if (report.views.some(({ to }) => to > latest))
                    throw new Refusal(400, "badRequest", "a view can't end after now");
                db.transaction(() => {
                    seen(sent!);
                    const { views } = db
                        .prepare(
                            "SELECT COUNT(*) AS views FROM frontstage_page_views WHERE tenant_id = :tenant AND session_id = ?",
                        )
                        .get(report.session) as { views: number };
                    // A view again is the one that began then, grown; a full session's only grow.
                    const add = db.prepare(
                        `INSERT INTO frontstage_page_views (tenant_id, session_id, started_ms, ended_ms, page)
                        VALUES (:tenant, :session, :from, :to, :page)
                        ON CONFLICT (tenant_id, session_id, started_ms) DO UPDATE
                            SET ended_ms = max(ended_ms, excluded.ended_ms)`,
                    );
                    const grow = db.prepare(
                        `UPDATE frontstage_page_views SET ended_ms = max(ended_ms, :to)
                        WHERE tenant_id = :tenant AND session_id = :session AND started_ms = :from`,
                    );
                    for (const { page, from, to } of report.views)
                        if (views < MAX_VIEWS_IN_SESSION) add.run({ session: report.session, from, to, page });
                        else grow.run({ session: report.session, from, to });
                });
                return reply.code(204).send();
            }

            const shown =
                report.kind === "opened"
                    ? (db
                          .prepare(
                              `SELECT assets.published_version AS version FROM frontstage_files AS file
                              JOIN assets ON assets.tenant_id = file.tenant_id AND assets.id = file.asset_id
                              WHERE file.tenant_id = :tenant AND file.room_id = ? AND file.asset_id = ?
                                  AND assets.published_version IS NOT NULL`,
                          )
                          .get(stage.room_id, report.fileId) as { version: number } | undefined)
                    : undefined;
            if (report.kind === "opened" && !shown) throw GONE();
            const visitorId = known ? sent : randomUUID();
            if (!known)
                reply.header(
                    "set-cookie",
                    `${VISITOR_COOKIE}=${visitorId}; Path=/api/frontstage/${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Max-Age=${VISITOR_SECONDS}`,
                );
            if (report.kind === "visited") {
                seen(visitorId);
                return reply.code(204).send();
            }
            const opened: FrontstageSession = { session: randomUUID() };
            db.transaction(() => {
                seen(visitorId);
                db.prepare(
                    `INSERT INTO frontstage_sessions (tenant_id, room_id, visitor_id, id, asset_id, version, started_at)
                    VALUES (:tenant, ?, ?, ?, ?, ?, ?)`,
                ).run(stage.room_id, visitorId, opened.session, report.fileId, shown!.version, at);
            });
            return reply.code(201).send(opened);
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

    /** A page of a file on the frontstage, at the version shown, counting from 0; `404` for anything else. */
    app.get<{ Params: { token: string; assetId: string; number: string; page: string } }>(
        "/api/frontstage/:token/thumbnails/:assetId/:number/:page",
        async (request, reply) => {
            const { token, assetId } = request.params;
            const number = Number(request.params.number);
            const page = Number(request.params.page);
            const row = tenantOf(token)
                .prepare(
                    `SELECT thumbnails.png FROM frontstages AS stage
                    JOIN frontstage_files AS file ON file.tenant_id = stage.tenant_id AND file.room_id = stage.room_id
                    JOIN assets ON assets.tenant_id = file.tenant_id AND assets.id = file.asset_id
                    JOIN thumbnails ON thumbnails.tenant_id = assets.tenant_id AND thumbnails.asset_id = assets.id
                        AND thumbnails.number = assets.published_version AND thumbnails.page = ?
                    WHERE stage.tenant_id = :tenant AND stage.token = ? AND file.asset_id = ?
                        AND assets.published_version = ?`,
                )
                .get(page, token, assetId, number) as { png: Uint8Array } | undefined;
            if (!row) throw GONE();
            return sendKept(request, reply, `${assetId}-${number}-${page}`, "image/png", row.png);
        },
    );
}
