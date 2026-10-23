// A combobox — a typeable value field paired with a dropdown list: the Text
// tab's font and size fields.
import { alignMenuToBounds, createMenuController, ICON_CHEVRON_DOWN } from "@docmentis/udoc-ui/internal";
import type { MenuController, MenuControllerOptions } from "@docmentis/udoc-ui/internal";

/** A combobox's field content — a typeable value paired with a dropdown list. */
export interface ComboBoxContent {
    /** Accessible name + tooltip for the field and its list toggle. */
    label: string;
    /** Extra class names appended to the field wrapper (e.g. a width class). */
    className?: string;
    /** The input's `inputmode` hint — e.g. `"decimal"` for a numeric field. */
    inputMode?: "text" | "numeric" | "decimal";
}

export interface ComboBox {
    /** The positioned field wrapper — the input, caret, and menu live inside it. */
    readonly el: HTMLElement;
    /** The typeable value field — the combobox's keyboard entry point. */
    readonly input: HTMLInputElement;
    /** The caret that opens the list. A mouse affordance, not a tab stop; the
     *  input is the field's single keyboard focus. */
    readonly caret: HTMLButtonElement;
    /** The floating `.udoc-menu` listbox to fill with options. */
    readonly menu: HTMLElement;
    readonly controller: MenuController;
    destroy(): void;
}

/**
 * A combobox: a bordered field pairing a typeable {@link HTMLInputElement} with a
 * caret that opens a `.udoc-menu` listbox — the editable analogue of
 * {@link createDropdownButton}. The caller fills `menu` on open (as with a
 * dropdown) and wires the input's commit / mirror behavior; both picking a value
 * from the list and typing one that isn't in it are first-class. The outline is
 * the shared field signal (see `.udoc-btn--field`).
 *
 * The caret is the menu's trigger, so a click on the input (also inside the
 * wrapper) leaves an open list open — you can open the list and then type.
 */
export function createComboBox(
    content: ComboBoxContent,
    options: { menuLabel?: string } & MenuControllerOptions = {},
): ComboBox {
    const el = document.createElement("div");
    el.className = content.className ? `udoc-combobox ${content.className}` : "udoc-combobox";

    const input = document.createElement("input");
    input.className = "udoc-combobox__input";
    input.type = "text";
    input.title = content.label;
    input.setAttribute("aria-label", content.label);
    // No native autofill dropdown — it would fight our own listbox panel.
    input.setAttribute("autocomplete", "off");
    if (content.inputMode) input.inputMode = content.inputMode;

    const caret = document.createElement("button");
    caret.className = "udoc-combobox__caret";
    caret.innerHTML = ICON_CHEVRON_DOWN;
    // The input carries the field's keyboard focus; the caret is click-only so it
    // doesn't add a second tab stop for one control.
    caret.tabIndex = -1;
    caret.title = content.label;
    caret.setAttribute("aria-label", content.label);
    caret.setAttribute("aria-haspopup", "listbox");

    const menu = document.createElement("div");
    menu.className = "udoc-menu";
    menu.setAttribute("role", "listbox");
    if (options.menuLabel) menu.setAttribute("aria-label", options.menuLabel);

    el.append(input, caret, menu);
    // Compose the caller's onOpen (which fills the list) with the collision flip,
    // running the flip last so it measures the built panel at its real width —
    // mirrors createDropdownButton. `isInside` spans the whole wrapper so clicking
    // the input doesn't dismiss an open list.
    const userOnOpen = options.onOpen;
    const controller = createMenuController(caret, menu, {
        isInside: (t) => el.contains(t),
        ...options,
        onOpen: () => {
            userOnOpen?.();
            alignMenuToBounds(caret, menu);
        },
    });
    return { el, input, caret, menu, controller, destroy: () => controller.destroy() };
}
