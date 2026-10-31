// The `udoc` command line, parsed.
//
// Nothing here imports a sibling at runtime, so the tests load it from `src`.

import { basename, extname } from "node:path";
import { parseArgs } from "node:util";

import type { ExportFormat, FileFormat } from "@docmentis/udoc-node";

export const USAGE = `Usage: udoc render <input> [--page <n>] [--scale <s>] [--out <file.png|file.svg>]
       udoc export <input> --out <file.pdf>
       udoc save <input> --out <file>
       udoc page-count <input>

Commands:
  render            render one page of a document to a PNG or an SVG
  export            export a document as a PDF of its laid-out pages
  save              save a document faithfully, in the format --out's
                    extension names: one of its own (.pdf, .pptx, …), or .udoc
  page-count        print how many pages the document has

The format is detected from the bytes; a .csv, .tsv, .tab, .psv, .txt, .md,
.markdown, .html or .htm's from its extension.
Counting pages and exporting lay out the whole document; rendering lays it out
only as far as the page asked for.

Options (render):
  -p, --page <n>    page to render, counting from 1 (default 1)
  -s, --scale <s>   output pixels per point, for a PNG; 1 is 72 DPI (default 1)
  -o, --out <file>  where to write it, a .png or a .svg; its extension names
                    the format (default <input-name>_page_<n>.png)

Options (export):
  -o, --out <file>  where to write it, a .pdf

Options (save):
  -o, --out <file>  where to write it; its extension names the format

Options:
      --password <p>
                    the password a protected PDF opens with: its user or its
                    owner password
      --delimiter <c>
                    the character a .csv's fields are split by: the input's,
                    and for save the output's (default: detected on open, and
                    on save the one the input was split by, else a comma)
  -h, --help        show this help
      --version     show the version

Environment:
  UDOC_LICENSE      commercial license key; without one, usage is metered and
                    each document opened needs a permit from docMentis
  UDOC_DOMAIN       the domain that license is issued for
`;

/** What the command line asks for. */
export type Invocation =
    | { command: "help" }
    | { command: "version" }
    | RenderInvocation
    | ExportInvocation
    | SaveInvocation
    | PageCountInvocation;

/** What every command that opens a document takes. */
interface OpenInvocation {
    input: string;
    /** The password `input` opens with, if it needs one. */
    password?: string;
    /** The character `input`'s fields are split by, for a CSV. */
    delimiter?: string;
}

export interface PageCountInvocation extends OpenInvocation {
    command: "page-count";
}

export interface SaveInvocation extends OpenInvocation {
    command: "save";
    out: string;
    /** The format `out`'s extension names — a file format, or `"udoc"` for a package. */
    format: FileFormat | "udoc";
    /** The character `out`'s fields are split by, for a CSV. */
    outDelimiter?: string;
}

export interface RenderInvocation extends OpenInvocation {
    command: "render";
    /** Counting from 1, as the user wrote it. */
    page: number;
    /** Output pixels per point, for a PNG. */
    scale: number;
    out: string;
    /** The format `out`'s extension names. */
    format: "png" | "svg";
}

export interface ExportInvocation extends OpenInvocation {
    command: "export";
    out: string;
    /** The format `out`'s extension names. */
    format: ExportFormat;
}

/** A command line asking for nothing `udoc` can do. The message says why. */
export class UsageError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "UsageError";
    }
}

