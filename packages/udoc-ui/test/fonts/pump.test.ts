/**
 * The pump's one job: keep the worker's queue free.
 *
 * That queue serializes everything that touches the session — a scroll's
 * `setViewport`, a keystroke's `execute`, a click's `hitTest` — so a pump that
 * waited on the network inside a job would freeze the document view for the
 * length of a download. These tests hold the split that prevents it: a kick
 * queues *nothing*, and bytes reach the session only as a job of their own,
 * after they are already in hand.
 *
 * The session, the fetch and the clock are all stand-ins, driven by hand, so the
 * ordering under test is the ordering asserted rather than whatever the network
 * or the timers happened to do.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { FontRequest } from "@docmentis/udoc-wasm";

import type { FontPumpSession } from "../../src/fonts/pump.ts";
import { createFontPump } from "../../src/fonts/pump.ts";

function order(id: number, family = "Roboto"): FontRequest {
    return {
        id,
        entry: id,
        descriptor: { family, bold: false, italic: false },
        fetch: "google",
        characters: ["a"],
    };
}

/** Let every pending microtask (and the `.then` behind a settled fetch) run. */
function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * An engine stand-in: hands out one round of orders per `takeFontRequests`, and
 * settles an order only if it was actually on order — the real fail-closed
 * answer to a stale id.
 */
function fakeSession(rounds: FontRequest[][], changed = true) {
    const inFlight = new Set<number>();
    const completed: Array<{ id: number; binaries: number }> = [];
    let round = 0;
    let refreshes = 0;
    const session: FontPumpSession = {
        takeFontRequests: () => {
            const orders = rounds[round++] ?? [];
            for (const o of orders) inFlight.add(o.id);
            return orders;
        },
        completeFontRequest: (id, binaries) => {
            completed.push({ id: Number(id), binaries: binaries.length });
            return inFlight.delete(Number(id));
        },
        refreshFonts: () => {
            refreshes++;
            return changed;
        },
    };
    return { session, completed, refreshes: () => refreshes, rounds: () => round };
}

/** A fetch the test settles by hand, so "in the air" is an observable state. */
function heldFetch() {
    const pending = new Map<number, (binaries: Uint8Array[]) => void>();
    return {
        fetch: (o: FontRequest) => new Promise<Uint8Array[]>((resolve) => pending.set(o.id, resolve)),
        pending,
        settle(id: number, binaries: Uint8Array[] = [new Uint8Array([1])]): void {
            const resolve = pending.get(id);
            assert.ok(resolve, `order ${id} was fetched`);
            pending.delete(id);
            resolve(binaries);
        },
    };
}

/**
 * The worker's timers, fired by hand so "waiting" and "fired" are separable.
 * `fireNext` fires the shortest wait — the one a real clock would reach first.
 */
function manualClock() {
    const timers = new Map<number, { ms: number; callback: () => void }>();
    let next = 0;
    return {
        schedule: (callback: () => void, ms: number) => {
            const id = next++;
            timers.set(id, { ms, callback });
            return () => void timers.delete(id);
        },
        waiting: () => timers.size,
        fireNext(): void {
            const [id, timer] = [...timers].reduce((soonest, entry) => (entry[1].ms < soonest[1].ms ? entry : soonest));
            timers.delete(id);
            timer.callback();
        },
        fireAll(): void {
            while (timers.size > 0) this.fireNext();
        },
    };
}

/** The worker's queue, drained by hand so "queued" and "run" are separable. */
function manualQueue() {
    const jobs: Array<() => void> = [];
    return {
        enqueue: (job: () => void) => void jobs.push(job),
        jobs,
        run(): void {
            while (jobs.length > 0) jobs.shift()!();
        },
    };
}

test("a kick starts every fetch and queues nothing", () => {
    // The regression guard for the freeze: at this moment the worker is free to
    // scroll, type and hit-test, with two downloads in the air.
    const queue = manualQueue();
    const clock = manualClock();
    const fetch = heldFetch();
    const engine = fakeSession([[order(1), order(2)]]);
    const kick = createFontPump({
        session: () => engine.session,
        enqueue: queue.enqueue,
        repaint: () => {},
        fetch: fetch.fetch,
        schedule: clock.schedule,
    });

    kick();

    assert.equal(fetch.pending.size, 2, "both orders are in the air");
    assert.equal(queue.jobs.length, 0, "and nothing is holding the queue");
});

