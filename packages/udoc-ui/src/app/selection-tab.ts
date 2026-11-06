// Which tab of a strip a selection opens, which the reducer asks as the selection
// changes.
import type { SelectionCapabilities } from "../geometry.js";
import type { ToolbarTab } from "./state.js";

/** The tab of `tabs` a selection of `caps` opens with `activeTab` open: that tab,
 *  if it {@link ToolbarTab.staysOpen} over this selection, else the first whose
 *  {@link ToolbarTab.opensFor} holds for it — or null for none. */
export function selectionTab(
    tabs: readonly ToolbarTab<string>[],
    caps: SelectionCapabilities,
    activeTab: string | null,
): string | null {
    const open = tabs.find((t) => t.id === activeTab);
    if (open?.staysOpen && open.opensFor?.(caps)) return open.id;
    return tabs.find((t) => t.opensFor?.(caps) ?? false)?.id ?? null;
}

/**
 * The tab of `tabs` that a selection changing from `was` to `now` opens with
 * `activeTab` open, or null to leave the tab where it is. A selection of another
 * kind opens its tab: a caret in text the Text tab, a picked shape the Shape tab.
 * One of the same kind — a caret moved, an edit echoed — doesn't, which keeps a tab
 * picked since or the ribbon folded. A selection out of none always does, though
 * none may be for the same tab: pages picked open a PDF's Page tab over one picked
 * while nothing was selected.
 */
export function selectionOpensTab(
    tabs: readonly ToolbarTab<string>[],
    was: SelectionCapabilities,
    now: SelectionCapabilities,
    activeTab: string | null,
): string | null {
    const tab = selectionTab(tabs, now, activeTab);
    if (tab === null) return null;
    const sameTab = tab === selectionTab(tabs, was, activeTab);
    return sameTab && !(was.count === 0 && now.count > 0) ? null : tab;
}
