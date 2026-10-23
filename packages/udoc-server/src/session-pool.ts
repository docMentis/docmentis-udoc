// The sessions open over what the server keeps: a cache, one per document on
// a thread of its own (see `@docmentis/udoc-node`) — opened when a request
// needs it, kept while requests keep coming, closed once idle or once too many
// are open, and reopened the next time. That is what bounds how much the
// process holds.

import { clearTimeout, setTimeout } from "node:timers";

import type { UDocSession } from "@docmentis/udoc-node";

/** One pooled session, and what the pool knows about its use. */
interface Pooled {
    /** The session — or its open, still under way, which every request that
     *  arrives meanwhile shares, so a document is opened once. */
    session: Promise<UDocSession>;
    /** Requests using it now. It is closed only when there are none. */
    busy: number;
    /** When its last request finished: what "least recently used" orders by. */
    lastUsed: number;
    /** Closes it once idle; armed only while `busy` is 0. */
    idle: ReturnType<typeof setTimeout> | undefined;
}

/**
 * The open sessions, by document id: each opened on the first request that
 * needs it, kept while requests keep coming, and closed once idle or once more
 * than its size are open — least recently used first, and never while a request
 * is using it. A closed one is opened again, from the store, by the next
 * request for it.
 */
export class SessionPool {
    readonly #pooled = new Map<string, Pooled>();
    readonly #open: (id: string) => Promise<UDocSession>;
    readonly #sessionTimeoutMs: number;
    readonly #size: number;

    constructor(open: (id: string) => Promise<UDocSession>, sessionTimeoutMs: number, size: number) {
        this.#open = open;
        this.#sessionTimeoutMs = sessionTimeoutMs;
        this.#size = size;
    }

    /** Run `use` on document `id`'s session, opening it if it isn't open. */
    async use<T>(id: string, use: (session: UDocSession) => Promise<T>): Promise<T> {
        const pooled = this.#pooled.get(id) ?? this.#pool(id, this.#open(id));
        pooled.busy++;
        clearTimeout(pooled.idle);
        pooled.idle = undefined;
        this.#trim();
        try {
            return await use(await pooled.session);
        } finally {
            pooled.busy--;
            pooled.lastUsed = Date.now();
            this.#settleIdle(id, pooled);
        }
    }

    /** Close document `id`'s session, if one is open. */
    async close(id: string): Promise<void> {
        const pooled = this.#pooled.get(id);
        if (pooled) await this.#close(id, pooled);
    }

    /** Close every open session. */
    async closeAll(): Promise<void> {
        await Promise.all([...this.#pooled].map(([id, pooled]) => this.#close(id, pooled)));
    }

    #pool(id: string, session: Promise<UDocSession>): Pooled {
        const pooled: Pooled = { session, busy: 0, lastUsed: Date.now(), idle: undefined };
        this.#pooled.set(id, pooled);
        session.then(
            // However it ends — closed here, or its engine gone — it is no
            // longer this document's session, and the next request reopens.
            (opened) => void opened.closed.then(() => this.#forget(id, pooled)),
            // An open that failed holds nothing; the next request tries again.
            () => this.#forget(id, pooled),
        );
        return pooled;
    }

    /** Once nothing is using `pooled`, start its idle clock and keep to the pool's size. */
    #settleIdle(id: string, pooled: Pooled): void {
        if (pooled.busy > 0 || this.#pooled.get(id) !== pooled) return;
        pooled.idle = setTimeout(() => void this.#close(id, pooled), this.#sessionTimeoutMs);
        // An idle clock is no reason for the process to stay up.
        pooled.idle.unref();
        this.#trim();
    }

    /** Close idle sessions, least recently used first, until no more than the pool's size are open. */
    #trim(): void {
        while (this.#pooled.size > this.#size) {
            let oldest: [string, Pooled] | undefined;
            for (const entry of this.#pooled) {
                if (entry[1].busy === 0 && (!oldest || entry[1].lastUsed < oldest[1].lastUsed)) oldest = entry;
            }
            // Every open session is in use: the size is kept as they finish.
            if (!oldest) return;
            void this.#close(...oldest);
        }
    }

    async #close(id: string, pooled: Pooled): Promise<void> {
        this.#forget(id, pooled);
        await pooled.session.then(
            (session) => session.close(),
            () => {},
        );
    }

    #forget(id: string, pooled: Pooled): void {
        if (this.#pooled.get(id) !== pooled) return;
        clearTimeout(pooled.idle);
        this.#pooled.delete(id);
    }
}
