// The Canva document: a design, by its link, framed on Canva's own read-only
// embed page, under the web page document's bar
// (docs/design/ui-extension-document.md). A link is never framed as given, as
// Canva refuses a frame on a plain `/view`.
//
// Nothing here imports a sibling at runtime, so the tests can load it from
// `src`: the shell hands it the frame.

import { UDocError } from "@docmentis/udoc-wasm/error";
import type { ExtensionDocument } from "./extension-documents.js";
import type { openFramedPage } from "./webpage-document.js";

/** A design's path: its id, its share token if it has one, and how the link opens it. */
const DESIGN_PATH = /^\/design\/([\w-]+(?:\/[\w-]+)?)\/(?:view|watch|edit)\/?$/;

/**
 * The embed page of the design `url` links to, its share token kept; the
 * address Canva's own oEmbed endpoint gives, which a browser can't read.
 * `undefined` for any other address.
 */
export function canvaEmbedPageOf(url: string): string | undefined {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return undefined;
    }
    if (parsed.hostname !== "www.canva.com" && parsed.hostname !== "canva.com") return undefined;
    const design = DESIGN_PATH.exec(parsed.pathname)?.[1];
    return design === undefined ? undefined : `https://www.canva.com/design/${design}/view?embed`;
}

/** The built-in Canva document, `docType` `"canva"`, framing with `frame`. */
export function canvaDocument(frame: typeof openFramedPage): ExtensionDocument {
    return {
        docType: "canva",
        formats: ["canva"],
        // By the address alone: a page can't read Canva's, so nothing is fetched.
        canOpen: (request) => canvaEmbedPageOf(request.url ?? "") !== undefined,
        open: async (container, request, host) => {
            const address = request.url ?? "";
            const url = canvaEmbedPageOf(address);
            if (url === undefined) throw new UDocError("unsupported", "a Canva document opens from a design's link");
            return frame(container, { url, address, sourceFormat: "canva" }, host);
        },
    };
}
