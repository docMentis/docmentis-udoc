/**
 * The Table tab's pure halves: what the Table Properties dialog opens on and
 * sends, and the selection Delete Table deletes in a word document.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { TableSelectionProperties, TextSelection, UDocSelection } from "@docmentis/udoc-wasm";

import {
    tablePropertiesEdits,
    tablePropertiesSeed,
    tableSlotSelection,
    wordTableSelection,
} from "../src/table-edits.ts";

/** A table selection's properties: a 20pt-minimum row, a 60pt column, a deck's
 *  default cell margins and a header row. */
function properties(overrides: Partial<TableSelectionProperties> = {}): TableSelectionProperties {
    return {
        fill: "absent",
        fillColor: null,
        anchor: { value: "top" },
        direction: { value: "lrTb" },
        margins: { value: { top: 3.6, bottom: 3.6, left: 7.2, right: 7.2 } },
        height: { value: { atLeast: 20 } },
        header: { value: true },
        width: { value: 60 },
        look: "absent",
        ...overrides,
    };
}

test("the dialog opens on what the selection holds, blank where it holds several", () => {
    const seed = tablePropertiesSeed(properties({ width: "mixed", height: { value: "auto" } }), false);
    assert.equal(seed.values.rowHeight, null, "an automatic height states no measure");
    assert.equal(seed.values.columnWidth, null, "the columns differ");
    assert.deepEqual(seed.values.margins, { top: 3.6, bottom: 3.6, left: 7.2, right: 7.2 });
    assert.equal(seed.heightRule, "atLeast");
    assert.equal(seed.showHeader, false, "a deck's table never splits across pages");
});

test("OK with nothing changed sends nothing", () => {
    const seed = tablePropertiesSeed(properties(), true);
    assert.deepEqual(tablePropertiesEdits(seed, seed.values), []);
});

test("OK sends only what changed, one edit per kind", () => {
    const seed = tablePropertiesSeed(properties(), true);
    const edits = tablePropertiesEdits(seed, {
        ...seed.values,
        rowHeight: 30,
        header: false,
        margins: { ...seed.values.margins, left: 0 },
    });
    assert.deepEqual(edits, [
        { patchRowProperties: { properties: { height: { atLeast: 30 }, header: false } } },
        { patchCellProperties: { properties: { margins: { left: 0 } } } },
    ]);
});

test("an edited height keeps the rule the rows declare it by", () => {
    const seed = tablePropertiesSeed(properties({ height: { value: { exact: 18 } } }), false);
    assert.deepEqual(tablePropertiesEdits(seed, { ...seed.values, rowHeight: 24 }), [
        { patchRowProperties: { properties: { height: { exact: 24 } } } },
    ]);
});

test("a blank field changes nothing, and a field over a mixed value sets it", () => {
    const seed = tablePropertiesSeed(properties({ width: "mixed" }), false);
    assert.deepEqual(tablePropertiesEdits(seed, { ...seed.values, rowHeight: null }), []);
    assert.deepEqual(tablePropertiesEdits(seed, { ...seed.values, columnWidth: 72 }), [
        { setColumnWidth: { width: 72 } },
    ]);
});

test("Repeat Header Rows is a word document's alone", () => {
    const seed = tablePropertiesSeed(properties(), false);
    assert.deepEqual(tablePropertiesEdits(seed, { ...seed.values, header: false }), []);
});

/** A caret in a body table's cell, the table at `offset` of `story`. */
function caretInCell(story: string, offset: number, text: TextSelection): TextSelection {
    return {
        table: {
            story,
            offset,
            table: { cellText: { table: "t", cell: { row: "r", column: "c" }, text } },
        },
    };
}

const CARET: TextSelection = { range: { story: "cell", anchor: 0, focus: 0 } };

test("Delete Table in a word document selects the one position the table takes", () => {
    const selection: UDocSelection = {
        wordprocessing: { sectionText: { section: "s", selection: caretInCell("body", 4, CARET) } },
    };
    assert.deepEqual(wordTableSelection(selection), {
        wordprocessing: { sectionText: { section: "s", selection: { range: { story: "body", anchor: 4, focus: 5 } } } },
    });
});

test("Delete Table takes the innermost table, the one the caret is in", () => {
    const nested = caretInCell("body", 4, caretInCell("cell", 2, CARET));
    assert.deepEqual(
        tableSlotSelection(nested),
        caretInCell("body", 4, { range: { story: "cell", anchor: 2, focus: 3 } }),
    );
});

test("Delete Table has nothing to select outside a table", () => {
    assert.equal(tableSlotSelection(CARET), null);
    assert.equal(wordTableSelection({ presentation: "none" }), null);
});
