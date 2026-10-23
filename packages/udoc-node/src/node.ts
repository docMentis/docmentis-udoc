// The embedder's entry point: who is running the engine, the fonts it offers,
// and the engine itself.

import type { FileFormat, GoogleFontFamily, SessionConfig, UrlFont } from "@docmentis/udoc-wasm";
import { CSS2_ENDPOINT } from "@docmentis/udoc-wasm/font-fulfill";

import { compileEngine } from "./engine.js";
import { FontCache } from "./font-cache.js";
import type { WorkerInit } from "./protocol.js";
import { UDocSession, fetchWhole } from "./session.js";
import { WRAPPER_VERSION } from "./version.js";

/**
 * What the engine is told about who is running it, under what license, and
 * which fonts it may draw with beyond a document's own. Every session started
 * through the same {@link UDocNode} carries it.
 */
export interface UDocNodeOptions {
    /** Commercial license key. Absent is free usage, which is metered: every
     *  {@link UDocNode.open} then needs a permit from the docMentis service. */
    license?: string;
    /** The domain the license is issued for. A browser host has a page to read
     *  it from and a Node host does not, so here it is declared. Defaults to
     *  `"unknown"`. */
    domain?: string;
    /** Ask for usage not to be reported. Honored only with a license;
     *  otherwise ignored. */
    disableTelemetry?: boolean;
    /** Anonymous per-user id, so usage attributes to one user across sessions.
     *  Without one, usage attributes to the domain. */
    distinctId?: string;
    /** The docMentis component embedding the engine, reported with every
     *  permit request and usage event. Defaults to this package; `udoc-cli`
     *  and `udoc-server` name themselves. */
    wrapper?: { name: string; version: string };

    /** Fonts of the host's own, offered to every document — each a font
     *  file's bytes or a {@link UrlFont}, fetched once a document's text asks
     *  for it; a `file:` URL is read from disk. Default none. */
    fonts?: ReadonlyArray<Uint8Array | UrlFont>;
    /** Fetch from Google Fonts the families a document names that no font of
     *  its own or the host's ({@link fonts}) covers. `false` offers no Google
     *  font family at all, so nothing is ever asked of Google. Default `true`. */
    enableGoogleFonts?: boolean;
    /** The Google font families offered, each its name, the `[bold, italic]`
     *  faces Google serves for it and its subsets — to narrow the catalog
     *  `@docmentis/udoc-wasm` ships (`GOOGLE_FONT_CATALOG`), extend it or keep it
     *  current. Ignored when {@link enableGoogleFonts} is `false`. Default that
     *  catalog. */
    googleFontFamilies?: GoogleFontFamily[];
    /** Where the Google Fonts css2 API is asked for a family's faces — a
     *  mirror's, for a host that can't or won't reach Google. The font files
     *  are fetched from the URLs its `@font-face` blocks give, so a mirror that
     *  also stands in for `fonts.gstatic.com` rewrites them. An absolute URL.
     *  Ignored when {@link enableGoogleFonts} is `false`. Default
     *  `https://fonts.googleapis.com/css2`. */
    googleFontEndpoint?: string | URL;
    /** Bytes of downloaded font files kept for every session to reuse — a
     *  Google font's files and each {@link UrlFont} fetched over the network —
     *  the least recently used dropped first. `0` keeps none. Default 64 MiB. */
    fontCacheSize?: number;
}

/** The docMentis component this package is. */
const WRAPPER = "udoc-node";

/** The bytes of font files kept when {@link UDocNodeOptions.fontCacheSize} is absent. */
const FONT_CACHE_SIZE = 64 * 1024 * 1024;

/**
 * The udoc engine in this process: the host's identity, and the compiled
 * engine every session instantiates. Build one per host identity and open as
 * many documents through it as needed — each is a session of its own, on a
 * thread of its own.
 */
