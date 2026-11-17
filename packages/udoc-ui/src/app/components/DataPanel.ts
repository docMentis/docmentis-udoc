// The right panel's Data tab: what a deck's text binds, as the engine reads its
// bindings, and the data written against it — a template's sample data, or the
// data an instance was filled with. What acts on all of it is a row of icon
// buttons the right panel stands in its title bar, each named by its tooltip:
// for a template, Generate Sample Data, which makes up a value for each name
// the sample data lacks, Load JSON, which fills the form from a file, and
// Clear, which empties it; for an instance, Load JSON and Reset, which puts
// back the data it was last filled with.
//
// For a template or an instance, the schema its bindings make, as a form of its
// data: a
// tree of the names the data must hold, nested as the data nests it, each
// object and array a group that folds, and each object item of an array. Beside
// each name is the value its bindings imply: text, a choice's text picked from
// its options' values or written as another, a bool as a switch, an array as
// its items, added and taken out. A name's count of the places that bind it,
// chosen, selects the next of them and brings its slide into view, round to the
// first again after the last. A name inside an array's items stands for every
// item's: its places are all the places bound by its path, `funds[].name`,
// whichever item is shown. The tree is one grid of rows, the names in one
// column, as wide as the widest needs, and the values in the other, so they
// line up at every depth.
// Last, the tags that are wrong, each as written with what is wrong with it. A
// plain deck shows a note in their place.
//
// A value is given as its input is left, or Enter is pressed in it, while edit
// mode is on: to a template's sample data, one undo step; to an instance's
// data as the panel holds it, which its Refresh fills it with, nothing filled
// till then. In view mode, and while a stand-in shows in the deck's place, the
// form is read only. The form is drawn again whenever what it shows changes, or a group is
// folded or unfolded, the control in use kept focused.

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
import {
    blankItem,
    boundPath,
    filledDataOf,
    filledInSample,
    sampleAt,
    sampleDataOf,
    withItem,
    withSample,
    withoutItem,
} from "../data-bindings.js";
import type { SamplePath } from "../data-bindings.js";
import {
    ICON_ADD,
    ICON_CHEVRON_DOWN,
    ICON_CLEAR_DATA,
    ICON_DELETE,
    ICON_LOAD_JSON,
    ICON_RESET_DATA,
    ICON_SAMPLE_DATA,
} from "../icons.js";
import { VIEW_MODE } from "../state.js";
import type { UIState } from "../state.js";
import type { I18n, MessageKey } from "../i18n/index.js";
import { createButton } from "./controls.js";

export interface DataPanelCallbacks {
    /** Select the next of `places`, a row's, `key` naming the row. */
    onChoose: (key: string, places: readonly PresentationBindingPlace[]) => void;
    /** Point out `places`, a row's the pointer is over — none as it leaves. */
    onHover: (places: readonly PresentationBindingPlace[]) => void;
    /** Give the template `data` as its sample data. */
    onSampleData: (data: BindingData) => void;
}

