/**
 * Insert Table's grid: the table a cell stands for, and the cells a size lights.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { inSize, PICKER_COLUMNS, PICKER_ROWS, pickedSize } from "../src/table-picker.ts";

test("a cell stands for the table reaching it, counted from one", () => {
    assert.deepEqual(pickedSize(0, 0), { rows: 1, columns: 1 });
    assert.deepEqual(pickedSize(2, 3), { rows: 3, columns: 4 });
    assert.deepEqual(pickedSize(PICKER_ROWS - 1, PICKER_COLUMNS - 1), { rows: 8, columns: 10 });
});

test("a size lights the cells up to it and left of it, and none past either edge", () => {
    const size = pickedSize(2, 3);
    assert.ok(inSize(size, 0, 0));
    assert.ok(inSize(size, 2, 3), "its own corner");
    assert.ok(!inSize(size, 3, 3), "a row below");
    assert.ok(!inSize(size, 2, 4), "a column right");
});

test("nothing pointed at lights nothing", () => {
    assert.ok(!inSize(null, 0, 0));
});
