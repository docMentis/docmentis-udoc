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
 * The pump also drives itself. A landed font can put more on order (a vendor
 * that turned out not to have the characters advances the chain), so installing
 * kicks again and the cycle runs to quiet without anyone asking.
 *
 * And it keeps re-shaping rare, because a re-shape is `refresh_fonts`: every
 * composed page laid out again, as one job the reader waits behind. Fonts that
 * land within {@link INSTALL_WAIT_MS} of each other install together; a batch
 * that installed a font re-shapes at once; and a batch of nothing but refusals
 * — "this vendor has none of those" — changes nothing on screen, so its
 * re-shape waits {@link REFUSAL_RESHAPE_MS} for one that will happen anyway.
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

/**
 * How long a refusal waits for a re-shape before forcing one.
 *
 * A refusal still owes one: re-resolving is what asks the next vendor down the
 * chain, so a character a vendor refused keeps its stand-in until something
 * re-shapes it. A font that installs meanwhile re-shapes anyway and pays the
 * debt; otherwise this does, once the refusals stop coming.
 */
const REFUSAL_RESHAPE_MS = 500;

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
     * Run `callback` after `ms`, returning what cancels it — `setTimeout` in the
     * worker. A parameter so tests move the clock by hand.
     */
    schedule: (callback: () => void, ms: number) => () => void;
}

/**
 * Build a pump, returning its kick.
 *
 * Call the kick whenever a layout change may have put new families on order. It
 * starts the fetches and returns — there is no round to drive, no result to
 * wait for, and calling it with nothing on order costs a `takeFontRequests`.
 */
export function createFontPump(deps: FontPumpDeps): () => void {
    /** Fetched orders waiting to be installed, so a burst installs in one pass. */
    const landed: Array<{ id: number; binaries: Uint8Array[] }> = [];
    let installArmed = false;
    /**
     * The session a refusal settled in since its last re-shape, which owes it
     * one — or `null`. A session, not a flag, so a document replaced during the
     * wait is not re-shaped for its predecessor's refusals.
     */
    let owedBy: FontPumpSession | null = null;
    /** Cancels the wait before the owed re-shape, while it is still waiting. */
    let cancelOwed: (() => void) | null = null;

    function kick(): void {
        const session = deps.session();
        if (!session) return;
        for (const order of session.takeFontRequests()) {
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

    /** Lay the composed pages out again against what is installed now. */
    function reshape(session: FontPumpSession): void {
        owedBy = null;
        cancelOwed?.();
        cancelOwed = null;
        if (session.refreshFonts()) deps.repaint();
    }

    function install(): void {
        installArmed = false;
        const batch = landed.splice(0);
        const session = deps.session();
        // Closed or replaced mid-flight. The ids are dead either way — they are
        // minted from a process-global counter, so a new session never reuses
        // one — but dropping the binaries here frees them.
        if (!session) return;
        let installed = false;
        let refused = false;
        for (const { id, binaries } of batch) {
            try {
                // `[]` is a complete answer: "this vendor has nothing". Either
                // way the order is finished, so the next layout moves on.
                if (!session.completeFontRequest(BigInt(id), binaries)) continue;
                if (binaries.length > 0) installed = true;
                else refused = true;
            } catch {
                // Per order, not per batch. The engine keeps one order per font
                // out at a time, so an order left unsettled by a *neighbour's*
                // failure would block that font's next order for the life of
                // the session. A font that won't install costs its own order
                // and no one else's.
            }
        }
        try {
            if (installed) {
                reshape(session);
            } else if (refused) {
                // Nothing new to draw with, so nothing on screen changes yet —
                // but the refusal is owed a re-shape, the one that asks the next
                // vendor. Each refusal pushes it back, so it runs once they
                // stop coming, unless an install pays it first.
                owedBy = session;
                cancelOwed?.();
                cancelOwed = deps.schedule(() => {
                    cancelOwed = null;
                    deps.enqueue(reshapeOwed);
                }, REFUSAL_RESHAPE_MS);
            }
            // A settled order frees its font's next one, refused or not.
            kick();
        } catch {
            // This runs as a queued job, with no request behind it to fail: a
            // re-shape that won't run is not worth taking the worker down for.
        }
    }

    /** The re-shape refusals were owed, once nothing else paid it. */
    function reshapeOwed(): void {
        const session = deps.session();
        // An install between the wait and this job already re-shaped.
        if (!session || session !== owedBy) return;
        try {
            reshape(session);
            kick();
        } catch {
            // As in `install`: no request behind it to fail.
        }
    }

    return kick;
}
