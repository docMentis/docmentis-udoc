// Following what an outline item or a link points at: its destination, or its
// action's. The engine lands the view on a destination in the document; a URL
// goes to whoever opens it — a new browser tab, or the host.

import type {
    Action as PdfAction,
    ActionHideTarget,
    Destination,
    DestinationView,
    ScrollAlignment,
    TextHyperlink,
} from "@docmentis/udoc-wasm";
import type { Store } from "../framework/index.js";
import type { Fit } from "../geometry.js";
import type { WorkerClient } from "../worker/WorkerClient.js";
import type { Action } from "./actions.js";
import type { UIState } from "./state.js";
import { NO_FIT, pageStep } from "./state.js";

/**
 * Follow an outline item, a link or a widget's action — `target`, whose
 * `/Dest` and `/A` they hold alike: its destination, else its action's — a
 * `GoTo` lands the view through the engine, its point by `alignment` (the
 * standing navigation alignment unless given): a `Fit`, `FitH` or `FitV` sets
 * the zoom menu's fit page, width or height ({@link viewFit}), and any other
 * landing that set the zoom turns the zoom mode custom, as a marquee zoom's
 * does; a `URI` goes to
 * `openUrl`; a named action moves a page as Table 215 has every viewer do
 * ({@link namedPage}); a `Hide` hides or shows its annotations through the
 * engine. Any other action does nothing yet. Rejects when the worker is torn
 * down under the call.
 */
export async function follow(
    client: WorkerClient,
    store: Store<UIState, Action>,
    target: { action: PdfAction | null; destination: Destination | null },
    openUrl: (url: string) => void,
    alignment: ScrollAlignment = store.getState().navigationScrollAlignment,
): Promise<void> {
    const destination = target.destination ?? goToDestination(target.action);
    if (!destination) {
        const url = uriOf(target.action);
        const page = namedPage(store.getState(), target.action);
        const hide = hideOf(target.action);
        if (url) openUrl(url);
        else if (page !== null) store.dispatch({ type: "NAVIGATE_TO_PAGE", page });
        else if (hide) await client.portable.hideAnnotations(hide.targets, hide.hide ?? true);
        return;
    }
    const view = await client.portable.goToDestination(destination, alignment);
    const fit = view && viewFit(view);
    // The engine set the fit as it landed: record it, without the re-send that
    // would re-frame the page and undo a `FitH`'s top.
    if (fit) store.dispatch({ type: "SET_FIT", fit, reframe: false });
    else if (view && setsZoom(view) && store.getState().fit.mode !== "none") {
        store.dispatch({ type: "SET_FIT", fit: NO_FIT });
    }
}

/** The URL a click on `target` opens, or `null` where it goes to a place in the
 *  document instead, or nowhere — what {@link follow} would open. */
export function urlOf(target: { action: PdfAction | null; destination: Destination | null }): string | null {
    if (target.destination ?? goToDestination(target.action)) return null;
    return uriOf(target.action);
}

/** The URL a click on a text run's `link` opens — a word document's or a
 *  slide's: its target's, for a plain link and for one opening a file or
 *  another presentation — or `null` where it goes to a place in the document
 *  instead, does something else, or nothing. */
export function textLinkUrl(link: TextHyperlink): string | null {
    const { target, action } = link;
    if (target == null || !("url" in target)) return null;
    const opens = action == null || action === "file" || (typeof action === "object" && "presentation" in action);
    return opens ? target.url : null;
}

/** Whether a click on a text run's `link` goes anywhere this viewer can take
 *  it: a URL it opens ({@link textLinkUrl}), a bookmark, a slide of this deck,
 *  or a move within the show other than ending it. A program, a macro, an OLE
 *  verb, media, a custom show and no action go nowhere a viewer can follow. */
export function textLinkFollows(link: TextHyperlink): boolean {
    if (textLinkUrl(link) !== null) return true;
    const { target, action } = link;
    if (action == null || action === "slideJump") return target != null && !("url" in target);
    return typeof action === "object" && "showJump" in action && action.showJump !== "endShow";
}

/** A `GoTo` action's destination, or `null` for any other action — some of
 *  which serialize as a bare string, which `in` can't test. */
function goToDestination(action: PdfAction | null): Destination | null {
    return typeof action === "object" && action && "goTo" in action ? action.goTo.destination : null;
}

/** A `URI` action's URI, or `null` for any other action. */
function uriOf(action: PdfAction | null): string | null {
    return typeof action === "object" && action && "uri" in action ? action.uri.uri : null;
}

/** The page (1-based) a named action moves to — one of the four Table 215 has
 *  every viewer support, the next and the previous as the page buttons step —
 *  or `null` for any other name or action, and a move past either end. A
 *  viewer that doesn't know a name takes no action (§12.6.4.12). */
function namedPage(state: UIState, action: PdfAction | null): number | null {
    const name = typeof action === "object" && action && "named" in action ? action.named.name : null;
    const last = state.composedPageCount;
    switch (name) {
        case "NextPage":
            return pageStep(state, 1);
        case "PrevPage":
            return pageStep(state, -1);
        case "FirstPage":
            return last > 0 ? 1 : null;
        case "LastPage":
            return last > 0 ? last : null;
        default:
            return null;
    }
}

/** A `Hide` action's targets and whether it hides them — `/H`, `true` when
 *  absent — or `null` for any other action. */
function hideOf(action: PdfAction | null): { targets: ActionHideTarget[]; hide: boolean | null } | null {
    return typeof action === "object" && action && "hide" in action ? action.hide : null;
}

/** The view's own fit a destination's `view` is — fit page, fit width or fit
 *  height, as the zoom menu sets it — or `null` for a view no fit of the
 *  view's measures: an `/XYZ`, a rect, a bounding box. */
function viewFit(view: DestinationView): Fit | null {
    if (view === "fit") return { mode: "both", zoomCap: null };
    if (typeof view === "object" && "fitH" in view) return { mode: "width", zoomCap: null };
    if (typeof view === "object" && "fitV" in view) return { mode: "height", zoomCap: null };
    return null;
}

/** Whether a landing by `view` set the zoom: every view but an `/XYZ` with no
 *  zoom (or zoom 0, which the spec reads as none). */
function setsZoom(view: DestinationView): boolean {
    return typeof view === "object" && "xyz" in view ? (view.xyz.zoom ?? 0) > 0 : true;
}
