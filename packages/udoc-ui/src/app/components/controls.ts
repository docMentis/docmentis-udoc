/**
 * The standard control factories — the shared button / dropdown / split-button
 * primitives. Every control builds from these so they share one set of
 * metrics (the `--udoc-btn-*` / `--udoc-menu-*` tokens) and one behavior (the
 * framework {@link createMenuController}) instead of each component hand-rolling
 * its own trigger, panel, and open/close logic.
 *
 * These own DOM construction + wiring only; callers own state (which item is
 * active, what a click dispatches) and mounting.
 */
import { createMenuController } from "../../framework/index.js";
import type { MenuController, MenuControllerOptions } from "../../framework/index.js";
import { ICON_CHEVRON_DOWN } from "../icons.js";
import type { I18n } from "../i18n/index.js";

/**
 * A key that runs a command: `key` with the platform's command modifier (⌘ on
 * a Mac, Ctrl elsewhere), and Shift when `shift`. `key` is what the key cap
 * reads ("Z", "8", "+").
 */
export interface Shortcut {
    key: string;
    shift?: boolean;
    /** The Mac's own key for it, where the platforms differ — Redo is ⇧⌘Z
     *  there and Ctrl+Y elsewhere. */
    mac?: { key: string; shift?: boolean };
}

/** Whether the keyboard is a Mac's — ⌘ rather than Ctrl, and its own glyphs. */
export const MAC = /Mac|iPhone|iPad|iPod/.test(navigator.platform);

/** The key this platform names for `shortcut`. */
function platformKey(shortcut: Shortcut): { key: string; shift?: boolean } {
    return (MAC && shortcut.mac) || shortcut;
}

/** A {@link Shortcut} as a button names it: the tooltip naming a label and
 *  the key, in the UI's language, and the `aria-keyshortcuts` value. */
export interface ShortcutName {
    /** `label`'s tooltip, which names the key after it — "Undo (⌘Z)". */
    title(label: string): string;
    aria: string;
}

/** `shortcut`'s {@link ShortcutName}. The tooltip writes the key as the
 *  platform does — "⇧⌘8" on a Mac, "Ctrl+Shift+8" elsewhere, in `i18n`'s words
 *  there ("Strg+Umschalt+8"); `aria-keyshortcuts` writes "Meta+Shift+8", with
 *  `+` spelt "Plus" since it is the separator. */
export function nameShortcut(shortcut: Shortcut, i18n: I18n): ShortcutName {
    const { key, shift } = platformKey(shortcut);
    const keys = MAC
        ? `${shift ? "⇧" : ""}⌘${key}`
        : i18n.t(shift ? "shortcut.controlShift" : "shortcut.control", { key });
    const aria = `${MAC ? "Meta" : "Control"}+${shift ? "Shift+" : ""}${key === "+" ? "Plus" : key}`;
    return { title: (label) => i18n.t("shortcut.tooltip", { label, shortcut: keys }), aria };
}

/** Name `button` `label`: its accessible name, and its tooltip — which, with a
 *  `shortcut`, also says the key that runs it ("Undo (⌘Z)"). */
export function nameButton(button: HTMLElement, label: string, shortcut?: ShortcutName): void {
    button.title = shortcut ? shortcut.title(label) : label;
    button.setAttribute("aria-label", label);
    if (shortcut) button.setAttribute("aria-keyshortcuts", shortcut.aria);
    else button.removeAttribute("aria-keyshortcuts");
}

/** A trigger's visible content: an icon glyph, a text label, or both. */
export interface TriggerContent {
    /** SVG markup for a leading glyph. */
    icon?: string;
    /** Visible text label (makes the button the labeled variant). */
    text?: string;
    /** Append the standard caret. Defaults to `true` for dropdown triggers. */
    caret?: boolean;
    /** Accessible name + tooltip. */
    label: string;
    /** The key that runs it, which the tooltip names after the label. */
    shortcut?: ShortcutName;
    /** Extra class names appended to the button. */
    className?: string;
    /**
     * Render as a bordered field (e.g. the mode switch). Set this only when the
     * trigger *displays a value* — the border is what tells that apart from a
     * plain command button, so a command must never take it, and related
     * commands are clustered with spacing instead. A *typeable* value uses
     * {@link createComboBox} instead of this flag.
     */
    field?: boolean;
}

/** Build a button element from {@link TriggerContent}. */
export function createButton(content: TriggerContent): HTMLButtonElement {
    const btn = document.createElement("button");
    const labeled = content.text !== undefined;
    const classes = ["udoc-btn", labeled ? "udoc-btn--labeled" : "udoc-btn--icon"];
    if (content.field) classes.push("udoc-btn--field");
    // A caret owns the right edge with its own 2px, so the button drops its 6px
    // there — the chevron sits 2px from the edge, matching a split button's caret.
    if (content.caret) classes.push("udoc-btn--has-caret");
    if (content.className) classes.push(content.className);
    btn.className = classes.join(" ");
    nameButton(btn, content.label, content.shortcut);

    let html = "";
    if (content.icon) html += labeled ? `<span class="udoc-btn__icon">${content.icon}</span>` : content.icon;
    if (labeled) html += `<span class="udoc-btn__label">${content.text}</span>`;
    if (content.caret) html += `<span class="udoc-btn__caret">${ICON_CHEVRON_DOWN}</span>`;
    btn.innerHTML = html;
    return btn;
}

