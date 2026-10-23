# @docmentis/udoc-editor

A document editor for the web. It opens PDF, Word, PowerPoint and Excel files,
CSV and images in the page, rendered by the docMentis udoc engine —
WebAssembly, on a canvas, in a worker — and edits them: text, shapes, images,
pages, annotations and form fields, with undo, and with other people at the
same time.

The editor and
[`@docmentis/udoc-viewer`](https://www.npmjs.com/package/@docmentis/udoc-viewer),
which only views, are both built on `@docmentis/udoc-ui`, the document UI they
share. The viewer's README covers what the two share — formats, the engine's
hosting, theming, browser support, Content Security Policy and license keys —
and all of it applies here. This one covers what editing adds.

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

The editor takes the viewer's
[options](https://www.docmentis.com/docs/api/udoc-editor/interfaces/UDocEditorOptions),
and has its [methods](https://www.docmentis.com/docs/api/udoc-editor/classes/UDocEditor)
and [events](https://www.docmentis.com/docs/api/udoc-editor/interfaces/UDocEditorEvents)
and more. `execute(command)` runs one edit, a `UDocCommand`, as the editor's
own tools do, and `undo()` and `redo()` step through them; `document:edited`
fires as each is applied, and `selection:changed` as the selection changes.
`saveToBytes(format, strategy)` returns the edited document, and
`download(filename?)` hands it to the browser.

`download` keeps as much of the original as its format can: a PDF appends the
edits as a new revision, so its signatures stay valid; a Word, PowerPoint or
Excel file rewrites only the parts that changed.

## Collaboration

Several editors can edit one document together, each seeing the others' edits
and selections as they make them.

**Through a udoc server**
([`@docmentis/udoc-server`](https://www.npmjs.com/package/@docmentis/udoc-server)),
which keeps the document:

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
leaves too. The `collaboration:joined`, `collaboration:interrupted`,
`collaboration:failed` and `collaboration:left` events follow it: an
interrupted collaboration rejoins by itself, and a failed one doesn't.

A host that carries edits over its own channel uses the calls these build on:
`snapshot`, `versionVector`, `patchSince`, `merge`, `opaquePartsSince`,
`mergeOpaqueParts`, `presence` and `mergePresence`, cued by `document:edited`
and `selection:changed`.

## Documentation

The guides and the API reference are at
[docmentis.com/docs](https://www.docmentis.com/docs).

## License

MIT OR Apache-2.0, at your option. That covers this package, not the
`@docmentis/udoc-wasm` engine it runs on, which is proprietary, under its own
license.
