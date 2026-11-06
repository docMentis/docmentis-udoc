// Collections: `/api/collections`, and `/api/published-files`, what can go in
// one. A manager arranges their tenant's published files in as many collections
// as it takes, each choosing its own files, a file in any number of them; and
// everyone at the tenant reads them. An item is a file and not a version: it
// shows whichever version its file publishes now, and nothing else of the file.
// All of this is its tenant's alone: another tenant's collection or file is as
// unknown as one that isn't there.
import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyRequest } from "fastify";

import { arrangesCollections } from "../../shared/api.ts";
import type { Collection, PublishedFile } from "../../shared/api.ts";
import { PUBLISHED_FILES, PUBLISHED_FILE_COLUMNS, publishedFileOfRow } from "../assets.ts";
import type { PublishedFileRow } from "../assets.ts";
import { isUniqueFailure } from "../db.ts";
import type { TenantDb } from "../db.ts";
import { Refusal, idsOf, nameOf, noteOf, signedIn, signedInAs } from "../http.ts";
import type { Access, Scope } from "../scope.ts";

interface CollectionRow {
    id: string;
    name: string;
    description: string | null;
    instructions: string | null;
    updated_at: number;
}

type ItemRow = PublishedFileRow & { collection_id: string; item_instructions: string | null };

/** What a collection's made or changed with, a request's body. */
interface CollectionBody {
    name?: unknown;
    description?: unknown;
    instructions?: unknown;
}

const NAME_TAKEN = () => new Refusal(409, "nameTaken", "a collection has that name already");

const NO_SUCH_FILE = () => new Refusal(404, "notFound", "no such file in this collection");

/** The tenant's collections, by name, or with `only`, that one alone. */
function collectionsOf(db: TenantDb, only: string | null = null): Collection[] {
    const rows = db
        .prepare(
            `SELECT id, name, description, instructions, updated_at FROM collections
            WHERE tenant_id = :tenant AND (:only IS NULL OR id = :only) ORDER BY name COLLATE NOCASE`,
        )
        .all({ only }) as unknown as CollectionRow[];
    const items = db
        .prepare(
            `SELECT item.collection_id, item.instructions AS item_instructions, ${PUBLISHED_FILE_COLUMNS}
            FROM ${PUBLISHED_FILES} JOIN collection_items AS item ON item.tenant_id = assets.tenant_id
                AND item.asset_id = assets.id
            WHERE assets.tenant_id = :tenant AND (:only IS NULL OR item.collection_id = :only)
            ORDER BY item.position`,
        )
        .all({ only }) as unknown as ItemRow[];
    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        instructions: row.instructions,
        updatedAt: row.updated_at,
        items: items
            .filter((item) => item.collection_id === row.id)
            .map((item) => ({ file: publishedFileOfRow(item), instructions: item.item_instructions })),
    }));
}

/** Collection `id` of the tenant's; a `404` for none. */
function collectionOf(db: TenantDb, id: string): Collection {
    const [collection] = collectionsOf(db, id);
    if (!collection) throw new Refusal(404, "notFound", "no such collection");
    return collection;
}

/** Note that collection `id` has changed. */
function touch(db: TenantDb, id: string): void {
    db.prepare("UPDATE collections SET updated_at = ? WHERE tenant_id = :tenant AND id = ?").run(Date.now(), id);
}

