// Each version's thumbnail: its first page as it was saved, rendered by
// udoc-server once, as the file's uploaded or the version's saved, and kept in
// `thumbnails`. udoc-server would render it again on each request, with nothing
// for a browser to cache it by, and can render only the document as it is now,
// not a checkpoint of it (GAPS.md), so one not rendered then never is: its file
// shows its type's badge. Its address names its file and version, so a browser
// keeps it, asking each time that it may still read it. The other pages a card in
// the library flips to, the card asks udoc-server for itself: none of them is kept.
// A deal room's file is read as its room is, and by a reviewer, the versions sent
// to them.
import type { FastifyInstance } from "fastify";

import { CARD_PAGE_SCALE, readsLibrary } from "../../shared/api.ts";
import type { TenantDb } from "../db.ts";
import { entersDealRoom, sentToReview } from "../dealRooms.ts";
import { Refusal, sendKept, signedIn } from "../http.ts";
import type { Access } from "../scope.ts";
import type { TenantDocuments } from "../udoc.ts";

/** Where the thumbnail of version `number` of file `assetId` is, for an `<img>`. */
export function thumbnailPath(assetId: string, number: number): string {
    return `/api/thumbnails/${encodeURIComponent(assetId)}/${number}`;
}

/**
 * Render the first page of document `documentId` and keep it as version
 * `number` of file `assetId`, just saved: the PNG, or `null` for a document
 * udoc-server won't render it of, kept as having none. The version must be
 * recorded first. udoc-server failing keeps nothing.
 */
export async function keepThumbnail(
    db: TenantDb,
    documents: TenantDocuments,
    { assetId, documentId, number }: { assetId: string; documentId: string; number: number },
): Promise<Uint8Array | null> {
    const png = await documents.renderFirstPage(documentId, CARD_PAGE_SCALE);
    db.prepare("INSERT OR REPLACE INTO thumbnails (tenant_id, asset_id, number, png) VALUES (:tenant, ?, ?, ?)").run(
        assetId,
        number,
        png,
    );
    return png;
}

export function thumbnailRoutes(app: FastifyInstance, access: Access): void {
    /**
     * A version's first page, a PNG, for a file of the user's tenant: any
     * version's for those who read the library, and for anyone else the one
     * published, as the gate lets them read that and no more; a deal room's, for
     * those who enter it, or the reviewer it was sent to. `404` for none.
     */
    app.get<{ Params: { assetId: string; number: string } }>(
        "/api/thumbnails/:assetId/:number",
        async (request, reply) => {
            const { user, db } = signedIn(access, request);
            const number = Number(request.params.number);
            const row = db
                .prepare(
                    `SELECT thumbnails.png, assets.published_version, room_file.room_id
                    FROM thumbnails JOIN assets ON assets.tenant_id = thumbnails.tenant_id
                        AND assets.id = thumbnails.asset_id
                    LEFT JOIN deal_room_files AS room_file ON room_file.tenant_id = assets.tenant_id
                        AND room_file.asset_id = assets.id
                    WHERE thumbnails.tenant_id = :tenant AND thumbnails.asset_id = ? AND thumbnails.number = ?`,
                )
                .get(request.params.assetId, number) as
                | { png: Uint8Array | null; published_version: number | null; room_id: string | null }
                | undefined;
            if (!row?.png) throw new Refusal(404, "notFound", "no such thumbnail");
            const mayRead =
                row.room_id === null
                    ? readsLibrary(user.role) || row.published_version === number
                    : entersDealRoom(db, user, row.room_id) || sentToReview(db, user, request.params.assetId, number);
            if (!mayRead) throw new Refusal(404, "notFound", "no such thumbnail");
            return sendKept(request, reply, `${request.params.assetId}-${number}`, "image/png", row.png);
        },
    );
}
