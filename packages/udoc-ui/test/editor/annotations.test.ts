/**
 * The Annotate tab's annotations: that a drawn one's rect takes in all it
 * inks, and a restyle keeps it so; that a restyle reaches only the annotations
 * whose appearance the change shows in, and writes only the entry it edits;
 * what the Format controls show and act on; which annotations the comment
 * popup shows, and when it is open; and what colour a text box and a stamp
 * take.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type {
    Annotation,
    FreeTextAnnotation,
    Rect,
    StampIcon,
    TextAnnotation,
    TextMarkupAnnotation,
} from "@docmentis/udoc-wasm";

import {
    annotationFor,
    annotationFormat,
    annotationStyle,
    commentThreads,
    markupFor,
    markupOf,
    commentOpen,
    parsePdfDate,
    restyled,
    selectedComment,
} from "../../src/app/annotations.ts";
import type { Comment } from "../../src/app/annotations.ts";
import type { UIState } from "../../src/app/state.ts";
import type { PageComments } from "../../src/worker/protocol.ts";

const NOW = new Date(2026, 8, 26, 12, 0, 0);
const BLUE = { components: [0, 0, 1], colorSpace: "deviceRgb" as const };

const contains = (outer: Rect, inner: Rect) =>
    outer.x0 <= inner.x0 && outer.y0 <= inner.y0 && outer.x1 >= inner.x1 && outer.y1 >= inner.y1;

/** `tool` drawn through `points` in its default style. */
/** The font list id a drawn text box sets its text in. */
const HELVETICA = "helvetica-id";

function drawn(
    tool: Parameters<typeof annotationFor>[0],
    points: { x: number; y: number }[],
    stamp?: StampIcon,
): Annotation {
    const annotation = annotationFor(tool, points, annotationStyle(tool, {}), "Walter", NOW, stamp, HELVETICA);
    assert.ok(annotation);
    return annotation;
}

/** The editor state the Format controls read: what is armed, and what is selected. */
function state(
    partial: Pick<UIState, "pointerMode" | "selectedAnnotations"> & Partial<Pick<UIState, "commentPopup" | "comments">>,
): UIState {
    return { annotationStyles: {}, commentPopup: null, comments: new Map(), ...partial } as UIState;
}

test("a line's rect grows to take in the arrowheads a restyle gives it, and a wider pen's ink", () => {
    const line = drawn("line", [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
    ]);
    const closed = restyled(
        restyled(line, { kind: "lineEnding", end: "start", ending: "closedArrow" }, NOW)!,
        { kind: "lineEnding", end: "end", ending: "closedArrow" },
        NOW,
    )!;
    // A closed arrowhead's wings reach 4.5 widths across the line at the default
    // two points wide.
    assert.ok(closed.rect.y0 <= 100 - 9 && closed.rect.y1 >= 100 + 9, "the wings are inside the rect");
    assert.ok(contains(closed.rect, line.rect));

    const ink = drawn("pen", [
        { x: 0, y: 0 },
        { x: 50, y: 20 },
    ]);
    const wide = restyled(ink, { kind: "width", width: 6 }, NOW)!;
    assert.ok(wide.rect.x0 <= -3 && wide.rect.y1 >= 23, "a round cap three points out is inside the rect");
});

test("a polygon's sharp join reaches past its corner by its miter, inside the rect", () => {
    // A 20° spike at (100, 0): its miter, 1 / sin(10°) ≈ 5.8 half-widths long,
    // is within the limit of ten, so it is drawn.
    const spike = drawn("polygon", [
        { x: 0, y: -18 },
        { x: 100, y: 0 },
        { x: 0, y: 18 },
    ]);
    assert.ok(spike.rect.x1 >= 100 + 5.7, "the miter tip is inside the rect");
});

test("a markup's quads run along the text's upper edge first, and its rect takes in a highlight's round ends", () => {
    // One run of text 100 points long and 12 high, set at (50, 200) on the page.
    const run = {
        page: 0,
        rect: { x0: 0, y0: 0, x1: 100, y1: 12 },
        transform: { scaleX: 1, skewY: 0, skewX: 0, scaleY: 1, translateX: 50, translateY: 200 },
    };
    const highlight = markupFor("highlight", [run], annotationStyle("highlight", {}), null, NOW)!;
    const { quadPoints } = (highlight.kind as { highlight: TextMarkupAnnotation }).highlight;
    // Upper left, upper right, lower left, lower right — y grows down the page.
    assert.deepEqual(quadPoints, [
        [
            { x: 50, y: 200 },
            { x: 150, y: 200 },
            { x: 50, y: 212 },
            { x: 150, y: 212 },
        ],
    ]);
    // The ends bulge a quarter of the height — three points — past the run.
    assert.ok(highlight.rect.x0 <= 50 - 3 && highlight.rect.x1 >= 150 + 3);
    assert.equal(highlight.borderStyle, null, "a markup is drawn with no line of its own");
    assert.deepEqual(highlight.color, { components: [1, 1, 0], colorSpace: "deviceRgb" }, "yellow");
});

