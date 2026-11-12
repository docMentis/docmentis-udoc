// The app's data, in SQLite, one database that every tenant shares and none can
// reach another through (docs/design/examples-shockwave.md). Each row says whose it
// is: `tenant_id` starts every table's key and every key that refers to another
// row, so that no row can refer to another tenant's. And the routes hold no database,
// only a `TenantDb`, which runs a statement only if it names its tenant.
//
// What's in it: tenants and their brands, their users, the users' sessions; the
// library: its folders, its files, their versions and their thumbnails; the
// collections its published files are arranged in; and the deal rooms sales prepare
// them in, each with the frontstage its buyers read, and what they read there.
import { DatabaseSync } from "node:sqlite";
import type { SQLInputValue, SQLOutputValue, StatementResultingChanges } from "node:sqlite";

/**
 * Each migration in turn; `PRAGMA user_version` counts those applied. A
 * migration once released is never edited: the next change is another.
 */
const MIGRATIONS = [
    // A file is an asset, its document kept by udoc-server as `document_id`, in a
    // folder or at the top; a version is a checkpoint of that document, numbered 1,
    // 2, 3 for people, since udoc-server's own numbers have gaps, and what happened
    // to it is kept as it happened. A version's thumbnail is its first page as it was
    // saved, `png` NULL for a document udoc-server can't render it of.
    //
    // A deal room's file is an asset too, which `deal_room_files` holds out of the
    // library. A room's files are deleted with their documents before it is, so that
    // key doesn't cascade: a room going alone would hand its files to the library.
    // A file outlives the one it was copied from: SQLite's SET NULL would clear the
    // whole key, tenant and all, so a trigger clears `source_asset_id` alone.
    //
    // What's on a frontstage is its link and a copy of what was put there, read apart
    // from the backstage, so that nothing reaches a buyer before someone puts it on;
    // which version of a file is on it is the asset's `published_version`.
    //
    // Only a user's email and a session's or a frontstage's token are unique across
    // tenants: they're how a request comes to say which tenant it's for.
    `
    CREATE TABLE tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        logo BLOB,
        logo_type TEXT,
        logo_changed_at INTEGER NOT NULL DEFAULT 0,
        brand_color TEXT,
        viewer_colors TEXT
    );
    CREATE TABLE users (
        tenant_id TEXT NOT NULL REFERENCES tenants (id),
        id TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        title TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'reviewer', 'manager', 'member')),
        PRIMARY KEY (tenant_id, id)
    );
    CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, id) ON DELETE CASCADE
    );
    CREATE INDEX sessions_by_user ON sessions (tenant_id, user_id);

    CREATE TABLE folders (
        tenant_id TEXT NOT NULL REFERENCES tenants (id),
        id TEXT NOT NULL,
        parent_id TEXT,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (tenant_id, id),
        FOREIGN KEY (tenant_id, parent_id) REFERENCES folders (tenant_id, id)
    );
    CREATE UNIQUE INDEX folders_by_name ON folders (tenant_id, coalesce(parent_id, ''), lower(name));
    CREATE TABLE assets (
        tenant_id TEXT NOT NULL REFERENCES tenants (id),
        id TEXT NOT NULL,
        folder_id TEXT,
        name TEXT NOT NULL,
        format TEXT NOT NULL,
        size INTEGER NOT NULL,
        document_id TEXT NOT NULL,
        uploaded_by TEXT NOT NULL,
        uploaded_at INTEGER NOT NULL,
        published_version INTEGER,
        PRIMARY KEY (tenant_id, id),
        UNIQUE (tenant_id, document_id),
        FOREIGN KEY (tenant_id, folder_id) REFERENCES folders (tenant_id, id),
        FOREIGN KEY (tenant_id, uploaded_by) REFERENCES users (tenant_id, id)
    );
    CREATE INDEX assets_by_folder ON assets (tenant_id, folder_id);
    CREATE TABLE versions (
        tenant_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        number INTEGER NOT NULL,
        checkpoint INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'approved', 'returned')),
        reviewer_id TEXT,
        PRIMARY KEY (tenant_id, asset_id, number),
        FOREIGN KEY (tenant_id, asset_id) REFERENCES assets (tenant_id, id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id, reviewer_id) REFERENCES users (tenant_id, id)
    );
    CREATE TABLE version_events (
        id INTEGER PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        number INTEGER NOT NULL,
        kind TEXT NOT NULL CHECK (
            kind IN ('saved', 'submitted', 'approved', 'returned', 'published', 'reassigned', 'dismissed')
        ),
        user_id TEXT NOT NULL,
        to_user_id TEXT,
        at INTEGER NOT NULL,
        note TEXT,
        FOREIGN KEY (tenant_id, asset_id, number) REFERENCES versions (tenant_id, asset_id, number) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, id),
        FOREIGN KEY (tenant_id, to_user_id) REFERENCES users (tenant_id, id)
    );
    CREATE INDEX version_events_by_version ON version_events (tenant_id, asset_id, number);
    CREATE TABLE thumbnails (
        tenant_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        number INTEGER NOT NULL,
        png BLOB,
        PRIMARY KEY (tenant_id, asset_id, number),
        FOREIGN KEY (tenant_id, asset_id, number) REFERENCES versions (tenant_id, asset_id, number) ON DELETE CASCADE
    );

    CREATE TABLE collections (
        tenant_id TEXT NOT NULL REFERENCES tenants (id),
        id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        instructions TEXT,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (tenant_id, id)
    );
    CREATE UNIQUE INDEX collections_by_name ON collections (tenant_id, lower(name));
    CREATE TABLE collection_items (
        tenant_id TEXT NOT NULL,
        collection_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        instructions TEXT,
        PRIMARY KEY (tenant_id, collection_id, asset_id),
        FOREIGN KEY (tenant_id, collection_id) REFERENCES collections (tenant_id, id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id, asset_id) REFERENCES assets (tenant_id, id) ON DELETE CASCADE
    );
    CREATE INDEX collection_items_by_asset ON collection_items (tenant_id, asset_id);

    CREATE TABLE deal_rooms (
        tenant_id TEXT NOT NULL REFERENCES tenants (id),
        id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        banner_color TEXT,
        banner_image BLOB,
        banner_image_type TEXT,
        banner_changed_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (tenant_id, id)
    );
    CREATE INDEX deal_rooms_by_change ON deal_rooms (tenant_id, updated_at);
    CREATE TABLE deal_room_people (
        tenant_id TEXT NOT NULL,
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        PRIMARY KEY (tenant_id, room_id, user_id),
        FOREIGN KEY (tenant_id, room_id) REFERENCES deal_rooms (tenant_id, id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, id) ON DELETE CASCADE
    );
    CREATE INDEX deal_room_people_by_user ON deal_room_people (tenant_id, user_id);
    CREATE TABLE deal_room_files (
        tenant_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        room_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        description TEXT,
        source_asset_id TEXT,
        source_name TEXT NOT NULL,
        source_version INTEGER NOT NULL,
        PRIMARY KEY (tenant_id, asset_id),
        FOREIGN KEY (tenant_id, room_id) REFERENCES deal_rooms (tenant_id, id),
        FOREIGN KEY (tenant_id, asset_id) REFERENCES assets (tenant_id, id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id, source_asset_id) REFERENCES assets (tenant_id, id)
    );
    CREATE INDEX deal_room_files_by_room ON deal_room_files (tenant_id, room_id, position);
    CREATE UNIQUE INDEX deal_room_files_of_source ON deal_room_files (tenant_id, room_id, source_asset_id);
    CREATE INDEX deal_room_files_by_source ON deal_room_files (tenant_id, source_asset_id);
    CREATE TRIGGER deal_room_files_outlive_source BEFORE DELETE ON assets BEGIN
        UPDATE deal_room_files SET source_asset_id = NULL
        WHERE tenant_id = OLD.tenant_id AND source_asset_id = OLD.id;
    END;
    CREATE TABLE frontstages (
        tenant_id TEXT NOT NULL,
        room_id TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        banner_color TEXT,
        banner_image BLOB,
        banner_image_type TEXT,
        staged_by TEXT NOT NULL,
        staged_at INTEGER NOT NULL,
        PRIMARY KEY (tenant_id, room_id),
        FOREIGN KEY (tenant_id, room_id) REFERENCES deal_rooms (tenant_id, id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id, staged_by) REFERENCES users (tenant_id, id)
    );
    CREATE TABLE frontstage_files (
        tenant_id TEXT NOT NULL,
        room_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        position INTEGER NOT NULL,
        PRIMARY KEY (tenant_id, room_id, asset_id),
        FOREIGN KEY (tenant_id, room_id) REFERENCES frontstages (tenant_id, room_id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id, asset_id) REFERENCES assets (tenant_id, id) ON DELETE CASCADE
    );
    CREATE INDEX frontstage_files_by_asset ON frontstage_files (tenant_id, asset_id);
    `,
    // What buyers read of a frontstage. A visitor is a browser, named by a cookie for
    // one link alone, with nothing of who it is. What it reads is kept as running
    // totals, so this grows with visitors and pages and not with time. All of it is
    // the room's, so it outlives the room's link, and goes with the room or the file.
    // Those on a room say when they last looked at this, for what's new to them.
    `
    ALTER TABLE deal_room_people ADD COLUMN activity_seen_at INTEGER NOT NULL DEFAULT 0;
    CREATE TABLE frontstage_visitors (
        tenant_id TEXT NOT NULL,
        room_id TEXT NOT NULL,
        id TEXT NOT NULL,
        first_at INTEGER NOT NULL,
        last_at INTEGER NOT NULL,
        PRIMARY KEY (tenant_id, room_id, id),
        FOREIGN KEY (tenant_id, room_id) REFERENCES deal_rooms (tenant_id, id) ON DELETE CASCADE
    );
    CREATE INDEX frontstage_visitors_by_last ON frontstage_visitors (tenant_id, room_id, last_at);
    CREATE TABLE frontstage_file_opens (
        tenant_id TEXT NOT NULL,
        room_id TEXT NOT NULL,
        visitor_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        opens INTEGER NOT NULL,
        last_at INTEGER NOT NULL,
        PRIMARY KEY (tenant_id, asset_id, visitor_id),
        FOREIGN KEY (tenant_id, room_id, visitor_id) REFERENCES frontstage_visitors (tenant_id, room_id, id)
            ON DELETE CASCADE,
        FOREIGN KEY (tenant_id, asset_id) REFERENCES assets (tenant_id, id) ON DELETE CASCADE
    );
    CREATE INDEX frontstage_file_opens_by_visitor ON frontstage_file_opens (tenant_id, room_id, visitor_id);
    CREATE TABLE frontstage_page_reads (
        tenant_id TEXT NOT NULL,
        room_id TEXT NOT NULL,
        visitor_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        page INTEGER NOT NULL,
        ms INTEGER NOT NULL,
        PRIMARY KEY (tenant_id, asset_id, version, page, visitor_id),
        FOREIGN KEY (tenant_id, room_id, visitor_id) REFERENCES frontstage_visitors (tenant_id, room_id, id)
            ON DELETE CASCADE,
        FOREIGN KEY (tenant_id, asset_id) REFERENCES assets (tenant_id, id) ON DELETE CASCADE
    );
    CREATE INDEX frontstage_page_reads_by_visitor ON frontstage_page_reads (tenant_id, room_id, visitor_id);
    `,
    // A version's thumbnails are each of its pages as it was saved, `page` counting
    // from 0, and a version udoc-server rendered none of has no row. Those kept
    // before were first pages alone, and stay so.
    `
    CREATE TABLE page_thumbnails (
        tenant_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        number INTEGER NOT NULL,
        page INTEGER NOT NULL,
        png BLOB NOT NULL,
        PRIMARY KEY (tenant_id, asset_id, number, page),
        FOREIGN KEY (tenant_id, asset_id, number) REFERENCES versions (tenant_id, asset_id, number) ON DELETE CASCADE
    );
    INSERT INTO page_thumbnails (tenant_id, asset_id, number, page, png)
        SELECT tenant_id, asset_id, number, 0, png FROM thumbnails WHERE png IS NOT NULL;
    DROP TABLE thumbnails;
    ALTER TABLE page_thumbnails RENAME TO thumbnails;
    `,
    // What buyers read, as it happened: a session is one opening of a file by a
    // visitor, at the version shown then, and each page view in it a stretch of
    // time a page was on screen, in milliseconds since the session began, named by
    // when it began. This grows with time, held back by what a report and a session
    // may hold. The running totals before it are let go.
    `
    DROP TABLE frontstage_page_reads;
    DROP TABLE frontstage_file_opens;
    CREATE TABLE frontstage_sessions (
        tenant_id TEXT NOT NULL,
        room_id TEXT NOT NULL,
        visitor_id TEXT NOT NULL,
        id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        started_at INTEGER NOT NULL,
        PRIMARY KEY (tenant_id, id),
        FOREIGN KEY (tenant_id, room_id, visitor_id) REFERENCES frontstage_visitors (tenant_id, room_id, id)
            ON DELETE CASCADE,
        FOREIGN KEY (tenant_id, asset_id) REFERENCES assets (tenant_id, id) ON DELETE CASCADE
    );
    CREATE INDEX frontstage_sessions_by_file ON frontstage_sessions (tenant_id, asset_id, started_at);
    CREATE INDEX frontstage_sessions_by_visitor ON frontstage_sessions (tenant_id, room_id, visitor_id);
    CREATE TABLE frontstage_page_views (
        tenant_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        started_ms INTEGER NOT NULL,
        ended_ms INTEGER NOT NULL,
        page INTEGER NOT NULL,
        PRIMARY KEY (tenant_id, session_id, started_ms),
        FOREIGN KEY (tenant_id, session_id) REFERENCES frontstage_sessions (tenant_id, id) ON DELETE CASCADE
    );
    `,
    // Several pages are on screen at once, scrolling, and two can come into view
    // in the same moment: a page view is named by its page and when it began.
    `
    CREATE TABLE page_views_by_page (
        tenant_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        page INTEGER NOT NULL,
        started_ms INTEGER NOT NULL,
        ended_ms INTEGER NOT NULL,
        PRIMARY KEY (tenant_id, session_id, page, started_ms),
        FOREIGN KEY (tenant_id, session_id) REFERENCES frontstage_sessions (tenant_id, id) ON DELETE CASCADE
    );
    INSERT INTO page_views_by_page (tenant_id, session_id, page, started_ms, ended_ms)
        SELECT tenant_id, session_id, page, started_ms, ended_ms FROM frontstage_page_views;
    DROP TABLE frontstage_page_views;
    ALTER TABLE page_views_by_page RENAME TO frontstage_page_views;
    `,
    // A version submitted for review is reviewed in a branch udoc-server starts at
    // its checkpoint, `review_branch`: what its reviewer writes on it goes there,
    // and into the working copy once they decide. One submitted before has none.
    `
    ALTER TABLE versions ADD COLUMN review_branch TEXT;
    `,
    // A tenant the seed makes waits, `seed_pending`, for the library, collections and
    // deal room the seed fills it with once the server's up (`server/seed.ts`).
    `
    ALTER TABLE tenants ADD COLUMN seed_pending INTEGER NOT NULL DEFAULT 0;
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

/** What a statement binds: its named parameters, if it has any besides `:tenant`, then its anonymous ones. */
type StatementParameters = [Record<string, SQLInputValue>, ...SQLInputValue[]] | SQLInputValue[];

/** A statement of one tenant's, which binds its `:tenant` itself. */
export interface TenantStatement {
    get(...parameters: StatementParameters): Record<string, SQLOutputValue> | undefined;
    all(...parameters: StatementParameters): Record<string, SQLOutputValue>[];
    run(...parameters: StatementParameters): StatementResultingChanges;
}

/** Whether a statement names its tenant. */
const NAMES_TENANT = /:tenant\b/;

/**
 * The database as one tenant has it, and all that the routes and the gate read it
 * through. A statement it runs has to name `:tenant`, which it binds itself, so a
 * query that forgets its tenant fails the first time it runs, rather than answering
 * with everyone's rows. Reaching two tenants is something else: it takes the database
 * itself, which only sign-in and the links that say which tenant they're for hold.
 */
export class TenantDb {
    readonly tenantId: string;
    readonly #db: DatabaseSync;

    constructor(db: DatabaseSync, tenantId: string) {
        this.#db = db;
        this.tenantId = tenantId;
    }

    /** `sql`, to run for this tenant: thrown out if it doesn't name `:tenant`. */
    prepare(sql: string): TenantStatement {
        if (!NAMES_TENANT.test(sql)) throw new Error(`a statement has to name its tenant, as :tenant: ${sql}`);
        const statement = this.#db.prepare(sql);
        const { tenantId: tenant } = this;
        // The named parameters, with the tenant's, then the anonymous ones.
        const bound = (parameters: StatementParameters): [Record<string, SQLInputValue>, ...SQLInputValue[]] => {
            const [first, ...rest] = parameters;
            return isNamed(first)
                ? [{ ...first, tenant }, ...(rest as SQLInputValue[])]
                : [{ tenant }, ...(parameters as SQLInputValue[])];
        };
        return {
            get: (...parameters) => statement.get(...bound(parameters)),
            all: (...parameters) => statement.all(...bound(parameters)),
            run: (...parameters) => statement.run(...bound(parameters)),
        };
    }

    /** Run `change`: all of it, or, when it throws, none. */
    transaction<T>(change: () => T): T {
        return inTransaction(this.#db, change);
    }
}

/** Whether `parameter` is a statement's named parameters, not a value to bind. */
function isNamed(parameter: unknown): parameter is Record<string, SQLInputValue> {
    return typeof parameter === "object" && parameter !== null && !ArrayBuffer.isView(parameter);
}

/** Whether `db` is from before every table named its tenant, which no migration carries over. */
function isFromBeforeTenantIds(db: DatabaseSync): boolean {
    const columns = db.prepare("PRAGMA table_info(sessions)").all() as unknown as { name: string }[];
    return columns.length > 0 && !columns.some(({ name }) => name === "tenant_id");
}

/** Open the database in `file`, migrated to the latest schema. */
export function openDatabase(file: string): DatabaseSync {
    const db = new DatabaseSync(file);
    if (isFromBeforeTenantIds(db)) {
        db.close();
        throw new Error(`${file} is from an older shockwave: run \`npm run shockwave:clear\`, which deletes its data`);
    }
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
