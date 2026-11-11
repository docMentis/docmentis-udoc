// Each version's thumbnails: each of its pages as it was saved, rendered by
// udoc-server once, as the file's uploaded or the version's saved, and kept in
// `thumbnails`. udoc-server would render them again on each request, with nothing
// for a browser to cache them by, and can render only the document as it is now,
// not a checkpoint of it (GAPS.md), so a version's pages not rendered then never
// are: one with none shows its type's badge. A page's address names its file,
// version and page, so a browser keeps it, asking each time that it may still read
// it. A deal room's file is read as its room is, and by a reviewer, the versions
// sent to them.
import type { FastifyInstance } from "fastify";

import { CARD_PAGE_SCALE, readsLibrary } from "../../shared/api.ts";
import type { Thumbnails } from "../../shared/api.ts";
import type { TenantDb } from "../db.ts";
import { entersDealRoom, sentToReview } from "../dealRooms.ts";
import { Refusal, sendKept, signedIn } from "../http.ts";
import type { Access } from "../scope.ts";
import type { TenantDocuments } from "../udoc.ts";

/** The thumbnails of version `number` of file `assetId`, `pageCount` of them: `null` for none. */
export function thumbnailsOf(assetId: string, number: number, pageCount: number): Thumbnails | null {
    if (pageCount === 0) return null;
    return { path: `/api/thumbnails/${encodeURIComponent(assetId)}/${number}`, pageCount };
}

/** The thumbnails of version `number` of file `assetId`, as kept: `null` for none. */
export function keptThumbnails(db: TenantDb, assetId: string, number: number): Thumbnails | null {
    const { pages } = db
        .prepare("SELECT COUNT(*) AS pages FROM thumbnails WHERE tenant_id = :tenant AND asset_id = ? AND number = ?")
        .get(assetId, number) as { pages: number };
    return thumbnailsOf(assetId, number, pages);
}

/** In a query over `assets`, how many thumbnails the file's version `number`, a column of the query's, has. */
export function thumbnailCount(number: string): string {
    return `(
        SELECT COUNT(*) FROM thumbnails WHERE thumbnails.tenant_id = assets.tenant_id
            AND thumbnails.asset_id = assets.id AND thumbnails.number = ${number}
    )`;
}

/**
 * Render each page of document `documentId` and keep them as version `number`
 * of file `assetId`, just saved: how many, none for a document udoc-server
 * won't render the first page of. The version must be recorded first.
 * udoc-server failing keeps nothing.
 */
export async function keepThumbnails(
    db: TenantDb,
    documents: TenantDocuments,
    { assetId, documentId, number }: { assetId: string; documentId: string; number: number },
): Promise<number> {
    const pages = await documents.renderPages(documentId, CARD_PAGE_SCALE);
    db.transaction(() => {
        const keep = db.prepare(
            "INSERT INTO thumbnails (tenant_id, asset_id, number, page, png) VALUES (:tenant, ?, ?, ?, ?)",
        );
        pages.forEach((png, page) => keep.run(assetId, number, page, png));
    });
    return pages.length;
}

export function thumbnailRoutes(app: FastifyInstance, access: Access): void {
    /**
     * A page of a version, counting from 0, a PNG, for a file of the user's
     * tenant: any version's for those who read the library, and for anyone else
     * the one published, as the gate lets them read that and no more; a deal
     * room's, for those who enter it, or the reviewer it was sent to. `404` for
     * none.
     */
    app.get<{ Params: { assetId: string; number: string; page: string } }>(
        "/api/thumbnails/:assetId/:number/:page",
        async (request, reply) => {
            const { user, db } = signedIn(access, request);
            const { assetId } = request.params;
            const number = Number(request.params.number);
            const page = Number(request.params.page);
            const row = db
                .prepare(
                    `SELECT thumbnails.png, assets.published_version, room_file.room_id
                    FROM thumbnails JOIN assets ON assets.tenant_id = thumbnails.tenant_id
                        AND assets.id = thumbnails.asset_id
                    LEFT JOIN deal_room_files AS room_file ON room_file.tenant_id = assets.tenant_id
                        AND room_file.asset_id = assets.id
                    WHERE thumbnails.tenant_id = :tenant AND thumbnails.asset_id = ? AND thumbnails.number = ?
                        AND thumbnails.page = ?`,
                )
                .get(assetId, number, page) as
                | { png: Uint8Array; published_version: number | null; room_id: string | null }
                | undefined;
            if (!row) throw new Refusal(404, "notFound", "no such thumbnail");
            const mayRead =
                row.room_id === null
                    ? readsLibrary(user.role) || row.published_version === number
                    : entersDealRoom(db, user, row.room_id) || sentToReview(db, user, assetId, number);
            if (!mayRead) throw new Refusal(404, "notFound", "no such thumbnail");
            return sendKept(request, reply, `${assetId}-${number}-${page}`, "image/png", row.png);
        },
    );
}