/**
 * Flip a `.udoc-menu` panel's horizontal anchor so it stays inside the root.
 * The panel opens left-anchored (`left: 0`) by default; when that would push its
 * right edge past the root's bounds — e.g. a trigger in the toolbar's right
 * cluster — switch to right-anchored (`.udoc-menu--end`). Run on open, after the
 * panel is `display: block` and its items are built, so the width is real.
 */
export function alignMenuToBounds(trigger: HTMLElement, panel: HTMLElement): void {
    panel.classList.remove("udoc-menu--end");
    const root = trigger.closest(".udoc-ui-root");
    if (!root) return;
    const MARGIN = 8;
    const overflowsRight = panel.getBoundingClientRect().right > root.getBoundingClientRect().right - MARGIN;
    if (overflowsRight) panel.classList.add("udoc-menu--end");
}

/** Build a standard menu item: `[icon] label`, the label alone for no icon. */
export function createMenuItem(opts: { icon?: string | undefined; text: string; role?: string }): HTMLButtonElement {
    const item = document.createElement("button");
    item.className = "udoc-menu__item";
    if (opts.role) item.setAttribute("role", opts.role);
    const icon = opts.icon ? `<span class="udoc-menu__item-icon">${opts.icon}</span>` : "";
    item.innerHTML = `${icon}<span class="udoc-menu__item-label">${opts.text}</span>`;
    return item;
}

export interface DropdownButton {
    /** The positioned wrapper — the trigger and menu live inside it. */
    readonly el: HTMLElement;
    readonly trigger: HTMLButtonElement;
    /** The floating `.udoc-menu` panel to fill with items. */
    readonly menu: HTMLElement;
    readonly controller: MenuController;
    destroy(): void;
}

/**
 * A dropdown button: a trigger that toggles a `.udoc-menu` panel, wired to the
 * shared controller (toggle / outside-click / Escape / `aria-expanded`). The
 * caller fills `menu` with {@link createMenuItem}s and closes on selection.
 */
export function createDropdownButton(
    content: TriggerContent,
    options: { menuLabel?: string; menuRole?: string; wrapperClass?: string } & MenuControllerOptions = {},
): DropdownButton {
    const el = document.createElement("div");
    el.className = options.wrapperClass ? `udoc-dropdown ${options.wrapperClass}` : "udoc-dropdown";

    const trigger = createButton({ caret: true, ...content });
    trigger.setAttribute("aria-haspopup", options.menuRole === "listbox" ? "listbox" : "menu");

    const menu = document.createElement("div");
    menu.className = "udoc-menu";
    menu.setAttribute("role", options.menuRole ?? "menu");
    if (options.menuLabel) menu.setAttribute("aria-label", options.menuLabel);

    el.append(trigger, menu);
    // Compose the caller's onOpen (which fills the menu) with the collision flip,
    // running the flip last so it measures the built panel at its real width.
    const userOnOpen = options.onOpen;
    const controller = createMenuController(trigger, menu, {
        ...options,
        onOpen: () => {
            userOnOpen?.();
            alignMenuToBounds(trigger, menu);
        },
    });
    return { el, trigger, menu, controller, destroy: () => controller.destroy() };
}

export interface SplitButton {
    readonly el: HTMLElement;
    /** The primary-action button (left). */
    readonly main: HTMLButtonElement;
    /** The caret button that opens the menu (right). */
    readonly caret: HTMLButtonElement;
    /** The floating `.udoc-menu` panel to fill with items. */
    readonly menu: HTMLElement;
    readonly controller: MenuController;
    /** Toggle the group's shared active tint. */
    setActive(active: boolean): void;
    destroy(): void;
}

/**
 * A split button: `[ main | caret ]` sharing one active tint, with the caret
 * opening a `.udoc-menu`. The main button carries the primary action; the caret
 * opens the menu of alternatives. Behavior comes from the shared controller.
 */
export function createSplitButton(opts: {
    mainLabel: string;
    mainIcon?: string;
    caretLabel: string;
    menuLabel?: string;
    menuRole?: string;
    /** Runs before the menu is aligned on each open — the caller fills the panel
     *  here so it reflects current state (recent picks, active swatch). */
    onOpen?: () => void;
}): SplitButton {
    const el = document.createElement("div");
    el.className = "udoc-split";

    const mainContent: TriggerContent = { label: opts.mainLabel, className: "udoc-split__main" };
    if (opts.mainIcon) mainContent.icon = opts.mainIcon;
    const main = createButton(mainContent);

    const caret = createButton({ icon: ICON_CHEVRON_DOWN, label: opts.caretLabel, className: "udoc-split__caret" });
    caret.setAttribute("aria-haspopup", "true");

    const menu = document.createElement("div");
    menu.className = "udoc-menu";
    menu.setAttribute("role", opts.menuRole ?? "menu");
    if (opts.menuLabel) menu.setAttribute("aria-label", opts.menuLabel);

    el.append(main, caret, menu);
    // Fill the panel first (so its width is real), then flip its anchor if it
    // would overflow the root — mirrors createDropdownButton's composition.
    const controller = createMenuController(caret, menu, {
        isInside: (t) => el.contains(t),
        onOpen: () => {
            opts.onOpen?.();
            alignMenuToBounds(caret, menu);
        },
    });

    return {
        el,
        main,
        caret,
        menu,
        controller,
        setActive: (active) => el.classList.toggle("udoc-split--selected", active),
        destroy: () => controller.destroy(),
    };
}
