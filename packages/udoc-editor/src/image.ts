// An image document's edits: its pages turned, flipped, cropped and resized
// from the Home tab, and the shapes the Insert tab draws over them. A page edit names
// its page by the id its manifest entry carries, which also measures it: the
// page's size in points — the points a crop and the shapes are in, the page's
// own from its top-left — and its pixels, which a resize names.
import type { ImagePageCommand, ImagePageInfo, UDocCommand } from "@docmentis/udoc-wasm";
import { allowsEdit, ICON_ROTATE_LEFT, ICON_ROTATE_RIGHT } from "@docmentis/udoc-ui/internal";
import type { CommandContext, CommandDef, ShapeKind, ShapePoint } from "@docmentis/udoc-ui/internal";
import { ICON_FLIP_VERTICAL } from "./arrange.js";
import { createImageSizeModal } from "./components/ImageSizeModal.js";
import type { EditHost } from "./edit-client.js";
import type { I18n, MessageKey } from "./i18n/index.js";
import { ICON_CROP, ICON_FLIP, ICON_IMAGE_SIZE } from "./icons.js";
import { markupShape } from "./markup.js";
import { editStateOf } from "./state.js";

/** A large insert index that clamps to "on top" in the engine. */
const APPEND_INDEX = 0x7fff_ffff;

/** The resolution a page whose file gave none is taken at — the engine's. */
const DEFAULT_DPI = 96;

/** Points per inch. */
const POINTS_PER_INCH = 72;

/** Wrap a command on an image's pages in its `UDocCommand`. */
export function editPage(command: ImagePageCommand): UDocCommand {
    return { image: { editPage: { command } } };
}

/** The page's resolution along its own `[x, y]`, in dots per inch: its
 *  image's, swapped where the image lies a quarter turn — the engine's
 *  `ImagePageInfo::resolution`. */
function resolution(info: ImagePageInfo): [number, number] {
    const [dpiX, dpiY] = info.dpi ?? [DEFAULT_DPI, DEFAULT_DPI];
    return quarterTurned(info) ? [dpiY, dpiX] : [dpiX, dpiY];
}

/** Whether page `info`'s image lies a quarter turn either way. */
function quarterTurned(info: ImagePageInfo): boolean {
    return info.imageRotation === "clockwise90" || info.imageRotation === "clockwise270";
}

/** The pixels page `info` holds at its resolution — the engine's
 *  `ImagePageInfo::pixel_size`: what a save writes, and what a resize names. */
export function pagePixels(info: ImagePageInfo): { width: number; height: number } {
    const [dpiX, dpiY] = resolution(info);
    return {
        width: Math.max(1, Math.round((info.size.width * dpiX) / POINTS_PER_INCH)),
        height: Math.max(1, Math.round((info.size.height * dpiY) / POINTS_PER_INCH)),
    };
}

/** The pixels of its image page `info` shows, as loaded — before any resize:
 *  the page's size over the points its image's pixels cover on it. */
function imagePixels(info: ImagePageInfo): { width: number; height: number } {
    const [across, down] = quarterTurned(info) ? [info.height, info.width] : [info.width, info.height];
    const rect = info.imageRect;
    return {
        width: Math.max(1, Math.round((info.size.width * across) / (rect.x1 - rect.x0))),
        height: Math.max(1, Math.round((info.size.height * down) / (rect.y1 - rect.y0))),
    };
}

/** Whether page `info` shows less than its whole image — a crop Reset can
 *  take away. */
export function croppedPage(info: ImagePageInfo): boolean {
    const rect = info.imageRect;
    const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
    return !(near(rect.x0, 0) && near(rect.y0, 0) && near(rect.x1, info.size.width) && near(rect.y1, info.size.height));
}

/** The current page of the open image's manifest entry — what an edit of it
 *  names and measures — or null with none. */
function currentPage(host: EditHost): Promise<ImagePageInfo | null> {
    return host.client.image.pageInfoByIndex(host.store.getState().pageIndex);
}

/** The Image Size dialog, mounted into a shell. */
export interface ImageSize {
    /** Open the dialog on the current page. */
    open(): Promise<void>;
    destroy(): void;
}

/** Mount the Image Size dialog into `host` — once, re-seeded with the current
 *  page's sizes each open: its pixels now, and its image's as loaded. */
export function mountImageSize(host: EditHost, i18n: I18n): ImageSize {
    const modal = createImageSizeModal(i18n);
    modal.mount(host.root);
    return {
        async open() {
            const info = await currentPage(host);
            if (!info) return;
            const shown = pagePixels(info);
            const original = imagePixels(info);
            modal.open({
                width: shown.width,
                height: shown.height,
                originalWidth: original.width,
                originalHeight: original.height,
                onResize: (width, height) =>
                    void host.commit(() =>
                        host.client.execute(editPage({ resizePage: { id: info.id, width, height } })),
                    ),
            });
        },
        destroy: () => modal.destroy(),
    };
}

