// The worker's side of a remote open: the engine's fetch, made synchronous.
//
// The engine asks for a part the moment it needs one, and waits for it; Node
// has no synchronous HTTP. So this thread posts the part's URL to the session's
// side, which fetches it on the embedder's thread, and blocks until the answer
// is counted in.
//
// Nothing here imports a sibling at runtime, so the tests run it from `src`.

import { receiveMessageOnPort } from "node:worker_threads";

import type { FetchAnswer, FetchChannel } from "./protocol.js";

/**
 * The engine's fetch over `channel`: post the URL, block this thread until the
 * session's side counts an answer in, and take that answer off the port — the
 * bytes, or a throw saying why they didn't come.
 */
export function blockingFetch({ port, answered }: FetchChannel): (url: string) => Uint8Array {
    return (url) => {
        // Read before posting, so an answer counted before the wait begins
        // still ends it.
        const seen = Atomics.load(answered, 0);
        port.postMessage(url);
        Atomics.wait(answered, 0, seen);
        const answer = receiveMessageOnPort(port)?.message as FetchAnswer | undefined;
        if (answer === undefined) throw new Error("the session's side answered nothing");
        if (!answer.ok) throw new Error(answer.message);
        return new Uint8Array(answer.body);
    };
}
