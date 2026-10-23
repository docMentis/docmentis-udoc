// The Insert tab's commands: Shapes on a PDF, placed by a pointer gesture the
// canvas carries out, and Image on a slide deck, asked for and inserted at once.
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
import { ICON_IMAGE } from "./icons.js";

/** A placed shape's fill — translucent blue (filled shapes only). */
const FILL = { components: [0.26, 0.55, 0.96], colorSpace: "srgb" };
/** A placed shape's fill opacity. */
const FILL_ALPHA = 0.18;

/** The shapes the Insert tab places, as the shell carries their place tools. */
const SHAPES: ReadonlySet<string> = new Set<ShapeKind>(["rectangle", "ellipse", "line", "arrow"]);

/** Shapes offered by the Insert tab's shape picker (`insertShape`). */
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

/** The shape the Insert tab's place `tool` drags out. */
export function placedShape(tool: string): ShapeKind | null {
    return SHAPES.has(tool) ? (tool as ShapeKind) : null;
}

/** Place the Insert tab's `tool` on page `page`, spanning the page-local points
 *  `p0 → p1`: a shape as a page object, on top of the page — the engine mints
 *  its id and selects it. A no-op for a page with no id (no document, or not a
 *  PDF). */
export async function place(host: EditHost, tool: string, page: number, p0: ShapePoint, p1: ShapePoint): Promise<void> {
    const shape = placedShape(tool);
    if (!shape || host.store.getState().status !== "ready") return;
    const pageId = await host.client.portable.pageIdByIndex(page);
    if (pageId === undefined) return;
    await host.commit(() => host.client.execute(EditCommand.insertObjects(pageId, [shapeObject(shape, p0, p1)])));
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

/** The Insert tab's commands, Image asking for its file with `pickImage`. */
export function insertCommands(pickImage: () => void): Readonly<Record<string, CommandDef<MessageKey>>> {
    return {
        insertImage: {
            id: "insertImage",
            label: "command.insertImage",
            icon: ICON_IMAGE,
            group: "insert",
            labeled: true,
            run: { kind: "action", press: pickImage },
            enabledWhen: (c) => c.ready && c.docType === "presentation",
        },
        insertShape: {
            id: "insertShape",
            label: "command.insertShape",
            icon: ICON_SUBTOOL_RECTANGLE,
            group: "insert",
            run: { kind: "armPicker", options: SHAPE_OPTIONS },
            enabledWhen: (c) => c.ready && c.docType === "portable",
        },
    };
}
