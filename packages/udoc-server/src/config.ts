// The settings `udoc-server` runs with: its flags, over an optional TOML
// config file, over the defaults.
//
// A config file's keys are the flags' names, in the flags' units, so there is
// one vocabulary for both: `session-timeout = 300` is `--session-timeout 300`.
// A key the file shouldn't have, or a value of the wrong type or out of range,
// is an error naming the file and the key — a typo never silently falls back
// to a default. The license stays in the environment, never in the file.

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { parse } from "smol-toml";

/** What `udoc-server` runs with. */
export interface Settings {
    port: number;
    host: string;
    /** Absolute. */
    dataDir: string;
    /** In seconds. */
    sessionTimeout: number;
    sessionPool: number;
}

/** A setting's name: its flag's, without the dashes, and its key in a config file. */
export type SettingName = "port" | "host" | "data-dir" | "session-timeout" | "session-pool";

/** The settings as given — a flag's text, a config file's value — before they are checked. */
export type GivenSettings = Partial<Record<SettingName, unknown>>;

const DEFAULTS = {
    port: 8080,
    host: "127.0.0.1",
    "data-dir": "udoc-data",
    "session-timeout": 300,
    "session-pool": 32,
} satisfies Record<SettingName, unknown>;

/** Every setting's name. */
export const SETTING_NAMES = Object.keys(DEFAULTS) as SettingName[];

const NAMES = new Set<string>(SETTING_NAMES);

/**
 * The settings a TOML config file at `path` gives. Its `data-dir` resolves
 * against the file's own directory, so a file and the data it names can move
 * together.
 */
export async function readConfigFile(path: string): Promise<GivenSettings> {
    let table: Record<string, unknown>;
    try {
        table = parse(await readFile(path, "utf8"));
    } catch (error) {
        throw new Error(`${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
    for (const key of Object.keys(table)) {
        if (!NAMES.has(key)) {
            throw new Error(`${path}: unknown setting ${JSON.stringify(key)} (known: ${[...NAMES].join(", ")})`);
        }
    }
    const given = table as GivenSettings;
    const dataDir = given["data-dir"];
    return typeof dataDir === "string" ? { ...given, "data-dir": resolve(dirname(path), dataDir) } : given;
}

/**
 * The settings to run with: each from `flags` when given there, else from
 * `file` (read from `filePath`), else its default. Flags are text, as the
 * command line gives them; a config file's values are already typed, so a
 * number written as a string is refused there.
 */
export function settingsOf(
    flags: Partial<Record<SettingName, string>>,
    file: GivenSettings = {},
    filePath = "the config file",
): Settings {
    const pick = (name: SettingName): [where: string, value: unknown] => {
        const flag = flags[name];
        if (flag !== undefined) return [`--${name}`, numeric(name) ? numberOrText(flag) : flag];
        if (file[name] !== undefined) return [`${filePath}: ${name}`, file[name]];
        return [`--${name}`, DEFAULTS[name]];
    };
    return {
        port: wholeNumber(...pick("port"), 0, 65535),
        host: text(...pick("host")),
        dataDir: resolve(text(...pick("data-dir"))),
        sessionTimeout: wholeNumber(...pick("session-timeout"), 1),
        sessionPool: wholeNumber(...pick("session-pool"), 1),
    };
}

function numeric(name: SettingName): boolean {
    return typeof DEFAULTS[name] === "number";
}

/** A flag's text as the number it spells, or as itself when it spells none. */
function numberOrText(flag: string): number | string {
    return flag.trim() !== "" && Number.isFinite(Number(flag)) ? Number(flag) : flag;
}

function wholeNumber(where: string, value: unknown, min: number, max?: number): number {
    if (typeof value !== "number" || !Number.isInteger(value) || value < min || (max !== undefined && value > max)) {
        const range = max === undefined ? `of at least ${min}` : `from ${min} to ${max}`;
        throw new Error(`${where} takes a whole number ${range}, got ${JSON.stringify(value)}`);
    }
    return value;
}

function text(where: string, value: unknown): string {
    if (typeof value !== "string" || value === "") {
        throw new Error(`${where} takes a non-empty string, got ${JSON.stringify(value)}`);
    }
    return value;
}
