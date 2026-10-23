# @docmentis/udoc-cli

**Document tools from the command line.**

Run document inspection, rendering, and export operations from your terminal or automation scripts, powered by the same udoc engine used across the docMentis ecosystem.

## Get started

```sh
npm install -g @docmentis/udoc-cli
```

```sh
udoc page-count slides.pptx
udoc render slides.pptx --page 3 --scale 2 --out slide-3.png
udoc save slides.pptx --out slides.udoc
```

Run `udoc --help` for supported commands and options.

## Where it fits

Choose the CLI for terminal workflows and scripts. To build document operations into your Node.js application, use [`@docmentis/udoc-node`](https://www.npmjs.com/package/@docmentis/udoc-node).

## Licensing

The CLI source code is open source under **MIT OR Apache-2.0**. Its underlying [`@docmentis/udoc-wasm`](https://www.npmjs.com/package/@docmentis/udoc-wasm) engine is proprietary and separately licensed. Free use requires online authorization; commercial licensing supports offline use. A commercial license can be supplied using `UDOC_LICENSE` and `UDOC_DOMAIN`.

[Source and documentation](https://github.com/docMentis/docmentis-udoc)
