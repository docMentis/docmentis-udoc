/**
 * Font **specimens** — a family's name drawn in its own typeface, so the picker
 * shows the face instead of naming it.
 *
 * Two paths, and a family's `sourceType` picks which. Most families the browser
 * can draw itself: a `Local` one it already answers to by name, a `Url` one it
 * loads as a `FontFace`, a `Google` one it pulls from the css2 API. Those rows
 * stay live text — they restyle with the theme, ellipse when the panel is
 * narrow, and read out to a screen reader — and this module's whole job for them
 * is to get the face into `document.fonts` and let the browser repaint on its
 * own.
 *
 * The rest — `Embedded`, `OfficeCompatible`, `AdobeStandard` — have no bytes
 * outside wasm, so nothing here can name them. Those come back from the engine
 * as a PNG **alpha mask** and are held as object URLs for a CSS `mask-image`
 * over `currentColor`: the specimen then takes the theme's text color, and a
 * light/dark switch needs no redraw.
 *
 * A `Url` family's address is **not** in its source type — the tag carries no
 * data at all — so the host supplies it from the same list it registered with
 * `registerUrlFonts`. It is the only side that ever had it.
 *
 * Every family is worked on **once**. The picker asks for its visible window on
 * every scroll step, so `request` has to be cheap to re-call — it is the only
 * thing standing between a flick through ~2000 families and a request storm.
 */

import type { FontSourceType } from "@docmentis/udoc-wasm";
import type { FontPreviewImage } from "../worker/protocol.js";

/**
 * Families per css2 request. One request per visible window beats one per row,
 * and Google serves as many families as the URL holds — this keeps it well
 * inside the ~2000-character limit proxies and browsers agree on, with room for
 * the `text=` list.
 */
const GOOGLE_BATCH = 24;

/** An engine-drawn specimen: a mask to point CSS at, and the box to draw it in. */
export interface FontSpecimen {
    /** Object URL of a PNG whose alpha is the glyph coverage. */
    url: string;
    /** CSS px. */
    width: number;
    /** CSS px. */
    height: number;
    /**
     * The transparent bleed on every side, CSS px. Offset the element by
     * `-bleed` to put the specimen's pen origin where a text row's is — the
     * raster is grown all round to hold overhanging ink.
     */
    bleed: number;
}

export interface FontPreviewLoaderOptions {
    /**
     * Draw a specimen the browser can't — the worker's `renderFontPreview`.
     * Resolving `null` means the engine had nothing to draw; the row keeps the
     * plain name.
     */
    render: (family: string, size: number) => Promise<FontPreviewImage | null>;
    /** The em to draw engine specimens at, in CSS px. */
    size: number;
    /**
     * Where a `Url` family's font actually is, keyed by family — the same
     * addresses the host handed to `registerUrlFonts`. Omit it when the host
     * registered none, which leaves `Url` families showing their plain name.
     */
    urls?: ReadonlyMap<string, string>;
    /** Where css2 is asked for a `Google` family's face — the worker's own. */
    googleFontEndpoint: string;
    /**
     * Called once per batch of arrivals (coalesced to a microtask), so a caller
     * re-renders the rows it has mounted rather than being patched per row.
     * Never called for browser-loaded faces — the browser repaints those itself.
     */
    onSpecimens: () => void;
}

export interface FontPreviewLoader {
    /**
     * Make sure these families can be shown in their own face. Families already
     * worked on are skipped, so calling this on every scroll step is fine.
     */
    request: (families: readonly FontSpecimenRequest[]) => void;
    /**
     * The engine-drawn specimen for `family`, once it has landed.
     *
     * The object URLs behind these are held for the loader's life, which is the
     * page's: a face is drawn once and the picker reopens against the same
     * masks, so there is no point at which revoking one would be right.
     */
    specimen: (family: string) => FontSpecimen | undefined;
}

/** One row's worth of what the loader needs: which family, and whose face it is. */
export interface FontSpecimenRequest {
    family: string;
    sourceType: FontSourceType;
}

