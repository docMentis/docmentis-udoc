// What a buyer's browser reports of a frontstage, for those who shared it: that it
// came, each file it opened, a session, and in that session, each stretch of time a
// page stayed on screen. A report that doesn't go through is let go: reading carries
// on regardless. A slide show counts for nothing here, since the viewer doesn't say
// which slide it's on (GAPS.md).
import type { FrontstageReport, FrontstageSession, PageView } from "../../shared/api.ts";

/** How often the time on a page is added up, in milliseconds. */
const TICK_MS = 1000;

/** How often what's added up is reported, in milliseconds. */
const REPORT_EVERY_MS = 15000;

/** How long, with nothing done, a page still counts as read, in milliseconds: left open, it doesn't. */
const IDLE_AFTER_MS = 60000;

/** The most page views one report tells of, as the backend takes them. */
const MAX_VIEWS_IN_REPORT = 64;

/** What's done to a page in reading it. */
const ACTIVITY = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"] as const;

/** Send `report`, which outlives the page if it's going: its answer, or none for one that didn't go through. */
async function send(token: string, report: FrontstageReport): Promise<Response | undefined> {
    try {
        return await fetch(`/api/frontstage/${encodeURIComponent(token)}/activity`, {
            method: "POST",
            keepalive: true,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(report),
        });
    } catch {
        // Let go: it's not the reader's to hear of.
        return undefined;
    }
}

/** Report file `fileId` opened: the session to report its page views in, or `null` for none, as for one not counted. */
async function open(token: string, fileId: string): Promise<string | null> {
    const answer = await send(token, { kind: "opened", fileId });
    if (answer?.status !== 201) return null;
    try {
        return ((await answer.json()) as FrontstageSession).session;
    } catch {
        return null;
    }
}

/** The links already reported as visited since this page loaded: once each, however often it's rendered. */
const visited = new Set<string>();

/** Report that the browser came to the frontstage at `token`. */
export function reportVisit(token: string): void {
    if (visited.has(token)) return;
    visited.add(token);
    void send(token, { kind: "visited" });
}

/** Someone reading a file: on which page, until it stops. */
export interface Reading {
    /** They've turned to `page`, 0-based. */
    turnTo(page: number): void;
    /** A slide show has started or ended. */
    presenting(playing: boolean): void;
    /** They've stopped: what's not reported yet is. */
    stop(): void;
}

/**
 * Report that file `fileId` of the frontstage at `token` was opened, a session of
 * its own, and from now on each stretch of time a page of it stays on screen: only
 * while the page is in view and something's been done with it lately, so that one
 * left open doesn't count. Each view is timed from the opening.
 */
export function startReading(token: string, fileId: string): Reading {
    const began = performance.now();
    // The session to report in: undefined until the opening's answered, `null` for none.
    let session: string | null | undefined;
    // The view going on, if a page is being read, and those begun or grown since the last report, by when they began.
    let current: PageView | undefined;
    const changed = new Map<number, PageView>();
    let page = 0;
    let inSlideShow = false;
    let lastTick = began;
    let lastActive = began;
    let lastReport = began;

    void open(token, fileId).then((opened) => {
        session = opened;
        report();
    });

    // What's changed, once there's a session to report it in; let go when there's none.
    function report() {
        if (session === undefined) return;
        const views = [...changed.values()];
        changed.clear();
        if (session === null) return;
        for (let first = 0; first < views.length; first += MAX_VIEWS_IN_REPORT)
            void send(token, { kind: "read", session, views: views.slice(first, first + MAX_VIEWS_IN_REPORT) });
    }

    function tick() {
        const now = performance.now();
        // A timer a hidden or sleeping page held back says nothing of reading.
        const elapsed = Math.min(now - lastTick, TICK_MS * 2);
        lastTick = now;
        if (!inSlideShow && document.visibilityState === "visible" && now - lastActive < IDLE_AFTER_MS) {
            // The page still on screen grows its view; another begins one, when the time just counted did.
            const to = Math.round(now - began);
            if (current?.page === page) current.to = to;
            else current = { page, from: Math.round(now - elapsed - began), to };
            if (current.to > current.from) changed.set(current.from, { ...current });
        } else current = undefined;
        if (now - lastReport >= REPORT_EVERY_MS) {
            lastReport = now;
            report();
        }
    }

    const active = () => {
        lastActive = performance.now();
    };
    const hidden = () => {
        if (document.visibilityState !== "hidden") return;
        tick();
        report();
    };
    const timer = setInterval(tick, TICK_MS);
    for (const event of ACTIVITY) window.addEventListener(event, active, { passive: true, capture: true });
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", report);

    return {
        turnTo(next) {
            tick();
            page = next;
            active();
        },
        presenting(playing) {
            tick();
            inSlideShow = playing;
            active();
        },
        stop() {
            tick();
            clearInterval(timer);
            for (const event of ACTIVITY) window.removeEventListener(event, active, { capture: true });
            document.removeEventListener("visibilitychange", hidden);
            window.removeEventListener("pagehide", report);
            report();
        },
    };
}
