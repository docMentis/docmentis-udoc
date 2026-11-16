// A template's places, drawn over its slides from the engine's read of where
// each shows (`bindingMarkup`): a tint behind a place within a paragraph, a bar
// beside one around whole paragraphs, and around the place the caret is in an
// outline, with a tab naming its kind and binding that opens the place's
// popover; the places of the Data panel's name the pointer is over stand out
// too. None of it is the document's — it is drawn over the canvas, under
// the selection, and takes no press but the tab's — and an instance shows none
// until asked, so it reads as an ordinary document.
import { subscribeSelector } from "@docmentis/udoc-ui/internal";
import type { OverlayFrame, OverlayItem, OverlaySource, PageView } from "@docmentis/udoc-ui";
import type { Binding, BindingMarkup, Point, SelectionGeometry, SelectionQuad } from "@docmentis/udoc-wasm";
import type { EditHost } from "./edit-client.js";
import type { I18n, MessageKey } from "./i18n/index.js";
import { editState } from "./state.js";

const OVERLAY_ID = "udoc:places";
const SVG_NS = "http://www.w3.org/2000/svg";

/** How far left of a block place's content its bar stands, CSS px. */
const BAR_GAP = 6;

/** How far a point may lie outside a quad and still be in it, points — so a
 *  caret at a place's edge is in it. */
const SLACK = 0.5;

/** The place the caret is in, as the overlay outlines it. */
export interface CurrentPlace {
    readonly markup: BindingMarkup;
    readonly page: number;
}

export interface Places {
    /** The place outlined: the one the caret is in, innermost, unless another
     *  around the caret is shown; or null. */
    current(): CurrentPlace | null;
    /** Every place the caret is in, outermost first. */
    atCaret(): CurrentPlace[];
    /** Outline `place`, one the caret is in, until the caret moves. */
    show(place: CurrentPlace): void;
    /** The outlined place's tab, as drawn, or null. */
    tab(): HTMLElement | null;
    /** The first place `pick` finds among those the caret is in, outermost
     *  first, once a read holds it — or null after `frames` frames. */
    find(pick: (places: CurrentPlace[]) => CurrentPlace | undefined, frames?: number): Promise<CurrentPlace | null>;
    destroy(): void;
}

/** What the overlay shows places for: an open deck that is a template, being
 *  edited, not previewed; or an instance whose places are asked to show. */
function placesShown(host: EditHost): boolean {
    const state = host.store.getState();
    if (state.status !== "ready" || state.docType !== "presentation") return false;
    const edit = editState(state);
    if (edit.automationPreview) return false;
    const role = state.automation?.role;
    if (role === undefined) return false;
    return "template" in role || edit.showPlaces;
}

/** The kind a binding's tab names, and what follows it: its path, a repeat's
 *  item over its path, an option's values. */
export function placeLabel(binding: Binding, i18n: I18n): string {
    const [kind, detail] = placeParts(binding);
    const name = i18n.t(kind);
    return detail === "" ? name : `${name} · ${detail}`;
}

function placeParts(binding: Binding): [MessageKey, string] {
    if (binding === "otherwise") return ["place.otherwise", ""];
    if ("variable" in binding) return ["place.variable", binding.variable.path];
    if ("repeat" in binding) return ["place.repeat", `${binding.repeat.item} ∈ ${binding.repeat.path}`];
    if ("condition" in binding) {
        const { not, path } = binding.condition;
        return ["place.condition", not ? `¬ ${path}` : path];
    }
    if ("choice" in binding) return ["place.choice", binding.choice.path];
    return ["place.when", binding.when.values.map((value) => `"${value}"`).join(", ")];
}

/** Draw the open deck's places, and keep the place the caret is in, while
 *  edit mode is mounted. `open` opens the popover of the place whose tab is
 *  pressed. */
