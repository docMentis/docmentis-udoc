/**
 * Which extension document opens what `open` was given: given a format, the
 * one whose formats hold it; given none, the first whose `canOpen` says yes;
 * else none, for the engine.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { UDocError } from "@docmentis/udoc-wasm/error";

import { createExtensionDocuments } from "../../src/app/extension-documents.ts";
import type { ExtensionDocument, ExtensionDocumentOpenRequest } from "../../src/app/extension-documents.ts";

function request(options: ExtensionDocumentOpenRequest["options"] = {}): ExtensionDocumentOpenRequest {
    return {
        source: "https://example.com/clip",
        options,
        url: "https://example.com/clip",
        name: "clip",
        head: async () => ({ bytes: new Uint8Array(), mediaType: undefined }),
    };
}

/** An extension document of `docType` reading `formats`, whose `canOpen` answers `opens` and records each ask in `asked`. */
function extensionDocument(
    docType: string,
    formats: readonly string[],
    opens: boolean | Promise<boolean>,
    asked: string[] = [],
): ExtensionDocument {
    return {
        docType,
        formats,
        canOpen: () => {
            asked.push(docType);
            return opens;
        },
        open: () => Promise.reject(new Error("not opened in these tests")),
    };
}

test("a format given picks the extension document whose formats hold it, asking no canOpen", async () => {
    const documents = createExtensionDocuments();
    const asked: string[] = [];
    const media = extensionDocument("media", ["mp4", "hls"], false, asked);
    documents.register(extensionDocument("webpage", ["url"], true, asked));
    documents.register(media);
    assert.equal(await documents.choose(request({ format: "hls" })), media);
    assert.deepEqual(asked, []);
});

test("a format none of them reads is the engine's, with no canOpen asked", async () => {
    const documents = createExtensionDocuments();
    const asked: string[] = [];
    documents.register(extensionDocument("media", ["mp4"], true, asked));
    assert.equal(await documents.choose(request({ format: "pdf" })), null);
    assert.deepEqual(asked, []);
});

test("with no format, the first whose canOpen says yes opens it, in the order registered", async () => {
    const documents = createExtensionDocuments();
    const asked: string[] = [];
    const second = extensionDocument("second", [], Promise.resolve(true), asked);
    documents.register(extensionDocument("first", [], false, asked));
    documents.register(second);
    documents.register(extensionDocument("third", [], true, asked));
    assert.equal(await documents.choose(request()), second);
    assert.deepEqual(asked, ["first", "second"]);
});

test("with no yes, none opens it, and the engine does", async () => {
    const documents = createExtensionDocuments();
    documents.register(extensionDocument("media", ["mp4"], false));
    assert.equal(await documents.choose(request()), null);
    assert.equal(await createExtensionDocuments().choose(request()), null);
});

test("a canOpen that rejects fails the choice", async () => {
    const documents = createExtensionDocuments();
    documents.register(extensionDocument("media", [], Promise.reject(new Error("unreadable"))));
    await assert.rejects(documents.choose(request()), /unreadable/);
});

test("one of a doc type already registered replaces it, in its place", async () => {
    const documents = createExtensionDocuments();
    const asked: string[] = [];
    documents.register(extensionDocument("media", [], false, asked));
    documents.register(extensionDocument("webpage", [], true, asked));
    const replacement = extensionDocument("media", [], true, asked);
    documents.register(replacement);
    assert.equal(await documents.choose(request()), replacement);
    assert.deepEqual(asked, ["media"]);
});

test("none of the engine's doc types can be registered", () => {
    const documents = createExtensionDocuments();
    for (const docType of ["portable", "wordprocessing", "presentation", "spreadsheet", "image"]) {
        assert.throws(
            () => documents.register(extensionDocument(docType, [], true)),
            (error) => error instanceof UDocError && error.code === "invalidRequest",
        );
    }
});
