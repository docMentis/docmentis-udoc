// The CSS of edit mode's own chrome, laid after udoc-ui's sheet — so it reads
// udoc-ui's color roles and shares its root class.
//
// `css` is an identity tag (returns the template's raw text) so editor
// extensions light up CSS syntax highlighting + Prettier inside the backticks;
// it has no runtime effect.
const css = (strings: TemplateStringsArray, ...values: unknown[]): string => String.raw({ raw: strings }, ...values);

export const editorStyles = css`
    /* Mode switcher wrapper — leads the editing cluster, governs the commands to its
   right. The trigger + menu are the standard .udoc-btn--field dropdown. */
    .udoc-ui-root .udoc-mode-switch {
        display: flex;
        align-items: center;
    }

    /* Per-page action rail (udoc:page-actions): a vertical column — move
   up/down, rotate, more, delete — beside the page's right edge, top-aligned
   with the page. "More" opens the page popup to the rail's left. Constant
   CSS size — the edit shell pairs it with screen-fixed (px) page spacing so
   the side margin fits it at every zoom. */
    .udoc-ui-root .udoc-ui__page-actions {
        /* Hidden until its page is hovered (or its popup is open) — the canvas owns
       the hover detection (page-band hit test) and toggles the --peek class.
       Non-interactive while hidden so it never eats clicks aimed at the page. */
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.12s;
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1px;
        padding: 3px 1px;
        font:
            600 11px/1 system-ui,
            sans-serif;
        color: var(--udoc-color-on-surface);
        background: var(--udoc-color-surface-container-high);
        border: 1px solid var(--udoc-color-outline-variant);
        border-radius: 12px;
        user-select: none;
    }
    .udoc-ui-root .udoc-ui__page-actions--peek {
        pointer-events: auto;
        opacity: 1;
    }
    .udoc-ui-root .udoc-ui__page-actions-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 20px;
        padding: 0;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: var(--udoc-color-on-surface);
        cursor: pointer;
    }
    .udoc-ui-root .udoc-ui__page-actions-btn svg,
    .udoc-ui-root .udoc-ui__page-insert-btn svg {
        width: 14px;
        height: 14px;
    }
    .udoc-ui-root .udoc-ui__page-actions-btn:hover:not(:disabled) {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }
    .udoc-ui-root .udoc-ui__page-actions-btn:disabled {
        opacity: var(--udoc-state-disabled-opacity);
        cursor: default;
    }

    /* Insert-between-pages affordance (udoc:page-insert): an invisible strip
   filling each inter-page gap; hovering it reveals a divider line with a
   centered "+" button. The strip at gap i inserts before page i. */
    .udoc-ui-root .udoc-ui__page-insert {
        pointer-events: auto;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .udoc-ui-root .udoc-ui__page-insert-line {
        position: absolute;
        left: 0;
        right: 0;
        top: 50%;
        height: 2px;
        margin-top: -1px;
        border-radius: 1px;
        background: var(--udoc-color-primary);
        opacity: 0;
        transition: opacity 0.12s;
    }
    .udoc-ui-root .udoc-ui__page-insert-btn {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        padding: 0;
        border: 1px solid var(--udoc-color-outline-variant);
        border-radius: 13px;
        background: var(--udoc-color-surface-container-high);
        color: var(--udoc-color-on-surface);
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.12s;
    }
    .udoc-ui-root .udoc-ui__page-insert:hover .udoc-ui__page-insert-line,
    .udoc-ui-root .udoc-ui__page-insert:hover .udoc-ui__page-insert-btn,
    .udoc-ui-root .udoc-ui__page-insert-btn:focus-visible {
        opacity: 1;
    }
    .udoc-ui-root .udoc-ui__page-insert-btn:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }

    /* === Per-page settings dialog === */
    .udoc-ui-root .udoc-page-modal {
        position: absolute;
        inset: 0;
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .udoc-ui-root .udoc-page-modal__backdrop {
        position: absolute;
        inset: 0;
        background: var(--udoc-color-scrim);
    }

    .udoc-ui-root .udoc-page-modal__dialog {
        position: relative;
        z-index: 1;
        width: min(360px, calc(100% - 32px));
        max-height: calc(100% - 32px);
        overflow: auto;
        background: var(--udoc-color-surface-container-highest);
        border: 1px solid var(--udoc-color-outline-variant);
        border-radius: 8px;
        box-shadow: var(--udoc-elevation-4);
    }

    .udoc-ui-root .udoc-page-modal__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid var(--udoc-color-outline-variant);
    }

    .udoc-ui-root .udoc-page-modal__heading {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        color: var(--udoc-color-on-surface);
    }

    .udoc-ui-root .udoc-page-modal__close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: var(--udoc-color-on-surface-variant);
        cursor: pointer;
    }

    .udoc-ui-root .udoc-page-modal__close:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }

    .udoc-ui-root .udoc-page-modal__close svg {
        width: var(--udoc-btn-glyph);
        height: var(--udoc-btn-glyph);
    }

    .udoc-ui-root .udoc-page-modal__body {
        padding: 14px 16px 4px;
    }

    .udoc-ui-root .udoc-page-modal__section-label {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--udoc-color-on-surface-variant);
        margin-bottom: 8px;
    }

    .udoc-ui-root .udoc-page-modal__section-label:not(:first-child) {
        margin-top: 18px;
    }

    .udoc-ui-root .udoc-page-modal__select {
        width: 100%;
        height: 32px;
        padding: 0 8px;
        border: 1px solid var(--udoc-color-outline);
        border-radius: 6px;
        background: transparent;
        color: var(--udoc-color-on-surface);
        font-size: 13px;
        cursor: pointer;
    }

    .udoc-ui-root .udoc-page-modal__dims {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        margin-top: 10px;
    }

    .udoc-ui-root .udoc-page-modal__field {
        flex: 1 1 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
    }

    .udoc-ui-root .udoc-page-modal__field-label {
        font-size: 12px;
        color: var(--udoc-color-on-surface-variant);
    }

    .udoc-ui-root .udoc-page-modal__input {
        width: 100%;
        height: 32px;
        padding: 0 8px;
        border: 1px solid var(--udoc-color-outline);
        border-radius: 6px;
        background: transparent;
        color: var(--udoc-color-on-surface);
        font-size: 13px;
        font-variant-numeric: tabular-nums;
        box-sizing: border-box;
    }

    .udoc-ui-root .udoc-page-modal__input:focus,
    .udoc-ui-root .udoc-page-modal__select:focus {
        outline: none;
        border-color: var(--udoc-color-primary);
    }

    .udoc-ui-root .udoc-page-modal__unit {
        flex: 0 0 64px;
        width: 64px;
    }

    .udoc-ui-root .udoc-page-modal__orient {
        display: flex;
        gap: 8px;
        margin-top: 10px;
    }

    .udoc-ui-root .udoc-page-modal__orient-btn {
        flex: 1 1 0;
        height: 32px;
        border: 1px solid var(--udoc-color-outline-variant);
        border-radius: 6px;
        background: transparent;
        color: var(--udoc-color-on-surface-variant);
        font-size: 13px;
        cursor: pointer;
    }

    .udoc-ui-root .udoc-page-modal__orient-btn:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }

    .udoc-ui-root .udoc-page-modal__orient-btn--selected {
        border-color: var(--udoc-color-primary);
        color: var(--udoc-color-primary);
        background-color: var(--udoc-state-selected);
    }

    .udoc-ui-root .udoc-page-modal__rotate {
        display: flex;
        gap: 8px;
    }

    .udoc-ui-root .udoc-page-modal__rotate-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 32px;
        border: 1px solid var(--udoc-color-outline-variant);
        border-radius: 6px;
        background: transparent;
        color: var(--udoc-color-on-surface-variant);
        cursor: pointer;
    }

    .udoc-ui-root .udoc-page-modal__rotate-btn:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
        color: var(--udoc-color-on-surface);
    }

    .udoc-ui-root .udoc-page-modal__rotate-btn svg {
        width: var(--udoc-btn-glyph);
        height: var(--udoc-btn-glyph);
    }

    .udoc-ui-root .udoc-page-modal__footer {
        display: flex;
        justify-content: flex-end;
        padding: 14px 16px;
        border-top: 1px solid var(--udoc-color-outline-variant);
    }

    .udoc-ui-root .udoc-page-modal__apply {
        height: 34px;
        padding: 0 18px;
        border: none;
        border-radius: 6px;
        background: var(--udoc-color-primary);
        color: var(--udoc-color-on-primary);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
    }

    .udoc-ui-root .udoc-page-modal__apply:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }

    .udoc-ui-root .udoc-page-modal__apply:focus-visible {
        outline: 2px solid var(--udoc-color-primary);
        outline-offset: 2px;
    }

    /* --- New-Slide layout picker (NewSlideModal) --- */

    .udoc-ui-root .udoc-slide-picker {
        position: absolute;
        inset: 0;
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .udoc-ui-root .udoc-slide-picker__backdrop {
        position: absolute;
        inset: 0;
        background: var(--udoc-color-scrim);
    }

    .udoc-ui-root .udoc-slide-picker__dialog {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        width: min(760px, calc(100% - 32px));
        max-height: calc(100% - 48px);
        background: var(--udoc-color-surface-container-highest);
        border: 1px solid var(--udoc-color-outline-variant);
        border-radius: 8px;
        box-shadow: var(--udoc-elevation-4);
    }

    .udoc-ui-root .udoc-slide-picker__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid var(--udoc-color-outline-variant);
    }

    .udoc-ui-root .udoc-slide-picker__heading {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        color: var(--udoc-color-on-surface);
    }

    .udoc-ui-root .udoc-slide-picker__close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: var(--udoc-color-on-surface-variant);
        cursor: pointer;
    }

    .udoc-ui-root .udoc-slide-picker__close:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }

    .udoc-ui-root .udoc-slide-picker__close svg {
        width: var(--udoc-btn-glyph);
        height: var(--udoc-btn-glyph);
    }

    .udoc-ui-root .udoc-slide-picker__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 14px;
        padding: 16px;
        overflow: auto;
    }

    .udoc-ui-root .udoc-slide-picker__cell {
        display: block;
        padding: 4px;
        border: 1px solid var(--udoc-color-outline-variant);
        border-radius: 6px;
        background: var(--udoc-color-surface-container-high);
        cursor: pointer;
    }

    .udoc-ui-root .udoc-slide-picker__cell:hover {
        border-color: var(--udoc-color-primary);
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }

    .udoc-ui-root .udoc-slide-picker__cell:focus-visible {
        outline: 2px solid var(--udoc-color-primary);
        outline-offset: 1px;
    }

    .udoc-ui-root .udoc-slide-picker__canvas {
        display: block;
        width: 100%;
        height: auto;
        aspect-ratio: 16 / 9;
        border-radius: 3px;
        background: var(--udoc-color-surface);
        box-shadow: 0 0 0 1px var(--udoc-color-outline-variant) inset;
    }

    /* Combobox — a typeable field: an outlined wrapper holding a text <input> and a
   caret that opens the shared .udoc-menu listbox. The editable analogue of a
   dropdown button; the outline is the same field signal as .udoc-btn--field (a
   control that holds a value), and the wrapper carries it so both the input and
   the caret sit inside one border. Used by the Text tab's font / size pickers so
   a value outside the list can be typed. */
    .udoc-ui-root .udoc-combobox {
        position: relative;
        display: inline-flex;
        align-items: center;
        height: var(--udoc-btn-h);
        border: 1px solid var(--udoc-color-outline);
        border-radius: var(--udoc-btn-radius);
        background: transparent;
        box-sizing: border-box;
    }
    /* The border is the field's own signal (like .udoc-btn--field's hover) — it
   darkens on hover and while the input holds focus. */
    .udoc-ui-root .udoc-combobox:hover,
    .udoc-ui-root .udoc-combobox:focus-within {
        border-color: var(--udoc-color-on-surface-variant);
    }
    .udoc-ui-root .udoc-combobox__input {
        flex: 1 1 auto;
        /* min-width:0 lets the flex input shrink to the field width instead of
       forcing it wider (so a long font name scrolls within, not overflows). */
        min-width: 0;
        height: 100%;
        padding: 0 var(--udoc-btn-pad-x);
        border: none;
        border-radius: var(--udoc-btn-radius) 0 0 var(--udoc-btn-radius);
        background: transparent;
        color: var(--udoc-color-on-surface);
        font-size: var(--udoc-btn-font);
        text-align: left;
    }
    .udoc-ui-root .udoc-combobox__input:focus {
        outline: none;
    }
    /* The caret shares the button caret's 3│chevron│3 metrics and muted tint. */
    .udoc-ui-root .udoc-combobox__caret {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: none;
        height: 100%;
        padding: 0 var(--udoc-caret-pad-x);
        border: none;
        border-radius: 0 var(--udoc-btn-radius) var(--udoc-btn-radius) 0;
        background: transparent;
        color: var(--udoc-color-on-surface-variant);
        cursor: pointer;
    }
    .udoc-ui-root .udoc-combobox__caret > svg {
        width: var(--udoc-caret);
        height: var(--udoc-caret);
    }
    .udoc-ui-root .udoc-combobox__caret:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }
    /* Disabled field: the whole control dims, as a disabled button does, and the
   caret stops taking clicks so the list can't open. */
    .udoc-ui-root .udoc-combobox:has(.udoc-combobox__input:disabled) {
        opacity: var(--udoc-state-disabled-opacity);
    }
    .udoc-ui-root .udoc-combobox:has(.udoc-combobox__input:disabled) .udoc-combobox__caret {
        pointer-events: none;
    }

    /* Text tab's font picker — a fixed-width field so picking a different typeface
   doesn't shift the Bold / Italic buttons beside it. The value shows the family
   name in the UI font (no own-typeface preview — see mirrorFontField). */
    .udoc-ui-root .udoc-font-select {
        width: 116px;
    }

    /* Font picker rows: the name fills the row, cut short with an ellipsis. */
    .udoc-ui-root .udoc-font-item .udoc-menu__item-label {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }
    /* A specimen the browser can't draw itself — an embedded or bundled face,
   rasterized by the engine. The PNG carries the glyph coverage in its alpha and
   nothing in its color, so it goes on as a MASK over currentColor rather than as
   an image: the row then picks up the theme's text color, the hover color and
   the dark palette from the cascade, and one raster serves all of them.

   The box is set inline, in CSS px, to whatever the engine measured the line at
   (it is already rendered at the device pixel ratio behind that box), so the
   mask draws 1:1 and never has to be scaled to fit. */
    .udoc-ui-root .udoc-font-specimen {
        display: inline-block;
        vertical-align: middle;
        background: currentColor;
        -webkit-mask-image: var(--udoc-font-specimen);
        mask-image: var(--udoc-font-specimen);
        -webkit-mask-repeat: no-repeat;
        mask-repeat: no-repeat;
        -webkit-mask-size: 100% 100%;
        mask-size: 100% 100%;
    }
    /* Font picker — virtualized for the large catalog (~2000 families): a bounded
   scroll viewport holding a full-height sizer that only the visible rows float
   over (absolutely positioned, their top set in JS). The row height is fixed and
   must match FONT_ROW_H in Ribbon.ts. The width is explicit because the
   absolutely-positioned rows can't give the panel an intrinsic width — wide
   enough that most family names sit on one line before the ellipsis.

   The scrolling is one level in, on udoc-font-scroll, rather than on the panel
   itself. A native scrollbar is painted square into its element's padding box,
   which the panel's own 8px corner radius does not clip — so a panel that
   scrolled would show the scrollbar cutting straight across both right-hand
   curves. Scrolling a child instead lets the panel clip it: overflow hidden plus
   the radius rounds off everything inside, scrollbar included. The alternative,
   styling the scrollbar to keep clear of the corners, would also switch
   Chrome and Safari off their overlay scrollbars for this list. */
    .udoc-ui-root .udoc-menu.udoc-font-menu {
        width: 280px;
        overflow: hidden;
        /* The panel's usual top/bottom padding would inset the viewport inside it,
       holding the scrollbar short of both edges. The viewport takes the padding
       instead, so it fills the panel and the bar runs corner to corner. */
        padding: 0;
    }
    .udoc-ui-root .udoc-font-scroll {
        max-height: 320px;
        padding: var(--udoc-menu-pad-y) 0;
        overflow-y: auto;
        overflow-x: hidden;
    }
    /* The divider between the font list's two sections — the families already
   loaded, then the rest of the catalog. It rides on the first row
   of the second section rather than sitting in a row of its own, so the virtual
   list's fixed row height still describes every row.

   Three classes, because the flat .udoc-menu__item resets border to none and,
   at equal specificity, would win on order. */
    .udoc-ui-root .udoc-font-menu .udoc-font-item--section {
        border-top: 1px solid var(--udoc-color-outline-variant);
    }
    .udoc-ui-root .udoc-font-sizer {
        position: relative;
        width: 100%;
    }
    .udoc-ui-root .udoc-font-menu .udoc-font-item {
        position: absolute;
        left: 0;
        right: 0;
        height: 30px;
        box-sizing: border-box;
        padding-top: 0;
        padding-bottom: 0;
    }
    .udoc-ui-root .udoc-menu__empty {
        padding: 8px 14px;
        color: var(--udoc-color-on-surface-variant);
    }

    /* Text tab's size field — a narrow fixed-width combobox (a point size is short),
   so picking a different size doesn't shift the Bold / Italic buttons beside it. */
    .udoc-ui-root .udoc-size-select {
        width: 66px;
    }
    /* The sample IS the answer here — the markers as the list renders them — so it
   is set in the text face at the row's own size, tracked out enough that
   "1. 2. 3." reads as a sequence rather than one token. */
    .udoc-ui-root .udoc-list-sample {
        letter-spacing: 0.08em;
        color: var(--udoc-color-on-surface);
    }

    /* === Advanced Fill / Line options dialog === */
    .udoc-ui-root .udoc-paint-modal {
        position: absolute;
        inset: 0;
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .udoc-ui-root .udoc-paint-modal__backdrop {
        position: absolute;
        inset: 0;
        background: var(--udoc-color-scrim);
    }
    .udoc-ui-root .udoc-paint-modal__dialog {
        position: relative;
        z-index: 1;
        width: min(420px, calc(100% - 32px));
        max-height: calc(100% - 32px);
        overflow: auto;
        background: var(--udoc-color-surface-container-highest);
        border: 1px solid var(--udoc-color-outline-variant);
        border-radius: 8px;
        box-shadow: var(--udoc-elevation-4);
    }
    .udoc-ui-root .udoc-paint-modal__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid var(--udoc-color-outline-variant);
    }
    .udoc-ui-root .udoc-paint-modal__heading {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        color: var(--udoc-color-on-surface);
    }
    .udoc-ui-root .udoc-paint-modal__close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: var(--udoc-color-on-surface-variant);
        cursor: pointer;
    }
    .udoc-ui-root .udoc-paint-modal__close:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }
    .udoc-ui-root .udoc-paint-modal__close svg {
        width: var(--udoc-btn-glyph);
        height: var(--udoc-btn-glyph);
    }
    .udoc-ui-root .udoc-paint-modal__body {
        padding: 16px;
    }
    .udoc-ui-root .udoc-paint-modal__placeholder {
        margin: 0;
        padding: 24px 16px;
        text-align: center;
        color: var(--udoc-color-on-surface-variant);
        font-size: 13px;
        line-height: 1.5;
        border: 1px dashed var(--udoc-color-outline-variant);
        border-radius: 6px;
    }
    .udoc-ui-root .udoc-paint-modal__footer {
        display: flex;
        justify-content: flex-end;
        padding: 14px 16px;
        border-top: 1px solid var(--udoc-color-outline-variant);
    }
    .udoc-ui-root .udoc-paint-modal__done {
        height: 34px;
        padding: 0 18px;
        border: none;
        border-radius: 6px;
        background: var(--udoc-color-primary);
        color: var(--udoc-color-on-primary);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
    }
    .udoc-ui-root .udoc-paint-modal__done:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }
    .udoc-ui-root .udoc-paint-modal__done:focus-visible {
        outline: 2px solid var(--udoc-color-primary);
        outline-offset: 2px;
    }

    /* Rotation grip (a round handle floating above the top edge), shown only when a
   single object is selected. Projected each frame, carries no pointer events —
   edit mode's grips (grips.ts) hit-test it geometrically and start a rotate
   drag. Its stem is an SVG line in the outline layer (behind the handle
   squares). */
    .udoc-ui-root .udoc-ui__rotate-handle {
        position: absolute;
        top: 0;
        left: 0;
        width: 10px;
        height: 10px;
        box-sizing: border-box;
        background: #fff;
        border: 1.5px solid var(--udoc-canvas-selection);
        border-radius: 50%;
        will-change: transform;
    }
    .udoc-ui-root .udoc-ui__rotate-stem {
        stroke: var(--udoc-canvas-selection);
        stroke-width: 1.5px;
    }
    /* Geometry grip (the yellow diamond Office draws for a preset's adjust
   handles): reshapes the shape — a rounded rectangle's corner radius, an
   arrow's head — rather than resizing its box, so it is deliberately a
   different color and shape from the white resize squares. Drawn as a square
   rotated 45deg by the layer's transform (which also centers it), so it needs
   no border-radius of its own. Sits inside the box, where a miss would read as
   a move, so it is hit-tested before the box itself. Carries no pointer
   events, like the rest of the chrome. */
    .udoc-ui-root .udoc-ui__adjust-handle {
        position: absolute;
        top: 0;
        left: 0;
        width: 9px;
        height: 9px;
        box-sizing: border-box;
        background: #ffd34d;
        border: 1.5px solid #b8860b;
        will-change: transform;
    }

    /* The ruler's controls (ruler-controls.ts), in the layers over its strips:
   each margin's edge, and the indent markers and tab stops of the paragraph a
   caret is in. Each takes its own press, where the layer under them takes
   none; placed along the ruler each frame by left (or top) in CSS px. */
    .udoc-ui-root .udoc-ui__ruler-control {
        position: absolute;
        pointer-events: auto;
        touch-action: none;
    }
    /* A margin's edge: a strip a few px wide to grab, over the line the band's
   canvas draws at rest — with the fills it bounds, so the two meet without a
   seam. While dragged, the strip carries a line of its own down its middle,
   in the same soft outline as the ticks. */
    .udoc-ui-root .udoc-ui__ruler-edge--h {
        top: 0;
        bottom: 0;
        width: 7px;
        cursor: col-resize;
    }
    .udoc-ui-root .udoc-ui__ruler-edge--v {
        left: 0;
        right: 0;
        height: 7px;
        cursor: row-resize;
    }
    .udoc-ui-root .udoc-ui__ruler-edge::after {
        content: "";
        position: absolute;
        background: var(--udoc-color-outline-variant);
        display: none;
    }
    .udoc-ui-root .udoc-ui__ruler-control--dragging::after {
        display: block;
    }
    .udoc-ui-root .udoc-ui__ruler-edge--h::after {
        top: 0;
        bottom: 0;
        left: 3px;
        width: 1px;
    }
    .udoc-ui-root .udoc-ui__ruler-edge--v::after {
        left: 0;
        right: 0;
        top: 3px;
        height: 1px;
    }
    /* The dashed line a drag on a ruler control draws across the content pane
   at it, as Word's does — down from the horizontal ruler, across from the
   vertical — in the outline that reads over a page and the canvas alike. */
    .udoc-ui-root .udoc-ui__ruler-guide {
        position: absolute;
        pointer-events: none;
    }
    .udoc-ui-root .udoc-ui__ruler-guide--h {
        top: 0;
        bottom: 0;
        border-left: 1px dashed var(--udoc-color-outline);
    }
    .udoc-ui-root .udoc-ui__ruler-guide--v {
        left: 0;
        right: 0;
        border-top: 1px dashed var(--udoc-color-outline);
    }
    .udoc-ui-root .udoc-ui__ruler-marker svg {
        display: block;
        overflow: visible;
    }
    /* An indent marker: filled as the text area it stands on, outlined. Its box
   runs the ruler's depth, and takes a press only on the shape, so beside the
   hourglass's narrow waist one reaches the margin's edge under it. */
    .udoc-ui-root .udoc-ui__ruler-marker--indent {
        top: 0;
        pointer-events: none;
    }
    .udoc-ui-root .udoc-ui__ruler-marker--indent path {
        fill: var(--udoc-color-surface-container-highest);
        stroke: var(--udoc-color-outline);
        stroke-width: 1px;
        stroke-linejoin: round;
        pointer-events: visiblePainted;
    }
    /* A tab stop's mark, in the ruler's figures' ink. */
    .udoc-ui-root .udoc-ui__ruler-marker--tab path {
        fill: none;
        stroke: var(--udoc-color-on-surface-variant);
        stroke-width: 1px;
    }
    .udoc-ui-root .udoc-ui__ruler-marker--tab rect {
        fill: var(--udoc-color-on-surface-variant);
    }
`;
