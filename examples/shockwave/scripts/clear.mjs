// `npm run clear`: delete shockwave's data, so that the backend starts over
// from the seed when it next starts. Not while the backend runs: it holds the
// database open, and would carry on with the one deleted until it restarted.
import { existsSync, readdirSync, rmSync } from "node:fs";
import { connect } from "node:net";
import { join } from "node:path";

import { config } from "../server/config.ts";

/** Whether something is listening on `port`, as the backend does. */
function listening(port) {
    return new Promise((resolve) => {
        const socket = connect(port, "127.0.0.1");
        socket.once("connect", () => {
            socket.destroy();
            resolve(true);
        });
        socket.once("error", () => resolve(false));
    });
}

const { dataDir, port } = config;

if (await listening(port)) {
    console.error(`[shockwave] its backend is running, on port ${port}: stop it first`);
    process.exit(1);
}

if (!existsSync(dataDir)) {
    console.log(`[shockwave] no data to clear, in ${dataDir}`);
    process.exit(0);
}

// `SHOCKWAVE_DATA` can name any folder: delete it only if it's shockwave's.
if (readdirSync(dataDir).length > 0 && !existsSync(join(dataDir, "shockwave.db"))) {
    console.error(`[shockwave] ${dataDir} has no shockwave.db, so it isn't shockwave's data: left as it is`);
    process.exit(1);
}

rmSync(dataDir, { recursive: true });
console.log(`[shockwave] cleared ${dataDir}: the next start seeds it again`);
