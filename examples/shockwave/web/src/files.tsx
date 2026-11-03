// How the library shows a file: its type, as a word and a colored badge, its
// first page, its size and its date.
import { useState } from "react";

import type { Asset } from "../../shared/api.ts";

/** Each format's name for people, and its badge's color, by udoc's name for it. */
const TYPES: Record<string, { label: string; color: string }> = {
    pdf: { label: "PDF", color: "#d93025" },
    docx: { label: "Word", color: "#2b579a" },
    doc: { label: "Word", color: "#2b579a" },
    pptx: { label: "PowerPoint", color: "#c43e1c" },
    ppt: { label: "PowerPoint", color: "#c43e1c" },
    xlsx: { label: "Excel", color: "#217346" },
    xls: { label: "Excel", color: "#217346" },
    csv: { label: "CSV", color: "#217346" },
};

/** A file's type in words: "PowerPoint"; a format with none, in capitals. */
export function typeLabel(format: string): string {
    return TYPES[format]?.label ?? format.toUpperCase();
}

/** A file's type as a small badge: its format, on its color. */
export function FileBadge({ format }: { format: string }) {
    return (
        <span className="file-badge" style={{ background: TYPES[format]?.color ?? "#636c7a" }} aria-hidden="true">
            {format.slice(0, 4).toUpperCase()}
        </span>
    );
}

/**
 * The scale a thumbnail is rendered at, in pixels per point: a letter page
 * 306 pixels wide, a 16:9 slide 480, sharp on a card at twice the pixels.
 */
const THUMBNAIL_SCALE = 0.5;

/**
 * A file's first page, rendered by udoc-server through the gate; a large
 * badge of its type while it can't be, as for a workbook, whose first page
 * is all of its first sheet (GAPS.md).
 */
export function Thumbnail({ asset }: { asset: Asset }) {
    const [state, setState] = useState<"loading" | "shown" | "failed">("loading");
    const source = `/udoc/documents/${encodeURIComponent(asset.documentId)}/layout/pages/0.png?scale=${THUMBNAIL_SCALE}`;
    return (
        <div className="thumbnail">
            {state === "failed" ? (
                <FileBadge format={asset.format} />
            ) : (
                <img
                    src={source}
                    alt=""
                    loading="lazy"
                    className={state === "shown" ? "thumbnail-shown" : undefined}
                    onLoad={() => setState("shown")}
                    onError={() => setState("failed")}
                />
            )}
        </div>
    );
}

/** `bytes` as people read a size: "583 KB". */
export function formatSize(bytes: number): string {
    if (bytes < 1000) return `${bytes} B`;
    const units = ["KB", "MB", "GB"];
    let size = bytes / 1000;
    let unit = 0;
    while (size >= 1000 && unit < units.length - 1) {
        size /= 1000;
        unit++;
    }
    return `${size < 10 ? size.toFixed(1) : Math.round(size)} ${units[unit]}`;
}

const DATE = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

/** A day, in the reader's own way: "Nov 3, 2026". */
export function formatDate(time: number): string {
    return DATE.format(time);
}

/** A file's name without its extension: what an upload is named by default. */
export function baseName(fileName: string): string {
    const dot = fileName.lastIndexOf(".");
    return dot > 0 ? fileName.slice(0, dot) : fileName;
}
