// The right panel's Data tab: the tags written in a deck's text, as the
// automation that fills the deck reads them — each tag once, by what is
// written inside its braces, with how many times the text holds it, in the
// order the text first holds each. Choosing a tag selects the next place it is
// written and brings it into view, round to the first again after the last.
//
// Above the list stands the deck's role, as its automation part gives it: a
// template, whose braces the automation reads as tags, an instance filled from
// one, or a plain deck, whose braces are only text until it is made a template.

import type { Store } from "../../framework/index.js";
import { subscribeSelector } from "../../framework/index.js";
import type { Automation } from "@docmentis/udoc-wasm";
import type { Action } from "../actions.js";
import type { DataTag } from "../data-tags.js";
import type { UIState } from "../state.js";
import type { I18n } from "../i18n/index.js";

export interface DataPanelCallbacks {
    /** Select the next place `tag` is written, and bring it into view. */
    onChoose: (tag: DataTag) => void;
}

export function createDataPanel(i18n: I18n, callbacks: DataPanelCallbacks) {
    const el = document.createElement("div");
    el.className = "udoc-data-panel";
    el.setAttribute("aria-label", i18n.t("rightPanel.data"));
    // The deck's role, once read: hidden until then.
    const role = document.createElement("div");
    role.className = "udoc-data-panel__role";
    role.hidden = true;
    const list = document.createElement("div");
    list.className = "udoc-data-panel__tags";
    list.setAttribute("role", "list");
    el.append(role, list);
    let unsubscribe: (() => void) | null = null;

    /** The deck's role, as `automation` gives it — nothing until the tags are
     *  read, which `automation` is read with. */
    function renderRole(tags: readonly DataTag[] | null, automation: Automation | null): void {
        role.hidden = tags === null;
        if (tags === null) return;
        const kind = automation === null ? "plain" : "template" in automation.role ? "template" : "instance";
        role.dataset.role = kind;
        role.textContent = i18n.t(
            kind === "template" ? "data.template" : kind === "instance" ? "data.instance" : "data.plain",
        );
    }

    /** A row for each of `tags`, or the placeholder in the list's place for
     *  none; nothing until they are read. */
    function render(tags: readonly DataTag[] | null): void {
        if (tags === null) {
            list.replaceChildren();
            el.replaceChildren(role, list);
            return;
        }
        if (tags.length === 0) {
            const empty = document.createElement("div");
            empty.className = "udoc-panel-placeholder";
            empty.textContent = i18n.t("data.none");
            el.replaceChildren(role, empty);
            return;
        }
        list.replaceChildren(...tags.map(row));
        el.replaceChildren(role, list);
    }

    /** `tag`'s row: what its braces hold, and how many times it is written. */
    function row(tag: DataTag): HTMLElement {
        const item = document.createElement("div");
        item.setAttribute("role", "listitem");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "udoc-data-panel__tag";
        const text = document.createElement("span");
        text.className = "udoc-data-panel__text";
        text.textContent = tag.tag;
        const count = document.createElement("span");
        count.className = "udoc-data-panel__count";
        count.textContent = String(tag.matches.length);
        button.append(text, count);
        button.addEventListener("click", () => callbacks.onChoose(tag));
        item.append(button);
        return item;
    }

    function mount(container: HTMLElement, store: Store<UIState, Action>): void {
        container.appendChild(el);
        const state = store.getState();
        renderRole(state.dataTags, state.dataAutomation);
        render(state.dataTags);
        const unsubscribeTags = subscribeSelector(store, (s) => s.dataTags, render);
        const unsubscribeRole = subscribeSelector(
            store,
            (s) => ({ tags: s.dataTags, automation: s.dataAutomation }),
            ({ tags, automation }) => renderRole(tags, automation),
            { equality: (a, b) => a.tags === b.tags && a.automation === b.automation },
        );
        unsubscribe = () => {
            unsubscribeTags();
            unsubscribeRole();
        };
    }

    function destroy(): void {
        unsubscribe?.();
        unsubscribe = null;
        el.remove();
    }

    return { el, mount, destroy };
}

export type DataPanelComponent = ReturnType<typeof createDataPanel>;
