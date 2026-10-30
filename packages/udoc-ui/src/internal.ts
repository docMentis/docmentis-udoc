// Internal API — for the docMentis packages built on this one, not for
// embedders. A package names itself here so the engine reports it, hands
// `createAs` its own class and its extension of the shell, and builds that
// extension from what the shell lends it.
export { createAs } from "./base.js";
export type { WorkerClient, Wrapper } from "./worker/WorkerClient.js";
export type { UIShell, UIShellOptions } from "./app/shell.js";
export type { PageSpacing, UIExtension, UIShellHost } from "./extension.js";
export { fragmentFromHtml, parseFragment, UDOC_FRAGMENT_FORMAT } from "./app/clipboard.js";
export type { ClipboardCopy } from "./app/clipboard.js";
export type { UIState } from "./app/state.js";
export type { Feature } from "@docmentis/udoc-wasm";
export { startLocalCollaborationService } from "./worker/LocalCollaborationService.js";
export { createMenuController, on, subscribeSelector } from "./framework/index.js";
export type { MenuController, MenuControllerOptions, Store } from "./framework/index.js";
export type { Action } from "./app/actions.js";
export {
    alignMenuToBounds,
    createButton,
    createDropdownButton,
    createMenuItem,
    createSplitButton,
} from "./app/components/controls.js";
export type { DropdownButton, SplitButton } from "./app/components/controls.js";
export { applyPaintBar, displayToActivePaint, paintSwatch } from "./app/components/Ribbon.js";
export type { BandCanvas, BandColors, BandLayer, BandStrip, GuideBand } from "./app/components/GuideBands.js";
export { DRAG_THRESHOLD } from "./app/components/Canvas.js";
export type { CanvasGesture, CanvasGestureHost } from "./app/components/Canvas.js";
export type {
    ChromeBox,
    ChromeFrame,
    KeepOutRect,
    Preview,
    SelectionChrome,
    SelectionExtent,
    SelectionPlacement,
} from "./app/components/SelectionLayer.js";
export { applyPoint, fromComponents, invert } from "./app/components/affine.js";
export type { Affine } from "./app/components/affine.js";
export { buildPaintPanel, DEFAULT_OFFICE_THEME, themeSwatches } from "./app/components/PaintPanel.js";
export type {
    LineDash,
    PaintPanelConfig,
    PaintSpec,
    PaintTransform,
    StrokeStyle,
    ThemeSwatch,
} from "./app/components/PaintPanel.js";
export {
    allowsEdit,
    allowsTableEdit,
    allowsTextEdit,
    drawingProperties,
    EMPTY_SELECTION_PAINT,
    EMPTY_SELECTION_TEXT_FORMAT,
    selectionPaint,
    selectionTextFormat,
} from "./geometry.js";
export type {
    PaintDisplay,
    SelectionCapabilities,
    SelectionHandle,
    SelectionPaint,
    SelectionTextFormat,
    TableEditKind,
    TextFormatState,
    TextParagraphAlign,
    ThemePalette,
} from "./geometry.js";
export type { AlignEdge, EditAxis, SelectionEdit, ZOrder } from "./worker/protocol.js";
export { ANNOTATE_TAB, VIEW_TAB, arrangementFor, profileFor } from "./app/profiles.js";
export { VIEW_MODE } from "./app/state.js";
export type { CommandId, ShapeKind, ToolbarTab } from "./app/state.js";
export { segmentsFor, STROKE as SHAPE_STROKE, STROKE_WIDTH as SHAPE_STROKE_WIDTH } from "./app/shapes.js";
export type { ShapePoint } from "./app/shapes.js";
export { commandContext, COPY_MENU_ITEM } from "./app/commands.js";
export { buildMenuInto } from "./app/components/menuItems.js";
export type {
    CommandContext,
    CommandDef,
    EnabledWhen,
    MenuAction,
    MenuItem,
    PaintChannel,
    PickerOption,
    RibbonControl,
    RibbonControlEnv,
} from "./app/commands.js";
export { createI18n, MESSAGE_PACKS } from "./app/i18n/index.js";
export type { I18n, Message } from "./app/i18n/index.js";
export * from "./app/icons.js";
