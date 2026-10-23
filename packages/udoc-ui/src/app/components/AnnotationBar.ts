// The annotation bar (`udoc:annotation-bar`): what can be done to the one
// annotation selected, or the free text a caret is in, in a strip just above
// it, left-aligned with it — open its
// comment, change its colour, delete it. A button shows only when it acts on the
// annotation, never disabled, and a bar with none to show shows nothing. A free
// text has no comment button — its text is edited in its box.
//
// Built once and handed to the overlay layer each time an annotation is the
// selection, rather than built per selection: its colour dropdown is the
// Annotate tab's Color, whose menu listens on the document until it is
// destroyed.

import type { PaintDisplay, SelectionBox } from "../../geometry.js";
import { ICON_COMMENTS, ICON_DELETE, ICON_STROKE } from "../icons.js";
import { applyPoint, fromComponents, type Affine } from "./affine.js";
import { createButton, createDropdownButton } from "./controls.js";
import type { OverlaySource } from "./OverlayManager.js";
import { applyPaintBar, paintSwatch } from "./Ribbon.js";
import type { I18n } from "../i18n/index.js";

/** Screen px between the bar and the annotation's top edge, clear of the resize
 *  handles on it. */
const GAP = 8;

export interface AnnotationBarCallbacks {
    /** The box of the one annotation the selection draws — one selected, or
     *  the free text a caret is in — as its report carries it, or null. */
    box: () => SelectionBox | null;
    /** The id of the one annotation selected whole, if one is — a colour menu
     *  left open closes when it changes. */
    selectedId: () => string | undefined;
    /** Page `page`'s page→viewport affine this frame, or null when it isn't on
     *  screen. */
    pageToViewport: (page: number) => Affine | null;
    /** Whether it has a comment button — every annotation but a free text. */
    commentable: () => boolean;
    /** Whether the annotation's comment popup is open; null when it has none. */
    comment: () => boolean | null;
    /** The colour the Format controls show for it; undefined where their colour
     *  doesn't reach it. */
    color: () => PaintDisplay | undefined;
    /** Whether it may be deleted. */
    deletable: () => boolean;
    /** Open its comment popup, or close it. */
    onToggleComment: () => void;
    /** Fill the colour menu, calling `close` after a pick. */
    fillColor: (menu: HTMLElement, close: () => void) => void;
    onDelete: () => void;
}

export interface AnnotationBar {
    /** The overlay source that shows the bar. */
    source: OverlaySource;
    destroy(): void;
}

export function createAnnotationBar(i18n: I18n, callbacks: AnnotationBarCallbacks): AnnotationBar {
    const el = document.createElement("div");
    el.className = "udoc-ui__annotation-bar";
    el.setAttribute("role", "toolbar");
    el.setAttribute("aria-label", i18n.t("annotationBar.label"));

    const comment = createButton({ icon: ICON_COMMENTS, label: i18n.t("comment.label") });
    comment.addEventListener("click", () => callbacks.onToggleComment());
    const colorLabel = i18n.t("command.annotationColor");
    const color = createDropdownButton(
        { icon: paintSwatch(ICON_STROKE, { kind: "unknown" }), label: colorLabel },
        {
            menuLabel: i18n.t("ribbon.paintOptions", { label: colorLabel }),
            onOpen: () => callbacks.fillColor(color.menu, () => color.controller.close()),
        },
    );
    const remove = createButton({ icon: ICON_DELETE, label: i18n.t("common.delete") });
    remove.addEventListener("click", () => callbacks.onDelete());
    el.append(comment, color.el, remove);

    // The annotation the bar last showed for: a menu left open closes when the
    // bar moves to another, or goes.
    let shown: string | undefined;

    // The buttons that act on the annotation selected — the ones the bar shows.
    const acting = () => ({
        comment: callbacks.commentable() && callbacks.comment() !== null,
        color: callbacks.color() !== undefined,
        remove: callbacks.deletable(),
    });

    const update = (): void => {
        const shows = acting();
        comment.style.display = shows.comment ? "" : "none";
        const open = callbacks.comment() === true;
        comment.classList.toggle("udoc-btn--selected", open);
        comment.setAttribute("aria-pressed", String(open));
        color.el.style.display = shows.color ? "" : "none";
        applyPaintBar(color.trigger, callbacks.color() ?? { kind: "unknown" });
        remove.style.display = shows.remove ? "" : "none";
    };

    const source: OverlaySource = () => {
        const box = callbacks.box();
        const m = box && callbacks.pageToViewport(box.page);
        const id = m ? callbacks.selectedId() : undefined;
        if (id !== shown) color.controller.close();
        shown = id;
        // A bar with no button to show shows nothing.
        if (!box || !m) return [];
        const shows = acting();
        if (!shows.comment && !shows.color && !shows.remove) return [];
        // The box's corners, through its own transform onto the page, then
        // onto the screen.
        const local = fromComponents(box.transform);
        const { x0, y0, x1, y1 } = box.rect;
        const corners = (
            [
                [x0, y0],
                [x1, y0],
                [x0, y1],
                [x1, y1],
            ] as const
        ).map(([x, y]) => {
            const p = applyPoint(local, x, y);
            return applyPoint(m, p.x, p.y);
        });
        return [
            {
                key: "bar",
                // The bar's bottom-left corner — it hangs up from here (see its
                // stylesheet).
                x: Math.min(...corners.map((c) => c.x)),
                y: Math.min(...corners.map((c) => c.y)) - GAP,
                create: () => el,
                update,
            },
        ];
    };

    return { source, destroy: () => color.destroy() };
}
