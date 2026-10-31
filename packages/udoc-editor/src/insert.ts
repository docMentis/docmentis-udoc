// The Insert tab's commands: Shapes, placed by a pointer gesture the canvas
// carries out — a PDF's four as page objects, the gallery's on a deck's slides
// and over an image's pages — and Image on a slide deck, asked for and inserted
// at once.
import {
    ICON_SUBTOOL_ARROW,
    ICON_SUBTOOL_ELLIPSE,
    ICON_SUBTOOL_LINE,
    ICON_SUBTOOL_RECTANGLE,
    SHAPE_STROKE,
    SHAPE_STROKE_WIDTH,
    segmentsFor,
} from "@docmentis/udoc-ui/internal";
import type { CommandDef, PickerOption, ShapeKind, ShapePoint } from "@docmentis/udoc-ui/internal";
import type { EditHost } from "./edit-client.js";
import { EditCommand } from "./edit-command.js";
import type { MessageKey } from "./i18n/index.js";
import { ICON_IMAGE, ICON_SHAPES } from "./icons.js";
import { placeMarkup } from "./image.js";
import { galleryShape, SHAPE_GALLERY } from "./shape-gallery.js";
import type { GalleryShape } from "./shape-gallery.js";
import { slideShape } from "./slide-shape.js";
import { editStateOf } from "./state.js";

/** A large insert index that clamps to "on top" in the engine. */
const APPEND_INDEX = 0x7fff_ffff;

/** A placed shape's fill — translucent blue (filled shapes only). */
const FILL = { components: [0.26, 0.55, 0.96], colorSpace: "srgb" };
/** A placed shape's fill opacity. */
const FILL_ALPHA = 0.18;

/** The shapes the Insert tab places on a PDF, as the shell carries their place
 *  tools. */
const PORTABLE_SHAPES: ReadonlySet<string> = new Set<ShapeKind>(["rectangle", "ellipse", "line", "arrow"]);

/** Shapes offered by a PDF's Insert tab's shape picker (`insertShape`). */
const SHAPE_OPTIONS: readonly PickerOption<MessageKey>[] = (
    [
        ["rectangle", ICON_SUBTOOL_RECTANGLE, "shape.rectangle"],
        ["ellipse", ICON_SUBTOOL_ELLIPSE, "shape.ellipse"],
        ["line", ICON_SUBTOOL_LINE, "shape.line"],
        ["arrow", ICON_SUBTOOL_ARROW, "shape.arrow"],
    ] as const satisfies ReadonlyArray<readonly [ShapeKind, string, MessageKey]>
).map(([shape, icon, label]) => ({ tool: { kind: "extension", tool: shape }, icon, label }));

/**
 * The model `GraphicsObject` for `shape` spanning the drag from `p0` to `p1`
 * (page-local document points), ready to drop into an `InsertObjects` command's
 * `objects`. The object carries **no `id`** — the `InsertObjects` command mints
 * one on insert, so the host never allocates ids. Rectangle and ellipse use the
 * box of the two points; line and arrow run `p0 → p1`, so the direction is
 * preserved. Filled shapes (rectangle / ellipse) get the translucent fill +
 * solid stroke; open shapes (line / arrow) are stroke only.
 */
function shapeObject(shape: ShapeKind, p0: ShapePoint, p1: ShapePoint): unknown {
    const filled = shape === "rectangle" || shape === "ellipse";
    const object = {
        transform: { scaleX: 1, skewY: 0, skewX: 0, scaleY: 1, translateX: 0, translateY: 0 },
        clips: [],
        optionalContent: [],
        content: {
            path: {
                path: { segments: segmentsFor(shape, p0, p1) },
                windingRule: "nonZero",
                nonstrokingStyle: { brush: { solid: FILL }, alpha: FILL_ALPHA, overprint: false },
                strokingStyle: {
                    brush: { solid: SHAPE_STROKE },
                    alpha: 1.0,
                    overprint: false,
                    line: {
                        width: SHAPE_STROKE_WIDTH,
                        lineCap: "butt",
                        lineJoin: "miter",
                        miterLimit: 10.0,
                        dashArray: null,
                        dashOffset: 0.0,
                    },
                },
                fill: filled,
                stroke: true,
                renderStyle: {
                    blendMode: "normal",
                    alphaIsShape: false,
                    overprintMode: "default",
                    renderingIntent: "relativeColorimetric",
                },
                softMask: null,
            },
        },
    };
    return object;
}

/** The outline the Insert tab's place `tool` is sketched with while it is
 *  dragged out — a gallery shape's, or a PDF shape's own. */
