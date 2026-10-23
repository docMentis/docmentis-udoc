import { UDocViewer } from "@docmentis/udoc-viewer";

const viewer = await UDocViewer.create(document.getElementById("udoc")!, {
    wasm: { baseUrl: "https://example.com/udoc-wasm/" },
});
await viewer.open("https://example.com/report.pdf");
