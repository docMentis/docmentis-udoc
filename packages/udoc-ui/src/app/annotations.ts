// Build and restyle the model `Annotation`s the Annotate tab draws.
//
// Like `shapes.ts` for an Insert-tab shape, the drawing lives in the host: the
// canvas maps the gesture into page-local document points, and this module
// turns them into the annotation the Rust model's serde expects. The shell drops
// it into an `InsertAnnotations` command, which mints its id and generates its
// appearance from these entries — so the annotation carries neither.
//
// A restyle works the same way round: the shell reads the selected annotations,
// this module changes the entries a Format control edits and drops the
// appearance, and the shell sends them back in an `UpdateAnnotations` command,
// which generates the appearance afresh.

import type {
    Annotation,
    AnnotationBorderStyle,
    AnnotationKind,
    AnnotationLineEnding,
    AnnotationLineEndings,
    AnnotationMarkup,
    Color,
    DefaultAppearance,
    Rect,
    StampIcon,
    StandardFont,
    TextAnnotation,
} from "@docmentis/udoc-wasm";
import type { PaintDisplay, SelectionQuad } from "../geometry.js";
import type { PageComments } from "../worker/protocol.js";
import type { LineDash, PaintSpec } from "./components/PaintPanel.js";
import type { AnnotationTool, UIState, MarkupTool } from "./state.js";
import type { ShapePoint } from "./shapes.js";

/** How an annotation tool draws: the entries its appearance is generated from. */
export interface AnnotationStyle {
    /** `/C` — the colour of the line, or none. */
    color: Color | null;
    /** `/IC` — the fill of a closed shape, or none. */
    interiorColor: Color | null;
    /** `/BS` — the line's width and dash. */
    borderStyle: AnnotationBorderStyle;
    /** `/CA` — the opacity everything paints with, `0` to `1`. */
    opacity: number;
    /** `/LE` — a line's or a polyline's ends, or none. */
    lineEndings: AnnotationLineEndings | null;
}

/** The styles the Format controls have set, per tool; a tool not in it draws
 *  with its {@link defaultStyle}. */
export type AnnotationStyles = Partial<Record<AnnotationTool, AnnotationStyle>>;

const BLACK: Color = { components: [0], colorSpace: "deviceGray" };
const RED: Color = { components: [1, 0, 0], colorSpace: "deviceRgb" };
const YELLOW: Color = { components: [1, 1, 0], colorSpace: "deviceRgb" };

/** What `tool` draws with until the Format controls set otherwise: red — a
 *  highlight or a note yellow — two points wide, solid and opaque, unfilled;
 *  an arrow with an open arrowhead at its end. */
function defaultStyle(tool: AnnotationTool): AnnotationStyle {
    return {
        color: tool === "highlight" || tool === "note" ? YELLOW : RED,
        interiorColor: null,
        borderStyle: { width: 2, style: "solid", dash: null },
        opacity: 1,
        lineEndings: tool === "arrow" ? { start: "none", end: "openArrow" } : null,
    };
}

/** The style `tool` draws with: what the Format controls set for it, or its
 *  default. */
export function annotationStyle(tool: AnnotationTool, styles: AnnotationStyles): AnnotationStyle {
    return styles[tool] ?? defaultStyle(tool);
}

/** `/BE /I` of a cloud, the most the spec allows: at four points of scallop
 *  radius per unit, less reads as a wavy line rather than a cloud. */
const CLOUD_INTENSITY = 2;
/** A cloud's scallop radius per unit of `/BE /I` — the appearance generator's. */
const CLOUD_RADIUS_PER_INTENSITY = 4;
/** The miter limit the appearance generator strokes with. */
const MITER_LIMIT = 10;
/** Room left past the ink on every side, so antialiasing isn't clipped by the
 *  rect the appearance is fitted to. */
const MARGIN = 1;
/** The side of a note's square, which the appearance generator draws the
 *  note's icon to fill. */
const NOTE_SIZE = 16;
/** The standard font a text box's text is set in — the shell finds it in the
 *  document's font list, or adds it — and its size. */
export const TEXT_BOX_FONT: StandardFont = "helvetica";
const TEXT_BOX_SIZE = 12;
/** A stamp's width and height; the appearance generator sizes its label to
 *  fill them. */
const STAMP_WIDTH = 180;
const STAMP_HEIGHT = 50;

/**
 * The model `Annotation` for `tool` drawn through `points` (page-local document
 * points) in `style`, or null when they draw nothing: a box with no area, a
 * line with no length, a polygon of fewer than three corners, a polyline of
 * fewer than two.
 *
 * - `note`: a square centred on the first point, a `Text` with the Note icon
 *   and no text yet;
 * - `textBox`: the box of the first two points, a `FreeText` with no text
 *   yet, its text set in `font` — the font list's id for {@link TEXT_BOX_FONT}
 *   — in `style`'s colour; null without `font`;
 * - `stamp`: a box centred on the first point, a `Stamp` of `stamp`'s name;
 * - `pen`: the stroke's points, an `Ink`;
 * - `rectangle` / `ellipse`: the box of the first two points, a `Square` /
 *   `Circle`;
 * - `line` / `arrow`: from the first point to the second, a `Line`;
 * - `polygon` / `polyline` / `cloud`: the corners, a `Polygon` / `PolyLine` —
 *   a cloud a polygon whose border scallops outward.
 *
 * The rect is what the appearance is clipped to, so it takes in the line's
 * width, its joins and its line endings ({@link inkRect}). `author` is `/T`,
 * `now` both its creation and its modification date. It carries the Print
 * flag, as a comment does.
 */
