// A word document's Review tab's Accept and Reject, edit mode's — a viewer shows
// tracked changes and never settles them — and Previous and Next beside them.
// Accept and Reject are each a menu, as Word's Changes group gives it: the
// change the selection touches, every change the revision view shows, or every
// change.
import { allowsTextEdit, applyPoint, commandContext, fromComponents } from "@docmentis/udoc-ui/internal";
import type { CommandContext, CommandDef, MenuItem } from "@docmentis/udoc-ui/internal";
import type { Point, Rect, SelectionGeometry, UDocCommand } from "@docmentis/udoc-wasm";
import type { EditHost } from "./edit-client.js";
import type { MessageKey } from "./i18n/index.js";
import {
    ICON_ACCEPT_REVISIONS,
    ICON_NEXT_REVISION_GROUP,
    ICON_PREVIOUS_REVISION_GROUP,
    ICON_REJECT_REVISIONS,
} from "./icons.js";
import { editAction } from "./menu-action.js";
import type { EditTools } from "./tools.js";

/** The Review tab's commands edit mode adds. */
type ReviewCommandId = "acceptRevisions" | "rejectRevisions" | "previousRevisionGroup" | "nextRevisionGroup";

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

/** Move the selection to the tracked change after it — or to the one before,
 *  unless `forward` — and bring it into view with the least scroll. As Word's
 *  Next and Previous, it shows the changes it steps through: No Markup and
 *  Original turn to All Markup, and Simple Markup stays, the engine passing by
 *  the deletions it hides. */
async function moveToRevisionGroup(host: EditHost, forward: boolean): Promise<void> {
    const mode = commandContext(host.store.getState()).revisionView?.mode;
    if (mode === "noMarkup" || mode === "original") {
        host.runMenuAction({ kind: "setRevisionViewMode", mode: "allMarkup" });
    }
    const landing = selectionStart(await host.client.moveToRevisionGroup(forward));
    if (landing) host.client.goToRect(landing.page, landing.rect, "nearest");
}

/** Where a selection starts: its first highlighted piece's page-local box, else
 *  its caret's, and the page it is on; null with neither. */
function selectionStart(geometry: SelectionGeometry): { page: number; rect: Rect } | null {
    const quad = geometry.text[0];
    if (quad) return { page: quad.page, rect: bounds(quad.points) };
    const caret = geometry.caret;
    if (!caret) return null;
    const transform = fromComponents(caret.transform);
    const { x0, y0, x1, y1 } = caret.rect;
    const corners = [
        applyPoint(transform, x0, y0),
        applyPoint(transform, x1, y0),
        applyPoint(transform, x0, y1),
        applyPoint(transform, x1, y1),
    ];
    return { page: caret.page, rect: bounds(corners) };
}

/** The axis-aligned box around `points`. */
function bounds(points: readonly Point[]): Rect {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
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

/** The Review tab's Accept and Reject, then Previous and Next, over the
 *  {@link EditTools} once edit mode is mounted; each named beside its icon. */
export function reviewCommands(tools: () => EditTools): Readonly<Record<ReviewCommandId, CommandDef<MessageKey>>> {
    return {
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
        previousRevisionGroup: {
            id: "previousRevisionGroup",
            label: "command.previousRevisionGroup",
            icon: ICON_PREVIOUS_REVISION_GROUP,
            group: "changes",
            labeled: true,
            run: { kind: "action", press: () => void moveToRevisionGroup(tools().host, false) },
            enabledWhen: whenTracked,
        },
        nextRevisionGroup: {
            id: "nextRevisionGroup",
            label: "command.nextRevisionGroup",
            icon: ICON_NEXT_REVISION_GROUP,
            group: "changes",
            labeled: true,
            run: { kind: "action", press: () => void moveToRevisionGroup(tools().host, true) },
            enabledWhen: whenTracked,
        },
    };
}
