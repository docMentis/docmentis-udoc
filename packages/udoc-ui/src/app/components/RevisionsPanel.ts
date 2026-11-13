// The right panel's Revisions tab: a word document's tracked changes, as Word
// lists them beside the page — grouped by page and a card per change, in
// reading order, laid out as the Comments tab's groups and cards are: who made
// it and when, what kind of change it is, and the text it is on, under the
// buttons edit mode offers on it (Accept and Reject). Choosing a card selects
// that change and brings it into view, as Next lands on one; the cards of the
// changes the selection touches are marked, as the selected comment's card is.

import type { Store } from "../../framework/index.js";
import { subscribeSelector } from "../../framework/index.js";
import type { RevisionGroup, RevisionGroupKind } from "@docmentis/udoc-wasm";
import type { RevisionAction } from "../../extension.js";
import type { ListedRevisionGroup } from "../../worker/protocol.js";
import type { Action } from "../actions.js";
import { parseDateTime } from "../annotations.js";
import { ICON_CHEVRON_DOWN } from "../icons.js";
import type { UIState } from "../state.js";
import type { I18n, MessageKey } from "../i18n/index.js";
import { showDate } from "./CommentThread.js";
import { createButton } from "./controls.js";

export interface RevisionsPanelCallbacks {
    /** Select `group` and bring it into view. */
    onChoose: (group: RevisionGroup) => void;
    /** The buttons each card offers on its change in `state` — edit mode's
     *  Accept and Reject — or none. */
    actions: (state: UIState) => readonly RevisionAction[];
}

/** What each kind of change reads as on its card. */
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

interface RevisionsPanelSlice {
    groups: readonly ListedRevisionGroup[] | null;
    selected: readonly string[];
    mode: string;
}

function selectSlice(state: UIState): RevisionsPanelSlice {
    return { groups: state.revisionGroups, selected: state.selectionRevisionIds, mode: state.mode };
}

/** A change's card, and the change it shows. */
interface Card {
    el: HTMLElement;
    group: RevisionGroup;
}

