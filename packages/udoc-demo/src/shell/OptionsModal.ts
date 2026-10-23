import { h, svg } from "../dom.js";
import { ICONS } from "../icons.js";

export interface ToggleOption {
    kind: "toggle";
    id: string;
    label: string;
    hint?: string;
    default?: boolean;
}

export interface SelectOption {
    kind: "select";
    id: string;
    label: string;
    hint?: string;
    options: { value: string; label: string }[];
    default?: string;
}

export type OptionItem = ToggleOption | SelectOption;
export interface OptionGroup {
    title: string;
    items: OptionItem[];
}

/**
 * The advanced-options modal (gear → dialog). Spec-driven and reusable: the
 * caller hands it groups of toggles/selects and a change callback. Mirrors the
 * viewer demo's options modal so the two demos feel related. Each group folds
 * under its title, and starts folded.
 */
export class OptionsModal {
    readonly el: HTMLElement;

    constructor(groups: OptionGroup[], onChange: (id: string, value: boolean | string) => void) {
        const body = h("div", { class: "options-body" });
        for (const group of groups) {
            const groupEl = h(
                "details",
                { class: "options-group" },
                h("summary", { class: "options-group-title" }, svg(ICONS.chevronRight), group.title),
            );
            for (const item of group.items) groupEl.appendChild(this.#row(item, onChange));
            body.appendChild(groupEl);
        }

        const closeBtn = h(
            "button",
            { class: "options-close", type: "button", title: "Close", onclick: () => this.close() },
            svg(ICONS.close),
        );

        this.el = h(
            "div",
            {
                class: "options-overlay",
                onclick: (e: Event) => {
                    if (e.target === this.el) this.close();
                },
            },
            h(
                "div",
                { class: "options-modal", role: "dialog" },
                h(
                    "div",
                    { class: "options-modal-head" },
                    h("span", { class: "options-modal-title" }, "Options"),
                    closeBtn,
                ),
                body,
            ),
        );
    }

    #row(item: OptionItem, onChange: (id: string, value: boolean | string) => void): HTMLElement {
        const label = h("label", { class: "option-label" }, item.label);
        if (item.hint) label.appendChild(h("span", { class: "option-hint" }, ` (${item.hint})`));

        if (item.kind === "toggle") {
            const input = h("input", { type: "checkbox", onchange: () => onChange(item.id, input.checked) });
            if (item.default) input.checked = true;
            const toggle = h("label", { class: "option-toggle" }, input, h("span", { class: "slider" }));
            return h("div", { class: "option-row" }, label, toggle);
        }

        const select = h("select", { class: "option-select", onchange: () => onChange(item.id, select.value) });
        for (const o of item.options) {
            const opt = h("option", { value: o.value }, o.label);
            if (o.value === item.default) opt.selected = true;
            select.appendChild(opt);
        }
        return h("div", { class: "option-row" }, label, select);
    }

    open(): void {
        this.el.classList.add("open");
    }

    close(): void {
        this.el.classList.remove("open");
    }
}
