#!/usr/bin/env node
// Regenerate `src/app/icons.ts` from Google's Material Symbols and
// Pictogrammers' Material Design Icons.
//
// Every icon the editor chrome shows is a Material Symbol, or where Material
// has none a Material Design Icon, picked by name in ICONS below — the chrome
// draws none of its own. A control whose concept has no icon in either shows
// its text label instead of an icon. The one drawing the chrome does is a
// sample of a value, not an icon: the Stroke panel's weight and dash rows show
// the line they set.
//
//   npm run gen:icons
//
// The SVGs come from the google/material-design-icons repository, pinned to
// COMMIT so a rerun reproduces the committed file; move COMMIT forward to take
// Google's updates. Style Outlined, FILL 0, weight 400, grade 0, at the 20px
// optical size — the chrome's icon size (`--udoc-btn-glyph`). The optical
// sizes are separate drawings, not scalings: the 20px one carries heavier
// strokes than the 24px and 48px masters so it holds up at 20px.
//
// A Material Design Icon (pictogrammers.com/library/mdi) comes from the
// Templarian/MaterialDesign-SVG repository, pinned to MDI_COMMIT the same way.
// Its one drawing is on a 24px grid, which the chrome scales to 20px, in the
// older Material Icons style, so it goes where Material Symbols has nothing.
// The generator refuses a Brand / Logo one, which isn't licensed under Apache
// 2.0 as the rest are, and a deprecated one, which a later major release drops.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../src/app/icons.ts");

// --- knobs -----------------------------------------------------------------
const COMMIT = "bd8cb85bd4bad964fe6918f79665bb40c3a8efef"; // 2026-09-25
const STYLE = "materialsymbolsoutlined";
const OPSZ = 20;
const MDI_COMMIT = "9e04201d4557e729822fb57f62a316c3dea1d4a8"; // v7.4.47, 2023-12-26
// ---------------------------------------------------------------------------

/**
 * Exported constant -> Material Symbol name, or `{ mdi }` naming a Material
 * Design Icon instead, as its library spells it (`table-row-remove`).
 */
