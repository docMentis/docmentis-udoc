/**
 * The custom colour picker's arithmetic: the hex a reader types, read the ways
 * a reader writes one, and HSV to and from hex — the square and strip the
 * picker drags agreeing with the hex it shows.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { hexToHsv, hsvToHex, parseHex, rgbToHex } from "../../src/app/color.ts";

test("a hex is read with or without its #, short or long, in either case", () => {
    assert.equal(parseHex("#FF8800"), "#ff8800");
    assert.equal(parseHex("ff8800"), "#ff8800");
    assert.equal(parseHex(" #f80 "), "#ff8800");
    assert.equal(parseHex("F80"), "#ff8800");
});

test("what is not a hex is refused", () => {
    for (const text of ["", "#", "#ff88", "#ff88000", "#gg0000", "red", "rgb(255, 0, 0)"]) {
        assert.equal(parseHex(text), null, text);
    }
});

test("the primaries and greys land where the picker draws them", () => {
    assert.deepEqual(hexToHsv("#ff0000"), { h: 0, s: 1, v: 1 });
    assert.deepEqual(hexToHsv("#00ff00"), { h: 120, s: 1, v: 1 });
    assert.deepEqual(hexToHsv("#0000ff"), { h: 240, s: 1, v: 1 });
    assert.deepEqual(hexToHsv("#000000"), { h: 0, s: 0, v: 0 });
    assert.deepEqual(hexToHsv("#ffffff"), { h: 0, s: 0, v: 1 });
    assert.equal(hsvToHex({ h: 300, s: 1, v: 1 }), "#ff00ff");
    assert.equal(hsvToHex({ h: 37, s: 0, v: 0.5 }), "#808080");
});

test("every hex comes back from HSV as itself", () => {
    for (let n = 0; n < 0x1000000; n += 0x010203) {
        const hex = rgbToHex(n >> 16, (n >> 8) & 0xff, n & 0xff);
        assert.equal(hsvToHex(hexToHsv(hex)), hex);
    }
});

test("channels out of range are clamped", () => {
    assert.equal(rgbToHex(-3, 255.4, 300), "#00ffff");
});
