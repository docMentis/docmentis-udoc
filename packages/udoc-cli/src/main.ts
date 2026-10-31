#!/usr/bin/env node
// `udoc` — the udoc engine on the command line.
//
// It runs the wasm engine through `@docmentis/udoc-node`, so it is licensed as
// any other host is: a key from `UDOC_LICENSE` (for the domain in
// `UDOC_DOMAIN`), or free usage, which spends a permit per document opened.

import { readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import process from "node:process";

import { UDocError, UDocNode } from "@docmentis/udoc-node";
import type { FileFormat, UDocNodeOptions, UDocSession } from "@docmentis/udoc-node";

import { USAGE, UsageError, parseInvocation } from "./args.js";
import type { ExportInvocation, Invocation, PageCountInvocation, RenderInvocation, SaveInvocation } from "./args.js";
import { WRAPPER_VERSION } from "./version.js";

async function main(): Promise<number> {
    let invocation: Invocation;
    try {
        invocation = parseInvocation(process.argv.slice(2));
    } catch (error) {
        if (!(error instanceof UsageError)) throw error;
        console.error(`error [invalidRequest]: ${error.message}\n\n${USAGE}`);
        return 2;
    }
    switch (invocation.command) {
        case "help":
            console.log(USAGE);
            return 0;
        case "version":
            console.log(WRAPPER_VERSION);
            return 0;
        case "render":
            await render(invocation);
            return 0;
        case "export":
            await exportDocument(invocation);
            return 0;
        case "save":
            await save(invocation);
            return 0;
        case "page-count":
            await pageCount(invocation);
            return 0;
    }
}

async function render({ input, password, delimiter, page, scale, out, format }: RenderInvocation): Promise<void> {
    const session = await open(input, password, delimiter);
    try {
        const bytes = await session
            .exportPageToBytes(page - 1, format === "svg" ? "svg" : { png: { scale } })
            .catch((error: unknown) => {
                // The engine counts pages from 0 and says only how many there
                // are; the address is ours to word, in the user's numbering.
                throw error instanceof UDocError && error.code === "notFound"
                    ? new UDocError("notFound", `page ${page} is out of range: ${error.message}`)
                    : error;
            });
        await fileIo(writeFile(out, bytes));
        const at = format === "svg" ? "" : `, scale ${scale}`;
        console.log(`Rendered page ${page} → ${out} (${bytes.length} bytes${at})`);
    } finally {
        await session.close();
    }
}

async function exportDocument({ input, password, delimiter, out, format }: ExportInvocation): Promise<void> {
    const session = await open(input, password, delimiter);
    try {
        const bytes = await session.exportToBytes(format);
        await fileIo(writeFile(out, bytes));
        console.log(`Exported → ${out} (${bytes.length} bytes)`);
    } finally {
        await session.close();
    }
}

async function save({ input, password, delimiter, out, format, outDelimiter }: SaveInvocation): Promise<void> {
    const session = await open(input, password, delimiter);
    try {
        // Only the format it came from saves over the original; any other is
        // rewritten — a .docx saved as a .dotx, a .csv as an .xlsx.
        const strategy = format === session.sourceFormat ? undefined : "rewrite";
        const bytes =
            format === "udoc"
                ? await session.saveToPackage()
                : await session.saveToBytes(format, strategy, outDelimiter);
        await fileIo(writeFile(out, bytes));
        console.log(`Saved → ${out} (${bytes.length} bytes)`);
    } finally {
        await session.close();
    }
}

async function pageCount({ input, password, delimiter }: PageCountInvocation): Promise<void> {
    const session = await open(input, password, delimiter);
    try {
        console.log(await session.pageCount());
    } finally {
        await session.close();
    }
}

async function open(input: string, password: string | undefined, delimiter: string | undefined): Promise<UDocSession> {
    const bytes = await fileIo(readFile(input));
    const udoc = await UDocNode.create({
        ...licenseFromEnvironment(),
        wrapper: { name: "udoc-cli", version: WRAPPER_VERSION },
    });
    const session = await udoc.open(bytes, signaturelessFormat(input), delimiter);
    try {
        if (session.needsPassword) await unlock(session, input, password);
        return session;
    } catch (error) {
        await session.close();
        throw error;
    }
}

/**
 * The format `input`'s extension names when the bytes can't say it: a CSV's, a
 * TSV's, a PSV's, a text file's, a Markdown file's or an email's, which have no
 * signature to detect, or an HTML file's, which needn't open with the
 * `<!DOCTYPE html>` or `<html>` one is detected by. `undefined` for any other
 * file.
 */
function signaturelessFormat(input: string): FileFormat | undefined {
    switch (extname(input).slice(1).toLowerCase()) {
        case "csv":
            return "csv";
        case "tsv":
        case "tab":
            return "tsv";
        case "psv":
            return "psv";
        case "txt":
            return "txt";
        case "md":
        case "markdown":
            return "md";
        case "html":
        case "htm":
            return "html";
        case "eml":
            return "eml";
        default:
            return undefined;
    }
}

/**
 * Unlock `session`, just opened from `input`, with the `--password` given.
 * Tried once: a command line has no one to ask again.
 */
async function unlock(session: UDocSession, input: string, password: string | undefined): Promise<void> {
    if (password === undefined) {
        throw new UDocError("passwordRequired", `${input} needs a password: give it with --password`);
    }
    if (!(await session.authenticate(password))) {
        throw new UDocError("passwordRequired", `the password given doesn't open ${input}`);
    }
}

/** `done`, a file read or write: its failure is `io`. */
function fileIo<T>(done: Promise<T>): Promise<T> {
    return done.catch((error: unknown) => {
        throw new UDocError("io", error instanceof Error ? error.message : String(error), undefined, { cause: error });
    });
}

function licenseFromEnvironment(): Pick<UDocNodeOptions, "license" | "domain"> {
    const license = process.env["UDOC_LICENSE"];
    const domain = process.env["UDOC_DOMAIN"];
    return {
        ...(license ? { license } : {}),
        ...(domain ? { domain } : {}),
    };
}

main().then(
    (code) => {
        process.exitCode = code;
    },
    (error: unknown) => {
        const { code, message } = UDocError.from(error);
        console.error(`error [${code}]: ${message}`);
        process.exitCode = 1;
    },
);
