// The delimiter a CSV's fields are split by, asked of the reader when the
// engine can't tell: the file's first lines as written, the delimiter picked
// marked in them, and the choices — a comma, a semicolon, a tab, a vertical
// bar or any other character — with the engine's guess picked, so Enter takes
// it.
//
// It covers the whole component, as the password dialog does, and for the
// same reason: until the document opens there is no document. What refuses
// the input is `inert` on its siblings, so it is mounted on the root.
//
// There is no Cancel: a delimiter is always picked, so the reader always has a
// next thing to do. The host moves on by opening another document, which
// dismisses it.
//
// Storeless and imperative, like the other dialogs: the shell asks it for a
// delimiter and opens the file split by what it hands back.

import { on } from "../../framework/index.js";
import { trapFocus } from "../a11y.js";
import type { I18n, MessageKey } from "../i18n/index.js";
import { csvPreviewLines } from "../source.js";

/** The delimiters offered by name, in order. */
const CHOICES: ReadonlyArray<{ delimiter: string; label: MessageKey }> = [
    { delimiter: ",", label: "delimiter.comma" },
    { delimiter: ";", label: "delimiter.semicolon" },
    { delimiter: "\t", label: "delimiter.tab" },
    { delimiter: "|", label: "delimiter.pipe" },
];

/** The radio standing for whatever the reader types. */
const OTHER = "other";

/** Whether `delimiter` can split a CSV's fields: one ASCII character, not the quote. */
function isDelimiter(delimiter: string): boolean {
    return delimiter.length === 1 && delimiter.charCodeAt(0) < 0x80 && delimiter !== '"';
}

/**
 * Build the delimiter dialog. The returned handle is mounted once by the shell
 * and asked for a delimiter per CSV the engine can't split for sure.
 */