export function collectionRoutes(app: FastifyInstance, access: Access): void {
    /** What's the user's signed in, who arranges collections; a `403` for one who doesn't. */
    const arranger = (request: FastifyRequest): Scope => signedInAs(access, request, arrangesCollections);

    /** `{ collections }`: the user's tenant's, by name. */
    app.get("/api/collections", async (request): Promise<{ collections: Collection[] }> => {
        return { collections: collectionsOf(signedIn(access, request).db) };
    });

    /** Make a collection, `{ name, description, instructions }`: `201 { collection }`; `409` for a name taken. */
    app.post<{ Body: CollectionBody | undefined }>("/api/collections", async (request, reply) => {
        const { db } = arranger(request);
        const id = randomUUID();
        try {
            db.prepare(
                `INSERT INTO collections (tenant_id, id, name, description, instructions, updated_at)
                VALUES (:tenant, ?, ?, ?, ?, ?)`,
            ).run(
                id,
                nameOf(request.body?.name),
                noteOf(request.body?.description),
                noteOf(request.body?.instructions),
                Date.now(),
            );
        } catch (error) {
            throw isUniqueFailure(error) ? NAME_TAKEN() : error;
        }
        return reply.code(201).send({ collection: collectionOf(db, id) });
    });

    /** `{ collection }`: one, with its files. */
    app.get<{ Params: { id: string } }>("/api/collections/:id", async (request) => {
        return { collection: collectionOf(signedIn(access, request).db, request.params.id) };
    });

    /** Change a collection, `{ name, description, instructions }`: `{ collection }`; `409` for a name taken. */
    app.patch<{ Params: { id: string }; Body: CollectionBody | undefined }>("/api/collections/:id", async (request) => {
        const { db } = arranger(request);
        const { id } = collectionOf(db, request.params.id);
        try {
            db.prepare(
                `UPDATE collections SET name = ?, description = ?, instructions = ?, updated_at = ?
                WHERE tenant_id = :tenant AND id = ?`,
            ).run(
                nameOf(request.body?.name),
                noteOf(request.body?.description),
                noteOf(request.body?.instructions),
                Date.now(),
                id,
            );
        } catch (error) {
            throw isUniqueFailure(error) ? NAME_TAKEN() : error;
        }
        return { collection: collectionOf(db, id) };
    });

    /** Delete a collection: `204`. The files in it stay as they are. */
    app.delete<{ Params: { id: string } }>("/api/collections/:id", async (request, reply) => {
        const { db } = arranger(request);
        const { id } = collectionOf(db, request.params.id);
        db.prepare("DELETE FROM collections WHERE tenant_id = :tenant AND id = ?").run(id);
        return reply.code(204).send();
    });

    /**
     * Add files to a collection's end, `{ assetIds }`: `{ collection }`; `400`
     * for one that isn't a published file of the user's tenant. One in it
     * already stays where it is.
     */
    app.post<{ Params: { id: string }; Body: { assetIds?: unknown } | undefined }>(
        "/api/collections/:id/items",
        async (request) => {
            const { db } = arranger(request);
            const { id } = collectionOf(db, request.params.id);
            const assetIds = idsOf(request.body?.assetIds);
            const published = db.prepare(
                `SELECT 1 FROM ${PUBLISHED_FILES} WHERE assets.tenant_id = :tenant AND assets.id = ?`,
            );
            for (const assetId of assetIds)
                if (!published.get(assetId))
                    throw new Refusal(400, "notPublished", "only a published file goes in a collection");
            db.transaction(() => {
                const add = db.prepare(
                    `INSERT OR IGNORE INTO collection_items (tenant_id, collection_id, asset_id, position)
                    VALUES (:tenant, :id, :asset, (
                        SELECT coalesce(MAX(position), -1) + 1 FROM collection_items
                        WHERE tenant_id = :tenant AND collection_id = :id
                    ))`,
                );
                for (const asset of assetIds) add.run({ id, asset });
                touch(db, id);
            });
            return { collection: collectionOf(db, id) };
        },
    );

    /** Say how to use a file in a collection, `{ instructions }`: `{ collection }`. */
    app.patch<{ Params: { id: string; assetId: string }; Body: { instructions?: unknown } | undefined }>(
        "/api/collections/:id/items/:assetId",
        async (request) => {
            const { db } = arranger(request);
            const { id } = collectionOf(db, request.params.id);
            const { changes } = db
                .prepare(
                    `UPDATE collection_items SET instructions = ?
                    WHERE tenant_id = :tenant AND collection_id = ? AND asset_id = ?`,
                )
                .run(noteOf(request.body?.instructions), id, request.params.assetId);
            if (changes === 0) throw NO_SUCH_FILE();
            touch(db, id);
            return { collection: collectionOf(db, id) };
        },
    );

    /** Take a file out of a collection: `{ collection }`. The file stays as it is. */
    app.delete<{ Params: { id: string; assetId: string } }>("/api/collections/:id/items/:assetId", async (request) => {
        const { db } = arranger(request);
        const { id } = collectionOf(db, request.params.id);
        const { changes } = db
            .prepare("DELETE FROM collection_items WHERE tenant_id = :tenant AND collection_id = ? AND asset_id = ?")
            .run(id, request.params.assetId);
        if (changes === 0) throw NO_SUCH_FILE();
        touch(db, id);
        return { collection: collectionOf(db, id) };
    });

    /**
     * Put a collection's files in order, `{ assetIds }`, all of them, first
     * first: `{ collection }`; `409` for a list that isn't what's in it now.
     */
    app.put<{ Params: { id: string }; Body: { assetIds?: unknown } | undefined }>(
        "/api/collections/:id/order",
        async (request) => {
            const { db } = arranger(request);
            const { id } = collectionOf(db, request.params.id);
            const assetIds = idsOf(request.body?.assetIds);
            const held = db
                .prepare("SELECT asset_id FROM collection_items WHERE tenant_id = :tenant AND collection_id = ?")
                .all(id) as unknown as { asset_id: string }[];
            const given = new Set(assetIds);
            if (
                given.size !== assetIds.length ||
                given.size !== held.length ||
                !held.every((row) => given.has(row.asset_id))
            )
                throw new Refusal(409, "orderStale", "the list isn't what's in the collection now");
            db.transaction(() => {
                const place = db.prepare(
                    "UPDATE collection_items SET position = ? WHERE tenant_id = :tenant AND collection_id = ? AND asset_id = ?",
                );
                assetIds.forEach((assetId, position) => place.run(position, id, assetId));
                touch(db, id);
            });
            return { collection: collectionOf(db, id) };
        },
    );

    /** `{ files }`: what can go in a collection, the published files of the user's tenant, by name. */
    app.get("/api/published-files", async (request): Promise<{ files: PublishedFile[] }> => {
        const { db } = arranger(request);
        const rows = db
            .prepare(
                `SELECT ${PUBLISHED_FILE_COLUMNS} FROM ${PUBLISHED_FILES}
                WHERE assets.tenant_id = :tenant ORDER BY assets.name COLLATE NOCASE`,
            )
            .all() as unknown as PublishedFileRow[];
        return { files: rows.map(publishedFileOfRow) };
    });
}
