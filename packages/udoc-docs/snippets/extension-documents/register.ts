import { UDocViewer } from "@docmentis/udoc-viewer";
import { jsonDocument } from "./json-document";

const viewer = await UDocViewer.create(document.getElementById("udoc")!, {
    extensionDocuments: [jsonDocument],
});
await viewer.open("https://example.com/settings.json");

console.log(viewer.docType, viewer.sourceFormat); // "json" "json"
