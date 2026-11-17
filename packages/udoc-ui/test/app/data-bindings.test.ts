/**
 * A template's sample data, as the Data panel edits it: a value read and set at
 * a place, an array's items added and removed, each edit a new copy.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { BindingData, BindingSchema } from "@docmentis/udoc-wasm";

import {
    blankItem,
    boundPath,
    filledInSample,
    sampleAt,
    withItem,
    withoutItem,
    withSample,
} from "../../src/app/data-bindings.ts";

const data: BindingData = { customer: { name: "Acme" }, funds: [{ name: "Alpha" }, { name: "Beta" }] };

test("a value is read at its place, or undefined where there is none", () => {
    assert.equal(sampleAt(data, ["customer", "name"]), "Acme");
    assert.equal(sampleAt(data, ["funds", 1, "name"]), "Beta");
    assert.equal(sampleAt(data, ["funds", 2, "name"]), undefined);
    assert.equal(sampleAt(data, ["customer", "title"]), undefined);
    assert.equal(sampleAt(undefined, ["customer"]), undefined);
});

test("a value set makes what is on the way, and leaves the old data as it is", () => {
    const set = withSample(data, ["funds", 0, "manager", "name"], "Kim");
    assert.equal(sampleAt(set, ["funds", 0, "manager", "name"]), "Kim");
    assert.equal(sampleAt(set, ["funds", 0, "name"]), "Alpha");
    assert.equal(sampleAt(data, ["funds", 0, "manager"]), undefined);
    assert.deepEqual(withSample(undefined, ["pays"], true), { pays: true });
});

test("an item is added after the others, and taken out by its index", () => {
    const added = withItem(data, ["funds"], { name: "Gamma" });
    assert.deepEqual(sampleAt(added, ["funds"]), [{ name: "Alpha" }, { name: "Beta" }, { name: "Gamma" }]);
    const removed = withoutItem(added, ["funds"], 0);
    assert.deepEqual(sampleAt(removed, ["funds"]), [{ name: "Beta" }, { name: "Gamma" }]);
    assert.deepEqual(sampleAt(withItem(undefined, ["managers"], ""), ["managers"]), [""]);
});

test("a value's bound path names every item alike", () => {
    assert.equal(boundPath(["customer", "name"]), "customer.name");
    assert.equal(boundPath(["funds", 2, "name"]), "funds[].name");
    assert.equal(boundPath(["rows", 0, 1]), "rows[][]");
    assert.equal(boundPath(["funds"]), "funds");
});

test("filling in makes up what the sample data lacks: a title, a choice's first value, true and three items", () => {
    const schema: BindingSchema = {
        object: {
            properties: {
                customer: { object: { properties: { name: { text: { values: [] } } } } },
                rating: { text: { values: ["low", "high"] } },
                vip: "bool",
                funds: { array: { item: { object: { properties: { fund_name: { text: { values: [] } } } } } } },
            },
        },
    };
    assert.deepEqual(filledInSample(undefined, schema), {
        customer: { name: "Customer Name" },
        rating: "low",
        vip: true,
        funds: [{ fund_name: "Funds Fund Name" }, { fund_name: "Funds Fund Name" }, { fund_name: "Funds Fund Name" }],
    });
    // What it holds stays, an empty text, false and an empty array among it;
    // its items are filled in as made-up items are.
    assert.deepEqual(
        filledInSample({ customer: { name: "" }, vip: false, funds: [{}, { fund_name: "Alpha" }] }, schema),
        {
            customer: { name: "" },
            rating: "low",
            vip: false,
            funds: [{ fund_name: "Funds Fund Name" }, { fund_name: "Alpha" }],
        },
    );
    assert.deepEqual(filledInSample({ funds: [] }, schema).funds, []);
});

test("a new item is blank as its kind is", () => {
    assert.equal(blankItem({ text: { values: [] } }), "");
    assert.equal(blankItem("bool"), false);
    assert.deepEqual(blankItem({ array: {} }), []);
    assert.deepEqual(blankItem({ object: { properties: {} } }), {});
    assert.deepEqual(blankItem(undefined), {});
});
