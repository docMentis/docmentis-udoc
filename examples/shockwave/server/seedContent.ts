// Larchmere's library, collections and deal room, which `seed.ts` has made once
// the server's up for a Larchmere it has just made. Its people make them through
// the app's own routes, each signed in as themselves, as they would in the app: Maya
// uploads the files, which udoc-server imports and renders, and submits them;
// Colin approves or returns them; Maya publishes those approved; Sam arranges
// them in collections; and Ryan prepares a deal room with Paula and puts it on
// its frontstage. So what's seeded is what the app would make.
//
// The files are in `seed/larchmere/files/`, made by `seed/generate/`. A buyer's
// visit isn't seeded: a frontstage's activity is what its link's visitors do.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { FastifyInstance, HTTPMethods } from "fastify";

import type { Asset, Collection, DealRoom, Folder, Reviewer, Seller } from "../shared/api.ts";
import { DEMO_PASSWORD, PERSONAS } from "../shared/personas.ts";

/** The library's files. */
const FILES_DIR = join(import.meta.dirname, "..", "seed", "larchmere", "files");

/** What becomes of a file once it's uploaded. */
type Review =
    /** Submitted, approved, and published. */
    | { to: "published"; submitted: string }
    /** Submitted, and waiting on the reviewer. */
    | { to: "submitted"; submitted: string }
    /** Submitted, and returned with the reviewer's note. */
    | { to: "returned"; submitted: string; returned: string };

const QUARTER = "Q3 2026 figures, to September 30.";

/** The library's folders, in order, and its files, each in one, by the file's name in `files/`. */
const FOLDERS = ["Pitch books", "Fact sheets", "Commentary", "RFP and DDQ", "Performance"];
const FILES: { file: string; name: string; folder: string; review: Review }[] = [
    {
        file: "global-equity-pitch-book.pptx",
        name: "Global Equity Pitch Book",
        folder: "Pitch books",
        review: { to: "published", submitted: QUARTER },
    },
    {
        file: "firm-overview.pptx",
        name: "Firm Overview",
        folder: "Pitch books",
        review: { to: "published", submitted: QUARTER },
    },
    {
        file: "global-equity-fact-sheet.pdf",
        name: "Global Equity Fact Sheet, Q3 2026",
        folder: "Fact sheets",
        review: { to: "published", submitted: QUARTER },
    },
    {
        file: "core-plus-fixed-income-fact-sheet.pdf",
        name: "Core Plus Fixed Income Fact Sheet, Q3 2026",
        folder: "Fact sheets",
        review: { to: "published", submitted: QUARTER },
    },
    {
        file: "global-infrastructure-fact-sheet.pdf",
        name: "Global Listed Infrastructure Fact Sheet, Q3 2026",
        folder: "Fact sheets",
        // The draft has what the note says: since inception alone, and the yield undated.
        review: {
            to: "returned",
            submitted: "The strategy's first fact sheet.",
            returned:
                "Two things before this goes out. The performance table shows the since-inception return alone: " +
                "our policy needs the 1- and 3-year returns beside it. And the distribution yield in Key facts " +
                "needs its as-of date, and a definition in Important information.",
        },
    },
    {
        file: "market-commentary-q3-2026.pdf",
        name: "Market Commentary, Q3 2026",
        folder: "Commentary",
        review: { to: "submitted", submitted: "Elena and Daniel's commentary for the quarter." },
    },
    {
        file: "global-equity-ddq.docx",
        name: "Global Equity DDQ",
        folder: "RFP and DDQ",
        review: { to: "published", submitted: "Answers updated to September 30." },
    },
    {
        file: "performance-and-fees-q3-2026.xlsx",
        name: "Performance and Fees, Q3 2026",
        folder: "Performance",
        review: { to: "published", submitted: QUARTER },
    },
];

