// A comment thread: a comment and the replies that answer it and theirs,
// nested under it — the one view the comment popup and the comments panel both
// show a thread in.
//
// Each entry shows, on its first line, its kind, its author and how long ago
// it was made — the date itself on hover; then its text; and on its last line
// a lock where it is locked, and the actions it allows. An entry opens
// read-only; where it may be written, Edit makes its field editable, Save
// writes what it holds as the annotation's rich contents, and Cancel — or
// Escape — puts back what it held. Where the thread is open and may be
// written, Reply opens a field under an entry, a step deeper, as a reply to it
// shows: Save sends what it holds as a reply to it, and Cancel — or Escape —
// drops it. Delete deletes an entry no reply answers. An edit or a reply the
// view is dropped on, or can no longer make, is dropped with it.
//
// A field is rich text: what a file's `/RC` styles shows styled, and typing
// carries on in the style of the text at the caret. It is filled from the XHTML
// as the engine reads it, keeping only rich text's elements and styles, so
// nothing else a file puts in `/RC` reaches the page; it is saved as its DOM
// written out as XML, which the engine narrows to rich text in turn.

import type { AnnotationSubtype, Comment } from "../annotations.js";
import { markupOf, parsePdfDate, subtypeOf } from "../annotations.js";
import {
    ICON_ATTACHMENT,
    ICON_DELETE,
    ICON_EDIT,
    ICON_LOCK,
    ICON_REPLY,
    ICON_SUBTOOL_ELLIPSE,
    ICON_SUBTOOL_FREEHAND,
    ICON_SUBTOOL_LINE,
    ICON_SUBTOOL_NOTE,
    ICON_SUBTOOL_POLYGON,
    ICON_SUBTOOL_POLYLINE,
    ICON_SUBTOOL_RECTANGLE,
    ICON_SUBTOOL_SQUIGGLY,
    ICON_SUBTOOL_STAMP,
    ICON_SUBTOOL_STRIKETHROUGH,
    ICON_SUBTOOL_TEXTBOX,
    ICON_SUBTOOL_UNDERLINE,
    ICON_SUBTOOL_HIGHLIGHT,
} from "../icons.js";
import { createButton } from "./controls.js";
import type { I18n, MessageKey } from "../i18n/index.js";

/** The namespace rich text's elements are in. */
const XHTML = "http://www.w3.org/1999/xhtml";

/** The elements rich text is made of (PDF 1.7 Table 223) below its `<body>`,
 *  with the `<div>` a browser's editing makes paragraphs of. Any other is
 *  unwrapped to what it holds, as the engine reads it. */
const ELEMENTS = new Set(["p", "div", "span", "b", "i", "br"]);
/** The inline ones: a lone top element that isn't one is the container. */
const INLINE = new Set(["span", "b", "i", "br"]);
/** The CSS properties rich text may style them with (Table 225). */
const PROPERTIES = new Set([
    "text-align",
    "vertical-align",
    "font-size",
    "font-style",
    "font-weight",
    "font-family",
    "font",
    "color",
    "text-decoration",
    "font-stretch",
]);

/** Each markup subtype's name, and the Annotate tab's icon for it where it has
 *  one; one without shows its name. */
const KINDS: Partial<Record<AnnotationSubtype, { label: MessageKey; icon?: string }>> = {
    text: { label: "annotationKind.note", icon: ICON_SUBTOOL_NOTE },
    freeText: { label: "annotationKind.textBox", icon: ICON_SUBTOOL_TEXTBOX },
    line: { label: "annotationKind.line", icon: ICON_SUBTOOL_LINE },
    square: { label: "annotationKind.rectangle", icon: ICON_SUBTOOL_RECTANGLE },
    circle: { label: "annotationKind.ellipse", icon: ICON_SUBTOOL_ELLIPSE },
    polygon: { label: "annotationKind.polygon", icon: ICON_SUBTOOL_POLYGON },
    polyLine: { label: "annotationKind.polyline", icon: ICON_SUBTOOL_POLYLINE },
    highlight: { label: "annotationKind.highlight", icon: ICON_SUBTOOL_HIGHLIGHT },
    underline: { label: "annotationKind.underline", icon: ICON_SUBTOOL_UNDERLINE },
    squiggly: { label: "annotationKind.squiggly", icon: ICON_SUBTOOL_SQUIGGLY },
    strikeOut: { label: "annotationKind.strikethrough", icon: ICON_SUBTOOL_STRIKETHROUGH },
    stamp: { label: "annotationKind.stamp", icon: ICON_SUBTOOL_STAMP },
    ink: { label: "annotationKind.pen", icon: ICON_SUBTOOL_FREEHAND },
    fileAttachment: { label: "annotationKind.attachment", icon: ICON_ATTACHMENT },
    caret: { label: "annotationKind.caret" },
    sound: { label: "annotationKind.sound" },
    redact: { label: "annotationKind.redaction" },
};

