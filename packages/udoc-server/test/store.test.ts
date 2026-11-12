/**
 * The directory store's promises to the server: a document is kept as its
 * original, `v0` on `main`, read back apart, and forgotten whole; a branch's
 * head, or one version, is read an entry at a time, by the route the server API
 * gives it, and a part or a blob deflated, however the zip keeps it, along its
 * ancestry; a branch's edit log is kept beside its versions, replaced whole, and
 * only for a branch kept; the opaque parts an edit brings, and their blobs, are
 * kept for the document by route, read back deflated, and nothing but a route is
 * kept of what a client sends; a version is kept once, on its branch, its
 * parent the branch's head; a cut keeps its version, marked, then replaces the
 * log; a branch starts from any version and is forgotten without its versions; a
 * merge is recorded under its target; an id already kept is never overwritten;
 * an id never becomes a path outside the directory; and a write that fails
 * leaves nothing half-written behind.
 */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { inflateRawSync } from "node:zlib";

import type { KeptDocument } from "../src/store.ts";
import { DirectoryDocumentStore } from "../src/store.ts";
import { IMAGE_BLOB, PACKAGE_ENTRIES, PEER, RAW_BLOB, checkpointEntries, packageZip } from "./package-zip.ts";

type Context = { after(fn: () => Promise<void>): void };

async function temporaryDirectory(t: Context): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), "udoc-store-test-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    return directory;
}

const bytesOf = (value: string) => new TextEncoder().encode(value);
const text = (bytes: Uint8Array | undefined) => (bytes === undefined ? undefined : new TextDecoder().decode(bytes));
/** The text of an entry read deflated. */
const inflated = (bytes: Uint8Array | undefined) => text(bytes && inflateRawSync(bytes));

const pdf: KeptDocument = { original: { bytes: bytesOf("pdf"), format: "pdf" }, checkpoint: bytesOf("PK") };
const MAIN = { branch: "main" } as const;

/** Every file kept under `path`, relative to it, sorted. */
async function files(path: string): Promise<string[]> {
    return (await readdir(path, { recursive: true, withFileTypes: true }))
        .filter((entry) => entry.isFile())
        .map((entry) => join(entry.parentPath, entry.name).slice(path.length + 1))
        .sort();
}

test("a document is kept as its original and v0 on main, read back apart, and forgotten", async (t) => {
    const directory = join(await temporaryDirectory(t), "documents");
    const store = new DirectoryDocumentStore(directory);

    assert.equal(await store.getOriginal("a"), undefined, "nothing is kept yet — not even the directory");
    assert.deepEqual(await store.getVersions("a"), []);
    assert.deepEqual(await store.getBranches("a"), []);
    assert.equal(await store.delete("a"), false);

    await store.put("a", pdf);
    const original = await store.getOriginal("a");
    assert.deepEqual({ bytes: text(original?.bytes), format: original?.format }, { bytes: "pdf", format: "pdf" });
    assert.deepEqual(await store.getVersions("a"), [{ version: 0, branch: "main" }]);
    assert.deepEqual(await store.getBranches("a"), [{ branch: "main" }]);
    assert.deepEqual(await files(join(directory, "a")), [
        "branches/main/branch.json",
        "original.pdf",
        "versions/v0.json",
        "versions/v0.udoc",
    ]);

    assert.equal(await store.delete("a"), true);
    assert.equal(await store.getOriginal("a"), undefined);
    assert.deepEqual(await store.getVersions("a"), []);
    assert.deepEqual(await readdir(directory), []);
});