/** Sam's collections, each file with how to use it. */
const COLLECTIONS: { name: string; description: string; instructions: string; items: [string, string][] }[] = [
    {
        name: "Global Equity Pitch Kit",
        description: "Everything for a Global Equity search, from the first meeting to the finals.",
        instructions:
            "Send the fact sheet ahead of a first meeting, present from the pitch book, and start every RFP from " +
            "the DDQ. Figures are as of September 30, 2026.",
        items: [
            ["global-equity-pitch-book.pptx", "Present from this. Slides 10 to 12 carry this quarter's performance."],
            ["global-equity-fact-sheet.pdf", "The leave-behind: send it ahead of a first meeting."],
            [
                "global-equity-ddq.docx",
                "Start every RFP and due diligence questionnaire from these answers. Compliance has approved them as written.",
            ],
            [
                "performance-and-fees-q3-2026.xlsx",
                "For a consultant's database update, or a question on fees: the Fees sheet works out a mandate's fee.",
            ],
        ],
    },
    {
        name: "Firm and Fixed Income",
        description: "Introducing Larchmere, and Core Plus Fixed Income.",
        instructions: "Lead with the firm overview when meeting a new relationship.",
        items: [
            ["firm-overview.pptx", "Ten minutes on who we are, before any strategy."],
            ["core-plus-fixed-income-fact-sheet.pdf", "The leave-behind for a fixed income search."],
            ["performance-and-fees-q3-2026.xlsx", "Every strategy's returns, and the fee calculator."],
        ],
    },
];

/**
 * Ryan's deal room, with Paula: its files from the collections, and those its
 * buyers see. What it says of itself, and each file, is said to its buyers.
 */
const DEAL_ROOM = {
    title: "Calderwood County ERS: Global Equity",
    description:
        "Prepared for Calderwood County Employees' Retirement System's search for a global equity manager: " +
        "Larchmere Global Equity, and its record to September 30, 2026.",
    people: ["Ryan", "Paula"],
    files: [
        {
            file: "global-equity-pitch-book.pptx",
            name: "Global Equity Pitch Book",
            description: "Our Global Equity strategy: its philosophy, process, team and results to September 30, 2026.",
            frontstage: true,
        },
        {
            file: "global-equity-fact-sheet.pdf",
            name: "Global Equity Fact Sheet, Q3 2026",
            description: "The strategy on two pages, as of September 30, 2026.",
            frontstage: true,
        },
        {
            file: "global-equity-ddq.docx",
            name: "Calderwood County ERS RFP Response",
            description: "Our response to the RFP, from Larchmere's due diligence answers.",
            frontstage: false,
        },
        {
            file: "performance-and-fees-q3-2026.xlsx",
            name: "Performance and Fees, Q3 2026",
            description: "Returns, and the fee on a $250 million mandate.",
            frontstage: false,
        },
    ],
};

/** A persona's email, by first name. */
function email(first: string): string {
    const persona = PERSONAS.find(({ name }) => name.startsWith(`${first} `));
    if (!persona) throw new Error(`no persona ${first}`);
    return persona.email;
}

type Call = <T>(method: HTTPMethods, url: string, body?: unknown) => Promise<T>;

/** Sign in as `first`, through `/api/session`: a call as them, and signing out. */
async function signIn(app: FastifyInstance, first: string): Promise<{ call: Call; signOut: () => Promise<void> }> {
    const answer = await app.inject({
        method: "POST",
        url: "/api/session",
        payload: { email: email(first), password: DEMO_PASSWORD },
    });
    if (answer.statusCode !== 200) throw new Error(`signing in as ${first}: ${answer.statusCode} ${answer.body}`);
    const cookie = [answer.headers["set-cookie"] ?? []]
        .flat()
        .map((value) => value.split(";")[0])
        .join("; ");
    const call: Call = async (method, url, body) => {
        const bytes = Buffer.isBuffer(body);
        const reply = await app.inject({
            method,
            url,
            headers: { cookie, ...(bytes ? { "content-type": "application/octet-stream" } : {}) },
            ...(body === undefined ? {} : { payload: bytes ? body : (body as object) }),
        });
        if (reply.statusCode >= 300) throw new Error(`${first}: ${method} ${url}: ${reply.statusCode} ${reply.body}`);
        return (reply.body ? reply.json() : undefined) as never;
    };
    return { call, signOut: () => call("DELETE", "/api/session") };
}

