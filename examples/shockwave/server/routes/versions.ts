// A file's versions: `/api/assets/:id/versions`. A version is a checkpoint of
// the file's document, which udoc-server keeps as it was whatever happens to
// the document after, so the document goes on being edited while a version is
// reviewed, and what's approved and published is exactly what was read. A
// version is saved as a draft, submitted, then approved or returned; one
// returned stays so, and what changes goes in a new version. Any approved
// version may be published, an older one taking the file back to it.
import type { DatabaseSync } from "node:sqlite";

import type { FastifyInstance } from "fastify";

import { managesLibrary, readsLibrary, reviewsLibrary } from "../../shared/api.ts";
import type { Role, Version, VersionEvent, VersionStatus, VersionStep, VersionedAsset } from "../../shared/api.ts";
import { assetOf } from "../assets.ts";
import { inTransaction } from "../db.ts";
import { Refusal, signedInAs } from "../http.ts";
import type { Udoc } from "../udoc.ts";
import { keepThumbnail } from "./thumbnails.ts";

/** The longest note a version's event keeps. */
const MAX_NOTE = 2000;

/** What each step asks of a version and its user, and what it leaves. */
const STEPS: Record<
    VersionStep,
    {
        may: (role: Role) => boolean;
        from: VersionStatus;
        to: VersionStatus;
        event: VersionEvent["kind"];
        needsNote?: boolean;
    }
> = {
    submit: { may: managesLibrary, from: "draft", to: "submitted", event: "submitted" },
    approve: { may: reviewsLibrary, from: "submitted", to: "approved", event: "approved" },
    return: { may: reviewsLibrary, from: "submitted", to: "returned", event: "returned", needsNote: true },
    publish: { may: managesLibrary, from: "approved", to: "approved", event: "published" },
};

interface EventRow {
    number: number;
    kind: VersionEvent["kind"];
    user_id: string;
    user_name: string;
    at: number;
    note: string | null;
}

/** A file's versions, newest first. */
function versionsOf(db: DatabaseSync, assetId: string): Version[] {
    const rows = db
        .prepare("SELECT number, checkpoint, status FROM versions WHERE asset_id = ? ORDER BY number DESC")
        .all(assetId) as unknown as Omit<Version, "events">[];
    const events = db
        .prepare(
            `SELECT number, kind, user_id, users.name AS user_name, at, note
            FROM version_events JOIN users ON users.id = version_events.user_id
            WHERE asset_id = ? ORDER BY version_events.id`,
        )
        .all(assetId) as unknown as EventRow[];
    return rows.map(({ number, checkpoint, status }) => ({
        number,
        checkpoint,
        status,
        events: events
            .filter((event) => event.number === number)
            .map(({ kind, user_id: id, user_name: name, at, note }) => ({ kind, by: { id, name }, at, note })),
    }));
}

/** Record that `userId` did `kind` to version `number` of file `assetId`. */
function addEvent(
    db: DatabaseSync,
    assetId: string,
    number: number,
    kind: VersionEvent["kind"],
    userId: string,
    at: number,
    note: string | null,
): void {
    db.prepare("INSERT INTO version_events (asset_id, number, kind, user_id, at, note) VALUES (?, ?, ?, ?, ?, ?)").run(
        assetId,
        number,
        kind,
        userId,
        at,
        note,
    );
}

/** Record a new version of file `assetId`, checkpoint `checkpoint`, a draft: its number. Run in a transaction. */
function addVersion(
    db: DatabaseSync,
    assetId: string,
    checkpoint: number,
    userId: string,
    at: number,
    note: string | null,
): number {
    const { latest } = db.prepare("SELECT MAX(number) AS latest FROM versions WHERE asset_id = ?").get(assetId) as {
        latest: number | null;
    };
    const number = (latest ?? 0) + 1;
    db.prepare("INSERT INTO versions (asset_id, number, checkpoint, status) VALUES (?, ?, ?, 'draft')").run(
        assetId,
        number,
        checkpoint,
    );
    addEvent(db, assetId, number, "saved", userId, at, note);
    return number;
}

