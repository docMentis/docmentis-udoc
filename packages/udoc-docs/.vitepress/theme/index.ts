// The default theme, dressed as docmentis.com, which serves the docs at
// /docs: its indigo, and Geist for text and code in place of the Inter the
// default theme bundles.
import { defineComponent, h } from "vue";
import { useData } from "vitepress";
import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme-without-fonts";
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

export default {
    extends: DefaultTheme,
    Layout: () => h(DefaultTheme.Layout, null, { "home-hero-info-before": () => h(HeroEyebrow) }),
} satisfies Theme;