/** Make Larchmere's library, collections and deal room, as its people, through `app`'s routes. */
export async function fillLarchmere(app: FastifyInstance): Promise<void> {
    // Maya uploads each file into its folder, and submits it to Colin.
    const maya = await signIn(app, "Maya");
    const folders = new Map<string, Folder>();
    for (const name of FOLDERS) {
        const { folder } = await maya.call<{ folder: Folder }>("POST", "/api/folders", { name, parentId: null });
        folders.set(name, folder);
    }
    const { reviewers } = await maya.call<{ reviewers: Reviewer[] }>("GET", "/api/library/reviewers");
    const colinId = reviewers.find(({ name }) => name.startsWith("Colin "))?.id;
    const assets = new Map<string, Asset>();
    for (const { file, name, folder, review } of FILES) {
        const query = `name=${encodeURIComponent(name)}&folder=${folders.get(folder)!.id}`;
        const bytes = readFileSync(join(FILES_DIR, file));
        const { asset } = await maya.call<{ asset: Asset }>("POST", `/api/assets?${query}`, bytes);
        assets.set(file, asset);
        await maya.call("POST", `/api/assets/${asset.id}/versions/1/submit`, {
            reviewerId: colinId,
            note: review.submitted,
        });
    }

    // Colin approves or returns each.
    const colin = await signIn(app, "Colin");
    for (const { file, review } of FILES) {
        const id = assets.get(file)!.id;
        if (review.to === "published") await colin.call("POST", `/api/assets/${id}/versions/1/approve`, {});
        if (review.to === "returned")
            await colin.call("POST", `/api/assets/${id}/versions/1/return`, { note: review.returned });
    }

    // Maya publishes what's approved.
    for (const { file, review } of FILES)
        if (review.to === "published")
            await maya.call("POST", `/api/assets/${assets.get(file)!.id}/versions/1/publish`, {});

    // Sam arranges them in collections.
    const sam = await signIn(app, "Sam");
    for (const { name, description, instructions, items } of COLLECTIONS) {
        const { collection } = await sam.call<{ collection: Collection }>("POST", "/api/collections", {
            name,
            description,
            instructions,
        });
        const assetIds = items.map(([file]) => assets.get(file)!.id);
        await sam.call("POST", `/api/collections/${collection.id}/items`, { assetIds });
        for (const [file, how] of items)
            await sam.call("PATCH", `/api/collections/${collection.id}/items/${assets.get(file)!.id}`, {
                instructions: how,
            });
    }

    // Ryan prepares a deal room with Paula, and puts it on its frontstage.
    const ryan = await signIn(app, "Ryan");
    const { title, description, people, files } = DEAL_ROOM;
    const { room } = await ryan.call<{ room: DealRoom }>("POST", "/api/deal-rooms", { title, description });
    const { sellers } = await ryan.call<{ sellers: Seller[] }>("GET", "/api/deal-rooms/sellers");
    const userIds = people.map((first) => sellers.find(({ name }) => name.startsWith(`${first} `))?.id);
    await ryan.call("PUT", `/api/deal-rooms/${room.id}/people`, { userIds });
    const sources = files.map(({ file }) => assets.get(file)!.id);
    const { room: filled } = await ryan.call<{ room: DealRoom }>("POST", `/api/deal-rooms/${room.id}/files`, {
        assetIds: sources,
    });
    const copyOf = (file: string) => filled.files.find(({ source }) => source.id === assets.get(file)!.id)!.asset;
    for (const { file, name, description: says } of files)
        await ryan.call("PATCH", `/api/deal-rooms/${room.id}/files/${copyOf(file).id}`, { name, description: says });
    await ryan.call("PUT", `/api/deal-rooms/${room.id}/frontstage`, {
        assetIds: files.filter(({ frontstage }) => frontstage).map(({ file }) => copyOf(file).id),
    });

    for (const person of [maya, colin, sam, ryan]) await person.signOut();
}