/** The units "12d ago" reads in, each with its length in seconds, largest first. */
const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 365 * 86400],
    ["month", 30 * 86400],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
];
/** How often the shown dates are read again, so "now" turns into "1m ago". */
const DATE_TICK_MS = 60_000;

/** What an entry's lock says, by the flags set: Locked, LockedContents
 *  (Table 167). */
const LOCKS: Record<"locked" | "contents" | "both", MessageKey> = {
    locked: "comment.locked",
    contents: "comment.lockedContents",
    both: "comment.lockedBoth",
};

export interface CommentThreadCallbacks {
    /** Save `richContents` (XHTML) as `comment`'s text. */
    onSave: (comment: Comment, richContents: string) => void;
    /** Answer `comment` with a reply holding `richContents` (XHTML). */
    onReply: (comment: Comment, richContents: string) => void;
    /** Delete `comment`, which no reply answers. */
    onDelete: (comment: Comment) => void;
    /** Hand the keyboard back, an edit, a reply or a delete done. */
    onDismiss: () => void;
}

/** A thread's view, kept across what it shows so an edit in progress stays. */
export interface CommentThreadView {
    el: HTMLElement;
    /** Show `thread`: its comment, and when `open` its replies, each entry
     *  answered in a field under it where it may be written; closed, a count
     *  of its replies. Nothing is written unless `annotating` — the session
     *  entitled to annotate. */
    show(thread: Comment, open: boolean, annotating: boolean): void;
    /** Open the thread's comment for editing, the caret at its end — once, for
     *  a note just placed, so its text is typed straight away. */
    editComment(): void;
}

/** One entry of a thread: a comment or a reply, and the field that answers it. */
interface Entry {
    el: HTMLElement;
    /** The field that answers the entry, shown under it while `replying`. */
    reply: HTMLElement;
    replying(): boolean;
    /** Show `comment`, written to where its locks allow, and answered where
     *  the thread is `open` — neither unless `annotating`. */
    show(comment: Comment, open: boolean, annotating: boolean): void;
    startEditing(): void;
}

