import type { Outline, OutlineItem } from "@docmentis/udoc-wasm";
import { subscribeSelector } from "../../framework/index.js";
import type { Store } from "../../framework/index.js";
import type { WorkerClient } from "../../worker/WorkerClient.js";
import type { Action } from "../actions.js";
import { follow } from "../destinations.js";
import { ICON_CHEVRON_RIGHT } from "../icons.js";
import type { UIState } from "../state.js";
import type { I18n } from "../i18n/index.js";

export interface OutlinePanelCallbacks {
    /** Open the URL an item's `URI` action names. */
    openUrl: (url: string) => void;
}

/**
 * The left panel's Outline tab: a PDF's document outline — its bookmarks — as a
 * tree. A port of the udoc-viewer's outline panel: items expand and collapse,
 * the tree answers the arrow / Home / End / Enter keys, and each item opens as
 * the file says it does (`/Count`); beyond it, each title shows in the file's
 * colour (`/C`) and style (`/F`).
 *
 * The outline is read once per document, the first time the tab opens (the
 * read loads it). Activating an item follows its destination — or its `GoTo`
 * action's — through the engine, which lands the view; when the landing set
 * the zoom, the zoom mode turns custom, as a marquee zoom's does. A `URI`
 * action's URI goes to the shell, which opens it as it opens a link's; any
 * other action does nothing yet.
 */
