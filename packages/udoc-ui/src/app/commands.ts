import type { HistoryOp, SelectionEdit } from "../worker/protocol.js";
import type { StampIcon, UDocType } from "@docmentis/udoc-wasm";
import { allowsEdit } from "../geometry.js";
import type { SelectionCapabilities, SelectionEditKind } from "../geometry.js";
import { copyAllowed, PAGELESS_PLANE } from "./state.js";
import type {
    AnnotationTool,
    CommandId,
    UIState,
    MarkupTool,
    PlaceTool,
    PresentationView,
    ScrollMode,
} from "./state.js";
import type { Store } from "../framework/index.js";
import type { Action } from "./actions.js";
import type { Shortcut } from "./components/controls.js";
import { annotationFormat } from "./annotations.js";
import type { AnnotationFormat, AnnotationStyleChange } from "./annotations.js";
import type { Message, MessageKey } from "./i18n/index.js";
import { STANDARD_COLORS } from "./components/PaintPanel.js";
import {
    ICON_COPY,
    ICON_DELETE,
    ICON_PAGE_ADD,
    ICON_PAGE_DUPLICATE,
    ICON_ROTATE_LEFT,
    ICON_ROTATE_RIGHT,
    ICON_SECTION_ADD,
    ICON_SECTION_DOWN,
    ICON_SECTION_REMOVE,
    ICON_SECTION_RENAME,
    ICON_SECTION_UP,
    ICON_SECTIONS_COLLAPSE,
    ICON_SECTIONS_EXPAND,
    ICON_SHEET_ADD,
    ICON_SHEET_HIDE,
    ICON_SHEET_RENAME,
    ICON_SHEET_TAB_COLOR,
    ICON_SHEET_UNHIDE,
    ICON_SLIDE_HIDE,
    ICON_UNDO,
    ICON_REDO,
    ICON_SUBTOOL_TEXTBOX,
    ICON_SUBTOOL_RECTANGLE,
    ICON_SUBTOOL_ELLIPSE,
    ICON_SUBTOOL_LINE,
    ICON_SUBTOOL_ARROW,
    ICON_SUBTOOL_POLYGON,
    ICON_SUBTOOL_POLYLINE,
    ICON_SUBTOOL_CLOUD,
    ICON_NOTES,
    ICON_NOTES_PAGE_VIEW,
    ICON_NORMAL_VIEW,
    ICON_PAGES_VIEW,
    ICON_PAGELESS_VIEW,
    ICON_SUBTOOL_HIGHLIGHT,
    ICON_FILL,
    ICON_STROKE,
    ICON_SUBTOOL_FREEHAND,
    ICON_SUBTOOL_UNDERLINE,
    ICON_SUBTOOL_STRIKETHROUGH,
    ICON_SUBTOOL_SQUIGGLY,
    ICON_SUBTOOL_NOTE,
    ICON_SUBTOOL_STAMP,
    ICON_SHAPES,
    ICON_OPACITY,
} from "./icons.js";

/**
 * The flat read-model every {@link CommandDef.enabledWhen} / {@link MenuItem.enabledWhen}
 * predicate reads — derived once per render from {@link UIState} by
 * {@link commandContext}. It carries only what *enablement* depends on: whether
 * a document is ready, undo/redo availability, and the engine's selection-command
 * capability verdict ({@link SelectionCapabilities}).
 *
 * This is the engine's half only. UI *policy* — mode scoping, host-disabled
 * commands ({@link UIState.disabledCommands}) — is applied by the toolbar
 * separately; final enablement is `enabledWhen(ctx) && uiPolicy`.
 */
export interface CommandContext {
    ready: boolean;
    canUndo: boolean;
    canRedo: boolean;
    /** Whether the selection copies and the mode lets it ({@link copyAllowed}). */
    canCopy: boolean;
    selection: SelectionCapabilities;
    /** Whether every selected slide is hidden ({@link UIState.selectedSlidesHidden})
     *  — what Hide Slide reads checked by. */
    slidesHidden: boolean;
    /** The open deck's sections as the section menu reads them: how many there
     *  are, the selected ones' indices in section order (ascending), and how
     *  many the thumbnails fold away. */
    slideSections: { count: number; selected: readonly number[]; collapsed: number };
    /** The open workbook's sheets as the sheet tab menu reads them: how many
     *  show a tab, how many are hidden (not very hidden), and the current
     *  sheet's tab colour — `#rrggbb`, `null` for none. */
    sheets: { visible: number; hidden: number; color: string | null };
    /** The extension's own state ({@link UIState.extension}) — what its
     *  commands' and menu rows' predicates read beyond the shell's. */
    extension: unknown;
    /** The open document's type — the gate for a control that belongs to some
     *  doc types whatever is selected. */
    docType: UDocType | null;
    /** How the pages scroll — a deck's notes panel shows only while its slides
     *  show one at a time. */
    scrollMode: ScrollMode;
    /** How a deck shows — its notes panel shows only in its Normal view. */
    presentationView: PresentationView;
    /** What the Annotate tab's Format controls act on and show — the armed
     *  annotation tool's style, else the selected annotations' — or null when
     *  there is neither. A control is live when its entry is present. */
    annotation: AnnotationFormat | null;
}

