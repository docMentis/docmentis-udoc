// The font files every session a `UDocNode` opens shares.
//
// Each document runs in a worker and a wasm instance of its own, so what one
// document downloaded goes when it closes, and the next document naming the
// same family downloads it again. The files are kept here instead, on the
// embedder's thread, where each session's worker asks for them by URL.
//
// Only files are kept. A css2 stylesheet is fetched each time — it is small,
// and what it names is what gets downloaded.

/**
 * Font files fetched by URL, kept up to `limit` bytes; the least recently used
 * goes first.
 */
export class FontCache {
    readonly #limit: number;
    readonly #fetch: (url: string) => Promise<Uint8Array>;
    /** The bytes of every file in {@link #files}. */
    #size = 0;
    /** Oldest use first: a hit moves its file to the end. */
    readonly #files = new Map<string, Uint8Array>();
    /** Downloads in flight, so two documents asking at once download once. */
    readonly #fetching = new Map<string, Promise<Uint8Array>>();

    /** Keep up to `limit` bytes of what `fetch` downloads. */
    constructor(limit: number, fetch: (url: string) => Promise<Uint8Array>) {
        this.#limit = limit;
        this.#fetch = fetch;
    }

    /**
     * The file at `url`: kept, or fetched, kept and the oldest dropped until
     * it fits. A failed fetch rejects and is not kept, so the next ask tries
     * again; a file larger than `limit` is not kept.
     */
    get(url: string): Promise<Uint8Array> {
        const kept = this.#files.get(url);
        if (kept) {
            this.#files.delete(url);
            this.#files.set(url, kept);
            return Promise.resolve(kept);
        }
        const fetching = this.#fetching.get(url);
        if (fetching) return fetching;

        const fetched = this.#fetch(url).then((bytes) => {
            this.#keep(url, bytes);
            return bytes;
        });
        this.#fetching.set(url, fetched);
        // Settled either way: a failure is not remembered.
        void fetched.then(
            () => this.#fetching.delete(url),
            () => this.#fetching.delete(url),
        );
        return fetched;
    }

    /** Keep `bytes` as the newest file, dropping the oldest until all fit. */
    #keep(url: string, bytes: Uint8Array): void {
        if (bytes.byteLength > this.#limit) return;
        this.#files.set(url, bytes);
        this.#size += bytes.byteLength;
        for (const [oldest, file] of this.#files) {
            if (this.#size <= this.#limit) break;
            this.#files.delete(oldest);
            this.#size -= file.byteLength;
        }
    }
}
