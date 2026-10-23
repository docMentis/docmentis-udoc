/**
 * Selector utilities.
 *
 * Adapted from the `docmentis-udoc-viewer` ui/framework layer (MIT).
 *
 * Why selectors:
 * - Most components only care about a small slice of global state.
 * - Using selectors lets you re-render only when that slice changes.
 * - This keeps DOM work cheap and avoids coupling components to the full state.
 *
 * How to use:
 * 1) Define a selector that returns the minimal shape you need.
 * 2) Subscribe with equality to skip redundant updates.
 * 3) In the callback, patch DOM (render) or run async work (effect).
 *
 * Example (render):
 * ```ts
 * const selectToolbar = (s: UIState) => ({ page: s.pageIndex, composedPageCount: s.composedPageCount });
 * const off = subscribeSelector(store, selectToolbar, (next) => {
 *     pageInput.value = String(next.page + 1);
 * }, { equality: shallowEqual });
 * ```
 *
 * Example (effect):
 * ```ts
 * const off = subscribeSelector(store, (s) => s.zoom, (zoom) => {
 *     void rerender(zoom);
 * }, { phase: "effect" });
 * ```
 */
import type { Store } from "./store.js";

export type Equality<T> = (a: T, b: T) => boolean;
export type Selector<S, T> = (state: S) => T;

/** Shallow object equality for small selector slices. */
export function shallowEqual<T extends Record<string, unknown>>(a: T, b: T): boolean {
    for (const k in a) if (a[k] !== b[k]) return false;
    for (const k in b) if (!(k in a)) return false;
    return true;
}

/**
 * Subscribe to a derived slice with equality checking.
 * Default phase is render; use phase "effect" for async work.
 */
export function subscribeSelector<S, A, T>(
    store: Store<S, A>,
    selector: Selector<S, T>,
    listener: (next: T, prev: T) => void,
    options: { equality?: Equality<T>; phase?: "render" | "effect" } = {},
): () => void {
    const equality = options.equality ?? Object.is;
    let prevSlice = selector(store.getState());

    const handler = (_prev: S, next: S) => {
        const nextSlice = selector(next);
        if (equality(prevSlice, nextSlice)) return;
        const prev = prevSlice;
        prevSlice = nextSlice;
        listener(nextSlice, prev);
    };

    return options.phase === "effect" ? store.subscribeEffect(handler) : store.subscribeRender(handler);
}