test("a restyle reaches only annotations its change shows in, and writes only what it edits", () => {
    const square = drawn("rectangle", [
        { x: 0, y: 0 },
        { x: 40, y: 30 },
    ]);
    const ink = drawn("pen", [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
    ]);
    const link = {
        ...square,
        kind: { link: { action: null, destination: null, highlight: null, uriAction: null, quadPoints: null } },
    } as Annotation;

    assert.equal(
        restyled(link, { kind: "color", color: BLUE }, NOW),
        null,
        "a link's appearance isn't generated from /C",
    );
    assert.equal(restyled(ink, { kind: "fill", color: BLUE }, NOW), null, "ink has nothing to fill");

    const filled = restyled(square, { kind: "fill", color: BLUE }, NOW)!;
    assert.deepEqual((filled.kind as { square: { interiorColor: unknown } }).square.interiorColor, BLUE);
    assert.equal(filled.appearance, null, "the engine generates it afresh");
    assert.deepEqual(filled.rect, square.rect, "a fill doesn't move a square's rect");

    // A colour change on one carrying the pre-/BS /Border leaves it at that.
    const bordered = {
        ...square,
        borderStyle: null,
        border: { horizontalRadius: 0, verticalRadius: 0, width: 3, dash: null },
    };
    const recolored = restyled(bordered, { kind: "color", color: BLUE }, NOW)!;
    assert.equal(recolored.borderStyle, null);
    assert.deepEqual(recolored.border, bordered.border);
});

test("a width change keeps the line's dash, scaled to the new width", () => {
    const square = drawn("rectangle", [
        { x: 0, y: 0 },
        { x: 40, y: 30 },
    ]);
    const dotted = restyled(square, { kind: "dash", dash: "dot" }, NOW)!;
    const wider = restyled(dotted, { kind: "width", width: 4 }, NOW)!;
    assert.deepEqual(wider.borderStyle, { width: 4, style: "dashed", dash: [4, 8] });
});

test("the Format controls show what the selection agrees on, and only what it takes", () => {
    const red = drawn("rectangle", [
        { x: 0, y: 0 },
        { x: 40, y: 30 },
    ]);
    const blue = restyled(red, { kind: "color", color: BLUE }, NOW)!;
    const ink = drawn("pen", [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
    ]);
    const format = annotationFormat(
        state({
            pointerMode: { kind: "select" },
            selectedAnnotations: { page: "p", index: 0, annotations: [red, blue, ink], richContents: ["", "", ""] },
        }),
    )!;
    assert.deepEqual(format.color, { kind: "mixed" });
    assert.deepEqual(format.fill, { kind: "none" }, "the squares agree on no fill; the ink takes none");
    assert.deepEqual(format.line, { width: 2, dash: "solid" });
    assert.equal(format.lineEnds, undefined, "nothing selected has line ends");
});

test("an armed tool, not the selection, is what the Format controls act on", () => {
    const square = drawn("rectangle", [
        { x: 0, y: 0 },
        { x: 40, y: 30 },
    ]);
    const format = annotationFormat(
        state({
            pointerMode: { kind: "place", tool: { kind: "annotation", tool: "arrow" }, sticky: false },
            selectedAnnotations: { page: "p", index: 0, annotations: [square], richContents: [""] },
        }),
    )!;
    assert.deepEqual(format.lineEnds, { start: "none", end: "openArrow" }, "the arrow tool's own ends");
    assert.equal(format.fill, undefined, "a line takes no fill");
    assert.equal(annotationFormat(state({ pointerMode: { kind: "select" }, selectedAnnotations: null })), null);
});

