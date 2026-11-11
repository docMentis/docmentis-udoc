// The markers of a Word, Excel or PowerPoint document's comments: one at the
// top-right of the first rect each thread stands in on a page on screen — a
// text range's first line, a shape, a slide's point — which opens the thread in
// the comments panel; a cell's a flag in its top-right corner, as Excel marks
// one. A PDF's comments are annotations, which draw themselves on the page.

import type { CommentAnchor } from "@docmentis/udoc-wasm";
import { ICON_COMMENTS } from "../icons.js";
import { applyPoint, type Affine } from "./affine.js";
import type { OverlaySource } from "./OverlayManager.js";

export interface CommentMarkersCallbacks {
    /** Whether markers show: an Office document is open. */
    active: () => boolean;
    /** Whether a thread stands at a cell, flagged in its corner. */
    cells: () => boolean;
    /** The anchors read for page `page` of the plane shown — none until read. */
    anchors: (page: number) => readonly CommentAnchor[];
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
        const cells = callbacks.cells();
        return frame.views.flatMap((view) => {
            const m = callbacks.pageToViewport(view.index);
            if (!m) return [];
            return callbacks.anchors(view.index).flatMap((anchor) => {
                const rect = anchor.rects[0];
                if (!rect) return [];
                const corner = applyPoint(m, Math.max(rect.x0, rect.x1), Math.min(rect.y0, rect.y1));
                return [
                    {
                        key: `${view.index}:${anchor.comment}`,
                        x: corner.x,
                        y: corner.y,
                        create: () => createMarker(anchor.comment, callbacks),
                        update: (el: HTMLElement) => {
                            el.classList.toggle("udoc-comment-marker--open", anchor.comment === open);
                            el.classList.toggle("udoc-comment-marker--cell", cells);
                        },
                    },
                ];
            });
        });
    };
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
