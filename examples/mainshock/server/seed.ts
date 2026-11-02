// The example tenant, Acme Corp, and its users. An empty database gets them.
// They share one password, the demo's: mainshock runs only locally.
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import type { Role } from "../shared/api.ts";
import { hashPassword } from "./auth.ts";

const TENANT = "Acme Corp";

/** Every seeded user's password. */
const DEMO_PASSWORD = "mainshock";

const USERS: { username: string; name: string; title: string; role: Role }[] = [
    { username: "maya", name: "Maya Patel", title: "Product Marketing Manager", role: "marketing" },
    { username: "dan", name: "Dan Brooks", title: "Account Executive", role: "sales" },
    { username: "lena", name: "Lena Ortiz", title: "Sales Engineer", role: "sales" },
];

/** Seed Acme Corp and its users, unless the database has a tenant already. */
export async function seed(db: DatabaseSync): Promise<void> {
    if (db.prepare("SELECT 1 FROM tenants LIMIT 1").get()) return;
    const hashes = await Promise.all(USERS.map(() => hashPassword(DEMO_PASSWORD)));
    const tenantId = randomUUID();
    db.exec("BEGIN");
    db.prepare("INSERT INTO tenants (id, name) VALUES (?, ?)").run(tenantId, TENANT);
    const insert = db.prepare(
        "INSERT INTO users (id, tenant_id, username, password_hash, name, title, role) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    USERS.forEach(({ username, name, title, role }, i) =>
        insert.run(randomUUID(), tenantId, username, hashes[i], name, title, role),
    );
    db.exec("COMMIT");
}
