/**
 * The settings `udoc-server` runs with: each from its flag, else from the
 * config file, else its default; a relative data directory resolves against
 * whichever gave it; and anything a config file or flag shouldn't say is
 * refused with the file and the key named, never replaced by a default.
 */

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { SETTING_NAMES, readConfigFile, settingsOf } from "../src/config.ts";

type Context = { after(fn: () => Promise<void>): void };

/** A config file holding `toml`, in a directory of its own. */
async function configFile(t: Context, toml: string): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), "udoc-config-test-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const path = join(directory, "server.toml");
    await writeFile(path, toml);
    return path;
}

test("each setting comes from its flag, else the config file, else its default", async (t) => {
    assert.deepEqual(settingsOf({}), {
        port: 8080,
        host: "127.0.0.1",
        dataDir: resolve("udoc-data"),
        sessionTimeout: 300,
        sessionPool: 32,
    });

    const path = await configFile(
        t,
        ["# the server's settings", 'host = "0.0.0.0"', "port = 9000", 'data-dir = "docs"', "session-pool = 4"].join(
            "\n",
        ),
    );
    const file = await readConfigFile(path);
    assert.deepEqual(settingsOf({ port: "9100" }, file, path), {
        port: 9100,
        host: "0.0.0.0",
        // Relative to the file that names it, not to where the server starts.
        dataDir: join(path, "..", "docs"),
        sessionTimeout: 300,
        sessionPool: 4,
    });
    // A flag's own relative path is relative to where the server starts.
    assert.equal(settingsOf({ "data-dir": "here" }, file, path).dataDir, resolve("here"));
});

test("the example config file names every setting, each at its default", async () => {
    const example = fileURLToPath(new URL("../config.example.toml", import.meta.url));
    const file = await readConfigFile(example);
    assert.deepEqual(Object.keys(file).sort(), [...SETTING_NAMES].sort());
    // Its data-dir is the default's, relative to the file rather than to where
    // the server starts.
    assert.deepEqual(settingsOf({}, file, example), {
        ...settingsOf({}),
        dataDir: join(dirname(example), "udoc-data"),
    });
});

test("what a config file or flag shouldn't say is refused, naming where it was said", async (t) => {
    const refusals: [string, RegExp][] = [
        ["sesion-pool = 4", /server\.toml: unknown setting "sesion-pool"/],
        ['[store]\ntype = "mongodb"', /server\.toml: unknown setting "store"/],
        ['port = "8080"', /server\.toml: port takes a whole number from 0 to 65535, got "8080"/],
        ["session-pool = 0", /server\.toml: session-pool takes a whole number of at least 1, got 0/],
        ["session-timeout = 1.5", /server\.toml: session-timeout takes a whole number of at least 1, got 1.5/],
        ["host = 1", /server\.toml: host takes a non-empty string, got 1/],
        ["port = ", /server\.toml: /],
    ];
    for (const [toml, refusal] of refusals) {
        const path = await configFile(t, toml);
        await assert.rejects(async () => settingsOf({}, await readConfigFile(path), path), refusal, toml);
    }

    await assert.rejects(readConfigFile(join(tmpdir(), "no-such-udoc-config.toml")), /no-such-udoc-config\.toml: /);
    assert.throws(() => settingsOf({ port: "80a" }), /--port takes a whole number from 0 to 65535, got "80a"/);
    assert.throws(() => settingsOf({ "session-pool": "" }), /--session-pool takes a whole number of at least 1/);
});