/** What the panel draws from. */
interface DataPanelSlice {
    bindings: BindingCatalog<PresentationBindingPlace> | null;
    automation: Automation | null;
    /** An instance's data as the panel holds it, where it differs from what
     *  the instance was last filled with. */
    draft: BindingData | null;
    /** Whether the data can be edited: edit mode is on, and no stand-in shows
     *  in the deck's place. */
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

/** The key a value at `path` goes by, so focus finds its control again once
 *  drawn anew, and a group stays folded. */
function pathKey(path: SamplePath): string {
    return JSON.stringify(path);
}

/** A `div` of `className`. */
function div(className: string): HTMLDivElement {
    const node = document.createElement("div");
    node.className = className;
    return node;
}

/** The sample data's value at `path` as text, where it is text or a number. */
function textAt(data: BindingData | undefined, path: SamplePath): string | undefined {
    const value = sampleAt(data, path);
    return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

/** Whether `slice`'s deck is an instance, whose form holds its data. */
function isInstance(slice: DataPanelSlice): boolean {
    return slice.automation !== null && "instance" in slice.automation.role;
}

/** The data `slice`'s form holds: a template's sample data; an instance's as
 *  the panel holds it, or as it was last filled with. */
function formData(slice: DataPanelSlice): BindingData | undefined {
    return isInstance(slice) ? (slice.draft ?? filledDataOf(slice.automation)) : sampleDataOf(slice.automation);
}

/** Whether `a` and `b` hold the same data. */
function sameData(a: BindingData | undefined, b: BindingData | undefined): boolean {
    return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
}

/** Whether `value`, as JSON reads it, is an object: data the form can hold. */
function isData(value: unknown): value is BindingData {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createDataPanel(i18n: I18n, callbacks: DataPanelCallbacks) {
    const el = div("udoc-data-panel");
    el.setAttribute("aria-label", i18n.t("rightPanel.data"));
    // What acts on all the data, which the right panel stands in its title
    // bar; and above the form what a file Load JSON couldn't take says.
    const actions = div("udoc-data-panel__actions");
    const notice = div("udoc-data-panel__notice");
    notice.setAttribute("role", "alert");
    const body = div("udoc-data-panel__body");
    // Load JSON's file picker, which nothing shows.
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = ".json,application/json";
    picker.hidden = true;
    picker.addEventListener("change", () => {
        const file = picker.files?.[0];
        picker.value = "";
        if (file) void loadJson(file);
    });
    el.append(notice, body, picker);
    let unsubscribe: (() => void) | null = null;
    let storeRef: Store<UIState, Action> | null = null;
    /** What is drawn, drawn again as a group folds or unfolds. */
    let current: DataPanelSlice | null = null;
    /** The groups folded, by the keys of their paths. */
    const folded = new Set<string>();

    /** Give the form `data`: a template takes it as its sample data, one undo
     *  step; an instance's panel holds it till its Refresh fills it in. */
    function give(slice: DataPanelSlice, data: BindingData): void {
        if (!isInstance(slice)) {
            callbacks.onSampleData(data);
            return;
        }
        const same = sameData(data, filledDataOf(slice.automation));
        storeRef?.dispatch({ type: "SET_DATA_DRAFT", data: same ? null : data });
    }

    /** Fill the form from `file`, a JSON object's; what else it holds is said
     *  under the actions, and taken for nothing. */
    async function loadJson(file: File): Promise<void> {
        let data: unknown;
        try {
            data = JSON.parse(await file.text());
        } catch {
            data = undefined;
        }
        if (!isData(data)) {
            notice.textContent = i18n.t("data.notJson");
            return;
        }
        notice.textContent = "";
        if (current) give(current, data);
    }

    /** A button acting on all the data: its icon alone, named `label`, its
     *  tooltip the name and `hint`, keyed `focus`. */
    function action(
        icon: string,
        label: MessageKey,
        hint: MessageKey,
        focus: string,
        enabled: boolean,
        run: () => void,
    ): HTMLElement {
        const name = i18n.t(label);
        const button = createButton({ icon, label: name });
        button.title = `${name}\n${i18n.t(hint)}`;
        button.dataset.focus = focus;
        button.disabled = !enabled;
        button.addEventListener("click", run);
        return button;
    }

    /** What acts on all of `slice`'s data, `schema` its bindings': a
     *  template's Generate Sample Data, Load JSON and Clear, or an instance's
     *  Load JSON and Reset — each live in edit mode while it would change
     *  something. */
    function actionButtons(schema: BindingSchema, slice: DataPanelSlice): HTMLElement[] {
        const data = formData(slice);
        const load = action(ICON_LOAD_JSON, "data.loadJson", "data.loadJsonHint", "loadJson", slice.editable, () =>
            picker.click(),
        );
        if (isInstance(slice)) {
            const reset = () => storeRef?.dispatch({ type: "SET_DATA_DRAFT", data: null });
            return [
                load,
                action(
                    ICON_RESET_DATA,
                    "data.reset",
                    "data.resetHint",
                    "reset",
                    slice.editable && slice.draft !== null,
                    reset,
                ),
            ];
        }
        const filled = filledInSample(data, schema);
        return [
            action(
                ICON_SAMPLE_DATA,
                "data.sampleData",
                "data.sampleDataHint",
                "sampleData",
                slice.editable && !sameData(filled, data),
                () => give(slice, filled),
            ),
            load,
            action(
                ICON_CLEAR_DATA,
                "data.clear",
                "data.clearHint",
                "clear",
                slice.editable && Object.keys(data ?? {}).length > 0,
                () => give(slice, {}),
            ),
        ];
    }

    /** A note, in the form's place, saying `text`. */
    function note(text: string): HTMLElement {
        const empty = div("udoc-panel-placeholder");
        empty.textContent = text;
        return empty;
    }

    /** For a template or an instance, its schema as a form of its data and a
     *  section for the tags that are wrong, or the placeholder for none of
     *  either; for a plain deck, the note that its braces are only text;
     *  nothing until the bindings are read. */
    function render(slice: DataPanelSlice): void {
        const { bindings, automation } = slice;
        actions.replaceChildren();
        if (bindings === null) {
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
            actions.append(...actionButtons(bindings.schema, slice));
            const form = div("udoc-data-panel__form");
            form.setAttribute("role", "group");
            form.append(...entries(properties, [], 0, slice));
            parts.push(form);
        }
        if (errors.length > 0) {
            const section = div("udoc-data-panel__errors");
            const heading = div("udoc-data-panel__heading");
            const title = document.createElement("span");
            title.textContent = i18n.t("data.errors");
            const count = document.createElement("span");
            count.className = "udoc-data-panel__error-count";
            count.textContent = String(errors.length);
            heading.append(title, count);
            const list = div("udoc-data-panel__error-list");
            list.setAttribute("role", "list");
            list.append(...errors.map((place, index) => errorRow(place, index)));
            section.append(heading, list);
            parts.push(section);
        }
        body.replaceChildren(...parts);
    }

    /** The rows of each of `properties`, at `path` in the data and `depth`
     *  in the tree. */
    function entries(
        properties: Record<string, BindingSchema>,
        path: SamplePath,
        depth: number,
        slice: DataPanelSlice,
    ): HTMLElement[] {
        return Object.entries(properties).flatMap(([name, schema]) =>
            entry(name, schema, [...path, name], depth, slice),
        );
    }

    /** The rows of `name`, holding `node`, at `path`: a group's for an object
     *  or an array, else a row of its name and its value's control. */
    function entry(
        name: string,
        node: BindingSchema,
        path: SamplePath,
        depth: number,
        slice: DataPanelSlice,
    ): HTMLElement[] {
        if (node !== "bool" && "object" in node) {
            return group(path, depth, nameButton(name, path, slice), [], () =>
                entries(node.object.properties, path, depth + 1, slice),
            );
        }
        if (node !== "bool" && "array" in node) {
            return group(
                path,
                depth,
                nameButton(name, path, slice),
                [itemCount(path, slice), tools(addButton(node, path, slice))],
                () => items(node, path, depth + 1, slice),
            );
        }
        return [row(depth, spacer(), nameButton(name, path, slice), valueControl(name, node, path, slice))];
    }

    /** A row of the tree at `depth`: `lead`, a group's fold or the room for
     *  one, and `title`, a name or an item's number, in the names' column,
     *  and `value` in the values'. */
    function row(depth: number, lead: HTMLElement, title: HTMLElement, value: HTMLElement): HTMLElement {
        const line = div("udoc-data-panel__row");
        line.style.setProperty("--udoc-data-depth", String(depth));
        const label = div("udoc-data-panel__label");
        label.append(lead, title);
        line.append(label, value);
        return line;
    }

    /** The room a fold takes, before a name that has none. */
    function spacer(): HTMLElement {
        return div("udoc-data-panel__spacer");
    }

    /** `buttons`, together at the end of a row. */
    function tools(...buttons: HTMLElement[]): HTMLElement {
        const box = div("udoc-data-panel__tools");
        box.append(...buttons);
        return box;
    }

    /** A group's rows: its own at `depth` — its fold and `title`, and in the
     *  values' column `value`, an array's count of items and buttons — then,
     *  unless it is folded, what `content` gives under it. */
    function group(
        path: SamplePath,
        depth: number,
        title: HTMLElement,
        value: HTMLElement[],
        content: () => HTMLElement[],
    ): HTMLElement[] {
        const key = pathKey(path);
        const open = !folded.has(key);
        const cell = div("udoc-data-panel__value");
        cell.append(...value);
        const line = row(depth, foldButton(title.textContent ?? "", key, open), title, cell);
        return open ? [line, ...content()] : [line];
    }

    /** The button folding the group `name`, keyed `key`, or unfolding it. */
    function foldButton(name: string, key: string, open: boolean): HTMLElement {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "udoc-data-panel__fold";
        button.innerHTML = ICON_CHEVRON_DOWN;
        button.setAttribute("aria-label", name);
        button.setAttribute("aria-expanded", String(open));
        button.dataset.focus = `fold:${key}`;
        button.addEventListener("click", () => {
            if (open) folded.add(key);
            else folded.delete(key);
            if (current) show(current);
        });
        return button;
    }

    /** The name of the value at `path`, which chooses the places that bind
     *  it — plain text where none do, as for an object, which no binding binds
     *  itself. How many places there are follows it, where there are two or
     *  more: one, as most are, goes without saying. */
    function nameButton(name: string, path: SamplePath, slice: DataPanelSlice): HTMLElement {
        const bound = boundPath(path);
        const places = (slice.bindings?.places ?? []).filter((place) => place.path === bound);
        const text = document.createElement("span");
        text.className = "udoc-data-panel__name-text";
        text.textContent = name;
        if (places.length === 0) {
            const plain = document.createElement("span");
            plain.className = "udoc-data-panel__name";
            plain.title = bound;
            plain.append(text);
            return plain;
        }
        const button = document.createElement("button");
        button.type = "button";
        button.className = "udoc-data-panel__name udoc-data-panel__name--places";
        button.title = `${bound} · ${i18n.plural("data.places", places.length)}`;
        button.dataset.focus = `name:${bound}`;
        button.append(text);
        if (places.length > 1) {
            const count = document.createElement("span");
            count.className = "udoc-data-panel__count";
            count.textContent = String(places.length);
            button.append(count);
        }
        button.addEventListener("click", () => callbacks.onChoose(bound, places));
        button.addEventListener("pointerenter", () => callbacks.onHover(places));
        button.addEventListener("pointerleave", () => callbacks.onHover([]));
        return button;
    }

    /** The control of the text or bool at `path`, showing the sample data's
     *  value there, which gives the template a new value as it is left. */
    function valueControl(name: string, node: BindingSchema, path: SamplePath, slice: DataPanelSlice): HTMLElement {
        const value = div("udoc-data-panel__value");
        if (node === "bool") {
            const data = formData(slice);
            const input = document.createElement("input");
            input.type = "checkbox";
            input.className = "udoc-switch udoc-data-panel__switch";
            input.dataset.focus = pathKey(path);
            input.setAttribute("aria-label", name);
            input.disabled = !slice.editable;
            input.checked = sampleAt(data, path) === true;
            input.addEventListener("change", () => give(slice, withSample(data, path, input.checked)));
            value.append(input);
        } else if (typeof node === "object" && "text" in node && node.text.values.length > 0) {
            const controls = choiceControls(name, node.text.values, path, slice);
            if (controls.length > 1) value.classList.add("udoc-data-panel__value--stacked");
            value.append(...controls);
        } else {
            value.append(textInput(name, path, slice));
        }
        return value;
    }

    /** The text input of the value at `path`, empty where the sample data
     *  gives nothing — `placeholder` the hint it shows then, a choice's Other
     *  field's alone. */
    function textInput(name: string, path: SamplePath, slice: DataPanelSlice, placeholder = ""): HTMLInputElement {
        const data = formData(slice);
        const input = document.createElement("input");
        input.type = "text";
        input.className = "udoc-data-panel__input";
        input.dataset.focus = pathKey(path);
        input.setAttribute("aria-label", name);
        input.disabled = !slice.editable;
        input.value = textAt(data, path) ?? "";
        input.placeholder = placeholder;
        input.addEventListener("change", () => give(slice, withSample(data, path, input.value)));
        return input;
    }

    /** A choice's controls at `path`: a menu of `values`, the choice's own, and
     *  Other — the sample data's value where it is none of them, written in a
     *  text input under the menu, which a choice's otherwise takes. With no
     *  value the menu shows the first, as a preview fills it in. */
    function choiceControls(
        name: string,
        values: readonly string[],
        path: SamplePath,
        slice: DataPanelSlice,
    ): HTMLElement[] {
        const data = formData(slice);
        const held = textAt(data, path);
        const other = held !== undefined && !values.includes(held);
        const wrap = div("udoc-data-panel__select");
        const select = document.createElement("select");
        select.dataset.focus = `choice:${pathKey(path)}`;
        select.setAttribute("aria-label", name);
        select.disabled = !slice.editable;
        for (const text of [...values, i18n.t("data.other")]) {
            const option = document.createElement("option");
            option.textContent = text;
            select.append(option);
        }
        select.selectedIndex = other ? values.length : Math.max(0, values.indexOf(held ?? ""));
        select.addEventListener("change", () => {
            const picked = values[select.selectedIndex];
            give(slice, withSample(data, path, picked ?? ""));
        });
        const chevron = document.createElement("span");
        chevron.className = "udoc-data-panel__chevron";
        chevron.innerHTML = ICON_CHEVRON_DOWN;
        wrap.append(select, chevron);
        return other ? [wrap, textInput(name, path, slice, i18n.t("data.other"))] : [wrap];
    }

    /** How many items the array at `path` holds, after its name. */
    function itemCount(path: SamplePath, slice: DataPanelSlice): HTMLElement {
        const held = sampleAt(formData(slice), path);
        const meta = document.createElement("span");
        meta.className = "udoc-data-panel__meta";
        meta.textContent = i18n.plural("data.items", Array.isArray(held) ? held.length : 0);
        return meta;
    }

    /** An icon button, `icon`, named `name`, keyed `focus`. */
    function iconButton(icon: string, name: string, focus: string, enabled: boolean, action: () => void) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "udoc-data-panel__icon-button";
        button.innerHTML = icon;
        button.title = name;
        button.setAttribute("aria-label", name);
        button.dataset.focus = focus;
        button.disabled = !enabled;
        button.addEventListener("click", action);
        return button;
    }

    /** The button adding an item to the array at `path`, unfolding it. */
    function addButton(node: BindingSchema, path: SamplePath, slice: DataPanelSlice): HTMLElement {
        const key = pathKey(path);
        return iconButton(ICON_ADD, i18n.t("data.add"), `add:${key}`, slice.editable, () => {
            folded.delete(key);
            give(slice, withItem(formData(slice), path, blankItem(arrayItem(node))));
        });
    }

    /** The button taking the item at `index` out of the array at `path`. */
    function removeButton(path: SamplePath, index: number, slice: DataPanelSlice): HTMLElement {
        const focus = `remove:${pathKey([...path, index])}`;
        const button = iconButton(ICON_DELETE, i18n.t("data.remove"), focus, slice.editable, () =>
            give(slice, withoutItem(formData(slice), path, index)),
        );
        button.classList.add("udoc-data-panel__icon-button--remove");
        return button;
    }

    /** An item's number, as its row or its group heads it. */
    function indexLabel(index: number): HTMLElement {
        const number = document.createElement("span");
        number.className = "udoc-data-panel__index";
        number.textContent = String(index + 1);
        return number;
    }

    /** The rows of the items of the array at `path` the sample data holds,
     *  at `depth`: a plain value's each a row of its number, its value and a
     *  button taking it out; an object's or an array's each a group, headed
     *  by its number and that button, holding what the item holds. */
    function items(node: BindingSchema, path: SamplePath, depth: number, slice: DataPanelSlice): HTMLElement[] {
        const item = arrayItem(node);
        const held = sampleAt(formData(slice), path);
        const count = Array.isArray(held) ? held.length : 0;
        const out: HTMLElement[] = [];
        for (let index = 0; index < count; index++) {
            const itemPath = [...path, index];
            const remove = removeButton(path, index, slice);
            if (item !== undefined && item !== "bool" && "object" in item) {
                out.push(
                    ...group(itemPath, depth, indexLabel(index), [tools(remove)], () =>
                        entries(item.object.properties, itemPath, depth + 1, slice),
                    ),
                );
            } else if (item !== undefined && item !== "bool" && "array" in item) {
                out.push(
                    ...group(
                        itemPath,
                        depth,
                        indexLabel(index),
                        [itemCount(itemPath, slice), tools(addButton(item, itemPath, slice), remove)],
                        () => items(item, itemPath, depth + 1, slice),
                    ),
                );
            } else {
                const name = String(index + 1);
                const value =
                    item === undefined ? div("udoc-data-panel__value") : valueControl(name, item, itemPath, slice);
                value.append(remove);
                out.push(row(depth, spacer(), indexLabel(index), value));
            }
        }
        return out;
    }

    /** A wrong tag's row: as written, and what is wrong with it. */
    function errorRow(place: PresentationBindingPlace, index: number): HTMLElement {
        const item = document.createElement("div");
        item.setAttribute("role", "listitem");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "udoc-data-panel__error";
        button.dataset.focus = `error:${index}`;
        const text = document.createElement("span");
        text.className = "udoc-data-panel__tag";
        text.textContent = place.text;
        text.title = place.text;
        const message = document.createElement("span");
        message.className = "udoc-data-panel__message";
        message.textContent = place.error ? i18n.t(errorMessage(place.error)) : "";
        button.append(text, message);
        button.addEventListener("click", () => callbacks.onChoose(`error:${index}:${place.text}`, [place]));
        item.append(button);
        return item;
    }

    /** Draw `slice`, the control in use focused again, where it is drawn
     *  anew — a text input's caret where it was. */
    function show(slice: DataPanelSlice): void {
        const focused = document.activeElement;
        const ours = focused instanceof HTMLElement && (el.contains(focused) || actions.contains(focused));
        const key = ours ? focused.dataset.focus : undefined;
        const caret: readonly [number | null, number | null] | null =
            focused instanceof HTMLInputElement && focused.type === "text"
                ? [focused.selectionStart, focused.selectionEnd]
                : null;
        current = slice;
        render(slice);
        if (key === undefined) return;
        const again = [
            ...el.querySelectorAll<HTMLElement>("[data-focus]"),
            ...actions.querySelectorAll<HTMLElement>("[data-focus]"),
        ].find((control) => control.dataset.focus === key);
        if (!again) return;
        again.focus();
        if (caret && again instanceof HTMLInputElement && again.type === "text") {
            again.setSelectionRange(caret[0], caret[1]);
        }
    }

    function mount(container: HTMLElement, store: Store<UIState, Action>): void {
        storeRef = store;
        container.appendChild(el);
        const select = (s: UIState): DataPanelSlice => ({
            bindings: s.dataBindings,
            automation: s.automation,
            draft: s.dataDraft,
            editable: s.mode !== VIEW_MODE && !s.standIn,
        });
        show(select(store.getState()));
        unsubscribe = subscribeSelector(store, select, show, {
            equality: (a, b) =>
                a.bindings === b.bindings &&
                a.automation === b.automation &&
                a.draft === b.draft &&
                a.editable === b.editable,
        });
    }

    function destroy(): void {
        unsubscribe?.();
        unsubscribe = null;
        storeRef = null;
        actions.remove();
        el.remove();
    }

    return { el, actions, mount, destroy };
}

export type DataPanelComponent = ReturnType<typeof createDataPanel>;
