/**
 * What a client asks of the udoc server it opened from: here, telling one
 * checkpoint's package, which is read-only, from the document's by its URL.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { isCheckpointPackage } from "../../src/app/remote.ts";

test("a checkpoint's package is told from the document's by its path", () => {
    for (const url of [
        "https://udoc.test/documents/a/checkpoints/3/package",
        "https://udoc.test/under/a/base/documents/a/checkpoints/0/package",
        "https://udoc.test/documents/a/checkpoints/12/package/",
        "https://udoc.test/documents/a/checkpoints/3/package?token=t",
    ]) {
        assert.equal(isCheckpointPackage(url), true, url);
    }
    for (const url of [
        "https://udoc.test/documents/a/package",
        "https://udoc.test/documents/checkpoints/package",
        "https://udoc.test/documents/a/checkpoints/three/package",
        "https://udoc.test/documents/a/package?checkpoints/3/package",
    ]) {
        assert.equal(isCheckpointPackage(url), false, url);
    }
});
