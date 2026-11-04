import { UDocViewer } from "@docmentis/udoc-viewer";

const viewer = await UDocViewer.create(document.getElementById("udoc")!);

await viewer.setWatermarks([
    {
        content: {
            shape: {
                // A 40 by 40 point diamond. Where these coordinates put it doesn't
                // matter: the placement moves its outline.
                path: {
                    segments: [
                        { moveTo: { x: 20, y: 0 } },
                        { lineTo: { x: 40, y: 20 } },
                        { lineTo: { x: 20, y: 40 } },
                        { lineTo: { x: 0, y: 20 } },
                        "close",
                    ],
                },
                fillColor: { colorSpace: "srgb", components: [1, 0, 0] },
                strokeColor: { colorSpace: "srgb", components: [0, 0, 0] },
                strokeWidth: 1,
            },
        },
        opacity: 0.15,
        target: "all",
        // Copies across every page, 60 points apart.
        placement: { tile: { gapX: 60, gapY: 60, rotation: 0 } },
    },
]);
