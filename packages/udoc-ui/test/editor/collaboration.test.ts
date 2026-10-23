/**
 * An editor's collaboration over a stand-in WebSocket and document: that it
 * sends the server only what the server lacks, never before its join is
 * answered, and never what it merged; that an opaque part's content goes ahead
 * of the patch naming it, and a peer's is merged; that its presence is kept
 * fresh, its pointer crosses alone, and leaving withdraws its presence before
 * the socket closes; and which closes it rejoins after — announcing each
 * connection lost once, backing off between attempts — and which end it.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { joinCollaboration, webSocketChannel } from "../../src/app/collaboration.ts";
import type { CollaborationEvent } from "../../src/app/collaboration.ts";

/** A collaboration message's kinds (docs/design/node-collaboration.md, docs/design/core-editor-opaque-part.md). */
const JOIN = 1;
const PATCH = 2;
const PRESENCE = 3;
const OPAQUE_PARTS = 4;

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const bytesOf = (value: string) => new TextEncoder().encode(value);

/** Let every promise the collaboration chained settle. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

type Listener = (event: { code?: number; reason?: string; data?: ArrayBuffer }) => void;

/** A WebSocket the test drives: it opens, receives and closes when told, and records what is sent on it. */
class FakeSocket {
    static readonly OPEN = 1;
    static readonly made: FakeSocket[] = [];
    readonly url: string;
    readonly sent: [kind: number, payload: string][] = [];
    binaryType = "blob";
    readyState = 0;
    closedByClient = false;
    readonly #listeners = new Map<string, Listener[]>();

    constructor(url: string) {
        this.url = url;
        FakeSocket.made.push(this);
    }
    addEventListener(type: string, listener: Listener): void {
        this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener]);
    }
    send(message: Uint8Array): void {
        this.sent.push([message[0]!, text(message.subarray(1))]);
    }
    close(): void {
        this.closedByClient = true;
        this.readyState = 3;
    }
    open(): void {
        this.readyState = 1;
        this.#fire("open", {});
    }
    receive(kind: number, payload: string): void {
        const bytes = bytesOf(payload);
        const message = new Uint8Array(bytes.byteLength + 1);
        message[0] = kind;
        message.set(bytes, 1);
        this.#fire("message", { data: message.buffer });
    }
    /** The connection ends from the far side, or is lost. */
    drop(code: number, reason = ""): void {
        this.readyState = 3;
        this.#fire("close", { code, reason });
    }
    #fire(type: string, event: Parameters<Listener>[0]): void {
        for (const listener of this.#listeners.get(type) ?? []) listener(event);
    }
}

/**
 * A document whose editing state is the set of edits it holds, named: a
 * version vector and a patch are each the JSON list of the edits in it, and
 * presence is JSON. `edit`, `select` and `point` are local changes, and fire
 * the cues; a withdrawal is the JSON string `"withdrawn"`.
 * An edit may bring an opaque part's content, recorded by the edit that wrote
 * it; opaque parts are the JSON list of the content whose edit a peer lacks,
 * and nothing when there is none.
 */
class FakeSync {
    readonly edits = new Set<string>();
    readonly peers: unknown[] = [];
    /** The opaque content recorded, by the edit that brought it. */
    readonly held = new Map<string, string>();
    readonly merged: string[] = [];
    refreshes = 0;
    #presence = "null";
    readonly #edited = new Set<() => void>();
    readonly #selected = new Set<() => void>();
    readonly #pointed = new Set<(presence: Uint8Array) => void>();