export function createOutlinePanel(i18n: I18n, callbacks: OutlinePanelCallbacks) {
    const el = document.createElement("div");
    el.className = "udoc-outline-panel";

    let store: Store<UIState, Action> | null = null;
    let client: WorkerClient | null = null;
    /** The document the tree on show was read from — a newer one re-reads. */
    let generation = -1;
    /** Items the reader has collapsed or expanded, by path — what a first state
     *  (`open`) no longer decides. */
    const toggled = new Map<string, boolean>();
    let unsub: (() => void) | null = null;

    function showMessage(text: string): void {
        el.replaceChildren();
        el.removeAttribute("role");
        const message = document.createElement("div");
        message.className = "udoc-panel-placeholder";
        message.textContent = text;
        el.appendChild(message);
    }

    async function load(docGeneration: number): Promise<void> {
        if (!client || docGeneration === generation) return;
        generation = docGeneration;
        toggled.clear();
        showMessage(i18n.t("outline.loading"));
        let outline: Outline;
        try {
            outline = await client.portable.outline();
        } catch (err) {
            // A worker torn down under the read took the panel with it.
            if (generation !== docGeneration || !client) return;
            console.error("outline read failed:", err);
            showMessage(i18n.t("outline.readFailed"));
            return;
        }
        // Another document opened (or the panel closed) while this read ran.
        if (generation !== docGeneration || !client) return;
        build(outline);
    }

    function build(outline: Outline): void {
        if (outline.items.length === 0) {
            showMessage(i18n.t("outline.empty"));
            return;
        }
        el.replaceChildren();
        el.setAttribute("role", "tree");
        el.setAttribute("aria-label", i18n.t("leftPanel.outline"));
        outline.items.forEach((item, index) => el.appendChild(itemElement(item, String(index), 0)));
        el.querySelector<HTMLElement>(".udoc-outline-item__header")?.setAttribute("tabindex", "0");
    }

    function isExpanded(item: OutlineItem, path: string): boolean {
        return toggled.get(path) ?? item.open;
    }

    function itemElement(item: OutlineItem, path: string, depth: number): HTMLElement {
        const container = document.createElement("div");
        container.className = "udoc-outline-item";
        container.dataset.path = path;
        container.setAttribute("role", "treeitem");
        container.setAttribute("aria-label", item.title);

        const header = document.createElement("div");
        header.className = "udoc-outline-item__header";
        header.style.paddingLeft = `${8 + depth * 16}px`;
        header.setAttribute("tabindex", "-1");

        const hasChildren = item.children.length > 0;
        if (hasChildren) {
            const toggle = document.createElement("button");
            toggle.className = "udoc-outline-item__toggle";
            toggle.type = "button";
            toggle.setAttribute("tabindex", "-1");
            toggle.setAttribute("aria-hidden", "true");
            toggle.innerHTML = ICON_CHEVRON_RIGHT;
            toggle.addEventListener("click", (e) => {
                e.stopPropagation();
                setExpanded(container, path, !isExpanded(item, path));
            });
            header.appendChild(toggle);
        } else {
            const spacer = document.createElement("span");
            spacer.className = "udoc-outline-item__spacer";
            header.appendChild(spacer);
        }

        const title = document.createElement("span");
        title.className = "udoc-outline-item__title";
        title.textContent = item.title;
        // The panel cuts a long title off; the tooltip reads it whole.
        title.title = item.title;
        const color = titleColor(item);
        if (color) title.style.color = color;
        if (item.italic) title.style.fontStyle = "italic";
        if (item.bold) title.style.fontWeight = "700";
        header.appendChild(title);
        container.appendChild(header);

        if (item.destination || item.action) {
            header.classList.add("udoc-outline-item__header--clickable");
            header.addEventListener("click", () => activate(item));
        }
        header.addEventListener("keydown", (e) => {
            if (onTreeKey(e, container, item, path)) {
                e.preventDefault();
                e.stopPropagation();
            }
        });

        if (hasChildren) {
            const children = document.createElement("div");
            children.className = "udoc-outline-item__children";
            children.setAttribute("role", "group");
            item.children.forEach((child, index) =>
                children.appendChild(itemElement(child, `${path}/${index}`, depth + 1)),
            );
            container.appendChild(children);
            showExpanded(container, isExpanded(item, path));
        }
        return container;
    }

    function setExpanded(container: HTMLElement, path: string, expanded: boolean): void {
        toggled.set(path, expanded);
        showExpanded(container, expanded);
    }

    function showExpanded(container: HTMLElement, expanded: boolean): void {
        const toggle = container.querySelector(":scope > .udoc-outline-item__header > .udoc-outline-item__toggle");
        const children = container.querySelector<HTMLElement>(":scope > .udoc-outline-item__children");
        if (!toggle || !children) return;
        toggle.classList.toggle("udoc-outline-item__toggle--expanded", expanded);
        children.style.display = expanded ? "" : "none";
        container.setAttribute("aria-expanded", String(expanded));
    }

    /** Follow an item: its destination, else its action's. */
    function activate(item: OutlineItem): void {
        if (!client || !store) return;
        follow(client, store, item, callbacks.openUrl).catch((err: unknown) => {
            // A worker torn down under the call took the panel with it.
            if (client) console.error("following an outline item failed:", err);
        });
    }

    function onTreeKey(e: KeyboardEvent, container: HTMLElement, item: OutlineItem, path: string): boolean {
        const hasChildren = item.children.length > 0;
        const expanded = hasChildren && isExpanded(item, path);
        switch (e.key) {
            case "ArrowDown": {
                const next = nextVisible(container);
                if (next) focusItem(next);
                return true;
            }
            case "ArrowUp": {
                const prev = previousVisible(container);
                if (prev) focusItem(prev);
                return true;
            }
            case "ArrowRight": {
                if (hasChildren && !expanded) setExpanded(container, path, true);
                else if (expanded) {
                    const first = container.querySelector<HTMLElement>(
                        ":scope > .udoc-outline-item__children > .udoc-outline-item",
                    );
                    if (first) focusItem(first);
                }
                return true;
            }
            case "ArrowLeft": {
                if (expanded) setExpanded(container, path, false);
                else {
                    const parent = container.parentElement?.closest<HTMLElement>(".udoc-outline-item");
                    if (parent) focusItem(parent);
                }
                return true;
            }
            case "Home": {
                const first = el.querySelector<HTMLElement>(".udoc-outline-item");
                if (first) focusItem(first);
                return true;
            }
            case "End": {
                const all = el.querySelectorAll<HTMLElement>(".udoc-outline-item");
                for (let i = all.length - 1; i >= 0; i--) {
                    if (all[i]!.offsetParent !== null) {
                        focusItem(all[i]!);
                        break;
                    }
                }
                return true;
            }
            case "Enter":
            case " ":
                activate(item);
                return true;
            default:
                return false;
        }
    }

    function focusItem(item: HTMLElement): void {
        item.querySelector<HTMLElement>(":scope > .udoc-outline-item__header")?.focus();
    }

    function nextVisible(current: HTMLElement): HTMLElement | null {
        const children = current.querySelector<HTMLElement>(":scope > .udoc-outline-item__children");
        if (children && children.style.display !== "none") {
            const first = children.querySelector<HTMLElement>(":scope > .udoc-outline-item");
            if (first) return first;
        }
        let node: HTMLElement | null = current;
        while (node) {
            const next = node.nextElementSibling as HTMLElement | null;
            if (next?.classList.contains("udoc-outline-item")) return next;
            node = node.parentElement?.closest<HTMLElement>(".udoc-outline-item") ?? null;
        }
        return null;
    }

    function previousVisible(current: HTMLElement): HTMLElement | null {
        const prev = current.previousElementSibling as HTMLElement | null;
        if (prev?.classList.contains("udoc-outline-item")) return lastVisibleDescendant(prev);
        return current.parentElement?.closest<HTMLElement>(".udoc-outline-item") ?? null;
    }

    function lastVisibleDescendant(item: HTMLElement): HTMLElement {
        const children = item.querySelector<HTMLElement>(":scope > .udoc-outline-item__children");
        if (children && children.style.display !== "none") {
            const last = children.querySelector<HTMLElement>(":scope > .udoc-outline-item:last-child");
            if (last) return lastVisibleDescendant(last);
        }
        return item;
    }

    function mount(container: HTMLElement, s: Store<UIState, Action>, c: WorkerClient): void {
        container.appendChild(el);
        store = s;
        client = c;
        void load(s.getState().docGeneration);
        unsub = subscribeSelector(
            s,
            (st) => st.docGeneration,
            (docGeneration) => void load(docGeneration),
        );
    }

    function destroy(): void {
        if (unsub) unsub();
        unsub = null;
        store = null;
        client = null;
        el.remove();
    }

    return { el, mount, destroy };
}

export type OutlinePanelComponent = ReturnType<typeof createOutlinePanel>;

/** An item's `/C` as CSS, or `null` for black — the default, which the theme's
 *  text colour stands for so a dark theme doesn't hide it. */
function titleColor(item: OutlineItem): string | null {
    const [r, g, b] = item.color?.components ?? [];
    if (r === undefined || g === undefined || b === undefined) return null;
    if (r === 0 && g === 0 && b === 0) return null;
    const channel = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
    return `rgb(${channel(r)}, ${channel(g)}, ${channel(b)})`;
}
