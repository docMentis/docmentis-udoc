// The right panel's Revisions tab: a word document's tracked changes, as Word
// lists them beside the page — one row per change, in reading order, each with
// what kind of change it is, who made it and when, and the text it is on.
// Choosing a row selects that change and brings it into view, as Next lands on
// one.

import type { Store } from "../../framework/index.js";
import { subscribeSelector } from "../../framework/index.js";
import type { RevisionGroup, RevisionGroupKind } from "@docmentis/udoc-wasm";
import type { Action } from "../actions.js";
import { parseDateTime } from "../annotations.js";
import type { UIState } from "../state.js";
import type { I18n, MessageKey } from "../i18n/index.js";

export interface RevisionsPanelCallbacks {
    /** Select `group` and bring it into view. */
    onChoose: (group: RevisionGroup) => void;
}

/** What each kind of change reads as on its row. */
const KIND_LABEL: Record<RevisionGroupKind, MessageKey> = {
    insertion: "revisions.insertion",
    deletion: "revisions.deletion",
    move: "revisions.move",
    formatting: "revisions.formatting",
    paragraphFormatting: "revisions.paragraphFormatting",
    rowInsertion: "revisions.rowInsertion",
    rowDeletion: "revisions.rowDeletion",
    cellInsertion: "revisions.cellInsertion",
    cellDeletion: "revisions.cellDeletion",
    cellMerge: "revisions.cellMerge",
    tableFormatting: "revisions.tableFormatting",
};

export function createRevisionsPanel(i18n: I18n, callbacks: RevisionsPanelCallbacks) {
    const el = document.createElement("div");
    el.className = "udoc-revisions-panel";
    el.setAttribute("aria-label", i18n.t("rightPanel.revisions"));
    let unsubscribe: (() => void) | null = null;

    function render(groups: readonly RevisionGroup[] | null): void {
        if (groups === null) {
            el.replaceChildren();
            return;
        }
        if (groups.length === 0) {
            const empty = document.createElement("div");
            empty.className = "udoc-panel-placeholder";
            empty.textContent = i18n.t("revisions.none");
            el.replaceChildren(empty);
            return;
        }
        const summary = document.createElement("div");
        summary.className = "udoc-revisions-panel__summary";
        summary.textContent = i18n.t("revisions.count", { count: groups.length });
        const list = document.createElement("div");
        list.className = "udoc-revisions-panel__list";
        list.setAttribute("role", "list");
        list.append(...groups.map(row));
        el.replaceChildren(summary, list);
    }

    /** `group`'s row: its kind and author over its date, then its text. */
    function row(group: RevisionGroup): HTMLElement {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "udoc-revisions-panel__row";
        item.setAttribute("role", "listitem");
        const head = document.createElement("div");
        head.className = "udoc-revisions-panel__head";
        const kind = document.createElement("span");
        kind.className = "udoc-revisions-panel__kind";
        kind.textContent = i18n.t(KIND_LABEL[group.kind]);
        head.append(kind);
        if (group.author) {
            const author = document.createElement("span");
            author.className = "udoc-revisions-panel__author";
            author.textContent = group.author;
            head.append(author);
        }
        item.append(head);
        const when = group.date ? parseDateTime(group.date) : null;
        if (when) {
            const date = document.createElement("div");
            date.className = "udoc-revisions-panel__date";
            date.lang = i18n.locale;
            date.textContent = new Intl.DateTimeFormat(i18n.locale, {
                dateStyle: "medium",
                timeStyle: "short",
            }).format(when);
            item.append(date);
        }
        if (group.text) {
            const text = document.createElement("div");
            text.className = "udoc-revisions-panel__text";
            text.textContent = group.text;
            item.append(text);
        }
        item.addEventListener("click", () => callbacks.onChoose(group));
        return item;
    }

    function mount(container: HTMLElement, store: Store<UIState, Action>): void {
        container.appendChild(el);
        render(store.getState().revisionGroups);
        unsubscribe = subscribeSelector(store, (s) => s.revisionGroups, render);
    }

    function destroy(): void {
        unsubscribe?.();
        unsubscribe = null;
        el.remove();
    }

    return { el, mount, destroy };
}

export type RevisionsPanelComponent = ReturnType<typeof createRevisionsPanel>;
