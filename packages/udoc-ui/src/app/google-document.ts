// The Google document: a Docs, Sheets or Slides file, by its link, framed on
// Google's own read-only page, under the web page document's bar
// (docs/design/ui-extension-document.md). A link is never framed as given, as
// `/edit` frames with Google's whole editor, which isn't view only.
//
// Nothing here imports a sibling at runtime, so the tests can load it from
// `src`: the shell hands it the frame.

import { UDocError } from "@docmentis/udoc-wasm/error";
import type { ExtensionDocument } from "./extension-documents.js";
import type { openFramedPage } from "./webpage-document.js";

/** Each Google app in a file's address: its source format and the page that shows a file read-only. */
const APPS: ReadonlyMap<string, { readonly sourceFormat: string; readonly page: string }> = new Map([
    ["document", { sourceFormat: "google-docs", page: "preview" }],
    ["spreadsheets", { sourceFormat: "google-sheets", page: "preview" }],
    ["presentation", { sourceFormat: "google-slides", page: "embed" }],
]);

/**
 * A file's path: its app, its id, and how the link opens it. Named ways only,
 * as `/export` is a document's bytes, which the engine fetches, and `/d/e/…`
 * a page published to the web, whose id this isn't.
 */
const FILE_PATH = /^\/([a-z]+)\/d\/([\w-]+)(?:\/(?:edit|view|preview|embed|present))?\/?$/;

/**
 * The read-only page of the file `url` links to, with its source format, and
 * the `resourcekey` that some link-shared files need to open. `undefined` for
 * any other address.
 */
export function googlePageOf(url: string): { url: string; sourceFormat: string } | undefined {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return undefined;
    }
    if (parsed.hostname !== "docs.google.com") return undefined;
    const match = FILE_PATH.exec(parsed.pathname);
    const app = APPS.get(match?.[1] ?? "");
    if (!match || !app) return undefined;
    const page = new URL(`https://docs.google.com/${match[1]}/d/${match[2]}/${app.page}`);
    const key = parsed.searchParams.get("resourcekey");
    if (key !== null) page.searchParams.set("resourcekey", key);
    return { url: page.href, sourceFormat: app.sourceFormat };
}

/** The built-in Google document, `docType` `"google"`, framing with `frame`. */
export function googleDocument(frame: typeof openFramedPage): ExtensionDocument {
    return {
        docType: "google",
        formats: [...APPS.values()].map((app) => app.sourceFormat),
        // By the address alone: a page can't read Google's, so nothing is fetched.
        canOpen: (request) => googlePageOf(request.url ?? "") !== undefined,
        open: async (container, request, host) => {
            const address = request.url ?? "";
            const page = googlePageOf(address);
            const format = request.options.format;
            // Given a `format`, no `canOpen` was asked: it holds for this link, or nothing does.
            if (page === undefined || (format !== undefined && format !== page.sourceFormat)) {
                throw new UDocError("unsupported", `a Google document opens from a link to its ${format ?? "file"}`);
            }
            return frame(container, { ...page, address }, host);
        },
    };
}
