// What scripts/headless.mjs runs in the browser: the viewer and the editor,
// each created with `null` for its container, on one document of each kind.
// A check that gets no answer fails rather than stalls: waiting on a person
// who isn't there is the way a headless UI goes wrong.
/* global document, KeyboardEvent, window */
import { UDocEditor } from "@docmentis/udoc-editor";
import { UDocViewer } from "@docmentis/udoc-viewer";

/** One blank page, protected by the password "secret" (`qpdf --encrypt secret owner 256`). */
const PROTECTED_PDF =
    "JVBERi0xLjcKJb/3ov4KMSAwIG9iago8PCAvRXh0ZW5zaW9ucyA8PCAvQURCRSA8PCAvQmFzZVZlcnNpb24gLzEuNyAvRXh0ZW5z" +
    "aW9uTGV2ZWwgOCA+PiA+PiAvUGFnZXMgMiAwIFIgL1R5cGUgL0NhdGFsb2cgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL0NvdW50IDEg" +
    "L0tpZHMgWyAzIDAgUiBdIC9UeXBlIC9QYWdlcyA+PgplbmRvYmoKMyAwIG9iago8PCAvTWVkaWFCb3ggWyAwIDAgMjAwIDIwMCBd" +
    "IC9QYXJlbnQgMiAwIFIgL1R5cGUgL1BhZ2UgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0NGIDw8IC9TdGRDRiA8PCAvQXV0aEV2ZW50" +
    "IC9Eb2NPcGVuIC9DRk0gL0FFU1YzIC9MZW5ndGggMzIgPj4gPj4gL0ZpbHRlciAvU3RhbmRhcmQgL0xlbmd0aCAyNTYgL08gPDhm" +
    "OTg3MGU5YjBhNTJjNWRiM2JmOTQ4NGNmNWVkZWE2ZWM0YmIwNzljMGYwNWRmODM5NjA4NmM4ZWZiMjlmY2Y4MjJlOGI3YzJjZWRk" +
    "Y2ZhZTJlNzc5OTU3NGY2MGEwOD4gL09FIDwyMTZlM2M4ZTg5ZjI3MmYwYmU4YWVhODM1ZmZlMWIyMjkwOTIxNDU0ODczZDY5ZWFl" +
    "NWI2ZWM0OTYxNWI5NGY0PiAvUCAtNCAvUGVybXMgPDkyMmYzOGQyMGRkMTI5ZGFmOWUwOTQwNDQ4ZmFhMDE4PiAvUiA2IC9TdG1G" +
    "IC9TdGRDRiAvU3RyRiAvU3RkQ0YgL1UgPGJmNjFhMThiNGNlNjUxMzhmZTBmOTlkZDllNTY1MDQ3MGFlNmFjYThhODQ1MDkyYjhi" +
    "MTFmNjE4MTIzNzlmNjhjNDBjN2JhN2NkOWM3NzE2Nzk4MDRlOTI5YzQ0ZGZhMT4gL1VFIDw1N2M2YWU1MDU5NWYzNGY5YjU1ODYx" +
    "NDMzODVkODc5OWM2OTdlZTA1Nzg4MWQ1NmYyODU5ZmFmYmI0ZWUwNzY2PiAvViA1ID4+CmVuZG9iagp4cmVmCjAgNQowMDAwMDAw" +
    "MDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDEzMCAwMDAwMCBuIAowMDAwMDAwMTg5IDAwMDAwIG4gCjAw" +
    "MDAwMDAyNjIgMDAwMDAgbiAKdHJhaWxlciA8PCAvUm9vdCAxIDAgUiAvU2l6ZSA1IC9JRCBbPDdiOTA4YzcyMDUyNTZlNjdjMzM5" +
    "ZTk0ZjllNDdhZjVjPjw3YjkwOGM3MjA1MjU2ZTY3YzMzOWU5NGY5ZTQ3YWY1Yz5dIC9FbmNyeXB0IDQgMCBSID4+CnN0YXJ0eHJl" +
    "Zgo4MDkKJSVFT0YK";

/** Fields no delimiter splits alike, so the engine's guess isn't certain and the UI would ask. */
const AMBIGUOUS_CSV = "a;b,c\nd e\nf|g\th\n";

/** What the demo serves, which scripts/headless.mjs serves here too. */
const PAGED = [
    { path: "/pdf/nasa-hubble-focus-black-holes-ebook.pdf", docType: "portable" },
    { path: "/docx/nasa-artemis-status-report.docx", docType: "wordprocessing" },
    { path: "/pptx/james-webb-space-telescope.pptx", docType: "presentation" },
];
const SHORT_PDF = "/pdf/nasa-hubble-fact-sheet-mission-operations.pdf";
const WORKBOOK = "/xlsx/nasa_asp_schedule_2026_01.xlsx";
const IMAGE = "/image/stephans-quintet.png";

