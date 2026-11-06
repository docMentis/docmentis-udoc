/**
 * The wheel at a page's edge in single-page view: one swipe turns one page, and
 * a swipe made during the last one's momentum turns another. The streams have a
 * Mac trackpad's shape, a finger's ramp and then a decaying momentum, whose
 * frames with less than a whole pixel to send send nothing.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { WheelPaging } from "../../src/app/wheel-paging.ts";

interface Event {
    at: number;
    dx?: number;
    dy: number;
}

const FRAME = 1000 / 60;

function swipe({ at = 0, peak = 70, sign = 1, decay = 0.96, floor = 0.2 } = {}): Event[] {
    const events: Event[] = [];
    let time = at;
    let carry = 0;
    const emit = (speed: number): void => {
        carry += speed;
        const px = Math.trunc(carry);
        carry -= px;
        if (px !== 0) events.push({ at: time, dy: sign * px });
        time += FRAME;
    };
    for (const speed of [1, 3, 8, 16, 30, 48]) if (speed < peak) emit(speed);
    let speed = peak;
    emit(speed);
    emit(speed);
    while (speed > floor) {
        speed *= decay;
        emit(speed);
    }
    return events;
}

/** Swipes, each one's finger stopping the momentum of the one before as it lands. */
function swipes(...each: Event[][]): Event[] {
    return each.flatMap((events, i) => {
        const next = each[i + 1]?.[0]?.at ?? Infinity;
        return events.filter((event) => event.at < next - 40);
    });
}

function steady(px: number, every: number, count: number): Event[] {
    return Array.from({ length: count }, (_, i) => ({ at: i * every, dy: px }));
}

/** Run `events` on pages `height` px taller than the view, as the viewer moves them. */
function run(events: Event[], { height = 0, at = "top", pages = 20 } = {}) {
    const paging = new WheelPaging();
    let page = 10;
    let y = at === "top" ? 0 : height;
    const turns: number[] = [];
    for (const { at: time, dx = 0, dy } of events) {
        const direction = Math.sign(dy);
        const next = page + (direction || 1);
        const move = paging.step({
            time,
            dx,
            dy,
            room: dy > 0 ? height - y : dy < 0 ? y : 0,
            adjacent: next >= 0 && next < pages,
        });
        if (move === "scroll") y = Math.min(height, Math.max(0, y + dy));
        if (move === "turn") {
            page = next;
            y = direction > 0 ? 0 : height;
            turns.push(page);
        }
    }
    return { page, y, turns: turns.length };
}

test("a swipe on a page that fits turns it once, however long its momentum", () => {
    assert.deepEqual(run(swipe()), { page: 11, y: 0, turns: 1 });
    assert.deepEqual(run(swipe({ peak: 20 })), { page: 11, y: 0, turns: 1 });
    assert.deepEqual(run(swipe({ sign: -1 })), { page: 9, y: 0, turns: 1 });
});

test("the sparse end of momentum doesn't turn another page", () => {
    assert.equal(run(swipe({ floor: 0.06 })).turns, 1);
});

test("a swipe during the last one's momentum turns another page", () => {
    const quick = swipes(swipe(), swipe({ at: 450 }), swipe({ at: 900 }));
    assert.deepEqual(run(quick), { page: 13, y: 0, turns: 3 });
    const gentle = swipes(swipe({ peak: 25 }), swipe({ at: 700, peak: 25 }), swipe({ at: 1400, peak: 25 }));
    assert.deepEqual(run(gentle), { page: 13, y: 0, turns: 3 });
});

test("a swipe back during the last one's momentum turns back", () => {
    const events = swipes(swipe(), swipe({ at: 450, sign: -1 }));
    assert.deepEqual(run(events), { page: 10, y: 0, turns: 2 });
});

test("a light touch doesn't turn the page", () => {
    const touch = [1, 2, 2, 1].map((dy, i) => ({ at: i * FRAME, dy }));
    assert.equal(run(touch).turns, 0);
});

test("a sideways swipe drifting along the page doesn't turn it", () => {
    const events: Event[] = [];
    let speed = 50;
    let carry = 0;
    for (let i = 0; speed > 0.5; i++) {
        speed *= 0.96;
        carry += speed * 0.04;
        const dy = Math.trunc(carry);
        carry -= dy;
        events.push({ at: i * FRAME, dx: Math.round(speed), dy });
    }
    assert.equal(run(events).turns, 0);
});

test("a slow drag turns the page once, past the distance a touch can be", () => {
    assert.equal(run(steady(3, FRAME, 60)).turns, 1);
    assert.equal(run(steady(1, FRAME, 20)).turns, 0);
});

test("a main thread that stalls in momentum doesn't turn another page", () => {
    const events = swipe();
    const start = events[25]!.at;
    const end = start + 220;
    const queued = events.filter((event) => event.at >= start && event.at < end);
    const stalled = [
        ...events.filter((event) => event.at < start),
        { at: end, dy: queued.reduce((sum, event) => sum + event.dy, 0) },
        ...events.filter((event) => event.at >= end),
    ];
    assert.equal(run(stalled).turns, 1);
});

test("each tick of a mouse wheel turns a page", () => {
    assert.equal(run(steady(100, 200, 3)).turns, 3);
    // A Mac's slowest tick.
    assert.equal(run(steady(4.000244140625, 300, 3)).turns, 3);
});

test("a tick of a mouse wheel after a swipe's momentum turns a page, however long after", () => {
    const events = swipe();
    const end = events.at(-1)!.at;
    for (const pause of [150, 400, 800, 1500, 5000, 20000]) {
        const tick = { at: end + pause, dy: 100 };
        assert.deepEqual(run([...events, tick]), { page: 12, y: 0, turns: 2 }, `after ${pause}ms`);
    }
});

test("a wheel spun without a pause turns one page", () => {
    assert.equal(run(steady(100, 50, 10)).turns, 1);
});

test("a swipe inside a taller page stops at its edge, and the next one turns it", () => {
    const tall = { height: 400 };
    const first = swipe();
    assert.deepEqual(run(first, tall), { page: 10, y: 400, turns: 0 });
    assert.deepEqual(run(swipes(first, swipe({ at: 700 })), tall), { page: 11, y: 0, turns: 1 });
});

test("a swipe that stays inside a taller page only scrolls it", () => {
    const { page, y, turns } = run(swipe({ peak: 20 }), { height: 5000 });
    assert.equal(page, 10);
    assert.equal(turns, 0);
    assert.ok(y > 0 && y < 5000);
});

test("the rest of a swipe leaves the page it turned to where it landed", () => {
    const tall = { height: 400 };
    assert.deepEqual(run(swipe(), { ...tall, at: "bottom" }), { page: 11, y: 0, turns: 1 });
    assert.deepEqual(run(swipe({ sign: -1 }), tall), { page: 9, y: 400, turns: 1 });
});

test("a page barely taller than the view turns like one that fits", () => {
    assert.deepEqual(run(swipe(), { height: 10 }), { page: 11, y: 0, turns: 1 });
});

test("a tick scrolling a page to its edge shows it, and the next tick turns it", () => {
    const events = steady(100, 200, 2);
    assert.deepEqual(run(events, { height: 25 }), { page: 11, y: 0, turns: 1 });
    assert.deepEqual(run(events.slice(0, 1), { height: 25 }), { page: 10, y: 25, turns: 0 });
});

test("the last page's edge has nothing to turn to", () => {
    const paging = new WheelPaging();
    for (const { at, dy } of swipe()) {
        assert.equal(paging.step({ time: at, dx: 0, dy, room: 0, adjacent: false }), "scroll");
    }
});
