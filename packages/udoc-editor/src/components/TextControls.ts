// The Text tab's controls: the font picker, the point-size field, the character
// toggles and the two list split buttons. Each *mirrors* the selection's
// resolved format — what the selected text actually carries, pushed from the
// engine's selection properties into edit mode's state — rather than its own
// click-state; a click fires the edit, and the control's look follows when the
// resulting selection report lands.
import type { FontFamilySummary } from "@docmentis/udoc-wasm";
import { createButton, createSplitButton } from "@docmentis/udoc-ui/internal";
import type { RibbonControl, RibbonControlEnv, TextFormatState } from "@docmentis/udoc-ui/internal";
import { cssFontFamily, isEngineDrawn } from "../fonts/preview.js";
import type { FontPreviewLoader } from "../fonts/preview.js";
import { editState } from "../state.js";
import { listStyles } from "../text-format.js";
import type { ListKind, ListStyle, TextFormatProperty } from "../text-format.js";
import type { EditTools } from "../tools.js";
import { createComboBox } from "./ComboBox.js";
import type { ComboBox } from "./ComboBox.js";

/** The point sizes the Text tab's size dropdown offers — the common Office set.
 *  The selection's own size still shows on the trigger even when it isn't one of
 *  these (a document can carry any size); the list is just the quick picks. */
const SIZE_PRESETS: readonly number[] = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 60, 72];

// Font dropdown virtualization knobs. FONT_ROW_H must match the fixed
// `.udoc-font-item` height in styles.ts; FONT_MENU_ROWS is how many rows
// the menu's (height-capped) max-height shows. The number of selectable
// fonts is unbounded — the list scrolls the whole catalog.
const FONT_ROW_H = 30;
const FONT_MENU_ROWS = 10;
const FONT_OVERSCAN = 4;

/** The em an engine-drawn specimen is rasterized at, in CSS px — matched to the
 *  row's own text size so a masked row and a live-text row read at the same
 *  weight beside each other. */
export const FONT_SPECIMEN_EM = 14;

/** A text-format toggle's `aria-pressed` for the tri-state selection format —
 *  `"mixed"` for a split selection, else the plain boolean string. The active
 *  tint lights for both `"on"` and `"mixed"` (the format is present); the aria
 *  value is what distinguishes them for assistive tech. */
function textFormatAria(state: TextFormatState): string {
    return state === "on" ? "true" : state === "mixed" ? "mixed" : "false";
}

/**
 * Whether a family answers what has been typed into the font box.
 *
 * **Prefix, not substring.** Across ~2000 families a match anywhere in the name
 * buries what you meant: `ar` used to return 227 rows — Akshar, Almarai and
 * Amaranth ahead of Arimo — where it now returns 31, and `oto` matched Roboto
 * without you having typed its start. Type-ahead is for a name you already know,
 * so the match has to begin where the name does.
 *
 * Every **word** is a starting point, not just the first, because a family's
 * distinguishing word is often not the one it leads with — `sans` has to keep
 * finding Open Sans, Noto Sans and PT Sans, and `mono` Roboto Mono. That is
 * still a prefix rule: it drops the mid-word matches and keeps the ones a reader
 * would call "starts with".
 *
 * Splitting on spaces is exhaustive for this catalog — every name in it is
 * letters, digits and spaces, with no hyphens or punctuation to miss.
 */
function matchesFontQuery(name: string, query: string): boolean {
    const lower = name.toLowerCase();
    return lower.startsWith(query) || lower.split(" ").some((word) => word.startsWith(query));
}

/**
 * Put a font-picker row's family into its label — as its own typeface where we
 * can, and as plain text where we can't yet.
 *
 * Three states, and the row is legible in all of them. A family the browser can
 * load is **live text** with `font-family` set to it: the name shows in the UI
 * face until the web font arrives and in its own from then on, with no work here
 * to make the swap happen. A family only the engine can draw shows the plain
 * name until its specimen lands, then the mask replaces it. A specimen the
 * engine had nothing to draw for stays plain text, which is exactly what the
 * picker looked like before specimens existed.
 *
 * The engine specimen is a `background: currentColor` box with the PNG as its
 * mask, so it takes the row's text color: the hovered row, the dark theme and
 * the forced-colors mode all come out right without a second raster. `width`
 * and `height` are the CSS box the engine sized it for, and `bleed` the
 * transparent margin inside it that a negative offset takes back out.
 */
