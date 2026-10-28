// The selection overlay: shapes over the canvas marking the selected graphics
// objects — the local selection plus every remote collaborator's (each in a
// stable per-peer color). Function-critical edit chrome, so — unlike the page
// pill or the insert strips — it deliberately does NOT go through the public
// overlay registry (a host can restyle it, but not remove it; see the
// "Overlays & page chrome" design note).
//
// The geometry arrives from the worker in **page-local document points**
// (`WorkerClient.onSelection`): each item is the object's bounds in its own
// local space plus a `local → page` affine, or — for a text highlight — the
// four corners of a quad on the page. Re-sent only when a selection or the
// document changes. Each painted frame this layer composes that with the page
// view rects the worker streams (`onPageViews`) and draws the object's box as
// a faithful **parallelogram** — so rotation and skew (from an imported PDF
// `cm`) both render correctly — and a highlight's quad as it is, so text a
// warp bends is followed; both ride scroll/zoom with zero extra worker
// traffic.

import { EMPTY_SELECTION_CAPABILITIES, allowsEdit } from "../../geometry.js";
import type {
    PageView,
    PeerPointer,
    PeerSelectionGeometry,
    Rect,
    SelectionBox,
    SelectionEditKind,
    SelectionQuad,
    SelectionState,
} from "../../geometry.js";
import type { Affine } from "./affine.js";
import {
    IDENTITY,
    applyPoint,
    applyVector,
    fromComponents,
    invert,
    multiply,
    rotate,
    scale,
    translate,
} from "./affine.js";
import { applyContentClip } from "./overlayClip.js";
import { ICON_TOOL_POINTER } from "../icons.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** The slice of a page-views frame the projection needs. */
interface SelectionFrame {
    views: PageView[];
    /** CSS px per document point for this frame. */
    scale: number;
}

/** How to draw a pooled box this frame: an object box (stroked, handled for the
 *  local user), a grid cell-range block (filled + bordered, no handles), or a
 *  text highlight (fill). Assigned from which group of the structured geometry
 *  the box came from — a peer's boxes carry the same roles, tinted by its color.
 *  Carets are not polygon specs: the local one and each peer's draw as HTML
 *  lines (see `#renderCarets`). Presentation only, not part of the wire
 *  contract. */
type BoxRole = "object" | "cell" | "text";

interface BoxSpec {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    transform: Affine;
    role: BoxRole;
    peer: string | null;
    name: string | null;
    /** How far its box stands off its bounds on screen, CSS px: an
     *  annotation's {@link ANNOTATION_PADDING}, else 0. */
    padding: number;
    /** A text highlight's corners in page-local points, drawn as they are in
     *  place of the box under its transform; null for a box. */
    points: SelectionQuad["points"] | null;
}

/** The eight resize handles, named by the compass point they sit on. */
export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

/**
 * An axis-aligned region in viewport (CSS px, canvas-relative) space — the
 * edges of the selection's edit chrome, as {@link SelectionLayer.keepOutRect}
 * reports it so page-anchored overlays can steer clear of it.
 */
