/**
 * Which tab a selection opens: the first of the strip that holds for it, unless
 * the tab already open stays open over it.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { SelectionCapabilities } from "../../src/geometry.ts";
import { selectionOpensTab, selectionTab } from "../../src/app/selection-tab.ts";
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

/** A strip as a PDF's reads: its Page tab for pages picked and for nothing at all. */
const NOTHING = { count: 0, copyable: false, allowed: [] } as unknown as SelectionCapabilities;
const PICKED_PAGES = allowing("rotatePages");
const PICKED_OBJECT = allowing("translateObjects");
const PDF_TABS = [
    tab("page", { opensFor: (caps) => caps.count === 0 || holds("rotatePages")(caps) }),
    tab("object", { opensFor: holds("translateObjects") }),
    tab("view"),
];

test("a selection of another kind opens its tab, and nothing selected the Page tab", () => {
    assert.equal(selectionOpensTab(PDF_TABS, NOTHING, PICKED_OBJECT, "page"), "object");
    assert.equal(selectionOpensTab(PDF_TABS, PICKED_OBJECT, NOTHING, "object"), "page");
    assert.equal(selectionOpensTab(PDF_TABS, PICKED_OBJECT, PICKED_PAGES, "object"), "page");
});

test("a selection of the same kind leaves a tab picked since", () => {
    assert.equal(selectionOpensTab(PDF_TABS, NOTHING, NOTHING, "view"), null);
    assert.equal(selectionOpensTab(PDF_TABS, PICKED_OBJECT, PICKED_OBJECT, "view"), null);
    assert.equal(selectionOpensTab(PDF_TABS, PICKED_PAGES, PICKED_PAGES, "view"), null);
    assert.equal(selectionOpensTab(PDF_TABS, PICKED_PAGES, NOTHING, "view"), null);
});

test("a selection out of none opens its tab, though none was for the same one", () => {
    assert.equal(selectionOpensTab(PDF_TABS, NOTHING, PICKED_PAGES, "view"), "page");
});

test("a selection no tab holds for leaves the tab where it is", () => {
    assert.equal(selectionOpensTab(TABS, PICKED_FRAME, allowing(), "shape"), null);
});
