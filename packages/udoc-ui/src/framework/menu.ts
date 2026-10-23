/**
 * Menu controller — the shared open/close behavior behind every dropdown,
 * split button, and app menu.
 *
 * Before this, each control hand-rolled the same four things: an `isOpen`
 * flag, `display` toggling on the panel, `aria-expanded` on the trigger, and a
 * document click-outside listener (some with Escape, some without). That drift
 * is exactly how behavior diverges. This centralizes it so every popover opens,
 * closes, and dismisses identically.
 *
 * It owns behavior only — not layout or styling. The caller supplies the
 * trigger and panel elements and positions the panel via CSS.
 */
export interface MenuController {
    /** Whether the panel is currently open. */
    readonly isOpen: boolean;
    open(): void;
    close(): void;
    toggle(): void;
    /** Remove listeners. Does not remove the elements. */
    destroy(): void;
}

export interface MenuControllerOptions {
    /** Called after the panel opens (e.g. to build/refresh its contents). */
    onOpen?: () => void;
    /** Called after the panel closes. */
    onClose?: () => void;
    /**
     * Outside-click hit test. `true` keeps the menu open. Defaults to "inside
     * the trigger or the panel" (just the panel for a triggerless menu).
     * Override when the panel is teleported out of the trigger's subtree (e.g.
     * anchored in a scroll container).
     */
    isInside?: (target: Node) => boolean;
}

/**
 * Every currently-open menu's close fn, with its panel. Menus are mutually
 * exclusive: opening one closes the rest — all but a menu whose panel holds the
 * new one's trigger (a dropdown on the ribbon's overflow panel), which stays
 * open around it. A trigger click stops propagation (so the document
 * outside-click listener never sees it), so without this registry an
 * already-open menu would stay open when another is opened.
 */
const openMenus = new Map<() => void, HTMLElement>();

/**
 * Wire a trigger button to a floating panel: toggle on trigger click, close on
 * outside click or Escape, and keep `aria-expanded` in sync. The panel is shown
 * with `display: block` and hidden with `display: none`. Opening this one
 * closes any other open menu but one it nests in, and closing it closes the
 * ones nested in it.
 *
 * `trigger` is `null` for a menu with no trigger element — a context menu,
 * which is opened imperatively (`open()`) at the pointer rather than by
 * clicking a button. Such a menu has nothing to toggle and nothing to carry
 * `aria-expanded`, so it takes neither; it keeps the rest of the shared
 * behavior (outside-click, Escape, and the mutual exclusion that closes any
 * dropdown it opens over).
 */
export function createMenuController(
    trigger: HTMLElement | null,
    panel: HTMLElement,
    options: MenuControllerOptions = {},
): MenuController {
    let open = false;

    const isInside =
        options.isInside ??
        ((target: Node) => (trigger !== null && trigger.contains(target)) || panel.contains(target));

    function setOpen(next: boolean): void {
        if (next === open) return;
        open = next;
        if (next) {
            // Close every other open menu before showing this one, but one this
            // one's trigger sits on.
            for (const [closeOther, other] of [...openMenus]) {
                if (closeOther !== forceClose && !(trigger !== null && other.contains(trigger))) closeOther();
            }
            openMenus.set(forceClose, panel);
        } else {
            openMenus.delete(forceClose);
            // A menu open on this one's panel goes with it.
            for (const [closeInner, inner] of [...openMenus]) if (panel.contains(inner)) closeInner();
        }
        panel.style.display = next ? "block" : "none";
        trigger?.setAttribute("aria-expanded", String(next));
        if (next) options.onOpen?.();
        else options.onClose?.();
    }

    const forceClose = () => setOpen(false);

    // A trigger click toggles; stopPropagation so the same click doesn't reach
    // the document listener below and immediately re-close what it just opened.
    const onTriggerClick = (e: MouseEvent) => {
        e.stopPropagation();
        setOpen(!open);
    };
    const onDocClick = (e: MouseEvent) => {
        if (open && !isInside(e.target as Node)) setOpen(false);
    };
    const onKeydown = (e: KeyboardEvent) => {
        if (open && e.key === "Escape") setOpen(false);
    };

    trigger?.addEventListener("click", onTriggerClick);
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKeydown);

    panel.style.display = "none";
    trigger?.setAttribute("aria-expanded", "false");

    return {
        get isOpen() {
            return open;
        },
        open: () => setOpen(true),
        close: () => setOpen(false),
        toggle: () => setOpen(!open),
        destroy() {
            openMenus.delete(forceClose);
            trigger?.removeEventListener("click", onTriggerClick);
            document.removeEventListener("click", onDocClick);
            document.removeEventListener("keydown", onKeydown);
        },
    };
}
