// Where the editor's render worker starts from.
//
// As compiled here, it starts beside this module as a module worker — how
// `npm run dev` runs it, its Vite server resolving the worker's imports. A
// release never runs this: `scripts/bundle-workers.mjs` rewrites this module in
// `dist/` with the worker bundled whole, the engine's glue included, and
// started from a blob. A blob worker runs whatever origin the editor was
// loaded from — a CDN, a bundle — and resolves no import, so it needs no
// bundler, no module workers, and nothing served beside the editor's own
// scripts.
//
// The rewrite also drops the `new Worker(new URL(…, import.meta.url))` below,
// so a host's bundler finds no worker of the editor's to emit a second time.

/** Start the render worker (`worker.ts`). */
export function startRenderWorker(): Worker {
    return new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
}
