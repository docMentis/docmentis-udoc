/**
 * The pages on screen, as `visiblePages` lists them and `"visiblePages:changed"`
 * reports them: of the views a frame carries, the span between the first and
 * last page on screen, those whose box overlaps the window, each with how much
 * of its area the window shows.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { pagesOnScreen } from "../src/geometry.ts";
import type { PageView } from "../src/geometry.ts";

const page = (index: number, x: number, y: number, width = 600, height = 800): PageView => ({
    index,
    x,
    y,
    width,
    height,
    rotation: 0,
});

const pages = (views: PageView[], width: number, height: number): number[] =>
    pagesOnScreen(views, width, height).map((shown) => shown.page);

test("gives each page of one column on screen the share of it that shows", () => {
    // A window 1000 × 900 over pages 3, 4 and 5: the bottom 200 px of 3, all
    // of 4, the top 100 px of 5.
    const views = [page(3, 200, -600), page(4, 200, 0), page(5, 200, 800)];
    assert.deepEqual(pagesOnScreen(views, 1000, 900), [
        { page: 3, visibleRatio: 0.25 },
        { page: 4, visibleRatio: 1 },
        { page: 5, visibleRatio: 0.125 },
    ]);
});

test("counts what shows across as well as down", () => {
    // Zoomed in on a page wider and taller than the window: a quarter of it
    // across and a half of it down shows.
    assert.deepEqual(pagesOnScreen([page(0, -300, -400, 1600, 1800)], 400, 900), [{ page: 0, visibleRatio: 0.125 }]);
});

test("lists the pages ascending, whatever order the views come in", () => {
    const views = [page(7, 0, 400), page(5, 0, -600), page(6, 0, -100)];
    assert.deepEqual(pages(views, 1000, 900), [5, 6, 7]);
});

test("leaves out the column scrolled off of two pages side by side", () => {
    // Zoomed in on the right column: pages 2 and 4 are on screen, 3 sits
    // between them in the span but off to the left.
    const views = [page(2, 100, -500), page(3, -1300, 320), page(4, 100, 320)];
    assert.deepEqual(pages(views, 1000, 900), [2, 4]);
});

test("counts a page that shows a sliver", () => {
    // Half a pixel of an 800 px page shows.
    assert.deepEqual(pagesOnScreen([page(0, 0, 899.5)], 1000, 900), [{ page: 0, visibleRatio: 0.5 / 800 }]);
    assert.deepEqual(pages([page(0, -599.5, 0)], 1000, 900), [0]);
});

test("leaves out a page that only touches the window's edge", () => {
    assert.deepEqual(pages([page(0, 0, 900)], 1000, 900), []);
    assert.deepEqual(pages([page(0, 1000, 0)], 1000, 900), []);
    assert.deepEqual(pages([page(0, 0, -800)], 1000, 900), []);
    assert.deepEqual(pages([page(0, -600, 0)], 1000, 900), []);
});

test("leaves out a page under the strip kept for a scrollbar", () => {
    // The window is the canvas less the strip, so a page that starts inside the
    // strip is past the window's right edge.
    assert.deepEqual(pages([page(0, 990, 0)], 1000 - 12, 900), []);
});

test("lists none with no views, no window or a page with no area", () => {
    assert.deepEqual(pagesOnScreen([], 1000, 900), []);
    assert.deepEqual(pagesOnScreen([page(0, 0, 0)], 0, 0), []);
    assert.deepEqual(pagesOnScreen([page(0, 10, 10, 0, 800)], 1000, 900), []);
});
