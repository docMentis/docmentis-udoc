// The form field input (`udoc:form-field`): the control a form field is filled
// in with, laid over the widget a press landed on.
//
// A text field, a combo box and a list box are filled in with the browser's own
// control — an input, a text area, a list — so typing, an IME, spell checking,
// a password's dots and picking from a list are the platform's. Its value is
// the field's once the control is left: Enter in a line, Tab, a press anywhere
// else, or an item picked from a single-choice list. Escape drops it. The
// engine then draws the value on every widget of the field, as the appearance
// a PDF viewer reads; until then the control covers the widget, so the value
// the widget drew doesn't show through.

import type { AcroFormField, AcroFormFieldFill, AnnotationTextJustification } from "@docmentis/udoc-wasm";
import type { FormWidget } from "../../worker/protocol.js";
import { exportOf, fieldShared, withChoice, withText } from "../forms.js";
import { applyPoint, type Affine } from "./affine.js";
import type { OverlaySource } from "./OverlayManager.js";

/** The size, in points, a multi-line field's or a list's text is set at when
 *  its `/DA` gives 0 — the size Acrobat starts from. */
const LIST_FONT_SIZE = 12;

/** A single line's height in font sizes: Helvetica's bounding box, which a
 *  `/DA` size of 0 fits a line's height to, as Acrobat does. */
const LINE_HEIGHT = 1.156;

/** The padding, in points, a widget keeps its text inside its border by. */
const PADDING = 2;

export interface FormFieldInputCallbacks {
    /** The widget whose field is being filled in — its id, and the field and
     *  widget as read when the press landed — or null for none. */
    filling: () => { widget: string; form: FormWidget } | null;
    /** Page `page`'s page→viewport affine this frame, or null when it isn't on
     *  screen. */
    pageToViewport: (page: number) => Affine | null;
    /** Fill the field in with the value the control holds. */
    onCommit: (fill: AcroFormFieldFill) => void;
    /** The control is done with, its value filled in or dropped. */
    onClose: () => void;
}

/** The control filling in the field of the widget being filled in, over the
 *  widget, at its size at every zoom. */
export function formFieldInput(callbacks: FormFieldInputCallbacks): OverlaySource {
    return (frame) => {
        const filling = callbacks.filling();
        const m = filling && callbacks.pageToViewport(filling.form.index);
        if (!filling || !m) return [];
        const { x0, y0, x1, y1 } = filling.form.rect;
        const corners = [applyPoint(m, x0, y0), applyPoint(m, x1, y0), applyPoint(m, x0, y1), applyPoint(m, x1, y1)];
        const left = Math.min(...corners.map((c) => c.x));
        const top = Math.min(...corners.map((c) => c.y));
        const width = Math.max(...corners.map((c) => c.x)) - left;
        const height = Math.max(...corners.map((c) => c.y)) - top;
        const size = fontSize(filling.form.field, height / frame.scale) * frame.scale;
        return [
            {
                key: `form-field:${filling.widget}`,
                x: left,
                y: top,
                create: () => createControl(filling.form.field, callbacks),
                update: (el) => {
                    el.style.width = `${width}px`;
                    el.style.height = `${height}px`;
                    el.style.fontSize = `${size}px`;
                },
            },
        ];
    };
}

/** The size, in points, `field`'s text is set at in a widget `height` points
 *  tall: its `/DA`'s, else a multi-line field's or a list's 12, else the size
 *  a line fits the height inside the padding at. */
function fontSize(field: AcroFormField, height: number): number {
    const size = fieldShared(field).defaultAppearance?.textStyle.fontSize ?? 0;
    if (size > 0) return size;
    if (("text" in field && field.text.multiline) || "listBox" in field) return LIST_FONT_SIZE;
    return Math.max(1, (height - 2 * PADDING) / LINE_HEIGHT);
}