test("a branch's head is read an entry at a time, each at its route", async (t) => {
    const store = new DirectoryDocumentStore(await temporaryDirectory(t));
    await store.put("a", { original: pdf.original, checkpoint: await packageZip() });

    assert.deepEqual(await store.getDescription("a", MAIN), {
        docType: "portable",
        sourceFormat: "pdf",
        baselineVersion: 0,
    });
    const parts = async (routes: [string, string][]) =>
        Promise.all(routes.map(async ([kinds, partId]) => inflated(await store.getPart("a", kinds, partId, MAIN))));
    // A kind's route is its kebab-case plural; one already plural, or a
    // `…data` one, stays as it is.
    assert.deepEqual(
        await parts([
            ["catalogs", "0-0"],
            ["pages", "0-1"],
            ["soft-masks", "0-1a"],
            ["font-data", "1-2"],
            ["settings", "0-0"],
        ]),
        ["catalog", "page", "soft mask", "font data", "settings"],
    );
    // Not the entry's own name, nor its kind in the singular, nor another id.
    assert.deepEqual(
        await parts([
            ["soft_mask", "0-1a"],
            ["soft-mask", "0-1a"],
            ["pages", "0-2"],
        ]),
        [undefined, undefined, undefined],
    );
    // A blob by its key, whatever extension it was written with.
    assert.equal(inflated(await store.getBlob("a", IMAGE_BLOB, MAIN)), "image blob");
    assert.equal(inflated(await store.getBlob("a", RAW_BLOB, MAIN)), "raw blob");
    assert.equal(await store.getBlob("a", "ffff", MAIN), undefined);

    // Read deflated whether the zip keeps an entry deflated or stored.
    await store.put("s", { original: pdf.original, checkpoint: await packageZip(PACKAGE_ENTRIES, false) });
    assert.equal(inflated(await store.getPart("s", "pages", "0-1", MAIN)), "page");
    assert.equal(inflated(await store.getBlob("s", RAW_BLOB, MAIN)), "raw blob");

    // Nothing kept, or no such branch, has nothing.
    assert.equal(await store.getDescription("c", MAIN), undefined);
    assert.equal(await store.getPart("c", "pages", "0-1", MAIN), undefined);
    assert.equal(await store.getBlob("c", IMAGE_BLOB, MAIN), undefined);
    assert.equal(await store.getDescription("a", { branch: "other" }), undefined);
    assert.equal(await store.getPart("a", "pages", "0-1", { branch: "other" }), undefined);
});

test("a branch's edit log is kept beside its versions, replaced whole, and only for a branch kept", async (t) => {
    const directory = await temporaryDirectory(t);
    const store = new DirectoryDocumentStore(directory);
    await store.put("a", { original: pdf.original, checkpoint: await packageZip() });
    assert.equal(await store.getLog("a", "main"), undefined);
    assert.equal((await store.getDescription("a", MAIN))?.baselineFrontier, undefined, "no log, nothing to replay");

    await store.putLog("a", "main", bytesOf("log 1"));
    await store.putLog("a", "main", bytesOf("log 2"));
    assert.equal(text(await store.getLog("a", "main")), "log 2");
    assert.deepEqual((await store.getDescription("a", MAIN))?.baselineFrontier, [], "replayed from the baseline");
    assert.ok((await files(join(directory, "a"))).includes("branches/main/crdt_delta.loro"));

    await assert.rejects(store.putLog("b", "main", bytesOf("log")), /nothing is kept/);
    await assert.rejects(store.putLog("a", "other", bytesOf("log")), /nothing is kept/);
    assert.deepEqual(await readdir(directory), ["a"], "a log for nothing kept keeps nothing");
    assert.deepEqual(await readdir(join(directory, "a", "branches")), ["main"]);
    await store.delete("a");
    assert.equal(await store.getLog("a", "main"), undefined);
});

test("a cut keeps its version, marked a cut on its branch, then replaces the log, and a refused one changes nothing", async (t) => {
    const directory = await temporaryDirectory(t);
    const store = new DirectoryDocumentStore(directory);
    await store.put("a", { original: pdf.original, checkpoint: await packageZip() });
    await store.putLog("a", "main", bytesOf("whole"));
    assert.equal(await store.getVersionLog("a", 1), undefined);

    await store.putCut("a", "main", 1, await packageZip(checkpointEntries(1)), bytesOf("cut at 1"));
    assert.deepEqual(await store.getVersions("a"), [
        { version: 0, branch: "main" },
        { version: 1, branch: "main", parent: 0, cut: true },
    ]);
    assert.equal(text(await store.getLog("a", "main")), "cut at 1");
    assert.equal((await store.getDescription("a", MAIN))?.baselineVersion, 1);
    assert.equal(text(await store.getVersionLog("a", 1)), "[]", "the log the version holds, not the branch's");

    await assert.rejects(
        store.putCut("a", "main", 1, await packageZip(checkpointEntries(1)), bytesOf("again")),
        /keeps version v1 already/,
    );
    assert.equal(text(await store.getLog("a", "main")), "cut at 1");
    await assert.rejects(store.putCut("a", "other", 2, await packageZip(), bytesOf("log")), /keeps no branch other/);
    assert.deepEqual(
        (await store.getVersions("a")).map(({ version }) => version),
        [0, 1],
    );
});

