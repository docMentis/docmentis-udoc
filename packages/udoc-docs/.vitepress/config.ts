import { readFileSync } from "node:fs";
import { defineConfig } from "vitepress";
import type { DefaultTheme } from "vitepress";

// The API reference's sidebar, which TypeDoc writes beside the pages it
// generates (`npm run api`).
const apiSidebar = JSON.parse(
    readFileSync(new URL("../api/typedoc-sidebar.json", import.meta.url), "utf8"),
) as DefaultTheme.SidebarItem[];

export default defineConfig({
    title: "docMentis udoc",
    description: "Guides and API reference for the docMentis udoc viewer, editor and Node hosts.",
    outDir: "dist",
    cleanUrls: true,
    themeConfig: {
        nav: [{ text: "API reference", link: "/api/" }],
        sidebar: {
            "/api/": [{ text: "API reference", link: "/api/", items: apiSidebar }],
        },
        // A class's members are its page's h3s, under h2s by kind.
        outline: [2, 3],
        search: { provider: "local" },
        socialLinks: [{ icon: "github", link: "https://github.com/docMentis/docmentis-udoc" }],
    },
});
