// Who is signed in. Signing in is a work email and a password, checked against
// the scrypt hash `users` keeps; it starts a session, a random token in an
// HTTP-only cookie, kept in `sessions` until it expires or its user signs out.
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { DatabaseSync } from "node:sqlite";

import { DEFAULT_VIEWER_COLORS, isViewerColors } from "../shared/api.ts";
import type { Role, User, ViewerColors } from "../shared/api.ts";

const COOKIE = "shockwave_session";

/** How long a session lasts, in seconds. */
const SESSION_SECONDS = 7 * 24 * 60 * 60;

/** A `users` row joined to its tenant's name and brand, and whether the tenant has a logo. */
interface UserRow {
    id: string;
    email: string;
    name: string;
    title: string;
    role: Role;
    tenant_id: string;
    tenant_name: string;
    tenant_has_logo: number;
    tenant_logo_changed_at: number;
    tenant_brand_color: string | null;
    tenant_viewer_colors: string | null;
}

const USER_COLUMNS = `users.id, users.email, users.name, users.title, users.role,
    users.tenant_id, tenants.name AS tenant_name, tenants.logo IS NOT NULL AS tenant_has_logo,
    tenants.logo_changed_at AS tenant_logo_changed_at, tenants.brand_color AS tenant_brand_color,
    tenants.viewer_colors AS tenant_viewer_colors`;

/** The viewer's colors kept as JSON; the viewer's own for none, or for what isn't one. */
function viewerColorsOf(json: string | null): ViewerColors {
    try {
        const colors: unknown = json ? JSON.parse(json) : null;
        return isViewerColors(colors) ? colors : DEFAULT_VIEWER_COLORS;
    } catch {
        return DEFAULT_VIEWER_COLORS;
    }
}

function userOfRow(row: UserRow): User {
    const { id, email, name, title, role, tenant_id: tenantId } = row;
    // Its address names when it changed, so that a new one isn't an old one kept.
    const logo = row.tenant_has_logo ? `/api/tenants/${tenantId}/logo?v=${row.tenant_logo_changed_at}` : null;
    const tenant = {
        id: tenantId,
        name: row.tenant_name,
        logo,
        brandColor: row.tenant_brand_color,
        viewerColors: viewerColorsOf(row.tenant_viewer_colors),
    };
    return { id, email, name, title, role, tenant };
}

/** `password`, hashed to keep: `scrypt:<salt>:<hash>`, each base64url. */
export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const hash = await scryptOf(password, salt, 64);
    return `scrypt:${salt.toString("base64url")}:${hash.toString("base64url")}`;
}

/** Whether `password` is the one `kept` is the hash of. */
async function passwordMatches(password: string, kept: string): Promise<boolean> {
    const [scheme, salt, hash] = kept.split(":");
    if (scheme !== "scrypt" || !salt || !hash) return false;
    const expected = Buffer.from(hash, "base64url");
    const actual = await scryptOf(password, Buffer.from(salt, "base64url"), expected.length);
    return timingSafeEqual(actual, expected);
}

function scryptOf(password: string, salt: Buffer, length: number): Promise<Buffer> {
    return new Promise((resolve, reject) =>
        scrypt(password, salt, length, (error, hash) => (error ? reject(error) : resolve(hash))),
    );
}

/**
 * Sign in as `email`, with `password`: the user, and the `Set-Cookie` that
 * holds their new session; `undefined` when there's no such user or the
 * password is wrong.
 */
export async function signIn(
    db: DatabaseSync,
    email: string,
    password: string,
): Promise<{ user: User; cookie: string } | undefined> {
    const row = db
        .prepare(
            `SELECT ${USER_COLUMNS}, users.password_hash FROM users
            JOIN tenants ON tenants.id = users.tenant_id
            WHERE users.email = ?`,
        )
        .get(email.trim().toLowerCase()) as (UserRow & { password_hash: string }) | undefined;
    if (!row || !(await passwordMatches(password, row.password_hash))) return undefined;
    const token = randomBytes(32).toString("base64url");
    db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(
        token,
        row.id,
        Date.now() + SESSION_SECONDS * 1000,
    );
    return { user: userOfRow(row), cookie: sessionCookie(token, SESSION_SECONDS) };
}

/** The user `request` is signed in as, if its session is one that hasn't expired. */
export function userOf(db: DatabaseSync, request: IncomingMessage): User | undefined {
    const token = cookieOf(request, COOKIE);
    if (!token) return undefined;
    const row = db
        .prepare(
            `SELECT ${USER_COLUMNS} FROM sessions
            JOIN users ON users.id = sessions.user_id
            JOIN tenants ON tenants.id = users.tenant_id
            WHERE sessions.id = ? AND sessions.expires_at > ?`,
        )
        .get(token, Date.now()) as UserRow | undefined;
    return row && userOfRow(row);
}

/** Sign `request`'s session out: the `Set-Cookie` that clears it. */
export function endSession(db: DatabaseSync, request: IncomingMessage): string {
    const token = cookieOf(request, COOKIE);
    if (token) db.prepare("DELETE FROM sessions WHERE id = ?").run(token);
    return sessionCookie("", 0);
}

function sessionCookie(token: string, maxAge: number): string {
    return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

/** The value of cookie `name` in `request`'s `Cookie` header. */
function cookieOf(request: IncomingMessage, name: string): string | undefined {
    for (const pair of request.headers.cookie?.split(";") ?? []) {
        const at = pair.indexOf("=");
        if (at >= 0 && pair.slice(0, at).trim() === name) return pair.slice(at + 1).trim();
    }
    return undefined;
}
