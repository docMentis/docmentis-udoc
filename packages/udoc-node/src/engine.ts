// The bundled engine, compiled once per process.
//
// Compiling the ~30 MB binary is most of what loading it costs, and a compiled
// `WebAssembly.Module` can be handed to a worker thread as is. So the module is
// compiled here, on whichever thread builds the `UDocNode`, and every session's
// worker instantiates that one module rather than reading and compiling its own.

import { readFile } from "node:fs/promises";

import { UDocError } from "@docmentis/udoc-wasm/error";
import { bundledWasmUrl } from "@docmentis/udoc-wasm/meta-url";

let compiled: Promise<WebAssembly.Module> | undefined;

/** The engine binary bundled in `@docmentis/udoc-wasm`, compiled. */
export function compileEngine(): Promise<WebAssembly.Module> {
    // `bundledWasmUrl` is resolved against the wasm package's own module URL,
    // which under Node is a `file:` URL that `readFile` takes directly.
    compiled ??= readFile(new URL(bundledWasmUrl))
        .then((bytes) => WebAssembly.compile(bytes))
        .catch((error: unknown) => Promise.reject(UDocError.from(error)));
    return compiled;
}
