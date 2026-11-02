// `npm run clear`: delete mainshock's data, so that the backend starts over
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
    console.error(`[mainshock] its backend is running, on port ${port}: stop it first`);
    process.exit(1);
}

if (!existsSync(dataDir)) {
    console.log(`[mainshock] no data to clear, in ${dataDir}`);
    process.exit(0);
}

// `MAINSHOCK_DATA` can name any folder: delete it only if it's mainshock's.
if (readdirSync(dataDir).length > 0 && !existsSync(join(dataDir, "mainshock.db"))) {
    console.error(`[mainshock] ${dataDir} has no mainshock.db, so it isn't mainshock's data: left as it is`);
    process.exit(1);
}

rmSync(dataDir, { recursive: true });
console.log(`[mainshock] cleared ${dataDir}: the next start seeds it again`);