test("bytes reach the session only as a job, once they are in hand", async () => {
    const queue = manualQueue();
    const clock = manualClock();
    const fetch = heldFetch();
    const engine = fakeSession([[order(1)]]);
    let repaints = 0;
    const kick = createFontPump({
        session: () => engine.session,
        enqueue: queue.enqueue,
        repaint: () => void repaints++,
        fetch: fetch.fetch,
        schedule: clock.schedule,
    });
    kick();

    fetch.settle(1);
    await flush();
    assert.equal(queue.jobs.length, 0, "waiting for others to land");
    clock.fireNext();
    assert.equal(engine.completed.length, 0, "queued, not applied");
    assert.equal(queue.jobs.length, 1);

    queue.run();
    assert.deepEqual(
        engine.completed.map((c) => c.id),
        [1],
    );
    assert.equal(engine.refreshes(), 1, "one re-shape");
    assert.equal(repaints, 1, "and one repaint, because it changed");
});

test("a burst installs in one pass", async () => {
    // Three families landing within the install wait re-shape once, not three
    // times — re-shaping is the expensive half.
    const queue = manualQueue();
    const clock = manualClock();
    const fetch = heldFetch();
    const engine = fakeSession([[order(1), order(2), order(3)]]);
    const kick = createFontPump({
        session: () => engine.session,
        enqueue: queue.enqueue,
        repaint: () => {},
        fetch: fetch.fetch,
        schedule: clock.schedule,
    });
    kick();

    fetch.settle(1);
    fetch.settle(2);
    fetch.settle(3);
    await flush();
    clock.fireNext();

    assert.equal(queue.jobs.length, 1, "one install job for the burst");
    queue.run();
    assert.deepEqual(
        engine.completed.map((c) => c.id),
        [1, 2, 3],
    );
    assert.equal(engine.refreshes(), 1);
});

test("installing re-arms the pump, and it stops when nothing is on order", async () => {
    // A landed font can put more on order: a vendor that turned out not to have
    // the characters advances the chain. Nobody asks for that round — the pump
    // takes it itself, and quits when the engine has nothing left.
    const queue = manualQueue();
    const clock = manualClock();
    const fetch = heldFetch();
    const engine = fakeSession([[order(1)], [order(2)], []]);
    const kick = createFontPump({
        session: () => engine.session,
        enqueue: queue.enqueue,
        repaint: () => {},
        fetch: fetch.fetch,
        schedule: clock.schedule,
    });
    kick();

    fetch.settle(1);
    await flush();
    clock.fireNext();
    queue.run();
    assert.ok(fetch.pending.has(2), "the next round went out on its own");

    fetch.settle(2);
    await flush();
    clock.fireNext();
    queue.run();
    assert.equal(fetch.pending.size, 0);
    assert.equal(engine.rounds(), 3, "one take per install, then the empty one");
});

test("an empty answer still settles the order", async () => {
    // "This vendor has nothing" is a complete answer — the order has to close,
    // or the engine waits on it forever and the character never resolves.
    const queue = manualQueue();
    const clock = manualClock();
    const fetch = heldFetch();
    const engine = fakeSession([[order(1)]]);
    const kick = createFontPump({
        session: () => engine.session,
        enqueue: queue.enqueue,
        repaint: () => {},
        fetch: fetch.fetch,
        schedule: clock.schedule,
    });
    kick();

    fetch.settle(1, []);
    await flush();
    clock.fireNext();
    queue.run();

    assert.deepEqual(engine.completed, [{ id: 1, binaries: 0 }]);
});

test("a stale completion re-shapes nothing", async () => {
    // The document changed while the download was in the air. The engine rejects
    // the id, so there is nothing to re-shape and nothing to repaint.
    const queue = manualQueue();
    const clock = manualClock();
    const fetch = heldFetch();
    const engine = fakeSession([[order(1)]]);
    let repaints = 0;
    const kick = createFontPump({
        session: () => engine.session,
        enqueue: queue.enqueue,
        repaint: () => void repaints++,
        fetch: fetch.fetch,
        schedule: clock.schedule,
    });
    kick();
    // Settle it once through the engine's own bookkeeping, so the pump's
    // completion is the second one and comes back false.
    engine.session.completeFontRequest(1n, []);

    fetch.settle(1);
    await flush();
    clock.fireNext();
    queue.run();

    assert.equal(engine.refreshes(), 0);
    assert.equal(repaints, 0);
});

