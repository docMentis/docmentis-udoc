// The Image Size dialog, opened from an image's Home tab: the size in pixels
// the current page shows and saves at, as a width × height kept to its aspect
// unless the lock is off, with its original size beside it to go back to. A
// modal — backdrop + centered dialog — on the page-settings dialog's styles.
//
// Storeless and imperative: mounted once and reused. `open(ctx)` seeds it with
// the page's sizes and the callback that turns Apply into the page's resize;
// it owns no document state of its own.

import { ICON_CLEAR, on } from "@docmentis/udoc-ui/internal";
import type { I18n } from "../i18n/index.js";

/** The widest or tallest a page is resized to, in pixels — past it, a save's
 *  pixels would run to gigabytes. */
const MAX_PIXELS = 16384;

/** What `open` needs: the page's sizes, turned as it shows, and how to
 *  resize it. */
export interface ImageSizeContext {
    /** The size in pixels the page shows at now. */
    width: number;
    height: number;
    /** The pixels it keeps, unscaled — its original size. */
    originalWidth: number;
    originalHeight: number;
    /** Resize the page to show at `width` × `height` pixels (one undo step). */
    onResize: (width: number, height: number) => void;
}

function labeledField(labelText: string): { field: HTMLLabelElement; input: HTMLInputElement } {
    const field = document.createElement("label");
    field.className = "udoc-page-modal__field";
    const label = document.createElement("span");
    label.className = "udoc-page-modal__field-label";
    label.textContent = labelText;
    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "numeric";
    input.className = "udoc-page-modal__input";
    field.append(label, input);
    return { field, input };
}

/** A whole pixel count in `text`, or null for none in range. */
function parsePixels(text: string): number | null {
    const n = Math.round(parseFloat(text));
    return Number.isFinite(n) && n >= 1 && n <= MAX_PIXELS ? n : null;
}

/** Build the Image Size dialog, mounted once and re-seeded by `open`. */
export function createImageSizeModal(i18n: I18n) {
    const el = document.createElement("div");
    el.className = "udoc-page-modal";
    el.style.display = "none";

    const backdrop = document.createElement("div");
    backdrop.className = "udoc-page-modal__backdrop";

    const dialog = document.createElement("div");
    dialog.className = "udoc-page-modal__dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", i18n.t("command.resizePage"));

    // --- header ---
    const header = document.createElement("div");
    header.className = "udoc-page-modal__header";
    const heading = document.createElement("h2");
    heading.className = "udoc-page-modal__heading";
    heading.textContent = i18n.t("command.resizePage");
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "udoc-page-modal__close";
    closeBtn.setAttribute("aria-label", i18n.t("common.close"));
    closeBtn.title = i18n.t("common.close");
    closeBtn.innerHTML = ICON_CLEAR;
    header.append(heading, closeBtn);

    // --- size ---
    const body = document.createElement("div");
    body.className = "udoc-page-modal__body";
    const dims = document.createElement("div");
    dims.className = "udoc-page-modal__dims";
    const { field: wField, input: widthInput } = labeledField(i18n.t("pageSettings.width"));
    const { field: hField, input: heightInput } = labeledField(i18n.t("pageSettings.height"));
    const unit = document.createElement("span");
    unit.className = "udoc-page-modal__unit-label";
    unit.textContent = i18n.t("image.pixels");
    dims.append(wField, hField, unit);

    const keep = document.createElement("label");
    keep.className = "udoc-page-modal__check";
    const keepInput = document.createElement("input");
    keepInput.type = "checkbox";
    keepInput.checked = true;
    const keepLabel = document.createElement("span");
    keepLabel.textContent = i18n.t("image.keepRatio");
    keep.append(keepInput, keepLabel);

    const original = document.createElement("div");
    original.className = "udoc-page-modal__hint";
    body.append(dims, keep, original);

    // --- footer ---
    const footer = document.createElement("div");
    footer.className = "udoc-page-modal__footer";
    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "udoc-page-modal__secondary";
    resetBtn.textContent = i18n.t("image.reset");
    const applyBtn = document.createElement("button");
    applyBtn.type = "button";
    applyBtn.className = "udoc-page-modal__apply";
    applyBtn.textContent = i18n.t("image.apply");
    footer.append(resetBtn, applyBtn);

    dialog.append(header, body, footer);
    el.append(backdrop, dialog);

    // --- state ---
    let width = 1;
    let height = 1;
    // Width over height, which the lock keeps — the page's as it opened.
    let ratio = 1;
    let ctx: ImageSizeContext | null = null;
    let isOpen = false;
    const unsubEvents: Array<() => void> = [];

    function render(): void {
        widthInput.value = String(width);
        heightInput.value = String(height);
    }

    // An edited side sets the other to the ratio while the lock is on; one
    // that doesn't parse goes back to what it was.
    on(widthInput, "change", () => {
        const n = parsePixels(widthInput.value);
        if (n !== null) {
            width = n;
            if (keepInput.checked) height = Math.min(MAX_PIXELS, Math.max(1, Math.round(n / ratio)));
        }
        render();
    });
    on(heightInput, "change", () => {
        const n = parsePixels(heightInput.value);
        if (n !== null) {
            height = n;
            if (keepInput.checked) width = Math.min(MAX_PIXELS, Math.max(1, Math.round(n * ratio)));
        }
        render();
    });

    on(resetBtn, "click", () => {
        if (!ctx) return;
        width = ctx.originalWidth;
        height = ctx.originalHeight;
        ratio = width / height;
        render();
    });

    function apply(): void {
        ctx?.onResize(width, height);
        close();
    }
    on(applyBtn, "click", apply);
    for (const input of [widthInput, heightInput]) {
        on(input, "keydown", (e) => {
            if ((e as KeyboardEvent).key === "Enter") {
                e.preventDefault();
                input.dispatchEvent(new Event("change"));
                apply();
            }
        });
    }

    on(closeBtn, "click", () => close());
    on(backdrop, "click", () => close());

    function open(context: ImageSizeContext): void {
        ctx = context;
        width = Math.max(1, Math.round(context.width));
        height = Math.max(1, Math.round(context.height));
        ratio = context.width / context.height;
        keepInput.checked = true;
        original.textContent = i18n.t("image.originalSize", {
            width: Math.round(context.originalWidth),
            height: Math.round(context.originalHeight),
        });
        render();
        isOpen = true;
        el.style.display = "";
        widthInput.focus();
        widthInput.select();
    }

    function close(): void {
        if (!isOpen) return;
        isOpen = false;
        ctx = null;
        el.style.display = "none";
    }

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

export type ImageSizeModal = ReturnType<typeof createImageSizeModal>;
