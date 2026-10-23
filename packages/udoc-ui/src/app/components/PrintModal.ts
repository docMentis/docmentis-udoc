// The print dialog, opened from the toolbar menu's Print: which pages to print —
// all, the current one, a from–to run, or a custom list like `1,3,5-8` — and
// how finely to render them. Ported from the udoc-viewer's print dialog.
//
// Storeless and imperative, like the other dialogs (PageSettingsModal,
// NewSlideModal): mounted once by the shell and reused. `open(ctx)` seeds it
// with the document's page count and current page; Print hands the choice to
// `ctx.onPrint` as `PrintOptions`.

import { on } from "../../framework/index.js";
import { trapFocus } from "../a11y.js";
import { ICON_CLEAR } from "../icons.js";
import type { PrintOptions, PrintQuality } from "../print.js";
import type { DocProfile } from "../profiles.js";
import type { I18n, MessageKey } from "../i18n/index.js";

/** What `open` needs: the document's pages and what to do with the choice. */
export interface PrintModalContext {
    /** Pages in the document. */
    pageCount: number;
    /** The current page, 1-based. */
    currentPage: number;
    /** What a page is called — "Slide" in a deck — which the dialog's words
     *  carry. */
    pageNoun: DocProfile["pageNoun"];
    /** Print as chosen. */
    onPrint: (options: PrintOptions) => void;
}

/** Which pages the radios choose. */
type Range = "all" | "current" | "fromTo" | "custom";

/** The quality choices, as the select lists them. */
const QUALITIES: ReadonlyArray<{ value: PrintQuality; label: MessageKey }> = [
    { value: "draft", label: "print.qualityDraft" },
    { value: "standard", label: "print.qualityStandard" },
    { value: "high", label: "print.qualityHigh" },
];

/** The pages section's words, for each word a page goes by. */
const PAGE_WORDS: Record<
    DocProfile["pageNoun"],
    {
        pages: MessageKey;
        all: MessageKey;
        current: MessageKey;
        first: MessageKey;
        last: MessageKey;
        custom: MessageKey;
        fromToInvalid: MessageKey;
        fromAfterTo: MessageKey;
        customInvalid: MessageKey;
    }
> = {
    Page: {
        pages: "print.pages",
        all: "print.allPages",
        current: "print.currentPage",
        first: "print.firstPage",
        last: "print.lastPage",
        custom: "print.customPages",
        fromToInvalid: "print.pagesFromToInvalid",
        fromAfterTo: "print.pagesFromAfterTo",
        customInvalid: "print.pagesCustomInvalid",
    },
    Slide: {
        pages: "print.slides",
        all: "print.allSlides",
        current: "print.currentSlide",
        first: "print.firstSlide",
        last: "print.lastSlide",
        custom: "print.customSlides",
        fromToInvalid: "print.slidesFromToInvalid",
        fromAfterTo: "print.slidesFromAfterTo",
        customInvalid: "print.slidesCustomInvalid",
    },
};

/**
 * The 1-based pages a custom range like `1,3,5-8` names, sorted and without
 * repeats, or null when it names none or one past `pageCount`.
 */
function parsePageList(input: string, pageCount: number): number[] | null {
    const pages = new Set<number>();
    for (const part of input.split(",")) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const bounds = trimmed.split("-").map((bound) => Number(bound.trim()));
        if (bounds.length > 2 || bounds.some((page) => !Number.isInteger(page) || page < 1 || page > pageCount)) {
            return null;
        }
        const from = bounds[0]!;
        const to = bounds[1] ?? from;
        if (from > to) return null;
        for (let page = from; page <= to; page++) pages.add(page);
    }
    return pages.size === 0 ? null : [...pages].sort((a, b) => a - b);
}

