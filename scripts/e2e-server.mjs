// The real udoc-server in a process of its own, over the store directory and with
// the options its arguments give, for the end-to-end suites (scripts/e2e.mjs). It
// prints the port it listens on, and ends with the suite that started it, however
// that ends, once its standard input closes.
import { createServer } from "node:http";
import { UDocNode } from "@docmentis/udoc-node";
import { createUDocServer, DirectoryDocumentStore } from "@docmentis/udoc-server";

const [directory, options] = process.argv.slice(2);
const server = createUDocServer({
    udoc: await UDocNode.create({}),
    store: new DirectoryDocumentStore(directory),
    ...JSON.parse(options ?? "{}"),
});
const http = createServer((request, response) => {
    if (!server.handleRequest(request, response)) {
        response.statusCode = 404;
        response.end();
    }
});
http.on("upgrade", (request, socket, head) => {
    if (!server.handleUpgrade(request, socket, head)) socket.destroy();
});
await new Promise((resolve) => http.listen(0, "127.0.0.1", resolve));
console.log(`PORT ${http.address().port}`);

process.on("SIGTERM", async () => {
    await server.close();
    http.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000);
});
process.stdin.resume();
process.stdin.on("end", () => process.exit(1));
