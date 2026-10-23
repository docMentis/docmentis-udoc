import type { OptionalContentOrderItem, OptionalContentProperties } from "@docmentis/udoc-wasm";
import { subscribeSelector } from "../../framework/index.js";
import type { Store } from "../../framework/index.js";
import type { WorkerClient } from "../../worker/WorkerClient.js";
import type { Action } from "../actions.js";
import { ICON_CHEVRON_RIGHT, ICON_LAYER_OFF, ICON_LAYER_ON, ICON_LOCK } from "../icons.js";
import type { UIState } from "../state.js";
import type { I18n } from "../i18n/index.js";

/**
 * The left panel's Layers tab: a PDF's optional content groups as the default
 * configuration's `/Order` presents them — a tree of groups, and of the text
 * labels that head related ones. A port of the udoc-viewer's layers panel: each
 * group shows whether it is ON and switches on a click, and one the
 * configuration locks shows a lock and doesn't switch; beyond it, the rows nest
 * as the order does, and a row with children collapses. A group the order
 * leaves out isn't shown, as the spec asks (8.11.4.3) — nor, with no order, is
 * any.
 *
 * The groups are read once per document, the first time the tab opens (the
 * read loads them). Which are OFF is the session's, not the document's: read
 * with them, and again after each switch, since turning a group ON turns the
 * others of its radio groups OFF.
 */
