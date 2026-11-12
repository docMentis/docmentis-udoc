---
description: Choose which parts of the docMentis viewer and editor show, restyle them with CSS variables, change their wording, and draw your own elements over the pages.
---

# Customize the UI

The viewer and the editor come with their whole UI: a toolbar and a ribbon,
side panels, page controls and dialogs. You can choose which parts show and
what people can do, restyle it to match your app, change its words, and add
elements of your own over the pages.

## Choose what shows

The options `create` takes decide which parts of the UI show:

<<< @/snippets/customize-the-ui/chrome.ts

| Option                                                                                              | What it shows                                                                                                                                     |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `showToolbar`                                                                                       | The toolbar, and the ribbon under it.                                                                                                             |
| `showLeftPanel`, `showRightPanel`                                                                   | The left side panel (thumbnails, outline, layers) and the right one (search, comments).                                                           |
| `showThumbnailPanel`, `showOutlinePanel`, `showLayersPanel`, `showSearchPanel`, `showCommentsPanel` | One panel each. A document shows only the panels its type has: the layers and comments are a PDF's, the outline a PDF's and a word document's.    |
| `activePanel`                                                                                       | The panel open at the start. `openPanel()` and `closePanel()` change it later.                                                                    |
| `showPrintButton`, `showDownloadButton`, `showThemeButton`, `showFullscreenButton`                  | The items of the toolbar's menu.                                                                                                                  |
| `showDeveloperButton`                                                                               | A Developer item in the menu, with the performance counter. Off by default.                                                                       |
| `viewControlsPlacement`                                                                             | Where page navigation and zoom go: `"floating"` over the pages, `"top-toolbar"` or `"status-bar"`. `setViewControlsPlacement()` moves them later. |
| `ribbonTabStyle`                                                                                    | How the ribbon's tabs show: `"icon"`, the default, with each name in a tooltip, or `"text"`, by name. `setRibbonTabStyle()` changes it later.     |
| `showNotesPanel`                                                                                    | A deck's speaker notes, open under its slides at the start.                                                                                       |
| `showFormulaBar`                                                                                    | A workbook's formula bar.                                                                                                                         |
| `showLoadingOverlay`, `hideAttribution`                                                             | The overlay that shows while a document opens, and the "Powered by docMentis" mark. Only a license can turn these off.                            |

Every `show…` option is on by default except `showDeveloperButton` and
`showNotesPanel`. The options without a call to change them, such as
`showToolbar`, are fixed once the viewer is created.
[`UDocOptions`](/api/Common/interfaces/UDocOptions) lists every option with its
default.

## Choose what people can do

| Option                     | What it does                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `enableCopy: false`        | Text can be selected, but not copied, in view mode.                                                                                                                                              |
| `enableAnnotation: false`  | A PDF's annotations, and every document's comments, can be read but not added, changed or deleted, and the Annotate tab is gone. Your own calls, such as `addPageAnnotation`, still change them. |
| `enableFormFilling: false` | A PDF's form shows as it is filled in, and can't be changed.                                                                                                                                     |
| `onLinkClick`              | Receives the URL of a link people click, in place of opening it in a new tab: to confirm it first, say, or open it elsewhere.                                                                    |

The editor adds options for its modes:

<<< @/snippets/customize-the-ui/editor.ts

`initialMode` is the mode it opens in, `"edit"` by default. `allowedModes`
limits the modes people can switch between, and the mode switch shows only
when there's more than one, unless `showModeSwitch: false` hides it.
`showPageControls: true` adds controls beside and between a PDF's pages in edit
mode, and `showRuler: false` drops the ruler.
[`UDocEditorOptions`](/api/udoc-editor/interfaces/UDocEditorOptions) has them
all.

## Theme

The UI has a light and a dark theme. The `theme` option picks one, or
`"system"` to follow the operating system's, and `setTheme()` changes it later.
People can switch it themselves from the toolbar's menu, unless you set
`showThemeButton: false`.

## Colors

Every color the UI uses is a CSS variable. Set them on `.udoc-ui-root`, the
element the UI puts in your container; the dark theme adds the class
`udoc-ui-dark` to it. The defaults have no specificity, so your rules win
whatever order the stylesheets load in.

The UI is neutral gray, with one hue: `--udoc-color-primary`, which colors
focus rings, selected controls, switches and filled buttons. To give it your
brand's, set it for each theme:

```css
.udoc-ui-root {
    --udoc-color-primary: #4f46e5;
    --udoc-color-on-primary: #ffffff;
}

.udoc-ui-root.udoc-ui-dark {
    --udoc-color-primary: #a5b4fc;
    --udoc-color-on-primary: #1e1b4b;
}
```

If your app runs one theme, set one value and pin the theme with the `theme`
option. Set the variables on `.udoc-ui-root` itself, not on an element inside
it: the hover and selected colors are worked out there.

Style the UI through these variables. A rule that reaches into it by its class
names depends on how it's built inside, which can change from one release to
the next.

### Color roles

The roles every part of the UI paints from:

