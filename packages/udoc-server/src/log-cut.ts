// Cutting a document's edit log when its idle session closes
// (docs/design/node-log-cut.md): the history before the checkpoint this writes
// leaves the log, so what later opens load is the state there and what follows.
// A collaboration holds its session busy, so no client is connected by then.

import type { BeforeIdleClose } from "./session-pool.ts";
import type { DocumentStore } from "./store.ts";

/** What cuts a document's log, over `store`, when that saves at least `minSavedBytes`. */
export function logCutter(store: DocumentStore, minSavedBytes: number): BeforeIdleClose {
    return async (id, session) => {
        const description = await store.getDescription(id);
        // No log to cut.
        if (description?.baselineFrontier === undefined) return;
        const version = description.baselineVersion + 1;
        const cut = await session.cutLog(version, minSavedBytes);
        if (!cut) return;
        // The checkpoint's frontier is the cut's marker, which the log kept has to
        // hold before the checkpoint exists, or a crash between the two leaves a
        // document that doesn't open.
        await store.putLog(id, await session.snapshot());
        await store.putCut(id, version, cut.checkpoint, cut.log);
    };
}
