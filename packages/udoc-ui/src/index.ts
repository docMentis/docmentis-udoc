// Public API shared by the docMentis packages built on this one: the class
// each package's own extends, and the types its calls take and return.
export { UDocBase } from "./base.js";
export type { EventHandler, OpenOptions, RenderPageOptions, SheetInfo, UDocEvents, UDocOptions } from "./base.js";
// A PDF's annotations, as the page-annotation calls and events hand them to a
// host and take them back (generated from the Rust serde), and the partial one
// `patchPageAnnotation` merges in.
export type { Annotation, AnnotationId, AnnotationKind } from "@docmentis/udoc-wasm";
export type { AnnotationPatch } from "./app/annotation-patch.js";
export type { LocalCollaborationServiceOptions } from "./worker/LocalCollaborationService.js";
export type { PrintOptions, PrintQuality } from "./app/print.js";
export type { RemoteCheckpointResponse } from "./app/remote.js";
export type { LeftPanelTab, PanelTab, RightPanelTab, ThemeMode } from "./app/state.js";
// The chrome's words: `Messages` keys the `translations` option.
export type { Messages } from "./app/i18n/index.js";
// The error every failure is reported as.
export { UDocError } from "@docmentis/udoc-wasm/error";
export type { UDocErrorCode, UDocErrorDetail } from "@docmentis/udoc-wasm/error";
export type { WasmLocateOptions } from "./worker/wasm-loader.js";

// Geometry types (document space), useful when observing the UI's state.
// `PageView` is viewport (CSS px) space — the unit overlay sources consume.
export type {
    DocumentLayout,
    Fit,
    FitMode,
    LayoutMode,
    PageGap,
    PageView,
    Rect,
    ScrollAlignment,
    ScrollMode,
    Size,
    ViewLength,
    Viewport,
} from "./geometry.js";

// A document in and out (generated from the Rust serde): the doc type it opened
// as, the file format it opens from and saves to, and the strategy it saves by —
// `UDocBase.open`, `saveToBytes`, and `docType` / `sourceFormat`.
export type { FileFormat, SaveStrategy, UDocType } from "@docmentis/udoc-wasm";

// A PDF destination, for `UDocBase.goToDestination` (generated from the Rust
// serde): a page and the view it lands by, or a name the document resolves.
export type { Destination, DestinationView } from "@docmentis/udoc-wasm";

// Fonts (generated from the Rust serde): a font `UDocBase.registerFonts`
// fetches by URL, the family and face it serves, and a Google font family the
// `googleFontFamilies` option offers.
export type { FontDescriptor, GoogleFontFamily, UrlFont } from "@docmentis/udoc-wasm";

// Search (generated from the Rust serde): `UDocBase.search`'s options and
// scope, and what it finds — each match with its page, its highlight quads and
// the words around it.
export type {
    SearchMatch,
    SearchMatchLocation,
    SearchOptions,
    SearchQuad,
    UDocSearchScope,
} from "@docmentis/udoc-wasm";

// A selection, tagged by doc type (generated from the Rust serde):
// `UDocBase.setSelection` takes one, `selection` and `searchMatchSelection`
// give one.
export type { UDocSelection } from "@docmentis/udoc-wasm";

// Command write contract (generated from the Rust serde). `UDocCommand` is the
// doc-type-tagged argument to `UDocBase.execute` — the generic write seam a
// host crafts from the declared type. The inner enums (`PortableCommand`,
// `PresentationCommand`, `ShapeCommand`) and the `Affine` field are re-exported
// for hosts that build commands directly.
export type { UDocCommand, PortableCommand, PresentationCommand, ShapeCommand, Affine } from "@docmentis/udoc-wasm";

// HTML overlay layer — page-anchored DOM chrome over the Rust-painted canvas.
// A registry: `UDocBase.setOverlay(id, source)` renders any number of
// overlays at once; the built-in ones register under `udoc:` ids through the
// same surface, so hosts can remove or replace them. Build a custom
// `OverlaySource` mapping each frame's `PageView`s + scale to elements.
export { OverlayManager } from "./app/components/OverlayManager.js";
export type { OverlayFrame, OverlayItem, OverlayOptions, OverlaySource } from "./app/components/OverlayManager.js";

// Where the view controls dock — `UDocBase.setViewControlsPlacement`.
export type { ViewControlsPlacement } from "./app/state.js";
