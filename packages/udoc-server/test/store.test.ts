/**
 * The directory store's promises to the server: what is put is what is got,
 * each part on its own, and forgotten whole; the latest checkpoint is read an
 * entry at a time, by the route the server API gives it, and a part or a blob
 * deflated, however the zip keeps it; an edit log is kept beside the
 * checkpoints, replaced whole, and only for a document kept; the opaque parts
 * an edit brings, and their blobs, are kept beside them by route, read back
 * deflated, and nothing but a route is kept of what a client sends; a
 * checkpoint is kept beside the earlier ones, once, read as the latest, and
 * forgets what it holds of the opaque parts, and a part only an earlier one
 * holds is read from the newest that does; an id already kept is never
 * overwritten; an id never becomes a path outside the directory; and a write
 * that fails leaves nothing half-written behind.
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

test("a document is kept as its original and its first checkpoint, read back apart, and forgotten", async (t) => {
    const directory = join(await temporaryDirectory(t), "documents");
    const store = new DirectoryDocumentStore(directory);

    assert.equal(await store.getOriginal("a"), undefined, "nothing is kept yet — not even the directory");
    assert.equal(await store.getCheckpoint("a"), undefined);
    assert.equal(await store.delete("a"), false);

    await store.put("a", pdf);
    const original = await store.getOriginal("a");
    assert.deepEqual({ bytes: text(original?.bytes), format: original?.format }, { bytes: "pdf", format: "pdf" });
    assert.equal(text(await store.getCheckpoint("a")), "PK");
    assert.deepEqual((await readdir(join(directory, "a"))).sort(), ["checkpoints", "original.pdf"]);
    assert.deepEqual(await readdir(join(directory, "a", "checkpoints")), ["v0.udoc"]);

    assert.equal(await store.delete("a"), true);
    assert.equal(await store.getOriginal("a"), undefined);
    assert.equal(await store.getCheckpoint("a"), undefined);
    assert.deepEqual(await readdir(directory), []);
});

test("the latest checkpoint is read an entry at a time, each at its route", async (t) => {
    const store = new DirectoryDocumentStore(await temporaryDirectory(t));
    await store.put("a", { original: pdf.original, checkpoint: await packageZip() });

    assert.deepEqual(await store.getDescription("a"), {
        docType: "portable",
        sourceFormat: "pdf",
        baselineVersion: 0,
    });
    const parts = async (routes: [string, string][]) =>
        Promise.all(routes.map(async ([kinds, partId]) => inflated(await store.getPart("a", kinds, partId))));
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
    assert.equal(inflated(await store.getBlob("a", IMAGE_BLOB)), "image blob");
    assert.equal(inflated(await store.getBlob("a", RAW_BLOB)), "raw blob");
    assert.equal(await store.getBlob("a", "ffff"), undefined);

    // Read deflated whether the zip keeps an entry deflated or stored.
    await store.put("s", { original: pdf.original, checkpoint: await packageZip(PACKAGE_ENTRIES, false) });
    assert.equal(inflated(await store.getPart("s", "pages", "0-1")), "page");
    assert.equal(inflated(await store.getBlob("s", RAW_BLOB)), "raw blob");

    // Nothing kept has nothing.
    assert.equal(await store.getDescription("c"), undefined);
    assert.equal(await store.getPart("c", "pages", "0-1"), undefined);
    assert.equal(await store.getBlob("c", IMAGE_BLOB), undefined);
});

test("an edit log is kept beside the checkpoints, replaced whole, and only for a document kept", async (t) => {
    const directory = await temporaryDirectory(t);
    const store = new DirectoryDocumentStore(directory);
    await store.put("a", { original: pdf.original, checkpoint: await packageZip() });
    assert.equal(await store.getLog("a"), undefined);
    assert.equal((await store.getDescription("a"))?.baselineFrontier, undefined, "no log, nothing to replay");

    await store.putLog("a", bytesOf("log 1"));
    await store.putLog("a", bytesOf("log 2"));
    assert.equal(text(await store.getLog("a")), "log 2");
    assert.deepEqual((await store.getDescription("a"))?.baselineFrontier, [], "replayed from the baseline");
    assert.deepEqual((await readdir(join(directory, "a"))).sort(), ["checkpoints", "crdt.loro", "original.pdf"]);

    await assert.rejects(store.putLog("b", bytesOf("log")), /no document "b" is kept/);
    assert.deepEqual(await readdir(directory), ["a"], "a log for nothing kept keeps nothing");
    await store.delete("a");
    assert.equal(await store.getLog("a"), undefined);
});

test("an opaque part and its blobs are kept by route beside the checkpoints, and nothing else is", async (t) => {
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
    assert.equal(inflated(await store.getPart("a", "images", "0-2a")), "image part");
    assert.equal(inflated(await store.getPart("a", "soft-masks", "0-3")), "another kind");
    assert.equal(inflated(await store.getPart("a", "soft-masks", "0-1a")), "soft mask", "the checkpoint's own, first");
    assert.equal(await store.getPart("a", "images", "0-2b"), undefined);
    assert.equal(inflated(await store.getBlob("a", "e7e7e7")), "pixels");
    assert.equal(inflated(await store.getBlob("a", IMAGE_BLOB)), "image blob", "the checkpoint's own, first");
    assert.deepEqual((await readdir(join(directory, "a"))).sort(), [
        "blobs",
        "checkpoints",
        "opaque-parts",
        "original.pdf",
    ]);
    assert.deepEqual(await readdir(join(directory, "a", "blobs")), ["e7e7e7"]);
    assert.deepEqual(await readdir(join(directory, "a", "opaque-parts", "images")), ["0-2a"], "nothing but a route");

    await assert.rejects(store.putOpaqueParts("b", parts), /no document "b" is kept/);
    assert.deepEqual(await readdir(directory), ["a"], "opaque parts for nothing kept keep nothing");
});

test("a checkpoint is kept beside the earlier ones, once, read as the latest, and forgets the opaque parts it holds", async (t) => {
    const directory = await temporaryDirectory(t);
    const store = new DirectoryDocumentStore(directory);
    await store.put("a", { original: pdf.original, checkpoint: await packageZip() });
    await store.putOpaqueParts(
        "a",
        await packageZip({
            "parts/image_0-2a.json": "image part",
            "blobs/e7e7e7.png": "image pixels",
            "parts/image_0-2b.json": "an image an undo took out",
        }),
    );
    assert.equal(await store.getLog("a"), undefined);

    const checkpoint = await packageZip(checkpointEntries(1));
    await store.putCheckpoint("a", 1, checkpoint);
    assert.deepEqual(await readdir(join(directory, "a", "checkpoints")), ["v0.udoc", "v1.udoc"], "v0 kept beside it");
    assert.deepEqual(await store.getCheckpoint("a"), checkpoint);
    assert.deepEqual(await store.getDescription("a"), {
        docType: "portable",
        sourceFormat: "pdf",
        baselineVersion: 1,
        baselineFrontier: [[PEER, 7n]],
    });
    assert.equal(inflated(await store.getPart("a", "pages", "0-1")), "page v1");
    // What it holds is read from it, and kept beside it no longer; what it
    // doesn't hold stays.
    assert.equal(inflated(await store.getPart("a", "images", "0-2a")), "image part");
    assert.equal(inflated(await store.getBlob("a", "e7e7e7")), "image pixels");
    assert.deepEqual(await readdir(join(directory, "a", "opaque-parts", "images")), ["0-2b"]);
    assert.deepEqual(await readdir(join(directory, "a", "blobs")), []);
    // Checkpointed before an edit was kept, its own log is the log; once one
    // is kept, that one.
    assert.equal(text(await store.getLog("a")), "[]");
    await store.putLog("a", bytesOf("log"));
    assert.equal(text(await store.getLog("a")), "log");

    await assert.rejects(store.putCheckpoint("a", 1, await packageZip()), /keeps checkpoint v1 already/);
    assert.deepEqual(await store.getCheckpoint("a"), checkpoint, "a version is kept once");

    // A later checkpoint that doesn't hold the picture — nothing showed it —
    // leaves it read from the newest earlier one that does, for an undo to
    // show it again; what the latest holds, the latest's.
    const withoutPicture = Object.fromEntries(
        Object.entries(checkpointEntries(2)).filter(([name]) => !/image_0-2a|e7e7e7/.test(name)),
    );
    await store.putCheckpoint("a", 2, await packageZip(withoutPicture));
    assert.equal(inflated(await store.getPart("a", "pages", "0-1")), "page v2");
    assert.equal(inflated(await store.getPart("a", "images", "0-2a")), "image part");
    assert.equal(inflated(await store.getBlob("a", "e7e7e7")), "image pixels");
    assert.equal(await store.getPart("a", "images", "0-2c"), undefined, "one no checkpoint holds");
    await assert.rejects(store.putCheckpoint("c", 1, checkpoint), /no document "c" with checkpoints is kept/);
    assert.deepEqual(await readdir(directory), ["a"]);
    assert.deepEqual(
        await readdir(join(directory, "a", "checkpoints")),
        ["v0.udoc", "v1.udoc", "v2.udoc"],
        "nothing staged",
    );
});

test("an id that could name another path is refused before any file is touched", async (t) => {
    const parent = await temporaryDirectory(t);
    const store = new DirectoryDocumentStore(join(parent, "documents"));

    for (const id of ["../escape", "a/b", "a.partial", ".", ""]) {
        await assert.rejects(store.put(id, pdf), /not a document id/, id);
        await assert.rejects(store.getOriginal(id), /not a document id/, id);
        await assert.rejects(store.getCheckpoint(id), /not a document id/, id);
        await assert.rejects(store.putCheckpoint(id, 1, bytesOf("PK")), /not a document id/, id);
        await assert.rejects(store.getDescription(id), /not a document id/, id);
        await assert.rejects(store.delete(id), /not a document id/, id);
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
