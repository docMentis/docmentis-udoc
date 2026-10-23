// The viewer's render worker: udoc-ui's engine worker, serving the engine's own
// requests and no others — the viewer's UI sends nothing else.
import { serveEngine } from "@docmentis/udoc-ui/worker";

serveEngine();
