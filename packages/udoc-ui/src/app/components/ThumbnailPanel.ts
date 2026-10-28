import { subscribeSelector } from "../../framework/index.js";
import type { Store } from "../../framework/index.js";
import { allowsEdit } from "../../geometry.js";
import type { SelectMode } from "../../geometry.js";
import type { SelectionEdit } from "../../worker/protocol.js";
import { THUMBNAIL_DROPPED } from "../../worker/WorkerClient.js";
import type { WorkerClient } from "../../worker/WorkerClient.js";
import type { Action } from "../actions.js";
import { PAGE_MENU, SLIDE_MENU } from "../commands.js";
import type { MenuItem } from "../commands.js";
import { reorderTo } from "../page-order.js";
import { VIEW_MODE } from "../state.js";
import type { UIState } from "../state.js";
import { profileFor } from "../profiles.js";
import type { I18n } from "../i18n/index.js";
import { MAC } from "./controls.js";

/**
 * The left panel's Thumbnails tab: a scrollable strip of page (slide) previews
 * that navigates the document. The counterpart of the previous udoc-viewer's
 * read-only panel, but built for a document whose page list may **not** be
 * known up front — a flow document's page count grows as the engine composes —
 * and whose page sizes change under edits, so it can't pre-size one item per
 * page like the viewer.
 *
 * Instead it virtual-scrolls incrementally:
 *
 *  - The scroll extent is sized from the page count (`state.pageCount`): the
 *    document's total where the engine knows it up front (a PDF, a
 *    presentation), else the composed prefix, growing with it.
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
 *
 * Outside view mode, for a doc type whose pages are picked whole (a PDF's
 * pages, a deck's slides — the profile's `pageSelection`), the strip is also
 * where pages are selected and edited. A press selects the page, Ctrl/Cmd
 * toggles it, Shift selects the run from the last press; the engine holds the
 * selection, and its `pages` come back marked as the current page is. A
 * right-click opens the page menu on the selection, and a drag lifts the
 * selected pages out of the strip, stacked, to drop them in a gap.
 */

/** The edits the strip makes and the menu it opens, run by the shell. */
export interface ThumbnailPanelCallbacks {
    /** Commit a page edit on the selection — a drop's reorder. */
    onSelectionEdit: (edit: SelectionEdit) => Promise<void>;
    /** Open the context menu of `rows` at viewport `(x, y)`. */
    onContextMenu: (x: number, y: number, rows: readonly MenuItem<string>[]) => void;
}

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
/** How far (px) a press travels before it becomes a drag. */
const DRAG_THRESHOLD = 4;
/** The band (px) at the strip's top and bottom where a drag scrolls it. */
const AUTOSCROLL_EDGE = 32;
/** The fastest a drag scrolls the strip, in px per frame, at its very edge. */
const AUTOSCROLL_SPEED = 16;
/** The most cards a drag's lifted stack shows, however many pages it carries. */
const GHOST_CARDS = 3;
/** How far (px) down and right each card of the stack sits from the one above. */
const GHOST_STEP = 6;
/** How far (degrees) each card of the stack turns from the one above, fanning
 *  the pages out behind the top one. */
const GHOST_FAN = 4;

/** One mounted thumbnail's DOM + the render state that gates redundant work. */
interface ThumbItem {
    container: HTMLDivElement;
    canvas: HTMLCanvasElement;
    /** Cache key (`page:scale`) last drawn, so an unchanged re-show is a no-op. */
    drawnKey: string | null;
}

interface ThumbnailSlice {
    pageCount: number;
    /** The current page's index (`state.pageIndex`). */
    currentPage: number;
    /** Bumped on each new document open — forces a full rebuild. */
    generation: number;
    /** Whether a press picks pages — outside view mode, in a doc type whose
     *  pages are picked whole. */
    picking: boolean;
    /** The selected pages (`state.selectedPages`). */
    selectedPages: readonly number[];
}

function selectSlice(state: UIState): ThumbnailSlice {
    return {
        pageCount: state.pageCount,
        currentPage: state.pageIndex,
        generation: state.docGeneration,
        picking: state.mode !== VIEW_MODE && profileFor(state.docType).pageSelection,
        selectedPages: state.selectedPages,
    };
}

