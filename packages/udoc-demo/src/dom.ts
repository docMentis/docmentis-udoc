// Tiny DOM builders for the demo shell. The editor package keeps its own
// framework; the demo is plain DOM, so these are deliberately minimal.

type Attrs = Record<string, string | number | boolean | EventListener | undefined>;
type Child = Node | string | null | undefined;

/** Create an element with attributes/handlers and children in one call. */
export function h<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs: Attrs = {},
    ...children: Child[]
): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === false) continue;
        if (k === "class") el.className = String(v);
        else if (k === "html") el.innerHTML = String(v);
        else if (k.startsWith("on") && typeof v === "function") {
            el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
        } else if (v === true) el.setAttribute(k, "");
        else el.setAttribute(k, String(v));
    }
    append(el, ...children);
    return el;
}

/** Append children, skipping nullish ones and wrapping strings as text. */
export function append(parent: Node, ...children: Child[]): void {
    for (const c of children) {
        if (c === null || c === undefined) continue;
        parent.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
}

/** Build an inline SVG from raw inner path markup. */
export function svg(inner: string, viewBox = "0 0 24 24", cls = ""): SVGSVGElement {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    el.setAttribute("viewBox", viewBox);
    el.setAttribute("fill", "currentColor");
    if (cls) el.setAttribute("class", cls);
    el.innerHTML = inner;
    return el;
}

/** Replace all children of `el` with the given nodes. */
export function replaceChildren(el: Element, ...children: Child[]): void {
    el.replaceChildren();
    append(el, ...children);
}
