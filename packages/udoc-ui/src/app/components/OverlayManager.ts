// The HTML overlay layer: DOM chrome positioned over the Rust-painted canvas.
//
// The viewport (pages, scroll, zoom) is owned by Rust in the worker, which
// paints into a single OffscreenCanvas — the main thread can't read where a
// page landed. So after every painted frame the worker streams the on-screen
// pages already projected to viewport (CSS px) space (see {@link PageView} and
// `WorkerClient.onPageViews`). This manager turns that per-frame stream into
// absolutely-positioned DOM: anything anchored to a page (a corner button, an
// inter-page divider) rides along as the document scrolls and zooms.
//
// It is a *registry*: multiple overlays — the built-ins (registered under
// `udoc:`-prefixed ids, e.g. the annotation bar) and any the host adds — render
// at once, each under its own id. The built-in overlays go through
// this same public surface, so a host can remove or replace them
// (`removeOverlay("udoc:page-actions")`) exactly like its own.
//
// The overlay container is `pointer-events: none` so it never eats wheel/scroll
// aimed at the canvas; an individual overlay opts back in with
// `pointer-events: auto` on its elements.

import type { PageView, Rect } from "../../geometry.js";
import { applyContentClip } from "./overlayClip.js";

/**
 * One painted frame, as the overlay layer sees it: the on-screen pages in
 * viewport (CSS px) space, plus the frame's scale (CSS px per document point —
 * the zoom). A source uses `scale` to project page-local coordinates, or to
 * scale an item with the content via {@link OverlayItem.scale}; chrome meant
 * to stay constant on screen simply ignores it.
 */
export interface OverlayFrame {
    views: PageView[];
    /** CSS px per document point for this frame. */
    scale: number;
    /** The branding decal's rect (CSS px, bottom-right), punched out of the clip
     *  so no overlay paints over the logo; `null` before the engine reports it. */
    branding: Rect | null;
}

/**
 * One piece of overlay chrome for a single frame. The manager pools the DOM
 * element by {@link key} across frames, so a stable key (e.g. `"pill:3"`)
 * means "the same element, moved" rather than a teardown + rebuild.
 */
export interface OverlayItem {
    /** Stable identity across frames (within the owning overlay id). */
    key: string;
    /** Viewport (CSS px) point the element's wrapper is translated to. */
    x: number;
    y: number;
    /**
     * Scale folded into the wrapper transform (`translate(x, y) scale(s)`),
     * for chrome that should scale with the content. Omit (or `1`) for
     * constant-size screen chrome.
     */
    scale?: number;
    /** Build the element the first time this key appears. */
    create: () => HTMLElement;
    /** Per-frame refresh (text, size on zoom, handlers) of the pooled element. */
    update?: (el: HTMLElement) => void;
}

/**
 * Maps one frame to the overlay items to show. Pure and stateless — it runs
 * every painted frame, so derive everything from the frame.
 */
export type OverlaySource = (frame: OverlayFrame) => OverlayItem[];

/** Which layer `setOverlay` puts an overlay in. */
export interface OverlayOptions {
    /**
     * Paint above the selection's boxes and handles — chrome that belongs over
     * the selected object, as a bar or a popup beside it does — rather than
     * under them with the page chrome. Default `false`.
     */
    aboveSelection?: boolean;
}

/**
 * Separates the overlay id from the item key in pooled-element keys. NUL
 * can't appear in an id, so one overlay's keys never prefix-collide
 * another's.
 */
const KEY_SEP = "\u0000";

/**
 * Reconciles the registered {@link OverlaySource}s against a container element
 * each painted frame: creates newly-appeared items, repositions and refreshes
 * the rest, and removes items whose key vanished (a page scrolled off).
 * Sources render in registration order, which is also their stacking order
 * (later sources paint above earlier ones). Positioning is a single transform
 * per item — the cheap path the browser can keep on the compositor.
 */
