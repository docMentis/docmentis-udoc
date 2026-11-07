/**
 * A drawing paint's opacity: read through its alpha transforms as the engine
 * resolves them, and set in place of them, leaving the color itself alone.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { PaintColor, PaintFill } from "@docmentis/udoc-wasm";

import { colorOpacity, fillOpacity, fillWithOpacity, withOpacity } from "../src/opacity.ts";

const accent: PaintColor = { base: { scheme: "accent1" }, transforms: [{ shade: 0.15 }] };

test("a color with no alpha transform is opaque", () => {
    assert.equal(colorOpacity(accent), 1);
});

test("alpha transforms read in order, as the engine applies them", () => {
    const color: PaintColor = {
        base: { scheme: "accent1" },
        transforms: [{ alpha: 0.5 }, { alphaMod: 0.5 }, { alphaOff: 0.1 }],
    };
    assert.ok(Math.abs(colorOpacity(color) - 0.35) < 1e-9);
});

test("opacity keeps within 0 to 1", () => {
    assert.equal(colorOpacity({ base: { scheme: "accent1" }, transforms: [{ alphaOff: 0.5 }] }), 1);
    assert.equal(colorOpacity({ base: { scheme: "accent1" }, transforms: [{ alpha: 0.2 }, { alphaOff: -0.5 }] }), 0);
});

test("setting opacity keeps the color's own transforms", () => {
    assert.deepEqual(withOpacity(accent, 0.5), {
        base: { scheme: "accent1" },
        transforms: [{ shade: 0.15 }, { alpha: 0.5 }],
    });
});

test("setting opacity replaces the alpha transforms a color had", () => {
    const color: PaintColor = { base: { scheme: "accent1" }, transforms: [{ alpha: 0.9 }, { alphaMod: 0.5 }] };
    assert.deepEqual(withOpacity(color, 0.25).transforms, [{ alpha: 0.25 }]);
});

test("opaque states no alpha transform", () => {
    const color: PaintColor = { base: { scheme: "accent1" }, transforms: [{ shade: 0.15 }, { alpha: 0.5 }] };
    assert.deepEqual(withOpacity(color, 1).transforms, [{ shade: 0.15 }]);
});

test("only a solid fill has an opacity to read", () => {
    assert.equal(fillOpacity({ solid: withOpacity(accent, 0.75) }), 0.75);
    assert.equal(fillOpacity("none"), null);
    assert.equal(fillOpacity("group"), null);
    assert.equal(fillOpacity({ gradient: {} } as unknown as PaintFill), null);
});

test("a fill with no one color is left as it is", () => {
    assert.equal(fillWithOpacity("none", 0.5), "none");
    const gradient = { gradient: {} } as unknown as PaintFill;
    assert.equal(fillWithOpacity(gradient, 0.5), gradient);
});
