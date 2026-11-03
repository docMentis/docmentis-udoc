---
layout: home

# The eyebrow is the theme's (.vitepress/theme/index.ts): the line over the
# heading, outside the h1, which is the headline alone.
hero:
    eyebrow: docMentis Documentation
    text: Build document experiences with udoc.
    tagline: Everything you need to integrate document viewing, editing, collaboration, and processing into your applications and workflows.
    actions:
        - theme: brand
          text: Get started
          link: /guide/quick-start
        - theme: alt
          text: Try the demo
          link: https://www.docmentis.com/viewer/demo

# The guides' cards, under their heading, over the packages' (the theme's
# HomeGuides). A card that names a guide is its title and description, and
# links to it; one that names several links each by its title, under its
# summary (`transformPageData` in .vitepress/config.ts).
guides:
    title: Guides
    items:
        - guide: quick-start
        - title: Frameworks
          summary: Set up the viewer or the editor in your app's framework, or with none.
          guides: [react, nextjs, vue, nuxt, svelte, angular, without-a-framework]
        - guide: supported-formats
        - guide: customize-the-ui
        - guide: extension-documents
        - guide: migrate-from-0-7

# A card that names a package says what its package.json does: its name and
# description (`transformPageData` in .vitepress/config.ts).
featuresTitle: Packages
features:
    - title: Viewer
      package: udoc-viewer
      link: /api/udoc-viewer/
      linkText: API reference
    - title: Editor
      package: udoc-editor
      link: /api/udoc-editor/
      linkText: API reference
    - title: Server
      package: udoc-server
      link: /api/udoc-server/
      linkText: API reference
    - title: Command line
      package: udoc-cli
      link: https://github.com/docMentis/docmentis-udoc/tree/main/packages/udoc-cli#readme
      linkText: README
    - title: Node
      package: udoc-node
      link: /api/udoc-node/
      linkText: API reference
    - title: Examples
      details: Example apps embedding the viewer and the editor with React, Vue, Svelte, Angular, Next.js, Nuxt, or plain JavaScript on Vite, webpack, or no bundler.
      link: https://github.com/docMentis/docmentis-udoc/tree/main/examples#readme
      linkText: On GitHub
---
