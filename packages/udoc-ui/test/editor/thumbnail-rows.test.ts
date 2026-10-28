/**
 * The thumbnail strip's rows: each page, and each section's header above its
 * slides, a folded section's slides left out — and where each page shows.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { pageRows, thumbnailRows } from "../../src/app/thumbnail-rows.ts";
import type { ThumbnailRow } from "../../src/app/thumbnail-rows.ts";

const SECTIONS = [
    { id: "s1", name: "Intro", start: 0, count: 2 },
    { id: "s2", name: "Empty", start: 2, count: 0 },
    { id: "s3", name: "Body", start: 2, count: 3 },
];

/** `rows` spelled compactly: `p3` a page's, `s1` a section's header. */
function spell(rows: readonly ThumbnailRow[]): string[] {
    return rows.map((row) => (row.kind === "page" ? `p${row.page}` : `s${row.section}`));
}

test("without sections each page is a row", () => {
    assert.deepEqual(spell(thumbnailRows(3, [], new Set())), ["p0", "p1", "p2"]);
});

test("each section's header heads its slides, an empty one's where it sits", () => {
    assert.deepEqual(spell(thumbnailRows(5, SECTIONS, new Set())), ["s0", "p0", "p1", "s1", "s2", "p2", "p3", "p4"]);
});

test("a folded section's slides are left out, its header kept", () => {
    assert.deepEqual(spell(thumbnailRows(5, SECTIONS, new Set(["s1"]))), ["s0", "s1", "s2", "p2", "p3", "p4"]);
    assert.deepEqual(spell(thumbnailRows(5, SECTIONS, new Set(["s1", "s3"]))), ["s0", "s1", "s2"]);
});

test("a section past the last page heads nothing, at the end", () => {
    const sections = [...SECTIONS, { id: "s4", name: "Last", start: 5, count: 0 }];
    assert.deepEqual(spell(thumbnailRows(5, sections, new Set())).slice(-2), ["p4", "s3"]);
});

test("a page shows in its row, or its folded section's header", () => {
    const rows = thumbnailRows(5, SECTIONS, new Set(["s1"]));
    assert.deepEqual(pageRows(5, rows, SECTIONS), [0, 0, 3, 4, 5]);
    const open = thumbnailRows(5, SECTIONS, new Set());
    assert.deepEqual(pageRows(5, open, SECTIONS), [1, 2, 5, 6, 7]);
});
