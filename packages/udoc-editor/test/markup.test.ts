/**
 * The shapes the Insert tab draws over an image: a box across the drag, a line
 * running the way it was dragged, an arrow's heads where it ended — and began,
 * for a double arrow — and an outline weight that reads at the page's size.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Shape, ShapeNode } from "@docmentis/udoc-wasm";

import { markupLineWeight, markupShape, markupTextSize } from "../src/markup.ts";
import type { GalleryShape } from "../src/shape-gallery.ts";

/** A page of a screenshot's size, in points. */
const PAGE = { width: 1440, height: 810 };

/** The gallery's shapes these place, as it describes them. */
const GALLERY: Readonly<Record<string, GalleryShape>> = {
    rect: { preset: "rect", line: false, outline: false, arrows: null, name: "Rectangle", sketch: "rectangle" },
    roundRect: {
        preset: "roundRect",
        line: false,
        outline: false,
        arrows: null,
        name: "Rectangle: Rounded Corners",
        sketch: "rectangle",
    },
    ellipse: { preset: "ellipse", line: false, outline: false, arrows: null, name: "Oval", sketch: "ellipse" },
    star5: { preset: "star5", line: false, outline: false, arrows: null, name: "Star: 5 Points", sketch: "rectangle" },
    bracketPair: {
        preset: "bracketPair",
        line: false,
        outline: true,
        arrows: null,
        name: "Double Bracket",
        sketch: "rectangle",
    },
    line: { preset: "line", line: true, outline: false, arrows: null, name: "Line", sketch: "line" },
    lineArrow: {
        preset: "straightConnector1",
        line: true,
        outline: false,
        arrows: "end",
        name: "Line Arrow",
        sketch: "arrow",
    },
    bentConnector3DoubleArrow: {
        preset: "bentConnector3",
        line: true,
        outline: false,
        arrows: "both",
        name: "Connector: Elbow Double-Arrow",
        sketch: "arrow",
    },
    curvedConnector3DoubleArrow: {
        preset: "curvedConnector3",
        line: true,
        outline: false,
        arrows: "both",
        name: "Connector: Curved Double-Arrow",
        sketch: "arrow",
    },
};

/** The gallery shape `tool` places. */
function gallery(tool: string): GalleryShape {
    const shape = GALLERY[tool];
    assert.ok(shape, tool);
    return shape;
}

/** The shape `node` is. */
function shapeOf(node: ShapeNode): Shape {
    assert.ok("shape" in node);
    return node.shape;
}

test("a rectangle spans the drag, unflipped, outlined and unfilled", () => {
    const shape = shapeOf(markupShape("1-1", "1-2", gallery("rect"), { x: 110, y: 70 }, { x: 10, y: 20 }, PAGE));
    assert.equal(shape.id, "1-1");
    assert.equal(shape.nonVisual.name, "Rectangle");
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
    const box = shapeOf(markupShape("1-1", "1-2", gallery("ellipse"), { x: 10, y: 20 }, { x: 110, y: 70 }, PAGE));
    assert.equal(box.textBody?.story.id, "1-2");
    assert.equal(box.textBody?.properties.anchor, "center");
    const [block] = box.textBody?.story.blocks ?? [];
    assert.ok(block && "paragraph" in block);
    assert.deepEqual(block.paragraph.spans, []);
    assert.deepEqual(block.paragraph.properties, [{ align: "center" }]);
    assert.deepEqual(block.paragraph.end, { mark: [{ size: 27 }, { fill: box.properties.line?.fill }] });

    const line = shapeOf(markupShape("1-3", "1-4", gallery("line"), { x: 10, y: 20 }, { x: 110, y: 70 }, PAGE));
    assert.equal(line.textBody, null);
});

test("a line runs the way it was dragged, an arrow's head where it ended", () => {
    const line = shapeOf(markupShape("1-2", "1-3", gallery("line"), { x: 10, y: 70 }, { x: 110, y: 20 }, PAGE));
    assert.equal(line.properties.transform?.flipH, false);
    assert.equal(line.properties.transform?.flipV, true);
    assert.deepEqual(line.properties.geometry, { preset: { preset: "line", adjustValues: [] } });

    const arrow = shapeOf(markupShape("1-4", "1-5", gallery("lineArrow"), { x: 110, y: 20 }, { x: 10, y: 70 }, PAGE));
    assert.equal(arrow.properties.transform?.flipH, true);
    assert.equal(arrow.properties.transform?.flipV, false);
    assert.deepEqual(arrow.properties.geometry, { preset: { preset: "straightConnector1", adjustValues: [] } });
    assert.deepEqual(arrow.properties.line?.tailEnd, { kind: "triangle", width: "medium", length: "medium" });
    assert.equal(arrow.properties.line?.headEnd, null);
    assert.equal(arrow.textBody, null);

    const both = shapeOf(
        markupShape("1-6", "1-7", gallery("bentConnector3DoubleArrow"), { x: 10, y: 20 }, { x: 110, y: 70 }, PAGE),
    );
    assert.deepEqual(both.properties.geometry, { preset: { preset: "bentConnector3", adjustValues: [] } });
    assert.deepEqual(both.properties.line?.headEnd, both.properties.line?.tailEnd);
});

test("any gallery shape but a line is a box across the drag, with a label", () => {
    const star = shapeOf(markupShape("1-1", "1-2", gallery("star5"), { x: 110, y: 70 }, { x: 10, y: 20 }, PAGE));
    assert.deepEqual(star.properties.geometry, { preset: { preset: "star5", adjustValues: [] } });
    assert.equal(star.properties.transform?.flipH, false);
    assert.equal(star.properties.transform?.flipV, false);
    assert.equal(star.properties.fill, "none");
    assert.equal(star.textBody?.story.id, "1-2");
    assert.equal(star.nonVisual.name, "Star: 5 Points");
});

test("the outline and a label grow with the page's shorter side, from a least", () => {
    assert.equal(markupLineWeight(400, 300), 2);
    assert.equal(markupLineWeight(1440, 810), 3);
    assert.equal(markupLineWeight(4000, 3000), 12);
    assert.equal(markupTextSize(400, 300), 12);
    assert.equal(markupTextSize(1440, 810), 27);
    assert.equal(markupTextSize(4000, 3000), 100);
});
