/**
 * The font pump: ask the engine what it needs, fetch it, install it, repeat.
 *
 * One rule shapes this whole file — **the network wait never runs on the
 * worker's job queue.** That queue exists so nothing touches the Rust session
 * concurrently, and it serializes: while a job runs, every message behind it
 * waits, including a scroll's `setViewport`, a keystroke's `execute` and a
 * click's `hitTest`. A css2 round trip is hundreds of milliseconds, so a pump
 * that awaited inside a handler would freeze the document view for the length of
 * the download — which is exactly the freeze the whole "downloading lives in JS"
 * design set out to remove.
 *
 * So {@link createFontPump} splits the cycle in two. Taking orders and starting
 * fetches is synchronous and returns immediately; the waiting happens out on the
 * event loop; and only the install — the `&mut self` part — goes back through
 * the queue as a job of its own.
 *
 * The pump also drives itself. A settled order can put more on order (a vendor
 * that turned out not to have the characters puts the next one on order), so
 * settling kicks again and the cycle runs to quiet without anyone asking.
 *
 * And it keeps re-shaping rare, because a re-shape is `refresh_fonts`: every
 * composed page laid out again, as one job the reader waits behind. Fonts that
 * land within {@link INSTALL_WAIT_MS} of each other install together, and a
 * batch that installed a font re-shapes at once. A batch of nothing but
 * refusals — "this vendor has none of those" — re-shapes not at all: it
 * installed nothing, so nothing on screen can change, and the engine has
 * already put the next vendor on order.
 */

import type { FontRequest } from "@docmentis/udoc-wasm";

/**
 * The session surface a pump touches. Every call here is `&mut self` in Rust,
 * which is why they only ever happen inside a queued job.
 */
export interface FontPumpSession {
    takeFontRequests(): FontRequest[];
    completeFontRequest(id: bigint, binaries: Uint8Array[]): boolean;
    refreshFonts(): boolean;
}

/**
 * How long the first font to land waits for others before installing. Each
 * install re-shapes every composed page, and a document's opening fonts land
 * within moments of each other — a few milliseconds apart, they would each pay
 * for a whole re-shape.
 */
const INSTALL_WAIT_MS = 100;

/** What a pump needs from its worker. */
export interface FontPumpDeps {
    /** The live session, or `null` once it is closed or replaced. */
    session: () => FontPumpSession | null;
    /** Run a job when the session is free. Jobs never overlap. */
    enqueue: (job: () => void) => void;
    /** Repaint — an install changed what the page looks like. */
    repaint: () => void;
    /**
     * How an order becomes bytes — `fetchFontBinaries` in the worker.
     *
     * A parameter rather than an import because this file is *when* to fetch and
     * `@docmentis/udoc-wasm`'s `font-fulfill.ts` is *how*; the worker is where
     * the two meet. It also keeps the pump's ordering testable without a network.
     */
    fetch: (order: FontRequest) => Promise<Uint8Array[]>;
    /**
     * Run `callback` after `ms` — `setTimeout` in the worker. A parameter so
     * tests move the clock by hand.
     */
    schedule: (callback: () => void, ms: number) => void;
}

/** A pump: its kick, and what waits for it to go quiet. */
export interface FontPump {
    /**
     * Take what is on order and start fetching it. Call it whenever a layout
     * change may have put new families on order. It starts the fetches and
     * returns — there is no round to drive, no result to wait for, and calling
     * it with nothing on order costs a `takeFontRequests`.
     */
    (): void;
    /**
     * Kick, then resolve once nothing is on order, in the air or waiting to
     * install: `true` if anything was, and the pages may have been laid out
     * again; `false`, at once, if nothing was. For an export, which draws the
     * document's own fonts only once those on order have landed. It waits on
     * the event loop, never in a job; it ends because every order does — a
     * fetch that fails answers with nothing — and a family's chain of vendors
     * is finite.
     */
    settled(): Promise<boolean>;
}

/** Build a pump, returning its kick, with {@link FontPump.settled} on it. */
export function createFontPump(deps: FontPumpDeps): FontPump {
    /** Fetched orders waiting to be installed, so a burst installs in one pass. */
    const landed: Array<{ id: number; binaries: Uint8Array[] }> = [];
    let installArmed = false;
    /** Orders taken and not yet installed: in the air, or landed and waiting. */
    let open = 0;
    /** Who waits for {@link FontPump.settled}, each told once `open` is back to none. */
    const waiting: Array<() => void> = [];

    function kick(): void {
        const session = deps.session();
        if (!session) return;
        for (const order of session.takeFontRequests()) {
            open++;
            void deps.fetch(order).then((binaries) => {
                landed.push({ id: order.id, binaries });
                // One install per burst, not one per order: the first to land
                // waits a moment, and everything landing before its install
                // runs joins it — so a document ordering twenty families
                // re-shapes a handful of times rather than twenty.
                if (installArmed) return;
                installArmed = true;
                deps.schedule(() => deps.enqueue(install), INSTALL_WAIT_MS);
            });
        }
    }

    function install(): void {
        installArmed = false;
        const batch = landed.splice(0);
        open -= batch.length;
        const session = deps.session();
        // Closed or replaced mid-flight. The ids are dead either way — they are
        // minted from a process-global counter, so a new session never reuses
        // one — but dropping the binaries here frees them.
        if (!session) {
            quieted();
            return;
        }
        let installed = false;
        for (const { id, binaries } of batch) {
            try {
                // `[]` is a complete answer: "this vendor has nothing". Either
                // way the order is finished, and a refusal puts the next vendor
                // on order.
                if (!session.completeFontRequest(BigInt(id), binaries)) continue;
                if (binaries.length > 0) installed = true;
            } catch {
                // Per order, not per batch. The engine keeps one order per font
                // out at a time, so an order left unsettled by a *neighbour's*
                // failure would block that font's next order for the life of
                // the session. A font that won't install costs its own order
                // and no one else's.
            }
        }
        try {
            // Lay the composed pages out again against what is installed now. A
            // batch of refusals installed nothing, so there is nothing to lay out.
            if (installed && session.refreshFonts()) deps.repaint();
            // A settled order frees its font's next one, refused or not.
            kick();
        } catch {
            // This runs as a queued job, with no request behind it to fail: a
            // re-shape that won't run is not worth taking the worker down for.
        }
        quieted();
    }

    /** Tell whoever waits that the pump is quiet, once nothing is open. */
    function quieted(): void {
        if (open > 0) return;
        for (const resolve of waiting.splice(0)) resolve();
    }

    function settled(): Promise<boolean> {
        kick();
        if (open === 0) return Promise.resolve(false);
        return new Promise((resolve) => waiting.push(() => resolve(true)));
    }

    return Object.assign(kick, { settled });
}
