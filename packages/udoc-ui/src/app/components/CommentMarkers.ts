// The markers of a Word, Excel or PowerPoint document's comments: one where
// the engine stands each thread's marker on a page on screen, which opens the
// thread in the comments panel — centred in a Word page's right margin beside
// its text's first line, just right of a slide's shape beside its text's,
// inside the top-right corner of a slide or a shape; a cell's a flag in that
// corner, as Excel marks one. A PDF's comments are annotations, which draw
// themselves on the page.

import type { CommentMarkup, UDocType } from "@docmentis/udoc-wasm";
import { ICON_COMMENTS } from "../icons.js";
import { applyPoint, type Affine } from "./affine.js";
import { markupComment, markupMarker } from "./commentMarkup.js";
import type { OverlaySource } from "./OverlayManager.js";

export interface CommentMarkersCallbacks {
    /** Whether markers show: an Office document is open. */
    active: () => boolean;
    /** The doc type shown, which says how a marker stands at its point. */
    docType: () => UDocType | null;
    /** The markup read for page `page` of the plane shown — none until read. */
    markup: (page: number) => readonly CommentMarkup[];
    pageToViewport: (page: number) => Affine | null;
    /** The thread a marker stands for, by its first comment's id, open. */
    open: () => string | null;
    /** Open thread `comment` in the comments panel. */
    onOpen: (comment: string) => void;
    /** What a marker is named for a screen reader. */
    label: string;
}

export function commentMarkers(callbacks: CommentMarkersCallbacks): OverlaySource {
    return (frame) => {
        if (!callbacks.active()) return [];
        const open = callbacks.open();
        const docType = callbacks.docType();
        return frame.views.flatMap((view) => {
            const m = callbacks.pageToViewport(view.index);
            if (!m) return [];
            return callbacks.markup(view.index).flatMap((markup) => {
                const marker = markupMarker(markup);
                if (!marker) return [];
                const comment = markupComment(markup);
                const stands = standing(markup, docType);
                const at = applyPoint(m, marker.x, marker.y);
                return [
                    {
                        key: `${view.index}:${comment}`,
                        x: at.x,
                        y: at.y,
                        create: () => createMarker(comment, callbacks),
                        update: (el: HTMLElement) => {
                            el.classList.toggle("udoc-comment-marker--open", comment === open);
                            for (const way of STANDINGS)
                                el.classList.toggle(`udoc-comment-marker--${way}`, way === stands);
                        },
                    },
                ];
            });
        });
    };
}

/** How a marker stands at its point, past centred on it: inside a box's
 *  top-right corner, a cell's as a flag, or just right of a slide's shape. */
const STANDINGS = ["corner", "cell", "beside"] as const;

function standing(markup: CommentMarkup, docType: UDocType | null): (typeof STANDINGS)[number] | null {
    if ("box" in markup) return docType === "spreadsheet" ? "cell" : "corner";
    return docType === "presentation" ? "beside" : null;
}

function createMarker(comment: string, callbacks: CommentMarkersCallbacks): HTMLElement {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "udoc-comment-marker";
    // The thread it stands for, by its first comment's id — what the comment
    // tether finds the open thread's marker by.
    el.dataset.comment = comment;
    el.innerHTML = ICON_COMMENTS;
    el.setAttribute("aria-label", callbacks.label);
    el.title = callbacks.label;
    // The press is the marker's, not the page's under it.
    el.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        callbacks.onOpen(comment);
    });
    return el;
}