/** The pages from `from` to `to`, inclusive. */
function pagesFromTo(from: number, to: number): number[] {
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/**
 * Build the print dialog. The returned handle is mounted once by the shell;
 * `open` re-seeds it for each print.
 */
export function createPrintModal(i18n: I18n) {
    const el = document.createElement("div");
    el.className = "udoc-print-modal";
    el.style.display = "none";

    const backdrop = document.createElement("div");
    backdrop.className = "udoc-print-modal__backdrop";

    const dialog = document.createElement("div");
    dialog.className = "udoc-print-modal__dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", i18n.t("print.title"));

    // --- header ---
    const header = document.createElement("div");
    header.className = "udoc-print-modal__header";
    const heading = document.createElement("h2");
    heading.className = "udoc-print-modal__heading";
    heading.textContent = i18n.t("print.title");
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "udoc-print-modal__close";
    closeBtn.setAttribute("aria-label", i18n.t("common.close"));
    closeBtn.title = i18n.t("common.close");
    closeBtn.innerHTML = ICON_CLEAR;
    header.append(heading, closeBtn);

    const body = document.createElement("div");
    body.className = "udoc-print-modal__body";

    // --- pages section ---
    const pagesLabel = document.createElement("div");
    pagesLabel.className = "udoc-print-modal__section-label";
    pagesLabel.textContent = i18n.t("print.pages");

    const radios = new Map<Range, HTMLInputElement>();
    /** Each radio's label, worded for the document's pages at `open`. */
    const radioLabels = new Map<Range, HTMLSpanElement>();
    /** One radio row: the radio, its label, and whatever input it governs. */
    function radioRow(range: Range, text: string, ...trailing: HTMLElement[]): HTMLLabelElement {
        const row = document.createElement("label");
        row.className = "udoc-print-modal__radio";
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "udoc-print-range";
        radio.value = range;
        radios.set(range, radio);
        const label = document.createElement("span");
        label.textContent = text;
        radioLabels.set(range, label);
        row.append(radio, label, ...trailing);
        return row;
    }
    function pageInput(): HTMLInputElement {
        const input = document.createElement("input");
        input.type = "number";
        input.min = "1";
        input.className = "udoc-print-modal__input udoc-print-modal__input--page";
        return input;
    }
    const fromInput = pageInput();
    const toInput = pageInput();
    const toLabel = document.createElement("span");
    toLabel.textContent = i18n.t("print.to");
    const customInput = document.createElement("input");
    customInput.type = "text";
    customInput.className = "udoc-print-modal__input udoc-print-modal__input--custom";
    customInput.placeholder = i18n.t("print.customPlaceholder");

    const radioGroup = document.createElement("div");
    radioGroup.className = "udoc-print-modal__radios";
    radioGroup.setAttribute("role", "radiogroup");
    radioGroup.append(
        radioRow("all", ""),
        radioRow("current", ""),
        radioRow("fromTo", "", fromInput, toLabel, toInput),
        radioRow("custom", i18n.t("print.custom"), customInput),
    );

    /** Word the pages section for `noun` — "Page", or "Slide" in a deck — and
     *  `currentPage`. */
    function namePages(noun: DocProfile["pageNoun"], currentPage: number): void {
        const words = PAGE_WORDS[noun];
        pagesLabel.textContent = i18n.t(words.pages);
        radioGroup.setAttribute("aria-label", i18n.t(words.pages));
        radioLabels.get("all")!.textContent = i18n.t(words.all);
        radioLabels.get("current")!.textContent = i18n.t(words.current, { page: currentPage });
        radioLabels.get("fromTo")!.textContent = i18n.t(words.pages);
        fromInput.setAttribute("aria-label", i18n.t(words.first));
        toInput.setAttribute("aria-label", i18n.t(words.last));
        customInput.setAttribute("aria-label", i18n.t(words.custom));
    }

    // --- quality section ---
    const qualityLabel = document.createElement("div");
    qualityLabel.className = "udoc-print-modal__section-label";
    qualityLabel.textContent = i18n.t("print.quality");
    const qualitySelect = document.createElement("select");
    qualitySelect.className = "udoc-print-modal__select";
    qualitySelect.setAttribute("aria-label", i18n.t("print.quality"));
    for (const { value, label } of QUALITIES) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = i18n.t(label);
        qualitySelect.append(option);
    }

    const error = document.createElement("p");
    error.className = "udoc-print-modal__error";
    error.setAttribute("aria-live", "polite");

    // --- footer ---
    const footer = document.createElement("div");
    footer.className = "udoc-print-modal__footer";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "udoc-print-modal__cancel";
    cancelBtn.textContent = i18n.t("common.cancel");
    const printBtn = document.createElement("button");
    printBtn.type = "button";
    printBtn.className = "udoc-print-modal__print";
    printBtn.textContent = i18n.t("print.print");
    footer.append(cancelBtn, printBtn);

    body.append(pagesLabel, radioGroup, qualityLabel, qualitySelect, error);
    dialog.append(header, body, footer);
    el.append(backdrop, dialog);

    // --- state ---
    let ctx: PrintModalContext | null = null;
    let releaseFocus: (() => void) | null = null;
    let returnFocus: HTMLElement | null = null;
    const unsubEvents: Array<() => void> = [];

    function selected(): Range {
        for (const [range, radio] of radios) if (radio.checked) return range;
        return "all";
    }

    /** Enable the inputs the chosen range reads, and clear any error. */
    function render(): void {
        const range = selected();
        fromInput.disabled = range !== "fromTo";
        toInput.disabled = range !== "fromTo";
        customInput.disabled = range !== "custom";
        error.textContent = "";
    }

    function choose(range: Range): void {
        radios.get(range)!.checked = true;
        render();
    }

    for (const radio of radios.values()) on(radio, "change", render);
    // Clicking into a range's input chooses that range, as in the viewer.
    on(fromInput, "focus", () => choose("fromTo"));
    on(toInput, "focus", () => choose("fromTo"));
    on(customInput, "focus", () => choose("custom"));

    /** The pages chosen, or null after saying what is wrong with them. */
    function chosenPages(context: PrintModalContext): readonly number[] | undefined | null {
        const { pageCount, currentPage } = context;
        const words = PAGE_WORDS[context.pageNoun];
        switch (selected()) {
            case "all":
                return undefined;
            case "current":
                return [currentPage];
            case "fromTo": {
                const from = Number(fromInput.value);
                const to = Number(toInput.value);
                const valid = (page: number) => Number.isInteger(page) && page >= 1 && page <= pageCount;
                if (!valid(from) || !valid(to)) {
                    error.textContent = i18n.t(words.fromToInvalid, { count: pageCount });
                    return null;
                }
                if (from > to) {
                    error.textContent = i18n.t(words.fromAfterTo);
                    return null;
                }
                return pagesFromTo(from, to);
            }
            case "custom": {
                const pages = parsePageList(customInput.value, pageCount);
                if (pages === null) error.textContent = i18n.t(words.customInvalid, { count: pageCount });
                return pages;
            }
        }
    }

    function print(): void {
        if (!ctx) return;
        const pages = chosenPages(ctx);
        if (pages === null) return;
        const onPrint = ctx.onPrint;
        const quality = qualitySelect.value as PrintQuality;
        close();
        onPrint(pages === undefined ? { quality } : { pages, quality });
    }

    on(printBtn, "click", print);
    on(cancelBtn, "click", () => close());
    on(closeBtn, "click", () => close());
    on(backdrop, "click", () => close());
    for (const input of [fromInput, toInput, customInput]) {
        on(input, "keydown", (e) => {
            if ((e as KeyboardEvent).key === "Enter") {
                e.preventDefault();
                print();
            }
        });
    }

    function open(context: PrintModalContext): void {
        ctx = context;
        namePages(context.pageNoun, context.currentPage);
        fromInput.max = String(context.pageCount);
        toInput.max = String(context.pageCount);
        fromInput.value = "1";
        toInput.value = String(context.pageCount);
        customInput.value = "";
        qualitySelect.value = "standard";
        choose("all");
        returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        el.style.display = "";
        releaseFocus = trapFocus(dialog);
        printBtn.focus();
    }

    function close(): void {
        if (!ctx) return;
        ctx = null;
        releaseFocus?.();
        releaseFocus = null;
        el.style.display = "none";
        if (returnFocus?.isConnected) returnFocus.focus();
        returnFocus = null;
    }

    function mount(parent: HTMLElement): void {
        parent.appendChild(el);
        const onKeydown = (e: KeyboardEvent) => {
            if (ctx && e.key === "Escape") {
                e.stopPropagation();
                close();
            }
        };
        document.addEventListener("keydown", onKeydown);
        unsubEvents.push(() => document.removeEventListener("keydown", onKeydown));
    }

    function destroy(): void {
        for (const off of unsubEvents) off();
        releaseFocus?.();
        el.remove();
    }

    return { el, mount, open, close, destroy };
}

export type PrintModal = ReturnType<typeof createPrintModal>;