test("what pairs a package with its original is read from a branch's head, or the version asked", async (t) => {
    const store = new DirectoryDocumentStore(await temporaryDirectory(t));
    await store.put("a", { original: pdf.original, checkpoint: await packageZip() });
    assert.equal(await store.getOriginalIdMap("a", MAIN), undefined, "this package holds none");
    assert.equal(await store.getModifiedPartIds("a", MAIN), undefined);

    for (const version of [1, 2]) {
        await store.putVersion(
            "a",
            "main",
            version,
            await packageZip({
                ...checkpointEntries(version),
                "original_id_map.json": `map v${version}`,
                "modified_part_ids.json": `ids v${version}`,
            }),
        );
    }
    assert.equal(text(await store.getOriginalIdMap("a", MAIN)), "map v2");
    assert.equal(text(await store.getModifiedPartIds("a", MAIN)), "ids v2");
    assert.equal(text(await store.getOriginalIdMap("a", { version: 1 })), "map v1");
    assert.equal(text(await store.getModifiedPartIds("a", { version: 1 })), "ids v1");
    assert.equal(await store.getOriginalIdMap("a", { version: 0 }), undefined);
    assert.equal(await store.getOriginalIdMap("a", { version: 7 }), undefined);
    assert.equal(await store.getOriginalIdMap("b", MAIN), undefined);
});

test("a part a version records as removed reads as nothing, while its parent still holds it", async (t) => {
    const store = new DirectoryDocumentStore(await temporaryDirectory(t));
    const route = ["notes-slides", "1-2"] as const;
    await store.put("a", { original: pdf.original, checkpoint: await packageZip() });
    const part = { "parts/notes_slide_1-2.json": "held" };
    await store.putVersion("a", "main", 1, await packageZip({ ...checkpointEntries(1), ...part }));
    await store.putVersion("a", "main", 2, await packageZip(checkpointEntries(2)));
    assert.equal(inflated(await store.getPart("a", ...route, MAIN)), "held", "an earlier version answers");

    const removed = { "removed_part_ids.json": JSON.stringify({ NotesSlide: ["1-2"] }) };
    await store.putVersion("a", "main", 3, await packageZip({ ...checkpointEntries(3), ...removed }));
    assert.equal(await store.getPart("a", ...route, MAIN), undefined, "removed as of the head");
    assert.equal(await store.getPart("a", ...route, { version: 3 }), undefined, "removed as of that version");
    assert.equal(inflated(await store.getPart("a", ...route, { version: 2 })), "held", "not yet as of that one");
    assert.equal(text(await store.getRemovedPartIds("a", MAIN)), JSON.stringify({ NotesSlide: ["1-2"] }));
    assert.equal(await store.getRemovedPartIds("a", { version: 2 }), undefined);

    await store.putVersion("a", "main", 4, await packageZip(checkpointEntries(4)));
    assert.equal(
        inflated(await store.getPart("a", ...route, MAIN)),
        "held",
        "the record is the head's own: an undo cleared it",
    );
});

