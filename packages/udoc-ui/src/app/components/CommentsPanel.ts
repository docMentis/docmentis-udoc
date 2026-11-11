// The right panel's Comments tab: every comment in the document, as Acrobat
// lists them — grouped by page, each a thread, in the thread view the comment
// popup shows one in. A Word, Excel or PowerPoint document's are listed the
// same way, grouped by page, by cell or by slide; where they may be written,
// New comment opens a field above them for a new thread's first comment.
//
// A thread shows its comment and a count of its replies; the thread of the
// annotation selected is open, its replies nested under it, and any entry of
// it may be replied to. Choosing a thread goes to its comment — the view lands
// with its rect at the viewport's top-left, as a PDF destination does — and
// selects it, which opens it here and on the page. Its entries are edited,
// replied to and deleted here as in the popup.

import type { Store } from "../../framework/index.js";
import { subscribeSelector } from "../../framework/index.js";
import type { CommentGroup, OfficeComment, PageComments } from "../../worker/protocol.js";
import type { Action } from "../actions.js";
import type { Comment } from "../annotations.js";
import { commentThreads, officeThreads, threadHolding } from "../annotations.js";
import { ICON_CHEVRON_DOWN } from "../icons.js";
import type { UIState } from "../state.js";
import { VIEW_MODE } from "../state.js";
import { createCommentThread, createReplyField } from "./CommentThread.js";
import type { CommentThreadCallbacks, CommentThreadView, ReplyFieldWords } from "./CommentThread.js";
import { createButton } from "./controls.js";
import type { I18n } from "../i18n/index.js";

export interface CommentsPanelCallbacks extends CommentThreadCallbacks {
    /** Go to `comment` and select it. */
    onChoose: (comment: Comment) => void;
    /** Hide the line from the open comment to its card, or show it again: the
     *  selected card chosen again. */
    onToggleTether: () => void;
    /** Open a thread whose first comment holds `richContents` (XHTML), on
     *  what the document has selected. */
    onNewComment: (richContents: string) => void;
}

interface CommentsPanelSlice {
    comments: ReadonlyMap<string, PageComments>;
    /** A Word, Excel or PowerPoint document's comments, once read. */
    office: readonly OfficeComment[] | null;
    /** The Office thread open, by its first comment's id. */
    openOffice: string | null;
    allRead: boolean;
    /** The selection's page and annotation ids, or null for none. */
    selected: { page: string; ids: readonly string[] } | null;
    /** Whether the session may annotate — without it, every PDF thread only
     *  reads. */
    annotating: boolean;
    /** Whether an Office thread may be written: in an editing mode, on a
     *  document whose comment edits are built. */
    officeEditing: boolean;
}

function selectSlice(state: UIState): CommentsPanelSlice {
    const selected = state.selectedAnnotations;
    return {
        comments: state.comments,
        office: state.officeComments,
        openOffice: state.openOfficeComment,
        allRead: state.allCommentsRead || state.officeComments !== null,
        selected: selected && {
            page: selected.page,
            ids: selected.annotations.flatMap((a) => (a.id === undefined ? [] : [a.id])),
        },
        annotating: state.features.includes("annotation"),
        officeEditing: state.mode !== VIEW_MODE && OFFICE_EDITED_DOC_TYPES.has(state.docType ?? ""),
    };
}

