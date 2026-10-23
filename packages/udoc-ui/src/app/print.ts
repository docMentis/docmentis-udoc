// Printing through the browser, ported from the udoc-viewer's: a hidden iframe
// holds what to print — the PDF itself, for the browser's own viewer to print
// as vectors, or the pages rendered to images, one per sheet — and its window
// is asked to print.

/** How finely a printed page is rendered: 150, 300 or 600 DPI. */
export type PrintQuality = "draft" | "standard" | "high";

/** Options for `print`. Every field is optional; each says its default. */
export interface PrintOptions {
    /** The pages to print, 1-based, in the order printed. Default every page. */
    pages?: readonly number[];
    /** How finely to render the pages. Default `"standard"`. */
    quality?: PrintQuality;
}

/** Dots per inch each quality renders a page at. */
export const PRINT_DPI: Record<PrintQuality, number> = { draft: 150, standard: 300, high: 600 };

/** A page rendered to print: its image, and its size on paper in inches. */
export interface PrintPage {
    url: string;
    width: number;
    height: number;
}

/** Encode `bitmap`, a page rendered at `dpi`, as a PNG to print, and close it. */
export async function printPageOf(bitmap: ImageBitmap, dpi: number): Promise<PrintPage> {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await canvas.convertToBlob({ type: "image/png" });
    return { url: URL.createObjectURL(blob), width: canvas.width / dpi, height: canvas.height / dpi };
}

/**
 * Print the PDF `bytes` through the browser's own PDF viewer — the document's
 * vectors, not a rendering of them. `title` names the print job.
 */
export async function printPdf(bytes: Uint8Array<ArrayBuffer>, title: string | undefined): Promise<void> {
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const frame = hiddenFrame();
    const loaded = new Promise<void>((resolve) => {
        frame.onload = () => resolve();
    });
    frame.src = url;
    await loaded;
    printFrame(frame, title, [url]);
}

/**
 * Print `pages`, each an image filling a sheet of its own size. `title` names
 * the print job. The pages' URLs are revoked once printed.
 */
export async function printImages(pages: readonly PrintPage[], title: string | undefined): Promise<void> {
    const frame = hiddenFrame();
    const doc = frame.contentDocument;
    if (!doc) {
        frame.remove();
        for (const page of pages) URL.revokeObjectURL(page.url);
        throw new Error("print: the print frame has no document");
    }
    // The sheet takes the first page's size, as the viewer's did; a page of
    // another size still fills a sheet of its own.
    const first = pages[0]!;
    const style = doc.createElement("style");
    style.textContent =
        `@page { size: ${first.width}in ${first.height}in; margin: 0; }` +
        "* { margin: 0; padding: 0; }" +
        ".page { overflow: hidden; break-after: page; }" +
        ".page:last-child { break-after: auto; }" +
        "img { display: block; width: 100%; height: 100%; }";
    doc.head.append(style);
    if (title !== undefined) doc.title = title;
    const images = pages.map((page) => {
        const sheet = doc.createElement("div");
        sheet.className = "page";
        sheet.style.width = `${page.width}in`;
        sheet.style.height = `${page.height}in`;
        const image = doc.createElement("img");
        image.src = page.url;
        sheet.append(image);
        doc.body.append(sheet);
        return image;
    });
    await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
    printFrame(
        frame,
        title,
        pages.map((page) => page.url),
    );
}

/** An iframe out of sight, attached so its window can print. */
function hiddenFrame(): HTMLIFrameElement {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.position = "fixed";
    frame.style.left = "-9999px";
    frame.style.top = "-9999px";
    frame.style.width = "0";
    frame.style.height = "0";
    document.body.append(frame);
    return frame;
}

/**
 * Ask `frame`'s window to print, under `title` — the page's title is what a
 * browser names the job — then remove the frame and revoke `urls`.
 */
function printFrame(frame: HTMLIFrameElement, title: string | undefined, urls: readonly string[]): void {
    const pageTitle = document.title;
    if (title !== undefined) document.title = title;
    frame.contentWindow?.print();
    // After the print dialog has taken what it prints, as the viewer did.
    setTimeout(() => {
        document.title = pageTitle;
        for (const url of urls) URL.revokeObjectURL(url);
        frame.remove();
    }, 1000);
}
