// Branches on every document type with comments (scripts/e2e.mjs): a document
// branched at a checkpoint between others, a reviewer commenting in the branch
// while the document goes on being edited — what was commented on moved, and a
// commented passage, shape or row deleted — and the branch merged into main: with
// no cut, past a cut of main's log, of the branch's, and of both, main cut before
// the branch starts too. docs/design/node-branches.md says what should happen.
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { DOCUMENTS, png, run } from "./e2e-documents.mjs";
import {
    check,
    converge,
    cutsOf,
    differ,
    finish,
    modelOf,
    onServer,
    Peer,
    remote,
    serve,
    served,
    sleep,
    temporaryStore,
    unzip,
    upload,
} from "./e2e-harness.mjs";

/** Cut as soon as a session idles out, however little that saves. */
const CUTS_AT_ONCE = { sessionTimeoutMs: 400, cutMinSavedBytes: 0 };

const only = process.argv[2];

const J = (entries, name) => JSON.parse(entries.get(name).toString());
const named = (entries, pattern) => [...entries.keys()].filter((name) => pattern.test(name));
const typed = (text) => ({
    blocks: [{ paragraph: { properties: { props: [] }, spans: [{ regular: { properties: { props: [] }, text } }] } }],
});
const replaceText = (start, end, text) => ({
    replaceText: { range: { start, end }, fragment: text === "" ? { blocks: [] } : typed(text) },
});

/** A comment as the reviewer writes one: its ids minted by the editor writing it. */
const draft = (s, body) => ({
    id: s.mintId(),
    story: s.mintId(),
    author: { name: "Reviewer" },
    created: "2026-11-12T10:00:00+00:00",
    body: `<p>${body}</p>`,
});

/** A PDF sticky note holding `contents`, as the Annotate tab's Note writes one. */
const note = (contents) => ({
    rect: { x0: 100, y0: 100, x1: 116, y1: 116 },
    contents,
    name: null,
    modified: "2026-11-12T10:00:00Z",
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
    color: { components: [1, 0.8, 0], colorSpace: "deviceRgb" },
    border: null,
    borderStyle: null,
    appearance: null,
    optionalContent: null,
    kind: {
        text: {
            markup: {
                author: "Reviewer",
                opacity: null,
                subject: null,
                richContents: null,
                replyType: null,
                intent: null,
                created: "2026-11-12T10:00:00Z",
                popup: null,
                inReplyTo: null,
            },
            open: null,
            icon: "comment",
            state: null,
            stateModel: null,
        },
    },
});

/** The text a comment's marks bracket in `story`, or `null` where it has none. */
function bracketed(story, comment) {
    let text = "";
    let inside = false;
    let found = false;
    for (const block of story.blocks) {
        for (const span of block.paragraph?.spans ?? []) {
            if (span.commentRangeStart?.comment === comment) [inside, found] = [true, true];
            else if (span.commentRangeEnd?.comment === comment) return text;
            else if (inside && span.regular) text += span.regular.text;
        }
        if (inside) text += "\n";
    }
    return found ? text : null;
}

/** A shape of a slide part, by id, wherever it sits in the shape tree. */
function shapeOf(slide, id) {
    const walk = (nodes) => {
        for (const node of nodes) {
            if (node.shape?.id === id) return node.shape;
            const inside = node.group && walk(node.group.children);
            if (inside) return inside;
        }
        return undefined;
    };
    return walk(slide.common.shapeTree.root.group.children);
}

/**
 * Per document type: the reviewer's two comments in the branch, each answering
 * what the comment's place is read by — the second made after a cut of the
 * branch's log, where there is one — on something the document then moves, or
 * `deleted`; what the document does meanwhile; and where a comment stands in a
 * package.
 */
