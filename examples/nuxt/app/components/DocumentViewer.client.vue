<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, useTemplateRef, watch } from "vue";
import { UDocViewer } from "@docmentis/udoc-viewer";

/** A viewer filling its element, opening `src`. */
const props = defineProps<{ src: string }>();
const container = useTemplateRef<HTMLDivElement>("container");
let viewer: UDocViewer | undefined;
// Unmounted before `create` resolves, the component destroys the viewer it made.
let gone = false;

onMounted(async () => {
    // Nuxt renders a `.client.vue` component's template once it has mounted.
    await nextTick();
    try {
        const created = await UDocViewer.create(container.value!);
        if (gone) return created.destroy();
        viewer = created;
        await viewer.open(props.src);
    } catch (error) {
        console.error("The viewer didn't open the document:", error);
    }
});

watch(
    () => props.src,
    (src) => viewer?.open(src),
);

onBeforeUnmount(() => {
    gone = true;
    viewer?.destroy();
});
</script>

<template>
    <div ref="container" class="pane"></div>
</template>
