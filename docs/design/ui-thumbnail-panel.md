# UI Thumbnail Panel

The left panel's `thumbnail` tab: a scrollable strip of per-page (per-slide)
preview images that navigates the document and, for presentations, will host
slide structure editing. An editor port of the viewer's read-only thumbnail
panel, extended with engine-raster previews, a render cache, virtual scrolling,
and a render-priority discipline the editor's autonomous viewport forces.

## Placement & lifecycle

The `thumbnail` tab already exists in `LeftPanel` (today a placeholder). When it
becomes the active tab, `LeftPanel` lazily mounts `createThumbnailPanel()` into
its content area and destroys it on tab switch — the same lazy-content pattern
the viewer's `LeftPanel` uses. The panel needs the `WorkerClient` (for renders),
so `LeftPanel.mount` is widened to thread `client` through from the shell.

Navigation reuses the existing seam: a click dispatches `NAVIGATE_TO_PAGE`; the
current-page highlight reads `state.page`. No new navigation plumbing.

## Pixel source — engine raster

The editor worker owns a single live-viewport `OffscreenCanvas` driven by a
Rust-owned `render_frame()` rAF loop; it has no request/response render path
like the viewer's worker. So thumbnails get a **new** wasm entry that rasterizes
an arbitrary page off the viewport:

- Rust already has `engine::render_page_to_pixmap(page_index, bbox, scale)`
  (`libs/facade/.../engine.rs`). We export a thin wasm wrapper —
  `render_page_to_rgba(page_index, width, height) -> Uint8Array` (premultiplied
  RGBA), matching the viewer's binding name — that calls it and returns the
  pixmap bytes.
- The worker handles a `renderThumbnail` message by calling that method and
  transferring the `Uint8Array` back; the main thread wraps it via
  `createImageBitmap(new ImageData(...))`, exactly as the viewer does.

Dimensions are pre-computed on the main thread (`pageAspect × thumbnailWidth ×
DPR`); the wasm call takes explicit pixel `width`/`height`, not a scale.

## Render priority — the editor divergence

In the viewer, viewport page-renders and thumbnails share one main-thread work
queue, so thumbnails simply sort _after_ page items (`sortQueue`, page items by
distance to `pageFocus`, thumbnails by `thumbnailFocus`, page-before-thumbnail).

The editor's viewport is **not** request-driven — it is an autonomous
`render_frame()` loop on the worker thread. A thumbnail render is a _synchronous_
wasm call on that same thread, so it competes with live painting directly.
Priority control is therefore a **yield gate**, not a queue sort:

- Thumbnail renders run only while the viewport is _settled_. We reuse the
  compose-ahead discipline already in `shell.ts` (`viewportSig` + idle
  scheduling): while scroll/zoom/edit are in flight the signature changes and
  thumbnail work defers; it resumes when the view stops. Thumbnails share the
  idle budget with compose-ahead and always lose to a moving camera.
- The pending thumbnail queue lives main-side in `WorkerClient`, one render
  in flight at a time, ordered by distance to the **visible window** (the
  `thumbnailFocus`/boost equivalent), so what the user is looking at fills first.

## Render cache

A `WorkerClient`-owned `Map` keyed `docGen:page:scale.toFixed(4)` (mirroring the
viewer's `makeRenderKey`), holding the decoded `ImageBitmap` plus `lastAccess`
for LRU eviction. Thumbnails are small, so the cap is **count-based** (the
viewer uses 500). The key includes `docGeneration` (bumped per open) and is
invalidated per-page on edits — an edit to slide _N_ drops _N_'s entry so the
strip re-renders just that one, leaving the rest cached.

## Virtual scrolling — incremental, not pre-sized

The viewer can build one DOM item per page up front because it knows the whole
page list the moment it opens: `getAllPageInfo` returns every page's
size/rotation in one call, dispatched as a complete `pageInfos` array. The
editor has **no such list** — page count grows as compose-ahead advances
(`DOC_RELAYOUT` keeps bumping `pageCount`) and page sizes change under edits.
So the editor must _not_ reuse the viewport's virtual scrolling (which leans on
a worker-authoritative `contentSize` streamed per frame); it builds its own
incremental model:

