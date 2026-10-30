/**
 * Where a crop box's drag takes it — inside the page, no narrower than its
 * least, and to an aspect where one is kept.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { aspectRatio, dragged, fitRatio, wholePage } from "../src/crop-box.ts";

test("a preset aspect turns to the page's orientation", () => {
    assert.equal(aspectRatio("free", 400, 300), null);
    assert.equal(aspectRatio("original", 400, 300), 4 / 3);
    assert.equal(aspectRatio("16:9", 400, 300), 16 / 9);
    assert.equal(aspectRatio("4:3", 300, 400), 3 / 4);
    assert.equal(aspectRatio("square", 300, 400), 1);
});

test("the largest box of a ratio sits about the middle of the one it fits in", () => {
    assert.deepEqual(fitRatio({ x0: 0, y0: 0, x1: 400, y1: 300 }, 1), { x0: 50, y0: 0, x1: 350, y1: 300 });
    assert.deepEqual(fitRatio({ x0: 0, y0: 0, x1: 300, y1: 300 }, 3), { x0: 0, y0: 100, x1: 300, y1: 200 });
});

test("a moved box stays on the page", () => {
    const from = { x0: 100, y0: 100, x1: 200, y1: 150 };
    assert.deepEqual(dragged("move", from, 500, -500, 400, 300, 10, null), { x0: 300, y0: 0, x1: 400, y1: 50 });
});

test("a free corner follows the pointer, inside the page and no narrower than the least", () => {
    const from = { x0: 100, y0: 100, x1: 200, y1: 200 };
    assert.deepEqual(dragged("se", from, 50, 20, 400, 300, 10, null), { x0: 100, y0: 100, x1: 250, y1: 220 });
    assert.deepEqual(dragged("se", from, 500, 500, 400, 300, 10, null), { x0: 100, y0: 100, x1: 400, y1: 300 });
    assert.deepEqual(dragged("nw", from, 200, 0, 400, 300, 10, null), { x0: 190, y0: 100, x1: 200, y1: 200 });
});

test("a corner keeps the ratio against the corner across from it", () => {
    const from = { x0: 0, y0: 0, x1: 100, y1: 100 };
    assert.deepEqual(dragged("se", from, 100, 100, 400, 400, 10, 2), { x0: 0, y0: 0, x1: 200, y1: 100 });
    const held = { x0: 200, y0: 200, x1: 300, y1: 300 };
    assert.deepEqual(dragged("nw", held, -100, -100, 400, 400, 10, 1), { x0: 100, y0: 100, x1: 300, y1: 300 });
    // The page stops the side that reaches it, the other kept to the ratio.
    assert.deepEqual(dragged("se", from, 500, 500, 300, 300, 10, 2), { x0: 0, y0: 0, x1: 300, y1: 150 });
});

test("an edge keeps the ratio about the box's middle the other way", () => {
    const from = { x0: 100, y0: 100, x1: 200, y1: 200 };
    assert.deepEqual(dragged("e", from, 100, 0, 400, 400, 10, 1), { x0: 100, y0: 50, x1: 300, y1: 250 });
    assert.deepEqual(dragged("s", from, 0, 100, 400, 400, 10, 1), { x0: 50, y0: 100, x1: 250, y1: 300 });
    // No room to grow the other way about the middle: the box stays.
    const top = { x0: 100, y0: 0, x1: 200, y1: 100 };
    assert.deepEqual(dragged("e", top, 100, 0, 400, 400, 10, 1), top);
});

test("a box at the page's edges keeps the whole page", () => {
    assert.equal(wholePage({ x0: 0, y0: 0, x1: 1, y1: 1 }), true);
    assert.equal(wholePage({ x0: 0.00001, y0: 0, x1: 0.99999, y1: 1 }), true);
    assert.equal(wholePage({ x0: 0.01, y0: 0, x1: 1, y1: 1 }), false);
});
