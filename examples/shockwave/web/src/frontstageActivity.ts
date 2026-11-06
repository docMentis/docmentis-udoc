// What a buyer's browser reports of a frontstage, for those who shared it: that it
// came, what it opened, and how long each page stayed on screen. A report that
// doesn't go through is let go: reading carries on regardless. A slide show counts
// for nothing here, since the viewer doesn't say which slide it's on (GAPS.md).
import type { FrontstageReport } from "../../shared/api.ts";

/** How often the time on a page is added up, in milliseconds. */
const TICK_MS = 1000;

/** How often what's added up is reported, in milliseconds. */
const REPORT_EVERY_MS = 15000;

/** How long, with nothing done, a page still counts as read, in milliseconds: left open, it doesn't. */
const IDLE_AFTER_MS = 60000;

/** What's done to a page in reading it. */
const ACTIVITY = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"] as const;

/** Send `report`, which outlives the page if it's going. */
function send(token: string, report: FrontstageReport): void {
    void fetch(`/api/frontstage/${encodeURIComponent(token)}/activity`, {
        method: "POST",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(report),
    }).catch(() => {
        // Let go: it's not the reader's to hear of.
    });
}

/** The links already reported as visited since this page loaded: once each, however often it's rendered. */
const visited = new Set<string>();

/** Report that the browser came to the frontstage at `token`. */
export function reportVisit(token: string): void {
    if (visited.has(token)) return;
    visited.add(token);
    send(token, { kind: "visited" });
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
 * Report that file `fileId` of the frontstage at `token` was opened, and from now on
 * how long each page of it stays on screen: only while the page is in view and
 * something's been done with it lately, so that one left open doesn't count.
 */
export function startReading(token: string, fileId: string): Reading {
    send(token, { kind: "opened", fileId });
    const read = new Map<number, number>();
    let page = 0;
    let inSlideShow = false;
    let lastTick = performance.now();
    let lastActive = lastTick;
    let lastReport = lastTick;

    function report() {
        const pages = [...read].flatMap(([each, ms]) => {
            const whole = Math.round(ms);
            return whole > 0 ? [{ page: each, ms: whole }] : [];
        });
        read.clear();
        if (pages.length > 0) send(token, { kind: "read", fileId, pages });
    }

    function tick() {
        const now = performance.now();
        // A timer a hidden or sleeping page held back says nothing of reading.
        const elapsed = Math.min(now - lastTick, TICK_MS * 2);
        lastTick = now;
        if (!inSlideShow && document.visibilityState === "visible" && now - lastActive < IDLE_AFTER_MS)
            read.set(page, (read.get(page) ?? 0) + elapsed);
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
