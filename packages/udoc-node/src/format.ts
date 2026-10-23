// The file formats at run time. The schema's `FileFormat` is a type only, so a
// host that receives one as text — a query parameter, a command-line flag —
// checks it here.
//
// Nothing here imports a sibling at runtime, so the tests can load it from `src`.

import type { FileFormat } from "@docmentis/udoc-wasm";

/** Every file format, held to the engine's `FileFormat`: a format added there
 *  or dropped from it fails to typecheck here. */
const FILE_FORMATS = {
    pdf: true,
    docx: true,
    pptx: true,
    xlsx: true,
    csv: true,
    tsv: true,
    psv: true,
    jpg: true,
    png: true,
    gif: true,
    bmp: true,
    tiff: true,
    webp: true,
    svg: true,
    emf: true,
    wmf: true,
} satisfies Record<FileFormat, true>;

/** Whether `value` is a file format's name (`"pdf"`, `"pptx"`, `"jpg"`, …). */
export function isFileFormat(value: string): value is FileFormat {
    return Object.hasOwn(FILE_FORMATS, value);
}
