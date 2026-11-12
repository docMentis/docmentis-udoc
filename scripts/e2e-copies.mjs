// The server's copies on every format with an original to keep (scripts/e2e.mjs):
// each read back from its bytes for what it kept of the original and which edits
// it holds, through everything a copy has to survive. No one session lasts from
// the import to the save, so what a session knows of the original has to come from
// the store: after a restart, over a checkpoint, over a cut, and of one checkpoint.
// docs/design/core-save.md says what each strategy promises.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DOCUMENTS, run } from "./e2e-documents.mjs";
import {
    check,
    cutsOf,
    finish,
    newSession,
    onServer,
    modelOf,
    Peer,
    remote,
    SAMPLES,
    serve,
    sleep,
    temporaryStore,
    unzip,
    upload,
} from "./e2e-harness.mjs";

/** One blank page, protected by the password "secret" (`qpdf --encrypt secret owner 256`), as scripts/headless-page.mjs has it. */
const PROTECTED_PDF =
    "JVBERi0xLjcKJb/3ov4KMSAwIG9iago8PCAvRXh0ZW5zaW9ucyA8PCAvQURCRSA8PCAvQmFzZVZlcnNpb24gLzEuNyAvRXh0ZW5z" +
    "aW9uTGV2ZWwgOCA+PiA+PiAvUGFnZXMgMiAwIFIgL1R5cGUgL0NhdGFsb2cgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL0NvdW50IDEg" +
    "L0tpZHMgWyAzIDAgUiBdIC9UeXBlIC9QYWdlcyA+PgplbmRvYmoKMyAwIG9iago8PCAvTWVkaWFCb3ggWyAwIDAgMjAwIDIwMCBd" +
    "IC9QYXJlbnQgMiAwIFIgL1R5cGUgL1BhZ2UgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0NGIDw8IC9TdGRDRiA8PCAvQXV0aEV2ZW50" +
    "IC9Eb2NPcGVuIC9DRk0gL0FFU1YzIC9MZW5ndGggMzIgPj4gPj4gL0ZpbHRlciAvU3RhbmRhcmQgL0xlbmd0aCAyNTYgL08gPDhm" +
    "OTg3MGU5YjBhNTJjNWRiM2JmOTQ4NGNmNWVkZWE2ZWM0YmIwNzljMGYwNWRmODM5NjA4NmM4ZWZiMjlmY2Y4MjJlOGI3YzJjZWRk" +
    "Y2ZhZTJlNzc5OTU3NGY2MGEwOD4gL09FIDwyMTZlM2M4ZTg5ZjI3MmYwYmU4YWVhODM1ZmZlMWIyMjkwOTIxNDU0ODczZDY5ZWFl" +
    "NWI2ZWM0OTYxNWI5NGY0PiAvUCAtNCAvUGVybXMgPDkyMmYzOGQyMGRkMTI5ZGFmOWUwOTQwNDQ4ZmFhMDE4PiAvUiA2IC9TdG1G" +
    "IC9TdGRDRiAvU3RyRiAvU3RkQ0YgL1UgPGJmNjFhMThiNGNlNjUxMzhmZTBmOTlkZDllNTY1MDQ3MGFlNmFjYThhODQ1MDkyYjhi" +
    "MTFmNjE4MTIzNzlmNjhjNDBjN2JhN2NkOWM3NzE2Nzk4MDRlOTI5YzQ0ZGZhMT4gL1VFIDw1N2M2YWU1MDU5NWYzNGY5YjU1ODYx" +
    "NDMzODVkODc5OWM2OTdlZTA1Nzg4MWQ1NmYyODU5ZmFmYmI0ZWUwNzY2PiAvViA1ID4+CmVuZG9iagp4cmVmCjAgNQowMDAwMDAw" +
    "MDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDEzMCAwMDAwMCBuIAowMDAwMDAwMTg5IDAwMDAwIG4gCjAw" +
    "MDAwMDAyNjIgMDAwMDAgbiAKdHJhaWxlciA8PCAvUm9vdCAxIDAgUiAvU2l6ZSA1IC9JRCBbPDdiOTA4YzcyMDUyNTZlNjdjMzM5" +
    "ZTk0ZjllNDdhZjVjPjw3YjkwOGM3MjA1MjU2ZTY3YzMzOWU5NGY5ZTQ3YWY1Yz5dIC9FbmNyeXB0IDQgMCBSID4+CnN0YXJ0eHJl" +
    "Zgo4MDkKJSVFT0YK";