/** A sticky note, for `addPageAnnotation`, its name and appearance left for the insert to make. */
const NOTE = {
    rect: { x0: 10, y0: 10, x1: 34, y1: 34 },
    contents: "Reviewed",
    name: null,
    modified: null,
    flags: {
        invisible: false,
        hidden: false,
        print: true,
        noZoom: false,
        noRotate: false,
        noView: false,
        readOnly: false,
        locked: false,
        toggleNoView: false,
        lockedContents: false,
    },
    color: null,
    border: null,
    borderStyle: null,
    appearance: null,
    optionalContent: null,
    kind: {
        text: {
            markup: {
                author: null,
                opacity: null,
                subject: null,
                richContents: null,
                replyType: null,
                intent: null,
                created: null,
                popup: null,
                inReplyTo: null,
            },
            open: null,
            icon: "note",
            state: null,
            stateModel: null,
        },
    },
};

const TIMEOUT_MS = 60_000;

const results = [];

/** Run one check, recording whether it passed: a rejection or no answer fails it. */
async function check(name, run) {
    let timer;
    const stalled = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`no answer in ${TIMEOUT_MS} ms`)), TIMEOUT_MS);
    });
    try {
        await Promise.race([run(), stalled]);
        results.push({ name, ok: true });
    } catch (error) {
        results.push({ name, ok: false, error: String(error?.message ?? error) });
    } finally {
        clearTimeout(timer);
    }
}

function expect(condition, what) {
    if (!condition) throw new Error(what);
}

async function rejectsWith(promise, code) {
    let error;
    try {
        await promise;
    } catch (thrown) {
        error = thrown;
    }
    expect(error, `resolved, where it should reject with ${code}`);
    expect(error.code === code, `rejected with ${error.code} (${error.message}), not ${code}`);
}

async function read(path) {
    return new Uint8Array(await (await fetch(path)).arrayBuffer());
}

const same = (a, b) => a.length === b.length && a.every((byte, i) => byte === b[i]);

const startsWith = (bytes, text) => new TextDecoder().decode(bytes.subarray(0, text.length)) === text;

/** What the same calls give a UI that is on the page, to hold the headless one to. */
async function shownPage(Class, bytes, filename) {
    const container = document.createElement("div");
    container.style.cssText = "width: 800px; height: 600px";
    document.body.append(container);
    const ui = await Class.create(container);
    try {
        await ui.open(bytes, { filename });
        return await ui.exportPageToBytes(0, { png: { scale: 1 } });
    } finally {
        ui.destroy();
        container.remove();
    }
}

async function pagedDocument(Class, label, { path, docType }) {
    const name = `${label} ${path.split("/").pop()}`;
    const filename = path.split("/").pop();
    const bytes = await read(path);
    const ui = await Class.create(null);
    await check(`${name}: open`, async () => {
        await ui.open(bytes, { filename });
        expect(ui.docType === docType, `docType is ${ui.docType}`);
        expect(ui.pageCount > 0, `pageCount is ${ui.pageCount}`);
    });
    await check(`${name}: a page exports as a UI on the page exports it`, async () => {
        const png = await ui.exportPageToBytes(0, { png: { scale: 1 } });
        const shown = await shownPage(Class, bytes, filename);
        expect(same(png, shown), `${png.length} bytes, where the UI on the page gave ${shown.length}`);
    });
    await check(`${name}: every page exports as a PDF, and the last renders`, async () => {
        const pdf = await ui.exportToBytes("pdf");
        expect(startsWith(pdf, "%PDF"), "not a PDF");
        expect(ui.pageCount > 1, `pageCount is ${ui.pageCount} once all are composed`);
        const last = await ui.renderPage(ui.pageCount - 1);
        expect(last.width > 0 && last.height > 0, `rendered ${last.width}x${last.height}`);
    });
    await check(`${name}: a page exports as an SVG`, async () => {
        const svg = await ui.exportPageToBytes(0, "svg");
        expect(new TextDecoder().decode(svg).includes("<svg"), "not an SVG");
    });
    await check(`${name}: search`, async () => {
        const matches = await ui.search("the");
        expect(matches.length > 0, "no matches");
    });
    await check(`${name}: goToPage moves currentPage`, async () => {
        const moved = new Promise((resolve) => ui.on("currentPage:changed", resolve));
        ui.goToPage(1);
        await moved;
        expect(ui.currentPage === 1, `currentPage is ${ui.currentPage}`);
    });
    await check(`${name}: what it saves reopens`, async () => {
        const pages = ui.pageCount;
        const saved = await ui.saveToBytes(ui.sourceFormat);
        await ui.open(saved, { filename });
        await ui.exportToBytes("pdf");
        expect(ui.pageCount === pages, `${ui.pageCount} pages, from ${pages}`);
    });
    ui.destroy();
}

