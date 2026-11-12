// Cutting a branch's edit log when its idle session closes
// (docs/design/node-log-cut.md): the history before the version this writes
// leaves the log, so what later opens load is the state there and what follows.
// A collaboration holds its session busy, so no client is connected by then.

import { branchOfKey } from "./branch.ts";
import type { VersionNumbers } from "./branch.ts";
import type { BeforeIdleClose } from "./session-pool.ts";
import type { DocumentStore } from "./store.ts";

/** What cuts a branch's log, over `store`, when that saves at least `minSavedBytes`; its version numbered by `numbers`. */
export function logCutter(store: DocumentStore, numbers: VersionNumbers, minSavedBytes: number): BeforeIdleClose {
    return async (key, session) => {
        const { id, branch } = branchOfKey(key);
        const description = await store.getDescription(id, { branch });
        // No log to cut.
        if (description?.baselineFrontier === undefined) return;
        await numbers.next(id, async (version) => {
            const cut = await session.cutLog(version, minSavedBytes);
            if (!cut) return;
            // The version's frontier is the cut's marker, which the log kept has to
            // hold before the version exists, or a crash between the two leaves a
            // branch that doesn't open.
            await store.putLog(id, branch, await session.snapshot());
            await store.putCut(id, branch, version, cut.checkpoint, cut.log);
        });
    };
}
