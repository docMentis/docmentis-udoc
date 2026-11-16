// A place's popover, opened from its tab over a template's slide: the place's
// binding as fields for its kind — a variable's path and default, a repeat's
// item, path and separators, a condition's path and whether it shows when
// false, a choice's path, an option's values — applied with Done or Enter, and
// Remove, which dissolves the place and keeps its content. Anchored below the
// tab, it closes on an outside press or Escape, as a menu does.
//
// Storeless and imperative: mounted once and reused, `open(ctx)` seeding it
// with the place's binding and what applying and removing do.
import { createMenuController, on } from "@docmentis/udoc-ui/internal";
import type { Binding } from "@docmentis/udoc-wasm";
import { placeLabel } from "../automation-places.js";
import type { I18n, MessageKey } from "../i18n/index.js";

/** What `open` needs: the binding, where the tab stands, and what Done and
 *  Remove do. */
export interface PlacePopoverContext {
    binding: Binding;
    /** The tab's rect, in client px, the popover opens below. */
    anchor: DOMRect;
    /** Bind the place by `binding` instead. */
    onApply: (binding: Binding) => Promise<void>;
    /** Dissolve the place, keeping its content. */
    onRemove: () => Promise<void>;
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
    const form = document.createElement("div");
    form.className = "udoc-place-popover__fields";
    const error = document.createElement("div");
    error.className = "udoc-page-modal__error";
    error.setAttribute("role", "alert");
    const footer = document.createElement("div");
    footer.className = "udoc-place-popover__footer";
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "udoc-page-modal__secondary";
    removeBtn.textContent = i18n.t("place.remove");
    const doneBtn = document.createElement("button");
    doneBtn.type = "button";
    doneBtn.className = "udoc-page-modal__apply";
    doneBtn.textContent = i18n.t("common.done");
    footer.append(removeBtn, doneBtn);
    panel.append(heading, form, error, footer);

    let ctx: PlacePopoverContext | null = null;
    let fields: Field[] = [];
    let busy = false;
    const unsubEvents: Array<() => void> = [];

    const controller = createMenuController(null, panel, {
        isInside: (target) => panel.contains(target),
        onClose: () => {
            ctx = null;
        },
    });

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
        error.textContent = "";
        // Below the tab, kept on screen.
        const width = 260;
        panel.style.left = `${Math.max(8, Math.min(context.anchor.left, window.innerWidth - width - 8))}px`;
        panel.style.top = `${context.anchor.bottom + 4}px`;
        controller.open();
        fields[0]?.input.focus();
        fields[0]?.input.select();
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
