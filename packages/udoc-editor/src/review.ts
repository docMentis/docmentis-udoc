// A word document's Review tab's Accept and Reject, edit mode's — a viewer shows
// tracked changes and never settles them. Each is a split button, as Word's
// Changes group gives it: pressed, it settles the change the selection touches
// and moves on to the next; its menu settles that change alone, every change
// the revision view shows, or every change. The Revisions panel's cards offer
// the two on their own change.
import { allowsTextEdit, buildMenuInto, commandContext, createSplitButton } from "@docmentis/udoc-ui/internal";
import type {
    CommandContext,
    CommandDef,
    MenuItem,
    RevisionAction,
    RibbonControl,
    RibbonControlEnv,
    UIState,
} from "@docmentis/udoc-ui/internal";
import type { UDocCommand } from "@docmentis/udoc-wasm";
import type { EditHost } from "./edit-client.js";
import type { MessageKey } from "./i18n/index.js";
import { ICON_ACCEPT_REVISIONS, ICON_REJECT_REVISIONS } from "./icons.js";
import { editAction, runEditMenuAction } from "./menu-action.js";
import type { EditMenuAction } from "./menu-action.js";
import type { EditTools } from "./tools.js";

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

/** Settle the change the selection touches — accepted where `accept`, else
 *  rejected — then move the selection to the next, as Word's Accept and Move
 *  to Next does. */
async function settleAndMoveOn(host: EditHost, accept: boolean): Promise<void> {
    await settleRevisions(host, accept, "selection");
    host.store.dispatch({ type: "MOVE_TO_REVISION_GROUP", forward: true });
}

/**
 * Accept's or Reject's split button, for command `id`: the main part, named
 * beside its icon, settles the change the selection touches and moves on, live
 * where the selection touches one; the caret opens {@link settleMenu}.
 */
function settleControl(env: RibbonControlEnv, tools: EditTools, id: ReviewCommandId): RibbonControl {
    const { host, i18n } = tools;
    const accept = id === "acceptRevisions";
    const split = createSplitButton({
        mainLabel: i18n.t(accept ? "review.acceptAndNext" : "review.rejectAndNext"),
        mainIcon: accept ? ICON_ACCEPT_REVISIONS : ICON_REJECT_REVISIONS,
        mainText: env.label,
        caretLabel: env.label,
        menuLabel: env.label,
        onOpen: () =>
            buildMenuInto(split.menu, settleMenu(accept), {
                i18n,
                context: () => commandContext(host.store.getState()),
                action: (action) => {
                    if (action.kind === "extension") runEditMenuAction(tools, action.action as EditMenuAction);
                },
                close: () => split.controller.close(),
            }),
    });
    split.main.dataset.command = id;
    split.caret.dataset.command = id;
    split.main.addEventListener("click", () => void settleAndMoveOn(host, accept));
    return {
        el: split.el,
        // After the ribbon's pass, which greys both parts as the command says.
        sync: (state: UIState) => {
            const c = commandContext(state);
            split.main.disabled = !(whenTracked(c) && allowsTextEdit(c.selection, id));
        },
        close: () => split.controller.close(),
        destroy: () => split.destroy(),
    };
}

/** The Review tab's Accept and Reject, split buttons named beside their icons,
 *  over the edit tools `tools` gives once edit mode is mounted. */
export function reviewCommands(tools: () => EditTools): Readonly<Record<ReviewCommandId, CommandDef<MessageKey>>> {
    const command = (id: ReviewCommandId, label: MessageKey, icon: string): CommandDef<MessageKey> => ({
        id,
        label,
        icon,
        group: "changes",
        labeled: true,
        run: { kind: "control", create: (env) => settleControl(env, tools(), id) },
        enabledWhen: whenTracked,
    });
    return {
        acceptRevisions: command("acceptRevisions", "command.acceptRevisions", ICON_ACCEPT_REVISIONS),
        rejectRevisions: command("rejectRevisions", "command.rejectRevisions", ICON_REJECT_REVISIONS),
    };
}
