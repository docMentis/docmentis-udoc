import { UDocViewer } from "@docmentis/udoc-viewer";

// A reading pane: the thumbnails open, the page controls in the status bar,
// and no search, comments, print, download or theme button.
const viewer = await UDocViewer.create(document.getElementById("udoc")!, {
    theme: "system",
    activePanel: "thumbnail",
    showRightPanel: false,
    showPrintButton: false,
    showDownloadButton: false,
    showThemeButton: false,
    viewControlsPlacement: "status-bar",
});
await viewer.open("https://example.com/report.pdf");
