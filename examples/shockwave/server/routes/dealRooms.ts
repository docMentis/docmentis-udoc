// Deal rooms, backstage: `/api/deal-rooms`. Those who sell make them, and work in
// those they can enter: the ones they're on, and for a manager, all their tenant's.
// A room's file is its own copy of a version the library published, picked from
// a collection, kept as a document of its own and edited apart from where it came
// from, with versions reviewed as a library file's are. Nothing here reaches a buyer
// until someone puts the room on its frontstage: that copies what it says of
// itself, and each file chosen goes on at its latest approved version. All of this
// is its tenant's alone: another tenant's room is as unknown as one that isn't there.
import { randomBytes, randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyRequest } from "fastify";

import { entersAllDealRooms, sellsDeals } from "../../shared/api.ts";
import type {
    DealRoom,
    DealRoomActivity,
    DealRoomFile,
    DealRoomFileDetail,
    DealRoomNews,
    DocumentActivity,
    PageView,
    PublishedFile,
    ReadingSession,
    Role,
    SessionActivity,
    Seller,
} from "../../shared/api.ts";
import {
    ASSETS,
    ASSET_COLUMNS,
    PUBLISHED_FILES,
    PUBLISHED_FILE_COLUMNS,
    assetOfRow,
    publishedFileOfRow,
} from "../assets.ts";
import type { AssetRow, PublishedFileRow } from "../assets.ts";
import type { TenantDb } from "../db.ts";
import { anySentToReview, entersDealRoom } from "../dealRooms.ts";
import { COLOR, Refusal, idsOf, imageTypeOf, nameOf, noteOf, sendImage, signedIn, signedInAs } from "../http.ts";
import type { Access, Scope } from "../scope.ts";
import { keptThumbnails } from "./thumbnails.ts";
import { addCopiedVersion, addEvent, versionsOf } from "./versions.ts";

/** The largest banner image, in bytes. */
const MAX_BANNER_BYTES = 5 * 1024 * 1024;

interface RoomRow {
    id: string;
    title: string;
    description: string | null;
    banner_color: string | null;
    /** 1 for a room with a banner image. */
    has_banner_image: number;
    banner_changed_at: number;
    updated_at: number;
    token: string | null;
    staged_at: number | null;
    staged_by: string | null;
    staged_by_name: string | null;
}

type FileRow = AssetRow & {
    file_description: string | null;
    source_asset_id: string | null;
    source_name: string;
    source_version: number;
    source_published: number | null;
    approved_version: number;
    on_frontstage: number;
};

const FILE_COLUMNS = `${ASSET_COLUMNS}, room_file.description AS file_description, room_file.source_asset_id,
    room_file.source_name, room_file.source_version, source.published_version AS source_published,
    (
        SELECT MAX(number) FROM versions AS approved
        WHERE approved.tenant_id = assets.tenant_id AND approved.asset_id = assets.id
            AND approved.status = 'approved'
    ) AS approved_version,
    EXISTS (
        SELECT 1 FROM frontstage_files
        WHERE frontstage_files.tenant_id = assets.tenant_id AND frontstage_files.asset_id = assets.id
    ) AS on_frontstage`;

const FILES = `${ASSETS} LEFT JOIN assets AS source ON source.tenant_id = room_file.tenant_id
    AND source.id = room_file.source_asset_id`;

function fileOfRow(row: FileRow): DealRoomFile {
    const copied = row.source_version;
    const published = row.source_published;
    return {
        asset: assetOfRow(row),
        description: row.file_description,
        source: {
            id: row.source_asset_id,
            name: row.source_name,
            version: copied,
            publishedInstead: published !== null && published !== copied ? published : null,
        },
        approvedVersion: row.approved_version,
        onFrontstage: row.on_frontstage === 1,
    };
}

const NO_SUCH_ROOM = () => new Refusal(404, "notFound", "no such deal room");

const NO_SUCH_FILE = () => new Refusal(404, "notFound", "no such file in this deal room");

/** A room's files, in their order. */
function filesOf(db: TenantDb, roomId: string): DealRoomFile[] {
    const rows = db
        .prepare(
            `SELECT ${FILE_COLUMNS} FROM ${FILES}
            WHERE assets.tenant_id = :tenant AND room_file.room_id = ? ORDER BY room_file.position`,
        )
        .all(roomId) as unknown as FileRow[];
    return rows.map(fileOfRow);
}

/** Note that room `id` has changed. */
function touch(db: TenantDb, id: string, at = Date.now()): void {
    db.prepare("UPDATE deal_rooms SET updated_at = ? WHERE tenant_id = :tenant AND id = ?").run(at, id);
}

/**
 * The sessions of room `roomId`, the latest first: those of file `asset` at
 * `version`, or session `session` alone. Each names its file, and its visitor
 * by the room's visitors numbered as they first came, from 1.
 */
