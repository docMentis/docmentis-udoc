import { UDocViewer } from "@docmentis/udoc-viewer";

const viewer = await UDocViewer.create(document.getElementById("udoc")!);
await viewer.open("https://example.com/report.pdf");

// Later, when you no longer need it:
viewer.destroy();
