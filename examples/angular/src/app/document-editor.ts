import { Component, ElementRef, inject, input, type AfterViewInit, type OnDestroy } from "@angular/core";
import { UDocEditor } from "@docmentis/udoc-editor";
import { wasm } from "./wasm";

/** An editor filling its element, opening `src`. */
@Component({
    selector: "app-document-editor",
    template: "",
    host: { class: "pane" },
})
export class DocumentEditor implements AfterViewInit, OnDestroy {
    readonly src = input.required<string>();
    readonly #host = inject<ElementRef<HTMLElement>>(ElementRef);
    #editor?: UDocEditor;
    // Destroyed before `create` resolves, the component destroys the editor it made.
    #gone = false;

    ngAfterViewInit(): void {
        UDocEditor.create(this.#host.nativeElement, { wasm })
            .then(async (editor) => {
                if (this.#gone) return editor.destroy();
                this.#editor = editor;
                await editor.open(this.src());
            })
            .catch((error: unknown) => console.error("The editor didn't open the document:", error));
    }

    ngOnDestroy(): void {
        this.#gone = true;
        this.#editor?.destroy();
    }
}
