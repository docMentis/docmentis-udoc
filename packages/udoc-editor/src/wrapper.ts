// This package, as the wrapper it reports to the engine — the editor's own, and
// the template preview's, which the editor makes.
import type { Wrapper } from "@docmentis/udoc-ui/internal";
import { WRAPPER_VERSION } from "./version.js";

/** This package, as the wrapper it reports to the engine. */
export const EDITOR_WRAPPER: Wrapper = { name: "udoc-editor", version: WRAPPER_VERSION };
