# UI Color System

The chrome's colors: a small set of neutral **color roles**, one CSS custom
property each, that every rule paints from; a few **component tokens** over them
for the chrome's regions and the marks drawn on the document; two themes, light
and dark. A host overrides any of them. The defaults live in
[`app/styles.ts`](../../packages/udoc-ui/src/app/styles.ts) with the rest of the
chrome CSS (see [UI Editor](ui-editor.md#styling)); the editor's
[`styles.ts`](../../packages/udoc-editor/src/styles.ts) paints from the same
tokens.

## Model

- **Two tiers.** A role is `--udoc-color-<role>`: what a color does, for the
  whole UI. A component token is `--udoc-<component>-<property>` and defaults to
  a role, or, for a mark on the document, to a literal. A region paints its fill
  from its component token and everything else from roles. There is no palette
  tier under the roles and no per-control tier over the components.
  Component tokens take the shape the metric tokens already have
  (`--udoc-menu-shadow`, `--udoc-btn-h`), so the word after `udoc-` tells the
  tier: `color`, `elevation` and `state` are the system families, any other word
  is a component.
- **Neutral.** Every role is a gray except `error` and `on-error`. A host's one
  hue is `primary`, which tints focus, selection and the filled button, so a
  branded UI is still a neutral frame around the document.
- **Lighter is raised, in both themes.** The canvas sits low, the chrome around
  it higher and anything floating highest, and each step up is lighter. Shadows
  grow in the same order, so tone and shadow always agree, and the white page is
  the lightest thing on the canvas, like paper on a desk.
- **Two hand-set values per role.** Light and dark are separate literals in
  `styles.ts`. Nothing is generated and no role derives from another, so
  overriding one moves nothing else.
- **States are opacities, not roles.** Four numbers give every control's hover,
  pressed, selected and disabled look (see [States](#states)).
- **The role names are Material 3's.** Its tonal palettes, tinted neutrals and
  elevation model are not used (see [Relationship to M3](#relationship-to-m3)).

## Color roles

The `--udoc-color-` prefix is dropped in the tables.

### Surface: the planes

| Role                        | Light     | Dark      | Paints                                                                                                                                   |
| --------------------------- | --------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `surface-container-lowest`  | `#e0e0e0` | `#121212` | Nothing yet: a well sunk below the canvas                                                                                                |
| `surface`                   | `#e6e6e6` | `#181818` | The canvas, via `--udoc-canvas-background`; the slide picker's preview well                                                              |
| `surface-container-low`     | `#ececec` | `#1e1e1e` | Nothing yet: a frame below the chrome, such as the toolbar stepping down from the ribbon                                                 |
| `surface-container`         | `#f3f3f3` | `#252525` | The chrome around the canvas, via the [region tokens](#component-tokens): toolbar, ribbon, panels, status bar, guide, scrollbar tracks   |
| `surface-container-high`    | `#f9f9f9` | `#2c2c2c` | Cards and text boxes inside a panel; the chrome floating over the canvas: floating toolbar, comment popup, annotation bar, page controls |
| `surface-container-highest` | `#ffffff` | `#333333` | Menus, tooltips, dialogs                                                                                                                 |

The ladder is M3's `surface` and its five containers, ordered the way M3 orders
them in its dark theme, in both of our themes: each rung is a height, and a
higher rung is lighter. A plane takes the rung for its height. A region that
wants another tone without changing height sets its region token instead. A
menu opened from a dialog shares the dialog's rung, and its frame sets it apart.
In light, the rungs between the canvas and the top sit about 6 levels apart, so
`-high` and `-highest` differ only slightly and lean on their frames and shadows.

### Content: text and icons

| Role                 | Light     | Dark      | Paints                                                                                                                                                                                    |
| -------------------- | --------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `on-surface`         | `#1f1f1f` | `#e8e8e8` | Text and icons on every surface                                                                                                                                                           |
| `on-surface-variant` | `#5f5f5f` | `#a8a8a8` | Secondary content: labels and section titles, metadata (comment author and date, page labels, the page total), placeholders, carets and close glyphs, unselected tabs, guide-band numbers |

One ink pair serves every rung. The rungs are neutrals a few steps apart, and
both inks hold at least 4.8:1 on each. `on-surface-variant` is a resting level,
not a state. Disabled is the control dimming itself (see [States](#states)), so a
secondary label inside a disabled control dims further and the two never look
alike.

### Outline: lines

| Role              | Light     | Dark      | Paints                                                                         |
| ----------------- | --------- | --------- | ------------------------------------------------------------------------------ |
| `outline`         | `#7f7f7f` | `#808080` | Field outlines (at least 3:1 on every rung); the guide band's marker color     |
| `outline-variant` | `#cccccc` | `#444444` | Dividers, panel / menu / dialog frames, the page border, guide-band grid marks |

### Primary: the one hue

| Role         | Light     | Dark      | Paints                                                                                                                                                 |
| ------------ | --------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `primary`    | `#2b2b2b` | `#e0e0e0` | Focus ring, the [selected overlay](#states), indicator bars (active panel tab, page insert line), switch track, filled button, checkbox `accent-color` |
| `on-primary` | `#ffffff` | `#1b1b1b` | Text and icons on a `primary` fill                                                                                                                     |

The default is the strongest ink of each theme, near-black and near-white. A host
brands the UI by setting this pair.

### Error

| Role       | Light     | Dark      | Paints                                                                  |
| ---------- | --------- | --------- | ----------------------------------------------------------------------- |
| `error`    | `#c62828` | `#f28b82` | Destructive actions, invalid input, error text                          |
| `on-error` | `#ffffff` | `#5c1410` | Text and icons on an `error` fill, such as a destructive confirm button |

### Inverse

| Role                 | Light     | Dark      | Paints                                                                            |
| -------------------- | --------- | --------- | --------------------------------------------------------------------------------- |
| `inverse-surface`    | `#2e2e2e` | `#e8e8e8` | A plane that must stand out from all the others: the perf HUD, transient messages |
| `inverse-on-surface` | `#f2f2f2` | `#1f1f1f` | Text and icons on it                                                              |

Tooltips are not inverse. A tooltip is the topmost floating plane, so it takes
`surface-container-highest` with an `outline-variant` frame and a shadow. The
tooltips today are OS-drawn `title` attributes.

### Utility

| Role    | Light            | Dark             | Paints         |
| ------- | ---------------- | ---------------- | -------------- |
| `scrim` | `rgba(0,0,0,.5)` | `rgba(0,0,0,.7)` | Modal backdrop |

### Not in the set

The M3 roles this set leaves out:

- **`secondary`, `tertiary` and their pairs.** These are a second and third hue,
  and a neutral UI has one. Secondary emphasis is `on-surface-variant` ink or an
  outlined control.
- **The hue containers** (`primary-container`, `error-container` and their
  `on-` pairs). These are tonal fills of a hue. Here a tinted fill is the hue at
  a state opacity over the plane (the selected overlay is `primary` at 14%), so
  it follows whatever sits beneath it and needs no role.
- **`surface-dim`, `surface-bright`, `surface-tint`.** Dim and bright would
  repeat the ladder's ends, and the tint is M3's elevation overlay, which the
  ladder's tones replace.

The surface ladder is whole, so a plane can change rung without a new role.
Any other role joins the set when something paints with it, under M3's name when
M3 has one.

## Component tokens

A component token exists for one of two reasons: a region's fill, or a color that
is not a role.

**Regions** are the fixed chrome around the canvas, the parts a host lines up
with its own app. Each has one fill token that defaults to the region's rung:

| Token                                | Default             | Painted by                                                                               |
| ------------------------------------ | ------------------- | ---------------------------------------------------------------------------------------- |
| `--udoc-toolbar-background`          | `surface-container` | `.udoc-toolbar`                                                                          |
| `--udoc-ribbon-background`           | `surface-container` | `.udoc-ribbon` and its selected tab                                                      |
| `--udoc-panel-background`            | `surface-container` | `.udoc-left-panel` and its tab strip, `.udoc-right-panel`                                |
| `--udoc-status-bar-background`       | `surface-container` | `.udoc-status-bar`                                                                       |
| `--udoc-canvas-background`           | `surface`           | The canvas host and the selected sheet tab; pushed to the engine as the page-gap color   |
| `--udoc-canvas-guide-background`     | `surface-container` | The guide bands: the ruler, a spreadsheet's row and column headers                       |
| `--udoc-canvas-scrollbar-background` | `surface-container` | The tracks of the scrollbars that take a strip of their own, and the corner between them |

A region token covers the fill only. The region's content keeps the roles' ink,
outlines and states, so the token picks a tone within its theme's ladder (the
ribbon a step apart from the toolbar, or the host's own gray); it does not invert
a region. Floating planes have no tokens of their own and read their rung
directly, so the ladder stays one decision.

**Chrome on the canvas** paints from roles like any other chrome, but for the
guide bands and the scrollbar tracks, which frame the canvas and fill from their
region tokens. The bands draw their grid in `outline-variant` and their numbers
in `on-surface-variant`, and mark the selected row or column with the selected
overlay. The page border is `outline-variant`. The page controls, the comment
popup and the annotation bar are `surface-container-high`. The scrollbar thumb
is the one color here that is not a role: `--udoc-scrollbar-thumb` and
`--udoc-scrollbar-thumb-hover`, `on-surface` at 30% and 50%.

**Marks on the document** are drawn over page content. They must read against
anything a page holds, in both themes, whatever the host's `primary` is; a
near-black selection would vanish into black text. Their defaults are literal
hues, not roles:

| Token                                        | Light                                         | Dark      | Marks                                                                                   |
| -------------------------------------------- | --------------------------------------------- | --------- | --------------------------------------------------------------------------------------- |
| `--udoc-canvas-selection`                    | `#0078d7`                                     | `#0078d7` | Selection outline and handles; its tint is this color at 15% (box, cell) and 30% (text) |
| `--udoc-canvas-hover`                        | `#7c3aed`                                     | `#7c3aed` | The hovered annotation's outline, a hue apart from the selection                        |
| `--udoc-canvas-marquee` (+ `-fill`)          | `#334155`                                     | `#94a3b8` | Marquee                                                                                 |
| `--udoc-canvas-marquee-crossing` (+ `-fill`) | `#1d4ed8`                                     | `#60a5fa` | Crossing marquee                                                                        |
| `--udoc-canvas-marquee-enclose` (+ `-fill`)  | `#15803d`                                     | `#4ade80` | Enclosing marquee                                                                       |
| `--udoc-canvas-search` / `-search-active`    | `rgba(255,235,59,.35)` / `rgba(255,152,0,.5)` | same      | Search hits, the current one                                                            |

A new mark, such as a link highlight, joins this group as `--udoc-canvas-<mark>`.

## States

```css
:where(.udoc-ui-root) {
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

/* the fill slot: what the control is */
.udoc-btn--selected {
    background-color: var(--udoc-state-selected);
}
/* the overlay slot: what the pointer is doing, painted over any fill */
.udoc-btn:hover:not(:disabled) {
    background-image: linear-gradient(var(--udoc-state-hover) 0 0);
}
.udoc-btn:active:not(:disabled) {
    background-image: linear-gradient(var(--udoc-state-pressed) 0 0);
}
.udoc-btn:focus-visible {
    outline: 2px solid var(--udoc-color-primary);
}
.udoc-btn:disabled {
    opacity: var(--udoc-state-disabled-opacity);
}
```

- **Hover and pressed** are the control's own ink (`currentColor`) at an opacity.
  That is right on every plane and on a filled button, where `on-primary` ink
  lightens a dark fill, with no rule per plane or per fill.
- **Selected** is `primary` at an opacity. It goes in `background-color`, the slot
  a control's lasting fill uses, while hover and pressed go in
  `background-image`, which paints over it. So selected-and-hovered needs no rule
  of its own, and the ink stays `on-surface`: a 14% tint keeps its contrast, so
  no fill needs a paired ink.
- **Focus** is a `primary` ring outside the fill, so it combines with every other
  state.
- **Disabled** dims the control itself, ink, outline and fill at once. The
  `:not(:disabled)` guard (with `[aria-disabled="true"]`) keeps hover and pressed
  off it.

Two rules keep the slots apart. A control never sets the `background` shorthand:
its fill goes in `background-color` and its state in `background-image`. A
control that owns its `background-image` for its shape (the ribbon and sheet
tabs draw their curves with gradients and pseudo-elements) paints the overlay on
a free `::after` instead. `:hover` sits behind `@media (hover: hover)`.

One shared rule in `styles.ts` lists every selectable control in an `:is()` and
sets the selected fill once. A component keeps only selection idioms that are
genuinely its own: the ribbon and sheet tabs show selection by joining the plane
beneath them, the panel tab by its indicator bar, the thumbnail by its ring.

At the defaults, selected sits a step darker than hover, and selected-and-hovered
a step darker again. Pressed and selected land within a few levels of each other,
which is acceptable because pressed lasts only while the pointer is down.

## Elevation

Shadows are not color roles. They are composite tokens (offset, blur and color in
one value), named by **level, not by component**: a surface picks the level it
belongs on and never coins a shadow of its own. Each level has to be visibly
different from its neighbours. Shadow and tone agree: a plane on
`surface-container` casts none, one on `surface-container-high` casts level 2,
and one on `surface-container-highest` casts level 3 (menus) or 4 (dialogs).

| Token                | Light            | Dark | Who                                   |
| -------------------- | ---------------- | ---- | ------------------------------------- |
| `--udoc-elevation-1` | `0 1px 3px` α.1  | α.3  | Thumbnail, skip link, switch handle   |
| `--udoc-elevation-2` | `0 2px 8px` α.15 | α.4  | Page, floating toolbar, comment popup |
| `--udoc-elevation-3` | `0 4px 16px` α.2 | α.5  | Every menu, via `--udoc-menu-shadow`  |
| `--udoc-elevation-4` | `0 8px 32px` α.3 | α.6  | Dialogs                               |

Shadows deepen in dark because a dark plane lifts less by tone. Drawers are not a
rung: `--udoc-elevation-drawer-start` and `-end` cast sideways (`±4px 0 20px`),
one per edge a panel docks to, and the two are kept in step.

## Fields are outlined

A **field** is a control that holds a value: the mode switch, the font and size
pickers, the page and zoom inputs, the page-setup controls. It is an `outline`
border with no fill, so it looks the same on every plane and takes the control
states unchanged. Its own states are the border darkening to
`on-surface-variant` under the pointer and turning `primary` on focus. The border
is the UI's one signal for a field and never groups buttons.

## Theming

`setTheme("light" | "dark" | "system")` drives two signals in lock-step on the
root. It toggles the `.udoc-ui-dark` class and sets `color-scheme` (`light`,
`dark`, or `light dark` to follow the OS). Under `system`, a
`prefers-color-scheme` listener re-toggles the class on every OS change. The
defaults key on the class; `color-scheme` keeps native form controls and
scrollbars in step and lets a host's `light-dark()` resolve.

The defaults are two blocks at zero specificity, so any host rule wins whatever
the stylesheet order:

```css
:where(.udoc-ui-root) {
    color-scheme: light dark;
    --udoc-color-surface: #e6e6e6;
    --udoc-color-surface-container: #f3f3f3;
    --udoc-color-surface-container-highest: #ffffff;
    --udoc-color-on-surface: #1f1f1f;
    /* … every role */
    --udoc-toolbar-background: var(--udoc-color-surface-container);
    --udoc-canvas-background: var(--udoc-color-surface);
    /* … every component token */
}
:where(.udoc-ui-root.udoc-ui-dark) {
    --udoc-color-surface: #181818;
    --udoc-color-surface-container: #252525;
    --udoc-color-surface-container-highest: #333333;
    --udoc-color-on-surface: #e8e8e8;
    /* … every role, and the canvas marks that differ */
}
```

A component token that names a role is declared once, in the base block. Its
`var()` resolves on the root against whichever theme's roles are in force there.

**Engine read-back.** The engine paints the page gaps and the page border, and
the guide bands are drawn on a canvas, so `shell.ts` pushes their colors on every
theme change: `--udoc-canvas-background` (`setBackdrop`),
`--udoc-canvas-guide-background` (the band background), `outline-variant`
(`setPageBorder`, the band grid), `outline` (the band marker),
`on-surface-variant` (the band text), and the selected highlight resolved opaque
over the band:
`color-mix(in srgb, var(--udoc-color-primary) var(--udoc-state-selected-opacity), var(--udoc-canvas-guide-background))`.
`getComputedStyle` does not resolve `var()` inside a custom property, so each
read sets a hidden probe element's `color` to the expression and reads back the
resolved `color`. For a `color-mix()` that comes back as `color(srgb …)`, which
the read-back parses along with hex and `rgb()`.

## Customization

A host sets any role or component token on `.udoc-ui-root`:

```css
/* brand: the one hue, per theme */
.udoc-ui-root {
    --udoc-color-primary: #0f766e;
    --udoc-color-on-primary: #ffffff;
}
.udoc-ui-root.udoc-ui-dark {
    --udoc-color-primary: #5eead4;
    --udoc-color-on-primary: #04312c;
}

/* a region a step apart */
.udoc-ui-root {
    --udoc-ribbon-background: #fafafa;
}
```

How many values a token needs depends only on how many themes the host runs:

- **One theme:** a single value per token, with `setTheme("light")` (or
  `"dark"`) pinning the scheme so the other theme never resolves.
- **Both themes, in one declaration:** `light-dark(<light>, <dark>)`, which
  resolves through `color-scheme` and needs that function's browser floor.
- **Both themes, in two blocks:** the base rule plus
  `.udoc-ui-root.udoc-ui-dark`, the form the defaults use, with no extra browser
  floor. The compound selector (0,2,0) outranks the base rule (0,1,0) whatever
  the order; a bare `.udoc-ui-dark` would tie it.

Overrides belong on the root. The state overlays resolve there, so a token set on
a descendant reaches that subtree's direct uses but not its hover or selected
colors.

## Relationship to M3

**Taken from M3:** every role name in the set: `surface` and the five
`surface-container` rungs, `on-surface` / `on-surface-variant`,
`primary` / `on-primary`, `error` / `on-error`,
`inverse-surface` / `inverse-on-surface` (the inverse family),
`outline` / `outline-variant` and `scrim`. Also taken: the order M3 gives the
surface ladder in its dark theme, and the disabled opacity of 38%.

**Not taken:**

- the seed and tonal palettes, and with them the tinted neutrals
- M3's light-theme order for the ladder, where higher containers are darker
- the secondary, tertiary and hue-container roles
- `surface-tint` and M3's two-shadow levels
- M3's state opacities (8 / 12 / 12 / 16): hover, pressed and selected here are
  6 / 12 / 14, and selected is an overlay rather than a container swap

## Status

Built: the roles, region tokens and canvas marks in both stylesheets, the states,
and the engine read-back. Not built: the `@media (hover: hover)` guard on the
hover rules.
