# Node Hosts

Three packages run the udoc engine outside a browser: **`@docmentis/udoc-node`**,
the library a customer embeds in their own Node application; **`@docmentis/udoc-cli`**,
the `udoc` command; and **`@docmentis/udoc-server`**, a service that holds open
documents. All three run the same wasm build the editor does, and enter it through
the same door — `startSession` — so a Node host
is licensed and metered exactly like a browser one.

```
  udoc-cli        udoc-server         hosts — own their configuration, their page
       \            /                 numbering and their transport
        udoc-node                     the library — UDocNode → UDocSession
            |
        udoc-wasm                     the one engine build (wasm-bindgen glue + binary)
```

The Rust `udoc-debug` binary (`tools/docmentis-udoc-debug`) is not in this stack. It
links the facade natively, so it never passes the licensing gate: it is a developer
tool, and what VRT replay renders a past revision with.

## Why wasm, not a native addon

A native addon would be faster and could not be metered: the gate lives only at the
wasm seam (Wasm Licensing — Not here), so a native
embedder is unmetered by construction. Wasm also ships one artifact for every
platform, where an addon needs a prebuilt binary per OS and architecture. The
`--target web` glue already runs under Node — `initSync` takes a compiled module —
so there is no second wasm build.

## One document, one thread

`UDocNode` is the engine in this process: the host's identity and the compiled binary,
and the place host-scope state that outlives any one document belongs.
`UDocNode.create` compiles the binary once per process. `open` starts a `worker_threads`
worker, hands it that compiled module, and the worker instantiates it, starts a
session and opens the document in it. The returned `UDocSession` is named for what
it drives — the facade's `UDocSession`, one document's engine and editor
(Core Session) — and every call on it is a message to that worker.

Three things make the document the right unit:

- **The calls are synchronous and CPU-bound.** Composing and rasterizing a page holds
  the thread for as long as it takes. On the embedder's own thread that would stall
  its event loop — every request a server is serving — for the length of a render.
- **A trap poisons the instance.** `panic = "abort"` makes a panic a wasm trap, and
  a trap can leave a `WasmSession` borrowed for good, so the instance is finished. An
  instance per document means a document that brings the engine down takes nothing
  else with it: the trap rejects every call in flight, the session ends, its thread
  is terminated.
- **A session is already one document.** One session, one permit, one document
  (Wasm Licensing), so an
  instance per session is an instance per document anyway.

A session's `closed` promise settles, with the reason, however it ends — `close()`,
a trap, or its thread exiting on its own — which is what a host holding sessions
watches to let one go. An idle session does not keep the process alive; a call in
flight does, so a script that forgets `close()` still exits.

## Licensing from Node

A Node host has no page, so what the browser reads from `location` it declares:

| field        | from a Node host                                                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `domain`     | declared (`UDOC_DOMAIN` for the CLI and server), `"unknown"` if not. A license is checked against its domain list, so a licensed host must declare one the key covers. |
| `wrapper`    | `udoc-node`, or `udoc-cli` / `udoc-server` when they are the embedder. Paired with its version so the two cannot disagree.                                             |
| `distinctId` | the host's, if it has one; none otherwise, and usage attributes to the domain.                                                                                         |

Free usage spends a permit per session opened, metered by client IP because a Node
host sends no browser `Origin`. A server opens a session for every upload and again
each time it reopens a kept document, so it reaches the free cap quickly; in practice
it runs licensed. The CLI and server read the key from
`UDOC_LICENSE` rather than a flag, so it stays out of the process list.

Because the permit endpoint is production, no test starts a session by default. The
tests exercise the judgments above the engine instead: `udoc-node` drives a document
over a stand-in thread, `udoc-server` serves stand-in documents over real HTTP. One
opt-in test, `UDOC_LIVE_ENGINE=1`, opens, exports and saves a document for real — spending a
permit unless `UDOC_LICENSE` is set.

## The server keeps documents

`udoc-server` imports a document once and keeps it; every session after that is opened
over what it kept.

