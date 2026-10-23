/**
 * The one thing a stand-in thread cannot tell you: that the real engine opens a
 * document and renders it, through a real session on a real worker.
 *
 * Off by default, because a session can't start offline: without a license the
 * engine asks docMentis for a permit, which spends one and reports the open.
 * `UDOC_LIVE_ENGINE=1 npm test -w @docmentis/udoc-node` runs it, after a build
 * — the worker is `dist/worker.js`, so this loads `dist` rather than `src`.
 * `UDOC_LICENSE` and `UDOC_DOMAIN`, when set, license it instead.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { UDocError, UDocNode } from "../dist/index.js";

/** A valid one-page PDF, 200 × 100 pt, with nothing drawn on it. */
function onePagePdf(): Uint8Array {
    const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] >>",
    ];
    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [];
    objects.forEach((object, i) => {
        offsets.push(pdf.length);
        pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return new TextEncoder().encode(pdf);
}

test(
    "live: a document opens, counts and exports its pages, ends at its last, and closes",
    { skip: !process.env["UDOC_LIVE_ENGINE"] && "set UDOC_LIVE_ENGINE=1 to start a real session" },
    async () => {
        const license = process.env["UDOC_LICENSE"];
        const domain = process.env["UDOC_DOMAIN"];
        const udoc = await UDocNode.create({
            ...(license ? { license } : {}),
            ...(domain ? { domain } : {}),
        });
        const session = await udoc.open(onePagePdf());
        try {
            assert.equal(session.docType, "portable");
            assert.equal(session.sourceFormat, "pdf");
            assert.equal(await session.pageCount(), 1);
            const png = await session.exportPageToBytes(0, { png: { scale: 2 } });
            assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "a PNG");
            await assert.rejects(session.exportPageToBytes(1, { png: { scale: 1 } }), (error: Error) => {
                assert.ok(error instanceof UDocError);
                assert.equal(error.code, "notFound");
                assert.equal(error.message, "the document has 1 page(s)");
                return true;
            });
        } finally {
            await session.close();
        }
        assert.equal((await session.closed).message, "the session is closed");
    },
);
