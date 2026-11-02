// Mainshock's backend: the app's API on Fastify, over its SQLite database;
// and under `npm start`, the built frontend.
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import fastifyStatic from "@fastify/static";
import Fastify from "fastify";

import { config } from "./config.ts";
import { openDatabase } from "./db.ts";
import { sessionRoutes } from "./routes/session.ts";
import { seed } from "./seed.ts";

if (config.webDir && !existsSync(config.webDir)) {
    console.error("mainshock: there's no built frontend to serve; run `npm run build` first");
    process.exit(1);
}

mkdirSync(config.dataDir, { recursive: true });
const db = openDatabase(join(config.dataDir, "mainshock.db"));
await seed(db);

const app = Fastify({ logger: { level: "warn" } });
sessionRoutes(app, db);
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
        ? `mainshock: open ${origin}`
        : `mainshock: backend at ${origin}; open the pages Vite serves, at http://localhost:${config.webPort}`,
);

async function stop(): Promise<void> {
    await app.close();
    db.close();
    process.exit(0);
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