| Variable                                 | Paints                                                 | Light     | Dark      |
| ---------------------------------------- | ------------------------------------------------------ | --------- | --------- |
| `--udoc-color-surface`                   | The area around the pages                              | `#e6e6e6` | `#181818` |
| `--udoc-color-surface-container`         | The toolbar, the ribbon, the panels and the status bar | `#f3f3f3` | `#252525` |
| `--udoc-color-surface-container-high`    | Cards in a panel, and what floats over the pages       | `#f9f9f9` | `#2c2c2c` |
| `--udoc-color-surface-container-highest` | Menus and dialogs                                      | `#ffffff` | `#333333` |
| `--udoc-color-on-surface`                | Text and icons                                         | `#1f1f1f` | `#e8e8e8` |
| `--udoc-color-on-surface-variant`        | Secondary text: labels, dates, placeholders            | `#5f5f5f` | `#a8a8a8` |
| `--udoc-color-outline`                   | The borders of fields                                  | `#7f7f7f` | `#808080` |
| `--udoc-color-outline-variant`           | Dividers, frames and the page border                   | `#cccccc` | `#444444` |
| `--udoc-color-primary`                   | Focus, selection, switches and filled buttons          | `#2b2b2b` | `#e0e0e0` |
| `--udoc-color-on-primary`                | Text and icons on the primary color                    | `#ffffff` | `#1b1b1b` |
| `--udoc-color-error`                     | Errors and destructive actions                         | `#c62828` | `#f28b82` |
| `--udoc-color-on-error`                  | Text and icons on the error color                      | `#ffffff` | `#5c1410` |
| `--udoc-color-scrim`                     | The backdrop behind a dialog                           | 50% black | 70% black |

A lighter surface stands higher, in both themes: the area around the pages
lowest, the chrome above it, and menus and dialogs on top.

### Regions

Each region of the UI takes its fill from a variable of its own, so you can set
one apart without changing the rest:

| Variable                             | Region                                                | Default                          |
| ------------------------------------ | ----------------------------------------------------- | -------------------------------- |
| `--udoc-toolbar-background`          | The toolbar                                           | `--udoc-color-surface-container` |
| `--udoc-ribbon-background`           | The ribbon                                            | `--udoc-color-surface-container` |
| `--udoc-panel-background`            | The side panels                                       | `--udoc-color-surface-container` |
| `--udoc-status-bar-background`       | The status bar                                        | `--udoc-color-surface-container` |
| `--udoc-canvas-background`           | The area around the pages, and the gaps between them  | `--udoc-color-surface`           |
| `--udoc-canvas-guide-background`     | The ruler, and a spreadsheet's row and column headers | `--udoc-color-surface-container` |
| `--udoc-canvas-scrollbar-background` | The scrollbars' tracks                                | `--udoc-color-surface-container` |

### Marks on the page

What the UI draws over a page has colors of its own, which read against
anything a page holds, whatever your primary color is:

| Variable                                                 | Marks                                   |
| -------------------------------------------------------- | --------------------------------------- |
| `--udoc-canvas-selection`                                | The selection, its handles and its tint |
| `--udoc-canvas-hover`                                    | The annotation under the pointer        |
| `--udoc-canvas-search`, `--udoc-canvas-search-active`    | Search matches, and the current one     |
| `--udoc-canvas-marquee` and its `-fill`                  | A selection drawn by dragging           |
| `--udoc-scrollbar-thumb`, `--udoc-scrollbar-thumb-hover` | The scrollbars' thumbs                  |

### States

A control's hover, pressed, selected and disabled looks are opacities:
`--udoc-state-hover-opacity` (6%), `--udoc-state-pressed-opacity` (12%) and
`--udoc-state-selected-opacity` (14%) of its color, and
`--udoc-state-disabled-opacity` (38%) for a disabled control.

## Words

The UI speaks English, Simplified and Traditional Chinese, Japanese, Korean,
Spanish, French, German, Brazilian Portuguese, Arabic and Russian. It follows
the browser's language unless the `locale` option names one, such as
`"zh-CN"`. A language it doesn't ship falls back to one in the same language
and script, then to English.

The `translations` option replaces any of its strings by key, to use your own
wording or to supply a language it doesn't ship:

<<< @/snippets/customize-the-ui/translations.ts

[`Messages`](/api/Common/interfaces/Messages) lists the keys. The editor adds
those of edit mode, in its own
[`Messages`](/api/udoc-editor/interfaces/Messages).

## Draw over the pages

`setOverlay(id, source)` adds elements of your own over the pages: a button,
a badge, a marker. They follow the pages as the view scrolls and zooms.

<<< @/snippets/customize-the-ui/overlay.ts

The source is called each time the view is painted, with the
[frame](/api/Common/interfaces/OverlayFrame): the pages on screen, each with its
index and its box in CSS pixels, and the `scale` from document points to CSS
pixels. It returns an [item](/api/Common/interfaces/OverlayItem) for each
element to show:

- `key` names the element from one frame to the next, so the same key moves
  the same element rather than making a new one. An element whose key is no
  longer returned, as when its page scrolls away, is removed.
- `x` and `y` are where the element's top-left corner goes, in CSS pixels. Set
  `scale` to have it grow and shrink with the zoom.
- `create()` makes the element the first time its key appears, and `update()`
  refreshes it on every frame.

The source runs on every frame, so keep it quick, and work out everything from
the frame it's given. The layer lets the pointer through to the page, so an
element that takes clicks sets `pointer-events: auto`. In a workbook, the
frame's `sheet` says which sheet its pages are on.

`removeOverlay(id)` removes an overlay. The UI's own elements over the pages are
overlays too, under ids that start with `udoc:`, so you can remove one, such as
`udoc:annotation-bar`, the bar over a selected annotation, and draw your own in
its place. Pass `{ aboveSelection: true }` to `setOverlay` to draw above the
selection's handles, as that bar does.
