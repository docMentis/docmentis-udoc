/**
 * Performance counter for the render path, modelled on the previous
 * udoc-viewer's counter but adapted for a continuous render loop.
 *
 * That counter tracked discrete operations (load, renderPage, …) and kept every
 * start/end entry. Here `repaint` fires on every animation frame, so an
 * unbounded entry log would grow without limit; instead this aggregates
 * durations per event type over a rolling window and reports a {@link
 * PerfSummary} (count / avg / min / max / last). The window is cleared with
 * {@link IPerformanceCounter.reset} after each report, so memory stays bounded.
 */

/**
 * Operations the render path times. `repaint` is the whole frame; the four phase
 * events break it down (the wasm engine reports them via `frameTimings`):
 * `reconcile` (relayout + page load/decode), `record` (building the draw-op
 * scene), `rasterize` (CPU raster), and `composite` (un-premultiply + blit).
 *
 * The rest time one step of the worker's background work each, by its task: a
 * font install, a thumbnail render, a compose-ahead step and a sheet loaded by
 * the sheet walk. A step can't be interrupted, so its length is the longest a
 * reader who comes back during it waits.
 */
export type PerfEvent =
    | "open"
    | "repaint"
    | "reconcile"
    | "record"
    | "rasterize"
    | "composite"
    | "fontInstall"
    | "thumbnail"
    | "composeAhead"
    | "sheetWalk";

/** Aggregated timing for one event type over the current window. */
export interface PerfEventStats {
    /** Number of samples in the window. */
    count: number;
    /** Sum of durations (ms). */
    total: number;
    /** Mean duration (ms). */
    avg: number;
    /** Fastest sample (ms). */
    min: number;
    /** Slowest sample (ms). */
    max: number;
    /** Most recent sample (ms). */
    last: number;
}

/** A snapshot of all event timings since the last reset. */
export interface PerfSummary {
    /** Wall-clock span the samples were collected over (ms). */
    windowMs: number;
    /** Per-event-type aggregates. */
    breakdown: Partial<Record<PerfEvent, PerfEventStats>>;
}

export interface IPerformanceCounter {
    /** Whether timing is recorded (false for the no-op counter). */
    readonly enabled: boolean;

    /** Record a completed operation's `durationMs` directly (synchronous ops). */
    record(type: PerfEvent, durationMs: number): void;

    /** Mark the start of an operation; pass the returned id to {@link markEnd}. */
    markStart(type: PerfEvent): string;

    /** Mark the end of the operation `id` from {@link markStart}. */
    markEnd(id: string): void;

    /** Aggregate the current window into a {@link PerfSummary}. */
    getSummary(): PerfSummary;

    /** Clear all samples and restart the window. */
    reset(): void;
}

export class PerformanceCounter implements IPerformanceCounter {
    readonly enabled = true;

    #samples = new Map<PerfEvent, number[]>();
    #pending = new Map<string, { type: PerfEvent; start: number }>();
    #idCounter = 0;
    #windowStart = performance.now();

    record(type: PerfEvent, durationMs: number): void {
        const samples = this.#samples.get(type);
        if (samples) samples.push(durationMs);
        else this.#samples.set(type, [durationMs]);
    }

    markStart(type: PerfEvent): string {
        const id = `${type}_${++this.#idCounter}`;
        this.#pending.set(id, { type, start: performance.now() });
        return id;
    }

    markEnd(id: string): void {
        const pending = this.#pending.get(id);
        if (!pending) return;
        this.#pending.delete(id);
        this.record(pending.type, performance.now() - pending.start);
    }

    getSummary(): PerfSummary {
        const breakdown: Partial<Record<PerfEvent, PerfEventStats>> = {};
        for (const [type, samples] of this.#samples) {
            if (samples.length === 0) continue;
            let total = 0;
            let min = Infinity;
            let max = -Infinity;
            for (const d of samples) {
                total += d;
                if (d < min) min = d;
                if (d > max) max = d;
            }
            breakdown[type] = {
                count: samples.length,
                total,
                avg: total / samples.length,
                min,
                max,
                last: samples[samples.length - 1] ?? 0,
            };
        }
        return { windowMs: performance.now() - this.#windowStart, breakdown };
    }

    reset(): void {
        this.#samples.clear();
        this.#pending.clear();
        this.#windowStart = performance.now();
    }
}

/** No-op counter: all methods are cheap no-ops, for when timing is disabled. */
export class NoOpPerformanceCounter implements IPerformanceCounter {
    readonly enabled = false;
    record(): void {}
    markStart(): string {
        return "";
    }
    markEnd(): void {}
    getSummary(): PerfSummary {
        return { windowMs: 0, breakdown: {} };
    }
    reset(): void {}
}
