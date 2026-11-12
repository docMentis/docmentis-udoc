// The example tenant, Larchmere, an imaginary asset manager, with its logo
// (`seed/larchmere/`), and its users (`shared/personas.ts`). An empty database
// gets them all, and one from before a user was added, that user, so that it
// needn't start over. A Larchmere made here then waits for its library,
// collections and deal room, which `seedContent` gives it once the server's up.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";

import type { FastifyInstance } from "fastify";

import { DEMO_PASSWORD, PERSONAS } from "../shared/personas.ts";
import { hashPassword } from "./auth.ts";
import { config } from "./config.ts";
import { inTransaction } from "./db.ts";
import { fillLarchmere } from "./seedContent.ts";

const TENANT = "Larchmere";

/** Its brand's color: forest green, its logo's. */
const BRAND_COLOR = "#1f4e3d";

/** The tenant's own files: its logo, and in `files/`, its library's. */
const FILES = join(import.meta.dirname, "..", "seed", "larchmere");

/** Seed Larchmere, unless the database has it already, and those of its users it hasn't. */
export async function seed(db: DatabaseSync): Promise<void> {
    const kept = db.prepare("SELECT id FROM tenants WHERE name = ?").get(TENANT) as { id: string } | undefined;
    const emails = db.prepare("SELECT email FROM users").all() as unknown as { email: string }[];
    const missing = PERSONAS.filter(({ email }) => !emails.some((user) => user.email === email));
    if (kept && missing.length === 0) return;
    const hashes = await Promise.all(missing.map(() => hashPassword(DEMO_PASSWORD)));
    const tenantId = kept?.id ?? randomUUID();
    inTransaction(db, () => {
        if (!kept)
            db.prepare(
                "INSERT INTO tenants (id, name, logo, logo_type, brand_color, seed_pending) VALUES (?, ?, ?, ?, ?, ?)",
            ).run(
                tenantId,
                TENANT,
                readFileSync(join(FILES, "logo.svg")),
                "image/svg+xml",
                BRAND_COLOR,
                config.seed === "all" ? 1 : 0,
            );
        const insert = db.prepare(
            "INSERT INTO users (id, tenant_id, email, password_hash, name, title, role) VALUES (?, ?, ?, ?, ?, ?, ?)",
        );
        missing.forEach(({ email, name, title, role }, i) =>
            insert.run(randomUUID(), tenantId, email, hashes[i], name, title, role),
        );
    });
}

/**
 * Give a Larchmere made here its library, collections and deal room, through
 * `app`'s routes, which import through udoc-server, so once the server's up
 * (`seedContent.ts`). One a run stopped part way through holds part of them, and
 * is said so each time the server starts, until its data's cleared.
 */
export async function seedContent(app: FastifyInstance, db: DatabaseSync): Promise<void> {
    const tenant = db.prepare("SELECT id FROM tenants WHERE name = ? AND seed_pending = 1").get(TENANT) as
        | { id: string }
        | undefined;
    if (!tenant) return;
    const { held } = db
        .prepare(
            `SELECT (SELECT COUNT(*) FROM folders WHERE tenant_id = :id) + (SELECT COUNT(*) FROM assets WHERE tenant_id = :id)
            + (SELECT COUNT(*) FROM collections WHERE tenant_id = :id) + (SELECT COUNT(*) FROM deal_rooms WHERE tenant_id = :id)
            AS held`,
        )
        .get({ id: tenant.id }) as { held: number };
    if (held > 0) {
        console.warn(
            "shockwave: Larchmere's library was seeded only in part, when shockwave last ran. To seed it again, " +
                "stop shockwave and run `npm run shockwave:clear` from the repo's root.",
        );
        return;
    }
    const started = Date.now();
    console.log("shockwave: seeding Larchmere's library, collections and deal room…");
    await fillLarchmere(app);
    db.prepare("UPDATE tenants SET seed_pending = 0 WHERE id = ?").run(tenant.id);
    console.log(`shockwave: seeded Larchmere in ${((Date.now() - started) / 1000).toFixed(1)} s`);
}
