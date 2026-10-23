import { h, svg, replaceChildren } from "../dom.js";
import { ICONS } from "../icons.js";
import { SAMPLE_CATEGORIES, type SampleCategory, type SampleDoc } from "../samples.js";

export interface SidebarHandlers {
    onOpenFile(): void;
    onOpenUrl(): void;
    onSelectDoc(doc: SampleDoc): void;
    onOpenOptions(): void;
}

/**
 * The document source rail. Collapsible:
 *  - expanded: Open buttons + the full categorized sample list (default in
 *    Edit mode, where the body has room to spare);
 *  - folded: a narrow vertical rail with one button per file type; clicking a
 *    type pops a flyout of that type's samples (default in the split modes).
 * Either way its foot opens the options — a wide button expanded, a
 * gear folded.
 */
export class Sidebar {
    readonly el: HTMLElement;
    readonly #expanded: HTMLElement;
    readonly #folded: HTMLElement;
    readonly #flyout: HTMLElement;
    readonly #docButtons = new Map<string, HTMLButtonElement>();
    #collapsed = false;
    #activePath: string | null = null;

    constructor(handlers: SidebarHandlers) {
        this.#expanded = this.#buildExpanded(handlers);
        this.#folded = this.#buildFolded(handlers);
        this.#flyout = h("div", { class: "type-flyout" });

        this.el = h("aside", { class: "demo-sidebar" }, this.#expanded, this.#folded, this.#flyout);

        // Dismiss the folded flyout on any outside click.
        document.addEventListener("click", (e) => {
            if (!this.el.contains(e.target as Node)) this.#closeFlyout();
        });
    }

    setCollapsed(collapsed: boolean): void {
        if (this.#collapsed === collapsed) return;
        this.#collapsed = collapsed;
        this.el.classList.toggle("collapsed", collapsed);
        this.#closeFlyout();
    }

    /** Highlight the active sample (clears highlight for opened files/URLs). */
    setActiveDoc(path: string | null): void {
        if (this.#activePath) this.#docButtons.get(this.#activePath)?.classList.remove("active");
        this.#activePath = path;
        if (path) this.#docButtons.get(path)?.classList.add("active");
    }

    // --- expanded view ----------------------------------------------------

    #buildExpanded(handlers: SidebarHandlers): HTMLElement {
        const collapseBtn = h(
            "button",
            { class: "collapse-btn", type: "button", title: "Collapse", onclick: () => this.#toggleCollapsed() },
            svg(ICONS.chevronLeft),
        );

        const actions = h(
            "div",
            { class: "sidebar-actions" },
            h("button", { class: "demo-btn", type: "button", onclick: () => handlers.onOpenFile() }, svg(ICONS.openFile), "Open File"),
            h("button", { class: "demo-btn", type: "button", onclick: () => handlers.onOpenUrl() }, svg(ICONS.openUrl), "Open URL"),
        );

        const list = h("div", { class: "document-list" });
        for (const cat of SAMPLE_CATEGORIES) {
            list.appendChild(h("div", { class: "category-header" }, cat.label));
            for (const doc of cat.documents) list.appendChild(this.#docItem(cat, doc, handlers));
        }

        return h(
            "div",
            { class: "sidebar-expanded" },
            h("div", { class: "sidebar-head" }, collapseBtn),
            actions,
            h("div", { class: "panel-label" }, "Sample Documents"),
            list,
            h(
                "div",
                { class: "sidebar-foot" },
                h(
                    "button",
                    { class: "demo-btn options-btn", type: "button", onclick: () => handlers.onOpenOptions() },
                    svg(ICONS.gear),
                    "Options",
                ),
            ),
        );
    }

    #docItem(cat: SampleCategory, doc: SampleDoc, handlers: SidebarHandlers): HTMLButtonElement {
        const btn = h(
            "button",
            { class: "document-item", type: "button", onclick: () => handlers.onSelectDoc(doc) },
            svg(ICONS[cat.type], "0 0 24 24", `doc-icon ${cat.type}`),
            h("span", {}, doc.name),
        );
        this.#docButtons.set(doc.path, btn);
        return btn;
    }

    // --- folded view ------------------------------------------------------

    #buildFolded(handlers: SidebarHandlers): HTMLElement {
        const expandBtn = h(
            "button",
            { class: "rail-btn", type: "button", title: "Expand", onclick: () => this.#toggleCollapsed() },
            svg(ICONS.chevronRight),
        );
        const openFile = h(
            "button",
            { class: "rail-btn", type: "button", title: "Open File", onclick: () => handlers.onOpenFile() },
            svg(ICONS.openFile),
        );
        const openUrl = h(
            "button",
            { class: "rail-btn", type: "button", title: "Open URL", onclick: () => handlers.onOpenUrl() },
            svg(ICONS.openUrl),
        );

        const types = h("div", { class: "rail-types" });
        for (const cat of SAMPLE_CATEGORIES) {
            const btn = h(
                "button",
                {
                    class: `rail-btn type ${cat.type}`,
                    type: "button",
                    title: `${cat.label} Samples`,
                    onclick: (e: Event) => {
                        e.stopPropagation();
                        this.#openFlyout(cat, btn, handlers);
                    },
                },
                svg(ICONS[cat.type]),
                h("span", { class: "rail-type-label" }, cat.label),
            );
            types.appendChild(btn);
        }

        return h(
            "div",
            { class: "sidebar-folded" },
            expandBtn,
            openFile,
            openUrl,
            h("div", { class: "rail-divider" }),
            types,
            h(
                "button",
                {
                    class: "rail-btn options",
                    type: "button",
                    title: "Options",
                    onclick: () => handlers.onOpenOptions(),
                },
                svg(ICONS.gear),
            ),
        );
    }

    #openFlyout(cat: SampleCategory, anchor: HTMLElement, handlers: SidebarHandlers): void {
        const open = this.#flyout.classList.contains("open") && this.#flyout.dataset.type === cat.type;
        if (open) {
            this.#closeFlyout();
            return;
        }
        replaceChildren(
            this.#flyout,
            h("div", { class: "flyout-head" }, cat.label),
            ...cat.documents.map((doc) =>
                h(
                    "button",
                    {
                        class: "flyout-item",
                        type: "button",
                        onclick: () => {
                            handlers.onSelectDoc(doc);
                            this.#closeFlyout();
                        },
                    },
                    doc.name,
                ),
            ),
        );
        this.#flyout.dataset.type = cat.type;
        this.#flyout.style.top = `${anchor.offsetTop}px`;
        this.#flyout.classList.add("open");
    }

    #closeFlyout(): void {
        this.#flyout.classList.remove("open");
        delete this.#flyout.dataset.type;
    }

    #toggleCollapsed(): void {
        this.setCollapsed(!this.#collapsed);
    }
}
