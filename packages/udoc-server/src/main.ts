#!/usr/bin/env node
// `udoc-server` — run the udoc server.
//
// Licensed from the environment like the `udoc` CLI: `UDOC_LICENSE` for the
// domain in `UDOC_DOMAIN`, or free usage, which spends a permit per session
// opened — an upload's, and each reopen of a kept document. It listens on
// loopback unless told otherwise, because nothing in front of it checks who is
// asking. Its settings come from its flags, over a TOML config file given with
// `--config` (see `config.ts`). It is the server's host: its own HTTP server
// hands the server each request and upgrade, and answers any the server's
// routes don't have with a 404.

import { createServer } from "node:http";
import { resolve } from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";

import { UDocNode } from "@docmentis/udoc-node";
import type { UDocNodeOptions } from "@docmentis/udoc-node";

import { readConfigFile, settingsOf } from "./config.ts";
import { failureReply, notFound, refuseUpgrade, writeReply } from "./http.ts";
import { createUDocServer } from "./server.ts";
import { DirectoryDocumentStore } from "./store.ts";
import { WRAPPER_VERSION } from "./version.ts";

const USAGE = `Usage: udoc-server [--config <path>] [--port <n>] [--host <address>]
                   [--data-dir <path>] [--session-timeout <seconds>] [--session-pool <n>]

      --config <path>         a TOML file of settings: each flag below is a key of
                              the same name (port = 8080, data-dir = "docs", …),
                              and a flag given here overrides it. A relative
                              data-dir in the file is relative to the file.
  -p, --port <n>              port to listen on (default 8080)
      --host <address>        address to bind (default 127.0.0.1)
      --data-dir <path>       where documents are kept (default ./udoc-data)
      --session-timeout <s>   close a document's session after this long with no
                              request for it (default 300)
      --session-pool <n>      how many sessions stay open once their requests
                              finish (default 32)

Environment:
  UDOC_LICENSE                commercial license key; without one, usage is
                              metered and each session opened needs a permit
  UDOC_DOMAIN                 the domain that license is issued for
`;

async function main(): Promise<void> {
    // No defaults here: an absent flag leaves the setting to the config file.
    const { values } = parseArgs({
        options: {
            config: { type: "string" },
            port: { type: "string", short: "p" },
            host: { type: "string" },
            "data-dir": { type: "string" },
            "session-timeout": { type: "string" },
            "session-pool": { type: "string" },
            help: { type: "boolean", short: "h" },
        },
    });
    if (values.help) {
        console.log(USAGE);
        return;
    }
    const { config, ...flags } = values;
    const configPath = config === undefined ? undefined : resolve(config);
    const { port, host, dataDir, sessionTimeout, sessionPool } = settingsOf(
        flags,
        configPath === undefined ? {} : await readConfigFile(configPath),
        configPath,
    );

    const udoc = await UDocNode.create({
        ...licenseFromEnvironment(),
        wrapper: { name: "udoc-server", version: WRAPPER_VERSION },
    });
    const server = createUDocServer({
        udoc,
        store: new DirectoryDocumentStore(dataDir),
        sessionTimeoutMs: sessionTimeout * 1000,
        sessionPool,
    });
    const http = createServer((request, response) => {
        if (!server.handleRequest(request, response)) writeReply(response, failureReply(notFound()));
    });
    http.on("upgrade", (request, socket, head) => {
        if (!server.handleUpgrade(request, socket, head)) refuseUpgrade(socket, notFound());
    });
    http.listen(port, host, () => {
        console.log(`udoc-server listening on http://${host}:${port}, keeping documents in ${dataDir}`);
    });

    const stop = () => {
        const stopped = new Promise<void>((resolve) => http.close(() => resolve()));
        void server
            .close()
            .then(() => stopped)
            .then(() => process.exit(0));
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
}

function licenseFromEnvironment(): Pick<UDocNodeOptions, "license" | "domain"> {
    const license = process.env["UDOC_LICENSE"];
    const domain = process.env["UDOC_DOMAIN"];
    return {
        ...(license ? { license } : {}),
        ...(domain ? { domain } : {}),
    };
}

main().catch((error: unknown) => {
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
});
