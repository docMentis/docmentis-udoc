// Edit mode's grips on the selection: a rotation grip above each selected box,
// and the geometry grips (yellow diamonds) a lone shape offers — a rounded
// rectangle's corner, an arrow's head. udoc-ui's selection layer draws them
// beside its resize handles (`SelectionChrome`), and the canvas hands a press on
// one to the gesture this runs (`UIExtension.pressCanvas`).
import { allowsEdit, applyPoint, DRAG_THRESHOLD, fromComponents, invert } from "@docmentis/udoc-ui/internal";
import type {
    Affine,
    CanvasGesture,
    CanvasGestureHost,
    ChromeFrame,
    KeepOutRect,
    SelectionChrome,
    SelectionHandle,
    SelectionPlacement,
} from "@docmentis/udoc-ui/internal";
import type { EditTools } from "./tools.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Adjust-handle diamond size (CSS px) — keep in sync with the stylesheet. */
const ADJUST_HANDLE_SIZE = 9;
/** Adjust-handle hit half-extent (CSS px) — a touch larger than the diamond, as
 *  it sits inside the box where a miss reads as a move. */
const ADJUST_HIT = 7;
/** Rotation-handle diameter (CSS px) — keep in sync with the stylesheet. */
const ROTATE_HANDLE_SIZE = 10;
/** Rotation-handle hit radius (CSS px). */
const ROTATE_HIT = 8;
/** Gap (CSS px) from the box's top edge out to the rotation handle's center. */
const ROTATE_GAP = 18;

/** Rotation-snap increment (radians) the Shift modifier locks to — 15°, the
 *  step PowerPoint/Figma/Illustrator use for constrained rotation. */
const ROTATE_SNAP = Math.PI / 12;

/** Cardinal rotation step (radians) the *default* (no-modifier) rotate snaps
 *  to — 0/90/180/270°. Unlike the Shift step this is magnetic, not absolute:
 *  it only pulls when within {@link ROTATE_CARDINAL_TOLERANCE} of a cardinal,
 *  so the object turns freely between them. Alt suppresses it entirely. */
const ROTATE_CARDINAL = Math.PI / 2;

/** Half-width (radians) of the magnetic zone around each cardinal angle —
 *  ~2.75°, matching PowerPoint's barely-there cardinal pull. */
const ROTATE_CARDINAL_TOLERANCE = (2.75 * Math.PI) / 180;

/** What an adjust-handle drag captures at press: which handle of which shape,
 *  and the projection to run backwards while the pointer moves. The shape is
 *  implied — only a single-shape selection offers handles. */
interface AdjustHandleGrab {
    /** The handle's index in the shape's geometry — what the edit names. */
    index: number;
    /** The page the shape sits on. */
    page: number;
    /** Its `local → page` affine, the outward half of the projection. */
    transform: Affine;
}

/** The seed a rotation drag captures when it starts on a rotation grip: the
 *  viewport-px center of the grabbed object's box, about which the pointer
 *  angle is measured. The rotation itself spins **each** selected object about
 *  its own center, so no single page-space pivot is needed. `baseAngle` is the
 *  grabbed box's on-screen orientation (radians) when the drag began, used to
 *  snap its *absolute* angle to fixed steps under the Shift modifier. */
interface RotateSeed {
    pivotX: number;
    pivotY: number;
    baseAngle: number;
}

/**
 * The rotation cursor: a curved arrow (PowerPoint/Figma style), far clearer than
 * the `grab` hand — which reads as "pan". A shallow 135° arc capped by a filled
 * triangle head at each end, drawn dark over a white halo so it stays legible on
 * any page color, in a 32×32 box with the hotspot on the arc's circle center
 * (16, 15). `deg` rotates the glyph about that center so it stays tangent to the
 * box's on-screen pose, like the resize cursors track the box's edges.
 */
const ROTATE_ARC = "M7.69 11.56 A9 9 0 0 1 24.31 11.56";
const ROTATE_HEAD_L = "M5.58 16.64 L4.36 10.18 L11.01 12.93 Z";
const ROTATE_HEAD_R = "M26.42 16.64 L20.99 12.93 L27.64 10.18 Z";

