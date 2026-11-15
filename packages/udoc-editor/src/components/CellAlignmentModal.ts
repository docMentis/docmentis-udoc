// The Format Cell Alignment dialog, opened from the Cell tab's Alignment and
// Orientation dropdowns: every alignment a worksheet cell takes, as Excel's
// Format Cells dialog has them on its Alignment tab — where the text sits
// across and down, its indent, how it wraps or shrinks, its direction and how
// it turns. A modal — backdrop + centered dialog — on the page-settings
// dialog's styles.
//
// Storeless and imperative: mounted once and reused. `open(seed, onApply)`
// seeds it with the active cell's alignment, and OK hands back the values,
// which the caller turns into the edit of what changed.

import type { GridHorizontalAlignment, GridVerticalAlignment } from "@docmentis/udoc-wasm";
import { ICON_CLEAR, on } from "@docmentis/udoc-ui/internal";
import { degreesOf, INDENTED, MAX_INDENT, rotationOf, STACKED_TEXT } from "../cell-alignment-edits.js";
import type { CellAlignmentValues } from "../cell-alignment-edits.js";
import type { I18n, MessageKey } from "../i18n/index.js";

const HORIZONTALS: readonly (readonly [GridHorizontalAlignment, MessageKey])[] = [
    ["general", "cellAlignment.general"],
    ["left", "cellAlignment.left"],
    ["center", "cellAlignment.center"],
    ["right", "cellAlignment.right"],
    ["fill", "cellAlignment.fill"],
    ["justify", "cellAlignment.justify"],
    ["centerContinuous", "cellAlignment.centerAcross"],
    ["distributed", "cellAlignment.distributed"],
];

const VERTICALS: readonly (readonly [GridVerticalAlignment, MessageKey])[] = [
    ["top", "cellAlignment.top"],
    ["center", "cellAlignment.middle"],
    ["bottom", "cellAlignment.bottom"],
    ["justify", "cellAlignment.verticalJustify"],
    ["distributed", "cellAlignment.verticalDistributed"],
];

const DIRECTIONS: readonly (readonly [number, MessageKey])[] = [
    [0, "cellAlignment.context"],
    [1, "cellAlignment.leftToRight"],
    [2, "cellAlignment.rightToLeft"],
];

/** A whole number from `min` to `max` in `text`, else `NaN`. */
function parseWhole(text: string, min: number, max: number): number {
    const trimmed = text.trim().replace("−", "-");
    if (!/^[-+]?\d+$/.test(trimmed)) return Number.NaN;
    const n = Number(trimmed);
    return n >= min && n <= max ? n : Number.NaN;
}

/** `control` under the label `labelText`, which names it. */
function labeledField(labelText: string, control: HTMLElement): HTMLLabelElement {
    const field = document.createElement("label");
    field.className = "udoc-page-modal__field";
    const label = document.createElement("span");
    label.className = "udoc-page-modal__field-label";
    label.textContent = labelText;
    field.append(label, control);
    return field;
}

/** A select offering `options`, each value by its label. */
function select<T extends string | number>(
    i18n: I18n,
    options: readonly (readonly [T, MessageKey])[],
): HTMLSelectElement {
    const el = document.createElement("select");
    el.className = "udoc-page-modal__select";
    for (const [value, label] of options) {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = i18n.t(label);
        el.append(option);
    }
    return el;
}

/** A whole-number field. */
function wholeInput(): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "numeric";
    input.className = "udoc-page-modal__input";
    return input;
}

/** A checkbox after its label. */
function checkbox(labelText: string): { el: HTMLLabelElement; input: HTMLInputElement } {
    const el = document.createElement("label");
    el.className = "udoc-page-modal__check";
    const input = document.createElement("input");
    input.type = "checkbox";
    const label = document.createElement("span");
    label.textContent = labelText;
    el.append(input, label);
    return { el, input };
}

/** A group's heading. */
function groupHeading(text: string): HTMLDivElement {
    const el = document.createElement("div");
    el.className = "udoc-page-modal__group";
    el.textContent = text;
    return el;
}

/** A row of fields side by side. */
function dims(...fields: HTMLElement[]): HTMLDivElement {
    const el = document.createElement("div");
    el.className = "udoc-page-modal__dims";
    el.append(...fields);
    return el;
}

/** Build the Format Cell Alignment dialog, mounted once and re-seeded by
 *  `open`. */
