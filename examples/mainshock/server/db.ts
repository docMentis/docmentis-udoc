// The app's data, in SQLite: tenants, their users, and the users' sessions.
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