const ICONS = {
    // Ribbon tabs — on the strip, in its icon style
    ICON_TAB_ANNOTATE: "edit_note",
    ICON_TAB_PRESENT: "slideshow",
    ICON_TAB_REVIEW: "rate_review",
    ICON_TAB_VIEW: "visibility",

    // Chrome
    ICON_CLEAR: "close",
    ICON_CHECK: "check",
    ICON_MORE: "more_horiz",
    ICON_MORE_VERT: "more_vert",
    ICON_MENU: "menu",
    ICON_SIDE_PANEL_OPEN: "left_panel_open",
    ICON_SIDE_PANEL_CLOSE: "left_panel_close",
    ICON_CODE: "code",
    ICON_SEARCH: "search",
    ICON_COMMENTS: "comment",
    ICON_FULLSCREEN: "fullscreen",
    ICON_FULLSCREEN_EXIT: "fullscreen_exit",
    ICON_DOWNLOAD: "download",
    ICON_PRINT: "print",
    ICON_UNDO: "undo",
    ICON_REDO: "redo",
    ICON_THEME_LIGHT: "light_mode",
    ICON_THEME_DARK: "dark_mode",
    ICON_THEME_SYSTEM: "computer",

    // Left panel tabs
    ICON_THUMBNAIL: "grid_view",
    ICON_OUTLINE: "toc",
    ICON_LAYERS: "layers",
    ICON_ATTACHMENT: "attach_file",

    // Navigation and view
    ICON_CHEVRON_LEFT: "chevron_left",
    ICON_CHEVRON_RIGHT: "chevron_right",
    ICON_CHEVRON_DOWN: "keyboard_arrow_down",
    ICON_CHEVRON_UP: "keyboard_arrow_up",
    ICON_ZOOM_IN: "zoom_in",
    ICON_ZOOM_OUT: "zoom_out",
    // The View tab
    ICON_VIEW_SPREAD: "fullscreen_portrait",
    ICON_VIEW_CONTINUOUS: "splitscreen_portrait",
    ICON_VIEW_SINGLE_PAGE: "crop_portrait",
    ICON_VIEW_DOUBLE_PAGE: "import_contacts",
    ICON_VIEW_COVER: "menu_book",
    ICON_VIEW_ROTATE_LEFT: "rotate_left",
    ICON_VIEW_ROTATE_RIGHT: "rotate_right",
    ICON_VIEW_GAPLESS: "grid_3x3_off",
    ICON_FORMATTING_MARKS: "format_paragraph",
    ICON_FORMULA_BAR: "function",
    ICON_NOTES: "speaker_notes",
    ICON_SLIDE_SHOW_FROM_BEGINNING: "smart_display",
    ICON_SLIDE_SHOW_FROM_CURRENT: "present_to_all",
    ICON_PRESENTER_VIEW: "co_present",
    ICON_SET_UP_SLIDE_SHOW: "tv_displays",
    // The presenter view
    ICON_TIMER_PAUSE: "pause",
    ICON_TIMER_RESUME: "play_arrow",
    ICON_TIMER_RESTART: "replay",
    ICON_TEXT_LARGER: "text_increase",
    ICON_TEXT_SMALLER: "text_decrease",
    ICON_SWAP_SCREENS: "swap_horiz",
    ICON_PREVIEW_SLIDE: "play_arrow",
    ICON_STOP_SLIDE_PREVIEW: "stop",
    ICON_SLIDE_PLAYS: "animation",
    ICON_NORMAL_VIEW: "crop_landscape",
    ICON_NOTES_PAGE_VIEW: "article",
    ICON_SLIDE_MASTER_VIEW: "space_dashboard",
    ICON_PAGES_VIEW: "description",
    ICON_PAGELESS_VIEW: "subject",
    ICON_REVISION_VIEW: "difference",
    ICON_SHOW_MARKUP: "filter_list",
    ICON_SHEET_NORMAL_VIEW: "grid_on",

    // Pointer modes
    ICON_TOOL_POINTER: "arrow_selector_tool",
    ICON_TOOL_HAND: "pan_tool",
    ICON_TOOL_ZOOM: "zoom_in",

    // Annotate
    ICON_SUBTOOL_FREEHAND: "draw",
    ICON_SUBTOOL_LINE: "diagonal_line",
    ICON_SUBTOOL_ARROW: "north_east",
    ICON_SUBTOOL_RECTANGLE: "rectangle",
    ICON_SUBTOOL_ELLIPSE: "circle",
    ICON_SUBTOOL_POLYGON: "pentagon",
    ICON_SUBTOOL_POLYLINE: "polyline",
    ICON_SUBTOOL_CLOUD: "cloud",
    ICON_SHAPES: "shapes",
    ICON_SUBTOOL_NOTE: "sticky_note_2",
    ICON_SUBTOOL_STAMP: "approval",
    ICON_SUBTOOL_TEXTBOX: "insert_text",
    ICON_SUBTOOL_HIGHLIGHT: "ink_highlighter",
    ICON_SUBTOOL_UNDERLINE: "format_underlined",
    ICON_SUBTOOL_STRIKETHROUGH: "format_strikethrough",
    ICON_SUBTOOL_SQUIGGLY: "format_underlined_squiggle",

    // Comment thread
    ICON_REPLY: "reply",
    ICON_EDIT: "edit",
    ICON_LOCK: "lock",

    // Password
    ICON_PASSWORD_SHOW: "visibility",
    ICON_PASSWORD_HIDE: "visibility_off",

    // Layers
    ICON_LAYER_ON: "visibility",
    ICON_LAYER_OFF: "visibility_off",

    // Line and paint. The four paint glyphs (fill, stroke, text color,
    // highlight) carry a bar in their bottom fifth where the chosen color
    // goes; the `.udoc-paint` swatch clips it and lays the color bar in its
    // place.
    ICON_LINE_STYLE: "line_style",
    ICON_STROKE_WIDTH: "line_weight",
    ICON_ARROW_OPEN: "line_end_arrow_notch",
    ICON_ARROW_CLOSED: "line_end_arrow",
    ICON_LINE_END_CIRCLE: "line_end_circle",
    ICON_LINE_END_SQUARE: "line_end_square",
    ICON_LINE_END_DIAMOND: "line_end_diamond",
    ICON_NO_FILL: "format_color_reset",
    ICON_FILL: "format_color_fill",
    ICON_STROKE: "border_color",
    ICON_OPACITY: "opacity",
    ICON_PALETTE: "palette",
    ICON_EYEDROPPER: "colorize",

    // Text
    ICON_TEXT_HIGHLIGHT: "format_ink_highlighter",

    // Clipboard
    ICON_COPY: "content_copy",

    // Delete
    ICON_DELETE: "delete",

    // Pages — the thumbnails' menu and edit mode's page controls
    ICON_PAGE_ADD: "note_add",
    ICON_PAGE_DUPLICATE: "file_copy",
    ICON_ROTATE_LEFT: "rotate_90_degrees_ccw",
    ICON_ROTATE_RIGHT: "rotate_90_degrees_cw",
    ICON_SLIDE_ADD: "rectangle_add",
    ICON_SLIDE_HIDE: "visibility_off",

    // Sections — a deck's, in the thumbnails' menus
    ICON_SECTION_ADD: "new_label",
    ICON_SECTION_RENAME: "edit",
    ICON_SECTION_REMOVE: "label_off",
    ICON_SECTION_UP: "arrow_upward",
    ICON_SECTION_DOWN: "arrow_downward",
    ICON_SECTIONS_COLLAPSE: "unfold_less",
    ICON_SECTIONS_EXPAND: "unfold_more",

    // Sheets — a workbook's sheet tabs and their menu
    ICON_SHEET_ADD: "add",
    ICON_SHEET_RENAME: "edit",
    ICON_SHEET_TAB_COLOR: "format_color_fill",
    ICON_SHEET_HIDE: "visibility_off",
    ICON_SHEET_UNHIDE: "visibility",

    // Collaboration
    ICON_PEOPLE: "group",
    ICON_PAUSE: "pause",
    ICON_RESUME: "play_arrow",
};

