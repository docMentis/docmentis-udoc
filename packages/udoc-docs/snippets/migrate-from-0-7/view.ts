import { UDocViewer } from "@docmentis/udoc-viewer";

const viewer = await UDocViewer.create(document.getElementById("viewer")!, {
    // 0.7's zoomMode "fit-spread-width-max": fit the width, never past 100%.
    fit: { mode: "width", zoomCap: 1 },
    // 0.7's layoutMode "double-page-odd-right".
    layoutMode: "doublePageOddRight",
    // 0.7's pageSpacing and spreadSpacing, in points rather than pixels.
    pageGap: { horizontal: 8, vertical: 16 },
});
await viewer.open("https://example.com/report.pdf");

// 0.7's setZoomMode("custom") and setZoom(1.5).
viewer.setZoom(1.5);
