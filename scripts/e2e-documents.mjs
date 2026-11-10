// The real edits the end-to-end suites make (scripts/e2e.mjs), per document type.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { check, SAMPLES } from "./e2e-harness.mjs";

export const png = await readFile(join(SAMPLES, "image/stephans-quintet.png"));

/** Run one edit on editor `s`; the engine refusing a real edit is a failure. */
export function run(s, label, command) {
    try {
        s.execute(command);
    } catch (error) {
        check(`the engine takes the edit "${label}"`, false, String(error?.message ?? error).slice(0, 200));
    }
}

/** A value each call, since Loro drops a write of the value already there. */
let lastValue = 0;
const nextValue = () => ++lastValue;

/** A TIFF of `pages` small pages: no sample document has that many, and the rounds of edits each need a page. */
function multiPageTiff(pages = 10, size = 16) {
    const tags = 10;
    const directoryBytes = 2 + tags * 12 + 4;
    const pixelBytes = size * size * 3;
    const pageBytes = directoryBytes + 6 + pixelBytes;
    const bytes = new Uint8Array(8 + pages * pageBytes);
    const view = new DataView(bytes.buffer);
    bytes.set([0x49, 0x49, 42, 0]);
    view.setUint32(4, 8, true);
    for (let page = 0; page < pages; page++) {
        const at = 8 + page * pageBytes;
        const bitsPerSample = at + directoryBytes;
        const strip = bitsPerSample + 6;
        view.setUint16(at, tags, true);
        [
            [256, 4, 1, size], // width
            [257, 4, 1, size], // height
            [258, 3, 3, bitsPerSample],
            [259, 3, 1, 1], // no compression
            [262, 3, 1, 2], // RGB
            [273, 4, 1, strip],
            [277, 3, 1, 3], // samples per pixel
            [278, 4, 1, size], // rows per strip
            [279, 4, 1, pixelBytes],
            [284, 3, 1, 1], // chunky
        ].forEach(([tag, type, count, value], i) => {
            const entry = at + 2 + i * 12;
            view.setUint16(entry, tag, true);
            view.setUint16(entry + 2, type, true);
            view.setUint32(entry + 4, count, true);
            if (type === 3 && count === 1) view.setUint16(entry + 8, value, true);
            else view.setUint32(entry + 8, value, true);
        });
        view.setUint32(at + 2 + tags * 12, page + 1 < pages ? at + pageBytes : 0, true);
        for (let sample = 0; sample < 3; sample++) view.setUint16(bitsPerSample + sample * 2, 8, true);
        bytes.fill(page * 20, strip, strip + pixelBytes);
    }
    return bytes;
}

const RED = { components: [1, 0, 0], colorSpace: "deviceRgb" };
const J = (e, n) => JSON.parse(e.get(n).toString());
const named = (e, re) => [...e.keys()].filter((n) => re.test(n));
const typed = (text) => ({
    blocks: [{ paragraph: { properties: { props: [] }, spans: [{ regular: { properties: { props: [] }, text } }] } }],
});
const insertText = (at, text) => ({ replaceText: { range: { start: at, end: at }, fragment: typed(text) } });
const flags = {
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
};
const markup = {
    author: "t",
    opacity: null,
    subject: null,
    richContents: null,
    replyType: null,
    intent: null,
    created: "D:20260101000000Z",
    popup: null,
    inReplyTo: null,
};
const annotation = (rect, kind, color = RED) => ({
    rect,
    contents: null,
    name: null,
    modified: "D:20260101000000Z",
    flags,
    color,
    border: null,
    borderStyle: null,
    appearance: null,
    optionalContent: null,
    kind,
});
const note = (x, y) =>
    annotation(
        { x0: x, y0: y, x1: x + 16, y1: y + 16 },
        { text: { markup, open: null, icon: "note", state: null, stateModel: null } },
    );
