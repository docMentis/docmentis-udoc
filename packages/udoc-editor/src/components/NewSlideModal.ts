// The New-Slide layout picker — a modal grid of slide-layout thumbnails, opened
// from the presentation Home tab's "New Slide" button. Picking a layout inserts
// a new slide built on it (its content placeholders seeded); the thumbnail *is*
// the layout's identity, since layouts carry no name/type in the model.
//
// Storeless and imperative, like the other modals (PageSettingsModal): mounted
// once by the shell and reused. `open(ctx)` seeds it with the layout roster, the
// preview renderer, and the pick callback that turns a click into a createSlide
// command; it owns no document state of its own.
//
// Layout previews render off a non-current plane (each slide master's own layout
// plane) via the plane-aware paged render path, so opening the picker never
// disturbs the slide plane the user is editing.

import { ICON_CLEAR, on } from "@docmentis/udoc-ui/internal";
import type { I18n } from "../i18n/index.js";

/** Output pixels per document point for a layout preview — a modest raster
 *  (a 960-pt slide → 240 px), downscaled by CSS into its grid cell. */
const PREVIEW_SCALE = 0.25;

/** One pickable slide layout: the id a slide is created on, plus where its
 *  preview renders — the plane (a slide master's, `1..`) and the page within it
 *  (`1 + its index`; page 0 of that plane is the master). */
export interface LayoutOption {
    /** The slide-layout id (hex key) — passed to `createSlide(index, layout)`. */
    layout: string;
    /** The layout plane the preview renders on (`1..`). */
    plane: number;
    /** The page index within that plane (`1..`; page 0 is the master). */
    page: number;
    /** The name the file gives the slide layout ("Title Slide"), or null for
     *  none. */
    name: string | null;
}

/** What `open` needs: where the slide lands, the layouts to choose from, how to
 *  render a preview, and what a pick does. */
export interface NewSlideContext {
    /** 0-based index the new slide is inserted at. */
    insertIndex: number;
    /** The layouts to offer, in roster order. */
    options: LayoutOption[];
    /** Render a one-shot preview of a page on a plane, at `scale` output px per
     *  point — resolves with a bitmap the caller owns. */
    renderPreview: (plane: number, page: number, scale: number) => Promise<ImageBitmap>;
    /** Create a new slide on `layout` at `insertIndex` and close. */
    onPick: (layout: string) => void;
}

/**
 * Build the New-Slide picker modal. The returned handle is mounted once by the
 * shell; `open` re-seeds it with the current layout roster each time.
 */
export function createNewSlideModal(i18n: I18n) {
    const el = document.createElement("div");
    el.className = "udoc-slide-picker";
    el.style.display = "none";

    const backdrop = document.createElement("div");
    backdrop.className = "udoc-slide-picker__backdrop";

    const dialog = document.createElement("div");
    dialog.className = "udoc-slide-picker__dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", i18n.t("newSlide.label"));

    const header = document.createElement("div");
    header.className = "udoc-slide-picker__header";
    const heading = document.createElement("h2");
    heading.className = "udoc-slide-picker__heading";
    heading.textContent = i18n.t("command.createSlide");
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "udoc-slide-picker__close";
    closeBtn.setAttribute("aria-label", i18n.t("common.close"));
    closeBtn.title = i18n.t("common.close");
    closeBtn.innerHTML = ICON_CLEAR;
    header.append(heading, closeBtn);

    const grid = document.createElement("div");
    grid.className = "udoc-slide-picker__grid";
    grid.setAttribute("role", "listbox");
    grid.setAttribute("aria-label", i18n.t("newSlide.layouts"));

    dialog.append(header, grid);
    el.append(backdrop, dialog);

    let isOpen = false;
    let ctx: NewSlideContext | null = null;
    // Bumped on every open/close so a preview that resolves after the picker
    // moved on is discarded (its bitmap closed) instead of drawn stale.
    let epoch = 0;
    const unsubEvents: Array<() => void> = [];

    function pick(layout: string): void {
        const chosen = ctx;
        close();
        chosen?.onPick(layout);
    }

    /** Build one layout cell: a button holding a canvas the preview draws into. */
    function buildCell(option: LayoutOption, index: number, myEpoch: number): HTMLButtonElement {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "udoc-slide-picker__cell";
        cell.setAttribute("role", "option");
        const name = option.name ?? i18n.t("newSlide.layout", { index: index + 1 });
        cell.title = name;
        cell.setAttribute("aria-label", name);
        const canvas = document.createElement("canvas");
        canvas.className = "udoc-slide-picker__canvas";
        cell.appendChild(canvas);
        on(cell, "click", () => pick(option.layout));

        void ctx
            ?.renderPreview(option.plane, option.page, PREVIEW_SCALE)
            .then((bitmap) => {
                // The picker closed / reopened while this rendered — drop it.
                if (myEpoch !== epoch) {
                    bitmap.close();
                    return;
                }
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
                canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
                bitmap.close();
                cell.classList.add("udoc-slide-picker__cell--ready");
            })
            .catch(() => {
                // A preview that fails to render just stays blank — the cell is
                // still pickable (the layout id is valid regardless).
            });
        return cell;
    }

    function open(context: NewSlideContext): void {
        ctx = context;
        epoch++;
        const myEpoch = epoch;
        grid.replaceChildren();
        context.options.forEach((option, index) => {
            grid.appendChild(buildCell(option, index, myEpoch));
        });
        isOpen = true;
        el.style.display = "";
        (grid.querySelector(".udoc-slide-picker__cell") as HTMLElement | null)?.focus();
    }

    function close(): void {
        if (!isOpen) return;
        isOpen = false;
        ctx = null;
        epoch++;
        grid.replaceChildren();
        el.style.display = "none";
    }

    on(closeBtn, "click", () => close());
    on(backdrop, "click", () => close());

    function mount(parent: HTMLElement): void {
        parent.appendChild(el);
        const onKeydown = (e: KeyboardEvent) => {
            if (isOpen && e.key === "Escape") {
                e.stopPropagation();
                close();
            }
        };
        document.addEventListener("keydown", onKeydown);
        unsubEvents.push(() => document.removeEventListener("keydown", onKeydown));
    }

    function destroy(): void {
        for (const off of unsubEvents) off();
        el.remove();
    }

    return { el, mount, open, close, destroy };
}

export type NewSlideModal = ReturnType<typeof createNewSlideModal>;
