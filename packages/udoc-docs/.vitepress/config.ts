import { readFileSync } from "node:fs";
import { defineConfig } from "vitepress";
import type { DefaultTheme } from "vitepress";

/** The most exports a package lists by name; one with more lists them by kind. */
const FLAT_EXPORTS = 20;

// A package's entry, which TypeDoc gives a group per kind of export. A package
// with a few lists them by name, as a reader looks one up — the class,
// interface or function its page says it is; one with many, Common, keeps
// the groups. Its "Engine types" section is one entry, last, its index page:
// its hundreds of types are reached from the pages that use them, and every
// page carries the whole sidebar.
function shapePackage(entry: DefaultTheme.SidebarItem): DefaultTheme.SidebarItem {
    const groups = entry.items ?? [];
    const engineTypes = groups.find((group) => group.text === "Engine types")?.items?.[0];
    const kinds = groups.filter((group) => group.text !== "Engine types");
    const exports = kinds.flatMap((group) => group.items ?? []);
    const items =
        exports.length <= FLAT_EXPORTS ? exports.sort((a, b) => (a.text ?? "").localeCompare(b.text ?? "")) : kinds;
    if (engineTypes) {
        const { items: _items, collapsed: _collapsed, ...indexPage } = engineTypes;
        items.push(indexPage);
    }
    return { ...entry, items };
}

// The API reference's sidebar, a package's entry apiece, which TypeDoc writes
// beside the pages it generates (`npm run api`).
const apiSidebar = (
    JSON.parse(
        readFileSync(new URL("../api/typedoc-sidebar.json", import.meta.url), "utf8"),
    ) as DefaultTheme.SidebarItem[]
).map(shapePackage);

/** The `package.json` of the package in `packages/<dir>`. */
function packageJson(dir: string): { name: string; version: string; description: string } {
    return JSON.parse(readFileSync(new URL(`../../${dir}/package.json`, import.meta.url), "utf8"));
}

const REPO = "https://github.com/docMentis/docmentis-udoc";

// Served at docmentis.com/docs: the site proxies `/docs/*` to the GitHub Pages
// deployment (.github/workflows/docs.yml), so every link and asset is under
// `/docs/` — on Pages' own github.io address too, where the pages therefore
// come up without their styles.
const base = "/docs/";

// The docs' public address. Pages serves the same pages at its github.io one,
// so each names its address here as canonical, for search engines to index
// it and not the copy; the sitemap lists them there too.
const SITE = `https://www.docmentis.com${base}`;

const title = "docMentis Docs";
// The home page's, and any other page's without one of its own.
const description =
    "Guides and API reference for docMentis udoc: integrate document viewing, editing, collaboration, " +
    "and processing into your applications and workflows.";

export default defineConfig({
    title,
    description,
    base,
    outDir: "dist",
    cleanUrls: true,
    sitemap: { hostname: SITE },
    // A page's canonical address, and what a link to it shows where it's
    // shared.
    transformHead({ pageData }) {
        const path = pageData.relativePath.replace(/(^|\/)index\.md$/, "$1").replace(/\.md$/, "");
        const url = new URL(path, SITE).href;
        return [
            ["link", { rel: "canonical", href: url }],
            ["meta", { property: "og:type", content: "website" }],
            ["meta", { property: "og:site_name", content: title }],
            ["meta", { property: "og:title", content: pageData.title ? `${pageData.title} | ${title}` : title }],
            ["meta", { property: "og:description", content: pageData.description || description }],
            ["meta", { property: "og:url", content: url }],
        ];
    },
    // The package's own README, for its folder on GitHub, not a page of the
    // site.
    srcExclude: ["README.md"],
    // docmentis.com's icon and wordmark, from `public/`. VitePress puts the
    // logo under `base` itself, but not what `head` links to.
    head: [["link", { rel: "icon", type: "image/svg+xml", href: `${base}favicon.svg` }]],
    transformPageData(pageData) {
        // The reference is TypeDoc's: no page of it is a file to edit.
        if (pageData.relativePath.startsWith("api/")) pageData.frontmatter.editLink = false;
        // The home page's card for a package describes it as npm does, from
        // its `package.json`, so the two can't drift apart.
        if (pageData.relativePath === "index.md") {
            for (const feature of pageData.frontmatter.features as { package?: string; details?: string }[]) {
                if (!feature.package) continue;
                const { name, description } = packageJson(feature.package);
                feature.details = `<code>${name}</code> ${description}`;
            }
        }
    },
    themeConfig: {
        logo: { light: "/logo.svg", dark: "/logo-dark.svg", alt: "docMentis" },
        siteTitle: false,
        // The footer the default theme shows on a page without a sidebar, the
        // home page; the theme repeats the copyright under every other page
        // (`theme/index.ts`). The year is the build's, a release's.
        footer: { copyright: `Copyright © ${new Date().getFullYear()} docMentis LLC` },
        // Each section's entry is active on any page of it. The version is the
        // packages' — they release together, at one — so the docs, deployed
        // on a release, name the release they describe.
        nav: [
            { text: "Guide", link: "/guide/quick-start", activeMatch: "^/guide/" },
            { text: "API reference", link: "/api/", activeMatch: "^/api/" },
            {
                text: `v${packageJson("udoc-viewer").version}`,
                items: [
                    { text: "Changelog", link: `${REPO}/blob/main/CHANGELOG.md` },
                    { text: "Releases", link: `${REPO}/releases` },
                ],
            },
            { text: "docmentis.com", link: "https://www.docmentis.com" },
        ],
        editLink: { pattern: `${REPO}/edit/main/packages/udoc-docs/:path`, text: "Edit this page on GitHub" },
        sidebar: {
            // In reading order, which is the guides' own, not their files'.
            "/guide/": [{ text: "Guide", items: [{ text: "Quick start", link: "/guide/quick-start" }] }],
            "/api/": [{ text: "API reference", link: "/api/", items: apiSidebar }],
        },
        // A class's members are its page's h3s, under h2s by kind.
        outline: [2, 3],
        search: { provider: "local" },
        socialLinks: [{ icon: "github", link: REPO }],
    },
});