function sessionsOf(
    db: TenantDb,
    roomId: string,
    which: { asset?: string; version?: number; session?: string },
): { assetId: string; session: ReadingSession }[] {
    const rows = db
        .prepare(
            `SELECT session.id, session.asset_id, session.version, session.started_at,
                (
                    SELECT COUNT(*) FROM frontstage_visitors AS earlier
                    WHERE earlier.tenant_id = visitor.tenant_id AND earlier.room_id = visitor.room_id
                        AND (earlier.first_at < visitor.first_at
                            OR (earlier.first_at = visitor.first_at AND earlier.id <= visitor.id))
                ) AS visitor,
                coalesce(MAX(view.ended_ms), 0) AS length
            FROM frontstage_sessions AS session
            JOIN frontstage_visitors AS visitor ON visitor.tenant_id = session.tenant_id
                AND visitor.room_id = session.room_id AND visitor.id = session.visitor_id
            LEFT JOIN frontstage_page_views AS view ON view.tenant_id = session.tenant_id
                AND view.session_id = session.id
            WHERE session.tenant_id = :tenant AND session.room_id = :room
                AND (:asset IS NULL OR session.asset_id = :asset)
                AND (:version IS NULL OR session.version = :version)
                AND (:session IS NULL OR session.id = :session)
            GROUP BY session.id
            ORDER BY session.started_at DESC, session.id`,
        )
        .all({
            room: roomId,
            asset: which.asset ?? null,
            version: which.version ?? null,
            session: which.session ?? null,
        }) as unknown as {
        id: string;
        asset_id: string;
        version: number;
        started_at: number;
        visitor: number;
        length: number;
    }[];
    // How long each was read: its views, in order, each session's together.
    const views = db
        .prepare(
            `SELECT view.session_id, view.started_ms AS "from", view.ended_ms AS "to"
            FROM frontstage_page_views AS view
            JOIN frontstage_sessions AS session ON session.tenant_id = view.tenant_id AND session.id = view.session_id
            WHERE view.tenant_id = :tenant AND session.room_id = :room
                AND (:asset IS NULL OR session.asset_id = :asset)
                AND (:version IS NULL OR session.version = :version)
                AND (:session IS NULL OR session.id = :session)
            ORDER BY view.session_id, view.started_ms`,
        )
        .all({
            room: roomId,
            asset: which.asset ?? null,
            version: which.version ?? null,
            session: which.session ?? null,
        }) as unknown as (Interval & { session_id: string })[];
    const viewsOf = bySession(views);
    return rows.map((row) => ({
        assetId: row.asset_id,
        session: {
            id: row.id,
            visitor: row.visitor,
            version: row.version,
            startedAt: row.started_at,
            length: row.length,
            ms: readingTime(viewsOf.get(row.id) ?? []),
        },
    }));
}

/** A stretch of time, in milliseconds since a session began. */
interface Interval {
    from: number;
    to: number;
}

/** `views`, each session's together, in the order they came. */
function bySession<T extends { session_id: string }>(views: T[]): Map<string, T[]> {
    const grouped = new Map<string, T[]>();
    for (const view of views) {
        const its = grouped.get(view.session_id);
        if (its) its.push(view);
        else grouped.set(view.session_id, [view]);
    }
    return grouped;
}

/** How long anything was on screen in `views`, in the order they began: pages on screen together count once. */
function readingTime(views: Interval[]): number {
    let total = 0;
    let reached = -Infinity;
    for (const { from, to } of views) {
        if (to <= reached) continue;
        total += to - Math.max(from, reached);
        reached = to;
    }
    return total;
}