**What is kept.** Its original and its checkpoints, and more once it is edited. Its
original is the upload, byte for byte, in the format it was imported as. Each
checkpoint is a udoc package, a baseline. `v0` is what the upload
became: the upload is opened — the one open that mints the document's ids — and saved
as a flat baseline. Each checkpoint after it saves the document's session as the next
baseline (Core Save — Checkpoint), and a later session
reopens the latest, ids and all (Core Editor — Bootstrap).
A udoc package is not an upload: its ids were minted by whatever imported it and it
has no original, so the server refuses a session the engine reports opened from one.
Only the open can tell, so the refusal has already spent a permit. Its edit log is
every edit made since the import: a package's own `crdt` entity, which opening
applies, but kept apart from the checkpoints, since it is written on every edit and a
checkpoint once ([Node Collaboration](node-collaboration.md#the-edit-log)). And the
opaque parts its edits name — an inserted picture's image, whose content the log does
not carry — each part and blob kept beside the checkpoints, written once, until a
checkpoint holds it (Core Editor Opaque Part). A part
only an earlier checkpoint holds is read from the newest that does: a later one holds
it only if something showed it then, and an undo can show it again.

A `DocumentStore` keeps each by id; `DirectoryDocumentStore` gives each document a
directory in `--data-dir`, holding `original.<format>` and `checkpoints/v0.udoc`,
written aside and renamed into place together — so a document is kept whole or not at
all, and an id already kept is never overwritten. Each later checkpoint is
`checkpoints/v<n>.udoc`, written aside and linked into place, so a version is kept
once; the highest is the latest. Once the document is edited it also holds
`crdt.loro`, replaced whole on each write, and `opaque-parts/<kinds>/<partId>` and
`blobs/<key>`, each deflated. An id reaches the store only once the server has checked
it is one it could have minted, so no id is ever a path.

**A session is a cache over it.** A request opens its document's session from the store
when none is open, and every request arriving meanwhile shares that open, so a document
opens once. It opens over the store, part by part as a browser streams it — `openRemote`
with a fetch the store answers, over the latest checkpoint — so it loads the opaque
parts an edit added. The session an upload was imported in
is closed once the document is kept: opened from the upload's bytes, it could load none. The session stays open while requests keep coming, and closes after the
session timeout (`--session-timeout`, default 5 minutes) or — past the session pool's
size (`--session-pool`, default 32) — least recently used first, but never while a
request is using it. A session that closed, or whose engine died, is opened again by
the next request. So a document outlives the process, and once its requests finish
the process holds no more sessions than the pool's size.

Two costs follow from reopening. It spends a permit like any open, so a server that
closes sessions often reaches the free cap sooner still. And it composes again: the
pages a session had composed go with it.

Every setting is a flag, and can also be a key of the same name in a TOML file given
with `--config`: the flag overrides the file, the file the default. One vocabulary
serves both, and an unknown key or a value out of range is an error naming the file
and the key, never a silent default. The license stays in the environment, so the file
can be committed or baked into an image.

| request                                                                                               | answer                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /documents?format=` (the bytes)                                                                 | `201 { id }`, the document kept · a license refusal `503` with its code · unreadable `422`, `malformed` or `unsupported` · a udoc package `422 cannotImportPackage` · too large `413` · a `format` that isn't one `400`                                                                                                                                                         |
| `GET /documents/:id/original`                                                                         | the upload, byte for byte — read from the store, with no session opened                                                                                                                                                                                                                                                                                                         |
| `GET /documents/:id/layout/page-count`                                                                | `{ pageCount }` — a resource of its own, because the first ask composes the whole document                                                                                                                                                                                                                                                                                      |
| `GET /documents/:id/layout/pages/:index.png?scale=`                                                   | the composed page as a PNG · no such page `404 notFound`                                                                                                                                                                                                                                                                                                                        |
| `GET /documents/:id/package` · `…/package/:kinds/:partId` · `…/package/blobs/:key` · `…/package/crdt` | the latest checkpoint's description, one part — its, an opaque part an edit brought, or an earlier checkpoint's — one blob, the edit log — read from the store, with no session opened ([Node Streaming](node-streaming.md))                                                                                                                                                    |
| `GET /documents/:id/collaboration`, upgraded to a WebSocket                                           | edit the document with every other client connected to it ([Node Collaboration](node-collaboration.md)) · a refusal takes the upgrade and closes it with a code · without the upgrade `426 upgradeRequired`                                                                                                                                                                     |
| `GET /documents/:id/file.:format?strategy=`                                                           | a copy saved in the document's session as `format` — one of its own (`pdf`, `pptx`, …) by `strategy`, `rewrite` if absent, `delta` or `incremental`, or `udoc` for a package, which takes none (Core Save — Copy) · a format or strategy it can't be saved by `400 invalidRequest`, or a save not built `422 unsupported` · a strategy that isn't one, or one for `udoc`, `400` |
| `POST /documents/:id/checkpoints`                                                                     | `201 { version }`, the session saved as the next baseline and kept as the latest, no session reopened (Core Save — Checkpoint) · checkpoints of one document taken in turn                                                                                                                                                                                                      |
| `DELETE /documents/:id`                                                                               | `204`, what was kept forgotten, its collaboration ended and its session closed                                                                                                                                                                                                                                                                                                  |

The server doesn't listen: it answers the requests and upgrades its host hands it.
`handleRequest` and `handleUpgrade` take one whose path, beneath the `basePath`
it was built with, is one of its routes — for any method, so a `405` is still its
own — and return `false` for any other, untouched, for the host to answer. So an
embedder mounts it in a Node server of their own, beside their own routes and
WebSockets; the `udoc-server` command is one more host, whose HTTP server answers
the rest with a `404`.

The count and the page images sit under `layout`: they are composed pages, which the
layout owns, not parts of the model — a word-processing document's pages exist only
once composed. Pages count from 0 here and from 1 in the CLI: `udoc-node`'s range
error says only how many pages there are, and each host words the address in its own
numbering.

Streaming and co-editing hang on the same two pieces. Streaming a document's parts
reads the store — the latest checkpoint's entries — and needs no session at all.
Co-editing it is a collaboration: its pooled session, held busy while any client is connected, so
neither idled out nor evicted. A session opened on an edited document merges its log,
so the layout and the saves show the edits.

## Status

**Built:** the three packages, for opening, counting, exporting pages and saving.
`udoc-node` opens a document on its own thread — detecting its format, or as the one
the host names, and saying whether it was a package — or opens a package a server
keeps, part by part ([Node Streaming](node-streaming.md)); counts the pages of its
primary plane — composing all of them, since a page is known only once composed —
exports one to PNG, and saves the document to one of its own formats or as a udoc
package; offers each session the host's own fonts, as bytes or by URL, and the Google
font catalog, and fills every font order a composing call places — a `file:` URL read
from disk, anything else fetched, a Google family through css2, with the fulfiller the
browser host uses (Text Font System) — composing again until
none is left, so a page it exports is never drawn in a stand-in; keeps the font files
it downloads in one cache per `UDocNode`, least recently used dropped first past a byte
limit, which every session's worker asks before the network, so a second document naming
a family downloads none of it;
`udoc page-count` prints the count, `udoc render` writes one page to a PNG,
and `udoc save` writes the document in the format its output's extension names;
`udoc-server`, listening on loopback by default or embedded in a host's own Node
server beneath a base path, keeps each upload as its original
and its checkpoints, a directory per document; serves the original and the package
part by part from the store ([Node Streaming](node-streaming.md)); serves counts,
pages, copies and checkpoints from a pool of sessions over what it keeps; and lets
clients edit a document together, keeping its edit log ([Node Collaboration](node-collaboration.md)),
through the engine's sync calls, which `udoc-node` carries. The native CLI is
`udoc-debug`, and VRT replay picks whichever of the two names a replayed revision
has.

**Not built:**

- A host font from the CLI or the server. Neither takes a font file or a Google Fonts
  setting, so each offers only the package's fonts and the Google catalog.
- Planes past the first, export to other formats, authentication.
