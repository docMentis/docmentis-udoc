/**
 * Which tab a selection opens: the first of the strip that holds for it, unless
 * the tab already open stays open over it.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { SelectionCapabilities } from "../../src/geometry.ts";
import { selectionTab } from "../../src/app/selection-tab.ts";
import type { ToolbarTab } from "../../src/app/state.ts";

const allowing = (...allowed: string[]): SelectionCapabilities =>
    ({ count: 1, copyable: false, allowed }) as SelectionCapabilities;

const holds =
    (...kinds: string[]) =>
    (caps: SelectionCapabilities) =>
        kinds.some((kind) => caps.allowed.includes(kind as never));

const tab = (id: string, rest: Partial<ToolbarTab<string>> = {}): ToolbarTab<string> => ({
    id,
    label: id,
    commands: [],
    ...rest,
});

/** A strip as a deck's reads: a caret in a cell reports its text, its table and
 *  the frame around them, a block of cells its table and the frame. */
const TABS = [
    tab("insert"),
    tab("text", { opensFor: holds("insertText") }),
    tab("table", { opensFor: holds("insertRows"), staysOpen: true }),
    tab("shape", { opensFor: holds("setShapeFill") }),
];
const CARET_IN_CELL = allowing("insertText", "insertRows", "setShapeFill");
const BLOCK_OF_CELLS = allowing("insertRows", "setShapeFill");
const PICKED_FRAME = allowing("setShapeFill");
const CARET_IN_BODY = allowing("insertText");

test("the first tab of the strip holding for a selection is the one it opens", () => {
    assert.equal(selectionTab(TABS, CARET_IN_CELL, null), "text");
    assert.equal(selectionTab(TABS, BLOCK_OF_CELLS, null), "table");
    assert.equal(selectionTab(TABS, BLOCK_OF_CELLS, "text"), "table");
    assert.equal(selectionTab(TABS, PICKED_FRAME, null), "shape");
});

test("a selection no tab holds for opens none", () => {
    assert.equal(selectionTab(TABS, allowing(), "shape"), null);
    assert.equal(selectionTab(TABS, allowing(), "table"), null);
});

test("a tab that stays open keeps the ribbon over a selection it holds for", () => {
    assert.equal(selectionTab(TABS, CARET_IN_CELL, "table"), "table");
    assert.equal(selectionTab(TABS, BLOCK_OF_CELLS, "table"), "table");
});

test("it gives the ribbon up over a selection it does not hold for", () => {
    assert.equal(selectionTab(TABS, CARET_IN_BODY, "table"), "text");
    assert.equal(selectionTab(TABS, PICKED_FRAME, "table"), "shape");
});

test("a tab that does not stay open gives way to the first holding", () => {
    assert.equal(selectionTab(TABS, CARET_IN_CELL, "shape"), "text");
});
