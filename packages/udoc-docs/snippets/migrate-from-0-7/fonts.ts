import { UDocViewer } from "@docmentis/udoc-viewer";

const viewer = await UDocViewer.create(document.getElementById("viewer")!, {
    // 0.7's googleFonts.
    enableGoogleFonts: true,
    // 0.7's { typeface, bold, italic, url }, its face now a descriptor.
    fonts: [
        {
            descriptor: { family: "Roboto", bold: false, italic: false },
            url: "https://example.com/Roboto-Regular.woff2",
        },
        {
            descriptor: { family: "Roboto", bold: true, italic: false },
            url: "https://example.com/Roboto-Bold.woff2",
        },
    ],
});
await viewer.open("https://example.com/report.docx");
