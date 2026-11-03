import type { ExtensionDocument, ExtensionDocumentOpenRequest } from "@docmentis/udoc-viewer";

/** A JSON file, shown indented: an extension document of doc type `"json"`. */
export const jsonDocument: ExtensionDocument = {
    docType: "json",
    formats: ["json"],

    // Asked when `open` is given no `format`. The name settles most sources
    // without reading them; the rest by the media type they declare.
    async canOpen(request) {
        if (request.name?.toLowerCase().endsWith(".json")) return true;
        const { mediaType } = await request.head();
        return mediaType === "application/json";
    },

    async open(container, request, host) {
        const text = await readText(request, host.signal);
        const pre = document.createElement("pre");
        pre.textContent = JSON.stringify(JSON.parse(text), null, 2);
        // The UI's colors, so it follows the theme by itself.
        pre.style.cssText =
            "box-sizing: border-box; height: 100%; margin: 0; padding: 16px; overflow: auto;" +
            "background: var(--udoc-color-surface-container-high); color: var(--udoc-color-on-surface);";
        container.append(pre);
        return {
            sourceFormat: "json",
            close: () => pre.remove(),
            setTheme: () => {},
        };
    },
};

/** The text of the source `open` was given, a fetch of a URL given up on once `signal` aborts. */
async function readText(request: ExtensionDocumentOpenRequest, signal: AbortSignal): Promise<string> {
    const { source } = request;
    if (source instanceof Blob) return source.text();
    if (source instanceof Uint8Array) return new TextDecoder().decode(source);
    const response = await fetch(source, { signal });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.text();
}
