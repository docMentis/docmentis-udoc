import { subscribeSelector } from "../../framework/index.js";
import type { Store } from "../../framework/index.js";
import { THUMBNAIL_DROPPED } from "../../worker/WorkerClient.js";
import type { WorkerClient } from "../../worker/WorkerClient.js";
import type { Action } from "../actions.js";
import type { UIState } from "../state.js";
import { profileFor } from "../profiles.js";
import type { I18n } from "../i18n/index.js";

/**
 * The left panel's Thumbnails tab: a scrollable strip of page (slide) previews
 * that navigates the document. The counterpart of the previous udoc-viewer's
 * read-only panel, but built for a document whose page list is **not** known up
 * front — page count grows as the engine composes and page sizes change under
 * edits — so it can't pre-size one item per page like the viewer.
 *
 * Instead it virtual-scrolls incrementally:
 *
 *  - The scroll extent is sized from the composed prefix (`state.composedPageCount`) and
 *    grows with it; there is no final page count to allocate against.
 *  - Each item's height starts from a typical-aspect estimate and is corrected
 *    once its real page size arrives (lazily, from `pageSize`), so a
 *    uniform-size document settles to an exact extent after the first measure.
 *  - Only the items in (or near) the viewport are in the DOM and only those
 *    request renders; the rest are spacer-backed offsets. Off-window items
 *    recycle; their bitmaps stay in the {@link WorkerClient} LRU cache.
 *
 * Bidirectional current-page sync rides on existing seams: the worker streams
 * the current page into `state.pageIndex` (so the strip never re-derives it), and a
 * click/keyboard dispatches `NAVIGATE_TO_PAGE`, which the shell already
 * forwards to the engine.
 */

/** Items above/below the viewport kept mounted, so a small scroll reveals a
 *  pre-rendered thumbnail instead of a blank one. */
const OVERSCAN = 3;
/** Constant inset from each strip edge to the card (matches `left`/`right` in
 *  styles.ts), so the edge gap never changes with panel width. */
const SIDE_PAD = 12;
/** Top padding above the first item. */
const TOP_PAD = 12;
/** Label area under each thumbnail (the page-number text plus its top gap). */
const LABEL_H = 18;
/** Padding inside the card, around the page and below the label — the gap
 *  between the card edge and the page (matches the `padding` in styles.ts). */
const CARD_PAD = 12;
/** Gap between cards: part of the slot height, but outside the card box so the
 *  hover/active fill never touches the neighbouring card. */
const GAP = 12;
/** Fallback aspect (width / height) before any page is measured — US Letter
 *  portrait, a reasonable guess that self-corrects on the first real measure. */
const DEFAULT_ASPECT = 612 / 792;

/** One mounted thumbnail's DOM + the render state that gates redundant work. */
interface ThumbItem {
    container: HTMLDivElement;
    canvas: HTMLCanvasElement;
    /** Cache key (`page:scale`) last drawn, so an unchanged re-show is a no-op. */
    drawnKey: string | null;
}

interface ThumbnailSlice {
    composedPageCount: number;
    /** The current page's index (`state.pageIndex`). */
    currentPage: number;
    /** Bumped on each new document open — forces a full rebuild. */
    generation: number;
}

function selectSlice(state: UIState): ThumbnailSlice {
    return {
        composedPageCount: state.composedPageCount,
        currentPage: state.pageIndex,
        generation: state.docGeneration,
    };
}

