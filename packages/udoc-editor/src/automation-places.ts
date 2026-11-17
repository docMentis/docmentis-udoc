// A template's places, drawn over its slides from the engine's read of where
// each shows (`bindingGeometry`): brackets, a [ where a place within a
// paragraph begins and a ] where it ends, and a tall [ and ] either side of
// one around whole paragraphs, each at its place's very edge — a choice drawn
// as the option it shows — and where places begin or end together, the
// innermost's as tall as its line and each around it a step taller; the
// place the caret is in has its brackets stronger. Every place the caret is
// in has a binding bar naming it, standing on top of its own opening bracket,
// left-aligned with it, and opening its popover, the place it stands in
// marked; bars that would overlap stack up, the outer over the inner, each
// stacked one joined to its bracket by a line straight down from its
// bottom-left corner. The places of the Data
// panel's name the pointer is over stand out too. Which places the caret is
// in is the engine's to say (the selection's `places`): where places end or
// begin, the caret stands at a level the arrows step through, and the bars
// show the level. None of it is the document's — it is drawn over the
// canvas, under the selection, and takes no press but the bars' — and an
// instance shows none until asked, so it reads as an ordinary document.
import { subscribeSelector } from "@docmentis/udoc-ui/internal";
import type { OverlayFrame, OverlayItem, OverlaySource, PageView } from "@docmentis/udoc-ui";
import type { Binding, BindingGeometry, Point, SelectionGeometry, UDocSelectionProperties } from "@docmentis/udoc-wasm";
import type { EditHost } from "./edit-client.js";
import type { I18n, MessageKey } from "./i18n/index.js";
import { editState } from "./state.js";

const OVERLAY_ID = "udoc:places";
const SVG_NS = "http://www.w3.org/2000/svg";

/** How far a bracket's ends reach in towards what it holds, CSS px, a place
 *  within a paragraph's and one around whole paragraphs' alike. */
const TICK = 5;

/** How much further above and below its line a bracket reaches for each place
 *  inside its own that begins or ends with it, CSS px. */
const NEST_STEP = 5;

/** Two brackets whose edges are nearer than this across stand on one
 *  another, CSS px. */
const COINCIDE = 1.5;

/** The place the caret is in, as the overlay marks it. */
export interface CurrentPlace {
    readonly geometry: BindingGeometry;
    readonly page: number;
}

