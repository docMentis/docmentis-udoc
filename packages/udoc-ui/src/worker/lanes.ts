// The engine worker's two lanes of jobs on the session: a reader's requests,
// and background work.
//
// Everything that touches the session runs as a job, one at a time, and a job
// that started runs to its end. Within that, a **request** — whatever the host
// sends, unless it marks it background — runs before any **background** job:
// the sheet walk, the font pump's installs, and the host's background requests
// (compose-ahead, thumbnails). A background job runs one per turn of the event
// loop, and only once no frame is pending: the frame a request scheduled paints
// before the next background job, and a request that arrives meanwhile goes
// ahead of it. So a reader waits at most for the one background job already
// running, never for a line of them.
//
// Frames run outside the lanes, on `requestAnimationFrame`; the worker tells
// the lanes once each frame has run (`framed`), and background work resumes.

/** One job on the session. */
export type Job = () => void | Promise<void>;

/** What the lanes need from the worker. */
export interface LanesHost {
    /** Whether a frame is scheduled and hasn't run yet. */
    framePending(): boolean;
    /** Run `callback` on a later turn of the event loop. */
    schedule(callback: () => void): void;
    /** A job threw `error`; the lanes go on to the next. */
    report(error: unknown): void;
}

export interface Lanes {
    /** Run `job` once the session is free, after the requests already waiting and before any background job. */
    request(job: Job): void;
    /** Run `job` once no request is waiting and no frame is pending, after the background jobs already waiting. */
    background(job: Job): void;
    /** A scheduled frame has run, or was dropped: background work may resume. */
    framed(): void;
}

export function createLanes(host: LanesHost): Lanes {
    const requests: Job[] = [];
    const background: Job[] = [];
    // Whether a job is running — a request or a background one.
    let running = false;
    // Whether a background turn is scheduled.
    let turnScheduled = false;

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
        scheduleTurn();
    }

    function scheduleTurn(): void {
        if (turnScheduled || background.length === 0) return;
        turnScheduled = true;
        host.schedule(() => void turn());
    }

    async function turn(): Promise<void> {
        turnScheduled = false;
        // A request goes first, and so does the frame one scheduled; each
        // schedules the next turn once it is done.
        if (running || requests.length > 0 || host.framePending()) return;
        const job = background.shift();
        if (!job) return;
        running = true;
        await run(job);
        running = false;
        if (requests.length > 0) void drainRequests();
        else scheduleTurn();
    }

    return {
        request(job) {
            requests.push(job);
            if (!running) void drainRequests();
        },
        background(job) {
            background.push(job);
            if (!running) scheduleTurn();
        },
        framed() {
            if (!running) scheduleTurn();
        },
    };
}
