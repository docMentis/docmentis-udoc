// A file in the library, as the routes read one: its row, with its uploader,
// its thumbnail and its latest version, and the `Asset` the API answers.
import type { DatabaseSync } from "node:sqlite";

import type { Asset, User, VersionStatus } from "../shared/api.ts";
import { Refusal } from "./http.ts";
import { thumbnailPath } from "./routes/thumbnails.ts";

export interface AssetRow {
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
    latest_number: number;
    latest_status: VersionStatus;
    published_version: number | null;
}

export const ASSET_COLUMNS = `assets.id, assets.name, assets.folder_id, assets.format, assets.size,
    assets.document_id, assets.uploaded_by, users.name AS uploader_name, assets.uploaded_at,
    thumbnails.document_id IS NOT NULL AND thumbnails.png IS NULL AS no_thumbnail,
    latest.number AS latest_number, latest.status AS latest_status, assets.published_version`;

/** The assets, with their uploaders, their thumbnails and their latest versions. */
export const ASSETS = `assets JOIN users ON users.id = assets.uploaded_by
    LEFT JOIN thumbnails ON thumbnails.document_id = assets.document_id
    JOIN versions AS latest ON latest.asset_id = assets.id
        AND latest.number = (SELECT MAX(number) FROM versions WHERE versions.asset_id = assets.id)`;

export function assetOfRow(row: AssetRow): Asset {
    return {
        id: row.id,
        name: row.name,
        folderId: row.folder_id,
        format: row.format,
        size: row.size,
        documentId: row.document_id,
        thumbnail: row.no_thumbnail ? null : thumbnailPath(row.document_id, row.latest_number),
        uploadedBy: { id: row.uploaded_by, name: row.uploader_name },
        uploadedAt: row.uploaded_at,
        latestVersion: { number: row.latest_number, status: row.latest_status },
        publishedVersion: row.published_version,
    };
}

/** Asset `id` of `user`'s tenant; a `404` for none. */
export function assetOf(db: DatabaseSync, user: User, id: string): Asset {
    const row = db
        .prepare(`SELECT ${ASSET_COLUMNS} FROM ${ASSETS} WHERE assets.id = ? AND assets.tenant_id = ?`)
        .get(id, user.tenant.id) as AssetRow | undefined;
    if (!row) throw new Refusal(404, "notFound", "no such file");
    return assetOfRow(row);
}