function rotateCursorSvg(deg: number): string {
    // One pass per color: a thicker white pass lays the halo, the dark pass sits
    // on top. The arc is stroked (no fill); the heads are filled triangles whose
    // matching stroke fattens the white pass into the halo outline.
    const layer = (color: string, width: number): string =>
        `<path d="${ROTATE_ARC}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>` +
        `<path d="${ROTATE_HEAD_L}" fill="${color}" stroke="${color}" stroke-width="${width}" stroke-linejoin="round"/>` +
        `<path d="${ROTATE_HEAD_R}" fill="${color}" stroke="${color}" stroke-width="${width}" stroke-linejoin="round"/>`;
    return (
        `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
        `<g transform="rotate(${deg} 16 15)">${layer("#fff", 4.5)}${layer("#111", 2.2)}</g></svg>`
    );
}

/** Cached `cursor` declarations by 15° bucket — a slow drag/hover reuses the
 *  data-URI instead of re-encoding the SVG every pixel. */
const ROTATE_CURSORS = new Map<number, string>();

/** The rotation `cursor` value (a data-URI curved arrow) for an on-screen box
 *  angle in radians, oriented to that pose. `grab` is the fallback. */
function rotateCursorForAngle(angle: number): string {
    const bucket = ((Math.round((angle * 180) / Math.PI / 15) % 24) + 24) % 24;
    let css = ROTATE_CURSORS.get(bucket);
    if (css === undefined) {
        const svg = encodeURIComponent(rotateCursorSvg(bucket * 15));
        css = `url("data:image/svg+xml,${svg}") 16 15, grab`;
        ROTATE_CURSORS.set(bucket, css);
    }
    return css;
}

/**
 * The rotation grip's viewport position for a placement projected by `lv`
 * (local→viewport): out from the box's top-edge midpoint, away from the center,
 * by {@link ROTATE_GAP}. Also returns the projected top-mid (stem near end) and
 * center, so the caller can draw the stem and use the center as the pivot.
 */
function rotateGripPos(
    p: SelectionPlacement,
    lv: Affine,
): { x: number; y: number; top: { x: number; y: number }; center: { x: number; y: number } } {
    const top = applyPoint(lv, p.x + p.width / 2, p.y);
    const center = applyPoint(lv, p.x + p.width / 2, p.y + p.height / 2);
    let dx = top.x - center.x;
    let dy = top.y - center.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    return { x: top.x + dx * ROTATE_GAP, y: top.y + dy * ROTATE_GAP, top, center };
}

/** Whether the selection in `frame` rotates — each box then carries a grip. */
function rotates(frame: ChromeFrame): boolean {
    return allowsEdit(frame.state.capabilities, "rotateEachObject", "rotateEachShape");
}

/** Edit mode's grips: the chrome udoc-ui draws, and the canvas's calls on them. */
export interface Grips {
    readonly chrome: SelectionChrome;
    /** The drag a press at canvas-local `(x, y)` starts on a grip, or null off
     *  every grip. */
    press(x: number, y: number, canvas: CanvasGestureHost): CanvasGesture | null;
    /** The resting cursor over a grip at `(x, y)`, or null off every grip. */
    cursor(x: number, y: number): string | null;
}

/** The grips, editing through `tools` — null until edit mode is mounted. */
export function createGrips(tools: () => EditTools | null): Grips {
    /** Pooled rotation stems (one line per selected box: top edge → grip). */
    const stems: SVGLineElement[] = [];
    /** Pooled rotation grips (one circle per selected box). */
    const rotateGrips: HTMLElement[] = [];
    /** Pooled adjust-handle diamonds — the geometry grips a shape offers. Only a
     *  single-shape selection reports any. */
    const diamonds: HTMLElement[] = [];
    /** The frame last drawn — what a hover or a press hit-tests. */
    let frame: ChromeFrame | null = null;
    /**
     * The grip a live adjust drag is moving, as the engine reports it will land
     * — substituted for the streamed handle of the same index until the
     * committed geometry arrives. Not a transform preview: an adjust drag
     * reshapes the geometry through a guide, which no affine can stand in for,
     * so the box and the other handles hold their last drawn positions while
     * this one moves.
     *
     * A geometry handle can't be previewed by an affine the way a move / resize
     * can: it drives a guide, and where that guide puts it is the geometry's
     * business (a corner radius runs along one edge, a callout's tail swings on
     * an arc, both stop at the ends of their range). So each pointer move asks
     * the engine and this draws the answer, rather than pinning the diamond to
     * the cursor and letting it jump on release.
     */
    let handlePreview: SelectionHandle | null = null;

    /** The adjust handles in `f`, or none when the engine reports no
     *  reshapeable geometry (a multi-shape selection, a doc type with none).
     *  While a drag is in flight the grabbed one is replaced by the engine's
     *  preview of where it has been dragged to. */
    function adjustItems(f: ChromeFrame): SelectionHandle[] {
        if (f.boxes.length === 0) return [];
        const handles = f.state.local.handles ?? [];
        const preview = handlePreview;
        if (!preview) return handles;
        return handles.map((handle) => (handle.index === preview.index ? preview : handle));
    }

    /**
     * The grabbed adjust handle if `(x, y)` (viewport CSS px, canvas-relative)
     * falls on one, else null.
     *
     * Tested **first** — ahead of the rotation grip, the resize handles, and the
     * box. A grip can land on any of them (a rounded rectangle at its maximum
     * radius parks its diamond on the top edge's midpoint, right under the `n`
     * handle), and it is the only one of the four with no second grab point, so
     * anything that outranked it would leave that shape's geometry uneditable.
     * It is drawn last for the same reason, so what the user sees on top is what
     * a press takes.
     */
    function adjustHandleAt(x: number, y: number): AdjustHandleGrab | null {
        if (!frame) return null;
        for (const handle of adjustItems(frame)) {
            const transform = fromComponents(handle.transform);
            const lv = frame.project(handle.page, transform);
            if (!lv) continue;
            const c = applyPoint(lv, handle.point.x, handle.point.y);
            if (Math.abs(x - c.x) <= ADJUST_HIT && Math.abs(y - c.y) <= ADJUST_HIT) {
                return { index: handle.index, page: handle.page, transform };
            }
        }
        return null;
    }

    /**
     * Where `(x, y)` (viewport CSS px) lands in the grabbed shape's **own local
     * space** — the space an `adjustShapeHandle` edit names its target in.
     *
     * The projection the diamond was drawn through, run backwards: the drag is
     * expressed where the geometry is defined, so the engine solves against the
     * shape's own axes and the host never reasons about rotation. Null when the
     * page has scrolled off, or the transform is degenerate (a zero-scale object
     * has no local space to speak of).
     */
    function adjustHandleLocal(grab: AdjustHandleGrab, x: number, y: number): { x: number; y: number } | null {
        const lv = frame?.project(grab.page, grab.transform);
        const back = lv ? invert(lv) : null;
        return back ? applyPoint(back, x, y) : null;
    }

    /**
     * The rotation seed if `(x, y)` falls on any selected box's rotation grip,
     * else null. Every selected box shows a grip when the selection rotates
     * (each about its own center); the seed carries the grabbed box's viewport
     * center, about which the drag angle is measured.
     */
    function rotateHitTest(x: number, y: number): RotateSeed | null {
        if (!frame || !rotates(frame)) return null;
        for (const { place, onScreen: lv } of frame.boxes) {
            const grip = rotateGripPos(place, lv);
            if (Math.hypot(x - grip.x, y - grip.y) <= ROTATE_HIT) {
                // On-screen orientation = angle of the local +x axis under the
                // local→viewport transform (carries the object + page rotation).
                return { pivotX: grip.center.x, pivotY: grip.center.y, baseAngle: Math.atan2(lv[1], lv[0]) };
            }
        }
        return null;
    }

    /** A pooled element at slot `i` of `pool`, made by `make` on first use. */
    function pooled<T extends Element>(pool: T[], i: number, parent: Element, make: () => T): T {
        let el = pool[i];
        if (!el) {
            el = make();
            parent.appendChild(el);
            pool.push(el);
        }
        return el;
    }

    /** Drop the pooled chrome past `rot` grips + stems / `adjust` diamonds. */
    function trim(rot: number, adjust: number): void {
        while (rotateGrips.length > rot) rotateGrips.pop()!.remove();
        while (stems.length > rot) stems.pop()!.remove();
        while (diamonds.length > adjust) diamonds.pop()!.remove();
    }

    const chrome: SelectionChrome = {
        hitPad: ROTATE_HIT,
        render(f, group, svg) {
            frame = f;
            // Each box's rotation stem (behind the resize handles) + grip,
            // riding the box's (preview-applied) transform.
            let usedRot = 0;
            if (rotates(f)) {
                const rHalf = ROTATE_HANDLE_SIZE / 2;
                for (const { place, onScreen } of f.boxes) {
                    const grip = rotateGripPos(place, onScreen);
                    const stem = pooled(stems, usedRot, svg, () => {
                        const line = document.createElementNS(SVG_NS, "line");
                        line.setAttribute("class", "udoc-ui__rotate-stem");
                        return line;
                    });
                    stem.setAttribute("x1", `${grip.top.x}`);
                    stem.setAttribute("y1", `${grip.top.y}`);
                    stem.setAttribute("x2", `${grip.x}`);
                    stem.setAttribute("y2", `${grip.y}`);
                    const rot = pooled(rotateGrips, usedRot, group, () => {
                        const el = document.createElement("div");
                        el.className = "udoc-ui__rotate-handle";
                        return el;
                    });
                    rot.style.transform = `translate(${grip.x - rHalf}px, ${grip.y - rHalf}px)`;
                    usedRot++;
                }
            }
            // The geometry grips, drawn after the box chrome so they sit above
            // it — matching the hit order, which tests them first (see
            // `adjustHandleAt`), so an overlapping grip both looks and acts like
            // the top control. They ride their own `local → page` transform,
            // not the box's, and carry no rotation of their own — a diamond
            // reads the same at any angle.
            let usedAdjust = 0;
            const aHalf = ADJUST_HANDLE_SIZE / 2;
            for (const handle of adjustItems(f)) {
                const lv = f.project(handle.page, fromComponents(handle.transform));
                if (!lv) continue;
                const c = applyPoint(lv, handle.point.x, handle.point.y);
                const el = pooled(diamonds, usedAdjust++, group, () => {
                    const diamond = document.createElement("div");
                    diamond.className = "udoc-ui__adjust-handle";
                    return diamond;
                });
                el.style.transform = `translate(${c.x - aHalf}px, ${c.y - aHalf}px) rotate(45deg)`;
            }
            trim(usedRot, usedAdjust);
        },
        reach(f): KeepOutRect | null {
            if (!rotates(f) || f.boxes.length === 0) return null;
            let left = Infinity;
            let top = Infinity;
            let right = -Infinity;
            let bottom = -Infinity;
            for (const { place, onScreen } of f.boxes) {
                const grip = rotateGripPos(place, onScreen);
                left = Math.min(left, grip.x);
                top = Math.min(top, grip.y);
                right = Math.max(right, grip.x);
                bottom = Math.max(bottom, grip.y);
            }
            return { left, top, right, bottom };
        },
        reset() {
            handlePreview = null;
        },
    };

    /** A drag on the rotation grip seeded by `seed`, pressed at `(x, y)`. */
    function rotateGesture(seed: RotateSeed, x: number, y: number, canvas: CanvasGestureHost): CanvasGesture {
        const startAngle = Math.atan2(y - seed.pivotY, x - seed.pivotX);
        let moved = false;
        // The latest pointer, so the Shift / Alt handlers re-snap with no
        // pointer movement.
        let lastX = x;
        let lastY = y;

        /**
         * The rotation delta (radians) the drag implies for the last pointer
         * position: the pointer's angle about the grabbed box's center, less
         * where the drag began. Snapping acts on the grabbed box's *absolute*
         * on-screen angle (its `baseAngle` plus the raw delta), so the grabbed
         * box lands on clean angles and the rest of a selection follow by the
         * same delta:
         *
         * - `alt` — no snap; the raw, free-rotating delta.
         * - `shift` — hard-snap to {@link ROTATE_SNAP} (15°) steps, always.
         * - neither — magnetic-snap to a cardinal ({@link ROTATE_CARDINAL},
         *   0/90/…) only while within {@link ROTATE_CARDINAL_TOLERANCE}, else
         *   rotate freely.
         */
        const delta = (shift: boolean, alt: boolean): number => {
            const raw = Math.atan2(lastY - seed.pivotY, lastX - seed.pivotX) - startAngle;
            if (alt) return raw;
            const abs = seed.baseAngle + raw;
            if (shift) return Math.round(abs / ROTATE_SNAP) * ROTATE_SNAP - seed.baseAngle;
            const cardinal = Math.round(abs / ROTATE_CARDINAL) * ROTATE_CARDINAL;
            return Math.abs(abs - cardinal) <= ROTATE_CARDINAL_TOLERANCE ? cardinal - seed.baseAngle : raw;
        };
        // Re-apply the live rotation preview for the last pointer position and
        // modifier state. Shared by the pointer drag and the Shift/Alt keys.
        const preview = (shift: boolean, alt: boolean): void => {
            if (moved) canvas.preview({ kind: "rotateEach", angle: delta(shift, alt) });
        };
        return {
            move(px, py, ev) {
                lastX = px;
                lastY = py;
                if (!moved) {
                    // Still close to the pivot — too noisy to read an angle.
                    if (Math.hypot(px - seed.pivotX, py - seed.pivotY) < DRAG_THRESHOLD) return;
                    moved = true;
                }
                // Default snaps to cardinals; Shift → 15° steps, Alt → free.
                // Read live (and re-applied by the key handlers) like the lock.
                preview(ev.shiftKey, ev.altKey);
            },
            up(px, py, ev) {
                lastX = px;
                lastY = py;
                if (!moved) {
                    // A bare click on the rotation handle — drop the (no-op) preview.
                    canvas.preview(null);
                    return;
                }
                // Keep the preview until the rotated geometry arrives, so the box
                // settles onto the new angle with no flash. Each object spins
                // about its own center, so this can't ride one shared affine
                // delta — the engine reads the per-object pivots.
                canvas.committing();
                void tools()?.arrange.rotateSelectionEach(delta(ev.shiftKey, ev.altKey));
            },
            cancel() {
                canvas.preview(null);
            },
            modifier(ev) {
                // Shift (15° steps) and Alt (free) both retarget the snap.
                if (ev.key === "Shift" || ev.key === "Alt") preview(ev.shiftKey, ev.altKey);
            },
        };
    }

    /** A drag on the geometry grip `grab`, pressed at `(x, y)`. */
    function adjustGesture(grab: AdjustHandleGrab, x: number, y: number, canvas: CanvasGestureHost): CanvasGesture {
        let moved = false;
        // Whether the drag is still on — a probe answering after release draws
        // nothing.
        let live = true;
        // The drag probe, coalesced latest-wins: one query in flight, the newest
        // pointer chased on completion.
        let probeSeq = 0;
        let probeBusy = false;
        let probeLatest: { x: number; y: number } | null = null;

        /**
         * Probe where the grabbed grip lands for a pointer at canvas-local
         * `(px, py)`, and draw it there.
         *
         * A geometry handle doesn't follow the pointer — it runs along whatever
         * track its guide describes and stops at the ends of its range — so the
         * position has to come from the engine, which is a worker hop.
         * Latest-wins like the canvas's hover probe, so the diamond tracks the
         * drag a frame behind rather than queueing up a hop per move. Stale
         * replies (a newer probe already out, or the drag ended) are dropped, so
         * nothing repaints the grip after release.
         */
        const probe = (px: number, py: number): void => {
            const to = adjustHandleLocal(grab, px, py);
            const edit = tools()?.host.edit;
            if (!to || !edit) return; // the page scrolled off — nothing to project against
            probeLatest = { x: px, y: py };
            if (probeBusy) return;
            probeBusy = true;
            const seq = ++probeSeq;
            void edit.selectionHandlePreview(grab.index, to.x, to.y).then((handle) => {
                probeBusy = false;
                if (seq === probeSeq && live && handlePreview !== handle) {
                    handlePreview = handle;
                    canvas.refreshChrome();
                }
                const next = probeLatest;
                if (next && (next.x !== px || next.y !== py) && live) probe(next.x, next.y);
            });
        };
        // Drop the grip's preview: it returns to where the geometry has it.
        const unpreview = (): void => {
            handlePreview = null;
            canvas.refreshChrome();
        };
        return {
            move(px, py) {
                if (!moved) {
                    if (Math.hypot(px - x, py - y) < DRAG_THRESHOLD) return;
                    moved = true;
                }
                // The grip follows the pointer along its own track — where that
                // is, only the engine can say (the handle drives a guide, not a
                // transform), so ask and draw the answer. The outline itself
                // holds its last drawn geometry until the commit lands.
                probe(px, py);
            },
            up(px, py) {
                live = false;
                if (!moved) {
                    // A bare click on a diamond — drop the (no-op) preview.
                    unpreview();
                    return;
                }
                const to = adjustHandleLocal(grab, px, py);
                const host = tools()?.host;
                if (!to || !host) return;
                // Hold the previewed grip until the reshaped geometry arrives,
                // so it settles onto the new outline instead of snapping back to
                // where the drag started. Selection-relative like the canvas's
                // other drags — the engine resolves which shape and solves the
                // adjust value the drag implies.
                canvas.committing();
                void host.commit(() =>
                    host.client.executeOnSelection({ kind: "adjustShapeHandle", index: grab.index, to }),
                );
            },
            cancel() {
                // Nothing was committed, so the preview has nothing to settle onto.
                live = false;
                unpreview();
            },
        };
    }

    return {
        chrome,
        press(x, y, canvas) {
            const grab = adjustHandleAt(x, y);
            if (grab) return adjustGesture(grab, x, y, canvas);
            const seed = rotateHitTest(x, y);
            return seed ? rotateGesture(seed, x, y, canvas) : null;
        },
        cursor(x, y) {
            if (adjustHandleAt(x, y)) return "crosshair";
            const seed = rotateHitTest(x, y);
            return seed ? rotateCursorForAngle(seed.baseAngle) : null;
        },
    };
}
