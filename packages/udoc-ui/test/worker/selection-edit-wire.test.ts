/**
 * A selection edit as the engine takes it: the shell's flat, family-named edit
 * wrapped in whatever its doc type holds the family under, and named by
 * `family.kind` where the engine reports it allowed. The engine's facade tests
 * parse these same wire forms (`the_hosts_wire_forms_parse`).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { selectionEditKind, tableEdit } from "../../src/geometry.ts";
import { taggedSelectionEdit } from "../../src/worker/selection-edit-wire.ts";

test("a PDF holds its pages, objects and annotations by family, and its text inside an annotation", () => {
    assert.deepEqual(taggedSelectionEdit({ family: "page", kind: "deletePages" }, "portable"), {
        portable: { page: { edit: "deletePages" } },
    });
    assert.deepEqual(taggedSelectionEdit({ family: "object", kind: "translateObjects", dx: 1, dy: 2 }, "portable"), {
        portable: { object: { edit: { translateObjects: { dx: 1, dy: 2 } } } },
    });
    assert.deepEqual(taggedSelectionEdit({ family: "annotation", kind: "deleteAnnotations" }, "portable"), {
        portable: { annotation: { edit: "deleteAnnotations" } },
    });
    assert.deepEqual(taggedSelectionEdit({ family: "text", kind: "insertText", text: "x" }, "portable"), {
        portable: { annotation: { edit: { common: { edit: { text: { insertText: { text: "x" } } } } } } },
    });
});

test("an image holds its pages and its drawing families by struct variants", () => {
    assert.deepEqual(taggedSelectionEdit({ family: "page", kind: "rotatePages", clockwise: true }, "image"), {
        image: { page: { edit: { rotatePages: { clockwise: true } } } },
    });
    assert.deepEqual(taggedSelectionEdit({ family: "shape", kind: "deleteShapes" }, "image"), {
        image: { common: { edit: { shape: "deleteShapes" } } },
    });
});

test("a deck holds its slides, sections and drawing families by newtypes, a comment bare", () => {
    assert.deepEqual(taggedSelectionEdit({ family: "slide", kind: "reorderSlides", to: 2 }, "presentation"), {
        presentation: { slide: { reorderSlides: { to: 2 } } },
    });
    assert.deepEqual(taggedSelectionEdit({ family: "slideSection", kind: "deleteSlideSections" }, "presentation"), {
        presentation: { slideSection: "deleteSlideSections" },
    });
    assert.deepEqual(
        taggedSelectionEdit({ family: "table", kind: "createRows", before: false, count: 1 }, "presentation"),
        { presentation: { common: { table: { createRows: { before: false, count: 1 } } } } },
    );
});

test("a word document holds its section and its drawing families by newtypes", () => {
    assert.deepEqual(
        taggedSelectionEdit({ family: "section", kind: "patchSectionPageMargins", left: 72 }, "wordprocessing"),
        { wordprocessing: { section: { patchSectionPageMargins: { left: 72 } } } },
    );
    assert.deepEqual(taggedSelectionEdit({ family: "text", kind: "deleteText", forward: true }, "wordprocessing"), {
        wordprocessing: { common: { text: { deleteText: { forward: true } } } },
    });
});

test("a workbook holds its worksheet edits by a struct variant, and its own bare", () => {
    assert.deepEqual(taggedSelectionEdit({ family: "worksheet", kind: "createRows", before: true }, "spreadsheet"), {
        spreadsheet: { worksheet: { edit: { createRows: { before: true } } } },
    });
    assert.deepEqual(taggedSelectionEdit({ family: "worksheet", kind: "cancelCut" }, "spreadsheet"), {
        spreadsheet: { worksheet: { edit: "cancelCut" } },
    });
    assert.deepEqual(taggedSelectionEdit({ kind: "createWorksheet", before: false }, "spreadsheet"), {
        spreadsheet: { createWorksheet: { before: false } },
    });
});

test("a family the doc type doesn't hold is refused before it reaches the engine", () => {
    assert.throws(
        () => taggedSelectionEdit({ family: "text", kind: "deleteText", forward: true }, "spreadsheet"),
        /takes no text edit/,
    );
});

test("an edit's capability name is its family and kind, the table's and the worksheet's apart", () => {
    assert.equal(
        selectionEditKind({ family: "table", kind: "createRows", before: true, count: 1 }),
        "table.createRows",
    );
    assert.equal(selectionEditKind({ family: "worksheet", kind: "createRows", before: true }), "worksheet.createRows");
    assert.equal(selectionEditKind({ kind: "createWorksheet", before: true }), "createWorksheet");
});

test("a table edit in the engine's own form flattens to a family-named one", () => {
    assert.deepEqual(tableEdit({ createRows: { before: true, count: 1 } }), {
        family: "table",
        kind: "createRows",
        before: true,
        count: 1,
    });
    assert.deepEqual(tableEdit("deleteRows"), { family: "table", kind: "deleteRows" });
});
