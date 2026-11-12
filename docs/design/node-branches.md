# Node Branches

A document udoc-server keeps has **branches**, and each branch **versions**. A branch
is a line of edits: its own edit log, cuts and collaboration. Importing a document
makes its first branch, `main`, and its first version, `v0`; a branch starts from any
version, on any branch; and one branch **merges** into another, its edits reaching
the other as an editor's do. It is how a review works: a reviewer comments in a
branch of the version submitted, while the author goes on editing `main`, and the
merge lands each comment where what it is on has moved to.

## The model

- **One document.** Every branch is the same CRDT document under the same edit ids,
  back to the import, so any edit can reach any branch.
- **A version** is a checkpoint, kept as it was for good. Versions are numbered
  across the document, so a number names one version wherever it is; a cut uses one
  up, so a branch's numbers have gaps. Each records its branch and its **parent**: the
  version before it on its branch, or the one its branch starts from. Following
  parents is a version's **ancestry**, back to `v0`.
- **A branch** has an id the server mints, `main` aside, and a **base**, the version
  it starts from (`main` has none). Its **head** is its latest version, or its base
  while it has none. Its edits since its head are in its log.
- **A merge** of a branch into another brings it the source's edits it lacks, sent to
  its editors and kept in its log, as an editor's are. It makes no version, and it
  never conflicts: what both changed is what the CRDT makes of it — the later write,
  where both set one value.

## The routes

`/documents/:id/…` is `main`'s, as it always was; `/documents/:id/branches/:branch/…`
is any branch's, the same routes beneath it.

| request                                                                                       | answer                                                                           |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `GET …/branches`                                                                              | `{ branches: [{ branch, base? }] }`                                              |
| `POST …/versions/:version/branches`                                                           | `201 { branch }`, a branch based at that version                                 |
| `DELETE …/branches/:branch`                                                                   | `204`: its log, its collaboration, what it merged. Its versions stay. Not `main` |
| `POST …/branches/:branch/merge?from=:source`                                                  | `204`, `source` merged into `branch`                                             |
| `…/branches/:branch/` `package`, `collaboration`, `file.:format`, `layout/…`, `POST versions` | the branch as it is now, as `main`'s routes answer for `main`                    |
| `GET …/versions`                                                                              | `{ versions: [{ version, branch, parent? }] }`, oldest first                     |
| `…/versions/:version/` `package`, `file.:format`                                              | one version as it was; `…/checkpoints/:version/…` too                            |

`POST …/checkpoints` checkpoints `main`, and `GET …/checkpoints` lists `main`'s
versions, as before.

## The store

```
<id>/original.<format>
<id>/versions/v<N>.udoc                       the version's package
<id>/versions/v<N>.json                       { branch, parent?, cut? }
<id>/branches/<branch>/branch.json            { base? }
<id>/branches/<branch>/crdt_delta.loro        its log
<id>/branches/<branch>/merges/<source>.json   { versionVector, moved }
<id>/opaque-parts/…, <id>/blobs/…             the document's, every branch's
```

A read is made **at** a branch, as it is now, or at a version, as it was. A part is
read from the head, or that version, then, unless that one records it removed, the
opaque parts, then along its ancestry: a version holds only what it saved, and the
branches' versions interleave by number. An opaque part's id names one content for
good, so the document keeps each for every branch, and never drops one. A branch's
cuts are its versions marked `cut`.

## A merge

1. Find the **merge base**: the latest version in both heads' ancestry.
2. Open the source as of the merge base, as an editor that opened it there, with that
   version's own log; then catch up through each cut in the source's ancestry since,
   whose package keeps in its own log what that cut dropped
   ([Node Log Cut](node-log-cut.md)), and the source's log. The session now holds the
   source's edits as edits.
3. Hold the target's collaboration, so its session is neither closed nor cut.
4. If either line was cut since the merge base, **move** the source's edits onto the
   target's log, as an editor back from behind a cut moves its unsent ones. A cut of
   the target's dropped the history they depend on; past a cut of the source's, its
   editors copied pages on that cut, under the ids the target's copies have and with
   other dependencies. Either is refused as it stands (the engine's Core Editor Log
   Cut).
5. Merge what the target lacks, and record, under the target, how much of the source
   it now holds, and whether it was moved.

## Limits

- **Again, after a move.** A moved merge authors the source's edits anew, so the
  target lacks the originals, and merging the source again would add them twice: it
  is refused, until the engine can move only the edits after what was merged. A merge
  that moved nothing can be repeated: the CRDT skips what the target holds.
- **A page both lines first edited on different cuts** is refused by the engine's
  catch-up, a branch's merge as an editor's return (Shockwave's `GAPS.md`).
- **Any edit.** A merge takes whatever the source holds; it can't tell a comment from
  a change to the content.
- **A permit.** A merge opens a session of its own, so it spends one.

## Tests

`npm run e2e -- branches` runs a review on the real server and engine, for a Word
document, a deck, a workbook and a PDF, merged with no cut, with the target's log cut,
the branch's, and both. `udoc-server`'s own tests run the routes and the store on a
fake session.
