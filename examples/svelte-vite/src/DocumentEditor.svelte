<script lang="ts">
    import { onMount } from "svelte";
    import { UDocEditor } from "@docmentis/udoc-editor";

    /** An editor filling its element, opening `src`. */
    let { src }: { src: string } = $props();
    let container: HTMLDivElement;

    onMount(() => {
        let editor: UDocEditor | undefined;
        // Unmounted before `create` resolves, the component destroys the editor it made.
        let gone = false;
        UDocEditor.create(container)
            .then(async (created) => {
                if (gone) return created.destroy();
                editor = created;
                await editor.open(src);
            })
            .catch((error: unknown) => console.error("The editor didn't open the document:", error));
        return () => {
            gone = true;
            editor?.destroy();
        };
    });
</script>

<div bind:this={container} class="pane"></div>