export interface KeepOutRect {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

/**
 * The region the local selection's boxes cover in viewport (CSS px,
 * canvas-relative) space, along the screen's axes — `x0..x1` across, `y0..y1`
 * down — as {@link SelectionLayer.extent} reports it for the ruler to mark.
 */
export interface SelectionExtent {
    readonly x0: number;
    readonly y0: number;
    readonly x1: number;
    readonly y1: number;
}

/** Render/hit-test order (corners then edge midpoints). */
const HANDLE_ORDER: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/** Handle side length (CSS px) — keep in sync with the stylesheet. */
const HANDLE_SIZE = 8;
/** Half the hit target (CSS px): a little larger than the visual square. */
const HANDLE_HIT = 7;
/** How far an annotation's selection box stands off its rect on screen (CSS
 *  px), its handles and hit area with it — and how far its hover outline
 *  stands off its quads (see `AnnotationHoverLayer`). */
export const ANNOTATION_PADDING = 3;
/** Width (CSS px) of the move-border band inside a selected box's edge — the
 *  grab strip for an open text object (ObjectText): a press on the border moves
 *  the object, an interior press edits its text. */
const BORDER_BAND = 6;
/** Padding (CSS px) beyond the viewport that a box polygon is clipped to before
 *  it becomes SVG (see {@link clipToRect}). Off the visible canvas, so the cut
 *  edges hide under the SVG viewport clip rather than showing at the screen edge. */
const BOX_CLIP_PAD = 16;
/**
 * Restart the local caret's blink from its solid phase, so a keystroke or
 * caret move shows the caret at once rather than waiting out the blink cycle —
 * rewinding the running CSS animation to time zero, where the keyframes hold
 * opacity 1. Only the local caret blinks (peer carets stay solid), so only it
 * is ever restarted.
 */
function restartBlink(el: HTMLElement): void {
    for (const anim of el.getAnimations()) anim.currentTime = 0;
}

/**
 * A caret's page-local geometry as a comparison key: it changes on a real move
 * (type / arrow / click), so the layer can restart the blink, but not on a
 * scroll or zoom re-project — same geometry, new screen rect — so an idle caret
 * keeps blinking. A caret is a zero-width line, so width is irrelevant.
 */
function caretKey(caret: SelectionBox): string {
    const { rect, transform: t } = caret;
    const xf = `${t.scaleX},${t.skewY},${t.skewX},${t.scaleY},${t.translateX},${t.translateY}`;
    return `${caret.page}:${rect.x0},${rect.y0},${rect.y1 - rect.y0}:${xf}`;
}

/**
 * One selected object's placement: its bounds in its **own local space** (the
 * space `transform` maps from) plus the `local → page` affine. Each selected
 * object carries its own placement — boxes, resize handles, and the rotation
 * grip are all drawn per-object. A resize drag captures the grabbed object's
 * placement so the group scales about that object's anchor.
 */
export interface SelectionPlacement {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    transform: Affine;
}

/**
 * A live transform preview applied to the local boxes during a drag:
 * - `affine` — one shared page-local delta (`delta · current`), for a move.
 * - `rotateEach` — every box turns `angle` radians about its **own** center, so
 *   a multi-object rotation spins each member in place.
 * - `scaleEach` — every box scales by `(sx, sy)` about its **own** anchor (the
 *   held-fixed corner, as bounds fractions), so a multi-object resize grows each
 *   member in place and the matching corner of every box moves proportionally.
 */
export type Preview =
    | { kind: "affine"; m: Affine }
    | { kind: "rotateEach"; angle: number }
    | { kind: "scaleEach"; sx: number; sy: number; axFrac: number; ayFrac: number };

/** A selected box the edit chrome sits on: its placement, and its local →
 *  viewport map (CSS px) this frame. */
export interface ChromeBox {
    readonly place: SelectionPlacement;
    readonly onScreen: Affine;
}

/** What a {@link SelectionChrome} draws and hit-tests from. */
export interface ChromeFrame {
    /**
     * The local boxes — object boxes and annotation rects — the edit chrome
     * sits on: none unless the selection shows edit chrome, on a single page.
     */
    readonly boxes: readonly ChromeBox[];
    /** The selection — its capabilities and engine-reported handles among it. */
    readonly state: SelectionState;
    /** `transform`'s local → viewport map on page `page` this frame, or null
     *  with that page off screen. */
    project(page: number, transform: Affine): Affine | null;
}

/**
 * Edit chrome the shell's extension adds on the selection, beside the resize
 * handles — edit mode's rotation and geometry grips.
 */
export interface SelectionChrome {
    /** How far around its targets a press still takes them, CSS px. */
    readonly hitPad: number;
    /**
     * Draw `frame`'s chrome — the live preview applied — into `group` (above
     * the resize handles) and `svg` (the outlines, behind them); with no boxes,
     * remove it.
     */
    render(frame: ChromeFrame, group: HTMLElement, svg: SVGSVGElement): void;
    /** The viewport region its targets cover in `frame` (no preview), before
     *  {@link hitPad}, or null for none. */
    reach(frame: ChromeFrame): KeepOutRect | null;
    /** The committed geometry superseded the live preview: drop any of its own. */
    reset(): void;
}

/**
 * The double-headed resize cursors by 45° bucket, indexed `round(deg / 45) % 4`
 * after the angle is folded into `[0, 180)` (resize cursors are symmetric):
 * 0° → ew, 45° → nwse, 90° → ns, 135° → nesw.
 */
const RESIZE_CURSORS = ["ew-resize", "nwse-resize", "ns-resize", "nesw-resize"];

/** Map a screen-space direction angle (radians, y-down) to a resize cursor. */
function cursorForAngle(angle: number): string {
    const deg = ((((angle * 180) / Math.PI) % 180) + 180) % 180;
    return RESIZE_CURSORS[Math.round(deg / 45) % 4]!;
}

/** `p` grown by `padding` CSS px on screen on every side — converted to local
 *  units per axis through `lv`, its local → viewport map, so the margin is
 *  even whatever the box's scale. */
function padPlacement<T extends SelectionPlacement>(p: T, lv: Affine, padding: number): T {
    const lenX = Math.hypot(lv[0], lv[1]);
    const lenY = Math.hypot(lv[2], lv[3]);
    const dx = lenX > 0 ? padding / lenX : 0;
    const dy = lenY > 0 ? padding / lenY : 0;
    return { ...p, x: p.x - dx, y: p.y - dy, width: p.width + 2 * dx, height: p.height + 2 * dy };
}

/** The local-space point of `handle` on a placement's bounds. */
function handleLocalPoint(handle: ResizeHandle, p: SelectionPlacement): { x: number; y: number } {
    const x = handle.includes("w") ? p.x : handle.includes("e") ? p.x + p.width : p.x + p.width / 2;
    const y = handle.includes("n") ? p.y : handle.includes("s") ? p.y + p.height : p.y + p.height / 2;
    return { x, y };
}

/**
 * A stable hue (degrees) for a peer, derived from its replica hex so every
 * client shows the same collaborator in the same color without coordination.
 * Golden-angle spacing keeps small replica ids visually far apart. Shared by the
 * solid stroke ({@link peerColor}) and the translucent highlight fill
 * ({@link peerColorFill}) so a peer's box and text read as one color.
 */
function peerHue(peer: string): number {
    // The low 8 hex digits fit a JS number exactly.
    const seed = parseInt(peer.slice(-8), 16) || 0;
    return (seed * 137.508) % 360;
}

/** A peer's solid color — its box / caret stroke, its name-flag fill, its
 *  pointer, and its face on the people button. */
export function peerColor(peer: string): string {
    return `hsl(${peerHue(peer).toFixed(1)} 70% 45%)`;
}

/** A peer's translucent fill alpha per role, held below the local fill for the
 *  same role so a collaborator's block reads fainter than your own selection: a
 *  text highlight at 0.2 (local 0.3), a spreadsheet cell block at 0.1 (local
 *  0.15). Peers are set further apart by a dashed, lower-opacity stroke — see the
 *  `--peer` classes in the stylesheet. */
const PEER_TEXT_FILL_ALPHA = 0.2;
const PEER_CELL_FILL_ALPHA = 0.1;

/** A peer's translucent fill at `alpha` — its text-highlight or cell-block fill,
 *  matching its hue (see the alpha constants above). */
function peerColorFill(peer: string, alpha: number): string {
    return `hsl(${peerHue(peer).toFixed(1)} 70% 45% / ${alpha})`;
}

/**
 * Renders one box per selected region, pooled across frames: the box outlines
 * live as SVG polygons (a crisp 1.5px stroke around the projected
 * parallelogram), the resize handles and rotation grip as DOM squares/circle.
 * A region whose page is off-screen simply has no box that frame.
 */
export class SelectionLayer {
    readonly #container: HTMLElement;
    /** The clipped chrome group: the boxes, handles, labels, and peer carets —
     *  everything clipped to the content area (see {@link #applyClip}). The
     *  `clip-path` lives on this inner group, NOT the container, because it makes
     *  an element a backdrop root: on the container it would cut the LOCAL caret's
     *  backdrop-filter off from the canvas behind it, blanking the caret (the
     *  caret has no ink of its own). The local caret is therefore a sibling of
     *  this group, a direct child of the (unclipped) container. */
    readonly #chrome: HTMLElement;
    /** The SVG holding the box outlines and the rotation stem (behind the
     *  handle squares, which the user grabs). Inside {@link #chrome}. */
    readonly #svg: SVGSVGElement;
    readonly #polys: SVGPolygonElement[] = [];
    /** Pooled peer name flags (DOM pills) — one per peer box that has a name,
     *  none for the local user. Live in the container above the SVG so they
     *  read on top of every outline. */
    readonly #labels: HTMLElement[] = [];
    /** Pooled resize-handle squares (8 per selected box when shown). */
    readonly #handles: HTMLElement[] = [];
    /** The local text caret: an HTML line the stylesheet paints with a
     *  backdrop filter (black over a light backdrop, white over a dark one —
     *  which doesn't apply to SVG shapes). Created on first use; hidden while
     *  there's no caret. Lives directly on the (unclipped) {@link #container},
     *  NOT in {@link #chrome}: a `clip-path` ancestor would make the caret's
     *  backdrop-filter sample the transparent overlay instead of the canvas and
     *  blank it, so it can't be CSS-clipped like the rest of the chrome. It needs
     *  no clip anyway — the content pane's `overflow: hidden` confines it, and the
     *  guide bands render in their own cells outside that pane. */
    #caret: HTMLElement | null = null;
    /** The local caret's page-local geometry last drawn ({@link caretKey}), so a
     *  real move restarts the blink while a scroll / zoom re-project — same
     *  geometry — leaves it running. Null when no caret is drawn. */
    #caretKey: string | null = null;
    /** Pooled peer caret lines — HTML like the local caret, so every caret has
     *  the same shape (an SVG polygon's stroke reads thinner than an
     *  equally-wide solid line); tinted by the peer's inline background. */
    readonly #peerCarets: HTMLElement[] = [];
    /** The remote peers' pointers, page-anchored, as the worker last reported them. */
    #peerPointers: PeerPointer[] = [];
    /** Pooled peer pointers — the arrow and its name pill, one per peer whose
     *  pointer rests on a page drawn this frame. */
    readonly #pointerEls: HTMLElement[] = [];
    #state: SelectionState = {
        local: { objects: [], annotations: [], cells: [], text: [], caret: null, headers: null },
        peers: [],
        capabilities: EMPTY_SELECTION_CAPABILITIES,
        properties: null,
        localChanged: false,
    };
    #lastFrame: SelectionFrame = { views: [], scale: 1 };
    /** The "Powered by docMentis" mark's viewport rect (CSS px, bottom-right), or
     *  null before a viewport is known / with branding off — punched out of the
     *  clip so a selection box never paints over the decal. Set out of band from
     *  the frame ({@link setBrandingRect}); the engine posts it only on a size /
     *  density change. */
    #brandingRect: Rect | null = null;
    /** The chrome key (the branding rect) the `clip-path` was last built from, so
     *  an unchanged frame — every frame but a format / density / resize change —
     *  doesn't rebuild the clip (nor read the container size). */
    #clipKey = "";
    /**
     * Whether the selection is editable — `true` shows (and hit-tests) the
     * resize/rotate chrome, `false` draws the outline boxes alone. View mode
     * selects objects to highlight them without offering move/resize/rotate, so
     * it runs with this off; edit mode turns it on. An annotation selection
     * shows the chrome either way (see {@link #showsChrome}).
     */
    #editable = true;
    /**
     * A transient transform preview (a page-local affine delta) applied to the
     * **local object** boxes only, so an in-progress move / resize / rotate drag
     * shows without a worker round-trip. Held until the committed edit's fresh
     * geometry arrives (the `resetDrag` path of {@link setState}), so the boxes
     * never snap back. Peer boxes are unaffected — and so are the marks *inside*
     * an object (a text highlight, a cell block, the caret), which the drag does
     * not move: they mark glyphs the canvas still paints where they were.
     */
    #preview: Preview | null = null;
    /**
     * Notified after any state-driven re-project (select / preview / editable
     * toggle) that can move the edit chrome without a new painted frame — so a
     * page-anchored overlay reading {@link keepOutRect} can refresh with it.
     * Not fired from the per-frame {@link render}; the frame driver already
     * re-renders both layers itself.
     */
    #onChromeChange: (() => void) | null = null;
    /** The chrome the shell's extension adds — edit mode's rotation and
     *  geometry grips — or null for none. */
    #extraChrome: SelectionChrome | null = null;

