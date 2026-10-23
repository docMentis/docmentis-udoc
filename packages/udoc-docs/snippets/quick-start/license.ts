import { UDocViewer } from "@docmentis/udoc-viewer";

const viewer = await UDocViewer.create(document.getElementById("udoc")!, {
    license: "YOUR-LICENSE-KEY",
});
await viewer.open("https://example.com/report.pdf");
