// What goes on a page or a slide, placed by a pointer gesture the canvas carries
// out: Shapes — a PDF's four as page objects, from its Page and Object tabs, the
// gallery's on a deck's slides, from its Slide and Shape tabs, and over an image's
// pages, from its Image and Shape tabs — and Text Box beside them, on a PDF's page
// a page object; and Image on a
// slide deck or a PDF's page, asked for and inserted at once. A shape paints with
// what was last specified (`PaintMemory`), else its document's default: a deck's
// theme, or docMentis's colors on a PDF or an image.
import {
    ICON_SUBTOOL_ARROW,
    ICON_SUBTOOL_ELLIPSE,
    ICON_SUBTOOL_LINE,
    ICON_SUBTOOL_RECTANGLE,
    ICON_SUBTOOL_TEXTBOX,
    SHAPE_STROKE_WIDTH,
    segmentsFor,
} from "@docmentis/udoc-ui/internal";
import type { CommandContext, CommandDef, PickerOption, ShapeKind, ShapePoint } from "@docmentis/udoc-ui/internal";
import type { ShapePreview } from "@docmentis/udoc-wasm";
import { DOCMENTIS_FILL, DOCMENTIS_LINE } from "./docmentis-theme.js";
import type { EditHost } from "./edit-client.js";
import { EditCommand } from "./edit-command.js";
import type { MessageKey } from "./i18n/index.js";
import { ICON_IMAGE, ICON_SHAPES } from "./icons.js";
import { markupPreview, placeMarkup, placeMarkupTextBox } from "./image.js";
import { galleryShape, PREVIEW_NODE_ID, PREVIEW_STORY_ID, SHAPE_GALLERY } from "./shape-gallery.js";
import type { GalleryShape } from "./shape-gallery.js";
import { specifiedPaint, specifiedPortablePaint } from "./paint.js";
import type { PaintMemory } from "./paint.js";
import { slideShape, slideShapeColors, slideTextBox } from "./slide-shape.js";
import type { SlideShapePaint } from "./slide-shape.js";
import { editStateOf } from "./state.js";

/** A large insert index that clamps to "on top" in the engine. */
const APPEND_INDEX = 0x7fff_ffff;

/** The shapes a PDF's Page tab places, as the shell carries their place tools. */
const PORTABLE_SHAPES: ReadonlySet<string> = new Set<ShapeKind>(["rectangle", "ellipse", "line", "arrow"]);

/** The tool Text Box arms, on a slide, an image or a PDF's page. */
const TEXT_BOX_TOOL = "textBox";

/** The standard font a PDF's text box is set in, and its size in points. */
const TEXT_BOX_FONT = "helvetica";
const TEXT_BOX_SIZE = 12;

/**
 * What a text box holds until it is typed over, selected so the first key
 * replaces it. One left untyped should still show, to be found and deleted: a
 * slide's or an image's has no fill or outline to show by, and the engine sets no
 * caret in a PDF's text object with nothing in it. ASCII, which the standard font's encoding
 * holds byte for byte; the same in every language, as that font has no glyphs for
 * most others.
 */
const TEXT_BOX_PLACEHOLDER = "Text";

/** Shapes offered by a PDF's Page tab's shape picker (`insertShape`). */
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
 * preserved. Filled shapes (rectangle / ellipse) get a fill and a stroke; open
 * shapes (line / arrow) are stroke only. Each paints with what was last specified
 * for it, else docMentis's colors at full opacity.
 */
