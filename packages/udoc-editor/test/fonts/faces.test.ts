/**
 * Which faces a font change has to be loaded in.
 *
 * The rule that matters is the mixed one: a selection with a bold word in it
 * will render in two binaries, so loading only the face the ribbon's B button
 * shows leaves the other to arrive on its own — the reflow the preload exists to
 * avoid, just smaller.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { facesToLoad } from "../../src/fonts/faces.ts";

test("a uniform selection needs one face", () => {
    assert.deepEqual(facesToLoad("off", "off"), [[false, false]]);
    assert.deepEqual(facesToLoad("on", "off"), [[true, false]]);
    assert.deepEqual(facesToLoad("off", "on"), [[false, true]]);
    assert.deepEqual(facesToLoad("on", "on"), [[true, true]]);
});

test("a mixed axis needs both of its faces", () => {
    // The paragraph-with-a-bold-word case.
    assert.deepEqual(facesToLoad("mixed", "off"), [
        [false, false],
        [true, false],
    ]);
    assert.deepEqual(facesToLoad("off", "mixed"), [
        [false, false],
        [false, true],
    ]);
});

test("both axes mixed asks for all four", () => {
    // Deliberately an over-approximation: a selection mixed on both axes need
    // not contain all four combinations. Narrowing it would take a new engine
    // read of the distinct faces, and being wrong costs one extra font — the
    // same one that would have been fetched had the selection spanned it.
    assert.deepEqual(facesToLoad("mixed", "mixed"), [
        [false, false],
        [false, true],
        [true, false],
        [true, true],
    ]);
});

test("every face is asked for once", () => {
    for (const bold of ["on", "off", "mixed"] as const) {
        for (const italic of ["on", "off", "mixed"] as const) {
            const faces = facesToLoad(bold, italic);
            assert.ok(faces.length > 0, `${bold}/${italic} asks for something`);
            const distinct = new Set(faces.map(([b, i]) => `${b}${i}`));
            assert.equal(distinct.size, faces.length, `${bold}/${italic} repeats a face`);
        }
    }
});