/** Project the UI state onto the {@link CommandContext} the predicates read. */
export function commandContext(state: UIState): CommandContext {
    return {
        ready: state.status === "ready",
        // Typing into a cell isn't on the history, which waits for its save.
        canUndo: state.canUndo && state.activeCell?.entry == null,
        canRedo: state.canRedo && state.activeCell?.entry == null,
        canCopy: state.selectionCaps.copyable && copyAllowed(state),
        selection: state.selectionCaps,
        slidesHidden: state.selectedSlidesHidden,
        slideSections: {
            count: state.slideSections.length,
            selected: state.slideSections.flatMap((section, index) =>
                state.selectedSlideSections.includes(section.id) ? [index] : [],
            ),
            collapsed: state.slideSections.filter((section) => state.collapsedSlideSections.has(section.id)).length,
        },
        sheets: {
            visible: state.planeVisibility.filter((state) => state === "visible").length,
            hidden: state.planeVisibility.filter((state) => state === "hidden").length,
            color: state.planeColors[state.currentPlane] ?? null,
        },
        extension: state.extension,
        docType: state.docType,
        scrollMode: state.scrollMode,
        presentationView: state.presentationView,
        annotation: annotationFormat(state),
    };
}

/**
 * A command / menu-item enablement predicate. Co-located with the command it
 * governs (see {@link COMMAND_CATALOG} / {@link SHAPE_ARRANGE_MENU}) so adding a
 * command means adding its rule, not editing a component's `if` ladder; pure
 * over the {@link CommandContext} so it is trivially unit-testable.
 */
export type EnabledWhen = (ctx: CommandContext) => boolean;

/** Enabled whenever a document is open — the default for commands that act on
 *  the document at large rather than on the selection. */
const whenReady: EnabledWhen = (c) => c.ready;

/**
 * What activating a menu item does — the intent the shell turns into an edit
 * (or a UI toggle). Each variant carries its full payload, so the shell handler
 * is a switch on `kind` with no side lookup tables. `copy` puts the selection
 * on the system clipboard. `selectionEdit` commits an edit on the selection.
 * `toggleSlidesHidden` is Hide Slide: it hides the selected slides, or shows
 * them again when every one is hidden. A deck's sections: `addSlideSection`
 * starts an untitled one at the selected slides and edits its name,
 * `renameSlideSection` edits the selected one's, `moveSlideSections` moves the
 * selected ones `by` a place, `collapseSlideSections` folds every one's
 * slides away in the thumbnails, or unfolds them, and `removeAllSlideSections`
 * deletes them all, keeping the slides. A workbook's sheet tab menu acts on
 * the current sheet: `insertSheet` inserts a worksheet before it,
 * `deleteSheet` deletes it, `renameSheet` edits its name in its tab,
 * `setSheetTabColor` colours its tab `#rrggbb` or takes its colour away,
 * `hideSheet` hides it, and `unhideSheet` shows the hidden sheet on `plane`.
 * `extension` carries an extension's own intent, which the shell hands back
 * to it (`UIExtension.menuAction`).
 */
export type MenuAction =
    | { kind: "annotationStyle"; change: AnnotationStyleChange }
    | { kind: "copy" }
    | { kind: "selectionEdit"; edit: SelectionEdit }
    | { kind: "toggleSlidesHidden" }
    | { kind: "addSlideSection" }
    | { kind: "renameSlideSection" }
    | { kind: "moveSlideSections"; by: -1 | 1 }
    | { kind: "collapseSlideSections"; collapsed: boolean }
    | { kind: "removeAllSlideSections" }
    | { kind: "insertSheet" }
    | { kind: "deleteSheet" }
    | { kind: "renameSheet" }
    | { kind: "setSheetTabColor"; color: string | null }
    | { kind: "hideSheet" }
    | { kind: "unhideSheet"; plane: number }
    | { kind: "extension"; action: unknown };

/** One entry in a command's dropdown menu (see the `menu` {@link CommandRun}).
 *  An item is either an *action* row (`action` set) or a *submenu* row
 *  (`submenu` set — a fly-out of nested items, e.g. Arrange's Order / Align /
 *  Rotate); exactly one of the two is present. */