export function createDelimiterModal(i18n: I18n) {
    const el = document.createElement("div");
    el.className = "udoc-delimiter-modal";
    el.style.display = "none";

    const backdrop = document.createElement("div");
    backdrop.className = "udoc-delimiter-modal__backdrop";

    const dialog = document.createElement("div");
    dialog.className = "udoc-delimiter-modal__dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");

    const heading = document.createElement("h2");
    heading.className = "udoc-delimiter-modal__heading";
    heading.id = "udoc-delimiter-modal-heading";
    heading.textContent = i18n.t("delimiter.title");
    dialog.setAttribute("aria-labelledby", heading.id);

    const form = document.createElement("form");
    form.className = "udoc-delimiter-modal__body";

    const message = document.createElement("p");
    message.className = "udoc-delimiter-modal__message";
    message.textContent = i18n.t("delimiter.message");

    const preview = document.createElement("pre");
    preview.className = "udoc-delimiter-modal__preview";
    preview.tabIndex = 0; // it scrolls sideways, so a keyboard reaches it
    preview.setAttribute("aria-label", i18n.t("delimiter.preview"));

    const radios = new Map<string, HTMLInputElement>();
    /** One radio row: the radio, its label, and the character it splits by where it shows. */
    function radioRow(value: string, text: string, ...trailing: HTMLElement[]): HTMLLabelElement {
        const row = document.createElement("label");
        row.className = "udoc-delimiter-modal__radio";
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "udoc-delimiter";
        radio.value = value;
        radios.set(value, radio);
        const label = document.createElement("span");
        label.textContent = text;
        row.append(radio, label, ...trailing);
        return row;
    }
    /** The character `delimiter` is, shown beside its name — none for a tab, which shows as nothing. */
    function glyph(delimiter: string): HTMLElement[] {
        if (delimiter === "\t") return [];
        const code = document.createElement("code");
        code.className = "udoc-delimiter-modal__glyph";
        code.textContent = delimiter;
        return [code];
    }
    const otherInput = document.createElement("input");
    otherInput.type = "text";
    otherInput.maxLength = 1;
    otherInput.className = "udoc-delimiter-modal__other";
    otherInput.autocomplete = "off";
    otherInput.setAttribute("aria-label", i18n.t("delimiter.otherLabel"));

    const radioGroup = document.createElement("div");
    radioGroup.className = "udoc-delimiter-modal__radios";
    radioGroup.setAttribute("role", "radiogroup");
    radioGroup.setAttribute("aria-label", i18n.t("delimiter.title"));
    radioGroup.append(
        ...CHOICES.map(({ delimiter, label }) => radioRow(delimiter, i18n.t(label), ...glyph(delimiter))),
        radioRow(OTHER, i18n.t("delimiter.other"), otherInput),
    );

    const error = document.createElement("p");
    error.className = "udoc-delimiter-modal__error";
    error.id = "udoc-delimiter-modal-error";
    error.setAttribute("aria-live", "polite");
    otherInput.setAttribute("aria-describedby", error.id);

    const footer = document.createElement("div");
    footer.className = "udoc-delimiter-modal__footer";
    const openButton = document.createElement("button");
    openButton.type = "submit";
    openButton.className = "udoc-delimiter-modal__open";
    openButton.textContent = i18n.t("delimiter.open");
    footer.appendChild(openButton);

    form.append(message, preview, radioGroup, error, footer);
    dialog.append(heading, form);
    el.append(backdrop, dialog);

    /** Hands the delimiter picked to the shell; null when nothing is asked. */
    let answer: ((delimiter: string | null) => void) | null = null;
    /** The first lines of the file asked about. */
    let lines: string[] = [];
    const unsubEvents: Array<() => void> = [];

    /** The delimiter picked: a named one, or what Other holds; null while Other holds none. */
    function picked(): string | null {
        const value = Array.from(radios.values()).find((radio) => radio.checked)?.value;
        if (value !== OTHER) return value ?? null;
        return isDelimiter(otherInput.value) ? otherInput.value : null;
    }

    /** Show the file's first lines, the delimiter picked marked in them. */
    function renderPreview(): void {
        const delimiter = picked();
        preview.replaceChildren(
            ...lines.flatMap((line, i) => {
                const parts = delimiter === null ? [line] : line.split(delimiter);
                const marked = parts.flatMap((part, j): Array<string | HTMLElement> => {
                    if (j === 0) return [part];
                    const mark = document.createElement("mark");
                    mark.className = "udoc-delimiter-modal__mark";
                    mark.textContent = delimiter;
                    return [mark, part];
                });
                return i === 0 ? marked : ["\n", ...marked];
            }),
        );
    }

    /**
     * Everything the dialog covers: every sibling of the scrim, which is the
     * whole UI — the shell mounts this on the root.
     */
    function covered(): HTMLElement[] {
        const parent = el.parentElement;
        if (!parent) return [];
        return Array.from(parent.children).filter(
            (child): child is HTMLElement => child !== el && child instanceof HTMLElement,
        );
    }

    function setInert(inert: boolean): void {
        for (const element of covered()) element.inert = inert;
    }

    function hide(): void {
        if (el.style.display === "none") return;
        el.style.display = "none";
        lines = [];
        preview.replaceChildren();
        otherInput.value = "";
        error.textContent = "";
        setInert(false);
    }

    on(radioGroup, "change", () => {
        error.textContent = "";
        renderPreview();
    });
    // Typing in Other picks it.
    on(otherInput, "focus", () => {
        radios.get(OTHER)!.checked = true;
        renderPreview();
    });
    on(otherInput, "input", () => {
        radios.get(OTHER)!.checked = true;
        error.textContent = "";
        renderPreview();
    });
    on(form, "submit", (e) => {
        e.preventDefault();
        const delimiter = picked();
        if (delimiter === null) {
            error.textContent = i18n.t("delimiter.otherInvalid");
            otherInput.focus();
            return;
        }
        if (!answer) return;
        const give = answer;
        answer = null;
        hide();
        give(delimiter);
    });

    /**
     * Ask which delimiter splits the fields of the CSV `bytes`, with `guess`,
     * the engine's, picked. Resolves with the one the reader opens it with, or
     * null once the dialog is {@link dismiss dismissed} instead.
     */
    function ask(bytes: Uint8Array, guess: string): Promise<string | null> {
        // An outstanding ask is abandoned rather than stacked.
        answer?.(null);
        lines = csvPreviewLines(bytes);
        const named = radios.get(guess);
        const choice = named ?? radios.get(OTHER)!;
        choice.checked = true;
        otherInput.value = named ? "" : guess;
        error.textContent = "";
        renderPreview();
        const shown = el.style.display !== "none";
        el.style.display = "";
        // Focus first, then inert: an inert element cannot take focus, so
        // doing it the other way round leaves focus wherever it was.
        choice.focus();
        if (!shown) setInert(true);
        return new Promise((resolve) => {
            answer = resolve;
        });
    }

    /** Take the dialog down, answering an outstanding {@link ask} with null. */
    function dismiss(): void {
        const pending = answer;
        answer = null;
        pending?.(null);
        hide();
    }

    function mount(parent: HTMLElement): void {
        parent.appendChild(el);
        // Inert keeps Tab out of the UI; this keeps it out of the browser's
        // own chrome too.
        unsubEvents.push(trapFocus(el));
    }

    function destroy(): void {
        dismiss();
        for (const off of unsubEvents) off();
        el.remove();
    }

    return { el, mount, ask, dismiss, destroy };
}

export type DelimiterModal = ReturnType<typeof createDelimiterModal>;
