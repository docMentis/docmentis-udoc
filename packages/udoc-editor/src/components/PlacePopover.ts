// A place's popover, opened from its binding bar over a
// template's slide: the place's binding as fields for its kind — a variable's
// path and default, a repeat's item, path and separators, a condition's path
// and whether it shows when false, a choice's path, an option's values —
// applied with Done or Enter, and left as it was by Escape or a press outside,
// which close it as they close a menu. Remove, the bin beside its title, apart
// from Done, dissolves the place and keeps its content. A choice's and an
// option's list the choice's options, and picking one shows it on the slide at
// once, the others taking no room — the view's pick, not an edit. Each option
// is taken out by the bin on its row, but a choice's last, and Add option and
// Add otherwise under the list add one, shown at once: edits, each one undo
// step, made as they are pressed. It opens below the bar, or above it where
// the window has no room below.
//
// Storeless and imperative: mounted once and reused, `open(ctx)` seeding it
// with the place's binding and what applying and removing do.
import { ICON_ADD, ICON_DELETE, createMenuController, on } from "@docmentis/udoc-ui/internal";
import type { Binding, BindingChoice } from "@docmentis/udoc-wasm";
import { placeLabel } from "../automation-places.js";
import type { I18n, MessageKey } from "../i18n/index.js";
import { ICON_REMOVE_PLACE } from "../icons.js";

/** What `open` needs: the binding, where its binding bar stands,
 *  and what Done and Remove do. */
export interface PlacePopoverContext {
    binding: Binding;
    /** The bar's rect, in client px, the popover opens below. */
    anchor: DOMRect;
    /** Bind the place by `binding` instead. */
    onApply: (binding: Binding) => Promise<void>;
    /** Dissolve the place, keeping its content. */
    onRemove: () => Promise<void>;
    /** The choice the place is, or is an option of, with its options and the
     *  one shown; null for any other place. */
    choice: BindingChoice | null;
    /** Show the choice's `option`, resolving with the choice as it then is. */
    onShow: (option: string) => Promise<BindingChoice | null>;
    /** Add an option bound by `binding` to the choice, resolving with the
     *  choice as it then is. */
    onAddOption: (binding: Binding) => Promise<BindingChoice | null>;
    /** Take the choice's `option` out, resolving with the choice as it then
     *  is — null where the place the popover is for went with it. */
    onRemoveOption: (option: string) => Promise<BindingChoice | null>;
}

/** The words no name takes: a tag's keywords. */
const KEYWORDS = new Set(["if", "not", "choose", "when", "otherwise", "in", "join", "last", "or"]);

/** Whether `text` is a name an item takes: letters, digits and `_`, no keyword. */
function isName(text: string): boolean {
    return /^[\p{L}\p{N}_]+$/u.test(text) && !KEYWORDS.has(text);
}

/** Whether `text` is a path: names joined by `.`, its first no keyword. */
function isPath(text: string): boolean {
    const names = text.split(".");
    return names.every((name) => /^[\p{L}\p{N}_]+$/u.test(name)) && !KEYWORDS.has(names[0]!);
}

