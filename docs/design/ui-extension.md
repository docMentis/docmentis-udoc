# UI Extension

udoc-editor reaches the shell through one object, `UIExtension`
(`extension.ts`), handed to `createAs`; udoc-viewer hands none, so what the
shell does on its own is all a viewer does. Each member exists for a piece of
edit mode: its mode and its tab strips, the page controls and the mode switch,
the formatting marks, New Slide and the Insert tab, the Text, Shape and Object
tabs' tools, the context menu and the clipboard, the ruler, shape placement,
and the rotation and geometry grips.

## What the shell lends

The shell mounts the extension once its own chrome is built, lending it a
`UIShellHost`: its root, the toolbar's mode slot, its store and worker client,
`commit` for an edit, `hold` for the busy hold, whether the selection holds
annotations, its own delete and typing verbs, the canvas's hidden text input
the clipboard events fire on, the page overlays, the hovered page and the
selection's keep-out. It lays the extension's `styles` after its own sheet.

The extension's own state rides the shell's store as `UIState.extension`,
starting from its `initialState`, so its controls re-render as the shell's do,
and a command's predicates read it from `CommandContext.extension`. Its words
are udoc-ui's packs with its own laid over each, built from the same `locale`
and `translations`: udoc-ui's `createI18n` takes the packs of the message set
it speaks, and the extension hands the shell its `messages`, so the shell names
its tabs and commands too.

## What the shell asks

Where the extension decides in the shell's place, the shell asks it:

- `spacing` — the page spacing its page chrome needs, or none for the shell's.
- `keydown` — its own keys.
- `menuAction` — a menu row whose action is the extension's own
  (`{ kind: "extension" }`), as the Arrange and paragraph menus' rows are.
- `contextMenu` — a right-click in edit mode, once the canvas has settled the
  selection it acts on.
- `guideBand` — a band the canvas reserves around the pages and the extension
  draws, as edit mode's ruler is.
- `placedShape` / `place` — a place tool of the extension's
  (`{ kind: "extension", tool }`) is dragged out as the shape `placedShape`
  names and handed to `place` on release, as Insert ▸ Shapes is.
- `selectionChrome` — chrome of its own on the selection, beside the shell's
  resize handles: edit mode's rotation and geometry grips.
- `pressCanvas` / `canvasCursor` — a select-pointer press offered ahead of the
  canvas's own routing, returning the `CanvasGesture` the extension runs on
  the captured pointer, and the resting cursor over its chrome.

## Modes

The shell knows view mode alone. The extension adds one mode of its own —
`mode`, its `id` and the `feature` a session needs to be in it — and says which
the shell opens in (`initialMode`); in any mode but view the canvas edits the
document's objects. Which modes a host allows, the switch between them and
`setMode` are the editor's.

## Tab strips and commands

A doc type's profile carries the strip view mode shows, and `tabs(docType)` the
one edit mode does, so the reducer, the ribbon and the toolbar read a mode's
strip through one source. A tab names its commands by id, looked up in the
shell's catalog and then in the extension's `commands`:

- a `toggle` command mirrors a setting of the extension's and presses it, as
  Show Formatting Marks does;
- an `action` command runs the extension's own code, as New Slide does;
- an `armPicker` carries the options its picker offers, as Insert ▸ Shapes and
  Annotate ▸ Stamp do;
- a `control` command builds a ribbon control of the extension's — the font
  picker, the size field, the character toggles, the list split buttons, the
  color dropdowns — which the ribbon places, syncs on each render, closes and
  destroys; `cluster` bunches it with its neighbours as the shell's toggles
  and color dropdowns bunch.

## Worker

Each product serves its own render worker: udoc-ui's engine worker is a
library, and udoc-editor's entry adds edit mode's request handlers to it, sent
through `EditClient` — so a viewer's worker carries no edit request. See
[UI Editor](ui-editor.md#threading-wasm-owns-the-session-in-a-worker).