const REVIEWS = {
    wordprocessing: {
        comments: [
            {
                body: "moves",
                make(s, ids) {
                    const comment = draft(s, "moves");
                    run(s, "insertComment", {
                        wordprocessing: { insertComment: { story: ids.story, range: { start: 10, end: 20 }, comment } },
                    });
                    return comment.id;
                },
            },
            {
                body: "doomed",
                deleted: true,
                make(s, ids) {
                    const comment = draft(s, "doomed");
                    run(s, "insertComment", {
                        wordprocessing: { insertComment: { story: ids.story, range: { start: 60, end: 70 }, comment } },
                    });
                    return comment.id;
                },
            },
        ],
        meanwhile(s, ids) {
            run(s, "delete the doomed comment's text", {
                wordprocessing: { editSectionText: { story: ids.story, command: replaceText(55, 75, "") } },
            });
            run(s, "type before the moving comment's text", {
                wordprocessing: { editSectionText: { story: ids.story, command: replaceText(0, 0, "NEW TEXT ") } },
            });
        },
        /** The text its marks bracket. */
        async place(base, id, comment) {
            const entries = await unzip(await served(base, id));
            return bracketed(J(entries, named(entries, /^parts\/document_\d/)[0]).sections[0].story, comment);
        },
        /** Kept, where its text was: its marks together. */
        deletedHolds: (place) => place === "",
    },
    presentation: {
        comments: [
            {
                body: "moves",
                make(s, ids) {
                    const comment = draft(s, "moves");
                    const slide = ids.slides[2];
                    run(s, "insertComment", {
                        presentation: {
                            insertComment: {
                                slide,
                                place: { text: { shape: ids.text[slide][0], range: { start: 2, end: 8 } } },
                                comment,
                            },
                        },
                    });
                    // A picture: an opaque part, which the merge has to bring along.
                    s.insertImage(s.addViewer(), png, "image/png");
                    return comment.id;
                },
            },
            {
                body: "doomed",
                deleted: true,
                make(s, ids) {
                    const comment = draft(s, "doomed");
                    const slide = ids.slides[3];
                    run(s, "insertComment", {
                        presentation: {
                            insertComment: { slide, place: { shape: { shape: ids.shapes[slide][0] } }, comment },
                        },
                    });
                    return comment.id;
                },
            },
        ],
        meanwhile(s, ids) {
            const [onText, onShape] = [ids.slides[2], ids.slides[3]];
            run(s, "type before the moving comment's text", {
                presentation: {
                    editShape: {
                        container: { slide: onText },
                        command: { editShapeText: { id: ids.text[onText][0], command: replaceText(0, 0, "NEW ") } },
                    },
                },
            });
            run(s, "insert a slide before it", {
                presentation: { editSlide: { command: { insertSlide: { index: 0 } } } },
            });
            run(s, "delete the doomed comment's shape", {
                presentation: {
                    editShape: {
                        container: { slide: onShape },
                        command: { deleteShapes: { ids: [ids.shapes[onShape][0]] } },
                    },
                },
            });
        },
        /** The slide's place in the deck, and the text its marks bracket, or the shape it is on. */
        async place(base, id, comment) {
            const entries = await unzip(await served(base, id));
            const slides = J(entries, named(entries, /^parts\/presentation_/)[0]).slideIdList.ids;
            for (const name of named(entries, /^parts\/slide_comment_list_/)) {
                const at = J(entries, name).comments.find((held) => held.comment.id === comment);
                if (!at) continue;
                const list = name.slice("parts/slide_comment_list_".length, -".json".length);
                const slide = slides.find((s) => entries.get(`parts/slide_${s}.json`)?.toString().includes(list));
                const where = `slide ${slides.indexOf(slide)}`;
                if (at.anchor.shape) return `${where}, shape ${at.anchor.shape.shape}`;
                const shape = shapeOf(J(entries, `parts/slide_${slide}.json`), at.anchor.text.shape);
                return `${where}, "${bracketed(shape.textBody.story, comment)}"`;
            }
            return null;
        },
        /** The same text, its slide one further on. */
        moved: (before, after) =>
            before !== null && after === before.replace(/^slide (\d+)/, (_, index) => `slide ${Number(index) + 1}`),
        /** The picture, there to be shown. */
        async extra(base, id) {
            return [...(await unzip(await served(base, id)))].some(([n, b]) => n.startsWith("blobs/") && b.equals(png));
        },
    },
    spreadsheet: {
        comments: [
            { body: "moves", make: (s, ids) => cellComment(s, ids, ids.rows[5], "moves") },
            { body: "doomed", deleted: true, make: (s, ids) => cellComment(s, ids, ids.rows[8], "doomed") },
        ],
        meanwhile(s, ids) {
            run(s, "insert a row above the moving comment's cell", {
                spreadsheet: {
                    editWorksheet: {
                        sheet: ids.sheet,
                        command: {
                            insertRows: { before: ids.rows[5], rows: { first: s.mintId(), count: 1, track: {} } },
                        },
                    },
                },
            });
            run(s, "delete the doomed comment's row", {
                spreadsheet: {
                    editWorksheet: {
                        sheet: ids.sheet,
                        command: {
                            deleteRows: {
                                first: ids.rows[8],
                                last: ids.rows[8],
                                refill: { first: s.mintId(), count: 1, track: {} },
                            },
                        },
                    },
                },
            });
        },
        /** The cell a workbook saved from it puts the comment in, found by its body. */
        async place(base, id, comment, body) {
            const saved = await fetch(`${base}/documents/${id}/file.xlsx`);
            if (!saved.ok) return `file.xlsx ${saved.status}`;
            for (const [name, bytes] of await unzip(new Uint8Array(await saved.arrayBuffer()))) {
                if (!/^xl\/threadedComments\//.test(name)) continue;
                const threads =
                    /<(?:\w+:)?threadedComment [^>]*ref="(\w+)"[^>]*>.*?<(?:\w+:)?text>(.*?)<\/(?:\w+:)?text>/gs;
                for (const [, ref, text] of bytes.toString().matchAll(threads)) {
                    if (text === body) return ref;
                }
            }
            return null;
        },
        /** One row further down. */
        moved: (before, after) => before !== null && after === before.replace(/\d+$/, (row) => String(Number(row) + 1)),
    },
    // No note on a page the document deletes: what only a deleted page reached
    // is kept by some sessions' saves and left out by others', with no branch,
    // so no two models compare.
    portable: {
        comments: [
            { body: "moves", make: (s, ids) => pageNote(s, ids.usable[2], "moves") },
            { body: "moves too", make: (s, ids) => pageNote(s, ids.usable[3], "moves too") },
        ],
        meanwhile(s) {
            run(s, "insert a page before", { portable: { editPage: { command: { insertPage: { index: 0 } } } } });
        },
        /** The page the note, found by its contents, is on, and its place among the pages. */
        async place(base, id, contents) {
            const entries = await unzip(await served(base, id));
            const pages = J(entries, named(entries, /^parts\/page_list_/)[0]).pages;
            for (const page of pages) {
                const list = J(entries, `parts/page_${page}.json`).annotations;
                if (!list) continue;
                const held = J(entries, `parts/page_annotation_list_${list}.json`);
                for (const annotation of held.annotations ?? held.ids ?? []) {
                    const part = entries.get(`parts/annotation_${annotation}.json`);
                    if (part && JSON.parse(part.toString()).contents === contents)
                        return `page ${pages.indexOf(page)} (${page})`;
                }
            }
            return null;
        },
        moved: (before, after) =>
            before !== null && after === before.replace(/^page (\d+)/, (_, index) => `page ${Number(index) + 1}`),
    },
};

/** A comment on the cell of row `row` in the third column, as the reviewer writes it; its id. */
function cellComment(s, ids, row, body) {
    const comment = draft(s, body);
    run(s, "insertComment", {
        spreadsheet: { insertComment: { sheet: ids.sheet, cell: { row, column: ids.columns[2] }, comment } },
    });
    return comment.id;
}

/** A sticky note holding `contents` on page `page`; its contents, by which it is found. */
function pageNote(s, page, contents) {
    run(s, `note ${contents}`, {
        portable: {
            editAnnotation: {
                page,
                command: { insertAnnotations: { index: 4294967295, annotations: [note(contents)] } },
            },
        },
    });
    return contents;
}

/** Wait for the cuts of branch `branch` of the document kept at `kept` to be as `done` wants them, and check they came to be. */
async function cutComes(kept, branch, done, label) {
    let cuts = await cutsOf(kept, branch);
    for (let i = 0; i < 100 && !done(cuts); i++) {
        await sleep(100);
        cuts = await cutsOf(kept, branch);
    }
    check(label, done(cuts), JSON.stringify(cuts));
}

const post = (base, path) => fetch(`${base}${path}`, { method: "POST" });

/** Which lines are cut after the merge base: main's, the branch's. */
const VARIANTS = [
    { name: "no cut", main: false, branch: false },
    { name: "main's log cut since", main: true, branch: false },
    { name: "the branch's log cut", main: false, branch: true },
    { name: "both logs cut", main: true, branch: true },
];

for (const [type, review] of Object.entries(REVIEWS)) {
    if (only && only !== type) continue;
    const t = DOCUMENTS[type];
    for (const variant of VARIANTS) {
        console.log(`\n[e2e] === ${type} (${t.file}), ${variant.name}`);
        const cutting = variant.main || variant.branch;
        const store = await temporaryStore();
        const server = await serve(store.directory, cutting ? CUTS_AT_ONCE : {});
        const { base } = server;
        const id = await upload(base, t);
        const kept = join(store.directory, id);
        const ids = t.ids(await unzip(await served(base, id)));

        // main's history: an edit, a cut where there are cuts, the version the
        // branch starts at, another edit and another version, so the branch
        // starts between two.
        let a = new Peer(base, id, await remote(base, id));
        await a.joined;
        t.first(a.session, ids);
        a.send();
        await onServer("main takes its first edits", base, id, await modelOf(a.session.saveToPackage()));
        if (cutting) {
            await a.close();
            await cutComes(kept, "main", (cuts) => cuts.length > 0, "main's log is cut before the branch starts");
            a = new Peer(base, id, await remote(base, id));
            await a.joined;
        }
        const at = (await (await post(base, `/documents/${id}/checkpoints`)).json()).version;
        const atVersion = await modelOf((await remote(base, id, at)).saveToPackage());
        t.two(a.session, ids, 3);
        a.send();
        await onServer("and more after that version", base, id, await modelOf(a.session.saveToPackage()));
        await post(base, `/documents/${id}/checkpoints`);

        const started = await post(base, `/documents/${id}/versions/${at}/branches`);
        const { branch } = await started.json();
        check("a branch starts at that version", started.status === 201 && typeof branch === "string");
        const { branches } = await (await fetch(`${base}/documents/${id}/branches`)).json();
        check(
            "the document lists it, with where it starts",
            branches.some((kept) => kept.branch === branch && kept.base === at),
            JSON.stringify(branches),
        );
        // A branch's routes are the document's beneath `branches/:branch`.
        const onBranch = `${id}/branches/${branch}`;
        const opened = differ(atVersion, await modelOf((await remote(base, onBranch)).saveToPackage()));
        check("the branch opens as the document stood at that version", opened.length === 0, opened.join(", "));

        // The reviewer comments in the branch, once before a cut of its log, where
        // there is one, and once after; main goes on being edited.
        let reviewer = new Peer(base, onBranch, await remote(base, onBranch));
        const marketer = new Peer(base, id, await remote(base, id));
        await Promise.all([reviewer.joined, marketer.joined]);
        const comments = [review.comments[0].make(reviewer.session, ids)];
        reviewer.send();
        await onServer("the branch takes a comment", base, onBranch, await modelOf(reviewer.session.saveToPackage()));
        if (variant.branch) {
            await reviewer.close();
            await cutComes(kept, branch, (cuts) => cuts.length > 0, "the branch's log is cut");
            reviewer = new Peer(base, onBranch, await remote(base, onBranch));
            await reviewer.joined;
        }
        comments.push(review.comments[1].make(reviewer.session, ids));
        reviewer.send();
        const reviewed = await modelOf(reviewer.session.saveToPackage());
        await onServer("and another", base, onBranch, reviewed);
        const placesIn = (path) =>
            Promise.all(review.comments.map(({ body }, i) => review.place(base, path, comments[i], body)));
        const asReviewed = await placesIn(onBranch);
        check(
            "each comment stands where the reviewer made it",
            asReviewed.every((place) => place !== null),
        );
        review.meanwhile(marketer.session, ids);
        marketer.send();
        await onServer("main takes its own edits meanwhile", base, id, await modelOf(marketer.session.saveToPackage()));
        await converge("the editors already joined get them", a.session, marketer.session);

        let live = marketer;
        if (variant.main) {
            // Nobody connected: main's idle session cuts its log.
            await Promise.all([a.close(), marketer.close()]);
            await cutComes(
                kept,
                "main",
                (cuts) => cuts.some((cut) => cut > at),
                "main's log is cut past the branch's start",
            );
            live = new Peer(base, id, await remote(base, id));
            await live.joined;
        }
        check(
            "the logs are cut as the case says",
            (await cutsOf(kept, "main")).some((cut) => cut > at) === variant.main &&
                (await cutsOf(kept, branch)).length > 0 === variant.branch,
        );

        const merge = () => post(base, `/documents/${id}/branches/main/merge?from=${branch}`);
        const merged = await merge();
        check("the branch merges into main", merged.status === 204, merged.status === 204 ? "" : await merged.text());
        const now = await placesIn(id);
        review.comments.forEach(({ body, deleted }, i) => {
            const detail = `${JSON.stringify(asReviewed[i])} in the branch, ${JSON.stringify(now[i])} merged`;
            if (!deleted) {
                const moved = review.moved ? review.moved(asReviewed[i], now[i]) : now[i] === asReviewed[i];
                check(`the comment "${body}" stands where what it is on moved to`, moved && now[i] !== null, detail);
            } else if (review.deletedHolds) {
                check(
                    `the comment "${body}" on what was deleted stays where it was`,
                    review.deletedHolds(now[i]),
                    detail,
                );
            } else {
                console.log(`[e2e] note  the comment "${body}" on what was deleted: ${detail}`);
            }
        });
        if (review.extra) check("the picture the reviewer added comes along", await review.extra(base, id));
        const mergedModel = await modelOf(await served(base, id));
        await converge("an editor joined to main gets the merge", live.session, await remote(base, id));
        check(
            "and stays connected, refusing nothing",
            live.connected && live.errors.length === 0,
            live.errors.join("; "),
        );
        const fresh = differ(mergedModel, await modelOf((await remote(base, id)).saveToPackage()));
        check("a fresh open holds what the server does", fresh.length === 0, fresh.join(", "));

        // Merged again: with nothing moved, the CRDT skips what main holds; once
        // moved, main holds the edits under ids of their own, so it is refused.
        const again = await merge();
        if (cutting) {
            check(
                "moved, a branch merges no more",
                again.status === 409 && (await again.json()).error === "cannotMergeAgain",
                String(again.status),
            );
        } else {
            const unchanged = differ(mergedModel, await modelOf(await served(base, id)));
            check(
                "merged again, nothing changes",
                again.status === 204 && unchanged.length === 0,
                unchanged.join(", "),
            );
        }
        await live.close();
        const branchNow = differ(reviewed, await modelOf(await served(base, onBranch)));
        check("the branch is left as it was", branchNow.length === 0, branchNow.join(", "));
        check("and nothing else is kept", JSON.stringify(await readdir(store.directory)) === JSON.stringify([id]));
        const { version } = await (await post(base, `/documents/${id}/checkpoints`)).json();
        const alone = differ(mergedModel, await modelOf((await remote(base, id, version)).saveToPackage()));
        check("a version after the merge holds it, opened on its own", alone.length === 0, alone.join(", "));

        await reviewer.close();
        if (!variant.main) await a.close();
        await server.close();
        await store.remove();
    }
}
finish();