function fillFontLabel(label: HTMLElement, family: FontFamilySummary, loader: FontPreviewLoader): void {
    const specimen = isEngineDrawn(family.sourceType) ? loader.specimen(family.name) : undefined;
    if (specimen) {
        const ink = document.createElement("span");
        ink.className = "udoc-font-specimen";
        ink.style.setProperty("--udoc-font-specimen", `url("${specimen.url}")`);
        ink.style.width = `${specimen.width}px`;
        ink.style.height = `${specimen.height}px`;
        // Pull the raster back by its bleed so the specimen's pen origin lands
        // where a live-text row's does; without it every engine row sits an
        // eighth of an em right of its neighbours.
        ink.style.marginLeft = `${-specimen.bleed}px`;
        label.replaceChildren(ink);
        return;
    }
    label.textContent = family.name;
    // An engine-drawn family keeps the UI face while it waits: naming it to CSS
    // would let a same-named OS font answer for a face the document isn't using.
    if (!isEngineDrawn(family.sourceType)) label.style.fontFamily = cssFontFamily(family.name);
}

// Reflect a value in a combobox's input. Skipped while the input is focused so
// it never stomps a value the user is typing (the incoming selection report
// re-mirrors on blur).
//
// A font name shows in the UI font, not its own typeface. We deliberately don't
// preview: the engine shapes font formats the browser can't load as web fonts
// (Type1, ...), and bundled / embedded faces never reach the DOM at all — an
// honest name beats a preview that only works for the subset a `font-family`
// CSS lookup happens to resolve.
function mirrorField(field: HTMLInputElement, value: string): void {
    if (field === document.activeElement) return;
    field.value = value;
}

// Commit a typed value on Enter, abandon it on Escape / blur (the mirror then
// restores the selection's value), open the list on ArrowDown, and keep the
// caret-movement keys for in-field editing — stopping them from reaching the
// ribbon's roving handler, which would otherwise jump focus to an adjacent
// tool. `mirror` re-reads the live selection each blur.
function wireComboInput(combo: ComboBox, commit: (raw: string) => void, mirror: () => void): void {
    combo.input.addEventListener("keydown", (e) => {
        switch (e.key) {
            case "Enter":
                commit(combo.input.value);
                combo.input.blur();
                break;
            case "Escape":
                combo.input.blur();
                break;
            case "ArrowDown":
                e.preventDefault();
                combo.controller.open();
                break;
            case "ArrowLeft":
            case "ArrowRight":
            case "Home":
            case "End":
                e.stopPropagation();
                break;
        }
    });
    combo.input.addEventListener("focus", () => combo.input.select());
    combo.input.addEventListener("blur", mirror);
}

/**
 * The Text tab's font picker: a typeable combobox showing the *selection's*
 * resolved font. The list offers the catalog (opened full, virtualized), Enter
 * applies any name — one outside the list included — and, while the list is
 * open, typing filters it (the input doubles as a search field). The input
 * mirrors the selection; each render keeps it in sync.
 */
