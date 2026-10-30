// What a package built on udoc-ui adds to the shell, handed to `createAs`. A
// package that hands none gets the shell as it is.
import type { Feature, UDocType } from "@docmentis/udoc-wasm";
import type { Store } from "./framework/index.js";
import type { Action } from "./app/actions.js";
import type { ClipboardCopy } from "./app/clipboard.js";
import type { CommandDef, MenuItem } from "./app/commands.js";
import type { Messages } from "./app/i18n/index.js";
import type { OverlayOptions, OverlaySource } from "./app/components/OverlayManager.js";
import type { GuideBand } from "./app/components/GuideBands.js";
import type { ShapeKind, ToolbarTab, UIState } from "./app/state.js";
import type { ShapePoint } from "./app/shapes.js";
import type { KeepOutRect, SelectionChrome } from "./app/components/SelectionLayer.js";
import type { CanvasGesture, CanvasGestureHost } from "./app/components/Canvas.js";
import type { ContentPadding, DocumentLayout, PageGap } from "./geometry.js";
import type { WorkerClient } from "./worker/WorkerClient.js";

/** The space around and between the pages: the content padding, screen-fixed (CSS px), and the gaps, page-fixed (document points). */
export interface PageSpacing {
    padding: ContentPadding;
    gap: PageGap;
}

/**
 * An extension of the shell: the shell mounts it once its own chrome is built,
 * and asks it wherever the extension may decide in the shell's place.
 */
export interface UIExtension {
    /**
     * The extension's own mode beside view mode — the one its `tabs` are
     * shown in, where the canvas edits the document — named by `id`, and the
     * feature a session needs to be in it.
     */
    readonly mode: { readonly id: string; readonly feature: Feature };
    /** The mode the shell opens in: view, or the extension's. */
    readonly initialMode: string;
    /** CSS of the extension's own chrome, laid after the shell's. */
    readonly styles: string;
    /**
     * The message packs the shell speaks, by language tag as `Intl` writes it:
     * udoc-ui's, each with the extension's own strings laid over it — the
     * labels of its tabs and commands among them.
     */
    readonly messages: Readonly<Record<string, Messages>>;
    /** The extension's own state at start: `UIState.extension`. */
    readonly initialState: unknown;
    /**
     * The tab strip a document of `docType` shows in the extension's mode —
     * in order, the default its Home — naming the shell's commands or the
     * extension's {@link commands}.
     */
    tabs(docType: UDocType | null): readonly ToolbarTab<string>[];
    /** The commands its tabs name beyond the shell's catalog, by id. */
    readonly commands: Readonly<Record<string, CommandDef<string>>>;
    /** A key pressed in the shell: the extension acts on its own keys, and
     *  prevents their default, which leaves them its alone. */
    keydown(e: KeyboardEvent): void;
    /** Run a menu row's intent of the extension's own — the `extension`
     *  `MenuAction` its menus carry. */
    menuAction(action: unknown): void;
    /**
     * The rows a right-click on the canvas offers in `state` — the extension's
     * own acts on the selection — or null for the shell's (Copy). `inTable`
     * says the click landed in a table's cell. The shell opens the menu; the
     * canvas has settled the selection it acts on by then.
     */
    contextMenuItems(state: UIState, inTable: boolean): readonly MenuItem<string>[] | null;
    /**
     * The band the extension draws around the content pane in `state` — edit
     * mode's ruler — or null for none. Read from state alone, so the band is
     * reserved before a frame paints; the same object for the same band, as the
     * canvas re-reserves only when it changes.
     */
    guideBand(state: UIState): GuideBand | null;
    /**
     * The shape the extension's place `tool` drags out — the outline the canvas
     * sketches while it does — or null for a tool the canvas places by no drag.
     */
    placedShape(tool: string): ShapeKind | null;
    /**
     * Place the extension's `tool` on page `page` (0-based), spanning the
     * page-local document points `p0 → p1` — its drag's two ends, or for a bare
     * click the default-sized shape the canvas drops there. Resolves once the
     * engine has what it placed.
     */
    place(tool: string, page: number, p0: ShapePoint, p1: ShapePoint): Promise<void>;
    /** Edit chrome the extension adds on the selection, beside the shell's
     *  resize handles — edit mode's rotation and geometry grips. */
    readonly selectionChrome: SelectionChrome;
    /**
     * A select-pointer press at canvas-local `(x, y)` (CSS px), offered to the
     * extension ahead of the canvas's own routing — on its selection chrome —
     * and the gesture it starts, or null to leave the press to the canvas.
     */
    pressCanvas(x: number, y: number, ev: PointerEvent, canvas: CanvasGestureHost): CanvasGesture | null;
    /** The resting cursor over the extension's chrome at `(x, y)`, or null for
     *  the canvas's own. */
    canvasCursor(x: number, y: number): string | null;
    /**
     * The spacing the pages show with in `state` — the extension's own, for
     * page chrome that needs room around the pages — or null for the shell's.
     * Returns the same objects for the same spacing, as the shell applies
     * spacing again only when one of them changes.
     */
    spacing(state: UIState): PageSpacing | null;
    /** Mount the extension into the shell `host` lends it; returns its teardown. */
    mount(host: UIShellHost): () => void;
}

/** What the shell lends the extension it mounts. */
export interface UIShellHost {
    /** The shell's root element, which a dialog of the extension's mounts in. */
    readonly root: HTMLElement;
    /** The toolbar's place for a mode switch: its right cluster, before the app menu. */
    readonly modeSlot: HTMLElement;
    readonly store: Store<UIState, Action>;
    readonly client: WorkerClient;
    /**
     * Run a committing edit as the shell runs its own: adopt the worker's new
     * layout, resume composing ahead, and fire the local-edit cue. A no-op
     * unless a document is ready.
     */
    commit(run: () => Promise<DocumentLayout>): Promise<void>;
    /**
     * Refuse input while `work` runs, under the busy hold's `message` — for
     * work a user's gesture waits on, as a font download a pick needs. Resolves
     * false when the user cancels the hold, true once the work is done.
     */
    hold(message: string, work: Promise<unknown>): Promise<boolean>;
    /** Whether the selection holds annotations — which an edit of the
     *  selection then acts on, rather than the page objects. */
    annotationsSelected(): boolean;
    /** Delete what is selected, as the Delete key does. */
    deleteSelection(): Promise<void>;
    /** Type `text` at the text caret, as the keyboard does. */
    insertSelectionText(text: string): Promise<void>;
    /**
     * The canvas's hidden text input, focused for all of edit mode and, in
     * view mode, while the selection is copyable — where the native `copy` /
     * `cut` / `paste` events fire.
     */
    readonly clipboardSink: HTMLElement;
    /** Focus {@link clipboardSink}, so an `execCommand("copy")` lands there. */
    focusClipboardSink(): void;
    /** The copy half of the clipboard, which writes every native `copy` on the
     *  sink — what a cut writes before it deletes. */
    readonly clipboard: ClipboardCopy;
    /** Register or replace the page overlay `id`, as the host's `setOverlay` does. */
    setOverlay(id: string, source: OverlaySource, options?: OverlayOptions): void;
    /** Remove the page overlay `id`; false when there is none. */
    removeOverlay(id: string): boolean;
    /** The page the pointer is over, or null — for page chrome shown on hover. */
    hoveredPage(): number | null;
    /**
     * The viewport rect a selection's handles cover, or null with nothing
     * selected — for page chrome that keeps clear of them.
     */
    selectionKeepOut(): KeepOutRect | null;
}