export interface Places {
    /** The place marked: the one the caret is in, innermost, unless another
     *  around the caret is shown; or null. */
    current(): CurrentPlace | null;
    /** Every place the caret is in, outermost first. */
    atCaret(): CurrentPlace[];
    /** Mark `place`, one the caret is in, until the caret moves. */
    show(place: CurrentPlace): void;
    /** The marked place's binding bar, as drawn, or null. */
    barItem(): HTMLElement | null;
    /** Read the places shown again — after the slide composed again with no
     *  edit to say so, as showing another of a choice's options does. */
    refresh(): void;
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

/** The kind a place's binding bar names, and what follows it: its path, a
 *  repeat's item over its path, an option's values. */
export function placeLabel(binding: Binding, i18n: I18n): string {
    const [kind, detail] = placeParts(binding);
    const name = i18n.t(kind);
    return detail === "" ? name : `${name} · ${detail}`;
}

/** Whether `binding` is a choice's, which shows one of its options. */
function isChoice(binding: Binding): boolean {
    return binding !== "otherwise" && "choice" in binding;
}

/** Whether `binding` is an option's, one of what a choice shows. */
function isOption(binding: Binding): boolean {
    return binding === "otherwise" || "when" in binding;
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
 *  edit mode is mounted. `open` opens the popover of the place whose item on the bar is
 *  pressed. */
export function mountPlaces(host: EditHost, i18n: I18n, open: (place: CurrentPlace, item: DOMRect) => void): Places {
    const { client, store } = host;
    // What was read for each page, by `plane:page`, and which read is current.
    let read = new Map<string, readonly BindingGeometry[]>();
    let generation = 0;
    let views: readonly PageView[] = [];
    let selection: SelectionGeometry | null = null;
    // The places the caret is in, outermost first, as the engine reports them.
    let chain: readonly string[] = [];
    let current: CurrentPlace | null = null;
    // A place `show` marked, and where the caret stood then.
    let shown: { id: string; at: string } | null = null;
    let markedItem: HTMLElement | null = null;

    const geometryOf = (page: number): readonly BindingGeometry[] =>
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
            void client.bindingGeometry(plane, index).then((geometry) => {
                if (asked !== generation) return;
                read.set(key, geometry);
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
        for (const [key, geometry] of shown) if (read.get(key)?.length === 0) read.set(key, geometry);
    }

    function atCaret(): CurrentPlace[] {
        const at = caretPoint(selection);
        if (!at || !placesShown(host)) return [];
        const geometries = geometryOf(at.page);
        return chain.flatMap((id) => {
            const geometry = geometries.find((place) => place.id === id);
            return geometry ? [{ geometry, page: at.page }] : [];
        });
    }

    function findCurrent(): void {
        const places = atCaret();
        const at = caretKey(selection);
        if (shown && shown.at !== at) shown = null;
        current = (shown && places.find((place) => place.geometry.id === shown?.id)) ?? places.at(-1) ?? null;
    }

    function items(frame: OverlayFrame): OverlayItem[] {
        const brackets: Bracket[] = [];
        // Each place's opening bracket, by page and id — where its binding bar
        // stands.
        const opened = new Map<string, number>();
        // The places of the Data panel's name the pointer is over stand out as
        // the caret's does.
        const state = store.getState();
        const hovered = new Set(state.activePanel === "data" ? state.dataHover : []);
        for (const view of frame.views) {
            const at = (p: Point) => ({ x: view.x + p.x * frame.scale, y: view.y + p.y * frame.scale });
            const geometries = geometryOf(view.index);
            // A choice draws as the option it shows, which holds all it shows
            // and comes next: the choice's brackets would only stand on the
            // option's. The option stands out where the choice does, and the
            // choice's bar stands on the option's bracket.
            let choice = null as { id: string; isMarked: boolean; isCurrent: boolean } | null;
            for (const [index, geometry] of geometries.entries()) {
                const quads = geometry.quads.filter((quad) => quad.page === view.index);
                if (quads.length === 0) continue;
                const isMarked =
                    (current?.geometry.id === geometry.id && current.page === view.index) || !!choice?.isMarked;
                const isCurrent = isMarked || hovered.has(geometry.id) || !!choice?.isCurrent;
                const held = choice;
                choice = null;
                const next = geometries[index + 1];
                if (isChoice(geometry.binding) && next && isOption(next.binding)) {
                    choice = { id: geometry.id, isMarked, isCurrent };
                    continue;
                }
                const [open, close] =
                    geometry.level === "block"
                        ? blockBrackets(quads.flatMap((quad) => quad.points.map(at)))
                        : spanBrackets(quads[0]!.points.map(at), quads.at(-1)!.points.map(at));
                for (const bracket of [open, close]) brackets.push({ ...bracket, current: isCurrent });
                const opening = brackets.length - 2;
                opened.set(`${view.index}:${geometry.id}`, opening);
                if (held) opened.set(`${view.index}:${held.id}`, opening);
            }
        }
        const levels = nestLevels(brackets);
        brackets.forEach((bracket, index) => grow(bracket, levels[index]!));
        const out: OverlayItem[] = [];
        if (brackets.length > 0) {
            out.push({
                key: "places",
                x: 0,
                y: 0,
                create: () => {
                    const el = document.createElement("div");
                    el.className = "udoc-places";
                    el.setAttribute("aria-hidden", "true");
                    const svg = document.createElementNS(SVG_NS, "svg");
                    svg.append(document.createElementNS(SVG_NS, "g"));
                    el.appendChild(svg);
                    return el;
                },
                update: (el) => {
                    const [group] = (el.firstElementChild as SVGSVGElement).children;
                    pooled(group!, "polyline", brackets.length).forEach((polyline, index) => {
                        const bracket = brackets[index]!;
                        polyline.setAttribute("points", bracketPoints(bracket));
                        polyline.setAttribute("class", classOf("udoc-place-bracket", bracket.current));
                    });
                },
            });
        }
        // A binding bar for every place the caret is in, each on top of its
        // own opening bracket; the place it stands in marked.
        const bars: Bar[] = atCaret().flatMap((place) => {
            const opening = opened.get(`${place.page}:${place.geometry.id}`);
            if (opening === undefined) return [];
            const isCurrent = current?.geometry.id === place.geometry.id;
            return [{ place, anchor: brackets[opening]!.top, current: isCurrent }];
        });
        if (bars.length > 0) {
            const key = bars.map((bar) => `${bar.place.geometry.id}:${bar.current}`).join();
            out.push({
                key: "bars",
                x: 0,
                y: 0,
                create: () => {
                    const el = document.createElement("div");
                    el.className = "udoc-binding-bars";
                    const svg = document.createElementNS(SVG_NS, "svg");
                    svg.setAttribute("aria-hidden", "true");
                    svg.append(document.createElementNS(SVG_NS, "g"));
                    el.appendChild(svg);
                    return el;
                },
                update: (el) => {
                    const svg = el.firstElementChild as SVGSVGElement;
                    if (el.dataset.bars !== key) {
                        el.dataset.bars = key;
                        markedItem = null;
                        el.replaceChildren(
                            svg,
                            ...bars.map((bar) => {
                                const label = placeLabel(bar.place.geometry.binding, i18n);
                                const item = document.createElement("button");
                                item.type = "button";
                                item.className = classOf("udoc-binding-bar", bar.current);
                                item.textContent = label;
                                item.title = label;
                                if (bar.current) markedItem = item;
                                // Down on a bar is no press on the text under it,
                                // and the press that opens the popover no press
                                // outside it.
                                item.addEventListener("pointerdown", (e) => e.stopPropagation());
                                item.addEventListener("click", (e) => {
                                    e.stopPropagation();
                                    open(bar.place, item.getBoundingClientRect());
                                });
                                return item;
                            }),
                        );
                    }
                    const items = [...el.querySelectorAll<HTMLElement>(".udoc-binding-bar")];
                    const placed = stacked(
                        bars.map((bar, index) => ({
                            left: bar.anchor.x,
                            bottom: bar.anchor.y,
                            width: items[index]!.offsetWidth,
                            height: items[index]!.offsetHeight,
                        })),
                    );
                    const leaders: { from: Point; to: Point; current: boolean }[] = [];
                    placed.forEach((box, index) => {
                        const item = items[index]!;
                        const bar = bars[index]!;
                        item.style.left = `${box.left}px`;
                        item.style.top = `${box.bottom - box.height}px`;
                        // Stacked off its place, a line straight down from its
                        // bottom-left corner to its opening bracket's top.
                        if (box.bottom < bar.anchor.y - 0.5) {
                            leaders.push({
                                from: { x: box.left, y: box.bottom },
                                to: bar.anchor,
                                current: bar.current,
                            });
                        }
                    });
                    pooled(svg.firstElementChild!, "line", leaders.length).forEach((line, index) => {
                        const leader = leaders[index]!;
                        line.setAttribute("x1", `${leader.from.x}`);
                        line.setAttribute("y1", `${leader.from.y}`);
                        line.setAttribute("x2", `${leader.to.x}`);
                        line.setAttribute("y2", `${leader.to.y}`);
                        line.setAttribute("class", classOf("udoc-binding-bar-leader", leader.current));
                    });
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
            const before = [current?.geometry.id, ...chain].join();
            chain = placesOf(state.properties);
            findCurrent();
            if ([current?.geometry.id, ...chain].join() !== before) draw();
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
            shown = { id: place.geometry.id, at: caretKey(selection) };
            findCurrent();
            draw();
        },
        barItem: () => (markedItem?.isConnected ? markedItem : null),
        refresh: readAgain,
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

/** The places the selection is in, outermost first, as a deck's selection
 *  properties report them; none for any other selection. */
function placesOf(properties: UDocSelectionProperties | null): readonly string[] {
    return properties && "presentation" in properties ? (properties.presentation.text.places ?? []) : [];
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

/** A place's binding bar: the place, its opening bracket's top end, which
 *  the bar's bottom-left corner stands on, and whether it is the place the
 *  caret stands in. */
interface Bar {
    place: CurrentPlace;
    anchor: Point;
    current: boolean;
}

/** How far apart bars stacked one over another stand, CSS px. */
const BAR_GAP = 2;

/** Where each of `boxes` stands, outermost place first — each on top of its
 *  own place, and one that would overlap a bar nearer its place's text
 *  stacked up over that bar, the innermost place's standing where it is. */
function stacked(
    boxes: { left: number; bottom: number; width: number; height: number }[],
): { left: number; bottom: number; width: number; height: number }[] {
    const placed: { left: number; bottom: number; width: number; height: number }[] = [];
    const out = boxes.map((box) => ({ ...box }));
    for (let index = out.length - 1; index >= 0; index--) {
        const box = out[index]!;
        for (let moved = true; moved; ) {
            moved = false;
            for (const other of placed) {
                const across = box.left < other.left + other.width && other.left < box.left + box.width;
                const down = box.bottom - box.height < other.bottom && other.bottom - other.height < box.bottom;
                if (across && down) {
                    box.bottom = other.bottom - other.height - BAR_GAP;
                    moved = true;
                }
            }
        }
        placed.push(box);
    }
    return out;
}

/** One bracket of a place, in viewport px: the edge it stands on, from its top
 *  end to its bottom; the way in towards what it holds, a unit vector;
 *  whether it opens or closes the place; and whether its place stands out. */
interface Bracket {
    top: Point;
    bottom: Point;
    inward: Point;
    side: "open" | "close";
    current: boolean;
}

type BracketShape = Omit<Bracket, "current">;

/** A place within a paragraph's brackets: a [ at the start of its first quad
 *  and a ] at the end of its last, each as tall as its line. A quad's corners
 *  run top-left, top-right, bottom-right, bottom-left. */
function spanBrackets(first: Point[], last: Point[]): [BracketShape, BracketShape] {
    const [topLeft, , , bottomLeft] = first;
    const [, topRight, bottomRight] = last;
    const forward = readingWay(topLeft!, bottomLeft!);
    return [
        { top: topLeft!, bottom: bottomLeft!, inward: forward, side: "open" },
        { top: topRight!, bottom: bottomRight!, inward: { x: -forward.x, y: -forward.y }, side: "close" },
    ];
}

/** A place around whole paragraphs' brackets: a [ and a ] as tall as all its
 *  lines, at either side of them. */
function blockBrackets(corners: Point[]): [BracketShape, BracketShape] {
    const xs = corners.map((p) => p.x);
    const ys = corners.map((p) => p.y);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    return [
        { top: { x: left, y: top }, bottom: { x: left, y: bottom }, inward: { x: 1, y: 0 }, side: "open" },
        { top: { x: right, y: top }, bottom: { x: right, y: bottom }, inward: { x: -1, y: 0 }, side: "close" },
    ];
}

/** The way a line reads, a unit vector, from its start edge's top and bottom:
 *  that edge turned a quarter forward — right, for a line not turned. */
function readingWay(top: Point, bottom: Point): Point {
    const length = Math.hypot(bottom.x - top.x, bottom.y - top.y);
    return length === 0 ? { x: 1, y: 0 } : { x: (bottom.y - top.y) / length, y: -(bottom.x - top.x) / length };
}

/** How many steps taller each of `brackets` stands: one more than the
 *  tallest later bracket on its side that falls on it — a place inside its
 *  own beginning or ending with it, as a page's places come each before the
 *  places inside it — and a place's two brackets alike, the taller of the
 *  two, so its [ and its ] match. `brackets` holds each place's opening
 *  bracket and then its closing one. The innermost stands as tall as its
 *  line, and each around it a step taller, so brackets meeting at one edge
 *  show each its own ends, none of them moved off the edge. */
function nestLevels(brackets: readonly Bracket[]): number[] {
    const levels = brackets.map(() => 0);
    // A pair grown to match can stand taller than a place around it at the
    // other edge, which grows again: on until nothing does.
    for (let changed = true; changed; ) {
        changed = false;
        for (let index = brackets.length - 1; index >= 0; index--) {
            const bracket = brackets[index]!;
            for (let inner = index + 1; inner < brackets.length; inner++) {
                const other = brackets[inner]!;
                if (other.side === bracket.side && fallsOn(other, bracket) && levels[inner]! >= levels[index]!) {
                    levels[index] = levels[inner]! + 1;
                    changed = true;
                }
            }
        }
        for (let open = 0; open + 1 < brackets.length; open += 2) {
            const tallest = Math.max(levels[open]!, levels[open + 1]!);
            if (levels[open] !== tallest || levels[open + 1] !== tallest) {
                levels[open] = levels[open + 1] = tallest;
                changed = true;
            }
        }
    }
    return levels;
}

/** Whether `bracket` falls on `on`: on its edge across, and beside some of it
 *  along. */
function fallsOn(bracket: Bracket, on: Bracket): boolean {
    const offset = (p: Point) => ({ x: p.x - on.top.x, y: p.y - on.top.y });
    const across = offset(bracket.top);
    if (Math.abs(across.x * on.inward.x + across.y * on.inward.y) >= COINCIDE) return false;
    const length = Math.hypot(on.bottom.x - on.top.x, on.bottom.y - on.top.y);
    if (length === 0) return false;
    const along = (p: Point) => {
        const d = offset(p);
        return (d.x * (on.bottom.x - on.top.x) + d.y * (on.bottom.y - on.top.y)) / length;
    };
    const [from, to] = [along(bracket.top), along(bracket.bottom)].sort((a, b) => a - b);
    return from! < length - COINCIDE && to! > COINCIDE;
}

/** Make `bracket` `level` steps taller, its ends that much further above
 *  and below along its edge. */
function grow(bracket: Bracket, level: number): void {
    if (level === 0) return;
    const { top, bottom } = bracket;
    const length = Math.hypot(bottom.x - top.x, bottom.y - top.y) || 1;
    const step = level * NEST_STEP;
    const dx = ((bottom.x - top.x) / length) * step;
    const dy = ((bottom.y - top.y) / length) * step;
    bracket.top = { x: top.x - dx, y: top.y - dy };
    bracket.bottom = { x: bottom.x + dx, y: bottom.y + dy };
}

/** `bracket` as a polyline's points: in along its top end, down its edge, in
 *  along its bottom end. */
function bracketPoints(bracket: Bracket): string {
    const { top, bottom, inward } = bracket;
    const reach = (p: Point) => ({ x: p.x + inward.x * TICK, y: p.y + inward.y * TICK });
    return [reach(top), top, bottom, reach(bottom)].map((p) => `${p.x},${p.y}`).join(" ");
}

/** `group`'s first `count` children, made `tag`s as needed, the rest gone. */
function pooled<K extends "polyline" | "line">(group: Element, tag: K, count: number): SVGElementTagNameMap[K][] {
    while (group.childElementCount > count) group.lastElementChild!.remove();
    while (group.childElementCount < count) group.appendChild(document.createElementNS(SVG_NS, tag));
    return [...group.children] as SVGElementTagNameMap[K][];
}

/** `base`, and its current modifier for the place the caret is in. */
function classOf(base: string, current: boolean): string {
    return current ? `${base} ${base}--current` : base;
}
