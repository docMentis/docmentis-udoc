#!/usr/bin/env node
// Regenerate `src/icons.ts` from Google's Material Symbols and Pictogrammers'
// Material Design Icons.
//
// Every icon edit mode's chrome shows beyond udoc-ui's is a Material Symbol or
// a Material Design Icon, picked by name in ICONS below — the chrome draws none
// of its own, as udoc-ui's `scripts/gen-icons.mjs` says of its own. The icons
// that draw a table are Material Design Icons, whose table set is fuller than
// Material's: the table itself, its style and properties, and each selection
// and edit of its rows, columns and cells, a delete and a split among them. So
// are the Arrange controls that draw shapes stacked — Group, Ungroup and the
// four order moves — where Material's show arrows and plain outlines, and
// Insert Image, a picture with a plus as Insert Table's table has. A table's
// borders and text directions stay Material Symbols, as does the rest, with a
// Material Design Icon where Material has none. The exceptions are the table
// glyphs neither has, each redrawn from the symbol nearest it: in
// `src/table.ts` the three cell alignments, from `position_top_right`; in
// `src/table-format.ts` the two diagonal borders, from `border_clear`. An icon
// drawn at the wrong angle takes an entry that turns it.
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
// older Material Icons style, a little heavier than the symbols. The generator refuses a Brand / Logo one, which isn't licensed under Apache
// 2.0 as the rest are, and a deprecated one, which a later major release drops.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../src/icons.ts");

// --- knobs -----------------------------------------------------------------
const COMMIT = "bd8cb85bd4bad964fe6918f79665bb40c3a8efef"; // 2026-09-25
const STYLE = "materialsymbolsoutlined";
const OPSZ = 20;
const MDI_COMMIT = "9e04201d4557e729822fb57f62a316c3dea1d4a8"; // v7.4.47, 2023-12-26
// ---------------------------------------------------------------------------

/**
 * Exported constant -> Material Symbol name, or `{ symbol, rotate, note }` for
 * one turned `rotate` degrees clockwise, `note` saying how and why in its doc
 * comment. `{ mdi, rotate, note }` names a Material Design Icon instead, as
 * its library spells it (`table-row-remove`).
 */
