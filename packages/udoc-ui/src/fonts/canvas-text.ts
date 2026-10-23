/**
 * Canvas fonts: the browser's own text stack, measuring and drawing a family
 * installed on the viewer's machine that no vendor serves.
 *
 * The engine asks synchronously — shaping asks mid-layout, painting mid-frame —
 * so every answer comes from an `OffscreenCanvas` in the worker the engine runs
 * in. The engine names a CSS `font` and a string; nothing here ever sees the
 * font's bytes, which the browser keeps to itself.
 *
 * One thing the text stack will not say is whether a glyph is the face's own: a
 * character the family lacks is drawn from whatever font the browser falls
 * back to, silently. So {@link createCanvasText} first loads a font of its
 * own whose every code point is one empty, zero-width glyph, and coverage
 * measures the character in the family **followed by that blank**: a character
 * the family has keeps its width, one it lacks lands on the blank and measures
 * nothing. A family the machine doesn't have at all covers nothing that way.
 */

import type { CanvasText } from "@docmentis/udoc-wasm";

/** The family the blank catch-all is loaded under, in the worker's own font set. */
const BLANK_FAMILY = "udoc-canvas-text-blank";

/** How large a surface {@link CanvasText.rasterize} draws into, per side — a
 *  backstop, well past any glyph the engine asks for. */
const MAX_RASTER = 4096;

/** The size a combining mark is drawn at to see whether it inks. */
const MARK_PROBE_PX = 64;

/** What a context's `font` is set to before every face, and reads back as
 *  when the face's own string did not parse. */
const UNSET_FONT = "1px sans-serif";

/** A combining mark: the one kind of character a face can draw while
 *  advancing nothing. */
const MARK = /^\p{M}$/u;

/**
 * Set `context`'s font to `font`, or say it isn't one: a 2D context ignores a
 * `font` it can't parse and keeps the one before, which would answer every
 * later question about the wrong face.
 */
function setFont(context: OffscreenCanvasRenderingContext2D, font: string): boolean {
    context.font = UNSET_FONT;
    const unset = context.font;
    context.font = font;
    return context.font !== unset;
}

interface WorkerFonts {
    fonts?: { add(face: FontFace): void };
}

/**
 * The browser's text stack as the engine's {@link CanvasText} — or `null` where
 * this browser can't give one: no `OffscreenCanvas`, no font set in workers,
 * or a blank font it refuses to load.
 */