export interface MenuItem<K extends string = MessageKey> {
    /** The intent dispatched when the item is activated. Absent on a submenu row. */
    action?: MenuAction;
    /** Nested items shown as a fly-out panel beside this row. Absent on an action
     *  row. A submenu row dispatches nothing itself — it opens its children. */
    submenu?: readonly MenuItem<K>[];
    /** Its label: a message of the shell's — udoc-ui's, or an extension's. */
    label: Message<K>;
    /** Set only where the glyph tells this row apart from its neighbours — an
     *  alignment, a z-order move. Absent on a row its label already says, a
     *  value in a list (a spacing, a scale, an opacity), where one glyph on every
     *  row would say nothing; and where Material Symbols has no icon for it. The
     *  row then shows its label alone, in line with the rows around it. */
    icon?: string;
    /** Whether this item is enabled for the current selection (see
     *  {@link EnabledWhen}); a disabled item is greyed and inert. A submenu row
     *  is enabled when any of its children is. */
    enabledWhen: EnabledWhen;
    /** Draw a divider above this item — starts a new visual group. */
    separatorBefore?: boolean;
    /** For a toggle item (e.g. "Align to page"), whether it currently reads as
     *  checked. Absent on plain action items. */
    checked?: (ctx: CommandContext) => boolean;
    /**
     * For one row of a **mutually exclusive set** (the alignments, the line
     * spacings), whether it is the value the selection currently holds — the row
     * is then tinted and reports `menuitemradio` / `aria-checked`.
     *
     * Distinct from {@link checked}, which draws an on/off *switch*: a switch on
     * each of four alignments would read as four independent toggles, and none of
     * them is independently on or off — exactly one is the current value, or none
     * is (a selection whose paragraphs disagree marks nothing).
     */
    activeWhen?: (ctx: CommandContext) => boolean;
    /** A toggle that keeps its panel open when activated, rebuilding it so its
     *  check — and what the toggle gates — reads the new state at once (Align ▸
     *  Align to Page). Any other row dismisses the menu. */
    keepsOpen?: boolean;
}

/** The canvas context menu's Copy row — live whenever the selection copies,
 *  in view mode as in edit, but greyed in view mode when the host turns copy
 *  off. An extension's own context menu carries it too. */
export const COPY_MENU_ITEM: MenuItem = {
    action: { kind: "copy" },
    label: "contextMenu.copy",
    icon: ICON_COPY,
    enabledWhen: (c) => c.canCopy,
};

/**
 * The canvas context menu's rows — what a right-click offers in view mode, and
 * wherever an extension offers none of its own
 * (`UIExtension.contextMenuItems`). These are *acts on the selection*, not
 * properties of it: they mean the same thing for a shape, a slide, or a range
 * of text, so they belong beside the selection rather than on a toolbar tab.
 */
export const CONTEXT_MENU: readonly MenuItem[] = [COPY_MENU_ITEM];

/** A thumbnail menu row running the page edit `edit` (a PDF's, so wrapped in
 *  its `page` family), live while the selection allows its kind. */
function pageRow(label: MessageKey, icon: string, edit: SelectionEdit & { kind: SelectionEditKind }): MenuItem {
    return {
        action: { kind: "selectionEdit", edit: { kind: "page", edit } },
        label,
        icon,
        enabledWhen: (c) => allowsEdit(c.selection, edit.kind),
    };
}

/** A thumbnail menu row running the slide edit `edit`, live while the
 *  selection allows its kind. */
function slideRow(label: MessageKey, icon: string, edit: SelectionEdit & { kind: SelectionEditKind }): MenuItem {
    return {
        action: { kind: "selectionEdit", edit },
        label,
        icon,
        enabledWhen: (c) => allowsEdit(c.selection, edit.kind),
    };
}

/**
 * A PDF's thumbnail menu — what a right-click on its page thumbnails offers
 * outside view mode, on the pages selected. An insert and a duplicate land
 * after the last of them. Delete is greyed with every page selected: a PDF
 * keeps one.
 */
export const PAGE_MENU: readonly MenuItem[] = [
    pageRow("thumbnails.insertPage", ICON_PAGE_ADD, { kind: "insertPage" }),
    pageRow("thumbnails.duplicatePage", ICON_PAGE_DUPLICATE, { kind: "duplicatePages" }),
    {
        ...pageRow("thumbnails.rotateRight", ICON_ROTATE_RIGHT, { kind: "rotatePages", clockwise: true }),
        separatorBefore: true,
    },
    pageRow("thumbnails.rotateLeft", ICON_ROTATE_LEFT, { kind: "rotatePages", clockwise: false }),
    { ...pageRow("thumbnails.deletePage", ICON_DELETE, { kind: "deletePages" }), separatorBefore: true },
];