export function fontFamilyControl(env: RibbonControlEnv, id: string, tools: EditTools): RibbonControl {
    const { store, label } = env;
    const { i18n } = tools;
    const selectedFont = () => editState(store.getState()).selectionText.font;

    // Re-render the open font list. Set while a list is open, so a specimen
    // landing from the engine can put itself on screen; cleared on close, so a
    // late arrival for a closed list does nothing.
    let refreshFontMenu: (() => void) | null = null;
    const unlisten = tools.onSpecimens(() => refreshFontMenu?.());

    // Render the font combobox's list (a listbox) — one row per family name,
    // the current pick checked. Every listed family is pickable whether or not
    // its bytes are here yet: the engine shapes a still-downloading family in a
    // stand-in and re-shapes when it lands, so the row has no load state to
    // show. The catalog can run to ~2000 families, so the list is **filtered by
    // `query` and virtualized**: a full-height sizer the menu scrolls, with only
    // the visible rows (plus overscan) mounted, each absolutely positioned.
    //
    // The list is in **two sections**: the families already loaded, then a
    // divider, then the rest of the catalog. Both sections are filtered by the
    // same query, so a section can empty out and the divider goes with it. The
    // divider is a border on the first row below it rather than a row of its
    // own — a row of its own would have to carry a height through the virtual
    // list's index-to-offset arithmetic, and this needs nothing from it.
    const renderFontMenu = (dd: ComboBox, query: string, keepScroll = false): void => {
        const state = editState(store.getState());
        // A full rebuild replaces the scroll viewport, so where the list was has
        // to be carried across by hand. `keepScroll` marks the renders that are
        // *not* a new list — a specimen arriving mid-scroll — where jumping back
        // to the selection would yank the rows out from under the pointer.
        const wasAt = dd.menu.querySelector<HTMLElement>(".udoc-font-scroll")?.scrollTop ?? 0;
        const q = query.trim().toLowerCase();
        const matches = q
            ? state.fontFamilies.filter((family) => matchesFontQuery(family.name, q))
            : state.fontFamilies;
        // A Set because this runs over the whole ~2000-family list.
        const here = new Set(state.loadedFontFamilyNames);
        const loaded = matches.filter((family) => here.has(family.name));
        const rest = matches.filter((family) => !here.has(family.name));
        // Every match — the virtual list mounts only the visible rows, so the
        // whole (unfiltered) ~2000-family catalog scrolls just as cheaply.
        const shown = [...loaded, ...rest];
        // Where the second section starts, so its first row draws the divider.
        // -1 when either section is empty: nothing to divide.
        const dividerAt = loaded.length > 0 && rest.length > 0 ? loaded.length : -1;
        const selected = state.selectionText.font;

        dd.menu.classList.add("udoc-font-menu");
        dd.menu.innerHTML = "";
        if (shown.length === 0) {
            const empty = document.createElement("div");
            empty.className = "udoc-menu__empty";
            empty.textContent = i18n.t("ribbon.noMatchingFonts");
            dd.menu.appendChild(empty);
            return;
        }
        // The scroll viewport is a child of the panel, not the panel — the
        // panel's rounded corners have to clip the native scrollbar. See
        // udoc-font-scroll in styles.ts.
        const viewport = document.createElement("div");
        viewport.className = "udoc-font-scroll";
        const sizer = document.createElement("div");
        sizer.className = "udoc-font-sizer";
        sizer.style.height = `${shown.length * FONT_ROW_H}px`;
        viewport.appendChild(sizer);
        dd.menu.appendChild(viewport);

        // Mount only the rows in view (+ overscan); recycle on scroll.
        const loader = tools.fontPreviews;
        const renderWindow = (): void => {
            const scrollTop = viewport.scrollTop;
            const viewH = viewport.clientHeight || FONT_ROW_H * FONT_MENU_ROWS;
            const first = Math.max(0, Math.floor(scrollTop / FONT_ROW_H) - FONT_OVERSCAN);
            const last = Math.min(shown.length, Math.ceil((scrollTop + viewH) / FONT_ROW_H) + FONT_OVERSCAN);
            sizer.replaceChildren();
            for (let i = first; i < last; i++) {
                const family = shown[i]!;
                const name = family.name;
                const item = document.createElement("button");
                item.className =
                    i === dividerAt
                        ? "udoc-menu__item udoc-font-item udoc-font-item--section"
                        : "udoc-menu__item udoc-font-item";
                item.setAttribute("role", "option");
                // The label is the family drawn in its own face, so the row's
                // accessible name has to be stated rather than read off the text
                // — for an engine specimen there is no text to read.
                item.setAttribute("aria-label", name);
                item.title = name;
                item.style.top = `${i * FONT_ROW_H}px`;
                const isSelected = name === selected;
                item.classList.toggle("udoc-menu__item--selected", isSelected);
                item.setAttribute("aria-selected", String(isSelected));
                item.innerHTML = `<span class="udoc-menu__item-label"></span>`;
                fillFontLabel(item.lastElementChild as HTMLElement, family, loader);
                item.addEventListener("click", (e) => {
                    e.stopPropagation();
                    // The trigger mirrors the selection, so it updates when the
                    // resulting report lands.
                    void tools.text.fontFamilySelection(name);
                    dd.controller.close();
                });
                sizer.appendChild(item);
            }
            // Ask for the window's specimens once the rows are up, so the list
            // is on screen before any of this starts. Families already worked
            // on are skipped inside, which is what makes calling this on every
            // scroll step cheap.
            loader.request(shown.slice(first, last).map((f) => ({ family: f.name, sourceType: f.sourceType })));
        };
        viewport.onscroll = renderWindow;
        // On open (no filter), reveal the current selection; on a filter, top.
        const selectedIndex = q ? -1 : shown.findIndex((family) => family.name === selected);
        viewport.scrollTop = keepScroll
            ? wasAt
            : selectedIndex > 0
              ? Math.max(0, selectedIndex * FONT_ROW_H - (FONT_ROW_H * FONT_MENU_ROWS) / 2)
              : 0;
        renderWindow();
    };

    // What the open list is filtered by — deliberately *not* the input's value.
    // The input mirrors the selection, so on open it holds the font already
    // applied; filtering by that would narrow the list to the one row you
    // started from. It becomes a query only once typed into, and opening clears
    // it again.
    let fontQuery = "";
    const combo = createComboBox(
        { label, className: "udoc-font-select" },
        {
            menuLabel: label,
            onOpen: () => {
                fontQuery = "";
                // Held while the list is up so a specimen arriving from the
                // engine can put itself on screen (it lands a round trip after
                // the row was mounted).
                refreshFontMenu = () => renderFontMenu(combo, fontQuery, true);
                // Render from what the store already holds, then again when the
                // refreshed loaded set lands — rendering only on the reply would
                // blank the list for a round trip, and never re-rendering would
                // leave a font loaded since the last open below the divider.
                renderFontMenu(combo, fontQuery);
                void tools.refreshLoadedFontFamilies().then(() => {
                    if (combo.controller.isOpen) renderFontMenu(combo, fontQuery);
                });
            },
            onClose: () => {
                refreshFontMenu = null;
            },
        },
    );
    combo.input.dataset.command = id;
    mirrorField(combo.input, selectedFont());
    wireComboInput(
        combo,
        (raw) => {
            const name = raw.trim();
            if (name) void tools.text.fontFamilySelection(name);
        },
        () => mirrorField(combo.input, selectedFont()),
    );
    // Type-to-filter: narrow the open list as the user types (closed, typing
    // just edits the value the mirror will restore).
    combo.input.addEventListener("input", () => {
        if (!combo.controller.isOpen) return;
        fontQuery = combo.input.value;
        renderFontMenu(combo, fontQuery);
    });
    return {
        el: combo.el,
        sync: (state) => mirrorField(combo.input, editState(state).selectionText.font),
        close: () => combo.controller.close(),
        destroy: () => {
            unlisten();
            combo.destroy();
        },
    };
}

