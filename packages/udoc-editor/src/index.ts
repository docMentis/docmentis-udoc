// Public API — the common surface every docMentis document UI shares, and the
// editor's own: its class, its options and events, its modes, its words, and
// edit mode's page controls.
export * from "@docmentis/udoc-ui";
export { UDocEditor } from "./editor.js";
export type { UDocEditorEvents, UDocEditorOptions } from "./editor.js";
export type { EditorMode } from "./mode.js";
// The chrome's words — udoc-ui's and edit mode's: `Messages` keys the
// `translations` option, and `createI18n` builds the `i18n` a host hands
// `pageActions` / `pageInserts`.
export { createI18n } from "./i18n/index.js";
export type { I18n, Messages } from "./i18n/index.js";
// The page controls — the rail beside each page and the insert strip between
// them, registered under `udoc:page-actions` / `udoc:page-insert` — for a host
// that registers them its own way.
export { pageActions, pageInserts } from "./components/PageControls.js";
export type { PageActionsCallbacks, PageInsertsOptions } from "./components/PageControls.js";
