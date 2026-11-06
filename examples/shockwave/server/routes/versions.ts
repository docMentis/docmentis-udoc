// A file's versions: `/api/assets/:id/versions`. A version is a checkpoint of
// the file's document, which udoc-server keeps as it was whatever happens to
// the document after, so the document goes on being edited while a version is
// reviewed, and what's approved and published is exactly what was read. A
// version is saved as a draft, submitted to a reviewer, who alone then approves
// or returns it; one returned stays so, and what changes goes in a new version.
// Any approved version may be published, an older one taking the file back to
// it. No one reviews what they submitted themselves. A deal room's file has its
// versions the same way, those who enter the room in place of those who keep the
// library: what publishes one is putting its room on the frontstage.
import type { DatabaseSync } from "node:sqlite";

import type { FastifyInstance } from "fastify";

import { managesLibrary, readsLibrary, reviewsLibrary } from "../../shared/api.ts";
import type {
    Asset,
    Reviewer,
    Role,
    User,
    Version,
    VersionEvent,
    VersionStatus,
    VersionStep,
    VersionedAsset,
    WaitingVersion,
} from "../../shared/api.ts";
import { ASSETS, ASSET_COLUMNS, anyFileOf, assetOf, assetOfRow } from "../assets.ts";
import type { AssetRow } from "../assets.ts";
import { inTransaction } from "../db.ts";
import { anySentToReview, entersDealRoom } from "../dealRooms.ts";
import { Refusal, noteOf, signedIn } from "../http.ts";
import type { Udoc } from "../udoc.ts";
import { keepThumbnail } from "./thumbnails.ts";

/**
 * What each step asks of a version and its user: who takes it, of those who edit
 * the file and those who review; and what it leaves: its status, or as it was with
 * no `to`.
 */
const STEPS: Record<
    VersionStep,
    {
        taker: "editor" | "reviewer" | "either";
        from: VersionStatus[];
        to?: VersionStatus;
        event: VersionEvent["kind"];
        needsNote?: boolean;
    }
> = {
    submit: { taker: "editor", from: ["draft"], to: "submitted", event: "submitted" },
    approve: { taker: "reviewer", from: ["submitted"], to: "approved", event: "approved" },
    return: { taker: "reviewer", from: ["submitted"], to: "returned", event: "returned", needsNote: true },
    publish: { taker: "editor", from: ["approved"], event: "published" },
    reassign: { taker: "either", from: ["submitted"], event: "reassigned" },
    dismiss: { taker: "editor", from: ["approved", "returned"], event: "dismissed" },
};

interface VersionRow {
    number: number;
    checkpoint: number;
    status: VersionStatus;
    reviewer_id: string | null;
    reviewer_name: string | null;
}

interface EventRow {
    number: number;
    kind: VersionEvent["kind"];
    user_id: string;
    user_name: string;
    to_user_id: string | null;
    to_user_name: string | null;
    at: number;
    note: string | null;
}

/** Whether `user` edits `file`: a library's, if they keep the library; a deal room's, if they enter the room. */
function editsFile(db: DatabaseSync, user: User, file: Asset): boolean {
    return file.dealRoomId === null ? managesLibrary(user.role) : entersDealRoom(db, user, file.dealRoomId);
}

/** A file's versions, newest first. */
export function versionsOf(db: DatabaseSync, assetId: string): Version[] {
    const rows = db
        .prepare(
            `SELECT versions.number, versions.checkpoint, versions.status, versions.reviewer_id,
                users.name AS reviewer_name
            FROM versions LEFT JOIN users ON users.id = versions.reviewer_id
            WHERE versions.asset_id = ? ORDER BY versions.number DESC`,
        )
        .all(assetId) as unknown as VersionRow[];
    const events = db
        .prepare(
            `SELECT version_events.number, version_events.kind, version_events.user_id, users.name AS user_name,
                version_events.to_user_id, target.name AS to_user_name, version_events.at, version_events.note
            FROM version_events JOIN users ON users.id = version_events.user_id
            LEFT JOIN users AS target ON target.id = version_events.to_user_id
            WHERE version_events.asset_id = ? ORDER BY version_events.id`,
        )
        .all(assetId) as unknown as EventRow[];
    return rows.map(({ number, checkpoint, status, reviewer_id: reviewerId, reviewer_name: reviewerName }) => ({
        number,
        checkpoint,
        status,
        reviewer: reviewerId === null ? null : { id: reviewerId, name: reviewerName! },
        events: events
            .filter((event) => event.number === number)
            .map((event) => ({
                kind: event.kind,
                by: { id: event.user_id, name: event.user_name },
                to: event.to_user_id === null ? null : { id: event.to_user_id, name: event.to_user_name! },
                at: event.at,
                note: event.note,
            })),
    }));
}

