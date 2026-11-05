// The log cut on every document type (scripts/e2e.mjs): the server's own cut, when
// its idle session closes, then real editors on the cut log and real editors back
// from behind it, with and without unsent edits, through `4003` and catch-up.
// docs/design/node-log-cut.md says what should happen.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fetchCutLogs } from "../packages/udoc-ui/dist/app/collaboration.js";
import { DOCUMENTS, png, run } from "./e2e-documents.mjs";
import {
    check,
    converge,
    descriptionOf,
    differ,
    finish,
    modelOf,
    newSession,
    onServer,
    Peer,
    remote,
    serve,
    served,
    sleep,
    temporaryStore,
    undoOwnEdits,
    unzip,
    upload,
} from "./e2e-harness.mjs";

/** Cut as soon as a session idles out, however little that saves. */
const CUTS_AT_ONCE = { sessionTimeoutMs: 400, cutMinSavedBytes: 0 };

const only = process.argv[2];

/** The versions the document's log was cut at, as the store keeps them. */
async function cutsOf(kept) {
    try {
        return JSON.parse(await readFile(join(kept, "cuts.json"), "utf8"));
    } catch {
        return [];
    }
}

/** Check the log comes to be cut `count` times. */
async function cutComes(kept, count, label) {
    let cuts = [];
    for (let i = 0; i < 120 && cuts.length < count; i++) {
        await sleep(100);
        cuts = await cutsOf(kept);
    }
    check(label, cuts.length === count, `cuts ${JSON.stringify(cuts)}`);
}

/** Check an editor behind a cut is refused with `4003`. */
async function refusedBehindCut(label, base, id, session) {
    const refused = await new Peer(base, id, session).joined.then(
        () => undefined,
        (error) => error.message,
    );
    check(label, refused?.includes("4003") === true, String(refused));
}

/** What an editor does on `4003`, through udoc-ui's own fetch of what it is behind. */
async function catchUp(label, base, id, session) {
    const url = new URL(`${base}/documents/${id}/collaboration`);
    const { logs, version } = await fetchCutLogs(url, session.baselineVersion() ?? 0);
    try {
        session.catchUp(logs, version);
        return check(`${label}: caught up through ${logs.length} logs`, true);
    } catch (error) {
        return check(
            `${label}: caught up through ${logs.length} logs`,
            false,
            String(error?.message ?? error).slice(0, 200),
        );
    }
}

/** Check `session` can join again, resolving with its connection. */
async function rejoin(base, id, session) {
    const peer = new Peer(base, id, session);
    await peer.joined.then(
        () => check("and it rejoins", true),
        (error) => check("and it rejoins", false, error.message),
    );
    return peer;
}

