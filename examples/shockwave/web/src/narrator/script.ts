// What the narrator says: typed data (docs/design/examples-shockwave.md). Its
// highlights, each the docMentis technology behind something the app shows,
// with its figures: shown while that shows, from the moment the app announces
// it showing to the moment it announces it gone.
import type { Moment } from "../moments";

export interface Highlight {
    id: string;
    /** Whether `moment` shows what this highlight tells about. */
    tells: (moment: Moment) => boolean;
    title: string;
    body: string;
    /** The moment's figures, in a line under the body; none for a moment without. */
    figures: (moment: Moment) => string[];
    /** Whether `moment` takes away what this highlight tells about, and the highlight with it. */
    ends: (moment: Moment) => boolean;
}

/** A moment's format and time, as its figures: "PPTX · 180 ms". */
function formatAndTime(moment: Moment): string[] {
    if (!("ms" in moment)) return [];
    const { format, ms } = moment;
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
        ends: (moment) => moment.kind === "document:closed" && moment.where === "upload",
    },
    {
        id: "streamed-from-the-server",
        tells: (moment) => moment.kind === "document:opened" && moment.where === "file",
        title: "Streamed from the server",
        body: "docMentis udoc-viewer is designed client-first, but for large documents you can pair it with udoc-server to do streaming. This way you get the first render instantly, without waiting for the whole file to download.",
        figures: () => [],
        ends: (moment) => moment.kind === "document:closed" && moment.where === "file",
    },
    {
        id: "thumbnails-on-the-server",
        tells: (moment) => moment.kind === "thumbnails:shown" && moment.where === "card",
        title: "Thumbnails rendered on the server",
        body: "udoc-server generates thumbnails on the server. Every page's is generated once, when a file is uploaded or a version is saved, and stored, so flipping through a card's pages loads stored images, each page as that version was saved, with nothing rendered on request.",
        figures: formatAndTime,
        ends: (moment) => moment.kind === "thumbnails:hidden" && moment.where === "card",
    },
    {
        id: "viewer-in-your-brand",
        tells: (moment) => moment.kind === "viewer-colors:shown",
        title: "The document viewer, in your brand",
        body: "An enterprise SaaS app like Shockwave is customized to fit each customer's brand, and the document viewer embedded in it should be no exception. Choose its toolbar, background and primary colors here: the viewer changes as you do.",
        figures: () => [],
        ends: (moment) => moment.kind === "viewer-colors:hidden",
    },
];
