// This package's version, reported to the engine as the wrapper version so a
// permit request and a usage event can name what produced them.
//
// Read from the `package.json` npm ships beside `dist` — the one place a
// release bumps — so it is always the version actually running. `../` is the
// package root from `src` and from `dist` alike.

import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };

export const WRAPPER_VERSION = manifest.version;
