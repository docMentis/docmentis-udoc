// The right panel's Data tab: what a deck's text binds, as the engine reads its
// bindings, and the template's sample data, written against it. Above, the
// deck's role, as its automation part gives it: a template, whose braces are
// read as tags, an instance filled from one, or a plain deck, whose braces are
// only text until it is made a template.
//
// For a template, the schema its bindings make, as a form of its sample data:
// each name the data must hold, nested as the data nests it, with a field for
// the value its bindings imply — text, a choice's text with its options' values
// offered, a bool as a checkbox, an array as its items, each added and removed.
// Last, the tags that are wrong, each as written with what is wrong with it. A
// plain deck shows a note in their place, and an instance nothing.
//
// A field's value is given to the template as the field is left, or Enter is
// pressed in it — one undo step — while edit mode is on; in view mode the form
// is read only. The form is drawn again whenever what it shows changes, the
// field being typed in kept focused.

import type {
    Automation,
    BindingCatalog,
    BindingData,
    BindingError,
    BindingSchema,
    PresentationBindingPlace,
} from "@docmentis/udoc-wasm";
import type { Store } from "../../framework/index.js";
import { subscribeSelector } from "../../framework/index.js";
import type { Action } from "../actions.js";
import { blankItem, sampleAt, withItem, withSample, withoutItem } from "../data-bindings.js";
import type { SamplePath } from "../data-bindings.js";
import { VIEW_MODE } from "../state.js";
import type { UIState } from "../state.js";
import type { I18n, MessageKey } from "../i18n/index.js";

export interface DataPanelCallbacks {
    /** Select the next of `places`, a row's, `key` naming the row. */
    onChoose: (key: string, places: readonly PresentationBindingPlace[]) => void;
    /** Give the template `data` as its sample data. */
    onSampleData: (data: BindingData) => void;
}

/** What the panel draws from. */
interface DataPanelSlice {
    bindings: BindingCatalog<PresentationBindingPlace> | null;
    automation: Automation | null;
    /** Whether the sample data can be edited: edit mode is on. */
    editable: boolean;
}

/** The properties of `schema` where it is an object, as a document's whole
 *  schema is, or none. */
function propertiesOf(schema: BindingSchema): Record<string, BindingSchema> {
    return typeof schema === "object" && "object" in schema ? schema.object.properties : {};
}

/** What each item of `schema` holds, where it is an array that says. */
function arrayItem(schema: BindingSchema): BindingSchema | undefined {
    return typeof schema === "object" && "array" in schema ? schema.array.item : undefined;
}

/** The message saying what `error` is. */
function errorMessage(error: BindingError): MessageKey {
    if (typeof error === "object") return "data.error.unexpected";
    switch (error) {
        case "unclosedTag":
            return "data.error.unclosedTag";
        case "unclosedQuote":
            return "data.error.unclosedQuote";
        case "empty":
            return "data.error.empty";
        case "unclosedPair":
            return "data.error.unclosedPair";
        case "unmatchedClose":
            return "data.error.unmatchedClose";
        case "misplacedOption":
            return "data.error.misplacedOption";
        case "splitPair":
            return "data.error.splitPair";
        case "conflictingType":
            return "data.error.conflictingType";
    }
}

/** The key a field's input goes by, so focus finds it again once drawn anew. */
function pathKey(path: SamplePath): string {
    return JSON.stringify(path);
}

