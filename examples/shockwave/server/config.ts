// Where the backend listens and keeps its data. Vite's config reads the ports
// too, to serve the pages on one and proxy the rest to the other.
import { join } from "node:path";

/** Shockwave's folder. */
const home = join(import.meta.dirname, "..");

export const config = {
    /** The backend's port. */
    port: Number(process.env.SHOCKWAVE_PORT ?? 5281),
    /** Where Vite serves the pages in development, proxying the API to the backend. */
    webPort: Number(process.env.SHOCKWAVE_WEB_PORT ?? 5280),
    /** The database: deleting it starts over from the seed. */
    dataDir: process.env.SHOCKWAVE_DATA ?? join(home, "data"),
    /** The built frontend, served by `npm start`; in development Vite serves it. */
    webDir: process.argv.includes("--serve-web") ? join(home, "dist") : undefined,
};
