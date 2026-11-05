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
