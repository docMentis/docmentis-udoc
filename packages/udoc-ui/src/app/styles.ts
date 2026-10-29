// The shell's stylesheet. The document UI is a self-contained embedded
// component, so it ships its own CSS as a single string injected into a
// <style> on mount (see shell.ts), with an extension's own laid after it.
// Authored directly in TS — no .css source, no codegen, no build step beyond
// tsc.
//
// History: seeded once from the previous generation's udoc-viewer styles.css
// (renamed `udoc-viewer` -> `udoc-ui`) to share its look and feel, and owned
// here since — never synced in either direction. Hand-edit freely.
//
// `css` is an identity tag (returns the template's raw text) so an IDE's CSS
// syntax highlighting + Prettier light up inside the backticks; it has no
// runtime effect.
const css = (strings: TemplateStringsArray, ...values: unknown[]): string => String.raw({ raw: strings }, ...values);

export const uiStyles = css`
    /* ============================================================
   Color roles and component tokens — the defaults
   (docs/design/ui-color-system.md). Neutral and hand-set, one
   value per theme. Emitted at zero specificity so any host
   override on .udoc-ui-root wins, whatever the stylesheet order.
   ============================================================ */
    :where(.udoc-ui-root) {
        color-scheme: light dark;

        /* The surface ladder, darkest to lightest: a higher rung is lighter, in
       both themes (M3's dark-theme order). */
        --udoc-color-surface-container-lowest: #e0e0e0;
        --udoc-color-surface: #e6e6e6;
        --udoc-color-surface-container-low: #ececec;
        --udoc-color-surface-container: #f3f3f3;
        --udoc-color-surface-container-high: #f9f9f9;
        --udoc-color-surface-container-highest: #ffffff;

        --udoc-color-on-surface: #1f1f1f;
        --udoc-color-on-surface-variant: #5f5f5f;
        --udoc-color-outline: #7f7f7f;
        --udoc-color-outline-variant: #cccccc;
        --udoc-color-primary: #2b2b2b;
        --udoc-color-on-primary: #ffffff;
        --udoc-color-error: #c62828;
        --udoc-color-on-error: #ffffff;
        --udoc-color-inverse-surface: #2e2e2e;
        --udoc-color-inverse-on-surface: #f2f2f2;
        --udoc-color-scrim: rgba(0, 0, 0, 0.5);

        /* Region fills, each defaulting to its rung, so a host can set one region
       apart without a new role. Declared here only: the var() resolves on the
       root against whichever theme's roles are in force there. */
        --udoc-toolbar-background: var(--udoc-color-surface-container);
        --udoc-ribbon-background: var(--udoc-color-surface-container);
        --udoc-panel-background: var(--udoc-color-surface-container);
        --udoc-status-bar-background: var(--udoc-color-surface-container);
        --udoc-canvas-background: var(--udoc-color-surface);
        --udoc-canvas-guide-background: var(--udoc-color-surface-container);
        --udoc-canvas-scrollbar-background: var(--udoc-color-surface-container);

        /* Scrollbar thumb — on-surface at low alpha, not a role. */
        --udoc-scrollbar-thumb: color-mix(in srgb, var(--udoc-color-on-surface) 30%, transparent);
        --udoc-scrollbar-thumb-hover: color-mix(in srgb, var(--udoc-color-on-surface) 50%, transparent);

        /* Marks on the document — drawn over page content, so literal hues tuned
       for legibility there, never derived from a role. */
        --udoc-canvas-selection: rgb(0, 120, 215);
        --udoc-canvas-hover: #7c3aed;
        --udoc-canvas-marquee: #334155;
        --udoc-canvas-marquee-fill: rgba(71, 85, 105, 0.12);
        --udoc-canvas-marquee-crossing: #1d4ed8;
        --udoc-canvas-marquee-crossing-fill: rgba(37, 99, 235, 0.12);
        --udoc-canvas-marquee-enclose: #15803d;
        --udoc-canvas-marquee-enclose-fill: rgba(22, 163, 74, 0.12);
        --udoc-canvas-search: rgba(255, 235, 59, 0.35);
        --udoc-canvas-search-active: rgba(255, 152, 0, 0.5);

        /* States — four opacities. Hover and pressed are the control's own ink
       (currentColor, resolved where the overlay is painted) and go in
       background-image, over whatever fill sits in background-color. Selected
       is primary in that fill slot, so selected-and-hovered composes with no
       rule of its own. Disabled is the control dimming itself. */
        --udoc-state-hover-opacity: 6%;
        --udoc-state-pressed-opacity: 12%;
        --udoc-state-selected-opacity: 14%;
        --udoc-state-disabled-opacity: 38%;
        --udoc-state-hover: color-mix(in srgb, currentColor var(--udoc-state-hover-opacity), transparent);
        --udoc-state-pressed: color-mix(in srgb, currentColor var(--udoc-state-pressed-opacity), transparent);
        --udoc-state-selected: color-mix(
            in srgb,
            var(--udoc-color-primary) var(--udoc-state-selected-opacity),
            transparent
        );
    }

    :where(.udoc-ui-root.udoc-ui-dark) {
        --udoc-color-surface-container-lowest: #121212;
        --udoc-color-surface: #181818;
        --udoc-color-surface-container-low: #1e1e1e;
        --udoc-color-surface-container: #252525;
        --udoc-color-surface-container-high: #2c2c2c;
        --udoc-color-surface-container-highest: #333333;

        --udoc-color-on-surface: #e8e8e8;
        --udoc-color-on-surface-variant: #a8a8a8;
        --udoc-color-outline: #808080;
        --udoc-color-outline-variant: #444444;
        --udoc-color-primary: #e0e0e0;
        --udoc-color-on-primary: #1b1b1b;
        --udoc-color-error: #f28b82;
        --udoc-color-on-error: #5c1410;
        --udoc-color-inverse-surface: #e8e8e8;
        --udoc-color-inverse-on-surface: #1f1f1f;
        --udoc-color-scrim: rgba(0, 0, 0, 0.7);

        /* Marks on the document — brighter hues where they cross the dark canvas. */
        --udoc-canvas-marquee: #94a3b8;
        --udoc-canvas-marquee-fill: rgba(148, 163, 184, 0.16);
        --udoc-canvas-marquee-crossing: #60a5fa;
        --udoc-canvas-marquee-crossing-fill: rgba(96, 165, 250, 0.16);
        --udoc-canvas-marquee-enclose: #4ade80;
        --udoc-canvas-marquee-enclose-fill: rgba(74, 222, 128, 0.16);
        --udoc-canvas-search: rgba(255, 235, 59, 0.35);
        --udoc-canvas-search-active: rgba(255, 152, 0, 0.5);
    }

    .udoc-ui-root {
        /* Elevation ladder — offset + blur + color composites, outside the color
       roles (deeper variants under the dark block below). Named by LEVEL, not by
       component: a new surface picks the level it belongs on instead of coining
       a shadow of its own, which is how the ladder stays this short. Each level
       must stay distinguishable from its neighbours. Shadow and tone agree: a
       plane on surface-container casts none, one on -high casts level 2, one on
       -highest level 3 (menus) or 4 (dialogs). */
        --udoc-elevation-1: 0 1px 3px rgba(0, 0, 0, 0.1); /* barely lifted: thumbnail, skip link */
        --udoc-elevation-2: 0 2px 8px rgba(0, 0, 0, 0.15); /* sheets + floating chrome: page, floating toolbar */
        --udoc-elevation-3: 0 4px 16px rgba(0, 0, 0, 0.2); /* menus — above the chrome they open from */
        --udoc-elevation-4: 0 8px 32px rgba(0, 0, 0, 0.3); /* modal: dialogs */
        /* A drawer casts sideways, so it is not a rung on the ladder. Mirrored pair —
       one per edge it docks to; keep the two in step. */
        --udoc-elevation-drawer-start: 4px 0 20px rgba(0, 0, 0, 0.15);
        --udoc-elevation-drawer-end: -4px 0 20px rgba(0, 0, 0, 0.15);

        /* === Control metrics (theme-independent) ===
       Single source of truth for the button/menu family, so triggers,
       split buttons, and dropdowns can't drift apart. */
        --udoc-btn-h: 32px; /* every button + dropdown trigger */
        --udoc-btn-radius: 4px;
        --udoc-btn-glyph: 20px; /* THE icon size — always 20x20 on a control */
        --udoc-btn-pad-x: 6px; /* button = 6px + content + 6px */
        --udoc-caret-pad-x: 3px; /* caret = 3px + chevron + 3px (tighter than the button) */
        --udoc-btn-gap: 4px; /* icon <-> label internal spacing */
        --udoc-btn-font: 13px;
        --udoc-caret: 16px; /* the one chevron size (a chevron, not an icon) */
        --udoc-inline-glyph: 16px; /* an icon labelling text rather than acting */

        /* Floating menu panel shared by every dropdown / split / app menu. */
        --udoc-menu-radius: 8px;
        --udoc-menu-shadow: var(--udoc-elevation-3);
        --udoc-menu-min-width: 150px;
        --udoc-menu-gap: 4px; /* offset from the trigger */
        --udoc-menu-pad-y: 4px; /* panel top/bottom padding */
        --udoc-menu-item-pad: 8px 14px;

        /* The UI's own ink, so whatever sets none of its own — a thumbnail, a
       panel's text — never takes the host page's, and nor do the hover and
       pressed overlays, which are that ink (currentColor). */
        color: var(--udoc-color-on-surface);
        position: relative;
        display: flex;
        flex-direction: column;
        height: 100%;
        container-type: inline-size;
        container-name: udoc-ui;
        isolation: isolate;
    }

    .udoc-ui-root.udoc-ui-dark {
        /* Elevation ladder — deeper in dark, where a plane lifts less by tone. */
        --udoc-elevation-1: 0 1px 3px rgba(0, 0, 0, 0.3);
        --udoc-elevation-2: 0 2px 8px rgba(0, 0, 0, 0.4);
        --udoc-elevation-3: 0 4px 16px rgba(0, 0, 0, 0.5);
        --udoc-elevation-4: 0 8px 32px rgba(0, 0, 0, 0.6);
        --udoc-elevation-drawer-start: 4px 0 20px rgba(0, 0, 0, 0.4);
        --udoc-elevation-drawer-end: -4px 0 20px rgba(0, 0, 0, 0.4);
    }

    .udoc-ui-root .udoc-toolbar-slot {
        flex: 0 0 auto;
        position: relative;
        z-index: 11;
    }

    .udoc-ui-root .udoc-body-slot {
        flex: 1 1 auto;
        display: flex;
        overflow: hidden;
        /* The positioning context of what covers the body alone — the loading
       overlay, the small-screen drawers and their scrim — and a stacking
       context of its own, so their z-indexes stay under the header slots'
       dropdown menus, as the viewport slot's do. */
        position: relative;
        isolation: isolate;
    }

    .udoc-ui-root .udoc-left-panel-slot {
        flex: 0 0 auto;
    }

    .udoc-ui-root .udoc-right-panel-slot {
        flex: 0 0 auto;
    }

    .udoc-ui-root .udoc-viewport-slot {
        position: relative;
        flex: 1 1 auto;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        min-width: 0;
        /* Trap the viewport's own chrome (floating toolbar z30, selection overlays,
       page micro-controls) in a self-contained stacking context. Without this
       their z-indexes leak into the root context and paint above the header
       slots (toolbar z11 / ribbon z10), clipping any dropdown menu that opens
       down over the viewport at the viewport's top edge. */
        isolation: isolate;
    }

    /* Floating Toolbar */
    .udoc-ui-root .udoc-floating-toolbar {
        position: absolute;
        /* Over the slides, clear of a deck's notes pane under them. */
        bottom: calc(24px + var(--udoc-notes-height, 0px));
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 4px;
        height: 40px;
        padding: 0 6px;
        background: var(--udoc-color-surface-container-high);
        border-radius: 8px;
        box-shadow: var(--udoc-elevation-2);
        z-index: 30;
        transition: opacity 0.3s ease;
    }

    .udoc-ui-root .udoc-floating-toolbar--idle {
        opacity: 0;
        pointer-events: none;
    }

    /* Zoom Dropdown */
    .udoc-ui-root .udoc-zoom-dropdown {
        position: relative;
        height: 28px;
        display: flex;
        align-items: center;
    }

    /* The zoom field — an outlined field like .udoc-btn--field and the page input:
   an outline border and no container, so it reads the same on the floating bar,
   the top toolbar and the status bar without naming any of their planes. */
    .udoc-ui-root .udoc-zoom-dropdown__toggle {
        display: flex;
        align-items: center;
        gap: 0;
        height: 100%;
        border: 1px solid var(--udoc-color-outline);
        border-radius: 4px;
        background: transparent;
    }

    .udoc-ui-root .udoc-zoom-dropdown__toggle:focus-within {
        border-color: var(--udoc-color-on-surface-variant);
    }

    .udoc-ui-root .udoc-zoom-dropdown__input {
        /* Room for a percent as the locale writes it: 88,5 % and 1600 % alike. */
        width: 52px;
        padding: 2px 4px;
        border: none;
        border-radius: 4px 0 0 4px;
        background: transparent;
        color: var(--udoc-color-on-surface);
        font-size: 13px;
        text-align: center;
    }

    .udoc-ui-root .udoc-zoom-dropdown__input:focus {
        outline: none;
    }

    .udoc-ui-root .udoc-zoom-dropdown__chevron {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 100%;
        padding: 2px 2px;
        border: none;
        border-left: 1px solid var(--udoc-color-outline-variant);
        border-radius: 0 4px 4px 0;
        background: transparent;
        color: var(--udoc-color-on-surface-variant);
        cursor: pointer;
    }

    .udoc-ui-root .udoc-zoom-dropdown__chevron svg {
        width: var(--udoc-caret);
        height: var(--udoc-caret);
    }

    .udoc-ui-root .udoc-zoom-dropdown__chevron:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
        color: var(--udoc-color-on-surface-variant);
    }

    .udoc-ui-root .udoc-zoom-dropdown__chevron--open {
        background-image: linear-gradient(var(--udoc-state-pressed) 0 0);
    }

    .udoc-ui-root .udoc-zoom-dropdown__chevron svg {
        width: var(--udoc-caret);
        height: var(--udoc-caret);
    }

    /* Re-anchor the shared .udoc-menu panel above the trigger and centre it — the
   zoom field sits at the foot of the viewport, so its menu opens upward. Surface,
   border, radius and shadow all come from .udoc-menu; only the anchor is ours,
   and top:auto undoes .udoc-menu's downward one. Matched on both classes so it
   outranks .udoc-menu (which is declared later in this file) rather than relying
   on order — the --top / toolbar-center rules below then re-flip it downward. */
    .udoc-ui-root .udoc-menu.udoc-zoom-dropdown__menu {
        top: auto;
        bottom: calc(100% + 8px);
        left: 50%;
        transform: translateX(-50%);
        min-width: 120px;
    }

    .udoc-ui-root .udoc-zoom-dropdown__section {
        display: flex;
        flex-direction: column;
    }

    .udoc-ui-root .udoc-zoom-dropdown__divider {
        height: 1px;
        background: var(--udoc-color-outline-variant);
        margin: 6px 0;
    }

    .udoc-ui-root .udoc-zoom-dropdown__item {
        display: block;
        width: 100%;
        padding: var(--udoc-menu-item-pad);
        border: none;
        background: transparent;
        color: var(--udoc-color-on-surface);
        font-size: var(--udoc-btn-font);
        text-align: left;
        cursor: pointer;
        white-space: nowrap;
    }

    .udoc-ui-root .udoc-zoom-dropdown__item:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }

    /* View Mode Menu */
    .udoc-ui-root .udoc-view-mode-menu {
        position: relative;
        height: 32px;
        display: flex;
        align-items: center;
    }

    /* A settings popover rather than a list of rows — sections of 32px icon buttons —
   so it keeps its own all-round padding where .udoc-menu insets rows vertically
   only. Everything else (surface, border, radius, shadow) is the shared panel's,
   which is also what finally gives this one the border it was missing. Matched on
   both classes for the same ordering reason as the zoom menu above. */
    .udoc-ui-root .udoc-menu.udoc-view-mode-menu__dropdown {
        top: auto;
        bottom: calc(100% + 8px);
        left: 0;
        padding: 8px;
        min-width: 160px;
    }

    .udoc-ui-root .udoc-view-mode-menu__section {
        margin-bottom: 8px;
    }

    .udoc-ui-root .udoc-view-mode-menu__section:last-child {
        margin-bottom: 0;
    }

    .udoc-ui-root .udoc-view-mode-menu__title {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--udoc-color-on-surface-variant);
        margin-bottom: 4px;
        padding: 0 4px;
    }

    .udoc-ui-root .udoc-view-mode-menu__options {
        display: flex;
        flex-wrap: wrap;
        gap: 2px;
    }

    .udoc-ui-root .udoc-view-mode-menu__option {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 0;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: var(--udoc-color-on-surface-variant);
        cursor: pointer;
    }

    .udoc-ui-root .udoc-view-mode-menu__option:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }

    /* A choice the icon set has no symbol for shows its name instead. */
    .udoc-ui-root .udoc-view-mode-menu__option--label {
        width: auto;
        min-width: 32px;
        padding: 0 8px;
        font: inherit;
        font-size: 12px;
        white-space: nowrap;
    }

    .udoc-ui-root .udoc-view-mode-menu__option--disabled {
        opacity: var(--udoc-state-disabled-opacity);
        cursor: default;
    }

    .udoc-ui-root .udoc-view-mode-menu__option--disabled:hover {
        background: transparent;
    }

    .udoc-ui-root .udoc-view-mode-menu__option-icon {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .udoc-ui-root .udoc-view-mode-menu__option-icon svg {
        width: var(--udoc-btn-glyph);
        height: var(--udoc-btn-glyph);
    }

    /* Left Panel */
    .udoc-ui-root .udoc-left-panel {
        position: relative;
        display: flex;
        width: 240px;
        height: 100%;
        background: var(--udoc-panel-background);
        border-right: 1px solid var(--udoc-color-outline-variant);
        overflow: hidden;
        transition: width 0.2s ease;
    }

    .udoc-ui-root .udoc-left-panel--closed {
        width: 0;
        border-right: none;
    }

    .udoc-ui-root .udoc-left-panel__tabs {
        display: flex;
        flex-direction: column;
        width: 40px;
        background: var(--udoc-panel-background);
        border-right: 1px solid var(--udoc-color-outline-variant);
    }

    .udoc-ui-root .udoc-left-panel__tab {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        padding: 0;
        border: none;
        background: transparent;
        color: var(--udoc-color-on-surface-variant);
        cursor: pointer;
    }

    .udoc-ui-root .udoc-left-panel__tab:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }

    /* Fill + ink + hover come from the shared selected rule; the indicator bar is
   this tab's own. */
    .udoc-ui-root .udoc-left-panel__tab--selected {
        border-right: 2px solid var(--udoc-color-primary);
    }

    .udoc-ui-root .udoc-left-panel__tab svg {
        width: var(--udoc-btn-glyph);
        height: var(--udoc-btn-glyph);
    }

    .udoc-ui-root .udoc-left-panel__content {
        flex: 1;
        overflow: hidden;
    }

    .udoc-ui-root .udoc-left-panel__resize-handle {
        position: absolute;
        right: 0;
        top: 0;
        width: 4px;
        height: 100%;
        cursor: col-resize;
        background: transparent;
        z-index: 10;
    }

    .udoc-ui-root .udoc-left-panel__resize-handle:hover,
    .udoc-ui-root .udoc-left-panel--resizing .udoc-left-panel__resize-handle {
        background: var(--udoc-state-selected);
    }

    .udoc-ui-root .udoc-left-panel--resizing {
        transition: none;
    }

    /* The Outline tab: a PDF's bookmarks as a tree. Ported by hand from the
   previous udoc-viewer's outline panel onto these tokens. */
    .udoc-ui-root .udoc-outline-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 8px 0;
    }

    .udoc-ui-root .udoc-outline-item {
        display: flex;
        flex-direction: column;
    }

    .udoc-ui-root .udoc-outline-item__header {
        display: flex;
        align-items: center;
        padding: 6px 12px 6px 8px;
        gap: 4px;
        min-height: 28px;
        outline: none;
    }

    .udoc-ui-root .udoc-outline-item__header:focus-visible {
        outline: 2px solid var(--udoc-color-primary);
        outline-offset: -2px;
    }

    .udoc-ui-root .udoc-outline-item__header--clickable {
        cursor: pointer;
    }

    .udoc-ui-root .udoc-outline-item__header--clickable:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }

    .udoc-ui-root .udoc-outline-item__toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        padding: 0;
        border: none;
        background: transparent;
        color: var(--udoc-color-on-surface-variant);
        cursor: pointer;
        flex-shrink: 0;
        transition: transform 0.15s ease;
    }

    .udoc-ui-root .udoc-outline-item__toggle svg {
        width: var(--udoc-caret);
        height: var(--udoc-caret);
    }

    .udoc-ui-root .udoc-outline-item__toggle:hover {
        color: var(--udoc-color-on-surface);
    }

    .udoc-ui-root .udoc-outline-item__toggle--expanded {
        transform: rotate(90deg);
    }

    .udoc-ui-root .udoc-outline-item__spacer {
        width: 16px;
        flex-shrink: 0;
    }

    .udoc-ui-root .udoc-outline-item__title {
        font-size: 13px;
        color: var(--udoc-color-on-surface);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
    }

    /* The Layers tab: a PDF's optional content groups as the default
   configuration's order nests them. Ported by hand from the previous
   udoc-viewer's layers panel onto these tokens, its rows shaped as the
   Outline's. */
    .udoc-ui-root .udoc-layers-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 8px 0;
    }

    .udoc-ui-root .udoc-layers-item {
        display: flex;
        flex-direction: column;
    }

    .udoc-ui-root .udoc-layers-item__header {
        display: flex;
        align-items: center;
        padding: 6px 12px 6px 8px;
        gap: 4px;
        min-height: 28px;
        cursor: pointer;
    }

    .udoc-ui-root .udoc-layers-item__header:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }

    .udoc-ui-root .udoc-layers-item__header--label,
    .udoc-ui-root .udoc-layers-item__header--locked {
        cursor: default;
    }

    .udoc-ui-root .udoc-layers-item__header--label:hover,
    .udoc-ui-root .udoc-layers-item__header--locked:hover {
        background: transparent;
    }

    .udoc-ui-root .udoc-layers-item__toggle,
    .udoc-ui-root .udoc-layers-item__switch {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: none;
        background: transparent;
        color: var(--udoc-color-on-surface-variant);
        cursor: pointer;
        flex-shrink: 0;
    }

    .udoc-ui-root .udoc-layers-item__toggle:focus-visible,
    .udoc-ui-root .udoc-layers-item__switch:focus-visible {
        outline: 2px solid var(--udoc-color-primary);
        outline-offset: 1px;
    }

    .udoc-ui-root .udoc-layers-item__toggle {
        width: 16px;
        height: 16px;
        transition: transform 0.15s ease;
    }

    .udoc-ui-root .udoc-layers-item__toggle svg {
        width: var(--udoc-caret);
        height: var(--udoc-caret);
    }

    .udoc-ui-root .udoc-layers-item__toggle:hover,
    .udoc-ui-root .udoc-layers-item__switch:hover {
        color: var(--udoc-color-on-surface);
    }

    .udoc-ui-root .udoc-layers-item__toggle--expanded {
        transform: rotate(90deg);
    }

    .udoc-ui-root .udoc-layers-item__spacer {
        width: 16px;
        flex-shrink: 0;
    }

    .udoc-ui-root .udoc-layers-item__switch {
        width: 20px;
        height: 20px;
        margin-right: 4px;
    }

    .udoc-ui-root .udoc-layers-item__switch svg {
        width: var(--udoc-btn-glyph);
        height: var(--udoc-btn-glyph);
    }

    .udoc-ui-root .udoc-layers-item__switch:disabled {
        cursor: default;
        opacity: 0.5;
    }

    .udoc-ui-root .udoc-layers-item__name {
        font-size: 13px;
        color: var(--udoc-color-on-surface);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
    }

    .udoc-ui-root .udoc-layers-item__header--label .udoc-layers-item__name {
        font-weight: 600;
        color: var(--udoc-color-on-surface-variant);
    }

    .udoc-ui-root .udoc-layers-item__header--off .udoc-layers-item__name {
        color: var(--udoc-color-on-surface-variant);
    }

    .udoc-ui-root .udoc-layers-item__lock {
        display: flex;
        width: 16px;
        height: 16px;
        flex-shrink: 0;
        color: var(--udoc-color-on-surface-variant);
    }

    .udoc-ui-root .udoc-layers-item__lock svg {
        width: var(--udoc-inline-glyph);
        height: var(--udoc-inline-glyph);
        margin: auto;
    }

    /* Thumbnail Panel — virtualized: a relative-positioned sizer with only the
   visible items absolutely positioned over it (their top/height set in JS). */
    .udoc-ui-root .udoc-thumbnail-panel {
        display: block;
        position: relative;
        padding: 0;
        height: 100%;
        overflow-y: auto;
        overflow-x: hidden;
        outline: none;
    }

    .udoc-ui-root .udoc-thumbnail-sizer {
        position: relative;
        width: 100%;
    }

    .udoc-ui-root .udoc-thumbnail-item {
        position: absolute;
        /* Full-width card, inset a constant amount from the strip edges (matches
       SIDE_PAD in ThumbnailPanel) so the edge gap never changes with panel
       width; the page fills the card minus this padding (matches CARD_PAD). */
        left: 12px;
        right: 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        margin: 0;
        padding: 12px;
        box-sizing: border-box;
        border-radius: 4px;
        cursor: pointer;
        background: transparent;
        outline: none;
        transition: background 0.15s ease;
    }

    .udoc-ui-root .udoc-thumbnail-item:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }

    /* The page shows through most of a card, so the hover tint alone is lost
   beside it: an unselected card under the pointer is ringed in outline too,
   the gray a selected card's primary ring stands apart from. */
    .udoc-ui-root .udoc-thumbnail-item:not(.udoc-thumbnail-item--selected):hover {
        outline: 2px solid var(--udoc-color-outline);
        outline-offset: -2px;
    }

    /* Fill + ink + hover come from the shared selected rule; the ring is this
   thumbnail's own — the page it marks is the navigator's whole point. The
   current page wears it, and so does each page picked outside view mode. */
    .udoc-ui-root .udoc-thumbnail-item--selected {
        outline: 2px solid var(--udoc-color-primary);
        outline-offset: -2px;
    }

    .udoc-ui-root .udoc-thumbnail-item__canvas {
        display: block;
        background: white;
        box-shadow: var(--udoc-elevation-1);
    }

    .udoc-ui-root .udoc-thumbnail-item__label {
        font-size: 11px;
        line-height: 1;
        color: var(--udoc-color-on-surface-variant);
        text-align: center;
    }

    .udoc-ui-root .udoc-thumbnail-item--selected .udoc-thumbnail-item__label {
        color: var(--udoc-color-on-surface);
        font-weight: 500;
    }

    /* A hidden slide, which the slide show skips: its page fades and its
   number is struck through. */
    .udoc-ui-root .udoc-thumbnail-item--hidden .udoc-thumbnail-item__canvas {
        opacity: 0.5;
    }

    .udoc-ui-root .udoc-thumbnail-item--hidden .udoc-thumbnail-item__label {
        text-decoration: line-through;
    }

    /* A deck section's header, above its slides: a toggle folding them away,
   its name, and how many it holds while folded. Placed like the cards
   (ThumbnailPanel's SECTION_H is its height). */
    .udoc-ui-root .udoc-thumbnail-section {
        position: absolute;
        left: 12px;
        right: 12px;
        height: 24px;
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 0 4px 0 0;
        box-sizing: border-box;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        color: var(--udoc-color-on-surface);
        cursor: pointer;
        user-select: none;
    }

    .udoc-ui-root .udoc-thumbnail-section:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }

    .udoc-ui-root .udoc-thumbnail-section__toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: none;
        width: 24px;
        height: 24px;
        padding: 0;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: var(--udoc-color-on-surface-variant);
        cursor: pointer;
    }

    .udoc-ui-root .udoc-thumbnail-section__toggle:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }

    .udoc-ui-root .udoc-thumbnail-section__toggle > svg {
        width: 16px;
        height: 16px;
    }

    .udoc-ui-root .udoc-thumbnail-section__name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .udoc-ui-root .udoc-thumbnail-section__count {
        flex: none;
        font-weight: 400;
        color: var(--udoc-color-on-surface-variant);
    }

    .udoc-ui-root .udoc-thumbnail-section__input {
        flex: 1;
        min-width: 0;
        height: 20px;
        padding: 0 4px;
        border: 1px solid var(--udoc-color-primary);
        border-radius: 3px;
        box-sizing: border-box;
        font: inherit;
        color: var(--udoc-color-on-surface);
        background: var(--udoc-color-surface-container-highest);
        outline: none;
        user-select: text;
        cursor: text;
    }
    /* The pages a drag is moving: lifted out of the strip, so their places
   fade, and the strip holds the grabbing hand wherever it goes. */
    .udoc-ui-root .udoc-thumbnail-item.udoc-dragging,
    .udoc-ui-root .udoc-thumbnail-section.udoc-dragging {
        opacity: 0.35;
    }

    .udoc-ui-root .udoc-thumbnail-panel--dragging,
    .udoc-ui-root .udoc-thumbnail-panel--dragging * {
        cursor: grabbing;
    }

    /* The lifted stack: the selected pages' thumbnails, or sections' headers,
   the pressed one on top and the rest fanned down and right behind it,
   following the pointer over the whole shell (ThumbnailPanel places it by its
   transform). It rises from the strip a little larger and tilted, on the
   menus' elevation. */
    .udoc-ui-root .udoc-thumbnail-ghost {
        position: absolute;
        left: 0;
        top: 0;
        z-index: 90;
        pointer-events: none;
        will-change: transform;
    }

    .udoc-ui-root .udoc-thumbnail-ghost__stack {
        position: relative;
        transform: rotate(-3deg) scale(1.04);
        transform-origin: top left;
        animation: udoc-thumbnail-lift 0.15s ease-out;
    }

    @keyframes udoc-thumbnail-lift {
        from {
            transform: none;
        }
    }

    .udoc-ui-root .udoc-thumbnail-ghost__card {
        position: absolute;
        left: 0;
        top: 0;
        display: block;
        background: white;
        border-radius: 2px;
        box-shadow: var(--udoc-elevation-3);
    }

    /* A lifted section is its header — name and slide count — on a card of the
   menus' plane. */
    .udoc-ui-root .udoc-thumbnail-ghost__section {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 0 8px;
        box-sizing: border-box;
        border-radius: 4px;
        background: var(--udoc-color-surface-container-highest);
        color: var(--udoc-color-on-surface);
        font-size: 12px;
        font-weight: 500;
    }

    /* The first card is in the flow, so the stack takes its size. */
    .udoc-ui-root .udoc-thumbnail-ghost__card:first-child {
        position: relative;
    }

    .udoc-ui-root .udoc-thumbnail-ghost__count {
        position: absolute;
        top: -8px;
        right: -8px;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        box-sizing: border-box;
        border-radius: 10px;
        background: var(--udoc-color-primary);
        color: var(--udoc-color-on-primary);
        font-size: 11px;
        font-weight: 600;
        line-height: 20px;
        text-align: center;
        box-shadow: var(--udoc-elevation-2);
    }

    /* Where a drag would drop the pages: a line across the gap, centred on the
   top ThumbnailPanel sets. */
    .udoc-ui-root .udoc-thumbnail-drop {
        position: absolute;
        left: 12px;
        right: 12px;
        height: 2px;
        transform: translateY(-50%);
        border-radius: 1px;
        background: var(--udoc-color-primary);
        pointer-events: none;
    }

    .udoc-ui-root .udoc-thumbnail-drop[hidden] {
        display: none;
    }

    .udoc-ui-root .udoc-toolbar {
        display: flex;
        align-items: center;
        gap: 4px;
        height: 40px;
        padding: 0 4px;
        background: var(--udoc-toolbar-background);
        border-bottom: 1px solid var(--udoc-color-outline-variant);
    }

    .udoc-ui-root .udoc-toolbar__left,
    .udoc-ui-root .udoc-toolbar__right {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .udoc-ui-root .udoc-toolbar__right {
        margin-left: auto;
    }

    /* Undo/redo history group in the top toolbar — trails the navigation group. */
    .udoc-ui-root .udoc-toolbar__history {
        display: flex;
        align-items: center;
        gap: 0;
    }

    /* ============================================================
   Shared control family — the one button / dropdown / split /
   menu system. Every control derives its metrics from the
   --udoc-btn-* / --udoc-menu-* tokens, so new controls match by
   construction instead of drifting. Built in TS by the factories
   in components/controls.ts.
   ============================================================ */

    /* Base button: ONE rule for every button — icon-only, labeled, dropdown
   trigger, split segment. 6px left/right padding on all of them. Internal
   spacing is NOT a flex gap (that would space the caret wrong); the icon and
   caret carry their own margins so a caret sits a full button-pad away — i.e.
   dropdown = button + caret, matching a split's main + caret exactly. */
    .udoc-ui-root .udoc-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: var(--udoc-btn-h);
        padding: 0 var(--udoc-btn-pad-x);
        border: none;
        border-radius: var(--udoc-btn-radius);
        background: transparent;
        color: var(--udoc-color-on-surface);
        font-size: var(--udoc-btn-font);
        white-space: nowrap;
        cursor: pointer;
        user-select: none;
        box-sizing: border-box;
    }
    .udoc-ui-root .udoc-btn:hover:not(:disabled) {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }
    .udoc-ui-root .udoc-btn:active:not(:disabled) {
        background-image: linear-gradient(var(--udoc-state-pressed) 0 0);
    }
    .udoc-ui-root .udoc-btn:disabled {
        opacity: var(--udoc-state-disabled-opacity);
        cursor: default;
    }
    /* Icon-only: just the glyph. The shared padding makes it a 32px square. */
    .udoc-ui-root .udoc-btn--icon > svg {
        width: var(--udoc-btn-glyph);
        height: var(--udoc-btn-glyph);
    }

    /* Button cluster — a related set of flat buttons butted together: the Text tab's
   Bold / Italic / Underline / Strikethrough toggles, its paragraph Align /
   Spacing / list controls, and the Text Color / Highlight and Fill / Line color
   dropdowns. These aren't one value, so the
   cluster is drawn with proximity, NOT a border: a box would say "one control,
   one value" and read as a field (see .udoc-btn--field), which is the one thing a
   border means here. The buttons butt together (gap 0) into one solid run, fenced
   by the divider the group boundary emits on each side. Each button keeps its own
   toggle (active) tint or color swatch; the 6px padding around every 20px glyph
   keeps the touching icons from crowding. */
    .udoc-ui-root .udoc-btn-group {
        display: inline-flex;
        align-items: center;
        gap: 0;
    }

    /* Labeled content: a leading icon is spaced from the label by the gap (this is
   the only spacing that lives *inside* the button). */
    .udoc-ui-root .udoc-btn__icon {
        display: inline-flex;
        align-items: center;
        margin-right: var(--udoc-btn-gap);
    }
    .udoc-ui-root .udoc-btn__icon > svg {
        width: var(--udoc-btn-glyph);
        height: var(--udoc-btn-glyph);
    }

    /* The one caret, everywhere — its own 3px unit (3 │ chevron │ 3). When a button
   carries a caret, the button drops its 6px right so the caret provides the
   edge, so the chevron sits 3px from the edge like a split button's caret. */
    .udoc-ui-root .udoc-btn--has-caret {
        padding-right: 0;
    }
    .udoc-ui-root .udoc-btn__caret {
        display: inline-flex;
        align-items: center;
        /* content → chevron spans one button-pad (6px): the main body's implicit
       3px seam (margin) + the caret's own 3px left pad — same gap as a split's
       seam (main's 3px right + caret's 3px left). */
        margin-left: var(--udoc-caret-pad-x);
        padding: 0 var(--udoc-caret-pad-x);
        color: var(--udoc-color-on-surface-variant);
    }
    .udoc-ui-root .udoc-btn__caret > svg {
        width: var(--udoc-caret);
        height: var(--udoc-caret);
    }

    /* Field variant: a bordered trigger (a mode switch). The border is the one
   signal that a control *holds a value* — it never groups buttons;
   the same border marks .udoc-toolbar__page-input, so every field reads as the
   same kind of thing.

   A field is an outline and no fill of its own, so it looks the same on every
   plane it sits on and inherits the base button's hover / pressed overlay
   untouched — only the border darkening below is the field's own, marking the
   hover as a field's rather than a button's. */
    .udoc-ui-root .udoc-btn--field {
        border: 1px solid var(--udoc-color-outline);
    }
    .udoc-ui-root .udoc-btn--field:hover:not(:disabled),
    .udoc-ui-root .udoc-btn--field:active:not(:disabled) {
        border-color: var(--udoc-color-on-surface-variant);
    }

    /* Split button: [ main | caret ] as one group. Each segment keeps the shared
   6px on its OUTER edge and drops it on the seam, so the whole control's
   left/right padding matches a plain button or a dropdown trigger. */
    .udoc-ui-root .udoc-split {
        position: relative;
        display: inline-flex;
        align-items: center;
        border-radius: var(--udoc-btn-radius);
    }
    /* Split = main + caret. The main keeps the shared 6px on its outer (left) edge
   but drops to one caret-pad (3px) on the seam; the caret is 3│chevron│3. Their
   abutting 3px paddings make the 6px between content and chevron — pixel-identical
   to a dropdown (button+caret); only the seam radius / hover split differs. */
    .udoc-ui-root .udoc-split__main {
        padding-right: var(--udoc-caret-pad-x);
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
    }
    .udoc-ui-root .udoc-split__caret {
        padding: 0 var(--udoc-caret-pad-x);
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
    }
    .udoc-ui-root .udoc-split__caret > svg {
        width: var(--udoc-caret);
        height: var(--udoc-caret);
        color: var(--udoc-color-on-surface-variant);
    }

    /* Paint swatch — a Fill / Line split button's main glyph: the channel glyph
   over a thin color bar. The Material paint glyphs (format_color_fill,
   border_color, format_color_text, format_ink_highlighter) carry a solid bar of
   their own in the bottom fifth, inset a tenth from each side; the glyph is
   clipped above it and the color bar takes its exact place. The bar's inset
   ring keeps a white/pale color visible against the toolbar. */
    .udoc-ui-root .udoc-paint {
        position: relative;
        display: inline-block;
        width: var(--udoc-btn-glyph);
        height: var(--udoc-btn-glyph);
    }
    .udoc-ui-root .udoc-paint > svg {
        display: block;
        width: 100%;
        height: 100%;
        clip-path: inset(0 0 20% 0);
    }
    .udoc-ui-root .udoc-paint__bar {
        position: absolute;
        left: 10%;
        right: 10%;
        bottom: 0;
        height: 20%;
        border-radius: 1px;
        background: var(--swatch-color, transparent);
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.18);
    }

    /* The Fill / Line "none" bar — a struck-through white bar signalling No Fill /
   No Line, in place of a solid color. */
    .udoc-ui-root .udoc-paint__bar--none {
        background:
            linear-gradient(
                to top right,
                transparent calc(50% - 0.6px),
                var(--udoc-color-error) calc(50% - 0.6px),
                var(--udoc-color-error) calc(50% + 0.6px),
                transparent calc(50% + 0.6px)
            ),
            var(--udoc-color-surface-container-highest);
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25);
    }

    /* The mirror's "mixed" bar — the selection's spans / objects carry different
   colors, so no single swatch: a muted multi-hue strip signals "several". */
    .udoc-ui-root .udoc-paint__bar--mixed {
        background: linear-gradient(90deg, #e5533d 0%, #e5b93d 33%, #46a35e 66%, #3d78e5 100%);
    }

    /* The mirror's "unknown" bar — no color info for this channel (a theme /
   gradient / pattern fill not yet reduced, or a doc type that doesn't report
   it): a faint neutral placeholder rather than a misleading color. */
    .udoc-ui-root .udoc-paint__bar--unknown {
        background: rgba(128, 128, 128, 0.18);
    }

    /* Paint panel — the Fill / Line dropdown body: labelled color grids over the
   shared menu rows (None, Weight / Dashes fly-outs, More…). Lives in a standard
   .udoc-menu, so rows keep the menu's own padding; only the grids and labels are
   inset to line up with a row's text. */
    .udoc-ui-root .udoc-paintpanel__label {
        padding: 7px 14px 3px;
        color: var(--udoc-color-on-surface-variant);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.02em;
    }
    .udoc-ui-root .udoc-paintpanel__grid {
        display: grid;
        gap: 3px;
        padding: 0 14px 3px;
    }
    .udoc-ui-root .udoc-paintpanel__cell {
        width: 17px;
        height: 17px;
        padding: 0;
        border: 1px solid rgba(0, 0, 0, 0.18);
        border-radius: 3px;
        background: var(--swatch-color, transparent);
        cursor: pointer;
    }
    .udoc-ui-root .udoc-paintpanel__cell:hover {
        outline: 1px solid var(--udoc-color-outline-variant);
        outline-offset: 1px;
    }
    .udoc-ui-root .udoc-paintpanel__cell--selected {
        outline: 2px solid var(--udoc-color-primary);
        outline-offset: 1px;
    }
    .udoc-ui-root .udoc-paintpanel__divider {
        margin: 5px 0;
        border-top: 1px solid var(--udoc-color-outline-variant);
    }
    /* Dropdown wrapper — positions its .udoc-menu panel against the trigger. */
    .udoc-ui-root .udoc-dropdown {
        position: relative;
        display: inline-flex;
        align-items: center;
    }

    /* Floating menu panel — one look for every dropdown / split / app menu. Sized
   to its widest row: the rows below never wrap, so the panel, absolutely
   positioned and shrink-to-fit, grows to hold the longest label on one line. */
    .udoc-ui-root .udoc-menu {
        position: absolute;
        top: calc(100% + var(--udoc-menu-gap));
        left: 0;
        min-width: var(--udoc-menu-min-width);
        padding: var(--udoc-menu-pad-y) 0;
        background: var(--udoc-color-surface-container-highest);
        border: 1px solid var(--udoc-color-outline-variant);
        border-radius: var(--udoc-menu-radius);
        box-shadow: var(--udoc-menu-shadow);
        z-index: 80;
    }
    /* Right-aligned panel (anchored to the trigger's right edge). */
    .udoc-ui-root .udoc-menu--end {
        left: auto;
        right: 0;
    }
    /* Canvas context menu — the same .udoc-menu panel, but placed at the pointer
   instead of hung under a trigger, so it drops the trigger-relative anchor and
   takes its left/top from the component (see ContextMenu.ts). It sits above the
   ribbon's dropdowns: a right-click closes them (the shared controller's mutual
   exclusion), but it also overhangs the canvas chrome — scrollbars, the page
   rail, the floating view controls — which it must never open behind. */
    .udoc-ui-root .udoc-context-menu {
        top: 0;
        left: 0;
        z-index: 90;
    }
    .udoc-ui-root .udoc-menu__item {
        display: flex;
        align-items: center;
        gap: var(--udoc-btn-gap);
        width: 100%;
        padding: var(--udoc-menu-item-pad);
        border: none;
        background: transparent;
        color: var(--udoc-color-on-surface);
        font-size: var(--udoc-btn-font);
        text-align: left;
        white-space: nowrap;
        cursor: pointer;
    }
    .udoc-ui-root .udoc-menu__item:hover:not(:disabled) {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }
    .udoc-ui-root .udoc-menu__item:disabled {
        opacity: var(--udoc-state-disabled-opacity);
        cursor: default;
    }
    /* Arrange / Align menu items — live in the shared .udoc-menu panel, but extend
   the standard item with a divider and a trailing on/off switch for checkable
   rows, so keep their own base rules (token-driven, matching .udoc-menu__item). */
    .udoc-ui-root .udoc-toolbar__menu-item {
        display: flex;
        align-items: center;
        gap: var(--udoc-btn-gap);
        width: 100%;
        padding: var(--udoc-menu-item-pad);
        border: none;
        background: transparent;
        color: var(--udoc-color-on-surface);
        font-size: var(--udoc-btn-font);
        text-align: left;
        white-space: nowrap;
        cursor: pointer;
    }
    .udoc-ui-root .udoc-toolbar__menu-item:hover:not(:disabled) {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }
    .udoc-ui-root .udoc-toolbar__menu-item:disabled {
        opacity: var(--udoc-state-disabled-opacity);
        cursor: default;
    }
    /* Selected — every control that can be selected, in one place. A selection
   persists with no pointer near it, so it sits in the fill slot
   (background-color): primary at the selected opacity, over whatever plane the
   control is on. Hover and pressed paint in background-image, over it, so a
   selected control keeps its fill under the pointer with no rule of its own. The
   ink is on-surface whatever the control's resting ink (a 14% tint keeps its
   contrast), so a muted control reads emphasized once selected.

   A control keeps only what is genuinely its own (the panel tab's indicator bar,
   the thumbnail's ring). Excludes the surface-plane tabs (ribbon / sheet) and the
   outlined orient toggle, which use other selection idioms. Sits after every
   per-control rule, so it wins on order over their transparent fills. */
    .udoc-ui-root
        :is(
            .udoc-zoom-dropdown__item--selected,
            .udoc-view-mode-menu__option--selected,
            .udoc-left-panel__tab--selected,
            .udoc-thumbnail-item--selected,
            .udoc-thumbnail-section--selected,
            .udoc-btn--selected,
            .udoc-split--selected,
            .udoc-paintpanel__none--selected,
            .udoc-menu__item--selected,
            .udoc-toolbar__menu-item--selected
        ) {
        background-color: var(--udoc-state-selected);
        color: var(--udoc-color-on-surface);
    }
    .udoc-ui-root .udoc-menu__item-icon {
        display: inline-flex;
        align-items: center;
    }
    .udoc-ui-root .udoc-menu__item-icon > svg {
        width: var(--udoc-btn-glyph);
        height: var(--udoc-btn-glyph);
    }

    /* Toolbar center section (inline controls when floating toolbar is hidden) */
    .udoc-ui-root .udoc-toolbar__center {
        display: flex;
        align-items: center;
        gap: 4px;
        flex: 1;
        justify-content: flex-start;
    }

    .udoc-ui-root .udoc-toolbar__group {
        display: flex;
        align-items: center;
        gap: 0;
    }

    .udoc-ui-root .udoc-toolbar__page-info {
        display: flex;
        align-items: center;
        font-size: 13px;
        color: var(--udoc-color-on-surface);
    }

    /* Outlined field — no container of its own, like .udoc-btn--field. */
    .udoc-ui-root .udoc-toolbar__page-input {
        width: 36px;
        height: 24px;
        border: 1px solid var(--udoc-color-outline);
        border-radius: 3px;
        text-align: center;
        font-size: 13px;
        padding: 0 2px;
        background: transparent;
        color: var(--udoc-color-on-surface);
    }

    .udoc-ui-root .udoc-toolbar__page-input:focus {
        outline: none;
        border-color: var(--udoc-color-on-surface-variant);
    }

    .udoc-ui-root .udoc-toolbar__page-total {
        font-size: 13px;
        color: var(--udoc-color-on-surface-variant);
        white-space: nowrap;
    }

    /* Zoom dropdown in toolbar: drops down instead of up */
    .udoc-ui-root .udoc-zoom-dropdown--toolbar .udoc-zoom-dropdown__menu {
        bottom: auto;
        top: calc(100% + 8px);
    }

    /* View mode menu in toolbar: drops down instead of up */
    .udoc-ui-root .udoc-toolbar__center .udoc-view-mode-menu__dropdown {
        bottom: auto;
        top: calc(100% + 8px);
    }

    /* ===== Ribbon (tool options bar) ===== */

    .udoc-ui-root .udoc-ribbon-slot {
        flex: 0 0 auto;
        position: relative;
        z-index: 10;
    }

    .udoc-ui-root .udoc-ribbon {
        display: flex;
        align-items: center;
        gap: 4px;
        height: 40px;
        padding: 0 4px;
        /* On the toolbar's rung by default (both region tokens default to
       surface-container): the ribbon reads as one continuous chrome band with
       it, not a separate raised layer. */
        background: var(--udoc-ribbon-background);
        border-bottom: 1px solid var(--udoc-color-outline-variant);
    }

    .udoc-ui-root .udoc-ribbon__tools {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    /* The More button, at the surface's trailing edge while the tools overrun it. */
    .udoc-ui-root .udoc-ribbon__more {
        margin-left: auto;
    }

    /* Its panel — a second toolbar of the tools that don't fit, hung under the
   button. Surface, border, radius, shadow and the right anchor are the shared
   .udoc-menu panel's; padded all round like a toolbar where .udoc-menu insets
   rows vertically only, and as wide as its tools on one row up to the
   surface's width (set inline by the ribbon), past which they wrap. Matched on
   both classes so it outranks .udoc-menu. */
    .udoc-ui-root .udoc-menu.udoc-ribbon__overflow {
        box-sizing: border-box;
        width: max-content;
        min-width: 0;
        padding: 4px;
    }

    .udoc-ui-root .udoc-ribbon__overflow-tools {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
    }

    /* A divider the cut leaves leading the panel fences off nothing. */
    .udoc-ui-root .udoc-ribbon__overflow-tools > .udoc-divider:first-child {
        display: none;
    }

    .udoc-ui-root .udoc-ribbon__undo {
        display: flex;
        align-items: center;
        gap: 2px;
    }

    /* Divider — the ONE hairline that separates control groups across the whole
   horizontal chrome: the ribbon's tool groups, the toolbar's docked view
   controls, and its history group. A single rule with one look everywhere (the
   chrome used to carry two divider variants at slightly different metrics —
   this is the consolidation). A short, faint 16px line, held off its neighbors
   by the 4px flex gap on each side plus its own 2px margin. Being an element
   (not a border) it collapses with display:none, so a hidden group — e.g. the
   toolbar's empty view-controls slot — takes its divider with it.
   Menu-internal separators are a separate, conventional job and keep their own
   rules. */
    .udoc-ui-root .udoc-divider {
        flex: none;
        align-self: center;
        width: 1px;
        height: 16px;
        margin: 0 2px;
        background: var(--udoc-color-outline-variant);
    }

    .udoc-ui-root .udoc-ribbon__options {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        overflow-x: auto;
    }

    /* Right Panel */
    .udoc-ui-root .udoc-right-panel {
        position: relative;
        display: flex;
        flex-direction: column;
        width: 300px;
        height: 100%;
        background: var(--udoc-panel-background);
        border-left: 1px solid var(--udoc-color-outline-variant);
        overflow: hidden;
        transition: width 0.2s ease;
    }

    .udoc-ui-root .udoc-right-panel--closed {
        width: 0;
        border-left: none;
    }

    .udoc-ui-root .udoc-right-panel__resize-handle {
        position: absolute;
        left: 0;
        top: 0;
        width: 4px;
        height: 100%;
        cursor: col-resize;
        background: transparent;
        z-index: 10;
    }

    .udoc-ui-root .udoc-right-panel__resize-handle:hover,
    .udoc-ui-root .udoc-right-panel--resizing .udoc-right-panel__resize-handle {
        background: var(--udoc-state-selected);
    }

    .udoc-ui-root .udoc-right-panel--resizing {
        transition: none;
    }

    /* The header: the tab shown named, then the panel's close button at the
   trailing edge. */
    .udoc-ui-root .udoc-right-panel__header {
        display: flex;
        flex: none;
        align-items: center;
        justify-content: space-between;
        height: 40px;
        padding: 0 4px;
        border-bottom: 1px solid var(--udoc-color-outline-variant);
        white-space: nowrap;
    }

    .udoc-ui-root .udoc-right-panel__title {
        padding: 0 var(--udoc-btn-pad-x);
        font-size: var(--udoc-btn-font);
        color: var(--udoc-color-on-surface);
    }

    .udoc-ui-root .udoc-right-panel__content {
        flex: 1;
        overflow: auto;
    }

    /* Mobile Panel Overlay */
    .udoc-ui-root .udoc-panel-overlay {
        display: none;
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--udoc-color-scrim);
        z-index: 40;
    }

    /* ===== Responsive: Small Mobile (≤480px) ===== */
    @container udoc-ui (max-width: 480px) {
        /* Collapse panels to slide-out drawers */
        .udoc-ui-root .udoc-left-panel {
            position: absolute;
            top: 0;
            left: 0;
            bottom: 0;
            width: 280px !important;
            z-index: 50;
            transform: translateX(-100%);
            transition: transform 0.2s ease;
        }

        .udoc-ui-root .udoc-left-panel:not(.udoc-left-panel--closed) {
            transform: translateX(0);
            box-shadow: var(--udoc-elevation-drawer-start);
        }

        .udoc-ui-root .udoc-left-panel--closed {
            width: 280px !important;
            transform: translateX(-100%);
        }

        .udoc-ui-root .udoc-right-panel {
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            width: 280px !important;
            z-index: 50;
            transform: translateX(100%);
            transition: transform 0.2s ease;
        }

        .udoc-ui-root .udoc-right-panel:not(.udoc-right-panel--closed) {
            transform: translateX(0);
            box-shadow: var(--udoc-elevation-drawer-end);
        }

        .udoc-ui-root .udoc-right-panel--closed {
            width: 280px !important;
            transform: translateX(100%);
        }

        /* Show overlay when panel is open */
        .udoc-ui-root.udoc-panel-open .udoc-panel-overlay {
            display: block;
        }

        /* Convert floating bar to full-width footer toolbar */
        .udoc-ui-root .udoc-floating-toolbar {
            position: relative;
            bottom: auto;
            left: auto;
            flex: 0 0 auto;
            transform: none;
            border-radius: 0;
            box-sizing: border-box;
            background: var(--udoc-color-surface-container);
            border-top: 1px solid var(--udoc-color-outline-variant);
            box-shadow: none;
            height: 40px;
            padding: 0 4px;
            gap: 4px;
            max-width: none;
            justify-content: center;
        }

        /* Raise toolbar above slide-out panels so its dropdowns are not hidden */
        .udoc-ui-root .udoc-toolbar-slot {
            z-index: 60;
        }

        /* Panel tab buttons for touch */
        .udoc-ui-root .udoc-left-panel__tabs {
            width: 32px;
            padding: 8px 0;
        }

        .udoc-ui-root .udoc-left-panel__tab {
            width: 32px;
            height: 32px;
        }

        .udoc-ui-root .udoc-left-panel__tab svg {
            width: var(--udoc-btn-glyph);
            height: var(--udoc-btn-glyph);
        }

        /* Toolbar adjustments */
        .udoc-ui-root .udoc-toolbar {
            padding: 0 4px;
        }

        .udoc-ui-root .udoc-btn--icon {
            box-sizing: border-box;
            padding: 6px;
        }

        /* View mode menu - right align */
        .udoc-ui-root .udoc-view-mode-menu__dropdown {
            left: auto;
            right: 0;
        }

        .udoc-ui-root .udoc-zoom-dropdown__item {
            padding: 12px 16px;
        }

        .udoc-ui-root .udoc-view-mode-menu__option {
            width: 36px;
            height: 36px;
        }

        .udoc-ui-root .udoc-view-mode-menu__option--label {
            width: auto;
        }
    }

    /* === Accessibility === */

    /* Screen-reader-only utility (visually hidden but accessible) */
    .udoc-ui-root .udoc-sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }

    /* Skip navigation link */
    .udoc-ui-root .udoc-skip-link {
        position: absolute;
        top: -100px;
        left: 0;
        z-index: 100;
        padding: 8px 16px;
        background: var(--udoc-color-surface-container-highest);
        color: var(--udoc-color-on-surface);
        text-decoration: none;
        font-size: 14px;
        border-radius: 0 0 4px 0;
        box-shadow: var(--udoc-elevation-1);
    }

    .udoc-ui-root .udoc-skip-link:focus {
        top: 0;
    }

    /* Keyboard focus indicators */
    .udoc-ui-root :focus-visible {
        outline: 2px solid var(--udoc-color-primary);
        outline-offset: 2px;
    }

    .udoc-ui-root :focus:not(:focus-visible) {
        outline: none;
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
        .udoc-ui-root,
        .udoc-ui-root * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
        }
    }

    /* High contrast preference */
    @media (prefers-contrast: more) {
        .udoc-ui-root {
            --udoc-color-outline: #000;
            --udoc-color-outline-variant: #000;
            --udoc-color-on-surface-variant: rgba(0, 0, 0, 0.7);
        }

        .udoc-ui-root.udoc-ui-dark {
            --udoc-color-outline: #aaa;
            --udoc-color-outline-variant: #aaa;
            --udoc-color-on-surface-variant: rgba(255, 255, 255, 0.7);
        }

        .udoc-ui-root :focus-visible {
            outline-width: 3px;
        }
    }

    /* Forced colors (Windows High Contrast) */
    @media (forced-colors: active) {
        .udoc-ui-root .udoc-thumbnail-item--selected {
            outline: 3px solid Highlight;
        }

        .udoc-ui-root .udoc-thumbnail-drop {
            background: Highlight;
        }

        .udoc-ui-root .udoc-btn,
        .udoc-ui-root .udoc-left-panel__tab {
            border: 1px solid ButtonText;
        }

        .udoc-ui-root .udoc-left-panel__tab--selected {
            background: Highlight;
            color: HighlightText;
        }
    }

    /* Resize handle focus styles */
    .udoc-ui-root .udoc-left-panel__resize-handle:focus-visible,
    .udoc-ui-root .udoc-right-panel__resize-handle:focus-visible {
        background: var(--udoc-state-selected);
        outline: 2px solid var(--udoc-color-primary);
        outline-offset: -2px;
    }

    /* Touch target sizes for coarse pointers (panels and side UI only — toolbars handle their own sizing) */
    @media (pointer: coarse) {
        .udoc-ui-root .udoc-left-panel__tab {
            width: 32px;
            height: 32px;
        }

        .udoc-ui-root .udoc-left-panel__tabs {
            width: 32px;
        }

        .udoc-ui-root .udoc-outline-item__toggle {
            min-width: 32px;
            min-height: 32px;
        }
    }

    /* ============================================================================
 * Canvas host — the WASM-painted surface, mounted into the viewport
 * slot. Reuses the viewer's viewport background so it themes consistently.
 * ==========================================================================*/
    /* The viewport grid: guide bands (a spreadsheet's row/column headers, a paged
   ruler) reserved as fixed CSS-px strips at the top/left edges, with the content
   pane (.udoc-ui__canvas-host) filling the remaining cell. The band tracks
   collapse to 0 when there's no guide; the renderer sets them per frame. */
    .udoc-ui-root .udoc-ui__viewport-grid {
        flex: 1 1 auto;
        width: 100%;
        min-width: 0;
        min-height: 0;
        display: grid;
        grid-template-columns: var(--udoc-band-left, 0px) minmax(0, 1fr);
        grid-template-rows: var(--udoc-band-top, 0px) minmax(0, 1fr);
        /* Scrollbar thickness — the bar's own cross size in either mode, and the
       strip the engine keeps clear for a shown bar in the gutter one. Kept in
       step with SCROLLBAR_THICKNESS_PX in Scrollbar.ts, which the corner math,
       the engine's strip and the branding inset take. */
        --udoc-scrollbar-size: 12px;
        background: var(--udoc-canvas-background);
        /* Positioning context + overflow clip for the header resize guide, an
       absolutely-positioned child that runs through the bands and content. */
        position: relative;
        overflow: hidden;
    }
    .udoc-ui-root .udoc-ui__band {
        display: block;
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;
        /* Keep in sync with the band fill the shell resolves (syncGuideColors). */
        background: var(--udoc-canvas-guide-background);
        /* Header presses select whole columns / rows via pointer capture; keep a
       touch drag on the band a selection, not a browser scroll gesture. */
        touch-action: none;
    }
    .udoc-ui-root .udoc-ui__band--corner {
        grid-column: 1;
        grid-row: 1;
    }
    .udoc-ui-root .udoc-ui__band--top {
        grid-column: 2;
        grid-row: 1;
    }
    .udoc-ui-root .udoc-ui__band--left {
        grid-column: 1;
        grid-row: 2;
    }
    /* The layer over a band strip an extension's band places its controls in
   (edit mode's ruler markers): the strip's own cell, positioned so it paints
   over the canvas and its controls place against it, clipped to the strip.
   It takes no press itself, so one between its controls reaches the band. */
    .udoc-ui-root .udoc-ui__band-layer {
        position: relative;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
        pointer-events: none;
    }
    .udoc-ui-root .udoc-ui__band-layer--top {
        grid-column: 2;
        grid-row: 1;
    }
    .udoc-ui-root .udoc-ui__band-layer--left {
        grid-column: 1;
        grid-row: 2;
    }
    /* Over the content pane, for what a band's controls draw across it (a
   drag's guide line): above the pages, as the header's resize guide is. */
    .udoc-ui-root .udoc-ui__band-layer--pane {
        grid-column: 2;
        grid-row: 2;
        z-index: 3;
    }
    /* ---- Scrollbar strips (every doc type but the spreadsheet; see the
   profile's scrollbarGutters) -------------------------------------------------
   The engine keeps a strip clear along the content pane's right edge while the
   vertical bar shows and along its bottom while the horizontal one does, in the
   very frame it paints, and centres the page in what is left: so a bar sits
   beside the document instead of over its page edges, and the page moves with
   the bar rather than a frame after it. Its fits measure the pane less one strip
   on each axis whichever bars show, so a bar coming or going never re-zooms the
   page. The bars overlay the pane's edges as the floating ones do and land in
   those strips; their tracks are opaque, so no page-anchored overlay shows
   through one either. */
    .udoc-ui-root .udoc-ui__viewport-grid--scrollbar-gutters .udoc-ui__scrollbar {
        background: var(--udoc-canvas-scrollbar-background);
    }
    /* The corner the two tracks stop short of, filled by the vertical one: its
   track is cut a bar's thickness short only while the horizontal bar shows, so
   this sits in the corner then and below the pane, clipped, otherwise. */
    .udoc-ui-root .udoc-ui__viewport-grid--scrollbar-gutters .udoc-ui__scrollbar--y::after {
        content: "";
        position: absolute;
        top: 100%;
        left: 0;
        width: 100%;
        height: var(--udoc-scrollbar-size);
        background: inherit;
        pointer-events: none;
    }
    /* Header resize guide: a transient 1px line the user drags along a column / row
   header boundary — a UI preview of the new track size (it commits nothing yet).
   Positioned from the --udoc-resize-pos custom property (content-pane-relative
   CSS px); the band offset is folded in here so the line runs through the header
   band and the content pane. pointer-events:none keeps the band the pointer-
   capture target. Sits above the bands and the content canvas. */
    .udoc-ui-root .udoc-ui__resize-guide {
        position: absolute;
        z-index: 3;
        pointer-events: none;
        background: var(--udoc-color-outline);
    }
    .udoc-ui-root .udoc-ui__resize-guide--column {
        top: 0;
        bottom: 0;
        width: 1px;
        left: calc(var(--udoc-band-left, 0px) + var(--udoc-resize-pos, 0px));
    }
    .udoc-ui-root .udoc-ui__resize-guide--row {
        left: 0;
        right: 0;
        height: 1px;
        top: calc(var(--udoc-band-top, 0px) + var(--udoc-resize-pos, 0px));
    }
    /* The prospective-size pill riding the guide near the boundary. Themed via the
   guide tokens, so it follows light / dark with no separate rule. */
    .udoc-ui-root .udoc-ui__resize-guide-label {
        position: absolute;
        padding: 1px 5px;
        border-radius: 3px;
        font:
            11px/1.4 -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            system-ui,
            sans-serif;
        white-space: nowrap;
        color: var(--udoc-color-on-surface-variant);
        background: var(--udoc-color-surface-container-high);
        border: 1px solid var(--udoc-color-outline-variant);
    }
    .udoc-ui-root .udoc-ui__resize-guide--column .udoc-ui__resize-guide-label {
        top: 2px;
        left: 5px;
    }
    .udoc-ui-root .udoc-ui__resize-guide--row .udoc-ui__resize-guide-label {
        top: 4px;
        left: 5px;
    }
    .udoc-ui-root .udoc-ui__canvas-host {
        grid-column: 2;
        grid-row: 2;
        position: relative;
        width: 100%;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
        background: var(--udoc-canvas-background);
        outline: none;
        /* The viewport scrolls synthetically (a touch drag becomes a SCROLL_BY, a
       wheel is intercepted), so the browser must not consume touch gestures as
       native scroll/zoom -- that would swallow the pointer events the canvas
       drives its own scroll from. 'none' routes every touch to the canvas. */
        touch-action: none;
    }
    .udoc-ui-root .udoc-ui__canvas {
        display: block;
        position: absolute;
        inset: 0;
    }

    /* A deck's notes pane, under the slides: the notes viewer's canvas, its
   caret and scrollbar over it, and the splitter that resizes it lying along
   its top edge. On the canvas's ground, as the engine paints the notes; its
   height, the edge included, is set inline. */
    .udoc-ui-root .udoc-ui__notes {
        position: relative;
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        border-top: 1px solid var(--udoc-color-outline-variant);
        background: var(--udoc-canvas-background);
        --udoc-scrollbar-size: 12px;
    }
    .udoc-ui-root .udoc-ui__notes-splitter {
        position: absolute;
        top: -4px;
        left: 0;
        right: 0;
        height: 7px;
        cursor: row-resize;
        z-index: 3;
        outline: none;
    }
    .udoc-ui-root .udoc-ui__notes-splitter:hover,
    .udoc-ui-root .udoc-ui__notes-splitter:focus-visible,
    .udoc-ui-root .udoc-ui__notes--resizing .udoc-ui__notes-splitter {
        background: var(--udoc-state-selected);
    }
    .udoc-ui-root .udoc-ui__notes-host {
        position: relative;
        flex: 1 1 auto;
        min-height: 0;
        overflow: hidden;
        cursor: text;
        /* Its scroll is synthetic, as the canvas's is. */
        touch-action: none;
    }
    .udoc-ui-root .udoc-ui__notes-canvas {
        display: block;
        position: absolute;
        top: 0;
        left: 0;
    }
    /* In the dark theme the notes show inverted, their dark text light, hues
   kept: the pane hands the engine its ground inverted to match (NotesPane's
   setBackdrop), so the ground still shows as the canvas's. */
    .udoc-ui-root.udoc-ui-dark .udoc-ui__notes-canvas {
        filter: invert(1) hue-rotate(180deg);
    }
    /* Its scrollbar, in the strip the engine keeps clear for it, as the
   canvas's is (scrollbar gutters). */
    .udoc-ui-root .udoc-ui__notes-host .udoc-ui__scrollbar {
        background: var(--udoc-canvas-scrollbar-background);
        cursor: default;
    }

    /* Page-anchored HTML overlay layer (above the canvas, below the scrollbars). */
    .udoc-ui-root .udoc-ui__overlay {
        position: absolute;
        inset: 0;
        overflow: hidden;
        z-index: 1;
        pointer-events: none;
    }
    .udoc-ui-root .udoc-ui__overlay-item {
        position: absolute;
        top: 0;
        left: 0;
        will-change: transform;
    }
    /* Selection overlay (above the canvas and the page chrome): boxes marking
   the selected graphics objects, projected from page-anchored geometry each
   frame. Function-critical edit chrome — its own layer, not a registry
   overlay, so hosts can restyle but not remove it. Sits above the page-control
   overlay (z-index 1) so selection marks and handles are never occluded by a
   page pill/rail. */
    .udoc-ui-root .udoc-ui__selection {
        position: absolute;
        inset: 0;
        overflow: hidden;
        z-index: 2;
        pointer-events: none;
    }
    /* The search highlights, under the selection: one SVG of polygons, a quad
   each, projected per frame (SearchLayer). Multiplied into the page so the
   text under a highlight stays legible. */
    .udoc-ui-root .udoc-ui__search {
        position: absolute;
        inset: 0;
        overflow: hidden;
        z-index: 1;
        pointer-events: none;
    }
    .udoc-ui-root .udoc-search-layer {
        position: absolute;
        inset: 0;
    }
    .udoc-ui-root .udoc-search-layer svg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
    }
    .udoc-ui-root .udoc-search-highlight {
        fill: var(--udoc-canvas-search);
        mix-blend-mode: multiply;
    }
    .udoc-ui-root .udoc-search-highlight--active {
        fill: var(--udoc-canvas-search-active);
    }
    /* The hovered annotation's outline, under the selection and over the search
   highlights: one line around all its quads, padded and round-cornered,
   projected per frame (AnnotationHoverLayer) — a rect in --udoc-canvas-hover
   shown through the mask the outline is drawn in, a hue apart from the
   selection's blue so a hover never reads as a selection. */
    .udoc-ui-root .udoc-ui__annotation-hover {
        position: absolute;
        inset: 0;
        overflow: hidden;
        z-index: 1;
        pointer-events: none;
    }
    .udoc-ui-root .udoc-annotation-hover-layer {
        position: absolute;
        inset: 0;
    }
    .udoc-ui-root .udoc-annotation-hover-layer svg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
    }
    .udoc-ui-root .udoc-annotation-hover {
        fill: var(--udoc-canvas-hover);
    }
    /* The overlay layer above the selection: registry overlays set with
   aboveSelection, which belong over the selected object's boxes and handles
   rather than under them — the selected annotation's bar and comment popup. */
    .udoc-ui-root .udoc-ui__overlay--above-selection {
        z-index: 3;
    }
    /* The clipped chrome group: the selection's boxes, handles, labels, and peer
   carets, clipped each frame to the content area (the canvas minus the frozen
   guide bands and the branding decal) via a clip-path SelectionLayer sets on it.
   The clip lives on this inner group — not the .udoc-ui__selection container
   — because clip-path makes an element a backdrop root: on the container it would
   cut the LOCAL caret's backdrop-filter off from the canvas behind it (the caret
   has no ink of its own; see --local below), blanking the caret. So the local
   caret is a sibling of this group, a direct child of the unclipped container. */
    .udoc-ui-root .udoc-ui__selection-chrome {
        position: absolute;
        inset: 0;
    }
    /* The selection outline layer: one SVG spanning the canvas, holding each
   object's box as a polygon (a faithful parallelogram under rotation/skew) plus
   the rotation stem. Behind the handle squares so the stem passes under them.
   No pointer events — the canvas hit-tests geometrically. */
    .udoc-ui-root .udoc-ui__selection-svg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
        pointer-events: none;
    }
    /* The local selection chrome (box outline, resize handles, rotation grip + stem)
   uses --udoc-canvas-selection — a deliberately FIXED blue, not the theme or host
   accent: it overlays the document page, white in light and dark alike, so a
   theme-shifted blue (and a surface-colored handle fill that goes dark) would
   read wrong on the page and the seam where the handles meet the box. */
    .udoc-ui-root .udoc-ui__selection-box {
        fill: none;
        stroke: var(--udoc-canvas-selection);
        stroke-width: 1.5px;
    }
    /* A remote collaborator's selection: the peer's stable color (set inline per
   box), drawn dashed and a touch more transparent than your own so a peer's box
   reads as clearly theirs and sits visually behind the local selection. The
   modifier class is also the hook for a host to restyle peers separately. */
    .udoc-ui-root .udoc-ui__selection-box--peer {
        stroke-dasharray: 4 3;
        stroke-opacity: 0.7;
    }
    /* A spreadsheet grid cell-range block: a translucent fill under a solid border —
   Excel's selection rectangle. Filled AND stroked (unlike an object box, which is
   stroke-only), and it carries no resize/rotate handles: a cell block is not a
   shape. */
    .udoc-ui-root .udoc-ui__selection-cell {
        fill: color-mix(in srgb, var(--udoc-canvas-selection) 15%, transparent);
        stroke: var(--udoc-canvas-selection);
        stroke-width: 1.5px;
    }
    /* A remote collaborator's cell selection: same fill + border shape, tinted by
   the peer's stable color (set inline per box), drawn dashed and more
   transparent than your own (fill alpha set inline; see PEER_CELL_FILL_ALPHA).
   The modifier class is also the hook for a host to restyle peers separately. */
    .udoc-ui-root .udoc-ui__selection-cell--peer {
        stroke-dasharray: 4 3;
        stroke-opacity: 0.7;
    }
    /* A text highlight quad: a translucent fill over the selected run(s), no
   outline — the range a text selection covers. */
    .udoc-ui-root .udoc-ui__selection-text {
        fill: color-mix(in srgb, var(--udoc-canvas-selection) 30%, transparent);
        stroke: none;
    }
    /* A text caret — a thin line drawn as an HTML line the selection layer
   translates + rotates onto the projected caret segment. Local and peer carets
   share the same shape (an SVG polygon's antialiased stroke reads thinner than
   an equally-wide solid line). A peer's wears its color as an inline background
   (--peer is the host's restyle hook) and stays solid; the local one takes its
   ink from the backdrop (--local below) and blinks like a text insertion point,
   its blink restarted (shown solid) by the layer on every caret move so a
   keystroke or arrow shows the caret at once. */
    .udoc-ui-root .udoc-ui__selection-caret {
        position: absolute;
        left: 0;
        top: 0;
        width: 1.5px;
        transform-origin: 0 0;
    }
    /* The local caret takes its ink from the page pixels behind it: black over a
   light backdrop, white over a dark one, decided per pixel by the compositor
   — no probe of the worker-rendered canvas. The filter grayscales the
   backdrop, inverts it, and binarizes with a huge contrast; the gamma-space
   0.5 cut sits near the WCAG crossover where black stops contrasting better
   than white. The filter reaches the canvas because the nearest backdrop root
   is the viewport slot (its isolation: isolate), which contains the canvas;
   an HTML line rather than an SVG polygon because backdrop-filter doesn't
   apply to SVG shapes. Supported by every browser that passes WorkerClient's
   OffscreenCanvas-in-worker gate. */
    .udoc-ui-root .udoc-ui__selection-caret--local {
        /* Above a peer's caret at the same spot — our own cursor stays visible. */
        z-index: 1;
        -webkit-backdrop-filter: grayscale(1) invert(1) contrast(10000%);
        backdrop-filter: grayscale(1) invert(1) contrast(10000%);
        /* Only the local caret blinks; the layer restarts it (from the solid phase)
       on every caret move so a keystroke shows the caret at once. */
        animation: udoc-ui__caret-blink 1.06s steps(1, end) infinite;
    }
    /* Typing goes to a field outside the canvas that edits the same text — a
   workbook's formula bar: its caret is the one shown. */
    .udoc-ui-root .udoc-ui__canvas-host--caret-elsewhere .udoc-ui__selection-caret--local {
        visibility: hidden;
    }
    @keyframes udoc-ui__caret-blink {
        0%,
        50% {
            opacity: 1;
        }
        50.01%,
        100% {
            opacity: 0;
        }
    }
    /* The hidden text field parked at the caret: a real textarea so keystrokes
   and IME composition land in an editable element, kept invisible — the
   document draws its own text and caret. Near-zero (not zero) opacity and no
   pointer events; the 16px font keeps mobile browsers from zooming to it. */
    .udoc-ui-root .udoc-ui__text-input {
        position: absolute;
        left: 0;
        top: 0;
        width: 2px;
        height: 16px;
        margin: 0;
        padding: 0;
        border: none;
        outline: none;
        resize: none;
        overflow: hidden;
        background: transparent;
        color: transparent;
        caret-color: transparent;
        opacity: 0.01;
        pointer-events: none;
        font-size: 16px;
        line-height: 1;
        white-space: pre;
        z-index: 4;
    }
    /* A remote collaborator's name flag: a small upright pill above the top-left
   corner of the peer's selection box, in the peer's stable color (set inline
   per peer, matching the box stroke). Projected each frame like the boxes and
   carries no pointer events. */
    .udoc-ui-root .udoc-ui__peer-label {
        position: absolute;
        top: 0;
        left: 0;
        max-width: 16ch;
        overflow: hidden;
        box-sizing: border-box;
        padding: 1px 5px;
        border-radius: 3px;
        font-size: 11px;
        line-height: 1.4;
        font-weight: 600;
        white-space: nowrap;
        text-overflow: ellipsis;
        color: #fff;
        pointer-events: none;
        will-change: transform;
    }
    /* A remote collaborator's pointer: the selector arrow in the peer's color (set
   inline), its tip on the element's origin, which the layer translates onto the
   page point the peer's pointer rests on; a white halo keeps it legible over any
   page. Its name pill sits below and right of the tip, like a cursor's label. */
    .udoc-ui-root .udoc-ui__peer-pointer {
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
        will-change: transform;
    }
    .udoc-ui-root .udoc-ui__peer-pointer > svg {
        position: absolute;
        /* The arrow's tip sits at (5px, 2px) in its 20px box. */
        left: -5px;
        top: -2px;
        width: 20px;
        height: 20px;
        filter: drop-shadow(0 0 1px #fff) drop-shadow(0 0 1px #fff);
    }
    .udoc-ui-root .udoc-ui__peer-pointer-name {
        position: absolute;
        left: 9px;
        top: 16px;
        max-width: 16ch;
        overflow: hidden;
        padding: 1px 5px;
        border-radius: 3px;
        font-size: 11px;
        line-height: 1.4;
        font-weight: 600;
        white-space: nowrap;
        text-overflow: ellipsis;
        color: #fff;
    }
    /* Resize handles: eight small squares on the local selection's bounding box
   (corners + edge midpoints), shown only when a single page's objects are
   selected. Like the boxes they're projected each frame and carry no pointer
   events — the canvas hit-tests them geometrically and sets the resize cursor,
   so a press over a handle starts a resize drag. Centered on their anchor
   point via a translate that already accounts for the half-size offset. */
    .udoc-ui-root .udoc-ui__selection-handle {
        position: absolute;
        top: 0;
        left: 0;
        width: 8px;
        height: 8px;
        box-sizing: border-box;
        background: #fff;
        border: 1.5px solid var(--udoc-canvas-selection);
        border-radius: 1px;
        will-change: transform;
    }

    /* The media players (udoc:media): the browser's own player of each slide
   element's audio or video, over the element's box from its top-left corner.
   Empty and transparent until a click starts it, the element's picture showing
   through; a video then fills the box as the picture does, and audio hangs its
   bar under the box at its own size. Takes the pointer back from the overlay
   layer. */
    .udoc-ui-root .udoc-ui__media {
        position: relative;
        pointer-events: auto;
        transform-origin: 0 0;
        cursor: pointer;
    }
    .udoc-ui-root .udoc-ui__media > video {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: fill;
    }
    .udoc-ui-root .udoc-ui__media > audio {
        position: absolute;
        top: 100%;
        left: 0;
    }

    /* The form field input (udoc:form-field): the control a form field is filled in
   with, over the widget pressed and its size at every zoom. On a page's white,
   like the widget it covers, and opaque, so the value the widget drew doesn't
   show through; takes the pointer back from the overlay layer. */
    .udoc-ui-root .udoc-ui__form-field {
        pointer-events: auto;
        display: flex;
    }
    .udoc-ui-root .udoc-ui__form-field > input,
    .udoc-ui-root .udoc-ui__form-field > textarea,
    .udoc-ui-root .udoc-ui__form-field > select {
        flex: 1;
        min-width: 0;
        margin: 0;
        padding: 0 2px;
        box-sizing: border-box;
        border: 1px solid var(--udoc-color-primary);
        border-radius: 0;
        background: #fff;
        color: #000;
        font-family: Helvetica, Arial, sans-serif;
        font-size: inherit;
        line-height: normal;
        resize: none;
        outline: none;
    }

    /* The comment popup (udoc:comment-popup): the selected markup annotation's
   thread, beside it. Constant screen size at every zoom; takes the pointer back
   from the overlay layer so its fields can be clicked into. */
    .udoc-ui-root .udoc-ui__comment {
        pointer-events: auto;
        width: 260px;
        max-height: 420px;
        overflow: auto;
        padding: 6px;
        background: var(--udoc-color-surface-container-high);
        border: 1px solid var(--udoc-color-outline-variant);
        border-radius: 6px;
        box-shadow: var(--udoc-elevation-2);
    }

    /* A comment thread, as the popup and the comments panel show it: its comment
   and the replies nested under it, a step in per depth — and the field that
   answers an entry under it, a step deeper, as its reply shows. */
    .udoc-ui-root .udoc-comment-thread {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font:
            12px/1.4 system-ui,
            sans-serif;
        color: var(--udoc-color-on-surface);
    }
    .udoc-ui-root .udoc-comment-thread__entries {
        display: flex;
        flex-direction: column;
    }
    /* The space between entries is padding, not a gap, so each level's bar runs on
   through it; a pixel of it overlaps the entry above, so no seam shows where
   two meet part way through a pixel. */
    .udoc-ui-root .udoc-comment-thread__entries > * + * {
        margin-top: -1px;
        padding-top: 9px;
    }
    .udoc-ui-root .udoc-comment {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }
    /* A bar at each step in: the entries touch, so a level's bars join into one
   down every entry under the comment its replies answer. */
    .udoc-ui-root .udoc-comment--reply,
    .udoc-ui-root .udoc-comment-thread__reply {
        padding-left: calc(var(--udoc-comment-depth) * 12px);
        background: repeating-linear-gradient(to right, var(--udoc-color-outline-variant) 0 2px, transparent 2px 12px)
            left / calc(var(--udoc-comment-depth) * 12px) 100% no-repeat;
    }
    .udoc-ui-root .udoc-comment__header {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
    }
    .udoc-ui-root .udoc-comment__kind {
        display: inline-flex;
        flex: none;
        font-size: 11px;
        color: var(--udoc-color-on-surface-variant);
    }
    .udoc-ui-root .udoc-comment__kind svg {
        width: var(--udoc-inline-glyph);
        height: var(--udoc-inline-glyph);
    }
    .udoc-ui-root .udoc-comment__author {
        min-width: 0;
        font-weight: 600;
        color: var(--udoc-color-on-surface-variant);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .udoc-ui-root .udoc-comment__date {
        flex: none;
        margin-left: auto;
        font-size: 11px;
        color: var(--udoc-color-on-surface-variant);
    }
    /* Rich text: its spaces kept as typed, as rich text keeps them; while it is
   written, four lines tall until it is dragged taller. */
    .udoc-ui-root .udoc-comment__text {
        overflow: auto;
        max-height: 24em;
        padding: 4px;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 4px;
        outline: none;
    }
    .udoc-ui-root .udoc-comment__text p,
    .udoc-ui-root .udoc-comment__text div {
        margin: 0;
    }
    .udoc-ui-root .udoc-comment__text:empty::before {
        content: attr(data-placeholder);
        color: var(--udoc-color-on-surface-variant);
    }
    .udoc-ui-root .udoc-comment__text[contenteditable="true"] {
        resize: vertical;
        min-height: 5.6em;
        cursor: text;
        background: var(--udoc-color-surface-container-high);
        border-color: var(--udoc-color-outline-variant);
    }
    .udoc-ui-root .udoc-comment__text:focus {
        border-color: var(--udoc-color-primary);
    }
    /* An entry's last line: its lock at the start, where it is locked, and Reply,
   Edit and Delete at the end — Cancel and Save while it is edited, and under
   the reply field. */
    .udoc-ui-root .udoc-comment__actions {
        --udoc-btn-h: 26px;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 4px;
    }
    .udoc-ui-root .udoc-comment__lock {
        display: inline-flex;
        margin-right: auto;
        color: var(--udoc-color-on-surface-variant);
    }
    .udoc-ui-root .udoc-comment__lock svg {
        width: var(--udoc-inline-glyph);
        height: var(--udoc-inline-glyph);
    }
    .udoc-ui-root .udoc-comment__actions .udoc-comment__primary {
        color: var(--udoc-color-on-primary);
        background: var(--udoc-color-primary);
    }
    .udoc-ui-root .udoc-comment__actions .udoc-comment__primary:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }
    .udoc-ui-root .udoc-comment-thread__count {
        font-size: 11px;
        color: var(--udoc-color-on-surface-variant);
    }
    .udoc-ui-root .udoc-comment-thread__reply {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    /* The comments panel (the right panel's Comments tab): a group per page, a
   card per thread, the selected thread's card open and outlined. */
    .udoc-ui-root .udoc-comments-panel {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 8px;
    }
    .udoc-ui-root .udoc-comments-panel__page {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .udoc-ui-root .udoc-comments-panel__page-header {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 2px;
        font:
            600 12px/1.4 system-ui,
            sans-serif;
        color: var(--udoc-color-on-surface-variant);
        text-align: left;
        background: none;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }
    .udoc-ui-root .udoc-comments-panel__page-header:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }
    .udoc-ui-root .udoc-comments-panel__page-header svg {
        width: var(--udoc-caret);
        height: var(--udoc-caret);
        transition: transform 0.15s ease;
    }
    .udoc-ui-root .udoc-comments-panel__page--collapsed .udoc-comments-panel__page-header svg {
        transform: rotate(-90deg);
    }
    .udoc-ui-root .udoc-comments-panel__count {
        margin-left: auto;
        font-weight: 400;
    }
    .udoc-ui-root .udoc-comments-panel__card {
        padding: 8px;
        background: var(--udoc-color-surface-container-high);
        border: 1px solid var(--udoc-color-outline-variant);
        border-radius: 6px;
        cursor: pointer;
    }
    .udoc-ui-root .udoc-comments-panel__card:hover {
        border-color: var(--udoc-color-outline);
    }
    .udoc-ui-root .udoc-comments-panel__card--selected,
    .udoc-ui-root .udoc-comments-panel__card--selected:hover {
        cursor: default;
        border-color: var(--udoc-color-primary);
    }

    /* The annotation bar (udoc:annotation-bar): the selected annotation's comment,
   colour and delete, in a strip hanging up from just above its top-left
   corner. Framed as the page controls are; constant screen size at every
   zoom. */
    .udoc-ui-root .udoc-ui__annotation-bar {
        --udoc-btn-h: 28px;
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 1px;
        padding: 1px 4px;
        transform: translateY(-100%);
        background: var(--udoc-color-surface-container-high);
        border: 1px solid var(--udoc-color-outline-variant);
        border-radius: 12px;
        user-select: none;
    }

    /* Virtual scrollbars overlaying the canvas host's right and bottom edges, in
   both modes. A doc type whose bars take a strip of their own (see
   --scrollbar-gutters above) gives the track a fill; the thickness, thumb and
   hover are common. */
    .udoc-ui-root .udoc-ui__scrollbar {
        position: absolute;
        z-index: 2;
        background: transparent;
    }
    .udoc-ui-root .udoc-ui__scrollbar--y {
        top: 0;
        right: 0;
        width: var(--udoc-scrollbar-size);
        height: 100%;
    }
    .udoc-ui-root .udoc-ui__scrollbar--x {
        left: 0;
        bottom: 0;
        height: var(--udoc-scrollbar-size);
        width: 100%;
    }
    .udoc-ui-root .udoc-ui__scrollbar-thumb {
        position: absolute;
        top: 0;
        left: 0;
        border-radius: 6px;
        background: var(--udoc-scrollbar-thumb, rgba(128, 128, 128, 0.5));
        transition: background 0.15s;
    }
    .udoc-ui-root .udoc-ui__scrollbar--y .udoc-ui__scrollbar-thumb {
        width: 8px;
        margin-left: 2px;
    }
    .udoc-ui-root .udoc-ui__scrollbar--x .udoc-ui__scrollbar-thumb {
        height: 8px;
        margin-top: 2px;
    }
    .udoc-ui-root .udoc-ui__scrollbar-thumb:hover {
        background: var(--udoc-scrollbar-thumb-hover, rgba(128, 128, 128, 0.8));
    }

    /* Placeholder shown in side panels whose content is foundation-only. */
    .udoc-ui-root .udoc-panel-placeholder {
        padding: 24px 16px;
        color: var(--udoc-color-on-surface-variant);
        font-size: 13px;
        text-align: center;
    }

    /* =========================================================================
   Search panel (the right panel's Search tab), ported from the viewer
   ========================================================================= */
    .udoc-ui-root .udoc-search-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        font-size: 13px;
    }
    .udoc-ui-root .udoc-search-panel__header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 12px 12px 8px;
    }
    .udoc-ui-root .udoc-search-panel__input-wrapper {
        flex: 1;
        display: flex;
        align-items: center;
        border: 1px solid var(--udoc-color-outline);
        border-radius: 4px;
        background: var(--udoc-color-surface-container-high);
        overflow: hidden;
    }
    .udoc-ui-root .udoc-search-panel__input-wrapper:focus-within {
        border-color: var(--udoc-color-primary);
    }
    .udoc-ui-root .udoc-search-panel__input-icon {
        display: flex;
        align-items: center;
        padding: 0 6px 0 8px;
        color: var(--udoc-color-on-surface-variant);
    }
    .udoc-ui-root .udoc-search-panel__input-icon svg {
        width: var(--udoc-inline-glyph);
        height: var(--udoc-inline-glyph);
    }
    .udoc-ui-root .udoc-search-panel__input {
        flex: 1;
        border: none;
        outline: none;
        padding: 6px 8px 6px 0;
        font-size: 13px;
        min-width: 0;
        background: transparent;
        color: var(--udoc-color-on-surface);
    }
    .udoc-ui-root .udoc-search-panel__input:focus-visible {
        outline: none;
    }
    .udoc-ui-root .udoc-search-panel__clear {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        margin-right: 4px;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: var(--udoc-color-on-surface-variant);
        cursor: pointer;
        padding: 0;
        flex-shrink: 0;
    }
    .udoc-ui-root .udoc-search-panel__clear:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }
    .udoc-ui-root .udoc-search-panel__clear svg {
        width: var(--udoc-btn-glyph);
        height: var(--udoc-btn-glyph);
    }
    .udoc-ui-root .udoc-search-panel__toggle {
        display: flex;
        align-self: stretch;
        align-items: center;
        justify-content: center;
        width: 32px;
        border: 1px solid var(--udoc-color-outline);
        border-radius: 4px;
        background: var(--udoc-color-surface-container-high);
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        color: var(--udoc-color-on-surface-variant);
        flex-shrink: 0;
    }
    .udoc-ui-root .udoc-search-panel__toggle:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }
    .udoc-ui-root .udoc-search-panel__toggle--active {
        background-color: var(--udoc-color-primary);
        color: var(--udoc-color-on-primary);
        border-color: var(--udoc-color-primary);
    }
    .udoc-ui-root .udoc-search-panel__nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 12px;
        border-bottom: 1px solid var(--udoc-color-outline-variant);
        min-height: 32px;
    }
    .udoc-ui-root .udoc-search-panel__status {
        color: var(--udoc-color-on-surface-variant);
        font-size: 12px;
    }
    .udoc-ui-root .udoc-search-panel__nav-buttons {
        display: flex;
        gap: 2px;
    }
    .udoc-ui-root .udoc-search-panel__nav-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border: none;
        border-radius: 4px;
        background: transparent;
        cursor: pointer;
        color: var(--udoc-color-on-surface);
        padding: 0;
    }
    .udoc-ui-root .udoc-search-panel__nav-btn svg {
        width: var(--udoc-caret);
        height: var(--udoc-caret);
    }
    .udoc-ui-root .udoc-search-panel__nav-btn:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }
    .udoc-ui-root .udoc-search-panel__nav-btn:disabled {
        opacity: 0.3;
        cursor: default;
        background: transparent;
    }
    .udoc-ui-root .udoc-search-panel__results {
        flex: 1;
        overflow-y: auto;
    }
    .udoc-ui-root .udoc-search-result__page-header {
        padding: 8px 12px 4px;
        font-size: 11px;
        font-weight: 600;
        color: var(--udoc-color-on-surface-variant);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        position: sticky;
        top: 0;
        background: var(--udoc-panel-background);
        z-index: 1;
    }
    .udoc-ui-root .udoc-search-result {
        padding: 6px 12px;
        cursor: pointer;
        font-size: 12px;
        line-height: 1.4;
        color: var(--udoc-color-on-surface);
        border-left: 3px solid transparent;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .udoc-ui-root .udoc-search-result:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }
    .udoc-ui-root .udoc-search-result--active {
        background-color: var(--udoc-state-selected);
        border-left-color: var(--udoc-color-primary);
    }
    .udoc-ui-root .udoc-search-result__match {
        background: var(--udoc-canvas-search);
        color: inherit;
        border-radius: 2px;
        padding: 0 1px;
    }

    /* =========================================================================
   Mode / command toolbar
   Top bar zones: left = panel toggle + mode switch + editing cluster;
   center = view-state; right = app menu. The editing cluster holds the
   mode-scoped Insert commands (Office "select + insert" model).
   ========================================================================= */

    /* The mode-scoped editing cluster (undo/redo + Insert commands). */
    .udoc-ui-root .udoc-toolbar__editing {
        display: flex;
        align-items: center;
        gap: 4px;
    }
    .udoc-ui-root .udoc-toolbar__commands {
        display: flex;
        align-items: center;
        gap: 2px;
    }

    /* Shape picker (anchored under the shape command). */
    /* The icon and submenu caret set their own color, so they'd stay lit while the
   label greys out — re-tint them to match the disabled row. */
    .udoc-ui-root .udoc-toolbar__menu-item:disabled .udoc-toolbar__menu-icon,
    .udoc-ui-root .udoc-toolbar__menu-item:disabled .udoc-toolbar__menu-caret {
    }
    /* A divider above the item: separates the z-order moves from grouping. */
    .udoc-ui-root .udoc-toolbar__menu-item--divider {
        margin-top: 5px;
        border-top: 1px solid var(--udoc-color-outline-variant);
        padding-top: 9px;
    }
    /* The current member of an exclusive set (the alignment / line spacing the
   selection holds) takes the shared selected fill above; the icon column sets
   its own color, so it takes the fill's ink here. Deliberately not the switch:
   see the --checkable rules below. */
    .udoc-ui-root .udoc-toolbar__menu-item--selected .udoc-toolbar__menu-icon {
        color: var(--udoc-color-on-surface);
    }
    /* A fixed icon column, so a row with no icon keeps its label aligned with the
   rows around it. Rendered only in a menu where some row has a glyph — see
   buildMenuInto. */
    .udoc-ui-root .udoc-toolbar__menu-icon {
        display: inline-flex;
        flex: none;
        width: var(--udoc-btn-glyph);
        align-items: center;
        justify-content: center;
        color: var(--udoc-color-on-surface-variant);
    }
    .udoc-ui-root .udoc-toolbar__menu-icon svg {
        width: var(--udoc-btn-glyph);
        height: var(--udoc-btn-glyph);
    }
    /* The label takes the row's slack so a trailing toggle switch sits flush right. */
    .udoc-ui-root .udoc-toolbar__menu-label {
        flex: 1;
    }
    /* A checkable row (the Align reference toggle) carries an on/off switch — a pill
   track with a sliding knob — so it reads as stateful, not as an action. */
    .udoc-ui-root .udoc-toolbar__menu-switch {
        flex: none;
        position: relative;
        width: 26px;
        height: 15px;
        border-radius: 999px;
        /* Off track — a neutral well, not the selected tint, which reads as on. The
       pair: off track outline-variant + handle outline, on track primary +
       handle on-primary. */
        background: var(--udoc-color-outline-variant);
        transition: background 120ms ease;
    }
    .udoc-ui-root .udoc-toolbar__menu-switch::after {
        content: "";
        position: absolute;
        top: 2px;
        left: 2px;
        width: 11px;
        height: 11px;
        border-radius: 50%;
        background: var(--udoc-color-outline);
        box-shadow: var(--udoc-elevation-1);
        transition: transform 120ms ease;
    }
    .udoc-ui-root .udoc-toolbar__menu-item--checked .udoc-toolbar__menu-switch {
        background: var(--udoc-color-primary);
    }
    .udoc-ui-root .udoc-toolbar__menu-item--checked .udoc-toolbar__menu-switch::after {
        background: var(--udoc-color-on-primary);
        transform: translateX(11px);
    }

    /* Submenu fly-out (Arrange ▸ Order / Align / Rotate). A submenu row is a plain
   menu item with a trailing caret; the .udoc-submenu panel is a nested .udoc-menu
   that opens beside it. The wrap anchors that absolutely-positioned panel. */
    .udoc-ui-root .udoc-toolbar__submenu-wrap {
        position: relative;
    }
    /* The label already takes the row's slack (flex: 1), so the caret sits flush
   right — same layout slot as a checkable row's switch. */
    .udoc-ui-root .udoc-toolbar__menu-caret {
        display: inline-flex;
        align-items: center;
        color: var(--udoc-color-on-surface-variant);
    }
    .udoc-ui-root .udoc-toolbar__menu-caret svg {
        width: var(--udoc-caret);
        height: var(--udoc-caret);
    }
    /* Nested panel — opens to the right of its row, hidden until its row is hovered
   / activated. Overrides the base .udoc-menu top/left anchor (so it must follow
   the .udoc-menu rules in source order). */
    .udoc-ui-root .udoc-submenu {
        top: -5px; /* pull up by the panel's top padding + border so the first item lines up with the parent row */
        left: 100%;
        margin-left: 2px;
        z-index: 81;
        display: none;
    }
    .udoc-ui-root .udoc-submenu.udoc-submenu--open {
        display: block;
    }
    /* Flipped to the left edge when opening right would overflow the root. */
    .udoc-ui-root .udoc-submenu.udoc-submenu--left {
        left: auto;
        right: 100%;
        margin-left: 0;
        margin-right: 2px;
    }

    /* The toolbar's mode slot — transparent to the toolbar's row, so a mode
   switch an extension parents in it lays out as its own child. */
    .udoc-ui-root .udoc-toolbar__mode-slot {
        display: contents;
    }

    /* App menu wrapper — the single collapsed home for global actions on the right.
   Its trigger is a plain icon button; the panel is the shared .udoc-menu--end. */
    .udoc-ui-root .udoc-app-menu {
        position: relative;
    }
    /* The people button: the peers present as overlapping discs of their initials,
   each in its own color, ringed in the toolbar's surface so they read apart. A
   pause glyph or a spinner sits on its corner while paused or rejoining. */
    .udoc-ui-root .udoc-collaboration__faces {
        position: relative;
        display: inline-flex;
        align-items: center;
    }
    .udoc-ui-root .udoc-collaboration__faces > svg {
        width: var(--udoc-btn-glyph);
        height: var(--udoc-btn-glyph);
    }
    .udoc-ui-root .udoc-collaboration__faces--paused > :not(.udoc-collaboration__badge) {
        opacity: 0.45;
    }
    .udoc-ui-root .udoc-collaboration__face {
        display: inline-flex;
        flex: none;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        box-shadow: 0 0 0 2px var(--udoc-toolbar-background);
        font-size: 11px;
        font-weight: 600;
        line-height: 1;
        color: #fff;
    }
    .udoc-ui-root .udoc-collaboration__faces > .udoc-collaboration__face + .udoc-collaboration__face {
        margin-left: -5px;
    }
    .udoc-ui-root .udoc-collaboration__face--you {
        background: var(--udoc-color-primary);
        color: var(--udoc-color-on-primary);
    }
    .udoc-ui-root .udoc-collaboration__more {
        margin-left: 4px;
        font-size: 11px;
        font-weight: 600;
        color: var(--udoc-color-on-surface-variant);
    }
    .udoc-ui-root .udoc-collaboration__badge {
        position: absolute;
        right: -4px;
        bottom: -4px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 13px;
        height: 13px;
        border-radius: 50%;
        background: var(--udoc-toolbar-background);
        color: var(--udoc-color-on-surface);
    }
    .udoc-ui-root .udoc-collaboration__badge > svg {
        width: 11px;
        height: 11px;
    }
    .udoc-ui-root .udoc-collaboration__badge--interrupted::after {
        content: "";
        width: 7px;
        height: 7px;
        border: 2px solid var(--udoc-color-outline-variant);
        border-top-color: var(--udoc-color-primary);
        border-radius: 50%;
        animation: udoc-busy-spin 0.8s linear infinite;
    }
    /* The people menu's roster: a face and a name per row, not a command — so no
   hover, and the default cursor. */
    .udoc-ui-root .udoc-collaboration__person {
        display: flex;
        align-items: center;
        gap: var(--udoc-btn-gap);
        padding: var(--udoc-menu-item-pad);
        color: var(--udoc-color-on-surface);
        font-size: var(--udoc-btn-font);
        white-space: nowrap;
        cursor: default;
    }
    .udoc-ui-root .udoc-collaboration__person > .udoc-collaboration__face {
        box-shadow: none;
    }
    .udoc-ui-root .udoc-collaboration__name {
        max-width: 24ch;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    /* The tab-strip slot takes the free space, so the right section must not also
   claim it via margin-left:auto. */
    .udoc-ui-root .udoc-toolbar__right {
        margin-left: 0;
    }

    /* The ribbon's tab strip — selects which tab's tools show in the ribbon's tool
   surface. The shell parents it into the toolbar's tab-strip slot, which takes
   the space between the toolbar's sections and centres the strip in it. The
   slot is as tall as the toolbar's content box, so the strip's flex-end lands
   on the toolbar's bottom edge (the bottom-anchor + folder-tab merge geometry
   below depends on it); its width, whatever the strip holds, is the room the
   ribbon fits the tabs to. */
    .udoc-ui-root .udoc-toolbar__tabs-slot {
        display: flex;
        flex: 1 1 0;
        min-width: 0;
        align-self: stretch;
        justify-content: center;
    }
    /* Ribbon-style tabs. The strip is outlined as one folder tab: its top edge level
   with the toolbar's buttons (a 32px button centred in the toolbar's 39px inner
   height leaves 3.5px), its sides running down to the toolbar's bottom edge and
   curving out into it. Inside, a closed tab is a borderless rounded button; the
   open tab is a real tab drawn on the strip's own outline — its top border on
   the strip's, and at either end its side and corner too — that breaks through
   the edge into the ribbon's tool surface below. It shares that surface's fill
   and covers the 1px seam so the two read as one continuous plane, its side
   borders extending the ribbon's outline up to the strip's. */
    .udoc-ui-root .udoc-ribbon__tabs {
        /* The corners' radius: the top corners' and the bottom fillets' (to the
       outside of their 1px ring), the strip's and the open tab's alike, so an
       open end tab's outline lies on the strip's. */
        --udoc-tab-radius: 8px;
        display: inline-flex;
        align-self: flex-end;
        align-items: flex-start;
        height: 35.5px;
        padding: 3px 0 0;
        border: 1px solid var(--udoc-color-outline-variant);
        border-bottom: none;
        border-radius: var(--udoc-tab-radius) var(--udoc-tab-radius) 0 0;
        position: relative;
    }
    /* A closed tab: from 7.5px — the strip's top, its border and its 3px top
   padding — down to 3px above the toolbar's line, the same gap below as above,
   so its label sits centred in the strip. It is held 4px off its neighbours
   and 3px off the strip's sides (the 4px less the 1px an end tab spends on the
   strip's border when open). */
    .udoc-ui-root .udoc-ribbon__tab {
        display: flex;
        align-items: center;
        height: 28.5px;
        margin: 0 4px;
        padding: 0 12px;
        border: 1px solid transparent;
        border-radius: 8px;
        background: transparent;
        color: var(--udoc-color-on-surface-variant);
        font-size: 13px;
        cursor: pointer;
        white-space: nowrap;
        user-select: none;
    }
    .udoc-ui-root .udoc-ribbon__tab:first-child {
        margin-left: 3px;
    }
    .udoc-ui-root .udoc-ribbon__tab:last-child {
        margin-right: 3px;
    }
    /* The More tab, closing the strip while tabs don't fit it: a closed tab
   holding the more glyph. Always the strip's last, held 4px off the tab before
   it and 3px off the strip's side — set outright, since inside its dropdown
   wrapper it is a first child and not a last. */
    .udoc-ui-root .udoc-ribbon__tab.udoc-ribbon__tab--more {
        margin: 0 3px 0 4px;
        padding: 0 4px;
    }
    .udoc-ui-root .udoc-ribbon__tab--more > svg {
        width: var(--udoc-btn-glyph);
        height: var(--udoc-btn-glyph);
    }
    .udoc-ui-root .udoc-ribbon__tab:not(.udoc-ribbon__tab--selected):hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
        color: var(--udoc-color-on-surface);
    }
    /* The open tab: up through the strip's padding onto its top border (3.5px) and
   down over the toolbar's border (to 40px), the 1px bottom padding over that
   seam keeping its label centred in the strip with the closed tabs'. Its
   margins go into its padding instead, so it takes the same width as when
   closed and no label moves; an end tab's outer margin reaches the strip's side
   border. */
    .udoc-ui-root .udoc-ribbon__tab--selected {
        background: var(--udoc-ribbon-background);
        border-color: var(--udoc-color-outline-variant);
        border-bottom: none;
        border-radius: var(--udoc-tab-radius) var(--udoc-tab-radius) 0 0;
        color: var(--udoc-color-on-surface);
        font-weight: 500;
        height: 36.5px;
        margin: -4px 0 0;
        padding: 0 16px 1px;
        position: relative;
        z-index: 1;
    }
    .udoc-ui-root .udoc-ribbon__tab--selected:first-child {
        margin-left: -1px;
    }
    .udoc-ui-root .udoc-ribbon__tab--selected:last-child {
        margin-right: -1px;
    }
    /* Outward-curving bottom corners, on the strip's outline and on the open tab's,
   so each flows into the edge below with a rounded fillet instead of a hard
   inside angle. The tabs, the ribbon and the toolbar share one plane by
   default (surface-container), so the fillet carries only the 1px border ring —
   continuing the outline around the curve down to the edge's line — rather than
   a tonal carve (folder-tab style, marked by the outline rather than a fill
   step). The open tab ends on the line's bottom, so its fillet covers the line
   and it opens into the ribbon. The strip ends on the line's top, so its fillet
   stops 1px short — cut off there, its ring runs into the line, and the line
   runs on beneath the strip. */
    .udoc-ui-root .udoc-ribbon__tabs::before,
    .udoc-ui-root .udoc-ribbon__tabs::after,
    .udoc-ui-root .udoc-ribbon__tab--selected::before,
    .udoc-ui-root .udoc-ribbon__tab--selected::after {
        content: "";
        position: absolute;
        bottom: 0;
        width: var(--udoc-tab-radius);
        height: var(--udoc-tab-radius);
    }
    .udoc-ui-root .udoc-ribbon__tabs::before,
    .udoc-ui-root .udoc-ribbon__tabs::after {
        height: calc(var(--udoc-tab-radius) - 1px);
    }
    .udoc-ui-root .udoc-ribbon__tabs::before,
    .udoc-ui-root .udoc-ribbon__tab--selected::before {
        left: calc(-1 * var(--udoc-tab-radius));
        background: radial-gradient(
            circle at top left,
            transparent calc(var(--udoc-tab-radius) - 1px),
            var(--udoc-color-outline-variant) calc(var(--udoc-tab-radius) - 1px),
            var(--udoc-color-outline-variant) var(--udoc-tab-radius),
            var(--udoc-ribbon-background) var(--udoc-tab-radius)
        );
    }
    .udoc-ui-root .udoc-ribbon__tabs::after,
    .udoc-ui-root .udoc-ribbon__tab--selected::after {
        right: calc(-1 * var(--udoc-tab-radius));
        background: radial-gradient(
            circle at top right,
            transparent calc(var(--udoc-tab-radius) - 1px),
            var(--udoc-color-outline-variant) calc(var(--udoc-tab-radius) - 1px),
            var(--udoc-color-outline-variant) var(--udoc-tab-radius),
            var(--udoc-ribbon-background) var(--udoc-tab-radius)
        );
    }

    /* Ribbon tool surface (second row) — the active tab's tools, undo/redo at the right. */
    .udoc-ui-root .udoc-ribbon__tools,
    .udoc-ui-root .udoc-ribbon__history {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    /* =========================================================================
   Side panels (desktop) — docked in-flow: each panel takes space from the
   viewport within its slot rather than overlaying the document, so the full
   page stays visible while a panel is open. Scoped past the 480px breakpoint
   so the mobile drawers (slide-overs by necessity at that width) are untouched.
   ========================================================================= */
    @container udoc-ui (min-width: 481px) {
        .udoc-ui-root .udoc-left-panel,
        .udoc-ui-root .udoc-right-panel {
            position: relative;
            height: 100%;
            z-index: auto;
            box-shadow: none;
        }
    }

    /* =========================================================================
   View controls (page nav + zoom + view mode)
   ----------------------------------------------------------------------
   A single component the shell re-parents between three hosts: inline in the
   top toolbar, the bottom floating bar, or the status bar.
   ========================================================================= */
    .udoc-ui-root .udoc-view-controls {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    /* Slot in the top toolbar's left zone (empty unless docked there). */
    .udoc-ui-root .udoc-toolbar__view-controls {
        display: flex;
        align-items: center;
    }
    /* Collapse the slot when the view controls aren't docked here (the default
   floating placement leaves it empty). An empty flex child still draws the
   parent's gap on both sides, which would double the space between the menu
   button and the pointer selector. Re-appears the moment the shell parents the
   controls in (no longer :empty). Its trailing divider — which fences the
   docked controls off from the pointer selector — collapses in lockstep, so it
   shows only alongside them. */
    .udoc-ui-root .udoc-toolbar__view-controls:empty,
    .udoc-ui-root .udoc-toolbar__view-controls:empty + .udoc-divider {
        display: none;
    }

    /* Docked in the top toolbar, the menus open downward instead of up. */
    .udoc-ui-root .udoc-view-controls--top .udoc-zoom-dropdown__menu,
    .udoc-ui-root .udoc-view-controls--top .udoc-view-mode-menu__dropdown {
        bottom: auto;
        top: calc(100% + 8px);
    }

    /* Status bar — a thin bottom bar; the view controls dock at its right edge. */
    /* A workbook's formula bar, above the grid, as tall as the toolbar: the Name
   Box, the ✕ / ✓ of an entry being typed (greyed while there is none), and the
   contents field. The field is a bordered one, as every field here is; the
   refusal of a save shows under the bar. */
    .udoc-ui-root .udoc-formula-bar {
        position: relative;
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        gap: 4px;
        height: 40px;
        padding: 0 4px;
        background: var(--udoc-status-bar-background);
        border-bottom: 1px solid var(--udoc-color-outline-variant);
        z-index: 12;
    }
    .udoc-ui-root .udoc-formula-bar[hidden] {
        display: none;
    }
    .udoc-ui-root .udoc-formula-bar__name {
        flex: 0 0 auto;
        width: 72px;
        height: 24px;
        line-height: 22px;
        box-sizing: border-box;
        padding: 0 6px;
        border: 1px solid var(--udoc-color-outline);
        border-radius: 3px;
        font-size: 13px;
        background: var(--udoc-color-surface-container-high);
        color: var(--udoc-color-on-surface);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .udoc-ui-root .udoc-formula-bar__input {
        flex: 1 1 auto;
        min-width: 0;
        height: 24px;
        box-sizing: border-box;
        padding: 3px 6px;
        border: 1px solid var(--udoc-color-outline);
        border-radius: 3px;
        font: inherit;
        font-size: 13px;
        line-height: 16px;
        resize: none;
        overflow: hidden;
        white-space: pre;
        background: var(--udoc-color-surface-container-high);
        color: var(--udoc-color-on-surface);
    }
    .udoc-ui-root .udoc-formula-bar__input:focus {
        outline: none;
        border-color: var(--udoc-color-on-surface-variant);
    }
    .udoc-ui-root .udoc-formula-bar__refusal {
        position: absolute;
        top: 100%;
        right: 4px;
        left: 4px;
        padding: 4px 8px;
        font-size: 12px;
        color: var(--udoc-color-error);
        background: var(--udoc-status-bar-background);
        border: 1px solid var(--udoc-color-outline-variant);
        border-top: none;
    }
    .udoc-ui-root .udoc-formula-bar__refusal[hidden] {
        display: none;
    }

    .udoc-ui-root .udoc-status-bar {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        height: 36px;
        padding: 0 4px;
        box-sizing: border-box;
        background: var(--udoc-status-bar-background);
        border-top: 1px solid var(--udoc-color-outline-variant);
        z-index: 11;
    }

    /* The sheet tabs' slot takes the bar's free space, so its width, whatever the
   tabs hold, is the room the sheet tabs fit to; the left region keeps only
   what its content needs. */
    .udoc-ui-root .udoc-status-bar__sheet-tabs {
        flex: 1 1 0;
        min-width: 0;
        align-self: stretch;
        display: flex;
        align-items: stretch;
        /* What the sheet tabs' refusal stands above. */
        position: relative;
    }

    .udoc-ui-root .udoc-status-bar__left {
        flex: 0 1 auto;
        min-width: 0;
    }

    .udoc-ui-root .udoc-status-bar__controls {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
    }

    /* =========================================================================
   Sheet tabs — the spreadsheet plane switcher on the status bar's left. It is
   the ribbon tab strip flipped upside down: the bar sits *below* the viewport,
   so the tabs round their BOTTOM corners and their open edge faces up, and the
   active tab is filled with the sheet surface (--udoc-bg-surface) so it reads
   as the active sheet's page flowing down out of the viewport into its label —
   the mirror of the ribbon's active tab merging into its tool surface.
   ========================================================================= */
    .udoc-ui-root .udoc-sheet-tabs {
        display: inline-flex;
        align-self: stretch;
        /* Flipped from the ribbon's flex-end: tabs top-align to the bar's top edge
       (the viewport boundary), so the active tab merges *up* into the page. */
        align-items: flex-start;
        gap: 2px;
        /* Spanning the room the status bar leaves it, however few its tabs, so
       the clip at its end falls at the room's end — past a tab that shows
       whole by the fold fillet's width, which the fit leaves it. */
        flex: 1 1 auto;
        min-width: 0;
        /* Clipped at its end only, where a scrolled strip's tabs run out of room,
       as Excel's do. On its other sides the clip stands off 8px: an overflow
       clip there would cut the active tab's lift over the bar's border, its
       fold fillets (the ::before/::after that extend past the tab, which give
       it the ribbon's folder-tab join), and a tab's focus ring. */
        clip-path: inset(-8px 0 -8px -8px);
        /* What a dragged tab's drop marker stands in. */
        position: relative;
    }
    /* A dragged tab: the hand holds it, and the marker shows where its sheet
   lands — a bar between the tabs, in the primary colour. */
    .udoc-ui-root .udoc-sheet-tabs--dragging,
    .udoc-ui-root .udoc-sheet-tabs--dragging .udoc-sheet-tab {
        cursor: grabbing;
    }
    .udoc-ui-root .udoc-sheet-tabs__drop {
        position: absolute;
        top: 0;
        bottom: 4px;
        width: 2px;
        margin-left: -2px;
        background: var(--udoc-color-primary);
        pointer-events: none;
        z-index: 2;
    }
    .udoc-ui-root .udoc-sheet-tabs__drop[hidden] {
        display: none;
    }
    /* The field a sheet's name is edited in, in place of its tab. */
    .udoc-ui-root .udoc-sheet-tab__input {
        flex: none;
        height: 26px;
        margin-top: 4px;
        padding: 0 8px;
        border: 1px solid var(--udoc-color-primary);
        border-radius: 3px;
        box-sizing: border-box;
        font: inherit;
        font-size: 13px;
        color: var(--udoc-color-on-surface);
        background: var(--udoc-color-surface-container-highest);
        outline: none;
        user-select: text;
    }
    /* Why the engine refused a name, above the field. */
    .udoc-ui-root .udoc-sheet-tabs__refusal {
        position: absolute;
        bottom: 100%;
        margin-bottom: 4px;
        padding: 4px 8px;
        font-size: 12px;
        white-space: nowrap;
        color: var(--udoc-color-error);
        background: var(--udoc-status-bar-background);
        border: 1px solid var(--udoc-color-outline-variant);
        border-radius: 4px;
        z-index: 3;
    }
    .udoc-ui-root .udoc-sheet-tabs__refusal[hidden] {
        display: none;
    }
    /* Excel's sheet navigation before the strip, shown with it: the arrows
   scrolling the strip a tab at a time, then the list of every sheet. */
    .udoc-ui-root .udoc-sheet-tabs__nav {
        display: flex;
        flex: none;
        align-items: center;
        margin-right: 4px;
    }
    .udoc-ui-root .udoc-sheet-tab {
        display: flex;
        align-items: center;
        /* The open tab's, less the 1px it lifts over the bar's border, so
       every tab's foot is on one line. */
        height: 33px;
        padding: 12px;
        border: 1px solid transparent;
        /* Flipped from the ribbon tab: the open edge faces up (toward the
       viewport), and the rounded corners are on the bottom. */
        border-top: none;
        border-radius: 0 0 8px 8px;
        background: transparent;
        color: var(--udoc-color-on-surface-variant);
        font-size: 13px;
        cursor: pointer;
        white-space: nowrap;
        user-select: none;
    }
    .udoc-ui-root .udoc-sheet-tab:not(.udoc-sheet-tab--selected):hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
        color: var(--udoc-color-on-surface);
    }
    /* The navigation's list of every sheet: the shared panel, opening upward from
   the status bar. A workbook can hold many sheets, so the list scrolls past 320px —
   inside a panel that clips it, as the font menu's does, so the radius rounds
   the scrollbar off too. Matched on both classes so it outranks .udoc-menu. */
    .udoc-ui-root .udoc-menu.udoc-sheet-tabs__menu {
        top: auto;
        bottom: calc(100% + var(--udoc-menu-gap));
        overflow: hidden;
        padding: 0;
    }
    .udoc-ui-root .udoc-sheet-tabs__menu-list {
        max-height: 320px;
        padding: var(--udoc-menu-pad-y) 0;
        overflow-y: auto;
        overflow-x: hidden;
    }
    .udoc-ui-root .udoc-sheet-tab--selected {
        /* The active sheet's own paper flowing down into its label: the canvas
       background, so the tab reads as a page poking out of the viewport, not a
       margin gap — the mirror of the ribbon's folder tab, which takes the
       ribbon's fill instead. */
        background: var(--udoc-canvas-background);
        border-color: var(--udoc-color-outline-variant);
        color: var(--udoc-color-on-surface);
        font-weight: 500;
        /* Lift over the status bar's top border so the tab joins the viewport. */
        height: 34px;
        margin-top: -1px;
        position: relative;
        z-index: 1;
    }
    /* Outward-curving top corners so the active tab flows up into the viewport with
   a rounded fillet (the ribbon's fold, mirrored). The gradient carves a
   quarter-circle of the sheet surface, and a 1px border-colored ring
   continues the tab's outline around the curve up to the viewport's edge. */
    .udoc-ui-root .udoc-sheet-tab--selected::before,
    .udoc-ui-root .udoc-sheet-tab--selected::after {
        content: "";
        position: absolute;
        top: 0;
        width: 7px;
        height: 7px;
    }
    .udoc-ui-root .udoc-sheet-tab--selected::before {
        left: -7px;
        background: radial-gradient(
            circle at bottom left,
            transparent 6px,
            var(--udoc-color-outline-variant) 6px,
            var(--udoc-color-outline-variant) 7px,
            var(--sheet-tab-top, var(--udoc-canvas-background)) 7px
        );
    }
    .udoc-ui-root .udoc-sheet-tab--selected::after {
        right: -7px;
        background: radial-gradient(
            circle at bottom right,
            transparent 6px,
            var(--udoc-color-outline-variant) 6px,
            var(--udoc-color-outline-variant) 7px,
            var(--sheet-tab-top, var(--udoc-canvas-background)) 7px
        );
    }
    /* A tab its sheet gives a colour (the sheet's tabColor, set on the tab as
   --sheet-tab-color, with --sheet-tab-label the black or white Excel letters
   it in). Content, not chrome: no role tints it. Unselected, it is filled
   solid, as Excel's are, and hovering lays the hover overlay over the colour
   rather than replacing it. */
    .udoc-ui-root .udoc-sheet-tab--colored:not(.udoc-sheet-tab--selected),
    .udoc-ui-root .udoc-sheet-tab--colored:not(.udoc-sheet-tab--selected):hover {
        background: var(--sheet-tab-color);
        color: var(--sheet-tab-label);
    }
    .udoc-ui-root .udoc-sheet-tab--colored:not(.udoc-sheet-tab--selected):hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }
    /* Selected, it keeps the page it opens onto and is washed in its colour from
   there down, as Excel's gradient runs: faint where it meets the viewport,
   deepest at its foot. Its fold fillets take the faint top, so they and the
   tab are one shape. */
    .udoc-ui-root .udoc-sheet-tab--colored.udoc-sheet-tab--selected {
        --sheet-tab-top: color-mix(in srgb, var(--sheet-tab-color) 8%, var(--udoc-canvas-background));
        background: linear-gradient(
            var(--sheet-tab-top),
            color-mix(in srgb, var(--sheet-tab-color) 45%, var(--udoc-canvas-background))
        );
    }

    /* Rubber-band swept over the canvas (above the overlay/selection layers, below
   the scrollbars). The base is the neutral marquee-zoom band; a marquee-*select*
   adds a --crossing / --enclose modifier so its colour echoes the sweep's rule. */
    /* Full-canvas clip layer for the marquee: clips the rubber-band to the content
   area (the shared overlay clip, set per-gesture) so a sweep never paints over
   the guide bands or the branding decal. */
    .udoc-ui-root .udoc-ui__marquee-clip {
        position: absolute;
        inset: 0;
        z-index: 2;
        pointer-events: none;
    }
    .udoc-ui-root .udoc-ui__marquee {
        position: absolute;
        pointer-events: none;
        border: 1px solid var(--udoc-canvas-marquee);
        background: var(--udoc-canvas-marquee-fill);
    }

    /* Rightward "crossing" select — picks anything the rect touches. */
    .udoc-ui-root .udoc-ui__marquee--crossing {
        border: 1px solid var(--udoc-canvas-marquee-crossing);
        background: var(--udoc-canvas-marquee-crossing-fill);
    }

    /* Leftward "window" select — picks only shapes the rect fully encloses. */
    .udoc-ui-root .udoc-ui__marquee--enclose {
        border: 1px solid var(--udoc-canvas-marquee-enclose);
        background: var(--udoc-canvas-marquee-enclose-fill);
    }

    /* What is being drawn — a pen stroke, a polygon's corners so far, a shape or
   text box being placed — in the marquee's clip layer, until the engine paints
   the real one. Its stroke is set per drawing from the tool's style. */
    .udoc-ui-root .udoc-ui__sketch {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
        pointer-events: none;
        fill: none;
    }

    /* A sketch whose line has no colour — a text box drawn without a border —
   still shows where it goes: a dashed hairline in the selection ink. */
    .udoc-ui-root .udoc-ui__sketch-guide {
        stroke: var(--udoc-canvas-selection);
        stroke-width: 1px;
        stroke-dasharray: 4 3;
        stroke-opacity: 1;
    }

    /* "Powered by docMentis" attribution: a transparent click target laid over the
   engine-painted mark (the visible pixels live in the canvas). The mark sits in
   the pane's bottom-right corner, in from the bars by their thickness, so a drag
   at a bar's end never lands on the link instead; the engine streams its
   position. */
    .udoc-ui-root .udoc-ui__branding {
        position: absolute;
        z-index: 3;
        cursor: pointer;
        background: transparent;
    }

    /* The repaint-area box (developer option): outlines the region the engine's
   latest frame repainted. Above every other layer in the canvas host so no
   chrome can hide it, and drawn as an inset outline rather than a border so the
   box lands exactly on the reported rect instead of growing a pixel each side.
   A deliberately FIXED red, not a theme role: it has to read against the page,
   the backdrop, and whatever document content sits under it, in both themes. */
    .udoc-ui-root .udoc-ui__repaint-area {
        position: absolute;
        z-index: 5;
        pointer-events: none;
        outline: 1px solid #f00;
        outline-offset: -1px;
    }

    /* === Developer options dialog === */
    .udoc-ui-root .udoc-dev-modal {
        position: absolute;
        inset: 0;
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .udoc-ui-root .udoc-dev-modal__backdrop {
        position: absolute;
        inset: 0;
        background: var(--udoc-color-scrim);
    }

    .udoc-ui-root .udoc-dev-modal__dialog {
        position: relative;
        z-index: 1;
        width: min(440px, calc(100% - 32px));
        max-height: calc(100% - 32px);
        overflow: auto;
        background: var(--udoc-color-surface-container-highest);
        border: 1px solid var(--udoc-color-outline-variant);
        border-radius: 8px;
        box-shadow: var(--udoc-elevation-4);
    }

    .udoc-ui-root .udoc-dev-modal__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid var(--udoc-color-outline-variant);
    }

    .udoc-ui-root .udoc-dev-modal__heading {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        color: var(--udoc-color-on-surface);
    }

    .udoc-ui-root .udoc-dev-modal__close {
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

    .udoc-ui-root .udoc-dev-modal__close:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }

    .udoc-ui-root .udoc-dev-modal__close svg {
        width: var(--udoc-btn-glyph);
        height: var(--udoc-btn-glyph);
    }

    .udoc-ui-root .udoc-dev-modal__body {
        padding: 6px 16px 12px;
    }

    .udoc-ui-root .udoc-dev-modal__option {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 12px 0;
        border-bottom: 1px solid var(--udoc-color-outline-variant);
        cursor: pointer;
    }

    .udoc-ui-root .udoc-dev-modal__option:last-child {
        border-bottom: none;
    }

    .udoc-ui-root .udoc-dev-modal__option-text {
        flex: 1 1 auto;
        min-width: 0;
    }

    .udoc-ui-root .udoc-dev-modal__option-label {
        font-size: 13px;
        font-weight: 500;
        color: var(--udoc-color-on-surface);
    }

    .udoc-ui-root .udoc-dev-modal__option-desc {
        margin-top: 2px;
        font-size: 12px;
        line-height: 1.4;
        color: var(--udoc-color-on-surface-variant);
    }

    .udoc-ui-root .udoc-dev-modal__switch {
        appearance: none;
        -webkit-appearance: none;
        flex: 0 0 auto;
        width: 36px;
        height: 20px;
        margin: 0;
        border-radius: 10px;
        background: var(--udoc-color-outline-variant);
        position: relative;
        cursor: pointer;
        transition: background 0.15s ease;
    }

    .udoc-ui-root .udoc-dev-modal__switch::after {
        content: "";
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        /* Switch handle: outline on the off track, on-primary once on (below).
       Never a hard-coded white — that failed to theme and left a white dot on the
       dark off track. */
        background: var(--udoc-color-outline);
        box-shadow: var(--udoc-elevation-1);
        transition: transform 0.15s ease;
    }

    .udoc-ui-root .udoc-dev-modal__switch:checked {
        background: var(--udoc-color-primary);
    }

    .udoc-ui-root .udoc-dev-modal__switch:checked::after {
        background: var(--udoc-color-on-primary);
        transform: translateX(16px);
    }

    .udoc-ui-root .udoc-dev-modal__switch:focus-visible {
        outline: 2px solid var(--udoc-color-primary);
        outline-offset: 2px;
    }

    /* === Performance counter HUD === */
    .udoc-ui-root .udoc-perf-hud {
        position: absolute;
        left: 12px;
        top: 12px;
        z-index: 40;
        padding: 6px 9px;
        border-radius: 6px;
        background: var(--udoc-color-inverse-surface);
        color: var(--udoc-color-inverse-on-surface);
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 11px;
        line-height: 1.4;
        white-space: nowrap;
        pointer-events: none;
        user-select: none;
    }

    .udoc-ui-root .udoc-perf-hud__title {
        font-weight: 600;
        opacity: 0.6;
        margin-bottom: 2px;
    }

    .udoc-ui-root .udoc-perf-hud__line {
        font-variant-numeric: tabular-nums;
    }

    /* === Print dialog (PrintModal) — which pages to print, and how finely. In
   the per-page settings dialog's look. === */
    .udoc-ui-root .udoc-print-modal {
        position: absolute;
        inset: 0;
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .udoc-ui-root .udoc-print-modal__backdrop {
        position: absolute;
        inset: 0;
        background: var(--udoc-color-scrim);
    }

    .udoc-ui-root .udoc-print-modal__dialog {
        position: relative;
        z-index: 1;
        width: min(380px, calc(100% - 32px));
        max-height: calc(100% - 32px);
        overflow: auto;
        background: var(--udoc-color-surface-container-highest);
        border: 1px solid var(--udoc-color-outline-variant);
        border-radius: 8px;
        box-shadow: var(--udoc-elevation-4);
    }

    .udoc-ui-root .udoc-print-modal__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid var(--udoc-color-outline-variant);
    }

    .udoc-ui-root .udoc-print-modal__heading {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        color: var(--udoc-color-on-surface);
    }

    .udoc-ui-root .udoc-print-modal__close {
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

    .udoc-ui-root .udoc-print-modal__close:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }

    .udoc-ui-root .udoc-print-modal__close svg {
        width: var(--udoc-btn-glyph);
        height: var(--udoc-btn-glyph);
    }

    .udoc-ui-root .udoc-print-modal__body {
        padding: 14px 16px 4px;
    }

    .udoc-ui-root .udoc-print-modal__section-label {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--udoc-color-on-surface-variant);
        margin-bottom: 8px;
    }

    .udoc-ui-root .udoc-print-modal__section-label:not(:first-child) {
        margin-top: 18px;
    }

    .udoc-ui-root .udoc-print-modal__radios {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .udoc-ui-root .udoc-print-modal__radio {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 32px;
        font-size: 13px;
        color: var(--udoc-color-on-surface);
        cursor: pointer;
    }

    .udoc-ui-root .udoc-print-modal__radio input[type="radio"] {
        margin: 0;
        accent-color: var(--udoc-color-primary);
    }

    .udoc-ui-root .udoc-print-modal__input,
    .udoc-ui-root .udoc-print-modal__select {
        height: 32px;
        padding: 0 8px;
        border: 1px solid var(--udoc-color-outline);
        border-radius: 6px;
        background: transparent;
        color: var(--udoc-color-on-surface);
        font-size: 13px;
        box-sizing: border-box;
    }

    .udoc-ui-root .udoc-print-modal__input:disabled {
        opacity: 0.5;
    }

    .udoc-ui-root .udoc-print-modal__input--page {
        width: 64px;
        font-variant-numeric: tabular-nums;
    }

    .udoc-ui-root .udoc-print-modal__input--custom {
        flex: 1 1 0;
        min-width: 0;
    }

    .udoc-ui-root .udoc-print-modal__select {
        width: 100%;
        cursor: pointer;
    }

    .udoc-ui-root .udoc-print-modal__input:focus,
    .udoc-ui-root .udoc-print-modal__select:focus {
        outline: none;
        border-color: var(--udoc-color-primary);
    }

    /* Always holds a line, so an error appearing doesn't move the buttons. */
    .udoc-ui-root .udoc-print-modal__error {
        min-height: 16px;
        margin: 8px 0 0;
        font-size: 12px;
        line-height: 16px;
        color: var(--udoc-color-error);
    }

    .udoc-ui-root .udoc-print-modal__footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 14px 16px;
        border-top: 1px solid var(--udoc-color-outline-variant);
    }

    .udoc-ui-root .udoc-print-modal__cancel {
        height: 34px;
        padding: 0 16px;
        border: 1px solid var(--udoc-color-outline-variant);
        border-radius: 6px;
        background: transparent;
        color: var(--udoc-color-on-surface);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
    }

    .udoc-ui-root .udoc-print-modal__cancel:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }

    .udoc-ui-root .udoc-print-modal__print {
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

    .udoc-ui-root .udoc-print-modal__print:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }

    .udoc-ui-root .udoc-print-modal__cancel:focus-visible,
    .udoc-ui-root .udoc-print-modal__print:focus-visible {
        outline: 2px solid var(--udoc-color-primary);
        outline-offset: 2px;
    }

    /* === Busy hold (BusyModal) — input refused while something finishes === */
    .udoc-ui-root .udoc-busy {
        position: absolute;
        inset: 0;
        /* Above the dialogs (z 100): a hold covers whatever is on screen, and that
       may include one of them. */
        z-index: 200;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    /* Nothing is drawn for the first fraction of a second. Input is already refused
   by then (BusyModal marks the root's content inert); this only decides when that
   becomes visible, so a wait that ends quickly leaves no trace on screen. The
   fade matters at that boundary: a hold that settles just after the reveal never
   gets past a few percent opacity, so the near-miss is a ghost, not a blink. */
    .udoc-ui-root .udoc-busy__backdrop {
        position: absolute;
        inset: 0;
        background: var(--udoc-color-scrim);
        opacity: 0;
        transition: opacity 120ms ease;
    }
    .udoc-ui-root .udoc-busy--shown .udoc-busy__backdrop {
        opacity: 1;
    }
    /* The licensing refusal, covering the whole component. Without a session
   nothing works, so the scrim is over everything rather than over the
   viewport alone; inert on the siblings is what actually refuses the input. */
    .udoc-ui-root .udoc-ui__license-notice {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        /* Above the chrome and the other dialogs. */
        z-index: 40;
    }
    .udoc-ui-root .udoc-ui__license-notice-backdrop {
        position: absolute;
        inset: 0;
        background: var(--udoc-color-scrim);
    }
    .udoc-ui-root .udoc-ui__license-notice-panel {
        position: relative;
        z-index: 1;
        max-width: 420px;
        padding: 20px 24px;
        text-align: center;
        background: var(--udoc-color-surface-container-highest);
        border: 1px solid var(--udoc-color-outline-variant);
        border-radius: 8px;
        box-shadow: var(--udoc-elevation-4);
    }
    .udoc-ui-root .udoc-ui__license-notice-title {
        margin: 0 0 8px;
        font-size: 15px;
        font-weight: 600;
        color: var(--udoc-color-on-surface);
    }
    .udoc-ui-root .udoc-ui__license-notice-body {
        margin: 0;
        font-size: 13px;
        color: var(--udoc-color-on-surface-variant);
    }
    .udoc-ui-root .udoc-busy__dialog {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        background: var(--udoc-color-surface-container-highest);
        border: 1px solid var(--udoc-color-outline-variant);
        border-radius: 8px;
        box-shadow: var(--udoc-elevation-4);
        opacity: 0;
        /* Untouchable until revealed, so a click during the silent wait can't land
       on a Cancel button the user can't see. Focus still reaches it — the trap
       needs somewhere inside to put it. */
        pointer-events: none;
        transition: opacity 120ms ease;
    }
    .udoc-ui-root .udoc-busy--shown .udoc-busy__dialog {
        opacity: 1;
        pointer-events: auto;
    }
    .udoc-ui-root .udoc-busy__spinner {
        flex: none;
        width: 18px;
        height: 18px;
        border: 2px solid var(--udoc-color-outline-variant);
        border-top-color: var(--udoc-color-primary);
        border-radius: 50%;
        animation: udoc-busy-spin 0.8s linear infinite;
    }
    @keyframes udoc-busy-spin {
        to {
            transform: rotate(360deg);
        }
    }
    .udoc-ui-root .udoc-busy__message {
        margin: 0;
        font-size: 13px;
        color: var(--udoc-color-on-surface);
    }
    .udoc-ui-root .udoc-busy__cancel {
        height: 30px;
        padding: 0 14px;
        margin-left: 8px;
        border: 1px solid var(--udoc-color-outline-variant);
        border-radius: 6px;
        background: transparent;
        color: var(--udoc-color-on-surface);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
    }
    .udoc-ui-root .udoc-busy__cancel:hover {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }
    .udoc-ui-root .udoc-busy__cancel:focus-visible {
        outline: 2px solid var(--udoc-color-primary);
        outline-offset: 2px;
    }

    /* === Loading overlay (LoadingOverlay) — what covers the body (the panels and
   the viewport) while a document opens: the wordmark and one bar. Its z-index
   holds inside the body's stacking context, over the panels and the viewport;
   the body as a whole sits under the dialogs (z 100), since a protected
   document asks for its password while it is still opening. === */
    .udoc-ui-root .udoc-loading {
        position: absolute;
        inset: 0;
        z-index: 95;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 14px;
        background: var(--udoc-canvas-background);
    }
    .udoc-ui-root .udoc-loading__logo svg {
        display: block;
        width: 124px;
        height: 20px;
    }
    .udoc-ui-root .udoc-loading__doc {
        fill: var(--udoc-color-on-surface);
    }
    .udoc-ui-root .udoc-loading__mentis {
        fill: var(--udoc-color-primary);
    }
    .udoc-ui-root .udoc-loading__track {
        width: 200px;
        height: 4px;
        border-radius: 2px;
        background: var(--udoc-color-outline-variant);
        overflow: hidden;
    }
    .udoc-ui-root .udoc-loading__fill {
        height: 100%;
        border-radius: 2px;
        background: var(--udoc-color-primary);
        transition: width 150ms ease;
    }
    /* Neither the size nor the end is known: a third of the bar runs across. */
    .udoc-ui-root .udoc-loading__fill--running {
        width: 30%;
        transition: none;
        animation: udoc-loading-run 1.5s ease-in-out infinite;
    }
    @keyframes udoc-loading-run {
        0% {
            transform: translateX(-100%);
        }
        100% {
            transform: translateX(333%);
        }
    }
    .udoc-ui-root .udoc-loading__label {
        font-size: 12px;
        color: var(--udoc-color-on-surface-variant);
        font-variant-numeric: tabular-nums;
    }

    /* === Password dialog (PasswordModal) — what a protected document needs to
   open. Covers the whole component, as the licensing notice does: until the
   document opens nothing works. === */
    .udoc-ui-root .udoc-password-modal {
        position: absolute;
        inset: 0;
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
    }
    .udoc-ui-root .udoc-password-modal__backdrop {
        position: absolute;
        inset: 0;
        background: var(--udoc-color-scrim);
    }
    .udoc-ui-root .udoc-password-modal__dialog {
        position: relative;
        z-index: 1;
        width: min(360px, 100%);
        background: var(--udoc-color-surface-container-highest);
        border: 1px solid var(--udoc-color-outline-variant);
        border-radius: 8px;
        box-shadow: var(--udoc-elevation-4);
    }
    .udoc-ui-root .udoc-password-modal__header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 14px 16px;
        border-bottom: 1px solid var(--udoc-color-outline-variant);
    }
    .udoc-ui-root .udoc-password-modal__icon {
        display: inline-flex;
        color: var(--udoc-color-on-surface-variant);
    }
    .udoc-ui-root .udoc-password-modal__icon svg {
        width: var(--udoc-btn-glyph);
        height: var(--udoc-btn-glyph);
    }
    .udoc-ui-root .udoc-password-modal__heading {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        color: var(--udoc-color-on-surface);
    }
    .udoc-ui-root .udoc-password-modal__body {
        margin: 0;
        padding: 14px 16px;
    }
    .udoc-ui-root .udoc-password-modal__message {
        margin: 0 0 12px;
        font-size: 13px;
        color: var(--udoc-color-on-surface-variant);
    }
    /* The show/hide toggle sits inside the field's right end. */
    .udoc-ui-root .udoc-password-modal__field {
        position: relative;
    }
    .udoc-ui-root .udoc-password-modal__input {
        width: 100%;
        height: 32px;
        padding: 0 36px 0 8px;
        border: 1px solid var(--udoc-color-outline);
        border-radius: 6px;
        background: transparent;
        color: var(--udoc-color-on-surface);
        font-size: 13px;
        box-sizing: border-box;
    }
    .udoc-ui-root .udoc-password-modal__input:focus {
        outline: none;
        border-color: var(--udoc-color-primary);
    }
    .udoc-ui-root .udoc-password-modal__toggle {
        position: absolute;
        top: 2px;
        right: 2px;
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
    .udoc-ui-root .udoc-password-modal__toggle:hover:not(:disabled) {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }
    .udoc-ui-root .udoc-password-modal__toggle svg {
        width: var(--udoc-btn-glyph);
        height: var(--udoc-btn-glyph);
    }
    /* Always holds a line, so a refusal appearing doesn't move the button. */
    .udoc-ui-root .udoc-password-modal__error {
        min-height: 16px;
        margin: 6px 0 0;
        font-size: 12px;
        line-height: 16px;
        color: var(--udoc-color-error);
    }
    .udoc-ui-root .udoc-password-modal__footer {
        display: flex;
        justify-content: flex-end;
        margin-top: 8px;
    }
    .udoc-ui-root .udoc-password-modal__unlock {
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
    .udoc-ui-root .udoc-password-modal__unlock:hover:not(:disabled) {
        background-image: linear-gradient(var(--udoc-state-hover) 0 0);
    }
    .udoc-ui-root .udoc-password-modal__unlock:disabled {
        opacity: 0.6;
        cursor: default;
    }
    .udoc-ui-root .udoc-password-modal__unlock:focus-visible {
        outline: 2px solid var(--udoc-color-primary);
        outline-offset: 2px;
    }
`;
