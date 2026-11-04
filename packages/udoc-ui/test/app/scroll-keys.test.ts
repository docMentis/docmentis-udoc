/**
 * The keys that move through a document: what each does to the view, and who
 * keeps it instead — a workbook's grid, a live caret, a shortcut.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { scrollKeyAction } from "../../src/app/scroll-keys.ts";
import type { ScrollKey } from "../../src/app/scroll-keys.ts";

function key(name: string, mods: Partial<Omit<ScrollKey, "key">> = {}): ScrollKey {
    return { key: name, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...mods };
}

const reading = { grid: false, typing: false };
const grid = { grid: true, typing: false };
const typing = { grid: false, typing: true };

test("an arrow scrolls a line along its axis", () => {
    const line = (axis: "x" | "y", by: 1 | -1) => ({ kind: "scroll", axis, step: "line", by });
    assert.deepEqual(scrollKeyAction(key("ArrowDown"), reading), line("y", 1));
    assert.deepEqual(scrollKeyAction(key("ArrowUp"), reading), line("y", -1));
    assert.deepEqual(scrollKeyAction(key("ArrowRight"), reading), line("x", 1));
    assert.deepEqual(scrollKeyAction(key("ArrowLeft"), reading), line("x", -1));
});

test("the page keys and Space scroll a view's height, Shift with Space back", () => {
    const view = (by: 1 | -1) => ({ kind: "scroll", axis: "y", step: "view", by });
    assert.deepEqual(scrollKeyAction(key("PageDown"), reading), view(1));
    assert.deepEqual(scrollKeyAction(key("PageUp"), reading), view(-1));
    assert.deepEqual(scrollKeyAction(key(" "), reading), view(1));
    assert.deepEqual(scrollKeyAction(key(" ", { shiftKey: true }), reading), view(-1));
});

test("Home and End go to the first and the last page", () => {
    assert.deepEqual(scrollKeyAction(key("Home"), reading), { kind: "edge", page: "first" });
    assert.deepEqual(scrollKeyAction(key("End"), reading), { kind: "edge", page: "last" });
});

test("a workbook's grid and a live caret keep all but the page keys", () => {
    for (const context of [grid, typing]) {
        for (const name of ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End", " "]) {
            assert.equal(scrollKeyAction(key(name), context), null, `${name} is the document's`);
        }
        assert.deepEqual(scrollKeyAction(key("PageDown"), context), {
            kind: "scroll",
            axis: "y",
            step: "view",
            by: 1,
        });
    }
});

test("a key with a modifier is a shortcut, and Shift only turns Space back", () => {
    for (const name of ["ArrowDown", "PageDown", "Home", " "]) {
        for (const mod of ["ctrlKey", "metaKey", "altKey"] as const) {
            assert.equal(scrollKeyAction(key(name, { [mod]: true }), reading), null, `${mod} with ${name}`);
        }
    }
    for (const name of ["ArrowDown", "PageDown", "Home", "End"]) {
        assert.equal(scrollKeyAction(key(name, { shiftKey: true }), reading), null, `Shift with ${name}`);
    }
});

test("any other key is left alone", () => {
    for (const name of ["a", "Enter", "Tab", "Escape", "Delete"]) {
        assert.equal(scrollKeyAction(key(name), reading), null, name);
    }
});