test("a version is read as it was, as an editor opens it with its log, and one not kept reads as nothing", async (t) => {
    const store = new DirectoryDocumentStore(await temporaryDirectory(t));
    await store.put("a", { original: pdf.original, checkpoint: await packageZip() });
    await store.putVersion("a", "main", 1, await packageZip(checkpointEntries(1)));
    // It leaves out a part v1 holds, as a version does one that shows no longer,
    // and comes after a number a cut could have used up.
    const { "parts/soft_mask_0-1a.json": _left, ...v3 } = checkpointEntries(3);
    await store.putVersion("a", "main", 3, await packageZip(v3));
    await store.putLog("a", "main", bytesOf("log"));
    assert.deepEqual(
        (await store.getVersions("a")).map(({ version, parent }) => [version, parent]),
        [
            [0, undefined],
            [1, 0],
            [3, 1],
        ],
    );

    // Its description is its own, with no frontier, since no log replays over
    // it; opened with its log, its own frontier.
    const asItWas = { docType: "portable", sourceFormat: "pdf", baselineVersion: 1 } as const;
    assert.deepEqual(await store.getDescription("a", { version: 1 }), asItWas);
    assert.deepEqual(await store.getDescription("a", { version: 1, withLog: true }), {
        ...asItWas,
        baselineFrontier: [[PEER, 7n]],
    });
    assert.equal(text(await store.getVersionLog("a", 1)), "[]");
    const head = await store.getDescription("a", MAIN);
    assert.equal(head?.baselineVersion, 3);
    assert.ok(head?.baselineFrontier);

    // Its parts are its own, not the head's.
    assert.equal(inflated(await store.getPart("a", "pages", "0-1", { version: 0 })), "page");
    assert.equal(inflated(await store.getPart("a", "pages", "0-1", { version: 1 })), "page v1");
    assert.equal(inflated(await store.getPart("a", "pages", "0-1", { version: 3 })), "page v3");
    assert.equal(inflated(await store.getPart("a", "pages", "0-1", MAIN)), "page v3");
    // What only an earlier one holds comes from it, and nothing from a later one.
    assert.equal(inflated(await store.getPart("a", "soft-masks", "0-1a", { version: 3 })), "soft mask");
    assert.equal(await store.getPart("a", "images", "0-2a", { version: 0 }), undefined);
    assert.equal(inflated(await store.getPart("a", "images", "0-2a", { version: 1 })), "image part");
    assert.equal(await store.getBlob("a", "e7e7e7", { version: 0 }), undefined);
    assert.equal(inflated(await store.getBlob("a", "e7e7e7", { version: 1 })), "image pixels");

    // An opaque part kept for the document is found as it is for a branch.
    await store.putOpaqueParts("a", await packageZip({ "parts/image_0-3.json": "brought by an edit" }));
    assert.equal(inflated(await store.getPart("a", "images", "0-3", { version: 1 })), "brought by an edit");

    // A version not kept has nothing, not even what is kept for the document.
    assert.equal(await store.getDescription("a", { version: 2 }), undefined);
    assert.equal(await store.getPart("a", "pages", "0-1", { version: 2 }), undefined);
    assert.equal(await store.getPart("a", "images", "0-3", { version: 2 }), undefined);
    assert.equal(await store.getBlob("a", IMAGE_BLOB, { version: 2 }), undefined);
    assert.equal(await store.getDescription("b", { version: 0 }), undefined);
    assert.equal(await store.getPart("b", "pages", "0-1", { version: 0 }), undefined);
});

test("an opaque part and its blobs are kept by route for the document, and nothing else is", async (t) => {
    const directory = await temporaryDirectory(t);
    const store = new DirectoryDocumentStore(directory);
    await store.put("a", { original: pdf.original, checkpoint: await packageZip() });
    const parts = await packageZip({
        "parts/image_0-2a.json": "image part",
        "parts/soft_mask_0-3.json": "another kind",
        "blobs/e7e7e7.png": "pixels",
        "opaque_parts.json": "[]",
        // Entry names a client chose that are no route. (One naming a path
        // outside — `..` — the zip reader refuses before any route is read.)
        "metadata.json": "{}",
        "parts/image_0-2a_1-7.json": "no part's entry name",
    });

    await store.putOpaqueParts("a", parts);
    // Kept again, it stays as it was.
    await store.putOpaqueParts("a", parts);
    assert.equal(inflated(await store.getPart("a", "images", "0-2a", MAIN)), "image part");
    assert.equal(inflated(await store.getPart("a", "soft-masks", "0-3", MAIN)), "another kind");
    assert.equal(inflated(await store.getPart("a", "soft-masks", "0-1a", MAIN)), "soft mask", "the head's own, first");
    assert.equal(await store.getPart("a", "images", "0-2b", MAIN), undefined);
    assert.equal(inflated(await store.getBlob("a", "e7e7e7", MAIN)), "pixels");
    assert.equal(inflated(await store.getBlob("a", IMAGE_BLOB, MAIN)), "image blob", "the head's own, first");
    assert.deepEqual(await files(join(directory, "a", "opaque-parts")), ["images/0-2a", "soft-masks/0-3"]);
    assert.deepEqual(await readdir(join(directory, "a", "blobs")), ["e7e7e7"], "nothing but a route");

    await assert.rejects(store.putOpaqueParts("b", parts), /no document "b" is kept/);
    assert.deepEqual(await readdir(directory), ["a"], "opaque parts for nothing kept keep nothing");
});

