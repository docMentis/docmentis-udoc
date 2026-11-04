import { UDocViewer } from "@docmentis/udoc-viewer";

const viewer = await UDocViewer.create(document.getElementById("udoc")!);

// Set before opening, so the document's first frame already has it.
await viewer.setWatermarks([
    {
        content: {
            text: {
                fontFamily: "Arial",
                bold: true,
                italic: false,
                size: 72,
                color: { colorSpace: "srgb", components: [0.5, 0.5, 0.5] },
                text: "CONFIDENTIAL",
            },
        },
        opacity: 0.2,
        target: "all",
        placement: { at: { anchor: "center", offsetX: 0, offsetY: 0, rotation: -45 } },
    },
]);

await viewer.open("https://example.com/report.pdf");
