// Where a local collaboration service's worker starts from. Its service imports
// this only when one starts, so a host that never starts one never loads it.
//
// As compiled here, it starts beside this module as a module worker — how
// `npm run dev` runs it, its Vite server resolving the worker's imports. A release
// never runs this: `scripts/bundle-workers.mjs` rewrites this module in `dist/`
// with the worker bundled whole, the engine's glue included, and started from a
// blob. A blob worker runs whatever origin the page loaded the package from — a
// CDN, a bundle — and resolves no import, so it needs no bundler, no module
// workers, and nothing served beside the package's own scripts.
//
// The rewrite also drops the `new Worker(new URL(…, import.meta.url))` below,
// so a host's bundler finds no worker of the package's to emit a second time.

/** Start a local collaboration service's worker (`local-collaboration-worker.ts`). */
export function startLocalCollaborationWorker(): Worker {
    return new Worker(new URL("./local-collaboration-worker.js", import.meta.url), { type: "module" });
}