/**
 * The Text tab's size field: a typeable combobox showing the selection's
 * resolved point size, its list the preset sizes (rebuilt on open so the check
 * tracks the selection). Enter applies any point size in range — one outside
 * the presets included. Mirror-only like the font picker.
 */
export function fontSizeControl(env: RibbonControlEnv, id: string, tools: EditTools): RibbonControl {
    const { store, label } = env;
    const selectedSize = () => editState(store.getState()).selectionText.size;

    // Fill the list (a listbox) — one option per preset point size, the one
    // matching the selection marked selected. Like the font picker the input is
    // a mirror, so it updates when the resulting selection report lands, not on
    // the click.
    const fillSizes = (dd: ComboBox): void => {
        dd.menu.innerHTML = "";
        for (const size of SIZE_PRESETS) {
            const item = document.createElement("button");
            item.className = "udoc-menu__item udoc-size-item";
            item.setAttribute("role", "option");
            const selected = String(size) === selectedSize();
            item.classList.toggle("udoc-menu__item--selected", selected);
            item.setAttribute("aria-selected", String(selected));
            item.innerHTML = `<span class="udoc-menu__item-label">${size}</span>`;
            item.addEventListener("click", (e) => {
                e.stopPropagation();
                void tools.text.fontSizeSelection(size);
                dd.controller.close();
            });
            dd.menu.appendChild(item);
        }
    };

    const combo = createComboBox(
        { label, className: "udoc-size-select", inputMode: "decimal" },
        { menuLabel: label, onOpen: () => fillSizes(combo) },
    );
    combo.input.dataset.command = id;
    mirrorField(combo.input, selectedSize());
    wireComboInput(
        combo,
        (raw) => {
            const size = parseFloat(raw);
            // Office's point-size range; an out-of-range or non-numeric entry is
            // dropped and the mirror restores the real value.
            if (!isNaN(size) && size >= 1 && size <= 4000) void tools.text.fontSizeSelection(size);
        },
        () => mirrorField(combo.input, selectedSize()),
    );
    return {
        el: combo.el,
        sync: (state) => mirrorField(combo.input, editState(state).selectionText.size),
        close: () => combo.controller.close(),
        destroy: () => combo.destroy(),
    };
}

