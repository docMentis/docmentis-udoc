import { UDocViewer } from "@docmentis/udoc-viewer";

const viewer = await UDocViewer.create(document.getElementById("viewer")!, {
    license: "YOUR-LICENSE-KEY",
    showToolbar: false,
    showThumbnailPanel: false,
});
await viewer.open("https://example.com/report.pdf");

// Later, when you no longer need it:
viewer.destroy();