function shapeObject(memory: PaintMemory, shape: ShapeKind, p0: ShapePoint, p1: ShapePoint): unknown {
    const filled = shape === "rectangle" || shape === "ellipse";
    const fill = specifiedPortablePaint(memory, "fill", DOCMENTIS_FILL);
    const stroke = specifiedPortablePaint(memory, "stroke", DOCMENTIS_LINE);
    const object = {
        transform: { scaleX: 1, skewY: 0, skewX: 0, scaleY: 1, translateX: 0, translateY: 0 },
        clips: [],
        optionalContent: [],
        content: {
            path: {
                path: { segments: segmentsFor(shape, p0, p1) },
                windingRule: "nonZero",
                nonstrokingStyle: { brush: { solid: fill.color }, alpha: fill.alpha, overprint: false },
                strokingStyle: {
                    brush: { solid: stroke.color },
                    alpha: stroke.alpha,
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

/** What {@link shapeObject} draws from `p0` to `p1`, as the sketch layer shows it. */
function shapeObjectPreview(memory: PaintMemory, shape: ShapeKind, p0: ShapePoint, p1: ShapePoint): ShapePreview {
    const filled = shape === "rectangle" || shape === "ellipse";
    const fill = specifiedPortablePaint(memory, "fill", DOCMENTIS_FILL);
    const stroke = specifiedPortablePaint(memory, "stroke", DOCMENTIS_LINE);
    return {
        paths: [
            {
                segments: segmentsFor(shape, p0, p1),
                fill: filled ? { color: fill.color, opacity: fill.alpha } : null,
                stroke: {
                    paint: { color: stroke.color, opacity: stroke.alpha },
                    style: {
                        width: SHAPE_STROKE_WIDTH,
                        lineCap: "butt",
                        lineJoin: "miter",
                        miterLimit: 10,
                        dashArray: null,
                        dashOffset: 0,
                    },
                },
            },
        ],
    };
}

/** A quarter turn's cosine and sine, by quarter turns clockwise. */
const QUARTER_TURNS: readonly (readonly [number, number])[] = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
];

/**
 * The model `GraphicsObject` for a new text box: one show op of
 * {@link TEXT_BOX_PLACEHOLDER}, its first line's baseline a font size below `at`
 * (page-local document points), its baseline running along `(cos, sin)`. Under
 * its minted `id`, so the placeholder can be selected straight after the insert.
 */
function textBoxObject(id: string, font: string, at: ShapePoint, cos: number, sin: number): unknown {
    return {
        id,
        transform: { scaleX: cos, skewY: sin, skewX: -sin, scaleY: cos, translateX: at.x, translateY: at.y },
        clips: [],
        optionalContent: [],
        content: {
            text: {
                runs: [
                    {
                        regular: {
                            textStyle: {
                                font,
                                fontSize: TEXT_BOX_SIZE,
                                charSpacing: 0,
                                wordSpacing: 0,
                                horizontalScaling: 100,
                                leading: 0,
                                rise: 0,
                                renderMode: "fill",
                                knockout: true,
                            },
                            nonstrokingStyle: {
                                brush: { solid: { components: [0], colorSpace: "deviceGray" } },
                                alpha: 1,
                                overprint: false,
                            },
                            strokingStyle: {
                                brush: { solid: { components: [0], colorSpace: "deviceGray" } },
                                alpha: 1,
                                overprint: false,
                                line: {
                                    width: 1,
                                    lineCap: "butt",
                                    lineJoin: "miter",
                                    miterLimit: 10,
                                    dashArray: null,
                                    dashOffset: 0,
                                },
                            },
                            renderStyle: {
                                blendMode: "normal",
                                alphaIsShape: false,
                                overprintMode: "default",
                                renderingIntent: "relativeColorimetric",
                            },
                            softMask: null,
                            chunks: [{ text: [...TEXT_BOX_PLACEHOLDER].map((char) => char.charCodeAt(0)) }],
                            textMatrix: {
                                scaleX: 1,
                                skewY: 0,
                                skewX: 0,
                                scaleY: 1,
                                translateX: 0,
                                translateY: TEXT_BOX_SIZE,
                            },
                            markedContent: null,
                        },
                    },
                ],
            },
        },
    };
}

/** Each shell's text box font, and the open document it was minted for. */
const textBoxFonts = new WeakMap<EditHost, { generation: number; id: string }>();

/**
 * The font list's id for {@link TEXT_BOX_FONT}, added under an id minted once per
 * document — an undo step of its own the first time, and again after that step is
 * undone. Its own, not a Helvetica the document holds: the engine composes text
 * only in a font it has loaded, and that one may be on a page it hasn't. Null with
 * no ids to mint.
 */
async function textBoxFont(host: EditHost): Promise<string | null> {
    const generation = host.store.getState().docGeneration;
    const known = textBoxFonts.get(host);
    const id = known?.generation === generation ? known.id : await host.client.mintId();
    if (id === null) return null;
    textBoxFonts.set(host, { generation, id });
    await host.commit(() => host.client.execute({ portable: { addStandardFont: { id, font: TEXT_BOX_FONT } } }));
    return id;
}

/**
 * Put a text box on page `page` — `pageId` — on top of the page, flowing in the
 * box from `p0` to `p1`, with its placeholder selected to be typed over. A page
 * shown turned has the text turned back, so it reads upright on screen, from the
 * box's top left there. Its insert and its frame are two undo steps: the engine
 * takes a frame only on a box already on the page.
 */
async function placeTextBox(
    host: EditHost,
    page: number,
    pageId: string,
    p0: ShapePoint,
    p1: ShapePoint,
): Promise<void> {
    const [font, id] = await Promise.all([textBoxFont(host), host.client.mintId()]);
    if (font === null || id === null) return;
    const [cos, sin] = QUARTER_TURNS[(4 - (host.pageView(page)?.view.rotation ?? 0)) % 4]!;
    // The box in the text's own axes, which a frame is given in: x along its
    // baseline, y down its lines.
    const xs = [p0, p1].map((p) => p.x * cos + p.y * sin);
    const ys = [p0, p1].map((p) => p.y * cos - p.x * sin);
    const frame = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
    const at = { x: frame.x0 * cos - frame.y0 * sin, y: frame.x0 * sin + frame.y0 * cos };
    const start = { object: id, run: 0, offset: 0 };
    await host.commit(() =>
        host.client.execute(EditCommand.insertObjects(pageId, [textBoxObject(id, font, at, cos, sin)])),
    );
    await host.commit(() => host.client.execute(EditCommand.resizeTextBox(pageId, start, frame)));
    const end = { ...start, offset: TEXT_BOX_PLACEHOLDER.length };
    host.client.setSelection({ portable: { objectText: { page: pageId, anchor: start, focus: end } } });
}

/** What a place `tool` drags out: a line or a box of a gallery shape, a PDF
 *  shape's own, or a text box's rectangle, which is its sketch too. */
export function placedShape(tool: string): ShapeKind | null {
    if (tool === TEXT_BOX_TOOL) return "rectangle";
    const shape = galleryShape(tool);
    if (shape) return shape.line ? "line" : "rectangle";
    return PORTABLE_SHAPES.has(tool) ? (tool as ShapeKind) : null;
}

/**
 * What placing `tool` from `p0` to `p1` on page `page` would draw, while it is
 * dragged out: a PDF's shape as it is drawn here, or the node a gallery shape
 * places, as the engine would paint it. Null, at once, for a text box, which has
 * nothing to show by, and for a tool not the document's.
 */
export function placePreview(
    host: EditHost,
    memory: PaintMemory,
    tool: string,
    page: number,
    p0: ShapePoint,
    p1: ShapePoint,
): Promise<ShapePreview | null> | null {
    const state = host.store.getState();
    if (state.status !== "ready" || tool === TEXT_BOX_TOOL) return null;
    if (state.docType === "portable") {
        return PORTABLE_SHAPES.has(tool)
            ? Promise.resolve(shapeObjectPreview(memory, tool as ShapeKind, p0, p1))
            : null;
    }
    const shape = galleryShape(tool);
    if (!shape) return null;
    if (state.docType === "image") return markupPreview(host, memory, shape, page, p0, p1);
    if (state.docType !== "presentation") return null;
    const node = slideShape(PREVIEW_NODE_ID, PREVIEW_STORY_ID, shape, p0, p1, slidePaint(memory, shape));
    return host.edit.shapePreview(page, node);
}

/** What was last specified for a new `shape` on a slide, over its style: a scheme
 *  color stays one, as a deck has a theme to resolve it. */
function slidePaint(memory: PaintMemory, shape: GalleryShape): SlideShapePaint {
    const colors = slideShapeColors(shape);
    return {
        fill: specifiedPaint(memory, "fill", true, colors.fill),
        line: specifiedPaint(memory, "stroke", true, colors.line),
    };
}

/** Place `tool` on page `page`, spanning the page-local points `p0 → p1`, on
 *  top of the page: on a PDF, a shape as a page object — the engine mints its
 *  id and selects it — or a text box with its text selected; on a deck, a gallery
 *  shape or a text box on the slide, and on an image, either drawn over it. A no-op
 *  for a page with no id (no document, or none of these), or a tool not the
 *  document's. */
export async function place(
    host: EditHost,
    memory: PaintMemory,
    tool: string,
    page: number,
    p0: ShapePoint,
    p1: ShapePoint,
): Promise<void> {
    const state = host.store.getState();
    if (state.status !== "ready") return;
    if (state.docType === "portable") {
        if (tool !== TEXT_BOX_TOOL && !PORTABLE_SHAPES.has(tool)) return;
        const pageId = await host.client.portable.pageIdByIndex(page);
        if (pageId === undefined) return;
        if (tool === TEXT_BOX_TOOL) return placeTextBox(host, page, pageId, p0, p1);
        const object = shapeObject(memory, tool as ShapeKind, p0, p1);
        await host.commit(() => host.client.execute(EditCommand.insertObjects(pageId, [object])));
        return;
    }
    if (tool === TEXT_BOX_TOOL) {
        if (state.docType === "presentation") return placeSlideTextBox(host, page, p0, p1);
        if (state.docType === "image") return placeMarkupTextBox(host, TEXT_BOX_PLACEHOLDER, page, p0, p1);
        return;
    }
    const shape = galleryShape(tool);
    if (!shape) return;
    if (state.docType === "image") return placeMarkup(host, memory, shape, page, p0, p1);
    if (state.docType === "presentation") return placeSlideShape(host, memory, shape, page, p0, p1);
}

/**
 * Put `shape` on the deck's slide `page` from `p0` to `p1` — the slide's own
 * points — on top of the slide, and select it. One committing edit. A no-op
 * past the last slide.
 */
async function placeSlideShape(
    host: EditHost,
    memory: PaintMemory,
    shape: GalleryShape,
    page: number,
    p0: ShapePoint,
    p1: ShapePoint,
): Promise<void> {
    const [slide, id, story] = await Promise.all([host.edit.slideId(page), host.client.mintId(), host.client.mintId()]);
    if (!slide || !id || !story) return;
    const container = { slide };
    const node = slideShape(id, story, shape, p0, p1, slidePaint(memory, shape));
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

/**
 * Put a text box on the deck's slide `page` from `p0` to `p1` — the slide's own
 * points — on top of the slide, with its text selected to be typed over. One
 * committing edit. A no-op past the last slide.
 */
async function placeSlideTextBox(host: EditHost, page: number, p0: ShapePoint, p1: ShapePoint): Promise<void> {
    const [slide, id, story] = await Promise.all([host.edit.slideId(page), host.client.mintId(), host.client.mintId()]);
    if (!slide || !id || !story) return;
    const container = { slide };
    const node = slideTextBox(id, story, TEXT_BOX_PLACEHOLDER, p0, p1);
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
    const range = { story, anchor: 0, focus: TEXT_BOX_PLACEHOLDER.length };
    host.client.setSelection({
        presentation: { shapes: { container, selection: { shapeText: [id, { range }] } } },
    });
}

/** Insert the image file `bytes` as a picture on the current slide or page,
 *  centred and scaled down to fit, then selected — a committing edit, so the picture's
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

/** Whether what goes on a deck's slide has one to go on: a slide shown, so not a
 *  notes page or the Slide Master view, nor a deck with no slides left. */
function onSlide(c: CommandContext): boolean {
    return c.ready && c.docType === "presentation" && c.presentationView === "normal" && c.pageCount > 0;
}

/** Whether what is drawn over an image has a page to go on: the current one, unless
 *  it's animated or a vector, and not while it's cropped. */
function overImage(c: CommandContext): boolean {
    return c.ready && c.docType === "image" && editStateOf(c).pageTakesMarkup && editStateOf(c).cropping === null;
}

/** The commands that put things on a page or a slide. Image asks for its file
 *  with `pickImage` — live on a deck's slides, which it inserts onto: not on
 *  its notes pages, where its Text Box and Shapes are grey too. A PDF's Text Box
 *  and Shapes place page objects, and its Image puts one on the current page. */
export function insertCommands(pickImage: () => void): Readonly<Record<string, CommandDef<MessageKey>>> {
    return {
        insertImage: {
            id: "insertImage",
            label: "command.insertImage",
            icon: ICON_IMAGE,
            group: "insert",
            run: { kind: "action", press: pickImage },
            enabledWhen: onSlide,
        },
        insertPageImage: {
            id: "insertPageImage",
            label: "command.insertImage",
            icon: ICON_IMAGE,
            group: "insert",
            run: { kind: "action", press: pickImage },
            enabledWhen: (c) => c.ready && c.docType === "portable",
        },
        insertTextBox: {
            id: "insertTextBox",
            label: "command.annotateTextBox",
            icon: ICON_SUBTOOL_TEXTBOX,
            group: "insert",
            run: { kind: "arm", tool: { kind: "extension", tool: TEXT_BOX_TOOL } },
            enabledWhen: (c) => (c.ready && c.docType === "portable") || onSlide(c) || overImage(c),
        },
        insertShape: {
            id: "insertShape",
            label: "command.insertShape",
            icon: ICON_SHAPES,
            group: "insert",
            run: { kind: "armPicker", options: SHAPE_OPTIONS },
            enabledWhen: (c) => c.ready && c.docType === "portable",
        },
        insertGalleryShape: {
            id: "insertGalleryShape",
            label: "command.insertShape",
            icon: ICON_SHAPES,
            group: "insert",
            run: { kind: "armGallery", sections: SHAPE_GALLERY },
            enabledWhen: (c) => onSlide(c) || overImage(c),
        },
    };
}
