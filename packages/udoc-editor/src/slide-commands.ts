// A deck's Slide tab's slide commands: New Slide and Change Layout, with the
// layout picker they open, and Delete Slide.
import type { UDocCommand } from "@docmentis/udoc-ui";
import { allowsEdit, ICON_DELETE, ICON_SLIDE_ADD } from "@docmentis/udoc-ui/internal";
import type { CommandDef, UIState } from "@docmentis/udoc-ui/internal";
import type { EditHost } from "./edit-client.js";
import { createSlideLayoutModal } from "./components/SlideLayoutModal.js";
import type { LayoutOption } from "./components/SlideLayoutModal.js";
import type { I18n, MessageKey } from "./i18n/index.js";
import { ICON_CHANGE_LAYOUT } from "./icons.js";

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

/** Put the slides `ids` on the slide layout `layout`, in one undo step. */
function setSlidesLayout(ids: string[], layout: string): UDocCommand {
    return { presentation: { editSlide: { command: { setSlidesLayout: { ids, layout } } } } };
}

/** Delete the slides picked in the thumbnails, or else the current slide — by
 *  id, as whatever else is selected is on it, not it. */
async function deleteSlides(host: EditHost): Promise<void> {
    const { selectedPages, pageIndex } = host.store.getState();
    if (selectedPages.length > 0) return host.deleteSelection();
    const id = await host.edit.slideId(pageIndex);
    if (id === null) return;
    await host.commit(() =>
        host.client.execute({ presentation: { editSlide: { command: { deleteSlides: { ids: [id] } } } } }),
    );
}

/** The 0-based slides Change Layout acts on: those of the sections selected in
 *  the thumbnails, else the slides selected there, else the current slide —
 *  an empty section's selection leaving only that. */
function layoutTargets(state: UIState): number[] {
    const { selectedPages, selectedSlideSections, slideSections, pageIndex } = state;
    const inSections = slideSections
        .filter((section) => selectedSlideSections.includes(section.id))
        .flatMap((section) => Array.from({ length: section.count }, (_, slide) => section.start + slide));
    if (inSections.length > 0) return inSections;
    return selectedPages.length > 0 ? [...selectedPages] : [pageIndex];
}

/** The layout picker, mounted into a shell. */
export interface SlideLayouts {
    /** Open the picker for a new slide after the current one. */
    newSlide(): Promise<void>;
    /** Open the picker for another layout for the slides selected in the
     *  thumbnails, or the current slide. */
    changeLayout(): Promise<void>;
    destroy(): void;
}

/** Mount the layout picker into `host` — once, re-seeded with the current
 *  layout roster each open. */