test("a session that goes away mid-flight drops what landed", async () => {
    const queue = manualQueue();
    const clock = manualClock();
    const fetch = heldFetch();
    const engine = fakeSession([[order(1)]]);
    let live: FontPumpSession | null = engine.session;
    const kick = createFontPump({
        session: () => live,
        enqueue: queue.enqueue,
        repaint: () => {},
        fetch: fetch.fetch,
        schedule: clock.schedule,
    });
    kick();

    live = null; // closed, or a new document took over
    fetch.settle(1);
    await flush();
    clock.fireNext();
    queue.run(); // must not throw

    assert.equal(engine.completed.length, 0);
});

test("an install that throws does not escape into the queue", async () => {
    // The queue drains every job in one loop; one that throws would strand the
    // rest. A font that won't install is not worth taking the worker down for.
    const queue = manualQueue();
    const clock = manualClock();
    const fetch = heldFetch();
    const session: FontPumpSession = {
        takeFontRequests: () => [order(1)],
        completeFontRequest: () => {
            throw new Error("engine went away");
        },
        refreshFonts: () => true,
    };
    const kick = createFontPump({
        session: () => session,
        enqueue: queue.enqueue,
        repaint: () => {},
        fetch: fetch.fetch,
        schedule: clock.schedule,
    });
    kick();

    fetch.settle(1);
    await flush();
    clock.fireNext();

    assert.doesNotThrow(() => queue.run());
});

test("one order that throws does not strand the rest of the batch", async () => {
    // The engine keeps one order per font out at a time, so an order left
    // unsettled blocks that font's next order for the life of the session. A
    // neighbour's failure must not be what leaves it open.
    const queue = manualQueue();
    const clock = manualClock();
    const fetch = heldFetch();
    const engine = fakeSession([[order(1), order(2), order(3)]]);
    const settle = engine.session.completeFontRequest;
    engine.session.completeFontRequest = (id, binaries) => {
        if (Number(id) === 2) throw new Error("this font will not install");
        return settle(id, binaries);
    };
    const kick = createFontPump({
        session: () => engine.session,
        enqueue: queue.enqueue,
        repaint: () => {},
        fetch: fetch.fetch,
        schedule: clock.schedule,
    });
    kick();

    fetch.settle(1);
    fetch.settle(2);
    fetch.settle(3);
    await flush();
    clock.fireNext();
    queue.run();

    assert.deepEqual(
        engine.completed.map((c) => c.id),
        [1, 3],
        "the orders either side of the bad one still settled",
    );
    assert.equal(engine.refreshes(), 1, "and what did land is re-shaped");
});

test("a font landing during the wait joins the install", async () => {
    // The wait is what folds a document's opening fonts together: they land
    // milliseconds apart, and each would otherwise re-shape every page.
    const queue = manualQueue();
    const clock = manualClock();
    const fetch = heldFetch();
    const engine = fakeSession([[order(1), order(2)]]);
    const kick = createFontPump({
        session: () => engine.session,
        enqueue: queue.enqueue,
        repaint: () => {},
        fetch: fetch.fetch,
        schedule: clock.schedule,
    });
    kick();

    fetch.settle(1);
    await flush();
    fetch.settle(2);
    await flush();
    assert.equal(clock.waiting(), 1, "the second landing armed nothing of its own");
    clock.fireNext();
    queue.run();

    assert.deepEqual(
        engine.completed.map((c) => c.id),
        [1, 2],
    );
    assert.equal(engine.refreshes(), 1);
});

test("a batch of refusals re-shapes nothing, and takes the next orders at once", async () => {
    // Nothing was installed, so the page cannot change; and the engine put the
    // next vendor on order as it settled the refusal, so the pump takes it now.
    const queue = manualQueue();
    const clock = manualClock();
    const fetch = heldFetch();
    const engine = fakeSession([[order(1)], [order(2)]]);
    const kick = createFontPump({
        session: () => engine.session,
        enqueue: queue.enqueue,
        repaint: () => {},
        fetch: fetch.fetch,
        schedule: clock.schedule,
    });
    kick();

    fetch.settle(1, []);
    await flush();
    clock.fireNext();
    queue.run();

    assert.equal(engine.refreshes(), 0, "no re-shape for a refusal");
    assert.equal(clock.waiting(), 0, "and none owed for later");
    assert.ok(fetch.pending.has(2), "the next vendor's order went out");
});
