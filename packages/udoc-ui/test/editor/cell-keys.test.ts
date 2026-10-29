/**
 * A workbook's keys: what a key pressed on the grid does with no cell being
 * typed into, and while one is in Enter or Edit mode.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { cellKeyAction } from "../../src/app/cell-keys.ts";
import type { CellKey } from "../../src/app/cell-keys.ts";

function key(name: string, mods: Partial<Omit<CellKey, "key">> = {}): CellKey {
    return { key: name, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...mods };
}

test("an arrow moves the active cell, Shift extends the block, Ctrl or Cmd jumps", () => {
    assert.deepEqual(cellKeyAction(key("ArrowDown"), null, false), { kind: "move", movement: "down", extend: false });
    assert.deepEqual(cellKeyAction(key("ArrowLeft", { shiftKey: true }), null, true), {
        kind: "move",
        movement: "left",
        extend: true,
    });
    assert.deepEqual(cellKeyAction(key("ArrowRight", { metaKey: true }), null, true), {
        kind: "move",
        movement: "rightEnd",
        extend: false,
    });
});

test("Enter and Tab step, Shift back, in view mode too", () => {
    assert.deepEqual(cellKeyAction(key("Enter"), null, false), { kind: "move", movement: "down", extend: false });
    assert.deepEqual(cellKeyAction(key("Tab", { shiftKey: true }), null, false), {
        kind: "move",
        movement: "left",
        extend: false,
    });
});

test("F2, Backspace and Delete edit only in edit mode", () => {
    assert.deepEqual(cellKeyAction(key("F2"), null, true), { kind: "begin", mode: "edit", text: null });
    assert.deepEqual(cellKeyAction(key("Backspace"), null, true), { kind: "begin", mode: "enter", text: "" });
    assert.deepEqual(cellKeyAction(key("Delete"), null, true), { kind: "clear" });
    for (const name of ["F2", "Backspace", "Delete"]) assert.equal(cellKeyAction(key(name), null, false), null);
});

test("a shortcut and a typed character are left to the rest", () => {
    assert.equal(cellKeyAction(key("z", { metaKey: true }), null, true), null);
    assert.equal(cellKeyAction(key("a"), null, true), null);
    assert.equal(cellKeyAction(key("a"), "enter", true), null);
});

test("while typing, Enter saves and steps, Ctrl or Cmd fills, Alt breaks the line", () => {
    assert.deepEqual(cellKeyAction(key("Enter"), "edit", true), { kind: "commit", fill: false, then: "down" });
    assert.deepEqual(cellKeyAction(key("Enter", { shiftKey: true }), "enter", true), {
        kind: "commit",
        fill: false,
        then: "up",
    });
    assert.deepEqual(cellKeyAction(key("Enter", { ctrlKey: true }), "enter", true), {
        kind: "commit",
        fill: true,
        then: null,
    });
    assert.deepEqual(cellKeyAction(key("Enter", { altKey: true }), "edit", true), { kind: "lineBreak" });
    assert.deepEqual(cellKeyAction(key("Tab"), "edit", true), { kind: "commit", fill: false, then: "right" });
});

test("while typing, Escape drops it and F2 switches the mode", () => {
    assert.deepEqual(cellKeyAction(key("Escape"), "enter", true), { kind: "cancel" });
    assert.deepEqual(cellKeyAction(key("F2"), "edit", true), { kind: "switchMode" });
});

test("an arrow saves and moves in Enter mode, and moves the caret in Edit mode", () => {
    assert.deepEqual(cellKeyAction(key("ArrowUp"), "enter", true), { kind: "commit", fill: false, then: "up" });
    assert.equal(cellKeyAction(key("ArrowUp"), "edit", true), null);
    assert.equal(cellKeyAction(key("Backspace"), "enter", true), null);
});