/** An image's thumbnail menu — {@link PAGE_MENU} less Insert Page, as a blank
 *  image page means nothing. Duplicate is greyed but in a TIFF, the one
 *  format that holds more than one page. */
export const IMAGE_PAGE_MENU: readonly MenuItem[] = PAGE_MENU.slice(1);

/** A deck's thumbnail menu — {@link PAGE_MENU}'s twin for its slides, with
 *  Add Section, and Hide Slide, checked while every selected slide is hidden. */
export const SLIDE_MENU: readonly MenuItem[] = [
    slideRow("thumbnails.newSlide", ICON_PAGE_ADD, { kind: "insertSlide" }),
    slideRow("thumbnails.duplicateSlide", ICON_PAGE_DUPLICATE, { kind: "duplicateSlides" }),
    {
        action: { kind: "addSlideSection" },
        label: "thumbnails.addSection",
        icon: ICON_SECTION_ADD,
        enabledWhen: (c) => allowsEdit(c.selection, "insertSlideSection"),
    },
    {
        action: { kind: "toggleSlidesHidden" },
        label: "thumbnails.hideSlide",
        icon: ICON_SLIDE_HIDE,
        enabledWhen: (c) => allowsEdit(c.selection, "setSlidesShow"),
        checked: (c) => c.slidesHidden,
        separatorBefore: true,
    },
    { ...slideRow("thumbnails.deleteSlide", ICON_DELETE, { kind: "deleteSlides" }), separatorBefore: true },
];

/**
 * A deck's section menu — what a right-click on a section's header in the
 * thumbnails offers outside view mode, on the sections selected. A move takes
 * them, with their slides, a place up or down; Remove Section keeps the slides,
 * in the section before, so it is greyed on the first section while others
 * remain; Remove Section & Slides deletes them too; Remove All Sections keeps
 * every slide.
 */
export const SECTION_MENU: readonly MenuItem[] = [
    {
        action: { kind: "renameSlideSection" },
        label: "thumbnails.renameSection",
        icon: ICON_SECTION_RENAME,
        enabledWhen: (c) => allowsEdit(c.selection, "renameSlideSection"),
    },
    {
        action: { kind: "moveSlideSections", by: -1 },
        label: "thumbnails.moveSectionUp",
        icon: ICON_SECTION_UP,
        enabledWhen: (c) => allowsEdit(c.selection, "reorderSlideSections") && c.slideSections.selected[0]! > 0,
        separatorBefore: true,
    },
    {
        action: { kind: "moveSlideSections", by: 1 },
        label: "thumbnails.moveSectionDown",
        icon: ICON_SECTION_DOWN,
        enabledWhen: ({ selection, slideSections: { count, selected } }) =>
            allowsEdit(selection, "reorderSlideSections") && selected[0]! < count - selected.length,
    },
    {
        action: { kind: "collapseSlideSections", collapsed: true },
        label: "thumbnails.collapseAll",
        icon: ICON_SECTIONS_COLLAPSE,
        enabledWhen: (c) => c.slideSections.collapsed < c.slideSections.count,
        separatorBefore: true,
    },
    {
        action: { kind: "collapseSlideSections", collapsed: false },
        label: "thumbnails.expandAll",
        icon: ICON_SECTIONS_EXPAND,
        enabledWhen: (c) => c.slideSections.collapsed > 0,
    },
    {
        action: { kind: "selectionEdit", edit: { kind: "deleteSlideSections" } },
        label: "thumbnails.removeSection",
        icon: ICON_SECTION_REMOVE,
        enabledWhen: (c) => allowsEdit(c.selection, "deleteSlideSections"),
        separatorBefore: true,
    },
    {
        action: { kind: "selectionEdit", edit: { kind: "deleteSlideSectionsWithSlides" } },
        label: "thumbnails.removeSectionAndSlides",
        icon: ICON_DELETE,
        enabledWhen: (c) => allowsEdit(c.selection, "deleteSlideSectionsWithSlides"),
    },
    {
        action: { kind: "removeAllSlideSections" },
        label: "thumbnails.removeAllSections",
        enabledWhen: (c) => c.slideSections.count > 0,
    },
];

/** A colour swatch a menu row shows as its icon: `hex`, filled, in a hairline
 *  frame so a light one shows on the menu. */
function swatchIcon(hex: string): string {
    return (
        `<svg viewBox="0 0 20 20"><rect x="3" y="3" width="14" height="14" rx="2" fill="${hex}" ` +
        `stroke="currentColor" stroke-opacity="0.3"/></svg>`
    );
}

