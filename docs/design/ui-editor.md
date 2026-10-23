# UI Editor

The web UI over the engine. Lives in the npm workspace under
[`packages/`](../../packages/), beside the Rust crates, as three packages:
`@docmentis/udoc-ui`, the shared core — the shell, the canvas and the worker —
and the two built on it, `@docmentis/udoc-viewer` and `@docmentis/udoc-editor`,
plus the editor's demo. udoc-ui imports neither, and the viewer never imports
the editor: viewer licensees must not receive it. Edit mode is udoc-editor's
alone; udoc-viewer's `no-editor` test reads every file a viewer install ships
and fails on the editor's name or a call only edit mode makes.
Framework-agnostic, no UI-framework dependency.

## Layers

Adapted from the existing `docmentis-udoc-viewer` architecture; the
framework primitives are ported nearly verbatim (MIT).

```
framework/   doc-agnostic primitives
  store        Redux-like: pure reducer + render/effect/action subscription
               phases + microtask batching
  selectors    derived slices with equality (re-render only on change)
  component    optional base class; factory `{ el, mount, destroy }` preferred
  dom/events   change-detecting DOM patches; listener helpers

geometry     shared document-space types (Size/Rect/Viewport/DocumentLayout)
worker/      WorkerClient (main thread; its job is to talk to the worker)
             + worker (the worker; its job is to talk to the WASM — a thin pump:
               forwards resize/scroll/zoom, ticks render_frame on rAF)
             + protocol (wire types) + wasm-loader (artifact URL candidates)
wasm/        wasm-bindgen glue contract (the Rust `WasmSession` owns the
             OffscreenCanvas + the whole compositor; see facade-wasm)
app/         app layer on the framework
  state/actions/reducer   pure, serializable state machine
  effects                 async background work (off the hot path)
  shell                   wires store + components + worker client + effects
  components/             Canvas (viewport surface + input), Toolbar
extension    the seam a package adds its own mode through
```

That is udoc-ui. udoc-viewer is its `UDocViewer` and a worker entry serving
the engine alone; udoc-editor is `UDocEditor`, its worker entry with edit
mode's requests, and edit mode itself — the extension (`edit-mode.ts`) and
what it brings: the tab strips and their commands, the ribbon controls, the
grips, the ruler, the context menu and the clipboard.

## Extension

udoc-editor reaches the shell through one object, `UIExtension`, and adds
edit mode through it; udoc-viewer hands none. What the shell lends it and asks
of it is [UI Extension](ui-extension.md).

## Rendering model: fixed canvas, dirty-rect

Unlike the previous generation's udoc-viewer (which rasterized per-page
bitmaps and cached them), the UI uses **one canvas pinned to the viewport**. The worker keeps a retained
scene and repaints only invalidated regions — every keystroke and scroll frame
is an incremental render. Scrolling is **synthetic**: wheel/touch is intercepted
and turned into a document-space viewport translate, never native DOM scroll.
Zoom is *faithful* (`1.0` == 100%: one document inch per inch of the screen);
the Rust viewer works in device px with an explicit dpi, and the worker declares
it as `dpi × devicePixelRatio`, where `dpi` is the screen's CSS px per physical
inch — the doc type's default unless the host calibrated it so 100% shows a page
at its real size — so every TS pt ↔ CSS-px conversion goes through
`zoom × cssPxPerPt(viewDpi(state))` (`dpi / 72`). The default is 96, the CSS
inch, but 72 for a spreadsheet: Mac Excel's 100% draws a point as a screen
pixel, so a sheet at 100% matches it (`defaultDpiForDocType`, which the worker
applies at open, before the first frame).

The `WorkerClient` API captures this: `attach(canvas)` once (it transfers the
canvas to the worker), then `setViewport` / `invalidate` are cheap, latest-wins
signals; the worker repaints the pending dirty area on its own
`requestAnimationFrame` loop. State holds scroll/zoom in document space; pixels
never enter the store and never cross the worker boundary.

