// What the narrator says: typed data (docs/design/examples-shockwave.md). Its
// highlights, each the docMentis technology behind a moment the app
// announces, told the first time that moment happens, with its figures.
import type { Moment } from "../moments";

export interface Highlight {
    id: string;
    /** Whether `moment` is the one this highlight tells about. */
    tells: (moment: Moment) => boolean;
    title: string;
    body: string;
    /** The moment's figures, in a line under the body. */
    figures: (moment: Moment) => string[];
}

/** A format and a time, the figures of a moment with both: "PPTX · 180 ms". */
function formatAndTime({ format, ms }: Moment): string[] {
    const time = ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
    return [...(format ? [format.toUpperCase()] : []), time];
}

export const HIGHLIGHTS: Highlight[] = [
    {
        id: "previewed-before-upload",
        tells: (moment) => moment.kind === "document:opened" && moment.where === "upload",
        title: "Previewed before upload",
        body: "Client-first: docMentis rendered this file in your browser, so you see it before it's uploaded, not after.",
        figures: formatAndTime,
    },
    {
        id: "rendered-on-request",
        tells: (moment) => moment.kind === "page:rendered" && moment.where === "card",
        title: "Thumbnails rendered on the server",
        body: "udoc-server generates thumbnails on the server. The first page's is generated and stored at upload; the other pages' are generated in real time, upon request. This reduces your storage cost while providing the best user experience.",
        figures: formatAndTime,
    },
];
