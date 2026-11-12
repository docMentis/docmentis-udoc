import { UDocEditor } from "@docmentis/udoc-editor";

const editor = await UDocEditor.create(document.getElementById("udoc")!);
await editor.open("https://example.com/notes.md");

// Saved back as Markdown, and as a Word document: a format other than the one
// it opened from is written afresh, by "rewrite".
await upload("notes.md", await editor.saveToBytes({ format: "md" }));
await upload("notes.docx", await editor.saveToBytes({ format: "docx", strategy: "rewrite" }));

// A rendering of its pages, which doesn't open as the same document again.
await upload("notes.pdf", await editor.exportToBytes("pdf"));
await upload("notes-1.png", await editor.exportPageToBytes(0, { png: { scale: 2 } }));

/** Your own code, which sends the bytes where they go. */
declare function upload(name: string, bytes: Uint8Array): Promise<void>;