The dirty-rect core is the Rust `WasmSession` (in `docmentis-udoc-facade-wasm`).
It stacks pages into one document-space coordinate system and, on scroll, **blits
the existing pixels by the (integer device-pixel) scroll delta and re-rasterizes
only the newly-exposed band** — rasterizing just the page-local sub-rects
intersecting the dirty rect (via `Engine::render_page_to_pixels`), compositing
over white, and `put_image_data`-ing them onto the OffscreenCanvas it owns (via
`web-sys`). Zoom/resize repaint the whole window. Because the canvas has no
native scrollbar, a virtual `Scrollbar` overlay (per axis) renders the position
and turns drag/track clicks into scroll actions.

## Threading: WASM owns the session, in a worker

`attach` transfers the canvas to a worker via `OffscreenCanvas`; the worker hands
it to the Rust `WasmSession`, which owns the document, the compositor, and the
canvas draws. The worker is a thin pump: it forwards resize/scroll/zoom and ticks
`render_frame()` from its own `requestAnimationFrame` loop (the host owns the
frame clock; Rust owns what/how to paint). The main thread keeps only a thin
`WorkerClient` that forwards viewport/input over `postMessage`. Tiles are
`put_image_data`'d straight onto the OffscreenCanvas inside the worker — they
never cross the boundary, so there is no per-frame pixel copy. Scroll/zoom
*state* stays in the shell's pure reducer; Rust receives the clamped values.

- **Worker-only.** `OffscreenCanvas` 2D is broadly supported (Chrome 2018,
  Firefox 105, Safari 16.4). `WorkerClient.create` throws an `unsupported`
  `UDocError` on older runtimes rather than maintaining a second main-thread
  render path.
- **Each product has its own worker.** udoc-ui's `worker.ts` is a library,
  not an entry: a product's worker entry calls `serveEngine` with the request
  handlers it adds — none for the viewer, edit mode's (`worker/handlers.ts`)
  for the editor — and is passed to `createAs` as `startWorker`. A handler
  answers a request by type, and a `sticky` one is replayed into each new
  session as the engine's own settings are. Edit mode sends its requests
  through `EditClient`, over the client's `request` / `post`; so a viewer's
  worker carries no edit request at all.
