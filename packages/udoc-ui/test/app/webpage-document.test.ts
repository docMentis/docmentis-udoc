/**
 * The web page document: built in with no rule, framing only a URL given
 * `format: "url"`; with a host's rule, asked of a URL alone; and an open
 * refused before it frames anything.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { UDocError } from "@docmentis/udoc-wasm/error";

import { createExtensionDocuments } from "../../src/app/extension-documents.ts";
import type { ExtensionDocumentHost, ExtensionDocumentOpenRequest } from "../../src/app/extension-documents.ts";
import { webpageDocument } from "../../src/app/webpage-document.ts";

function request(
    source: ExtensionDocumentOpenRequest["source"],
    options: ExtensionDocumentOpenRequest["options"] = {},
): ExtensionDocumentOpenRequest {
    const url = typeof source === "string" ? source : source instanceof URL ? source.href : undefined;
    return {
        source,
        options,
        url,
        name: undefined,
        head: async () => ({ bytes: new Uint8Array(), mediaType: undefined }),
    };
}

const host: ExtensionDocumentHost = {
    theme: "light",
    locale: "en",
    signal: new AbortController().signal,
    progress: () => {},
};

test("its doc type is webpage and its one format url", () => {
    const document = webpageDocument({ canOpen: () => true });
    assert.equal(document.docType, "webpage");
    assert.deepEqual(document.formats, ["url"]);
});

test("the host's rule decides a URL, given the URL", async () => {
    const asked: string[] = [];
    const document = webpageDocument({
        canOpen: (request) => {
            asked.push(request.url);
            return new URL(request.url).hostname === "www.figma.com";
        },
    });
    assert.equal(await document.canOpen(request("https://www.figma.com/embed?x=1")), true);
    assert.equal(await document.canOpen(request("https://example.com/report.pdf")), false);
    assert.deepEqual(asked, ["https://www.figma.com/embed?x=1", "https://example.com/report.pdf"]);
});

test("with no rule, no URL is a page", async () => {
    const document = webpageDocument();
    assert.equal(await document.canOpen(request("https://www.figma.com/embed?x=1")), false);
});

test("a Blob or bytes is no page, the host's rule not asked", async () => {
    let asked = 0;
    const document = webpageDocument({
        canOpen: () => {
            asked += 1;
            return true;
        },
    });
    assert.equal(await document.canOpen(request(new Blob(["<p>hi</p>"]))), false);
    assert.equal(await document.canOpen(request(new Uint8Array([1, 2]))), false);
    assert.equal(asked, 0);
});

test("format url picks it, its rule not asked", async () => {
    let asked = 0;
    const documents = createExtensionDocuments();
    const document = webpageDocument({
        canOpen: () => {
            asked += 1;
            return false;
        },
    });
    documents.register(document);
    assert.equal(await documents.choose(request("https://example.com/", { format: "url" })), document);
    assert.equal(asked, 0);
});

test("built in with no rule, it frames format url alone; a host's with a rule replaces it", async () => {
    const builtIn = webpageDocument();
    const documents = createExtensionDocuments([builtIn]);
    assert.equal(await documents.choose(request("https://example.com/", { format: "url" })), builtIn);
    assert.equal(await documents.choose(request("https://example.com/")), null);
    const hosts = webpageDocument({ canOpen: () => true });
    documents.register(hosts);
    assert.equal(await documents.choose(request("https://example.com/", { format: "url" })), hosts);
    assert.equal(await documents.choose(request("https://example.com/")), hosts);
});

test("a Blob given format url is refused, unsupported", async () => {
    const document = webpageDocument({ canOpen: () => true });
    const container = {} as HTMLDivElement;
    await assert.rejects(document.open(container, request(new Blob([]), { format: "url" }), host), (error) => {
        assert.ok(error instanceof UDocError);
        assert.equal(error.code, "unsupported");
        return true;
    });
});

test("an open outside the viewer and the editor is refused, as it has no words", async () => {
    const document = webpageDocument({ canOpen: () => true });
    const container = {} as HTMLDivElement;
    await assert.rejects(document.open(container, request("https://example.com/"), host), (error) => {
        assert.ok(error instanceof UDocError);
        assert.equal(error.code, "invalidRequest");
        return true;
    });
});
