// The app's data, in SQLite: tenants and their brands, their users, the users'
// sessions; the library: its folders, its files, their versions and their
// thumbnails; the collections its published files are arranged in; and the deal
// rooms sales prepare them in, each with the frontstage its buyers read.
import { DatabaseSync } from "node:sqlite";

/**
 * Each migration in turn; `PRAGMA user_version` counts those applied. A
 * migration once released is never edited: the next change is another.
 */
const MIGRATIONS = [
    `
    CREATE TABLE tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
    );
    CREATE TABLE users (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants (id),
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        title TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('marketing', 'sales'))
    );
    CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL
    );
    `,
    // A tenant's logo: its image, and the image's media type.
    `
    ALTER TABLE tenants ADD COLUMN logo BLOB;
    ALTER TABLE tenants ADD COLUMN logo_type TEXT;
    `,
    // Signing in with a work email, and a role for what a user may do. SQLite
    // changes a CHECK only by building the table anew: the users so far, all
    // Larchmere's, get its domain after their usernames, marketing becomes an
    // admin and sales a member, and dropping the old table ends every session.
    `
    CREATE TABLE users_new (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants (id),
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        title TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'reviewer', 'member'))
    );
    INSERT INTO users_new
        SELECT id, tenant_id, username || '@larchmere.example', password_hash, name, title,
            CASE role WHEN 'marketing' THEN 'admin' ELSE 'member' END
        FROM users;
    DROP TABLE users;
    ALTER TABLE users_new RENAME TO users;
    `,
    // The library: its folders, a tree, each in its parent or at the top, and
    // named apart from its siblings; and its files, the assets, each in a
    // folder or at the top, the document udoc-server keeps as `document_id`.
    `
    CREATE TABLE folders (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants (id),
        parent_id TEXT REFERENCES folders (id),
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX folders_by_name ON folders (tenant_id, coalesce(parent_id, ''), lower(name));
    CREATE TABLE assets (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants (id),
        folder_id TEXT REFERENCES folders (id),
        name TEXT NOT NULL,
        format TEXT NOT NULL,
        size INTEGER NOT NULL,
        document_id TEXT NOT NULL UNIQUE,
        uploaded_by TEXT NOT NULL REFERENCES users (id),
        uploaded_at INTEGER NOT NULL
    );
    CREATE INDEX assets_by_folder ON assets (tenant_id, folder_id);
    `,
    // A file's thumbnail: its document's first page, as a PNG, rendered once
    // and kept; \`png\` NULL for a document udoc-server can't render it of.
    `
    CREATE TABLE thumbnails (
        document_id TEXT PRIMARY KEY REFERENCES assets (document_id) ON DELETE CASCADE,
        png BLOB
    );
    `,
    // A tenant's brand: its color, `#rrggbb`, Larchmere's its forest green;
    // and when its logo last changed, which its address names, so that a
    // browser asks again for a new one.
    `
    ALTER TABLE tenants ADD COLUMN brand_color TEXT;
    ALTER TABLE tenants ADD COLUMN logo_changed_at INTEGER NOT NULL DEFAULT 0;
    UPDATE tenants SET brand_color = '#1f4e3d' WHERE name = 'Larchmere';
    `,
    // The document viewer's colors in the app, a tenant's: JSON, a
    // ViewerColors; NULL for the viewer's own.
    `
    ALTER TABLE tenants ADD COLUMN viewer_colors TEXT;
    `,
    // A file's versions, each a checkpoint of its document, numbered 1, 2, 3
    // for people: udoc-server's own numbers have gaps. What happened to each
    // is kept as it happened, and which one is published on the file. No file
    // has been edited so far, so each is one version, its upload, checkpoint 0.
    `
    CREATE TABLE versions (
        asset_id TEXT NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
        number INTEGER NOT NULL,
        checkpoint INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'approved', 'returned')),
        PRIMARY KEY (asset_id, number)
    );
    CREATE TABLE version_events (
        id INTEGER PRIMARY KEY,
        asset_id TEXT NOT NULL,
        number INTEGER NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('saved', 'submitted', 'approved', 'returned', 'published')),
        user_id TEXT NOT NULL REFERENCES users (id),
        at INTEGER NOT NULL,
        note TEXT,
        FOREIGN KEY (asset_id, number) REFERENCES versions (asset_id, number) ON DELETE CASCADE
    );
    CREATE INDEX version_events_by_version ON version_events (asset_id, number);
    ALTER TABLE assets ADD COLUMN published_version INTEGER;
    INSERT INTO versions (asset_id, number, checkpoint, status) SELECT id, 1, 0, 'draft' FROM assets;
    INSERT INTO version_events (asset_id, number, kind, user_id, at)
        SELECT id, 1, 'saved', uploaded_by, uploaded_at FROM assets;
    `,
    // A version's reviewer, who alone approves or returns it; and two more
    // events, a change of reviewer and a version dismissed, each naming who
    // it was sent to where it was sent to someone. SQLite changes a CHECK only
    // by building the table anew. A version decided already was reviewed by
    // whoever decided it; one still waiting goes to the tenant's first reviewer,
    // and is reassigned from there.
    `
    ALTER TABLE versions ADD COLUMN reviewer_id TEXT REFERENCES users (id);
    CREATE TABLE version_events_new (
        id INTEGER PRIMARY KEY,
        asset_id TEXT NOT NULL,
        number INTEGER NOT NULL,
        kind TEXT NOT NULL CHECK (
            kind IN ('saved', 'submitted', 'approved', 'returned', 'published', 'reassigned', 'dismissed')
        ),
        user_id TEXT NOT NULL REFERENCES users (id),
        to_user_id TEXT REFERENCES users (id),
        at INTEGER NOT NULL,
        note TEXT,
        FOREIGN KEY (asset_id, number) REFERENCES versions (asset_id, number) ON DELETE CASCADE
    );
    INSERT INTO version_events_new (id, asset_id, number, kind, user_id, at, note)
        SELECT id, asset_id, number, kind, user_id, at, note FROM version_events;
    DROP TABLE version_events;
    ALTER TABLE version_events_new RENAME TO version_events;
    CREATE INDEX version_events_by_version ON version_events (asset_id, number);
    UPDATE versions SET reviewer_id = (
        SELECT user_id FROM version_events AS event
        WHERE event.asset_id = versions.asset_id AND event.number = versions.number
            AND event.kind IN ('approved', 'returned')
        ORDER BY event.id DESC LIMIT 1
    ) WHERE status IN ('approved', 'returned');
    UPDATE versions SET reviewer_id = (
        SELECT users.id FROM users JOIN assets ON assets.tenant_id = users.tenant_id
        WHERE assets.id = versions.asset_id AND users.role = 'reviewer'
        ORDER BY users.name LIMIT 1
    ) WHERE status = 'submitted';
    UPDATE version_events SET to_user_id = (
        SELECT reviewer_id FROM versions
        WHERE versions.asset_id = version_events.asset_id AND versions.number = version_events.number
    ) WHERE kind = 'submitted';
    `,
    // A manager, who arranges collections. SQLite changes a CHECK only by
    // building the table anew; foreign keys are off as it's built, so what
    // refers to a user, their sessions among it, stays as it is.
    `
    CREATE TABLE users_new (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants (id),
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        title TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'reviewer', 'manager', 'member'))
    );
    INSERT INTO users_new SELECT id, tenant_id, email, password_hash, name, title, role FROM users;
    DROP TABLE users;
    ALTER TABLE users_new RENAME TO users;
    `,
    // A thumbnail for each version, its first page as it was saved, where each
    // file had one: so a published version's isn't a later draft's. The one a
    // file has is its latest version's, and an older version has none.
    `
    CREATE TABLE thumbnails_new (
        asset_id TEXT NOT NULL,
        number INTEGER NOT NULL,
        png BLOB,
        PRIMARY KEY (asset_id, number),
        FOREIGN KEY (asset_id, number) REFERENCES versions (asset_id, number) ON DELETE CASCADE
    );
    INSERT INTO thumbnails_new (asset_id, number, png)
        SELECT assets.id, (SELECT MAX(number) FROM versions WHERE versions.asset_id = assets.id), thumbnails.png
        FROM thumbnails JOIN assets ON assets.document_id = thumbnails.document_id;
    DROP TABLE thumbnails;
    ALTER TABLE thumbnails_new RENAME TO thumbnails;
    `,
    // A tenant's collections, each named apart from its others, and each
    // choosing its own files, a file in any number of them. An item names its
    // tenant, and its keys hold both its collection and its file to it, so
    // nothing can join one tenant's collection to another's file.
    `
    CREATE UNIQUE INDEX assets_of_tenant ON assets (id, tenant_id);
    CREATE TABLE collections (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants (id),
        name TEXT NOT NULL,
        description TEXT,
        instructions TEXT,
        updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX collections_by_name ON collections (tenant_id, lower(name));
    CREATE UNIQUE INDEX collections_of_tenant ON collections (id, tenant_id);
    CREATE TABLE collection_items (
        collection_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        instructions TEXT,
        PRIMARY KEY (collection_id, asset_id),
        FOREIGN KEY (collection_id, tenant_id) REFERENCES collections (id, tenant_id) ON DELETE CASCADE,
        FOREIGN KEY (asset_id, tenant_id) REFERENCES assets (id, tenant_id) ON DELETE CASCADE
    );
    CREATE INDEX collection_items_by_asset ON collection_items (asset_id);
    `,
    // A tenant's deal rooms, backstage: each with who's on it, and its files, a
    // file being an asset, with versions like any other's, that this table holds
    // out of the library. A room's files are deleted with their documents before
    // it is, so its key doesn't cascade: a room going alone would hand its files
    // to the library. And what's on its frontstage, its link and a copy of what
    // was put there, read apart from the backstage, so that nothing reaches a
    // buyer before someone puts it on: which version of a file is on it is the
    // asset's published_version. Keys hold what they join to one tenant.
    `
    CREATE UNIQUE INDEX users_of_tenant ON users (id, tenant_id);
    CREATE TABLE deal_rooms (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants (id),
        title TEXT NOT NULL,
        description TEXT,
        banner_color TEXT,
        banner_image BLOB,
        banner_image_type TEXT,
        banner_changed_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX deal_rooms_of_tenant ON deal_rooms (id, tenant_id);
    CREATE INDEX deal_rooms_by_tenant ON deal_rooms (tenant_id, updated_at);
    CREATE TABLE deal_room_people (
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        PRIMARY KEY (room_id, user_id),
        FOREIGN KEY (room_id, tenant_id) REFERENCES deal_rooms (id, tenant_id) ON DELETE CASCADE,
        FOREIGN KEY (user_id, tenant_id) REFERENCES users (id, tenant_id) ON DELETE CASCADE
    );
    CREATE INDEX deal_room_people_by_user ON deal_room_people (user_id);
    CREATE TABLE deal_room_files (
        asset_id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        description TEXT,
        source_asset_id TEXT REFERENCES assets (id) ON DELETE SET NULL,
        source_name TEXT NOT NULL,
        source_version INTEGER NOT NULL,
        FOREIGN KEY (room_id, tenant_id) REFERENCES deal_rooms (id, tenant_id),
        FOREIGN KEY (asset_id, tenant_id) REFERENCES assets (id, tenant_id) ON DELETE CASCADE
    );
    CREATE INDEX deal_room_files_by_room ON deal_room_files (room_id, position);
    CREATE UNIQUE INDEX deal_room_files_by_source ON deal_room_files (room_id, source_asset_id);
    CREATE TABLE frontstages (
        room_id TEXT PRIMARY KEY REFERENCES deal_rooms (id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        banner_color TEXT,
        banner_image BLOB,
        banner_image_type TEXT,
        staged_by TEXT NOT NULL REFERENCES users (id),
        staged_at INTEGER NOT NULL
    );
    CREATE TABLE frontstage_files (
        room_id TEXT NOT NULL REFERENCES frontstages (room_id) ON DELETE CASCADE,
        asset_id TEXT NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        position INTEGER NOT NULL,
        PRIMARY KEY (room_id, asset_id)
    );
    CREATE INDEX frontstage_files_by_asset ON frontstage_files (asset_id);
    `,
];

