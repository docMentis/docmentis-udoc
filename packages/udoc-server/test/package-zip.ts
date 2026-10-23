/**
 * A udoc package for the tests to stream from: a real zip, named as the
 * engine's zip saver names its entries, holding each entry as the given text.
 */

import { buffer } from "node:stream/consumers";

import { ZipFile } from "yazl";

/** Two blob keys: one written with an extension, one without. */
export const IMAGE_BLOB = "a1b2c3";
export const RAW_BLOB = "d4e5f6";

/** A portable package, a flat baseline, whose part and blob entries each hold their own name. */
export const PACKAGE_ENTRIES: Record<string, string> = {
    "metadata.json": JSON.stringify({ udoc: 1, documentType: "portable", sourceFormat: "pdf", baselineVersion: 0 }),
    "parts/catalog_0-0.json": "catalog",
    "parts/page_0-1.json": "page",
    "parts/soft_mask_0-1a.json": "soft mask",
    "parts/font_data_1-2.json": "font data",
    "parts/settings_0-0.json": "settings",
    [`blobs/${IMAGE_BLOB}.png`]: "image blob",
    [`blobs/${RAW_BLOB}`]: "raw blob",
};

/** A peer as the engine mints one: random, so past what a JS number holds exactly. */
export const PEER = 18446744073709551557n;

/**
 * Checkpoint `version` of {@link PACKAGE_ENTRIES}' document: its page edited,
 * an inserted picture's image among its parts, and its edit log — an empty
 * one — with the frontier its parts sit at.
 */
export function checkpointEntries(version: number): Record<string, string> {
    return {
        ...PACKAGE_ENTRIES,
        // Written by hand: `JSON.stringify` can't write a `u64` whole.
        "metadata.json": `{"udoc":1,"documentType":"portable","sourceFormat":"pdf","baselineVersion":${version},"baselineFrontier":[[${PEER},7]]}`,
        "parts/page_0-1.json": `page v${version}`,
        "parts/image_0-2a.json": "image part",
        "blobs/e7e7e7.png": "image pixels",
        "crdt.loro": "[]",
    };
}

/** `entries` as a zip, each deflated as the engine's saver writes it — or, not `compress`, stored. */
export async function packageZip(entries: Record<string, string> = PACKAGE_ENTRIES, compress = true): Promise<Uint8Array> {
    const zip = new ZipFile();
    for (const [name, text] of Object.entries(entries)) zip.addBuffer(Buffer.from(text), name, { compress });
    zip.end();
    return buffer(zip.outputStream);
}
