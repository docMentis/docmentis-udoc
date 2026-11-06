import { UDocEditor } from "@docmentis/udoc-editor";

// Opens in view mode, with the switch to edit mode, and with controls beside
// each page of a PDF in edit mode.
const editor = await UDocEditor.create(document.getElementById("udoc")!, {
    initialMode: "view",
    showPageControls: true,
});
await editor.open("https://example.com/report.docx");
