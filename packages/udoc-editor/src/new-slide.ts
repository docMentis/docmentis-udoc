// New Slide: the presentation Home tab's document-level action, and the layout
// picker it opens.
import type { UDocCommand } from "@docmentis/udoc-ui";
import { allowsEdit, ICON_PAGE_ADD } from "@docmentis/udoc-ui/internal";
import type { CommandDef } from "@docmentis/udoc-ui/internal";
import type { EditHost } from "./edit-client.js";
import { createNewSlideModal } from "./components/NewSlideModal.js";
import type { LayoutOption } from "./components/NewSlideModal.js";
import type { I18n, MessageKey } from "./i18n/index.js";

/** An insert index past any deck's end, which the engine clamps — the end of
 *  the section the slide is put in. */
const APPEND_INDEX = 0x7fff_ffff;

/** Create a slide at `index` (clamped), seeded with its layout's content
 *  placeholders. `layout` is the slide-layout id to build on; omit it to copy
 *  the neighbor slide's layout. `slideSection` is the section it joins, `index`
 *  clamped into its run; omit it to join the section of the slide it follows. */
function createSlide(index: number, layout?: string, slideSection?: string): UDocCommand {
    return {
        presentation: {
            editSlide: {
                command: {
                    insertSlide: {
                        index,
                        ...(layout == null ? {} : { layout }),
                        ...(slideSection == null ? {} : { slideSection }),
                    },
                },
            },
        },
    };
}

/** The layout picker, mounted into a shell. */
export interface NewSlide {
    /** Open the picker for a new slide after the current one. */
    open(): Promise<void>;
    destroy(): void;
}

/** Mount the layout picker into `host` — once, re-seeded with the current
 *  layout roster each open. */
export function mountNewSlide(host: EditHost, i18n: I18n): NewSlide {
    const modal = createNewSlideModal(i18n);
    modal.mount(host.root);
    const execute = (command: UDocCommand) => host.commit(() => host.client.execute(command));
    return {
        // Pull every slide master's summary, flatten it to pickable options
        // (each slide layout previews on its slide master's plane at page
        // `1 + its index`), and open — with the current slide's size, which
        // every slide layout shares. Falls back to the copy-neighbor default
        // when no slide layouts are available. The new slide lands at the end
        // of the last section selected in the thumbnails — an empty one too —
        // else right after the last slide selected there, else after the
        // current slide — the 0-based page index nearest the viewport top —
        // PowerPoint-style.
        async open() {
            const { selectedPages, pageIndex, slideSections, selectedSlideSections } = host.store.getState();
            const section = [...slideSections].reverse().find((s) => selectedSlideSections.includes(s.id))?.id;
            const insertIndex =
                section !== undefined
                    ? APPEND_INDEX
                    : (selectedPages.length > 0 ? Math.max(...selectedPages) : pageIndex) + 1;
            const [slideMasters, slideSize] = await Promise.all([
                host.edit.slideMastersSummary(),
                host.client.pageDisplaySize(pageIndex),
            ]);
            const options: LayoutOption[] = slideMasters.flatMap((slideMaster) =>
                slideMaster.slideLayouts.map((slideLayout, index) => ({
                    layout: slideLayout.id,
                    plane: slideMaster.plane,
                    page: index + 1,
                    name: slideLayout.name,
                })),
            );
            if (options.length === 0) {
                void execute(createSlide(insertIndex, undefined, section));
                return;
            }
            modal.open({
                insertIndex,
                options,
                // Zero in a deck with no slides yet.
                slideSize: slideSize.width > 0 && slideSize.height > 0 ? slideSize : null,
                renderPreview: (plane, page, scale) => host.client.renderPagePreview(plane, page, scale),
                onPick: (layout) => void execute(createSlide(insertIndex, layout, section)),
            });
        },
        destroy: () => modal.destroy(),
    };
}

/**
 * The New Slide command, opening the picker with `open` — a document-level
 * action shown with nothing selected, or slides or sections: it sits where the
 * selection's property controls go, so it shows on the empty canvas and with
 * slides or sections picked in the thumbnails, and yields to those controls the
 * moment a shape or text is selected.
 */
export function newSlideCommand(open: () => void): CommandDef<MessageKey> {
    return {
        id: "createSlide",
        label: "command.createSlide",
        icon: ICON_PAGE_ADD,
        group: "slide",
        run: { kind: "action", press: open },
        enabledWhen: (c) =>
            c.ready &&
            (c.selection.count === 0 || allowsEdit(c.selection, "insertSlide") || c.slideSections.selected.length > 0),
    };
}
