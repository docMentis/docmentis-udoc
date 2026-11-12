// One branch of one document across the server's pieces
// (docs/design/node-branches.md): the id it goes by in a path, the key its pooled
// session and its collaboration go by, and the version numbers its checkpoints
// and cuts take — the document's, one at a time, whichever branch takes one.

import type { DocumentStore } from "./store.ts";

/** The ids this server mints for a document or a branch — `randomUUID`'s. */
export const MINTED_ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

/** A branch's id in a path: `main`, or one this server minted. */
export const BRANCH_ID = new RegExp(`main|${MINTED_ID.source}`);

/** The key branch `branch` of document `id` goes by, its session's and its collaboration's. */
export function branchKey(id: string, branch: string): string {
    return `${id}/${branch}`;
}

/** The document and the branch `key` names. */
export function branchOfKey(key: string): { id: string; branch: string } {
    const slash = key.indexOf("/");
    return { id: key.slice(0, slash), branch: key.slice(slash + 1) };
}

/**
 * Version numbers, taken across each document: one at a time, each one past
 * the latest kept, so a checkpoint on one branch and a cut on another never
 * take the same.
 */
export class VersionNumbers {
    readonly #store: DocumentStore;
    /** What each document is keeping now, which its next number waits for. */
    readonly #keeping = new Map<string, Promise<unknown>>();

    constructor(store: DocumentStore) {
        this.#store = store;
    }

    /**
     * Run `keep` with document `id`'s next version number, once what it is
     * keeping now is kept, and answer what it answers. A number `keep` keeps
     * nothing under is taken again by the next.
     */
    next<T>(id: string, keep: (version: number) => Promise<T>): Promise<T> {
        const keeping = (this.#keeping.get(id) ?? Promise.resolve())
            .catch(() => {})
            .then(async () => keep(((await this.#store.getVersions(id)).at(-1)?.version ?? -1) + 1));
        this.#keeping.set(id, keeping);
        const forget = () => {
            if (this.#keeping.get(id) === keeping) this.#keeping.delete(id);
        };
        keeping.then(forget, forget);
        return keeping;
    }
}
