/**
 * The shapes the Insert tab draws over an image: a box across the drag, a line
 * running the way it was dragged, an arrow's head where it ended, and an
 * outline weight that reads at the page's size.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Shape, ShapeNode } from "@docmentis/udoc-wasm";

import { markupLineWeight, markupShape, markupTextSize } from "../src/markup.ts";

/** A page of a screenshot's size, in points. */
const PAGE = { width: 1440, height: 810 };

/** The shape `node` is. */
function shapeOf(node: ShapeNode): Shape {
    assert.ok("shape" in node);
    return node.shape;
}

test("a rectangle spans the drag, unflipped, outlined and unfilled", () => {
    const shape = shapeOf(markupShape("1-1", "1-2", "rectangle", { x: 110, y: 70 }, { x: 10, y: 20 }, PAGE));
    assert.equal(shape.id, "1-1");
    assert.deepEqual(shape.properties.transform, {
        offset: { x: 10, y: 20 },
        extents: { width: 100, height: 50 },
        rotation: 0,
        flipH: false,
        flipV: false,
    });
    assert.deepEqual(shape.properties.geometry, { preset: { preset: "rect", adjustValues: [] } });
    assert.equal(shape.properties.fill, "none");
    assert.equal(shape.properties.line?.width, 3);
    assert.deepEqual(shape.properties.line?.fill, {
        solid: { base: { sRgb: { r: 0xe5, g: 0x39, b: 0x35 } }, transforms: [] },
    });
    assert.equal(shape.properties.line?.tailEnd, null);
    assert.equal(shape.style, null);
});

test("a box takes a label: an empty paragraph, centred, in the outline's color", () => {
    const box = shapeOf(markupShape("1-1", "1-2", "ellipse", { x: 10, y: 20 }, { x: 110, y: 70 }, PAGE));
    assert.equal(box.textBody?.story.id, "1-2");
    assert.equal(box.textBody?.properties.anchor, "center");
    const [block] = box.textBody?.story.blocks ?? [];
    assert.ok(block && "paragraph" in block);
    assert.deepEqual(block.paragraph.spans, []);
    assert.deepEqual(block.paragraph.properties, [{ align: "center" }]);
    assert.deepEqual(block.paragraph.end, { mark: [{ size: 27 }, { fill: box.properties.line?.fill }] });

    const line = shapeOf(markupShape("1-3", "1-4", "line", { x: 10, y: 20 }, { x: 110, y: 70 }, PAGE));
    assert.equal(line.textBody, null);
});

test("a line runs the way it was dragged, an arrow's head where it ended", () => {
    const line = shapeOf(markupShape("1-2", "1-3", "line", { x: 10, y: 70 }, { x: 110, y: 20 }, PAGE));
    assert.equal(line.properties.transform?.flipH, false);
    assert.equal(line.properties.transform?.flipV, true);
    assert.deepEqual(line.properties.geometry, { preset: { preset: "line", adjustValues: [] } });

    const arrow = shapeOf(markupShape("1-4", "1-5", "arrow", { x: 110, y: 20 }, { x: 10, y: 70 }, PAGE));
    assert.equal(arrow.properties.transform?.flipH, true);
    assert.equal(arrow.properties.transform?.flipV, false);
    assert.deepEqual(arrow.properties.line?.tailEnd, { kind: "triangle", width: "medium", length: "medium" });
    assert.equal(arrow.properties.line?.headEnd, null);
});

test("the outline and a label grow with the page's shorter side, from a least", () => {
    assert.equal(markupLineWeight(400, 300), 2);
    assert.equal(markupLineWeight(1440, 810), 3);
    assert.equal(markupLineWeight(4000, 3000), 12);
    assert.equal(markupTextSize(400, 300), 12);
    assert.equal(markupTextSize(1440, 810), 27);
    assert.equal(markupTextSize(4000, 3000), 100);
});