export function createRevisionsPanel(i18n: I18n, callbacks: RevisionsPanelCallbacks) {
    const el = document.createElement("div");
    el.className = "udoc-revisions-panel";
    el.setAttribute("aria-label", i18n.t("rightPanel.revisions"));
    let cards: Card[] = [];
    /** The pages whose group is folded, by page — `null` for the changes on
     *  none. */
    const collapsed = new Set<number | null>();
    /** The card last scrolled to as marked, so it is scrolled into view once. */
    let revealed: Card | null = null;
    let last: RevisionsPanelSlice | null = null;
    let unsubscribe: (() => void) | null = null;

    /** Lay out a group per page and a card per change in it, with the buttons
     *  `actions` offers. */
    function renderCards(groups: readonly ListedRevisionGroup[] | null, actions: readonly RevisionAction[]): void {
        cards = [];
        revealed = null;
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
        const pages = new Map<number | null, ListedRevisionGroup[]>();
        for (const listed of groups) {
            const on = pages.get(listed.page);
            if (on) on.push(listed);
            else pages.set(listed.page, [listed]);
        }
        const sections: HTMLElement[] = [];
        for (const [page, listed] of pages) {
            const section = document.createElement("div");
            section.className = "udoc-revisions-panel__page";
            const list = document.createElement("div");
            list.className = "udoc-revisions-panel__cards";
            list.setAttribute("role", "list");
            const pageCards = listed.map(({ group }) => ({ el: card(group, actions), group }));
            cards.push(...pageCards);
            list.append(...pageCards.map((c) => c.el));
            if (page !== null) section.append(pageHeader(page, listed.length, section));
            section.append(list);
            section.classList.toggle("udoc-revisions-panel__page--collapsed", collapsed.has(page));
            sections.push(section);
        }
        el.replaceChildren(summary, ...sections);
    }

    /** Page `page`'s header — its number and how many changes stand on it —
     *  folding `section`, as a comment page's does. */
    function pageHeader(page: number, count: number, section: HTMLElement): HTMLElement {
        const header = document.createElement("button");
        header.type = "button";
        header.className = "udoc-revisions-panel__page-header";
        header.innerHTML = ICON_CHEVRON_DOWN;
        const label = document.createElement("span");
        label.textContent = i18n.t("comments.page", { page: page + 1 });
        const counted = document.createElement("span");
        counted.className = "udoc-revisions-panel__count";
        counted.textContent = String(count);
        header.append(label, counted);
        header.setAttribute("aria-expanded", String(!collapsed.has(page)));
        header.addEventListener("click", () => {
            if (collapsed.has(page)) collapsed.delete(page);
            else collapsed.add(page);
            const folded = collapsed.has(page);
            section.classList.toggle("udoc-revisions-panel__page--collapsed", folded);
            header.setAttribute("aria-expanded", String(!folded));
        });
        return header;
    }

    /** `group`'s card: its author and date over its kind and its text, then
     *  the buttons `actions` offers on it. */
    function card(group: RevisionGroup, actions: readonly RevisionAction[]): HTMLElement {
        const item = document.createElement("div");
        item.className = "udoc-revisions-panel__card";
        item.setAttribute("role", "listitem");
        item.tabIndex = 0;
        const entry = document.createElement("div");
        entry.className = "udoc-comment";
        const header = document.createElement("div");
        header.className = "udoc-comment__header";
        const kind = document.createElement("span");
        kind.className = "udoc-revisions-panel__kind";
        kind.textContent = i18n.t(KIND_LABEL[group.kind]);
        const author = document.createElement("span");
        author.className = "udoc-comment__author";
        author.textContent = group.author ?? "";
        const date = document.createElement("span");
        date.className = "udoc-comment__date";
        showDate(date, group.date ? parseDateTime(group.date) : null, i18n.locale);
        header.append(kind, author, date);
        entry.append(header);
        if (group.text) {
            const text = document.createElement("div");
            text.className = "udoc-revisions-panel__text";
            text.textContent = group.text;
            entry.append(text);
        }
        if (actions.length > 0) {
            const row = document.createElement("div");
            row.className = "udoc-comment__actions";
            for (const action of actions) {
                const button = createButton({ icon: action.icon, label: i18n.t(action.label as MessageKey) });
                button.addEventListener("click", (ev) => {
                    ev.stopPropagation();
                    action.run(group);
                });
                row.append(button);
            }
            entry.append(row);
        }
        item.append(entry);
        const choose = () => callbacks.onChoose(group);
        item.addEventListener("click", choose);
        item.addEventListener("keydown", (ev) => {
            if (ev.target !== item || (ev.key !== "Enter" && ev.key !== " ")) return;
            ev.preventDefault();
            choose();
        });
        return item;
    }

    /** Mark the cards of the changes the selection touches, `selected` by
     *  their records' ids, and bring the first into view once. */
    function mark(selected: readonly string[]): void {
        const ids = new Set(selected);
        let first: Card | null = null;
        for (const c of cards) {
            const marked = c.group.ids.some((id) => ids.has(id));
            c.el.classList.toggle("udoc-revisions-panel__card--selected", marked);
            if (marked) first ??= c;
        }
        if (first && first !== revealed) first.el.scrollIntoView({ block: "nearest" });
        revealed = first;
    }

    function render(slice: RevisionsPanelSlice, store: Store<UIState, Action>): void {
        if (last === null || slice.groups !== last.groups || slice.mode !== last.mode) {
            renderCards(slice.groups, callbacks.actions(store.getState()));
        }
        mark(slice.selected);
        last = slice;
    }

    function mount(container: HTMLElement, store: Store<UIState, Action>): void {
        container.appendChild(el);
        render(selectSlice(store.getState()), store);
        unsubscribe = subscribeSelector(store, selectSlice, (slice) => render(slice, store), {
            equality: (a, b) => a.groups === b.groups && a.selected === b.selected && a.mode === b.mode,
        });
    }

    /** The marked card — the first change the selection is in — and the
     *  height the tether lands on it at, its header's middle, as client
     *  rects; null with none marked. */
    function selectedCard(): { rect: DOMRect; y: number } | null {
        const marked = el.querySelector(".udoc-revisions-panel__card--selected");
        if (!marked) return null;
        const header = (marked.querySelector(".udoc-comment__header") ?? marked).getBoundingClientRect();
        return { rect: marked.getBoundingClientRect(), y: header.top + header.height / 2 };
    }

    function destroy(): void {
        unsubscribe?.();
        unsubscribe = null;
        el.remove();
    }

    return { el, mount, selectedCard, destroy };
}

export type RevisionsPanelComponent = ReturnType<typeof createRevisionsPanel>;
