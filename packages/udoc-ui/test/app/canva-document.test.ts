/**
 * The Canva document: which links it knows, by their address alone; the embed
 * page it frames for one, under the address it was given; and what it refuses.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { UDocError } from "@docmentis/udoc-wasm/error";

import { canvaDocument, canvaEmbedPageOf } from "../../src/app/canva-document.ts";
import { createExtensionDocuments } from "../../src/app/extension-documents.ts";
import type {
    ExtensionDocument,
    ExtensionDocumentHost,
    ExtensionDocumentOpenRequest,
} from "../../src/app/extension-documents.ts";
import type { FramedPage } from "../../src/app/webpage-document.ts";

/** A request that fails if the source is read. */
function request(
    source: ExtensionDocumentOpenRequest["source"],
    options: ExtensionDocumentOpenRequest["options"] = {},
): ExtensionDocumentOpenRequest {
    return {
        source,
        options,
        url: typeof source === "string" ? source : undefined,
        name: undefined,
        head: async () => assert.fail("a Canva link is known without reading it"),
    };
}

const host: ExtensionDocumentHost = {
    theme: "light",
    locale: "en",
    signal: new AbortController().signal,
    progress: () => {},
};
const container = {} as HTMLDivElement;

/** A Canva document whose frame records what it was handed. */
function recording(): { document: ExtensionDocument; framed: FramedPage[] } {
    const framed: FramedPage[] = [];
    const document = canvaDocument(async (_container, page) => {
        framed.push(page);
        return { sourceFormat: page.sourceFormat, close: () => {}, setTheme: () => {} };
    });
    return { document, framed };
}

test("its doc type and its one format are canva", () => {
    const { document } = recording();
    assert.equal(document.docType, "canva");
    assert.deepEqual(document.formats, ["canva"]);
});

test("a design's link names its embed page, its share token kept", () => {
    const embed = "https://www.canva.com/design/DACSWFLr08k/view?embed";
    for (const url of [
        "https://www.canva.com/design/DACSWFLr08k/view",
        "https://www.canva.com/design/DACSWFLr08k/view?embed",
        "https://www.canva.com/design/DACSWFLr08k/view?utm_content=x&utm_source=y#2",
        "https://www.canva.com/design/DACSWFLr08k/watch",
        "https://www.canva.com/design/DACSWFLr08k/edit",
        "https://canva.com/design/DACSWFLr08k/view/",
    ]) {
        assert.equal(canvaEmbedPageOf(url), embed, url);
    }
    assert.equal(
        canvaEmbedPageOf("https://www.canva.com/design/DACL-CgO2NA/ybPLSlaEaBqein2rb-ohaw/view"),
        "https://www.canva.com/design/DACL-CgO2NA/ybPLSlaEaBqein2rb-ohaw/view?embed",
    );
});

test("any other address is no design's", () => {
    for (const url of [
        "https://www.canva.com/",
        "https://www.canva.com/templates/",
        "https://www.canva.com/design/DACSWFLr08k",
        "https://www.canva.com/design/a/b/c/view",
        "https://www.canva.com/design/DACSWFLr08k/report.pdf",
        "https://example.com/design/DACSWFLr08k/view",
        "https://www.canva.com.example.com/design/DACSWFLr08k/view",
        "https://www.canva.com@example.com/design/DACSWFLr08k/view",
        "not a url",
        "",
    ]) {
        assert.equal(canvaEmbedPageOf(url), undefined, url);
    }
});

test("canOpen decides by the address, reading nothing", async () => {
    const { document } = recording();
    assert.equal(await document.canOpen(request("https://www.canva.com/design/DACSWFLr08k/view")), true);
    assert.equal(await document.canOpen(request("https://example.com/report.pdf")), false);
    assert.equal(await document.canOpen(request(new Blob(["x"]))), false);
    assert.equal(await document.canOpen(request(new Uint8Array([1, 2]))), false);
});

test("it frames the embed page under the address it was given", async () => {
    const { document, framed } = recording();
    const address = "https://www.canva.com/design/DACSWFLr08k/view?utm_content=x";
    const viewer = await document.open(container, request(address), host);
    assert.deepEqual(framed, [
        { url: "https://www.canva.com/design/DACSWFLr08k/view?embed", address, sourceFormat: "canva" },
    ]);
    assert.equal(viewer.sourceFormat, "canva");
});

test("given format canva, what has no embed page is refused, unsupported, framing nothing", async () => {
    const { document, framed } = recording();
    for (const source of ["https://example.com/report.pdf", new Blob(["x"]), new Uint8Array([1, 2])]) {
        await assert.rejects(document.open(container, request(source, { format: "canva" }), host), (error) => {
            assert.ok(error instanceof UDocError);
            assert.equal(error.code, "unsupported");
            return true;
        });
    }
    assert.deepEqual(framed, []);
});

test("listed ahead of a document that reads the source, a link is never read", async () => {
    const { document } = recording();
    const reads: ExtensionDocument = {
        docType: "reads",
        formats: [],
        canOpen: async (asked) => (await asked.head()).bytes.length > 0,
        open: async () => assert.fail("not opened"),
    };
    const documents = createExtensionDocuments([document, reads]);
    assert.equal(await documents.choose(request("https://www.canva.com/design/DACSWFLr08k/view")), document);
});

test("a host's own of its doc type replaces it", async () => {
    const { document } = recording();
    const documents = createExtensionDocuments([document]);
    const hosts: ExtensionDocument = {
        docType: "canva",
        formats: ["canva"],
        canOpen: () => true,
        open: async () => assert.fail("not opened"),
    };
    documents.register(hosts);
    assert.equal(await documents.choose(request("https://www.canva.com/design/DACSWFLr08k/view")), hosts);
});
