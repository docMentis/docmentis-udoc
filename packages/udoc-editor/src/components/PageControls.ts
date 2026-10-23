// The editor's built-in page-management overlays: a per-page control pill and
// an insert-between-pages affordance. Both are plain {@link OverlaySource}s
// registered through the public overlay registry (under `udoc:page-actions` /
// `udoc:page-insert`), so a host can remove or replace either like any overlay
// of its own.
//
// Geometry contract:
//
// - The control rail is **constant-size screen chrome** that sits just
//   *beside* a page's right edge, top-aligned with the page — so the shell
//   pairs it with screen-fixed (px) content padding, which holds its on-screen
//   width at every zoom. It is a vertical column of actions — move up / move
//   down / rotate / more / delete — and "more" opens the shared page-settings
//   modal dialog (size + rotation) for the page.
// - Insert lives *between* pages, in the inter-page gap. The gap is page-fixed
//   (document points), so its on-screen size tracks the zoom; the strip is
//   sized from the gap in points × the frame's scale, so it fills the gap at
//   every zoom by construction. Hovering it reveals a divider with a centered
//   "+" button. Inserting in the gap above page N is "before N" and "after
//   N−1" at once, so there is no before/after question to ask.

import { ICON_CHEVRON_DOWN, ICON_CHEVRON_UP, ICON_DELETE, ICON_MORE } from "@docmentis/udoc-ui/internal";
import { ICON_PAGE_ADD, ICON_ROTATE_RIGHT } from "../icons.js";
import type { OverlayItem, OverlaySource } from "@docmentis/udoc-ui";
import { createI18n } from "../i18n/index.js";
import type { I18n } from "../i18n/index.js";

/**
 * A page's current size and orientation, as the "more" button hands it to the
 * settings dialog. `width`/`height` are the page's media-box size in document
 * points (rotation-independent — the intrinsic page rectangle); `rotation` is
 * the display rotation in quarter turns clockwise (0–3).
 */
export interface PageSizeInfo {
    width: number;
    height: number;
    rotation: number;
}

/** Gap between the rail's left edge and its page's right edge, CSS px. */
const PILL_OFFSET = 7;

/** Hide the per-page chrome (control rail *and* insert affordance) when the
 *  page is shorter than this on screen — a control rail taller than its page
 *  reads as attached to nothing, and a lone insert by a too-small page is just
 *  as adrift. */
const MIN_PAGE_HEIGHT = 130;

/** Minimum hover/tap width of an insert strip, CSS px. */
const MIN_INSERT_WIDTH = 48;

/** The page-structure verbs the per-page pill dispatches. */
export interface PageActionsCallbacks {
    /** The language the controls' names are in. Default English. */
    i18n?: I18n;
    /** Total page count — bounds move-down and gates delete. */
    composedPageCount: () => number;
    /**
     * The page the pointer is currently over (null when none) — the rail is
     * hidden until its page is hovered, so only that page's controls show.
     */
    hoveredPage: () => number | null;
    onMoveUp: (index: number) => void;
    onMoveDown: (index: number) => void;
    /** Rotate the page one quarter turn — clockwise, or counter-clockwise
     *  when `clockwise` is false. */
    onRotate: (index: number, clockwise: boolean) => void;
    onDelete: (index: number) => void;
    /** Open the page-settings dialog for `index`, seeded with its current
     *  size + rotation — the "more" button's action. */
    onOpenSettings: (index: number, size: PageSizeInfo) => void;
}

function button(className: string, icon: string): HTMLButtonElement {
    const el = document.createElement("button");
    el.type = "button";
    el.className = className;
    el.innerHTML = icon;
    return el;
}

/**
 * The latest media-box size + rotation of each pill's page, refreshed every
 * frame in `update` and read by the "more" click handler (set once in `create`)
 * — the click fires the page-settings dialog with the page's current size.
 * Keyed by the pooled pill element so it survives across frames.
 */
const pillSize = new WeakMap<HTMLElement, PageSizeInfo>();

/**
 * The per-page control rail (`udoc:page-actions`): a vertical column — move
 * up, move down, rotate, more, delete — beside each visible page's right
 * edge, top-aligned with the page. "More" opens the shared page-settings
 * dialog (size + rotation). Constant CSS size — pair with px page spacing,
 * whose screen-fixed side padding gives the rail room at every zoom.
 */