for (const [type, t] of Object.entries(DOCUMENTS)) {
    if (only && only !== type) continue;
    console.log(`\n[e2e] === ${type} (${t.file})`);
    const store = await temporaryStore();
    let server = await serve(store.directory, CUTS_AT_ONCE);
    const id = await upload(server.base, t);
    const kept = join(store.directory, id);
    const ids = t.ids(await unzip(await readFile(join(kept, "checkpoints/v0.udoc"))));

    // Open before the first cut and kept open: `old` synced, `unsent` with an edit
    // it never sends, `blank` knowing nothing past the import, and two more with
    // an edit each that will race a live editor's.
    const a = new Peer(server.base, id, await remote(server.base, id));
    const old = new Peer(server.base, id, await remote(server.base, id));
    const blank = await remote(server.base, id);
    const unsent = await remote(server.base, id);
    const racers = [await remote(server.base, id), await remote(server.base, id)];
    await Promise.all([a.joined, old.joined]);
    t.first(a.session, ids);
    if (t.image) a.session.insertImage(a.session.addViewer(), png, "image/png");
    a.send();
    const firstModel = await modelOf(a.session.saveToPackage());
    await onServer("the server takes the first edits", server.base, id, firstModel);
    await converge("an open editor takes them", old.session, a.session);
    t.one(unsent, ids, 3);
    if (t.image) unsent.insertImage(unsent.addViewer(), png, "image/png");
    t.one(racers[0], ids, 4);
    t.one(racers[1], ids, 5);
    await Promise.all([a.close(), old.close()]);

    // The first cut, the server's own, with nobody connected.
    await cutComes(kept, 1, "the idle session's log is cut");
    const atCut = await descriptionOf(server.base, id);
    check(
        "the cut is a checkpoint, and the description is at it",
        atCut.baselineVersion === 1 && atCut.baselineFrontier?.length === 1,
        JSON.stringify(atCut).slice(0, 110),
    );
    const onCut = differ(firstModel, await modelOf((await remote(server.base, id)).saveToPackage()));
    check("an editor opened on the cut log: the same model", onCut.length === 0, onCut.join(", "));

    // Two editors on the cut log, each a first edit on the same page.
    const c = new Peer(server.base, id, await remote(server.base, id));
    const d = new Peer(server.base, id, await remote(server.base, id));
    await Promise.all([c.joined, d.joined]);
    t.one(c.session, ids, 0);
    t.two(d.session, ids, 0);
    if (t.image) c.session.insertImage(c.session.addViewer(), png, "image/png");
    if (type === "spreadsheet") {
        run(c.session, "renameSheet", {
            spreadsheet: { editWorkbook: { command: { renameSheet: { id: ids.sheet, name: "Renamed" } } } },
        });
    }
    c.send();
    d.send();
    await converge("two editors merge their first copies on the cut log", c.session, d.session);
    check("the server keeps both connected", c.connected && d.connected);
    check(
        "neither refuses the other's patch",
        c.errors.length + d.errors.length === 0,
        [...c.errors, ...d.errors].join("; "),
    );
    const merged = await modelOf(c.session.saveToPackage());
    check("their edits changed the document", differ(firstModel, merged).length > 0);
    await onServer("the server has the same model", server.base, id, merged);

    // Undo on the cut log.
    const undos = undoOwnEdits(d.session, t);
    d.send();
    check("an editor can undo its own edits on the cut log", undos > 0);
    await converge("the undo reaches the other editor", c.session, d.session);
    await onServer("the undo reaches the server", server.base, id, await modelOf(c.session.saveToPackage()));

    // A checkpoint with editors connected: it changes nothing for them, and cuts nothing.
    const checkpoint = await fetch(`${server.base}/documents/${id}/checkpoints`, { method: "POST" });
    const { version } = await checkpoint.json();
    check("a checkpoint with editors connected", checkpoint.status === 201 && version === 2, String(version));
    check("and no cut", (await cutsOf(kept)).length === 1 && c.connected && d.connected);
    t.two(c.session, ids, 1);
    c.send();
    await converge("they go on editing past it", c.session, d.session);
    await onServer("the server takes that too", server.base, id, await modelOf(c.session.saveToPackage()));

    // The editor that was open across the cut, nothing unsent: refused, catches up, rejoins.
    await refusedBehindCut("an editor from before the cut is closed with 4003", server.base, id, old.session);
    const undoBefore = old.session.canUndo();
    if (await catchUp("that editor", server.base, id, old.session)) {
        check("with nothing unsent its undo stack stays", old.session.canUndo() === undoBefore);
        const rejoined = await rejoin(server.base, id, old.session);
        await sleep(200);
        await converge("and holds the document", old.session, c.session);
        t.two(old.session, ids, 2);
        rejoined.send();
        await converge("and its first copy merges", old.session, c.session);
        check("and it stays connected", rejoined.connected, rejoined.errors.join("; "));
        await rejoined.close();
    }

    // The editor with an edit it never sent: rebased.
    await refusedBehindCut("an editor with unsent edits is closed with 4003", server.base, id, unsent);
    if (await catchUp("the unsent editor", server.base, id, unsent)) {
        const rejoined = await rejoin(server.base, id, unsent);
        await sleep(200);
        rejoined.send();
        await converge("its unsent edits reach everyone", unsent, c.session);
        check("and it stays connected", rejoined.connected, rejoined.errors.join("; "));
        check("its undo stack goes", !unsent.canUndo());
        await rejoined.close();
    }

    // The race: a rebased page copy against a live editor's first copy of that
    // page, both already authored, each order of arriving.
    for (const [round, rebasedFirst] of [
        [4, false],
        [5, true],
    ]) {
        const racer = racers[round - 4];
        const order = rebasedFirst ? "the rebased copy arrives first" : "the live copy arrives first";
        await refusedBehindCut(`race, ${order}: the editor is closed with 4003`, server.base, id, racer);
        if (!(await catchUp(`race, ${order}`, server.base, id, racer))) continue;
        t.two(c.session, ids, round);
        const racing = await rejoin(server.base, id, racer);
        if (!racing.connected) continue;
        if (rebasedFirst) {
            racing.send();
            await sleep(200);
            c.send();
        } else {
            c.send();
            await sleep(200);
            racing.send();
        }
        await converge(`race, ${order}: both end up the same`, racer, c.session);
        check(
            `race, ${order}: both stay connected, and neither refuses the other`,
            racing.connected && c.connected && racing.errors.length + c.errors.length === 0,
            [...racing.errors, ...c.errors].join("; "),
        );
        await onServer(
            `race, ${order}: the server has the same model`,
            server.base,
            id,
            await modelOf(c.session.saveToPackage()),
        );
        if (t.bothEditsHold) {
            const held = t.bothEditsHold(await unzip(await served(server.base, id)), ids, round);
            check(`race, ${order}: both editors' edits on that page survive`, held.ok, held.detail);
        }
        await racing.close();
    }
    await converge("after the races, everyone connected holds the same", c.session, d.session);
    const beforeSecond = await modelOf(c.session.saveToPackage());
    await Promise.all([c.close(), d.close()]);

    // A second cut; the blank editor is now behind two.
    await cutComes(kept, 2, "a second idle close cuts again");
    const reopened = differ(beforeSecond, await modelOf((await remote(server.base, id)).saveToPackage()));
    check("an editor opened on the second cut: the same model", reopened.length === 0, reopened.join(", "));
    if (await catchUp("the blank editor, behind two cuts", server.base, id, blank)) {
        const blankParts = differ(beforeSecond, await modelOf(blank.saveToPackage()));
        check("it holds the same model", blankParts.length === 0, blankParts.join(", "));
        const rejoined = await rejoin(server.base, id, blank);
        await rejoined.close();
    }

    // Stopped and started, then the package alone.
    await sleep(100);
    await server.close();
    server = await serve(store.directory, CUTS_AT_ONCE);
    const restarted = differ(beforeSecond, await modelOf(await served(server.base, id)));
    check("restarted: the same model", restarted.length === 0, restarted.join(", "));
    const { baselineVersion } = await descriptionOf(server.base, id);
    const alone = await newSession();
    alone.open(await readFile(join(kept, `checkpoints/v${baselineVersion}.udoc`)));
    const aloneParts = differ(beforeSecond, await modelOf(alone.saveToPackage()));
    check("the latest package opened alone: the same model", aloneParts.length === 0, aloneParts.join(", "));
    await server.close();
    await store.remove();
}
finish();