/**
 * A workbook's sheet tab menu — what a right-click on a sheet's tab offers
 * outside view mode, on that sheet, which the click makes current: Insert puts
 * a worksheet before it, as Excel's does; Delete and Hide are greyed while it
 * is the one sheet showing a tab, as Excel refuses them; Tab Color offers
 * Excel's standard colours; Unhide lists the hidden sheets of `state`, greyed
 * with none.
 */
export function sheetTabMenu(state: UIState): readonly MenuItem[] {
    const hidden = state.planeVisibility.flatMap((visibility, plane) =>
        visibility === "hidden" ? [{ plane, name: state.planeNames[plane] ?? "" }] : [],
    );
    const color = (hex: string | null, label: MessageKey): MenuItem => ({
        action: { kind: "setSheetTabColor", color: hex },
        label,
        ...(hex !== null && { icon: swatchIcon(hex) }),
        enabledWhen: whenReady,
        activeWhen: (c) => c.sheets.color === hex,
    });
    return [
        { action: { kind: "insertSheet" }, label: "sheet.insert", icon: ICON_SHEET_ADD, enabledWhen: whenReady },
        {
            action: { kind: "deleteSheet" },
            label: "sheet.delete",
            icon: ICON_DELETE,
            enabledWhen: (c) => c.ready && c.sheets.visible > 1,
        },
        { action: { kind: "renameSheet" }, label: "sheet.rename", icon: ICON_SHEET_RENAME, enabledWhen: whenReady },
        {
            submenu: [color(null, "sheet.noColor"), ...STANDARD_COLORS.map((swatch) => color(swatch.hex, swatch.name))],
            label: "sheet.tabColor",
            icon: ICON_SHEET_TAB_COLOR,
            enabledWhen: whenReady,
            separatorBefore: true,
        },
        {
            action: { kind: "hideSheet" },
            label: "sheet.hide",
            icon: ICON_SHEET_HIDE,
            enabledWhen: (c) => c.ready && c.sheets.visible > 1,
            separatorBefore: true,
        },
        {
            submenu: hidden.map(({ plane, name }) => ({
                action: { kind: "unhideSheet", plane },
                label: ["sheet.hiddenName", { name }],
                enabledWhen: whenReady,
            })),
            label: "sheet.unhide",
            icon: ICON_SHEET_UNHIDE,
            enabledWhen: (c) => c.ready && c.sheets.hidden > 0,
        },
    ];
}

/** Which paint channel a Fill / Line split button edits. Decides the swatch
 *  glyph and the "No Fill" / "No Line" wording of its (later) picker panel. */
/** A paint target a color control fills: a shape's `fill` / `stroke`, or a text
 *  span's `text` color / `highlight` (the Text tab's font color and highlight).
 *  The color-picker machinery is channel-generic; `applyPaint` routes each to its
 *  own callback. */
export type PaintChannel = "fill" | "stroke" | "text" | "highlight";

/** The opacities the Annotate tab's Opacity menu offers. */
const ANNOTATION_OPACITIES: readonly number[] = [1, 0.75, 0.5, 0.25];

/** The Opacity dropdown: one exclusive set, the value the annotations (or the
 *  armed tool) hold marked. */
const ANNOTATION_OPACITY_MENU: readonly MenuItem[] = ANNOTATION_OPACITIES.map((opacity) => ({
    action: { kind: "annotationStyle", change: { kind: "opacity", opacity } },
    label: ["format.percent", { percent: Math.round(opacity * 100) }],
    enabledWhen: (c) => c.annotation?.opacity !== undefined,
    activeWhen: (c) => c.annotation?.opacity === opacity,
}));

/** A row of an `armPicker`'s picker: the tool it arms, and for a stamp row the
 *  stamp that tool then drops. */
export interface PickerOption<K extends string = MessageKey> {
    tool: PlaceTool;
    icon?: string;
    label: K;
    stamp?: StampIcon;
}

/** Shapes offered by the Annotate tab's shape picker (`annotateShape`) — each
 *  an annotation tool. */
const ANNOTATION_SHAPE_OPTIONS: readonly PickerOption[] = (
    [
        ["rectangle", ICON_SUBTOOL_RECTANGLE, "shape.rectangle"],
        ["ellipse", ICON_SUBTOOL_ELLIPSE, "shape.ellipse"],
        ["line", ICON_SUBTOOL_LINE, "shape.line"],
        ["arrow", ICON_SUBTOOL_ARROW, "shape.arrow"],
        ["polygon", ICON_SUBTOOL_POLYGON, "shape.polygon"],
        ["polyline", ICON_SUBTOOL_POLYLINE, "shape.polyline"],
        ["cloud", ICON_SUBTOOL_CLOUD, "shape.cloud"],
    ] as const satisfies ReadonlyArray<readonly [AnnotationTool, string, MessageKey]>
).map(([tool, icon, label]) => ({ tool: { kind: "annotation", tool }, icon, label }));

