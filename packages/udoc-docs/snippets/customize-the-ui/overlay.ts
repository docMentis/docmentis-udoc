import { UDocViewer } from "@docmentis/udoc-viewer";

const viewer = await UDocViewer.create(document.getElementById("udoc")!);
await viewer.open("https://example.com/report.pdf");

// A button beside each page on screen, which follows it as the view scrolls
// and zooms.
viewer.setOverlay("comment-buttons", (frame) =>
    frame.views.map((view) => ({
        key: `comment:${view.index}`,
        x: view.x + view.width + 8,
        y: view.y,
        create: () => {
            const button = document.createElement("button");
            button.textContent = "Comment";
            // The overlay layer lets the pointer through to the page; the
            // button takes it back.
            button.style.pointerEvents = "auto";
            return button;
        },
        update: (button) => {
            button.onclick = () => openComments(view.index);
        },
    })),
);

function openComments(page: number): void {
    console.log(`Comments on page ${page + 1}`);
}