export function createLayersPanel(i18n: I18n) {
    const el = document.createElement("div");
    el.className = "udoc-layers-panel";

    let client: WorkerClient | null = null;
    /** The document the tree on show was read from — a newer one re-reads. */
    let generation = -1;
    /** Each group's rows, by id — a group the order lists twice has two. */
    const rows = new Map<string, HTMLElement[]>();
    let unsub: (() => void) | null = null;

    function showMessage(text: string): void {
        rows.clear();
        el.replaceChildren();
        const message = document.createElement("div");
        message.className = "udoc-panel-placeholder";
        message.textContent = text;
        el.appendChild(message);
    }

    async function load(docGeneration: number): Promise<void> {
        if (!client || docGeneration === generation) return;
        generation = docGeneration;
        showMessage(i18n.t("layers.loading"));
        let properties: OptionalContentProperties | null;
        let off: string[];
        try {
            [properties, off] = await Promise.all([
                client.portable.optionalContentProperties(),
                client.portable.optionalContentOff(),
            ]);
        } catch (err) {
            // A worker torn down under the read took the panel with it.
            if (generation !== docGeneration || !client) return;
            console.error("layers read failed:", err);
            showMessage(i18n.t("layers.readFailed"));
            return;
        }
        // Another document opened (or the panel closed) while this read ran.
        if (generation !== docGeneration || !client) return;
        build(properties, new Set(off));
    }

    function build(properties: OptionalContentProperties | null, off: ReadonlySet<string>): void {
        const order = properties?.defaultConfig.order ?? [];
        if (!properties || order.length === 0) {
            showMessage(i18n.t("layers.empty"));
            return;
        }
        const names = new Map(properties.groups.map((group) => [group.id, group.name]));
        const locked = new Set(properties.defaultConfig.locked);
        // A flat list keeps no column for the chevrons none of its rows has.
        const nested = order.some((item) => ("group" in item ? item.group : item.label).children.length > 0);
        rows.clear();
        el.replaceChildren();
        for (const item of order) el.appendChild(itemElement(item, 0, names, locked, nested));
        showOff(off);
    }

    function itemElement(
        item: OptionalContentOrderItem,
        depth: number,
        names: ReadonlyMap<string, string>,
        locked: ReadonlySet<string>,
        nested: boolean,
    ): HTMLElement {
        const container = document.createElement("div");
        container.className = "udoc-layers-item";

        const header = document.createElement("div");
        header.className = "udoc-layers-item__header";
        header.style.paddingLeft = `${8 + depth * 16}px`;
        container.appendChild(header);

        const { children } = "group" in item ? item.group : item.label;
        const label = "group" in item ? (names.get(item.group.id) ?? "") : item.label.text;
        let childList: HTMLElement | null = null;
        if (children.length > 0) {
            childList = document.createElement("div");
            childList.className = "udoc-layers-item__children";
            childList.setAttribute("role", "group");
            for (const child of children) childList.appendChild(itemElement(child, depth + 1, names, locked, nested));
            container.appendChild(childList);

            const toggle = document.createElement("button");
            toggle.className = "udoc-layers-item__toggle udoc-layers-item__toggle--expanded";
            toggle.type = "button";
            toggle.setAttribute("aria-label", label);
            toggle.setAttribute("aria-expanded", "true");
            toggle.innerHTML = ICON_CHEVRON_RIGHT;
            const list = childList;
            toggle.addEventListener("click", (e) => {
                // Not a switch of the row's group.
                e.stopPropagation();
                const expanded = list.style.display === "none";
                list.style.display = expanded ? "" : "none";
                toggle.classList.toggle("udoc-layers-item__toggle--expanded", expanded);
                toggle.setAttribute("aria-expanded", String(expanded));
            });
            header.appendChild(toggle);
        } else if (nested) {
            const spacer = document.createElement("span");
            spacer.className = "udoc-layers-item__spacer";
            header.appendChild(spacer);
        }

        if ("label" in item) {
            // A heading for the groups under it, which nothing switches.
            header.classList.add("udoc-layers-item__header--label");
            header.appendChild(nameElement(label));
            return container;
        }

        const id = item.group.id;
        const isLocked = locked.has(id);
        const onSwitch = document.createElement("button");
        onSwitch.className = "udoc-layers-item__switch";
        onSwitch.type = "button";
        onSwitch.setAttribute("role", "switch");
        onSwitch.setAttribute("aria-label", label);
        onSwitch.disabled = isLocked;
        header.append(onSwitch, nameElement(label));
        if (isLocked) {
            header.classList.add("udoc-layers-item__header--locked");
            const lock = document.createElement("span");
            lock.className = "udoc-layers-item__lock";
            lock.title = i18n.t("layers.locked");
            lock.innerHTML = ICON_LOCK;
            header.appendChild(lock);
        } else {
            // The whole row switches; the switch's own click (and its Space /
            // Enter) bubbles here.
            header.addEventListener("click", () => {
                const on = onSwitch.getAttribute("aria-checked") !== "true";
                void setOn(id, on);
            });
        }
        const list = rows.get(id);
        if (list) list.push(header);
        else rows.set(id, [header]);
        return container;
    }

    function nameElement(text: string): HTMLElement {
        const name = document.createElement("span");
        name.className = "udoc-layers-item__name";
        name.textContent = text;
        name.title = text;
        return name;
    }

    /** Show each row's group ON unless it is in `off`. */
    function showOff(off: ReadonlySet<string>): void {
        for (const [id, headers] of rows) {
            const on = !off.has(id);
            for (const header of headers) {
                header.classList.toggle("udoc-layers-item__header--off", !on);
                const onSwitch = header.querySelector<HTMLButtonElement>(":scope > .udoc-layers-item__switch");
                if (!onSwitch) continue;
                onSwitch.setAttribute("aria-checked", String(on));
                onSwitch.innerHTML = on ? ICON_LAYER_ON : ICON_LAYER_OFF;
                if (!onSwitch.disabled) onSwitch.title = i18n.t(on ? "layers.hide" : "layers.show");
            }
        }
    }

    async function setOn(id: string, on: boolean): Promise<void> {
        if (!client) return;
        const docGeneration = generation;
        let off: string[];
        try {
            if (!(await client.portable.setOptionalContentGroupOn(id, on))) return;
            off = await client.portable.optionalContentOff();
        } catch (err) {
            // A worker torn down under the call took the panel with it.
            if (client) console.error("switching a layer failed:", err);
            return;
        }
        if (generation !== docGeneration || !client) return;
        showOff(new Set(off));
    }

    function mount(container: HTMLElement, s: Store<UIState, Action>, c: WorkerClient): void {
        container.appendChild(el);
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
        client = null;
        el.remove();
    }

    return { el, mount, destroy };
}

export type LayersPanelComponent = ReturnType<typeof createLayersPanel>;
