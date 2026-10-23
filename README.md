# docMentis udoc

The open-source packages of docMentis udoc: a web document viewer and editor,
the UI they share, and the hosts that run the udoc engine in Node.

| Package                                          | What it is                                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| [`@docmentis/udoc-viewer`](packages/udoc-viewer) | Framework-agnostic document viewer.                                                |
| [`@docmentis/udoc-editor`](packages/udoc-editor) | Framework-agnostic document editor.                                                |
| [`@docmentis/udoc-ui`](packages/udoc-ui)         | The UI the viewer and the editor are built on. Not for embedding on its own.       |
| [`@docmentis/udoc-node`](packages/udoc-node)     | Embed the engine in a Node application.                                            |
| [`@docmentis/udoc-cli`](packages/udoc-cli)       | The `udoc` command line.                                                           |
| [`@docmentis/udoc-server`](packages/udoc-server) | A document server: keeps documents on the engine and serves their pages over HTTP. |
| [`udoc-demo`](packages/udoc-demo)                | The end-to-end demo app for the viewer and the editor. Not published.              |

All of them run on [`@docmentis/udoc-wasm`](https://www.npmjs.com/package/@docmentis/udoc-wasm),
the udoc engine: a proprietary WebAssembly runtime under its own license,
developed separately and installed from npm.

## Development

```sh
npm install
npm run build
npm run dev           # the demo, with the UI packages and udoc-server rebuilding as you edit
npm run typecheck
npm test
npm run lint
npm run format:check
```

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT License ([LICENSE-MIT](LICENSE-MIT))

at your option. This covers the code in this repository, not the
`@docmentis/udoc-wasm` engine it runs on.
