// What edit mode builds on the shell's host once mounted: the edits the ribbon's
// controls and the menus make, the clipboard, and the write-side memory they
// share.
import { createArrangeEdits } from "./arrange.js";
import type { ArrangeEdits } from "./arrange.js";
import { createClipboard } from "./clipboard.js";
import type { Clipboard } from "./clipboard.js";
import { createLastListStyle, FONT_SPECIMEN_EM } from "./components/TextControls.js";
import type { EditHost } from "./edit-client.js";
import { createFontPreviewLoader } from "./fonts/preview.js";
import type { FontPreviewLoader } from "./fonts/preview.js";
import type { I18n } from "./i18n/index.js";
import { createPaintEdits, createPaintMemory } from "./paint.js";
import type { PaintEdits, PaintMemory } from "./paint.js";
import { updateEditState } from "./state.js";
import { createTextEdits } from "./text-format.js";
import type { ListKind, ListStyle, TextEdits } from "./text-format.js";

export interface EditTools {
    readonly host: EditHost;
    readonly i18n: I18n;
    readonly paint: PaintEdits;
    readonly text: TextEdits;
    readonly arrange: ArrangeEdits;
    readonly clipboard: Clipboard;
    readonly paintMemory: PaintMemory;
    /** The style each list button's main region applies. */
    readonly lastListStyle: Record<ListKind, ListStyle>;
    /** The font picker's specimens. One loader for edit mode's life — a face
     *  loaded into the browser stays loaded across documents. */
    readonly fontPreviews: FontPreviewLoader;
    /** Call `listener` on each batch of specimens landing; returns the unlisten. */
    onSpecimens(listener: () => void): () => void;
    /**
     * Pull the loaded font families — the picker's first section.
     *
     * Unlike the full list this is *not* cached on open: fonts materialize
     * lazily, so the set grows all through a session as compose-ahead walks the
     * document and as fonts are picked. The picker re-pulls on every open, which
     * is a cheap read and the only moment the answer is looked at.
     */
    refreshLoadedFontFamilies(): Promise<void>;
}

/** The {@link EditTools} over `host`. */
export function createEditTools(host: EditHost, i18n: I18n): EditTools {
    const specimenListeners = new Set<() => void>();
    return {
        host,
        i18n,
        paint: createPaintEdits(host),
        text: createTextEdits(host, i18n),
        arrange: createArrangeEdits(host),
        clipboard: createClipboard(host),
        paintMemory: createPaintMemory(),
        lastListStyle: createLastListStyle(),
        fontPreviews: createFontPreviewLoader({
            render: (family, size) => host.edit.renderFontPreview(family, false, false, family, size).catch(() => null),
            size: FONT_SPECIMEN_EM,
            googleFontEndpoint: host.client.googleFontEndpoint,
            onSpecimens: () => {
                for (const listener of specimenListeners) listener();
            },
        }),
        onSpecimens(listener) {
            specimenListeners.add(listener);
            return () => specimenListeners.delete(listener);
        },
        async refreshLoadedFontFamilies() {
            updateEditState(host.store, { loadedFontFamilyNames: await host.edit.loadedFontFamilyNames() });
        },
    };
}