export function pageActions(callbacks: PageActionsCallbacks): OverlaySource {
    const i18n = callbacks.i18n ?? createI18n("en");
    return (frame) =>
        frame.views
            .filter((view) => view.height >= MIN_PAGE_HEIGHT)
            .map((view): OverlayItem => {
                return {
                    key: `pill:${view.index}`,
                    // The rail's top-left corner: just right of the page,
                    // level with its top edge.
                    x: view.x + view.width + PILL_OFFSET,
                    y: view.y,
                    create: () => {
                        const el = document.createElement("div");
                        el.className = "udoc-ui__page-actions";
                        el.setAttribute("role", "group");

                        el.append(
                            button("udoc-ui__page-actions-btn udoc-ui__page-actions-up", ICON_CHEVRON_UP),
                            button("udoc-ui__page-actions-btn udoc-ui__page-actions-down", ICON_CHEVRON_DOWN),
                            button("udoc-ui__page-actions-btn udoc-ui__page-actions-rotate", ICON_ROTATE_RIGHT),
                            button("udoc-ui__page-actions-btn udoc-ui__page-actions-more", ICON_MORE),
                            button("udoc-ui__page-actions-btn udoc-ui__page-actions-delete", ICON_DELETE),
                        );

                        // "More" opens the shared settings dialog for this page,
                        // seeded with the size last stashed by `update`. The
                        // pill's index is encoded in its key, so the pooled
                        // element always speaks for the same page.
                        const more = el.querySelector<HTMLButtonElement>(".udoc-ui__page-actions-more")!;
                        more.addEventListener("click", () => {
                            const size = pillSize.get(el);
                            if (size) callbacks.onOpenSettings(view.index, size);
                        });

                        return el;
                    },
                    update: (el) => {
                        const index = view.index;
                        const page = index + 1;
                        const count = callbacks.composedPageCount();
                        el.setAttribute("aria-label", i18n.t("pageControls.label", { page }));

                        // Reveal only the hovered page's rail.
                        el.classList.toggle("udoc-ui__page-actions--peek", callbacks.hoveredPage() === index);

                        const up = el.querySelector<HTMLButtonElement>(".udoc-ui__page-actions-up")!;
                        up.disabled = index === 0;
                        up.title = i18n.t("pageControls.moveUp");
                        up.setAttribute("aria-label", i18n.t("pageControls.moveUpLabel", { page }));
                        up.onclick = () => callbacks.onMoveUp(index);

                        const down = el.querySelector<HTMLButtonElement>(".udoc-ui__page-actions-down")!;
                        down.disabled = index >= count - 1;
                        down.title = i18n.t("pageControls.moveDown");
                        down.setAttribute("aria-label", i18n.t("pageControls.moveDownLabel", { page }));
                        down.onclick = () => callbacks.onMoveDown(index);

                        // The pill's rotate button turns the page clockwise; the
                        // settings dialog offers both directions.
                        const rotate = el.querySelector<HTMLButtonElement>(".udoc-ui__page-actions-rotate")!;
                        rotate.title = i18n.t("pageControls.rotate");
                        rotate.setAttribute("aria-label", i18n.t("pageControls.rotateLabel", { page }));
                        rotate.onclick = () => callbacks.onRotate(index, true);

                        const more = el.querySelector<HTMLButtonElement>(".udoc-ui__page-actions-more")!;
                        more.title = i18n.t("pageControls.settings");
                        more.setAttribute("aria-label", i18n.t("pageControls.settingsLabel", { page }));

                        const del = el.querySelector<HTMLButtonElement>(".udoc-ui__page-actions-delete")!;
                        del.disabled = count <= 1;
                        del.title = i18n.t("pageControls.delete");
                        del.setAttribute("aria-label", i18n.t("pageControls.deleteLabel", { page }));
                        del.onclick = () => callbacks.onDelete(index);

                        // Stash the page's intrinsic (media-box) size for the
                        // settings dialog. The frame's geometry is the *displayed*
                        // size (CSS px / scale = document points); a quarter-turn
                        // rotation swaps width and height on screen, so undo that
                        // to recover the rotation-independent page rectangle.
                        const wPt = view.width / frame.scale;
                        const hPt = view.height / frame.scale;
                        const turned = view.rotation % 2 === 1;
                        pillSize.set(el, {
                            width: turned ? hPt : wPt,
                            height: turned ? wPt : hPt,
                            rotation: view.rotation,
                        });
                    },
                };
            });
}

