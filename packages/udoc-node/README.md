# @docmentis/udoc-node

**Document processing for Node.js, powered by the udoc engine.**

Use docMentis document capabilities programmatically in Node.js applications and services. Open documents, render pages, export images, and save document content without embedding a browser-based viewer.

[![npm version](https://img.shields.io/npm/v/@docmentis/udoc-node)](https://www.npmjs.com/package/@docmentis/udoc-node)
[![license](https://img.shields.io/npm/l/@docmentis/udoc-node)](https://github.com/docMentis/docmentis-udoc#open-source-packages-shared-runtime)

**[Docs](https://www.docmentis.com/docs)** · **[API Reference](https://www.docmentis.com/docs/api/udoc-node)** · **[Changelog](https://github.com/docMentis/docmentis-udoc/blob/main/CHANGELOG.md)** · **[Report Issue](https://github.com/docMentis/docmentis-udoc/issues)**

---

## When to use it

- **Backend document workflows.** Inspect and process documents inside your existing Node.js application.
- **Rendering and previews.** Export document pages as images for thumbnails, previews, or other workflows.
- **Document operations.** Read and save supported document formats, including udoc document packages.
- **Custom integrations.** Build document functionality into your own services and automation tools.

## Quick start

```sh
npm install @docmentis/udoc-node
```

```ts
import { readFile, writeFile } from "node:fs/promises";
import { UDocNode } from "@docmentis/udoc-node";

const udoc = await UDocNode.create({ license: "YOUR_LICENSE", domain: "example.com" });
const session = await udoc.open(await readFile("report.docx"));
try {
    const png = await session.exportPageToBytes(0, { png: { scale: 2 } });
    await writeFile("page-1.png", png);
} finally {
    await session.close();
}
```

A commercial license is shown for illustration; the runtime also supports online-authorized free use. See the API documentation for session management, supported formats, and licensing options. Requires a supported Node.js version.

## Related packages

Use [`@docmentis/udoc-cli`](https://www.npmjs.com/package/@docmentis/udoc-cli) for ready-made commands, or [`@docmentis/udoc-server`](https://www.npmjs.com/package/@docmentis/udoc-server) to expose document operations and collaboration through a hosted service.

## Licensing

The Node.js integration is open source under **MIT OR Apache-2.0**. The underlying [`@docmentis/udoc-wasm`](https://www.npmjs.com/package/@docmentis/udoc-wasm) runtime is proprietary and separately licensed. Free use requires online authorization; commercial licensing is available for offline use.

[Source and documentation](https://github.com/docMentis/docmentis-udoc)