- **Extent grows with composition.** The strip's scroll height and scrollbar
  are sized from the _composed prefix_ (`state.pageCount`), not a known total,
  and grow in lockstep with the same `DOC_RELAYOUT`/compose-ahead signal that
  grows the main viewport's scrollbar. There is no final page count to allocate
  against — space appears as pages compose.
- **Heights are estimated, then corrected.** A not-yet-measured item uses a
  placeholder aspect (a uniform-slide guess); its real ratio arrives lazily from
  the doc-type-agnostic `pageSize(index)` (the engine's `page_metrics`, so a
  slide sizes like a PDF page) when the item enters the window (cached), and a
  size that _changes_ under an edit re-measures that item and adjusts the
  running extent and the offsets below it.
- **Only the visible window is mounted and rendered.** Item elements exist only
  for the visible range (+ a small overscan) over a spacer sized to the running
  extent; they recycle as the window scrolls. Only mounted items request
  renders (cache-first). Scrolled-away items are unmounted but their bitmaps
  stay in the LRU cache, so scrolling back is instant.

## Current-page sync (viewport ↔ strip)

The viewer carries a lot of bidirectional sync because it derives the current
page from scroll position in JS (`updateCurrentPageFromScroll` →
`findSpreadAtCenter` → `SET_PAGE`) and guards that against programmatic nav
(`navigationPage`/`navigationScrollTop`). The editor inherits the easy half for
free: the worker already streams `currentPage` each frame and the Canvas folds
it into `state.page`/`state.pageIndex`, so the strip never re-derives it from
spread math. What the panel still owns:

- **Viewport → strip.** Subscribe to `state.page`; on change, move the active
  highlight and `scrollIntoView({ block: "nearest" })` the active item. Because
  that scrolls the _panel_ container (not the document viewport), it can't loop
  back into a viewport scroll — the same natural guard the viewer relies on.
- **Strip → viewport.** Click and keyboard (↑/↓, Home/End, Enter/Space) dispatch
  `NAVIGATE_TO_PAGE`; the shell already forwards the request seq to
  `client.goToPage`, which scrolls and streams the new `currentPage` back. No
  new viewport plumbing.
- **Keyboard focus vs. current page.** A local `focusedPage` (arrow-key cursor)
  is distinct from `state.page` (where the viewport is) and follows it on every
  viewport-driven change, but may lead it while arrowing before Enter commits —
  mirroring the viewer.
- **Render-focus follows the eye.** On panel scroll, the thumbnail queue's focus
  is set to the item nearest the panel center (the `boostThumbnailRenderPriority`
  / `findFocusThumbnail` equivalent), so the window the user is looking at fills
  first — independent of where the viewport's current page is.

## Slide-awareness & profile gating (forward-looking)

The thumbnail panel is the **slide navigator** and will own slide
insert/delete/reorder for presentations — not a page-control overlay (see
[UI Editor](ui-editor.md); structural editing for slides lives here by design).
This splits by doc type via `DocProfile`:

- **PDF** — navigation only; structural editing stays in the page-control rail
  overlay.
- **Presentation** — navigation **plus** reorder/insert/delete/duplicate
  (the `ReorderPage` verb and slide-shape commands are already wired); no
  page-control overlay.

A `DocProfile` capability (e.g. `thumbnailEditing`) encodes which side a doc
type lands on, alongside the existing `pageControls`.

## First slice

Navigate-only: lazy engine-raster previews, the cache, virtual scrolling, the
yield-gated priority, click-to-navigate, current-page highlight, and keyboard
nav. Slide structural editing (drag-reorder, insert/delete/duplicate, the
`+slide` affordance) is a deferred follow-up that builds on this panel.
