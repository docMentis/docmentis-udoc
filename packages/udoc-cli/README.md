# @docmentis/udoc-cli

The `udoc` command: the udoc engine on the command line.

```sh
npm install -g @docmentis/udoc-cli
udoc page-count slides.pptx                               # 12
udoc render slides.pptx --page 3 --scale 2 --out slide-3.png
udoc save slides.pptx --out slides.udoc                   # or --out slides.pptx
```

`udoc --help` lists the options. The license comes from the environment:
`UDOC_LICENSE`, for the domain in `UDOC_DOMAIN`. Without one, usage is metered
and each document opened needs a permit from the docMentis service.

Built on [`@docmentis/udoc-node`](../udoc-node).
