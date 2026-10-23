# @docmentis/udoc-node

Embed the docMentis udoc engine in a Node application: open a PDF, DOCX, PPTX,
XLSX, CSV, TSV, PSV, image or `.udoc` package, export its pages to PNG, and
save it back — to its own format or as a `.udoc` package. Each open document
is a session on a worker thread of its own, so rendering never blocks your
event loop.

```sh
npm install @docmentis/udoc-node    # Node.js 22.18 or later
```

```ts
import { readFile, writeFile } from "node:fs/promises";
import { UDocNode } from "@docmentis/udoc-node";

const udoc = await UDocNode.create({ license: "…", domain: "example.com" });
const session = await udoc.open(await readFile("report.docx"));
try {
    const pages = await session.pageCount();
    for (let index = 0; index < pages; index++) {
        await writeFile(`page-${index + 1}.png`, await session.exportPageToBytes(index, { png: { scale: 2 } }));
    }
    await writeFile("report.udoc", await session.saveToPackage());
} finally {
    await session.close();
}
```

A document a
[udoc-server](https://www.npmjs.com/package/@docmentis/udoc-server) keeps
opens without downloading it: each part is fetched the first time the document
needs it.

```ts
const session = await udoc.openRemote("https://docs.example.com/documents/<id>/package");
```

Every failure rejects with a `UDocError`, whose `code` is what to branch on.

Without a license, usage is metered: every `open` or `openRemote` needs a
permit from the docMentis service, and a refusal rejects with `invalidLicense`,
`permitRefused` or `cannotVerify`. A license is checked against the `domain` it
was issued for.

`session.entitlements.features` lists what the session may use. A call that
needs a feature it lacks — the sync calls need `collaboration` — rejects with
`notEntitled`.

## Documentation

The [API reference](https://www.docmentis.com/docs/api/udoc-node) has every
call, and the
[architecture](https://github.com/docMentis/docmentis-udoc/blob/main/docs/design/node-hosts.md)
says how the hosts run the engine.

## License

MIT OR Apache-2.0, at your option. That covers this package, not the
`@docmentis/udoc-wasm` engine it runs on, which is proprietary, under its own
license.
