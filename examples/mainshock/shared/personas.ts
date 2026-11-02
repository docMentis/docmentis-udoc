// The users an empty database is seeded with, one for each part of the story,
// and the demo's password, which they share: mainshock runs only locally. The
// seed creates them; the narrator signs in as them.
import type { Role } from "./api.ts";

export const DEMO_PASSWORD = "mainshock";

export const PERSONAS: { username: string; name: string; title: string; role: Role }[] = [
    { username: "maya", name: "Maya Patel", title: "Product Marketing Manager", role: "marketing" },
    { username: "dan", name: "Dan Brooks", title: "Account Executive", role: "sales" },
    { username: "lena", name: "Lena Ortiz", title: "Sales Engineer", role: "sales" },
];
