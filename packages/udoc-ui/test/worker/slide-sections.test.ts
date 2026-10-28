/**
 * A deck's sections as the thumbnails group its slides: each the run of the
 * slide order it holds, an empty one where the one before it ends.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { slideSectionRuns } from "../../src/worker/slide-sections.ts";

const SLIDES = ["a", "b", "c", "d", "e"];

test("each section is the run of slides it holds", () => {
    const runs = slideSectionRuns(
        [
            { id: "s1", name: "Intro", slideIds: ["a", "b"] },
            { id: "s2", name: "Body", slideIds: ["c", "d", "e"] },
        ],
        SLIDES,
    );
    assert.deepEqual(runs, [
        { id: "s1", name: "Intro", start: 0, count: 2 },
        { id: "s2", name: "Body", start: 2, count: 3 },
    ]);
});

test("an empty section sits where the one before it ends, the first at the start", () => {
    const runs = slideSectionRuns(
        [
            { id: "s1", name: "First", slideIds: [] },
            { id: "s2", name: "Body", slideIds: ["a", "b", "c"] },
            { id: "s3", name: "Empty", slideIds: [] },
            { id: "s4", name: "End", slideIds: ["d", "e"] },
            { id: "s5", name: "Last", slideIds: [] },
        ],
        SLIDES,
    );
    assert.deepEqual(
        runs.map(({ start, count }) => [start, count]),
        [
            [0, 0],
            [0, 3],
            [3, 0],
            [3, 2],
            [5, 0],
        ],
    );
});

test("a slide the deck doesn't list is left out", () => {
    const runs = slideSectionRuns([{ id: "s1", name: "All", slideIds: ["x", "a", "b"] }], SLIDES);
    assert.deepEqual(runs, [{ id: "s1", name: "All", start: 0, count: 2 }]);
});