export function createCommentThread(i18n: I18n, callbacks: CommentThreadCallbacks): CommentThreadView {
    const el = document.createElement("div");
    el.className = "udoc-comment-thread";
    const list = document.createElement("div");
    list.className = "udoc-comment-thread__entries";
    const count = document.createElement("div");
    count.className = "udoc-comment-thread__count";
    el.append(list, count);

    /** The entries by annotation id, kept while their annotations are shown. */
    const entries = new Map<string, Entry>();
    /** The entries shown, in reading order. */
    let order: Entry[] = [];
    let showing: Comment | null = null;
    /** What the last `show` showed, so a frame that changes none of it — the
     *  popup is shown again on every one — leaves the view as it is. */
    let last: { thread: Comment; open: boolean; annotating: boolean } | null = null;

    function show(thread: Comment, open: boolean, annotating: boolean): void {
        if (last && last.thread === thread && last.open === open && last.annotating === annotating) return;
        last = { thread, open, annotating };
        showing = thread;
        // The thread in reading order, each entry with how deep it answers.
        const walked: Array<[Comment, number]> = [];
        const walk = (comment: Comment, depth: number): void => {
            walked.push([comment, depth]);
            if (open) for (const r of comment.replies) walk(r, depth + 1);
        };
        walk(thread, 0);
        order = [];
        const kept = new Set<string>();
        for (const [comment, depth] of walked) {
            const key = comment.annotation.id ?? "";
            kept.add(key);
            let entry = entries.get(key);
            if (!entry) {
                entry = createEntry(i18n, callbacks, layOut);
                entries.set(key, entry);
            }
            entry.show(comment, open, annotating);
            entry.el.classList.toggle("udoc-comment--reply", depth > 0);
            entry.el.style.setProperty("--udoc-comment-depth", String(depth));
            entry.reply.style.setProperty("--udoc-comment-depth", String(depth + 1));
            order.push(entry);
        }
        for (const key of entries.keys()) if (!kept.has(key)) entries.delete(key);
        layOut();

        const replies = countReplies(thread);
        shown(count, !open && replies > 0);
        count.textContent = i18n.plural("comment.replies", replies);
    }

    /** Put the entries shown in the list, in order, each being answered with
     *  its reply field under it. Moving a node takes the keyboard from it:
     *  reorder only when the order changed. */
    function layOut(): void {
        const els = order.flatMap((entry) => (entry.replying() ? [entry.el, entry.reply] : [entry.el]));
        const same = els.length === list.children.length && els.every((e, i) => list.children[i] === e);
        if (!same) list.replaceChildren(...els);
    }

    function editComment(): void {
        const key = showing?.annotation.id;
        if (key !== undefined) entries.get(key)?.startEditing();
    }

    return { el, show, editComment };
}

/** How many replies answer `comment`, at any depth. */
function countReplies(comment: Comment): number {
    return comment.replies.reduce((n, r) => n + 1 + countReplies(r), 0);
}

/** How long before `now` `when` is, in `locale` and the largest unit it spans
 *  one of: "12d ago", "3h ago" — or "now", under a minute. */
function ago(when: Date, now: Date, locale: string): string {
    const seconds = (when.getTime() - now.getTime()) / 1000;
    const found = UNITS.find(([, length]) => Math.abs(seconds) >= length);
    if (!found) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(0, "second");
    const [unit, length] = found;
    return new Intl.RelativeTimeFormat(locale, { style: "narrow" }).format(Math.trunc(seconds / length), unit);
}

/** The timer reading the shown dates again, while any is shown. */
let dateTicker: ReturnType<typeof setInterval> | null = null;

/** Show `when` in `date`, in `locale` — which `date` keeps as its `lang` — and
 *  keep it read again as time passes: a date is the one thing on a thread that
 *  changes with nothing else changing, so no `show` would ever come to move it
 *  on. */
function showDate(date: HTMLElement, when: Date | null, locale: string): void {
    date.lang = locale;
    date.textContent = when ? ago(when, new Date(), locale) : "";
    date.title = when ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(when) : "";
    if (!when) {
        delete date.dataset.when;
        return;
    }
    date.dataset.when = String(when.getTime());
    dateTicker ??= setInterval(tickDates, DATE_TICK_MS);
}

/** Read every shown date again — every thread's, the dates on the page being
 *  all there are — and stop once none is shown. */
function tickDates(): void {
    const dates = document.querySelectorAll<HTMLElement>(".udoc-comment__date[data-when]");
    if (dates.length === 0 && dateTicker !== null) {
        clearInterval(dateTicker);
        dateTicker = null;
        return;
    }
    const now = new Date();
    for (const date of dates) date.textContent = ago(new Date(Number(date.dataset.when)), now, date.lang);
}

/** What an entry shows: the comment, refreshed on every `show` and read by its
 *  handlers, which are set once; the rich contents its field was last filled
 *  from; what the field held, written out, once filled — it saves only when
 *  it holds something else; and whether it is being edited. */
interface Shown {
    comment: Comment;
    richContents: string;
    written: string;
    editing: boolean;
}