/** A new file's first version: its upload, the checkpoint importing it made. Run in a transaction. */
export function addFirstVersion(db: DatabaseSync, assetId: string, userId: string, at: number): void {
    addVersion(db, assetId, 0, userId, at, null);
}

/** `value`, a version's note, trimmed; `null` for none, and a `400` for one too long. */
function noteOf(value: unknown): string | null {
    const note = typeof value === "string" ? value.trim() : "";
    if (note.length > MAX_NOTE) throw new Refusal(400, "badRequest", `a note is at most ${MAX_NOTE} characters`);
    return note || null;
}

export function versionRoutes(app: FastifyInstance, db: DatabaseSync, udoc: Udoc): void {
    /** `{ versions }`: a file's versions, newest first. */
    app.get<{ Params: { id: string } }>("/api/assets/:id/versions", async (request) => {
        const user = signedInAs(db, request, readsLibrary);
        return { versions: versionsOf(db, assetOf(db, user, request.params.id).id) };
    });

    /**
     * Save the file's document as it is now as a new version, `{ note }`: a
     * checkpoint udoc-server takes, its first page kept as the file's
     * thumbnail. `201`, a `VersionedAsset`.
     */
    app.post<{ Params: { id: string }; Body: { note?: unknown } | undefined }>(
        "/api/assets/:id/versions",
        async (request, reply) => {
            const user = signedInAs(db, request, managesLibrary);
            const { id, documentId } = assetOf(db, user, request.params.id);
            const note = noteOf(request.body?.note);
            const checkpoint = await udoc.checkpoint(documentId);
            inTransaction(db, () => addVersion(db, id, checkpoint, user.id, Date.now(), note));
            try {
                await keepThumbnail(db, udoc, documentId);
            } catch (error) {
                // The version is kept all the same; the file shows the thumbnail it had.
                request.log.warn(error, "a thumbnail wasn't rendered");
            }
            const answer: VersionedAsset = { asset: assetOf(db, user, id), versions: versionsOf(db, id) };
            return reply.code(201).send(answer);
        },
    );

    /**
     * Take a step with version `number`, `{ note }`: a `VersionedAsset`; a
     * `403` for a user whose role doesn't take it, and a `409` for a version
     * not where it starts from, or already the one published.
     */
    for (const [step, { may, from, to, event, needsNote }] of Object.entries(STEPS)) {
        app.post<{ Params: { id: string; number: string }; Body: { note?: unknown } | undefined }>(
            `/api/assets/:id/versions/:number/${step}`,
            async (request): Promise<VersionedAsset> => {
                const user = signedInAs(db, request, may);
                const asset = assetOf(db, user, request.params.id);
                const number = Number(request.params.number);
                const row = db
                    .prepare("SELECT status FROM versions WHERE asset_id = ? AND number = ?")
                    .get(asset.id, number) as { status: VersionStatus } | undefined;
                if (!row) throw new Refusal(404, "notFound", "no such version");
                if (row.status !== from)
                    throw new Refusal(409, "wrongStatus", `only a version that's ${from} can take this step`);
                const publishing = step === "publish";
                if (publishing && asset.publishedVersion === number)
                    throw new Refusal(409, "wrongStatus", "this version is published already");
                const note = noteOf(request.body?.note);
                if (needsNote && !note) throw new Refusal(400, "badRequest", "a note is needed");
                inTransaction(db, () => {
                    db.prepare("UPDATE versions SET status = ? WHERE asset_id = ? AND number = ?").run(
                        to,
                        asset.id,
                        number,
                    );
                    if (publishing)
                        db.prepare("UPDATE assets SET published_version = ? WHERE id = ?").run(number, asset.id);
                    addEvent(db, asset.id, number, event, user.id, Date.now(), note);
                });
                return { asset: assetOf(db, user, asset.id), versions: versionsOf(db, asset.id) };
            },
        );
    }
}
