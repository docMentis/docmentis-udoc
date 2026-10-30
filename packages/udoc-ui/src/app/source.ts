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
    const total = Number(response.headers.get("Content-Length")) || 0;
    if (!response.body) {
        const bytes = new Uint8Array(await response.arrayBuffer());
        progress(bytes.byteLength, bytes.byteLength);
        return bytes;
    }
    return readStream(response.body, total, progress);
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
 * TSV's, a PSV's, a text file's or a Markdown file's, which have no signature
 * for the engine to detect.
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
        default:
            return undefined;
    }
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
    txt: "text/plain",
    md: "text/markdown",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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
    if (chunks.length === 1) return chunks[0]!;
    const bytes = new Uint8Array(loaded);
    let at = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, at);
        at += chunk.byteLength;
    }
    return bytes;
}
