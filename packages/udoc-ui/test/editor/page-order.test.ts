/**
 * Where a drag drops the selected pages: `to` is the index the first of them
 * takes once they land as one run in document order, and a drop that leaves a
 * run where it is moves nothing.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { reorderTo } from "../../src/app/page-order.ts";

/** `pages` after moving `selected` to `to`, as the engine reorders them. */
function reorder(pages: readonly number[], selected: readonly number[], to: number): number[] {
    const rest = pages.filter((page) => !selected.includes(page));
    const run = pages.filter((page) => selected.includes(page));
    return [...rest.slice(0, to), ...run, ...rest.slice(to)];
}

const PAGES = [0, 1, 2, 3, 4];

test("one page moves up, down and to either end", () => {
    assert.equal(reorderTo([2], 0), 0);
    assert.equal(reorderTo([2], 1), 1);
    assert.equal(reorderTo([2], 4), 3);
    assert.equal(reorderTo([2], 5), 4);
    assert.deepEqual(reorder(PAGES, [2], reorderTo([2], 4)!), [0, 1, 3, 2, 4]);
});

test("a drop beside the pages, or inside their run, moves nothing", () => {
    assert.equal(reorderTo([2], 2), null);
    assert.equal(reorderTo([2], 3), null);
    assert.equal(reorderTo([1, 2, 3], 1), null);
    assert.equal(reorderTo([1, 2, 3], 2), null);
    assert.equal(reorderTo([1, 2, 3], 4), null);
    assert.equal(reorderTo([], 0), null);
});

test("pages apart are gathered into one run at the gap", () => {
    assert.equal(reorderTo([1, 3], 2), 1);
    assert.deepEqual(reorder(PAGES, [1, 3], 1), [0, 1, 3, 2, 4]);
    // Inside the span but not one run: still a move.
    assert.equal(reorderTo([0, 4], 2), 1);
    assert.deepEqual(reorder(PAGES, [0, 4], 1), [1, 0, 4, 2, 3]);
    assert.deepEqual(reorder(PAGES, [1, 3], reorderTo([1, 3], 5)!), [0, 2, 4, 1, 3]);
});

test("the selection's order doesn't matter", () => {
    assert.equal(reorderTo([3, 1], 0), 0);
    assert.equal(reorderTo([3, 1], 5), 3);
});

test("a drop into another section moves the pages even beside them", () => {
    assert.equal(reorderTo([2], 3), null);
    assert.equal(reorderTo([2], 3, true), 2);
    assert.equal(reorderTo([2], 2, true), 2);
    assert.equal(reorderTo([2, 3], 4, true), 2);
});
