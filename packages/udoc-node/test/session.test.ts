/**
 * The session's lifecycle over its thread: which failures end it, which leave
 * it usable, the error each comes back as — what a host like `udoc-server`
 * branches on — and when the thread may hold the process open.
 *
 * The thread is a stand-in replied to by hand, so no engine is loaded, nothing
 * starts a session in it, and no permit is spent.
 */

import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import type { Worker } from "node:worker_threads";

import { UDocError } from "@docmentis/udoc-wasm/error";

import { UDocSession } from "../src/session.ts";
import type { WorkerReply, WorkerRequest } from "../src/protocol.ts";

class FakeThread extends EventEmitter {
    readonly posted: WorkerRequest[] = [];
    referenced = true;
    terminated = false;

    postMessage(request: WorkerRequest): void {
        this.posted.push(request);
    }
    ref(): void {
        this.referenced = true;
    }
    unref(): void {
        this.referenced = false;
    }
    async terminate(): Promise<number> {
        this.terminated = true;
        return 0;
    }
    reply(reply: WorkerReply): void {
        this.emit("message", reply);
    }
}

/** A page's export format, for the calls these tests put in flight. */
const PNG = { png: { scale: 1 } } as const;

function sessionOn(thread: FakeThread): UDocSession {
    return new UDocSession(thread as unknown as Worker);
}

/** Whether `closed` has settled — asked after every pending microtask has run. */
function isClosed(session: UDocSession): Promise<boolean> {
    return Promise.race([
        session.closed.then(() => true),
        new Promise<boolean>((resolve) => setImmediate(() => resolve(false))),
    ]);
}

test("a trap ends the session: all in flight rejects, nothing more is sent, the thread goes", async () => {
    const thread = new FakeThread();
    const session = sessionOn(thread);
    const trapped = session.exportPageToBytes(0, PNG);
    const waiting = session.exportPageToBytes(1, PNG);

    thread.reply({ id: 1, ok: false, failure: { code: "crashed", message: "unreachable" } });

    await assert.rejects(trapped, /engine crashed/);
    await assert.rejects(waiting, /engine crashed/);
    await assert.rejects(session.exportPageToBytes(2, PNG), /engine crashed/);
    assert.match((await session.closed).message, /engine crashed/);
    assert.equal(thread.posted.length, 2);
    assert.equal(thread.terminated, true);
});

test("the thread exiting on its own rejects what is in flight and what comes after", async () => {
    const thread = new FakeThread();
    const session = sessionOn(thread);
    const waiting = session.exportPageToBytes(0, PNG);

    thread.emit("exit", 1);

    await assert.rejects(waiting, /exited \(code 1\)/);
    await assert.rejects(session.exportPageToBytes(0, PNG), /exited \(code 1\)/);
    assert.match((await session.closed).message, /exited \(code 1\)/);
    assert.equal(thread.posted.length, 1);
});

test("any other failure comes back as its own error and leaves the session open", async () => {
    const thread = new FakeThread();
    const session = sessionOn(thread);

    const refused = session.exportPageToBytes(0, PNG);
    thread.reply({
        id: 1,
        ok: false,
        failure: { code: "permitRefused", message: "refused", detail: { message: "Cap reached." } },
    });
    const refusal = await refused.catch((error: unknown) => error);
    assert.ok(refusal instanceof UDocError);
    assert.equal(refusal.code, "permitRefused");
    assert.deepEqual(refusal.detail, { message: "Cap reached." });

    const pastTheEnd = session.exportPageToBytes(9, PNG);
    thread.reply({ id: 2, ok: false, failure: { code: "notFound", message: "out of range" } });
    await assert.rejects(pastTheEnd, (error: Error) => error instanceof UDocError && error.code === "notFound");

    const failed = session.exportPageToBytes(0, PNG);
    thread.reply({ id: 3, ok: false, failure: { code: "malformed", message: "bad page" } });
    await assert.rejects(
        failed,
        (error: Error) => error instanceof UDocError && error.code === "malformed" && error.message === "bad page",
    );

    const rendered = session.exportPageToBytes(0, PNG);
    thread.reply({ id: 4, ok: true, result: new Uint8Array([0x89]) });
    assert.deepEqual([...(await rendered)], [0x89]);
    assert.equal(await isClosed(session), false);
    assert.equal(thread.terminated, false);
});

test("the thread holds the process open only while a call is in flight", async () => {
    const thread = new FakeThread();
    const session = sessionOn(thread);
    assert.equal(thread.referenced, false, "idle from the start");

    const first = session.exportPageToBytes(0, PNG);
    const second = session.exportPageToBytes(1, PNG);
    assert.equal(thread.referenced, true);

    thread.reply({ id: 1, ok: true, result: new Uint8Array() });
    assert.equal(thread.referenced, true, "the second call is still out");

    thread.reply({ id: 2, ok: true, result: new Uint8Array() });
    assert.equal(thread.referenced, false);
    await Promise.all([first, second]);
});
