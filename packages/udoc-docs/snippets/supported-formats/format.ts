import { UDocViewer } from "@docmentis/udoc-viewer";

const viewer = await UDocViewer.create(document.getElementById("udoc")!);

// Bytes have no file name to tell a CSV by, so name the format, and the
// character its fields are split by.
const response = await fetch("https://example.com/export");
const bytes = new Uint8Array(await response.arrayBuffer());
await viewer.open(bytes, { format: "csv", delimiter: ";", filename: "export.csv" });

console.log(viewer.docType, viewer.sourceFormat); // "spreadsheet" "csv"
