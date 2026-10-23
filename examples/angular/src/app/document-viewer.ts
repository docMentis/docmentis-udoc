import { Component, ElementRef, inject, input, type AfterViewInit, type OnDestroy } from "@angular/core";
import { UDocViewer } from "@docmentis/udoc-viewer";
import { wasm } from "./wasm";

/** A viewer filling its element, opening `src`. */
@Component({
    selector: "app-document-viewer",
    template: "",
    host: { class: "pane" },
})
export class DocumentViewer implements AfterViewInit, OnDestroy {
    readonly src = input.required<string>();
    readonly #host = inject<ElementRef<HTMLElement>>(ElementRef);
    #viewer?: UDocViewer;
    // Destroyed before `create` resolves, the component destroys the viewer it made.
    #gone = false;

    ngAfterViewInit(): void {
        UDocViewer.create(this.#host.nativeElement, { wasm })
            .then(async (viewer) => {
                if (this.#gone) return viewer.destroy();
                this.#viewer = viewer;
                await viewer.open(this.src());
            })
            .catch((error: unknown) => console.error("The viewer didn't open the document:", error));
    }

    ngOnDestroy(): void {
        this.#gone = true;
        this.#viewer?.destroy();
    }
}
