# Node Streaming

A browser or a Node host opens a document the server keeps without downloading it.
The engine loads a part the first time it needs it — the root at open, a page's body
and resources when the page is composed
(Core Model — Parts and lazy loading) — so a
remote open fetches the parts the engine reaches: each round of a closure's parts in
one request, and the blobs they name in one more.

The API between the two is its own design. It addresses the document's parts as
resources; it does not mirror the package's file layout, which is
the server's storage business.

## The routes

```
GET /documents/{documentId}/package                    the package: { docType, sourceFormat?, baselineVersion, baselineFrontier? }
GET /documents/{documentId}/package/{kinds}/{partId}   one part, as the JSON its model serializes, deflated
GET /documents/{documentId}/package/blobs/{blobKey}    one binary payload a part refers to, deflated
GET /documents/{documentId}/package/batch?p={route}&p={route}…
                                                       up to 64 parts or blobs at once
GET /documents/{documentId}/package/crdt               the edit log, once the document has been edited, deflated
```

- **`{kinds}`** is the part's kind in kebab-case, plural: `Page` → `pages`,
  `SoftMask` → `soft-masks`, `SlideLayout` → `slide-layouts`. A kind already plural
  stays as it is (`Settings` → `settings`, `Styles` → `styles`), and so does a `…Data`
  kind (`FontData` → `font-data`); `Numbering` → `numberings`.
- **`{partId}`** is the id's key, `replica-counter` in hex (`0-1a`). A part the
  document has one of is addressed the same way, at id zero: `package/styles/0-0`,
  `package/catalog/0-0`.
- **Kinds live under `package`**, so no kind collides with the document's other
  resources — `layout`, `original`, `file.*` — and a word-processing root is simply
  `package/documents/0-0`.
- **A part's body is the part**, as its model serializes it, deflated: the server
  serves it, it does not reshape it. A blob is its bytes, and the edit log its
  bytes, deflated the same way — raw DEFLATE (RFC 1951), which the engine inflates.
  Deflated, a body is a fraction of its JSON, and a browser's developer tools show
  none of the document's content in it: out of sight at a glance, not from anyone
  who inflates it. The package's own description stays JSON, and carries what an
  open needs and no more.
- **The edit log is the package's `crdt` entity**, kept by the server apart from the
  package and served beside its parts; the description carries `baselineFrontier`
  exactly when there is one ([Node Collaboration](node-collaboration.md#the-edit-log)).
  No kind's route collides with it: a kind's is a plural.
- **`batch`** names up to 64 parts or blobs, each `p` its route under `package`
  (`pages/0-1a`, `blobs/<key>`). Its body is each entry in turn: a 4-byte big-endian
  length and that many bytes, deflated as the route's own body is — or the length
  `0xffffffff` alone for one the package doesn't have, which fails that entry alone.
  A closure round asks for its parts in one, and the blobs they name in another
  (Core Model). No kind's route
  collides with it: a kind's is a plural, and a part's has an id.
- **A part an edit brought** — an inserted picture's image, an opaque part whose id
  the edit log carries but not its content (Core Editor Opaque Part) — is
  served on the same route as a part the package has.

A blob's key is its content, so its response is cacheable forever. A part and the description make no caching promise yet: see
[Versions](#versions). The log, which grows with every edit, never will.

## Server and client

**The server** maps a request to an entry of the latest checkpoint, to an opaque part
or blob an edit brought, kept beside the checkpoints, or else to an entry of an
earlier checkpoint, the newest first
([Node Hosts — The server keeps documents](node-hosts.md#the-server-keeps-documents)).
It reads the zip's central directory and sends the one entry asked for as the zip
keeps it, deflated, so nothing is compressed again; the log, kept apart from the zip,
it deflates as it sends. It never opens a session, so serving a part spends no permit
and loads no engine. It learns
each entry's route by applying the naming rule above to the entry's name, so it knows
no roster of kinds. A kind, part or blob the package doesn't have is `404`.

**The client** is the engine on a thread of its own: a browser's worker, or a
udoc-node session's. `RemotePackageLoader` maps `load_part(part)`,
`load_blob(key)` and `load_crdt()` to these routes, and `load_raw_parts` to `batch`, inflating each body, and turns the
description into the package `Metadata` — so an open applies the log and comes to the
edited document. Its `HttpFetcher` is the host's: `openRemote(url, fetch)` takes a function
that fetches a URL synchronously and returns its bytes. The engine names each URL; how
the bytes travel, and with what credentials, is the host's. The editor's worker uses a
synchronous `XMLHttpRequest`, which a worker allows. Node has no synchronous HTTP, so
udoc-node's worker posts the URL to the session's side, which fetches it on the
embedder's thread, and blocks in `Atomics.wait` until the answer is counted in. Either
way only the engine's thread waits — never the page, never the embedder's event loop —
for one round trip per batch.
A remote open is an open: one session, one permit, one document
(Wasm Licensing).

Both sides apply the naming rule, each in its own language: it is the API's contract,
written here, not a detail either side owns.

## Versions

A route without a version answers from the latest checkpoint, the baseline a client
opening now opens; a client that opened an earlier one goes on as it was
(Core Save — Checkpoint). The package routes are to take
`?version=`, the baseline's number — additive, so no path moves, and a URL without
one means the latest. The layout is not versioned that way: it shows the baseline plus
the edit log, which a baseline number does not address.

## Status

**Built:** the `package` routes, `batch` among them, over `DirectoryDocumentStore` reading
the latest checkpoint with `yauzl` — a scan of the central directory per request, the
entry sent deflated as the zip keeps it — and `package/crdt`, deflated as it is sent,
with the description's `baselineFrontier`, the latest checkpoint's, its `u64` peers
written whole; `RemotePackageLoader` on these routes, inflating each body and applying
the log; a part or blob found beside the checkpoints when the latest hasn't it, and in
an earlier checkpoint when neither has; `UDocSession::open_remote`; the wasm's
`openRemote(url, fetch)` over the host's fetch; `UDocEditor.openRemote(url)`, fetching
with a synchronous `XMLHttpRequest`; udoc-node's `UDocNode.openRemote(url, fetch?)`,
fetching on the embedder's thread for its blocked worker — with the global `fetch`, a
part failing after 60 seconds, or with the embedder's own, which is how udoc-server
opens a session over its store; and the
demo's `?document=<id>`, which its dev server proxies to the udoc-server
`npm run dev` runs beside it, so page and API share an origin.

**Not built:** `?version=`; an index of a package's entries, so a request needn't scan
them; cross-origin access and authentication.
