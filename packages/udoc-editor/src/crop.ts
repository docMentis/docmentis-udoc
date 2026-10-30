// Crop mode on an image's page: a box over the page that keeps its part of
// the image, dragged by its corners, its edges and its middle, kept to an
// aspect when one is picked, and applied as the page's crop. While it lasts
// the Home tab carries its controls — the aspect, Reset, Cancel and Apply —
// and Enter and Escape apply and cancel it.
//
// The page shows only the part of its image it keeps, so the box crops within
// that; Reset takes the crop away, the whole image showing again, to crop it
// afresh.
import type { ImagePageInfo } from "@docmentis/udoc-wasm";
import type { PageView } from "@docmentis/udoc-ui";
import { ICON_CHECK, ICON_CLEAR, subscribeSelector } from "@docmentis/udoc-ui/internal";
import type { CommandContext, CommandDef, MenuItem, UIState } from "@docmentis/udoc-ui/internal";
import { cropOverlay } from "./components/CropOverlay.js";
import { aspectRatio, dragged, fitRatio, scaled, WHOLE, wholePage } from "./crop-box.js";
import type { CropAspect, CropBox } from "./crop-box.js";
import type { EditHost } from "./edit-client.js";
import type { I18n, MessageKey } from "./i18n/index.js";
import { ICON_ASPECT_RATIO, ICON_CROP_RESET } from "./icons.js";
import { croppedPage, editPage, pagePixels } from "./image.js";
import { editAction } from "./menu-action.js";
import { editStateOf, updateEditState } from "./state.js";

/** The overlay crop mode registers. */
const OVERLAY_ID = "udoc:image-crop";

/** The narrowest the box gets, in CSS px on screen. */
const MIN_BOX_PX = 16;

/** Crop mode: what the Home tab's crop controls and the keys call. */
export interface Crop {
    /** Start cropping the current page — a no-op on a doc that isn't an
     *  image, or while cropping. */
    start(): Promise<void>;
    /** Crop the page to the box, and end crop mode. */
    apply(): Promise<void>;
    /** End crop mode, the page as it was. */
    cancel(): void;
    /** Take the page's crop away, its whole canvas showing again, and go on
     *  cropping it. */
    reset(): Promise<void>;
    /** Keep the box to `aspect`: the largest box of it in the one now. */
    setAspect(aspect: CropAspect): void;
    /** Enter applies and Escape cancels, while cropping. */
    keydown(e: KeyboardEvent): void;
    destroy(): void;
}

/** One crop in progress. */
interface CropSession {
    /** The page cropped. */
    page: number;
    /** Its manifest entry, re-read as the document changes. */
    info: ImagePageInfo;
    box: CropBox;
    aspect: CropAspect;
    /** The page on screen at the last frame. */
    view: PageView | null;
    /** Ends what the session subscribed to. */
    unsubscribe: () => void;
}

/** The pixels the cropped page holds. */
function shownPixels(session: CropSession): { width: number; height: number } {
    return pagePixels(session.info);
}

/** The ratio the session's aspect keeps the box to, or null for none. */
function sessionRatio(session: CropSession): number | null {
    const { width, height } = shownPixels(session);
    return aspectRatio(session.aspect, width, height);
}

/** Whether crop mode should end in `s`: the document, its type or the mode
 *  changed under it, or its page is gone. */
function cropEnds(s: UIState, page: number, generation: number): boolean {
    return (
        s.status !== "ready" ||
        s.docGeneration !== generation ||
        s.docType !== "image" ||
        s.mode !== "edit" ||
        page >= s.pageCount
    );
}

