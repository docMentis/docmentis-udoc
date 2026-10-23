# @docmentis/udoc-server

A service that keeps documents as udoc packages and serves them over HTTP,
through sessions on the udoc engine opened over what it keeps.

```sh
UDOC_LICENSE=… UDOC_DOMAIN=example.com udoc-server --port 8080 --data-dir ./udoc-data

curl --data-binary @report.pdf http://127.0.0.1:8080/documents        # → {"id":"…"}
curl http://127.0.0.1:8080/documents/<id>/layout/page-count           # → {"pageCount":12}
curl -o page-1.png "http://127.0.0.1:8080/documents/<id>/layout/pages/0.png?scale=2"
curl -o report.pdf http://127.0.0.1:8080/documents/<id>/original          # the upload, as it was
curl -o report.udoc http://127.0.0.1:8080/documents/<id>/file.udoc       # or file.pdf
curl -o report.pdf "http://127.0.0.1:8080/documents/<id>/file.pdf?strategy=incremental"
curl -X POST http://127.0.0.1:8080/documents/<id>/checkpoints         # → {"version":1}
curl http://127.0.0.1:8080/documents/<id>/package                     # → {"docType":"Portable",…}
curl http://127.0.0.1:8080/documents/<id>/package/pages/<part-id>     # one part, as JSON
curl -X DELETE http://127.0.0.1:8080/documents/<id>
```

Each upload is kept in `--data-dir` as its original and its checkpoints, each a
udoc package, one directory per document, so documents survive a restart. A document's session
opens when a request needs it and closes after `--session-timeout` seconds
without one (default 300); the session pool keeps at most `--session-pool`
sessions (default 32) open once their requests finish.

The settings can also live in a TOML file given with `--config`, each flag a
key of the same name; a flag on the command line overrides the file, and a
relative `data-dir` there is relative to the file. An unknown key is an error.
The license stays in the environment. [`config.example.toml`](config.example.toml)
lists every setting at its default, to copy from:

```sh
cp node_modules/@docmentis/udoc-server/config.example.toml udoc-server.toml
udoc-server --config udoc-server.toml
```

It listens on loopback by default and does no authentication; put it behind
whatever authenticates your users. Or embed it in your own Node server, with your
own `UDocNode` and store, beneath a base path of your choosing. It answers the
requests and WebSocket upgrades whose path is one of its routes and returns
`false` for the rest, untouched, for your server to answer:

```ts
import { UDocNode } from "@docmentis/udoc-node";
import { DirectoryDocumentStore, createUDocServer } from "@docmentis/udoc-server";

const udoc = createUDocServer({
    udoc: await UDocNode.create({ license, domain }),
    store: new DirectoryDocumentStore("udoc-data"),
    basePath: "/udoc", // serves /udoc/documents/…
});

// Express, Connect, or any (req, res, next) middleware stack:
app.use((req, res, next) => {
    if (!udoc.handleRequest(req, res)) next();
});
// Upgrades never reach the middleware, so hand them over on the HTTP server:
httpServer.on("upgrade", (req, socket, head) => {
    if (!udoc.handleUpgrade(req, socket, head)) socket.destroy(); // or your own WebSockets
});

// On shutdown: close your server, and the udoc server's sessions and collaborations.
await udoc.close();
```

Mount it with `app.use(handler)`, not `app.use("/udoc", handler)`: the base path
is matched against `req.url`, which Express rewrites beneath a mount path but not
for an upgrade. And put it ahead of any body parser (`express.json()`,
`express.raw()`, …): an upload is read from the request stream, which a parser
before it has already consumed.

The `package` routes are what a browser or a Node host opening the document part
by part fetches — `UDocEditor.openRemote(".../documents/<id>/package")`, or
udoc-node's `UDocNode.openRemote`; see
[docs/design/node-streaming.md](../../docs/design/node-streaming.md).

Clients edit a document together over `ws://…/documents/<id>/collaboration`: the
server merges each client's edits into the document's session, sends them on to
the others, and keeps them in the document's directory as its edit log, which
every later open applies. See
[docs/design/node-collaboration.md](../../docs/design/node-collaboration.md) for
the messages, and [docs/design/node-hosts.md](../../docs/design/node-hosts.md)
for the architecture.
