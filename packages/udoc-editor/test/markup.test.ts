/**
 * The shapes the Image tab draws over an image: a box across the drag, a line
 * running the way it was dragged, an arrow's heads where it ended — and began,
 * for a double arrow — and an outline weight that reads at the page's size.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { PaintColor, PaintFill, Shape, ShapeNode } from "@docmentis/udoc-wasm";

import { markupLineWeight, markupShape, markupTextBox, markupTextSize } from "../src/markup.ts";
import type { MarkupPaint } from "../src/markup.ts";
import type { GalleryShape } from "../src/shape-gallery.ts";

/** A page of a screenshot's size, in points. */
const PAGE = { width: 1440, height: 810 };

/** The gallery's shapes these place, as it describes them. */
const GALLERY: Readonly<Record<string, GalleryShape>> = {
    rect: { preset: "rect", line: false, outline: false, arrows: null, name: "Rectangle" },
    roundRect: {
        preset: "roundRect",
        line: false,
        outline: false,
        arrows: null,
        name: "Rectangle: Rounded Corners",
    },
    ellipse: { preset: "ellipse", line: false, outline: false, arrows: null, name: "Oval" },
    star5: { preset: "star5", line: false, outline: false, arrows: null, name: "Star: 5 Points" },
    bracketPair: {
        preset: "bracketPair",
        line: false,
        outline: true,
        arrows: null,
        name: "Double Bracket",
    },
    line: { preset: "line", line: true, outline: false, arrows: null, name: "Line" },
    lineArrow: {
        preset: "straightConnector1",
        line: true,
        outline: false,
        arrows: "end",
        name: "Line Arrow",
    },
    bentConnector3DoubleArrow: {
        preset: "bentConnector3",
        line: true,
        outline: false,
        arrows: "both",
        name: "Connector: Elbow Double-Arrow",
    },
    curvedConnector3DoubleArrow: {
        preset: "curvedConnector3",
        line: true,
        outline: false,
        arrows: "both",
        name: "Connector: Curved Double-Arrow",
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

const FILL: PaintFill = { solid: { base: { sRgb: { r: 1, g: 2, b: 3 } }, transforms: [{ alpha: 0.5 }] } };
const LINE: PaintFill = { solid: { base: { sRgb: { r: 4, g: 5, b: 6 } }, transforms: [] } };
const TEXT: PaintColor = { base: { sRgb: { r: 7, g: 8, b: 9 } }, transforms: [] };
const PAINT: MarkupPaint = { fill: FILL, line: LINE, text: TEXT };

test("a rectangle spans the drag, unflipped, in the paint it's given", () => {
    const shape = shapeOf(markupShape("1-1", "1-2", gallery("rect"), { x: 110, y: 70 }, { x: 10, y: 20 }, PAGE, PAINT));
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
    assert.deepEqual(shape.properties.fill, FILL);
    assert.equal(shape.properties.line?.width, 3);
    assert.deepEqual(shape.properties.line?.fill, LINE);
    assert.equal(shape.properties.line?.tailEnd, null);
    assert.equal(shape.style, null);
});

test("a box takes a label: an empty paragraph, centred, in the text's color", () => {
    const box = shapeOf(
        markupShape("1-1", "1-2", gallery("ellipse"), { x: 10, y: 20 }, { x: 110, y: 70 }, PAGE, PAINT),
    );
    assert.equal(box.textBody?.story.id, "1-2");
    assert.equal(box.textBody?.properties.anchor, "center");
    const [block] = box.textBody?.story.blocks ?? [];
    assert.ok(block && "paragraph" in block);
    assert.deepEqual(block.paragraph.spans, []);
    assert.deepEqual(block.paragraph.properties, { props: [{ align: "center" }] });
    assert.deepEqual(block.paragraph.end, {
        mark: { properties: { props: [{ size: 27 }, { fill: { solid: TEXT } }] } },
    });

    const line = shapeOf(markupShape("1-3", "1-4", gallery("line"), { x: 10, y: 20 }, { x: 110, y: 70 }, PAGE, PAINT));
    assert.equal(line.textBody, null);
});

test("a line runs the way it was dragged, an arrow's head where it ended", () => {
    const line = shapeOf(markupShape("1-2", "1-3", gallery("line"), { x: 10, y: 70 }, { x: 110, y: 20 }, PAGE, PAINT));
    assert.equal(line.properties.transform?.flipH, false);
    assert.equal(line.properties.transform?.flipV, true);
    assert.deepEqual(line.properties.geometry, { preset: { preset: "line", adjustValues: [] } });

    const arrow = shapeOf(
        markupShape("1-4", "1-5", gallery("lineArrow"), { x: 110, y: 20 }, { x: 10, y: 70 }, PAGE, PAINT),
    );
    assert.equal(arrow.properties.transform?.flipH, true);
    assert.equal(arrow.properties.transform?.flipV, false);
    assert.deepEqual(arrow.properties.geometry, { preset: { preset: "straightConnector1", adjustValues: [] } });
    assert.deepEqual(arrow.properties.line?.tailEnd, { kind: "triangle", width: "medium", length: "medium" });
    assert.equal(arrow.properties.line?.headEnd, null);
    assert.equal(arrow.textBody, null);

    const both = shapeOf(
        markupShape(
            "1-6",
            "1-7",
            gallery("bentConnector3DoubleArrow"),
            { x: 10, y: 20 },
            { x: 110, y: 70 },
            PAGE,
            PAINT,
        ),
    );
    assert.deepEqual(both.properties.geometry, { preset: { preset: "bentConnector3", adjustValues: [] } });
    assert.deepEqual(both.properties.line?.headEnd, both.properties.line?.tailEnd);
});

test("any gallery shape but a line is a box across the drag, with a label", () => {
    const star = shapeOf(markupShape("1-1", "1-2", gallery("star5"), { x: 110, y: 70 }, { x: 10, y: 20 }, PAGE, PAINT));
    assert.deepEqual(star.properties.geometry, { preset: { preset: "star5", adjustValues: [] } });
    assert.equal(star.properties.transform?.flipH, false);
    assert.equal(star.properties.transform?.flipV, false);
    assert.deepEqual(star.properties.fill, FILL);
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

test("a line and an open outline take no fill, whatever fill is given", () => {
    const a = { x: 10, y: 20 };
    const b = { x: 110, y: 70 };
    assert.equal(shapeOf(markupShape("1-1", "1-2", gallery("line"), a, b, PAGE, PAINT)).properties.fill, "none");
    const outline = { ...gallery("rect"), outline: true };
    assert.equal(shapeOf(markupShape("1-1", "1-2", outline, a, b, PAGE, PAINT)).properties.fill, "none");
});

test("a text box is in the color it's given, with no fill or outline", () => {
    const box = shapeOf(markupTextBox("1-1", "1-2", "Text", { x: 10, y: 20 }, { x: 410, y: 270 }, PAGE, TEXT));
    assert.equal(box.properties.fill, "none");
    assert.equal(box.properties.line, null);
    const [block] = box.textBody?.story.blocks ?? [];
    assert.ok(block && "paragraph" in block);
    assert.deepEqual(block.paragraph.end, {
        mark: { properties: { props: [{ size: 27 }, { fill: { solid: TEXT } }] } },
    });
});
