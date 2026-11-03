// Each file's thumbnail: its document's first page, rendered by udoc-server
// once, on upload, and kept in `thumbnails`, or for a file uploaded before
// thumbnails were kept, the first time it's asked for. udoc-server would
// render it again on each request, with nothing for a browser to cache it by
// (GAPS.md). A thumbnail's address names its document, whose first page never
// changes, so a browser keeps it for good; a document edited in place, when
// the editor comes, has its thumbnail rendered again, and its address needs a
// revision then.
import type { DatabaseSync } from "node:sqlite";

import type { FastifyInstance } from "fastify";

import { Refusal, signedIn } from "../http.ts";
import type { Udoc } from "../udoc.ts";

/** Pixels to a point: a letter page 306 pixels wide, a 16:9 slide 480, sharp on a card at twice the pixels. */
const SCALE = 0.5;

/** Where document `documentId`'s thumbnail is, for an `<img>`. */
export function thumbnailPath(documentId: string): string {
    return `/api/thumbnails/${encodeURIComponent(documentId)}`;
}

/**
 * Render document `documentId`'s first page and keep it: the PNG, or `null`
 * for a document udoc-server won't render it of, kept as having none. An
 * asset must point at the document first. udoc-server failing keeps nothing,
 * so the next asking tries again.
 */
export async function keepThumbnail(db: DatabaseSync, udoc: Udoc, documentId: string): Promise<Uint8Array | null> {
    const png = await udoc.renderFirstPage(documentId, SCALE);
    db.prepare("INSERT OR REPLACE INTO thumbnails (document_id, png) VALUES (?, ?)").run(documentId, png);
    return png;
}

export function thumbnailRoutes(app: FastifyInstance, db: DatabaseSync, udoc: Udoc): void {
    /** A document's first page, a PNG, for a file of the user's tenant; `404` for none. */
    app.get<{ Params: { documentId: string } }>("/api/thumbnails/:documentId", async (request, reply) => {
        const user = signedIn(db, request);
        const { documentId } = request.params;
        const owned = db
            .prepare("SELECT 1 FROM assets WHERE document_id = ? AND tenant_id = ?")
            .get(documentId, user.tenant.id);
        if (!owned) throw new Refusal(404, "notFound", "no such thumbnail");
        const kept = db.prepare("SELECT png FROM thumbnails WHERE document_id = ?").get(documentId) as
            | { png: Uint8Array | null }
            | undefined;
        const png = kept ? kept.png : await keepThumbnail(db, udoc, documentId);
        if (!png) throw new Refusal(404, "notFound", "no thumbnail of this file");
        reply.header("cache-control", "private, max-age=31536000, immutable");
        return reply.type("image/png").send(Buffer.from(png));
    });
}