/** Turn the pages picked in the thumbnails a quarter turn — clockwise, or
 *  counter-clockwise — or the current page with none picked. */
async function rotatePages(host: EditHost, clockwise: boolean): Promise<void> {
    if (allowsEdit(host.store.getState().selectionCaps, "rotatePages")) {
        await host.commit(() =>
            host.client.executeOnSelection({ kind: "page", edit: { kind: "rotatePages", clockwise } }),
        );
        return;
    }
    const info = await currentPage(host);
    if (info) await host.commit(() => host.client.execute(editPage({ rotatePages: { ids: [info.id], clockwise } })));
}

/** Flip the pages picked in the thumbnails — left to right, or top to bottom
 *  — or the current page with none picked. */
async function flipPages(host: EditHost, horizontal: boolean): Promise<void> {
    if (allowsEdit(host.store.getState().selectionCaps, "flipPages")) {
        await host.commit(() =>
            host.client.executeOnSelection({ kind: "page", edit: { kind: "flipPages", horizontal } }),
        );
        return;
    }
    const info = await currentPage(host);
    if (info) await host.commit(() => host.client.execute(editPage({ flipPages: { ids: [info.id], horizontal } })));
}

/**
 * Whether an image's page edits show on its Home tab in `c`: with no shape
 * drawn over a page selected — nothing, or pages in the thumbnails — outside
 * crop mode. Home is contextual, so they yield to the text and shape controls
 * the moment a shape is.
 */
function whenPageEdits(c: CommandContext): boolean {
    return (
        c.ready &&
        c.docType === "image" &&
        editStateOf(c).cropping === null &&
        (c.selection.count === 0 || allowsEdit(c.selection, "rotatePages"))
    );
}

/** What the image commands open: crop mode, and the Image Size dialog, on the
 *  current page. */
export interface ImagePageActions {
    crop(): void;
    resize(): void;
}

/** The image Home tab's page commands, over `host` once edit mode is mounted. */
export function imageCommands(
    host: () => EditHost | null,
    actions: ImagePageActions,
): Readonly<Record<string, CommandDef<MessageKey>>> {
    const rotate = (clockwise: boolean) => {
        const mounted = host();
        if (mounted) void rotatePages(mounted, clockwise);
    };
    const flip = (horizontal: boolean) => {
        const mounted = host();
        if (mounted) void flipPages(mounted, horizontal);
    };
    return {
        rotatePageLeft: {
            id: "rotatePageLeft",
            label: "thumbnails.rotateLeft",
            icon: ICON_ROTATE_LEFT,
            group: "image",
            run: { kind: "action", press: () => rotate(false) },
            enabledWhen: whenPageEdits,
        },
        rotatePageRight: {
            id: "rotatePageRight",
            label: "thumbnails.rotateRight",
            icon: ICON_ROTATE_RIGHT,
            group: "image",
            run: { kind: "action", press: () => rotate(true) },
            enabledWhen: whenPageEdits,
        },
        flipPageHorizontal: {
            id: "flipPageHorizontal",
            label: "arrange.flipHorizontal",
            icon: ICON_FLIP,
            group: "image",
            run: { kind: "action", press: () => flip(true) },
            enabledWhen: whenPageEdits,
        },
        flipPageVertical: {
            id: "flipPageVertical",
            label: "arrange.flipVertical",
            icon: ICON_FLIP_VERTICAL,
            group: "image",
            run: { kind: "action", press: () => flip(false) },
            enabledWhen: whenPageEdits,
        },
        cropPage: {
            id: "cropPage",
            label: "command.cropPage",
            icon: ICON_CROP,
            group: "image",
            run: { kind: "action", press: actions.crop },
            enabledWhen: whenPageEdits,
        },
        resizePage: {
            id: "resizePage",
            label: "command.resizePage",
            icon: ICON_IMAGE_SIZE,
            group: "image",
            run: { kind: "action", press: actions.resize },
            enabledWhen: whenPageEdits,
        },
    };
}

/**
 * Draw `shape` over page `page` from `p0` to `p1` — the page's own points —
 * and select it. One committing edit. A no-op on a page that takes no markup,
 * or with no image open.
 */
export async function placeMarkup(
    host: EditHost,
    shape: ShapeKind,
    page: number,
    p0: ShapePoint,
    p1: ShapePoint,
): Promise<void> {
    const [info, id, story] = await Promise.all([
        host.client.image.pageInfoByIndex(page),
        host.client.mintId(),
        host.client.mintId(),
    ]);
    if (!info || !id || !story) return;
    const node = markupShape(id, story, shape, p0, p1, info.size);
    await host.commit(() =>
        host.client.execute({
            image: {
                editShape: {
                    page: info.id,
                    command: { insertShapes: { parent: null, index: APPEND_INDEX, nodes: [node] } },
                },
            },
        }),
    );
    host.client.setSelection({ image: { shapes: { page: info.id, selection: { shapes: [id] } } } });
}
