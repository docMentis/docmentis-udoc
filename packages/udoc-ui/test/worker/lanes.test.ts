/**
 * The worker's lanes: what a reader asked for runs before background work, and
 * background work waits, too, for the frame a request scheduled — so a reader
 * waits at most for the one background job already running.
 *
 * The frame and the event loop's turns are stand-ins, driven by hand, so the
 * order under test is the order asserted rather than whatever the timers did.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { createLanes } from "../../src/worker/lanes.ts";

/** Let every pending microtask run — a drain's `await`s between its jobs. */
function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Lanes whose turns and frame are held by hand, and a log of what ran. */
function harness() {
    const turns: Array<() => void> = [];
    let framePending = false;
    const ran: string[] = [];
    const reported: string[] = [];
    const lanes = createLanes({
        framePending: () => framePending,
        schedule: (callback) => turns.push(callback),
        report: (error) => reported.push((error as Error).message),
    });
    return {
        lanes,
        ran,
        reported,
        job: (name: string) => () => {
            ran.push(name);
        },
        setFrame(pending: boolean) {
            framePending = pending;
        },
        /** Run the event loop's next turn, if the lanes asked for one. */
        async turn(): Promise<void> {
            turns.shift()?.();
            await settle();
        },
        /** Run every turn the lanes ask for, until they ask for none. */
        async turns(): Promise<void> {
            while (turns.length > 0) await this.turn();
        },
    };
}

test("requests run in order, one at a time, without waiting for a turn", async () => {
    const h = harness();
    let release!: () => void;
    h.lanes.request(async () => {
        h.ran.push("open:start");
        await new Promise<void>((resolve) => (release = resolve));
        h.ran.push("open:end");
    });
    h.lanes.request(h.job("setViewport"));
    await settle();
    assert.deepEqual(h.ran, ["open:start"], "a job runs to its end before the next starts");
    release();
    await settle();
    assert.deepEqual(h.ran, ["open:start", "open:end", "setViewport"]);
});

test("a request goes ahead of background work queued before it", async () => {
    const h = harness();
    h.lanes.background(h.job("walk:sheet1"));
    h.lanes.background(h.job("walk:sheet2"));
    h.lanes.request(h.job("goToPlane"));
    await settle();
    assert.deepEqual(h.ran, ["goToPlane"]);
    await h.turns();
    assert.deepEqual(h.ran, ["goToPlane", "walk:sheet1", "walk:sheet2"]);
});

test("background work waits for a pending frame to paint", async () => {
    const h = harness();
    h.setFrame(true);
    h.lanes.background(h.job("thumbnail"));
    await h.turns();
    assert.deepEqual(h.ran, [], "nothing runs while the frame is pending");
    h.setFrame(false);
    h.lanes.framed();
    await h.turns();
    assert.deepEqual(h.ran, ["thumbnail"]);
});

test("background work runs one job a turn, and a request between them goes first", async () => {
    const h = harness();
    h.lanes.background(h.job("walk:sheet1"));
    h.lanes.background(h.job("walk:sheet2"));
    await h.turn();
    assert.deepEqual(h.ran, ["walk:sheet1"]);
    h.lanes.request(h.job("setViewport"));
    await settle();
    await h.turns();
    assert.deepEqual(h.ran, ["walk:sheet1", "setViewport", "walk:sheet2"]);
});

test("a request waits for the background job already running, and no other", async () => {
    const h = harness();
    let release!: () => void;
    h.lanes.background(async () => {
        h.ran.push("walk:sheet1:start");
        await new Promise<void>((resolve) => (release = resolve));
        h.ran.push("walk:sheet1:end");
    });
    h.lanes.background(h.job("walk:sheet2"));
    await h.turn();
    h.lanes.request(h.job("goToPlane"));
    await settle();
    assert.deepEqual(h.ran, ["walk:sheet1:start"], "a running job isn't interrupted");
    // The request's frame is pending once it has run.
    h.setFrame(true);
    release();
    await settle();
    await h.turns();
    assert.deepEqual(h.ran, ["walk:sheet1:start", "walk:sheet1:end", "goToPlane"]);
    h.setFrame(false);
    h.lanes.framed();
    await h.turns();
    assert.deepEqual(h.ran, ["walk:sheet1:start", "walk:sheet1:end", "goToPlane", "walk:sheet2"]);
});

test("a job that throws is reported, and doesn't wedge either lane", async () => {
    const h = harness();
    h.lanes.request(() => {
        throw new Error("request failed");
    });
    h.lanes.background(() => {
        throw new Error("background failed");
    });
    h.lanes.background(h.job("walk:sheet2"));
    h.lanes.request(h.job("setViewport"));
    await settle();
    await h.turns();
    assert.deepEqual(h.ran, ["setViewport", "walk:sheet2"]);
    assert.deepEqual(h.reported, ["request failed", "background failed"]);
});