/** A press on a thumbnail, while it may still become a drag. */
interface Press {
    pointerId: number;
    page: number;
    startX: number;
    startY: number;
    /** No Shift or toggle key: only a plain press drags. */
    plain: boolean;
    /** A plain press on a page already selected: on release without a drag it
     *  narrows the selection to that page; a drag moves the whole selection. */
    narrowOnRelease: boolean;
    /** Past the threshold: moving the selected pages. */
    dragging: boolean;
    /** The index the first selected page would take, dropped where the line
     *  shows ({@link reorderTo}), or `null` where a drop moves nothing. */
    to: number | null;
    /** The pointer's last viewport point, for the stack to follow and the
     *  autoscroll's re-aim. */
    clientX: number;
    clientY: number;
    /** The stack of the selected pages a drag lifts out of the strip. */
    ghost: Ghost | null;
}

/** The selected pages lifted out of the strip by a drag: their stacked
 *  thumbnails, following the pointer over the whole shell. */
interface Ghost {
    el: HTMLElement;
    /** The shell root it is parented on and placed against. */
    root: HTMLElement;
    /** Where the pointer holds the top card, from its top-left corner (px). */
    grabX: number;
    grabY: number;
}

export function createThumbnailPanel(i18n: I18n, callbacks: ThumbnailPanelCallbacks) {
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

    // The line a drag shows in the gap the selection would drop into.
    const dropMarker = document.createElement("div");
    dropMarker.className = "udoc-thumbnail-drop";
    dropMarker.setAttribute("aria-hidden", "true");
    dropMarker.hidden = true;
    sizer.appendChild(dropMarker);

    let store: Store<UIState, Action> | null = null;
    let client: WorkerClient | null = null;
    let mounted = false;

    let slice: ThumbnailSlice = { pageCount: 0, currentPage: 0, generation: -1, picking: false, selectedPages: [] };
    /** The selected pages, as a set. */
    let selected: ReadonlySet<number> = new Set();
    /** Where a Shift press's run starts: the page last pressed or toggled. */
    let anchorPage: number | null = null;
    /** The press in progress, if any. */
    let press: Press | null = null;
    /** The drag's autoscroll frame, while one is scheduled. */
    let autoscrollRaf: number | null = null;
    /** Mounted items by 0-based page index. */
    const items = new Map<number, ThumbItem>();
    /** Page sizes (document points) by page index — drives aspect + scale. */
    const sizes = new Map<number, { w: number; h: number }>();
    /** The pages whose size in {@link sizes} has been read since the document
     *  last changed. An edit can resize a page (a rotate) or put another one at
     *  its index (a move, an insert), so each change re-reads them as they show. */
    const measured = new Set<number>();
    /** Bumped on each document change, so a size read sent before it is dropped. */
    let sizeGeneration = 0;
    /** In-flight `pageSize` size probes, so we don't fire duplicates. */
    const sizing = new Set<number>();
    /** Most recent measured aspect — the estimate for not-yet-measured pages. */
    let typicalAspect = DEFAULT_ASPECT;

    /** Prefix-sum of item slot heights: `offsets[i]` is the top of item `i`,
     *  `offsets[pageCount]` the total extent. Rebuilt when the geometry shifts. */
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
        offsets = new Array(slice.pageCount + 1);
        offsets[0] = TOP_PAD;
        for (let i = 0; i < slice.pageCount; i++) offsets[i + 1] = offsets[i]! + slotHeight(i);
        sizer.style.height = `${offsets[slice.pageCount]! + TOP_PAD}px`;
    }

    /** First page whose bottom is past `y` (binary search over `offsets`). */
    function pageAt(y: number): number {
        let lo = 0;
        let hi = slice.pageCount;
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
        const end = Math.min(slice.pageCount, pageAt(top + viewH) + 1 + OVERSCAN);

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
        client?.boostThumbnails(Math.min(center, Math.max(0, slice.pageCount - 1)));
    }

    function positionItem(item: ThumbItem, page: number): void {
        // The card fills its content box; the trailing GAP is left empty so the
        // fill/outline reads as a separated card, not a continuous column.
        item.container.style.top = `${offsets[page]!}px`;
        item.container.style.height = `${cardHeight(page)}px`;
        item.canvas.style.width = `${thumbWidth}px`;
        item.canvas.style.height = `${Math.round(thumbWidth / aspect(page))}px`;
        markItem(item, page);
    }

    /** Mark `item` selected — one look for the current page and, picking, each
     *  page the engine's selection holds. For assistive tech the two stay
     *  apart: `aria-current` names the current page, `aria-selected` the
     *  selection (the current page, when not picking). */
    function markItem(item: ThumbItem, page: number): void {
        const current = page === slice.currentPage;
        const isSelected = slice.picking ? selected.has(page) : current;
        item.container.classList.toggle("udoc-thumbnail-item--selected", current || isSelected);
        item.container.classList.toggle("udoc-dragging", isSelected && press?.dragging === true);
        item.container.setAttribute("aria-selected", String(isSelected));
        if (current) item.container.setAttribute("aria-current", "page");
        else item.container.removeAttribute("aria-current");
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

        // Picking, a press is the strip's own (see `onPointerDown`).
        container.addEventListener("click", () => {
            if (!slice.picking) navigateTo(page);
        });
        return { container, canvas, drawnKey: null };
    }

    // --- sizing + rendering ----------------------------------------------

    /** Probe one page's size (document points) so its aspect and render scale
     *  are exact; corrects the extent when it differs from the estimate. Uses
     *  the doc-type-agnostic `pageSize`, so slides size like PDF pages. */
    async function ensureSize(page: number): Promise<void> {
        if (measured.has(page) || sizing.has(page) || !client) return;
        sizing.add(page);
        const generation = sizeGeneration;
        let stale = false;
        try {
            const { width: w, height: h } = await client.pageSize(page);
            if (!mounted || w <= 0 || h <= 0) return;
            // Read before the document last changed: re-read it.
            if (generation !== sizeGeneration) {
                stale = true;
                return;
            }
            measured.add(page);
            const known = sizes.get(page);
            if (known && known.w === w && known.h === h) return;
            sizes.set(page, { w, h });
            typicalAspect = w / h;
            // The corrected height shifts every item below it; re-flow.
            rebuildOffsets();
            renderWindow();
        } finally {
            sizing.delete(page);
            if (stale && mounted) renderWindow();
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
        if (page < 0 || page >= slice.pageCount) return;
        const top = offsets[page]!;
        const bottom = offsets[page + 1]!;
        if (top < el.scrollTop) el.scrollTop = top - TOP_PAD;
        else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight;
    }

    function updateHighlight(): void {
        for (const [page, item] of items) markItem(item, page);
        el.setAttribute("aria-activedescendant", `udoc-thumb-${slice.currentPage}`);
    }

    function onKeyDown(e: KeyboardEvent): void {
        if (e.key === "Escape" && press) {
            // Cancel the drag — and keep the shell's Escape from closing the panel.
            e.preventDefault();
            e.stopPropagation();
            endPress();
            return;
        }
        const from = focusedPage;
        let handled = true;
        switch (e.key) {
            case "ArrowDown":
                focusedPage = Math.min(focusedPage + 1, slice.pageCount - 1);
                break;
            case "ArrowUp":
                focusedPage = Math.max(focusedPage - 1, 0);
                break;
            case "Home":
                focusedPage = 0;
                break;
            case "End":
                focusedPage = slice.pageCount - 1;
                break;
            case "Enter":
            case " ":
                if (slice.picking) pick(focusedPage, e);
                navigateTo(focusedPage);
                break;
            default:
                handled = false;
        }
        if (!handled) return;
        e.preventDefault();
        // Shift with a move runs the selection from its anchor to the page moved to.
        if (slice.picking && e.shiftKey && focusedPage !== from) pick(focusedPage, e);
        el.setAttribute("aria-activedescendant", `udoc-thumb-${focusedPage}`);
        scrollActiveIntoView(focusedPage);
    }

    // --- picking + editing -----------------------------------------------

    /** Whether `e` holds the key that toggles a page in or out — Cmd on a Mac,
     *  Ctrl elsewhere. */
    function toggles(e: { ctrlKey: boolean; metaKey: boolean }): boolean {
        return MAC ? e.metaKey : e.ctrlKey;
    }

    /** Pick `page` as a press with `e`'s keys does: Shift selects the run from
     *  the anchor, the toggle key adds or removes the page, a plain press
     *  selects it alone. The engine answers with the selection to tint. */
    function pick(page: number, e: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): void {
        if (e.shiftKey) {
            anchorPage ??= page;
            client?.selectPages(anchorPage, page, "replace");
            return;
        }
        const mode: SelectMode = toggles(e) ? "toggle" : "replace";
        client?.selectPages(page, page, mode);
        anchorPage = page;
    }

    /** The page of the thumbnail `e` happened on, or `null` off every one. */
    function pageOfEvent(e: Event): number | null {
        const item = e.target instanceof Element ? e.target.closest<HTMLElement>(".udoc-thumbnail-item") : null;
        return item && sizer.contains(item) ? Number(item.dataset.page) : null;
    }

    /** Whether the selection may be moved — the engine's gate, which a session
     *  not entitled to edit never has. */
    function reorderable(): boolean {
        const caps = store?.getState().selectionCaps;
        return caps !== undefined && allowsEdit(caps, slides() ? "reorderSlides" : "reorderPages");
    }

    function onPointerDown(e: PointerEvent): void {
        // A Mac's Ctrl+click is its right-click: the menu takes it.
        if (!slice.picking || press || e.button !== 0 || (MAC && e.ctrlKey)) return;
        const page = pageOfEvent(e);
        if (page === null) return;
        // The press is the strip's: no text selection or image drag of the
        // browser's, and the strip focused for its keys.
        e.preventDefault();
        el.focus({ preventScroll: true });
        focusedPage = page;
        el.setAttribute("aria-activedescendant", `udoc-thumb-${page}`);
        const plain = !e.shiftKey && !toggles(e);
        // A plain press on a selected page may start a drag of the whole
        // selection, so it narrows to the page only on release.
        const narrowOnRelease = plain && selected.has(page);
        if (narrowOnRelease) anchorPage = page;
        else pick(page, e);
        press = {
            pointerId: e.pointerId,
            page,
            startX: e.clientX,
            startY: e.clientY,
            plain,
            narrowOnRelease,
            dragging: false,
            to: null,
            clientX: e.clientX,
            clientY: e.clientY,
            ghost: null,
        };
        el.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e: PointerEvent): void {
        if (!press || e.pointerId !== press.pointerId) return;
        press.clientX = e.clientX;
        press.clientY = e.clientY;
        if (!press.dragging) {
            const moved = Math.hypot(e.clientX - press.startX, e.clientY - press.startY);
            if (!press.plain || moved < DRAG_THRESHOLD) return;
            // The press's own pick lands a round trip later: drag once it has.
            if (!selected.has(press.page) || !reorderable()) return;
            press.dragging = true;
            press.ghost = liftGhost(press);
            el.classList.add("udoc-thumbnail-panel--dragging");
            updateHighlight();
        }
        moveGhost(press);
        aimDrop();
        autoscroll();
    }

    /** Lift the selected pages out of the strip: a stack of their thumbnails —
     *  the pressed page on top, the selected pages nearest it behind, up to
     *  {@link GHOST_CARDS} in all, and how many there are when more than one —
     *  parented on the shell root, so it can follow the pointer anywhere over
     *  it. `null` when the pressed page's thumbnail isn't in the strip. */
    function liftGhost(p: Press): Ghost | null {
        const root = el.closest<HTMLElement>(".udoc-ui-root");
        const top = items.get(p.page)?.canvas;
        if (!root || !top) return null;
        const pages = [
            p.page,
            ...[...selected]
                .filter((page) => page !== p.page)
                .sort((a, b) => Math.abs(a - p.page) - Math.abs(b - p.page)),
        ];
        const { left, top: y, width, height } = top.getBoundingClientRect();

        const ghost = document.createElement("div");
        ghost.className = "udoc-thumbnail-ghost";
        ghost.setAttribute("aria-hidden", "true");
        const stack = document.createElement("div");
        stack.className = "udoc-thumbnail-ghost__stack";
        ghost.appendChild(stack);
        // Back to front, so the pressed page lands on top.
        for (let depth = Math.min(pages.length, GHOST_CARDS) - 1; depth >= 0; depth--) {
            stack.appendChild(ghostCard(pages[depth]!, depth, width, height));
        }
        if (pages.length > 1) {
            const count = document.createElement("span");
            count.className = "udoc-thumbnail-ghost__count";
            count.textContent = String(pages.length);
            stack.appendChild(count);
        }
        root.appendChild(ghost);
        // Held where the press caught the page, clamped onto the card.
        const grabX = Math.min(Math.max(p.startX - left, 0), width);
        const grabY = Math.min(Math.max(p.startY - y, 0), height);
        return { el: ghost, root, grabX, grabY };
    }

    /** One card of the lifted stack: `page`'s thumbnail as the strip drew it,
     *  or a blank sheet when it isn't in the strip, `depth` cards down. */
    function ghostCard(page: number, depth: number, width: number, height: number): HTMLCanvasElement {
        const card = document.createElement("canvas");
        card.className = "udoc-thumbnail-ghost__card";
        card.style.width = `${width}px`;
        card.style.height = `${height}px`;
        card.style.transform = `translate(${depth * GHOST_STEP}px, ${depth * GHOST_STEP}px) rotate(${depth * GHOST_FAN}deg)`;
        const source = items.get(page)?.canvas;
        if (source && source.width > 0 && source.height > 0) {
            card.width = source.width;
            card.height = source.height;
            card.getContext("2d")?.drawImage(source, 0, 0);
        }
        return card;
    }

    /** Keep the lifted stack under the pointer, held where it was caught. */
    function moveGhost(p: Press): void {
        const ghost = p.ghost;
        if (!ghost) return;
        const root = ghost.root.getBoundingClientRect();
        const x = p.clientX - root.left - ghost.grabX;
        const y = p.clientY - root.top - ghost.grabY;
        ghost.el.style.transform = `translate(${x}px, ${y}px)`;
    }

    function onPointerUp(e: PointerEvent): void {
        if (!press || e.pointerId !== press.pointerId) return;
        const { page, dragging, to, narrowOnRelease } = press;
        endPress();
        if (dragging) {
            if (to !== null) drop(to);
            return;
        }
        if (narrowOnRelease) client?.selectPages(page, page, "replace");
        navigateTo(page);
    }

    /** End the press, a drag with it: put the lifted stack and the drop line
     *  away, stop scrolling, and take the drag's look off the selected pages. */
    function endPress(): void {
        if (!press) return;
        if (el.hasPointerCapture(press.pointerId)) el.releasePointerCapture(press.pointerId);
        const dragging = press.dragging;
        press.ghost?.el.remove();
        press = null;
        el.classList.remove("udoc-thumbnail-panel--dragging");
        dropMarker.hidden = true;
        if (autoscrollRaf !== null) cancelAnimationFrame(autoscrollRaf);
        autoscrollRaf = null;
        if (dragging) updateHighlight();
    }

    /** Aim the drop at the gap nearest the pointer — the one above the page
     *  whose upper half it is over — and draw the line there, hidden where a
     *  drop would leave the pages where they are. */
    function aimDrop(): void {
        if (!press) return;
        const y = press.clientY - el.getBoundingClientRect().top + el.scrollTop;
        const page = pageAt(y);
        const gap =
            page >= slice.pageCount ? slice.pageCount : y < offsets[page]! + cardHeight(page) / 2 ? page : page + 1;
        press.to = reorderTo(slice.selectedPages, gap);
        dropMarker.hidden = press.to === null;
        // Midway down the gap above the page it lands before.
        if (press.to !== null) dropMarker.style.top = `${offsets[gap]! - GAP / 2}px`;
    }

    /** The px a drag scrolls the strip by this frame: towards the edge whose
     *  band the pointer is in, faster the nearer the edge; `0` outside both. */
    function autoscrollStep(clientY: number): number {
        const { top, bottom } = el.getBoundingClientRect();
        const depth = (into: number) => Math.ceil(AUTOSCROLL_SPEED * Math.min(1, into / AUTOSCROLL_EDGE));
        if (clientY < top + AUTOSCROLL_EDGE) return -depth(top + AUTOSCROLL_EDGE - clientY);
        if (clientY > bottom - AUTOSCROLL_EDGE) return depth(clientY - (bottom - AUTOSCROLL_EDGE));
        return 0;
    }

    /** Scroll the strip while a drag holds the pointer in an edge band, a
     *  frame at a time, re-aiming the drop as the pages pass under it. */
    function autoscroll(): void {
        if (autoscrollRaf !== null || !press?.dragging || autoscrollStep(press.clientY) === 0) return;
        autoscrollRaf = requestAnimationFrame(() => {
            autoscrollRaf = null;
            if (!press?.dragging) return;
            el.scrollTop += autoscrollStep(press.clientY);
            aimDrop();
            autoscroll();
        });
    }

    /** Move the selected pages, as one run in document order, the first of
     *  them to `to`. */
    function drop(to: number): void {
        const edit: SelectionEdit = slides()
            ? { kind: "reorderSlides", to }
            : { kind: "page", edit: { kind: "reorderPages", to } };
        void callbacks.onSelectionEdit(edit);
    }

    /** The page menu on the selection, with the view at the page it opened on.
     *  A right-click on a page outside the selection selects that page first;
     *  the menu key opens it at the focused page. */
    function onContextMenu(e: MouseEvent): void {
        if (!slice.picking) return;
        const target = pageOfEvent(e);
        // A mouse's right-click off every page leaves the browser its menu.
        if (target === null && e.button === 2) return;
        const page = target ?? focusedPage;
        if (page >= slice.pageCount) return;
        e.preventDefault();
        if (!selected.has(page)) pick(page, { ctrlKey: false, metaKey: false, shiftKey: false });
        let { clientX: x, clientY: y } = e;
        if (target === null) {
            scrollActiveIntoView(page);
            const rect = el.getBoundingClientRect();
            x = rect.left + rect.width / 2;
            y = rect.top + offsets[page]! - el.scrollTop + cardHeight(page) / 2;
        }
        navigateTo(page);
        callbacks.onContextMenu(x, y, slides() ? SLIDE_MENU : PAGE_MENU);
    }

    // --- state application -----------------------------------------------

    function applySlice(next: ThumbnailSlice): void {
        const docChanged = next.generation !== slice.generation;
        const grew = next.pageCount !== slice.pageCount;
        const pageMoved = next.currentPage !== slice.currentPage;
        const marksChanged = next.picking !== slice.picking || next.selectedPages !== slice.selectedPages;
        slice = next;
        selected = new Set(next.selectedPages);
        // A drag aims at the pages as they stood: one the strip changes under,
        // or that stops picking, is called off.
        if (docChanged || grew || !next.picking) endPress();
        el.setAttribute("aria-multiselectable", String(next.picking));

        if (docChanged) {
            el.setAttribute("aria-label", i18n.t(slides() ? "thumbnails.slides" : "thumbnails.pages"));
            // New document: drop everything and rebuild from a clean slate.
            for (const item of items.values()) item.container.remove();
            items.clear();
            sizes.clear();
            measured.clear();
            sizing.clear();
            typicalAspect = DEFAULT_ASPECT;
            focusedPage = next.currentPage;
            anchorPage = null;
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
            scrollActiveIntoView(next.currentPage);
        }
        if (pageMoved || marksChanged) updateHighlight();
    }

    // --- lifecycle -------------------------------------------------------

    const onScroll = (): void => renderWindow();
    let unsub: (() => void) | null = null;
    let unsubInvalidate: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let refreshRaf: number | null = null;

    /** The document changed and the bitmap cache was dropped: forget what each
     *  item drew (a stale `drawnKey` would suppress the redraw) and which page
     *  sizes are current, and re-request the visible window against the new
     *  pixels. Coalesced to the next frame —
     *  a burst of edits refreshes once, and a refresh raced by a `close` runs
     *  after the resulting `CLOSE_DOC` has cleared the strip (no render of a
     *  shut document). */
    function onInvalidated(): void {
        for (const item of items.values()) item.drawnKey = null;
        measured.clear();
        sizeGeneration++;
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
        el.addEventListener("pointerdown", onPointerDown);
        el.addEventListener("pointermove", onPointerMove);
        el.addEventListener("pointerup", onPointerUp);
        el.addEventListener("pointercancel", endPress);
        el.addEventListener("contextmenu", onContextMenu);
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
        slice = { pageCount: 0, currentPage: 0, generation: -1, picking: false, selectedPages: [] };
        applySlice(selectSlice(s.getState()));
        unsub = subscribeSelector(s, selectSlice, applySlice, {
            equality: (a, b) =>
                a.pageCount === b.pageCount &&
                a.currentPage === b.currentPage &&
                a.generation === b.generation &&
                a.picking === b.picking &&
                a.selectedPages === b.selectedPages,
        });
    }

    function destroy(): void {
        mounted = false;
        endPress();
        if (refreshRaf !== null) cancelAnimationFrame(refreshRaf);
        if (unsub) unsub();
        if (unsubInvalidate) unsubInvalidate();
        resizeObserver?.disconnect();
        el.removeEventListener("scroll", onScroll);
        el.removeEventListener("keydown", onKeyDown);
        el.removeEventListener("pointerdown", onPointerDown);
        el.removeEventListener("pointermove", onPointerMove);
        el.removeEventListener("pointerup", onPointerUp);
        el.removeEventListener("pointercancel", endPress);
        el.removeEventListener("contextmenu", onContextMenu);
        for (const page of items.keys()) client?.cancelThumbnail(page);
        items.clear();
        store = null;
        client = null;
        el.remove();
    }

    return { el, mount, destroy };
}

export type ThumbnailPanelComponent = ReturnType<typeof createThumbnailPanel>;
