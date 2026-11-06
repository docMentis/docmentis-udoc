// The users an empty database is seeded with, one for each part of the story,
// in its order, and the demo's password, which they share: shockwave runs only
// locally. The seed creates them; the narrator signs in as them. Each first
// name starts with the letter of the job, to tell them apart by: Maya in
// marketing, Colin in compliance, Sam heading sales, Ryan owning the
// relationship, Paula on the portfolio. Their emails are at `.example`, a domain
// kept for examples, so that none is anyone's.
import type { Role } from "./api.ts";

export const DEMO_PASSWORD = "shockwave";

export const PERSONAS: { email: string; name: string; title: string; role: Role }[] = [
    { email: "maya.patel@larchmere.example", name: "Maya Patel", title: "Product Marketing Manager", role: "admin" },
    { email: "colin.okafor@larchmere.example", name: "Colin Okafor", title: "Compliance Officer", role: "reviewer" },
    {
        email: "sam.hughes@larchmere.example",
        name: "Sam Hughes",
        title: "Head of Institutional Sales",
        role: "manager",
    },
    {
        email: "ryan.brooks@larchmere.example",
        name: "Ryan Brooks",
        title: "Director, Institutional Sales",
        role: "member",
    },
    { email: "paula.ortiz@larchmere.example", name: "Paula Ortiz", title: "Client Portfolio Manager", role: "member" },
];