export function dealRoomRoutes(app: FastifyInstance, access: Access): void {
    /** What's the user's signed in, who sells; a `403` for one who doesn't. */
    const seller = (request: FastifyRequest): Scope => signedInAs(access, request, sellsDeals);

    /** The rooms the user enters, changed last first, or with `only`, that one alone. */
    function roomsFor({ user, db }: Scope, only: string | null = null): DealRoom[] {
        const rows = db
            .prepare(
                `SELECT rooms.id, rooms.title, rooms.description, rooms.banner_color,
                    rooms.banner_image IS NOT NULL AS has_banner_image, rooms.banner_changed_at, rooms.updated_at,
                    stage.token, stage.staged_at, stage.staged_by, stager.name AS staged_by_name
                FROM deal_rooms AS rooms
                LEFT JOIN frontstages AS stage ON stage.tenant_id = rooms.tenant_id AND stage.room_id = rooms.id
                LEFT JOIN users AS stager ON stager.tenant_id = stage.tenant_id AND stager.id = stage.staged_by
                WHERE rooms.tenant_id = :tenant AND (:only IS NULL OR rooms.id = :only) AND (
                    :all = 1 OR EXISTS (
                        SELECT 1 FROM deal_room_people AS person
                        WHERE person.tenant_id = rooms.tenant_id AND person.room_id = rooms.id
                            AND person.user_id = :me
                    )
                )
                ORDER BY rooms.updated_at DESC`,
            )
            .all({
                only,
                all: entersAllDealRooms(user.role) ? 1 : 0,
                me: user.id,
            }) as unknown as RoomRow[];
        const people = db.prepare(
            `SELECT users.id, users.name, users.title FROM deal_room_people AS person
            JOIN users ON users.tenant_id = person.tenant_id AND users.id = person.user_id
            WHERE person.tenant_id = :tenant AND person.room_id = ? ORDER BY users.name COLLATE NOCASE`,
        );
        return rows.map((row) => {
            const files = filesOf(db, row.id);
            return {
                id: row.id,
                title: row.title,
                description: row.description,
                banner: {
                    color: row.banner_color,
                    image: row.has_banner_image ? `/api/deal-rooms/${row.id}/banner?v=${row.banner_changed_at}` : null,
                },
                updatedAt: row.updated_at,
                people: people.all(row.id) as unknown as Seller[],
                files,
                frontstage:
                    row.token === null
                        ? null
                        : {
                              token: row.token,
                              at: row.staged_at!,
                              by: { id: row.staged_by!, name: row.staged_by_name! },
                              behind:
                                  row.updated_at > row.staged_at! ||
                                  files.some(
                                      (file) =>
                                          file.onFrontstage && file.approvedVersion !== file.asset.publishedVersion,
                                  ),
                          },
            };
        });
    }

    /** Room `id`, if the user enters it; a `404` otherwise, as a room that isn't there. */
    function roomFor(scope: Scope, id: string): DealRoom {
        const [room] = roomsFor(scope, id);
        if (!room) throw NO_SUCH_ROOM();
        return room;
    }

    /** `{ rooms }`: those the user enters, changed last first. */
    app.get("/api/deal-rooms", async (request): Promise<{ rooms: DealRoom[] }> => {
        return { rooms: roomsFor(seller(request)) };
    });

    /** `{ sellers }`: those at the user's tenant who can be on a room, by name. */
    app.get("/api/deal-rooms/sellers", async (request): Promise<{ sellers: Seller[] }> => {
        const { db } = seller(request);
        const rows = db
            .prepare("SELECT id, name, title, role FROM users WHERE tenant_id = :tenant ORDER BY name COLLATE NOCASE")
            .all() as unknown as (Seller & { role: Role })[];
        return {
            sellers: rows.filter(({ role }) => sellsDeals(role)).map(({ id, name, title }) => ({ id, name, title })),
        };
    });

    /**
     * `{ rooms }`: the rooms the user is on, with visitors since they last looked, as
     * a `DealRoomNews`, those who came last first. A manager who enters a room without
     * being on it sees what's there by opening it, and isn't told.
     */
    app.get("/api/deal-rooms/news", async (request): Promise<{ rooms: DealRoomNews[] }> => {
        const scope = seller(request);
        const rows = scope.db
            .prepare(
                `SELECT visitor.room_id, COUNT(*) AS visitors, MAX(visitor.last_at) AS at
                FROM frontstage_visitors AS visitor
                JOIN deal_room_people AS person ON person.tenant_id = visitor.tenant_id
                    AND person.room_id = visitor.room_id AND person.user_id = :me
                WHERE visitor.tenant_id = :tenant AND visitor.last_at > person.activity_seen_at
                GROUP BY visitor.room_id ORDER BY at DESC`,
            )
            .all({ me: scope.user.id }) as unknown as { room_id: string; visitors: number; at: number }[];
        return {
            rooms: rows.map(({ room_id: roomId, visitors, at }) => ({ room: roomFor(scope, roomId), visitors, at })),
        };
    });

    /** Make a room, `{ title, description }`, with the user on it: `201 { room }`. */
    app.post<{ Body: { title?: unknown; description?: unknown } | undefined }>(
        "/api/deal-rooms",
        async (request, reply) => {
            const scope = seller(request);
            const { user, db } = scope;
            const id = randomUUID();
            const title = nameOf(request.body?.title);
            const description = noteOf(request.body?.description);
            db.transaction(() => {
                db.prepare(
                    "INSERT INTO deal_rooms (tenant_id, id, title, description, updated_at) VALUES (:tenant, ?, ?, ?, ?)",
                ).run(id, title, description, Date.now());
                db.prepare("INSERT INTO deal_room_people (tenant_id, room_id, user_id) VALUES (:tenant, ?, ?)").run(
                    id,
                    user.id,
                );
            });
            return reply.code(201).send({ room: roomFor(scope, id) });
        },
    );

    /** `{ room }`: one, with its files, its people and how its frontstage stands. */
    app.get<{ Params: { id: string } }>("/api/deal-rooms/:id", async (request) => {
        return { room: roomFor(seller(request), request.params.id) };
    });

    /** Change what a room says of itself, `{ title, description, bannerColor }`: `{ room }`. Its frontstage stays as it is. */
    app.patch<{
        Params: { id: string };
        Body: { title?: unknown; description?: unknown; bannerColor?: unknown } | undefined;
    }>("/api/deal-rooms/:id", async (request) => {
        const scope = seller(request);
        const { id } = roomFor(scope, request.params.id);
        const color = request.body?.bannerColor ?? null;
        if (color !== null && (typeof color !== "string" || !COLOR.test(color)))
            throw new Refusal(400, "badRequest", "a banner's color is #rrggbb, or null for the tenant's");
        scope.db
            .prepare(
                `UPDATE deal_rooms SET title = ?, description = ?, banner_color = ?, updated_at = ?
                WHERE tenant_id = :tenant AND id = ?`,
            )
            .run(
                nameOf(request.body?.title),
                noteOf(request.body?.description),
                color?.toLowerCase() ?? null,
                Date.now(),
                id,
            );
        return { room: roomFor(scope, id) };
    });

    /** Delete a room, its files and their documents, and with them its frontstage: `204`. */
    app.delete<{ Params: { id: string } }>("/api/deal-rooms/:id", async (request, reply) => {
        const scope = seller(request);
        const { db, documents } = scope;
        const { id, files } = roomFor(scope, request.params.id);
        for (const { asset } of files) await documents.deleteDocument(asset.documentId);
        db.transaction(() => {
            const remove = db.prepare("DELETE FROM assets WHERE tenant_id = :tenant AND id = ?");
            for (const { asset } of files) remove.run(asset.id);
            db.prepare("DELETE FROM deal_rooms WHERE tenant_id = :tenant AND id = ?").run(id);
        });
        return reply.code(204).send();
    });

    /** A `DealRoomActivity`: how buyers read the room's frontstage. */
    app.get<{ Params: { id: string } }>("/api/deal-rooms/:id/activity", async (request): Promise<DealRoomActivity> => {
        const scope = seller(request);
        const { db } = scope;
        const { id, files } = roomFor(scope, request.params.id);
        const visits = db
            .prepare(
                `SELECT COUNT(*) AS visitors, MAX(last_at) AS last_at FROM frontstage_visitors
                WHERE tenant_id = :tenant AND room_id = ?`,
            )
            .get(id) as { visitors: number; last_at: number | null };
        const opened = db.prepare(
            `SELECT COUNT(DISTINCT visitor_id) AS visitors, COUNT(*) AS sessions, MAX(started_at) AS last_at
            FROM frontstage_sessions WHERE tenant_id = :tenant AND asset_id = ?`,
        );
        const read = db.prepare(
            `SELECT view.session_id, view.started_ms AS "from", view.ended_ms AS "to" FROM frontstage_page_views AS view
            JOIN frontstage_sessions AS session ON session.tenant_id = view.tenant_id AND session.id = view.session_id
            WHERE view.tenant_id = :tenant AND session.asset_id = ? ORDER BY view.session_id, view.started_ms`,
        );
        return {
            visitors: visits.visitors,
            lastVisitAt: visits.last_at,
            files: files.flatMap(({ asset, onFrontstage }) => {
                const each = opened.get(asset.id) as { visitors: number; sessions: number; last_at: number | null };
                if (!onFrontstage && each.sessions === 0) return [];
                const views = read.all(asset.id) as unknown as (Interval & { session_id: string })[];
                const viewsOf = bySession(views);
                return [
                    {
                        assetId: asset.id,
                        visitors: each.visitors,
                        sessions: each.sessions,
                        ms: [...viewsOf.values()].reduce((sum, its) => sum + readingTime(its), 0),
                        lastOpenedAt: each.last_at,
                    },
                ];
            }),
        };
    });

    /**
     * A `DocumentActivity`: how buyers read file `assetId` of the room, a session
     * at a time, at the version its last session read, or else the one on the
     * frontstage. `404` for a file the room doesn't hold.
     */
    app.get<{ Params: { id: string; assetId: string } }>(
        "/api/deal-rooms/:id/activity/files/:assetId",
        async (request): Promise<DocumentActivity> => {
            const scope = seller(request);
            const { db } = scope;
            const room = roomFor(scope, request.params.id);
            const asset = room.files.find((file) => file.asset.id === request.params.assetId)?.asset;
            if (!asset) throw new Refusal(404, "notFound", "no such file");
            const last = db
                .prepare(
                    `SELECT version FROM frontstage_sessions WHERE tenant_id = :tenant AND asset_id = ?
                    ORDER BY started_at DESC LIMIT 1`,
                )
                .get(asset.id) as { version: number } | undefined;
            const version = last?.version ?? asset.publishedVersion;
            if (version === null) return { assetId: asset.id, version, thumbnails: null, sessions: [], pages: [] };
            const sessions = sessionsOf(db, room.id, { asset: asset.id, version });
            const reads = db
                .prepare(
                    `SELECT view.session_id AS id, view.page, SUM(view.ended_ms - view.started_ms) AS ms
                    FROM frontstage_page_views AS view
                    JOIN frontstage_sessions AS session ON session.tenant_id = view.tenant_id
                        AND session.id = view.session_id
                    WHERE view.tenant_id = :tenant AND session.room_id = ? AND session.asset_id = ?
                        AND session.version = ?
                    GROUP BY view.session_id, view.page`,
                )
                .all(room.id, asset.id, version) as unknown as { id: string; page: number; ms: number }[];
            const thumbnails = keptThumbnails(db, asset.id, version);
            const pageCount = Math.max(thumbnails?.pageCount ?? 0, ...reads.map(({ page }) => page + 1));
            // Each page's sessions in the sessions' order, the latest first.
            const order = new Map(sessions.map(({ session }, index) => [session.id, index]));
            const pages = Array.from({ length: pageCount }, (_, page) => {
                const its = reads
                    .filter((read) => read.page === page)
                    .sort((x, y) => order.get(x.id)! - order.get(y.id)!)
                    .map(({ id, ms }) => ({ id, ms }));
                return { page, ms: its.reduce((sum, { ms }) => sum + ms, 0), sessions: its };
            });
            return { assetId: asset.id, version, thumbnails, sessions: sessions.map(({ session }) => session), pages };
        },
    );

    /** A `SessionActivity`: one session of a file of the room, as it happened. `404` for none of the room's. */
    app.get<{ Params: { id: string; sessionId: string } }>(
        "/api/deal-rooms/:id/activity/sessions/:sessionId",
        async (request): Promise<SessionActivity> => {
            const scope = seller(request);
            const { db } = scope;
            const room = roomFor(scope, request.params.id);
            const [found] = sessionsOf(db, room.id, { session: request.params.sessionId });
            if (!found) throw new Refusal(404, "notFound", "no such session");
            const { assetId, session } = found;
            const views = db
                .prepare(
                    `SELECT page, started_ms AS "from", ended_ms AS "to" FROM frontstage_page_views
                    WHERE tenant_id = :tenant AND session_id = ? ORDER BY started_ms`,
                )
                .all(session.id) as unknown as PageView[];
            const thumbnails = keptThumbnails(db, assetId, session.version);
            const pageCount = Math.max(thumbnails?.pageCount ?? 0, ...views.map(({ page }) => page + 1));
            return { assetId, session, thumbnails, pageCount, views };
        },
    );

    /** Note that the user, if they're on the room, has looked at what buyers did: `204`. */
    app.post<{ Params: { id: string } }>("/api/deal-rooms/:id/activity/seen", async (request, reply) => {
        const scope = seller(request);
        const { id } = roomFor(scope, request.params.id);
        scope.db
            .prepare(
                "UPDATE deal_room_people SET activity_seen_at = ? WHERE tenant_id = :tenant AND room_id = ? AND user_id = ?",
            )
            .run(Date.now(), id, scope.user.id);
        return reply.code(204).send();
    });

    /** A room's banner image; `404` when it has none. */
    app.get<{ Params: { id: string } }>("/api/deal-rooms/:id/banner", async (request, reply) => {
        const scope = seller(request);
        const { id } = roomFor(scope, request.params.id);
        const image = scope.db
            .prepare(
                `SELECT banner_image, banner_image_type, banner_changed_at FROM deal_rooms
                WHERE tenant_id = :tenant AND id = ? AND banner_image IS NOT NULL`,
            )
            .get(id) as { banner_image: Uint8Array; banner_image_type: string; banner_changed_at: number } | undefined;
        if (!image) throw new Refusal(404, "notFound", "no such image");
        const tag = `banner-${id}-${image.banner_changed_at}`;
        return sendImage(request, reply, tag, image.banner_image_type, image.banner_image);
    });

    /** Replace a room's banner image with the body, a PNG, JPEG, WebP or SVG of at most 5 MB: `{ room }`. */
    app.put<{ Params: { id: string }; Body: unknown }>("/api/deal-rooms/:id/banner", async (request) => {
        const scope = seller(request);
        const { id } = roomFor(scope, request.params.id);
        const bytes = request.body;
        if (!(bytes instanceof Buffer) || bytes.length === 0)
            throw new Refusal(400, "badRequest", "the body is the image's bytes, as application/octet-stream");
        if (bytes.length > MAX_BANNER_BYTES)
            throw new Refusal(413, "payloadTooLarge", "a banner image is at most 5 MB");
        const type = imageTypeOf(bytes);
        if (!type) throw new Refusal(415, "unsupportedImage", "a banner image is a PNG, a JPEG, a WebP or an SVG");
        const at = Date.now();
        scope.db
            .prepare(
                `UPDATE deal_rooms SET banner_image = ?, banner_image_type = ?, banner_changed_at = ?, updated_at = ?
                WHERE tenant_id = :tenant AND id = ?`,
            )
            .run(bytes, type, at, at, id);
        return { room: roomFor(scope, id) };
    });

    /** Remove a room's banner image: `{ room }`. */
    app.delete<{ Params: { id: string } }>("/api/deal-rooms/:id/banner", async (request) => {
        const scope = seller(request);
        const { id } = roomFor(scope, request.params.id);
        const at = Date.now();
        scope.db
            .prepare(
                `UPDATE deal_rooms SET banner_image = NULL, banner_image_type = NULL, banner_changed_at = ?,
                    updated_at = ?
                WHERE tenant_id = :tenant AND id = ?`,
            )
            .run(at, at, id);
        return { room: roomFor(scope, id) };
    });

    /**
     * Say who's on a room, `{ userIds }`, all of them: `{ room }`; `400` for one who
     * doesn't sell at the user's tenant, or a member taking themselves off, who
     * would lose the room with no way back.
     */
    app.put<{ Params: { id: string }; Body: { userIds?: unknown } | undefined }>(
        "/api/deal-rooms/:id/people",
        async (request) => {
            const scope = seller(request);
            const { user, db } = scope;
            const { id } = roomFor(scope, request.params.id);
            const userIds = [...new Set(idsOf(request.body?.userIds))];
            const ofTenant = db.prepare("SELECT role FROM users WHERE tenant_id = :tenant AND id = ?");
            for (const userId of userIds) {
                const row = ofTenant.get(userId) as { role: Role } | undefined;
                if (!row || !sellsDeals(row.role)) throw new Refusal(400, "notASeller", "that person doesn't sell");
            }
            if (!entersAllDealRooms(user.role) && !userIds.includes(user.id))
                throw new Refusal(400, "badRequest", "you can't take yourself off a room");
            db.transaction(() => {
                // One who stays on keeps when they last looked at what buyers did.
                const onIt = db
                    .prepare("SELECT user_id FROM deal_room_people WHERE tenant_id = :tenant AND room_id = ?")
                    .all(id) as unknown as { user_id: string }[];
                const remove = db.prepare(
                    "DELETE FROM deal_room_people WHERE tenant_id = :tenant AND room_id = ? AND user_id = ?",
                );
                for (const { user_id: userId } of onIt) if (!userIds.includes(userId)) remove.run(id, userId);
                const add = db.prepare(
                    "INSERT OR IGNORE INTO deal_room_people (tenant_id, room_id, user_id) VALUES (:tenant, ?, ?)",
                );
                for (const userId of userIds) add.run(id, userId);
                touch(db, id);
            });
            return { room: roomFor(scope, id) };
        },
    );

    /**
     * Add files to a room's end, `{ assetIds }`, each one that's in a collection,
     * copied at the version the library publishes now: `{ room }`; `400` for another.
     * One copied already stays as it is. All of them are copied, or none.
     */
    app.post<{ Params: { id: string }; Body: { assetIds?: unknown } | undefined }>(
        "/api/deal-rooms/:id/files",
        async (request) => {
            const scope = seller(request);
            const { user, db, documents } = scope;
            const room = roomFor(scope, request.params.id);
            const held = new Set(room.files.map(({ source }) => source.id));
            const inCollection = db.prepare(
                `SELECT ${PUBLISHED_FILE_COLUMNS} FROM ${PUBLISHED_FILES}
                WHERE assets.tenant_id = :tenant AND assets.id = ? AND EXISTS (
                    SELECT 1 FROM collection_items AS item
                    WHERE item.tenant_id = assets.tenant_id AND item.asset_id = assets.id
                )`,
            );
            const sources: PublishedFile[] = [];
            for (const assetId of new Set(idsOf(request.body?.assetIds))) {
                if (held.has(assetId)) continue;
                const row = inCollection.get(assetId) as PublishedFileRow | undefined;
                if (!row) throw new Refusal(400, "notInCollection", "only a file in a collection goes in a deal room");
                sources.push(publishedFileOfRow(row));
            }
            const copies: { assetId: string; documentId: string; size: number; source: PublishedFile }[] = [];
            try {
                for (const source of sources) {
                    const copy = await documents.copyCheckpoint(source.documentId, source.checkpoint, source.format);
                    copies.push({ assetId: randomUUID(), documentId: copy.id, size: copy.size, source });
                }
                db.transaction(() => {
                    const at = Date.now();
                    for (const { assetId, documentId, size, source } of copies) {
                        db.prepare(
                            `INSERT INTO assets (tenant_id, id, name, format, size, document_id, uploaded_by, uploaded_at)
                            VALUES (:tenant, ?, ?, ?, ?, ?, ?, ?)`,
                        ).run(assetId, source.name, source.format, size, documentId, user.id, at);
                        addCopiedVersion(
                            db,
                            assetId,
                            user.id,
                            at,
                            `Copied from version ${source.version} of “${source.name}”, as the library published it`,
                        );
                        db.prepare(
                            `INSERT INTO deal_room_files (tenant_id, asset_id, room_id, position, source_asset_id,
                                source_name, source_version)
                            VALUES (:tenant, :asset, :room, (
                                SELECT coalesce(MAX(position), -1) + 1 FROM deal_room_files
                                WHERE tenant_id = :tenant AND room_id = :room
                            ), :source, :name, :version)`,
                        ).run({
                            asset: assetId,
                            room: room.id,
                            source: source.id,
                            name: source.name,
                            version: source.version,
                        });
                        // The pages as they were published: the copy's first version is that.
                        db.prepare(
                            `INSERT INTO thumbnails (tenant_id, asset_id, number, page, png)
                            SELECT tenant_id, ?, 1, page, png FROM thumbnails
                            WHERE tenant_id = :tenant AND asset_id = ? AND number = ?`,
                        ).run(assetId, source.id, source.version);
                    }
                    touch(db, room.id, at);
                });
            } catch (error) {
                for (const { documentId } of copies) await documents.deleteDocument(documentId);
                throw error;
            }
            return { room: roomFor(scope, room.id) };
        },
    );

    /** A file of room `roomId`, for the user: a `404` for none, or one who has no business with it. */
    function fileFor({ user, db }: Scope, roomId: string, assetId: string): { file: DealRoomFile; enters: boolean } {
        const row = db
            .prepare(
                `SELECT ${FILE_COLUMNS} FROM ${FILES}
                WHERE assets.tenant_id = :tenant AND room_file.room_id = ? AND room_file.asset_id = ?`,
            )
            .get(roomId, assetId) as FileRow | undefined;
        if (!row) throw NO_SUCH_FILE();
        const enters = entersDealRoom(db, user, roomId);
        if (!enters && !anySentToReview(db, user, assetId)) throw NO_SUCH_FILE();
        return { file: fileOfRow(row), enters };
    }

    /** A `DealRoomFileDetail`, for those who enter the room, and a reviewer sent one of its versions. */
    app.get<{ Params: { id: string; assetId: string } }>(
        "/api/deal-rooms/:id/files/:assetId",
        async (request): Promise<DealRoomFileDetail> => {
            const scope = signedIn(access, request);
            const { user, db } = scope;
            const { id, assetId } = request.params;
            const { file, enters } = fileFor(scope, id, assetId);
            const room = db
                .prepare("SELECT id, title FROM deal_rooms WHERE tenant_id = :tenant AND id = ?")
                .get(id) as {
                id: string;
                title: string;
            };
            const versions = versionsOf(db, assetId);
            return {
                room,
                file,
                versions: enters ? versions : versions.filter((version) => version.reviewer?.id === user.id),
            };
        },
    );

    /** Change what a room's file says, `{ name, description }`: `{ room }`. */
    app.patch<{
        Params: { id: string; assetId: string };
        Body: { name?: unknown; description?: unknown } | undefined;
    }>("/api/deal-rooms/:id/files/:assetId", async (request) => {
        const scope = seller(request);
        const { db } = scope;
        const { id } = roomFor(scope, request.params.id);
        const { assetId } = request.params;
        const name = nameOf(request.body?.name);
        const description = noteOf(request.body?.description);
        db.transaction(() => {
            const { changes } = db
                .prepare(
                    "UPDATE deal_room_files SET description = ? WHERE tenant_id = :tenant AND room_id = ? AND asset_id = ?",
                )
                .run(description, id, assetId);
            if (changes === 0) throw NO_SUCH_FILE();
            db.prepare("UPDATE assets SET name = ? WHERE tenant_id = :tenant AND id = ?").run(name, assetId);
            touch(db, id);
        });
        return { room: roomFor(scope, id) };
    });

    /** Take a file out of a room and off its frontstage, and delete its document: `{ room }`. */
    app.delete<{ Params: { id: string; assetId: string } }>("/api/deal-rooms/:id/files/:assetId", async (request) => {
        const scope = seller(request);
        const { db, documents } = scope;
        const { id, files } = roomFor(scope, request.params.id);
        const found = files.find(({ asset }) => asset.id === request.params.assetId);
        if (!found) throw NO_SUCH_FILE();
        await documents.deleteDocument(found.asset.documentId);
        db.transaction(() => {
            db.prepare("DELETE FROM assets WHERE tenant_id = :tenant AND id = ?").run(found.asset.id);
            touch(db, id);
        });
        return { room: roomFor(scope, id) };
    });

    /**
     * Put a room's files in order, `{ assetIds }`, all of them, first first:
     * `{ room }`; `409` for a list that isn't what's in it now.
     */
    app.put<{ Params: { id: string }; Body: { assetIds?: unknown } | undefined }>(
        "/api/deal-rooms/:id/order",
        async (request) => {
            const scope = seller(request);
            const { db } = scope;
            const { id, files } = roomFor(scope, request.params.id);
            const assetIds = idsOf(request.body?.assetIds);
            const given = new Set(assetIds);
            if (
                given.size !== assetIds.length ||
                given.size !== files.length ||
                !files.every(({ asset }) => given.has(asset.id))
            )
                throw new Refusal(409, "orderStale", "the list isn't what's in the room now");
            db.transaction(() => {
                const place = db.prepare(
                    "UPDATE deal_room_files SET position = ? WHERE tenant_id = :tenant AND asset_id = ?",
                );
                assetIds.forEach((assetId, position) => place.run(position, assetId));
                touch(db, id);
            });
            return { room: roomFor(scope, id) };
        },
    );

    /**
     * Put a room on its frontstage as it stands, or update what's there, `{ assetIds }`,
     * the files to show: what it says of itself and of each file is copied, each file
     * chosen goes on at its latest approved version, and any other comes off. A room
     * keeps its link while it stays on. `{ room }`; `400` for no files, or one not in it.
     */
    app.put<{ Params: { id: string }; Body: { assetIds?: unknown } | undefined }>(
        "/api/deal-rooms/:id/frontstage",
        async (request) => {
            const scope = seller(request);
            const { user, db } = scope;
            const { id, files } = roomFor(scope, request.params.id);
            const chosen = new Set(idsOf(request.body?.assetIds));
            if (chosen.size === 0) throw new Refusal(400, "badRequest", "choose a file to show");
            for (const assetId of chosen) if (!files.some(({ asset }) => asset.id === assetId)) throw NO_SUCH_FILE();
            const at = Date.now();
            db.transaction(() => {
                const kept = db
                    .prepare("SELECT token FROM frontstages WHERE tenant_id = :tenant AND room_id = ?")
                    .get(id) as { token: string } | undefined;
                db.prepare(
                    `INSERT INTO frontstages (tenant_id, room_id, token, title, description, banner_color, banner_image,
                        banner_image_type, staged_by, staged_at)
                    SELECT tenant_id, id, :token, title, description, banner_color, banner_image, banner_image_type,
                        :by, :at
                    FROM deal_rooms WHERE tenant_id = :tenant AND id = :id
                    ON CONFLICT (tenant_id, room_id) DO UPDATE SET title = excluded.title,
                        description = excluded.description,
                        banner_color = excluded.banner_color, banner_image = excluded.banner_image,
                        banner_image_type = excluded.banner_image_type, staged_by = excluded.staged_by,
                        staged_at = excluded.staged_at`,
                ).run({ id, token: kept?.token ?? randomBytes(32).toString("base64url"), by: user.id, at });
                db.prepare("DELETE FROM frontstage_files WHERE tenant_id = :tenant AND room_id = ?").run(id);
                const publish = db.prepare(
                    "UPDATE assets SET published_version = ? WHERE tenant_id = :tenant AND id = ?",
                );
                const show = db.prepare(
                    `INSERT INTO frontstage_files (tenant_id, room_id, asset_id, name, description, position)
                    VALUES (:tenant, ?, ?, ?, ?, ?)`,
                );
                files.forEach(({ asset, description, approvedVersion }, position) => {
                    if (!chosen.has(asset.id)) {
                        publish.run(null, asset.id);
                        return;
                    }
                    publish.run(approvedVersion, asset.id);
                    show.run(id, asset.id, asset.name, description, position);
                    if (approvedVersion !== asset.publishedVersion)
                        addEvent(db, {
                            assetId: asset.id,
                            number: approvedVersion,
                            kind: "published",
                            userId: user.id,
                            at,
                            note: null,
                        });
                });
                touch(db, id, at);
            });
            return { room: roomFor(scope, id) };
        },
    );

    /** Take a room off its frontstage: `{ room }`. Its link stops working, for good; putting it back makes a new one. */
    app.delete<{ Params: { id: string } }>("/api/deal-rooms/:id/frontstage", async (request) => {
        const scope = seller(request);
        const { db } = scope;
        const { id, files } = roomFor(scope, request.params.id);
        db.transaction(() => {
            db.prepare("DELETE FROM frontstages WHERE tenant_id = :tenant AND room_id = ?").run(id);
            const unpublish = db.prepare(
                "UPDATE assets SET published_version = NULL WHERE tenant_id = :tenant AND id = ?",
            );
            for (const { asset } of files) unpublish.run(asset.id);
            touch(db, id);
        });
        return { room: roomFor(scope, id) };
    });
}
