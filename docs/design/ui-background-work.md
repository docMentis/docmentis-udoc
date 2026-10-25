# UI Background Work

How the engine worker fits the work nobody has asked for yet (composing ahead,
thumbnails, a workbook's other sheets, web fonts) around what the reader does.
The code is `packages/udoc-ui/src/worker/lanes.ts` and the tasks in `worker.ts`.

## One job at a time

The worker owns the session, and a wasm call can't be interrupted, so every
touch of the session is a job that runs to its end. Frames run outside the jobs,
on `requestAnimationFrame`. The scheduler only decides which job goes next.

## Two lanes

- **Requests** are every message the host sends: open, the viewport, a pick, an
  edit, a search. They run in arrival order, as soon as the session is free.
- **Background work** comes from tasks, a slice at a time. A slice runs only
  when no request is waiting, no frame is pending and the reader has been quiet
  for its task's window. One slice runs per turn of the event loop, so a request
  that arrives in between goes first.

A reader waits at most for the one slice already running.

## Tasks

Priority is the order of the table.

| Task          | One slice                                                         | Starts                                                               | Stops                                     |
| ------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------- |
| Font installs | install a fetched batch, or settle a refusal; re-shape every page | the font pump fetched a batch, or a font was refused                 | nothing left to install                   |
| Thumbnails    | rasterize the queued page nearest the strip's focus               | the strip queues a render                                            | queue empty: rendered, cancelled, dropped |
| Compose-ahead | compose two more pages, post the layout (`composed`)              | an opened document's first paint; an edit, undo, merge, sheet switch | complete, or a step that didn't grow      |
| Sheet walk    | load the next sheet not loaded yet, post its tab (`planeLoaded`)  | an opened workbook's first paint                                     | its last sheet                            |

A task hands out its slice only as the slice runs. Nothing is queued ahead of
time, so nothing goes stale and no generation counter is needed: an open, a
close or a cancel resets the task's state, and its next slice starts from there.
A step clears its task's state before running, so one that throws ends the task
rather than repeating.

Every task waits for the same quiet window, 300 ms. It is longer than the gap
between keystrokes, so typing doesn't render thumbnails that the next
keystroke's edit throws away. Font installs wait for it too: one re-shapes every
composed page against the new font, a few hundred ms on a long document.

With the developer performance counter on, the HUD shows each task's steps,
average and longest: a step can't be interrupted, so its length is the longest a
reader who comes back during it waits.

## The reader's activity

The shell reports its inputs (`pointerdown`, `pointermove`, `keydown`, `wheel`,
captured at its root) as `readerActivity`, at most every 50 ms. Each of those
can ask the worker something, and the quiet windows keep that from landing
behind a slice.

View requests don't count. The host moves the view on its own too: a relayout
re-clamps the scroll, and a frame's view is adopted back. A window keyed on those
stalls compose-ahead on the echoes of its own steps. A programmatic move needs
no window anyway: its frame is pending, and background work waits for it.

## What the main thread keeps

- **The thumbnail cache**, decoded `ImageBitmap`s, and what the strip wants: it
  queues, cancels and drops renders, and posts its focus. The worker decides
  when each runs.
- **The layout**: the shell adopts each `composed` layout (`DOC_RELAYOUT`) while
  the document is ready.
- **What can't wait**: a print and `renderPage` compose what they need as
  requests (`updateLayout`), and a slide-layout preview renders as one.

## Limits

A slice can't be interrupted, so a long one is still a wait. Loading a large
sheet is one slice (about a second for 32,000 rows), and laying it out happens
in one frame. Making those incremental is the engine's part.
