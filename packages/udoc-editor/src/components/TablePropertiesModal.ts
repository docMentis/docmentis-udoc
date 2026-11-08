// The Table Properties dialog, opened from the Table tab or a table's context
// menu: the selected rows' height, the selected columns' width, the cells'
// margins and, in a word document, whether the rows repeat as a header on each
// page. A modal — backdrop + centered dialog — on the page-settings dialog's
// styles.
//
// Storeless and imperative: mounted once and reused. `open(seed, onApply)`
// seeds it with what the selection holds — a field the selection holds several
// values of opens blank — and OK hands back the values, which the caller turns
// into the edits of what changed.

import { ICON_CLEAR, on } from "@docmentis/udoc-ui/internal";
import type { I18n } from "../i18n/index.js";
import type { MessageKey } from "../i18n/index.js";
import { MARGIN_SIDES } from "../table-edits.js";
import type { MarginSide, TablePropertiesSeed, TablePropertiesValues } from "../table-edits.js";

/** The largest measure a field takes, in points — 22 inches, past the widest
 *  page an Office document lays out. */
const MAX_POINTS = 1584;

/** A measure in points in `text`: `null` for a blank field (no change), `NaN`
 *  for one that isn't a measure in range. A height or a width must be more
 *  than nothing; a margin may be none. */
function parsePoints(text: string, min: "positive" | "zero"): number | null {
    const trimmed = text.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed.replace(",", "."));
    const inRange = Number.isFinite(n) && n <= MAX_POINTS && (min === "zero" ? n >= 0 : n > 0);
    return inRange ? n : Number.NaN;
}

/** A measure as a field shows it: up to two decimals, no trailing zeros. */
function formatPoints(value: number | null): string {
    return value === null ? "" : String(Math.round(value * 100) / 100);
}

function labeledField(labelText: string): { field: HTMLLabelElement; input: HTMLInputElement } {
    const field = document.createElement("label");
    field.className = "udoc-page-modal__field";
    const label = document.createElement("span");
    label.className = "udoc-page-modal__field-label";
    label.textContent = labelText;
    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "decimal";
    input.className = "udoc-page-modal__input";
    field.append(label, input);
    return { field, input };
}

/** A titled row of fields, the unit after them. */
function section(title: string, fields: readonly HTMLElement[], unit: string): HTMLDivElement {
    const row = document.createElement("div");
    row.className = "udoc-page-modal__row";
    const heading = document.createElement("span");
    heading.className = "udoc-page-modal__field-label";
    heading.textContent = title;
    const dims = document.createElement("div");
    dims.className = "udoc-page-modal__dims";
    const unitLabel = document.createElement("span");
    unitLabel.className = "udoc-page-modal__unit-label";
    unitLabel.textContent = unit;
    dims.append(...fields, unitLabel);
    row.append(heading, dims);
    return row;
}

const SIDE_LABELS: Record<MarginSide, MessageKey> = {
    top: "table.marginTop",
    bottom: "table.marginBottom",
    left: "table.marginLeft",
    right: "table.marginRight",
};

/** Build the Table Properties dialog, mounted once and re-seeded by `open`. */
export function createTablePropertiesModal(i18n: I18n) {
    const title = i18n.t("table.properties");
    const points = i18n.t("pageSettings.points");

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
    const height = labeledField(i18n.t("table.rowHeight"));
    const width = labeledField(i18n.t("table.columnWidth"));
    const margins = Object.fromEntries(
        MARGIN_SIDES.map((side) => [side, labeledField(i18n.t(SIDE_LABELS[side]))]),
    ) as Record<MarginSide, ReturnType<typeof labeledField>>;

    const repeat = document.createElement("label");
    repeat.className = "udoc-page-modal__check";
    const repeatInput = document.createElement("input");
    repeatInput.type = "checkbox";
    const repeatLabel = document.createElement("span");
    repeatLabel.textContent = i18n.t("table.repeatHeaderRow");
    repeat.append(repeatInput, repeatLabel);

    body.append(
        section(i18n.t("table.size"), [height.field, width.field], points),
        section(
            i18n.t("table.cellMargins"),
            MARGIN_SIDES.map((side) => margins[side].field),
            points,
        ),
        repeat,
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
    let onApply: ((values: TablePropertiesValues) => void) | null = null;
    let isOpen = false;
    const unsubEvents: Array<() => void> = [];

    // The checkbox's own value is on / off; `mixed` is the selection's rows
    // disagreeing, until the box is clicked and says one.
    let headerMixed = false;
    on(repeatInput, "change", () => {
        headerMixed = false;
        repeatInput.indeterminate = false;
    });

    /** The form's values, or `null` while a field holds what isn't a measure —
     *  that field marked invalid, the dialog left open. */
    function read(): TablePropertiesValues | null {
        const fields: Array<[HTMLInputElement, number | null]> = [];
        const measure = (input: HTMLInputElement, min: "positive" | "zero"): number | null => {
            const value = parsePoints(input.value, min);
            fields.push([input, value]);
            return value;
        };
        const values: TablePropertiesValues = {
            rowHeight: measure(height.input, "positive"),
            columnWidth: measure(width.input, "positive"),
            margins: {
                top: measure(margins.top.input, "zero"),
                bottom: measure(margins.bottom.input, "zero"),
                left: measure(margins.left.input, "zero"),
                right: measure(margins.right.input, "zero"),
            },
            header: headerMixed ? null : repeatInput.checked,
        };
        let valid = true;
        for (const [input, value] of fields) {
            const bad = value !== null && Number.isNaN(value);
            input.setAttribute("aria-invalid", String(bad));
            if (bad && valid) {
                valid = false;
                input.focus();
                input.select();
            }
        }
        return valid ? values : null;
    }

    function apply(): void {
        const values = read();
        if (!values) return;
        const done = onApply;
        close();
        done?.(values);
    }
    on(okBtn, "click", apply);
    for (const input of [height.input, width.input, ...MARGIN_SIDES.map((side) => margins[side].input)]) {
        on(input, "keydown", (e) => {
            if ((e as KeyboardEvent).key === "Enter") {
                e.preventDefault();
                apply();
            }
        });
    }

    on(closeBtn, "click", () => close());
    on(backdrop, "click", () => close());

    function open(seed: TablePropertiesSeed, apply: (values: TablePropertiesValues) => void): void {
        onApply = apply;
        const { values } = seed;
        height.input.value = formatPoints(values.rowHeight);
        width.input.value = formatPoints(values.columnWidth);
        for (const side of MARGIN_SIDES) margins[side].input.value = formatPoints(values.margins[side]);
        for (const input of el.querySelectorAll("input")) input.removeAttribute("aria-invalid");
        repeat.style.display = seed.showHeader ? "" : "none";
        headerMixed = values.header === null;
        repeatInput.checked = values.header === true;
        repeatInput.indeterminate = headerMixed;
        isOpen = true;
        el.style.display = "";
        height.input.focus();
        height.input.select();
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

export type TablePropertiesModal = ReturnType<typeof createTablePropertiesModal>;
