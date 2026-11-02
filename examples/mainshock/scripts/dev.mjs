// Mainshock in development: the backend under `node --watch`, restarted on a
// change to it, and Vite serving the frontend, which proxies `/api` and
// `/udoc` to the backend. Both share this terminal, so neither clears it.
import { spawn } from "node:child_process";

const children = ["dev:server", "dev:web"].map((script) => spawn("npm", ["run", script], { stdio: "inherit" }));

let stopping = false;

function stop(code) {
    if (stopping) return;
    stopping = true;
    for (const child of children) child.kill("SIGINT");
    process.exitCode = code;
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
// One stopping, on its own, stops the other.
for (const child of children) child.on("exit", (code) => stop(code ?? 0));
