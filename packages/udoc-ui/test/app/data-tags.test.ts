/**
 * The tags the Data panel lists: each binding once, by what it binds, with every
 * tag that writes it, in the order the text first holds it; the tags that are
 * wrong apart.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { SlideTag, Tag, TagError } from "@docmentis/udoc-wasm";

import { entryName, groupDataTags } from "../../src/app/data-tags.ts";

/** A tag on slide `slide` that reads as `tag`, or is wrong with `error`. */
const at = (text: string, tag?: Tag, error?: TagError, slide = 0): SlideTag => ({
    text,
    ...(tag === undefined ? {} : { tag }),
    ...(error === undefined ? {} : { error }),
    slide,
    location: { start: [slide, 0, 0], end: [slide, 0, text.length] },
});

const variable = (path: string): Tag => ({ variable: { path } });

test("a binding is named by what it binds", () => {
    assert.equal(entryName(at("{{customer.name}}", variable("customer.name"))), "customer.name");
    assert.equal(entryName(at("{{#fund in funds}}", { repeat: { item: "fund", path: "funds" } })), "#fund in funds");
    assert.equal(entryName(at("{{#if not a.b}}", { condition: { not: true, path: "a.b" } })), "#if not a.b");
    assert.equal(entryName(at("{{#choose r}}", { choice: { path: "r" } })), "#choose r");
});

test("a closing tag, an option and a literal are no binding of their own", () => {
    assert.equal(entryName(at("{{/if}}", { close: { name: "if" } })), null);
    assert.equal(entryName(at("{{:otherwise}}", "otherwise")), null);
    assert.equal(entryName(at('{{"{{"}}', { literal: { text: "{{" } })), null);
});

test("each binding is listed once, in the order the text first holds it", () => {
    const a = at("{{customer.name}}", variable("customer.name"));
    const b = at("{{fund.name}}", variable("fund.name"));
    const c = at("{{ customer.name }}", variable("customer.name"), undefined, 2);
    const { entries, errors } = groupDataTags([a, b, c]);
    assert.deepEqual(
        entries.map((e) => e.name),
        ["customer.name", "fund.name"],
    );
    assert.deepEqual(entries[0]!.tags, [a, c]);
    assert.deepEqual(errors, []);
});

test("a tag that is wrong is listed apart, even one that reads", () => {
    const open = at("{{#if a}}", { condition: { not: false, path: "a" } }, "unclosedPair");
    const broken = at("{{cust", undefined, "unclosedTag");
    const { entries, errors } = groupDataTags([open, broken]);
    assert.deepEqual(entries, []);
    assert.deepEqual(errors, [open, broken]);
});
