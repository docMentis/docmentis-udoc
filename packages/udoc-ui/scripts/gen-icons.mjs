#!/usr/bin/env node
// Regenerate `src/app/icons.ts` from Google's Material Symbols.
//
// Every icon the editor chrome shows is a Material Symbol picked by name in
// ICONS below — the chrome draws none of its own. A control whose concept has
// no symbol shows its text label instead of an icon. The one drawing the chrome
// does is a sample of a value, not an icon: the Stroke panel's weight and dash
// rows show the line they set.
//
//   npm run gen:icons
//
// The SVGs come from the google/material-design-icons repository, pinned to
// COMMIT so a rerun reproduces the committed file; move COMMIT forward to take
// Google's updates. Style Outlined, FILL 0, weight 400, grade 0, at the 20px
// optical size — the chrome's icon size (`--udoc-btn-glyph`). The optical
// sizes are separate drawings, not scalings: the 20px one carries heavier
// strokes than the 24px and 48px masters so it holds up at 20px.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../src/app/icons.ts");

// --- knobs -----------------------------------------------------------------
const COMMIT = "bd8cb85bd4bad964fe6918f79665bb40c3a8efef"; // 2026-09-25
const STYLE = "materialsymbolsoutlined";
const OPSZ = 20;
// ---------------------------------------------------------------------------

/** Exported constant -> Material Symbol name. */
const ICONS = {
    // Chrome
    ICON_CLEAR: "close",
    ICON_CHECK: "check",
    ICON_MORE: "more_horiz",
    ICON_MORE_VERT: "more_vert",
    ICON_MENU: "menu",
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
    ICON_VIEW_MODE: "tune",
    ICON_VIEW_SPREAD: "fullscreen_portrait",
    ICON_VIEW_CONTINUOUS: "splitscreen_portrait",
    ICON_VIEW_SINGLE_PAGE: "description",
    ICON_VIEW_DOUBLE_PAGE: "import_contacts",
    ICON_VIEW_COVER: "menu_book",
    ICON_VIEW_ROTATION: "draft",
    ICON_VIEW_GAP_ON: "grid_on",
    ICON_VIEW_GAP_OFF: "grid_off",
    ICON_NOTES: "speaker_notes",
    ICON_NORMAL_VIEW: "crop_landscape",
    ICON_NOTES_PAGE_VIEW: "article",
    ICON_PAGES_VIEW: "description",
    ICON_PAGELESS_VIEW: "subject",

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

const url = (name) =>
    `https://raw.githubusercontent.com/google/material-design-icons/${COMMIT}` +
    `/symbols/web/${name}/${STYLE}/${name}_${OPSZ}px.svg`;

// Google's file is `<svg xmlns=… height=… viewBox=… width=…>…</svg>`. Inline in
// HTML it needs no namespace, and CSS sets its size, so only the viewBox and
// the drawing survive; `currentColor` lets the button's color tint it.
async function fetchSymbol(name) {
    const response = await fetch(url(name));
    if (!response.ok) throw new Error(`${name}: ${response.status} ${response.statusText}`);
    const svg = (await response.text()).trim();
    const match = /^<svg\b[^>]*\bviewBox="([^"]+)"[^>]*>([\s\S]*)<\/svg>$/.exec(svg);
    if (!match) throw new Error(`${name}: unexpected SVG shape`);
    return `<svg viewBox="${match[1]}" fill="currentColor">${match[2]}</svg>`;
}

const names = [...new Set(Object.values(ICONS))];
const svgs = new Map(await Promise.all(names.map(async (name) => [name, await fetchSymbol(name)])));

const rows = Object.entries(ICONS)
    .map(([constant, name]) => `/** \`${name}\` */\nexport const ${constant} = \`${svgs.get(name)}\`;`)
    .join("\n\n");

writeFileSync(
    OUT,
    `// AUTO-GENERATED by scripts/gen-icons.mjs — do not edit by hand.
// Material Symbols Outlined, ${OPSZ}px optical size, google/material-design-icons@${COMMIT.slice(0, 12)}.
// Regenerate: \`npm run gen:icons\` (pick icons in the script's ICONS table).
//
// Material Symbols are © Google LLC, licensed under the Apache License 2.0:
// https://www.apache.org/licenses/LICENSE-2.0

${rows}
`,
);
console.log(`[gen-icons] wrote ${Object.keys(ICONS).length} icons (${names.length} symbols) -> ${OUT}`);