export function createCellAlignmentModal(i18n: I18n) {
    const title = i18n.t("cell.formatAlignment");

    const el = document.createElement("div");
    el.className = "udoc-page-modal";
    el.style.display = "none";

    const backdrop = document.createElement("div");
    backdrop.className = "udoc-page-modal__backdrop";

    const dialog = document.createElement("div");
    dialog.className = "udoc-page-modal__dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", title);

    // --- header ---
    const header = document.createElement("div");
    header.className = "udoc-page-modal__header";
    const heading = document.createElement("h2");
    heading.className = "udoc-page-modal__heading";
    heading.textContent = title;
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "udoc-page-modal__close";
    closeBtn.setAttribute("aria-label", i18n.t("common.close"));
    closeBtn.title = i18n.t("common.close");
    closeBtn.innerHTML = ICON_CLEAR;
    header.append(heading, closeBtn);

    // --- body ---
    const body = document.createElement("div");
    body.className = "udoc-page-modal__body";
    const horizontal = select(i18n, HORIZONTALS);
    const indent = wholeInput();
    const indentField = labeledField(i18n.t("cellAlignment.indent"), indent);
    indentField.classList.add("udoc-page-modal__unit");
    const vertical = select(i18n, VERTICALS);
    const justifyLastLine = checkbox(i18n.t("cellAlignment.justifyDistributed"));
    const wrapText = checkbox(i18n.t("cellAlignment.wrapText"));
    const shrinkToFit = checkbox(i18n.t("cellAlignment.shrinkToFit"));
    const direction = select(i18n, DIRECTIONS);
    const degrees = wholeInput();
    const degreesField = labeledField(i18n.t("cellAlignment.degrees"), degrees);
    degreesField.classList.add("udoc-page-modal__unit");
    const stacked = checkbox(i18n.t("cellAlignment.verticalText"));

    const verticalRow = labeledField(i18n.t("cellAlignment.vertical"), vertical);
    verticalRow.classList.add("udoc-page-modal__row");
    const directionRow = labeledField(i18n.t("cellAlignment.textDirection"), direction);
    directionRow.classList.add("udoc-page-modal__row");
    body.append(
        groupHeading(i18n.t("cellAlignment.textAlignment")),
        dims(labeledField(i18n.t("cellAlignment.horizontal"), horizontal), indentField),
        verticalRow,
        justifyLastLine.el,
        groupHeading(i18n.t("cellAlignment.textControl")),
        wrapText.el,
        shrinkToFit.el,
        directionRow,
        groupHeading(i18n.t("cell.orientation")),
        dims(degreesField),
        stacked.el,
    );

    // --- footer ---
    const footer = document.createElement("div");
    footer.className = "udoc-page-modal__footer";
    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = "udoc-page-modal__apply";
    okBtn.textContent = i18n.t("common.ok");
    footer.append(okBtn);

    dialog.append(header, body, footer);
    el.append(backdrop, dialog);

    // --- state ---
    let onApply: ((values: CellAlignmentValues) => void) | null = null;
    let isOpen = false;
    const unsubEvents: Array<() => void> = [];

    /** Grey what the other choices leave without effect, as Excel's dialog
     *  does: the indent but for the "(Indent)" alignments, Justify distributed
     *  but for Distributed, and the degrees for stacked text. */
    function settle(): void {
        const across = horizontal.value as GridHorizontalAlignment;
        indent.disabled = !INDENTED.has(across);
        if (indent.disabled) indent.value = "0";
        justifyLastLine.input.disabled = across !== "distributed";
        if (justifyLastLine.input.disabled) justifyLastLine.input.checked = false;
        degrees.disabled = stacked.input.checked;
        if (degrees.disabled) degrees.value = "0";
        for (const input of [indent, degrees]) input.removeAttribute("aria-invalid");
    }
    on(horizontal, "change", settle);
    on(stacked.input, "change", settle);

    /** The form's values, or `null` while a field holds what isn't a whole
     *  number in range — that field marked invalid, the dialog left open. */
    function read(): CellAlignmentValues | null {
        const indentValue = indent.disabled ? 0 : parseWhole(indent.value, 0, MAX_INDENT);
        const degreesValue = degrees.disabled ? 0 : parseWhole(degrees.value, -90, 90);
        let valid = true;
        for (const [input, value] of [
            [indent, indentValue],
            [degrees, degreesValue],
        ] as const) {
            const bad = Number.isNaN(value);
            input.setAttribute("aria-invalid", String(bad));
            if (bad && valid) {
                valid = false;
                input.focus();
                input.select();
            }
        }
        if (!valid) return null;
        return {
            horizontal: horizontal.value as GridHorizontalAlignment,
            indent: indentValue,
            vertical: vertical.value as GridVerticalAlignment,
            justifyLastLine: justifyLastLine.input.checked,
            wrapText: wrapText.input.checked,
            shrinkToFit: shrinkToFit.input.checked,
            readingOrder: Number(direction.value),
            textRotation: stacked.input.checked ? STACKED_TEXT : rotationOf(degreesValue),
        };
    }

    function apply(): void {
        const values = read();
        if (!values) return;
        const done = onApply;
        close();
        done?.(values);
    }
    on(okBtn, "click", apply);
    for (const input of [indent, degrees]) {
        on(input, "keydown", (e) => {
            if ((e as KeyboardEvent).key === "Enter") {
                e.preventDefault();
                apply();
            }
        });
    }

    on(closeBtn, "click", () => close());
    on(backdrop, "click", () => close());

    function open(seed: CellAlignmentValues, apply: (values: CellAlignmentValues) => void): void {
        onApply = apply;
        horizontal.value = seed.horizontal;
        indent.value = String(seed.indent);
        vertical.value = seed.vertical;
        justifyLastLine.input.checked = seed.justifyLastLine;
        wrapText.input.checked = seed.wrapText;
        shrinkToFit.input.checked = seed.shrinkToFit;
        direction.value = String(seed.readingOrder);
        stacked.input.checked = seed.textRotation === STACKED_TEXT;
        degrees.value = String(degreesOf(seed.textRotation));
        settle();
        isOpen = true;
        el.style.display = "";
        horizontal.focus();
    }

    function close(): void {
        if (!isOpen) return;
        isOpen = false;
        onApply = null;
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

export type CellAlignmentModal = ReturnType<typeof createCellAlignmentModal>;