function createEntry(i18n: I18n, callbacks: CommentThreadCallbacks, layOut: () => void): Entry {
    const el = document.createElement("div");
    el.className = "udoc-comment";
    const header = document.createElement("div");
    header.className = "udoc-comment__header";
    const kind = document.createElement("span");
    kind.className = "udoc-comment__kind";
    const author = document.createElement("span");
    author.className = "udoc-comment__author";
    const date = document.createElement("span");
    date.className = "udoc-comment__date";
    header.append(kind, author, date);
    const text = document.createElement("div");
    text.className = "udoc-comment__text";
    text.setAttribute("role", "textbox");
    text.setAttribute("aria-multiline", "true");
    text.setAttribute("aria-label", i18n.t("comment.label"));
    const actions = document.createElement("div");
    actions.className = "udoc-comment__actions";
    const lock = document.createElement("span");
    lock.className = "udoc-comment__lock";
    lock.setAttribute("role", "img");
    lock.innerHTML = ICON_LOCK;
    const answer = createButton({ icon: ICON_REPLY, label: i18n.t("comment.reply") });
    const edit = createButton({ icon: ICON_EDIT, label: i18n.t("comment.edit") });
    const remove = createButton({ icon: ICON_DELETE, label: i18n.t("common.delete") });
    const cancel = createButton({ text: i18n.t("common.cancel"), label: i18n.t("comment.cancelEditing") });
    const save = createButton({
        text: i18n.t("common.save"),
        label: i18n.t("comment.save"),
        className: "udoc-comment__primary",
    });
    actions.append(lock, answer, edit, remove, cancel, save);
    el.append(header, text, actions);

    let current: Shown | null = null;
    let locked = false;
    let writable = false;
    let answerable = false;
    let deletable = false;
    let replying = false;

    const fillFrom = (comment: Comment): void => {
        fill(text, comment.richContents, comment.annotation.contents ?? "");
        current = { comment, richContents: comment.richContents, written: write(text), editing: false };
    };
    const showMode = (): void => {
        const editing = current?.editing ?? false;
        const contentEditable = editing ? "true" : "false";
        if (text.contentEditable !== contentEditable) text.contentEditable = contentEditable;
        text.dataset.placeholder = editing ? i18n.t("comment.placeholder") : "";
        shown(actions, locked || writable || answerable || deletable || editing);
        shown(lock, locked);
        shown(answer, answerable && !editing && !replying);
        shown(edit, writable && !editing);
        shown(remove, deletable && !editing);
        shown(cancel, editing);
        shown(save, editing);
    };
    const startEditing = (): void => {
        if (!current || !writable) return;
        current.editing = true;
        showMode();
        focusAtEnd(text);
    };
    const stopEditing = (saving: boolean): void => {
        if (!current?.editing) return;
        const written = write(text);
        if (saving && written !== current.written) {
            current.written = written;
            callbacks.onSave(current.comment, written);
        }
        // What was saved stays shown until the save's echo refills the field;
        // what wasn't is put back.
        if (saving) current.editing = false;
        else fillFrom(current.comment);
        showMode();
        callbacks.onDismiss();
    };
    edit.addEventListener("click", startEditing);
    cancel.addEventListener("click", () => stopEditing(false));
    save.addEventListener("click", () => stopEditing(true));
    wireField(text, {
        active: () => current?.editing ?? false,
        commit: () => stopEditing(true),
        cancel: () => stopEditing(false),
    });

    const reply = createReplyField(i18n, {
        save: (richContents) => {
            if (current) callbacks.onReply(current.comment, richContents);
            stopReplying();
        },
        cancel: () => stopReplying(),
    });
    const startReplying = (): void => {
        if (!current || !answerable) return;
        replying = true;
        showMode();
        layOut();
        reply.focus();
    };
    const stopReplying = (): void => {
        if (!replying) return;
        replying = false;
        reply.clear();
        showMode();
        layOut();
        callbacks.onDismiss();
    };
    answer.addEventListener("click", startReplying);
    remove.addEventListener("click", () => {
        if (!current || !deletable) return;
        callbacks.onDelete(current.comment);
        callbacks.onDismiss();
    });

    function show(comment: Comment, open: boolean, annotating: boolean): void {
        const { flags } = comment.annotation;
        locked = flags.locked || flags.lockedContents;
        writable = annotating && !flags.lockedContents;
        answerable = annotating && open;
        deletable = annotating && !flags.locked && comment.replies.length === 0;
        // A reply the entry can no longer make is dropped; the thread lays out
        // the list once its entries are shown.
        if (replying && !answerable) {
            replying = false;
            reply.clear();
        }
        const markup = markupOf(comment.annotation);
        const subtype = KINDS[subtypeOf(comment.annotation.kind)];
        shown(kind, subtype !== undefined);
        kind.innerHTML = subtype?.icon ?? "";
        const kindLabel = subtype ? i18n.t(subtype.label) : "";
        if (!subtype?.icon) kind.textContent = kindLabel;
        kind.title = kindLabel;
        author.textContent = markup?.author || markup?.subject || "";
        showDate(date, parsePdfDate(markup?.created ?? comment.annotation.modified ?? ""), i18n.locale);
        const says = i18n.t(
            flags.locked && flags.lockedContents ? LOCKS.both : flags.locked ? LOCKS.locked : LOCKS.contents,
        );
        lock.title = says;
        lock.setAttribute("aria-label", says);
        // What is being typed stays until it is saved or cancelled — or dropped,
        // as an edit the entry can no longer make is. Otherwise show what the
        // annotation holds — a save, an undo or a peer's edit may have changed
        // it.
        const keep = current?.editing ? writable : current?.richContents === comment.richContents;
        if (current && keep) current.comment = comment;
        else fillFrom(comment);
        showMode();
    }

    return { el, reply: reply.el, replying: () => replying, show, startEditing };
}

