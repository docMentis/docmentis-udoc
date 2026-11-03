// The web page document: a page framed in an iframe — a host's Figma or Loom
// embeds, say — under a bar with its address and a link to open it in a new
// tab (docs/design/ui-extension-document.md). Built in, it frames a URL
// `open` is given `format: "url"` for, and says yes to none on its own, as one
// that took every URL would frame a PDF the engine should read; a host that
// wants a rule registers `webpageDocument({ canOpen })` in its place.
//
// A site that refuses to be framed (`X-Frame-Options`, `frame-ancestors`)
// leaves the frame without its page — Chrome shows its error page there — and
// the page framing it can't tell that from a slow one, so the link always
// shows. The frame inherits the chrome's `color-scheme`, which a page reads as
// its `prefers-color-scheme`, so a theme change needs nothing from here.
//
// The frame and its bar, `openFramedPage`, are also the Canva and Google
// documents', which frame a service's page for a link.
//
// Nothing here imports a sibling at runtime, so the tests can load it from `src`.

import { UDocError } from "@docmentis/udoc-wasm/error";
import type {
    ExtensionDocument,
    ExtensionDocumentHost,
    ExtensionDocumentOpenRequest,
    ExtensionDocumentViewer,
} from "./extension-documents.js";
import type { I18n } from "./i18n/index.js";

/** How long an open waits for the page to load before showing the frame as it is, loading. */
const LOAD_WAIT_MS = 10_000;

/**
 * What the frame lets a page do: run its scripts, keep its own origin — its
 * cookies and storage — submit forms and open links in new tabs, unsandboxed.
 * Not navigate the host's page, open dialogs or download.
 */
const SANDBOX = "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox";

/** The browser features the frame lets a page use: those a page's media and copy buttons want. */
const ALLOW = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";

/** What {@link webpageDocument} is given. */
export interface WebpageDocumentOptions {
    /**
     * Whether the URL `open` was given is a page to frame: the host's own
     * rule — its Figma or Loom embeds, say. Asked only of a URL source, when
     * `open` was given no `format`. Without it, the web page document frames
     * only a URL given `format: "url"`.
     */
    canOpen?(request: ExtensionDocumentOpenRequest & { readonly url: string }): boolean | Promise<boolean>;
}

/**
 * A web page document, `docType` `"webpage"`: a page framed in an iframe,
 * under a bar with its address and a link to open it in a new tab. Its one
 * format is `"url"`.
 *
 * One is built in, with no `canOpen`: `open(url, { format: "url" })` frames a
 * page, and a URL given no `format` is never taken for one, as taking every URL
 * would frame a PDF the engine should read. To frame some URLs without a
 * `format` — a host's Figma or Loom embeds, say — register one with a
 * `canOpen` saying which, with the `extensionDocuments` option or
 * `registerExtensionDocument`; it replaces the built-in one.
 *
 * A site that refuses to be framed leaves the frame without its page, which
 * the page framing it can't tell from a slow one, so the link always shows.
 * The frame is sandboxed: a page runs its scripts, keeps its own origin,
 * submits forms and opens links in new tabs, and may autoplay, copy, play
 * encrypted media and go full screen or picture-in-picture — but not navigate
 * the host's page. A page from the host's own origin isn't held by it: allowed
 * its scripts and its origin, it can lift the sandbox. A page follows the
 * theme through its `prefers-color-scheme`.
 */
export function webpageDocument(options: WebpageDocumentOptions = {}): ExtensionDocument {
    const rule = options.canOpen;
    return {
        docType: "webpage",
        formats: ["url"],
        canOpen: async (request) =>
            rule !== undefined && request.url !== undefined && (await rule({ ...request, url: request.url })),
        open: async (container, request, host) => {
            if (request.url === undefined) throw new UDocError("unsupported", "a web page opens from its URL");
            return openFramedPage(container, { url: request.url, address: request.url, sourceFormat: "url" }, host);
        },
    };
}

/** The chrome's words, by the host lent each open: the host's `translations` laid over them. */
const chromeWords = new WeakMap<ExtensionDocumentHost, I18n>();

/** Lend `host`'s open the chrome's words, `i18n`: the shell's call, as it makes the host. */
export function lendChromeWords(host: ExtensionDocumentHost, i18n: I18n): void {
    chromeWords.set(host, i18n);
}

/** The chrome's words lent with `host`. */
function wordsOf(host: ExtensionDocumentHost): I18n {
    const words = chromeWords.get(host);
    if (!words) throw new UDocError("invalidRequest", "a framed page opens in the viewer or the editor");
    return words;
}

/** What {@link openFramedPage} shows. */
export interface FramedPage {
    /** The address the frame loads. */
    readonly url: string;
    /** The address the bar shows and links: what `open` was given, which a service's page may not be. */
    readonly address: string;
    /** The source format its viewer reports. */
    readonly sourceFormat: string;
}

/** Frame `page` in `container` under its bar, resolving once it loads, or the wait runs out. */
export async function openFramedPage(
    container: HTMLDivElement,
    page: FramedPage,
    host: ExtensionDocumentHost,
): Promise<ExtensionDocumentViewer> {
    const words = wordsOf(host);
    const { url, address: shown, sourceFormat } = page;
    const area = document.createElement("div");
    area.className = "udoc-ui__webpage-document";
    const bar = document.createElement("div");
    bar.className = "udoc-ui__webpage-document-bar";
    const address = document.createElement("span");
    address.className = "udoc-ui__webpage-document-address";
    address.dir = "ltr";
    address.textContent = shown;
    address.title = shown;
    const link = document.createElement("a");
    link.className = "udoc-ui__webpage-document-open";
    link.href = shown;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = words.t("webpage.openInNewTab");
    bar.append(address, link);
    const frame = document.createElement("iframe");
    frame.className = "udoc-ui__webpage-document-frame";
    frame.title = shown;
    frame.setAttribute("sandbox", SANDBOX);
    frame.allow = ALLOW;
    const loading = load(frame, host.signal);
    frame.src = url;
    area.append(bar, frame);
    container.append(area);
    // The frame's page goes with it.
    const close = (): void => area.remove();
    try {
        // Another document opened, or this one closed: given up.
        if ((await loading) === "aborted") host.signal.throwIfAborted();
    } catch (error) {
        close();
        throw error;
    }
    return {
        sourceFormat,
        close,
        // The page follows the chrome by itself (see the top of the file).
        setTheme: () => {},
    };
}

/**
 * How `frame`'s open ends: its page loaded — or the browser's error page, for
 * one refused — `signal` aborted, or {@link LOAD_WAIT_MS} gone by: a slow page
 * shows as it loads.
 */
function load(frame: HTMLIFrameElement, signal: AbortSignal): Promise<"loaded" | "aborted" | "waited"> {
    if (signal.aborted) return Promise.resolve("aborted");
    return new Promise((resolve) => {
        const done = (how: "loaded" | "aborted" | "waited"): void => {
            frame.removeEventListener("load", onLoad);
            signal.removeEventListener("abort", onAbort);
            clearTimeout(timer);
            resolve(how);
        };
        const onLoad = (): void => done("loaded");
        const onAbort = (): void => done("aborted");
        const timer = setTimeout(() => done("waited"), LOAD_WAIT_MS);
        frame.addEventListener("load", onLoad);
        signal.addEventListener("abort", onAbort);
    });
}
