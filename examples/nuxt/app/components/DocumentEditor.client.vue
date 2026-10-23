<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, useTemplateRef, watch } from "vue";
import { UDocEditor } from "@docmentis/udoc-editor";

/** An editor filling its element, opening `src`. */
const props = defineProps<{ src: string }>();
const container = useTemplateRef<HTMLDivElement>("container");
let editor: UDocEditor | undefined;
// Unmounted before `create` resolves, the component destroys the editor it made.
let gone = false;

onMounted(async () => {
    // Nuxt renders a `.client.vue` component's template once it has mounted.
    await nextTick();
    try {
        const created = await UDocEditor.create(container.value!);
        if (gone) return created.destroy();
        editor = created;
        await editor.open(props.src);
    } catch (error) {
        console.error("The editor didn't open the document:", error);
    }
});

watch(
    () => props.src,
    (src) => editor?.open(src),
);

onBeforeUnmount(() => {
    gone = true;
    editor?.destroy();
});
</script>

<template>
    <div ref="container" class="pane"></div>
</template>
