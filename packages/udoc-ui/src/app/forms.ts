// Fill in a PDF's interactive form (§12.7): what a press on a widget does to
// its field, and the value it fills it in with.
//
// A field's value is the field's, shown by each of its widgets. The shell reads
// the field a pressed widget belongs to, this module gives what filling it in
// sets — a text field's text, a check box's or radio button's on state or
// `Off`, a choice field's chosen items — and the shell sends that in a
// `FillAcroFormFields` command, which shows it on its widgets.

import type {
    AcroForm,
    AcroFormField,
    AcroFormFieldFill,
    AcroFormFieldShared,
    AcroFormChoiceOption,
} from "@docmentis/udoc-wasm";

/**
 * How a press on a widget fills its field in: `text` types into it (a text
 * field, or a combo box that takes text of its own), `toggle` turns a check box
 * or radio button on or off, `choice` picks from a list.
 */
export type FillKind = "text" | "toggle" | "choice";

/** What every field type holds, whichever type `field` is. */
export function fieldShared(field: AcroFormField): AcroFormFieldShared {
    return Object.values(field)[0]!.shared;
}

/**
 * How a press fills `field` in, or null when it doesn't: a read-only field, a
 * push-button (no value), a signature (signing isn't filling in), and a text
 * field that names a file to submit.
 */
export function fillKind(field: AcroFormField): FillKind | null {
    if (fieldShared(field).readOnly) return null;
    if ("text" in field) return field.text.fileSelect ? null : "text";
    if ("checkBox" in field || "radioButton" in field) return "toggle";
    if ("comboBox" in field) return field.comboBox.edit ? "text" : "choice";
    if ("listBox" in field) return "choice";
    return null;
}

/** Each widget of `form`'s fields, with how a press fills its field in through
 *  it — null where none does. */
export function widgetFills(form: AcroForm): Map<string, FillKind | null> {
    const widgets = new Map<string, FillKind | null>();
    for (const field of form.fields) {
        const kind = fillKind(field);
        for (const widget of fieldShared(field).widgets) widgets.set(widget, kind);
    }
    return widgets;
}

/** Each widget of `form`'s fields that have an alternate name — the `/TU` a
 *  reader shows wherever it names the field (§12.7.4.1) — with that name. */
export function widgetAlternateNames(form: AcroForm): Map<string, string> {
    const names = new Map<string, string>();
    for (const field of form.fields) {
        const { alternateName, widgets } = fieldShared(field);
        if (!alternateName) continue;
        for (const widget of widgets) names.set(widget, alternateName);
    }
    return names;
}

/**
 * `field` toggled at its widget whose on state is `on`: a check box turns on,
 * or off where it is on; a radio button turns on — the others of its group off,
 * as they share its value — or off where it is on, unless its field never turns
 * all its buttons off. Null when nothing changes, or `field` isn't a button.
 */
export function toggled(field: AcroFormField, on: string): AcroFormFieldFill | null {
    if ("checkBox" in field) {
        const check = field.checkBox;
        return { id: check.shared.id, value: { checkBox: check.value === on ? "Off" : on } };
    }
    if ("radioButton" in field) {
        const radio = field.radioButton;
        if (radio.value === on && radio.noToggleToOff) return null;
        return { id: radio.shared.id, value: { radioButton: radio.value === on ? "Off" : on } };
    }
    return null;
}

/**
 * `field` with `text` typed in — a text field's value, an empty one none; a
 * combo box's one chosen item, the item of its list whose text or export value
 * `text` is, else text of its own. Null where `field` takes no text.
 */
export function withText(field: AcroFormField, text: string): AcroFormFieldFill | null {
    if ("text" in field) return { id: field.text.shared.id, value: { text } };
    if ("comboBox" in field) return { id: field.comboBox.shared.id, value: { comboBox: text === "" ? [] : [text] } };
    return null;
}

/**
 * `field` with the items at `indices` of its list chosen, by their export
 * values. Null where `field` isn't a choice field.
 */
export function withChoice(field: AcroFormField, indices: number[]): AcroFormFieldFill | null {
    const values = (options: AcroFormChoiceOption[]): string[] =>
        indices.flatMap((i) => {
            const option = options[i];
            return option ? [exportOf(option)] : [];
        });
    if ("comboBox" in field) {
        return { id: field.comboBox.shared.id, value: { comboBox: values(field.comboBox.options) } };
    }
    if ("listBox" in field) {
        return { id: field.listBox.shared.id, value: { listBox: values(field.listBox.options) } };
    }
    return null;
}

/** The value an item of a choice field's list stands for: its export value,
 *  else its text. */
export function exportOf(option: AcroFormChoiceOption): string {
    return option.export ?? option.text;
}
