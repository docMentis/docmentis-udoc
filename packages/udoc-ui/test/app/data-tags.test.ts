/**
 * The tags the Data panel lists: each once, by what its braces hold, with every
 * place it is written, in the order the text first holds it.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { SearchMatch } from "@docmentis/udoc-wasm";

import { DATA_TAG_PATTERN, groupDataTags, tagText } from "../../src/app/data-tags.ts";

/** A match of `text` on page `page`. */
const match = (text: string, page = 0): SearchMatch =>
    ({ location: {}, plane: 0, page, quads: [], context: ["", text, ""] }) as unknown as SearchMatch;

test("a tag is what its braces hold, without the spaces around it", () => {
    assert.equal(tagText(match("{{customer.name}}")), "customer.name");
    assert.equal(tagText(match("{{ customer.name }}")), "customer.name");
    assert.equal(tagText(match('{{#fund in funds join ", "}}')), '#fund in funds join ", "');
    assert.equal(tagText(match("{{}}")), "");
});

test("the tags are listed once each, in the order the text first holds them", () => {
    const a = match("{{customer.name}}", 0);
    const b = match("{{fund.name}}", 0);
    const c = match("{{ customer.name }}", 2);
    const tags = groupDataTags([a, b, c]);
    assert.deepEqual(
        tags.map((t) => t.tag),
        ["customer.name", "fund.name"],
    );
    assert.deepEqual(tags[0]!.matches, [a, c]);
    assert.deepEqual(tags[1]!.matches, [b]);
});

test("no matches list no tags", () => {
    assert.deepEqual(groupDataTags([]), []);
});

test("the pattern finds each tag whole, braces in its quotes and all", () => {
    const pattern = new RegExp(DATA_TAG_PATTERN, "g");
    const found = (text: string) => [...text.matchAll(pattern)].map((m) => m[0]);
    assert.deepEqual(found("Dear {{customer.name}}, welcome."), ["{{customer.name}}"]);
    assert.deepEqual(found("{{a}} and {{ b }}"), ["{{a}}", "{{ b }}"]);
    assert.deepEqual(found('{{customer.title or "Client"}}'), ['{{customer.title or "Client"}}']);
    assert.deepEqual(found('{{"{{"}}'), ['{{"{{"}}']);
});

test("the pattern finds no tag in braces left open, or quotes", () => {
    const pattern = new RegExp(DATA_TAG_PATTERN, "g");
    const found = (text: string) => [...text.matchAll(pattern)].map((m) => m[0]);
    assert.deepEqual(found("{{a} and {b}}"), []);
    assert.deepEqual(found('{{"}}'), []);
    assert.deepEqual(found("{{cust"), []);
});
