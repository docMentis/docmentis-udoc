// The default theme, dressed as docmentis.com, which serves the docs at
// /docs: its indigo, and Geist for text and code in place of the Inter the
// default theme bundles.
import { defineComponent, h } from "vue";
import { useData } from "vitepress";
import type { Theme } from "vitepress";
import DefaultTheme, { VPFeatures } from "vitepress/theme-without-fonts";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./custom.css";

// A home page's `hero.eyebrow`: the small line over its heading. The default
// theme's `hero.name` would go inside the h1, beside the headline; this goes
// before it, so the h1 is the headline alone.
const HeroEyebrow = defineComponent(() => {
    const { frontmatter } = useData();
    return () => {
        const eyebrow: unknown = frontmatter.value.hero?.eyebrow;
        return typeof eyebrow === "string" ? h("p", { class: "hero-eyebrow" }, eyebrow) : null;
    };
});

/** A heading over a section of the home page's cards. */
const sectionTitle = (text: string) =>
    h("div", { class: "home-section" }, h("h2", { class: "home-section-title" }, text));

// A home page's `guides`: their cards under their heading, before its
// `features`, which `featuresTitle` heads. The default theme has one set of
// cards, its features, which the home page gives to its packages.
const HomeGuides = defineComponent(() => {
    const { frontmatter } = useData();
    return () => {
        const guides: unknown = frontmatter.value.guides;
        const featuresTitle: unknown = frontmatter.value.featuresTitle;
        if (typeof guides !== "object" || guides === null) return null;
        const { title, items } = guides as { title: string; items: unknown[] };
        return [
            sectionTitle(title),
            h(VPFeatures, { features: items }),
            typeof featuresTitle === "string" ? sectionTitle(featuresTitle) : null,
        ];
    };
});

// The footer's copyright under a page with a sidebar — a guide's, the
// reference's — where the default theme hides its footer.
const DocCopyright = defineComponent(() => {
    const { theme } = useData();
    return () => {
        const copyright: unknown = theme.value.footer?.copyright;
        return typeof copyright === "string" ? h("p", { class: "doc-copyright" }, copyright) : null;
    };
});

export default {
    extends: DefaultTheme,
    Layout: () =>
        h(DefaultTheme.Layout, null, {
            "home-hero-info-before": () => h(HeroEyebrow),
            "home-features-before": () => h(HomeGuides),
            "doc-after": () => h(DocCopyright),
        }),
} satisfies Theme;