const J = (entries, name) => JSON.parse(entries.get(name).toString());
const named = (entries, pattern) => [...entries.keys()].filter((name) => pattern.test(name));
/** How many entries of `entries` hold `text`, as a word document's typed text shows. */
const holding = (entries, text) => [...entries.values()].filter((bytes) => bytes.includes(text)).length;

/**
 * Each format with a strategy that writes over the original: that strategy, two edits
 * that can be told apart in a file read back, and how many a package of it shows.
 */
const FORMATS = {
    portable: {
        format: "pdf",
        strategy: "incremental",
        removed: ({ pages }) => ["pages", pages.at(-1)],
        remove: (s, { pages }) =>
            run(s, "deletePages", { portable: { editPage: { command: { deletePages: { ids: pages.slice(-1) } } } } }),
        edits: [(s) => insertPage(s), (s) => insertPage(s)],
        shown: (entries) => J(entries, named(entries, /^parts\/page_list_/)[0]).pages.length,
    },
    presentation: {
        format: "pptx",
        strategy: "delta",
        removed: ({ slides }) => ["slides", slides.at(-1)],
        remove: (s, { slides }) =>
            run(s, "deleteSlides", {
                presentation: { editSlide: { command: { deleteSlides: { ids: slides.slice(-1) } } } },
            }),
        edits: [(s) => insertSlide(s), (s) => insertSlide(s)],
        shown: (entries) => J(entries, named(entries, /^parts\/presentation_/)[0]).slideIdList.ids.length,
    },
    wordprocessing: {
        format: "docx",
        strategy: "delta",
        edits: [(s, ids) => typeAt(s, ids, 40, "CCC"), (s, ids) => typeAt(s, ids, 80, "DDD")],
        shown: (entries) => (holding(entries, "CCC") > 0 ? 1 : 0) + (holding(entries, "DDD") > 0 ? 1 : 0),
    },
    spreadsheet: {
        format: "xlsx",
        strategy: "delta",
        removed: ({ sheet }) => ["sheets", sheet],
        remove: (s, { sheet }) =>
            run(s, "deleteSheets", { spreadsheet: { editWorkbook: { command: { deleteSheets: { ids: [sheet] } } } } }),
        edits: [(s) => insertSheet(s, "First"), (s) => insertSheet(s, "Second")],
        shown: (entries) => named(entries, /^parts\/sheet_/).length,
    },
};

const insertPage = (s) => run(s, "insertPage", { portable: { editPage: { command: { insertPage: { index: 0 } } } } });
const insertSlide = (s) =>
    run(s, "insertSlide", { presentation: { editSlide: { command: { insertSlide: { index: 0 } } } } });
const insertSheet = (s, name) =>
    run(s, "insertWorksheet", { spreadsheet: { editWorkbook: { command: { insertWorksheet: { index: 0, name } } } } });
const typeAt = (s, { story }, at, text) =>
    run(s, "typing", {
        wordprocessing: {
            editSectionText: {
                story,
                command: {
                    replaceText: {
                        range: { start: at, end: at },
                        fragment: {
                            blocks: [
                                {
                                    paragraph: {
                                        properties: { props: [] },
                                        spans: [{ regular: { properties: { props: [] }, text } }],
                                    },
                                },
                            ],
                        },
                    },
                },
            },
        },
    });

async function copyOf(base, path, query = "") {
    const response = await fetch(`${base}/documents/${path}${query}`);
    return { ok: response.ok, status: response.status, bytes: new Uint8Array(await response.arrayBuffer()) };
}

/** The entries of an OOXML file that aren't byte for byte the original's. */
async function changedEntries(saved, original) {
    const [was, is] = [await unzip(original), await unzip(saved)];
    return [...new Set([...was.keys(), ...is.keys()])].filter((name) => {
        const [before, after] = [was.get(name), is.get(name)];
        return !before || !after || !before.equals(after);
    });
}