test("the comment popup shows a lone markup annotation, save a sound and a free text, with its rich contents", () => {
    const note = drawn("note", [{ x: 100, y: 100 }]);
    const square = drawn("rectangle", [
        { x: 0, y: 0 },
        { x: 40, y: 30 },
    ]);
    const selecting = (annotations: Annotation[]) =>
        selectedComment(
            state({
                pointerMode: { kind: "select" },
                selectedAnnotations: {
                    page: "p",
                    index: 2,
                    annotations,
                    richContents: annotations.map(() => "<body/>"),
                },
            }),
        );
    assert.deepEqual(selecting([note]), {
        page: "p",
        index: 2,
        annotation: note,
        thread: {
            page: "p",
            index: 2,
            annotation: note,
            richContents: "<body/>",
            reviews: [],
            marked: false,
            replies: [],
        },
    });
    assert.equal(selecting([square])?.annotation, square, "a square is a comment too");
    assert.equal(selecting([note, square]), null, "two at once have no one popup");

    const markup = (note.kind as { text: { markup: unknown } }).text.markup;
    const sound = { ...note, kind: { sound: { markup, icon: null } } } as unknown as Annotation;
    assert.equal(selecting([sound]), null, "a sound has no popup");
    const textBox = drawn("textBox", [
        { x: 10, y: 20 },
        { x: 130, y: 100 },
    ]);
    assert.equal(selecting([textBox]), null, "a free text's text is edited in its box");
    const link = { ...note, kind: { link: {} } } as unknown as Annotation;
    assert.equal(selecting([link]), null, "a link isn't a markup annotation");
});

test("a text box's text takes the tool's colour and leaves it unfilled; a stamp is the one picked, in the tool's colour", () => {
    const textBox = drawn("textBox", [
        { x: 10, y: 20 },
        { x: 130, y: 100 },
    ]);
    assert.deepEqual(textBox.rect, { x0: 10, y0: 20, x1: 130, y1: 100 });
    const appearance = (textBox.kind as { freeText: FreeTextAnnotation }).freeText.defaultAppearance;
    assert.equal(appearance?.textStyle.font, HELVETICA, "its text in the font it was given");
    assert.deepEqual(
        appearance?.nonstrokingStyle.brush,
        { solid: { components: [1, 0, 0], colorSpace: "deviceRgb" } },
        "its text in the default red",
    );
    assert.equal(textBox.color, null, "/C would fill its box");

    const stamp = drawn("stamp", [{ x: 300, y: 400 }], "confidential");
    assert.deepEqual((stamp.kind as { stamp: { icon: StampIcon } }).stamp.icon, "confidential");
    const { x0, y0, x1, y1 } = stamp.rect;
    assert.deepEqual([(x0 + x1) / 2, (y0 + y1) / 2], [300, 400], "centred where it is dropped");
    assert.deepEqual(stamp.color, { components: [1, 0, 0], colorSpace: "deviceRgb" }, "/C in the default red");
});

test("a note's popup is open until its button closes it, any other comment's closed until it opens it", () => {
    const note = { ...drawn("note", [{ x: 100, y: 100 }]), id: "note" };
    const square = {
        ...drawn("rectangle", [
            { x: 0, y: 0 },
            { x: 40, y: 30 },
        ]),
        id: "square",
    };
    const open = (annotation: Annotation, commentPopup: UIState["commentPopup"]) => {
        const s = state({
            pointerMode: { kind: "select" },
            selectedAnnotations: { page: "p", index: 0, annotations: [annotation], richContents: [""] },
            commentPopup,
        });
        return commentOpen(s, selectedComment(s)!);
    };
    assert.equal(open(note, null), true, "a note's icon shows nothing of its text");
    assert.equal(open(square, null), false);
    assert.equal(open(note, { id: "note", open: false }), false);
    assert.equal(open(square, { id: "square", open: true }), true);
    assert.equal(open(square, { id: "note", open: true }), false, "another annotation's button doesn't open it");
});

/** A note by `author`, made at `created`, answering `irt` as `rt` — or a state
 *  note setting `state` in `model` — for a page of comments. */
function note(
    id: string,
    author: string,
    created: string,
    irt: string | null = null,
    extra: { rt?: "reply" | "group"; state?: string; model?: string } = {},
): Annotation {
    const base = drawn("note", [{ x: 100, y: 100 }]);
    const text = (base.kind as { text: TextAnnotation }).text;
    return {
        ...base,
        id,
        kind: {
            text: {
                ...text,
                markup: { ...text.markup, author, created, inReplyTo: irt, replyType: extra.rt ?? null },
                state: extra.state ?? null,
                stateModel: extra.model ?? null,
            },
        },
    } as unknown as Annotation;
}

