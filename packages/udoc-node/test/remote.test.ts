/**
 * A remote document's parts, fetched for an engine that asks for each one
 * synchronously: its thread blocks while the session's side fetches, and gets
 * the part's bytes or why they didn't come — each answer its own URL's. A URL
 * a Node host can't resolve is refused before any thread starts, so no permit
 * is spent on it.
 *
 * The blocking side runs from `src` on a real thread, and the parts come from a
 * real HTTP server, but no engine is loaded.
 */

import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { MessageChannel, Worker } from "node:worker_threads";

import { UDocError } from "@docmentis/udoc-wasm/error";

import type { FontCache } from "../src/font-cache.ts";
import type { WorkerInit } from "../src/protocol.ts";
import { UDocSession, answerFetches } from "../src/session.ts";

type Context = { after(fn: () => Promise<void>): void };

/** Where `server` listens, once it does. */
async function listening(server: Server): Promise<string> {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

/** A server answering `/parts/<name>` with the name, and anything else `404`. */
async function partServer(t: Context): Promise<string> {
    const server = createServer((request, response) => {
        const name = /^\/parts\/(\w+)$/.exec(request.url ?? "")?.[1];
        response.writeHead(name === undefined ? 404 : 200).end(name);
    });
    t.after(async () => {
        server.close();
        await once(server, "close");
    });
    return listening(server);
}

/** An address nothing listens at any more. */
async function closedAddress(): Promise<string> {
    const server = createServer();
    const address = await listening(server);
    server.close();
    await once(server, "close");
    return address;
}

/**
 * Fetch each of `urls` in turn on a thread blocking on the session's side, as
 * the engine does: the text of each part, or `refused: <why>`.
 */
async function fetchOnAThread(urls: string[]): Promise<string[]> {
    const { port1, port2 } = new MessageChannel();
    const answered = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
    answerFetches(port1, answered);
    const thread = new Worker(
        `const { parentPort, workerData } = require("node:worker_threads");
        import(workerData.module).then(({ blockingFetch }) => {
            const fetch = blockingFetch(workerData.fetches);
            parentPort.postMessage(workerData.urls.map((url) => {
                try {
                    return new TextDecoder().decode(fetch(url));
                } catch (error) {
                    return "refused: " + error.message;
                }
            }));
        });`,
        {
            eval: true,
            workerData: {
                module: new URL("../src/blocking-fetch.ts", import.meta.url).href,
                fetches: { port: port2, answered },
                urls,
            },
            transferList: [port2],
        },
    );
    try {
        const [texts] = (await once(thread, "message")) as [string[]];
        return texts;
    } finally {
        await thread.terminate();
    }
}

test("the thread blocks while the session's side fetches, and gets each part's bytes or why not", async (t) => {
    const server = await partServer(t);
    const unreachable = await closedAddress();

    const [page, missing, refused, blob] = await fetchOnAThread([
        `${server}/parts/page`,
        `${server}/missing`,
        `${unreachable}/parts/page`,
        `${server}/parts/blob`,
    ]);

    assert.equal(page, "page");
    assert.equal(missing, "refused: HTTP 404");
    assert.match(refused ?? "", /^refused: fetch failed: connect ECONNREFUSED /);
    assert.equal(blob, "blob", "an answer after a refusal is still its own URL's");
});

test("a relative URL is refused before a thread starts, so no permit is spent on it", async () => {
    // Nothing is started, so nothing the thread would be started with is needed.
    const init = {} as WorkerInit;
    await assert.rejects(
        UDocSession.openRemote(init, {} as FontCache, "/documents/1/package"),
        (error: Error) =>
            error instanceof UDocError &&
            error.code === "invalidRequest" &&
            /must be absolute, got "\/documents\/1\/package"/.test(error.message),
    );
});
