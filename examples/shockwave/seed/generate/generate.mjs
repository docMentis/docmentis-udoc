// Make Larchmere's files again, into `seed/larchmere/files/`: run
// `node seed/generate/generate.mjs` from shockwave's folder. The files are
// committed, so shockwave itself never runs this; it's for changing them.
//
// It needs Python 3 with python-pptx, python-docx and openpyxl; Microsoft Word,
// on a Mac; and the packages built (`npm run build` from the repo's root).
// udoc renders the logo to the PNG the files carry. The fact sheets and the
// commentary are written as Word documents, and Word saves them as PDF, as
// Larchmere's marketing would: the PDFs are Word's.
import { spawnSync } from "node:child_process";
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    statSync,
    writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";

import { UDocNode } from "@docmentis/udoc-node";

const here = import.meta.dirname;
const larchmere = join(here, "..", "larchmere");
const out = join(larchmere, "files");
const work = mkdtempSync(join(tmpdir(), "larchmere-"));
const staged = join(work, "staged");

const WORD = "/Applications/Microsoft Word.app";
if (process.platform !== "darwin" || !existsSync(WORD)) {
    console.error("[generate] Word saves the PDFs, and it isn't here: run this on a Mac with Microsoft Word.");
    process.exit(1);
}
// Word is sandboxed: what it opens and saves without asking is in its own container.
const wordDir = join(homedir(), "Library", "Containers", "com.microsoft.Word", "Data", "larchmere-seed");

/** Have Word open `docx`, in its container, save it as `pdf` beside it, and close it. Word's other documents stay as they are. */
function saveAsPdf(docx, pdf) {
    const quoted = (text) => `"${text.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
    const script = `
tell application "Microsoft Word"
    open POSIX file ${quoted(docx)}
    set waited to 0
    repeat until (exists document ${quoted(basename(docx))}) or waited > 60
        delay 0.5
        set waited to waited + 1
    end repeat
    set opened to document ${quoted(basename(docx))}
    save as opened file name ${quoted(pdf)} file format format PDF
    close opened saving no
end tell`;
    const run = spawnSync("osascript", ["-"], { input: script, encoding: "utf8" });
    if (run.status !== 0 || !existsSync(pdf))
        throw new Error(`Word didn't save ${basename(pdf)}: ${run.stderr || run.error?.message || "no PDF"}`);
}

const license = process.env.UDOC_LICENSE;
const domain = process.env.UDOC_DOMAIN;
const udoc = await UDocNode.create({ ...(license ? { license } : {}), ...(domain ? { domain } : {}) });
try {
    const logo = join(work, "logo.png");
    const svg = await udoc.open(readFileSync(join(larchmere, "logo.svg")));
    try {
        writeFileSync(logo, await svg.exportPageToBytes(0, { png: { scale: 8 } }));
    } finally {
        await svg.close();
    }

    console.log("Writing Larchmere's files…");
    const python = process.env.PYTHON ?? "python3";
    const run = spawnSync(python, [join(here, "main.py"), logo, out, staged], {
        stdio: "inherit",
        // No __pycache__ left beside the generator.
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    });
    if (run.status !== 0) throw new Error(`${python} main.py failed${run.error ? `: ${run.error.message}` : ""}`);

    rmSync(wordDir, { recursive: true, force: true });
    mkdirSync(wordDir, { recursive: true });
    for (const name of readdirSync(staged)) {
        const docx = join(wordDir, name);
        const pdf = join(wordDir, basename(name, ".docx") + ".pdf");
        copyFileSync(join(staged, name), docx);
        saveAsPdf(docx, pdf);
        copyFileSync(pdf, join(out, basename(pdf)));
        console.log(`  ${basename(pdf)}, saved by Word`);
    }
} finally {
    rmSync(work, { recursive: true, force: true });
    rmSync(wordDir, { recursive: true, force: true });
}

const kb = (name) => `${Math.round(statSync(join(out, name)).size / 1024)} KB`;
console.log(`\nIn ${out}:`);
for (const name of readdirSync(out).sort()) console.log(`  ${name}  ${kb(name)}`);
process.exit(0);
