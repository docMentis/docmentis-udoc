# Node Branches

A **branch** is a document udoc-server keeps as another stood at one of its
checkpoints, edited apart from it and then **merged back**: each edit made in the
branch reaches the document as it is by then, beside the document's own edits since.
It is how a review works: a reviewer comments on exactly the version submitted, while
the author goes on editing, and the comments land in the author's document where
what they're on has moved to.

## What a branch is

A branch at checkpoint `vN` is the document as of `vN`, under the same edit ids, so
to the engine it is one more editor that opened the document at `vN`. The store keeps:

| Kept                      | What it is                                                               |
| ------------------------- | ------------------------------------------------------------------------ |
| `original.<format>`       | the document's, shared                                                   |
| `checkpoints/v0` … `vN`   | the document's, shared: `vN` holds only the parts that changed before it |
| `cuts.json`               | the document's cuts up to `vN`                                           |
| `opaque-parts/`, `blobs/` | the opaque parts kept beside the document's checkpoints then, shared     |
| no `crdt_delta.loro`      | so `vN`'s own log is the branch's until it is edited                     |
| `branch-point.json`       | `{ id, version }`: where it was taken from, until it is merged back      |

Shared files are hard links, a copy where the file system has none: none of them is
ever written over in place. Taking a branch opens no session and spends no permit.

## The routes

| request                                           | answer                                                                                                                                        |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /documents/:id/checkpoints/:version/branch` | `201 { id }`, the branch: a document like any other until merged · no such document or checkpoint `404`                                       |
| `POST /documents/:id/merge`                       | `204`, branch `:id` merged back into the document it came from · not a branch, or merged already, `409 notABranch` · that document gone `404` |

## A merge

1. Wait for the branch's collaboration, if any, to keep its log.
2. Keep the branch's opaque parts beside the document's checkpoints, as a client's go
   ahead of its patch.
3. Open a session of its own holding every edit made in the branch since `vN`, as
   edits. Opened at the branch's head, it would hold those before a cut of the
   branch's log only as the state they left. So it opens as the branch stood at
   `vN` — a branch of it there, deleted after — and catches up through each of the
   branch's cuts since, whose package keeps in its own log what that cut dropped
   ([Node Log Cut](node-log-cut.md)), then the branch's log.
4. Hold the document's collaboration, so its session is neither closed nor cut
   meanwhile.
5. If either log was cut since `vN`, move the branch's edits onto the document's log
   as it is now, under a new peer, as an editor back from behind a cut moves its
   unsent ones. A cut of the document's dropped the history the branch's edits depend
   on, so it refuses them (the engine's Core Editor Log Cut); past a cut of the
   branch's, its editors copied pages on that cut, under the ids the document's
   copies have and with other dependencies, which it refuses too. The move copies
   them again on the document's log.
6. Merge `patchSince` of the document's version vector: sent on to its editors and
   kept in its log, as an editor's patch is. Then forget the branch point.

A checkpoint of a branch keeps its opaque parts beside it until it is merged back: a
server session loads them through the store and holds none to send (the engine's Core
Editor Opaque Part), so they reach the document only from there.

## What lands where

Each edit lands where its ids put it, as between two live editors. A Word comment's
range is marks on its characters, so it moves with them; a slide's or a cell's comment
names its shape or its row, so it moves with that (the engine's Comment Model). Where
the document deleted what a comment was on, a Word comment stays at that place, its
marks together; a slide's goes on naming the shape it was on, which is gone; and a
workbook saved from it leaves out a comment on a deleted row.

## Limits

- **Once.** A merge that moves the branch's edits authors them again, so a second
  would add them twice: it is refused. An edit made in the branch after it stays there.
- **Any edit.** The server merges whatever the branch holds; it can't tell a comment
  from a change to the content.
- **A permit.** A merge opens a session, so it spends one, as any open does.
- **Every cut package.** A merge reads the package of each cut of either log since
  `vN`, as catch-up does: deleting one breaks it.

## Tests

`npm run e2e -- branches` runs a branch on the real server and engine, for a Word
document, a deck, a workbook and a PDF, its document cut before it was taken, and
merged with no cut since, a cut of the document's, of the branch's, and of both.
`udoc-server`'s own tests run the routes and the store on a fake session.