/** The bytes of a PDF past its original, but for the `/ID` that is new with each save. */
function revisionOf(bytes) {
    return Buffer.from(bytes.subarray(originalLength))
        .toString("latin1")
        .replace(/(\/ID \[<[0-9A-F]+> <)[0-9A-F]+>/, "$1>");
}

/** What a package of `bytes`, opened as any file is, shows of the edits. */
async function shownIn(bytes, shown) {
    const session = await newSession();
    session.open(bytes);
    return shown(await unzip(session.saveToPackage()));
}

const only = process.argv[2];
let originalLength = 0;

for (const [type, f] of Object.entries(FORMATS)) {
    if (only && only !== type) continue;
    const t = DOCUMENTS[type];
    console.log(`\n[e2e] === ${type} (${t.file})`);
    const original = await readFile(join(SAMPLES, t.file));
    originalLength = original.length;
    const before = await shownIn(original, f.shown);
    const onTheFile = await newSession();
    onTheFile.open(original);
    const unedited = f.format === "pdf" ? onTheFile.saveToBytes({ format: "pdf", strategy: f.strategy }) : undefined;
    const store = await temporaryStore();
    let server = await serve(store.directory);
    const id = await upload(server.base, t);
    const kept = join(store.directory, id);
    const ids = t.ids(await unzip(await readFile(join(kept, "versions/v0.udoc"))));

    /** Check the copy at `path`, by `query`, kept the original and holds `edits` edits. */
    async function copyHolds(label, path, query, edits) {
        const { ok, status, bytes } = await copyOf(server.base, `${id}/${path}file.${f.format}`, query);
        if (!check(`${label}: it answers`, ok, ok ? "" : `${status} ${new TextDecoder().decode(bytes).slice(0, 160)}`))
            return;
        if (f.format === "pdf") {
            const keeps = Buffer.from(bytes.subarray(0, original.length)).equals(original);
            check(`${label}: the original is an untouched prefix`, keeps, `${bytes.length} of ${original.length}`);
            // Even unedited a revision follows, as from a session on the file itself.
            if (edits === 0) {
                check(`${label}: as a session on the file saves it`, revisionOf(bytes) === revisionOf(unedited));
            }
        } else {
            const changed = await changedEntries(bytes, original);
            const total = (await unzip(original)).size;
            if (edits === 0) check(`${label}: every entry is the original's`, changed.length === 0, changed.join(", "));
            else
                check(
                    `${label}: only modified entries differ`,
                    changed.length > 0 && changed.length < total,
                    `${changed.length} of ${total}`,
                );
        }
        const shown = (await shownIn(bytes, f.shown)) - before;
        check(`${label}: it holds ${edits} edits`, shown === edits, shown);
    }
    const both = async (label, path, edits) => {
        await copyHolds(`${label}, no strategy`, path, "", edits);
        await copyHolds(`${label}, ${f.strategy}`, path, `?strategy=${f.strategy}`, edits);
    };

    await both("unedited", "", 0);
    const rewritten = await copyOf(server.base, `${id}/file.${f.format}`, "?strategy=rewrite");
    check("a rewrite still answers", rewritten.ok, rewritten.status);

    // One edit, in the live session.
    let editor = new Peer(server.base, id, await remote(server.base, id));
    await editor.joined;
    f.edits[0](editor.session, ids);
    editor.send();
    const firstEdit = await modelOf(editor.session.saveToPackage());
    await onServer("the server takes the first edit", server.base, id, firstEdit);
    await both("in the live session", "", 1);
    await editor.close();

    // A new session, from the import and the log.
    await sleep(100);
    await server.close();
    server = await serve(store.directory);
    await both("restarted, over the import and its log", "", 1);

    // A new session, over a checkpoint, which has to carry the modified status.
    const v1 = await fetch(`${server.base}/documents/${id}/checkpoints`, { method: "POST" });
    check("checkpoint v1", v1.status === 201);
    await server.close();
    server = await serve(store.directory);
    await both("restarted, over checkpoint v1", "", 1);

    // A second edit past it: the document has both, and each checkpoint what it had.
    editor = new Peer(server.base, id, await remote(server.base, id));
    await editor.joined;
    f.edits[1](editor.session, ids);
    editor.send();
    const secondEdit = await modelOf(editor.session.saveToPackage());
    await onServer("the server takes the second edit", server.base, id, secondEdit);
    await both("past checkpoint v1", "", 2);
    await both("of checkpoint v1", "checkpoints/1/", 1);
    await both("of checkpoint v0", "checkpoints/0/", 0);
    await editor.close();

    // A new session, over a log cut: the cut's checkpoint has to carry it too.
    await sleep(100);
    await server.close();
    server = await serve(store.directory, { sessionTimeoutMs: 400, cutMinSavedBytes: 0 });
    await fetch(`${server.base}/documents/${id}/layout/page-count`);
    let cuts = [];
    for (let i = 0; i < 120 && cuts.length === 0; i++) {
        await sleep(100);
        cuts = await cutsOf(kept);
    }
    check("the log is cut", cuts.length > 0, JSON.stringify(cuts));
    await both("over the log's cut", "", 2);
    await both("of the cut's checkpoint", "checkpoints/2/", 2);

    // A part removed is gone: from a copy, in the session that removed it and one
    // over its checkpoint, and from that checkpoint, whose record says so while an
    // earlier one still holds it. An undo brings it back.
    if (f.remove) {
        const [route, removed] = f.removed(ids);
        const v0 = await unzip(await readFile(join(kept, "versions/v0.udoc")));
        const entry = f.format === "pdf" ? undefined : J(v0, "original_id_map.json")[removed]?.[0]?.replace(/^\//, "");
        const inTheFile = async (label, expected) => {
            if (entry === undefined) return;
            const { bytes } = await copyOf(server.base, `${id}/file.${f.format}`, `?strategy=${f.strategy}`);
            const entries = await unzip(bytes);
            check(`${label}: ${entry} ${expected ? "is" : "isn't"} in the file`, entries.has(entry) === expected);
            const file = entry.split("/").at(-1);
            const relating = named(entries, /\.rels$/).filter((name) => entries.get(name).includes(file));
            check(
                `${label}: ${expected ? "a" : "no"} relationship names it`,
                relating.length > 0 === expected,
                relating,
            );
        };
        const edit = async (label, write) => {
            write();
            editor.send();
            await onServer(label, server.base, id, await modelOf(editor.session.saveToPackage()));
        };
        editor = new Peer(server.base, id, await remote(server.base, id));
        await editor.joined;
        const remove = () => f.remove(editor.session, ids);
        await edit("the server takes a removal", remove);
        await both("with a part removed, live", "", 1);
        await inTheFile("with a part removed, live", false);
        await edit("the server takes its undo", () => editor.session.undo());
        await both("with the removal undone", "", 2);
        await inTheFile("with the removal undone", true);
        await edit("the server takes the removal again", remove);
        const removedAt = await fetch(`${server.base}/documents/${id}/checkpoints`, { method: "POST" });
        check("a checkpoint of it", removedAt.status === 201);
        const { version } = await removedAt.json();
        await editor.close();
        await sleep(100);
        await server.close();
        server = await serve(store.directory);
        await both("with a part removed, over its checkpoint", "", 1);
        await inTheFile("with a part removed, over its checkpoint", false);
        const checkpoint = await unzip(await readFile(join(kept, `versions/v${version}.udoc`)));
        const record = Object.values(J(checkpoint, "removed_part_ids.json")).flat();
        check("its checkpoint records it", record.includes(removed), record);
        check("its checkpoint holds no part of it", named(checkpoint, new RegExp(`_${removed}\\.json$`)).length === 0);
        const served = (path) => fetch(`${server.base}/documents/${id}/${path}/${route}/${removed}`);
        check("the package answers 404 for it", (await served("package")).status === 404);
        check("that checkpoint answers 404 for it", (await served(`checkpoints/${version}/package`)).status === 404);
        check("v0 still serves it", (await served("checkpoints/0/package")).ok);
    }

    await server.close();
    await store.remove();
}

// An image has no strategy but rewrite, and unedited comes back as its file.
if (!only || only === "image") {
    console.log("\n[e2e] === image (image/stephans-quintet.png)");
    const file = "image/stephans-quintet.png";
    const original = await readFile(join(SAMPLES, file));
    const store = await temporaryStore();
    const server = await serve(store.directory);
    const id = await upload(server.base, { file });
    const { ok, bytes } = await copyOf(server.base, `${id}/file.png`);
    check("an unedited image's copy is its file", ok && Buffer.from(bytes).equals(original), bytes.length);
    await server.close();
    await store.remove();
}

// A PDF that needs a password: its original can't be written over, and the password isn't kept.
if (!only || only === "portable") {
    console.log("\n[e2e] === a PDF that needs a password");
    const store = await temporaryStore();
    const server = await serve(store.directory);
    const uploaded = await fetch(`${server.base}/documents`, {
        method: "POST",
        headers: { "X-UDoc-Password": "secret" },
        body: Buffer.from(PROTECTED_PDF, "base64"),
    });
    const { id } = await uploaded.json();
    check("it uploads with its password", uploaded.status === 201, uploaded.status);
    const copy = await copyOf(server.base, `${id}/file.pdf`);
    check(
        "named no strategy, its copy is a rewrite",
        copy.ok && new TextDecoder().decode(copy.bytes.subarray(0, 5)) === "%PDF-",
        copy.status,
    );
    const session = await newSession();
    session.open(copy.bytes);
    check("which opens with no password", !session.needsPassword());
    const incremental = await copyOf(server.base, `${id}/file.pdf`, "?strategy=incremental");
    check("naming incremental is refused", !incremental.ok, new TextDecoder().decode(incremental.bytes).slice(0, 120));
    await server.close();
    await store.remove();
}
finish();
