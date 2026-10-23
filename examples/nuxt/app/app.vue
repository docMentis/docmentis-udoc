<template>
    <main class="panes">
        <!-- Their components are `.client.vue`: the viewer and the editor run in
             the browser, so Nuxt renders them there alone, and the server renders
             the page around them. -->
        <DocumentViewer src="/sample.pdf" />
        <DocumentEditor src="/sample.docx" />
    </main>
</template>
