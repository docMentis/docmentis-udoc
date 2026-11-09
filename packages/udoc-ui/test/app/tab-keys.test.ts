/**
 * What Tab does at a text caret: on through a table's cells, or a tab typed —
 * and with a modifier, a tab typed in a cell too.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { tabKeyAction } from "../../src/app/tab-keys.ts";
import type { TabKeyPress } from "../../src/app/tab-keys.ts";

function key(name: string, mods: Partial<Omit<TabKeyPress, "key">> = {}): TabKeyPress {
    return { key: name, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...mods };
}

const inCell = { inTable: true, typing: true };
const inCells = { inTable: true, typing: false };
const inText = { inTable: false, typing: true };
const nowhere = { inTable: false, typing: false };

test("in a table, Tab steps on through the cells and Shift+Tab back", () => {
    assert.equal(tabKeyAction(key("Tab"), inCell), "nextCell");
    assert.equal(tabKeyAction(key("Tab", { shiftKey: true }), inCell), "previousCell");
    assert.equal(tabKeyAction(key("Tab"), inCells), "nextCell", "a block of cells steps too");
});

test("Ctrl+Tab or Option/Alt+Tab types a tab in a cell", () => {
    assert.equal(tabKeyAction(key("Tab", { ctrlKey: true }), inCell), "insertTab");
    assert.equal(tabKeyAction(key("Tab", { altKey: true }), inCell), "insertTab");
    assert.equal(tabKeyAction(key("Tab", { altKey: true }), inCells), null, "nowhere to type it");
});

test("in text, Tab types a tab and Shift+Tab is kept", () => {
    assert.equal(tabKeyAction(key("Tab"), inText), "insertTab");
    assert.equal(tabKeyAction(key("Tab", { shiftKey: true }), inText), "none");
});

test("what is no Tab of the document's is left to the page", () => {
    assert.equal(tabKeyAction(key("Tab"), nowhere), null);
    assert.equal(tabKeyAction(key("Tab", { metaKey: true }), inCell), null, "Cmd+Tab is the system's");
    assert.equal(tabKeyAction(key("Enter"), inCell), null);
});
