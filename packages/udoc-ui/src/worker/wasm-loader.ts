// Where the engine's artifacts are: the `.wasm` binary and the
// office-compatible fonts `@docmentis/udoc-wasm` ships. The glue that runs the
// binary is not among them — every worker is bundled with it (see
// local-collaboration-worker-source.ts) — so only these two are located, on the
// main thread, and handed to the worker as one candidate after another until a
// binary loads.
//
// The candidate list is the battle-tested fix from the previous generation
// (docmentis-udoc-viewer): across environments — Vite pre-bundling,
// Angular/esbuild, StackBlitz, custom hosts — a single resolution strategy
// fails for *some* of them, so we try several and fall through.

import type { FontLocation } from "@docmentis/udoc-wasm";

import { WASM_VERSION } from "../version.js";

/** One place the artifacts may be, from {@link resolveWasmCandidates}, for a worker to load from. */
export interface WasmCandidate {
    /** The `.wasm` binary. */
    wasmUrl: string;
    /** Where the office-compatible fonts are, beside that binary. */
    fonts: FontLocation;
}

export interface WasmLocateOptions {
    /**
     * Directory the host serves the artifacts from, laid out as
     * `@docmentis/udoc-wasm`'s `dist/`: `wasm/udoc_bg.wasm` and `fonts/`.
     * Tried first.
     */
    baseUrl?: string | URL;
    /**
     * CDN directory laid out as {@link baseUrl} is, tried last. Default
     * jsDelivr's copy of exactly the `@docmentis/udoc-wasm` this package was
     * built against, `https://cdn.jsdelivr.net/npm/@docmentis/udoc-wasm@<version>/dist/`.
     */
    cdnUrl?: string | URL;
}

const DEFAULT_CDN_URL = `https://cdn.jsdelivr.net/npm/@docmentis/udoc-wasm@${WASM_VERSION}/dist/`;

/**
 * Resolve candidate artifact URLs in priority order:
 *
 * 1. `baseUrl/wasm/udoc_bg.wasm`, with `baseUrl/fonts/`,
 * 2. `import.meta.url`-relative bundled copy (via the isolated, dynamically
 *    imported `meta-url` module — so envs without `import.meta` don't choke),
 * 3. the CDN's, `cdnUrl` or jsDelivr's.
 */
export async function resolveWasmCandidates(options: WasmLocateOptions = {}): Promise<WasmCandidate[]> {
    const candidates: WasmCandidate[] = [];

    if (options.baseUrl) candidates.push(laidOutAt(options.baseUrl));

    // Bundled copy via import.meta.url. Dynamic import so a parse-time failure in
    // import.meta-hostile environments just skips this candidate.
    try {
        const meta = await import("@docmentis/udoc-wasm/meta-url");
        candidates.push({ wasmUrl: meta.bundledWasmUrl, fonts: meta.bundledFontUrls });
    } catch {
        // import.meta unavailable here — rely on baseUrl/cdn.
    }

    candidates.push(laidOutAt(options.cdnUrl ?? DEFAULT_CDN_URL));
    return candidates;
}

/** The artifacts in directory `base`, laid out as `@docmentis/udoc-wasm`'s `dist/`. */
function laidOutAt(base: string | URL): WasmCandidate {
    const dir = new URL(base).href;
    return { wasmUrl: new URL("wasm/udoc_bg.wasm", dir).href, fonts: dir };
}
