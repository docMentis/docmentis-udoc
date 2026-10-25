// The engine worker's two lanes of jobs on the session: a reader's requests,
// and background work.
//
// Everything that touches the session runs as a job, one at a time, and a job
// that started runs to its end. Within that, a **request** — whatever the host
// sends — runs before any background work, which comes from **tasks**, each a
// source of one kind of it, in order of priority: the font pump's installs, the
// thumbnail strip's renders, compose-ahead, the sheet walk. A task hands its
// work out a slice at a time, taken only when it runs, so no slice is queued
// ahead of time: a task whose work changed (a new document, a cancelled
// thumbnail) has nothing stale left to drop.
//
// A slice runs one per turn of the event loop, and only once no request is
// waiting, no frame is pending, and the reader has been quiet for as long as
// its task asks (`quietMs`): the frame a request scheduled paints first, a
// request that arrives meanwhile goes ahead, and a scroll, a hover or a
// keystroke doesn't land behind work that could have waited for it. So a reader
// waits at most for the one slice already running, never for a line of them.
//
// Frames run outside the lanes, on `requestAnimationFrame`; the worker tells
// the lanes once each frame has run (`framed`), and background work resumes.

/** One job on the session. */
export type Job = () => void | Promise<void>;

/** A source of background work, handing it out a slice at a time. */
export interface Task {
    /** How long the reader must have been quiet before a slice of this task runs, in ms. */
    readonly quietMs: number;
    /** Whether the task has a slice to run. */
    pending(): boolean;
    /** Take the task's next slice. Asked only while it is {@link pending}, as the slice is about to run. */
    take(): Job;
}

/** What the lanes need from the worker. */
export interface LanesHost {
    /** Whether a frame is scheduled and hasn't run yet. */
    framePending(): boolean;
    /** The time now, in ms. */
    now(): number;
    /** Run `callback` on a later turn of the event loop, `ms` from now; returns what cancels it. */
    schedule(callback: () => void, ms: number): () => void;
    /** A job threw `error`; the lanes go on to the next. */
    report(error: unknown): void;
}

export interface Lanes {
    /** Run `job` once the session is free, after the requests already waiting and before any background work. */
    request(job: Job): void;
    /** A task may have work it didn't have: run it when its turn comes. */
    wake(): void;
    /** The reader did something: each task waits out its quiet window again. */
    active(): void;
    /** A scheduled frame has run, or was dropped: background work may resume. */
    framed(): void;
}

/** Lanes running `tasks`' work in the background, the first task's before the next's. */
export function createLanes(host: LanesHost, tasks: readonly Task[]): Lanes {
    const requests: Job[] = [];
    // Whether a job is running — a request or a slice.
    let running = false;
    // When the reader last did something.
    let lastActive = -Infinity;
    // When the scheduled turn is due, and what cancels it; none is `Infinity`.
    let turnAt = Infinity;
    let cancelTurn: (() => void) | null = null;

    /** Run `job`, reporting what it throws: one job failing must not wedge the lanes. */
    async function run(job: Job): Promise<void> {
        try {
            await job();
        } catch (error) {
            host.report(error);
        }
    }

    async function drainRequests(): Promise<void> {
        running = true;
        while (requests.length > 0) await run(requests.shift()!);
        running = false;
        scheduleTurn(0);
    }

    /** Schedule a turn `ms` from now, unless one is due sooner or no task has work. */
    function scheduleTurn(ms: number): void {
        if (!tasks.some((task) => task.pending())) return;
        const at = host.now() + ms;
        if (at >= turnAt) return;
        cancelTurn?.();
        turnAt = at;
        cancelTurn = host.schedule(() => {
            turnAt = Infinity;
            cancelTurn = null;
            void turn();
        }, ms);
    }

    async function turn(): Promise<void> {
        // A request goes first, and so does the frame one scheduled; each
        // schedules the next turn once it is done.
        if (running || requests.length > 0 || host.framePending()) return;
        const quietFor = host.now() - lastActive;
        let wait = Infinity;
        for (const task of tasks) {
            if (!task.pending()) continue;
            if (quietFor < task.quietMs) {
                wait = Math.min(wait, task.quietMs - quietFor);
                continue;
            }
            running = true;
            await run(() => task.take()());
            running = false;
            if (requests.length > 0) void drainRequests();
            else scheduleTurn(0);
            return;
        }
        // Each task with work is waiting for the reader to go quiet.
        if (wait < Infinity) scheduleTurn(wait);
    }

    return {
        request(job) {
            requests.push(job);
            if (!running) void drainRequests();
        },
        wake() {
            if (!running) scheduleTurn(0);
        },
        active() {
            lastActive = host.now();
        },
        framed() {
            if (!running) scheduleTurn(0);
        },
    };
}
