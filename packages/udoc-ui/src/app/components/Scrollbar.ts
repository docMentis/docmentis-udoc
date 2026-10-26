import { cssPxPerPt } from "../../geometry.js";
import { subscribeSelector } from "../../framework/index.js";
import type { Store } from "../../framework/index.js";
import type { Action } from "../actions.js";
import { profileFor } from "../profiles.js";
import type { UIState } from "../state.js";
import { renderZoom, viewDpi } from "../state.js";

type Axis = "y" | "x";

/** Track thickness in CSS px — must match `--udoc-scrollbar-size` in styles.ts.
 *  Also the scrollbar size the engine keeps a strip clear for, where it keeps
 *  one (the profile's `scrollbarGutters`). */
export const SCROLLBAR_THICKNESS_PX = 12;

/** Gap the thumb keeps from each end of its track, in CSS px — as wide as its
 *  gap from the track's sides (its margin in styles.ts). */
const THUMB_INSET_PX = 2;

/**
 * A virtual scrollbar for one axis. Because the canvas is pinned to the
 * viewport (synthetic scroll), the browser shows no native scrollbar — this bar
 * reflects the document-space scroll position and lets the user drag, page, or
 * click to scroll. Dispatches `SCROLL_TO`/`SCROLL_BY`; the engine repaints the
 * dirty band as usual.
 *
 * It lies along the content pane's right or bottom edge either way. Where the
 * engine keeps a strip clear for it (the profile's `scrollbarGutters`) it sits
 * in that strip and shows when the engine's frame says so (see
 * {@link scrollbarShown}); elsewhere it floats over the content wherever the
 * document scrolls along its axis. When both show, each stops short of the
 * corner the other would cross.
 *
 * One factory per axis; both share the geometry math via the `Axis` switch.
 */
