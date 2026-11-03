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
    figures: (moment: Moment) => string;
}

export const HIGHLIGHTS: Highlight[] = [
    {
        id: "previewed-before-upload",
        tells: (moment) => moment.kind === "document:opened" && moment.where === "upload",
        title: "Previewed before it's uploaded",
        body:
            "docMentis is client-first: the viewer rendered this file in your browser, in WebAssembly, " +
            "from its own bytes. So a document is previewed before or during its upload, not after it.",
        figures: ({ format, ms }) =>
            [format?.toUpperCase(), `shown in ${(ms / 1000).toFixed(1)} s`].filter(Boolean).join(" · "),
    },
];
