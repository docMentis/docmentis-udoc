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

# A card that names a package says what its package.json does: its name and
# description (`transformPageData` in .vitepress/config.ts).
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
