/**
 * Per-document-type UI profiles.
 *
 * A document type (`"portable"`, `"presentation"`, …) selects a
 * {@link DocProfile} that declares the chrome
 * that doc type gets: its view-mode toolbar tabs and which built-in overlays
 * apply. The shell and toolbars read the profile for the open document's
 * `docType` instead of hardcoding a single (PDF) shape — the TS analog of the
 * facade's per-doc-type modules.
 *
 * Each editable doc type gets its own entry ({@link PORTABLE_PROFILE},
 * {@link PRESENTATION_PROFILE}, {@link WORDPROCESSING_PROFILE}, …); an unknown
 * or not-yet-profiled doc type falls back to {@link FALLBACK_PROFILE}. Adding a
 * doc type is one entry here — the rest of the UI doesn't change.
 */
import { ANNOTATE_COMMANDS, LEFT_PANEL_TABS, RIGHT_PANEL_TABS } from "./state.js";
import type { UIState, LayoutMode, LeftPanelTab, PanelTab, RightPanelTab, ToolbarTab } from "./state.js";
import type { Feature, UDocType } from "@docmentis/udoc-wasm";

/**
 * The Annotate tab — the tools that draw a PDF annotation over the page (see
 * {@link ANNOTATE_COMMANDS}). An edit of the document's annotations, not its
 * content, so it serves both edit mode and view mode.
 */
export const ANNOTATE_TAB: ToolbarTab = {
    id: "annotate",
    label: "ribbon.annotate",
    commands: ANNOTATE_COMMANDS,
    feature: "annotation",
};

/**
 * The chrome one document type gets. Selected by `docType` (see
 * {@link profileFor}); read by the toolbars (tabs) and the shell (overlays).
 */
export interface DocProfile {
    /** The toolbar's tab strip in view mode for this doc type; an extension's
     *  modes bring their own. */
    viewTabs: readonly ToolbarTab[];
    /**
     * Whether this doc type shows the bottom sheet-tab bar — one tab per layout
     * plane, switching the viewer's current plane. Spreadsheets only (a workbook
     * is the multi-plane document); every other doc type is single-plane and
     * hides it. When set, the shell keeps the status bar visible to host the
     * tabs even when the view controls dock elsewhere.
     */
    sheetTabs: boolean;
    /**
     * The left-panel navigator tabs this doc type offers, in render order — a
     * subset of {@link LEFT_PANEL_TABS}. A PDF exposes the full strip
     * (thumbnails, outline, layers, attachments); a deck, a word document and an
     * image only the thumbnails, the rest reading PDF parts they don't have; a
     * spreadsheet offers none — its navigation is the bottom sheet-tab bar (see
     * {@link sheetTabs}) and the page/PDF-shaped navigators don't map to a grid —
     * so its left panel and the toolbar's panel menu button drop out entirely.
     * Any tab outside this list is treated as disabled (hidden from the UI).
     */
    leftPanels: readonly LeftPanelTab[];
    /**
     * The right panel's tabs this doc type offers — a subset of
     * {@link RIGHT_PANEL_TABS}, treated as {@link leftPanels} is. Comments are a
     * PDF's annotations, so only the portable type offers them; an image, with
     * no text to search, offers none.
     */
    rightPanels: readonly RightPanelTab[];
    /**
     * Whether this doc type's text is editable in place — a caret in a shape
     * accepts typing (the hidden text input activates). Presentation and PDF
     * (the portable engine's line-structured text) today; the rest is
     * selection-only until their text model lands.
     */
    textEditing: boolean;
    /**
     * Whether the view controls carry the paged sections — page navigation and
     * the view-mode menu (scroll, layout, rotation). A page/slide stack (PDF,
     * PPTX) shows the full page-nav + zoom + view-mode bar in the configured
     * placement. A grid document (spreadsheet) has no page stack to scroll,
     * group or turn, so it drops both and shows zoom only, pinned to the status
     * bar beside its sheet tabs (see the shell's placement resolution).
     */
    pagedViewControls: boolean;
    /**
     * Whether the view settings offer the page arrangement — Layout, Rotation
     * and Page Gap. A document read as a book of pages (PDF, Word) does; a deck
     * and an image keep their pages single, upright and apart, whatever those
     * settings hold (see {@link arrangementFor}).
     */
    pageArrangement: boolean;
    /**
     * The guide band this doc type reserves around the content pane — a
     * spreadsheet's row/column `"header"` — or `null` for one with none of its
     * own (an extension's band may still be drawn there). Host-static: it's
     * what the engine's `guide()` projects for this type, known from the type
     * alone, so the host reserves the band strip up front — before the first
     * painted frame — and the content pane is measured once.
     */
    guide: "header" | null;
    /**
     * Whether this doc type's scrollbars take gutters beside the document
     * instead of floating over it: the engine keeps a strip clear along the
     * pane's right / bottom edge while a bar shows, in the frame it paints, and
     * centres the page beside it (see the canvas's `applyScrollbarMode`). A page
     * stack (PDF, Word, PowerPoint) or an image takes them, so a bar never
     * covers the page edge — where selection handles and the page rail live. A
     * grid keeps floating bars: its cells run to the pane's edge at every zoom,
     * so a gutter would read as a blank strip cut out of the sheet.
     *
     * Host-static like {@link guide}: known from the doc type alone, applied with
     * the band reservation, never flipped mid-document.
     */
    scrollbarGutters: boolean;
    /**
     * What the chrome calls one page of this doc type — "Slide" in a deck,
     * "Page" everywhere else: the thumbnails, the page navigation, the search
     * results and the print dialog all name it.
     */
    pageNoun: "Page" | "Slide";
}

