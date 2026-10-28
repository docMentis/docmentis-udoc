// New Slide: the presentation Home tab's document-level action, and the layout
// picker it opens.
import type { UDocCommand } from "@docmentis/udoc-ui";
import type { CommandDef } from "@docmentis/udoc-ui/internal";
import type { EditHost } from "./edit-client.js";
import { createNewSlideModal } from "./components/NewSlideModal.js";
import type { LayoutOption } from "./components/NewSlideModal.js";
import type { I18n, MessageKey } from "./i18n/index.js";
import { ICON_PAGE_ADD } from "./icons.js";

/** Create a slide at `index` (clamped), seeded with its layout's content
 *  placeholders. `layout` is the slide-layout id to build on; omit it to copy
 *  the neighbor slide's layout. */
function createSlide(index: number, layout?: string): UDocCommand {
    return {
        presentation: { editSlide: { command: { insertSlide: layout == null ? { index } : { index, layout } } } },
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
        // `1 + its index`), and open. Falls back to the copy-neighbor default
        // when no slide layouts are available. The 0-based page index nearest
        // the viewport top is the current slide; +1 lands the new slide right
        // after it, PowerPoint-style.
        async open() {
            const insertIndex = host.store.getState().pageIndex + 1;
            const slideMasters = await host.edit.slideMastersSummary();
            const options: LayoutOption[] = slideMasters.flatMap((slideMaster) =>
                slideMaster.slideLayouts.map((slideLayout, index) => ({
                    layout: slideLayout.id,
                    plane: slideMaster.plane,
                    page: index + 1,
                    name: slideLayout.name,
                })),
            );
            if (options.length === 0) {
                void execute(createSlide(insertIndex));
                return;
            }
            modal.open({
                insertIndex,
                options,
                renderPreview: (plane, page, scale) => host.client.renderPagePreview(plane, page, scale),
                onPick: (layout) => void execute(createSlide(insertIndex, layout)),
            });
        },
        destroy: () => modal.destroy(),
    };
}

/**
 * The New Slide command, opening the picker with `open` — a document-level
 * action shown only with nothing selected: it sits where the selection's
 * property controls go, so it shows on the empty canvas and yields to those
 * controls the moment a shape or text is selected. Labeled, as its page-add
 * glyph reads "slide" only once you know.
 */
export function newSlideCommand(open: () => void): CommandDef<MessageKey> {
    return {
        id: "createSlide",
        label: "command.createSlide",
        icon: ICON_PAGE_ADD,
        group: "slide",
        labeled: true,
        run: { kind: "action", press: open },
        enabledWhen: (c) => c.ready && c.selection.count === 0,
    };
}