/**
 * A character toggle (Bold / Italic / Underline / …): an icon button
 * reflecting whether the selection carries that format (on / off / mixed). A
 * mixed / off selection turns the format on, a fully-on one turns it off (the
 * Office gesture).
 */
export function textFormatControl(
    env: RibbonControlEnv,
    command: { id: string; icon: string; property: TextFormatProperty },
    tools: EditTools,
): RibbonControl {
    const { property } = command;
    const btn = createButton({ icon: command.icon, label: env.label });
    btn.dataset.command = command.id;
    const sync = (state: ReturnType<typeof env.store.getState>): void => {
        const format = editState(state).selectionText[property];
        btn.classList.toggle("udoc-btn--selected", format !== "off");
        btn.setAttribute("aria-pressed", textFormatAria(format));
    };
    sync(env.store.getState());
    btn.addEventListener("click", () => {
        void tools.text.formatTextSelection(property, editState(env.store.getState()).selectionText[property] !== "on");
    });
    return { el: btn, sync };
}

/**
 * A Bullets / Numbering split button: the main region toggles the selection's
 * paragraphs into the last-picked style (or out of the list when it's already
 * lit), the caret opens the style gallery. A mirror like the character toggles
 * — the lit state re-derives from the selection each render, not from the click.
 */
export function listControl(
    env: RibbonControlEnv,
    command: { id: string; icon: string; list: ListKind },
    tools: EditTools,
): RibbonControl {
    const { i18n, lastListStyle } = tools;
    const { list } = command;
    const listed = () => editState(env.store.getState()).selectionText[list];

    // Fill the gallery — one row per marker style. No row is marked: the
    // selection reports only whether its paragraphs are in a list, not which
    // style, and the last pick the main region re-applies is not a value the
    // selection holds. The row's sample is the markers themselves ("1. 2. 3."),
    // not a glyph: the gallery's whole question is what the marker *looks
    // like*, which a drawn icon would only paraphrase. Picking applies the
    // style and remembers it for the main region; the button's lit state still
    // comes from the selection report that follows.
    const fillListStyles = (): void => {
        split.menu.innerHTML = "";
        for (const style of listStyles(list)) {
            const item = document.createElement("button");
            item.className = "udoc-menu__item udoc-list-item";
            item.setAttribute("role", "menuitem");
            const label = i18n.t(style.label);
            item.setAttribute("aria-label", label);
            item.title = label;
            item.innerHTML = `<span class="udoc-menu__item-label udoc-list-sample">${style.preview}</span>`;
            item.addEventListener("click", (e) => {
                e.stopPropagation();
                lastListStyle[list] = style;
                void tools.text.listSelection(style);
                split.controller.close();
            });
            split.menu.appendChild(item);
        }
    };

    const split = createSplitButton({
        mainLabel: env.label,
        mainIcon: command.icon,
        caretLabel: i18n.t("ribbon.listOptions", { label: env.label }),
        menuLabel: i18n.t("ribbon.listStyles", { label: env.label }),
        onOpen: fillListStyles,
    });
    split.main.dataset.command = command.id;
    split.caret.dataset.command = command.id;
    split.setActive(listed() !== "off");
    split.main.addEventListener("click", () => {
        // Lit means every touched paragraph is already in this kind of list, so
        // the button's job is to take them out; mixed and off both put them in
        // (the Office gesture, matching Bold).
        const on = listed() === "on";
        void tools.text.listSelection(on ? null : lastListStyle[list]);
    });
    return {
        el: split.el,
        // Both halves carry the command id (so each greys with it), but the lit
        // state belongs to the pair — set it on the wrapper they share.
        sync: (state) => {
            const format = editState(state).selectionText[list];
            split.el.classList.toggle("udoc-split--selected", format !== "off");
            split.main.setAttribute("aria-pressed", textFormatAria(format));
        },
        close: () => split.controller.close(),
        destroy: () => split.destroy(),
    };
}

/** The style each list button applies when its main region is clicked — the
 *  gallery's first entry until one is picked, that pick from then on (the
 *  split-button contract: the caret chooses, the main repeats). */
export function createLastListStyle(): Record<ListKind, ListStyle> {
    return { bulleted: listStyles("bulleted")[0]!, numbered: listStyles("numbered")[0]! };
}