test("a version is kept on its branch once, its parent the branch's head, and keeps the document's opaque parts", async (t) => {
    const directory = await temporaryDirectory(t);
    const store = new DirectoryDocumentStore(directory);
    await store.put("a", { original: pdf.original, checkpoint: await packageZip() });
    await store.putOpaqueParts(
        "a",
        await packageZip({ "parts/image_0-2a.json": "image part", "blobs/e7e7e7.png": "image pixels" }),
    );
    assert.equal(await store.getLog("a", "main"), undefined);

    const checkpoint = await packageZip(checkpointEntries(1));
    await store.putVersion("a", "main", 1, checkpoint);
    assert.deepEqual(await store.getVersions("a"), [
        { version: 0, branch: "main" },
        { version: 1, branch: "main", parent: 0 },
    ]);
    assert.deepEqual(await store.getDescription("a", MAIN), {
        docType: "portable",
        sourceFormat: "pdf",
        baselineVersion: 1,
        baselineFrontier: [[PEER, 7n]],
    });
    assert.equal(inflated(await store.getPart("a", "pages", "0-1", MAIN)), "page v1");
    // Every branch reads the document's opaque parts, so none goes when a
    // version holds it.
    assert.deepEqual(await files(join(directory, "a", "opaque-parts")), ["images/0-2a"]);
    assert.deepEqual(await readdir(join(directory, "a", "blobs")), ["e7e7e7"]);
    // Checkpointed before an edit was kept, its own log is the branch's; once
    // one is kept, that one.
    assert.equal(text(await store.getLog("a", "main")), "[]");
    await store.putLog("a", "main", bytesOf("log"));
    assert.equal(text(await store.getLog("a", "main")), "log");

    await assert.rejects(store.putVersion("a", "main", 1, await packageZip()), /keeps version v1 already/);
    assert.deepEqual(text(await store.getVersionLog("a", 1)), "[]", "a version is kept once");
    await assert.rejects(store.putVersion("a", "other", 2, checkpoint), /keeps no branch other/);
    await assert.rejects(store.putVersion("c", "main", 1, checkpoint), /keeps no branch main/);
    assert.deepEqual(await readdir(directory), ["a"]);
    assert.deepEqual(await readdir(join(directory, "a", "versions")), ["v0.json", "v0.udoc", "v1.json", "v1.udoc"]);
});

test("a branch starts from any version, reads along its ancestry, and is forgotten without its versions", async (t) => {
    const directory = await temporaryDirectory(t);
    const store = new DirectoryDocumentStore(directory);
    await store.put("a", { original: pdf.original, checkpoint: await packageZip() });
    await store.putVersion("a", "main", 1, await packageZip(checkpointEntries(1)));
    // A part main's v2 holds that v1 doesn't: the branch from v1 never reads it,
    // though v2's number comes before the branch's own.
    await store.putVersion(
        "a",
        "main",
        2,
        await packageZip({ ...checkpointEntries(2), "parts/notes_slide_1-2.json": "main's" }),
    );

    await store.putBranch("a", "b", 1);
    assert.deepEqual(await store.getBranches("a"), [{ branch: "main" }, { branch: "b", base: 1 }]);
    const B = { branch: "b" };
    assert.equal((await store.getDescription("a", B))?.baselineVersion, 1, "its head is its base");
    assert.equal(inflated(await store.getPart("a", "pages", "0-1", B)), "page v1");
    assert.equal(text(await store.getLog("a", "b")), "[]", "its base's own log, until it has one");

    const { "parts/soft_mask_0-1a.json": _left, ...v3 } = checkpointEntries(3);
    await store.putVersion("a", "b", 3, await packageZip(v3));
    assert.deepEqual((await store.getVersions("a")).at(-1), { version: 3, branch: "b", parent: 1 });
    assert.equal(inflated(await store.getPart("a", "pages", "0-1", B)), "page v3");
    assert.equal(inflated(await store.getPart("a", "soft-masks", "0-1a", B)), "soft mask", "from its ancestry");
    assert.equal(await store.getPart("a", "notes-slides", "1-2", B), undefined, "and from no other branch's");
    assert.equal(inflated(await store.getPart("a", "notes-slides", "1-2", MAIN)), "main's");
    assert.equal((await store.getDescription("a", MAIN))?.baselineVersion, 2, "main's head stays its own");
    await store.putLog("a", "b", bytesOf("b's log"));
    assert.equal(text(await store.getLog("a", "main")), "[]", "each branch's log its own: main's, its head's");

    await assert.rejects(store.putBranch("a", "c", 7), /keeps no version v7/);
    await assert.rejects(store.putBranch("a", "b", 2), /keeps branch b already/);
    assert.deepEqual(await readdir(join(directory, "a", "branches")), ["b", "main"], "nothing staged");

    assert.equal(await store.deleteBranch("a", "b"), true);
    assert.equal(await store.deleteBranch("a", "b"), false);
    assert.deepEqual(await store.getBranches("a"), [{ branch: "main" }]);
    assert.equal(await store.getDescription("a", B), undefined);
    assert.equal(await store.getLog("a", "b"), undefined);
    assert.equal(inflated(await store.getPart("a", "pages", "0-1", { version: 3 })), "page v3", "its versions stay");
});

