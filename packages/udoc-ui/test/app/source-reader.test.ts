/**
 * A source read once: its first bytes for an extension document's `canOpen`,
 * then the whole for the engine from where they stopped — a URL fetched once.
 */

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { HEAD_BYTES, sourceReader } from "../../src/app/source.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = realFetch;
});

/** `length` bytes counting up, wrapping at 256. */
function counting(length: number): Uint8Array<ArrayBuffer> {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) bytes[i] = i % 256;
    return bytes;
}

/** Stand in for `fetch`: each call answers with `chunks` as the body, under `headers`, and is counted; `cancelled` is set once the body is cancelled. */
function stubFetch(chunks: readonly Uint8Array[], headers: Record<string, string>) {
    const seen = { calls: 0, cancelled: false };
    globalThis.fetch = async () => {
        seen.calls += 1;
        let next = 0;
        const body = new ReadableStream<Uint8Array>({
            pull(controller) {
                if (next < chunks.length) controller.enqueue(chunks[next++]!);
                else controller.close();
            },
            cancel() {
                seen.cancelled = true;
            },
        });
        return new Response(body, { headers });
    };
    return seen;
}

test("bytes: the head is their start, the whole is them", async () => {
    const bytes = counting(HEAD_BYTES + 100);
    const reader = sourceReader(bytes, () => {});
    const head = await reader.head();
    assert.deepEqual(head.bytes, bytes.subarray(0, HEAD_BYTES));
    assert.equal(head.mediaType, undefined);
    assert.equal(await reader.all(), bytes);
});

test("a Blob: the head is its start, typed without its parameters", async () => {
    const bytes = counting(10);
    const reader = sourceReader(new Blob([bytes], { type: "video/mp4; codecs=avc1" }), () => {});
    const head = await reader.head();
    assert.deepEqual(head.bytes, bytes);
    assert.equal(head.mediaType, "video/mp4");
    assert.deepEqual(await reader.all(), bytes);
});

test("a URL is fetched once: the whole reads on from the head", async () => {
    const whole = counting(9000);
    const seen = stubFetch([whole.subarray(0, 3000), whole.subarray(3000, 6000), whole.subarray(6000)], {
        "Content-Type": "Video/MP4",
        "Content-Length": "9000",
    });
    const progress: Array<[number, number]> = [];
    const reader = sourceReader("https://example.com/clip", (loaded, total) => progress.push([loaded, total]));
    const head = await reader.head();
    assert.deepEqual(head.bytes, whole.subarray(0, HEAD_BYTES));
    assert.equal(head.mediaType, "video/mp4");
    // Asked again, it is the same read.
    assert.equal(await reader.head(), head);
    assert.deepEqual(await reader.all(), whole);
    assert.equal(seen.calls, 1);
    assert.deepEqual(progress.at(-1), [9000, 9000]);
});

test("a URL whose head isn't asked for is read whole, as before", async () => {
    const whole = counting(5000);
    const seen = stubFetch([whole], {});
    const reader = sourceReader("https://example.com/report.pdf", () => {});
    assert.deepEqual(await reader.all(), whole);
    assert.equal(seen.calls, 1);
});

test("a URL an extension document takes stops being read after its head", async () => {
    const seen = stubFetch([counting(HEAD_BYTES), counting(HEAD_BYTES)], {});
    const reader = sourceReader("https://example.com/clip", () => {});
    await reader.head();
    reader.cancel();
    // The cancel reaches the body once the fetch it waits on has settled.
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(seen.cancelled, true);
});
