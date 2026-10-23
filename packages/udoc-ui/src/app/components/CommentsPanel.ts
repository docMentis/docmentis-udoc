// The right panel's Comments tab: every comment in the document, as Acrobat
// lists them — grouped by page, each a thread, in the thread view the comment
// popup shows one in.
//
// A thread shows its comment and a count of its replies; the thread of the
// annotation selected is open, its replies nested under it, and any entry of
// it may be replied to. Choosing a thread goes to its comment — the view lands
// with its rect at the viewport's top-left, as a PDF destination does — and
// selects it, which opens it here and on the page. Its entries are edited,
// replied to and deleted here as in the popup.

import type { Store } from "../../framework/index.js";
import { subscribeSelector } from "../../framework/index.js";
import type { PageComments } from "../../worker/protocol.js";
import type { Action } from "../actions.js";
import type { Comment } from "../annotations.js";
import { commentThreads, threadHolding } from "../annotations.js";
import { ICON_CHEVRON_DOWN } from "../icons.js";
import type { UIState } from "../state.js";
import { createCommentThread } from "./CommentThread.js";
import type { CommentThreadCallbacks, CommentThreadView } from "./CommentThread.js";
import type { I18n } from "../i18n/index.js";

export interface CommentsPanelCallbacks extends CommentThreadCallbacks {
    /** Go to `comment` and select it. */
    onChoose: (comment: Comment) => void;
}

interface CommentsPanelSlice {
    comments: ReadonlyMap<string, PageComments>;
    allRead: boolean;
    /** The selection's page and annotation ids, or null for none. */
    selected: { page: string; ids: readonly string[] } | null;
    /** Whether the session may annotate — without it, every thread only reads. */
    annotating: boolean;
}

function selectSlice(state: UIState): CommentsPanelSlice {
    const selected = state.selectedAnnotations;
    return {
        comments: state.comments,
        allRead: state.allCommentsRead,
        selected: selected && {
            page: selected.page,
            ids: selected.annotations.flatMap((a) => (a.id === undefined ? [] : [a.id])),
        },
        annotating: state.features.includes("annotation"),
    };
}

function sliceEqual(a: CommentsPanelSlice, b: CommentsPanelSlice): boolean {
    return (
        a.comments === b.comments &&
        a.allRead === b.allRead &&
        a.annotating === b.annotating &&
        a.selected?.page === b.selected?.page &&
        (a.selected?.ids.join() ?? "") === (b.selected?.ids.join() ?? "")
    );
}

/** A page's group: its header — its number and how many threads it holds,
 *  folding the group — and its threads' cards. */
interface Group {
    el: HTMLElement;
    header: HTMLButtonElement;
    label: HTMLSpanElement;
    count: HTMLSpanElement;
}

/** A thread's card: its view, and the thread it shows now — read by the
 *  card's click handler, which is set once. */
interface Card {
    el: HTMLElement;
    view: CommentThreadView;
    thread: Comment;
}

