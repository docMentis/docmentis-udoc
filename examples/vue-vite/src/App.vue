<script setup lang="ts">
import DocumentEditor from "./components/DocumentEditor.vue";
import DocumentViewer from "./components/DocumentViewer.vue";
</script>

<template>
    <main class="panes">
        <DocumentViewer src="/sample.pdf" />
        <DocumentEditor src="/sample.docx" />
    </main>
</template>
