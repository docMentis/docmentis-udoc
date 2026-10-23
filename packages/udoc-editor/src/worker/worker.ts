// The editor's render worker: udoc-ui's engine worker, serving edit mode's
// requests beside the engine's own.
import { serveEngine } from "@docmentis/udoc-ui/worker";
import { EDIT_HANDLERS } from "./handlers.js";

serveEngine(EDIT_HANDLERS);