export function createCommentsPanel(i18n: I18n, callbacks: CommentsPanelCallbacks) {
    const el = document.createElement("div");
    el.className = "udoc-comments-panel";
    el.setAttribute("aria-label", i18n.t("rightPanel.comments"));
    const empty = document.createElement("div");
    empty.className = "udoc-panel-placeholder";

    /** The cards by their comment's id, kept while it is listed so an edit in
     *  progress stays. */
    const cards = new Map<string, Card>();
    /** The page groups by page key, kept as the cards are. */
    const groups = new Map<string, Group>();
    /** The pages whose group is collapsed, by key. */
    const collapsed = new Set<string>();
    /** The thread last shown open, so it is scrolled into view once. */
    let revealed: string | null = null;
    let last: CommentsPanelSlice | null = null;
    let unsubscribe: (() => void) | null = null;

    function cardFor(thread: Comment): Card {
        const key = thread.annotation.id ?? "";
        const existing = cards.get(key);
        if (existing) {
            existing.thread = thread;
            return existing;
        }
        const card: Card = {
            el: document.createElement("div"),
            view: createCommentThread(i18n, callbacks),
            thread,
        };
        card.el.className = "udoc-comments-panel__card";
        card.el.append(card.view.el);
        // A click on the card chooses its thread; one in a field or on a
        // button is that control's.
        card.el.addEventListener("click", (ev) => {
            const target = ev.target as HTMLElement;
            if (target.closest("button, [contenteditable='true']")) return;
            callbacks.onChoose(card.thread);
        });
        cards.set(key, card);
        return card;
    }

    function groupFor(page: string): Group {
        const existing = groups.get(page);
        if (existing) return existing;
        const group: Group = {
            el: document.createElement("div"),
            header: document.createElement("button"),
            label: document.createElement("span"),
            count: document.createElement("span"),
        };
        group.el.className = "udoc-comments-panel__page";
        group.header.className = "udoc-comments-panel__page-header";
        group.count.className = "udoc-comments-panel__count";
        group.header.innerHTML = ICON_CHEVRON_DOWN;
        group.header.append(group.label, group.count);
        group.header.addEventListener("click", () => {
            if (collapsed.has(page)) collapsed.delete(page);
            else collapsed.add(page);
            if (last) render(last);
        });
        groups.set(page, group);
        return group;
    }

    function render(slice: CommentsPanelSlice): void {
        last = slice;
        const pages = [...slice.comments.values()].sort((a, b) => a.index - b.index);
        const shownGroups: HTMLElement[] = [];
        const listed = new Set<string>();
        let open: Card | null = null;
        for (const page of pages) {
            const threads = commentThreads(page);
            if (threads.length === 0) continue;
            const selected = new Set(
                slice.selected?.page === page.page
                    ? slice.selected.ids.map((id) => threadHolding(threads, page, id))
                    : [],
            );
            const group = groupFor(page.page);
            const folded = collapsed.has(page.page);
            group.el.classList.toggle("udoc-comments-panel__page--collapsed", folded);
            group.header.setAttribute("aria-expanded", String(!folded));
            group.label.textContent = i18n.t("comments.page", { page: page.index + 1 });
            group.count.textContent = String(threads.length);
            const children: HTMLElement[] = [group.header];
            for (const thread of threads) {
                const card = cardFor(thread);
                listed.add(thread.annotation.id ?? "");
                const isOpen = selected.has(thread);
                card.el.classList.toggle("udoc-comments-panel__card--selected", isOpen);
                card.view.show(thread, isOpen, slice.annotating);
                if (isOpen) open = card;
                if (!folded) children.push(card.el);
            }
            setChildren(group.el, children);
            shownGroups.push(group.el);
        }
        for (const key of cards.keys()) if (!listed.has(key)) cards.delete(key);
        for (const key of groups.keys()) if (!slice.comments.has(key)) groups.delete(key);

        empty.textContent = i18n.t(slice.allRead ? "comments.empty" : "comments.loading");
        setChildren(el, shownGroups.length > 0 ? shownGroups : [empty]);
        // The thread selected on the page is brought into view here, once.
        const openKey = open?.thread.annotation.id ?? null;
        if (open && openKey !== revealed) open.el.scrollIntoView({ block: "nearest" });
        revealed = openKey;
    }

    function mount(container: HTMLElement, store: Store<UIState, Action>): void {
        container.appendChild(el);
        render(selectSlice(store.getState()));
        unsubscribe = subscribeSelector(store, selectSlice, render, { equality: sliceEqual });
    }

    function destroy(): void {
        unsubscribe?.();
        unsubscribe = null;
        el.remove();
    }

    return { el, mount, destroy };
}

export type CommentsPanelComponent = ReturnType<typeof createCommentsPanel>;

/** Give `parent` `children`, in order — left as it is when it has them, as
 *  moving a node takes the keyboard from a field in it. */
function setChildren(parent: HTMLElement, children: readonly HTMLElement[]): void {
    const same = children.length === parent.children.length && children.every((c, i) => parent.children[i] === c);
    if (!same) parent.replaceChildren(...children);
}
