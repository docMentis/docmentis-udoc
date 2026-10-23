# @docmentis/udoc-server

**Self-hosted document services and collaboration for your application.**

Host documents on your own infrastructure, access document content and rendered pages over HTTP, and support collaborative editing in applications built with docMentis.

## What it provides

- **Document hosting.** Store and retrieve documents through a document service you operate.
- **Document APIs.** Access pages, previews, and saved documents from your application.
- **Remote document access.** Connect browser-based editors and Node.js integrations to documents held by the service.
- **Collaborative editing.** Synchronize changes between participants working on a shared document.

## Quick start

```sh
npm install -g @docmentis/udoc-server
udoc-server --port 8080 --data-dir ./udoc-data
```

```sh
curl --data-binary @report.pdf http://127.0.0.1:8080/documents
```

The service listens on loopback by default and does not provide end-user authentication. **Add authentication, authorization, and appropriate deployment controls before exposing it to users or the public internet.** See the package documentation for configuration, embedding it into an existing Node.js server, and collaboration endpoints.

## Part of the udoc ecosystem

The server works with [`@docmentis/udoc-editor`](https://www.npmjs.com/package/@docmentis/udoc-editor) for remote collaborative editing and builds on [`@docmentis/udoc-node`](https://www.npmjs.com/package/@docmentis/udoc-node).

## Licensing

The server's source code is open source under **MIT OR Apache-2.0**. It uses the proprietary, separately licensed [`@docmentis/udoc-wasm`](https://www.npmjs.com/package/@docmentis/udoc-wasm) engine. Free runtime use requires online authorization; commercial licensing is available for offline use.

[Source and documentation](https://github.com/docMentis/docmentis-udoc)
