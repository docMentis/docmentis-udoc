import { UDocEditor } from "@docmentis/udoc-editor";
import { UDocViewer } from "@docmentis/udoc-viewer";

UDocViewer.create(document.getElementById("viewer")!)
    .then((viewer) => viewer.open("sample.pdf"))
    .catch((error: unknown) => console.error("The viewer didn't open the document:", error));

UDocEditor.create(document.getElementById("editor")!)
    .then((editor) => editor.open("sample.docx"))
    .catch((error: unknown) => console.error("The editor didn't open the document:", error));
