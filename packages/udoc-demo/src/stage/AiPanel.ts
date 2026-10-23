import { h, svg } from "../dom.js";
import { ICONS } from "../icons.js";

/**
 * The AI panel for the Co-edit with AI demo mode — a placeholder until the
 * assistant lands. Demo code, not part of the editor.
 */
export function aiPanel(): HTMLElement {
    const head = h(
        "div",
        { class: "chat-head" },
        h(
            "div",
            { class: "chat-title-row" },
            svg(ICONS.sparkle, "0 0 24 24", "chat-spark"),
            h("span", { class: "chat-title" }, "AI Assistant"),
        ),
    );
    return h("div", { class: "chat-panel" }, head, h("div", { class: "chat-soon" }, "Coming soon"));
}
