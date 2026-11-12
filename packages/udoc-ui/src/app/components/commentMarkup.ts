// A Word, Excel or PowerPoint comment thread's markup on a page, read: the
// thread it's of, the box choosing it goes to, and where its marker stands.

import type { CommentMarkup } from "@docmentis/udoc-wasm";

/** The thread `markup` is of, by its first comment's id. */
export function markupComment(markup: CommentMarkup): string {
    return "text" in markup ? markup.text.comment : markup.box.comment;
}

/** The box choosing the thread goes to, page-local: its text's first quad's,
 *  or the box it's on; null for text with no quad on the page. */
export function markupRect(markup: CommentMarkup): { x0: number; y0: number; x1: number; y1: number } | null {
    if ("box" in markup) return markup.box.rect;
    const quad = markup.text.quads[0];
    if (!quad) return null;
    const xs = quad.points.map((p) => p.x);
    const ys = quad.points.map((p) => p.y);
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** Where its marker stands, page-local: where the engine stood it on text,
 *  or a box's top-right corner. */
export function markupMarker(markup: CommentMarkup): { x: number; y: number } | null {
    if ("text" in markup) return markup.text.marker ?? null;
    const { rect } = markup.box;
    return { x: Math.max(rect.x0, rect.x1), y: Math.min(rect.y0, rect.y1) };
}
