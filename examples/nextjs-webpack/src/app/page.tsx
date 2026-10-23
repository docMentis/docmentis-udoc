import { DocumentEditor } from "@/components/DocumentEditor";
import { DocumentViewer } from "@/components/DocumentViewer";

export default function Home() {
    return (
        <main className="panes">
            <DocumentViewer src="/sample.pdf" />
            <DocumentEditor src="/sample.docx" />
        </main>
    );
}