const symbolUrl = (name) =>
    `https://raw.githubusercontent.com/google/material-design-icons/${COMMIT}` +
    `/symbols/web/${name}/${STYLE}/${name}_${OPSZ}px.svg`;
const mdiUrl = (path) => `https://raw.githubusercontent.com/Templarian/MaterialDesign-SVG/${MDI_COMMIT}/${path}`;

async function fetchOk(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
    return response;
}

// Google's file is `<svg xmlns=… height=… viewBox=… width=…>…</svg>`, and
// Pictogrammers' `<svg xmlns=… id=… viewBox=…>…</svg>`. Inline in HTML it needs
// no namespace or id, and CSS sets its size, so only the viewBox and the drawing
// survive; `currentColor` lets the button's color tint it.
async function fetchSvg(url) {
    const svg = (await (await fetchOk(url)).text()).trim();
    const match = /^<svg\b[^>]*\bviewBox="([^"]+)"[^>]*>([\s\S]*)<\/svg>$/.exec(svg);
    if (!match) throw new Error(`${url}: unexpected SVG shape`);
    return `<svg viewBox="${match[1]}" fill="currentColor">${match[2]}</svg>`;
}

// Stop on a Material Design Icon the library has no such name for, or that
// the header comment above says the chrome mustn't take.
async function checkMdi(names) {
    if (names.length === 0) return;
    const meta = new Map((await (await fetchOk(mdiUrl("meta.json"))).json()).map((icon) => [icon.name, icon]));
    for (const name of names) {
        const icon = meta.get(name);
        if (!icon) throw new Error(`${name}: no Material Design Icon of that name`);
        if (icon.tags.includes("Brand / Logo"))
            throw new Error(`${name}: a brand's logo, not licensed under Apache 2.0`);
        if (icon.deprecated) throw new Error(`${name}: deprecated`);
    }
}

const entries = Object.entries(ICONS).map(([constant, icon]) =>
    typeof icon === "string"
        ? { constant, url: symbolUrl(icon), doc: `\`${icon}\`` }
        : {
              constant,
              mdi: icon.mdi,
              url: mdiUrl(`svg/${icon.mdi}.svg`),
              doc: `Material Design Icons' \`${icon.mdi}\``,
          },
);
const mdiNames = [...new Set(entries.filter((entry) => entry.mdi).map((entry) => entry.mdi))];
await checkMdi(mdiNames);
const urls = [...new Set(entries.map((entry) => entry.url))];
const svgs = new Map(await Promise.all(urls.map(async (url) => [url, await fetchSvg(url)])));

const rows = entries
    .map(({ constant, url, doc }) => `/** ${doc} */\nexport const ${constant} = \`${svgs.get(url)}\`;`)
    .join("\n\n");

// The header names Material Design Icons only once ICONS takes one.
const mdi = mdiNames.length > 0;
writeFileSync(
    OUT,
    `// AUTO-GENERATED by scripts/gen-icons.mjs — do not edit by hand.
// Material Symbols Outlined, ${OPSZ}px optical size, google/material-design-icons@${COMMIT.slice(0, 12)}.
${mdi ? `// Material Design Icons, Templarian/MaterialDesign-SVG@${MDI_COMMIT.slice(0, 12)}.\n` : ""}\
// Regenerate: \`npm run gen:icons\` (pick icons in the script's ICONS table).
//
// Material Symbols are © Google LLC, licensed under the Apache License 2.0:
${mdi ? "// https://www.apache.org/licenses/LICENSE-2.0\n// Material Design Icons are © Pictogrammers, licensed under the Apache License 2.0:\n" : ""}\
// https://www.apache.org/licenses/LICENSE-2.0

${rows}
`,
);
console.log(
    `[gen-icons] wrote ${Object.keys(ICONS).length} icons (${urls.length - mdiNames.length} symbols, ` +
        `${mdiNames.length} Material Design Icons) -> ${OUT}`,
);
