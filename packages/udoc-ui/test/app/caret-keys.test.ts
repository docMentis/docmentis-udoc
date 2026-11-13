/**
 * The keys that move a text caret: the bare arrows, Home and End, and the
 * word, paragraph and story moves under each platform's modifier.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { caretKeyMove } from "../../src/app/caret-keys.ts";
import type { CaretKeyPress } from "../../src/app/caret-keys.ts";

function key(name: string, mods: Partial<Omit<CaretKeyPress, "key">> = {}): CaretKeyPress {
    return { key: name, ctrlKey: false, altKey: false, metaKey: false, ...mods };
}

test("the bare keys step a character or a line, Home and End go to the line's ends", () => {
    for (const mac of [true, false]) {
        assert.equal(caretKeyMove(key("ArrowLeft"), mac), "left");
        assert.equal(caretKeyMove(key("ArrowRight"), mac), "right");
        assert.equal(caretKeyMove(key("ArrowUp"), mac), "up");
        assert.equal(caretKeyMove(key("ArrowDown"), mac), "down");
        assert.equal(caretKeyMove(key("Home"), mac), "lineStart");
        assert.equal(caretKeyMove(key("End"), mac), "lineEnd");
        assert.equal(caretKeyMove(key("a"), mac), null);
    }
});

test("on a Mac, Option steps by word or paragraph and Cmd goes to the line's or the text's ends", () => {
    const option = { altKey: true };
    assert.equal(caretKeyMove(key("ArrowLeft", option), true), "wordStart");
    assert.equal(caretKeyMove(key("ArrowRight", option), true), "wordEnd");
    assert.equal(caretKeyMove(key("ArrowUp", option), true), "paragraphStart");
    assert.equal(caretKeyMove(key("ArrowDown", option), true), "paragraphEnd");

    const cmd = { metaKey: true };
    assert.equal(caretKeyMove(key("ArrowLeft", cmd), true), "lineStart");
    assert.equal(caretKeyMove(key("ArrowRight", cmd), true), "lineEnd");
    assert.equal(caretKeyMove(key("ArrowUp", cmd), true), "storyStart");
    assert.equal(caretKeyMove(key("ArrowDown", cmd), true), "storyEnd");
});

test("a Mac keeps Ctrl with an arrow, and Cmd with a letter is a shortcut", () => {
    assert.equal(caretKeyMove(key("ArrowLeft", { ctrlKey: true }), true), null);
    assert.equal(caretKeyMove(key("ArrowLeft", { metaKey: true, altKey: true }), true), null);
    assert.equal(caretKeyMove(key("z", { metaKey: true }), true), null);
});

test("elsewhere, Ctrl steps by word or paragraph, and with Home or End goes to the text's ends", () => {
    const ctrl = { ctrlKey: true };
    assert.equal(caretKeyMove(key("ArrowLeft", ctrl), false), "wordStart");
    assert.equal(caretKeyMove(key("ArrowRight", ctrl), false), "wordEnd");
    assert.equal(caretKeyMove(key("ArrowUp", ctrl), false), "paragraphStart");
    assert.equal(caretKeyMove(key("ArrowDown", ctrl), false), "paragraphEnd");
    assert.equal(caretKeyMove(key("Home", ctrl), false), "storyStart");
    assert.equal(caretKeyMove(key("End", ctrl), false), "storyEnd");
    assert.equal(caretKeyMove(key("z", ctrl), false), null);
});

test("elsewhere, Alt with an arrow moves as the bare arrow, and the Windows key moves nothing", () => {
    assert.equal(caretKeyMove(key("ArrowLeft", { altKey: true }), false), "left");
    assert.equal(caretKeyMove(key("ArrowLeft", { metaKey: true }), false), null);
});