export function mountPlaces(host: EditHost, i18n: I18n, open: (place: CurrentPlace, tab: DOMRect) => void): Places {
    const { client, store } = host;
    // What was read for each page, by `plane:page`, and which read is current.
    let read = new Map<string, readonly BindingMarkup[]>();
    let generation = 0;
    let views: readonly PageView[] = [];
    let selection: SelectionGeometry | null = null;
    let current: CurrentPlace | null = null;
    // A place `show` outlined, and where the caret stood then.
    let shown: { id: string; at: string } | null = null;
    let tabElement: HTMLElement | null = null;

    const markupOf = (page: number): readonly BindingMarkup[] =>
        read.get(`${store.getState().currentPlane}:${page}`) ?? [];

    const source: OverlaySource = (frame) => (placesShown(host) ? items(frame) : []);

    function draw(): void {
        host.setOverlay(OVERLAY_ID, source);
    }

    function ask(): void {
        if (!placesShown(host)) return;
        const plane = store.getState().currentPlane;
        for (const { index } of views) {
            const key = `${plane}:${index}`;
            if (read.has(key)) continue;
            read.set(key, []);
            const asked = generation;
            void client.bindingMarkup(plane, index).then((markup) => {
                if (asked !== generation) return;
                read.set(key, markup);
                findCurrent();
                draw();
            });
        }
    }

    // A change can move every place: the pages shown are read again, keeping
    // what they showed until the new land.
    function readAgain(): void {
        const shown = read;
        generation += 1;
        read = new Map();
        ask();
        for (const [key, markup] of shown) if (read.get(key)?.length === 0) read.set(key, markup);
    }

    function atCaret(): CurrentPlace[] {
        const at = caretPoint(selection);
        if (!at || !placesShown(host)) return [];
        // The catalog's order is outermost first, so the places are too.
        return markupOf(at.page)
            .filter((markup) => markup.quads.some((quad) => quad.page === at.page && holds(quad, at.point)))
            .map((markup) => ({ markup, page: at.page }));
    }

    function findCurrent(): void {
        const places = atCaret();
        const at = caretKey(selection);
        if (shown && shown.at !== at) shown = null;
        current = (shown && places.find((place) => place.markup.id === shown?.id)) ?? places.at(-1) ?? null;
    }

    function items(frame: OverlayFrame): OverlayItem[] {
        const fills: { points: string; current: boolean }[] = [];
        const bars: { x: number; y1: number; y2: number; current: boolean }[] = [];
        let tab: { x: number; y: number; place: CurrentPlace } | null = null;
        // The places of the Data panel's name the pointer is over stand out as
        // the caret's does.
        const state = store.getState();
        const hovered = new Set(state.activePanel === "data" ? state.dataHover : []);
        for (const view of frame.views) {
            const at = (p: Point) => ({ x: view.x + p.x * frame.scale, y: view.y + p.y * frame.scale });
            for (const markup of markupOf(view.index)) {
                const quads = markup.quads.filter((quad) => quad.page === view.index);
                if (quads.length === 0) continue;
                const isOutlined = current?.markup.id === markup.id && current.page === view.index;
                const isCurrent = isOutlined || hovered.has(markup.id);
                if (markup.level === "block") {
                    const corners = quads.flatMap((quad) => quad.points.map(at));
                    bars.push({
                        x: Math.min(...corners.map((p) => p.x)) - BAR_GAP,
                        y1: Math.min(...corners.map((p) => p.y)),
                        y2: Math.max(...corners.map((p) => p.y)),
                        current: isCurrent,
                    });
                }
                if (markup.level === "span" || isCurrent) {
                    for (const quad of quads) {
                        fills.push({
                            points: quad.points
                                .map(at)
                                .map((p) => `${p.x},${p.y}`)
                                .join(" "),
                            current: isCurrent,
                        });
                    }
                }
                if (isOutlined && current) {
                    const [topLeft] = quads[0]!.points;
                    tab = { ...at(topLeft), place: current };
                }
            }
        }
        const out: OverlayItem[] = [];
        if (fills.length > 0 || bars.length > 0) {
            out.push({
                key: "places",
                x: 0,
                y: 0,
                create: () => {
                    const el = document.createElement("div");
                    el.className = "udoc-places";
                    el.setAttribute("aria-hidden", "true");
                    const svg = document.createElementNS(SVG_NS, "svg");
                    svg.append(document.createElementNS(SVG_NS, "g"), document.createElementNS(SVG_NS, "g"));
                    el.appendChild(svg);
                    return el;
                },
                update: (el) => {
                    const [polygons, lines] = (el.firstElementChild as SVGSVGElement).children;
                    pooled(polygons!, "polygon", fills.length).forEach((polygon, index) => {
                        const fill = fills[index]!;
                        polygon.setAttribute("points", fill.points);
                        polygon.setAttribute("class", classOf("udoc-place", fill.current));
                    });
                    pooled(lines!, "line", bars.length).forEach((line, index) => {
                        const bar = bars[index]!;
                        line.setAttribute("x1", `${bar.x}`);
                        line.setAttribute("x2", `${bar.x}`);
                        line.setAttribute("y1", `${bar.y1}`);
                        line.setAttribute("y2", `${bar.y2}`);
                        line.setAttribute("class", classOf("udoc-place-bar", bar.current));
                    });
                },
            });
        }
        if (tab) {
            const { place } = tab;
            const label = placeLabel(place.markup.binding, i18n);
            out.push({
                key: "tab",
                x: tab.x,
                y: tab.y,
                create: () => {
                    const button = document.createElement("button");
                    button.type = "button";
                    button.className = "udoc-place-tab";
                    tabElement = button;
                    // Down on the tab is no press on the text under it.
                    button.addEventListener("pointerdown", (e) => e.stopPropagation());
                    // The press that opens the popover is no press outside it.
                    button.addEventListener("click", (e) => {
                        e.stopPropagation();
                        if (current) open(current, button.getBoundingClientRect());
                    });
                    return button;
                },
                update: (el) => {
                    el.textContent = label;
                    el.title = label;
                },
            });
        }
        return out;
    }

    const unsubs = [
        client.onPageViews((frame) => {
            views = frame.views;
            ask();
        }),
        client.onSelection((state) => {
            selection = state.local;
            const before = current?.markup.id;
            findCurrent();
            if (current?.markup.id !== before) draw();
        }),
        client.onDocumentChanged(readAgain),
        client.onFontsRefreshed(readAgain),
        subscribeSelector(
            store,
            (s) => s.docGeneration,
            () => {
                generation += 1;
                read = new Map();
                current = null;
            },
        ),
        // The Data panel's name the pointer is over, or the panel shown or not.
        subscribeSelector(store, (s) => (s.activePanel === "data" ? s.dataHover : []), draw),
        // Shown or hidden as the deck becomes a template, is previewed, or an
        // instance's places are asked for.
        subscribeSelector(
            store,
            () => placesShown(host),
            () => {
                ask();
                findCurrent();
                draw();
            },
        ),
    ];
    draw();

    return {
        current: () => current,
        atCaret,
        show(place) {
            shown = { id: place.markup.id, at: caretKey(selection) };
            findCurrent();
            draw();
        },
        tab: () => (tabElement?.isConnected ? tabElement : null),
        async find(pick, frames = 60) {
            for (let frame = 0; frame < frames; frame++) {
                const found = pick(atCaret());
                if (found) return found;
                await new Promise((resolve) => requestAnimationFrame(resolve));
            }
            return null;
        },
        destroy() {
            for (const unsub of unsubs) unsub();
            host.removeOverlay(OVERLAY_ID);
        },
    };
}