export async function createCanvasText(): Promise<CanvasText | null> {
    const fonts = (self as unknown as WorkerFonts).fonts;
    if (typeof OffscreenCanvas === "undefined" || !fonts) return null;
    try {
        const blank = new FontFace(BLANK_FAMILY, blankFont());
        await blank.load();
        fonts.add(blank);
    } catch {
        return null;
    }

    const measuring = new OffscreenCanvas(1, 1).getContext("2d", { willReadFrequently: true });
    const drawing = new OffscreenCanvas(1, 1).getContext("2d", { willReadFrequently: true });
    if (!measuring || !drawing) return null;

    const measure = (font: string, text: string): number => {
        if (!setFont(measuring, font)) return 0;
        measuring.fontKerning = "normal";
        return measuring.measureText(text).width;
    };

    /** Whether `text` leaves any ink in `font`, drawn small. */
    const inks = (font: string, text: string): boolean => {
        drawing.canvas.width = MARK_PROBE_PX * 2;
        drawing.canvas.height = MARK_PROBE_PX * 2;
        if (!setFont(drawing, font)) return false;
        const scale = MARK_PROBE_PX / pixelSizeOf(font);
        drawing.setTransform(scale, 0, 0, scale, MARK_PROBE_PX / 2, MARK_PROBE_PX * 1.5);
        drawing.fillText(text, 0, 0);
        const data = drawing.getImageData(0, 0, drawing.canvas.width, drawing.canvas.height).data;
        for (let i = 3; i < data.length; i += 4) if (data[i]) return true;
        return false;
    };

    return {
        covers(font, character) {
            const withBlank = `${font}, "${BLANK_FAMILY}"`;
            if (measure(withBlank, character) > 0) return true;
            // A combining mark advances nothing either way: it is the face's
            // if it inks, since the blank never does. Anything else measuring
            // nothing landed on the blank.
            return MARK.test(character) && inks(withBlank, character);
        },

        metrics(font) {
            if (!setFont(measuring, font)) return null;
            const capital = measuring.measureText("H");
            const lower = measuring.measureText("x");
            return {
                ascent: capital.fontBoundingBoxAscent,
                descent: capital.fontBoundingBoxDescent,
                capHeight: capital.actualBoundingBoxAscent,
                xHeight: lower.actualBoundingBoxAscent,
            };
        },

        measure,

        rasterize(font, text, transform, stroke) {
            const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = transform;
            if (!setFont(drawing, font)) return null;
            drawing.fontKerning = "normal";
            const ink = drawing.measureText(text);
            // The ink box in the text's own space, grown by half the stroke,
            // then carried to the device through the transform.
            const grow = (stroke ?? 0) / 2;
            const corners: [number, number][] = [
                [-ink.actualBoundingBoxLeft - grow, -ink.actualBoundingBoxAscent - grow],
                [ink.actualBoundingBoxRight + grow, -ink.actualBoundingBoxAscent - grow],
                [-ink.actualBoundingBoxLeft - grow, ink.actualBoundingBoxDescent + grow],
                [ink.actualBoundingBoxRight + grow, ink.actualBoundingBoxDescent + grow],
            ];
            const xs = corners.map(([x, y]) => a * x + c * y + e);
            const ys = corners.map(([x, y]) => b * x + d * y + f);
            // A pixel of margin on every side for the anti-aliased fringe.
            const x = Math.floor(Math.min(...xs)) - 1;
            const y = Math.floor(Math.min(...ys)) - 1;
            const width = Math.ceil(Math.max(...xs)) + 1 - x;
            const height = Math.ceil(Math.max(...ys)) + 1 - y;
            if (!(width > 0 && height > 0) || width > MAX_RASTER || height > MAX_RASTER) return null;

            drawing.canvas.width = width;
            drawing.canvas.height = height;
            drawing.font = font;
            drawing.fontKerning = "normal";
            drawing.setTransform(a, b, c, d, e - x, f - y);
            if (stroke === undefined) {
                drawing.fillText(text, 0, 0);
            } else {
                drawing.lineWidth = stroke;
                drawing.lineJoin = "round";
                drawing.strokeText(text, 0, 0);
            }
            const pixels = drawing.getImageData(0, 0, width, height).data;
            const alpha = new Uint8Array(width * height);
            let inked = false;
            for (let i = 0; i < alpha.length; i++) {
                const value = pixels[i * 4 + 3] ?? 0;
                alpha[i] = value;
                if (value) inked = true;
            }
            return inked ? { x, y, width, height, alpha } : null;
        },
    };
}

/** The pixel size a CSS `font` shorthand names. */
function pixelSizeOf(font: string): number {
    const size = /(\d+(?:\.\d+)?)px/.exec(font);
    return size ? Number(size[1]) : 16;
}

/**
 * A TrueType font whose cmap sends every code point to one empty glyph that
 * advances nothing — the catch-all a CSS `font` list ends with, so a
 * character the named family lacks measures `0` instead of falling back.
 *
 * Built here rather than shipped, because it is nothing but structure: the
 * tables a browser's font sanitizer requires, one `cmap` format 13 subtable
 * (a constant glyph over code-point ranges), and an empty outline. The glyph
 * is a real zero-contour outline, not a zero-length one — Chrome refuses a
 * font whose `glyf` table is empty.
 */