const freeText = (font) =>
    annotation(
        { x0: 50, y0: 50, x1: 250, y1: 110 },
        {
            freeText: {
                markup,
                defaultAppearance: {
                    textStyle: {
                        font,
                        fontSize: 12,
                        charSpacing: 0,
                        wordSpacing: 0,
                        horizontalScaling: 100,
                        leading: 0,
                        rise: 0,
                        renderMode: "fill",
                        knockout: true,
                    },
                    nonstrokingStyle: { brush: { solid: RED }, alpha: 1, overprint: false },
                    strokingStyle: {
                        brush: { solid: { components: [0], colorSpace: "deviceGray" } },
                        alpha: 1,
                        overprint: false,
                        line: {
                            width: 1,
                            lineCap: "butt",
                            lineJoin: "miter",
                            miterLimit: 10,
                            dashArray: null,
                            dashOffset: 0,
                        },
                    },
                    renderStyle: {
                        blendMode: "normal",
                        alphaIsShape: false,
                        overprintMode: "default",
                        renderingIntent: "relativeColorimetric",
                    },
                    linear: null,
                },
                justification: null,
                defaultStyle: null,
                calloutLine: null,
                lineEnding: null,
                borderEffect: null,
                rectDifferences: null,
            },
        },
        null,
    );

const shape = (id, story, x) => ({
    shape: {
        id,
        nonVisual: { name: "t", description: null, title: null, hidden: false, placeholder: null },
        properties: {
            transform: {
                offset: { x, y: 20 },
                extents: { width: 40, height: 40 },
                rotation: 0,
                flipH: false,
                flipV: false,
            },
            geometry: { preset: { preset: "ellipse", adjustValues: [] } },
            fill: null,
            line: null,
            effects: null,
            scene3d: null,
            shape3d: null,
        },
        style: null,
        textBody: {
            properties: {},
            story: { id: story, blocks: [{ paragraph: { properties: { props: [] }, spans: [] } }] },
        },
        textTransform: null,
        diagramPoint: null,
    },
});
const portableIds = (e) => {
    const pages = J(e, named(e, /^parts\/page_list_/)[0]).pages;
    const objects = (p) =>
        J(e, `parts/page_contents_${J(e, `parts/page_${p}.json`).contents}.json`).objects.map((o) => o.id);
    const usable = pages.filter((p) => objects(p).length >= 3);
    return { pages, usable, objects: Object.fromEntries(usable.map((p) => [p, objects(p)])) };
};
const P = (c) => ({ portable: c });
/**
 * Per document type: its file, the ids its edits need, and real edits, as an editor sends them. `first` leaves
 * pages, stories and lists untouched, and each `one` and `two` of a round is a first edit there, on the same page,
 * for two editors: what makes each author its own copy of that page.
 */
