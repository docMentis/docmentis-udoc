// How the library shows a file: its type, as a word and a colored badge, its
// pages, its size and its date.
import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";

import { CARD_PAGE_SCALE } from "../../shared/api.ts";
import type { Asset } from "../../shared/api.ts";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { announceMoment } from "./moments";

/** Each format's name for people, and its badge's color (app.css), by udoc's name for it. */
const TYPES: Record<string, { label: string; color: string }> = {
    pdf: { label: "PDF", color: "var(--sw-format-pdf)" },
    docx: { label: "Word", color: "var(--sw-format-word)" },
    doc: { label: "Word", color: "var(--sw-format-word)" },
    pptx: { label: "PowerPoint", color: "var(--sw-format-powerpoint)" },
    ppt: { label: "PowerPoint", color: "var(--sw-format-powerpoint)" },
    xlsx: { label: "Excel", color: "var(--sw-format-excel)" },
    xls: { label: "Excel", color: "var(--sw-format-excel)" },
    csv: { label: "CSV", color: "var(--sw-format-excel)" },
};

/** A file's type in words: "PowerPoint"; a format with none, in capitals. */
export function typeLabel(format: string): string {
    return TYPES[format]?.label ?? format.toUpperCase();
}

/** A file's type as a small badge: its format, on its color, or for a format with none, on-surface-variant. */
export function FileBadge({ format }: { format: string }) {
    const background = TYPES[format]?.color ?? "var(--md-sys-color-on-surface-variant)";
    return (
        <span className="file-badge" style={{ background }} aria-hidden="true">
            {format.slice(0, 4).toUpperCase()}
        </span>
    );
}

/** What a card needs of a file to show its pages. */
type PagedFile = Pick<Asset, "format" | "thumbnail" | "documentId">;

/** Where page `index` of `file` is: its first, kept by the backend; another, rendered by udoc-server as it's asked for. */
function pageSource(file: PagedFile, index: number): string {
    if (index === 0 && file.thumbnail) return file.thumbnail;
    const document = encodeURIComponent(file.documentId);
    return `/udoc/documents/${document}/layout/pages/${index}.png?scale=${CARD_PAGE_SCALE}`;
}

/** How many thumbnails that flip are in view: the first to show, and the last to go, are moments. */
let inView = 0;

/**
 * A file's pages, on its card: its first, kept by the backend, and unless
 * `flips` is false, with the arrows over it, the others, which udoc-server
 * renders as they're flipped to, as the document is now: a published version's
 * card, which can't show that (GAPS.md), doesn't flip. The page shown stays
 * until the one flipped to has loaded; the next arrow shows until udoc-server
 * has no next page. A file with no first page, as a workbook, whose first page
 * is all of its first sheet (GAPS.md), shows a large badge of its type.
 */
export function Thumbnail({ file, flips = true }: { file: PagedFile; flips?: boolean }) {
    const [state, setState] = useState<"loading" | "shown" | "failed">("loading");
    // The page flipped to, and the one shown: another while it loads.
    const [page, setPage] = useState(0);
    const [shown, setShown] = useState(0);
    // The last page, once a flip past it has found it.
    const [lastPage, setLastPage] = useState(Infinity);
    const madeAt = useRef(performance.now());
    const shownAfter = useRef(0);
    const showing = state === "shown";

    // In view from its first page loaded until it goes.
    useEffect(() => {
        if (!showing || !flips) return;
        if (inView++ === 0) {
            announceMoment({ kind: "thumbnails:shown", where: "card", format: file.format, ms: shownAfter.current });
        }
        return () => {
            if (--inView === 0) announceMoment({ kind: "thumbnails:hidden", where: "card" });
        };
    }, [showing, flips, file.format]);

    function flip(event: MouseEvent, by: number) {
        // The card opens its file; its arrows only flip.
        event.stopPropagation();
        setPage(page + by);
    }

    function loaded() {
        if (!showing) shownAfter.current = performance.now() - madeAt.current;
        setState("shown");
        setShown(page);
    }

    // A page flipped to that doesn't load leaves the one shown, the last.
    function failed() {
        if (page === 0) {
            setState("failed");
            return;
        }
        setLastPage(shown);
        setPage(shown);
    }

    return (
        <div className="thumbnail" aria-busy={page !== shown}>
            {state === "failed" || !file.thumbnail ? (
                <FileBadge format={file.format} />
            ) : (
                <>
                    <img
                        src={pageSource(file, page)}
                        alt=""
                        loading="lazy"
                        className={state === "shown" ? "thumbnail-shown" : undefined}
                        onLoad={loaded}
                        onError={failed}
                    />
                    {page !== shown && <span className="page-loading" />}
                    {flips && state === "shown" && page > 0 && (
                        <button
                            type="button"
                            className="page-flip page-flip-back"
                            aria-label="Previous page"
                            onClick={(event) => flip(event, -1)}
                        >
                            <ChevronLeftIcon />
                        </button>
                    )}
                    {flips && state === "shown" && page < lastPage && (
                        <button
                            type="button"
                            className="page-flip page-flip-next"
                            aria-label="Next page"
                            onClick={(event) => flip(event, 1)}
                        >
                            <ChevronRightIcon />
                        </button>
                    )}
                </>
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

const DATE_TIME = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/** A day and its time, in the reader's own way: "Nov 3, 2026, 2:56 PM". */
export function formatDateTime(time: number): string {
    return DATE_TIME.format(time);
}

/** A file's name without its extension: what an upload is named by default. */
export function baseName(fileName: string): string {
    const dot = fileName.lastIndexOf(".");
    return dot > 0 ? fileName.slice(0, dot) : fileName;
}
