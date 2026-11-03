import { UDocViewer } from "@docmentis/udoc-viewer";

const viewer = await UDocViewer.create(document.getElementById("udoc")!);

// A video or audio file, a stream, or a YouTube or Vimeo video by its address.
await viewer.open("https://www.youtube.com/watch?v=VIDEO-ID");

// A web page, framed: only with `format: "url"`.
await viewer.open("https://example.com/", { format: "url" });