export function parseInvocation(argv: readonly string[]): Invocation {
    let parsed;
    try {
        parsed = parseArgs({
            args: [...argv],
            allowPositionals: true,
            options: {
                page: { type: "string", short: "p" },
                scale: { type: "string", short: "s" },
                out: { type: "string", short: "o" },
                password: { type: "string" },
                delimiter: { type: "string" },
                help: { type: "boolean", short: "h" },
                version: { type: "boolean" },
            },
        });
    } catch (error) {
        throw new UsageError(error instanceof Error ? error.message : String(error));
    }
    const { values, positionals } = parsed;
    if (values.help) return { command: "help" };
    if (values.version) return { command: "version" };

    const [command, ...operands] = positionals;
    const password = values.password !== undefined ? { password: values.password } : {};
    const { delimiter } = values;
    /** `--delimiter` for `input`, which takes one only as a CSV. */
    const inputDelimiter = (input: string) => {
        if (delimiter === undefined) return {};
        if (!isCsv(input)) throw new UsageError("--delimiter is for a .csv input");
        return { delimiter };
    };
    switch (command) {
        case undefined:
            throw new UsageError("no command given");
        case "render": {
            if (operands.length !== 1) throw new UsageError("render takes exactly one input document");
            const input = operands[0]!;
            const page = pageOf(values.page);
            const scale = scaleOf(values.scale);
            const out = values.out ?? defaultOut(input, page);
            const format = renderFormatOf(out);
            if (format === "svg" && values.scale !== undefined) throw new UsageError("--scale is for a PNG");
            return {
                command: "render",
                input,
                page,
                scale,
                out,
                format,
                ...password,
                ...inputDelimiter(input),
            };
        }
        case "export": {
            if (operands.length !== 1) throw new UsageError("export takes exactly one input document");
            if (values.page !== undefined || values.scale !== undefined) {
                throw new UsageError("--page and --scale are for render");
            }
            if (values.out === undefined) throw new UsageError("export needs --out, a .pdf");
            const input = operands[0]!;
            if (extname(values.out).toLowerCase() !== ".pdf") {
                throw new UsageError(`--out ${JSON.stringify(values.out)} isn't a .pdf, which export writes`);
            }
            return {
                command: "export",
                input,
                out: values.out,
                format: "pdf",
                ...password,
                ...inputDelimiter(input),
            };
        }
        case "save": {
            if (operands.length !== 1) throw new UsageError("save takes exactly one input document");
            if (values.page !== undefined || values.scale !== undefined) {
                throw new UsageError("--page and --scale are for render");
            }
            if (values.out === undefined) throw new UsageError("save needs --out, whose extension names the format");
            const input = operands[0]!;
            const format = saveFormatOf(values.out);
            if (delimiter !== undefined && !isCsv(input) && format !== "csv") {
                throw new UsageError("--delimiter is for a .csv, in or out");
            }
            return {
                command: "save",
                input,
                out: values.out,
                format,
                ...password,
                ...(delimiter !== undefined && isCsv(input) ? { delimiter } : {}),
                ...(delimiter !== undefined && format === "csv" ? { outDelimiter: delimiter } : {}),
            };
        }
        case "page-count": {
            if (operands.length !== 1) throw new UsageError("page-count takes exactly one input document");
            // Accepted by the parser for `render`, but meaningless here — say
            // so rather than silently ignore what the user asked for.
            if (values.page !== undefined || values.scale !== undefined || values.out !== undefined) {
                throw new UsageError("--page, --scale and --out are for render");
            }
            return { command: "page-count", input: operands[0]!, ...password, ...inputDelimiter(operands[0]!) };
        }
        default:
            throw new UsageError(`unknown command ${JSON.stringify(command)}`);
    }
}

/** Whether `path` names a CSV by its extension. */
function isCsv(path: string): boolean {
    return extname(path).slice(1).toLowerCase() === "csv";
}

function pageOf(value: string | undefined): number {
    if (value === undefined) return 1;
    const page = Number(value);
    if (!Number.isInteger(page)) throw new UsageError(`--page takes a whole number, got ${JSON.stringify(value)}`);
    if (page < 1) throw new UsageError("page numbers count from 1");
    return page;
}

function scaleOf(value: string | undefined): number {
    if (value === undefined) return 1;
    const scale = Number(value);
    if (!Number.isFinite(scale) || scale <= 0) {
        throw new UsageError(`--scale takes a positive number, got ${JSON.stringify(value)}`);
    }
    return scale;
}

/** Each extension `save` writes, and the format it names. */
const SAVE_FORMATS: Readonly<Record<string, FileFormat | "udoc">> = {
    pdf: "pdf",
    docx: "docx",
    docm: "docm",
    dotx: "dotx",
    dotm: "dotm",
    txt: "txt",
    md: "md",
    markdown: "md",
    html: "html",
    htm: "html",
    pptx: "pptx",
    pptm: "pptm",
    potx: "potx",
    potm: "potm",
    ppsx: "ppsx",
    ppsm: "ppsm",
    xlsx: "xlsx",
    xlsm: "xlsm",
    xltx: "xltx",
    xltm: "xltm",
    csv: "csv",
    tsv: "tsv",
    tab: "tsv",
    psv: "psv",
    jpg: "jpg",
    jpeg: "jpg",
    png: "png",
    gif: "gif",
    bmp: "bmp",
    tif: "tiff",
    tiff: "tiff",
    webp: "webp",
    svg: "svg",
    emf: "emf",
    wmf: "wmf",
    udoc: "udoc",
};

function saveFormatOf(out: string): FileFormat | "udoc" {
    const ext = extname(out).slice(1).toLowerCase();
    const format = SAVE_FORMATS[ext];
    if (format === undefined) {
        throw new UsageError(`--out ${JSON.stringify(out)} doesn't name a format save writes`);
    }
    return format;
}

/** The format `render` writes to `out`, named by its extension. */
function renderFormatOf(out: string): "png" | "svg" {
    const ext = extname(out).slice(1).toLowerCase();
    if (ext === "png" || ext === "svg") return ext;
    throw new UsageError(`--out ${JSON.stringify(out)} isn't a .png or a .svg, which render writes`);
}

/** `<input-name>_page_<page>.png`, in the working directory. */
function defaultOut(input: string, page: number): string {
    return `${basename(input, extname(input)) || "page"}_page_${page}.png`;
}
