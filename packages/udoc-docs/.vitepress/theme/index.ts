// The default theme, dressed as docmentis.com, which serves the docs at
// /docs: its indigo, and Geist for text and code in place of the Inter the
// default theme bundles.
import DefaultTheme from "vitepress/theme-without-fonts";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./custom.css";

export default DefaultTheme;
