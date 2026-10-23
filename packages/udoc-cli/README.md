# @docmentis/udoc-cli

The `udoc` command: the docMentis udoc engine on the command line.

```sh
npm install -g @docmentis/udoc-cli                        # Node.js 22.18 or later
udoc page-count slides.pptx                               # 12
udoc render slides.pptx --page 3 --scale 2 --out slide-3.png
udoc save slides.pptx --out slides.udoc                   # or --out slides.pptx
```

`udoc --help` lists the options. The license comes from the environment:
`UDOC_LICENSE`, for the domain in `UDOC_DOMAIN`. Without one, usage is metered
and each document opened needs a permit from the docMentis service.

Built on
[`@docmentis/udoc-node`](https://www.npmjs.com/package/@docmentis/udoc-node).

## License

MIT OR Apache-2.0, at your option. That covers this package, not the
`@docmentis/udoc-wasm` engine it runs on, which is proprietary, under its own
license.
