<script lang="ts">
    import DocumentEditor from "./DocumentEditor.svelte";
    import DocumentViewer from "./DocumentViewer.svelte";
</script>

<main class="panes">
    <DocumentViewer src="/sample.pdf" />
    <DocumentEditor src="/sample.docx" />
</main>