async function workbook(Class, label) {
    const ui = await Class.create(null);
    await check(`${label} workbook: open, and move between sheets`, async () => {
        await ui.open(await read(WORKBOOK), { filename: "schedule.xlsx" });
        expect(ui.docType === "spreadsheet", `docType is ${ui.docType}`);
        expect(ui.sheetCount > 0, `sheetCount is ${ui.sheetCount}`);
        await ui.goToSheet(0);
    });
    await check(`${label} workbook: a sheet exports as a PNG and an SVG`, async () => {
        const png = await ui.exportPageToBytes(0, { png: { scale: 1 } });
        expect(png[0] === 0x89 && png[1] === 0x50, "not a PNG");
        const svg = await ui.exportPageToBytes(0, "svg");
        expect(new TextDecoder().decode(svg).includes("<svg"), "not an SVG");
    });
    await check(`${label} workbook: exports as a PDF`, async () => {
        expect(startsWith(await ui.exportToBytes("pdf"), "%PDF"), "not a PDF");
    });
    await check(`${label} workbook: renderPage rejects`, async () => {
        let rendered = false;
        await ui.renderPage(0).then(
            () => (rendered = true),
            () => {},
        );
        expect(!rendered, "renderPage resolved");
    });
    await check(`${label} workbook: search`, async () => {
        expect((await ui.search("a")).length > 0, "no matches");
    });
    ui.destroy();
}

async function image(Class, label) {
    const ui = await Class.create(null);
    await check(`${label} image: open and render`, async () => {
        await ui.open(await read(IMAGE), { filename: "image.png" });
        expect(ui.docType === "image", `docType is ${ui.docType}`);
        expect((await ui.renderPage(0)).width > 0, "rendered nothing");
    });
    ui.destroy();
}

/** What the UI asks a person: each is answered without one. */
async function nobodyToAsk(Class, label) {
    const protectedPdf = Uint8Array.from(atob(PROTECTED_PDF), (c) => c.charCodeAt(0));
    const ui = await Class.create(null);
    await check(`${label}: a protected PDF with no password rejects`, () =>
        rejectsWith(ui.open(protectedPdf, { filename: "protected.pdf" }), "passwordRequired"),
    );
    await check(`${label}: a protected PDF with the wrong password rejects`, () =>
        rejectsWith(ui.open(protectedPdf, { filename: "protected.pdf", password: "wrong" }), "passwordRequired"),
    );
    await check(`${label}: a protected PDF with its password opens`, async () => {
        await ui.open(protectedPdf, { filename: "protected.pdf", password: "secret" });
        expect(ui.pageCount === 1, `pageCount is ${ui.pageCount}`);
    });
    await check(`${label}: a CSV no delimiter splits alike opens on the likeliest`, async () => {
        await ui.open(new TextEncoder().encode(AMBIGUOUS_CSV), { filename: "ambiguous.csv" });
        expect(ui.docType === "spreadsheet", `docType is ${ui.docType}`);
    });
    await check(`${label}: an extension document rejects`, () =>
        rejectsWith(ui.open("https://www.canva.com/design/DAFexample/view"), "unsupported"),
    );
    await check(`${label}: video rejects`, () =>
        rejectsWith(ui.open(new Uint8Array([0]), { filename: "clip.mp4", format: "mp4" }), "unsupported"),
    );
    await check(`${label}: it opens another document after a rejection`, async () => {
        await ui.open(await read(SHORT_PDF), { filename: "short.pdf" });
        expect(ui.pageCount === 2, `pageCount is ${ui.pageCount}`);
    });
    await check(`${label}: print with no options prints every page`, async () => {
        const printed = new Promise((resolve) => ui.on("document:printed", resolve));
        await ui.print();
        const { pageCount } = await printed;
        expect(pageCount === 2, `printed ${pageCount} pages`);
    });
    ui.destroy();
}

