// Each version's thumbnail: its first page as it was saved, rendered by
// udoc-server once, as the file's uploaded or the version's saved, and kept in
// `thumbnails`. udoc-server would render it again on each request, with nothing
// for a browser to cache it by, and can render only the document as it is now,
// not a checkpoint of it (GAPS.md), so one not rendered then never is: its file
// shows its type's badge. Its address names its file and version, so a browser
// keeps it for good. The other pages a card in the library flips to, the card
// asks udoc-server for itself: none of them is kept.
import type { DatabaseSync } from "node:sqlite";

import type { FastifyInstance } from "fastify";

import { CARD_PAGE_SCALE, readsLibrary } from "../../shared/api.ts";
import { Refusal, signedIn } from "../http.ts";
import type { Udoc } from "../udoc.ts";

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
    db: DatabaseSync,
    udoc: Udoc,
    { assetId, documentId, number }: { assetId: string; documentId: string; number: number },
): Promise<Uint8Array | null> {
    const png = await udoc.renderFirstPage(documentId, CARD_PAGE_SCALE);
    db.prepare("INSERT OR REPLACE INTO thumbnails (asset_id, number, png) VALUES (?, ?, ?)").run(assetId, number, png);
    return png;
}

export function thumbnailRoutes(app: FastifyInstance, db: DatabaseSync): void {
    /**
     * A version's first page, a PNG, for a file of the user's tenant: any
     * version's for those who read the library, and for anyone else the one
     * published, as the gate lets them read that and no more. `404` for none.
     */
    app.get<{ Params: { assetId: string; number: string } }>(
        "/api/thumbnails/:assetId/:number",
        async (request, reply) => {
            const user = signedIn(db, request);
            const number = Number(request.params.number);
            const row = db
                .prepare(
                    `SELECT thumbnails.png, assets.published_version
                    FROM thumbnails JOIN assets ON assets.id = thumbnails.asset_id
                    WHERE thumbnails.asset_id = ? AND thumbnails.number = ? AND assets.tenant_id = ?`,
                )
                .get(request.params.assetId, number, user.tenant.id) as
                | { png: Uint8Array | null; published_version: number | null }
                | undefined;
            if (!row?.png || (!readsLibrary(user.role) && row.published_version !== number))
                throw new Refusal(404, "notFound", "no such thumbnail");
            reply.header("cache-control", "private, max-age=31536000, immutable");
            return reply.type("image/png").send(Buffer.from(row.png));
        },
    );
}
