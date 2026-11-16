// The Generate dialog, opened from a template's Automation tab: the data to fill
// the template with, as JSON — at first its sample data, every value it lacks
// made up — edited in place or read from a file, and Generate, which fills a copy
// of the template with it and downloads the copy. An instance's Refresh opens it
// too, to fill the instance again in place. A modal — backdrop + centered
// dialog — on the page-settings dialog's styles.
//
// Storeless and imperative: mounted once and reused. `open(ctx)` seeds it with
// the data and the callback that turns Generate into a download; it owns no
// document state of its own.

import { ICON_CLEAR, on } from "@docmentis/udoc-ui/internal";
import type { BindingData } from "@docmentis/udoc-wasm";
import type { I18n } from "../i18n/index.js";

/** What `open` needs: the data to start from, how to fill with it, and what
 *  the dialog calls that. */
export interface GenerateContext {
    /** The data the text box starts with, as JSON. */
    json: string;
    /** Fill with `data`: a copy of the template, downloaded, or an instance in
     *  place. */
    onGenerate: (data: BindingData) => Promise<void>;
    /** What the dialog and its button are named: Generate, the default, or
     *  Refresh. */
    action?: "command.generate" | "command.refresh";
}

/** `text` read as the data to fill a template with — a JSON object — or null. */
function readData(text: string): BindingData | null {
    try {
        const value: unknown = JSON.parse(text);
        return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as BindingData) : null;
    } catch {
        return null;
    }
}

/** Build the Generate dialog, mounted once and re-seeded by `open`. */
export function createGenerateModal(i18n: I18n) {
    const el = document.createElement("div");
    el.className = "udoc-page-modal";
    el.style.display = "none";

    const backdrop = document.createElement("div");
    backdrop.className = "udoc-page-modal__backdrop";

    const dialog = document.createElement("div");
    dialog.className = "udoc-page-modal__dialog udoc-page-modal__dialog--wide";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", i18n.t("command.generate"));

    // --- header ---
    const header = document.createElement("div");
    header.className = "udoc-page-modal__header";
    const heading = document.createElement("h2");
    heading.className = "udoc-page-modal__heading";
    heading.textContent = i18n.t("command.generate");
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "udoc-page-modal__close";
    closeBtn.setAttribute("aria-label", i18n.t("common.close"));
    closeBtn.title = i18n.t("common.close");
    closeBtn.innerHTML = ICON_CLEAR;
    header.append(heading, closeBtn);

    // --- data ---
    const body = document.createElement("div");
    body.className = "udoc-page-modal__body";
    const hint = document.createElement("div");
    hint.className = "udoc-page-modal__hint";
    hint.textContent = i18n.t("generate.hint");
    const text = document.createElement("textarea");
    text.className = "udoc-page-modal__json";
    text.spellcheck = false;
    text.setAttribute("aria-label", i18n.t("generate.hint"));
    const error = document.createElement("div");
    error.className = "udoc-page-modal__error";
    error.setAttribute("role", "alert");
    body.append(hint, text, error);

    // --- footer ---
    const footer = document.createElement("div");
    footer.className = "udoc-page-modal__footer";
    const file = document.createElement("input");
    file.type = "file";
    file.accept = ".json,application/json";
    file.hidden = true;
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "udoc-page-modal__secondary";
    openBtn.textContent = i18n.t("generate.openFile");
    const generateBtn = document.createElement("button");
    generateBtn.type = "button";
    generateBtn.className = "udoc-page-modal__apply";
    generateBtn.textContent = i18n.t("command.generate");
    footer.append(file, openBtn, generateBtn);

    dialog.append(header, body, footer);
    el.append(backdrop, dialog);

    // --- state ---
    let ctx: GenerateContext | null = null;
    let isOpen = false;
    let busy = false;
    const unsubEvents: Array<() => void> = [];

    function setBusy(next: boolean): void {
        busy = next;
        generateBtn.disabled = next;
        openBtn.disabled = next;
    }

    on(openBtn, "click", () => file.click());
    on(file, "change", () => {
        const chosen = file.files?.[0];
        file.value = "";
        if (!chosen) return;
        void chosen.text().then((json) => {
            text.value = json;
            error.textContent = "";
        });
    });

    async function generate(): Promise<void> {
        if (!ctx || busy) return;
        const data = readData(text.value);
        if (data === null) {
            error.textContent = i18n.t("generate.invalid");
            return;
        }
        error.textContent = "";
        setBusy(true);
        try {
            await ctx.onGenerate(data);
            close();
        } catch (failure) {
            console.error("udoc: generating failed", failure);
            error.textContent = i18n.t("generate.failed");
        } finally {
            setBusy(false);
        }
    }
    on(generateBtn, "click", () => void generate());

    on(closeBtn, "click", () => close());
    on(backdrop, "click", () => close());

    function open(context: GenerateContext): void {
        ctx = context;
        const action = i18n.t(context.action ?? "command.generate");
        dialog.setAttribute("aria-label", action);
        heading.textContent = action;
        generateBtn.textContent = action;
        text.value = context.json;
        error.textContent = "";
        setBusy(false);
        isOpen = true;
        el.style.display = "";
        text.focus();
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

export type GenerateModal = ReturnType<typeof createGenerateModal>;
