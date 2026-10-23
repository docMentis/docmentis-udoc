/**
 * The {@link MenuItem} renderer — the shared row-building behind every menu of
 * commands: the ribbon's Arrange dropdown (with its Order / Align / Rotate
 * fly-outs) and the canvas context menu.
 *
 * It sits beside {@link createMenuController} in spirit: the controller owns a
 * panel's open/close, this owns a panel's *contents*. Both menus render the same
 * three row kinds from the same declarative item trees in `commands.ts`, so a
 * command's icon, label, divider, enablement, and checked state are written once
 * and read identically wherever the command is offered.
 *
 * DOM construction + wiring only — the caller owns the panel, its placement, and
 * what an activated row does (see {@link MenuHost}).
 */
import type { CommandContext, MenuAction, MenuItem } from "../commands.js";
import type { Message } from "../i18n/index.js";
import type { I18n } from "../i18n/index.js";
import { ICON_CHEVRON_RIGHT } from "../icons.js";

/** What a built menu needs from its owner. */
export interface MenuHost {
    /** The language the rows' labels are drawn in. */
    readonly i18n: I18n;
    /**
     * The enablement context each row reads. A function, not a value: a rebuild
     * (the Align reference toggle rebuilds its panel in place) must see the
     * state its own action just produced.
     */
    context(): CommandContext;
    /** Run an activated row's intent. */
    action(action: MenuAction): void;
    /** Dismiss the whole menu — called after a plain action row fires. */
    close(): void;
}

/**
 * Build `items` into `panel`, replacing its contents. Call on each open so
 * per-item enablement, the Align toggle's checked state, and submenu contents
 * reflect the current selection.
 *
 * Handles three row kinds: a submenu row (a fly-out of nested items — Arrange ▸
 * Order / Align / Rotate), a checkable toggle row, and a plain action row.
 */
export function buildMenuInto(panel: HTMLElement, items: readonly MenuItem<string>[], host: MenuHost): void {
    panel.innerHTML = "";
    const ctx = host.context();
    // The fly-out currently open in this panel, if any — opening another, or
    // hovering a plain row, collapses it, so only one shows at a time.
    let openSub: { panel: HTMLElement; row: HTMLButtonElement } | null = null;
    const closeSub = (): void => {
        if (!openSub) return;
        openSub.panel.classList.remove("udoc-submenu--open", "udoc-submenu--left");
        openSub.row.setAttribute("aria-expanded", "false");
        openSub = null;
    };
    // The icon column is the menu's, not the row's: kept on every row where any
    // row has a glyph, so a row without one lines its label up with the rest,
    // and left out where none has — a list of values — so the labels sit flush.
    const iconColumn = items.some((item) => item.icon !== undefined);
    const icon = (item: MenuItem<string>): string =>
        iconColumn ? `<span class="udoc-toolbar__menu-icon">${item.icon ?? ""}</span>` : "";

    // A row's label — a message of the shell's, whose words speak an
    // extension's keys too.
    const label = (item: MenuItem<string>): string => host.i18n.t(item.label as Message);

    for (const item of items) {
        const enabled = item.enabledWhen(ctx);

        // --- Submenu row: a labeled parent that opens a nested fly-out. ---
        if (item.submenu) {
            const wrap = document.createElement("div");
            wrap.className = "udoc-toolbar__submenu-wrap";
            const row = document.createElement("button");
            row.className = "udoc-toolbar__menu-item udoc-toolbar__menu-item--parent";
            row.setAttribute("role", "menuitem");
            row.setAttribute("aria-haspopup", "menu");
            row.setAttribute("aria-expanded", "false");
            row.disabled = !enabled;
            if (item.separatorBefore) row.classList.add("udoc-toolbar__menu-item--divider");
            row.innerHTML = `${icon(item)}<span class="udoc-toolbar__menu-label">${label(item)}</span><span class="udoc-toolbar__menu-caret">${ICON_CHEVRON_RIGHT}</span>`;

            const sub = document.createElement("div");
            sub.className = "udoc-menu udoc-submenu";
            sub.setAttribute("role", "menu");
            buildMenuInto(sub, item.submenu, host);

            const open = (): void => {
                if (!enabled) return;
                closeSub();
                sub.classList.add("udoc-submenu--open");
                row.setAttribute("aria-expanded", "true");
                openSub = { panel: sub, row };
                // Flip the fly-out left if opening right would overflow the
                // root's bounds (mirrors alignMenuToBounds for the top panel).
                const root = sub.closest(".udoc-ui-root");
                if (root && sub.getBoundingClientRect().right > root.getBoundingClientRect().right - 8) {
                    sub.classList.add("udoc-submenu--left");
                }
            };
            // Hover opens; moving onto the fly-out stays inside the wrap (the
            // panel is its DOM child) so it doesn't close prematurely. Click
            // toggles for touch / keyboard.
            wrap.addEventListener("mouseenter", open);
            wrap.addEventListener("mouseleave", closeSub);
            row.addEventListener("click", (e) => {
                e.stopPropagation();
                if (openSub?.panel === sub) closeSub();
                else open();
            });
            wrap.append(row, sub);
            panel.appendChild(wrap);
            continue;
        }

        // --- Action / toggle row. ---
        const btn = document.createElement("button");
        btn.className = "udoc-toolbar__menu-item";
        btn.setAttribute("role", item.checked ? "menuitemcheckbox" : item.activeWhen ? "menuitemradio" : "menuitem");
        // A disabled button is inert, so the click can't fire for it.
        btn.disabled = !enabled;
        if (item.separatorBefore) btn.classList.add("udoc-toolbar__menu-item--divider");
        // A checkable item (the Align reference toggle) carries a trailing on/off
        // switch — visibly stateful in either position — and reports its state to
        // a11y.
        const isChecked = item.checked?.(ctx) ?? false;
        if (item.checked) {
            btn.classList.add("udoc-toolbar__menu-item--checkable");
            btn.classList.toggle("udoc-toolbar__menu-item--checked", isChecked);
            btn.setAttribute("aria-checked", String(isChecked));
        }
        // A row of a mutually exclusive set (an alignment, a line spacing) marks
        // the value the selection holds with the shared selected fill — no
        // switch: exactly one of the set is current, or none is, which four
        // switches would misread as four independent toggles.
        if (item.activeWhen) {
            const active = item.activeWhen(ctx);
            btn.classList.toggle("udoc-toolbar__menu-item--selected", active);
            btn.setAttribute("aria-checked", String(active));
        }
        const toggle = item.checked ? `<span class="udoc-toolbar__menu-switch" aria-hidden="true"></span>` : "";
        btn.innerHTML = `${icon(item)}<span class="udoc-toolbar__menu-label">${label(item)}</span>${toggle}`;
        // Hovering a plain row collapses any open sibling fly-out.
        btn.addEventListener("mouseenter", closeSub);
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (!item.action) return;
            host.action(item.action);
            // A toggle that keeps its panel open rebuilds it so its check (and
            // what it gates) reflect the new state immediately; a plain action
            // dismisses the whole menu.
            if (item.keepsOpen) buildMenuInto(panel, items, host);
            else host.close();
        });
        panel.appendChild(btn);
    }
}
