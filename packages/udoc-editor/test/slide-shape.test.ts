/**
 * The shapes the Insert tab places on a slide: a shape across the drag, styled
 * from the theme with an empty text body to type into; a line a connector
 * running the way it was dragged, its arrowheads its only outline of its own.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Shape, ShapeConnector, ShapeNode } from "@docmentis/udoc-wasm";

import type { GalleryShape } from "../src/shape-gallery.ts";
import { slideShape } from "../src/slide-shape.ts";

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

/** The connector `node` is. */
function connectorOf(node: ShapeNode): ShapeConnector {
    assert.ok("connector" in node);
    return node.connector;
}

test("a shape spans the drag, unflipped, filled and outlined from the theme", () => {
    const shape = shapeOf(slideShape("1-1", "1-2", gallery("roundRect"), { x: 300, y: 200 }, { x: 100, y: 50 }));
    assert.equal(shape.id, "1-1");
    assert.equal(shape.nonVisual.name, "Rectangle: Rounded Corners");
    assert.deepEqual(shape.properties.transform, {
        offset: { x: 100, y: 50 },
        extents: { width: 200, height: 150 },
        rotation: 0,
        flipH: false,
        flipV: false,
    });
    assert.deepEqual(shape.properties.geometry, { preset: { preset: "roundRect", adjustValues: [] } });
    assert.equal(shape.properties.fill, null);
    assert.equal(shape.properties.line, null);
    assert.deepEqual(shape.style?.fillRef, { index: 1, color: { base: { scheme: "accent1" }, transforms: [] } });
    assert.deepEqual(shape.style?.lineRef, {
        index: 2,
        color: { base: { scheme: "accent1" }, transforms: [{ shade: 0.15 }] },
    });
    assert.deepEqual(shape.style?.fontRef, { index: "minor", color: { base: { scheme: "light1" }, transforms: [] } });
});

test("a shape holds an empty paragraph, centred both ways", () => {
    const shape = shapeOf(slideShape("1-1", "1-2", gallery("ellipse"), { x: 10, y: 20 }, { x: 110, y: 70 }));
    assert.equal(shape.textBody?.story.id, "1-2");
    assert.equal(shape.textBody?.properties.anchor, "center");
    const [block] = shape.textBody?.story.blocks ?? [];
    assert.ok(block && "paragraph" in block);
    assert.deepEqual(block.paragraph.spans, []);
    assert.deepEqual(block.paragraph.properties, { props: [{ align: "center" }] });
});

test("an arc or a bracket is styled as a line is, and still holds text", () => {
    const bracket = shapeOf(slideShape("1-1", "1-2", gallery("bracketPair"), { x: 10, y: 20 }, { x: 110, y: 70 }));
    assert.equal(bracket.style?.lineRef.index, 1);
    assert.equal(bracket.style?.fillRef.index, 0);
    assert.deepEqual(bracket.style?.fontRef.color, { base: { scheme: "text1" }, transforms: [] });
    assert.equal(bracket.textBody?.story.id, "1-2");
});

test("a line is a connector running the way it was dragged", () => {
    const line = connectorOf(slideShape("1-1", "1-2", gallery("line"), { x: 110, y: 20 }, { x: 10, y: 70 }));
    assert.equal(line.properties.transform?.flipH, true);
    assert.equal(line.properties.transform?.flipV, false);
    assert.deepEqual(line.properties.geometry, { preset: { preset: "line", adjustValues: [] } });
    assert.equal(line.properties.line, null);
    assert.equal(line.style?.lineRef.index, 1);
    assert.equal(line.startConnection, null);
    assert.equal(line.endConnection, null);
});

test("an arrowed line carries its heads alone, the rest from its style", () => {
    const arrow = connectorOf(slideShape("1-1", "1-2", gallery("lineArrow"), { x: 10, y: 70 }, { x: 110, y: 20 }));
    assert.deepEqual(arrow.properties.geometry, { preset: { preset: "straightConnector1", adjustValues: [] } });
    assert.equal(arrow.properties.transform?.flipV, true);
    assert.deepEqual(arrow.properties.line?.tailEnd, { kind: "triangle", width: null, length: null });
    assert.equal(arrow.properties.line?.headEnd, null);
    assert.equal(arrow.properties.line?.width, null);
    assert.equal(arrow.properties.line?.fill, null);

    const both = connectorOf(
        slideShape("1-3", "1-4", gallery("curvedConnector3DoubleArrow"), { x: 10, y: 20 }, { x: 110, y: 70 }),
    );
    assert.deepEqual(both.properties.geometry, { preset: { preset: "curvedConnector3", adjustValues: [] } });
    assert.deepEqual(both.properties.line?.headEnd, both.properties.line?.tailEnd);
});
