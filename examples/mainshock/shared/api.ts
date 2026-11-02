// What the backend's API answers and the frontend reads: the one definition
// of each, imported by both.

/** What a user does at their tenant: marketing keeps the content, sales uses it. */
export type Role = "marketing" | "sales";

/** A tenant's user, as the API shows one. */
export interface User {
    id: string;
    /** What they sign in with. */
    username: string;
    name: string;
    /** Their job title. */
    title: string;
    role: Role;
    tenant: Tenant;
}

/** A company using Mainshock, whose brand its users see the app in. */
export interface Tenant {
    id: string;
    name: string;
    /** Where its logo is, a square icon, for an `<img>`; `null` when it has none. */
    logo: string | null;
}

/** What a request that fails answers. */
export interface Failure {
    error: string;
    message: string;
}