export class OverlayManager {
    readonly #container: HTMLElement;
    readonly #sources = new Map<string, OverlaySource>();
    readonly #wrappers = new Map<string, HTMLElement>();
    #lastFrame: OverlayFrame = { views: [], scale: 1, branding: null };
    /** The content-clip key last applied to the container, so an unchanged clip
     *  doesn't restyle it (or trigger its layout read) every frame. */
    #lastClipKey = "";

    constructor(container: HTMLElement) {
        this.#container = container;
    }

    /**
     * Register (or replace) the overlay under `id`. Re-renders immediately
     * against the last frame's pages, so an overlay set after the document is
     * already on screen shows up without waiting for the next paint. Ids
     * prefixed `udoc:` are the built-ins — replace or
     * {@link remove} them to take over a built-in overlay.
     */
    set(id: string, source: OverlaySource): void {
        this.#sources.set(id, source);
        this.render(this.#lastFrame);
    }

    /** Remove the overlay under `id` (and its elements). False if unknown. */
    remove(id: string): boolean {
        if (!this.#sources.delete(id)) return false;
        const prefix = id + KEY_SEP;
        for (const [key, wrapper] of this.#wrappers) {
            if (key.startsWith(prefix)) {
                wrapper.remove();
                this.#wrappers.delete(key);
            }
        }
        return true;
    }

    /** Reconcile the overlay DOM against one painted frame. */
    render(frame: OverlayFrame): void {
        this.#lastFrame = frame;

        // Clip the whole layer — every built-in AND host-registered overlay lives
        // in this one container — with the branding decal punched out, through the
        // shared definition every overlay host uses. So a page-anchored control (a
        // pill, an insert strip, a host's own chrome) scrolled over the logo is cut
        // at its edge instead of painting on top of it.
        this.#lastClipKey = applyContentClip(this.#container, { branding: frame.branding }, this.#lastClipKey);

        // Wrappers are composited layers (will-change: transform), so a
        // fractional translate shifts the rasterized layer by a subpixel on
        // the GPU and blurs its text and icons. The projected page geometry
        // is fractional; snap every translate to the device-pixel grid.
        const dpr = globalThis.devicePixelRatio || 1;
        const snap = (v: number): number => Math.round(v * dpr) / dpr;

        // Every item this frame, in stacking order: the sources in registration
        // order, each one's items in its own.
        const items: Array<{ key: string; item: OverlayItem }> = [];
        for (const [id, source] of this.#sources) {
            for (const item of source(frame)) items.push({ key: id + KEY_SEP + item.key, item });
        }
        const live = new Set(items.map(({ key }) => key));
        for (const [key, wrapper] of this.#wrappers) {
            if (!live.has(key)) {
                wrapper.remove();
                this.#wrappers.delete(key);
            }
        }

        // A new item's wrapper goes in before the next item's, so the layer
        // stacks in that order however late an item appears — a popup opened
        // after a toolbar still paints under the toolbar's menu. One already in
        // place stays there: moving it would take the focus from a field in it.
        let next: HTMLElement | null = null;
        for (let i = items.length - 1; i >= 0; i--) {
            const { key, item } = items[i]!;
            let wrapper = this.#wrappers.get(key);
            if (!wrapper) {
                wrapper = document.createElement("div");
                wrapper.className = "udoc-ui__overlay-item";
                wrapper.appendChild(item.create());
                this.#container.insertBefore(wrapper, next);
                this.#wrappers.set(key, wrapper);
            }
            next = wrapper;
        }

        for (const { key, item } of items) {
            const wrapper = this.#wrappers.get(key)!;
            item.update?.(wrapper.firstElementChild as HTMLElement);
            const scale = item.scale ?? 1;
            wrapper.style.transform =
                scale === 1
                    ? `translate(${snap(item.x)}px, ${snap(item.y)}px)`
                    : `translate(${snap(item.x)}px, ${snap(item.y)}px) scale(${scale})`;
        }
    }

    /** Remove every overlay element and registration (document close/teardown). */
    clear(): void {
        for (const [, wrapper] of this.#wrappers) wrapper.remove();
        this.#wrappers.clear();
        this.#sources.clear();
    }
}
