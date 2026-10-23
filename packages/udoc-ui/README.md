# @docmentis/udoc-ui

The document UI that
[`@docmentis/udoc-viewer`](https://www.npmjs.com/package/@docmentis/udoc-viewer)
and
[`@docmentis/udoc-editor`](https://www.npmjs.com/package/@docmentis/udoc-editor)
are built on: the shell with its toolbar and panels, the canvas the pages are
drawn on, and the worker that runs the docMentis udoc engine.

Install the viewer or the editor rather than this. Each depends on exactly the
udoc-ui of its own version, and exports all of udoc-ui that you use — import it
from whichever you use, not from `@docmentis/udoc-ui`. What the two share is
[Common](https://www.docmentis.com/docs/api/Common) in the API reference.

## Documentation

The guides and the API reference are at
[docmentis.com/docs](https://www.docmentis.com/docs).

## License

MIT OR Apache-2.0, at your option. That covers this package, not the
`@docmentis/udoc-wasm` engine it runs on, which is proprietary, under its own
license.
