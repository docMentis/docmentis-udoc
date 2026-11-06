// A PDF's Page tab's page commands: a blank page after the current one, and the
// current page deleted, turned a quarter turn or resized — the pages picked in
// the thumbnails in its place, but for a resize, which names one page.
import {
    allowsEdit,
    ICON_DELETE,
    ICON_PAGE_ADD,
    ICON_ROTATE_LEFT,
    ICON_ROTATE_RIGHT,
} from "@docmentis/udoc-ui/internal";
import type { CommandContext, CommandDef, SelectionCapabilities } from "@docmentis/udoc-ui/internal";
import { pageSizeInfo } from "./components/PageControls.js";
import { createPageSettingsModal } from "./components/PageSettingsModal.js";
import type { EditHost } from "./edit-client.js";
import type { I18n, MessageKey } from "./i18n/index.js";
import { ICON_PAGE_RESIZE } from "./icons.js";
import { applyPageEdit } from "./page-controls.js";

/** Whether `caps` holds pages picked in the thumbnails. */
function pagesPicked(caps: SelectionCapabilities): boolean {
    return allowsEdit(caps, "rotatePages");
}

/** Whether a PDF's page edits are live in `c`. */
function whenPortable(c: CommandContext): boolean {
    return c.ready && c.docType === "portable";
}

/** Delete Page, greyed where it would take a PDF's last page: its only one, or
 *  every page picked. */
function whenDeletable(c: CommandContext): boolean {
    if (!whenPortable(c)) return false;
    return pagesPicked(c.selection) ? allowsEdit(c.selection, "deletePages") : c.pageCount > 1;
}

/** Insert a blank page after the last page picked, or else the current one —
 *  a page the size of the one it follows — and go to it. */
async function createPage(host: EditHost): Promise<void> {
    const { selectionCaps, selectedPages, pageIndex } = host.store.getState();
    const picked = allowsEdit(selectionCaps, "insertPage");
    const index = (picked ? Math.max(...selectedPages) : pageIndex) + 1;
    await (picked
        ? host.commit(() => host.client.executeOnSelection({ kind: "page", edit: { kind: "insertPage" } }))
        : applyPageEdit(host, { kind: "insert", index }));
    host.store.dispatch({ type: "NAVIGATE_TO_PAGE", pageIndex: index });
}

/** Delete the pages picked, or else the current one. */
function deletePages(host: EditHost): Promise<void> {
    const { selectionCaps, pageIndex } = host.store.getState();
    return pagesPicked(selectionCaps)
        ? host.commit(() => host.client.executeOnSelection({ kind: "page", edit: { kind: "deletePages" } }))
        : applyPageEdit(host, { kind: "delete", index: pageIndex });
}

/** Turn the pages picked a quarter turn, or else the current one. */
function rotatePages(host: EditHost, clockwise: boolean): Promise<void> {
    const { selectionCaps, pageIndex } = host.store.getState();
    return pagesPicked(selectionCaps)
        ? host.commit(() => host.client.executeOnSelection({ kind: "page", edit: { kind: "rotatePages", clockwise } }))
        : applyPageEdit(host, { kind: "rotate", index: pageIndex, clockwise });
}

/** The Resize Page dialog, mounted into a shell. */
export interface PageResize {
    /** Open the dialog on the current page. */
    open(): void;
    destroy(): void;
}

/** Mount the Resize Page dialog into `host` — once, re-seeded with the current
 *  page's size each open, as the last frame measured it. */
export function mountPageResize(host: EditHost, i18n: I18n): PageResize {
    const modal = createPageSettingsModal(i18n);
    modal.mount(host.root);
    return {
        open() {
            const index = host.store.getState().pageIndex;
            const shown = host.pageView(index);
            if (!shown) return;
            const { width, height } = pageSizeInfo(shown.view, shown.scale);
            modal.open({
                index,
                width,
                height,
                onResize: (w, h) => void applyPageEdit(host, { kind: "resize", index, width: w, height: h }),
            });
        },
        destroy: () => modal.destroy(),
    };
}

/** The Page tab's page commands, over `host` once edit mode is mounted, Resize
 *  Page opening its dialog with `resize`. */
export function pageCommands(
    host: () => EditHost | null,
    resize: () => void,
): Readonly<Record<string, CommandDef<MessageKey>>> {
    const withHost = (run: (mounted: EditHost) => Promise<void>) => () => {
        const mounted = host();
        if (mounted) void run(mounted);
    };
    return {
        pageCreate: {
            id: "pageCreate",
            label: "thumbnails.insertPage",
            icon: ICON_PAGE_ADD,
            group: "page",
            run: { kind: "action", press: withHost(createPage) },
            enabledWhen: whenPortable,
        },
        pageDelete: {
            id: "pageDelete",
            label: "thumbnails.deletePage",
            icon: ICON_DELETE,
            group: "page",
            run: { kind: "action", press: withHost(deletePages) },
            enabledWhen: whenDeletable,
        },
        pageRotateLeft: {
            id: "pageRotateLeft",
            label: "thumbnails.rotateLeft",
            icon: ICON_ROTATE_LEFT,
            group: "page",
            run: { kind: "action", press: withHost((mounted) => rotatePages(mounted, false)) },
            enabledWhen: whenPortable,
        },
        pageRotateRight: {
            id: "pageRotateRight",
            label: "thumbnails.rotateRight",
            icon: ICON_ROTATE_RIGHT,
            group: "page",
            run: { kind: "action", press: withHost((mounted) => rotatePages(mounted, true)) },
            enabledWhen: whenPortable,
        },
        pageResize: {
            id: "pageResize",
            label: "command.pageResize",
            icon: ICON_PAGE_RESIZE,
            group: "page",
            run: { kind: "action", press: resize },
            enabledWhen: whenPortable,
        },
    };
}
