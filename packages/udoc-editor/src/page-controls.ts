// Edit mode's page controls: the rail beside a page — move up, move down,
// rotate, settings, delete — and the insert strip between pages, both page
// overlays registered under `udoc:` ids, so a host can remove or replace either
// like its own; with the roomier spacing they sit in, and the page settings
// dialog the rail opens.
import type { UDocCommand, UDocType } from "@docmentis/udoc-ui";
import type { PageCommand } from "@docmentis/udoc-wasm";
import { arrangementFor, subscribeSelector } from "@docmentis/udoc-ui/internal";
import type { PageSpacing, UIShellHost, UIState } from "@docmentis/udoc-ui/internal";
import { pageActions, pageInserts } from "./components/PageControls.js";
import { createPageSettingsModal } from "./components/PageSettingsModal.js";
import type { I18n } from "./i18n/index.js";

/** The gap between pages, which the insert strip lives in: page-fixed
 *  (document points), so it reads as part of the paper. */
const GAP_PT = 24;

/**
 * The spacing the page controls show with. The insert strip is sized from the
 * gap × the frame scale, so it fills the gap at every zoom. The paddings are
 * screen-fixed (CSS px), so the rail in the right padding stays a constant size
 * on screen — the side paddings are wide enough that the rail (offset + ~26px)
 * clears the virtual scrollbar at fit-width.
 */
export const PAGE_CONTROLS_SPACING: PageSpacing = {
    padding: { top: { px: 36 }, right: { px: 48 }, bottom: { px: 36 }, left: { px: 48 } },
    gap: { horizontal: GAP_PT, vertical: GAP_PT },
};

/** A page-structure edit addressed by index: the page controls' verbs. */
type PageStructureEdit =
    | { kind: "insert"; index: number }
    | { kind: "delete"; index: number }
    | { kind: "reorder"; from: number; to: number }
    // Rotate the page at `index` one quarter turn (clockwise, or
    // counter-clockwise when `clockwise` is false).
    | { kind: "rotate"; index: number; clockwise: boolean }
    // Resize the page at `index` to `width` × `height` (its new media-box size
    // in PDF points). The page's media-box origin and its objects' coordinates
    // are kept — the page rectangle changes around them.
    | { kind: "resize"; index: number; width: number; height: number };

/** The index of the existing page `edit` addresses, or `null` for an insert,
 *  whose index is only where the new page lands. */
function addressedPage(edit: PageStructureEdit): number | null {
    switch (edit.kind) {
        case "insert":
            return null;
        case "reorder":
            return edit.from;
        default:
            return edit.index;
    }
}

/** The `UDocCommand` for a page-structure edit, the page it addresses named by
 *  `id` (its {@link addressedPage}'s id; unused by an insert). `to` is the index
 *  the moved page takes in the resulting order. */
function pageCommand(edit: PageStructureEdit, id: string): UDocCommand {
    const editPage = (command: PageCommand): UDocCommand => ({ portable: { editPage: { command } } });
    switch (edit.kind) {
        case "insert":
            return editPage({ insertPage: { index: edit.index } });
        case "delete":
            return editPage({ deletePages: { ids: [id] } });
        case "reorder":
            return editPage({ reorderPages: { ids: [id], to: edit.to } });
        case "rotate":
            return editPage({ rotatePages: { ids: [id], clockwise: edit.clockwise } });
        case "resize":
            return editPage({ resizePage: { id, size: { width: edit.width, height: edit.height } } });
    }
}

/** The doc types whose pages the page controls move, rotate, delete and
 *  insert: the paginated, page-reorderable ones — PDF today. */
const PAGE_CONTROLLED: ReadonlySet<UDocType> = new Set<UDocType>(["portable"]);

/**
 * Whether the page controls show in `s`: in edit mode, for a doc type whose
 * pages reorder ({@link PAGE_CONTROLLED}), in the continuous single-page
 * arrangement — where the gaps they live in exist, and no facing page sits
 * where the rail goes.
 */
export function pageControlsShown(s: UIState): boolean {
    return (
        s.mode === "edit" &&
        s.scrollMode === "continuous" &&
        arrangementFor(s).layoutMode === "singlePage" &&
        s.docType !== null &&
        PAGE_CONTROLLED.has(s.docType)
    );
}

/** Mount the page controls into `host`, shown while {@link pageControlsShown}; returns the teardown. */
export function mountPageControls(host: UIShellHost, i18n: I18n): () => void {
    // Mounted once and reused for whichever page's "more" button is clicked.
    const settings = createPageSettingsModal(i18n);
    settings.mount(host.root);

    // Commands address a page by id: read the addressed page's id first, and
    // skip the edit when that page is gone.
    const pageEditAt = async (edit: PageStructureEdit): Promise<void> => {
        const page = addressedPage(edit);
        const id = page === null ? "" : await host.client.portable.pageIdByIndex(page);
        if (id === undefined) return;
        await host.commit(() => host.client.execute(pageCommand(edit, id)));
    };
    const pageCount = () => host.store.getState().pageCount;

    function show(shown: boolean): void {
        if (!shown) {
            host.removeOverlay("udoc:page-insert");
            host.removeOverlay("udoc:page-actions");
            return;
        }
        host.setOverlay(
            "udoc:page-insert",
            pageInserts({
                i18n,
                gapPt: GAP_PT,
                pageCount,
                onInsert: (index) => void pageEditAt({ kind: "insert", index }),
                // Yield the gap where a selection's resize/rotate handles
                // floated into it, so the insert strip never sits under them.
                keepOut: () => host.selectionKeepOut(),
            }),
        );
        // Registered after the insert strips so the rail stacks above them —
        // they share the inter-page gap.
        host.setOverlay(
            "udoc:page-actions",
            pageActions({
                i18n,
                pageCount,
                hoveredPage: () => host.hoveredPage(),
                onMoveUp: (index) => void pageEditAt({ kind: "reorder", from: index, to: index - 1 }),
                onMoveDown: (index) => void pageEditAt({ kind: "reorder", from: index, to: index + 1 }),
                onRotate: (index, clockwise) => void pageEditAt({ kind: "rotate", index, clockwise }),
                onDelete: (index) => void pageEditAt({ kind: "delete", index }),
                onOpenSettings: (index, size) =>
                    settings.open({
                        index,
                        width: size.width,
                        height: size.height,
                        onResize: (width, height) => void pageEditAt({ kind: "resize", index, width, height }),
                        onRotate: (clockwise) => void pageEditAt({ kind: "rotate", index, clockwise }),
                    }),
            }),
        );
    }

    show(pageControlsShown(host.store.getState()));
    const unsubscribe = subscribeSelector(host.store, pageControlsShown, show);
    return () => {
        unsubscribe();
        settings.destroy();
    };
}