/** The control `field` is filled in with, its value the field's. */
function createControl(field: AcroFormField, callbacks: FormFieldInputCallbacks): HTMLElement {
    const el = document.createElement("div");
    el.className = "udoc-ui__form-field";
    const { control, suggestions, filled, picks } = buildControl(field);
    // The field's alternate name is what a reader names it by (§12.7.4.1).
    const { alternateName } = fieldShared(field);
    if (alternateName) {
        control.title = alternateName;
        control.setAttribute("aria-label", alternateName);
    }
    el.append(control, ...(suggestions ? [suggestions] : []));

    let done = false;
    const finish = (commit: boolean): void => {
        if (done) return;
        done = true;
        document.removeEventListener("pointerdown", onOutside, true);
        const fill = commit ? filled() : null;
        if (fill) callbacks.onCommit(fill);
        callbacks.onClose();
    };
    // A press anywhere else leaves the control, as a blur does — the canvas
    // keeps the focus it had, so a press on it blurs nothing.
    const onOutside = (e: PointerEvent): void => {
        if (!el.isConnected) {
            // Taken down unfinished — its document closed under it.
            done = true;
            document.removeEventListener("pointerdown", onOutside, true);
        } else if (!(e.target instanceof Node && el.contains(e.target))) {
            finish(true);
        }
    };
    document.addEventListener("pointerdown", onOutside, true);
    control.addEventListener("blur", () => finish(true));
    if (picks) control.addEventListener("change", () => finish(true));
    control.addEventListener("keydown", (e) => {
        // The field's keys are the field's: none reaches the UI's shortcuts.
        e.stopPropagation();
        const ke = e as KeyboardEvent;
        if (ke.key === "Escape") {
            ke.preventDefault();
            finish(false);
        } else if (
            ke.key === "Tab" ||
            (ke.key === "Enter" && (!(control instanceof HTMLTextAreaElement) || ke.ctrlKey || ke.metaKey))
        ) {
            ke.preventDefault();
            finish(true);
        }
    });
    // The element is attached after `create` returns.
    requestAnimationFrame(() => {
        if (!done) control.focus({ preventScroll: true });
    });
    return el;
}

/** The control for `field`, with the list of `suggestions` an input offers;
 *  `filled`, the field filled in with the value it holds, or null where that is the
 *  value it started with; and `picks`, whether choosing an item leaves it — a
 *  single-choice list's does. */
function buildControl(field: AcroFormField): {
    control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    suggestions?: HTMLDataListElement;
    filled: () => AcroFormFieldFill | null;
    picks: boolean;
} {
    if ("text" in field) {
        const text = field.text;
        const input = text.multiline ? document.createElement("textarea") : document.createElement("input");
        if (input instanceof HTMLInputElement) input.type = text.password ? "password" : "text";
        const initial = text.value ?? "";
        input.value = initial;
        if (text.maxLen !== null) input.maxLength = text.maxLen;
        input.spellcheck = !text.doNotSpellCheck;
        align(input, text.justification);
        return {
            control: input,
            filled: () => (input.value === initial ? null : withText(field, input.value)),
            picks: false,
        };
    }
    if ("comboBox" in field && field.comboBox.edit) {
        // A combo box that takes text of its own: typed, or picked from its
        // items as suggestions.
        const combo = field.comboBox;
        const input = document.createElement("input");
        const list = document.createElement("datalist");
        list.id = `udoc-form-field-${++datalists}`;
        for (const option of combo.options) list.append(new Option(option.text, option.text));
        input.setAttribute("list", list.id);
        const chosen = combo.options.find((option) => combo.value.includes(exportOf(option)));
        const initial = chosen?.text ?? combo.value[0] ?? "";
        input.value = initial;
        input.spellcheck = !combo.doNotSpellCheck;
        align(input, combo.justification);
        return {
            control: input,
            suggestions: list,
            filled: () => (input.value === initial ? null : withText(field, input.value)),
            picks: false,
        };
    }
    if ("comboBox" in field || "listBox" in field) {
        const choice = "comboBox" in field ? field.comboBox : field.listBox;
        const select = document.createElement("select");
        const list = "listBox" in field;
        select.multiple = list && choice.multiSelect;
        if (list) select.size = Math.max(2, choice.options.length);
        choice.options.forEach((option, index) => {
            const chosen =
                choice.selected.length > 0 ? choice.selected.includes(index) : choice.value.includes(exportOf(option));
            select.append(new Option(option.text, String(index), chosen, chosen));
        });
        if (
            !select.multiple &&
            choice.selected.length === 0 &&
            !choice.options.some((o) => choice.value.includes(exportOf(o)))
        ) {
            select.selectedIndex = -1;
        }
        const indices = (): number[] => [...select.selectedOptions].map((option) => Number(option.value));
        const initial = indices().join(",");
        return {
            control: select,
            filled: () => (indices().join(",") === initial ? null : withChoice(field, indices())),
            picks: !select.multiple,
        };
    }
    // No other field is filled in with a control.
    const input = document.createElement("input");
    return { control: input, filled: () => null, picks: false };
}

/** Datalists minted so far — each an id of its own. */
let datalists = 0;

/** Align `input`'s text as `/Q` asks. */
function align(input: HTMLInputElement | HTMLTextAreaElement, justification: AnnotationTextJustification | null): void {
    input.style.textAlign = justification === "centered" ? "center" : justification === "right" ? "right" : "left";
}
