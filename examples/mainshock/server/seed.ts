// The example tenant, Acme Corp, and its users (`shared/personas.ts`). An empty
// database gets them.
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import { DEMO_PASSWORD, PERSONAS } from "../shared/personas.ts";
import { hashPassword } from "./auth.ts";

const TENANT = "Acme Corp";

/** Seed Acme Corp and its users, unless the database has a tenant already. */
export async function seed(db: DatabaseSync): Promise<void> {
    if (db.prepare("SELECT 1 FROM tenants LIMIT 1").get()) return;
    const hashes = await Promise.all(PERSONAS.map(() => hashPassword(DEMO_PASSWORD)));
    const tenantId = randomUUID();
    db.exec("BEGIN");
    db.prepare("INSERT INTO tenants (id, name) VALUES (?, ?)").run(tenantId, TENANT);
    const insert = db.prepare(
        "INSERT INTO users (id, tenant_id, username, password_hash, name, title, role) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    PERSONAS.forEach(({ username, name, title, role }, i) =>
        insert.run(randomUUID(), tenantId, username, hashes[i], name, title, role),
    );
    db.exec("COMMIT");
}
