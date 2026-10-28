// Codec for the typed `UDocSelection` the wasm `setSelection` / `selection`
// seam uses — the agnostic presence path that replaced the per-doc-type select
// verbs. The boundary is typed (`setSelection(UDocSelection)` /
// `selection(): UDocSelection`), so this builds and reads the object directly —
// no `JSON.stringify` / `JSON.parse`. `UDocSelection` is externally tagged by
// doc type (`{ portable: … }`), and the inner `PortableSelection` is
// `{ objects: { page, ids } }` for a set or the bare string `"none"` for the
// empty selection. A portable selection is confined to one page, so it carries
// that page beside its ids — the page twin of a presentation selection's slide.
// Ids are `replica-counter` keys.

import type { UDocSelection } from "@docmentis/udoc-wasm";

/** A portable object selection: the page it sits on (its hex key) and the
 *  selected object ids. Confined to one page, so the page rides with it — an
 *  object gesture names that page without any lookup. */
export interface PortableObjects {
    page: string;
    ids: string[];
}

/** The doc-type-tagged `UDocSelection` for a portable object selection on
 *  `page` — `{ portable: { objects: { page, ids } } }`, or `{ portable: "none" }`
 *  when `ids` is empty (which clears). The host stamps in ids it minted or read
 *  back from {@link portableObjects}. */
function objects(page: string, ids: string[]): UDocSelection {
    return { portable: ids.length ? { objects: { page, ids } } : "none" };
}

/** The selected object ids read from a `UDocSelection` (the wasm `selection()`
 *  read), or `[]` when nothing is selected, the selection isn't a portable
 *  object selection, or no document is open (`undefined`). */
function objectIds(selection: UDocSelection | undefined): string[] {
    return portableObjects(selection)?.ids ?? [];
}

/** The page + annotation ids read from a `UDocSelection`, or `null` when it
 *  isn't a portable annotation selection, or no document is open. */
function annotations(selection: UDocSelection | undefined): PortableObjects | null {
    if (!selection || !("portable" in selection)) return null;
    const portable = selection.portable;
    if (portable === "none" || !("annotations" in portable)) return null;
    const { page, ids } = portable.annotations;
    return ids.length > 0 ? { page, ids } : null;
}

/** The section ids read from a `UDocSelection` — a deck's section selection —
 *  or `[]` for any other selection, or with no document open. */
function slideSections(selection: UDocSelection | undefined): string[] {
    if (!selection || !("presentation" in selection)) return [];
    const presentation = selection.presentation;
    return presentation !== "none" && "slideSections" in presentation ? presentation.slideSections.ids : [];
}

/** The page + object ids read from a `UDocSelection`, or `null` when nothing is
 *  selected, it isn't a portable object selection, or no document is open. */
function portableObjects(selection: UDocSelection | undefined): PortableObjects | null {
    if (!selection || !("portable" in selection)) return null;
    const portable = selection.portable;
    if (portable === "none" || !("objects" in portable)) return null;
    const { page, ids } = portable.objects;
    return ids.length > 0 ? { page, ids } : null;
}

/** Selection codec for the presence channel — build a `setSelection` payload
 *  ({@link objects}) and read ids back from a `selection()` JSON
 *  ({@link objectIds}, {@link annotations}, {@link slideSections}). Resolving the selection to a *command* (which slide /
 *  page, which ids) is no longer the worker's job — a `SelectionEdit` crosses
 *  the boundary id-free and the engine binds it (see
 *  `session.executeOnSelection`). */
export const Selection = { objects, objectIds, annotations, slideSections };