export function createScrollbar(axis: Axis) {
    const track = document.createElement("div");
    track.className = `udoc-ui__scrollbar udoc-ui__scrollbar--${axis}`;
    const thumb = document.createElement("div");
    thumb.className = "udoc-ui__scrollbar-thumb";
    track.appendChild(thumb);

    const cleanups: Array<() => void> = [];
    let dragPointer: number | null = null;

    function mount(host: HTMLElement, store: Store<UIState, Action>): void {
        host.appendChild(track);

        const apply = () => layout(store.getState());
        cleanups.push(subscribeSelector(store, (s) => geom(s, axis), apply, { equality: shallowGeomEqual }));
        // Initial paint (subscribeSelector only fires on change).
        apply();

        const onThumbDown = (ev: PointerEvent) => {
            ev.preventDefault();
            ev.stopPropagation();
            dragPointer = ev.pointerId;
            thumb.setPointerCapture(ev.pointerId);
            const start = axis === "y" ? ev.clientY : ev.clientX;
            const startScroll = axis === "y" ? store.getState().scrollY : store.getState().scrollX;
            // Freeze the thumb→scroll mapping at grab time. The scroll-area basis
            // grows as you drag toward empty grid, so recomputing it mid-drag
            // would accelerate under the finger; the frozen travel/range keep the
            // drag linear and hold it within the data (to reach empty grid, wheel).
            const startG = geom(store.getState(), axis);
            const startTravel = startG.travelPx;

            const onMove = (e: PointerEvent) => {
                if (dragPointer !== e.pointerId) return;
                if (startTravel <= 0) return;
                const deltaPx = (axis === "y" ? e.clientY : e.clientX) - start;
                const scroll = startScroll + (deltaPx / startTravel) * startG.maxScroll;
                store.dispatch(scrollTo(store.getState(), axis, scroll));
            };
            const onUp = (e: PointerEvent) => {
                if (dragPointer !== e.pointerId) return;
                dragPointer = null;
                thumb.releasePointerCapture(e.pointerId);
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
        };
        thumb.addEventListener("pointerdown", onThumbDown);
        cleanups.push(() => thumb.removeEventListener("pointerdown", onThumbDown));

        // Click on the track (not the thumb) pages toward the click.
        const onTrackDown = (ev: PointerEvent) => {
            if (ev.target === thumb) return;
            const rect = track.getBoundingClientRect();
            const pos = axis === "y" ? ev.clientY - rect.top : ev.clientX - rect.left;
            const g = geom(store.getState(), axis);
            const page = g.visibleDoc * 0.9 * (pos > g.thumbStartPx + g.thumbPx / 2 ? 1 : -1);
            store.dispatch(
                axis === "y" ? { type: "SCROLL_BY", dx: 0, dy: page } : { type: "SCROLL_BY", dx: page, dy: 0 },
            );
        };
        track.addEventListener("pointerdown", onTrackDown);
        cleanups.push(() => track.removeEventListener("pointerdown", onTrackDown));
    }

    function layout(s: UIState): void {
        const g = geom(s, axis);
        const visible = g.shown && g.trackPx > 0;
        track.style.display = visible ? "" : "none";
        if (!visible) return;
        if (axis === "y") {
            // The track spans the viewport height — shortened (not 100%) when the
            // other bar is present, so the two tracks meet at a clear corner
            // instead of overlapping there. Its top is pinned to the edge by CSS.
            track.style.height = `${g.trackPx}px`;
            thumb.style.height = `${g.thumbPx}px`;
            thumb.style.transform = `translateY(${g.thumbStartPx}px)`;
        } else {
            // The track spans the viewport width; its left is pinned by CSS.
            track.style.width = `${g.trackPx}px`;
            thumb.style.width = `${g.thumbPx}px`;
            thumb.style.transform = `translateX(${g.thumbStartPx}px)`;
        }
    }

    function destroy(): void {
        for (const off of cleanups) off();
        cleanups.length = 0;
        track.remove();
    }

    return { el: track, mount, destroy };
}

interface Geom {
    shown: boolean;
    trackPx: number;
    thumbPx: number;
    thumbStartPx: number;
    travelPx: number;
    visibleDoc: number;
    maxScroll: number;
}

function geom(s: UIState, axis: Axis): Geom {
    const viewportPx = axis === "y" ? s.viewportHeight : s.viewportWidth;
    const scroll = axis === "y" ? s.scrollY : s.scrollX;
    // Visible extent in document space: the span the document shows through
    // (the viewport less any strip kept for the other bar), divided by
    // (zoom × 96/72), against the zoom actually rendered (the fit's derived zoom
    // while fitting, not the stale explicit `zoom`).
    const z = renderZoom(s);
    const visibleDoc = z > 0 ? visibleSpan(s, axis) / (z * cssPxPerPt(viewDpi(s))) : 0;
    const content = scrollArea(s, axis, visibleDoc);
    // Before the first fitted frame after open, `content` is the full document
    // extent but `z` is the open default (the fit's zoom isn't known yet), so
    // their ratio is meaningless — no scroll range until the first SYNC_VIEW.
    const maxScroll = s.viewSettled ? Math.max(0, content - visibleDoc) : 0;
    // The track spans the viewport, stopping short of the corner when the other
    // bar shows too, so the two butt against a clear corner instead of crossing.
    const other: Axis = axis === "y" ? "x" : "y";
    const trackPx = viewportPx - (scrollbarShown(s, other) ? SCROLLBAR_THICKNESS_PX : 0);
    const fraction = content > 0 ? Math.min(1, visibleDoc / content) : 1;
    // The thumb runs between the insets at the track's two ends.
    const spanPx = trackPx - 2 * THUMB_INSET_PX;
    const thumbPx = Math.max(24, spanPx * fraction);
    const travelPx = spanPx - thumbPx;
    const thumbStartPx = THUMB_INSET_PX + (maxScroll > 0 ? travelPx * (scroll / maxScroll) : 0);
    return { shown: scrollbarShown(s, axis), trackPx, thumbPx, thumbStartPx, travelPx, visibleDoc, maxScroll };
}

/**
 * Whether the bar along `axis` shows. Where the engine keeps a strip clear for
 * the bars (the profile's `scrollbarGutters`) it decides, with the frame it
 * paints, and the bar follows its report; a floating bar shows wherever the
 * document scrolls along its axis.
 */
export function scrollbarShown(s: UIState, axis: Axis): boolean {
    return profileFor(s.docType).scrollbarGutters ? s.scrollbars[axis] : scrollsAlong(s, axis);
}

/**
 * The CSS px of the viewport the document shows through along `axis`: less the
 * strip the engine keeps clear for the other axis's bar while that one shows,
 * where it keeps one. A floating bar lies over the document and takes nothing.
 */
export function visibleSpan(s: UIState, axis: Axis): number {
    const viewportPx = axis === "y" ? s.viewportHeight : s.viewportWidth;
    const strip = profileFor(s.docType).scrollbarGutters && s.scrollbars[axis === "y" ? "x" : "y"];
    return viewportPx - (strip ? SCROLLBAR_THICKNESS_PX : 0);
}

/**
 * The scrollbar's basis for `axis` (document points).
 *
 * Only a spreadsheet's grid scrolls far past its data, so the grow-into-empty
 * behavior is spreadsheet-only: the thumb reflects the used data extent and
 * slides to the far edge (`scroll + visibleDoc`) as the reader scrolls past it
 * into empty grid — sliding to the bottom and shrinking rather than jumping to a
 * whole-grid scale.
 *
 * Every other doc type fills its scrollable extent (the scroll clamps to it),
 * so its basis is simply `scrollSize`. Using it directly — not
 * `scrollUsedSize`, which a `DOC_RELAYOUT` grows without refreshing (compose-ahead
 * carries no `scrollUsedSize`) — keeps the basis monotonic across the frame so the
 * thumb can't shrink while scrolling up through a not-yet-re-synced extent.
 */
function scrollArea(s: UIState, axis: Axis, visibleDoc: number): number {
    const content = axis === "y" ? s.scrollSize.height : s.scrollSize.width;
    if (s.docType !== "spreadsheet") return content;
    const used = axis === "y" ? s.scrollUsedSize.height : s.scrollUsedSize.width;
    const scroll = axis === "y" ? s.scrollY : s.scrollX;
    return Math.max(used, scroll + visibleDoc);
}

/**
 * Whether the document scrolls along `axis` under a floating bar — more than
 * half a CSS pixel of on-screen scrollable distance over the whole viewport.
 * The engine fits against its device-px viewport (round(css × dpr)) while the
 * visible extent here divides the fractional CSS size, so the two can disagree
 * by up to half a device pixel; in document points that grows as 1/zoom and
 * overflows any fixed point threshold at small fitted zooms, showing a phantom
 * scrollbar — so the test is in screen px. Half a CSS pixel of scrollability is
 * never worth a scrollbar.
 */
function scrollsAlong(s: UIState, axis: Axis): boolean {
    const viewportPx = axis === "y" ? s.viewportHeight : s.viewportWidth;
    const z = renderZoom(s);
    const visibleDoc = z > 0 ? viewportPx / (z * cssPxPerPt(viewDpi(s))) : 0;
    const content = scrollArea(s, axis, visibleDoc);
    const maxScroll = s.viewSettled ? Math.max(0, content - visibleDoc) : 0;
    return maxScroll * z * cssPxPerPt(viewDpi(s)) > 0.5;
}

function shallowGeomEqual(a: Geom, b: Geom): boolean {
    return (
        a.shown === b.shown && a.trackPx === b.trackPx && a.thumbPx === b.thumbPx && a.thumbStartPx === b.thumbStartPx
    );
}

function scrollTo(s: UIState, axis: Axis, value: number): Action {
    return axis === "y" ? { type: "SCROLL_TO", x: s.scrollX, y: value } : { type: "SCROLL_TO", x: value, y: s.scrollY };
}
