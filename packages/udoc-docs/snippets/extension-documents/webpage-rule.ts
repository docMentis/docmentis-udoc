import { UDocViewer, webpageDocument } from "@docmentis/udoc-viewer";

// Frame a Figma or Loom embed given no `format`, as well as any URL given
// `format: "url"`. It replaces the built-in web page document.
const embeds = webpageDocument({
    canOpen: ({ url }) => /^https:\/\/(www\.)?(figma\.com|loom\.com)\/embed/.test(url),
});

const viewer = await UDocViewer.create(document.getElementById("udoc")!, {
    extensionDocuments: [embeds],
});
await viewer.open("https://www.loom.com/embed/0123456789abcdef");