test("what a branch was last merged from another is kept under it, and goes with it", async (t) => {
    const store = new DirectoryDocumentStore(await temporaryDirectory(t));
    await store.put("a", { original: pdf.original, checkpoint: await packageZip() });
    await store.putBranch("a", "b", 0);
    assert.equal(await store.getMerge("a", "main", "b"), undefined);

    await store.putMerge("a", "main", "b", { versionVector: bytesOf("vv 1"), moved: false });
    await store.putMerge("a", "main", "b", { versionVector: bytesOf("vv 2"), moved: true });
    const merge = await store.getMerge("a", "main", "b");
    assert.deepEqual(
        { versionVector: text(merge?.versionVector), moved: merge?.moved },
        { versionVector: "vv 2", moved: true },
    );
    assert.equal(await store.getMerge("a", "b", "main"), undefined, "under its target");

    await assert.rejects(
        store.putMerge("a", "c", "b", { versionVector: bytesOf(""), moved: false }),
        /keeps no branch c/,
    );
    await store.putMerge("a", "b", "main", { versionVector: bytesOf("back"), moved: false });
    await store.deleteBranch("a", "b");
    await store.putBranch("a", "b", 0);
    assert.equal(await store.getMerge("a", "b", "main"), undefined, "a branch forgotten forgets what it merged");
});

test("an id that could name another path is refused before any file is touched", async (t) => {
    const parent = await temporaryDirectory(t);
    const store = new DirectoryDocumentStore(join(parent, "documents"));

    for (const id of ["../escape", "a/b", "a.partial", ".", ""]) {
        await assert.rejects(store.put(id, pdf), /not a document id/, id);
        await assert.rejects(store.getOriginal(id), /not a document id/, id);
        await assert.rejects(store.getVersions(id), /not a document id/, id);
        await assert.rejects(store.putVersion(id, "main", 1, bytesOf("PK")), /not a document id/, id);
        await assert.rejects(store.getDescription(id, MAIN), /not a document id/, id);
        await assert.rejects(store.delete(id), /not a document id/, id);
        await assert.rejects(store.getLog("a", id), /not a branch id/, id);
        await assert.rejects(store.putBranch("a", id, 0), /not a branch id|keeps no version/, id);
        await assert.rejects(store.getMerge("a", "main", id), /not a branch id/, id);
    }
    assert.deepEqual(await readdir(parent), []);
});

test("an id already kept is refused, and the refused write leaves nothing staged", async (t) => {
    const directory = await temporaryDirectory(t);
    const store = new DirectoryDocumentStore(directory);
    await mkdir(join(directory, "a"));
    await writeFile(join(directory, "a", "occupant"), "kept");

    await assert.rejects(store.put("a", pdf));
    assert.deepEqual(await readdir(directory), ["a"]);
    assert.deepEqual(await readdir(join(directory, "a")), ["occupant"]);
    assert.equal(await readFile(join(directory, "a", "occupant"), "utf8"), "kept");
});
