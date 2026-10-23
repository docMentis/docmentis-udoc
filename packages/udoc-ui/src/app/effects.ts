import type { Store } from "../framework/index.js";
import type { Action } from "./actions.js";
import type { UIState } from "./state.js";

/**
 * The async / background-work layer.
 *
 * The interactive render loop lives in the Canvas component (it owns the canvas
 * and the rAF loop) and in the worker (which owns the OffscreenCanvas). Effects
 * own everything *off* the hot path — currently just the document-generation
 * guard below; lazy loads (outline, page text, thumbnails) land here next, using
 * `docGeneration` to discard stale async results after a document switch.
 */
export function createEffects(store: Store<UIState, Action>): { destroy: () => void } {
    // The store's `docGeneration` bumps whenever a *new* document is opened, so
    // in-flight async work can compare against it and bail out when stale.
    // Reserved for future lazy-load effects.
    const unsubscribe = store.subscribeEffect((prev, next) => {
        if (prev.docGeneration !== next.docGeneration) {
            // A new document was opened — discard any in-flight async work here.
        }
    });

    return {
        destroy(): void {
            unsubscribe();
        },
    };
}
