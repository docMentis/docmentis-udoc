import { UDocEditor } from "@docmentis/udoc-editor";

// Opens in view mode, with the switch to edit mode, and without the controls
// edit mode shows beside each page.
const editor = await UDocEditor.create(document.getElementById("udoc")!, {
    initialMode: "view",
    showPageControls: false,
});
await editor.open("https://example.com/report.docx");
