/**
 * The Format Cell Alignment dialog's pure half: what it opens on, how it shows
 * a turn, and the alignment its OK sends.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { GridCellFormatProperties } from "@docmentis/udoc-wasm";

import { cellAlignmentPatch, cellAlignmentSeed, degreesOf, rotationOf } from "../src/cell-alignment-edits.ts";

/** A cell's format: General across, Bottom down, indented two steps. */
function format(overrides: Partial<GridCellFormatProperties> = {}): GridCellFormatProperties {
    return {
        fontName: "Aptos Narrow",
        fontSize: 11,
        bold: false,
        italic: false,
        underline: "none",
        strike: false,
        verticalAlign: "baseline",
        fontColor: { r: 0, g: 0, b: 0 },
        fillColor: null,
        horizontal: "left",
        vertical: "bottom",
        wrapText: false,
        shrinkToFit: false,
        indent: 2,
        textRotation: 0,
        readingOrder: 0,
        justifyLastLine: false,
        numberFormat: "General",
        ...overrides,
    } as GridCellFormatProperties;
}

test("OK with nothing changed sends nothing", () => {
    const seed = cellAlignmentSeed(format());
    assert.equal(cellAlignmentPatch(seed, seed), null);
});

test("OK sends only what changed", () => {
    const seed = cellAlignmentSeed(format());
    assert.deepEqual(cellAlignmentPatch(seed, { ...seed, vertical: "top", wrapText: true }), {
        vertical: "top",
        wrapText: true,
    });
    assert.deepEqual(cellAlignmentPatch(seed, { ...seed, indent: 3 }), { indent: 3 });
});

test("an alignment that takes no indent takes the cell's away", () => {
    const seed = cellAlignmentSeed(format());
    assert.deepEqual(cellAlignmentPatch(seed, { ...seed, horizontal: "center" }), {
        horizontal: "center",
        indent: 0,
    });
    assert.deepEqual(cellAlignmentPatch(seed, { ...seed, horizontal: "right" }), { horizontal: "right" });
});

test("justify distributed goes only with Distributed", () => {
    const seed = cellAlignmentSeed(format({ horizontal: "distributed", justifyLastLine: true }));
    assert.deepEqual(cellAlignmentPatch(seed, { ...seed, horizontal: "justify" }), {
        horizontal: "justify",
        indent: 0,
        justifyLastLine: false,
    });
});

test("a turn shows up as positive degrees and down as negative", () => {
    assert.equal(degreesOf(45), 45);
    assert.equal(degreesOf(135), -45);
    assert.equal(degreesOf(180), -90);
    assert.equal(degreesOf(255), 0, "stacked text has its own box");
    assert.equal(rotationOf(-45), 135);
    assert.equal(rotationOf(-90), 180);
    assert.equal(rotationOf(90), 90);
});
