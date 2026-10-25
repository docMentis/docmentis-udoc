/**
 * The worker's lanes: what a reader asked for runs before background work, and
 * background work waits, too, for the frame a request scheduled and for the
 * reader to go quiet — so a reader waits at most for the one slice already
 * running. Background tasks run in priority order, each slice taken as it runs.
 *
 * The frame, the clock and the event loop's turns are stand-ins, driven by
 * hand, so the order under test is the order asserted rather than whatever the
 * timers did.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { createLanes } from "../../src/worker/lanes.ts";
import type { Job, Task } from "../../src/worker/lanes.ts";

/** Let every pending microtask run — a drain's `await`s between its jobs. */
function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/** A slice: a name, logged as it runs, or a job of its own. */
type Slice = string | Job;

/** A task of slices, in the order added. */
interface SliceTask extends Task {
    /** Add slices, and wake the lanes to them. */
    add(...slices: Slice[]): void;
    /** Withdraw a slice not yet taken. */
    withdraw(name: string): void;
}

/** Lanes over `quietMs.length` tasks, whose turns, clock and frame are held by hand, and a log of what ran. */
function harness(...quietMs: number[]) {
    const timers: Array<{ at: number; callback: () => void; live: boolean }> = [];
    let now = 0;
    let framePending = false;
    const ran: string[] = [];
    const reported: string[] = [];
    // Assigned below, before any task is woken.
    let wake = (): void => {};
    const tasks: SliceTask[] = quietMs.map((quiet) => {
        const slices: Slice[] = [];
        return {
            quietMs: quiet,
            pending: () => slices.length > 0,
            take: () => {
                const slice = slices.shift()!;
                if (typeof slice !== "string") return slice;
                return () => {
                    ran.push(slice);
                };
            },
            add(...added) {
                slices.push(...added);
                wake();
            },
            withdraw(name) {
                slices.splice(slices.indexOf(name), 1);
            },
        };
    });
    const lanes = createLanes(
        {
            framePending: () => framePending,
            now: () => now,
            schedule: (callback, ms) => {
                const timer = { at: now + ms, callback, live: true };
                timers.push(timer);
                return () => {
                    timer.live = false;
                };
            },
            report: (error) => reported.push((error as Error).message),
        },
        tasks,
    );
    wake = () => lanes.wake();
    /** The next live timer due by now, taken off the list. */
    function due(): (() => void) | undefined {
        let next = -1;
        for (const [i, timer] of timers.entries()) {
            if (timer.live && timer.at <= now && (next < 0 || timer.at < timers[next]!.at)) next = i;
        }
        return next < 0 ? undefined : timers.splice(next, 1)[0]!.callback;
    }
    return {
        lanes,
        tasks,
        ran,
        reported,
        setFrame(pending: boolean) {
            framePending = pending;
        },
        /** Run the event loop's next turn, if the lanes asked for one by now. */
        async turn(): Promise<void> {
            due()?.();
            await settle();
        },
        /** Run every turn the lanes ask for by now, until they ask for none. */
        async turns(): Promise<void> {
            for (let callback = due(); callback; callback = due()) {
                callback();
                await settle();
            }
        },
        /** Move the clock on `ms`, running every turn due on the way. */
        async advance(ms: number): Promise<void> {
            now += ms;
            await this.turns();
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
    h.lanes.request(() => {
        h.ran.push("setViewport");
    });
    await settle();
    assert.deepEqual(h.ran, ["open:start"], "a job runs to its end before the next starts");
    release();
    await settle();
    assert.deepEqual(h.ran, ["open:start", "open:end", "setViewport"]);
});

test("a request goes ahead of background work that was waiting before it", async () => {
    const h = harness(0);
    h.tasks[0]!.add("walk:sheet1", "walk:sheet2");
    h.lanes.request(() => {
        h.ran.push("goToPlane");
    });
    await settle();
    assert.deepEqual(h.ran, ["goToPlane"]);
    await h.turns();
    assert.deepEqual(h.ran, ["goToPlane", "walk:sheet1", "walk:sheet2"]);
});

test("background work waits for a pending frame to paint", async () => {
    const h = harness(0);
    h.setFrame(true);
    h.tasks[0]!.add("thumbnail");
    await h.turns();
    assert.deepEqual(h.ran, [], "nothing runs while the frame is pending");
    h.setFrame(false);
    h.lanes.framed();
    await h.turns();
    assert.deepEqual(h.ran, ["thumbnail"]);
});

test("background work runs one slice a turn, and a request between them goes first", async () => {
    const h = harness(0);
    h.tasks[0]!.add("walk:sheet1", "walk:sheet2");
    await h.turn();
    assert.deepEqual(h.ran, ["walk:sheet1"]);
    h.lanes.request(() => {
        h.ran.push("setViewport");
    });
    await settle();
    await h.turns();
    assert.deepEqual(h.ran, ["walk:sheet1", "setViewport", "walk:sheet2"]);
});

test("a request waits for the slice already running, and no other", async () => {
    const h = harness(0);
    let release!: () => void;
    h.tasks[0]!.add(async () => {
        h.ran.push("walk:sheet1:start");
        await new Promise<void>((resolve) => (release = resolve));
        h.ran.push("walk:sheet1:end");
    }, "walk:sheet2");
    await h.turn();
    h.lanes.request(() => {
        h.ran.push("goToPlane");
    });
    await settle();
    assert.deepEqual(h.ran, ["walk:sheet1:start"], "a running slice isn't interrupted");
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

test("the first task's slices run before the next task's", async () => {
    const h = harness(0, 0);
    const [fonts, walk] = h.tasks;
    walk!.add("walk:sheet1", "walk:sheet2");
    fonts!.add("font:a");
    await h.turn();
    // A slice the first task gains goes ahead of the next task's waiting ones.
    fonts!.add("font:b");
    await h.turns();
    assert.deepEqual(h.ran, ["font:a", "font:b", "walk:sheet1", "walk:sheet2"]);
});

test("a slice waits until the reader has been quiet for its task's window", async () => {
    const h = harness(120, 300);
    const [thumbnails, compose] = h.tasks;
    h.lanes.active();
    compose!.add("compose");
    thumbnails!.add("thumbnail");
    await h.advance(100);
    assert.deepEqual(h.ran, [], "nothing runs inside either window");
    await h.advance(20);
    assert.deepEqual(h.ran, ["thumbnail"], "the shorter window ends first");
    // The reader comes back before the longer window ends: it starts again.
    await h.advance(100);
    h.lanes.active();
    await h.advance(250);
    assert.deepEqual(h.ran, ["thumbnail"]);
    await h.advance(50);
    assert.deepEqual(h.ran, ["thumbnail", "compose"]);
});

test("a slice is taken as it runs, so work withdrawn before its turn never runs", async () => {
    const h = harness(0);
    h.setFrame(true);
    h.tasks[0]!.add("thumbnail:4", "thumbnail:5");
    h.tasks[0]!.withdraw("thumbnail:4");
    h.setFrame(false);
    h.lanes.framed();
    await h.turns();
    assert.deepEqual(h.ran, ["thumbnail:5"]);
});

test("a job that throws is reported, and doesn't wedge either lane", async () => {
    const h = harness(0);
    h.lanes.request(() => {
        throw new Error("request failed");
    });
    h.tasks[0]!.add(() => {
        throw new Error("background failed");
    }, "walk:sheet2");
    h.lanes.request(() => {
        h.ran.push("setViewport");
    });
    await settle();
    await h.turns();
    assert.deepEqual(h.ran, ["setViewport", "walk:sheet2"]);
    assert.deepEqual(h.reported, ["request failed", "background failed"]);
});