function sliceEqual(a: CommentsPanelSlice, b: CommentsPanelSlice): boolean {
    return (
        a.comments === b.comments &&
        a.office === b.office &&
        a.openOffice === b.openOffice &&
        a.allRead === b.allRead &&
        a.annotating === b.annotating &&
        a.officeEditing === b.officeEditing &&
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

/** The words of the field that writes a new thread's first comment. */
const NEW_COMMENT_WORDS: ReplyFieldWords = { field: "comments.new", save: "common.save", cancel: "common.cancel" };

/** The doc types whose Office comments may be edited — those whose comment
 *  commands are built. */
const OFFICE_EDITED_DOC_TYPES: ReadonlySet<string> = new Set(["presentation"]);

export function createCommentsPanel(i18n: I18n, callbacks: CommentsPanelCallbacks) {
    const el = document.createElement("div");
    el.className = "udoc-comments-panel";
    el.setAttribute("aria-label", i18n.t("rightPanel.comments"));
    const empty = document.createElement("div");
    empty.className = "udoc-panel-placeholder";

    // New comment, and the field it opens in its place: Save opens the thread,
    // Save and Cancel each put the button back.
    const compose = document.createElement("div");
    compose.className = "udoc-comments-panel__new";
    const start = createButton({ text: i18n.t("comments.new"), label: i18n.t("comments.new") });
    const field = createReplyField(i18n, NEW_COMMENT_WORDS, {
        save: (richContents) => {
            closeField();
            callbacks.onNewComment(richContents);
        },
        cancel: closeField,
    });
    function closeField(): void {
        field.clear();
        compose.replaceChildren(start);
    }
    start.addEventListener("click", () => {
        compose.replaceChildren(field.el);
        field.focus();
    });
    compose.append(start);

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
        const key = thread.id;
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
            if (card.el.classList.contains("udoc-comments-panel__card--selected")) callbacks.onToggleTether();
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
        group.header.type = "button";
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

    /** What a group's header names it by. */
    function labelOf(group: CommentGroup): string {
        const { label } = group;
        if ("page" in label) return i18n.t("comments.page", { page: label.page });
        if ("slide" in label) return i18n.t("comments.slide", { slide: label.slide });
        return i18n.t("comments.cell", { sheet: label.sheet, cell: label.cell });
    }

    function render(slice: CommentsPanelSlice): void {
        last = slice;
        const shownGroups: HTMLElement[] = [];
        const listed = new Set<string>();
        const keys = new Set<string>();
        let open: Card | null = null;
        for (const { group: listing, threads, selected } of listedGroups(slice)) {
            keys.add(listing.key);
            const group = groupFor(listing.key);
            const folded = collapsed.has(listing.key);
            group.el.classList.toggle("udoc-comments-panel__page--collapsed", folded);
            group.header.setAttribute("aria-expanded", String(!folded));
            group.label.textContent = labelOf(listing);
            group.count.textContent = String(threads.length);
            const children: HTMLElement[] = [group.header];
            for (const thread of threads) {
                const card = cardFor(thread);
                listed.add(thread.id);
                const isOpen = selected.has(thread);
                card.el.classList.toggle("udoc-comments-panel__card--selected", isOpen);
                card.view.show(
                    thread,
                    isOpen,
                    thread.source.kind === "annotation" ? slice.annotating : slice.officeEditing,
                );
                if (isOpen) open = card;
                if (!folded) children.push(card.el);
            }
            setChildren(group.el, children);
            shownGroups.push(group.el);
        }
        for (const key of cards.keys()) if (!listed.has(key)) cards.delete(key);
        for (const key of groups.keys()) if (!keys.has(key)) groups.delete(key);

        empty.textContent = i18n.t(slice.allRead ? "comments.empty" : "comments.loading");
        const listing = shownGroups.length > 0 ? shownGroups : [empty];
        setChildren(el, slice.officeEditing ? [compose, ...listing] : listing);
        // The thread selected on the page is brought into view here, once.
        const openKey = open?.thread.id ?? null;
        if (open && openKey !== revealed) open.el.scrollIntoView({ block: "nearest" });
        revealed = openKey;
    }

    function mount(container: HTMLElement, store: Store<UIState, Action>): void {
        container.appendChild(el);
        render(selectSlice(store.getState()));
        unsubscribe = subscribeSelector(store, selectSlice, render, { equality: sliceEqual });
    }

    /** The selected thread's card and the height of its first comment's
     *  header — where the comment tether lands — as client rects; null with
     *  none selected. */
    function selectedCard(): { rect: DOMRect; y: number } | null {
        const card = el.querySelector(".udoc-comments-panel__card--selected");
        if (!card) return null;
        const header = (card.querySelector(".udoc-comment__header") ?? card).getBoundingClientRect();
        return { rect: card.getBoundingClientRect(), y: header.top + header.height / 2 };
    }

    function destroy(): void {
        unsubscribe?.();
        unsubscribe = null;
        el.remove();
    }

    return { el, mount, selectedCard, destroy };
}

export type CommentsPanelComponent = ReturnType<typeof createCommentsPanel>;

/** Give `parent` `children`, in order — left as it is when it has them, as
 *  moving a node takes the keyboard from a field in it. */
function setChildren(parent: HTMLElement, children: readonly HTMLElement[]): void {
    const same = children.length === parent.children.length && children.every((c, i) => parent.children[i] === c);
    if (!same) parent.replaceChildren(...children);
}

/** The groups the panel lists, in the order the document reads, each with its
 *  threads and those the selection opens: a PDF's pages, read page by page,
 *  and a Word, Excel or PowerPoint document's pages, cells or slides. */
function listedGroups(
    slice: CommentsPanelSlice,
): Array<{ group: CommentGroup; threads: Comment[]; selected: Set<Comment | null> }> {
    const listed: Array<{ group: CommentGroup; threads: Comment[]; selected: Set<Comment | null> }> = [];
    for (const page of slice.comments.values()) {
        const threads = commentThreads(page);
        if (threads.length === 0) continue;
        const selected = new Set(
            slice.selected?.page === page.page ? slice.selected.ids.map((id) => threadHolding(threads, page, id)) : [],
        );
        listed.push({ group: threads[0]!.group, threads, selected });
    }
    const office = new Map<string, { group: CommentGroup; threads: Comment[]; selected: Set<Comment | null> }>();
    for (const thread of slice.office ? officeThreads(slice.office) : []) {
        const at = office.get(thread.group.key);
        const selected = new Set<Comment | null>(thread.id === slice.openOffice ? [thread] : []);
        if (at) {
            at.threads.push(thread);
            if (thread.id === slice.openOffice) at.selected.add(thread);
        } else {
            office.set(thread.group.key, { group: thread.group, threads: [thread], selected });
        }
    }
    listed.push(...office.values());
    return listed.sort((a, b) => a.group.order - b.group.order);
}
