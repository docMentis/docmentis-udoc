// Extension documents: kinds of document the engine doesn't read, which a host
// registers and the viewer and the editor then open, view only — each into a
// `<div>` the shell hands it (docs/design/ui-extension-document.md). This is
// what one is, what it is asked and lent, and the registry that picks the one
// that opens what `open` was given.
//
// Nothing here imports a sibling at runtime, so the tests can load it from `src`.

import type { UDocType } from "@docmentis/udoc-wasm";
import { UDocError } from "@docmentis/udoc-wasm/error";
import type { OpenOptions } from "../base.js";

/**
 * A kind of document the engine doesn't read — video, a web page — that the
 * viewer and the editor open, view only. Register one with
 * `UDocOptions.extensionDocuments`, or `registerExtensionDocument` later.
 *
 * `open` asks the extension documents in turn before the engine: one whose
 * {@link formats} holds the `format` it was given opens it; with no `format`
 * given, the first whose {@link canOpen} says yes does. It renders into a
 * `<div>` filling the document area, where the canvas hides.
 */
export interface ExtensionDocument {
    /**
     * What kind of document it is, as `"presentation"` is one the engine
     * opens: `"media"`, say. `docType` reports it while one is open, and it
     * names the extension document: registering one of a doc type already
     * registered replaces that one. None of the engine's own doc types.
     */
    readonly docType: string;
    /**
     * The source formats it opens, as `pptx` and `potx` are a presentation's:
     * `"mp4"`, `"hls"`, say. An `OpenOptions.format` among them picks it, with
     * no {@link canOpen} asked, and its viewer's `sourceFormat` is one of them.
     */
    readonly formats: readonly string[];
    /**
     * Whether it opens what `open` was given, when `open` was given no
     * `format`. Asked in the order the extension documents were registered;
     * the first to say yes opens it, and with none the engine does. A
     * rejection fails the open.
     */
    canOpen(request: ExtensionOpenRequest): boolean | Promise<boolean>;
    /**
     * Render what `request` names into `container`, a `<div>` filling the
     * document area, resolving with its viewer once it shows. The loading
     * overlay covers the area until then; a rejection fails the open, and the
     * container is removed.
     */
    open(
        container: HTMLDivElement,
        request: ExtensionOpenRequest,
        host: ExtensionDocumentHost,
    ): Promise<ExtensionDocumentViewer>;
}

/** An open extension document, as its {@link ExtensionDocument.open} handed it back. */
export interface ExtensionDocumentViewer {
    /** The source format it came from, one of its extension document's `formats`: `"mp4"`, say. `sourceFormat` reports it. */
    readonly sourceFormat: string;
    /** Close it: the host closed it, or another document is opening. Its container is removed after. */
    close(): void;
    /**
     * The theme changed to `theme`. What renders in the container takes the
     * chrome's colors from its CSS variables by itself; this is for what they
     * don't reach, such as a frame's own page.
     */
    setTheme(theme: "light" | "dark"): void;
}

/** What `open` was given, as an {@link ExtensionDocument} is asked about it. */
export interface ExtensionOpenRequest {
    /** The source, as `open` was given it. */
    readonly source: string | URL | Blob | Uint8Array;
    /** The options, as `open` was given them. */
    readonly options: OpenOptions;
    /** A URL source, absolute; `undefined` for a Blob or bytes. */
    readonly url: string | undefined;
    /**
     * The file's name: the `filename` option, else a `File`'s own or a URL's
     * last path segment; `undefined` where none is known.
     */
    readonly name: string | undefined;
    /**
     * The source's first bytes, at most 4 KiB, and the media type the Blob or
     * the response declares (`undefined` where neither does). Read once,
     * whoever asks first; when the engine opens the source, it reads on from
     * there, so a URL is fetched once.
     */
    head(): Promise<{ bytes: Uint8Array; mediaType: string | undefined }>;
}

/** What the shell lends an {@link ExtensionDocument} it opens. */
export interface ExtensionDocumentHost {
    /** The theme it opens in; {@link ExtensionDocumentViewer.setTheme} tells of a change. */
    readonly theme: "light" | "dark";
    /** The language the chrome speaks, a BCP 47 tag. */
    readonly locale: string;
    /**
     * Aborted once another document opens or this one is closed — before
     * `open` resolves, a sign to give up.
     */
    readonly signal: AbortSignal;
    /**
     * Report how far it has read: `loaded` of `total` bytes, `0` when the
     * size isn't known — the loading overlay's bar and `"document:loading"`.
     */
    progress(loaded: number, total: number): void;
}

/** The doc types the engine opens, held to its `UDocType`: an extension document is none of them. */
const ENGINE_DOC_TYPES = {
    portable: true,
    wordprocessing: true,
    presentation: true,
    spreadsheet: true,
    image: true,
} satisfies Record<UDocType, true>;

/** The extension documents registered, and the choice of which opens what. */
export interface ExtensionDocuments {
    /**
     * Register `document`, after those registered before — in place of the
     * one of its doc type, if one was. Throws an `invalidRequest` `UDocError`
     * for one of the engine's doc types.
     */
    register(document: ExtensionDocument): void;
    /**
     * The extension document that opens `request`: given a `format`, the first
     * whose `formats` hold it; given none, the first whose `canOpen` says yes.
     * Null for none, so the engine opens it.
     */
    choose(request: ExtensionOpenRequest): Promise<ExtensionDocument | null>;
}

export function createExtensionDocuments(): ExtensionDocuments {
    const documents: ExtensionDocument[] = [];
    return {
        register(document) {
            if (Object.hasOwn(ENGINE_DOC_TYPES, document.docType)) {
                throw new UDocError(
                    "invalidRequest",
                    `an extension document can't be of the engine's doc type "${document.docType}"`,
                );
            }
            const at = documents.findIndex((registered) => registered.docType === document.docType);
            if (at < 0) documents.push(document);
            else documents[at] = document;
        },
        async choose(request) {
            const format = request.options.format;
            // A format given skips detection: the extension document that
            // reads it, else the engine.
            if (format !== undefined) return documents.find((document) => document.formats.includes(format)) ?? null;
            for (const document of documents) {
                if (await document.canOpen(request)) return document;
            }
            return null;
        },
    };
}
