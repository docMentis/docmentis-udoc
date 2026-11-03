// The library: `/api/library`, what a folder holds, and `/api/folders` and
// `/api/assets`, its folders and its files. Everyone at a tenant reads its
// library, and an admin changes it. A file's document is udoc-server's to
// keep: an upload is imported into it, its first page rendered and kept as
// its thumbnail, and a file deleted is forgotten by it.
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import type { FastifyInstance, FastifyRequest } from "fastify";

import { managesLibrary } from "../../shared/api.ts";
import type { Asset, Folder, FolderListing, User } from "../../shared/api.ts";
import { Refusal, signedIn } from "../http.ts";
import type { Udoc } from "../udoc.ts";
import { keepThumbnail, thumbnailPath } from "./thumbnails.ts";

/** The largest upload: udoc-server's own limit. */
const MAX_UPLOAD_BYTES = 256 * 1024 * 1024;

/** How many of the files uploaded last Home shows. */
const RECENT_FILES = 8;

/** The longest name a folder or a file is given. */
const MAX_NAME = 200;

/** SQLite's code for a `UNIQUE` constraint failing. */
const SQLITE_CONSTRAINT_UNIQUE = 2067;

interface FolderRow {
    id: string;
    name: string;
    parent_id: string | null;
}

interface AssetRow {
    id: string;
    name: string;
    folder_id: string | null;
    format: string;
    size: number;
    document_id: string;
    uploaded_by: string;
    uploader_name: string;
    uploaded_at: number;
    /** 1 for a document kept as having no thumbnail; one not rendered yet is rendered when asked for. */
    no_thumbnail: number;
}

const ASSET_COLUMNS = `assets.id, assets.name, assets.folder_id, assets.format, assets.size,
    assets.document_id, assets.uploaded_by, users.name AS uploader_name, assets.uploaded_at,
    thumbnails.document_id IS NOT NULL AND thumbnails.png IS NULL AS no_thumbnail`;

/** The assets, with their uploaders and their thumbnails. */
const ASSETS = `assets JOIN users ON users.id = assets.uploaded_by
    LEFT JOIN thumbnails ON thumbnails.document_id = assets.document_id`;

function folderOfRow({ id, name, parent_id: parentId }: FolderRow): Folder {
    return { id, name, parentId };
}

function assetOfRow(row: AssetRow): Asset {
    return {
        id: row.id,
        name: row.name,
        folderId: row.folder_id,
        format: row.format,
        size: row.size,
        documentId: row.document_id,
        thumbnail: row.no_thumbnail ? null : thumbnailPath(row.document_id),
        uploadedBy: { id: row.uploaded_by, name: row.uploader_name },
        uploadedAt: row.uploaded_at,
    };
}

/** `value`, a name for a folder or a file, trimmed; a `400` for none, or one too long. */
function nameOf(value: unknown): string {
    const name = typeof value === "string" ? value.trim() : "";
    if (!name) throw new Refusal(400, "badRequest", "a name is needed");
    if (name.length > MAX_NAME) throw new Refusal(400, "badRequest", `a name is at most ${MAX_NAME} characters`);
    return name;
}

/** Whether `error` is SQLite turning down a second folder of the same name. */
function nameTaken(error: unknown): boolean {
    return (error as { errcode?: number }).errcode === SQLITE_CONSTRAINT_UNIQUE;
}

const NAME_TAKEN = () => new Refusal(409, "nameTaken", "a folder there has that name already");

