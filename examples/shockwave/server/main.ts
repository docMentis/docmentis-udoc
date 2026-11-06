// Shockwave's backend: the app's API on Fastify, over its SQLite database;
// udoc-server, behind the gate, on the same HTTP server; and under
// `npm start`, the built frontend.
import { existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

import fastifyStatic from "@fastify/static";
import Fastify from "fastify";

import { config } from "./config.ts";
import { openDatabase } from "./db.ts";
import { answerFailure } from "./http.ts";
import { collectionRoutes } from "./routes/collections.ts";
import { dealRoomRoutes } from "./routes/dealRooms.ts";
import { frontstageRoutes } from "./routes/frontstage.ts";
import { libraryRoutes } from "./routes/library.ts";
import { sessionRoutes } from "./routes/session.ts";
import { tenantRoutes } from "./routes/tenants.ts";
import { thumbnailRoutes } from "./routes/thumbnails.ts";
import { versionRoutes } from "./routes/versions.ts";
import { seed } from "./seed.ts";
import { createUdoc } from "./udoc.ts";

if (config.webDir && !existsSync(config.webDir)) {
    console.error("shockwave: there's no built frontend to serve; run `npm run build` first");
    process.exit(1);
}

mkdirSync(config.dataDir, { recursive: true });
const db = openDatabase(join(config.dataDir, "shockwave.db"));
await seed(db);
const udoc = await createUdoc(db);

const app = Fastify({
    logger: { level: "warn" },
    // udoc-server answers what's under `/udoc`, past the gate; Fastify the rest.
    serverFactory: (handler) => {
        const server = createServer((request, response) => {
            if (!udoc.handleRequest(request, response)) handler(request, response);
        });
        server.on("upgrade", (request, socket, head) => udoc.handleUpgrade(request, socket, head) || socket.destroy());
        return server;
    },
});
app.setErrorHandler(answerFailure);
sessionRoutes(app, db);
tenantRoutes(app, db);
libraryRoutes(app, db, udoc);
versionRoutes(app, db, udoc);
thumbnailRoutes(app, db);
collectionRoutes(app, db);
dealRoomRoutes(app, db, udoc);
frontstageRoutes(app, db);
if (config.webDir) {
    await app.register(fastifyStatic, { root: config.webDir });
    // Any other page is the frontend's to route.
    app.setNotFoundHandler((request, reply) =>
        request.method === "GET" && !request.url.startsWith("/api/")
            ? reply.sendFile("index.html")
            : reply.code(404).send({ error: "notFound", message: "no such resource" }),
    );
}

const origin = `http://127.0.0.1:${config.port}`;
await app.listen({ host: "127.0.0.1", port: config.port });
console.log(
    config.webDir
        ? `shockwave: open ${origin}`
        : `shockwave: backend at ${origin}; open the pages Vite serves, at http://localhost:${config.webPort}`,
);

async function stop(): Promise<void> {
    await app.close();
    await udoc.close();
    db.close();
    process.exit(0);
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
