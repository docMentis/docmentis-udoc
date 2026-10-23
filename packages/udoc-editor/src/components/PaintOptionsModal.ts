// The advanced Fill / Line options dialog, opened from a paint panel's "More
// Fill/Line Options…" row. A modal — backdrop + centered dialog — that will
// host the richer authoring surface the dropdown can't: a custom colour, and
// the non-solid fills (gradient / pattern / picture) for Fill; compound lines,
// caps / joins, and arrow ends for Stroke.
//
// Storeless and imperative, matching {@link createPageSettingsModal}: mounted
// once by the shell and reused for whichever channel's row was clicked.
// `open({ channel })` seeds the title; the body is a placeholder until the
// surface is designed — the goal here is the dialog + its seam, not its content.

import { ICON_CLEAR, on } from "@docmentis/udoc-ui/internal";
import type { PaintChannel } from "@docmentis/udoc-ui/internal";
import type { I18n, MessageKey } from "../i18n/index.js";

/** What `open` needs — which channel's options to show. */
export interface PaintOptionsContext {
    channel: PaintChannel;
}

const TITLE: Record<PaintChannel, MessageKey> = {
    fill: "paintOptions.fillTitle",
    stroke: "paintOptions.lineTitle",
    text: "paintOptions.textColorTitle",
    highlight: "paintOptions.highlightTitle",
};

const BLURB: Record<PaintChannel, MessageKey> = {
    fill: "paintOptions.fillBlurb",
    stroke: "paintOptions.lineBlurb",
    text: "paintOptions.textColorBlurb",
    highlight: "paintOptions.highlightBlurb",
};

/**
 * Build the paint-options modal. The returned handle is mounted once by the
 * shell; `open` re-seeds it for whichever channel's row was clicked.
 */
export function createPaintOptionsModal(i18n: I18n) {
    const el = document.createElement("div");
    el.className = "udoc-paint-modal";
    el.style.display = "none";

    const backdrop = document.createElement("div");
    backdrop.className = "udoc-paint-modal__backdrop";

    const dialog = document.createElement("div");
    dialog.className = "udoc-paint-modal__dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");

    // --- header ---
    const header = document.createElement("div");
    header.className = "udoc-paint-modal__header";
    const heading = document.createElement("h2");
    heading.className = "udoc-paint-modal__heading";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "udoc-paint-modal__close";
    closeBtn.setAttribute("aria-label", i18n.t("common.close"));
    closeBtn.title = i18n.t("common.close");
    closeBtn.innerHTML = ICON_CLEAR;
    header.append(heading, closeBtn);

    // --- body (placeholder until the authoring surface is designed) ---
    const body = document.createElement("div");
    body.className = "udoc-paint-modal__body";
    const placeholder = document.createElement("p");
    placeholder.className = "udoc-paint-modal__placeholder";
    body.appendChild(placeholder);

    // --- footer ---
    const footer = document.createElement("div");
    footer.className = "udoc-paint-modal__footer";
    const doneBtn = document.createElement("button");
    doneBtn.type = "button";
    doneBtn.className = "udoc-paint-modal__done";
    doneBtn.textContent = i18n.t("common.done");
    footer.appendChild(doneBtn);

    dialog.append(header, body, footer);
    el.append(backdrop, dialog);

    let isOpen = false;
    const unsubEvents: Array<() => void> = [];

    on(closeBtn, "click", () => close());
    on(doneBtn, "click", () => close());
    on(backdrop, "click", () => close());

    function open(ctx: PaintOptionsContext): void {
        heading.textContent = i18n.t(TITLE[ctx.channel]);
        dialog.setAttribute("aria-label", i18n.t(TITLE[ctx.channel]));
        placeholder.textContent = i18n.t(BLURB[ctx.channel]);
        isOpen = true;
        el.style.display = "";
        doneBtn.focus();
    }

    function close(): void {
        if (!isOpen) return;
        isOpen = false;
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

export type PaintOptionsModal = ReturnType<typeof createPaintOptionsModal>;