/** `annotation` made a caret, keeping its markup entries. */
const caretOf = (annotation: Annotation): Annotation =>
    ({
        ...annotation,
        kind: { caret: { markup: markupOf(annotation), rectDifferences: null, symbol: null } },
    }) as unknown as Annotation;

/** The ids of `threads`, each with its replies', as nested arrays. */
const shape = (threads: readonly Comment[]): unknown[] =>
    threads.map((c) => (c.replies.length ? [c.annotation.id, shape(c.replies)] : c.annotation.id));

test("a page's comments thread as Acrobat lists them: replies under what they answer, groups and states on their comment", () => {
    // Shaped on the ISO 32000-2 errata file Acrobat wrote: a caret with a
    // strikeout grouped under it (a replace-text edit), a chain of one
    // reviewer's states, replies, and what isn't a comment at all.
    const caret = caretOf(note("caret", "Issue #149", "D:20240429120000+2'00'"));
    const strike = { ...note("strike", "Issue #149", "D:20240429120000+2'00'", "caret", { rt: "group" }) };
    const link = { ...note("link", "", ""), kind: { link: {} } } as unknown as Annotation;
    const annotations: Annotation[] = [
        note("editor", "PDF Association", "D:20240429120000+2'00'"),
        // A reviewer's states: Completed, then — answering that one — Accepted.
        note("completed", "PDF Association", "D:20240429120000+2'00'", "editor", {
            state: "Completed",
            model: "Review",
        }),
        note("accepted", "PDF Association", "D:20240429120000+2'00'", "completed", {
            state: "Accepted",
            model: "Review",
        }),
        note("nothing", "Walter", "D:20240501000000Z", "editor", { state: "None", model: "Review" }),
        note("marked", "Walter", "D:20240501000000Z", "editor", { state: "Marked", model: "Marked" }),
        // Replies, listed out of the order they were made — one written in UT
        // at 09:00, one at 10:00+02'00' (08:00 UT) — and a reply to a reply.
        note("later", "Walter", "D:20240501090000Z", "editor"),
        note("earlier", "Ann", "D:20240501100000+02'00'", "editor"),
        note("nested", "Ann", "D:20240502000000Z", "later"),
        caret,
        strike,
        // A reply to the strikeout answers the group, whose primary is the caret.
        note("on-strike", "Walter", "D:20240503000000Z", "strike"),
        // One answering what isn't on the page, and two answering each other.
        note("orphan", "Walter", "D:20240504000000Z", "elsewhere"),
        note("loop-a", "Walter", "D:20240505000000Z", "loop-b"),
        note("loop-b", "Walter", "D:20240505000000Z", "loop-a"),
        link,
    ];
    const page: PageComments = {
        page: "p",
        index: 4,
        annotations,
        richContents: annotations.map((a) => `<body>${a.id}</body>`),
    };
    const threads = commentThreads(page);

    assert.deepEqual(shape(threads), [
        ["editor", ["earlier", ["later", ["nested"]]]],
        ["caret", ["on-strike"]],
        "orphan",
        "loop-a",
        "loop-b",
    ]);
    const [editor] = threads;
    assert.deepEqual(
        editor?.reviews,
        [{ author: "PDF Association", state: "Accepted" }],
        "the last of the chain; None isn't shown",
    );
    assert.equal(editor?.marked, true);
    assert.equal(editor?.richContents, "<body>editor</body>");
    assert.equal(threads[1]?.marked, false);
    assert.equal(commentThreads(page), threads, "read once per read of the page");
    assert.equal(parsePdfDate("D:20240429120000+2'00'")?.toISOString(), "2024-04-29T10:00:00.000Z");
});

test("the popup shows the whole thread of what is selected — a group member its primary's", () => {
    const caret = caretOf(note("caret", "Ann", "D:20240429120000Z"));
    const strike = note("strike", "Ann", "D:20240429120000Z", "caret", { rt: "group" });
    const reply = note("reply", "Walter", "D:20240430120000Z", "caret");
    const annotations = [caret, strike, reply];
    const page: PageComments = { page: "p", index: 0, annotations, richContents: annotations.map(() => "") };
    const shown = selectedComment(
        state({
            pointerMode: { kind: "select" },
            selectedAnnotations: { page: "p", index: 0, annotations: [strike], richContents: [""] },
            comments: new Map([["p", page]]),
        }),
    );
    assert.equal(shown?.annotation, strike, "the popup sits by what is selected");
    assert.deepEqual(shape(shown ? [shown.thread] : []), [["caret", ["reply"]]]);
});
