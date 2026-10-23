<script lang="ts">
    import { onMount } from "svelte";
    import { UDocViewer } from "@docmentis/udoc-viewer";

    /** A viewer filling its element, opening `src`. */
    let { src }: { src: string } = $props();
    let container: HTMLDivElement;

    onMount(() => {
        let viewer: UDocViewer | undefined;
        // Unmounted before `create` resolves, the component destroys the viewer it made.
        let gone = false;
        UDocViewer.create(container)
            .then(async (created) => {
                if (gone) return created.destroy();
                viewer = created;
                await viewer.open(src);
            })
            .catch((error: unknown) => console.error("The viewer didn't open the document:", error));
        return () => {
            gone = true;
            viewer?.destroy();
        };
    });
</script>

<div bind:this={container} class="pane"></div>