function blankFont(): Uint8Array<ArrayBuffer> {
    const u16 = (v: number) => [(v >> 8) & 0xff, v & 0xff];
    const i16 = (v: number) => u16(v & 0xffff);
    const u32 = (v: number) => [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
    const zeros = (n: number) => new Array<number>(n).fill(0);
    const utf16 = (s: string) => [...s].flatMap((c) => u16(c.charCodeAt(0)));

    // `.notdef` is empty; glyph 1 is the blank, a simple glyph of no contours.
    const glyf = [...i16(0), ...zeros(8), ...u16(0)];
    const loca = [...u16(0), ...u16(0), ...u16(glyf.length / 2)];
    // Every scalar value — both sides of the surrogates — to glyph 1.
    const groups: [number, number][] = [
        [0x0000, 0xd7ff],
        [0xe000, 0x10ffff],
    ];
    const cmap = [
        ...u16(0),
        ...u16(1),
        ...u16(3),
        ...u16(10),
        ...u32(12),
        ...u16(13),
        ...u16(0),
        ...u32(16 + 12 * groups.length),
        ...u32(0),
        ...u32(groups.length),
        ...groups.flatMap(([start, end]) => [...u32(start), ...u32(end), ...u32(1)]),
    ];
    const names: [number, string][] = [
        [1, "UDoc Canvas Text Blank"],
        [2, "Regular"],
        [3, "UDoc Canvas Text Blank"],
        [4, "UDoc Canvas Text Blank"],
        [5, "Version 1.0"],
        [6, "UDocCanvasTextBlank"],
    ];
    const records: number[] = [];
    const strings: number[] = [];
    for (const [id, text] of names) {
        const bytes = utf16(text);
        records.push(...u16(3), ...u16(1), ...u16(0x409), ...u16(id), ...u16(bytes.length), ...u16(strings.length));
        strings.push(...bytes);
    }
    const name = [...u16(0), ...u16(names.length), ...u16(6 + 12 * names.length), ...records, ...strings];
    const head = [
        ...u16(1),
        ...u16(0),
        ...u32(0x00010000),
        ...u32(0), // checksum adjustment, set once the whole font is summed
        ...u32(0x5f0f3cf5),
        ...u16(0x000b),
        ...u16(1000),
        ...zeros(16), // created, modified
        ...zeros(8), // the bounding box
        ...u16(0),
        ...u16(8),
        ...i16(2),
        ...i16(0), // short loca offsets
        ...i16(0),
    ];
    const hhea = [
        ...u16(1),
        ...u16(0),
        ...i16(800),
        ...i16(-200),
        ...zeros(10), // line gap, advance and side-bearing extremes
        ...i16(1), // caret slope rise: upright
        ...zeros(14), // caret run and offset, reserved, metric data format
        ...u16(2),
    ];
    const hmtx = zeros(8); // both glyphs advance nothing
    const maxp = [...u32(0x00010000), ...u16(2), ...zeros(8), ...u16(2), ...zeros(16)];
    const os2 = [
        ...u16(4),
        ...i16(0),
        ...u16(400),
        ...u16(5),
        ...zeros(34),
        ...zeros(16), // Unicode ranges
        ...[0x55, 0x44, 0x4f, 0x43], // vendor "UDOC"
        ...u16(0x40), // regular
        ...u16(0),
        ...u16(0xffff),
        ...i16(800),
        ...i16(-200),
        ...i16(0),
        ...u16(800),
        ...u16(200),
        ...zeros(12),
        ...u16(0),
        ...u16(0x20),
        ...u16(0),
    ];
    const post = [...u32(0x00030000), ...zeros(28)];

    const tables: [string, number[]][] = [
        ["OS/2", os2],
        ["cmap", cmap],
        ["glyf", glyf],
        ["head", head],
        ["hhea", hhea],
        ["hmtx", hmtx],
        ["loca", loca],
        ["maxp", maxp],
        ["name", name],
        ["post", post],
    ];
    const checksum = (bytes: ArrayLike<number>) => {
        let sum = 0;
        for (let i = 0; i < bytes.length; i += 4) {
            const word =
                ((bytes[i] ?? 0) << 24) |
                ((bytes[i + 1] ?? 0) << 16) |
                ((bytes[i + 2] ?? 0) << 8) |
                (bytes[i + 3] ?? 0);
            sum = (sum + word) >>> 0;
        }
        return sum;
    };
    const count = tables.length;
    const power = 2 ** Math.floor(Math.log2(count));
    const directory = [
        ...u32(0x00010000),
        ...u16(count),
        ...u16(power * 16),
        ...u16(Math.log2(power)),
        ...u16((count - power) * 16),
    ];
    const body: number[] = [];
    let offset = 12 + 16 * count;
    let headAt = 0;
    for (const [tag, bytes] of tables) {
        if (tag === "head") headAt = offset;
        directory.push(
            ...[...tag].map((c) => c.charCodeAt(0)),
            ...u32(checksum(bytes)),
            ...u32(offset),
            ...u32(bytes.length),
        );
        const padded = [...bytes, ...zeros((4 - (bytes.length % 4)) % 4)];
        body.push(...padded);
        offset += padded.length;
    }
    const font = new Uint8Array([...directory, ...body]);
    font.set(u32((0xb1b0afba - checksum(font)) >>> 0), headAt + 8);
    return font;
}
