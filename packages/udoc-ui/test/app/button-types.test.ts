/**
 * A button with no `type` is a submit button, so inside a host's form it
 * submits that form. This suite has no DOM to mount a shell in, so it reads the
 * source: every button the packages build says which it is, and only a dialog
 * with a form of its own builds a submit button.
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { test } from "node:test";

const PACKAGES = resolve(import.meta.dirname, "../../..");
const SOURCES = ["udoc-ui/src", "udoc-editor/src", "udoc-viewer/src"];
const OWN_FORMS = ["udoc-ui/src/app/components/DelimiterModal.ts", "udoc-ui/src/app/components/PasswordModal.ts"];

const CALL = 'document.createElement("button")';
/** One button being built: what holds it, up to the next button being built. */
const BUILT =
    /(\w+)\s*[:=]\s*document\.createElement\("button"\)([\s\S]*?)(?=\w+\s*[:=]\s*document\.createElement\("button"\)|$)/g;

/** Each source file's path under the packages, and its text. */
function sources(): Array<{ path: string; text: string }> {
    return SOURCES.flatMap((source) =>
        readdirSync(join(PACKAGES, source), { recursive: true, withFileTypes: true })
            .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
            .map((entry) => join(entry.parentPath, entry.name))
            .map((path) => ({ path: relative(PACKAGES, path), text: readFileSync(path, "utf8") })),
    );
}

/** The `type` given to each button `text` builds, by the name holding it; null for none. */
function buttonTypes(text: string): Array<{ name: string; type: string | null }> {
    return [...text.matchAll(BUILT)].map(([, name, rest]) => {
        // A button a property holds is typed through what holds that property.
        return { name: name!, type: rest!.match(new RegExp(`\\b${name}\\.type = "(\\w+)"`))?.[1] ?? null };
    });
}

test("every button the packages build has an explicit type", () => {
    const missing: string[] = [];
    let buttons = 0;
    for (const { path, text } of sources()) {
        const built = buttonTypes(text);
        buttons += built.length;
        // A button built with no name holding it can't be given a type.
        assert.equal(built.length, text.split(CALL).length - 1, `${path} builds a button that nothing holds`);
        for (const { name, type } of built) if (type === null) missing.push(`${path}: ${name}`);
    }
    assert.deepEqual(missing, []);
    assert.ok(buttons > 0, "the scan found no buttons, so it no longer sees how they are built");
});

test("only the dialogs with a form of their own build a submit button", () => {
    const submitting = sources()
        .filter(({ text }) => buttonTypes(text).some(({ type }) => type === "submit"))
        .map(({ path }) => path)
        .sort();
    assert.deepEqual(submitting, OWN_FORMS);
});
