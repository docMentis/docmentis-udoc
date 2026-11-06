// What a request reaches: its tenant's data and its tenant's documents, and nothing
// else. The routes hold this, and never the database itself, so what they do is
// always for one tenant, the one the request's session or link says.
import type { IncomingMessage } from "node:http";
import type { DatabaseSync } from "node:sqlite";

import type { User } from "../shared/api.ts";
import { endSession, signIn, tenantOfFrontstage, userOf } from "./auth.ts";
import { TenantDb } from "./db.ts";
import type { TenantDocuments, Udoc } from "./udoc.ts";

/** Who's signed in, and what's their tenant's: its data and its documents. */
export interface Scope {
    user: User;
    db: TenantDb;
    documents: TenantDocuments;
}

/** How a request comes to a tenant. */
export interface Access {
    /** What `request`'s session reaches; `undefined` for no one signed in. */
    scopeOf(request: IncomingMessage): Scope | undefined;
    /** The data of the tenant whose frontstage is at `token`; `undefined` for none. */
    frontstage(token: string): TenantDb | undefined;
    /** Sign in as `email`, with `password`; see `signIn`. */
    signIn(email: string, password: string): ReturnType<typeof signIn>;
    /** Sign `request`'s session out: the `Set-Cookie` that clears it. */
    endSession(request: IncomingMessage): string;
}

export function createAccess(db: DatabaseSync, udoc: Udoc): Access {
    return {
        scopeOf(request) {
            const user = userOf(db, request);
            if (!user) return undefined;
            return { user, db: new TenantDb(db, user.tenant.id), documents: udoc.documentsOf(user.tenant.id) };
        },
        frontstage(token) {
            const tenantId = tenantOfFrontstage(db, token);
            return tenantId === undefined ? undefined : new TenantDb(db, tenantId);
        },
        signIn: (email, password) => signIn(db, email, password),
        endSession: (request) => endSession(db, request),
    };
}