    constructor(container: HTMLElement) {
        this.#container = container;
        // The clipped chrome group (boxes / handles / labels / peer carets). The
        // content-area clip is set on this inner group, not the container, so the
        // local caret — a sibling outside it — keeps its backdrop-filter (see
        // #chrome / #caret).
        this.#chrome = document.createElement("div");
        this.#chrome.className = "udoc-ui__selection-chrome";
        this.#container.appendChild(this.#chrome);
        // The outline layer sits below the handle squares so the rotation stems
        // pass behind them. No viewBox → one user unit is one CSS px, matching
        // the handle divs' coordinates.
        this.#svg = document.createElementNS(SVG_NS, "svg");
        this.#svg.setAttribute("class", "udoc-ui__selection-svg");
        this.#chrome.appendChild(this.#svg);
    }

    /**
     * Adopt a new selection state and re-project it immediately. Pass
     * `resetDrag` when the state already reflects a just-committed edit (its
     * geometry supersedes the live preview); otherwise the preview is preserved
     * so an unrelated update (a peer merge mid-drag) doesn't yank the box.
     */
    setState(state: SelectionState, resetDrag = false): void {
        this.#state = state;
        if (resetDrag) {
            this.#preview = null;
            this.#extraChrome?.reset();
        }
        this.render(this.#lastFrame);
        this.#onChromeChange?.();
    }

    /**
     * Adopt the remote peers' pointers and place them at once — only them: a
     * pointer moves far more often than anything else here, and moving one
     * re-projects no box.
     */
    setPeerPointers(pointers: PeerPointer[]): void {
        this.#peerPointers = pointers;
        this.#renderPointers(this.#pageMap());
    }

    /**
     * Register a listener fired whenever a state change (select / preview /
     * editable toggle) may have moved the edit chrome outside a painted frame —
     * the page-insert overlay hooks this to re-read {@link keepOutRect} so its
     * strips clear the handles the instant a selection lands, not on next paint.
     */
    onChromeChange(listener: () => void): void {
        this.#onChromeChange = listener;
    }

    /**
     * Set (or clear, with `null`) the live transform preview applied to the
     * local boxes, and re-project. Drives move / resize (a shared affine delta)
     * and rotate (a per-object spin about each box's own center).
     */
    setPreview(preview: Preview | null): void {
        this.#preview = preview;
        this.render(this.#lastFrame);
        this.#onChromeChange?.();
    }

    /** Draw `chrome`, the extension's, beside the resize handles from now on. */
    setChrome(chrome: SelectionChrome | null): void {
        this.#extraChrome = chrome;
        this.refresh();
    }

    /** Re-project now — after the extension's chrome changed its own state
     *  mid-gesture, with no new frame to draw it. */
    refresh(): void {
        this.render(this.#lastFrame);
        this.#onChromeChange?.();
    }

    /**
     * Toggle the edit chrome. With `false` the boxes draw as bare outlines (the
     * resize handles and rotation grip are removed and not hit-tested) — the
     * view-mode shape, where a click only highlights — but for an annotation
     * selection, which edits in either mode. Re-projects so the change shows
     * without waiting for the next frame.
     */
    setEditable(editable: boolean): void {
        if (this.#editable === editable) return;
        this.#editable = editable;
        this.render(this.#lastFrame);
        this.#onChromeChange?.();
    }

    /** Whether the edit chrome shows: where the selection is editable, and on
     *  an annotation selection in either mode — annotations edit in view mode
     *  as in edit. */
    #showsChrome(): boolean {
        return this.#editable || this.#state.local.annotations.length > 0;
    }

    /**
     * The single page every selected object sits on, or null when the selection
     * is empty or spans more than one page. Resize and rotation chrome is offered
     * only on a single page (a group resize/rotate applies across one page's
     * axes), so this gates both the drawn handles and their hit tests. The move
     * gesture also reads it to un-rotate the drag for the page's view rotation.
     */
    selectionPage(): number | null {
        const boxes = this.#objectItems();
        if (boxes.length === 0) return null;
        const page = boxes[0]!.page;
        for (const b of boxes) if (b.page !== page) return null;
        return page;
    }

    /**
     * The local boxes the move / resize / rotate chrome and the "over a selected
     * box?" test ride — object boxes and annotation rects, never a text
     * highlight or caret (an edit-mode text selection carries an object box
     * alongside them).
     */
    #objectItems(): SelectionBox[] {
        const { objects, annotations } = this.#state.local;
        return annotations.length === 0 ? objects : [...objects, ...annotations];
    }

    /**
     * `place`, `item`'s placement, as its box stands on screen through `lv`,
     * its local → viewport map: an annotation's grown by
     * {@link ANNOTATION_PADDING}, an object's as it is. Where its handles sit
     * and what a press on it hits — while a resize still scales the placement
     * itself, so the box follows the pointer.
     */
    #boxPlacement(item: SelectionBox, place: SelectionPlacement, lv: Affine): SelectionPlacement {
        return this.#state.local.annotations.includes(item) ? padPlacement(place, lv, ANNOTATION_PADDING) : place;
    }

    /** Whether the local selection allows an edit of any of `kinds` — its move
     *  (`translateObjects` / `translateAnnotations` / `translateShapes`), resize
     *  (`scaleEachObject` / `resizeAnnotations` / `scaleEachShape`) or rotation
     *  (`rotateEachObject` / `rotateEachShape`), whose chrome and cursors show
     *  only when it does. */
    allows(...kinds: SelectionEditKind[]): boolean {
        return allowsEdit(this.#state.capabilities, ...kinds);
    }

    /**
     * The grabbed resize handle (its compass name) and the placement of the
     * object it sits on, if `(x, y)` (viewport CSS px, canvas-relative) falls on
     * one — projected per-object against the latest frame (handles are drawn on
     * every selected box). Null when not over a handle or when resize isn't
     * offered (empty / multi-page selection, view mode, or a selection that
     * doesn't resize). Where the handles of a small box reach over one another,
     * the nearest takes the point — a corner's own, not the edge handle beside
     * it. The resize drag
     * captures the returned placement so the group scales about that object's
     * anchor.
     */
    handleAt(x: number, y: number): { handle: ResizeHandle; place: SelectionPlacement } | null {
        if (
            !this.#showsChrome() ||
            this.selectionPage() === null ||
            !this.allows("scaleEachObject", "resizeAnnotations", "scaleEachShape")
        )
            return null;
        const byPage = this.#pageMap();
        let nearest: { handle: ResizeHandle; place: SelectionPlacement } | null = null;
        let nearestDistance = Infinity;
        for (const item of this.#objectItems()) {
            const view = byPage.get(item.page);
            if (!view) continue;
            const place = itemPlacement(item);
            const lv = this.#localToViewport(place.transform, view);
            const box = this.#boxPlacement(item, place, lv);
            for (const handle of HANDLE_ORDER) {
                const lp = handleLocalPoint(handle, box);
                const c = applyPoint(lv, lp.x, lp.y);
                const distance = Math.max(Math.abs(x - c.x), Math.abs(y - c.y));
                if (distance <= HANDLE_HIT && distance < nearestDistance) {
                    nearest = { handle, place };
                    nearestDistance = distance;
                }
            }
        }
        return nearest;
    }

    /**
     * The CSS resize cursor for `handle` on `place`, oriented to the box's
     * **on-screen** pose. The handle's compass name lives in page-local space,
     * but the box may be drawn rotated — by the object's own transform and/or the
     * page's view rotation — so the cursor is chosen from the handle's outward
     * direction carried along the box's on-screen axes rather than the name. An
     * edge handle points along one axis; a corner along their diagonal, whatever
     * the box's proportions — the direction from the centre to a corner would
     * read as an edge on a long, thin box. Falls back to a plain `ew-resize`
     * when the box's page is off-screen.
     */
    resizeCursor(handle: ResizeHandle, place: SelectionPlacement): string {
        const view = this.#pageMap().get(place.page);
        if (!view) return "ew-resize";
        const lv = this.#localToViewport(place.transform, view);
        const dx = handle.includes("w") ? -1 : handle.includes("e") ? 1 : 0;
        const dy = handle.includes("n") ? -1 : handle.includes("s") ? 1 : 0;
        const ax = applyVector(lv, 1, 0);
        const ay = applyVector(lv, 0, 1);
        const lx = Math.hypot(ax.x, ax.y) || 1;
        const ly = Math.hypot(ay.x, ay.y) || 1;
        const x = (dx * ax.x) / lx + (dy * ay.x) / ly;
        const y = (dx * ax.y) / lx + (dy * ay.y) / ly;
        return cursorForAngle(Math.atan2(y, x));
    }

    /**
     * Whether `(x, y)` falls within a **local** selection box (its projected
     * parallelogram) — the "is the pointer on a selected object?" test that
     * starts a move drag.
     */
    hitLocal(x: number, y: number): boolean {
        return this.#within(this.#objectItems(), x, y);
    }

    /**
     * Whether `(x, y)` falls within a **local** cell box — the tinted cells a
     * table or sheet block draws. The "is the pointer on the selected block?"
     * test where no object box stands around it: a word document's table has
     * no frame, so a block of its cells is all the selection draws.
     */
    hitCells(x: number, y: number): boolean {
        return this.#within(this.#state.local.cells, x, y);
    }

    /** Whether `(x, y)` falls within any of `items`, each projected against its
     *  page's latest view. */
    #within(items: SelectionBox[], x: number, y: number): boolean {
        const byPage = this.#pageMap();
        for (const item of items) {
            const view = byPage.get(item.page);
            if (!view) continue;
            let place = itemPlacement(item);
            const lv = this.#localToViewport(place.transform, view);
            place = this.#boxPlacement(item, place, lv);
            const inv = invert(lv);
            if (!inv) continue;
            const local = applyPoint(inv, x, y);
            if (
                local.x >= place.x &&
                local.x <= place.x + place.width &&
                local.y >= place.y &&
                local.y <= place.y + place.height
            ) {
                return true;
            }
        }
        return false;
    }

    /**
     * Whether `(x, y)` (viewport CSS px) falls on a **local** object box's move
     * border — inside the projected box but within {@link BORDER_BAND} of its
     * outline. The grab strip for an open text object (ObjectText): a press on
     * the border moves the object while an interior press edits its text. The
     * band is measured on-screen (converted to local units per axis via the
     * projected basis lengths, like the resize min-side), so it stays an even
     * strip under the box's rotation, scale, and shear. A point in the deep
     * interior, or outside every box, is false.
     */
    borderLocal(x: number, y: number): boolean {
        const byPage = this.#pageMap();
        for (const item of this.#objectItems()) {
            const view = byPage.get(item.page);
            if (!view) continue;
            let place = itemPlacement(item);
            const lv = this.#localToViewport(place.transform, view);
            place = this.#boxPlacement(item, place, lv);
            const inv = invert(lv);
            if (!inv) continue;
            const local = applyPoint(inv, x, y);
            if (
                local.x < place.x ||
                local.x > place.x + place.width ||
                local.y < place.y ||
                local.y > place.y + place.height
            ) {
                continue; // outside this box
            }
            // One local unit spans this many CSS px along each projected axis;
            // fold the on-screen band into local units so the strip is the same
            // width on screen whatever the box's local scale.
            const lenX = Math.hypot(lv[0], lv[1]);
            const lenY = Math.hypot(lv[2], lv[3]);
            const bandX = lenX > 0 ? BORDER_BAND / lenX : 0;
            const bandY = lenY > 0 ? BORDER_BAND / lenY : 0;
            const nearX = local.x - place.x <= bandX || place.x + place.width - local.x <= bandX;
            const nearY = local.y - place.y <= bandY || place.y + place.height - local.y <= bandY;
            if (nearX || nearY) return true;
        }
        return false;
    }

    /**
     * The axis-aligned viewport region the local selection's edit chrome covers
     * this frame — every selected box's resize handles plus its rotation grip,
     * grown by their hit radius — or null when no editable single-page selection
     * is showing chrome (view mode, empty, or a cross-page selection, matching
     * {@link handleAt} / {@link rotateHitTest}).
     *
     * The handles and grip float just *outside* the box, so a selection near a
     * page edge pushes them into the inter-page gap. The page-insert overlay
     * reads this rect to drop any insert strip it covers, so the two never fight
     * for the same gap.
     */
    keepOutRect(): KeepOutRect | null {
        if (!this.#showsChrome() || this.selectionPage() === null) return null;
        const byPage = this.#pageMap();
        let left = Infinity;
        let top = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;
        for (const item of this.#objectItems()) {
            const view = byPage.get(item.page);
            if (!view) continue; // page scrolled off — no chrome for this box
            const place = itemPlacement(item);
            const lv = this.#localToViewport(place.transform, view);
            const box = this.#boxPlacement(item, place, lv);
            // The resize handles (box corners + edge midpoints): with the
            // extension's chrome below, the outermost grabbable chrome,
            // projected to this frame.
            for (const handle of HANDLE_ORDER) {
                const lp = handleLocalPoint(handle, box);
                const c = applyPoint(lv, lp.x, lp.y);
                left = Math.min(left, c.x);
                top = Math.min(top, c.y);
                right = Math.max(right, c.x);
                bottom = Math.max(bottom, c.y);
            }
        }
        const extra = this.#extraChrome?.reach(this.#chromeFrame(false));
        if (extra) {
            left = Math.min(left, extra.left);
            top = Math.min(top, extra.top);
            right = Math.max(right, extra.right);
            bottom = Math.max(bottom, extra.bottom);
        }
        if (left > right) return null; // every selected box is off-screen
        // Grow by the largest hit radius so a strip clears the grabbable target,
        // not just the drawn square.
        const pad = Math.max(HANDLE_HIT, this.#extraChrome?.hitPad ?? 0);
        return { left: left - pad, top: top - pad, right: right + pad, bottom: bottom + pad };
    }

    /**
     * The region the local selection's boxes cover this frame — its objects,
     * annotations and cell blocks, the objects and annotations where the live
     * preview carries them mid-drag — or null with none on screen. An
     * annotation counts by its own rect, not the box standing off it. A text
     * range or caret runs along its lines rather than framing a region, and
     * adds nothing.
     */
    extent(): SelectionExtent | null {
        const byPage = this.#pageMap();
        const { objects, annotations, cells } = this.#state.local;
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        const cover = (items: SelectionBox[], previewed: boolean): void => {
            for (const item of items) {
                const view = byPage.get(item.page);
                if (!view) continue; // page scrolled off
                const place = itemPlacement(item);
                const m = previewed ? this.#applyPreview(place.transform, place) : place.transform;
                const lv = this.#localToViewport(m, view);
                for (const [lx, ly] of cornersOf(place)) {
                    const p = applyPoint(lv, lx, ly);
                    x0 = Math.min(x0, p.x);
                    y0 = Math.min(y0, p.y);
                    x1 = Math.max(x1, p.x);
                    y1 = Math.max(y1, p.y);
                }
            }
        };
        cover(objects, true);
        cover(annotations, true);
        cover(cells, false);
        return x0 > x1 ? null : { x0, y0, x1, y1 };
    }

    /** Re-project the current selections against one painted frame's pages. */
    render(frame: SelectionFrame): void {
        this.#lastFrame = frame;
        this.#applyClip();
        const byPage = new Map<number, PageView>();
        for (const view of frame.views) byPage.set(view.index, view);

        // Peers first, the local user last: SVG paints in document order, so
        // this keeps our own selection box on top of any peer box it overlaps.
        const specs: BoxSpec[] = [];
        for (const peer of this.#state.peers) {
            // A peer is drawn faithfully by role: one object's own box, many
            // collapsed to a covering box, or a text highlight (see peerBoxes;
            // its caret draws in the caret pass) — but never the per-object
            // resize/rotate chrome.
            for (const spec of peerBoxes(peer)) specs.push(spec);
        }
        // The local selection, grouped by role — object boxes and annotation
        // rects (handled), grid cell blocks (filled + bordered, no handles), and
        // text highlights (fill). Carets are not polygon specs: they draw as
        // HTML lines above the SVG (see #renderCarets).
        const local = this.#state.local;
        for (const b of local.objects) specs.push(boxSpec(b, "object", null, null));
        for (const b of local.annotations)
            specs.push({ ...boxSpec(b, "object", null, null), padding: ANNOTATION_PADDING });
        for (const b of local.cells) specs.push(boxSpec(b, "cell", null, null));
        for (const q of local.text) specs.push(quadSpec(q, null, null));

        // Peer name flags placed this frame: the projected box top-left, the
        // peer color, and the name. Rendered after the boxes so the pooled
        // label DOM tracks count without churn.
        const flags: Array<{ x: number; y: number; color: string; name: string }> = [];
        const flaggedPeers = new Set<string>();

        // The padded viewport every box polygon is clipped to (see clipToRect):
        // a whole-column / whole-sheet cell block reaches the grid's last row, so
        // its unclipped polygon is tens of millions of px tall and the browser
        // draws its dashed peer stroke solid. Read the canvas size once here,
        // before the loop writes any points, so it costs one layout read a frame.
        const clipW = this.#chrome.clientWidth;
        const clipH = this.#chrome.clientHeight;
        const clipping = clipW > 0 && clipH > 0;

        let used = 0;
        for (const spec of specs) {
            const view = byPage.get(spec.page);
            if (!view) continue; // page scrolled off — no box this frame
            let poly = this.#polys[used];
            if (!poly) {
                poly = document.createElementNS(SVG_NS, "polygon");
                this.#svg.appendChild(poly);
                this.#polys.push(poly);
            }
            poly.setAttribute("class", boxClass(spec));
            // Peer boxes carry the peer's stable color inline, on the SVG
            // properties their role paints with — a text highlight fills, an
            // object box strokes, a cell block does both. A local box clears both
            // so the stylesheet's fixed selection color applies. Polys are
            // pooled, so both props reset every frame.
            const color = spec.peer ? peerColor(spec.peer) : "";
            const peerFill = spec.peer !== null && (spec.role === "text" || spec.role === "cell");
            const peerStroke = spec.peer !== null && (spec.role === "object" || spec.role === "cell");
            const fillAlpha = spec.role === "cell" ? PEER_CELL_FILL_ALPHA : PEER_TEXT_FILL_ALPHA;
            poly.style.fill = peerFill ? peerColorFill(spec.peer as string, fillAlpha) : "";
            poly.style.stroke = peerStroke ? color : "";
            // Only the local user's **object** boxes carry the live transform
            // preview: a drag transforms objects, while the marks inside one —
            // a text highlight, a cell block — stay on the glyphs, which the
            // canvas goes on painting in place until the edit commits.
            const base = spec.transform;
            const m = spec.peer === null && spec.role === "object" ? this.#applyPreview(base, spec) : base;
            const lv = this.#localToViewport(m, view);
            const box = spec.padding > 0 ? padPlacement(spec, lv, spec.padding) : spec;
            let corners = spec.points
                ? spec.points.map((p) => applyPoint(lv, p.x, p.y))
                : cornersOf(box).map(([lx, ly]) => applyPoint(lv, lx, ly));
            if (clipping) {
                corners = clipToRect(corners, -BOX_CLIP_PAD, -BOX_CLIP_PAD, clipW + BOX_CLIP_PAD, clipH + BOX_CLIP_PAD);
            }
            poly.setAttribute("points", corners.map((p) => `${p.x},${p.y}`).join(" "));
            // Flag the peer's name at the box's projected top-left corner. Only
            // the first box of a multi-object peer selection is labelled, so a
            // peer reads as one named cursor, not one flag per object.
            if (spec.peer && spec.name && !flaggedPeers.has(spec.peer)) {
                flaggedPeers.add(spec.peer);
                const anchor = applyPoint(lv, spec.x, spec.y);
                flags.push({ x: anchor.x, y: anchor.y, color, name: spec.name });
            }
            used++;
        }
        while (this.#polys.length > used) this.#polys.pop()!.remove();

        this.#renderCarets(byPage, flags, flaggedPeers);
        this.#renderLabels(flags);
        this.#renderHandles();
        this.#renderPointers(byPage);
    }

    /**
     * Place each peer's pointer: the arrow's tip on the page-local point its
     * peer rests on, projected through the page's on-screen box like a box
     * corner, in the peer's color, with its name beside it. Upright whatever
     * the page's rotation — a pointer is the peer's screen cursor, not a mark
     * on the page. A pointer whose page is off-screen draws nothing this frame.
     */
    #renderPointers(byPage: Map<number, PageView>): void {
        let used = 0;
        for (const { peer, pointer } of this.#peerPointers) {
            const view = byPage.get(pointer.page);
            if (!view) continue;
            let el = this.#pointerEls[used];
            if (!el) {
                el = document.createElement("div");
                el.className = "udoc-ui__peer-pointer";
                el.innerHTML = `${ICON_TOOL_POINTER}<span class="udoc-ui__peer-pointer-name"></span>`;
                this.#chrome.appendChild(el);
                this.#pointerEls.push(el);
            }
            const color = peerColor(peer.id);
            el.style.color = color;
            const name = el.lastElementChild as HTMLElement;
            name.textContent = peer.name ?? "";
            name.style.background = color;
            name.style.display = peer.name ? "" : "none";
            const tip = applyPoint(this.#viewportOf(view), pointer.point.x, pointer.point.y);
            el.style.transform = `translate(${tip.x}px, ${tip.y}px)`;
            used++;
        }
        while (this.#pointerEls.length > used) this.#pointerEls.pop()!.remove();
    }

    /**
     * The mark's viewport rect (CSS px), punched out of the clip so a selection
     * box never paints over the "Powered by docMentis" decal. Set out of band
     * from the frame — the engine posts it only on a size / density change. Pass
     * null when no viewport is known yet or branding is off.
     */
    setBrandingRect(rect: Rect | null): void {
        this.#brandingRect = rect;
        this.#applyClip();
    }

    /**
     * Clip the chrome group (boxes, handles, labels, peer carets — every
     * descendant of {@link #chrome}) to the canvas minus the branding decal the
     * engine paints into its bottom-right. A selection box scrolled over the decal
     * is cut at its edge rather than painted on top of it. The group fills the
     * canvas, so the decal rect drops straight into its clip coordinates.
     *
     * The clip is on {@link #chrome}, not the container, so it never sits over the
     * local caret (whose backdrop-filter a `clip-path` ancestor would blank — see
     * {@link #caret}); the caret is a sibling outside the clipped group instead.
     *
     * Delegates to the shared {@link applyContentClip} so the selection chrome, the
     * page-anchored overlay, and the marquee all clip through one definition.
     */
    #applyClip(): void {
        this.#clipKey = applyContentClip(this.#chrome, { branding: this.#brandingRect }, this.#clipKey);
    }

    /**
     * Place every text caret — each peer's, then the local one on top — as
     * HTML lines (see {@link #placeCaretLine}). A peer's caret is tinted its
     * color and wears the peer's name flag, tagging its cursor (`peerBoxes`
     * leaves the name off the polygon specs whenever a caret is drawn); the
     * local caret's ink comes from the stylesheet's backdrop filter instead
     * (black over a light backdrop, white over a dark one). No caret rides the
     * live drag preview: a caret marks a glyph, and the glyph stays where the
     * canvas paints it until the move / resize / rotate commits. A caret whose
     * page is off-screen draws nothing this frame.
     */
    #renderCarets(
        byPage: Map<number, PageView>,
        flags: Array<{ x: number; y: number; color: string; name: string }>,
        flaggedPeers: Set<string>,
    ): void {
        let used = 0;
        for (const peer of this.#state.peers) {
            const caret = peer.selection.caret;
            const view = caret ? byPage.get(caret.page) : undefined;
            if (!caret || !view) continue;
            const el = this.#ensurePeerCaret(used++);
            const color = peerColor(peer.peer.id);
            el.style.background = color;
            const top = this.#placeCaretLine(el, caret, view);
            if (peer.peer.name && !flaggedPeers.has(peer.peer.id)) {
                flaggedPeers.add(peer.peer.id);
                flags.push({ x: top.x, y: top.y, color, name: peer.peer.name });
            }
        }
        while (this.#peerCarets.length > used) this.#peerCarets.pop()!.remove();

        const caret = this.#state.local.caret;
        if (!caret) {
            if (this.#caret) this.#caret.style.display = "none";
            this.#caretKey = null;
            return;
        }
        const view = byPage.get(caret.page);
        if (!view) {
            // The caret's page scrolled off — hide it this frame but keep
            // #caretKey, so scrolling it back into view isn't read as a move.
            if (this.#caret) this.#caret.style.display = "none";
            return;
        }
        let el = this.#caret;
        if (!el) {
            el = document.createElement("div");
            el.className = "udoc-ui__selection-caret udoc-ui__selection-caret--local";
            // On the (unclipped) container, NOT #chrome — a clip-path ancestor
            // would blank its backdrop-filter (see #caret / #applyClip).
            this.#container.appendChild(el);
            this.#caret = el;
        }
        this.#placeCaretLine(el, caret, view);
        el.style.display = "";
        // A real caret move (type / arrow / click) restarts the blink from its
        // solid phase, so the caret shows at once; a scroll / zoom re-project
        // keeps the same key and leaves the blink running.
        const key = caretKey(caret);
        if (key !== this.#caretKey) {
            this.#caretKey = key;
            restartBlink(el);
        }
    }

    /**
     * Pose `el` on a caret's projected segment: translated to the top point,
     * rotated onto the segment (the div's own axis is vertical), its width
     * centered on the line like a polygon's centered stroke. Returns the
     * projected top point, the name-flag anchor.
     */
    #placeCaretLine(el: HTMLElement, caret: SelectionBox, view: PageView): { x: number; y: number } {
        const place = itemPlacement(caret);
        const m = this.#localToViewport(place.transform, view);
        const top = applyPoint(m, place.x, place.y);
        const bottom = applyPoint(m, place.x, place.y + place.height);
        const angle = Math.atan2(bottom.y - top.y, bottom.x - top.x) - Math.PI / 2;
        el.style.height = `${Math.hypot(bottom.x - top.x, bottom.y - top.y)}px`;
        el.style.transform = `translate(${top.x}px, ${top.y}px) rotate(${angle}rad) translateX(-50%)`;
        return top;
    }

    /** A pooled peer caret line at slot `i` (created on first use). */
    #ensurePeerCaret(i: number): HTMLElement {
        let el = this.#peerCarets[i];
        if (!el) {
            el = document.createElement("div");
            el.className = "udoc-ui__selection-caret udoc-ui__selection-caret--peer";
            this.#chrome.appendChild(el);
            this.#peerCarets.push(el);
        }
        return el;
    }

    /**
     * Place the peer name flags this frame, pooling the DOM pills like the
     * boxes. Each flag is a screen-upright pill (it never rotates with the box)
     * sitting just above the box's projected top-left corner, in the peer's
     * color — a collaborator cursor label.
     *
     * The pill's natural spot is bottom-left on the anchor, lifted by its own
     * height (with a 3px gap); but a peer at the top of the view would put that
     * above the top edge, and one near the right/bottom would push it past that
     * edge — where the content clip cuts it off. So the pill is measured and
     * kept inside the content rect: flipped below the anchor when it would ride
     * above the top, then clamped on both axes. Without this an anchor at a view
     * edge (a peer editing the first line, or a box scrolled to the margin)
     * leaves the label rendered outside the viewport.
     */
    #renderLabels(flags: Array<{ x: number; y: number; color: string; name: string }>): void {
        // Set every pill's text first, so measuring their sizes below costs one
        // reflow, not one per pill (a transform write doesn't dirty layout, but
        // a textContent write does).
        flags.forEach((flag, i) => {
            let el = this.#labels[i];
            if (!el) {
                el = document.createElement("div");
                el.className = "udoc-ui__peer-label";
                this.#chrome.appendChild(el);
                this.#labels.push(el);
            }
            el.textContent = flag.name;
            el.style.background = flag.color;
        });
        while (this.#labels.length > flags.length) this.#labels.pop()!.remove();
        if (flags.length === 0) return;

        // The content rect (CSS px): #chrome fills the canvas, so its client box
        // is the viewport the pills must stay within.
        const vw = this.#chrome.clientWidth;
        const vh = this.#chrome.clientHeight;
        flags.forEach((flag, i) => {
            const el = this.#labels[i]!;
            const lw = el.offsetWidth;
            const lh = el.offsetHeight;
            let left = flag.x;
            let top = flag.y - 3 - lh; // just above the anchor
            if (top < 0) top = flag.y + 3; // flip below when it clears the top edge
            left = Math.max(0, Math.min(left, vw - lw));
            top = Math.max(0, Math.min(top, vh - lh));
            el.style.transform = `translate(${left}px, ${top}px)`;
        });
    }

    /**
     * Place the eight resize handles and the rotation grip + stem on **each**
     * selected box — the handles only when the selection resizes, the grip
     * only when it rotates — or remove all chrome when nothing's
     * selectable (empty / multi-page selection, or view mode). Resizing any
     * handle scales the whole group about the grabbed object's anchor; rotating
     * any grip spins each object about its own center — but every box carries the
     * full set so the affordance reads on each. Each handle rides its box's
     * (preview-applied) transform, so it sits on the parallelogram's corners.
     */
    #renderHandles(): void {
        const page = this.selectionPage();
        const byPage = this.#pageMap();
        // No chrome in view mode (bar an annotation selection), with nothing
        // selectable, or across pages.
        if (!this.#showsChrome() || page === null) {
            this.#trimChrome(0);
            this.#extraChrome?.render(this.#chromeFrame(true), this.#chrome, this.#svg);
            return;
        }
        const half = HANDLE_SIZE / 2;
        let usedHandles = 0;
        const resizes = this.allows("scaleEachObject", "resizeAnnotations", "scaleEachShape");
        for (const item of this.#objectItems()) {
            const view = byPage.get(item.page);
            if (!view) continue; // page scrolled off — no chrome for this box
            const place = itemPlacement(item);
            const lv = this.#localToViewport(this.#applyPreview(place.transform, place), view);
            const box = this.#boxPlacement(item, place, lv);
            // Spin each square to sit square-on against the box's edges: the
            // angle of the box's local x-axis, mapped into the viewport. (Under
            // shear the axes aren't perpendicular, so this aligns with the
            // horizontal edges — the closest a single square can come.)
            const xAxis = applyVector(lv, 1, 0);
            const angle = Math.atan2(xAxis.y, xAxis.x);
            for (const handle of resizes ? HANDLE_ORDER : []) {
                const el = this.#ensureHandle(usedHandles++);
                const lp = handleLocalPoint(handle, box);
                const c = applyPoint(lv, lp.x, lp.y);
                el.style.transform = `translate(${c.x - half}px, ${c.y - half}px) rotate(${angle}rad)`;
            }
        }
        this.#trimChrome(usedHandles);
        // The extension's chrome, drawn after the resize handles so it sits
        // above them.
        this.#extraChrome?.render(this.#chromeFrame(true), this.#chrome, this.#svg);
    }

    /** A pooled resize-handle square at slot `i` (created on first use). */
    #ensureHandle(i: number): HTMLElement {
        let el = this.#handles[i];
        if (!el) {
            el = document.createElement("div");
            el.className = "udoc-ui__selection-handle";
            this.#chrome.appendChild(el);
            this.#handles.push(el);
        }
        return el;
    }

    /** Drop the pooled resize handles past `handles` squares. */
    #trimChrome(handles: number): void {
        while (this.#handles.length > handles) this.#handles.pop()!.remove();
    }

    /**
     * The frame the extension's chrome draws from: the boxes the edit chrome
     * sits on — none unless it shows, on a single page — each with its local →
     * viewport map this frame, the live preview applied when `previewed`.
     */
    #chromeFrame(previewed: boolean): ChromeFrame {
        const byPage = this.#pageMap();
        const boxes: ChromeBox[] = [];
        if (this.#showsChrome() && this.selectionPage() !== null) {
            for (const item of this.#objectItems()) {
                const view = byPage.get(item.page);
                if (!view) continue; // page scrolled off — no chrome for this box
                const place = itemPlacement(item);
                const transform = previewed ? this.#applyPreview(place.transform, place) : place.transform;
                boxes.push({ place, onScreen: this.#localToViewport(transform, view) });
            }
        }
        return {
            boxes,
            state: this.#state,
            project: (page, transform) => {
                const view = byPage.get(page);
                return view ? this.#localToViewport(transform, view) : null;
            },
        };
    }

    /**
     * Apply the live preview to one box's `local → page` transform: a shared
     * affine delta (`delta · transform`) for move/resize, or — for rotate-each —
     * a spin of `angle` about this box's own center (mapped to page space through
     * `transform`). No preview → the transform unchanged.
     */
    #applyPreview(transform: Affine, bounds: { x: number; y: number; width: number; height: number }): Affine {
        const p = this.#preview;
        if (!p) return transform;
        if (p.kind === "affine") return multiply(p.m, transform);
        if (p.kind === "rotateEach") {
            // Spin this box about its own center in page space.
            const c = applyPoint(transform, bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
            return multiply(rotateDelta(p.angle, c.x, c.y), transform);
        }
        // scaleEach: scale this box about its own anchor in its local space, so
        // the new local → page transform is `M · (T(a) · S · T(-a))`.
        const ax = bounds.x + p.axFrac * bounds.width;
        const ay = bounds.y + p.ayFrac * bounds.height;
        const local = multiply(multiply(translate(ax, ay), scale(p.sx, p.sy)), translate(-ax, -ay));
        return multiply(transform, local);
    }

    /** Drop every box (document closed / layer destroyed). */
    clear(): void {
        this.setState(
            {
                local: { objects: [], annotations: [], cells: [], text: [], caret: null, headers: null },
                peers: [],
                capabilities: EMPTY_SELECTION_CAPABILITIES,
                properties: null,
                localChanged: false,
            },
            true,
        );
    }

    /** This frame's pages, indexed for projection. */
    #pageMap(): Map<number, PageView> {
        const byPage = new Map<number, PageView>();
        for (const view of this.#lastFrame.views) byPage.set(view.index, view);
        return byPage;
    }

    /** The page→viewport affine for `view` this frame (CSS px) — see
     *  {@link pageViewportAffine}. */
    #viewportOf(view: PageView): Affine {
        return pageViewportAffine(view, this.#lastFrame.scale);
    }

    /** Compose a `local → page` transform with the page→viewport projection. */
    #localToViewport(m: Affine, view: PageView): Affine {
        return multiply(this.#viewportOf(view), m);
    }

    /**
     * The local caret's viewport anchor this frame (CSS px): its top point and
     * on-screen height, or null when no caret is drawn (no text selection, or
     * its page isn't on-screen). The hidden text input parks here so the IME's
     * candidate window opens beside the text being composed.
     */
    caretViewportRect(): { x: number; y: number; height: number } | null {
        const caret = this.#state.local.caret;
        if (!caret) return null;
        const view = this.#pageMap().get(caret.page);
        if (!view) return null;
        const place = itemPlacement(caret);
        const m = this.#localToViewport(place.transform, view);
        const top = applyPoint(m, place.x, place.y);
        const bottom = applyPoint(m, place.x, place.y + place.height);
        return {
            x: top.x,
            y: top.y,
            height: Math.hypot(bottom.x - top.x, bottom.y - top.y),
        };
    }

    /**
     * The page→viewport affine (CSS px) for `page` this frame — page-local
     * document space → its on-screen box, carrying the view rotation + scale —
     * or null when that page isn't on-screen. A drag delta lives in viewport
     * px; inverting this maps it back to page-local points along the page's own
     * axes, so move / resize stay faithful when the page is displayed rotated.
     */
    pageToViewport(page: number): Affine | null {
        const view = this.#pageMap().get(page);
        return view ? this.#viewportOf(view) : null;
    }
}

/**
 * The page→viewport affine for `view` at `scale` CSS px per document point:
 * page-local content space (unrotated, top-left origin) → the page's on-screen
 * box, carrying its quarter-turn rotation. The streamed rect is axis-aligned,
 * so a rotated page turns the page-local axes into the box rather than mapping
 * the local origin straight to its top-left. Shared by every layer that draws
 * page-local geometry — the selection's boxes, a search's highlights.
 */
export function pageViewportAffine(view: PageView, scale: number): Affine {
    const s = scale;
    const { x, y, width: w, height: h } = view;
    switch (view.rotation) {
        case 1: // 90° clockwise: local top edge → display right edge
            return [0, s, -s, 0, x + w, y];
        case 2: // 180°
            return [-s, 0, 0, -s, x + w, y + h];
        case 3: // 270° clockwise: local top edge → display left edge
            return [0, -s, s, 0, x, y + h];
        default: // upright
            return [s, 0, 0, s, x, y];
    }
}

/** Flatten a wire {@link SelectionBox} to a local-space placement — the single
 *  point that unpacks its `rect` (to `x`/`y`/`width`/`height`) and its
 *  `transform` (named components) to the toolkit's {@link Affine} array. Every
 *  box the layer draws or hit-tests goes through here. */
function itemPlacement(it: SelectionBox): SelectionPlacement {
    return {
        page: it.page,
        x: it.rect.x0,
        y: it.rect.y0,
        width: it.rect.x1 - it.rect.x0,
        height: it.rect.y1 - it.rect.y0,
        transform: fromComponents(it.transform),
    };
}

/** A drawn/pooled box spec from a wire {@link SelectionBox}: its flattened
 *  placement plus the presentation role, peer color seed, and name flag. */
function boxSpec(b: SelectionBox, role: BoxRole, peer: string | null, name: string | null): BoxSpec {
    return { ...itemPlacement(b), role, peer, name, padding: 0, points: null };
}

/** A drawn/pooled text-highlight spec from a wire {@link SelectionQuad}: its
 *  corners on the page, placed under no transform of their own, and anchored
 *  — for a peer's name flag — at its top-left corner. */
function quadSpec(q: SelectionQuad, peer: string | null, name: string | null): BoxSpec {
    const [topLeft] = q.points;
    return {
        page: q.page,
        x: topLeft.x,
        y: topLeft.y,
        width: 0,
        height: 0,
        transform: IDENTITY,
        role: "text",
        peer,
        name,
        padding: 0,
        points: q.points,
    };
}

/** A page-local rotation delta by `angle` about page point (`cx`, `cy`). */
function rotateDelta(angle: number, cx: number, cy: number): Affine {
    return multiply(multiply(translate(cx, cy), rotate(angle)), translate(-cx, -cy));
}

/** The CSS class for a selection polygon by its role: an object box (stroked,
 *  handled for the local user), a grid cell block (filled + bordered, no
 *  handles), or a text highlight (filled). `--peer` is the host's restyle hook
 *  for a collaborator's box; the peer's color is applied inline (see `render`),
 *  so the class only picks the fill/stroke shape. */
function boxClass(spec: BoxSpec): string {
    switch (spec.role) {
        case "text":
            return "udoc-ui__selection-text";
        case "cell":
            return spec.peer ? "udoc-ui__selection-cell udoc-ui__selection-cell--peer" : "udoc-ui__selection-cell";
        default:
            return spec.peer ? "udoc-ui__selection-box udoc-ui__selection-box--peer" : "udoc-ui__selection-box";
    }
}

/**
 * The boxes for one peer's selection, faithful to what they picked:
 *
 * - a **text** selection → the box of the object they're editing (when the range
 *   sits inside one, so you see which shape they're in) and its highlight quads —
 *   the blinking caret itself is an HTML line, not a spec (see
 *   {@link SelectionLayer.render}'s caret pass);
 * - a **single** object → that object's own box (its faithful parallelogram,
 *   rotation and skew and all);
 * - **multiple** objects → one axis-aligned covering box per page (their overall
 *   bbox), not the per-object edit chrome.
 *
 * At most one spec carries the peer's `name` — the caret pass flags the peer's
 * cursor instead when a caret is present — so the peer is flagged once.
 */
function peerBoxes(peer: PeerSelectionGeometry): BoxSpec[] {
    const { cells, text, caret } = peer.selection;
    // An annotation's rect is drawn as an object's box is.
    const objects = [...peer.selection.objects, ...peer.selection.annotations];
    const { id, name } = peer.peer;
    // A text selection: draw the enclosing object box (edit-mode ObjectText
    // carries it) and the range quads. With a caret the name flag rides it
    // (the caret pass places both); a caret-less range tags its start.
    if (text.length > 0 || caret) {
        const specs: BoxSpec[] = objects.map((b) => boxSpec(b, "object", id, null));
        const textStart = specs.length;
        for (const q of text) specs.push(quadSpec(q, id, null));
        if (!caret) {
            if (specs[textStart]) {
                specs[textStart].name = name ?? null;
            } else if (specs[0]) {
                specs[0].name = name ?? null;
            }
        }
        return specs;
    }
    // A grid cell selection: draw each contiguous block as a filled + bordered
    // box (never object handles); the first wears the peer's name flag.
    if (cells.length > 0) {
        return cells.map((b, i) => boxSpec(b, "cell", id, i === 0 ? (name ?? null) : null));
    }
    // A single object: draw its own box faithfully.
    if (objects.length === 1) {
        return [boxSpec(objects[0]!, "object", id, name ?? null)];
    }
    // Multiple objects: collapse to one covering box per page.
    return coveringBoxes(peer, objects);
}

/**
 * Collapse a peer's multi-object selection into one axis-aligned covering box
 * per page: each object's corners are pushed through its own `local → page`
 * affine (folding in rotation / skew) and the page-local bounds of every corner
 * become a single box. The spec carries the identity transform — its bounds are
 * already page-local, so it projects like an upright object and rides the page's
 * view rotation. A selection spanning pages yields one box per page; only the
 * first is name-flagged.
 */
function coveringBoxes(peer: PeerSelectionGeometry, objects: readonly SelectionBox[]): BoxSpec[] {
    const byPage = new Map<number, { minX: number; minY: number; maxX: number; maxY: number }>();
    for (const item of objects) {
        const place = itemPlacement(item);
        const m = place.transform;
        let box = byPage.get(item.page);
        for (const [lx, ly] of cornersOf(place)) {
            const p = applyPoint(m, lx, ly);
            if (!box) {
                box = { minX: p.x, minY: p.y, maxX: p.x, maxY: p.y };
                byPage.set(item.page, box);
            } else {
                box.minX = Math.min(box.minX, p.x);
                box.minY = Math.min(box.minY, p.y);
                box.maxX = Math.max(box.maxX, p.x);
                box.maxY = Math.max(box.maxY, p.y);
            }
        }
    }
    const specs: BoxSpec[] = [];
    for (const [page, b] of byPage) {
        specs.push({
            page,
            x: b.minX,
            y: b.minY,
            width: b.maxX - b.minX,
            height: b.maxY - b.minY,
            role: "object",
            transform: [1, 0, 0, 1, 0, 0],
            peer: peer.peer.id,
            // Only the first covering box wears the name, so a cross-page peer
            // reads as one named cursor, not one flag per page.
            name: specs.length === 0 ? (peer.peer.name ?? null) : null,
            padding: 0,
            points: null,
        });
    }
    return specs;
}

/** The four local-space corners (nw, ne, se, sw) of a box's bounds. */
function cornersOf(b: { x: number; y: number; width: number; height: number }): Array<[number, number]> {
    return [
        [b.x, b.y],
        [b.x + b.width, b.y],
        [b.x + b.width, b.y + b.height],
        [b.x, b.y + b.height],
    ];
}

type ClipPt = { x: number; y: number };

/**
 * Clip a convex polygon (viewport-px corners) to an axis-aligned rect by
 * Sutherland–Hodgman — the clipped corners, empty when fully outside, unchanged
 * when fully inside. Bounds a selection box's projected corners to a padded
 * viewport before it becomes an SVG polygon: a whole-column / whole-sheet cell
 * block runs to the grid's last row (~1M rows), so its unclipped polygon is tens
 * of millions of px tall — big enough that the browser renders the dashed stroke
 * solid and misfills it. The padding ({@link BOX_CLIP_PAD}) sits off the visible
 * canvas, so the cut edges hide under the SVG viewport clip rather than drawing a
 * border along the screen edge.
 */
function clipToRect(pts: ClipPt[], minX: number, minY: number, maxX: number, maxY: number): ClipPt[] {
    let poly = clipHalf(pts, "x", minX, true);
    poly = clipHalf(poly, "x", maxX, false);
    poly = clipHalf(poly, "y", minY, true);
    poly = clipHalf(poly, "y", maxY, false);
    return poly;
}

/**
 * One Sutherland–Hodgman pass against the axis-aligned line `axis = bound`: keep
 * the vertices on the wanted side (`atLeast` → `axis >= bound`, else `<=`),
 * emitting the crossing point wherever an edge enters or leaves it. The
 * interpolation runs only on a straddling edge, whose endpoints differ on `axis`,
 * so it never divides by zero.
 */
function clipHalf(poly: ClipPt[], axis: "x" | "y", bound: number, atLeast: boolean): ClipPt[] {
    if (poly.length === 0) return poly;
    const out: ClipPt[] = [];
    for (let i = 0; i < poly.length; i++) {
        const cur = poly[i]!;
        const prev = poly[(i + poly.length - 1) % poly.length]!;
        const curIn = atLeast ? cur[axis] >= bound : cur[axis] <= bound;
        const prevIn = atLeast ? prev[axis] >= bound : prev[axis] <= bound;
        if (curIn !== prevIn) {
            const t = (bound - prev[axis]) / (cur[axis] - prev[axis]);
            out.push({ x: prev.x + t * (cur.x - prev.x), y: prev.y + t * (cur.y - prev.y) });
        }
        if (curIn) out.push(cur);
    }
    return out;
}
