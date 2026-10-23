import { Component } from "@angular/core";
import { DocumentEditor } from "./document-editor";
import { DocumentViewer } from "./document-viewer";

@Component({
    selector: "app-root",
    imports: [DocumentViewer, DocumentEditor],
    template: `
        <main class="panes">
            <app-document-viewer src="/sample.pdf" />
            <app-document-editor src="/sample.docx" />
        </main>
    `,
})
export class App {}
