// Fetches for the end-to-end suites' editors (scripts/e2e-harness.mjs), whose main
// thread waits: what a synchronous request is in a browser's worker.
import { parentPort, workerData } from "node:worker_threads";

const { signal, data } = workerData;
const flags = new Int32Array(signal);
parentPort.on("message", async (url) => {
    try {
        const response = await fetch(url);
        const body = new Uint8Array(await response.arrayBuffer());
        if (!response.ok) throw new Error(`${response.status} ${url}`);
        if (body.length > data.byteLength) throw new Error("response too large");
        new Uint8Array(data).set(body);
        flags[1] = body.length;
        flags[0] = 1;
    } catch {
        flags[0] = 2;
    }
    Atomics.notify(flags, 0);
});