export function placedShape(tool: string): ShapeKind | null {
    return galleryShape(tool)?.sketch ?? (PORTABLE_SHAPES.has(tool) ? (tool as ShapeKind) : null);
}

/** Place the Insert tab's `tool` on page `page`, spanning the page-local points
 *  `p0 → p1`, on top of the page: on a PDF, a shape as a page object — the
 *  engine mints its id and selects it — on a deck, a gallery shape on the
 *  slide, and on an image, one drawn over it. A no-op for a page with no id
 *  (no document, or none of these), or a tool not the document's. */
export async function place(host: EditHost, tool: string, page: number, p0: ShapePoint, p1: ShapePoint): Promise<void> {
    const state = host.store.getState();
    if (state.status !== "ready") return;
    if (state.docType === "portable") {
        if (!PORTABLE_SHAPES.has(tool)) return;
        const pageId = await host.client.portable.pageIdByIndex(page);
        if (pageId === undefined) return;
        const object = shapeObject(tool as ShapeKind, p0, p1);
        await host.commit(() => host.client.execute(EditCommand.insertObjects(pageId, [object])));
        return;
    }
    const shape = galleryShape(tool);
    if (!shape) return;
    if (state.docType === "image") return placeMarkup(host, shape, page, p0, p1);
    if (state.docType === "presentation") return placeSlideShape(host, shape, page, p0, p1);
}

/**
 * Put `shape` on the deck's slide `page` from `p0` to `p1` — the slide's own
 * points — on top of the slide, and select it. One committing edit. A no-op
 * past the last slide.
 */
async function placeSlideShape(
    host: EditHost,
    shape: GalleryShape,
    page: number,
    p0: ShapePoint,
    p1: ShapePoint,
): Promise<void> {
    const [slide, id, story] = await Promise.all([host.edit.slideId(page), host.client.mintId(), host.client.mintId()]);
    if (!slide || !id || !story) return;
    const container = { slide };
    const node = slideShape(id, story, shape, p0, p1);
    await host.commit(() =>
        host.client.execute({
            presentation: {
                editShape: {
                    container,
                    command: { insertShapes: { parent: null, index: APPEND_INDEX, nodes: [node] } },
                },
            },
        }),
    );
    host.client.setSelection({ presentation: { shapes: { container, selection: { shapes: [id] } } } });
}

/** Insert the image file `bytes` as a picture on the current slide, centred
 *  and scaled down to fit, then selected — a committing edit, so the picture's
 *  selection rides back. */
export function insertImage(host: EditHost, bytes: Uint8Array, contentType: string): Promise<void> {
    return host.commit(() => host.edit.insertImage(bytes, contentType));
}

/** Ask for an image file and {@link insertImage} it. The engine reads the
 *  file's size and format from its bytes; the browser's MIME type rides along,
 *  empty when it has none. */
export function pickImage(host: EditHost): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) return;
        void file
            .arrayBuffer()
            .then((buffer) => insertImage(host, new Uint8Array(buffer), file.type))
            .catch((error: unknown) => console.error("udoc: inserting the image failed", error));
    });
    input.click();
}

/** The Insert tab's commands, Image asking for its file with `pickImage` —
 *  live on a deck's slides, which it inserts onto: not on its notes pages. */
export function insertCommands(pickImage: () => void): Readonly<Record<string, CommandDef<MessageKey>>> {
    return {
        insertImage: {
            id: "insertImage",
            label: "command.insertImage",
            icon: ICON_IMAGE,
            group: "insert",
            labeled: true,
            run: { kind: "action", press: pickImage },
            enabledWhen: (c) => c.ready && c.docType === "presentation" && c.presentationView === "normal",
        },
        insertShape: {
            id: "insertShape",
            label: "command.insertShape",
            icon: ICON_SHAPES,
            group: "insert",
            labeled: true,
            run: { kind: "armPicker", options: SHAPE_OPTIONS },
            enabledWhen: (c) => c.ready && c.docType === "portable",
        },
        insertGalleryShape: {
            id: "insertGalleryShape",
            label: "command.insertShape",
            icon: ICON_SHAPES,
            group: "insert",
            labeled: true,
            run: { kind: "armGallery", sections: SHAPE_GALLERY },
            // On a deck's slides, not its notes pages. An image's current page
            // takes them unless it's animated or a vector, and not while it's
            // cropped.
            enabledWhen: (c) =>
                c.ready &&
                ((c.docType === "presentation" && c.presentationView === "normal") ||
                    (c.docType === "image" && editStateOf(c).pageTakesMarkup && editStateOf(c).cropping === null)),
        },
    };
}