    edit(name: string, content?: string): void {
        this.edits.add(name);
        if (content !== undefined) this.held.set(name, content);
        for (const listener of this.#edited) listener();
    }
    select(presence: string): void {
        this.#presence = JSON.stringify(presence);
        for (const listener of this.#selected) listener();
    }
    point(pointer: string): void {
        for (const listener of this.#pointed) listener(bytesOf(JSON.stringify(pointer)));
    }
    async versionVector(): Promise<Uint8Array> {
        return bytesOf(JSON.stringify([...this.edits]));
    }
    async patchSince(peer: Uint8Array): Promise<Uint8Array> {
        const held = JSON.parse(text(peer)) as string[];
        return bytesOf(JSON.stringify([...this.edits].filter((edit) => !held.includes(edit))));
    }
    async merge(patch: Uint8Array): Promise<void> {
        for (const edit of JSON.parse(text(patch)) as string[]) this.edits.add(edit);
    }
    async opaquePartsSince(peer: Uint8Array): Promise<Uint8Array> {
        const held = JSON.parse(text(peer)) as string[];
        const lacked = [...this.held].filter(([edit]) => !held.includes(edit)).map(([, content]) => content);
        return lacked.length > 0 ? bytesOf(JSON.stringify(lacked)) : new Uint8Array();
    }
    async mergeOpaqueParts(parts: Uint8Array): Promise<void> {
        this.merged.push(...(JSON.parse(text(parts)) as string[]));
    }
    async presence(): Promise<Uint8Array> {
        return bytesOf(this.#presence);
    }
    async mergePresence(presence: Uint8Array): Promise<void> {
        this.peers.push(JSON.parse(text(presence)));
    }
    async refreshPresence(): Promise<void> {
        this.refreshes++;
    }
    async withdrawPresence(): Promise<Uint8Array> {
        this.peers.length = 0;
        return bytesOf('"withdrawn"');
    }
    onEdit(listener: () => void): () => void {
        this.#edited.add(listener);
        return () => this.#edited.delete(listener);
    }
    onSelectionEdit(listener: () => void): () => void {
        this.#selected.add(listener);
        return () => this.#selected.delete(listener);
    }
    onPointer(listener: (presence: Uint8Array) => void): () => void {
        this.#pointed.add(listener);
        return () => this.#pointed.delete(listener);
    }
}

// Every WebSocket a collaboration here opens is a fake; `node --test` runs each
// file in a process of its own.
globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket;

/** Join a fresh document. `sockets()` is every socket it has opened, the latest last. */
function join() {
    const first = FakeSocket.made.length;
    const sync = new FakeSync();
    const events: CollaborationEvent[] = [];
    const collaboration = joinCollaboration(
        sync,
        webSocketChannel(new URL("https://udoc.example/documents/d/collaboration")),
        (event) => events.push(event),
    );
    const sockets = () => FakeSocket.made.slice(first);
    return { sync, events, collaboration, sockets, socket: () => sockets().at(-1)! };
}

test("a joined editor sends only what the server lacks, and never what it merged", async (t) => {
    t.mock.timers.enable({ apis: ["setInterval"] });
    const { sync, events, socket } = join();
    assert.equal(socket().url, "wss://udoc.example/documents/d/collaboration");

    // Made before the join is answered: held until it is, presence too — the
    // server ends a client whose first message isn't its join.
    sync.edit("alex 1");
    sync.select("page 1");
    socket().open();
    await settle();
    assert.deepEqual(socket().sent, [[JOIN, '["alex 1"]']]);

    // The server holds an edit the editor lacks, and a peer's presence.
    socket().receive(JOIN, '["robin 1"]');
    socket().receive(PATCH, '["robin 1"]');
    socket().receive(PRESENCE, '"robin on page 2"');
    await settle();
    assert.deepEqual(events, [{ type: "joined" }]);
    assert.deepEqual([...sync.edits], ["alex 1", "robin 1"]);
    assert.deepEqual(sync.peers, ["robin on page 2"]);
    assert.deepEqual(
        socket()
            .sent.slice(1)
            .sort(([a], [b]) => a - b),
        [
            [PATCH, '["alex 1"]'],
            [PRESENCE, '"page 1"'],
        ],
    );

    // Each edit after crosses alone: not again what was sent, nor what was merged.
    sync.edit("alex 2");
    await settle();
    assert.deepEqual(socket().sent.slice(3), [[PATCH, '["alex 2"]']]);
});

test("an opaque part's content goes ahead of the patch naming it, and a peer's is merged", async (t) => {
    t.mock.timers.enable({ apis: ["setInterval"] });
    const { sync, socket } = join();
    socket().open();
    socket().receive(JOIN, "[]");
    await settle();
    const joined = socket().sent.length;

    // An inserted picture: its image first, then the edit naming it.
    sync.edit("alex's picture", "pixels");
    await settle();
    assert.deepEqual(socket().sent.slice(joined), [
        [OPAQUE_PARTS, '["pixels"]'],
        [PATCH, '["alex\'s picture"]'],
    ]);
    // An edit that brings none crosses alone: the far side is taken to hold
    // the picture's edit, and so its image.
    sync.edit("alex 2");
    await settle();
    assert.deepEqual(socket().sent.slice(joined + 2), [[PATCH, '["alex 2"]']]);

    // A peer's, sent on by a local collaboration service, is merged.
    socket().receive(OPAQUE_PARTS, '["robin pixels"]');
    await settle();
    assert.deepEqual(sync.merged, ["robin pixels"]);
});

test("a joined editor keeps its presence fresh, sends its pointer alone, and withdraws it as it leaves", async (t) => {
    t.mock.timers.enable({ apis: ["setInterval"] });
    const { sync, socket, collaboration } = join();
    socket().open();
    // Not before the join is answered.
    sync.point("page 1 at 10, 20");
    socket().receive(JOIN, "[]");
    await settle();
    // Refreshed on the join, before its presence goes out.
    assert.equal(sync.refreshes, 1);
    const joined = socket().sent.length;

    // The pointer crosses as its own presence; every ten seconds the presence
    // is refreshed and sent whole.
    sync.point("page 1 at 30, 40");
    t.mock.timers.tick(10_000);
    await settle();
    assert.equal(sync.refreshes, 2);
    assert.deepEqual(socket().sent.slice(joined), [
        [PRESENCE, '"page 1 at 30, 40"'],
        [PRESENCE, "null"],
    ]);

    // Leaving withdraws its presence, sent before the socket closes, and
    // forgets the peers'.
    sync.peers.push("robin on page 2");
    const leaving = collaboration.leave();
    assert.equal(socket().closedByClient, false);
    await leaving;
    assert.deepEqual(socket().sent.at(-1), [PRESENCE, '"withdrawn"']);
    assert.equal(socket().closedByClient, true);
    assert.deepEqual(sync.peers, []);
    t.mock.timers.tick(60_000);
    await settle();
    assert.equal(sync.refreshes, 2);
});

test("a lost connection is rejoined, backing off, and any other close ends the collaboration", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
    const { sync, events, socket, sockets } = join();
    socket().open();
    socket().receive(JOIN, "[]");
    await settle();

    // Lost: announced once, and rejoined after a second — then after two, the
    // first attempt having failed without a word.
    socket().drop(1006);
    assert.deepEqual(events.at(-1), { type: "interrupted", code: 1006, reason: "" });
    t.mock.timers.tick(999);
    assert.equal(sockets().length, 1);
    t.mock.timers.tick(1);
    assert.equal(sockets().length, 2);
    socket().drop(1006);
    t.mock.timers.tick(1999);
    assert.equal(sockets().length, 2);
    t.mock.timers.tick(1);
    assert.equal(sockets().length, 3);

    // What was edited while away reaches the server once the rejoin is
    // answered — once, however many times it was asked for — and presence
    // with it.
    sync.edit("offline");
    socket().open();
    socket().receive(JOIN, "[]");
    await settle();
    assert.deepEqual(
        socket().sent.sort(([a], [b]) => a - b),
        [
            [JOIN, '["offline"]'],
            [PATCH, '["offline"]'],
            [PRESENCE, "null"],
        ],
    );

    // Answered, the wait starts over; the session ending is rejoined too.
    socket().drop(1011, "the document's session ended");
    t.mock.timers.tick(1000);
    assert.equal(sockets().length, 4);
    socket().open();
    socket().receive(JOIN, '["offline"]');
    await settle();

    // The document deleted ends it, and nothing reconnects.
    socket().drop(4000, "the document was deleted");
    t.mock.timers.tick(60_000);
    assert.equal(sockets().length, 4);
    assert.deepEqual(events, [
        { type: "joined" },
        { type: "interrupted", code: 1006, reason: "" },
        { type: "joined" },
        { type: "interrupted", code: 1011, reason: "the document's session ended" },
        { type: "joined" },
        { type: "failed", code: 4000, reason: "the document was deleted" },
    ]);
});

test("a collaboration never joined isn't rejoined, and one left stays left", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });

    // Unreachable before the first answer: nothing to rejoin.
    const unreachable = join();
    unreachable.socket().drop(1006);
    t.mock.timers.tick(60_000);
    assert.equal(unreachable.sockets().length, 1);
    assert.deepEqual(unreachable.events, [{ type: "failed", code: 1006, reason: "" }]);

    // Left while rejoining: the pending attempt is dropped, and the leave is said once.
    const left = join();
    left.socket().open();
    left.socket().receive(JOIN, "[]");
    left.socket().drop(1001, "the server is closing");
    left.collaboration.leave();
    left.collaboration.leave();
    t.mock.timers.tick(60_000);
    assert.equal(left.sockets().length, 1);
    assert.deepEqual(left.events.at(-1), { type: "left" });
    assert.equal(left.events.filter(({ type }) => type === "left").length, 1);

    // Left while connected: its socket is closed, and its close heard as nothing more.
    const connected = join();
    connected.socket().open();
    await connected.collaboration.leave();
    assert.equal(connected.socket().closedByClient, true);
    connected.socket().drop(1005);
    assert.deepEqual(connected.events, [{ type: "left" }]);
});
