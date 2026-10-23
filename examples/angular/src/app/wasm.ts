import type { WasmLocateOptions } from "@docmentis/udoc-viewer";

/**
 * Where the app serves the engine's binary and fonts, which angular.json copies
 * from `@docmentis/udoc-wasm`. Angular's builder bundles with esbuild, which
 * leaves the `new URL(…, import.meta.url)` that finds them as it is rather than
 * emitting the files it names, so the viewer and the editor are pointed at the
 * app's copy.
 */
export const wasm: WasmLocateOptions = { baseUrl: "/udoc-wasm/" };