/** Nothing of a headless UI reaches the page around it. */
async function nothingOnThePage(Class, label) {
    const before = document.body.children.length;
    const ui = await Class.create(null);
    await check(`${label}: print with no options prints a rendered document's every page`, async () => {
        const slides = await Class.create(null);
        await slides.open(await read("/pptx/james-webb-space-telescope.pptx"), { filename: "deck.pptx" });
        const printed = new Promise((resolve) => slides.on("document:printed", resolve));
        await slides.print();
        const { pageCount } = await printed;
        expect(pageCount === slides.pageCount, `printed ${pageCount} of ${slides.pageCount} pages`);
        slides.destroy();
    });
    await check(`${label}: adds nothing to the page`, async () => {
        await ui.open(await read(SHORT_PDF), { filename: "short.pdf" });
        expect(document.querySelector(".udoc-ui-root") === null, "a root on the page");
        expect(document.body.children.length === before, "the body gained an element");
    });
    await check(`${label}: leaves the page's shortcuts alone`, async () => {
        const key = { key: "z", ctrlKey: true, metaKey: true, bubbles: true, cancelable: true };
        expect(document.body.dispatchEvent(new KeyboardEvent("keydown", key)), "took Ctrl+Z");
    });
    ui.destroy();
}

/** The editor's edits, on a document saved and reopened. */
async function editing() {
    const ui = await UDocEditor.create(null);
    await check("editor: execute, undo and redo change the pages", async () => {
        await ui.open(await read(SHORT_PDF), { filename: "short.pdf" });
        await ui.execute({ portable: { editPage: { command: { insertPage: { index: 0 } } } } });
        expect(ui.pageCount === 3, `${ui.pageCount} pages after inserting one`);
        await ui.undo();
        expect(ui.pageCount === 2, `${ui.pageCount} pages after undo`);
        await ui.redo();
        expect(ui.pageCount === 3, `${ui.pageCount} pages after redo`);
    });
    await check("editor: an edit is in what it saves", async () => {
        const saved = await ui.saveToBytes("pdf");
        await ui.open(saved, { filename: "short.pdf" });
        expect(ui.pageCount === 3, `${ui.pageCount} pages reopened`);
    });
    await check("editor: an annotation goes on and comes off", async () => {
        const added = await ui.addPageAnnotation(0, NOTE);
        expect(
            (await ui.getPageAnnotations(0)).some((a) => a.name === added.name),
            "not on the page",
        );
        await ui.removePageAnnotation(0, added.name);
        expect(!(await ui.getPageAnnotations(0)).some((a) => a.name === added.name), "still on the page");
    });
    await check("editor: insertImage selects the picture on a slide", async () => {
        await ui.open(await read("/pptx/james-webb-space-telescope.pptx"), { filename: "deck.pptx" });
        await ui.insertImage(await read(IMAGE), "image/png");
        expect((await ui.selection())?.presentation?.shapes, "nothing selected");
    });
    ui.destroy();
}

/** A teardown ends what's in flight: the caller hears, and nothing goes uncaught. */
async function destroyedAtOnce(Class, label) {
    const bytes = await read(SHORT_PDF);
    await check(`${label}: destroy straight after open reports nothing`, async () => {
        const ui = await Class.create(null);
        await ui.open(bytes, { filename: "short.pdf" });
        ui.destroy();
    });
    await check(`${label}: a call in flight at destroy rejects`, async () => {
        const ui = await Class.create(null);
        await ui.open(bytes, { filename: "short.pdf" });
        const exporting = ui.exportToBytes("pdf");
        ui.destroy();
        await rejectsWith(exporting, "invalidRequest");
    });
}

/** Two headless editors in one collaboration: an edit reaches the other. */
async function collaboration() {
    await check("editor: an edit reaches another headless editor", async () => {
        const id = await UDocEditor.startLocalCollaborationService(await read(SHORT_PDF));
        const [one, other] = await Promise.all([UDocEditor.create(null), UDocEditor.create(null)]);
        await one.openLocal(id);
        await other.openLocal(id);
        one.joinLocalCollaboration(id, "One");
        other.joinLocalCollaboration(id, "Other");
        const reached = new Promise((resolve) => {
            const poll = setInterval(() => {
                if (other.pageCount === 3) {
                    clearInterval(poll);
                    resolve();
                }
            }, 100);
        });
        await one.execute({ portable: { editPage: { command: { insertPage: { index: 0 } } } } });
        await reached;
        expect(other.pageCount === 3, `the other has ${other.pageCount} pages`);
        one.destroy();
        other.destroy();
    });
}

window.runHeadless = async () => {
    for (const [label, Class] of [
        ["viewer", UDocViewer],
        ["editor", UDocEditor],
    ]) {
        for (const sample of PAGED) await pagedDocument(Class, label, sample);
        await workbook(Class, label);
        await image(Class, label);
        await nobodyToAsk(Class, label);
        await nothingOnThePage(Class, label);
        await destroyedAtOnce(Class, label);
    }
    await editing();
    await collaboration();
    return results;
};
window.headlessReady = true;