export const DOCUMENTS = {
    portable: {
        // Back past the added font: the editor that undid it and one opened later both hold it removed.
        undoSteps: 3,
        bothEditsHold(e, { usable }, round) {
            const page = J(e, `parts/page_${usable[2 + round]}.json`);
            const list = J(e, `parts/page_annotation_list_${page.annotations}.json`);
            const n = (list.annotations ?? list.ids ?? []).length;
            return {
                ok: n >= 3,
                detail: `${n} annotations on that page; the rebased editor added 1, the live editor 2`,
            };
        },
        file: "pdf/nasa-hubble-focus-black-holes-ebook.pdf",
        ids: portableIds,
        first(s, { usable, objects }) {
            run(
                s,
                "translate",
                P({
                    editObject: {
                        page: usable[0],
                        command: { translateObjects: { ids: objects[usable[0]].slice(0, 2), dx: 10, dy: -7 } },
                    },
                }),
            );
            run(
                s,
                "style",
                P({
                    editObject: {
                        page: usable[0],
                        command: {
                            setNonstrokingStyle: {
                                ids: objects[usable[0]].slice(2, 3),
                                style: { brush: { solid: RED }, alpha: 1, overprint: false },
                            },
                        },
                    },
                }),
            );
            run(
                s,
                "note",
                P({
                    editAnnotation: {
                        page: usable[1],
                        command: { insertAnnotations: { index: 4294967295, annotations: [note(100, 100)] } },
                    },
                }),
            );
        },
        one(s, { usable, objects }, round) {
            const page = usable[2 + round];
            run(
                s,
                "C translate",
                P({
                    editObject: {
                        page,
                        command: { translateObjects: { ids: objects[page].slice(0, 1), dx: 3, dy: 3 } },
                    },
                }),
            );
            run(
                s,
                "C note",
                P({
                    editAnnotation: {
                        page,
                        command: { insertAnnotations: { index: 4294967295, annotations: [note(200, 200)] } },
                    },
                }),
            );
            if (round === 0) run(s, "C insertPage", P({ editPage: { command: { insertPage: { index: 0 } } } }));
        },
        two(s, { usable, objects }, round) {
            const page = usable[2 + round];
            run(
                s,
                "D style",
                P({
                    editObject: {
                        page,
                        command: {
                            setNonstrokingStyle: {
                                ids: objects[page].slice(1, 2),
                                style: { brush: { solid: RED }, alpha: 1, overprint: false },
                            },
                        },
                    },
                }),
            );
            run(
                s,
                "D note",
                P({
                    editAnnotation: {
                        page,
                        command: { insertAnnotations: { index: 4294967295, annotations: [note(300, 300)] } },
                    },
                }),
            );
            const font = s.mintId();
            run(s, "D font", P({ addStandardFont: { id: font, font: "helvetica" } }));
            run(
                s,
                "D freeText",
                P({
                    editAnnotation: {
                        page,
                        command: { insertAnnotations: { index: 4294967295, annotations: [freeText(font)] } },
                    },
                }),
            );
            if (round === 0)
                run(s, "D rotate", P({ editPage: { command: { rotatePages: { ids: [page], clockwise: true } } } }));
        },
    },
    presentation: {
        bothEditsHold(e, { slides }, round) {
            const text = e.get(`parts/slide_${slides[2 + round]}.json`).toString();
            const c = text.includes("CCC"),
                d = text.includes("DDD");
            return { ok: c && d, detail: `the rebased editor's typing there: ${c}; the live editor's: ${d}` };
        },
        file: "pptx/james-webb-space-telescope.pptx",
        ids(e) {
            const slides = J(e, named(e, /^parts\/presentation_/)[0]).slideIdList.ids;
            const kids = (id) =>
                J(e, `parts/slide_${id}.json`)
                    .common.shapeTree.root.group.children.map((k) => k.shape)
                    .filter(Boolean);
            const texted = (id) =>
                kids(id)
                    .filter((k) => k.textBody?.story?.blocks?.some((b) => b.paragraph?.spans?.length))
                    .map((k) => k.id);
            return {
                slides,
                shapes: Object.fromEntries(slides.map((x) => [x, kids(x).map((k) => k.id)])),
                text: Object.fromEntries(slides.map((x) => [x, texted(x)])),
            };
        },
        first(s, { slides, shapes }) {
            run(s, "translate", {
                presentation: {
                    editShape: {
                        container: { slide: slides[0] },
                        command: { translateShapes: { ids: shapes[slides[0]].slice(0, 2), dx: 12, dy: 4 } },
                    },
                },
            });
        },
        one(s, { slides, shapes, text }, round) {
            const slide = slides[2 + round];
            run(s, "C translate", {
                presentation: {
                    editShape: {
                        container: { slide },
                        command: { translateShapes: { ids: shapes[slide].slice(0, 1), dx: 2, dy: 2 } },
                    },
                },
            });
            if (text[slide][0])
                run(s, "C typing", {
                    presentation: {
                        editShape: {
                            container: { slide },
                            command: { editShapeText: { id: text[slide][0], command: insertText(0, "CCC") } },
                        },
                    },
                });
            if (round === 0)
                run(s, "C insertSlide", { presentation: { editSlide: { command: { insertSlide: { index: 1 } } } } });
        },
        two(s, { slides, shapes, text }, round) {
            const slide = slides[2 + round];
            run(s, "D rotate", {
                presentation: {
                    editShape: {
                        container: { slide },
                        command: { rotateShapes: { ids: shapes[slide].slice(1, 2), angle: 10 } },
                    },
                },
            });
            if (text[slide][0])
                run(s, "D typing", {
                    presentation: {
                        editShape: {
                            container: { slide },
                            command: { editShapeText: { id: text[slide][0], command: insertText(0, "DDD") } },
                        },
                    },
                });
            const [id, story] = [s.mintId(), s.mintId()];
            run(s, "D new shape", {
                presentation: {
                    editShape: {
                        container: { slide },
                        command: { insertShapes: { parent: null, index: 4294967295, nodes: [shape(id, story, 30)] } },
                    },
                },
            });
        },
        image: true,
    },
    wordprocessing: {
        file: "docx/nasa-artemis-status-report.docx",
        ids(e) {
            const d = J(e, named(e, /^parts\/document_/)[0]);
            return {
                story: d.sections[0].story.id,
                section: d.sections[0].id,
                margins: d.sections[0].properties?.pageMargins ?? null,
            };
        },
        first(s, { section, margins }) {
            if (margins)
                run(s, "margins", {
                    wordprocessing: {
                        setSectionPageMargins: { section, margins: { ...margins, top: margins.top + 1 } },
                    },
                });
        },
        one(s, { story }, round) {
            run(s, "C typing", {
                wordprocessing: { editSectionText: { story, command: insertText(40 + round * 100, "CCC") } },
            });
        },
        two(s, { story }, round) {
            run(s, "D typing", {
                wordprocessing: { editSectionText: { story, command: insertText(80 + round * 100, "DDD") } },
            });
            run(s, "D italic", {
                wordprocessing: {
                    editSectionText: {
                        story,
                        command: {
                            patchCharacterProperties: {
                                range: { start: 90 + round * 100, end: 95 + round * 100 },
                                properties: { props: [{ italic: true }] },
                            },
                        },
                    },
                },
            });
        },
    },
    spreadsheet: {
        file: "xlsx/nasa_asp_schedule_2026_01.xlsx",
        ids(e) {
            const w = J(e, "parts/sheet_0-1.json").worksheet;
            // Each row's cells: the worksheet's `cells`, or, from an engine
            // before rows carried their data on their runs, each row record's.
            const cells =
                w.cells ?? Object.fromEntries(Object.entries(w.rows).map(([row, record]) => [row, record.cells ?? {}]));
            const columns = [...new Set(Object.values(cells).flatMap((held) => Object.keys(held)))];
            return { sheet: w.id, rows: Object.keys(cells), columns };
        },
        first(s, { sheet, rows, columns }) {
            run(s, "setCells", {
                spreadsheet: {
                    editWorksheet: {
                        sheet,
                        command: {
                            setCells: {
                                cells: [
                                    {
                                        cell: { row: rows[1], column: columns[1] },
                                        content: { value: { number: 42 } },
                                    },
                                ],
                            },
                        },
                    },
                },
            });
        },
        one(s, { sheet, rows, columns }, round) {
            run(s, "C setCells", {
                spreadsheet: {
                    editWorksheet: {
                        sheet,
                        command: {
                            setCells: {
                                cells: [
                                    {
                                        cell: { row: rows[3 + round * 2], column: columns[3] },
                                        content: { value: { number: 7 + nextValue() } },
                                    },
                                ],
                            },
                        },
                    },
                },
            });
            if (round === 0)
                run(s, "C insertWorksheet", {
                    spreadsheet: { editWorkbook: { command: { insertWorksheet: { index: 1, name: "Added" } } } },
                });
        },
        two(s, { sheet, rows, columns }, round) {
            run(s, "D setCells", {
                spreadsheet: {
                    editWorksheet: {
                        sheet,
                        command: {
                            setCells: {
                                cells: [
                                    {
                                        cell: { row: rows[4 + round * 2], column: columns[4] },
                                        content: { value: { text: `D${nextValue()}` } },
                                    },
                                ],
                            },
                        },
                    },
                },
            });
            if (round === 0)
                run(s, "D renameSheet", {
                    spreadsheet: { editWorkbook: { command: { renameSheet: { id: sheet, name: "Renamed" } } } },
                });
        },
    },
    image: {
        file: "pages.tiff",
        bytes: multiPageTiff(),
        ids(e) {
            return { pages: J(e, named(e, /^parts\/image_manifest_/)[0]).pages.map((p) => p.id) };
        },
        first(s, { pages }) {
            run(s, "rotatePages", {
                image: { editPage: { command: { rotatePages: { ids: [pages[0]], clockwise: true } } } },
            });
        },
        one(s, { pages }, round) {
            const [id, story] = [s.mintId(), s.mintId()];
            run(s, "C markup", {
                image: {
                    editShape: {
                        page: pages[1 + round],
                        command: { insertShapes: { parent: null, index: 4294967295, nodes: [shape(id, story, 10)] } },
                    },
                },
            });
        },
        two(s, { pages }, round) {
            const [id, story] = [s.mintId(), s.mintId()];
            run(s, "D markup", {
                image: {
                    editShape: {
                        page: pages[1 + round],
                        command: { insertShapes: { parent: null, index: 4294967295, nodes: [shape(id, story, 50)] } },
                    },
                },
            });
        },
    },
};