export class UDocNode {
    readonly #module: WebAssembly.Module;
    readonly #config: SessionConfig;
    readonly #fonts: ReadonlyArray<Uint8Array | UrlFont>;
    /** `[]` with Google Fonts off; `undefined` keeps the catalog `startSession` offers. */
    readonly #googleFontFamilies: GoogleFontFamily[] | undefined;
    readonly #googleFontEndpoint: string;
    /** The font files every session opened here shares. */
    readonly #fontCache: FontCache;

    private constructor(module: WebAssembly.Module, options: UDocNodeOptions) {
        this.#module = module;
        this.#config = {
            domain: options.domain ?? "unknown",
            wrapper: options.wrapper?.name ?? WRAPPER,
            wrapperVersion: options.wrapper?.version ?? WRAPPER_VERSION,
            ...(options.license !== undefined ? { license: options.license } : {}),
            ...(options.distinctId !== undefined ? { distinctId: options.distinctId } : {}),
            disableTelemetry: options.disableTelemetry ?? false,
        };
        this.#fonts = [...(options.fonts ?? [])];
        this.#googleFontFamilies = options.enableGoogleFonts === false ? [] : options.googleFontFamilies;
        this.#googleFontEndpoint =
            options.googleFontEndpoint === undefined ? CSS2_ENDPOINT : new URL(options.googleFontEndpoint).href;
        this.#fontCache = new FontCache(options.fontCacheSize ?? FONT_CACHE_SIZE, fetchWhole);
    }

    /** Compile the bundled engine (once per process) and return a `UDocNode` for it. */
    static async create(options: UDocNodeOptions = {}): Promise<UDocNode> {
        return new UDocNode(await compileEngine(), options);
    }

    /**
     * Open a document from its bytes in a session of its own — as `format` when
     * given, which skips detection; otherwise the format is detected, and a
     * `.udoc` zip opens as a package. `delimiter` is the character a CSV's
     * fields are split by; without it, a comma, or a semicolon where the first
     * record is split by more of them. No other format takes one.
     *
     * Starts the session first, so this is where a license is checked and,
     * without one, where a permit is spent — on this document, whether or not
     * it then parses. Rejects with a `UDocError`: a licensing code when the
     * engine refuses, or the engine's own when the bytes don't open.
     *
     * A PDF that needs a password opens waiting for one: the session's
     * `needsPassword` says so, and its `authenticate` takes the password.
     */
    open(bytes: Uint8Array, format?: FileFormat, delimiter?: string): Promise<UDocSession> {
        return UDocSession.open(this.#init(), this.#fontCache, bytes, format, delimiter);
    }

    /**
     * Open the package a server keeps at `url` in a session of its own, without
     * downloading it — `url` is its package resource, udoc-server's
     * `…/documents/{id}/package`, and absolute. Each part is fetched the first
     * time the document needs it: the open fetches the few it starts from, and a
     * call that composes a page fetches that page's, rejecting if one can't be
     * fetched.
     *
     * A remote open is an open: this is where a license is checked and, without
     * one, where a permit is spent. Rejects with a `UDocError`: a licensing code
     * when the engine refuses, or the engine's own when the package can't be
     * fetched or read.
     *
     * Each URL is fetched with the global `fetch`, unless `fetch` answers it —
     * the whole body, as the route serves it — which is how udoc-server opens
     * a session over the store it keeps, with no request to itself.
     */
    openRemote(url: string, fetch?: (url: string) => Promise<Uint8Array>): Promise<UDocSession> {
        return UDocSession.openRemote(this.#init(), this.#fontCache, url, fetch);
    }

    /** What a session's worker starts with. */
    #init(): WorkerInit {
        return {
            module: this.#module,
            config: this.#config,
            fonts: this.#fonts,
            ...(this.#googleFontFamilies !== undefined ? { googleFontFamilies: this.#googleFontFamilies } : {}),
            googleFontEndpoint: this.#googleFontEndpoint,
        };
    }
}
