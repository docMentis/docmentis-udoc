// Collaboration with no log cut, on every document type (scripts/e2e.mjs): real
// editors from before and after a checkpoint, undo, a patch sent twice, restarts,
// the package opened alone, and a save to the document's own format.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DOCUMENTS, png } from "./e2e-documents.mjs";
import {
    check,
    checkpointHolds,
    checkpointVersions,
    converge,
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

/** The format each document type saves back to; an image's has no rewrite. */
const SOURCE = { portable: "pdf", presentation: "pptx", wordprocessing: "docx", spreadsheet: "xlsx" };

const only = process.argv[2];

for (const [type, t] of Object.entries(DOCUMENTS)) {
    if (only && only !== type) continue;
    console.log(`\n[e2e] === ${type} (${t.file})`);
    const store = await temporaryStore();
    let server = await serve(store.directory);
    const id = await upload(server.base, t);
    const kept = join(store.directory, id);
    const ids = t.ids(await unzip(await readFile(join(kept, "checkpoints/v0.udoc"))));

    const asUploaded = await modelOf((await remote(server.base, id)).saveToPackage());

    // The first edits, with an editor that stays open across the checkpoint.
    const a = new Peer(server.base, id, await remote(server.base, id));
    const old = new Peer(server.base, id, await remote(server.base, id));
    await Promise.all([a.joined, old.joined]);
    t.first(a.session, ids);
    if (t.image) a.session.insertImage(a.session.addViewer(), png, "image/png");
    a.send();
    const firstModel = await modelOf(a.session.saveToPackage());
    await onServer("the server takes the first edits", server.base, id, firstModel);
    await converge("an editor already open takes them", old.session, a.session);
    const v1 = await fetch(`${server.base}/documents/${id}/checkpoints`, { method: "POST" });
    check("checkpoint v1", v1.status === 201);

    // One editor opened before the checkpoint and one after it each make the first
    // edit on a page nothing has touched, so each authors its own copy of it, one
    // from v0's page and one from v1's.
    const fresh = new Peer(server.base, id, await remote(server.base, id));
    await fresh.joined;
    const freshParts = differ(firstModel, await modelOf(fresh.session.saveToPackage()));
    check("an editor opened over v1 and its log: the same model", freshParts.length === 0, freshParts.join(", "));
    t.one(old.session, ids, 0);
    t.two(fresh.session, ids, 0);
    if (t.image) old.session.insertImage(old.session.addViewer(), png, "image/png");
    old.send();
    fresh.send();
    await converge("editors from before and after a checkpoint merge their first copies", old.session, fresh.session);
    check("the server keeps both connected", old.connected && fresh.connected);
    check(
        "neither refuses the other's patch",
        old.errors.length + fresh.errors.length === 0,
        [...old.errors, ...fresh.errors].join("; "),
    );
    const merged = await modelOf(fresh.session.saveToPackage());
    check("their edits changed the document", differ(firstModel, merged).length > 0);
    await onServer("the server has the same model", server.base, id, merged);

    // An editor undoes its own edits, on the merged document.
    const undos = undoOwnEdits(fresh.session, t);
    fresh.send();
    check("an editor can undo its own edits", undos > 0);
    await converge("the undo reaches the other editor", old.session, fresh.session);
    const undone = await modelOf(fresh.session.saveToPackage());
    await onServer("the undo reaches the server", server.base, id, undone);

    // Sent again, the same edits change nothing.
    fresh.sendEverything();
    await sleep(300);
    check("a patch sent twice is taken", fresh.connected);
    await onServer("and changes nothing", server.base, id, undone);

    const later = differ(undone, await modelOf((await remote(server.base, id)).saveToPackage()));
    check("an editor opened later: the same model", later.length === 0, later.join(", "));
    await Promise.all([a.close(), old.close(), fresh.close()]);

    // Restarts, and the next checkpoint.
    await sleep(200);
    await server.close();
    server = await serve(store.directory);
    const restarted = differ(undone, await modelOf(await served(server.base, id)));
    check("restarted: the same model", restarted.length === 0, restarted.join(", "));
    const v2 = await fetch(`${server.base}/documents/${id}/checkpoints`, { method: "POST" });
    check("checkpoint v2", v2.status === 201);
    const alone = await newSession();
    alone.open(await readFile(join(kept, "checkpoints/v2.udoc")));
    const aloneParts = differ(undone, await modelOf(alone.saveToPackage()));
    check("the package opened alone: the same model", aloneParts.length === 0, aloneParts.join(", "));
    await server.close();
    server = await serve(store.directory);
    const overV2 = differ(undone, await modelOf(await served(server.base, id)));
    check("restarted over v2: the same model", overV2.length === 0, overV2.join(", "));

    // Two editors opened now, on a page nothing has touched yet.
    const c = new Peer(server.base, id, await remote(server.base, id));
    const d = new Peer(server.base, id, await remote(server.base, id));
    await Promise.all([c.joined, d.joined]);
    t.one(c.session, ids, 1);
    t.two(d.session, ids, 1);
    c.send();
    d.send();
    await converge("two editors after a restart merge their first copies", c.session, d.session);
    check("and stay connected", c.connected && d.connected);
    check(
        "and neither refuses the other's patch",
        c.errors.length + d.errors.length === 0,
        [...c.errors, ...d.errors].join("; "),
    );
    const last = await modelOf(c.session.saveToPackage());
    await onServer("the server has the same model", server.base, id, last);

    // Every checkpoint is still the document as it was, whatever has happened since.
    const versions = await checkpointVersions(server.base, id);
    check("the checkpoints are listed", JSON.stringify(versions) === "[0,1,2]", JSON.stringify(versions));
    await checkpointHolds(server.base, id, 0, asUploaded);
    await checkpointHolds(server.base, id, 1, firstModel);
    await checkpointHolds(server.base, id, 2, undone);

    if (SOURCE[type]) {
        const reopened = await remote(server.base, id);
        let refused = "";
        try {
            reopened.saveToBytes(SOURCE[type], "rewrite");
        } catch (error) {
            refused = String(error?.message ?? error).slice(0, 200);
        }
        check(`saved to ${SOURCE[type]}`, refused === "", refused);
    }
    await Promise.all([c.close(), d.close()]);
    await server.close();
    await store.remove();
}
finish();