export function libraryRoutes(app: FastifyInstance, db: DatabaseSync, udoc: Udoc): void {
    // An upload is the file's bytes, as they are.
    app.addContentTypeParser(
        "application/octet-stream",
        { parseAs: "buffer", bodyLimit: MAX_UPLOAD_BYTES },
        (_request, body, done) => done(null, body),
    );

    /** The user signed in, who changes the library; a `403` for one who doesn't. */
    function manager(request: FastifyRequest): User {
        const user = signedIn(db, request);
        if (!managesLibrary(user.role)) throw new Refusal(403, "forbidden", "only an admin changes the library");
        return user;
    }

    /** Folder `id` of `user`'s tenant; a `404` for none. */
    function folderOf(user: User, id: string): Folder {
        const row = db
            .prepare("SELECT id, name, parent_id FROM folders WHERE id = ? AND tenant_id = ?")
            .get(id, user.tenant.id) as FolderRow | undefined;
        if (!row) throw new Refusal(404, "notFound", "no such folder");
        return folderOfRow(row);
    }

    /** The folders from the top down to folder `id`, it last; a `404` for none. */
    function pathTo(user: User, id: string | null): Folder[] {
        if (id === null) return [];
        const rows = db
            .prepare(
                `WITH RECURSIVE path (id, name, parent_id, depth) AS (
                    SELECT id, name, parent_id, 0 FROM folders WHERE id = ? AND tenant_id = ?
                    UNION ALL
                    SELECT folders.id, folders.name, folders.parent_id, path.depth + 1
                    FROM folders JOIN path ON folders.id = path.parent_id
                )
                SELECT id, name, parent_id FROM path ORDER BY depth DESC`,
            )
            .all(id, user.tenant.id) as unknown as FolderRow[];
        if (rows.length === 0) throw new Refusal(404, "notFound", "no such folder");
        return rows.map(folderOfRow);
    }

    /** Asset `id` of `user`'s tenant; a `404` for none. */
    function assetOf(user: User, id: string): Asset {
        const row = db
            .prepare(
                `SELECT ${ASSET_COLUMNS} FROM ${ASSETS}
                WHERE assets.id = ? AND assets.tenant_id = ?`,
            )
            .get(id, user.tenant.id) as AssetRow | undefined;
        if (!row) throw new Refusal(404, "notFound", "no such file");
        return assetOfRow(row);
    }

    /** `FolderListing`: what folder `?folder=` holds, or, with none, the library's top. */
    app.get<{ Querystring: { folder?: string } }>("/api/library", async (request): Promise<FolderListing> => {
        const user = signedIn(db, request);
        const folderId = request.query.folder || null;
        const path = pathTo(user, folderId);
        const folders = db
            .prepare(
                `SELECT id, name, parent_id FROM folders WHERE tenant_id = ? AND parent_id IS ?
                ORDER BY name COLLATE NOCASE`,
            )
            .all(user.tenant.id, folderId) as unknown as FolderRow[];
        const assets = db
            .prepare(
                `SELECT ${ASSET_COLUMNS} FROM ${ASSETS}
                WHERE assets.tenant_id = ? AND assets.folder_id IS ? ORDER BY assets.name COLLATE NOCASE`,
            )
            .all(user.tenant.id, folderId) as unknown as AssetRow[];
        return { path, folders: folders.map(folderOfRow), assets: assets.map(assetOfRow) };
    });

    /** `{ assets }`: the files uploaded last, in any folder, newest first. */
    app.get("/api/library/recent", async (request): Promise<{ assets: Asset[] }> => {
        const user = signedIn(db, request);
        const assets = db
            .prepare(
                `SELECT ${ASSET_COLUMNS} FROM ${ASSETS}
                WHERE assets.tenant_id = ? ORDER BY assets.uploaded_at DESC LIMIT ?`,
            )
            .all(user.tenant.id, RECENT_FILES) as unknown as AssetRow[];
        return { assets: assets.map(assetOfRow) };
    });

    /** Make a folder, `{ name, parentId }`, `parentId` `null` at the top: `201 { folder }`. */
    app.post<{ Body: { name?: unknown; parentId?: unknown } | undefined }>("/api/folders", async (request, reply) => {
        const user = manager(request);
        const name = nameOf(request.body?.name);
        const parentId = typeof request.body?.parentId === "string" ? folderOf(user, request.body.parentId).id : null;
        const folder: Folder = { id: randomUUID(), name, parentId };
        try {
            db.prepare("INSERT INTO folders (id, tenant_id, parent_id, name, created_at) VALUES (?, ?, ?, ?, ?)").run(
                folder.id,
                user.tenant.id,
                parentId,
                name,
                Date.now(),
            );
        } catch (error) {
            throw nameTaken(error) ? NAME_TAKEN() : error;
        }
        return reply.code(201).send({ folder });
    });

    /** Rename a folder, `{ name }`: `{ folder }`. */
    app.patch<{ Params: { id: string }; Body: { name?: unknown } | undefined }>("/api/folders/:id", async (request) => {
        const user = manager(request);
        const folder = { ...folderOf(user, request.params.id), name: nameOf(request.body?.name) };
        try {
            db.prepare("UPDATE folders SET name = ? WHERE id = ?").run(folder.name, folder.id);
        } catch (error) {
            throw nameTaken(error) ? NAME_TAKEN() : error;
        }
        return { folder };
    });

    /** Delete a folder with nothing in it: `204`, or `409` for one with folders or files. */
    app.delete<{ Params: { id: string } }>("/api/folders/:id", async (request, reply) => {
        const user = manager(request);
        const { id } = folderOf(user, request.params.id);
        const holds =
            db.prepare("SELECT 1 FROM folders WHERE parent_id = ?").get(id) ??
            db.prepare("SELECT 1 FROM assets WHERE folder_id = ?").get(id);
        if (holds) throw new Refusal(409, "folderNotEmpty", "only an empty folder is deleted");
        db.prepare("DELETE FROM folders WHERE id = ?").run(id);
        return reply.code(204).send();
    });

    /**
     * Upload a file into folder `?folder=`, or with none, the top, as
     * `?name=`: the body is its bytes, as `application/octet-stream`.
     * udoc-server imports it, and renders its first page, kept as its
     * thumbnail: `201 { asset }`, or udoc-server's failure when it doesn't
     * read it.
     */
    app.post<{ Querystring: { folder?: string; name?: string }; Body: unknown }>(
        "/api/assets",
        { bodyLimit: MAX_UPLOAD_BYTES },
        async (request, reply) => {
            const user = manager(request);
            const name = nameOf(request.query.name);
            const folderId = request.query.folder ? folderOf(user, request.query.folder).id : null;
            const bytes = request.body;
            if (!(bytes instanceof Buffer) || bytes.length === 0)
                throw new Refusal(400, "badRequest", "the body is the file's bytes, as application/octet-stream");
            const document = await udoc.importDocument(bytes);
            const asset: Asset = {
                id: randomUUID(),
                name,
                folderId,
                format: document.format,
                size: bytes.length,
                documentId: document.id,
                thumbnail: thumbnailPath(document.id),
                uploadedBy: { id: user.id, name: user.name },
                uploadedAt: Date.now(),
            };
            try {
                db.prepare(
                    `INSERT INTO assets (id, tenant_id, folder_id, name, format, size, document_id, uploaded_by,
                    uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                ).run(
                    asset.id,
                    user.tenant.id,
                    folderId,
                    name,
                    asset.format,
                    asset.size,
                    asset.documentId,
                    user.id,
                    asset.uploadedAt,
                );
            } catch (error) {
                // Its folder deleted meanwhile, say: no asset, so no document.
                await udoc.deleteDocument(document.id);
                throw error;
            }
            try {
                if (!(await keepThumbnail(db, udoc, document.id))) asset.thumbnail = null;
            } catch (error) {
                // The file is kept all the same; its thumbnail is rendered when it's asked for.
                request.log.warn(error, "a thumbnail wasn't rendered");
            }
            return reply.code(201).send({ asset });
        },
    );

    /** `{ asset, path }`: a file, and the folders from the top down to the one it's in. */
    app.get<{ Params: { id: string } }>("/api/assets/:id", async (request) => {
        const user = signedIn(db, request);
        const asset = assetOf(user, request.params.id);
        return { asset, path: pathTo(user, asset.folderId) };
    });

    /** Rename a file, `{ name }`: `{ asset }`. */
    app.patch<{ Params: { id: string }; Body: { name?: unknown } | undefined }>("/api/assets/:id", async (request) => {
        const user = manager(request);
        const asset = { ...assetOf(user, request.params.id), name: nameOf(request.body?.name) };
        db.prepare("UPDATE assets SET name = ? WHERE id = ?").run(asset.name, asset.id);
        return { asset };
    });

    /** Delete a file, and the document udoc-server keeps for it: `204`. */
    app.delete<{ Params: { id: string } }>("/api/assets/:id", async (request, reply) => {
        const user = manager(request);
        const { id, documentId } = assetOf(user, request.params.id);
        await udoc.deleteDocument(documentId);
        db.prepare("DELETE FROM assets WHERE id = ?").run(id);
        return reply.code(204).send();
    });
}