/** Whether the engine has to draw this family — nothing outside wasm holds its
 *  bytes. The complement of the three the browser can load itself. */
export function isEngineDrawn(sourceType: FontSourceType): boolean {
    return sourceType === "embedded" || sourceType === "officeCompatible" || sourceType === "adobeStandard";
}

export function createFontPreviewLoader(options: FontPreviewLoaderOptions): FontPreviewLoader {
    /** Families already worked on — the whole request-storm guard. */
    const seen = new Set<string>();
    const specimens = new Map<string, FontSpecimen>();
    /** Whether an `onSpecimens` notification is already queued. */
    let notifying = false;

    // One notification per burst: a window of ~18 rows lands as ~18 separate
    // promises, and re-rendering the list once for all of them beats 18 times.
    const notify = (): void => {
        if (notifying) return;
        notifying = true;
        queueMicrotask(() => {
            notifying = false;
            options.onSpecimens();
        });
    };

    const drawInEngine = (family: string): void => {
        void options
            .render(family, options.size)
            .then((image) => {
                if (!image) return;
                const url = URL.createObjectURL(new Blob([image.png], { type: "image/png" }));
                specimens.set(family, {
                    url,
                    width: image.width,
                    height: image.height,
                    bleed: image.bleed,
                });
                notify();
            })
            .catch(() => {
                // The worker is gone or the document closed. The row keeps the
                // plain name, which is what it showed before this landed.
            });
    };

    const loadUrlFace = (family: string, url: string): void => {
        // A quoted string, not a bare token: family names carry spaces.
        const face = new FontFace(family, `url("${url.replace(/["\\]/g, "\\$&")}")`);
        void face
            .load()
            .then((loaded) => document.fonts.add(loaded))
            .catch(() => {
                // A 404 or a font the browser can't parse. The row falls back to
                // the UI face, which is what it already shows.
            });
    };

    // One stylesheet for the whole batch. `text=` narrows each face to the
    // characters actually drawn — the union of the batch's names — so a window
    // of two dozen specimens costs a few kilobytes rather than two dozen full
    // Latin subsets.
    const loadGoogleFaces = (families: readonly string[]): void => {
        for (let at = 0; at < families.length; at += GOOGLE_BATCH) {
            const batch = families.slice(at, at + GOOGLE_BATCH);
            const text = [...new Set(batch.join(""))].join("");
            const query = batch.map((name) => `family=${encodeURIComponent(name)}`).join("&");
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = `${options.googleFontEndpoint}?${query}&text=${encodeURIComponent(text)}&display=swap`;
            document.head.appendChild(link);
        }
    };

    return {
        request(families) {
            const google: string[] = [];
            for (const { family, sourceType } of families) {
                if (seen.has(family)) continue;
                seen.add(family);
                switch (sourceType) {
                    case "google":
                        google.push(family);
                        break;
                    case "url": {
                        // Only the host ever knew the address; a tag carries none.
                        const url = options.urls?.get(family);
                        if (url) loadUrlFace(family, url);
                        break;
                    }
                    case "local":
                        // The host registered these bytes, so its own text stack
                        // already answers to the name — naming the family in CSS
                        // is the whole of the work. A host that registered an
                        // upload rather than an installed face registers the same
                        // buffer as a `FontFace` under the same name, and this
                        // stays true.
                        break;
                    default:
                        drawInEngine(family);
                        break;
                }
            }
            if (google.length > 0) loadGoogleFaces(google);
        },

        specimen(family) {
            return specimens.get(family);
        },
    };
}

/**
 * `family` as a CSS `font-family` value, quoted and escaped — the form to drop
 * into a style attribute. A family name is arbitrary text (it comes out of a
 * document's font table), so it can't be interpolated raw.
 */
export function cssFontFamily(family: string): string {
    return `"${family.replace(/["\\]/g, "\\$&")}"`;
}