export function createDataPanel(i18n: I18n, callbacks: DataPanelCallbacks) {
    const el = document.createElement("div");
    el.className = "udoc-data-panel";
    el.setAttribute("aria-label", i18n.t("rightPanel.data"));
    // The deck's role, once read: hidden until then.
    const role = document.createElement("div");
    role.className = "udoc-data-panel__role";
    role.hidden = true;
    const body = document.createElement("div");
    body.className = "udoc-data-panel__body";
    el.append(role, body);
    let unsubscribe: (() => void) | null = null;

    /** The deck's role, as `automation` gives it — nothing until the bindings
     *  are read, so the role and the form show together. */
    function renderRole({ bindings, automation }: DataPanelSlice): void {
        role.hidden = bindings === null;
        if (bindings === null) return;
        const kind = automation === null ? "plain" : "template" in automation.role ? "template" : "instance";
        role.dataset.role = kind;
        role.textContent = i18n.t(
            kind === "template" ? "data.template" : kind === "instance" ? "data.instance" : "data.plain",
        );
    }

    /** A note, in the form's place, saying `text`. */
    function note(text: string): HTMLElement {
        const empty = document.createElement("div");
        empty.className = "udoc-panel-placeholder";
        empty.textContent = text;
        return empty;
    }

    /** For a template, its schema as a form of its sample data and a section
     *  for the tags that are wrong, or the placeholder for none of either; for
     *  a plain deck, the note that its braces are only text; nothing for an
     *  instance, or until the bindings are read. */
    function render(slice: DataPanelSlice): void {
        const { bindings, automation } = slice;
        if (bindings === null || (automation !== null && !("template" in automation.role))) {
            body.replaceChildren();
            return;
        }
        if (automation === null) {
            body.replaceChildren(note(i18n.t("data.plainNote")));
            return;
        }
        const errors = bindings.places.filter((place) => place.error !== undefined);
        const properties = propertiesOf(bindings.schema);
        const named = Object.keys(properties).length > 0;
        if (!named && errors.length === 0) {
            body.replaceChildren(note(i18n.t("data.none")));
            return;
        }
        const parts: HTMLElement[] = [];
        if (named) {
            const form = document.createElement("div");
            form.className = "udoc-data-panel__form";
            form.setAttribute("role", "group");
            form.append(...propertyRows(properties, [], slice));
            parts.push(form);
        }
        if (errors.length > 0) {
            const heading = document.createElement("div");
            heading.className = "udoc-data-panel__heading";
            heading.textContent = i18n.t("data.errors");
            const list = document.createElement("div");
            list.className = "udoc-data-panel__errors";
            list.setAttribute("role", "list");
            list.append(...errors.map((place, index) => errorRow(place, index)));
            parts.push(heading, list);
        }
        body.replaceChildren(...parts);
    }

    /** A row for each of `properties`, at `path` in the data. */
    function propertyRows(
        properties: Record<string, BindingSchema>,
        path: SamplePath,
        slice: DataPanelSlice,
    ): HTMLElement[] {
        return Object.entries(properties).map(([name, schema]) => fieldRow(name, schema, [...path, name], slice));
    }

    /** A name, as the data holds it. */
    function nameLabel(name: string): HTMLElement {
        const label = document.createElement("span");
        label.className = "udoc-data-panel__name";
        label.textContent = name;
        return label;
    }

    /** The row of the field `name`, holding `node`, at `path` in the data. */
    function fieldRow(name: string, node: BindingSchema, path: SamplePath, slice: DataPanelSlice): HTMLElement {
        const row = document.createElement("div");
        row.className = "udoc-data-panel__field";
        const head = document.createElement("div");
        head.className = "udoc-data-panel__field-head";
        head.append(nameLabel(name));
        row.append(head);
        if (node !== "bool" && "object" in node) {
            const nested = document.createElement("div");
            nested.className = "udoc-data-panel__nested";
            nested.append(...propertyRows(node.object.properties, path, slice));
            row.append(nested);
        } else if (node !== "bool" && "array" in node) {
            head.append(addButton(node, path, slice));
            row.append(items(node, path, slice));
        } else {
            head.append(valueInput(name, node, path, slice));
        }
        return row;
    }

    /** The input of a text or a bool at `path`, showing the sample data's
     *  value there, which gives the template a new value as it is left. */
    function valueInput(name: string, node: BindingSchema, path: SamplePath, slice: DataPanelSlice): HTMLElement {
        const data = slice.automation?.sampleData;
        const input = document.createElement("input");
        input.className = "udoc-data-panel__input";
        input.dataset.path = pathKey(path);
        input.setAttribute("aria-label", name);
        input.disabled = !slice.editable;
        const value = sampleAt(data, path);
        if (node === "bool") {
            input.type = "checkbox";
            input.checked = value === true;
            input.addEventListener("change", () => callbacks.onSampleData(withSample(data, path, input.checked)));
            return input;
        }
        input.type = "text";
        input.value = typeof value === "string" || typeof value === "number" ? String(value) : "";
        if (typeof node === "object" && "text" in node && node.text.values.length > 0) {
            const options = document.createElement("datalist");
            options.id = `udoc-data-values-${pathKey(path).replace(/\W+/g, "-")}`;
            for (const value of node.text.values) {
                const option = document.createElement("option");
                option.value = value;
                options.append(option);
            }
            input.setAttribute("list", options.id);
            input.addEventListener("change", () => callbacks.onSampleData(withSample(data, path, input.value)));
            const wrap = document.createElement("span");
            wrap.className = "udoc-data-panel__value";
            wrap.append(input, options);
            return wrap;
        }
        input.addEventListener("change", () => callbacks.onSampleData(withSample(data, path, input.value)));
        return input;
    }

    /** The button adding an item to the array at `path`. */
    function addButton(node: BindingSchema, path: SamplePath, slice: DataPanelSlice): HTMLElement {
        const item = arrayItem(node);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "udoc-data-panel__add";
        button.textContent = i18n.t("data.add");
        button.disabled = !slice.editable;
        button.addEventListener("click", () =>
            callbacks.onSampleData(withItem(slice.automation?.sampleData, path, blankItem(item))),
        );
        return button;
    }

    /** The items of the array at `path` the sample data holds, each with its
     *  fields — or, for an array of plain values, its value — and a button
     *  taking it out. */
    function items(node: BindingSchema, path: SamplePath, slice: DataPanelSlice): HTMLElement {
        const item = arrayItem(node);
        const data = slice.automation?.sampleData;
        const held = sampleAt(data, path);
        const list = document.createElement("div");
        list.className = "udoc-data-panel__items";
        const count = Array.isArray(held) ? held.length : 0;
        for (let index = 0; index < count; index++) {
            const itemPath = [...path, index];
            const row = document.createElement("div");
            row.className = "udoc-data-panel__item";
            const head = document.createElement("div");
            head.className = "udoc-data-panel__field-head";
            const label = document.createElement("span");
            label.className = "udoc-data-panel__item-label";
            label.textContent = String(index + 1);
            head.append(label);
            if (item !== undefined && (item === "bool" || "text" in item)) {
                head.append(valueInput(String(index + 1), item, itemPath, slice));
            }
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "udoc-data-panel__remove";
            remove.textContent = i18n.t("data.remove");
            remove.disabled = !slice.editable;
            remove.addEventListener("click", () => callbacks.onSampleData(withoutItem(data, path, index)));
            head.append(remove);
            row.append(head);
            if (item !== undefined && item !== "bool" && "object" in item) {
                const nested = document.createElement("div");
                nested.className = "udoc-data-panel__nested";
                nested.append(...propertyRows(item.object.properties, itemPath, slice));
                row.append(nested);
            } else if (item !== undefined && item !== "bool" && "array" in item) {
                const nested = document.createElement("div");
                nested.className = "udoc-data-panel__nested";
                nested.append(fieldRow(String(index + 1), item, itemPath, slice));
                row.append(nested);
            }
            list.append(row);
        }
        return list;
    }

    /** A wrong tag's row: as written, and what is wrong with it. */
    function errorRow(place: PresentationBindingPlace, index: number): HTMLElement {
        const item = document.createElement("div");
        item.setAttribute("role", "listitem");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "udoc-data-panel__error";
        const text = document.createElement("span");
        text.className = "udoc-data-panel__text";
        text.textContent = place.text;
        const message = document.createElement("span");
        message.className = "udoc-data-panel__message";
        message.textContent = place.error ? i18n.t(errorMessage(place.error)) : "";
        button.append(text, message);
        button.addEventListener("click", () => callbacks.onChoose(`error:${index}:${place.text}`, [place]));
        item.append(button);
        return item;
    }

    /** Draw `slice`, the field being typed in focused again, where it is
     *  drawn anew, with its caret where it was. */
    function show(slice: DataPanelSlice): void {
        const focused = document.activeElement;
        const key = focused instanceof HTMLInputElement && el.contains(focused) ? focused.dataset.path : undefined;
        const caret: readonly [number | null, number | null] | null =
            focused instanceof HTMLInputElement && focused.type === "text"
                ? [focused.selectionStart, focused.selectionEnd]
                : null;
        renderRole(slice);
        render(slice);
        if (key === undefined) return;
        const again = [...body.querySelectorAll<HTMLInputElement>("input[data-path]")].find(
            (input) => input.dataset.path === key,
        );
        if (!again) return;
        again.focus();
        if (caret && again.type === "text") again.setSelectionRange(caret[0], caret[1]);
    }

    function mount(container: HTMLElement, store: Store<UIState, Action>): void {
        container.appendChild(el);
        const select = (s: UIState): DataPanelSlice => ({
            bindings: s.dataBindings,
            automation: s.automation,
            editable: s.mode !== VIEW_MODE,
        });
        show(select(store.getState()));
        unsubscribe = subscribeSelector(store, select, show, {
            equality: (a, b) => a.bindings === b.bindings && a.automation === b.automation && a.editable === b.editable,
        });
    }

    function destroy(): void {
        unsubscribe?.();
        unsubscribe = null;
        el.remove();
    }

    return { el, mount, destroy };
}

export type DataPanelComponent = ReturnType<typeof createDataPanel>;
