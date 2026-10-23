import { UDocEditor } from "@docmentis/udoc-editor";

const editor = await UDocEditor.create(document.getElementById("udoc")!);
await editor.open("https://example.com/report.docx");

// Later, when you no longer need it:
editor.destroy();
