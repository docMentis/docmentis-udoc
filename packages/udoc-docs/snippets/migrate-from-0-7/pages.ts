import { UDocViewer } from "@docmentis/udoc-viewer";

const viewer = await UDocViewer.create(document.getElementById("viewer")!);
await viewer.open("https://example.com/report.pdf");

viewer.on("currentPage:changed", ({ page }) => {
    console.log(`Page ${page + 1} of ${viewer.pageCount}`);
});

// The fifth page: 0.7's goToPage(5).
viewer.goToPage(4);