/** The standard stamps (Table 181) the Annotate tab's Stamp picker
 *  (`annotateStamp`) offers, in the spec's order. */
const STAMP_OPTIONS: readonly PickerOption[] = (
    [
        ["approved", "stamp.approved"],
        ["experimental", "stamp.experimental"],
        ["notApproved", "stamp.notApproved"],
        ["asIs", "stamp.asIs"],
        ["expired", "stamp.expired"],
        ["notForPublicRelease", "stamp.notForPublicRelease"],
        ["confidential", "stamp.confidential"],
        ["final", "stamp.final"],
        ["sold", "stamp.sold"],
        ["departmental", "stamp.departmental"],
        ["forComment", "stamp.forComment"],
        ["topSecret", "stamp.topSecret"],
        ["draft", "stamp.draft"],
        ["forPublicRelease", "stamp.forPublicRelease"],
    ] as const satisfies ReadonlyArray<readonly [StampIcon, MessageKey]>
).map(([stamp, label]) => ({ tool: { kind: "annotation", tool: "stamp" }, label, stamp }));

/**
 * What activating a command does. The toolbar interprets these:
 * - `history` → undo / redo, routed to the worker via the shell's history callback.
 * - `arm` → dispatches `ARM_PLACE`, entering the transient placement pointer
 *   mode; the canvas commits and returns to `select` (Office "insert" model) —
 *   unless `sticky`, which keeps the tool armed placement after placement.
 *   Pressing an armed tool's button again disarms it.
 * - `action` → a plain button whose click `press`es — for a command of an
 *   extension's that its own code runs (New Slide, Insert ▸ Image).
 * - `armPicker` → opens a sub-picker of `options` before arming: the Annotate
 *   tab's shapes or its standard stamps, an extension's own.
 * - `menu` → opens a dropdown of {@link MenuItem}s (Arrange / Align / Rotate);
 *   selecting an item dispatches its {@link MenuAction} through the ribbon's
 *   `onMenuAction` callback. `cluster` bunches it as a `control`'s does.
 * - `control` → a control an extension builds for its command and keeps in
 *   step with the state itself ({@link RibbonControl}) — the Text tab's font
 *   picker, its toggles, its color and list buttons. `cluster` bunches it with
 *   its neighbours of the same {@link ClusterKind} into one segmented group.
 * - `toggle` → a button that reads as pressed while `pressed` says so, and
 *   `press`es on a click — for a setting of an extension's (Show Formatting
 *   Marks), which mirrors its state, not the selection. `cluster` bunches it
 *   as a `control`'s does: a deck's Normal and Notes Page, one of which is
 *   always pressed, into a segment button.
 * - `markup` → an Annotate-tab text markup, through the ribbon's `onMarkup`:
 *   with text selected it marks it at once; else it arms its tool to mark the
 *   text the next drag selects, returning to `select` once it has. Pressing it
 *   armed puts it down.
 * - `annotationPaint` → the Annotate tab's Color / Fill dropdown: the swatch
 *   mirrors {@link CommandContext.annotation}, the panel picks the colour — and
 *   for Color the line's weight and dashes — and fires `onAnnotationStyle`.
 */
export type CommandRun<K extends string = MessageKey> =
    | { kind: "history"; op: HistoryOp }
    | { kind: "action"; press(store: Store<UIState, Action>): void }
    | { kind: "arm"; tool: PlaceTool; sticky?: boolean }
    | { kind: "armPicker"; options: readonly PickerOption<K>[] }
    | { kind: "menu"; menu: readonly MenuItem<K>[]; cluster?: ClusterKind }
    | { kind: "control"; cluster?: ClusterKind; create(env: RibbonControlEnv): RibbonControl }
    | {
          kind: "toggle";
          cluster?: ClusterKind;
          pressed(state: UIState): boolean;
          press(store: Store<UIState, Action>): void;
      }
    | { kind: "markup"; tool: MarkupTool }
    | { kind: "annotationPaint"; channel: "color" | "fill" };

/** Which segmented group a ribbon command bunches into: consecutive commands of
 *  one kind butt together with no gap between them — the character toggles, the
 *  color dropdowns, the paragraph controls. Consecutive `"segment"` toggles are
 *  the choices of one setting, one pressed at a time: they form a segment
 *  button (see `createSegmentButton`), which the ribbon never splits. */
export type ClusterKind = "toggle" | "paint" | "paragraph" | "segment";

/** A ribbon control an extension builds for one of its commands (a `control` {@link CommandRun}). */
export interface RibbonControl {
    /** The control's element, every focusable part of it carrying the command's
     *  id in `data-command`, which the ribbon's enablement pass greys. */
    readonly el: HTMLElement;
    /** Mirror `state` — run on each render, after the enablement pass. */
    sync?(state: UIState): void;
    /** Close an open menu of its — the ribbon closes them when it hides. */
    close?(): void;
    /** Tear down — the ribbon destroys its controls when it rebuilds. */
    destroy?(): void;
}

