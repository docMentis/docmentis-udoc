/**
 * The Google document: which links it knows, by their address alone; the
 * read-only page it frames for each app's, under the address it was given; and
 * what it refuses or leaves to the engine.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { UDocError } from "@docmentis/udoc-wasm/error";

import { createExtensionDocuments } from "../../src/app/extension-documents.ts";
import type {
    ExtensionDocument,
    ExtensionDocumentHost,
    ExtensionDocumentOpenRequest,
} from "../../src/app/extension-documents.ts";
import { googleDocument, googlePageOf } from "../../src/app/google-document.ts";
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
        head: async () => assert.fail("a Google link is known without reading it"),
    };
}

const host: ExtensionDocumentHost = {
    theme: "light",
    locale: "en",
    signal: new AbortController().signal,
    progress: () => {},
};
const container = {} as HTMLDivElement;

/** A Google document whose frame records what it was handed. */
function recording(): { document: ExtensionDocument; framed: FramedPage[] } {
    const framed: FramedPage[] = [];
    const document = googleDocument(async (_container, page) => {
        framed.push(page);
        return { sourceFormat: page.sourceFormat, close: () => {}, setTheme: () => {} };
    });
    return { document, framed };
}

const ID = "195j9eDD3ccgjQRttHhJPymLJUCOUjs-jmwTrekvdjFE";
const G = "https://docs.google.com";

test("its doc type is google and its formats are the three apps'", () => {
    const { document } = recording();
    assert.equal(document.docType, "google");
    assert.deepEqual(document.formats, ["google-docs", "google-sheets", "google-slides"]);
});

test("each app's link names its read-only page and source format", () => {
    const pages: Array<[string, string, string]> = [
        ["document", "preview", "google-docs"],
        ["spreadsheets", "preview", "google-sheets"],
        ["presentation", "embed", "google-slides"],
    ];
    for (const [app, page, sourceFormat] of pages) {
        const expected = { url: `${G}/${app}/d/${ID}/${page}`, sourceFormat };
        for (const way of [
            "/edit",
            "/edit?usp=sharing",
            "/edit#heading=h.x",
            "/view",
            "/preview",
            "/embed",
            "/present",
            "",
            "/",
        ]) {
            assert.deepEqual(googlePageOf(`${G}/${app}/d/${ID}${way}`), expected, `${app}${way}`);
        }
    }
});

test("a link's resourcekey is kept, as some link-shared files need it to open", () => {
    assert.deepEqual(googlePageOf(`${G}/document/d/${ID}/edit?usp=sharing&resourcekey=0-abc`), {
        url: `${G}/document/d/${ID}/preview?resourcekey=0-abc`,
        sourceFormat: "google-docs",
    });
});

test("an export is no link to a page: the engine fetches it", async () => {
    const { document } = recording();
    for (const url of [
        `${G}/document/d/${ID}/export?format=pdf`,
        `${G}/presentation/d/${ID}/export/pptx`,
        `${G}/spreadsheets/d/${ID}/export?format=xlsx`,
    ]) {
        assert.equal(googlePageOf(url), undefined, url);
        assert.equal(await document.canOpen(request(url)), false, url);
    }
    const documents = createExtensionDocuments([document]);
    assert.equal(await documents.choose(request(`${G}/document/d/${ID}/export?format=pdf`)), null);
});

test("any other address is no file's", () => {
    for (const url of [
        `${G}/`,
        `${G}/document/`,
        `${G}/document/d/e/2PACX-1vT/pub`,
        `${G}/forms/d/${ID}/edit`,
        `${G}/document/u/1/d/${ID}/edit`,
        `https://drive.google.com/file/d/${ID}/view`,
        `https://example.com/document/d/${ID}/edit`,
        `https://docs.google.com.example.com/document/d/${ID}/edit`,
        `https://docs.google.com@example.com/document/d/${ID}/edit`,
        "not a url",
        "",
    ]) {
        assert.equal(googlePageOf(url), undefined, url);
    }
});

test("canOpen decides by the address, reading nothing", async () => {
    const { document } = recording();
    assert.equal(await document.canOpen(request(`${G}/document/d/${ID}/edit`)), true);
    assert.equal(await document.canOpen(request("https://example.com/report.pdf")), false);
    assert.equal(await document.canOpen(request(new Blob(["x"]))), false);
    assert.equal(await document.canOpen(request(new Uint8Array([1, 2]))), false);
});

test("it frames the read-only page, never the editor, under the address it was given", async () => {
    const { document, framed } = recording();
    const address = `${G}/presentation/d/${ID}/edit?usp=sharing`;
    const viewer = await document.open(container, request(address), host);
    assert.deepEqual(framed, [{ url: `${G}/presentation/d/${ID}/embed`, address, sourceFormat: "google-slides" }]);
    assert.equal(viewer.sourceFormat, "google-slides");
});

test("given the format of the link's app, it opens", async () => {
    const { document, framed } = recording();
    const address = `${G}/spreadsheets/d/${ID}/edit`;
    await document.open(container, request(address, { format: "google-sheets" }), host);
    assert.equal(framed[0]?.sourceFormat, "google-sheets");
});

test("given a format, what has no such page is refused, unsupported, framing nothing", async () => {
    const { document, framed } = recording();
    const refused: Array<[ExtensionDocumentOpenRequest["source"], string]> = [
        [`${G}/document/d/${ID}/edit`, "google-slides"],
        ["https://example.com/report.pdf", "google-docs"],
        [new Blob(["x"]), "google-docs"],
        [new Uint8Array([1, 2]), "google-sheets"],
    ];
    for (const [source, format] of refused) {
        await assert.rejects(document.open(container, request(source, { format }), host), (error) => {
            assert.ok(error instanceof UDocError);
            assert.equal(error.code, "unsupported");
            return true;
        });
    }
    assert.deepEqual(framed, []);
});
