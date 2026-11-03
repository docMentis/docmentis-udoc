import { UDocViewer } from "@docmentis/udoc-viewer";

const viewer = await UDocViewer.create(document.getElementById("udoc")!, {
    translations: {
        "toolbar.download": "Save a copy",
        "toolbar.print": "Print pages",
    },
});
await viewer.open("https://example.com/report.pdf");