/** The field that answers an entry. */
interface ReplyField {
    el: HTMLElement;
    /** Empty it. */
    clear(): void;
    /** Focus it, the caret at the end of what it holds. */
    focus(): void;
}

/** A field that answers an entry: always editable, its Save — or Ctrl/⌘+Enter
 *  — sending what it holds, when it holds anything, and its Cancel — or
 *  Escape — dropping it. */
function createReplyField(i18n: I18n, on: { save: (richContents: string) => void; cancel: () => void }): ReplyField {
    const el = document.createElement("div");
    el.className = "udoc-comment-thread__reply";
    const text = document.createElement("div");
    text.className = "udoc-comment__text";
    text.contentEditable = "true";
    text.setAttribute("role", "textbox");
    text.setAttribute("aria-multiline", "true");
    text.setAttribute("aria-label", i18n.t("comment.replyField"));
    text.dataset.placeholder = i18n.t("comment.replyField");
    const actions = document.createElement("div");
    actions.className = "udoc-comment__actions";
    const cancel = createButton({ text: i18n.t("common.cancel"), label: i18n.t("comment.cancelReply") });
    const save = createButton({
        text: i18n.t("common.save"),
        label: i18n.t("comment.saveReply"),
        className: "udoc-comment__primary",
    });
    actions.append(cancel, save);
    el.append(text, actions);

    const saveReply = (): void => {
        if ((text.textContent ?? "") !== "") on.save(write(text));
    };
    cancel.addEventListener("click", on.cancel);
    save.addEventListener("click", saveReply);
    wireField(text, { active: () => true, commit: saveReply, cancel: on.cancel });
    return {
        el,
        clear: () => {
            text.replaceChildren();
            text.removeAttribute("style");
        },
        focus: () => focusAtEnd(text),
    };
}

/** Give a rich text field its keys, while `active`: Escape cancels,
 *  Ctrl/⌘+Enter commits, and Shift+Enter breaks the line as a paragraph; a
 *  paste brings its words, a paragraph a line; and emptied, it drops the break
 *  the browser leaves, so it shows its placeholder again. */
function wireField(text: HTMLElement, on: { active: () => boolean; commit: () => void; cancel: () => void }): void {
    text.addEventListener("keydown", (ev) => {
        if (!on.active()) return;
        if (ev.key === "Escape") {
            ev.preventDefault();
            ev.stopPropagation();
            on.cancel();
        } else if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) {
            ev.preventDefault();
            on.commit();
        } else if (ev.key === "Enter" && ev.shiftKey) {
            // A line break is a paragraph, as it is in `/Contents`: in a field
            // that keeps its spaces, the browser would break the line with a
            // newline in the text, which rich text reads as a space.
            ev.preventDefault();
            document.execCommand("insertParagraph");
        }
    });
    text.addEventListener("paste", (ev) => {
        ev.preventDefault();
        const lines = (ev.clipboardData?.getData("text/plain") ?? "").split(/\r\n|\r|\n/);
        lines.forEach((line, i) => {
            if (i > 0) document.execCommand("insertParagraph");
            if (line !== "") document.execCommand("insertText", false, line);
        });
    });
    text.addEventListener("input", () => {
        if (text.textContent === "" && text.childNodes.length === 1 && text.firstChild?.nodeName === "BR") {
            text.replaceChildren();
        }
    });
}

