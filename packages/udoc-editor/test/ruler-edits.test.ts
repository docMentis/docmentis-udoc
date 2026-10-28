/**
 * What a drop on the ruler sends: the edit each control's move means to each
 * doc type, read off the guide and the selection's values, and whether the
 * control takes a drag at all.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Guide } from "@docmentis/udoc-wasm";
import type { SelectionCapabilities } from "@docmentis/udoc-ui/internal";

import { EMPTY_SELECTION_RULER, rulerEdit, rulerMovable } from "../src/ruler-edits.ts";
import type { SelectionRuler } from "../src/ruler-edits.ts";

type RulerGuide = Extract<Guide, { type: "ruler" }>;

/** A Letter page with 1" margins, the rulers' zero at the text area's corner. */
const GUIDE: RulerGuide = {
    type: "ruler",
    horizontal: { origin: 100, page: { start: -72, end: 540 }, margins: { start: 0, end: 468 } },
    vertical: { origin: 50, page: { start: -72, end: 720 }, margins: { start: 0, end: 648 } },
    text: { firstLine: 18, left: 0, right: 468, tabs: [{ position: 425, alignment: "right" }], defaultTab: 36 },
};

/** A paragraph indented 18pt on its first line, with a cleared stop and a
 *  dot-leader right stop, in a shape with the default insets. */
const RULER: SelectionRuler = {
    indentLeft: 0,
    indentRight: 0,
    indentFirstLine: 18,
    tabStops: [
        { position: 36, alignment: "clear", leader: "none" },
        { position: 425, alignment: "right", leader: "dot" },
    ],
    insetLeft: 7.2,
    insetTop: 3.6,
    insetRight: 7.2,
    insetBottom: 3.6,
};

function caps(...allowed: string[]): SelectionCapabilities {
    return { count: 1, copyable: false, allowed };
}

test("each indent marker moves the indents Word's does", () => {
    const indent = (indent: "firstLine" | "hanging" | "left" | "right", by: number) =>
        rulerEdit({ control: { kind: "indent", indent }, by }, GUIDE, "wordprocessing", RULER);
    assert.deepEqual(indent("firstLine", 9), {
        kind: "setParagraphProperties",
        properties: [{ indentFirstLine: 27 }],
    });
    // The hanging indent's lines move; the first line stays where it was.
    assert.deepEqual(indent("hanging", 9), {
        kind: "setParagraphProperties",
        properties: [{ indentLeft: 9 }, { indentFirstLine: 9 }],
    });
    assert.deepEqual(indent("left", 9), { kind: "setParagraphProperties", properties: [{ indentLeft: 9 }] });
    // The right indent is measured in from the right: moving it right lessens it.
    assert.deepEqual(indent("right", 9), { kind: "setParagraphProperties", properties: [{ indentRight: -9 }] });
});

test("a moved Word tab stop is cleared where it stood; a slide's is not", () => {
    const tab = { kind: "tab", index: 0 } as const;
    assert.deepEqual(rulerEdit({ control: tab, by: -25 }, GUIDE, "wordprocessing", RULER), {
        kind: "setParagraphProperties",
        properties: [
            {
                tabStops: [
                    { position: 36, alignment: "clear", leader: "none" },
                    { position: 400, alignment: "right", leader: "dot" },
                    { position: 425, alignment: "clear", leader: "none" },
                ],
            },
        ],
    });
    assert.deepEqual(rulerEdit({ control: tab, by: -25 }, GUIDE, "presentation", RULER), {
        kind: "setParagraphProperties",
        properties: [
            {
                tabStops: [
                    { position: 36, alignment: "clear", leader: "none" },
                    { position: 400, alignment: "right", leader: "dot" },
                ],
            },
        ],
    });
});

test("a Word margin edge sets the section's page margin on its side", () => {
    const margin = (edge: "left" | "top" | "right" | "bottom", by: number) =>
        rulerEdit({ control: { kind: "margin", edge }, by }, GUIDE, "wordprocessing", RULER);
    assert.deepEqual(margin("left", 18), { kind: "setSectionPageMargins", left: 90 });
    assert.deepEqual(margin("right", -18), { kind: "setSectionPageMargins", right: 90 });
    assert.deepEqual(margin("top", 9), { kind: "setSectionPageMargins", top: 81 });
    assert.deepEqual(margin("bottom", 9), { kind: "setSectionPageMargins", bottom: 63 });
});

test("a slide's margin edge sets its shape's text inset", () => {
    const margin = (edge: "left" | "right", by: number) =>
        rulerEdit({ control: { kind: "margin", edge }, by }, GUIDE, "presentation", RULER);
    assert.deepEqual(margin("left", 3.6), {
        kind: "setShapeTextBodyProperties",
        properties: { insetLeft: 7.2 + 3.6 },
    });
    assert.deepEqual(margin("right", 3.6), {
        kind: "setShapeTextBodyProperties",
        properties: { insetRight: 7.2 - 3.6 },
    });
});

test("a PDF margin edge sets the box's side in page-local points, but not its bottom", () => {
    const margin = (edge: "left" | "bottom", by: number) =>
        rulerEdit({ control: { kind: "margin", edge }, by }, GUIDE, "portable", EMPTY_SELECTION_RULER);
    assert.deepEqual(margin("left", 10), {
        kind: "object",
        edit: { kind: "resizeTextBox", frame: { x0: 82, y0: 72, x1: 540, y1: 720 } },
    });
    assert.equal(margin("bottom", 10), null, "the box's height follows its lines");
});

test("a control moves only where its edit is gated on and its values agree", () => {
    const left = { kind: "indent", indent: "left" } as const;
    const edge = { kind: "margin", edge: "left" } as const;
    assert.ok(rulerMovable(left, GUIDE, "wordprocessing", caps("setParagraphProperties"), RULER));
    assert.ok(!rulerMovable(left, GUIDE, "wordprocessing", caps(), RULER), "gated off");
    assert.ok(
        !rulerMovable(left, GUIDE, "wordprocessing", caps("setParagraphProperties"), {
            ...RULER,
            indentLeft: null,
        }),
        "the paragraphs disagree",
    );
    assert.ok(rulerMovable(edge, GUIDE, "wordprocessing", caps("setSectionPageMargins"), RULER));
    assert.ok(rulerMovable(edge, GUIDE, "presentation", caps("setShapeTextBodyProperties"), RULER));
    assert.ok(rulerMovable(edge, GUIDE, "portable", caps("resizeTextBox"), EMPTY_SELECTION_RULER));
    assert.ok(!rulerMovable(edge, GUIDE, "portable", caps("setSectionPageMargins"), EMPTY_SELECTION_RULER));
});