- **The worker carries the glue.** A release bundles each worker whole, the
  wasm-bindgen glue included, into a classic script it starts from a blob
  (each product's `worker-source.ts`; udoc-ui's for a local collaboration
  service's worker), so a product runs from any origin — a CDN, a host's
  bundle — with no bundler and no module workers. Only `npm run dev` starts the
  unbundled module worker beside the product's modules.
- **WASM loading.** Only the binary and the office-compatible fonts are
  located, by trying an ordered candidate list — explicit `baseUrl` →
  `import.meta.url` (via the isolated, dynamically-imported `meta-url` module,
  which names each file by its own literal, so a bundler emits it) → the CDN,
  jsDelivr's copy of exactly the `@docmentis/udoc-wasm` udoc-ui was built
  against unless `cdnUrl` says otherwise — until one `init` succeeds. This is
  the fix, inherited from `docmentis-udoc-viewer`, for "wasm not found" across
  bundlers/hosts; it also survives content-hashed asset names because the
  resolved `.wasm` URL is passed explicitly to the glue's `init`.
- **Serialized messages.** The worker processes one message at a time, so
  `open`/`close` can't interleave with a render (and a future async GPU render
  path can't trigger a concurrent `&mut self` borrow on the `WasmSession`).
- **Background work** (prefetch/decode adjacent pages, warm caches, CRDT sync)
  belongs inside the worker, not on the main thread; the `effects` layer holds
  only the off-hot-path main-thread concerns (e.g. the document-generation guard
  for stale async results).

## Overlays & page chrome

The canvas is Rust-painted, so interactive page chrome is **HTML floated over
it**: after every painted frame the worker streams the on-screen pages
projected to CSS px (plus the frame's zoom, authoritative scroll, and content
extent), and the `OverlayManager` reconciles registered `OverlaySource`s
against that stream — pooled elements, one compositor-friendly transform per
item.

The manager is a **registry**, not a slot: `setOverlay(id, source)` /
`removeOverlay(id)`, any number at once, stacked in registration order. The
built-in chrome registers through the same public surface under `udoc:` ids,
so a host can remove or replace a built-in exactly like its own overlay. The
boundary is what's *in* the registry: optional chrome is; anything the UI
requires to function (selection, caret) is not. The first such layer
is the **selection overlay** (`SelectionLayer`): it holds the worker's
page-anchored selection geometry — re-sent only when the selection or
document changes — and re-projects it against the same per-frame page
stream; see Core Editor — Selection.

The registry fills two layers, one either side of the selection overlay.
Page chrome goes under it, so no control covers a selection handle. An
overlay set with `aboveSelection` goes over it: chrome that belongs over the
selected object, as the annotation bar (`udoc:annotation-bar`) and the comment
popup (`udoc:comment-popup`) do. An id lives in one layer; setting it in the
other moves it.

Edit mode's built-ins, registered by udoc-editor's extension
(`showPageControls: false` opts out):

- `udoc:page-controls` — a constant-size vertical rail beside each page's
  right edge, top-aligned with the page (in the screen-fixed side padding,
  never covering content; proximity and alignment make ownership
  unambiguous). It is a column of actions — move up / move down / rotate /
  more / delete — and "more" opens a per-page popup with the page's size and
  rotation (rotate and size are UI-only until the engine grows those
  commands). Hidden when the page is shorter on screen than the rail.
- `udoc:page-insert` — insert lives *between* pages: an invisible strip
  filling each gap (plus above the first and below the last page) reveals a
  divider + "+" on hover. The strip above page N inserts before N — i.e.
  after N−1 — so there is no before/after question.

Spacing is split across the two layers. The page **gaps** are the layout's
(a `PageGap`, across a spread and down from one to the next) — page-fixed
(`Pt`), so they scale with zoom and the inter-page strip stays a constant
*document* size; the host scales its in-gap chrome (divider + "+") with zoom to
match. The controls keep their own gap: a host's `pageGap` applies wherever they
aren't showing, and they show only in continuous scrolling over a single-page
layout, where no facing page sits where the rail goes. The **content padding** is the camera's
(`setContentPadding`) — each edge a `ViewLength` (`Pt` page-fixed | `Px`
screen-fixed), framing the page stack with margin the scroll can reveal; px
padding is sized for screen chrome living in the outer margin and re-resolves on
zoom/density change.

Because the gap is page-fixed, **page positions are zoom-independent**: the
content extent no longer changes with zoom, and a zoom keeps the content point
at the viewport's top fixed with no re-anchoring (the old top-edge anchoring is
gone). The camera still *derives* its zoom in fit modes and clamps scroll, so
the per-frame report carries the authoritative scroll/zoom and the shell adopts
them — but only from frames whose echoed viewport `seq` matches the latest sent,
so a stale mid-burst frame can't yank the view back.

Page rotation and page-size commands are follow-ups: they need new engine
commands (`PortableCommand` currently has insert/delete/move only) before the
pill grows those buttons.

## Styling

Each package ships its own CSS as a single string, injected into one `<style>`
on mount: udoc-ui's ([`app/styles.ts`](../../packages/udoc-ui/src/app/styles.ts),
exporting `uiStyles`), with an extension's `styles` laid after it — udoc-editor's
([`styles.ts`](../../packages/udoc-editor/src/styles.ts)) for edit mode's own
chrome. The CSS is **authored directly in TS** via a `css` identity tag — no
`.css` source, no codegen, no build step beyond `tsc`. (The tag only marks the
backticks so an IDE's CSS highlighting/Prettier lights up; it has no runtime
effect.)

udoc-ui's stylesheet was **seeded once** from the previous generation's
udoc-viewer `styles.css` (renamed `udoc-viewer` → `udoc-ui`) to share its look
and feel, and is owned here since — **never synced** in either direction. There
are no separate override sheets — everything that used to be layered on top (the
virtual-scroll thumbnail panel, in-flow panel docking, the developer and
per-page-settings dialogs) is folded into the one file in cascade order.

## Status

The worker is wired: `createAs` spawns the worker (via
`WorkerClient.create`), which hands the canvas to the Rust `WasmSession` (built
from `@docmentis/udoc-wasm`). It renders real documents with the dirty-rect /
scroll-blit model above, plus virtual scrollbars. Verified end-to-end in headless
Chrome (open → 2-page layout, then driving real scroll + zoom with no worker
exceptions). Each package's class — `UDocViewer` and `UDocEditor`, both
extending udoc-ui's `UDocBase` — is its entire public surface; `WorkerClient`
and the worker are internal.
