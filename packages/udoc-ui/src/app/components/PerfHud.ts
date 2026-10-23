import type { PerfSummary } from "../../performance/index.js";

/**
 * A small on-screen heads-up display for the render path's performance counter,
 * toggled from the More menu's "Developer" dialog. It renders the
 * repaint timings from the {@link PerfSummary} the worker streams: a headline
 * (fps + samples), the per-frame spread (avg/min/max/last), and a phase
 * breakdown (reconcile / record / rasterize / composite avg ms) so the slow
 * stage is obvious at a glance.
 *
 * Purely presentational: the shell drives it, calling {@link update} on each
 * worker perf report and {@link show}/{@link hide} as the toggle changes.
 */
export function createPerfHud() {
    const el = document.createElement("div");
    el.className = "udoc-perf-hud";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "off");
    el.setAttribute("aria-label", "Performance counter");
    el.style.display = "none";

    const title = document.createElement("div");
    title.className = "udoc-perf-hud__title";
    title.textContent = "performance";
    el.appendChild(title);

    const line1 = document.createElement("div");
    line1.className = "udoc-perf-hud__line";
    const line2 = document.createElement("div");
    line2.className = "udoc-perf-hud__line";
    const line3 = document.createElement("div");
    line3.className = "udoc-perf-hud__line";
    el.append(line1, line2, line3);

    function fmt(ms: number): string {
        return ms >= 100 ? ms.toFixed(0) : ms.toFixed(1);
    }

    /** Average ms for a phase event, or 0 if it has no samples this window. */
    function phaseAvg(summary: PerfSummary, event: "reconcile" | "record" | "rasterize" | "composite"): number {
        return summary.breakdown[event]?.avg ?? 0;
    }

    function update(summary: PerfSummary): void {
        const repaint = summary.breakdown.repaint;
        if (repaint && repaint.avg > 0) {
            // Line 1: the headline (fps + how many frames it's over).
            // Line 2: the per-frame timing spread.
            // Line 3: where the frame's time went, by phase.
            line1.textContent = `${(1000 / repaint.avg).toFixed(0)} fps · ${repaint.count} samples`;
            line2.textContent =
                `avg ${fmt(repaint.avg)} · min ${fmt(repaint.min)} · ` +
                `max ${fmt(repaint.max)} · last ${fmt(repaint.last)} ms`;
            line3.textContent =
                `reconcile ${fmt(phaseAvg(summary, "reconcile"))} · ` +
                `record ${fmt(phaseAvg(summary, "record"))} · ` +
                `raster ${fmt(phaseAvg(summary, "rasterize"))} · ` +
                `composite ${fmt(phaseAvg(summary, "composite"))} ms`;
        } else {
            line1.textContent = "idle";
            line2.textContent = "";
            line3.textContent = "";
        }
    }

    function show(): void {
        el.style.display = "";
    }

    function hide(): void {
        el.style.display = "none";
    }

    return { el, update, show, hide };
}

export type PerfHud = ReturnType<typeof createPerfHud>;