/** What the ribbon lends a {@link RibbonControl} it creates. */
export interface RibbonControlEnv {
    readonly store: Store<UIState, Action>;
    /** The command's label, in the shell's language. */
    readonly label: string;
    /** The colors picked lately per paint channel, most recent first — shared by
     *  every color panel on the ribbon, so the Annotate tab's Color / Fill offer
     *  what the Object tab's Line / Fill picked. */
    readonly recentPaint: Readonly<Record<PaintChannel, readonly string[]>>;
    /** Record a picked color as the most recent of `channel`'s. */
    pushRecent(channel: PaintChannel, hex: string): void;
}

export interface CommandDef<K extends string = MessageKey> {
    /** Its id: a {@link CommandId} of the shell's catalog, or an extension's own. */
    id: string;
    /** Its label: a key of the shell's messages — udoc-ui's, or an extension's. */
    label: K;
    icon: string;
    /** Visual grouping key — consecutive commands sharing a group sit together. */
    group: string;
    run: CommandRun<K>;
    /** The key that runs it — the shell's own handler, which the tooltip names. */
    shortcut?: Shortcut;
    /** When this command is enabled, given the current {@link CommandContext}
     *  (see {@link EnabledWhen}). The toolbar ANDs this with its own UI policy
     *  (host-disabled commands, mode). Most commands just need a document
     *  ({@link whenReady}); selection-gated ones read {@link CommandContext.selection}. */
    enabledWhen: EnabledWhen;
}

/**
 * The full command catalog. `MODE_TABS` (in state.ts) selects which of these
 * each mode's tabs surface; `disabledCommands` (host override) hides individual
 * entries.
 *
 * Most `arm`/`armPicker` commands are foundation: they enter placement pointer
 * mode, but the canvas does not yet realize the placement. `history` commands
 * (undo / redo) are fully wired.
 */
