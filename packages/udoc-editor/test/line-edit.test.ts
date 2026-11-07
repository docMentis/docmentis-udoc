/**
 * A change to a line: what it states replaces what the line has, and the rest is
 * carried, so changing a line's weight doesn't change its color.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { LineStyle, PaintFill, PaintLine } from "@docmentis/udoc-wasm";

import { changedDrawingLine, changedPortableLine, lineDashOfDrawing, lineDashOfPortable } from "../src/line-edit.ts";

const accent: PaintFill = { solid: { base: { scheme: "accent1" }, transforms: [{ shade: 0.15 }] } };
const fallback = {
    fill: { solid: { base: { sRgb: { r: 0, g: 0, b: 0 } }, transforms: [] } } as PaintFill,
    weight: 1,
    dash: "solid" as const,
};
const line: PaintLine = {
    width: 2,
    cap: "round",
    compound: null,
    align: null,
    fill: accent,
    dash: { preset: "dash" },
    join: "round",
    headEnd: null,
    tailEnd: { kind: "triangle", width: null, length: null },
};

test("a new weight keeps a line's color, dash and arrowhead", () => {
    const changed = changedDrawingLine(line, { weight: 6 }, fallback);
    assert.deepEqual(changed, { ...line, width: 6 });
});

test("a new dash keeps a line's color and weight", () => {
    const changed = changedDrawingLine(line, { dash: "dot" }, fallback);
    assert.deepEqual(changed, { ...line, dash: { preset: "dot" } });
});

test("a new color keeps a line's weight and dash", () => {
    const red: PaintFill = { solid: { base: { sRgb: { r: 255, g: 0, b: 0 } }, transforms: [] } };
    assert.deepEqual(changedDrawingLine(line, { fill: red }, fallback), { ...line, fill: red });
});

test("no line takes what the panel last set, and the change", () => {
    const changed = changedDrawingLine(null, { weight: 3 }, fallback);
    assert.equal(changed.width, 3);
    assert.deepEqual(changed.fill, fallback.fill);
    assert.deepEqual(changed.dash, { preset: "solid" });
});

test("a line painting nothing is turned on in the panel's color", () => {
    const changed = changedDrawingLine({ ...line, fill: "none" }, { weight: 3 }, fallback);
    assert.deepEqual(changed.fill, fallback.fill);
});

test("a line with no paint of its own keeps taking it from its style", () => {
    const changed = changedDrawingLine({ ...line, fill: null }, { weight: 3 }, fallback);
    assert.equal(changed.fill, null);
});

test("a drawing dash reads as one the panel offers", () => {
    assert.equal(lineDashOfDrawing(null), "solid");
    assert.equal(lineDashOfDrawing({ preset: "dot" }), "dot");
    assert.equal(lineDashOfDrawing({ preset: "largeDash" }), null);
    assert.equal(lineDashOfDrawing({ custom: [] }), null);
});

const pdfLine: LineStyle = {
    width: 2,
    lineCap: "butt",
    lineJoin: "bevel",
    miterLimit: 4,
    dashArray: [6, 6],
    dashOffset: 1,
};

test("a new weight on a PDF line scales its dashes and keeps the rest", () => {
    assert.deepEqual(changedPortableLine(pdfLine, { weight: 4 }, fallback), {
        ...pdfLine,
        width: 4,
        dashArray: [12, 12],
    });
});

test("a solid PDF line stays solid at a new weight", () => {
    const solid = { ...pdfLine, dashArray: null };
    assert.equal(changedPortableLine(solid, { weight: 4 }, fallback).dashArray, null);
});

test("a new dash on a PDF line sets its array at its weight, keeping its joins", () => {
    assert.deepEqual(changedPortableLine(pdfLine, { dash: "dot" }, fallback), {
        ...pdfLine,
        lineCap: "round",
        dashArray: [2, 4],
    });
});

test("a PDF side with no line takes what the panel last set", () => {
    const changed = changedPortableLine(null, { weight: 3 }, fallback);
    assert.equal(changed.width, 3);
    assert.equal(changed.dashArray, null);
});

test("a PDF dash reads as one the panel offers, at the line's weight", () => {
    assert.equal(lineDashOfPortable({ ...pdfLine, dashArray: null }), "solid");
    assert.equal(lineDashOfPortable(pdfLine), "dash");
    assert.equal(lineDashOfPortable({ ...pdfLine, dashArray: [2, 4] }), "dot");
    assert.equal(lineDashOfPortable({ ...pdfLine, dashArray: [6, 4, 2, 4] }), "dashDot");
    assert.equal(lineDashOfPortable({ ...pdfLine, dashArray: [5, 1] }), null);
});