/** Show `el` or not — by its display, which a class's own can't override as
 *  it would `hidden`. */
function shown(el: HTMLElement, on: boolean): void {
    el.style.display = on ? "" : "none";
}

/** Focus `text` with the caret at the end of what it holds. */
function focusAtEnd(text: HTMLElement): void {
    text.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(text);
    range.collapse(false);
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(range);
}

/**
 * Fill `text` with the rich contents `xhtml`, read as the engine reads rich
 * text: a lone top element that isn't inline is the container, whose style the
 * field takes; `<p>`, `<div>`, `<span>`, `<b>`, `<i>` and `<br>` are kept, in
 * only the styles rich text may set, and any other element is unwrapped to what
 * it holds; a line break or a tab in text is a space, and whitespace holding a
 * line break alone is dropped. XHTML the browser can't read as XML shows
 * `contents` instead, a paragraph a line.
 */
function fill(text: HTMLElement, xhtml: string, contents: string): void {
    text.replaceChildren();
    text.removeAttribute("style");
    // `&nbsp;` is the one entity past XML's that rich text is written with.
    const doc = new DOMParser().parseFromString(xhtml.replaceAll("&nbsp;", "&#160;"), "application/xml");
    const root = doc.documentElement;
    if (doc.getElementsByTagName("parsererror").length > 0) {
        if (contents === "") return;
        for (const line of contents.split(/\r\n|\r|\n/)) {
            const paragraph = document.createElement("p");
            paragraph.append(line === "" ? document.createElement("br") : line);
            text.append(paragraph);
        }
        return;
    }
    if (INLINE.has(root.localName.toLowerCase())) {
        copy(root, text);
    } else {
        copyStyle(root, text);
        for (const child of root.childNodes) copy(child, text);
    }
}

/** Copy `node` of a rich text string into `into` (see {@link fill}). */
function copy(node: Node, into: Node): void {
    if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE) {
        const value = node.nodeValue ?? "";
        if (/[\r\n]/.test(value) && value.trim() === "") return;
        into.appendChild(document.createTextNode(value.replace(/[\r\n\t]/g, " ")));
        return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    const name = element.localName.toLowerCase();
    if (!ELEMENTS.has(name)) {
        for (const child of element.childNodes) copy(child, into);
        return;
    }
    const copied = document.createElement(name);
    copyStyle(element, copied);
    for (const child of element.childNodes) copy(child, copied);
    // An empty paragraph is a line, which a browser shows only with a break.
    if ((name === "p" || name === "div") && !copied.hasChildNodes()) copied.append(document.createElement("br"));
    into.appendChild(copied);
}

/** Give `to` those of `from`'s styles that rich text may set. */
function copyStyle(from: Element, to: HTMLElement): void {
    for (const declaration of (from.getAttribute("style") ?? "").split(";")) {
        const colon = declaration.indexOf(":");
        const name = declaration.slice(0, colon).trim().toLowerCase();
        if (colon > 0 && PROPERTIES.has(name)) to.style.setProperty(name, declaration.slice(colon + 1).trim());
    }
}

/** What `text` holds, as rich contents: a `<body>` in the field's style,
 *  holding the field's nodes written out as XML. */
function write(text: HTMLElement): string {
    const serializer = new XMLSerializer();
    const style = text.getAttribute("style");
    const attribute = style
        ? ` style="${style.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;")}"`
        : "";
    const body = Array.from(text.childNodes, (node) => serializer.serializeToString(node)).join("");
    return `<body xmlns="${XHTML}"${attribute}>${body}</body>`;
}