/** Crop mode over `host`, its words in `i18n`. */
export function createCrop(host: EditHost, i18n: I18n): Crop {
    const { store, client } = host;
    let session: CropSession | null = null;

    /** Mirror the session onto edit mode's state, which the Home tab reads. */
    function publish(): void {
        updateEditState(store, {
            cropping: session
                ? { page: session.page, aspect: session.aspect, cropped: croppedPage(session.info) }
                : null,
        });
    }

    const overlay = cropOverlay({
        i18n,
        get page() {
            return session?.page ?? -1;
        },
        box: () => session?.box ?? WHOLE,
        label(box) {
            if (!session) return "";
            const { width, height } = shownPixels(session);
            return i18n.t("image.cropSize", {
                width: Math.max(1, Math.round((box.x1 - box.x0) * width)),
                height: Math.max(1, Math.round((box.y1 - box.y0) * height)),
            });
        },
        view(view) {
            if (session) session.view = view;
        },
        drag(handle, from, dx, dy, keep) {
            if (!session) return from;
            const { width, height } = shownPixels(session);
            // The narrowest box, in the page's pixels, from its width on screen.
            const min = session.view ? (MIN_BOX_PX * width) / session.view.width : 1;
            const start = scaled(from, width, height);
            const ratio =
                sessionRatio(session) ??
                (keep && handle !== "move" ? (start.x1 - start.x0) / (start.y1 - start.y0) : null);
            const box = dragged(handle, start, dx * width, dy * height, width, height, min, ratio);
            session.box = scaled(box, 1 / width, 1 / height);
            return session.box;
        },
        apply: () => void apply(),
    });

    /** Draw the overlay again — a box that changed with no frame painted. */
    function redraw(): void {
        if (session) host.setOverlay(OVERLAY_ID, overlay, { aboveSelection: true });
    }

    function end(): void {
        if (!session) return;
        session.unsubscribe();
        session = null;
        host.removeOverlay(OVERLAY_ID);
        publish();
    }

    async function start(): Promise<void> {
        const state = store.getState();
        if (session || state.docType !== "image" || state.status !== "ready") return;
        const page = state.pageIndex;
        const info = await client.image.pageInfoByIndex(page);
        if (!info || session) return;
        // The selection's handles would sit over the box.
        client.clearSelection();
        const generation = state.docGeneration;
        const unsubs = [
            subscribeSelector(
                store,
                (s) => cropEnds(s, page, generation),
                (ends) => {
                    if (ends) end();
                },
            ),
            // An undo, a peer's edit: the entry the box is measured in again.
            client.onDocumentChanged(() => {
                void client.image.pageInfoByIndex(page).then((fresh) => {
                    if (!session || !fresh) return;
                    session.info = fresh;
                    publish();
                });
            }),
        ];
        session = {
            page,
            info,
            box: WHOLE,
            aspect: "free",
            view: null,
            unsubscribe: () => {
                for (const unsub of unsubs) unsub();
            },
        };
        publish();
        redraw();
    }

    async function apply(): Promise<void> {
        const cropped = session;
        if (!cropped) return;
        const { page, box } = cropped;
        end();
        if (wholePage(box)) return;
        // In the page's points as it is now, which the box was drawn over; the
        // engine snaps it to the page's pixels.
        const info = await client.image.pageInfoByIndex(page);
        if (!info) return;
        const rect = scaled(box, info.size.width, info.size.height);
        await host.commit(() => client.execute(editPage({ cropPage: { id: info.id, rect } })));
    }

    async function reset(): Promise<void> {
        const cropped = session;
        if (!cropped || !croppedPage(cropped.info)) return;
        await host.commit(() => client.execute(editPage({ cropPage: { id: cropped.info.id, rect: null } })));
        const info = await client.image.pageInfoByIndex(cropped.page);
        if (session !== cropped || !info) return;
        cropped.info = info;
        cropped.box = WHOLE;
        cropped.aspect = "free";
        publish();
        redraw();
    }

    function setAspect(aspect: CropAspect): void {
        if (!session) return;
        session.aspect = aspect;
        const ratio = sessionRatio(session);
        if (ratio !== null) {
            const { width, height } = shownPixels(session);
            session.box = scaled(fitRatio(scaled(session.box, width, height), ratio), 1 / width, 1 / height);
        }
        publish();
        redraw();
    }

    return {
        start,
        apply,
        cancel: end,
        reset,
        setAspect,
        keydown(e) {
            // A key in a real field — a dialog's, a panel's — is the field's;
            // the canvas's hidden text input, which edit mode keeps focused,
            // is no field.
            const target = e.target as HTMLElement | null;
            const field =
                target !== null &&
                !target.classList.contains("udoc-ui__text-input") &&
                (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA");
            if (!session || e.defaultPrevented || field) return;
            if (e.key === "Enter") {
                e.preventDefault();
                void apply();
            } else if (e.key === "Escape") {
                e.preventDefault();
                end();
            }
        },
        destroy: end,
    };
}

/** Whether crop mode is on in `c`. */
function whenCropping(c: CommandContext): boolean {
    return editStateOf(c).cropping !== null;
}

/** The aspects the Aspect Ratio menu offers, and what it calls them. */
const ASPECTS: ReadonlyArray<[CropAspect, MessageKey | null]> = [
    ["free", "image.free"],
    ["original", "image.original"],
    ["square", "image.square"],
    ["4:3", null],
    ["16:9", null],
];

/** The Aspect Ratio menu: the aspect the box keeps, checked. */
const ASPECT_MENU: readonly MenuItem<MessageKey>[] = ASPECTS.map(([aspect, label]) => ({
    action: editAction({ kind: "cropAspect", aspect }),
    label: label ?? ["image.ratio", { ratio: aspect }],
    enabledWhen: whenCropping,
    activeWhen: (c) => editStateOf(c).cropping?.aspect === aspect,
}));

/** Crop mode's controls on the image Home tab — which, Home being contextual,
 *  show while it lasts — over `crop` once edit mode is mounted. */
export function cropCommands(crop: () => Crop | null): Readonly<Record<string, CommandDef<MessageKey>>> {
    return {
        cropAspect: {
            id: "cropAspect",
            label: "image.aspectRatio",
            icon: ICON_ASPECT_RATIO,
            group: "crop",
            run: { kind: "menu", menu: ASPECT_MENU },
            enabledWhen: whenCropping,
        },
        cropReset: {
            id: "cropReset",
            label: "image.reset",
            icon: ICON_CROP_RESET,
            group: "crop",
            run: { kind: "action", press: () => void crop()?.reset() },
            enabledWhen: (c) => editStateOf(c).cropping?.cropped === true,
        },
        cropCancel: {
            id: "cropCancel",
            label: "common.cancel",
            icon: ICON_CLEAR,
            group: "cropEnd",
            run: { kind: "action", press: () => crop()?.cancel() },
            enabledWhen: whenCropping,
        },
        cropApply: {
            id: "cropApply",
            label: "image.apply",
            icon: ICON_CHECK,
            group: "cropEnd",
            run: { kind: "action", press: () => void crop()?.apply() },
            enabledWhen: whenCropping,
        },
    };
}
