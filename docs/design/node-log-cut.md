# Node Log Cut

The engine's side is in the engine repo's Core Editor Log Cut.

Every open of a kept document loads its edit log, and the log's history is what takes
the memory. A deck with 22,050 edits reaches 106 MB after a fresh editor's first edit
on the whole log, and stays at 13 MB on a cut one. A **log cut** (a **cut**) drops the
history before a checkpoint from the document's log and keeps the state at that point.
It stays the same Loro document with the same edit ids, and the history it dropped
stays in the kept packages.

## A checkpoint and a cut are separate

A checkpoint happens at any time, as [Node Collaboration](node-collaboration.md)
describes: a package is saved, the log isn't cut, and connected editors notice nothing.

A cut happens only with no editor connected. Connected editors wouldn't save memory
from one anyway, since a session doesn't shrink while it is open.

```
last cut (v3)
    |--- v4's log --->|
    |------- v5's log ------->|
    |-------- /<id>/crdt_delta.loro -------->  now
```

## When a cut runs

When the pool closes a document's idle session: by default 5 minutes after its last
use, or when it is evicted, but not at server shutdown. A collaboration holds its
session busy, so no editor is connected by then. An editor whose connection dropped
tries to rejoin at least every 30 seconds, well inside that wait.

1. New requests for that document wait, through `SessionPool.retired`: its session, its
   `package` routes and its collaboration. A checkpoint can't run beside the cut: it reads
   its version inside the session's use, and a session is closed only with none.
2. `session.cutLog(version, minSavedBytes)` adds one marker edit and measures the
   saving. Below `cutMinSavedBytes`, it returns nothing and the session closes as
   usual, with nothing kept of the marker.
3. Otherwise it saves checkpoint `vN` at the marker and exports the cut log, from one
   instant.
4. `store.putLog` keeps the log as it is, with the marker in it.
5. `store.putCut` writes `vN`, then adds `N` to `cuts.json`, then replaces the log with
   the cut one.
6. The session closes, and the requests that waited reopen from the cut log.

So a cut always lands on a checkpoint of its own, and every editor open before it lacks
the marker. That leaves one way back for all of them, and needs no new message.

## What is kept

| Type  | Path                                                               | What it is                                           | How we use it, why we need it                                           |
| ----- | ------------------------------------------------------------------ | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| store | `/<id>/crdt_delta.loro`, replacing `crdt.loro`                     | The state at the last cut, plus every edit since     | Every open loads it: the memory saving                                  |
| store | `/<id>/cuts.json`                                                  | The versions that are cuts, like `[3, 7]`            | Tells catch-up which packages it needs                                  |
| store | `/<id>/checkpoints/vN.udoc/crdt_delta.loro`, replacing `crdt.loro` | The state at the last cut, plus the edits up to `vN` | Opens the package alone; a cut's package also serves catch-up           |
| store | `/<id>/checkpoints/vN.udoc/metadata.json/baseline_frontier`        | Unchanged: the version `vN`'s parts were saved at    | Open replays from here                                                  |
| store | `/<id>/checkpoints/vN.udoc/metadata.json/baseline_version`         | Unchanged: `N`                                       | A cut's checkpoint takes the next number, so an app's numbers have gaps |

No vector or state is kept beside these. The log holds the state at its cut and records
where it starts, and Loro works a version vector out from it.

## The API

| Type | Path                                                  | What it is                                                 | How we use it, why we need it                                           |
| ---- | ----------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| api  | `GET /documents/:id/package/crdt`                     | Unchanged route, serving `/<id>/crdt_delta.loro`           | Open and catch-up                                                       |
| api  | `GET /documents/:id/package/cuts`                     | `{ "versions": [3, 7] }`                                   | Catch-up's first step                                                   |
| api  | `GET /documents/:id/package/cuts/:version/crdt`       | That cut package's log, deflated                           | Catch-up                                                                |
| api  | WebSocket close `4003`, `CLOSE_BEHIND_CUT`            | This editor is behind the log                              | Starts catch-up; today it would be `1008`, which ends the collaboration |
| api  | `UDocServerOptions.cutMinSavedBytes`                  | The smallest saving worth a cut, 128 KiB by default        | Stops a cut for a tiny edit                                             |
| api  | `DocumentStore.putCut`, `getCuts`, `getCheckpointLog` | Store methods; `putCut` keeps the order above              | Hosts with their own store implement them                               |
| api  | `UDocError` code `behindCut`                          | What `session.patchSince` throws for a peer behind the log | The server turns it into `4003`                                         |
| api  | `session.cutLog(version, minSavedBytes)`              | `{ checkpoint, log }`, or nothing                          | Marker, save and cut from one instant, so they can't run out of order   |
| api  | `session.catchUp(logs, version)`                      | Merges the logs, then adopts the cut or rebases            | The whole client side of catch-up                                       |
| api  | `session.baselineVersion()`                           | The version this editor opened at or last caught up to     | Picks which cuts to fetch                                               |

## An editor back after a cut

An editor left open across a cut, whatever kept it away, comes back the same way:

1. Its `JOIN` is refused, because its version vector lacks the marker: `patchSince`
   throws `behindCut`, and the server closes the connection with `4003`.
2. It reads `…/package/cuts`, then fetches the log of each cut after its
   `baselineVersion`, plus the current log.
3. `session.catchUp` merges them in order. With no unsent edits it adopts the cut and
   keeps its undo. With unsent edits it re-authors them on the log and loses its undo.
4. It rejoins and sends its edits.

`udoc-ui`'s collaboration does this on `4003`, as it rejoins on the codes it rejoins
after today. A local collaboration service never cuts, so never sends it.

## Races and crashes

- **A cut between an open's two reads.** A client that read the description before a cut
  and the log after it has parts older than the log's start. The engine sees that and
  re-reads the description once.
- **A crash during a cut.** `vN`'s `baseline_frontier` is the marker, so the kept log has
  to hold the marker before `vN` exists, or that document wouldn't open: hence
  `store.putLog` first. After that, `putCut` writes the package, then `cuts.json`, then
  the log, and the log's replacement is atomic. Until it happens, the log kept is uncut
  and valid over the new package, so opens and edits go on as if no cut had started. The
  next idle close cuts again, and a `cuts.json` entry left behind names a package that
  holds its log, which catch-up can read like any other.

## With no cut

If a cut never runs, nothing else changes: the log isn't shallow, so page copies are
made as today, `patchSince` never refuses, `4003` is never sent and `cuts.json` doesn't
exist. Only the log's file name differs.

## Tests

`npm run e2e` (`scripts/e2e.mjs`) runs a server's own cuts, catch-up and the rebase on the
real server and engine, on all five doc types, and again with the real editor in headless
Chrome. `udoc-server`'s own tests run the server's side on a fake session.

## Limits

- **A document that is never idle is never cut.** New opens keep loading everything
  since the last cut.
- **Open sessions don't shrink.** Only new opens get the saving. A client can't trim its
  own log either: Loro refuses incoming edits from before its cut, which includes every
  other editor's page copies.
- **Coming back with unsent edits loses the undo stack.**
- **Catch-up needs the cut packages.** Nothing deletes packages today, and deleting one
  breaks catch-up for any editor behind it.
- **A document with no checkpoint since its import** opens through `merge_patch`, as
  today. A first cut ends that, since its package has a frontier to replay from.