/** Options for the insert-between-pages affordance. */
export interface PageInsertsOptions {
    /** The language the insert button's name is in. Default English. */
    i18n?: I18n;
    /**
     * The inter-page gap in **document points** — the same value the shell set
     * via `setSpacing`. The strip's on-screen hover-zone height is this × the
     * frame's scale, so it fills the (page-fixed) gap at every zoom.
     */
    gapPt: number;
    /** Total page count (for the after-the-last-page strip). */
    composedPageCount: () => number;
    /** Insert a blank page at `index` (`0` = before the first page). */
    onInsert: (index: number) => void;
    /**
     * The region (viewport CSS px) the live selection's edit chrome covers, or
     * null when nothing is selected — read every frame. Any insert strip that
     * overlaps it is dropped: a selection near a page edge floats its resize
     * handles and rotation grip into the gap, so yielding the strip there keeps
     * the insert "+" from lighting up under them. Omit to never yield.
     */
    keepOut?: () => { left: number; top: number; right: number; bottom: number } | null;
}

/**
 * The insert affordance (`udoc:page-insert`): an invisible strip filling each
 * inter-page gap (plus above the first and below the last page) that reveals
 * a divider line and a centered "+" button on hover. The strip at index `i`
 * inserts before page `i`, dissolving the before/after question spatially.
 */
export function pageInserts(options: PageInsertsOptions): OverlaySource {
    const i18n = options.i18n ?? createI18n("en");
    // Anchored by the strip's top-left (integer-friendly — a -50% centering
    // translate of a fractional width would land the layer on a half pixel
    // and blur it; the manager snaps the wrapper to the device grid).
    const stripItem = (
        insertIndex: number,
        left: number,
        top: number,
        width: number,
        height: number,
    ): OverlayItem => ({
        key: `gap:${insertIndex}`,
        x: left,
        y: top,
        create: () => {
            const el = document.createElement("div");
            el.className = "udoc-ui__page-insert";

            const line = document.createElement("span");
            line.className = "udoc-ui__page-insert-line";

            const btn = button("udoc-ui__page-insert-btn", ICON_PAGE_ADD);
            btn.title = i18n.t("pageControls.insert");

            el.append(line, btn);
            return el;
        },
        update: (el) => {
            el.style.width = `${width}px`;
            el.style.height = `${height}px`;
            const btn = el.querySelector<HTMLButtonElement>(".udoc-ui__page-insert-btn")!;
            btn.setAttribute(
                "aria-label",
                insertIndex >= options.composedPageCount()
                    ? i18n.t("pageControls.insertAtEnd")
                    : i18n.t("pageControls.insertBefore", { page: insertIndex + 1 }),
            );
            btn.onclick = () => options.onInsert(insertIndex);
        },
    });

    return (frame) => {
        const items: OverlayItem[] = [];
        // The gap is page-fixed (document points); its on-screen height is the
        // gap scaled by this frame's CSS-px-per-point factor.
        const gapPx = options.gapPt * frame.scale;
        // The selection's edit chrome for this frame (null when nothing is
        // selected). A strip that overlaps it yields the gap to the handles.
        const keepOut = options.keepOut?.() ?? null;
        const clearOfSelection = (left: number, top: number, width: number, height: number): boolean =>
            keepOut === null ||
            left + width <= keepOut.left ||
            left >= keepOut.right ||
            top + height <= keepOut.top ||
            top >= keepOut.bottom;
        // Drop the insert affordance once a page is too short on screen to carry
        // its own control rail — same threshold as `pageActions`, so the two
        // page-management overlays appear and vanish together at every zoom
        // rather than leaving stray inserts around pages with no controls.
        for (const view of frame.views.filter((v) => v.height >= MIN_PAGE_HEIGHT)) {
            const width = Math.round(Math.max(view.width, MIN_INSERT_WIDTH));
            const left = view.x + (view.width - width) / 2;
            // The gap above this page: inserting there is "before this page".
            const top = view.y - gapPx;
            if (clearOfSelection(left, top, width, gapPx)) {
                items.push(stripItem(view.index, left, top, width, gapPx));
            }
            // Below the document's last page: "append at the end".
            if (view.index === options.composedPageCount() - 1) {
                const tail = view.y + view.height;
                if (clearOfSelection(left, tail, width, gapPx)) {
                    items.push(stripItem(view.index + 1, left, tail, width, gapPx));
                }
            }
        }
        return items;
    };
}
