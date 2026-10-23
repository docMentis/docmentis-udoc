import { DocumentEditor } from "./DocumentEditor";
import { DocumentViewer } from "./DocumentViewer";

export function App() {
    return (
        <main className="panes">
            <DocumentViewer src="/sample.pdf" />
            <DocumentEditor src="/sample.docx" />
        </main>
    );
}
