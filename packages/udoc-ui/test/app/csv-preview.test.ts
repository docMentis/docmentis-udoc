/**
 * A CSV's first lines as the delimiter dialog shows them: as written, short of
 * a line its sample cuts.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { csvPreviewLines } from "../../src/app/source.ts";

const bytes = (text: string) => new TextEncoder().encode(text);

test("a CSV's lines show as written, whatever breaks them", () => {
    assert.deepEqual(csvPreviewLines(bytes("a;b\r\nc;d\ne;f\rg;h")), ["a;b", "c;d", "e;f", "g;h"]);
    // The last line break ends a line rather than starting one.
    assert.deepEqual(csvPreviewLines(bytes("a;b\r\n")), ["a;b"]);
    assert.deepEqual(csvPreviewLines(bytes("")), []);
});

test("a byte order mark isn't shown", () => {
    assert.deepEqual(csvPreviewLines(new Uint8Array([0xef, 0xbb, 0xbf, ...bytes("a;b")])), ["a;b"]);
});

test("only the first lines show", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `${i};x`);
    assert.deepEqual(csvPreviewLines(bytes(lines.join("\n"))), lines.slice(0, 8));
});

test("the line a long file's sample cuts doesn't show, unless it is the only one", () => {
    assert.deepEqual(csvPreviewLines(bytes(`a;b\n${"c".repeat(5000)}`)), ["a;b"]);
    assert.equal(csvPreviewLines(bytes("c".repeat(5000)))[0]!.length, 4096);
});
