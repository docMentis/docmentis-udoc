// The pitch book's template, which a deal room fills with its deal's data:
// main.py writes the deck with its places as `{{…}}` tags, and the badge's
// binding in its shape's tag, and udoc makes it a template here — its tags
// places — and gives it the sample data an author previews it with, as Maya
// would in the editor's Automation tab and Data panel.
//
// generate.mjs runs this with the rest; `node seed/generate/template.mjs`, from
// shockwave's folder, makes the template alone, with no Word.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { UDocNode } from "@docmentis/udoc-node";

const here = import.meta.dirname;
const larchmere = join(here, "..", "larchmere");

/** The file the template is kept as, in `files/`. */
export const TEMPLATE = "global-equity-pitch-book-template.pptx";

/** What an author previews the template with: a made-up search, its team Larchmere's two contacts. */
export const SAMPLE_DATA = {
    client: { name: "Ashby Teachers' Retirement Fund" },
    meeting: { date: "November 2026", isFinals: false },
    mandate: { size: "$250 million" },
    team: [
        { name: "Ryan Brooks", role: "Director, Institutional Sales", email: "ryan.brooks@larchmere.example" },
        { name: "Paula Ortiz", role: "Client Portfolio Manager", email: "paula.ortiz@larchmere.example" },
    ],
};

/**
 * Make the deck main.py wrote to `staged` a template, its sample data given,
 * and save it into `out`, in `udoc`'s sessions.
 */
export async function finishTemplate(udoc, staged, out) {
    const session = await udoc.open(readFileSync(join(staged, TEMPLATE)));
    try {
        await session.execute({ automation: "makeTemplate" });
        await session.execute({ automation: { setSampleData: { data: SAMPLE_DATA } } });
        writeFileSync(join(out, TEMPLATE), await session.saveToBytes({ format: "pptx" }));
    } finally {
        await session.close();
    }
    console.log(`  ${TEMPLATE}, made a template by udoc`);
}

/** The logo's PNG the decks carry, rendered by udoc into `work`. */
export async function renderLogo(udoc, work) {
    const logo = join(work, "logo.png");
    const svg = await udoc.open(readFileSync(join(larchmere, "logo.svg")));
    try {
        writeFileSync(logo, await svg.exportPageToBytes(0, { png: { scale: 8 } }));
    } finally {
        await svg.close();
    }
    return logo;
}

if (process.argv[1] === import.meta.filename) {
    const work = mkdtempSync(join(tmpdir(), "larchmere-template-"));
    const license = process.env.UDOC_LICENSE;
    const domain = process.env.UDOC_DOMAIN;
    const udoc = await UDocNode.create({ ...(license ? { license } : {}), ...(domain ? { domain } : {}) });
    try {
        const logo = await renderLogo(udoc, work);
        const python = process.env.PYTHON ?? "python3";
        const run = spawnSync(python, [join(here, "main.py"), logo, join(larchmere, "files"), work, "--template"], {
            stdio: "inherit",
            env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
        });
        if (run.status !== 0) throw new Error(`${python} main.py failed${run.error ? `: ${run.error.message}` : ""}`);
        await finishTemplate(udoc, work, join(larchmere, "files"));
    } finally {
        rmSync(work, { recursive: true, force: true });
    }
    process.exit(0);
}
