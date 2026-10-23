# docMentis udoc

The open-source packages of docMentis udoc: a web document viewer and editor,
the UI they share, and the hosts that run the docMentis udoc engine in Node.
The guides and the API reference are at
[docmentis.com/docs](https://www.docmentis.com/docs).

| Package                                          | What it is                                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| [`@docmentis/udoc-viewer`](packages/udoc-viewer) | Document viewer for the web, with any framework or none.                           |
| [`@docmentis/udoc-editor`](packages/udoc-editor) | Document editor for the web, alone or together in real time.                       |
| [`@docmentis/udoc-ui`](packages/udoc-ui)         | The UI the viewer and the editor are built on. Not for embedding on its own.       |
| [`@docmentis/udoc-node`](packages/udoc-node)     | Open, render and save documents in a Node application.                             |
| [`@docmentis/udoc-cli`](packages/udoc-cli)       | The `udoc` command line.                                                           |
| [`@docmentis/udoc-server`](packages/udoc-server) | A document server: keeps documents on the engine and serves their pages over HTTP. |
| [`udoc-demo`](packages/udoc-demo)                | The end-to-end demo app for the viewer and the editor. Not published.              |
| [`udoc-docs`](packages/udoc-docs)                | The developer docs site and its API reference, generated from the packages' TSDoc. |

All of them run on [`@docmentis/udoc-wasm`](https://www.npmjs.com/package/@docmentis/udoc-wasm),
the engine: a proprietary WebAssembly runtime under its own license,
developed separately and installed from npm.

## Development

```sh
npm install
npm run build
npm run dev               # the demo, with the UI packages and udoc-server rebuilding as you edit
npm run docs              # the docs site, its API reference generated from the built packages
npm run typecheck
npm test
npm run lint
npm run format:check
npm run update-engine     # pin the latest engine release
npm run release -- patch  # cut a release, which CI publishes
```

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT License ([LICENSE-MIT](LICENSE-MIT))

at your option. This covers the code in this repository, not the
`@docmentis/udoc-wasm` engine it runs on.