/** SQLite's code for a `UNIQUE` constraint failing. */
const SQLITE_CONSTRAINT_UNIQUE = 2067;

/** Whether `error` is SQLite turning down a second row where a `UNIQUE` constraint allows one. */
export function isUniqueFailure(error: unknown): boolean {
    return (error as { errcode?: number }).errcode === SQLITE_CONSTRAINT_UNIQUE;
}

/** Run `change`: all of it, or, when it throws, none. */
export function inTransaction<T>(db: DatabaseSync, change: () => T): T {
    db.exec("BEGIN");
    try {
        const result = change();
        db.exec("COMMIT");
        return result;
    } catch (error) {
        db.exec("ROLLBACK");
        throw error;
    }
}

/** Open the database in `file`, migrated to the latest schema. */
export function openDatabase(file: string): DatabaseSync {
    const db = new DatabaseSync(file);
    db.exec("PRAGMA journal_mode = WAL;");
    const { user_version: applied } = db.prepare("PRAGMA user_version").get() as { user_version: number };
    // Off while the schema changes, as SQLite has it for building a table anew:
    // dropping one that others refer to would delete what refers to it, or
    // refuse to. Each migration's checked before it's kept.
    db.exec("PRAGMA foreign_keys = OFF");
    for (let version = applied; version < MIGRATIONS.length; version++) {
        db.exec("BEGIN");
        try {
            db.exec(MIGRATIONS[version]);
            const broken = db.prepare("PRAGMA foreign_key_check").all();
            if (broken.length > 0)
                throw new Error(`migration ${version} broke foreign keys: ${JSON.stringify(broken)}`);
            db.exec(`PRAGMA user_version = ${version + 1}`);
            db.exec("COMMIT");
        } catch (error) {
            db.exec("ROLLBACK");
            throw error;
        }
    }
    db.exec("PRAGMA foreign_keys = ON");
    return db;
}
