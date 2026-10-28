/**
 * The canvas context menu — the right-click surface over the document, in view
 * mode as in edit.
 *
 * It is the home for the commands that *act on* the selection (copy, and an
 * extension's cut / paste / delete): they mean the same thing for a shape, a
 * slide, or a range of text, so they don't vary with the selection the way a
 * toolbar's controls do, and they read better beside the thing they act on than
 * ten inches away in a tab strip. It also stops the browser's own menu ("Save
 * image as…", "Inspect") from surfacing over a customer's document.
 *
 * Its rows are handed to it at each open — the shell's `CONTEXT_MENU`, or
 * the extension's (`UIExtension.contextMenuItems`) — the same declarative
 * {@link MenuItem}s the ribbon's dropdowns use, rendered by the same
 * {@link buildMenuInto}, so an item's icon, label, divider, and enablement are
 * written once where its list is.
 * The panel is a plain `.udoc-menu` parented on the shell root and positioned
 * at the pointer; open/close (outside-click, Escape, and the mutual exclusion
 * that closes any ribbon dropdown it opens over) is the shared
 * {@link createMenuController}, opened imperatively rather than by a trigger.
 */
import { createMenuController, subscribeSelector } from "../../framework/index.js";
import type { Store } from "../../framework/index.js";
import type { SelectionCapabilities } from "../../geometry.js";
import type { Action } from "../actions.js";
import { commandContext } from "../commands.js";
import type { MenuAction, MenuItem } from "../commands.js";
import type { I18n } from "../i18n/index.js";
import type { UIState } from "../state.js";
import { buildMenuInto } from "./menuItems.js";

export interface ContextMenuCallbacks {
    /** Run an activated row's intent (a copy, an extension's cut / delete) on
     *  the current selection — the same seam the ribbon's dropdown rows use. */
    onMenuAction?: (action: MenuAction) => void;
}

/** Gap (px) kept between the panel and the shell's edges when it would
 *  overflow — the panel flips back over the pointer rather than being clipped. */
const EDGE_MARGIN = 8;

/** The state the rows' enablement reads. Rebuilt while open (see `mount`) so an
 *  async selection report — the pick a right-click just made — settles the rows
 *  rather than leaving them stale for the life of the menu. */
interface ContextMenuSlice {
    ready: boolean;
    selectionCaps: SelectionCapabilities;
    /** Hide Slide's check, read back a round trip after the selection. */
    slidesHidden: boolean;
}

function selectSlice(s: UIState): ContextMenuSlice {
    return { ready: s.status === "ready", selectionCaps: s.selectionCaps, slidesHidden: s.selectedSlidesHidden };
}

function sliceEqual(a: ContextMenuSlice, b: ContextMenuSlice): boolean {
    return a.ready === b.ready && a.selectionCaps === b.selectionCaps && a.slidesHidden === b.slidesHidden;
}

export function createContextMenu(i18n: I18n) {
    const el = document.createElement("div");
    el.className = "udoc-menu udoc-context-menu";
    el.setAttribute("role", "menu");
    el.setAttribute("aria-label", i18n.t("contextMenu.label"));

    // Which list this open is showing — the one the open was handed. Held
    // rather than passed through `build` because the rows are also rebuilt while
    // open (when a late selection report lands), and that rebuild must show the
    // same menu the open did.
    let items: readonly MenuItem<string>[] = [];

    // No trigger: a context menu is opened by a `contextmenu` event at a point,
    // not by clicking a button, so there is nothing to toggle or to carry
    // `aria-expanded`. The controller still owns dismissal and exclusivity.
    // Rows are built on each open, so they reflect the selection this open sees.
    const controller = createMenuController(null, el, {
        isInside: (t) => el.contains(t),
        onOpen: () => build(),
    });

    let unsubRender: (() => void) | null = null;
    let callbacks: ContextMenuCallbacks = {};
    let store: Store<UIState, Action> | null = null;

    function build(): void {
        const s = store;
        if (!s) return;
        buildMenuInto(el, items, {
            i18n,
            context: () => commandContext(s.getState()),
            action: (action) => callbacks.onMenuAction?.(action),
            close: () => controller.close(),
        });
    }

    /**
     * Place the panel with its top-left at viewport `(clientX, clientY)`, in the
     * shell root's coordinates. Flips back over the pointer (the convention:
     * the menu never covers what you clicked on the side you have room on) when
     * it would overflow the root's right / bottom edge, and clamps to the top-left
     * if it fits neither way. Measured after the rows are built, so the size is
     * real.
     */
    function place(clientX: number, clientY: number): void {
        const root = el.parentElement;
        if (!root) return;
        const bounds = root.getBoundingClientRect();
        const { width, height } = el.getBoundingClientRect();
        let x = clientX - bounds.left;
        let y = clientY - bounds.top;
        if (x + width > bounds.width - EDGE_MARGIN) x = Math.max(EDGE_MARGIN, x - width);
        if (y + height > bounds.height - EDGE_MARGIN) y = Math.max(EDGE_MARGIN, y - height);
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
    }

    /**
     * Open the menu of `rows` at viewport `(clientX, clientY)`. Re-opens
     * (rebuilds and re-places) when already open, so a second right-click
     * elsewhere moves it rather than leaving it parked at the first point.
     */
    function open(clientX: number, clientY: number, rows: readonly MenuItem<string>[]): void {
        items = rows;
        controller.close();
        controller.open();
        place(clientX, clientY);
    }

    function mount(container: HTMLElement, s: Store<UIState, Action>): void {
        store = s;
        container.appendChild(el);
        // The rows build on open, and again whenever the selection's capabilities
        // land: a right-click that re-picks the object under the pointer reports
        // its new capabilities a round-trip later, so rows that opened stale (Copy
        // greyed on a fresh pick) settle in place instead of staying wrong for the
        // life of the menu.
        const rebuildIfOpen = () => {
            if (controller.isOpen) build();
        };
        unsubRender = subscribeSelector(s, selectSlice, rebuildIfOpen, { equality: sliceEqual });
    }

    function setCallbacks(next: ContextMenuCallbacks): void {
        callbacks = { ...callbacks, ...next };
    }

    function destroy(): void {
        if (unsubRender) unsubRender();
        controller.destroy();
        el.remove();
    }

    return { el, mount, open, close: () => controller.close(), setCallbacks, destroy };
}
