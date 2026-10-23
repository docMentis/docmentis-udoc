/**
 * What the command line decides before any engine is involved: pages count
 * from 1, the output is named after the input unless given, and anything that
 * can't be run is a usage error rather than a failure halfway through.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { UsageError, parseInvocation } from "../src/args.ts";

test("render defaults to page 1 at scale 1, named after the input", () => {
    assert.deepEqual(parseInvocation(["render", "docs/Quarterly Report.pptx"]), {
        command: "render",
        input: "docs/Quarterly Report.pptx",
        page: 1,
        scale: 1,
        out: "Quarterly Report_page_1.png",
    });
});

test("the page names the default output, and --out overrides it", () => {
    assert.deepEqual(parseInvocation(["render", "a.pdf", "--page", "3", "--scale", "2"]), {
        command: "render",
        input: "a.pdf",
        page: 3,
        scale: 2,
        out: "a_page_3.png",
    });
    assert.deepEqual(parseInvocation(["render", "a.pdf", "-p", "3", "-o", "x.png"]), {
        command: "render",
        input: "a.pdf",
        page: 3,
        scale: 1,
        out: "x.png",
    });
});

test("save writes the format its output's extension names", () => {
    assert.deepEqual(parseInvocation(["save", "a.pdf", "--out", "b.PDF"]), {
        command: "save",
        input: "a.pdf",
        out: "b.PDF",
        format: "pdf",
    });
    assert.equal((parseInvocation(["save", "a.pptx", "-o", "a.udoc"]) as { format: string }).format, "udoc");
    assert.equal((parseInvocation(["save", "a.jpeg", "-o", "b.jpeg"]) as { format: string }).format, "jpg");
});

test("page-count takes the one document it counts", () => {
    assert.deepEqual(parseInvocation(["page-count", "a.pdf"]), { command: "page-count", input: "a.pdf" });
});

test("what can't be run is a usage error", () => {
    for (const argv of [
        [],
        ["print", "a.pdf"],
        ["render"],
        ["render", "a.pdf", "b.pdf"],
        ["render", "a.pdf", "--page", "0"],
        ["render", "a.pdf", "--page", "1.5"],
        ["render", "a.pdf", "--scale", "0"],
        ["render", "a.pdf", "--scale", "big"],
        ["render", "a.pdf", "--colour"],
        ["page-count"],
        ["page-count", "a.pdf", "b.pdf"],
        ["page-count", "a.pdf", "--page", "2"],
        ["page-count", "a.pdf", "-o", "x.png"],
        ["save", "a.pdf"],
        ["save", "a.pdf", "b.pdf", "-o", "c.pdf"],
        ["save", "a.pdf", "-o", "a.txt"],
        ["save", "a.pdf", "-o", "a"],
        ["save", "a.pdf", "-o", "b.pdf", "--page", "2"],
    ]) {
        assert.throws(() => parseInvocation(argv), UsageError, JSON.stringify(argv));
    }
});
