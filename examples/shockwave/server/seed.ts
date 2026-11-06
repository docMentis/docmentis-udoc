// The example tenant, Larchmere, an imaginary asset manager, with its logo
// (`seed/larchmere/`), and its users (`shared/personas.ts`). An empty database
// gets them all, and one from before a user was added, that user, so that it
// needn't start over.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";

import { DEMO_PASSWORD, PERSONAS } from "../shared/personas.ts";
import { hashPassword } from "./auth.ts";
import { inTransaction } from "./db.ts";

const TENANT = "Larchmere";

/** Its brand's color: forest green, its logo's. */
const BRAND_COLOR = "#1f4e3d";

/** The tenant's files. */
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
            db.prepare("INSERT INTO tenants (id, name, logo, logo_type, brand_color) VALUES (?, ?, ?, ?, ?)").run(
                tenantId,
                TENANT,
                readFileSync(join(FILES, "logo.svg")),
                "image/svg+xml",
                BRAND_COLOR,
            );
        const insert = db.prepare(
            "INSERT INTO users (id, tenant_id, email, password_hash, name, title, role) VALUES (?, ?, ?, ?, ?, ?, ?)",
        );
        missing.forEach(({ email, name, title, role }, i) =>
            insert.run(randomUUID(), tenantId, email, hashes[i], name, title, role),
        );
    });
}
