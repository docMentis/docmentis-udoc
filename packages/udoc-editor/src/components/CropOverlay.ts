// Crop mode's chrome over an image's page: the box that keeps its part of the
// page, the rest of the page dimmed around it, a handle on each corner and
// edge, and the size the page would show at. A plain {@link OverlaySource}
// registered over the selection layer (`udoc:image-crop`), so its presses are
// its own rather than the canvas's.
//
// The box is fractions of the page from its top-left, so it follows the page
// through every zoom and scroll with no conversion here; what a drag makes of
// it (an aspect kept, the page's bounds) is the crop controller's.
import type { OverlaySource, PageView } from "@docmentis/udoc-ui";
import type { CropBox, CropHandle } from "../crop-box.js";
import type { I18n } from "../i18n/index.js";

/** What the crop overlay draws, and what its gestures ask. */
export interface CropOverlayHooks {
    i18n: I18n;
    /** The page cropped. */
    page: number;
    /** The box now. */
    box(): CropBox;
    /** The size the page would show at, cropped to `box` — its badge. */
    label(box: CropBox): string;
    /** The page's on-screen box this frame, which a drag measures by. */
    view(view: PageView): void;
    /** Drag `handle` from where the box was, `from`, by `dx` × `dy` (fractions
     *  of the page), keeping its aspect when `keep` (Shift); the box it lands
     *  at. */
    drag(handle: CropHandle, from: CropBox, dx: number, dy: number, keep: boolean): CropBox;
    /** Apply the crop — a double click in the box. */
    apply(): void;
}

/** The handles around the box, each with the cursor it shows. */
const HANDLES: ReadonlyArray<[CropHandle, string]> = [
    ["nw", "nwse-resize"],
    ["n", "ns-resize"],
    ["ne", "nesw-resize"],
    ["e", "ew-resize"],
    ["se", "nwse-resize"],
    ["s", "ns-resize"],
    ["sw", "nesw-resize"],
    ["w", "ew-resize"],
];

/** The room the size badge needs above the box to sit outside it, CSS px. */
const BADGE_ROOM = 28;

/** The parts of one crop overlay's element, laid out each frame and drag. */
interface CropParts {
    root: HTMLElement;
    shades: [HTMLElement, HTMLElement, HTMLElement, HTMLElement];
    box: HTMLElement;
    badge: HTMLElement;
}

function div(className: string): HTMLDivElement {
    const el = document.createElement("div");
    el.className = className;
    return el;
}

/** Lay `parts` out over a page `width` × `height` CSS px, the box at `box`. */
function layout(parts: CropParts, width: number, height: number, box: CropBox, label: string): void {
    const x0 = box.x0 * width;
    const y0 = box.y0 * height;
    const x1 = box.x1 * width;
    const y1 = box.y1 * height;
    const place = (el: HTMLElement, left: number, top: number, w: number, h: number) => {
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
        el.style.width = `${Math.max(0, w)}px`;
        el.style.height = `${Math.max(0, h)}px`;
    };
    parts.root.style.width = `${width}px`;
    parts.root.style.height = `${height}px`;
    const [top, bottom, left, right] = parts.shades;
    place(top, 0, 0, width, y0);
    place(bottom, 0, y1, width, height - y1);
    place(left, 0, y0, x0, y1 - y0);
    place(right, x1, y0, width - x1, y1 - y0);
    place(parts.box, x0, y0, x1 - x0, y1 - y0);
    parts.badge.textContent = label;
    parts.badge.style.left = `${(x0 + x1) / 2}px`;
    // Above the box where there is room, else just inside its top edge.
    parts.badge.style.top = `${y0 >= BADGE_ROOM ? y0 - BADGE_ROOM : y0 + 6}px`;
}

/**
 * The crop overlay: over page `hooks.page`, the box `hooks.box()`, which its
 * handles and its middle drag through `hooks.drag`.
 */
export function cropOverlay(hooks: CropOverlayHooks): OverlaySource {
    // The page's last on-screen box, which a drag in progress measures by.
    let current: PageView | null = null;
    let parts: CropParts | null = null;

    function create(): HTMLElement {
        const root = div("udoc-crop");
        root.setAttribute("role", "group");
        root.setAttribute("aria-label", hooks.i18n.t("command.cropPage"));
        const shades = [
            div("udoc-crop__shade"),
            div("udoc-crop__shade"),
            div("udoc-crop__shade"),
            div("udoc-crop__shade"),
        ] as [HTMLElement, HTMLElement, HTMLElement, HTMLElement];
        const box = div("udoc-crop__box");
        box.dataset["handle"] = "move";
        box.append(div("udoc-crop__grid"));
        for (const [handle, cursor] of HANDLES) {
            const el = div(`udoc-crop__handle udoc-crop__handle--${handle}`);
            el.dataset["handle"] = handle;
            el.style.cursor = cursor;
            box.append(el);
        }
        const badge = div("udoc-crop__size");
        root.append(...shades, box, badge);
        parts = { root, shades, box, badge };
        const laid = parts;

        // A press on a handle, or in the box, drags it until the release.
        root.addEventListener("pointerdown", (e) => {
            const handle = (e.target as HTMLElement).dataset["handle"] as CropHandle | undefined;
            if (e.button !== 0 || !handle || !current) return;
            e.preventDefault();
            e.stopPropagation();
            root.setPointerCapture(e.pointerId);
            const from = hooks.box();
            const start = { x: e.clientX, y: e.clientY };
            const move = (ev: PointerEvent) => {
                if (ev.pointerId !== e.pointerId || !current) return;
                const view = current;
                const box = hooks.drag(
                    handle,
                    from,
                    (ev.clientX - start.x) / view.width,
                    (ev.clientY - start.y) / view.height,
                    ev.shiftKey,
                );
                layout(laid, view.width, view.height, box, hooks.label(box));
            };
            const end = (ev: PointerEvent) => {
                if (ev.pointerId !== e.pointerId) return;
                root.releasePointerCapture(e.pointerId);
                root.removeEventListener("pointermove", move);
                root.removeEventListener("pointerup", end);
                root.removeEventListener("pointercancel", end);
            };
            root.addEventListener("pointermove", move);
            root.addEventListener("pointerup", end);
            root.addEventListener("pointercancel", end);
        });
        box.addEventListener("dblclick", (e) => {
            e.preventDefault();
            hooks.apply();
        });
        return root;
    }

    return (frame) =>
        frame.views
            .filter((view) => view.index === hooks.page)
            .map((view) => ({
                key: "crop",
                x: view.x,
                y: view.y,
                create,
                update: () => {
                    current = view;
                    hooks.view(view);
                    const box = hooks.box();
                    if (parts) layout(parts, view.width, view.height, box, hooks.label(box));
                },
            }));
}
