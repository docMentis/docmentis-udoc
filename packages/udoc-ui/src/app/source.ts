// Reading what `open` is given into the bytes the engine opens:
// bytes as they are, a Blob (a File) read through, a URL fetched — each
// reporting how far it has got as it reads, which the loading overlay and the
// `document:loading` event show.

import type { FileFormat } from "@docmentis/udoc-wasm";
import { UDocError } from "@docmentis/udoc-wasm/error";

/** A document as `open` takes it. */
export type OpenSource = string | URL | Blob | Uint8Array;

/** How far reading a document has got: bytes read, of `total` — `0` when the size isn't known. */
export type ReadProgress = (loaded: number, total: number) => void;

/**
 * The bytes of `source`, reporting `progress` as they arrive: a URL is fetched
 * (its size from `Content-Length`, when the server sends one), a Blob read, and
 * bytes reported once, whole. Rejects with an `io` `UDocError` when a fetch
 * fails or the server answers with an error.
 */
export async function readSource(source: OpenSource, progress: ReadProgress): Promise<Uint8Array> {
    if (source instanceof Uint8Array) {
        progress(source.byteLength, source.byteLength);
        return source;
    }
    if (source instanceof Blob) return readStream(source.stream(), source.size, progress);
    const response = await fetchResponse(source, progress);
    const total = Number(response.headers.get("Content-Length")) || 0;
    if (!response.body) {
        const bytes = new Uint8Array(await response.arrayBuffer());
        progress(bytes.byteLength, bytes.byteLength);
        return bytes;
    }
    return readStream(response.body, total, progress);
}

/** The response to fetching `source`, reporting nothing read yet; rejects with an `io` `UDocError` when the fetch fails or the server answers with an error. */
async function fetchResponse(source: string | URL, progress: ReadProgress): Promise<Response> {
    progress(0, 0);
    let response: Response;
    try {
        response = await fetch(source);
    } catch (error) {
        throw new UDocError("io", `fetching ${String(source)} failed`, undefined, { cause: error });
    }
    if (!response.ok) {
        throw new UDocError("io", `fetching ${String(source)}: ${response.status} ${response.statusText}`);
    }
    return response;
}

/** The most of a source {@link SourceReader.head} reads. */
export const HEAD_BYTES = 4096;

/** A source read once: its first bytes when asked for, then the whole from there. */
export interface SourceReader {
    /**
     * The first bytes, at most {@link HEAD_BYTES}, and the media type the
     * Blob or the response declares, without its parameters — `undefined`
     * where neither does. Read once: a URL is fetched the first time it is
     * asked, and {@link all} reads on from there.
     */
    head(): Promise<{ bytes: Uint8Array; mediaType: string | undefined }>;
    /** The whole, as {@link readSource} reads it, reporting progress — a URL's from where {@link head} stopped. */
    all(): Promise<Uint8Array>;
    /** Stop reading a URL {@link head} began fetching, which another reader takes from here. */
    cancel(): void;
}

/** A reader of `source`, reporting `progress` as {@link readSource} does. */
export function sourceReader(source: OpenSource, progress: ReadProgress): SourceReader {
    if (source instanceof Uint8Array) {
        return {
            head: async () => ({ bytes: source.subarray(0, HEAD_BYTES), mediaType: undefined }),
            all: () => readSource(source, progress),
            cancel: () => {},
        };
    }
    if (source instanceof Blob) {
        return {
            head: async () => ({
                bytes: new Uint8Array(await source.slice(0, HEAD_BYTES).arrayBuffer()),
                mediaType: mediaTypeEssence(source.type),
            }),
            all: () => readSource(source, progress),
            cancel: () => {},
        };
    }
    // A URL is fetched once, by whichever asks first; what `head` read stays
    // the start of what `all` returns.
    let fetched: Promise<FetchedSource> | undefined;
    let headRead: Promise<{ bytes: Uint8Array; mediaType: string | undefined }> | undefined;
    return {
        head() {
            headRead ??= (async () => {
                fetched ??= fetchSource(source, progress);
                const read = await fetched;
                await read.until(HEAD_BYTES);
                return { bytes: read.bytes().subarray(0, HEAD_BYTES), mediaType: read.mediaType };
            })();
            return headRead;
        },
        async all() {
            if (!fetched) return readSource(source, progress);
            await headRead;
            const read = await fetched;
            await read.until(Infinity);
            return read.bytes();
        },
        cancel() {
            void fetched?.then((read) => read.cancel()).catch(() => {});
        },
    };
}

/** A URL's response, read as far as asked so far. */
interface FetchedSource {
    readonly mediaType: string | undefined;
    /** Read on until at least `length` bytes are in, or the body ends. */
    until(length: number): Promise<void>;
    /** What has been read so far, whole. */
    bytes(): Uint8Array;
    cancel(): void;
}

/** Fetch `source`, rejecting as {@link readSource} does, to read its body as far as asked. */
async function fetchSource(source: string | URL, progress: ReadProgress): Promise<FetchedSource> {
    const response = await fetchResponse(source, progress);
    const total = Number(response.headers.get("Content-Length")) || 0;
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    let done = reader === undefined;
    if (!reader) {
        const bytes = new Uint8Array(await response.arrayBuffer());
        chunks.push(bytes);
        loaded = bytes.byteLength;
        progress(loaded, loaded);
    } else {
        progress(0, total);
    }
    return {
        mediaType: mediaTypeEssence(response.headers.get("Content-Type") ?? ""),
        async until(length) {
            while (!done && loaded < length) {
                const { done: ended, value } = await reader!.read();
                if (ended) {
                    done = true;
                    break;
                }
                chunks.push(value);
                loaded += value.byteLength;
                progress(loaded, total);
            }
        },
        bytes: () => concat(chunks, loaded),
        cancel() {
            if (!done) void reader?.cancel().catch(() => {});
            done = true;
        },
    };
}

