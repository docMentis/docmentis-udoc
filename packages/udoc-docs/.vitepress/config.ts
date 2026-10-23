import { readFileSync } from "node:fs";
import { defineConfig } from "vitepress";
import type { DefaultTheme } from "vitepress";

// An "Engine types" section is one entry, its index page: its hundreds of
// types are reached from the pages that use them, and every page carries the
// whole sidebar.
function collapseEngineTypes(items: DefaultTheme.SidebarItem[]): DefaultTheme.SidebarItem[] {
    return items.map((item) => {
        if (item.text === "Engine types") {
            const { items: _items, collapsed: _collapsed, ...entry } = item;
            return entry;
        }
        return item.items ? { ...item, items: collapseEngineTypes(item.items) } : item;
    });
}

// The API reference's sidebar, which TypeDoc writes beside the pages it
// generates (`npm run api`).
const apiSidebar = collapseEngineTypes(
    JSON.parse(readFileSync(new URL("../api/typedoc-sidebar.json", import.meta.url), "utf8")),
);

export default defineConfig({
    title: "docMentis udoc",
    description: "Guides and API reference for the docMentis udoc viewer, editor and Node hosts.",
    // Served at docmentis.com/docs: the site proxies `/docs/*` to the GitHub
    // Pages deployment (.github/workflows/docs.yml), so every link and asset
    // is under `/docs/` — on Pages' own github.io address too, where the
    // pages therefore come up without their styles.
    base: "/docs/",
    outDir: "dist",
    cleanUrls: true,
    themeConfig: {
        nav: [
            { text: "Guide", link: "/guide/quick-start" },
            { text: "API reference", link: "/api/" },
        ],
        sidebar: {
            // In reading order, which is the guides' own, not their files'.
            "/guide/": [{ text: "Guide", items: [{ text: "Quick start", link: "/guide/quick-start" }] }],
            "/api/": [{ text: "API reference", link: "/api/", items: apiSidebar }],
        },
        // A class's members are its page's h3s, under h2s by kind.
        outline: [2, 3],
        search: { provider: "local" },
        socialLinks: [{ icon: "github", link: "https://github.com/docMentis/docmentis-udoc" }],
    },
});
