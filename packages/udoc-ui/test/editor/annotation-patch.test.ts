/**
 * How a host's patch merges into an annotation: a field it gives replaces the
 * annotation's and an object merges, all the way down; an array is replaced
 * whole; `undefined` leaves a field and `null` clears it; the id and name stay
 * the annotation's; and a kind of another subtype replaces the kind whole.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Annotation } from "@docmentis/udoc-wasm";

import { applyAnnotationPatch } from "../../src/app/annotation-patch.ts";

const highlight = {
    id: "a1",
    rect: { x0: 100, y0: 100, x1: 300, y1: 120 },
    contents: "Important",
    name: "note-1",
    modified: null,
    flags: { print: true },
    color: { components: [1, 1, 0], colorSpace: "deviceRgb" },
    border: null,
    borderStyle: null,
    appearance: null,
    optionalContent: null,
    kind: {
        highlight: {
            markup: { author: "Alice", subject: "Review", opacity: 0.5 },
            quadPoints: [
                [
                    { x: 100, y: 100 },
                    { x: 300, y: 100 },
                    { x: 100, y: 120 },
                    { x: 300, y: 120 },
                ],
            ],
        },
    },
} as unknown as Annotation;

test("a patch replaces what it gives, merges objects all the way down, and keeps the rest", () => {
    const patched = applyAnnotationPatch(highlight, {
        color: { components: [0, 1, 0] },
        contents: null,
        modified: undefined,
        kind: { highlight: { markup: { author: "Bob" } } },
    });
    assert.deepEqual(patched, {
        ...highlight,
        color: { components: [0, 1, 0], colorSpace: "deviceRgb" },
        contents: null,
        kind: {
            highlight: {
                markup: { author: "Bob", subject: "Review", opacity: 0.5 },
                quadPoints: (highlight.kind as { highlight: { quadPoints: unknown } }).highlight.quadPoints,
            },
        },
    });
});

test("an array is replaced whole, and the id and name stay the annotation's", () => {
    const quad = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
    ] as const;
    const patched = applyAnnotationPatch(highlight, {
        id: "other",
        name: "other",
        kind: { highlight: { quadPoints: [[...quad]] } },
    });
    assert.equal(patched.id, "a1");
    assert.equal(patched.name, "note-1");
    assert.deepEqual((patched.kind as { highlight: { quadPoints: unknown } }).highlight.quadPoints, [[...quad]]);
});

test("a kind of another subtype replaces the kind whole", () => {
    const square = { square: { markup: {}, interiorColor: null, borderEffect: null, rectDifferences: null } };
    const patched = applyAnnotationPatch(highlight, { kind: square as Annotation["kind"] });
    assert.deepEqual(patched.kind, square);
});
