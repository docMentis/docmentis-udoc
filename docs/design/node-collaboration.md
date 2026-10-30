# Node Collaboration

Clients editing a document the server keeps, together. A **collaboration** is the
document's pooled session held open while any client is connected
([Node Hosts — The server keeps documents](node-hosts.md#the-server-keeps-documents)):
each client's edits are merged into it, sent on to every other client, and kept as
the document's edit log. The engine does the merging — the sync surface of
Core Editor (`versionVector`, `patchSince`, `merge`, `mergePresence`) — and the
server only carries its bytes.

## The edit log

In concept the log is the package's own `crdt` entity
(Core Package — Baseline, log, and replay):
opening a package applies it, and a plain save drops it. The server stores it apart,
as `crdt.loro` beside the checkpoints, because the log is written on every edit and a
checkpoint once. It holds every edit since the import, so it replays over any
checkpoint's frontier, and a checkpoint leaves it as it is.

- **Written** by the collaboration: after a merge, the session's whole editing state
  replaces the kept log, one write at a time — a merge landing during a write is
  taken in by the next. The last write finishes before the session is let go.
- **Served** at `GET …/package/crdt`, and the package description carries
  `baselineFrontier` exactly when there is a log — the latest checkpoint's frontier,
  or `[]` over `v0` — so a browser opening the package applies it through
  `RemotePackageLoader::load_crdt` and opens current. A document checkpointed before
  any edit was kept serves the checkpoint's own log.
- **Replayed from the baseline's frontier.** Over a checkpoint, the replay starts at
  its frontier, since its parts hold everything before. Over `v0`, a flat baseline,
  the frontier is empty: the log holds every edit made over the flat baseline,
  including the baseline each editor materializes lazily on a first edit — which a
  replay from nothing would insert a second time. So `open_package` applies a
  log anchored at the empty frontier the way a peer's is applied: merged, which
  derives that baseline first so the log's copy of it dedupes. The server's own
  reopen opens the package over its store as a browser does, and applies the log the
  same way.

## The channel

`GET /documents/{id}/collaboration`, upgraded to a WebSocket. What refuses it — no
such document, a license refusal — takes the upgrade and closes it at once with a
code saying why: a browser can't read the answer to an upgrade it isn't given, so a
refusal made before the upgrade would reach it as a dropped connection, one worth
retrying. A path that names no collaboration is answered `404` as a request; without
the upgrade it is `426 upgradeRequired`.

Each message is a binary frame: one byte saying what it is, then the engine's bytes.

| kind               | sent by                                            | payload                                                                             | what the receiver does                                                                                 |
| ------------------ | -------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `join` (1)         | a client, first                                    | its version vector                                                                  | answers `join` with its own version vector, then `patch` — the edits the client lacks                  |
| `join` (1)         | the server                                         | its version vector                                                                  | sends `patch`: the edits the server lacks, preceded by `opaque parts` when they name any               |
| `patch` (2)        | either                                             | a patch                                                                             | merges it; the server also sends it on to every other client and keeps the log                         |
| `presence` (3)     | either                                             | a presence                                                                          | merges it; the server also sends it on. Never kept.                                                    |
| `opaque parts` (4) | a client, before the `patch` whose edits name them | the content of opaque parts — an inserted picture's image (Core Editor Opaque Part) | keeps each part and blob beside the package, before it merges the `patch` that follows. Never sent on. |

The join is also the recovery: a client that reconnects joins with its version
vector, and each side sends what the other lacks, so a dropped connection loses
nothing — and a client that leaves on purpose and joins again, pausing, loses
nothing either. A client is joined before its answer is made, so an edit merged meanwhile
reaches it — perhaps twice, which merging makes harmless. What the engine can't
merge ends that client alone, and nothing of it is sent on or kept.

A client's presence is its selection, its name and its pointer
(Core Editor — Selection is presence). A
joined client refreshes it every 10 s, inside the engine's 30 s presence timeout,
and sends it whole; its pointer crosses alone, as it moves. One that leaves sends
the withdrawal of its presence before it closes, so the others drop it at once;
one that vanishes without leaving drops out within 40 s. The server merges a
presence and sends it on as it does any other, a withdrawal included, but sends
none of its own, not even with a join's answer: it is no peer, and a joiner
learns the others within one refresh.

A close code is WebSocket's own where it defines the meaning, and the server's from 4000. Each says whether a joined client should rejoin; a code it doesn't know, it
doesn't. A client whose join was never answered has nothing to rejoin: whatever
closed it — the server unreachable, a refusal — ends it.

| close code | why                                                                                                                        | rejoin? |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1001       | the server is closing — its collaborations end once their logs are kept, and a client arriving meanwhile is closed at once | yes     |
| 1002       | a message before `join`, a second `join`, or an unknown kind                                                               | no      |
| 1003       | a message that isn't a binary frame                                                                                        | no      |
| 1006       | never sent: the connection was lost without a close                                                                        | yes     |
| 1008       | a payload the engine couldn't merge                                                                                        | no      |
| 1011       | the document's session ended                                                                                               | yes     |
| 4000       | no such document — deleted, or never kept                                                                                  | no      |
| 4001       | a license refusal                                                                                                          | no      |
| 4002       | the document couldn't be opened                                                                                            | no      |

There is no REST fallback. WebSocket over TLS passes nearly everywhere, and a fallback
would have to keep the join, ordering and presence identical over polling — where no
connection's close says a client left. `package/crdt` is the REST half that matters,
and the messages map onto HTTP as they are if a deployment ever needs one.

## Status

**Built:** the channel and the log in `udoc-server`, with the collaboration holding
the pooled session busy — never idled out or evicted — while any client is connected
or arriving; `opaque parts` kept before the patch that names them, and a local
collaboration service sending them on instead, since it keeps nothing an editor's
loader reads; udoc-node's sync calls; `package/crdt` and
`baselineFrontier`; the
remote loader applying the log; `udoc-editor`'s client — `joinRemoteCollaboration`,
`leaveCollaboration`, `pauseCollaboration` and `resumeCollaboration`, heard through
the `collaboration:joined`, `interrupted`, `failed` and `left` events — which rejoins
after 1 s, then twice as long after each attempt that fails, up to 30 s, refreshes the
presence every 10 s, sends a pointer shared with `enablePointerSharing`, and
withdraws the presence as it leaves; its people button at the head of the top
toolbar's right zone, shown while in a collaboration — who is present, switches
showing the others' pointers (`showPeerPointers`) and sharing this one's, and
Pause / Resume, which leaves the collaboration and joins it again (a paused client
still holds a local collaboration service); and the demo,
which joins every editor open on a `?document=<id>` to its collaboration — so the same
URL open in two browsers edits one document.

**Not built:**

- A connection heartbeat. A connection that drops without closing holds the session
  until TCP gives up on it: the presence refresh keeps a client present to the
  others, and the server reads no deadline from it.
- Bounding the log. It is rewritten whole after each batch of merges, so a write grows
  with the document's history, and a checkpoint trims none of it: `ShallowSnapshot`
  trimming and `?version=` come later. A client's first patch carries the baseline it materialized, so a
  document opened in a collaboration gains a log even before anyone edits it.
- Authentication.
