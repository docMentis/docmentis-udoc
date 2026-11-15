// The right panel's Data tab: what a deck's text binds, as the engine reads its
// tags. Above, the deck's role, as its automation part gives it: a template,
// whose braces are read as tags, an instance filled from one, or a plain deck,
// whose braces are only text until it is made a template. Then, for a template
// alone, each binding once — a variable by its path, a repeat, a condition or a
// choice by its opening tag — with how many tags write it, in the order the
// text first holds it, and last the tags that are wrong, each as written with
// what is wrong with it. Choosing a row selects the next tag it stands for and
// brings its slide into view, round to the first again after the last. A plain
// deck shows a note in their place, and an instance nothing.

import type { Automation, SlideTag, TagError } from "@docmentis/udoc-wasm";
import type { Store } from "../../framework/index.js";
import { subscribeSelector } from "../../framework/index.js";
import type { Action } from "../actions.js";
import type { DataEntry, DataTags } from "../data-tags.js";
import type { UIState } from "../state.js";
import type { I18n, MessageKey } from "../i18n/index.js";

export interface DataPanelCallbacks {
    /** Select the next of `tags`, a row's, `key` naming the row. */
    onChoose: (key: string, tags: readonly SlideTag[]) => void;
}

/** The message saying what `error` is. */
function errorMessage(error: TagError): MessageKey {
    if (typeof error === "object") return "data.error.unexpected";
    switch (error) {
        case "unclosedTag":
            return "data.error.unclosedTag";
        case "unclosedQuote":
            return "data.error.unclosedQuote";
        case "empty":
            return "data.error.empty";
        case "unclosedPair":
            return "data.error.unclosedPair";
        case "unmatchedClose":
            return "data.error.unmatchedClose";
        case "misplacedOption":
            return "data.error.misplacedOption";
        case "splitPair":
            return "data.error.splitPair";
    }
}

export function createDataPanel(i18n: I18n, callbacks: DataPanelCallbacks) {
    const el = document.createElement("div");
    el.className = "udoc-data-panel";
    el.setAttribute("aria-label", i18n.t("rightPanel.data"));
    // The deck's role, once read: hidden until then.
    const role = document.createElement("div");
    role.className = "udoc-data-panel__role";
    role.hidden = true;
    const body = document.createElement("div");
    body.className = "udoc-data-panel__body";
    el.append(role, body);
    let unsubscribe: (() => void) | null = null;

    /** The deck's role, as `automation` gives it — nothing until the tags are
     *  read, so the role and the list show together. */
    function renderRole(tags: DataTags | null, automation: Automation | null): void {
        role.hidden = tags === null;
        if (tags === null) return;
        const kind = automation === null ? "plain" : "template" in automation.role ? "template" : "instance";
        role.dataset.role = kind;
        role.textContent = i18n.t(
            kind === "template" ? "data.template" : kind === "instance" ? "data.instance" : "data.plain",
        );
    }

    /** A note, in the list's place, saying `text`. */
    function note(text: string): HTMLElement {
        const empty = document.createElement("div");
        empty.className = "udoc-panel-placeholder";
        empty.textContent = text;
        return empty;
    }

    /** For a template, a row for each binding and a section for the tags that
     *  are wrong, or the placeholder for none of either; for a plain deck, the
     *  note that its braces are only text; nothing for an instance, or until
     *  the tags are read. */
    function render(tags: DataTags | null, automation: Automation | null): void {
        if (tags === null || (automation !== null && !("template" in automation.role))) {
            body.replaceChildren();
            return;
        }
        if (automation === null) {
            body.replaceChildren(note(i18n.t("data.plainNote")));
            return;
        }
        if (tags.entries.length === 0 && tags.errors.length === 0) {
            body.replaceChildren(note(i18n.t("data.none")));
            return;
        }
        const parts: HTMLElement[] = [];
        if (tags.entries.length > 0) {
            const list = document.createElement("div");
            list.className = "udoc-data-panel__tags";
            list.setAttribute("role", "list");
            list.append(...tags.entries.map(entryRow));
            parts.push(list);
        }
        if (tags.errors.length > 0) {
            const heading = document.createElement("div");
            heading.className = "udoc-data-panel__heading";
            heading.textContent = i18n.t("data.errors");
            const list = document.createElement("div");
            list.className = "udoc-data-panel__tags udoc-data-panel__tags--errors";
            list.setAttribute("role", "list");
            list.append(...tags.errors.map(errorRow));
            parts.push(heading, list);
        }
        body.replaceChildren(...parts);
    }

    /** A row: `text` in the code face, `aside` beside it, choosing `tags`. */
    function row(key: string, text: string, aside: string, tags: readonly SlideTag[]): HTMLElement {
        const item = document.createElement("div");
        item.setAttribute("role", "listitem");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "udoc-data-panel__tag";
        const name = document.createElement("span");
        name.className = "udoc-data-panel__text";
        name.textContent = text;
        const side = document.createElement("span");
        side.className = "udoc-data-panel__count";
        side.textContent = aside;
        button.append(name, side);
        button.addEventListener("click", () => callbacks.onChoose(key, tags));
        item.append(button);
        return item;
    }

    /** A binding's row: what it binds, and how many tags write it. */
    function entryRow(entry: DataEntry): HTMLElement {
        return row(entry.name, entry.name, String(entry.tags.length), entry.tags);
    }

    /** A wrong tag's row: as written, and what is wrong with it. */
    function errorRow(tag: SlideTag, index: number): HTMLElement {
        const message = tag.error ? i18n.t(errorMessage(tag.error)) : "";
        const item = row(`error:${index}:${tag.text}`, tag.text, message, [tag]);
        item.firstElementChild?.classList.add("udoc-data-panel__tag--error");
        return item;
    }

    function mount(container: HTMLElement, store: Store<UIState, Action>): void {
        container.appendChild(el);
        const show = ({ tags, automation }: { tags: DataTags | null; automation: Automation | null }) => {
            renderRole(tags, automation);
            render(tags, automation);
        };
        show({ tags: store.getState().dataTags, automation: store.getState().automation });
        unsubscribe = subscribeSelector(store, (s) => ({ tags: s.dataTags, automation: s.automation }), show, {
            equality: (a, b) => a.tags === b.tags && a.automation === b.automation,
        });
    }

    function destroy(): void {
        unsubscribe?.();
        unsubscribe = null;
        el.remove();
    }

    return { el, mount, destroy };
}

export type DataPanelComponent = ReturnType<typeof createDataPanel>;