export function annotationFor(
    tool: AnnotationTool,
    points: readonly ShapePoint[],
    style: AnnotationStyle,
    author: string | null,
    now: Date,
    stamp: StampIcon = "draft",
    font: string | null = null,
): Annotation | null {
    const width = style.borderStyle.width;
    const markup = markupEntries(style, author, now);
    const ends = style.lineEndings;
    // A square or a circle is drawn inside its box; the rest ink around their
    // points, and their rect is what that ink takes.
    let box: Rect | null = null;
    let kind: AnnotationKind;
    switch (tool) {
        case "highlight":
        case "underline":
        case "strikeOut":
        case "squiggly":
            // A markup is made from the text it marks, not from points.
            return null;
        case "note": {
            const [at] = points;
            if (!at) return null;
            const half = NOTE_SIZE / 2;
            box = { x0: at.x - half, y0: at.y - half, x1: at.x + half, y1: at.y + half };
            kind = { text: { markup, open: null, icon: "note", state: null, stateModel: null } };
            break;
        }
        case "textBox": {
            const [p0, p1] = points;
            if (!p0 || !p1 || !font) return null;
            box = bounds([p0, p1], 0);
            if (box.x1 - box.x0 <= 0 || box.y1 - box.y0 <= 0) return null;
            kind = {
                freeText: {
                    markup,
                    defaultAppearance: textBoxAppearance(font, style.color),
                    justification: null,
                    defaultStyle: null,
                    calloutLine: null,
                    lineEnding: null,
                    borderEffect: null,
                    rectDifferences: null,
                },
            };
            break;
        }
        case "stamp": {
            const [at] = points;
            if (!at) return null;
            box = {
                x0: at.x - STAMP_WIDTH / 2,
                y0: at.y - STAMP_HEIGHT / 2,
                x1: at.x + STAMP_WIDTH / 2,
                y1: at.y + STAMP_HEIGHT / 2,
            };
            kind = { stamp: { markup, icon: stamp } };
            break;
        }
        case "pen": {
            if (points.length === 0) return null;
            kind = { ink: { markup, inkList: [points.map(point)] } };
            break;
        }
        case "rectangle":
        case "ellipse": {
            const [p0, p1] = points;
            if (!p0 || !p1) return null;
            box = bounds([p0, p1], 0);
            if (box.x1 - box.x0 <= 0 || box.y1 - box.y0 <= 0) return null;
            const shape = { markup, interiorColor: style.interiorColor, borderEffect: null, rectDifferences: null };
            kind = tool === "rectangle" ? { square: shape } : { circle: shape };
            break;
        }
        case "line":
        case "arrow": {
            const [p0, p1] = points;
            if (!p0 || !p1 || (p0.x === p1.x && p0.y === p1.y)) return null;
            kind = {
                line: {
                    markup: { ...markup, intent: tool === "arrow" ? "lineArrow" : null },
                    line: [point(p0), point(p1)],
                    lineEndings: ends,
                    interiorColor: style.interiorColor,
                    leaderLength: null,
                    leaderExtension: null,
                    leaderOffset: null,
                    caption: null,
                    captionPosition: null,
                    captionOffset: null,
                },
            };
            break;
        }
        case "polygon":
        case "cloud": {
            if (points.length < 3) return null;
            const cloud = tool === "cloud";
            kind = {
                polygon: {
                    markup: { ...markup, intent: cloud ? "polygonCloud" : null },
                    vertices: points.map(point),
                    interiorColor: style.interiorColor,
                    borderEffect: cloud ? { cloudy: true, intensity: CLOUD_INTENSITY } : null,
                },
            };
            break;
        }
        case "polyline": {
            if (points.length < 2) return null;
            kind = {
                polyLine: {
                    markup,
                    vertices: points.map(point),
                    lineEndings: ends,
                    interiorColor: style.interiorColor,
                    borderEffect: null,
                },
            };
            break;
        }
    }
    const rect = box ?? inkRect(kind, width);
    if (!rect) return null;
    return commented(rect, style, kind, now);
}

/**
 * The model `Annotation` marking the text `quads` cover on one page — the
 * text selection's highlight quads, one per run it crosses — with `tool`: a
 * `Highlight`, `Underline`, `StrikeOut` or `Squiggly` over them, in `style`'s
 * colour and opacity. Null for no quads. Each quad's corners give its
 * quadrilateral in the order Acrobat writes: the upper edge, then the lower,
 * each from the text's start. The rect takes in the highlight's rounded ends,
 * which bulge a quarter of the text's height past them.
 */
export function markupFor(
    tool: MarkupTool,
    quads: readonly SelectionQuad[],
    style: AnnotationStyle,
    author: string | null,
    now: Date,
): Annotation | null {
    if (quads.length === 0) return null;
    const quadPoints = quads.map(
        ({ points: [topLeft, topRight, bottomRight, bottomLeft] }): Quad => [
            topLeft,
            topRight,
            bottomLeft,
            bottomRight,
        ],
    );
    const height = Math.max(
        ...quadPoints.map(([upperLeft, , lowerLeft]) =>
            Math.hypot(lowerLeft.x - upperLeft.x, lowerLeft.y - upperLeft.y),
        ),
    );
    const markup = { markup: markupEntries(style, author, now), quadPoints };
    const kind: AnnotationKind =
        tool === "highlight"
            ? { highlight: markup }
            : tool === "underline"
              ? { underline: markup }
              : tool === "strikeOut"
                ? { strikeOut: markup }
                : { squiggly: markup };
    return commented(bounds(quadPoints.flat(), height / 4 + MARGIN), style, kind, now);
}

