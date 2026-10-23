import { h, svg, replaceChildren } from "../dom.js";
import { ICONS } from "../icons.js";
import { MODES, type Mode } from "../types.js";
import type { Theme } from "../theme.js";

export interface HeaderHandlers {
    onModeChange(mode: Mode): void;
    onToggleTheme(): void;
}

/**
 * The demo header — a thin frosted bar that replaces the docMentis site header.
 * Mirrors the site's `Header.tsx`: `doc`+`Mentis` logo on the left, an indigo
 * accent, and npm/GitHub links on the right. The center hosts the mode switcher
 * and the right side carries the theme toggle. The options open from the
 * sidebar's foot.
 */
export class Header {
    readonly el: HTMLElement;
    readonly #modeButtons = new Map<Mode, HTMLButtonElement>();
    readonly #themeBtn: HTMLButtonElement;

    constructor(handlers: HeaderHandlers) {
        // Identical markup to the site's `Logo` component: DM Sans bold text,
        // `doc` in slate-900, `Mentis` in indigo-600.
        const logo = h(
            "a",
            { class: "logo", href: "https://www.docmentis.com", title: "docMentis" },
            h(
                "span",
                { class: "logo-text" },
                h("span", { class: "logo-doc" }, "doc"),
                h("span", { class: "logo-mentis" }, "Mentis"),
            ),
        );

        const modeSwitch = h("div", { class: "mode-switch", role: "tablist" });
        for (const m of MODES) {
            const btn = h(
                "button",
                {
                    class: "mode-btn",
                    type: "button",
                    role: "tab",
                    title: m.label,
                    onclick: () => handlers.onModeChange(m.id),
                },
                svg(ICONS[m.icon]),
                h("span", {}, m.label),
            );
            this.#modeButtons.set(m.id, btn);
            modeSwitch.appendChild(btn);
        }

        this.#themeBtn = h(
            "button",
            { class: "icon-btn", type: "button", title: "Toggle Theme", onclick: () => handlers.onToggleTheme() },
            svg(ICONS.moon),
        );
        const npm = h(
            "a",
            { class: "icon-btn link", href: "https://www.npmjs.com/org/docmentis", target: "_blank", rel: "noopener", title: "npm" },
            svg(ICONS.npm),
        );
        const github = h(
            "a",
            { class: "icon-btn link", href: "https://github.com/docMentis", target: "_blank", rel: "noopener", title: "GitHub" },
            svg(ICONS.github),
        );

        // Logo left, mode switcher centered, demo controls + links on the right.
        this.el = h(
            "header",
            { class: "demo-header" },
            h("div", { class: "header-left" }, logo),
            modeSwitch,
            h("div", { class: "header-right" }, this.#themeBtn, npm, github),
        );
    }

    /** Reflect the active mode in the switcher (when set programmatically). */
    setMode(mode: Mode): void {
        for (const [id, btn] of this.#modeButtons) btn.classList.toggle("active", id === mode);
    }

    /** Swap the theme-toggle glyph to match the *current* theme. */
    setTheme(theme: Theme): void {
        replaceChildren(this.#themeBtn, svg(theme === "dark" ? ICONS.sun : ICONS.moon));
    }
}