/**
 * The doc type with no specific profile — an unknown/empty `docType`, or any
 * format without its own entry yet. Keeps the standard authoring tabs but no
 * page-control overlay (page reordering is portable-only for now).
 */
export const FALLBACK_PROFILE: DocProfile = {
    viewTabs: [],
    sheetTabs: false,
    leftPanels: LEFT_PANEL_TABS,
    rightPanels: ["search"],
    textEditing: false,
    pagedViewControls: true,
    pageArrangement: false,
    // No band for an unprofiled type; a known paged type opts into the ruler
    // explicitly below.
    guide: null,
    // Gutters, like the page stacks.
    scrollbarGutters: true,
    // Unknown type: no theme model to offer, so standard colors only.
    pageNoun: "Page",
};

/**
 * The image document type — a stack of image pages, with no text to edit and
 * no page-control overlay.
 */
export const IMAGE_PROFILE: DocProfile = {
    viewTabs: [],
    sheetTabs: false,
    // The outline, layers and attachments read PDF parts.
    leftPanels: ["thumbnail"],
    // An image has no text to search.
    rightPanels: [],
    textEditing: false,
    pagedViewControls: true,
    pageArrangement: false,
    // An image projects no guide.
    guide: null,
    // Gutters, like the page stacks.
    scrollbarGutters: true,
    // Device colors, no theme model — standard swatches only.
    pageNoun: "Page",
};

/** The portable (PDF) document type — the only one with real editing today. */
export const PORTABLE_PROFILE: DocProfile = {
    viewTabs: [ANNOTATE_TAB],
    sheetTabs: false,
    leftPanels: LEFT_PANEL_TABS,
    rightPanels: RIGHT_PANEL_TABS,
    // A caret in a text object accepts typing / backspace / delete — the
    // portable text model edits in place (v0: within one line; arrow-key caret
    // movement and Enter/line-splitting are still deferred, see TODO.md).
    textEditing: true,
    pagedViewControls: true,
    pageArrangement: true,
    guide: null,
    scrollbarGutters: true,
    // PDF carries device colors, not a DrawingML theme — standard swatches only.
    pageNoun: "Page",
};

/**
 * The presentation (PPTX) document type. Carries the Text and Shape tabs (its
 * free-floating shapes) but no page-control overlay — slide structure lives in
 * the Thumbnails navigator, not a page-control strip.
 */
export const PRESENTATION_PROFILE: DocProfile = {
    viewTabs: [],
    sheetTabs: false,
    // The outline, layers and attachments read PDF parts.
    leftPanels: ["thumbnail"],
    rightPanels: ["search"],
    textEditing: true,
    pagedViewControls: true,
    pageArrangement: false,
    guide: null,
    scrollbarGutters: true,
    // A deck re-themes per slide; the picker shows the current slide's palette.
    pageNoun: "Slide",
};

/**
 * The spreadsheet (XLSX) document type. A workbook is the multi-plane document —
 * one plane per sheet — so it's the only profile that turns on the bottom
 * sheet-tab bar. Keeps the standard authoring tabs; no page-control overlay
 * (a sheet is a scrolling grid, not a page stack). A grid has no page stack or
 * paged/continuous view, so its view controls are zoom-only, docked in the
 * status bar beside the sheet tabs rather than in a floating page-nav bar.
 */