/** A quadrilateral of `/QuadPoints`: four corners. */
type Quad = [ShapePoint, ShapePoint, ShapePoint, ShapePoint];

/** A text box's `/DA`: its text in `font` at {@link TEXT_BOX_SIZE}, filled
 *  with `color` — black for none — and everything else as the graphics state
 *  starts. */
function textBoxAppearance(font: string, color: Color | null): DefaultAppearance {
    return {
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
        nonstrokingStyle: { brush: { solid: color ?? BLACK }, alpha: 1, overprint: false },
        strokingStyle: {
            brush: { solid: BLACK },
            alpha: 1,
            overprint: false,
            line: {
                width: 1,
                lineCap: "butt",
                lineJoin: "miter",
                miterLimit: MITER_LIMIT,
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
        linear: null,
    };
}

/** The markup entries (Table 170) of one made now by `author` in `style`: its
 *  opacity, left out when opaque, and its creation date. */
function markupEntries(style: AnnotationStyle, author: string | null, now: Date): AnnotationMarkup {
    return {
        author,
        opacity: style.opacity < 1 ? style.opacity : null,
        subject: null,
        richContents: null,
        replyType: null,
        intent: null,
        created: pdfDate(now),
        popup: null,
        inReplyTo: null,
    };
}

/** The annotation `kind` makes in `rect`, drawn in `style` — its colour and its
 *  line, each when its subtype is drawn in one (see {@link DRAWS}); its
 *  subtype's own entries carry the rest — modified `now`, with the Print flag a
 *  comment carries, and no id or appearance: the insert mints the one and
 *  generates the other. */
function commented(rect: Rect, style: AnnotationStyle, kind: AnnotationKind, now: Date): Annotation {
    return {
        rect,
        contents: null,
        name: null,
        modified: pdfDate(now),
        flags: {
            invisible: false,
            hidden: false,
            print: true,
            noZoom: false,
            noRotate: false,
            noView: false,
            readOnly: false,
            locked: false,
            toggleNoView: false,
            lockedContents: false,
        },
        // `/C`: a free text's is its fill, not the colour its tool draws in —
        // that is its `/DA`'s.
        color: TAKES.color.has(subtypeOf(kind)) ? style.color : null,
        border: null,
        borderStyle: DRAWS.width.has(subtypeOf(kind)) ? style.borderStyle : null,
        appearance: null,
        optionalContent: null,
        kind,
    };
}

// -- restyling ---------------------------------------------------------------

/** One edit a Format control makes — to the selected annotations, or to the
 *  armed tool's style. */
export type AnnotationStyleChange =
    | { kind: "color"; color: Color | null }
    | { kind: "fill"; color: Color | null }
    | { kind: "width"; width: number }
    | { kind: "dash"; dash: LineDash }
    | { kind: "opacity"; opacity: number }
    | { kind: "lineEnding"; end: "start" | "end"; ending: AnnotationLineEnding };

/** The subtypes whose generated appearance each change reaches: the colour of
 *  what every drawn, marked, iconed or stamped one paints; the fill of a
 *  closed shape; the line of a drawn one; a markup annotation's opacity; a
 *  line's ends. */
const COLORED: AnnotationSubtype[] = [
    "ink",
    "square",
    "circle",
    "line",
    "polygon",
    "polyLine",
    "highlight",
    "underline",
    "squiggly",
    "strikeOut",
    "caret",
    "text",
    "fileAttachment",
    "sound",
    "stamp",
];
const LINED: AnnotationSubtype[] = ["ink", "square", "circle", "line", "polygon", "polyLine"];
const TAKES: Record<AnnotationStyleChange["kind"], ReadonlySet<AnnotationSubtype>> = {
    color: new Set(COLORED),
    fill: new Set(["square", "circle", "polygon"]),
    width: new Set(LINED),
    dash: new Set(LINED),
    opacity: new Set(COLORED),
    lineEnding: new Set(["line", "polyLine"]),
};

/** The subtypes each part of a tool's style reaches in what it draws: those a
 *  restyle reaches ({@link TAKES}), and a text box's colour and line besides —
 *  its `/DA` colour, which its text and border are drawn in, and its `/BS`. A
 *  restyle doesn't reach a drawn free text: the engine reads its shape from its
 *  entries once, on insert, and a restyle sends that shape back. */
const DRAWS: Record<AnnotationStyleChange["kind"], ReadonlySet<AnnotationSubtype>> = {
    ...TAKES,
    color: new Set([...COLORED, "freeText"]),
    width: new Set([...LINED, "freeText"]),
    dash: new Set([...LINED, "freeText"]),
};

/** The subtype each tool makes. */
const TOOL_SUBTYPE: Record<AnnotationTool, AnnotationSubtype> = {
    highlight: "highlight",
    underline: "underline",
    strikeOut: "strikeOut",
    squiggly: "squiggly",
    note: "text",
    textBox: "freeText",
    stamp: "stamp",
    pen: "ink",
    rectangle: "square",
    ellipse: "circle",
    line: "line",
    arrow: "line",
    polygon: "polygon",
    polyline: "polyLine",
    cloud: "polygon",
};

/** An annotation's subtype — the tag of its {@link AnnotationKind}: a unit
 *  variant's string, or a payload variant's one key. */
export type AnnotationSubtype = TagOf<AnnotationKind>;
type TagOf<K> = K extends string ? K : keyof K;

/** An annotation's subtype — its kind's tag. */
export function subtypeOf(kind: AnnotationKind): AnnotationSubtype {
    return typeof kind === "string" ? kind : (Object.keys(kind)[0] as AnnotationSubtype);
}

/** A markup annotation's markup entries (Table 170); null for one that isn't. */
export function markupOf(annotation: Annotation): AnnotationMarkup | null {
    return (entriesOf(annotation.kind)?.markup as AnnotationMarkup | undefined) ?? null;
}

/** The subtype's own entries — the object under its kind's tag. */
function entriesOf(kind: AnnotationKind): Record<string, unknown> | null {
    return typeof kind === "string" ? null : (Object.values(kind)[0] as Record<string, unknown>);
}

/** `/BS` for a line `width` points wide, dashed as `dash` — the dash array in
 *  multiples of the width, as the Object tab's stroke has it, so it reads the same
 *  at any weight. */
function borderStyle(width: number, dash: LineDash): AnnotationBorderStyle {
    const w = width || 1;
    switch (dash) {
        case "solid":
            return { width, style: "solid", dash: null };
        case "dash":
            return { width, style: "dashed", dash: [3 * w, 3 * w] };
        case "dot":
            return { width, style: "dashed", dash: [w, 2 * w] };
        case "dashDot":
            return { width, style: "dashed", dash: [3 * w, 2 * w, w, 2 * w] };
    }
}

/** An annotation's line: `/BS`, else `/Border`, else the solid one-point line
 *  the generator draws with. */
function lineOf(annotation: Annotation): { width: number; dash: LineDash } {
    const style = annotation.borderStyle;
    if (style) {
        const dash = style.style === "dashed" ? dashOf(style.dash ?? [3], style.width) : "solid";
        return { width: style.width, dash };
    }
    const border = annotation.border;
    if (border) return { width: border.width, dash: border.dash ? dashOf(border.dash, border.width) : "solid" };
    return { width: 1, dash: "solid" };
}

/** Which of the offered dashes a dash array reads as, at `width`. */
function dashOf(array: readonly number[], width: number): LineDash {
    if (array.length >= 4) return "dashDot";
    return (array[0] ?? 0) <= 1.5 * (width || 1) ? "dot" : "dash";
}

/** `style` with `change` made. */
export function restyle(style: AnnotationStyle, change: AnnotationStyleChange): AnnotationStyle {
    switch (change.kind) {
        case "color":
            return { ...style, color: change.color };
        case "fill":
            return { ...style, interiorColor: change.color };
        case "width":
            return { ...style, borderStyle: borderStyle(change.width, lineOfStyle(style).dash) };
        case "dash":
            return { ...style, borderStyle: borderStyle(style.borderStyle.width, change.dash) };
        case "opacity":
            return { ...style, opacity: change.opacity };
        case "lineEnding":
            return { ...style, lineEndings: withEnding(style.lineEndings, change.end, change.ending) };
    }
}

/** A tool style's line, read as {@link lineOf} reads an annotation's. */
function lineOfStyle(style: AnnotationStyle): { width: number; dash: LineDash } {
    const { width, style: kind, dash } = style.borderStyle;
    return { width, dash: kind === "dashed" ? dashOf(dash ?? [3], width) : "solid" };
}

/** `endings` with its `end` ending set to `ending`. */
function withEnding(
    endings: AnnotationLineEndings | null,
    end: "start" | "end",
    ending: AnnotationLineEnding,
): AnnotationLineEndings {
    return { ...(endings ?? { start: "none", end: "none" }), [end]: ending };
}

/**
 * `annotation` with `change` made to the entry it edits, its appearance dropped
 * so the engine generates it afresh, and `now` as its modification date — or
 * null for one whose appearance the change doesn't reach (see {@link TAKES}),
 * which a restyle leaves as it is. Only that entry is written: changing a colour
 * doesn't turn a `/Border` into a `/BS`. A change to how far the ink reaches — a
 * line's width, its endings — fits the rect of one drawn around its points to
 * the new ink ({@link inkRect}), which the appearance would otherwise be clipped
 * to.
 */
export function restyled(annotation: Annotation, change: AnnotationStyleChange, now: Date): Annotation | null {
    if (!TAKES[change.kind].has(subtypeOf(annotation.kind))) return null;
    const next: Annotation = structuredClone(annotation);
    const entries = entriesOf(next.kind)!;
    switch (change.kind) {
        case "color":
            next.color = change.color;
            break;
        case "fill":
            entries.interiorColor = change.color;
            break;
        case "width":
            next.borderStyle = borderStyle(change.width, lineOf(annotation).dash);
            break;
        case "dash":
            next.borderStyle = borderStyle(lineOf(annotation).width, change.dash);
            break;
        case "opacity":
            (entries.markup as AnnotationMarkup).opacity = change.opacity < 1 ? change.opacity : null;
            break;
        case "lineEnding":
            entries.lineEndings = withEnding(
                entries.lineEndings as AnnotationLineEndings | null,
                change.end,
                change.ending,
            );
            break;
    }
    if (change.kind === "width" || change.kind === "lineEnding") {
        next.rect = inkRect(next.kind, lineOf(next).width) ?? next.rect;
    }
    next.appearance = null;
    next.modified = pdfDate(now);
    return next;
}

// -- a comment's text --------------------------------------------------------

/** The one annotation selected, and its page — by key, as an edit names it, and
 *  by index, as the view does; null for none, or for several. What the
 *  annotation bar acts on. */
export function selectedAnnotation(state: UIState): { page: string; index: number; annotation: Annotation } | null {
    const selected = state.selectedAnnotations;
    const [annotation, ...rest] = selected?.annotations ?? [];
    if (!selected || !annotation || rest.length > 0) return null;
    return { page: selected.page, index: selected.index, annotation };
}

/** A comment — a markup annotation (§12.5.6.2), the kinds Acrobat lists as
 *  comments — with its page, its text, what its reviewers last set on it, and
 *  the replies that answer it. */
export interface Comment {
    page: string;
    index: number;
    annotation: Annotation;
    /** Its rich contents: XHTML, `/RC` or its `/Contents`. */
    richContents: string;
    /** The state each author last set on it in the Review model, but `None`. */
    reviews: CommentReview[];
    /** Whether an author last set it Marked, in the Marked model. */
    marked: boolean;
    /** The replies that answer it (`/IRT`, `/RT /R`), oldest first, each with
     *  its own. */
    replies: Comment[];
}

/** A state an author set on a comment (§12.5.6.3). */
export interface CommentReview {
    author: string;
    state: string;
}

/** The threads read from a page's comments, kept while the read is. */
const threadsRead = new WeakMap<PageComments, Comment[]>();

/**
 * The comment threads on `page`, in paint order — what Acrobat lists as the
 * page's comments (PDF 2.0 §12.5.6.2–3):
 *
 * - every markup annotation is a comment; a popup, a link, a widget isn't;
 * - a reply (`/IRT`, `/RT /R`) is in the thread of the comment it answers,
 *   oldest first, and not a thread of its own;
 * - a member of a group (`/RT /Group`) is its primary's, which stands for the
 *   group, so what answers it answers the primary;
 * - a state note — a text annotation setting `/State` in a `/StateModel` —
 *   sets that state on the comment it answers, or on the one the note it
 *   answers does: an author's further states answer their previous one, so
 *   the last of an author's chain is the state they set.
 *
 * A reply whose comment isn't on the page, or that would answer itself, is a
 * thread of its own.
 */
export function commentThreads(page: PageComments): Comment[] {
    const cached = threadsRead.get(page);
    if (cached) return cached;
    const at = new Map<string, number>();
    page.annotations.forEach((annotation, i) => {
        if (annotation.id !== undefined) at.set(annotation.id, i);
    });
    const comments = new Map<string, Comment>();
    page.annotations.forEach((annotation, i) => {
        if (annotation.id === undefined || roleOf(annotation) !== "comment") return;
        comments.set(annotation.id, {
            page: page.page,
            index: page.index,
            annotation,
            richContents: page.richContents[i] ?? "",
            reviews: [],
            marked: false,
            replies: [],
        });
    });
    // The comment `id` stands for — itself, its group's primary, the comment
    // a state note is set on — and how many state notes lie on the way; null
    // for none on the page. Bounded, as a file may loop its `/IRT`s.
    const owner = (id: string | null): { comment: Comment; states: number } | null => {
        let states = 0;
        for (let steps = 0; id !== null && steps <= page.annotations.length; steps++) {
            const i = at.get(id);
            const annotation = i === undefined ? undefined : page.annotations[i];
            if (!annotation) return null;
            const role = roleOf(annotation);
            if (role === "comment") return { comment: comments.get(id)!, states };
            if (role === "state") states++;
            id = markupOf(annotation)?.inReplyTo ?? null;
        }
        return null;
    };

    const threads: Comment[] = [];
    for (const comment of comments.values()) {
        const parent = owner(markupOf(comment.annotation)!.inReplyTo);
        if (parent && !answers(parent.comment, comment, owner)) parent.comment.replies.push(comment);
        else threads.push(comment);
    }
    for (const comment of comments.values()) comment.replies.sort(byCreation);

    // Each author's last state in each model, per comment: the deepest of
    // their chain, a later note breaking a tie.
    const last = new Map<Comment, Map<string, { depth: number; state: string }>>();
    for (const annotation of page.annotations) {
        const text = textEntries(annotation);
        if (roleOf(annotation) !== "state" || !text) continue;
        const target = owner(text.markup.inReplyTo);
        if (!target) continue;
        const key = `${text.stateModel}\u0000${text.markup.author ?? ""}`;
        const states = last.get(target.comment) ?? new Map<string, { depth: number; state: string }>();
        const depth = target.states;
        if ((states.get(key)?.depth ?? -1) <= depth) states.set(key, { depth, state: text.state ?? "" });
        last.set(target.comment, states);
    }
    for (const [comment, states] of last) {
        for (const [key, { state }] of states) {
            const [model, author] = key.split("\u0000") as [string, string];
            if (model === "Review" && state !== "None") comment.reviews.push({ author, state });
            if (model === "Marked" && state === "Marked") comment.marked = true;
        }
    }
    threadsRead.set(page, threads);
    return threads;
}

/** Whether `reply` answering `parent` would close a loop: `parent` is `reply`,
 *  or answers it at some depth. */
function answers(parent: Comment, reply: Comment, owner: (id: string | null) => { comment: Comment } | null): boolean {
    const seen = new Set<Comment>();
    for (let at: Comment | null = parent; at !== null && !seen.has(at); ) {
        if (at === reply) return true;
        seen.add(at);
        const irt: string | null = markupOf(at.annotation)?.inReplyTo ?? null;
        at = irt === null ? null : (owner(irt)?.comment ?? null);
    }
    return false;
}

/** What a markup annotation is in a thread: a comment of its own, a member of
 *  a group, or a state note; null for one that isn't a markup annotation. */
function roleOf(annotation: Annotation): "comment" | "member" | "state" | null {
    const markup = markupOf(annotation);
    if (!markup) return null;
    if (markup.inReplyTo === null) return "comment";
    if (markup.replyType === "group") return "member";
    const text = textEntries(annotation);
    return text && text.state !== null && text.stateModel !== null ? "state" : "comment";
}

/** A text annotation's own entries (Table 175); null for another subtype. */
function textEntries(annotation: Annotation): TextAnnotation | null {
    const kind = annotation.kind;
    return typeof kind === "object" && "text" in kind ? kind.text : null;
}

/** Oldest first, by `/CreationDate`; one without keeps its place. */
function byCreation(a: Comment, b: Comment): number {
    const made = (c: Comment) => parsePdfDate(markupOf(c.annotation)?.created ?? "")?.getTime() ?? NaN;
    const [ta, tb] = [made(a), made(b)];
    return Number.isNaN(ta) || Number.isNaN(tb) ? 0 : ta - tb;
}

/** The thread in `threads` that holds the annotation `id` — as a comment, a
 *  reply, a member of a group or a state note — or null. */
export function threadHolding(threads: readonly Comment[], page: PageComments, id: string): Comment | null {
    const holds = (comment: Comment): boolean => comment.annotation.id === id || comment.replies.some(holds);
    const own = threads.find(holds);
    if (own) return own;
    // A member or a state note stands for the comment it answers.
    const annotation = page.annotations.find((a) => a.id === id);
    const irt: string | null = annotation ? (markupOf(annotation)?.inReplyTo ?? null) : null;
    return irt ? threadHolding(threads, page, irt) : null;
}

/**
 * A reply to `parent`: a text annotation on its page that answers it (`/IRT`,
 * its reply type left to the default, `/R`), holding `richContents`, by
 * `author`, made and modified `now`. It takes `parent`'s rect and the Print,
 * NoZoom and NoRotate flags. A processor shows it in `parent`'s thread and not
 * on the page (§12.5.6.2); the insert narrows its text and generates the
 * appearance PDF 2.0 still asks of it. Null for a `parent` with no id yet.
 */
export function replyTo(parent: Annotation, richContents: string, author: string | null, now: Date): Annotation | null {
    if (parent.id === undefined) return null;
    return {
        rect: parent.rect,
        contents: null,
        name: null,
        modified: pdfDate(now),
        flags: {
            invisible: false,
            hidden: false,
            print: true,
            noZoom: true,
            noRotate: true,
            noView: false,
            readOnly: false,
            locked: false,
            toggleNoView: false,
            lockedContents: false,
        },
        color: null,
        border: null,
        borderStyle: null,
        appearance: null,
        optionalContent: null,
        kind: {
            text: {
                markup: {
                    author,
                    opacity: null,
                    subject: null,
                    richContents: richContents,
                    replyType: null,
                    intent: null,
                    created: pdfDate(now),
                    popup: null,
                    inReplyTo: parent.id,
                },
                open: null,
                icon: "comment",
                state: null,
                stateModel: null,
            },
        },
    };
}

/** The markup annotation the comment popup shows the thread of — the one
 *  selected, where the popup sits — and its page. */
export interface ShownComment {
    page: string;
    index: number;
    annotation: Annotation;
    /** The thread it is in, from its root: read from its page's comments, or
     *  it alone until they are. */
    thread: Comment;
}

/** The comment the popup can show the thread of: the one annotation selected,
 *  when it is a markup annotation (§12.5.6.2) other than a sound, which has no
 *  popup, and a free text, whose text is edited in its box; null otherwise. */
export function selectedComment(state: UIState): ShownComment | null {
    const selected = selectedAnnotation(state);
    if (
        !selected ||
        !markupOf(selected.annotation) ||
        subtypeOf(selected.annotation.kind) === "sound" ||
        editedInBox(selected.annotation)
    ) {
        return null;
    }
    const id = selected.annotation.id;
    const page = state.comments.get(selected.page);
    const thread = page && id !== undefined ? threadHolding(commentThreads(page), page, id) : null;
    return {
        ...selected,
        thread: thread ?? {
            ...selected,
            richContents: state.selectedAnnotations?.richContents[0] ?? "",
            reviews: [],
            marked: false,
            replies: [],
        },
    };
}

/** Whether `annotation` is a free text, whose text is edited in its box
 *  rather than in a comment popup. */
export function editedInBox(annotation: Annotation): boolean {
    return subtypeOf(annotation.kind) === "freeText";
}

/** Whether `comment`'s popup is open: as its comment button last set it while
 *  it has been selected — else open for a note, whose icon shows nothing of its
 *  text, and closed for the rest. */
export function commentOpen(state: UIState, comment: ShownComment): boolean {
    const set = state.commentPopup;
    if (set && set.id === comment.annotation.id) return set.open;
    return subtypeOf(comment.annotation.kind) === "text";
}

// -- what the Format controls show ------------------------------------------

/**
 * What the Annotate tab's Format controls show — the style of what they act on
 * ({@link formatTarget}). Each entry is present only when something there takes
 * it, and holds null where they disagree.
 */
export interface AnnotationFormat {
    color?: PaintDisplay;
    fill?: PaintDisplay;
    line?: { width: number | null; dash: LineDash | null };
    opacity?: number | null;
    lineEnds?: { start: AnnotationLineEnding | null; end: AnnotationLineEnding | null };
}

/** One styled thing the Format controls act on: its subtype and its style. */
interface Styled {
    subtype: AnnotationSubtype;
    color: Color | null;
    fill: Color | null;
    line: { width: number; dash: LineDash };
    opacity: number;
    ends: AnnotationLineEndings | null;
}

/**
 * What the Format controls act on in `state`: the armed annotation tool — its
 * style is what the next one drawn takes, so while drawing they set the pen, not
 * the stroke just drawn — else the selected annotations; null when there is
 * neither.
 */
export function formatTarget(
    state: UIState,
): { kind: "tool"; tool: AnnotationTool } | { kind: "selection"; page: string; annotations: Annotation[] } | null {
    if (state.pointerMode.kind === "place" && state.pointerMode.tool.kind === "annotation") {
        return { kind: "tool", tool: state.pointerMode.tool.tool };
    }
    const selected = state.selectedAnnotations;
    if (selected && selected.annotations.length > 0) {
        return { kind: "selection", page: selected.page, annotations: selected.annotations };
    }
    return null;
}

/** The format the controls show for `state` (see {@link AnnotationFormat}), or
 *  null when they act on nothing. */
export function annotationFormat(state: UIState): AnnotationFormat | null {
    const target = formatTarget(state);
    if (!target) return null;
    let targets: Styled[];
    if (target.kind === "selection") {
        targets = target.annotations.map((annotation) => {
            const entries = entriesOf(annotation.kind);
            const markup = entries?.markup as AnnotationMarkup | undefined;
            return {
                subtype: subtypeOf(annotation.kind),
                color: annotation.color,
                fill: (entries?.interiorColor as Color | null | undefined) ?? null,
                line: lineOf(annotation),
                opacity: markup?.opacity ?? 1,
                ends: (entries?.lineEndings as AnnotationLineEndings | null | undefined) ?? null,
            };
        });
    } else {
        const style = annotationStyle(target.tool, state.annotationStyles);
        targets = [
            {
                subtype: TOOL_SUBTYPE[target.tool],
                color: style.color,
                fill: style.interiorColor,
                line: lineOfStyle(style),
                opacity: style.opacity,
                ends: style.lineEndings,
            },
        ];
    }
    // An armed tool's style reaches what it draws; a selection, what a restyle
    // reaches.
    const takes = target.kind === "tool" ? DRAWS : TAKES;
    const taking = (kind: AnnotationStyleChange["kind"]) => targets.filter((t) => takes[kind].has(t.subtype));
    const format: AnnotationFormat = {};
    const colored = taking("color");
    if (colored.length > 0) format.color = colorDisplay(colored.map((t) => t.color));
    const filled = taking("fill");
    if (filled.length > 0) format.fill = colorDisplay(filled.map((t) => t.fill));
    const lined = taking("width");
    if (lined.length > 0) {
        format.line = {
            width: agree(lined.map((t) => t.line.width)),
            dash: agree(lined.map((t) => t.line.dash)),
        };
    }
    if (colored.length > 0) format.opacity = agree(colored.map((t) => t.opacity));
    const ended = taking("lineEnding");
    if (ended.length > 0) {
        format.lineEnds = {
            start: agree(ended.map((t) => t.ends?.start ?? "none")),
            end: agree(ended.map((t) => t.ends?.end ?? "none")),
        };
    }
    return format;
}

/** The value every one of `values` holds, or null when they disagree. */
function agree<T extends string | number>(values: readonly T[]): T | null {
    const [first] = values;
    return first !== undefined && values.every((v) => v === first) ? first : null;
}

/** The swatch colours `colors` show: the one they share (none for no colour),
 *  or mixed. */
function colorDisplay(colors: readonly (Color | null)[]): PaintDisplay {
    const hexes = colors.map((color) => (color ? colorHex(color) : null));
    const [first] = hexes;
    if (!hexes.every((hex) => hex === first)) return { kind: "mixed" };
    return first ? { kind: "solid", hex: first } : { kind: "none" };
}

/** A picked paint as an annotation colour: an sRGB pick as its device RGB
 *  components, "no colour" as none. (A PDF offers no theme colours.) */
export function paintColor(paint: PaintSpec): Color | null {
    if (paint.kind === "none") return null;
    const n = parseInt(paint.hex.replace("#", ""), 16);
    return {
        components: [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255],
        colorSpace: "deviceRgb",
    };
}

// -- geometry ---------------------------------------------------------------

/**
 * The rect the generated appearance of an annotation drawn around its points
 * inks, at a line `width` points wide: its points grown by half the width, its
 * mitered joins, its line endings' reach, a cloud's scallops. Null for a subtype
 * drawn inside its rect — a square, a circle, anything not drawn from points —
 * and for one with no points.
 */
function inkRect(kind: AnnotationKind, width: number): Rect | null {
    if (typeof kind === "string") return null;
    const ends = "line" in kind ? kind.line.lineEndings : "polyLine" in kind ? kind.polyLine.lineEndings : null;
    // A line ending reaches past the end it sits on: an arrowhead's wings run
    // nine line widths back from the tip at 30° either side — four and a half
    // across — and its mitered tip about two widths past the end; the other
    // endings are smaller.
    const endReach =
        ends && (ends.start !== "none" || ends.end !== "none") ? 4.5 * Math.max(width, 1) + 2 * width + MARGIN : 0;
    if ("ink" in kind) {
        const points = kind.ink.inkList.flat();
        return points.length > 0 ? bounds(points, width / 2 + MARGIN) : null;
    }
    if ("line" in kind) {
        const line = kind.line.line;
        return line ? bounds(line, Math.max(width / 2 + MARGIN, endReach)) : null;
    }
    if ("polygon" in kind) {
        const { vertices, borderEffect } = kind.polygon;
        if (vertices.length === 0) return null;
        // A cloud's scallops are arcs centred on its edges, so they bulge a
        // radius past the corners; a plain polygon reaches past them only at its
        // mitered joins.
        if (borderEffect?.cloudy) {
            return bounds(vertices, CLOUD_RADIUS_PER_INTENSITY * borderEffect.intensity + width / 2 + MARGIN);
        }
        return strokeBounds(vertices, true, width);
    }
    if ("polyLine" in kind) {
        const vertices = kind.polyLine.vertices;
        return vertices.length > 0 ? union(strokeBounds(vertices, false, width), bounds(vertices, endReach)) : null;
    }
    return null;
}

/** A copy of `p` holding only its coordinates. */
function point(p: ShapePoint): ShapePoint {
    return { x: p.x, y: p.y };
}

/** The box around `points`, grown by `pad` on every side. */
function bounds(points: readonly ShapePoint[], pad: number): Rect {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    return {
        x0: Math.min(...xs) - pad,
        y0: Math.min(...ys) - pad,
        x1: Math.max(...xs) + pad,
        y1: Math.max(...ys) + pad,
    };
}

/** The box around both `a` and `b`. */
function union(a: Rect, b: Rect): Rect {
    return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
}

/**
 * The box a line of `width` through `points` inks — closed back to the first
 * point when `closed` — with the generator's butt caps and mitered joins: half
 * the width on every side, and each join's miter tip where the miter limit
 * keeps it (a sharper join is bevelled, inside that half width).
 */
function strokeBounds(points: readonly ShapePoint[], closed: boolean, width: number): Rect {
    const half = width / 2;
    const tips: ShapePoint[] = [];
    const n = points.length;
    for (let i = 0; i < n; i++) {
        if (!closed && (i === 0 || i === n - 1)) continue;
        const at = points[i]!;
        const prev = unit(at, points[(i + n - 1) % n]!);
        const next = unit(at, points[(i + 1) % n]!);
        if (!prev || !next) continue;
        // The half-angle between the two segments sets the miter's length.
        const sinHalf = Math.sqrt(Math.max(0, (1 - (prev.x * next.x + prev.y * next.y)) / 2));
        if (sinHalf === 0 || 1 / sinHalf > MITER_LIMIT) continue;
        const out = unit({ x: 0, y: 0 }, { x: -(prev.x + next.x), y: -(prev.y + next.y) });
        if (!out) continue;
        tips.push({ x: at.x + (out.x * half) / sinHalf, y: at.y + (out.y * half) / sinHalf });
    }
    const inked = bounds(points, half);
    const reach = tips.length > 0 ? union(inked, bounds(tips, 0)) : inked;
    return { x0: reach.x0 - MARGIN, y0: reach.y0 - MARGIN, x1: reach.x1 + MARGIN, y1: reach.y1 + MARGIN };
}

/** The unit vector from `from` toward `to`, or null when they coincide. */
function unit(from: ShapePoint, to: ShapePoint): ShapePoint | null {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    return length > 0 ? { x: dx / length, y: dy / length } : null;
}

/** `now` as a PDF date string (§7.9.4): `D:YYYYMMDDHHmmSS` in local time and
 *  its offset from UT. */
export function pdfDate(now: Date): string {
    const two = (n: number) => String(n).padStart(2, "0");
    const offset = -now.getTimezoneOffset();
    const sign = offset < 0 ? "-" : "+";
    const minutes = Math.abs(offset);
    return (
        `D:${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}` +
        `${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}` +
        `${sign}${two(Math.floor(minutes / 60))}'${two(minutes % 60)}'`
    );
}

/** The PDF date string `text` (§7.9.4) as a `Date` — in local time when it
 *  gives no offset from UT, and reading the one-digit offset hours some writers
 *  give — or null when it doesn't read as one. */
export function parsePdfDate(text: string): Date | null {
    const match =
        /^(?:D:)?(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?(?:([Zz+-])(?:(\d{1,2})'?(\d{2})?'?)?)?$/.exec(
            text.trim(),
        );
    if (!match) return null;
    const [, y, mo = "01", d = "01", h = "00", mi = "00", sec = "00", sign, oh = "0", om = "0"] = match;
    const parts = [Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(sec)] as const;
    if (!sign) return new Date(...parts);
    const offset = sign === "Z" || sign === "z" ? 0 : (sign === "-" ? -1 : 1) * (Number(oh) * 60 + Number(om));
    return new Date(Date.UTC(...parts) - offset * 60_000);
}

/** `color` as an `#rrggbb` hex — the device colour spaces by their usual
 *  conversions — for a swatch, or for drawing an annotation as it is drawn. */
export function colorHex(color: Color): string {
    const c = color.components;
    let rgb: [number, number, number];
    switch (c.length) {
        case 1:
            rgb = [c[0]!, c[0]!, c[0]!];
            break;
        case 4: {
            const k = 1 - c[3]!;
            rgb = [(1 - c[0]!) * k, (1 - c[1]!) * k, (1 - c[2]!) * k];
            break;
        }
        default:
            rgb = [c[0] ?? 0, c[1] ?? 0, c[2] ?? 0];
    }
    const byte = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
    return `#${rgb.map((v) => byte(v).toString(16).padStart(2, "0")).join("")}`;
}
