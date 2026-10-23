# Design docs

Index of architecture & design documents for `docmentis-udoc`.
See [CLAUDE.md](../../CLAUDE.md#design-docs) for conventions.

The engine's own design — its core, doc types, facade and the wasm boundary
the packages here call through — is documented with the engine, not here.

## Topics

### UI

- [UI Editor](ui-editor.md) — the web UI's architecture: udoc-ui, the shared
  core the viewer and the editor are built on, neither reaching the other;
  the ported framework primitives (store/selectors/component), the
  fixed-canvas dirty-rect render model with synthetic scrolling, and the
  main-thread, worker-ready `DocumentEngine` seam.
- [UI Extension](ui-extension.md) — the one object udoc-editor adds edit mode
  through: what the shell lends it, what the shell asks it (its mode, tab
  strips and commands, ribbon controls, menu actions, context menu, guide band,
  place tools, selection chrome and canvas gestures), and its worker requests.
- [UI Thumbnail Panel](ui-thumbnail-panel.md) — the left-panel page/slide
  navigator: engine-raster previews over a new `render_page_to_rgba` wasm
  entry, the yield-gated render priority the autonomous viewport forces, the
  LRU bitmap cache, virtual scrolling, and the slide-navigator future.
- [UI Color System](ui-color-system.md) — the chrome's neutral color roles
  (`--udoc-color-*`, M3 names, hand-set light/dark values, lighter is raised)
  and the component tokens over them (region fills, marks on the document),
  states as four opacities composed as fill + overlay, the engine read-back via
  a probe element, and host customization.

### Node

- [Node Hosts](node-hosts.md) — the engine outside a browser: `udoc-node` (the
  embeddable library), the `udoc` CLI and `udoc-server`, all on the one wasm build
  through the one `startSession` door; why wasm and not a native addon, one document
  per worker thread (the event loop, the trap that poisons an instance, the session
  that is already one document), what a Node host declares for licensing, and the
  server's two pieces — each document kept as its original and its udoc package,
  and a pool of sessions caching what is kept — that streaming and co-editing
  hang on.
- [Node Streaming](node-streaming.md) — a browser or a Node host opening a kept
  document part by part: the server's `package` routes (kinds as kebab-case plurals,
  blobs by content key, the edit log), what the server maps and the client fetches,
  and why versions wait.
- [Node Collaboration](node-collaboration.md) — clients editing a kept document
  together: the collaboration a pooled session held open, the edit log kept apart
  from the package and merged from the empty frontier, the WebSocket channel's
  join / patch / presence messages, a presence refreshed while joined and withdrawn
  on leaving, the close codes and which a client rejoins after, and why there is no
  REST fallback.