/** A media type without its parameters, lowercased: `video/mp4` of `video/MP4; codecs=avc1`; `undefined` for none. */
function mediaTypeEssence(type: string): string | undefined {
    const essence = type.split(";")[0]!.trim().toLowerCase();
    return essence === "" ? undefined : essence;
}

/** Whether `value` is the name of a file format the engine opens. */
export function isFileFormat(value: string): value is FileFormat {
    return Object.hasOwn(MEDIA_TYPES, value);
}

/**
 * The name `source`'s file has, for a download of the document: a File's own,
 * or a URL's last path segment; `undefined` for bytes, a nameless Blob, or a
 * URL that ends in `/`.
 */
export function sourceName(source: OpenSource): string | undefined {
    if (source instanceof Uint8Array) return undefined;
    if (source instanceof Blob) return source instanceof File && source.name !== "" ? source.name : undefined;
    const path = new URL(source, location.href).pathname;
    const last = path.slice(path.lastIndexOf("/") + 1);
    if (last === "") return undefined;
    try {
        return decodeURIComponent(last);
    } catch {
        // A `%` that escapes nothing: the segment is its own name.
        return last;
    }
}

/**
 * The format `name`'s extension names when the bytes can't say it: a CSV's, a
 * TSV's, a PSV's, a text file's, a Markdown file's or an email's, which have no
 * signature for the engine to detect, or an HTML file's, which needn't open
 * with the `<!DOCTYPE html>` or `<html>` the engine detects one by.
 * `undefined` for any other name, and for none.
 */
export function signaturelessFormat(name: string | undefined): FileFormat | undefined {
    switch (/\.([^.]+)$/.exec(name ?? "")?.[1]?.toLowerCase()) {
        case "csv":
            return "csv";
        case "tsv":
        case "tab":
            return "tsv";
        case "psv":
            return "psv";
        case "txt":
            return "txt";
        case "md":
        case "markdown":
            return "md";
        case "html":
        case "htm":
            return "html";
        case "eml":
            return "eml";
        default:
            return undefined;
    }
}

/** The lines of a CSV its preview shows. */
const PREVIEW_LINES = 8;

/** The most of a CSV its preview decodes, so one without line breaks isn't decoded whole. */
const PREVIEW_BYTES = 4096;

/**
 * The first lines of the CSV `bytes` as written, for the reader to see what
 * splits its fields: decoded as UTF-8, as the engine reads it, without a byte
 * order mark, and short of the line the first {@link PREVIEW_BYTES} cut,
 * unless that is the only one.
 */
export function csvPreviewLines(bytes: Uint8Array): string[] {
    const cut = bytes.byteLength > PREVIEW_BYTES;
    const lines = new TextDecoder().decode(bytes.subarray(0, PREVIEW_BYTES)).split(/\r\n|\r|\n/);
    // The line the cut runs through, or the empty one after the last break.
    if ((cut && lines.length > 1) || lines.at(-1) === "") lines.pop();
    return lines.slice(0, PREVIEW_LINES);
}

/**
 * The media type of a file in `format`, for a download of it: what lets the
 * browser give a name without an extension the right one, where an untyped
 * Blob is sniffed — a PDF's as text, saved `.txt`.
 */
export function mediaType(format: FileFormat): string {
    return MEDIA_TYPES[format];
}

const MEDIA_TYPES: Record<FileFormat, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    docm: "application/vnd.ms-word.document.macroEnabled.12",
    dotx: "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
    dotm: "application/vnd.ms-word.template.macroEnabled.12",
    txt: "text/plain",
    md: "text/markdown",
    html: "text/html",
    eml: "message/rfc822",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    pptm: "application/vnd.ms-powerpoint.presentation.macroEnabled.12",
    potx: "application/vnd.openxmlformats-officedocument.presentationml.template",
    potm: "application/vnd.ms-powerpoint.template.macroEnabled.12",
    ppsx: "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
    ppsm: "application/vnd.ms-powerpoint.slideshow.macroEnabled.12",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
    xltx: "application/vnd.openxmlformats-officedocument.spreadsheetml.template",
    xltm: "application/vnd.ms-excel.template.macroEnabled.12",
    csv: "text/csv",
    tsv: "text/tab-separated-values",
    // A PSV has no media type of its own.
    psv: "text/plain",
    jpg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    bmp: "image/bmp",
    tiff: "image/tiff",
    webp: "image/webp",
    svg: "image/svg+xml",
    emf: "image/emf",
    wmf: "image/wmf",
};

/** Read `stream` whole, reporting each chunk against `total` (`0` unknown). */
async function readStream(
    stream: ReadableStream<Uint8Array>,
    total: number,
    progress: ReadProgress,
): Promise<Uint8Array> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    progress(0, total);
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.byteLength;
        progress(loaded, total);
    }
    return concat(chunks, loaded);
}

/** `chunks` in one array, `length` bytes long. */
function concat(chunks: readonly Uint8Array[], length: number): Uint8Array {
    if (chunks.length === 1) return chunks[0]!;
    const bytes = new Uint8Array(length);
    let at = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, at);
        at += chunk.byteLength;
    }
    return bytes;
}