export function createThumbnailPanel(i18n: I18n) {
    const el = document.createElement("div");
    el.className = "udoc-thumbnail-panel";
    el.setAttribute("role", "listbox");
    el.setAttribute("aria-label", i18n.t("thumbnails.pages"));
    el.tabIndex = 0;

    // A full-extent spacer the absolutely-positioned items float over, so the
    // scrollbar reflects the whole composed strip while only the window is in
    // the DOM.
    const sizer = document.createElement("div");
    sizer.className = "udoc-thumbnail-sizer";
    el.appendChild(sizer);

    let store: Store<UIState, Action> | null = null;
    let client: WorkerClient | null = null;
    let mounted = false;

    let slice: ThumbnailSlice = { composedPageCount: 0, currentPage: 0, generation: -1 };
    /** Mounted items by 0-based page index. */
    const items = new Map<number, ThumbItem>();
    /** Measured page sizes (document points) by page index — drives aspect + scale. */
    const sizes = new Map<number, { w: number; h: number }>();
    /** In-flight `pageSize` size probes, so we don't fire duplicates. */
    const sizing = new Set<number>();
    /** Most recent measured aspect — the estimate for not-yet-measured pages. */
    let typicalAspect = DEFAULT_ASPECT;

    /** Prefix-sum of item slot heights: `offsets[i]` is the top of item `i`,
     *  `offsets[composedPageCount]` the total extent. Rebuilt when the geometry shifts. */
    let offsets: number[] = [TOP_PAD];
    /** Thumbnail width in CSS px (panel inner width); tracks panel resize. */
    let thumbWidth = 0;
    /** Keyboard cursor (a page index), distinct from the viewport's current page. */
    let focusedPage = 0;

    /** Whether one page is called a slide in the open document — in a deck. */
    const slides = (): boolean => profileFor(store?.getState().docType ?? null).pageNoun === "Slide";

    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));

    // --- geometry --------------------------------------------------------

    function aspect(page: number): number {
        const s = sizes.get(page);
        return s ? s.w / s.h : typicalAspect;
    }

    /** Card height of one item: the padded box the tint/outline hugs — the
     *  scaled thumbnail plus its vertical padding and label, but *not* the
     *  inter-card gap. */
    function cardHeight(page: number): number {
        const inner = LABEL_H + 2 * CARD_PAD;
        if (thumbWidth <= 0) return inner;
        return Math.round(thumbWidth / aspect(page)) + inner;
    }

    /** Slot height of one item: the card plus the gap below it. */
    function slotHeight(page: number): number {
        return cardHeight(page) + GAP;
    }

    /** Rebuild the offset prefix-sums from the current sizes and page count. */
    function rebuildOffsets(): void {
        offsets = new Array(slice.composedPageCount + 1);
        offsets[0] = TOP_PAD;
        for (let i = 0; i < slice.composedPageCount; i++) offsets[i + 1] = offsets[i]! + slotHeight(i);
        sizer.style.height = `${offsets[slice.composedPageCount]! + TOP_PAD}px`;
    }

    /** First page whose bottom is past `y` (binary search over `offsets`). */
    function pageAt(y: number): number {
        let lo = 0;
        let hi = slice.composedPageCount;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (offsets[mid + 1]! <= y) lo = mid + 1;
            else hi = mid;
        }
        return lo;
    }

    // --- windowing -------------------------------------------------------

    /** Mount/position the items in the viewport (+ overscan), recycle the rest,
     *  and bias the render queue toward the page at the strip's centre. */
    function renderWindow(): void {
        if (!mounted || thumbWidth <= 0) return;
        const top = el.scrollTop;
        const viewH = el.clientHeight || 1;
        const start = Math.max(0, pageAt(top) - OVERSCAN);
        const end = Math.min(slice.composedPageCount, pageAt(top + viewH) + 1 + OVERSCAN);

        // Recycle items that scrolled out of the window.
        for (const [page, item] of items) {
            if (page < start || page >= end) {
                client?.cancelThumbnail(page);
                item.container.remove();
                items.delete(page);
            }
        }
        // Mount/position the items now in the window.
        for (let page = start; page < end; page++) {
            let item = items.get(page);
            if (!item) {
                item = createItem(page);
                items.set(page, item);
                sizer.appendChild(item.container);
            }
            positionItem(item, page);
            void renderItem(page, item);
        }

        // The render queue fills nearest the strip's centre first.
        const center = pageAt(top + viewH / 2);
        client?.boostThumbnails(Math.min(center, Math.max(0, slice.composedPageCount - 1)));
    }

    function positionItem(item: ThumbItem, page: number): void {
        // The card fills its content box; the trailing GAP is left empty so the
        // fill/outline reads as a separated card, not a continuous column.
        item.container.style.top = `${offsets[page]!}px`;
        item.container.style.height = `${cardHeight(page)}px`;
        item.canvas.style.width = `${thumbWidth}px`;
        item.canvas.style.height = `${Math.round(thumbWidth / aspect(page))}px`;
        item.container.classList.toggle("udoc-thumbnail-item--selected", page === slice.currentPage);
        item.container.setAttribute("aria-selected", String(page === slice.currentPage));
    }

    function createItem(page: number): ThumbItem {
        const container = document.createElement("div");
        container.className = "udoc-thumbnail-item";
        container.id = `udoc-thumb-${page}`;
        container.setAttribute("role", "option");
        container.setAttribute(
            "aria-label",
            i18n.t(slides() ? "thumbnails.slide" : "thumbnails.page", { page: page + 1 }),
        );
        container.dataset.page = String(page);

        const canvas = document.createElement("canvas");
        canvas.className = "udoc-thumbnail-item__canvas";
        canvas.setAttribute("aria-hidden", "true");
        container.appendChild(canvas);

        const label = document.createElement("div");
        label.className = "udoc-thumbnail-item__label";
        label.textContent = String(page + 1);
        container.appendChild(label);

        container.addEventListener("click", () => navigateTo(page));
        return { container, canvas, drawnKey: null };
    }

    // --- sizing + rendering ----------------------------------------------

    /** Probe one page's size (document points) so its aspect and render scale
     *  are exact; corrects the extent when it differs from the estimate. Uses
     *  the doc-type-agnostic `pageSize`, so slides size like PDF pages. */
    async function ensureSize(page: number): Promise<void> {
        if (sizes.has(page) || sizing.has(page) || !client) return;
        sizing.add(page);
        try {
            const { width: w, height: h } = await client.pageSize(page);
            if (!mounted || w <= 0 || h <= 0) return;
            sizes.set(page, { w, h });
            typicalAspect = w / h;
            // The corrected height shifts every item below it; re-flow.
            rebuildOffsets();
            renderWindow();
        } finally {
            sizing.delete(page);
        }
    }

    /** Render (or redraw from cache) one item's bitmap at the current scale. */
    async function renderItem(page: number, item: ThumbItem): Promise<void> {
        // Skip when no document is open (e.g. a cache-invalidation refresh that
        // raced a close): the worker would reject a render with no session.
        if (!client || store?.getState().status !== "ready") return;
        await ensureSize(page);
        const size = sizes.get(page);
        if (!size || !mounted || !items.has(page)) return;

        const scale = (thumbWidth * dpr) / size.w;
        const key = `${page}:${scale.toFixed(3)}`;
        if (item.drawnKey === key) return;

        try {
            const bitmap = await client.requestThumbnail(page, scale);
            // The item may have recycled or rescaled while awaiting.
            if (!mounted || items.get(page) !== item) return;
            const canvas = item.canvas;
            if (canvas.width !== bitmap.width) canvas.width = bitmap.width;
            if (canvas.height !== bitmap.height) canvas.height = bitmap.height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                // Clear first: when the size is unchanged the canvas keeps its
                // last render, so a (possibly transparent) bitmap would composite
                // on top of the stale pixels instead of replacing them.
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(bitmap, 0, 0);
            }
            item.drawnKey = key;
        } catch (err) {
            // A superseded / cancelled / invalidated render is expected churn.
            if (!(err instanceof Error && err.message === THUMBNAIL_DROPPED)) {
                console.error(`thumbnail render failed for page ${page + 1}:`, err);
            }
        }
    }

    // --- navigation + current-page sync ----------------------------------

    function navigateTo(page: number): void {
        focusedPage = page;
        store?.dispatch({ type: "NAVIGATE_TO_PAGE", pageIndex: page });
    }

    /** Scroll the active page's slot into view (called when the viewport's
     *  current page changes). Cheap when it's already visible. */
    function scrollActiveIntoView(page: number): void {
        if (page < 0 || page >= slice.composedPageCount) return;
        const top = offsets[page]!;
        const bottom = offsets[page + 1]!;
        if (top < el.scrollTop) el.scrollTop = top - TOP_PAD;
        else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight;
    }

    function updateHighlight(): void {
        for (const [page, item] of items) {
            const active = page === slice.currentPage;
            item.container.classList.toggle("udoc-thumbnail-item--selected", active);
            item.container.setAttribute("aria-selected", String(active));
        }
        el.setAttribute("aria-activedescendant", `udoc-thumb-${slice.currentPage}`);
    }

    function onKeyDown(e: KeyboardEvent): void {
        let handled = true;
        switch (e.key) {
            case "ArrowDown":
                focusedPage = Math.min(focusedPage + 1, slice.composedPageCount - 1);
                break;
            case "ArrowUp":
                focusedPage = Math.max(focusedPage - 1, 0);
                break;
            case "Home":
                focusedPage = 0;
                break;
            case "End":
                focusedPage = slice.composedPageCount - 1;
                break;
            case "Enter":
            case " ":
                navigateTo(focusedPage);
                break;
            default:
                handled = false;
        }
        if (!handled) return;
        e.preventDefault();
        el.setAttribute("aria-activedescendant", `udoc-thumb-${focusedPage}`);
        scrollActiveIntoView(focusedPage);
    }

    // --- state application -----------------------------------------------

    function applySlice(next: ThumbnailSlice): void {
        const docChanged = next.generation !== slice.generation;
        const grew = next.composedPageCount !== slice.composedPageCount;
        const pageMoved = next.currentPage !== slice.currentPage;
        slice = next;

        if (docChanged) {
            el.setAttribute("aria-label", i18n.t(slides() ? "thumbnails.slides" : "thumbnails.pages"));
            // New document: drop everything and rebuild from a clean slate.
            for (const item of items.values()) item.container.remove();
            items.clear();
            sizes.clear();
            sizing.clear();
            typicalAspect = DEFAULT_ASPECT;
            focusedPage = next.currentPage;
            rebuildOffsets();
            renderWindow();
            return;
        }
        if (grew) {
            rebuildOffsets();
            renderWindow();
        }
        if (pageMoved) {
            focusedPage = next.currentPage;
            updateHighlight();
            scrollActiveIntoView(next.currentPage);
        }
    }

    // --- lifecycle -------------------------------------------------------

    const onScroll = (): void => renderWindow();
    let unsub: (() => void) | null = null;
    let unsubInvalidate: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let refreshRaf: number | null = null;

    /** The document changed and the bitmap cache was dropped: forget what each
     *  item drew (a stale `drawnKey` would suppress the redraw) and re-request
     *  the visible window against the new pixels. Coalesced to the next frame —
     *  a burst of edits refreshes once, and a refresh raced by a `close` runs
     *  after the resulting `CLOSE_DOC` has cleared the strip (no render of a
     *  shut document). */
    function onInvalidated(): void {
        for (const item of items.values()) item.drawnKey = null;
        if (refreshRaf !== null) return;
        refreshRaf = requestAnimationFrame(() => {
            refreshRaf = null;
            renderWindow();
        });
    }

    function measureWidth(): void {
        // The page fills the card: panel width minus the card's side inset
        // (SIDE_PAD) and its own horizontal padding (CARD_PAD), so it grows with
        // the panel while both gaps stay constant.
        const w = Math.max(0, el.clientWidth - 2 * SIDE_PAD - 2 * CARD_PAD);
        if (w === thumbWidth) return;

        // A width change rescales every item's height (the page fills the width),
        // so the same scrollTop would point at different content and the strip
        // would drift up/down as the panel resizes. Anchor to the page at the top
        // of the viewport — capture its fractional scroll offset before the
        // reflow, then restore it after — so that page stays put.
        const top = el.scrollTop;
        const anchor = pageAt(top);
        const beforeSlot = slotHeight(anchor);
        const frac = beforeSlot > 0 ? (top - offsets[anchor]!) / beforeSlot : 0;

        thumbWidth = w;
        rebuildOffsets();
        el.scrollTop = offsets[anchor]! + frac * slotHeight(anchor);
        renderWindow();
    }

    function mount(container: HTMLElement, s: Store<UIState, Action>, c: WorkerClient): void {
        container.appendChild(el);
        mounted = true;
        store = s;
        client = c;

        el.addEventListener("scroll", onScroll, { passive: true });
        el.addEventListener("keydown", onKeyDown);
        unsubInvalidate = c.onThumbnailsInvalidated(onInvalidated);
        // A width change re-flows item sizes; a height change (panel revealed /
        // window resized) widens the visible window. `measureWidth` covers the
        // former (and re-renders); the explicit `renderWindow` covers the latter.
        resizeObserver = new ResizeObserver(() => {
            measureWidth();
            renderWindow();
        });
        resizeObserver.observe(el);

        measureWidth();
        slice = { composedPageCount: 0, currentPage: 0, generation: -1 };
        applySlice(selectSlice(s.getState()));
        unsub = subscribeSelector(s, selectSlice, applySlice, {
            equality: (a, b) =>
                a.composedPageCount === b.composedPageCount &&
                a.currentPage === b.currentPage &&
                a.generation === b.generation,
        });
    }

    function destroy(): void {
        mounted = false;
        if (refreshRaf !== null) cancelAnimationFrame(refreshRaf);
        if (unsub) unsub();
        if (unsubInvalidate) unsubInvalidate();
        resizeObserver?.disconnect();
        el.removeEventListener("scroll", onScroll);
        el.removeEventListener("keydown", onKeyDown);
        for (const page of items.keys()) client?.cancelThumbnail(page);
        items.clear();
        store = null;
        client = null;
        el.remove();
    }

    return { el, mount, destroy };
}

export type ThumbnailPanelComponent = ReturnType<typeof createThumbnailPanel>;