export function mountSlideLayouts(host: EditHost, i18n: I18n): SlideLayouts {
    const modal = createSlideLayoutModal(i18n);
    modal.mount(host.root);
    const execute = (command: UDocCommand) => host.commit(() => host.client.execute(command));
    const renderPreview = (plane: number, page: number, scale: number) =>
        host.client.renderPagePreview(plane, page, scale);
    // Pull every slide master's summary, flattened to pickable options (each
    // slide layout previews on the slide masters' plane, after its slide
    // master's page), with the current slide's size, which every slide layout
    // shares.
    const roster = async () => {
        const [slideMasters, slideSize] = await Promise.all([
            host.client.presentation.slideMasters(),
            host.client.pageDisplaySize(0, host.store.getState().pageIndex),
        ]);
        const options: LayoutOption[] = slideMasters.flatMap((slideMaster) =>
            slideMaster.slideLayouts.map((slideLayout, index) => ({
                layout: slideLayout.id,
                plane: slideMaster.plane,
                page: slideMaster.page + 1 + index,
                name: slideLayout.name,
            })),
        );
        // Zero in a deck with no slides yet.
        return { options, slideSize: slideSize.width > 0 && slideSize.height > 0 ? slideSize : null };
    };
    return {
        // Falls back to the copy-neighbor default when no slide layouts are
        // available. The new slide lands at the end of the last section selected
        // in the thumbnails — an empty one too — else right after the last slide
        // selected there, else after the current slide — the 0-based page index
        // nearest the viewport top — PowerPoint-style.
        async newSlide() {
            const { selectedPages, pageIndex, slideSections, selectedSlideSections } = host.store.getState();
            const section = [...slideSections].reverse().find((s) => selectedSlideSections.includes(s.id))?.id;
            const insertIndex =
                section !== undefined
                    ? APPEND_INDEX
                    : (selectedPages.length > 0 ? Math.max(...selectedPages) : pageIndex) + 1;
            const { options, slideSize } = await roster();
            if (options.length === 0) {
                void execute(createSlide(insertIndex, undefined, section));
                return;
            }
            modal.open({
                heading: i18n.t("command.createSlide"),
                label: i18n.t("newSlide.label"),
                current: null,
                options,
                slideSize,
                renderPreview,
                onPick: (layout) => void execute(createSlide(insertIndex, layout, section)),
            });
        },
        // The slides are read as the picker opens, by id: a peer's edit while it
        // is open can move them, or delete one, which the engine then skips. The
        // layout they all share is marked, the slide's own when there's one.
        async changeLayout() {
            const slides = layoutTargets(host.store.getState());
            const [{ options, slideSize }, ids, layouts] = await Promise.all([
                roster(),
                Promise.all(slides.map((slide) => host.edit.slideId(slide))),
                Promise.all(slides.map((slide) => host.client.presentation.slideLayoutId(slide))),
            ]);
            const held = ids.filter((id) => id !== null);
            if (held.length === 0 || options.length === 0) return;
            const label = i18n.t("command.changeLayout");
            modal.open({
                heading: label,
                label,
                current: new Set(layouts).size === 1 ? layouts[0]! : null,
                options,
                slideSize,
                renderPreview,
                onPick: (layout) => void execute(setSlidesLayout(held, layout)),
            });
        },
        destroy: () => modal.destroy(),
    };
}

/**
 * The New Slide command, opening the picker with `open` — a document-level
 * action, live whatever is selected: the slide lands after the current one,
 * or the slides or sections picked in the thumbnails. Not in the Slide Master
 * view, which shows no slide to put it after.
 */
export function newSlideCommand(open: () => void): CommandDef<MessageKey> {
    return {
        id: "createSlide",
        label: "command.createSlide",
        icon: ICON_SLIDE_ADD,
        group: "slide",
        run: { kind: "action", press: open },
        enabledWhen: (c) => c.ready && c.presentationView !== "slideMaster",
    };
}

/**
 * The Delete Slide command, over `host` once edit mode is mounted: the slides
 * picked in the thumbnails, or else the current one. On a deck's slides, not its
 * notes pages or the Slide Master view. Greyed with a section picked, which holds
 * its slides' pages too but goes by its own edits: Delete removes the section,
 * and its menu offers to take the slides with it.
 */
export function deleteSlideCommand(host: () => EditHost | null): CommandDef<MessageKey> {
    return {
        id: "deleteSlide",
        label: "thumbnails.deleteSlide",
        icon: ICON_DELETE,
        group: "slide",
        run: {
            kind: "action",
            press: () => {
                const mounted = host();
                if (mounted) void deleteSlides(mounted);
            },
        },
        enabledWhen: (c) =>
            c.ready &&
            c.presentationView === "normal" &&
            c.pageCount > 0 &&
            !allowsEdit(c.selection, "deleteSlideSections"),
    };
}

/**
 * The Change Layout command, opening the picker with `open` — live whatever is
 * selected, as New Slide is: it acts on the current slide unless slides or
 * sections are picked in the thumbnails. On a deck's slides, not its notes
 * pages or the Slide Master view, and not with no slide to change.
 */
export function changeLayoutCommand(open: () => void): CommandDef<MessageKey> {
    return {
        id: "changeLayout",
        label: "command.changeLayout",
        icon: ICON_CHANGE_LAYOUT,
        group: "slide",
        run: { kind: "action", press: open },
        enabledWhen: (c) => c.ready && c.presentationView === "normal" && c.pageCount > 0,
    };
}