export const COMMAND_CATALOG: Record<CommandId, CommandDef> = {
    undo: {
        id: "undo",
        label: "command.undo",
        icon: ICON_UNDO,
        group: "history",
        run: { kind: "history", op: "undo" },
        enabledWhen: (c) => c.canUndo,
    },
    redo: {
        id: "redo",
        label: "command.redo",
        icon: ICON_REDO,
        group: "history",
        run: { kind: "history", op: "redo" },
        enabledWhen: (c) => c.canRedo,
    },

    // Annotate tab — the text markups, each marking what a drag selects (or the
    // text already selected), then returning to select.
    annotateHighlight: {
        id: "annotateHighlight",
        label: "command.annotateHighlight",
        icon: ICON_SUBTOOL_HIGHLIGHT,
        group: "markup",
        run: { kind: "markup", tool: "highlight" },
        enabledWhen: whenReady,
    },
    annotateUnderline: {
        id: "annotateUnderline",
        label: "command.annotateUnderline",
        icon: ICON_SUBTOOL_UNDERLINE,
        group: "markup",
        run: { kind: "markup", tool: "underline" },
        enabledWhen: whenReady,
    },
    annotateStrikeOut: {
        id: "annotateStrikeOut",
        label: "command.annotateStrikeOut",
        icon: ICON_SUBTOOL_STRIKETHROUGH,
        group: "markup",
        run: { kind: "markup", tool: "strikeOut" },
        enabledWhen: whenReady,
    },
    annotateSquiggly: {
        id: "annotateSquiggly",
        label: "command.annotateSquiggly",
        icon: ICON_SUBTOOL_SQUIGGLY,
        group: "markup",
        run: { kind: "markup", tool: "squiggly" },
        enabledWhen: whenReady,
    },

    // A sticky note, dropped with a click, and a text box, dragged out or
    // dropped with one: the text of each is typed in the popup it opens beside
    // it. A stamp, picked from the standard ones, is dropped with a click.
    annotateNote: {
        id: "annotateNote",
        label: "command.annotateNote",
        icon: ICON_SUBTOOL_NOTE,
        group: "comment",
        run: { kind: "arm", tool: { kind: "annotation", tool: "note" } },
        enabledWhen: whenReady,
    },
    annotateTextBox: {
        id: "annotateTextBox",
        label: "command.annotateTextBox",
        icon: ICON_SUBTOOL_TEXTBOX,
        group: "comment",
        run: { kind: "arm", tool: { kind: "annotation", tool: "textBox" } },
        enabledWhen: whenReady,
    },
    annotateStamp: {
        id: "annotateStamp",
        label: "command.annotateStamp",
        icon: ICON_SUBTOOL_STAMP,
        group: "comment",
        run: { kind: "armPicker", options: STAMP_OPTIONS },
        enabledWhen: whenReady,
    },

    // The tools that draw a PDF annotation. The Pen stays armed
    // stroke after stroke (a signature, a scribble), so it arms sticky; a shape
    // is placed once, like an Insert-tab shape.
    annotatePen: {
        id: "annotatePen",
        label: "command.annotatePen",
        icon: ICON_SUBTOOL_FREEHAND,
        group: "draw",
        run: { kind: "arm", tool: { kind: "annotation", tool: "pen" }, sticky: true },
        enabledWhen: whenReady,
    },
    annotateShape: {
        id: "annotateShape",
        label: "command.annotateShape",
        icon: ICON_SHAPES,
        group: "draw",
        run: { kind: "armPicker", options: ANNOTATION_SHAPE_OPTIONS },
        enabledWhen: whenReady,
    },

    // The Annotate tab's Format group — the style of the armed annotation tool,
    // else of the selected annotations. Each control is live when what it acts
    // on takes the entry it edits (see `annotationFormat`).
    annotationColor: {
        id: "annotationColor",
        label: "command.annotationColor",
        icon: ICON_STROKE,
        group: "format",
        run: { kind: "annotationPaint", channel: "color" },
        enabledWhen: (c) => c.annotation?.color !== undefined,
    },
    annotationFill: {
        id: "annotationFill",
        label: "command.annotationFill",
        icon: ICON_FILL,
        group: "format",
        run: { kind: "annotationPaint", channel: "fill" },
        enabledWhen: (c) => c.annotation?.fill !== undefined,
    },
    annotationOpacity: {
        id: "annotationOpacity",
        label: "command.annotationOpacity",
        icon: ICON_OPACITY,
        group: "format",
        // With Color and Fill: it styles the same annotation.
        run: { kind: "menu", menu: ANNOTATION_OPACITY_MENU, cluster: "paint" },
        enabledWhen: (c) => c.annotation?.opacity !== undefined,
    },

    // View tab — a deck's views, one segment button: its slides, or the
    // pages its notes print on, the one shown pressed.
    normalView: {
        id: "normalView",
        label: "command.normalView",
        icon: ICON_NORMAL_VIEW,
        group: "views",
        run: {
            kind: "toggle",
            cluster: "segment",
            pressed: (state) => state.presentationView === "normal",
            press: (store) => store.dispatch({ type: "SET_PRESENTATION_VIEW", view: "normal" }),
        },
        enabledWhen: whenReady,
    },
    notesPageView: {
        id: "notesPageView",
        label: "command.notesPageView",
        icon: ICON_NOTES_PAGE_VIEW,
        group: "views",
        run: {
            kind: "toggle",
            cluster: "segment",
            pressed: (state) => state.presentationView === "notesPage",
            press: (store) => store.dispatch({ type: "SET_PRESENTATION_VIEW", view: "notesPage" }),
        },
        enabledWhen: whenReady,
    },
    // Then its notes pane under its slides, opened or closed to its edge: a
    // view setting, live whatever is selected, while the slides show one at a
    // time in the Normal view — scrolled through, or as notes pages, they show
    // no pane.
    notes: {
        id: "notes",
        label: "command.notes",
        icon: ICON_NOTES,
        group: "show",
        run: {
            kind: "toggle",
            pressed: (state) => state.notesOpen,
            press: (store) => store.dispatch({ type: "SET_NOTES_OPEN", open: !store.getState().notesOpen }),
        },
        enabledWhen: (c) => c.ready && c.scrollMode === "spread" && c.presentationView === "normal",
    },

    // View tab — a word document's views, one segment button like the
    // deck's: its pages, or its body pageless, flowed to the pane's width.
    pagesView: {
        id: "pagesView",
        label: "command.pagesView",
        icon: ICON_PAGES_VIEW,
        group: "views",
        run: {
            kind: "toggle",
            cluster: "segment",
            pressed: (state) => state.currentPlane !== PAGELESS_PLANE,
            press: (store) => store.dispatch({ type: "SET_CURRENT_PLANE", plane: 0 }),
        },
        enabledWhen: whenReady,
    },
    pagelessView: {
        id: "pagelessView",
        label: "command.pagelessView",
        icon: ICON_PAGELESS_VIEW,
        group: "views",
        run: {
            kind: "toggle",
            cluster: "segment",
            pressed: (state) => state.currentPlane === PAGELESS_PLANE,
            press: (store) => store.dispatch({ type: "SET_CURRENT_PLANE", plane: PAGELESS_PLANE }),
        },
        enabledWhen: whenReady,
    },
};
