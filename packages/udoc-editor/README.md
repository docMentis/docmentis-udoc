# @docmentis/udoc-editor

A document editor for the web. It opens PDF, Word, PowerPoint and Excel files
and images in the page, rendered by the docMentis engine — WebAssembly, on a
canvas, in a worker — and edits them: text, shapes, images, pages, annotations
and form fields, with undo, and with other people at the same time.

The editor and [`@docmentis/udoc-viewer`](../udoc-viewer), which only views,
are both built on `@docmentis/udoc-ui`, the document UI they share. The
viewer's [README](../udoc-viewer/README.md) covers what the two share — formats,
options, methods, events, theming, browser support, Content Security Policy and
licensing — and all of it applies here. This one covers what editing adds.

## Quick start

```sh
npm install @docmentis/udoc-editor
```

```ts
import { UDocEditor } from "@docmentis/udoc-editor";

const editor = await UDocEditor.create(document.getElementById("editor")!, { license: "…" });
await editor.open(file);
```

The editor opens in edit mode, with a switch to view mode. `initialMode`
(`"view"` or `"edit"`) and `allowedModes` set them, and `mode` / `setMode`
read and change the mode; `showModeSwitch`, `showPageControls` (edit mode's
per-page controls, with the wider page gap they sit in) and `showRuler` (the
page ruler on paged documents) show or hide their chrome.

What a session may change comes from its license, or for free usage its
permit: `annotation`, `formFilling`, `editing` and `collaboration`. The editor
offers only what the session may use — without `editing` there is no edit
mode.

## Editing

| Method                                                       | What it does                                                                        |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `execute(command)`                                           | Run one edit, a `UDocCommand`, as the editor's own tools do.                        |
| `undo()`, `redo()`                                           | Undo or redo the last edit.                                                         |
| `selection()`, `setSelection(selection)`, `clearSelection()` | The selection.                                                                      |
| `insertImage(bytes, contentType)`                            | Insert an image.                                                                    |
| `setShowRuler(visible)`                                      | The page ruler, as the option.                                                      |
| `setShowFormattingMarks(visible)`                            | Word's formatting marks: `¶`, a dot per space, a tab's arrow.                       |
| `setUserInfo(name)`                                          | The user's name: the author of their annotations, and their label to collaborators. |
| `saveToBytes(format, strategy)`                              | The edited document, in a format it saves to.                                       |
| `download(filename?)`                                        | The same, handed to the browser.                                                    |

`download` keeps as much of the original as its format can: a PDF appends the
edits as a new revision, so its signatures stay valid; a Word, PowerPoint or
Excel file rewrites only the parts that changed.

| Event               | Payload                  | Fires when                           |
| ------------------- | ------------------------ | ------------------------------------ |
| `mode:changed`      | `{ mode, previousMode }` | The mode changes.                    |
| `document:edited`   | `{ composedPageCount }`  | An edit of this editor's is applied. |
| `selection:changed` | `{}`                     | This editor's selection changes.     |

## Collaboration

Several editors can edit one document together, each seeing the others' edits
and selections as they make them.

**Through a udoc server** (`@docmentis/udoc-server`), which keeps the document:

```ts
const base = "https://example.com/documents/42";
await editor.openRemote(`${base}/package`);
editor.joinRemoteCollaboration(`${base}/collaboration`, "Ada");
```

**In one page**, with no server — editors side by side, say:

```ts
const id = await UDocEditor.startLocalCollaborationService(bytes, { license: "…" });
await editor.openLocal(id);
editor.joinLocalCollaboration(id, "Ada");
```

`leaveCollaboration()` leaves; opening another document or closing this one
leaves too.

| Event                       | Payload            | Fires when                                             |
| --------------------------- | ------------------ | ------------------------------------------------------ |
| `collaboration:joined`      | `{}`               | The join is answered, and again on each rejoin.        |
| `collaboration:interrupted` | `{ code, reason }` | The connection is lost; the editor rejoins by itself.  |
| `collaboration:failed`      | `{ code, reason }` | The collaboration ends in an error; it isn't rejoined. |
| `collaboration:left`        | `{}`               | The editor leaves.                                     |

A host that carries edits over its own channel uses the calls these build on:
`snapshot`, `versionVector`, `patchSince`, `merge`, `opaquePartsSince`,
`mergeOpaqueParts`, `presence` and `mergePresence`, cued by `document:edited`
and `selection:changed`.

## Development

In this repo, build the shared UI before the package:

```sh
npm install                                       # the engine from npm, or a local build linked in
npm run build --workspace @docmentis/udoc-ui      # the shared UI → its dist/
npm run build --workspace @docmentis/udoc-editor  # tsc → dist/, then its render worker bundled
```

`npm run dev` runs the demo against this package's source. The architecture is in
[docs/design/ui-editor.md](../../docs/design/ui-editor.md).