const ICONS = {
    // Ribbon tabs — on the strip, in its icon style
    ICON_TAB_IMAGE: "image",
    ICON_TAB_OBJECT: "deployed_code",
    ICON_TAB_PAGE: "draft",
    ICON_TAB_SHAPE: "shapes",
    ICON_TAB_SLIDE: "text_ad",
    ICON_TAB_TABLE: { mdi: "table" },
    ICON_TAB_TEXT: "text_fields",
    ICON_TAB_CELL: "grid_on",

    ICON_WRAP_TEXT: "wrap_text",
    ICON_NUMBER_FORMAT: "123",
    ICON_DECIMAL_INCREASE: "decimal_increase",
    ICON_DECIMAL_DECREASE: "decimal_decrease",
    ICON_CLEAR_FORMAT: "format_clear",

    // View tab
    ICON_RULER: "straighten",

    // A deck's Slide tab
    ICON_CHANGE_LAYOUT: "team_dashboard",
    ICON_INSERT_IMAGE: { mdi: "image-plus-outline" },
    ICON_SHAPES: "shapes",

    // Shape tab
    ICON_CHANGE_SHAPE: "shape_line",

    // An image's Home tab
    ICON_CROP: "crop",
    ICON_IMAGE_SIZE: "photo_size_select_large",
    ICON_ASPECT_RATIO: "aspect_ratio",

    // The page rail
    ICON_MOVE_UP: "move_up",
    ICON_MOVE_DOWN: "move_down",
    ICON_PAGE_RESIZE: {
        symbol: "aspect_ratio",
        rotate: 90,
        note: "turned a quarter clockwise: upright, as a page is",
    },

    // An image's crop mode
    ICON_CROP_RESET: "crop_free",

    // Text tab
    ICON_PARAGRAPH_STYLE: "style",
    ICON_FONTS: "font_download",
    ICON_FONT_SIZE: "format_size",
    ICON_BOLD: "format_bold",
    ICON_ITALIC: "format_italic",
    ICON_UNDERLINE: "format_underlined",
    ICON_STRIKETHROUGH: "format_strikethrough",
    ICON_SUPERSCRIPT: "superscript",
    ICON_SUBSCRIPT: "subscript",
    ICON_WIDTH_SCALE: "format_letter_spacing_2",
    ICON_TEXT_FILL: "format_color_text",
    ICON_PARAGRAPH_LEFT: "format_align_left",
    ICON_PARAGRAPH_CENTER: "format_align_center",
    ICON_PARAGRAPH_RIGHT: "format_align_right",
    ICON_PARAGRAPH_JUSTIFY: "format_align_justify",
    ICON_INDENT_DECREASE: "format_indent_decrease",
    ICON_INDENT_INCREASE: "format_indent_increase",
    ICON_LINE_SPACING: "format_line_spacing",
    ICON_LIST_BULLET: "format_list_bulleted",
    ICON_LIST_NUMBER: "format_list_numbered",

    // Arrange
    ICON_BRING_TO_FRONT: { mdi: "arrange-bring-to-front" },
    ICON_BRING_FORWARD: { mdi: "arrange-bring-forward" },
    ICON_SEND_BACKWARD: { mdi: "arrange-send-backward" },
    ICON_SEND_TO_BACK: { mdi: "arrange-send-to-back" },
    ICON_ALIGN_LEFT: "align_horizontal_left",
    ICON_ALIGN_CENTER_H: "align_horizontal_center",
    ICON_ALIGN_RIGHT: "align_horizontal_right",
    ICON_ALIGN_TOP: "align_vertical_top",
    ICON_ALIGN_MIDDLE_V: "align_vertical_center",
    ICON_ALIGN_BOTTOM: "align_vertical_bottom",
    ICON_DISTRIBUTE_H: "horizontal_distribute",
    ICON_DISTRIBUTE_V: "vertical_distribute",
    ICON_FLIP: "flip",
    ICON_GROUP: { mdi: "group" },
    ICON_UNGROUP: { mdi: "ungroup" },

    // Clipboard
    ICON_CUT: "content_cut",
    ICON_PASTE: "content_paste",

    // Table — Material Design Icons, as the header comment says
    ICON_INSERT_TABLE: { mdi: "table-plus" },
    ICON_SELECT_ROWS: { mdi: "table-row" },
    ICON_SELECT_COLUMNS: { mdi: "table-column" },
    ICON_SELECT_TABLE: { mdi: "table" },
    ICON_INSERT_ROW_ABOVE: { mdi: "table-row-plus-before" },
    ICON_INSERT_ROW_BELOW: { mdi: "table-row-plus-after" },
    ICON_INSERT_COLUMN_LEFT: { mdi: "table-column-plus-before" },
    ICON_INSERT_COLUMN_RIGHT: { mdi: "table-column-plus-after" },
    ICON_DELETE_ROWS: { mdi: "table-row-remove" },
    ICON_DELETE_COLUMNS: { mdi: "table-column-remove" },
    ICON_DELETE_TABLE: { mdi: "table-remove" },
    ICON_MERGE_CELLS: { mdi: "table-merge-cells" },
    ICON_UNMERGE_CELLS: { mdi: "table-split-cell" },
    ICON_TABLE_STYLE: { mdi: "table-headers-eye" },
    ICON_TABLE_PROPERTIES: { mdi: "table-cog" },
    // The table's borders and text directions, which stay Material Symbols
    ICON_BORDER_ALL: "border_all",
    ICON_BORDER_OUTSIDE: "border_outer",
    ICON_BORDER_INSIDE: "border_inner",
    ICON_BORDER_TOP: "border_top",
    ICON_BORDER_BOTTOM: "border_bottom",
    ICON_BORDER_LEFT: "border_left",
    ICON_BORDER_RIGHT: "border_right",
    ICON_BORDER_INSIDE_HORIZONTAL: "border_horizontal",
    ICON_BORDER_INSIDE_VERTICAL: "border_vertical",
    ICON_BORDER_NONE: "border_clear",
    ICON_BORDER_COLOR: "border_color",
    ICON_TEXT_HORIZONTAL: "text_rotation_none",
    ICON_TEXT_ROTATE_90: "text_rotation_down",
    ICON_TEXT_ROTATE_270: "text_rotate_up",
    ICON_TEXT_STACKED: "text_rotate_vertical",

    // A word document's floating drawing, selected: its anchor, and the lock
    // on one that stays in its paragraph
    ICON_OBJECT_ANCHOR: "anchor",
    ICON_OBJECT_ANCHOR_LOCK: "lock",
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

// Turn an icon about the centre of its viewBox. It holds one path, or the rest
// would stay as they are: stop rather than draw that.
function rotated(svg, degrees) {
    const [x, y, width, height] = /viewBox="([^"]+)"/
        .exec(svg)[1]
        .split(/[\s,]+/)
        .map(Number);
    const [head, ...paths] = svg.split("<path ");
    if (paths.length !== 1) throw new Error(`can't rotate an icon of ${paths.length} paths: ${svg}`);
    return `${head}<path transform="rotate(${degrees} ${x + width / 2} ${y + height / 2})" ${paths[0]}`;
}

const entries = Object.entries(ICONS).map(([constant, icon]) => {
    const entry = typeof icon === "string" ? { symbol: icon } : icon;
    if (!entry.symbol === !entry.mdi) throw new Error(`${constant}: name a \`symbol\` or an \`mdi\` icon`);
    return entry.mdi
        ? { constant, ...entry, url: mdiUrl(`svg/${entry.mdi}.svg`), doc: `Material Design Icons' \`${entry.mdi}\`` }
        : { constant, ...entry, url: symbolUrl(entry.symbol), doc: `\`${entry.symbol}\`` };
});
const mdiNames = [...new Set(entries.filter((entry) => entry.mdi).map((entry) => entry.mdi))];
await checkMdi(mdiNames);
const urls = [...new Set(entries.map((entry) => entry.url))];
const svgs = new Map(await Promise.all(urls.map(async (url) => [url, await fetchSvg(url)])));

const rows = entries
    .map(({ constant, url, doc, rotate, note }) => {
        const svg = svgs.get(url);
        return `/** ${note ? `${doc}, ${note}.` : doc} */\nexport const ${constant} = \`${rotate ? rotated(svg, rotate) : svg}\`;`;
    })
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