/** Where the selection's caret stands — its focus for a range — as a page and
 *  a page-local point. */
function caretPoint(selection: SelectionGeometry | null): { page: number; point: Point } | null {
    const box = selection?.caret ?? selection?.focus ?? null;
    if (box) {
        const { rect, transform: t } = box;
        const x = (rect.x0 + rect.x1) / 2;
        const y = (rect.y0 + rect.y1) / 2;
        return {
            page: box.page,
            point: {
                x: t.scaleX * x + t.skewX * y + t.translateX,
                y: t.skewY * x + t.scaleY * y + t.translateY,
            },
        };
    }
    const quad = selection?.text[0];
    if (!quad) return null;
    const [a, , c] = quad.points;
    return { page: quad.page, point: { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 } };
}

/** Where the selection's caret stands, as a key that changes when it moves. */
function caretKey(selection: SelectionGeometry | null): string {
    const at = caretPoint(selection);
    return at ? `${at.page}:${at.point.x.toFixed(2)}:${at.point.y.toFixed(2)}` : "";
}

/** Whether `point` lies in `quad`, convex, its corners in order — within
 *  {@link SLACK}. */
function holds(quad: SelectionQuad, point: Point): boolean {
    const corners = quad.points;
    let sign = 0;
    for (let i = 0; i < corners.length; i++) {
        const a = corners[i]!;
        const b = corners[(i + 1) % corners.length]!;
        const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const side = ((b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x)) / length;
        if (Math.abs(side) <= SLACK) continue;
        const s = Math.sign(side);
        if (sign === 0) sign = s;
        else if (s !== sign) return false;
    }
    return true;
}

/** `group`'s first `count` children, made `tag`s as needed, the rest gone. */
function pooled<K extends "polygon" | "line">(group: Element, tag: K, count: number): SVGElementTagNameMap[K][] {
    while (group.childElementCount > count) group.lastElementChild!.remove();
    while (group.childElementCount < count) group.appendChild(document.createElementNS(SVG_NS, tag));
    return [...group.children] as SVGElementTagNameMap[K][];
}

/** `base`, and its current modifier for the place the caret is in. */
function classOf(base: string, current: boolean): string {
    return current ? `${base} ${base}--current` : base;
}