/** Whether `text` can stand in a tag's quotes, which have no escape. */
function isLiteral(text: string): boolean {
    return !/["“”]/.test(text);
}

/** What an option's row in the list reads: its values, quoted, or Otherwise. */
function optionLabel(binding: Binding, i18n: I18n): string {
    if (typeof binding === "object" && "when" in binding) {
        return binding.when.values.map((value) => `"${value}"`).join(", ");
    }
    return i18n.t("place.otherwise");
}

/** The values `choice`'s `when`s match. */
function valuesOf(choice: BindingChoice): Set<string> {
    return new Set(
        choice.options.flatMap(({ binding }) =>
            typeof binding === "object" && "when" in binding ? binding.when.values : [],
        ),
    );
}

/** A value for a new option to match, made up for its author to change: the
 *  first letter no option of `choice` matches yet, else a number. */
function newValue(choice: BindingChoice): string {
    const taken = valuesOf(choice);
    const letter = [..."abcdefghijklmnopqrstuvwxyz"].find((value) => !taken.has(value));
    if (letter) return letter;
    let n = choice.options.length + 1;
    while (taken.has(String(n))) n += 1;
    return String(n);
}

/** One field of the form: its label, its input, and whether it is a box. */
interface Field {
    readonly key: string;
    readonly label: MessageKey;
    readonly input: HTMLInputElement;
}

/** Build the place popover, mounted once and re-seeded by `open`. */
export function createPlacePopover(i18n: I18n) {
    const panel = document.createElement("div");
    panel.className = "udoc-place-popover";
    panel.setAttribute("role", "dialog");

    const heading = document.createElement("div");
    heading.className = "udoc-place-popover__heading";
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "udoc-place-popover__remove";
    removeBtn.innerHTML = ICON_REMOVE_PLACE;
    removeBtn.title = i18n.t("place.remove");
    removeBtn.setAttribute("aria-label", i18n.t("place.remove"));
    const header = document.createElement("div");
    header.className = "udoc-place-popover__header";
    header.append(heading, removeBtn);
    const form = document.createElement("div");
    form.className = "udoc-place-popover__fields";
    const options = document.createElement("fieldset");
    options.className = "udoc-place-popover__options";
    const legend = document.createElement("legend");
    legend.className = "udoc-page-modal__field-label";
    legend.textContent = i18n.t("place.shown");
    const adding = document.createElement("div");
    adding.className = "udoc-place-popover__adding";
    const addOption = addButton(i18n.t("place.addOption"));
    const addOtherwise = addButton(i18n.t("place.addOtherwise"));
    adding.append(addOption, addOtherwise);
    const error = document.createElement("div");
    error.className = "udoc-page-modal__error";
    error.setAttribute("role", "alert");
    const footer = document.createElement("div");
    footer.className = "udoc-place-popover__footer";
    const doneBtn = document.createElement("button");
    doneBtn.type = "button";
    doneBtn.className = "udoc-page-modal__apply";
    doneBtn.textContent = i18n.t("common.done");
    footer.append(doneBtn);
    panel.append(header, form, options, error, footer);

    let ctx: PlacePopoverContext | null = null;
    /** The choice the list shows, as it last stood. */
    let listed: BindingChoice | null = null;
    let fields: Field[] = [];
    let busy = false;
    const unsubEvents: Array<() => void> = [];

    const controller = createMenuController(null, panel, {
        isInside: (target) => panel.contains(target),
        onClose: () => {
            ctx = null;
        },
    });

    /** A button under the option list, its icon beside its name. */
    function addButton(name: string): HTMLButtonElement {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "udoc-place-popover__add";
        button.innerHTML = ICON_ADD;
        const text = document.createElement("span");
        text.textContent = name;
        button.append(text);
        return button;
    }

    function field(key: string, label: MessageKey, value: string, type: "text" | "checkbox" = "text"): Field {
        const input = document.createElement("input");
        input.type = type;
        if (type === "checkbox") input.checked = value === "true";
        else {
            input.value = value;
            input.className = "udoc-page-modal__input";
            input.spellcheck = false;
        }
        return { key, label, input };
    }

    /** The fields `binding`'s kind has, filled from it. */
    function fieldsOf(binding: Binding): Field[] {
        if (binding === "otherwise") return [];
        if ("variable" in binding) {
            const { path, default: fallback } = binding.variable;
            return [field("path", "place.path", path), field("default", "place.default", fallback ?? "")];
        }
        if ("repeat" in binding) {
            const { item, path, join, last } = binding.repeat;
            return [
                field("item", "place.item", item),
                field("path", "place.path", path),
                field("join", "place.join", join ?? ""),
                field("last", "place.last", last ?? ""),
            ];
        }
        if ("condition" in binding) {
            const { not, path } = binding.condition;
            return [field("path", "place.path", path), field("not", "place.not", String(not), "checkbox")];
        }
        if ("choice" in binding) return [field("path", "place.path", binding.choice.path)];
        return [field("values", "place.values", binding.when.values.join(", "))];
    }

    /** The binding the fields say, of `kind`'s kind; null where one is wrong. */
    function read(kind: Binding): Binding | null {
        const value = (key: string) => fields.find((f) => f.key === key)?.input.value.trim() ?? "";
        const optional = (key: string) => {
            const text = fields.find((f) => f.key === key)?.input.value ?? "";
            return text === "" ? undefined : text;
        };
        const literal = (text: string | undefined) => text === undefined || isLiteral(text);
        if (kind === "otherwise") return kind;
        if ("variable" in kind) {
            const path = value("path");
            const fallback = optional("default");
            if (!isPath(path) || !literal(fallback)) return null;
            return { variable: fallback === undefined ? { path } : { path, default: fallback } };
        }
        if ("repeat" in kind) {
            const [item, path, join, last] = [value("item"), value("path"), optional("join"), optional("last")];
            if (!isName(item) || !isPath(path) || !literal(join) || !literal(last)) return null;
            return {
                repeat: {
                    item,
                    path,
                    ...(join === undefined ? {} : { join }),
                    ...(last === undefined ? {} : { last }),
                },
            };
        }
        if ("condition" in kind) {
            const path = value("path");
            const not = fields.find((f) => f.key === "not")?.input.checked ?? false;
            return isPath(path) ? { condition: { not, path } } : null;
        }
        if ("choice" in kind) {
            const path = value("path");
            return isPath(path) ? { choice: { path } } : null;
        }
        const values = value("values")
            .split(",")
            .map((text) => text.trim())
            .filter((text) => text !== "");
        return values.length > 0 && values.every(isLiteral) ? { when: { values } } : null;
    }

    /** List `choice`'s options, the one shown picked, each with its bin — but
     *  a choice's last — and under them what adds one: Add otherwise only
     *  where the choice has none. None where it is null. */
    function listOptions(choice: BindingChoice | null): void {
        listed = choice;
        options.hidden = choice === null;
        if (choice === null) {
            options.replaceChildren();
            return;
        }
        const last = choice.options.length < 2;
        options.replaceChildren(
            legend,
            ...choice.options.map((option) => {
                const row = document.createElement("div");
                row.className = "udoc-place-popover__option-row";
                const label = document.createElement("label");
                label.className = "udoc-place-popover__option";
                const input = document.createElement("input");
                input.type = "radio";
                input.name = "udoc-place-shown";
                input.checked = option.id === choice.shown;
                input.addEventListener("change", () => {
                    if (input.checked) void show(option.id);
                });
                const text = document.createElement("span");
                text.textContent = optionLabel(option.binding, i18n);
                label.append(input, text);
                const remove = document.createElement("button");
                remove.type = "button";
                remove.className = "udoc-place-popover__remove-option";
                remove.innerHTML = ICON_DELETE;
                remove.title = i18n.t("place.removeOption");
                remove.setAttribute("aria-label", `${i18n.t("place.removeOption")}: ${text.textContent}`);
                remove.disabled = last;
                remove.addEventListener("click", () => void removeOption(option.id));
                row.append(label, remove);
                return row;
            }),
            adding,
        );
        addOtherwise.hidden = choice.options.some(({ binding }) => binding === "otherwise");
    }

    /** Run `work`, which changes the choice, and list it as it then is; the
     *  popover closes where the choice is gone from under it. */
    async function change(work: (open: PlacePopoverContext) => Promise<BindingChoice | null>): Promise<void> {
        const open = ctx;
        if (!open || busy) return;
        busy = true;
        try {
            const choice = await work(open);
            if (ctx !== open) return;
            if (choice === null && listed !== null) controller.close();
            else listOptions(choice);
        } finally {
            busy = false;
        }
    }

    function show(option: string): Promise<void> {
        return change((open) => open.onShow(option));
    }

    /** Add an option bound by `binding`, and show it. */
    function add(binding: Binding): Promise<void> {
        return change(async (open) => {
            const before = new Set(listed?.options.map((option) => option.id));
            const choice = await open.onAddOption(binding);
            const added = choice?.options.find((option) => !before.has(option.id));
            return added ? open.onShow(added.id) : choice;
        });
    }

    function removeOption(option: string): Promise<void> {
        return change((open) => open.onRemoveOption(option));
    }

    on(addOption, "click", () => {
        if (listed) void add({ when: { values: [newValue(listed)] } });
    });
    on(addOtherwise, "click", () => void add("otherwise"));

    async function run(work: () => Promise<void>): Promise<void> {
        if (busy) return;
        busy = true;
        try {
            await work();
            controller.close();
        } finally {
            busy = false;
        }
    }

    function apply(): void {
        const open = ctx;
        if (!open) return;
        const binding = read(open.binding);
        if (binding === null) {
            error.textContent = i18n.t("place.invalid");
            return;
        }
        error.textContent = "";
        if (JSON.stringify(binding) === JSON.stringify(open.binding)) {
            controller.close();
            return;
        }
        void run(() => open.onApply(binding));
    }

    on(doneBtn, "click", apply);
    on(removeBtn, "click", () => {
        const open = ctx;
        if (open) void run(() => open.onRemove());
    });
    on(form, "keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            apply();
        }
    });

    function open(context: PlacePopoverContext): void {
        ctx = context;
        heading.textContent = placeLabel(context.binding, i18n);
        panel.setAttribute("aria-label", heading.textContent);
        fields = fieldsOf(context.binding);
        form.replaceChildren(
            ...fields.map((f) => {
                const label = document.createElement("label");
                label.className = f.input.type === "checkbox" ? "udoc-place-popover__check" : "udoc-page-modal__field";
                const text = document.createElement("span");
                text.className = "udoc-page-modal__field-label";
                text.textContent = i18n.t(f.label);
                if (f.input.type === "checkbox") label.append(f.input, text);
                else label.append(text, f.input);
                return label;
            }),
        );
        listOptions(context.choice);
        error.textContent = "";
        // Below the bar, kept on screen: above it where the window has no room
        // below and has above, else as low as it can.
        const width = 260;
        panel.style.left = `${Math.max(8, Math.min(context.anchor.left, window.innerWidth - width - 8))}px`;
        panel.style.top = `${context.anchor.bottom + 4}px`;
        controller.open();
        const height = panel.offsetHeight;
        const room = window.innerHeight - 8;
        if (context.anchor.bottom + 4 + height > room) {
            const above = context.anchor.top - 4 - height;
            panel.style.top = `${above >= 8 ? above : Math.max(8, room - height)}px`;
        }
        if (fields[0]) {
            fields[0].input.focus();
            fields[0].input.select();
        } else {
            // An otherwise has no field: its list takes the focus.
            options.querySelector<HTMLInputElement>("input:checked")?.focus();
        }
    }

    function mount(parent: HTMLElement): void {
        parent.appendChild(panel);
    }

    function destroy(): void {
        for (const off of unsubEvents) off();
        controller.destroy();
        panel.remove();
    }

    return { mount, open, close: () => controller.close(), destroy };
}

export type PlacePopover = ReturnType<typeof createPlacePopover>;
