import { UDocViewer } from "@docmentis/udoc-viewer";

const viewer = await UDocViewer.create(document.getElementById("udoc")!);

// Decode the image with a canvas: `pixels` are its raw samples, not a PNG file.
const bitmap = await createImageBitmap(await (await fetch("/logo@2x.png")).blob());
const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
const context = canvas.getContext("2d")!;
context.drawImage(bitmap, 0, 0);
const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);

await viewer.setWatermarks([
    {
        // A logo made at twice its size: `scale: 2` draws it at half its pixels.
        content: { image: { pixels: data, width: bitmap.width, height: bitmap.height, scale: 2 } },
        opacity: 1,
        // Only the first page.
        target: { pages: { plane: 0, indices: [0] } },
        // 24 points in from the top and from the right.
        placement: { at: { anchor: "topRight", offsetX: -24, offsetY: 24, rotation: 0 } },
    },
]);
