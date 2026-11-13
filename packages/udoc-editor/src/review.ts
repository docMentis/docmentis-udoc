// A word document's Review tab's Accept and Reject, edit mode's — a viewer shows
// tracked changes and never settles them. Each is a menu, as Word's Changes
// group gives it: the change the selection touches, every change the revision
// view shows, or every change. The Revisions panel's cards offer the two on
// their own change.
import { allowsTextEdit } from "@docmentis/udoc-ui/internal";
import type { CommandContext, CommandDef, MenuItem, RevisionAction } from "@docmentis/udoc-ui/internal";
import type { UDocCommand } from "@docmentis/udoc-wasm";
import type { EditHost } from "./edit-client.js";
import type { MessageKey } from "./i18n/index.js";
import { ICON_ACCEPT_REVISIONS, ICON_REJECT_REVISIONS } from "./icons.js";
import { editAction } from "./menu-action.js";

/** The Review tab's commands edit mode adds. */
type ReviewCommandId = "acceptRevisions" | "rejectRevisions";

/** Which tracked changes a settle takes: those the selection touches, every one
 *  the revision view shows, or every one. */
export type RevisionScope = "selection" | "shown" | "all";

/** Whether a word document is open, its tracked changes there to settle. */
function whenTracked(c: CommandContext): boolean {
    return c.ready && c.revisionView !== null;
}

/** Settle `scope`'s tracked changes — accepted where `accept`, else rejected —
 *  as one undo step. */
export function settleRevisions(host: EditHost, accept: boolean, scope: RevisionScope): Promise<void> {
    if (scope === "selection") {
        return host.commit(() =>
            host.client.executeOnSelection({ kind: accept ? "acceptRevisions" : "rejectRevisions" }),
        );
    }
    const shownOnly = scope === "shown";
    const command: UDocCommand = {
        wordprocessing: accept ? { acceptAllRevisions: { shownOnly } } : { rejectAllRevisions: { shownOnly } },
    };
    return host.commit(() => host.client.execute(command));
}

/** Settle the tracked change whose records are `ids` — accepted where `accept`,
 *  else rejected — as one undo step. */
function settleRevisionGroup(host: EditHost, accept: boolean, ids: readonly string[]): Promise<void> {
    const command: UDocCommand = {
        wordprocessing: accept ? { acceptRevisions: { ids: [...ids] } } : { rejectRevisions: { ids: [...ids] } },
    };
    return host.commit(() => host.client.execute(command));
}

/** A Revisions panel card's Accept and Reject, on its change alone. */
export function revisionActions(host: EditHost): readonly RevisionAction[] {
    return [
        {
            icon: ICON_ACCEPT_REVISIONS,
            label: "command.acceptRevisions",
            run: (group) => void settleRevisionGroup(host, true, group.ids),
        },
        {
            icon: ICON_REJECT_REVISIONS,
            label: "command.rejectRevisions",
            run: (group) => void settleRevisionGroup(host, false, group.ids),
        },
    ];
}

/** Accept's or Reject's menu: the change the selection touches, live where the
 *  selection touches one, then every change shown, then every change. */
function settleMenu(accept: boolean): readonly MenuItem<MessageKey>[] {
    const row = (scope: RevisionScope, label: MessageKey, enabledWhen: (c: CommandContext) => boolean) => ({
        action: editAction({ kind: "settleRevisions", accept, scope }),
        label,
        enabledWhen,
    });
    return accept
        ? [
              row("selection", "review.acceptThisChange", (c) => allowsTextEdit(c.selection, "acceptRevisions")),
              row("shown", "review.acceptAllShown", whenTracked),
              row("all", "review.acceptAll", whenTracked),
          ]
        : [
              row("selection", "review.rejectThisChange", (c) => allowsTextEdit(c.selection, "rejectRevisions")),
              row("shown", "review.rejectAllShown", whenTracked),
              row("all", "review.rejectAll", whenTracked),
          ];
}

/** The Review tab's Accept and Reject, each named beside its icon. */
export const REVIEW_COMMANDS: Readonly<Record<ReviewCommandId, CommandDef<MessageKey>>> = {
    acceptRevisions: {
        id: "acceptRevisions",
        label: "command.acceptRevisions",
        icon: ICON_ACCEPT_REVISIONS,
        group: "changes",
        labeled: true,
        run: { kind: "menu", menu: settleMenu(true) },
        enabledWhen: whenTracked,
    },
    rejectRevisions: {
        id: "rejectRevisions",
        label: "command.rejectRevisions",
        icon: ICON_REJECT_REVISIONS,
        group: "changes",
        labeled: true,
        run: { kind: "menu", menu: settleMenu(false) },
        enabledWhen: whenTracked,
    },
};