export const SPREADSHEET_PROFILE: DocProfile = {
    viewTabs: [],
    sheetTabs: true,
    // No left-panel navigators — a workbook is a grid, not a page/slide stack, so
    // thumbnails / outline / layers / attachments don't apply; its navigation is
    // the bottom sheet-tab bar (`sheetTabs`). With every tab omitted the left
    // panel and its toolbar menu button drop out entirely.
    leftPanels: [],
    rightPanels: ["search"],
    textEditing: false,
    pagedViewControls: false,
    pageArrangement: false,
    guide: "header",
    // The sheet fills the pane edge to edge, so its bars float over the grid
    // rather than carving gutters out of it.
    scrollbarGutters: false,
    // A workbook carries a DrawingML theme; its color pickers offer it.
    pageNoun: "Page",
};

/**
 * The wordprocessing (DOCX) document type. Its body is flow text that edits in
 * place — a caret in the text accepts caret movement / typing (the hidden text
 * input activates), so `textEditing` is on even though the caret sits in the
 * page flow, not a free-floating object. A page stack with the paged/continuous
 * view; no shape-authoring tab yet and no page-control overlay (pages derive
 * from the flow, they don't reorder).
 */
export const WORDPROCESSING_PROFILE: DocProfile = {
    viewTabs: [],
    sheetTabs: false,
    // The outline, layers and attachments read PDF parts.
    leftPanels: ["thumbnail"],
    rightPanels: ["search"],
    textEditing: true,
    pagedViewControls: true,
    pageArrangement: true,
    guide: null,
    scrollbarGutters: true,
    // Word carries a single DrawingML theme (`w:clrSchemeMapping`); the Text
    // Color picker offers it, resolved once at open (it doesn't re-theme).
    pageNoun: "Page",
};

/** Profiles by `docType`. */
const PROFILES: Partial<Record<UDocType, DocProfile>> = {
    image: IMAGE_PROFILE,
    portable: PORTABLE_PROFILE,
    wordprocessing: WORDPROCESSING_PROFILE,
    presentation: PRESENTATION_PROFILE,
    spreadsheet: SPREADSHEET_PROFILE,
};

/** The profile for `docType`, or {@link FALLBACK_PROFILE} when none matches. */
export function profileFor(docType: UDocType | null): DocProfile {
    return (docType !== null && PROFILES[docType]) || FALLBACK_PROFILE;
}

/**
 * The arrangement the open document is shown in: the view settings' layout,
 * rotation and page gap where its doc type offers them
 * ({@link DocProfile.pageArrangement} — PDF, Word), else single, upright pages
 * with their gaps.
 */
export function arrangementFor(state: UIState): {
    layoutMode: LayoutMode;
    pageRotation: 0 | 90 | 180 | 270;
    showPageGap: boolean;
} {
    if (!profileFor(state.docType).pageArrangement) {
        return { layoutMode: "singlePage", pageRotation: 0, showPageGap: true };
    }
    return { layoutMode: state.layoutMode, pageRotation: state.pageRotation, showPageGap: state.showPageGap };
}

/** The tab strip `docType` shows in `mode`: the profile's in view mode, an
 *  extension's in its own mode. */
export type TabSource = (docType: UDocType | null, mode: string) => readonly ToolbarTab<string>[];

/** Whether a session entitled to `features` may be in `mode` — view mode
 *  always, an extension's as its feature says. */
export type ModeEntitlement = (mode: string, features: readonly Feature[]) => boolean;

/** `tabs` less the tabs whose feature a session entitled to `features` lacks. */
export function tabsFor(
    tabs: readonly ToolbarTab<string>[],
    features: readonly Feature[],
): readonly ToolbarTab<string>[] {
    const offered = (tab: ToolbarTab<string>) => tab.feature === undefined || features.includes(tab.feature);
    return tabs.every(offered) ? tabs : tabs.filter(offered);
}

/** The tab a strip of `tabs` opens on — Home, or null (the ribbon folded, its
 *  tabs alone showing) in a strip without one. Home needs no feature. */
export function defaultTab(tabs: readonly ToolbarTab<string>[]): string | null {
    return tabs.find((t) => t.id === "home")?.id ?? null;
}

/**
 * The side-panel tabs `docType` drops from its chrome — the doc-type share of
 * the state's `disabledPanels`, seeded when a document opens. Derived as the
 * complement of the profile's {@link DocProfile.leftPanels} and
 * {@link DocProfile.rightPanels}: a PDF drops no navigator, the other paged
 * and slide types all but the thumbnails, a spreadsheet the whole strip; all but
 * a PDF drop Comments, and an image Search too.
 */
export function profileDisabledPanels(docType: UDocType | null): readonly PanelTab[] {
    const profile = profileFor(docType);
    const offered = new Set<PanelTab>([...profile.leftPanels, ...profile.rightPanels]);
    return [...LEFT_PANEL_TABS, ...RIGHT_PANEL_TABS].filter((tab) => !offered.has(tab));
}
