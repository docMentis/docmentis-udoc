import { UDocViewer } from "@docmentis/udoc-viewer";

const viewer = await UDocViewer.create(document.getElementById("viewer")!);
await viewer.open("https://example.com/report.pdf");

for (const annotation of await viewer.getPageAnnotations(0)) {
    // The subtype is the key of `kind`, its own entries under it.
    if (typeof annotation.kind !== "object" || !("highlight" in annotation.kind)) continue;
    const { author } = annotation.kind.highlight.markup;
    console.log(annotation.name, annotation.rect, author, annotation.contents);

    // Merges into the annotation, all the way down; the rest stays as it was.
    if (annotation.name !== null) {
        await viewer.patchPageAnnotation(0, annotation.name, { contents: "Reviewed" });
    }
}