/** Record what `userId` did to version `number` of file `assetId`. */
export function addEvent(
    db: DatabaseSync,
    {
        assetId,
        number,
        kind,
        userId,
        toUserId = null,
        at,
        note,
    }: {
        assetId: string;
        number: number;
        kind: VersionEvent["kind"];
        userId: string;
        toUserId?: string | null;
        at: number;
        note: string | null;
    },
): void {
    db.prepare(
        "INSERT INTO version_events (asset_id, number, kind, user_id, to_user_id, at, note) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(assetId, number, kind, userId, toUserId, at, note);
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
    addEvent(db, { assetId, number, kind: "saved", userId, at, note });
    return number;
}

/** A new file's first version: its upload, the checkpoint importing it made. Run in a transaction. */
export function addFirstVersion(db: DatabaseSync, assetId: string, userId: string, at: number): void {
    addVersion(db, assetId, 0, userId, at, null);
}

/**
 * A deal room's new file's first version: the checkpoint importing it made, a copy
 * of a version the library published, so approved as that was, with `note` saying
 * which. Run in a transaction.
 */
export function addCopiedVersion(db: DatabaseSync, assetId: string, userId: string, at: number, note: string): void {
    const number = addVersion(db, assetId, 0, userId, at, note);
    db.prepare("UPDATE versions SET status = 'approved' WHERE asset_id = ? AND number = ?").run(assetId, number);
}

const OWN_SUBMISSION = () => new Refusal(403, "ownSubmission", "no one reviews what they submitted themselves");

/**
 * `value`, the id of someone at `user`'s tenant to send a version to, which
 * `submitterId` submitted: a `400` for no one, or someone who doesn't review,
 * and a `403` for who submitted it.
 */
function reviewerOf(db: DatabaseSync, user: User, value: unknown, submitterId: string): string {
    if (typeof value !== "string") throw new Refusal(400, "badRequest", "a reviewer is needed");
    const row = db.prepare("SELECT role FROM users WHERE id = ? AND tenant_id = ?").get(value, user.tenant.id) as
        | { role: Role }
        | undefined;
    if (!row || !reviewsLibrary(row.role)) throw new Refusal(400, "notAReviewer", "that person doesn't review");
    if (value === submitterId) throw OWN_SUBMISSION();
    return value;
}

/** Whether version `number` of file `assetId` has had an event of one of `kinds`. */
function hasEvent(db: DatabaseSync, assetId: string, number: number, kinds: VersionEvent["kind"][]): boolean {
    const row = db
        .prepare(
            `SELECT 1 FROM version_events WHERE asset_id = ? AND number = ?
            AND kind IN (${kinds.map(() => "?").join(", ")})`,
        )
        .get(assetId, number, ...kinds);
    return row !== undefined;
}

export function versionRoutes(app: FastifyInstance, db: DatabaseSync, udoc: Udoc): void {
    /**
     * `{ versions }`: what's waiting on the user, each version with its file,
     * for them alone, whatever their role. What was sent to them to review. And
     * what they submitted, until it's dealt with: returned, until a later version
     * is submitted; approved, until it's published, or a later one is. Dismissing
     * one takes it off, and a version published once isn't waiting to be again,
     * so a rollback leaves nothing behind. Those who sell have the same, for what
     * they submit from their deal rooms.
     */
    app.get("/api/library/attention", async (request): Promise<{ versions: WaitingVersion[] }> => {
        const user = signedIn(db, request);
        const rows = db
            .prepare(
                `SELECT ${ASSET_COLUMNS}, waiting.number AS waiting_number, waiting.status AS waiting_status
                FROM ${ASSETS} JOIN versions AS waiting ON waiting.asset_id = assets.id
                WHERE assets.tenant_id = :tenant AND (
                    (waiting.status = 'submitted' AND waiting.reviewer_id = :me)
                    OR (
                        EXISTS (
                            SELECT 1 FROM version_events AS event
                            WHERE event.asset_id = waiting.asset_id AND event.number = waiting.number
                                AND event.kind = 'submitted' AND event.user_id = :me
                        )
                        AND NOT EXISTS (
                            SELECT 1 FROM version_events AS event
                            WHERE event.asset_id = waiting.asset_id AND event.number = waiting.number
                                AND event.kind IN ('dismissed', 'published')
                        )
                        AND (
                            (waiting.status = 'returned' AND NOT EXISTS (
                                SELECT 1 FROM version_events AS event
                                WHERE event.asset_id = waiting.asset_id AND event.number > waiting.number
                                    AND event.kind = 'submitted'
                            ))
                            OR (
                                waiting.status = 'approved'
                                AND waiting.number > coalesce(assets.published_version, 0)
                            )
                        )
                    )
                )
                ORDER BY assets.name COLLATE NOCASE, waiting.number DESC`,
            )
            .all({ tenant: user.tenant.id, me: user.id }) as unknown as (AssetRow & {
            waiting_number: number;
            waiting_status: VersionStatus;
        })[];
        return {
            versions: rows.map((row) => ({
                asset: assetOfRow(row),
                number: row.waiting_number,
                status: row.waiting_status,
            })),
        };
    });

    /** `{ reviewers }`: those at the user's tenant a version can be sent to, by name. */
    app.get("/api/library/reviewers", async (request): Promise<{ reviewers: Reviewer[] }> => {
        const user = signedIn(db, request);
        const rows = db
            .prepare("SELECT id, name, title, role FROM users WHERE tenant_id = ? ORDER BY name COLLATE NOCASE")
            .all(user.tenant.id) as unknown as (Reviewer & { role: Role })[];
        return {
            reviewers: rows
                .filter(({ role }) => reviewsLibrary(role))
                .map(({ id, name, title }) => ({ id, name, title })),
        };
    });

    /**
     * File `id` of the user's tenant, for a request about its versions: a `403`
     * for a library's to one who doesn't read the library, and a `404` for a deal
     * room's to one with no business with it.
     */
    function fileFor(user: User, id: string): Asset {
        const file = anyFileOf(db, user, id);
        if (file.dealRoomId === null) {
            if (!readsLibrary(user.role)) throw new Refusal(403, "forbidden", "your role doesn't let you do this");
        } else if (!entersDealRoom(db, user, file.dealRoomId) && !anySentToReview(db, user, file.id))
            throw new Refusal(404, "notFound", "no such file");
        return file;
    }

    /** `{ versions }`: a file's versions, newest first. */
    app.get<{ Params: { id: string } }>("/api/assets/:id/versions", async (request) => {
        const user = signedIn(db, request);
        const file = fileFor(user, request.params.id);
        const versions = versionsOf(db, file.id);
        if (editsFile(db, user, file) || file.dealRoomId === null) return { versions };
        // A reviewer who isn't on the room reads what was sent to them.
        return { versions: versions.filter((version) => version.reviewer?.id === user.id) };
    });

    /**
     * Save the file's document as it is now as a new version, `{ note }`: a
     * checkpoint udoc-server takes, its first page kept as that version's
     * thumbnail. `201`, a `VersionedAsset`.
     */
    app.post<{ Params: { id: string }; Body: { note?: unknown } | undefined }>(
        "/api/assets/:id/versions",
        async (request, reply) => {
            const user = signedIn(db, request);
            const file = fileFor(user, request.params.id);
            if (!editsFile(db, user, file)) throw new Refusal(403, "forbidden", "your role doesn't let you do this");
            const { id, documentId } = file;
            const note = noteOf(request.body?.note);
            const checkpoint = await udoc.checkpoint(documentId);
            const number = inTransaction(db, () => addVersion(db, id, checkpoint, user.id, Date.now(), note));
            try {
                await keepThumbnail(db, udoc, { assetId: id, documentId, number });
            } catch (error) {
                // The version is kept all the same, with no thumbnail.
                request.log.warn(error, "a thumbnail wasn't rendered");
            }
            const answer: VersionedAsset = { asset: anyFileOf(db, user, id), versions: versionsOf(db, id) };
            return reply.code(201).send(answer);
        },
    );

    /**
     * Take a step with version `number`, `{ note, reviewerId }`, `reviewerId`
     * for a step that sends it to someone: a `VersionedAsset`; a `403` for a
     * user the step isn't theirs to take; and a `409` for a version not where
     * it starts from, or that has taken it already.
     */
    for (const [step, { taker, from, to, event, needsNote }] of Object.entries(STEPS)) {
        app.post<{
            Params: { id: string; number: string };
            Body: { note?: unknown; reviewerId?: unknown } | undefined;
        }>(`/api/assets/:id/versions/:number/${step}`, async (request): Promise<VersionedAsset> => {
            const user = signedIn(db, request);
            const asset = fileFor(user, request.params.id);
            const edits = editsFile(db, user, asset);
            const reviews = reviewsLibrary(user.role);
            if (!(taker === "editor" ? edits : taker === "reviewer" ? reviews : edits || reviews))
                throw new Refusal(403, "forbidden", "your role doesn't let you do this");
            if (step === "publish" && asset.dealRoomId !== null)
                throw new Refusal(
                    409,
                    "wrongStatus",
                    "a deal room's file is published by putting it on the frontstage",
                );
            const number = Number(request.params.number);
            const row = db
                .prepare("SELECT status, reviewer_id FROM versions WHERE asset_id = ? AND number = ?")
                .get(asset.id, number) as { status: VersionStatus; reviewer_id: string | null } | undefined;
            if (!row) throw new Refusal(404, "notFound", "no such version");
            if (!from.includes(row.status))
                throw new Refusal(409, "wrongStatus", `only a version that's ${from.join(" or ")} can take this step`);
            const submitter = db
                .prepare(
                    `SELECT user_id FROM version_events WHERE asset_id = ? AND number = ? AND kind = 'submitted'
                    ORDER BY id DESC LIMIT 1`,
                )
                .get(asset.id, number) as { user_id: string } | undefined;

            let sentTo: string | null = null;
            if (step === "submit") sentTo = reviewerOf(db, user, request.body?.reviewerId, user.id);
            if (step === "approve" || step === "return") {
                if (submitter?.user_id === user.id) throw OWN_SUBMISSION();
                if (row.reviewer_id !== user.id)
                    throw new Refusal(403, "notYourReview", "this version was sent to someone else to review");
            }
            if (step === "reassign") {
                if (!edits && row.reviewer_id !== user.id)
                    throw new Refusal(403, "notYourReview", "this version was sent to someone else to review");
                sentTo = reviewerOf(db, user, request.body?.reviewerId, submitter?.user_id ?? "");
                if (sentTo === row.reviewer_id)
                    throw new Refusal(409, "wrongStatus", "this version was sent to them already");
            }
            if (step === "publish" && asset.publishedVersion === number)
                throw new Refusal(409, "wrongStatus", "this version is published already");
            // One no one submitted, as a deal room's first, copied as approved, isn't waiting either.
            if (
                step === "dismiss" &&
                (submitter === undefined || hasEvent(db, asset.id, number, ["dismissed", "published"]))
            )
                throw new Refusal(409, "wrongStatus", "this version isn't waiting on anyone");

            const note = noteOf(request.body?.note);
            if (needsNote && !note) throw new Refusal(400, "badRequest", "a note is needed");
            inTransaction(db, () => {
                db.prepare("UPDATE versions SET status = ?, reviewer_id = ? WHERE asset_id = ? AND number = ?").run(
                    to ?? row.status,
                    sentTo ?? row.reviewer_id,
                    asset.id,
                    number,
                );
                if (step === "publish")
                    db.prepare("UPDATE assets SET published_version = ? WHERE id = ?").run(number, asset.id);
                addEvent(db, {
                    assetId: asset.id,
                    number,
                    kind: event,
                    userId: user.id,
                    toUserId: sentTo,
                    at: Date.now(),
                    note,
                });
            });
            return { asset: anyFileOf(db, user, asset.id), versions: versionsOf(db, asset.id) };
        });
    }
}
