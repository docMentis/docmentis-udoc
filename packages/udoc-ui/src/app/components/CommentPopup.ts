// The comment popup (`udoc:comment-popup`): the thread of the markup annotation
// selected, beside it.
//
// A markup annotation is a comment (§12.5.6.2), and its text — its rich
// contents, `/RC` or else `/Contents` — is not what the engine draws of it: a
// note's icon, a square's outline, a highlight's colour. Nor are the replies
// that answer it, which a processor shows in its thread and not on the page. A
// free text's box does show its text, set as the engine sets it. So the thread
// is shown here, in DOM the overlay layer anchors beside the annotation — the
// same thread view the comments panel shows it in, where it is read, edited,
// replied to and deleted alike. It shows while the annotation is the selection and its
// popup is open, so the selection's frame marks what it belongs to. An edit the
// popup closes on, when the selection moves, is dropped.

import type { Comment, ShownComment } from "../annotations.js";
import { applyPoint, type Affine } from "./affine.js";
import { createCommentThread, type CommentThreadView } from "./CommentThread.js";
import type { I18n } from "../i18n/index.js";
import type { OverlaySource } from "./OverlayManager.js";

/** Screen px between the annotation and its popup. */
const GAP = 8;

export interface CommentPopupCallbacks {
    /** The comment to show the thread of — the one annotation selected, when
     *  it is a markup annotation with a popup — or null for none. */
    comment: () => ShownComment | null;
    /** Page `page`'s page→viewport affine this frame, or null when it isn't on
     *  screen. */
    pageToViewport: (page: number) => Affine | null;
    /** Whether a popup newly shown opens editing, with the keyboard — once, for
     *  a note just placed, so its text can be typed straight away. */
    takeFocus: () => boolean;
    /** Whether the session may annotate — without it, the thread only reads. */
    annotating: () => boolean;
    /** Save `richContents` (XHTML) as `comment`'s text. */
    onSave: (comment: Comment, richContents: string) => void;
    /** Answer `comment` with a reply holding `richContents` (XHTML). */
    onReply: (comment: Comment, richContents: string) => void;
    /** Delete `comment`, which no reply answers. */
    onDelete: (comment: Comment) => void;
    /** Hand the keyboard back to the canvas. */
    onDismiss: () => void;
}

/** The thread view each pooled popup holds. */
const views = new WeakMap<HTMLElement, CommentThreadView>();

/** The popup of the selected comment, its top-left corner just right of the
 *  annotation and level with its top. */
export function commentPopup(i18n: I18n, callbacks: CommentPopupCallbacks): OverlaySource {
    return () => {
        const comment = callbacks.comment();
        const m = comment && callbacks.pageToViewport(comment.index);
        if (!comment || !m) return [];
        const { x0, y0, x1, y1 } = comment.annotation.rect;
        const corners = [applyPoint(m, x0, y0), applyPoint(m, x1, y0), applyPoint(m, x0, y1), applyPoint(m, x1, y1)];
        return [
            {
                key: `comment:${comment.annotation.id ?? ""}`,
                x: Math.max(...corners.map((c) => c.x)) + GAP,
                y: Math.min(...corners.map((c) => c.y)),
                create: () => createPopup(i18n, callbacks),
                update: (el) => views.get(el)?.show(comment.thread, true, callbacks.annotating()),
            },
        ];
    };
}

function createPopup(i18n: I18n, callbacks: CommentPopupCallbacks): HTMLElement {
    const el = document.createElement("div");
    el.className = "udoc-ui__comment";
    const view = createCommentThread(i18n, callbacks);
    views.set(el, view);
    el.append(view.el);
    // The element is attached, and filled, after `create` returns.
    if (callbacks.takeFocus()) requestAnimationFrame(() => view.editComment());
    return el;
}
