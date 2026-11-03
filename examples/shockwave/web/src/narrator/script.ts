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

export const HIGHLIGHTS: Highlight[] = [
    {
        id: "previewed-before-upload",
        tells: (moment) => moment.kind === "document:opened" && moment.where === "upload",
        title: "Previewed before upload",
        body: "Client-first: docMentis rendered this file in your browser, so you see it before it's uploaded, not after.",
        figures: ({ format, ms }) => [...(format ? [format.toUpperCase()] : []), `${(ms / 1000).toFixed(1)} s`],
    },
];
