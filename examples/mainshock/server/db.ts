// The app's data, in SQLite: tenants and their logos, their users, and the
// users' sessions.
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
];

/** Open the database in `file`, migrated to the latest schema. */
export function openDatabase(file: string): DatabaseSync {
    const db = new DatabaseSync(file);
    db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    const { user_version: applied } = db.prepare("PRAGMA user_version").get() as { user_version: number };
    for (let version = applied; version < MIGRATIONS.length; version++) {
        db.exec("BEGIN");
        try {
            db.exec(MIGRATIONS[version]);
            db.exec(`PRAGMA user_version = ${version + 1}`);
            db.exec("COMMIT");
        } catch (error) {
            db.exec("ROLLBACK");
            throw error;
        }
    }
    return db;
}
