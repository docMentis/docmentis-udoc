---
description: Draw text, a shape or an image over a document's pages, on screen, in print and in every export, and control exactly where it lands.
---

# Watermarks

A watermark is text, a shape or an image drawn over a document's pages: on
screen, in thumbnails and slide shows, in print, and in `exportToBytes` and
`exportPageToBytes`. It works on every document type the viewer and the editor
open, and the same call is on `UDocSession` in `@docmentis/udoc-node`.

<<< @/snippets/watermarks/text.ts

`setWatermarks` replaces whatever was set before, and `[]` clears it. Later
watermarks in the list draw on top of earlier ones, so two can be stacked, for
instance text over a shape. It rejects if a watermark can't be drawn, and then
leaves the ones before in place. It stays set across `open`, and setting it before
the first `open` means no frame ever shows without it.

::: warning A watermark is not saved or enforced
`saveToBytes` and the Download button give the document as it is, in its own
format, with no watermark. Set `showDownloadButton: false` if that file shouldn't
be handed out, or offer `exportToBytes("pdf")` instead. In a browser a watermark
deters; it doesn't protect, because the document is already on the viewer's machine.
:::

## What it draws

| `content` | Fields                                                           | Its box                                                                                  |
| --------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `text`    | `fontFamily`, `bold`, `italic`, `size` (points), `color`, `text` | As wide as the text and as tall as its font's ascent and descent. One line, no wrapping. |
| `shape`   | `path`, `fillColor`, `strokeColor`, `strokeWidth` (points)       | What it paints, stroke included.                                                         |
| `image`   | `pixels`, `width`, `height`, `scale`                             | `width / scale` by `height / scale` points.                                              |

A colour is `{ colorSpace: "srgb", components: [r, g, b] }`, each from 0 to 1.
`opacity` runs from 0, invisible, to 1, and applies to the whole watermark.

<<< @/snippets/watermarks/shape.ts

An image's `pixels` are its decoded samples, not a PNG or JPEG file: four bytes a
pixel in `R, G, B, A` order, top row first, as `getImageData` gives them. In Node,
decode the file with a library of your choice. `scale` is pixels per point, so `1`
draws each pixel a point across, and `2` suits a logo made for high-density screens.

<<< @/snippets/watermarks/image.ts

## Which pages

- `target: "all"` draws on every page.
- `target: { pages: { plane: 0, indices: [0, 3] } }` draws on those pages, counted
  from 0. A page the document doesn't have is passed over.

`plane` is `0`, except in a workbook, where each sheet is a plane: `plane: 2` is the
third sheet.

## Where it lands

Everything is measured on **the page as it is shown**, in points, with x to the right
and y down. On a page turned a quarter turn, the top right is the top right on screen.
Anything past the page's edge is cut off.

### One copy: `at`

```ts
placement: {
    at: {
        (anchor, offsetX, offsetY, rotation);
    }
}
```

These four steps happen in this order:

1. **Rotate** the watermark about its own centre by `rotation` degrees. Positive is
   clockwise, so `-45` is the diagonal rising to the right.
2. **Take its bounding box**: the upright rectangle just holding the rotated
   watermark. With no rotation, that is the watermark's own box.
3. **Align** the bounding box to the page by `anchor`, which names the same point on
   both. `"center"` puts its centre on the page's centre, never its corner, and
   `"topRight"` puts its top-right corner on the page's top-right corner.
4. **Move** it by `offsetX` to the right and `offsetY` down. Negative goes the other
   way.

`anchor` is one of `"topLeft"`, `"top"`, `"topRight"`, `"left"`, `"center"`,
`"right"`, `"bottomLeft"`, `"bottom"`, `"bottomRight"`.

```text
 center, (0, 0)    topRight, (0, 0)   topRight, (-24, 24)  bottomLeft, (24, -24)
 ┌────────────┐    ┌────────┬───┐     ┌────────────┐       ┌────────────┐
 │            │    │        │ W │     │       24↓  │       │            │
 │    ┌───┐   │    │        └───┤     │      ┌───┐ │       │            │
 │    │ W │   │    │            │     │      │ W │←24      │24→┌───┐    │
 │    └───┘   │    │            │     │      └───┘ │       │   │ W │    │
 │            │    │            │     │            │       │   └───┘    │
 └────────────┘    └────────────┘     └────────────┘       └─────24↑────┘
```

To keep a watermark inside the page from a corner, the offset has to point inward,
which is why it is `(-24, 24)` at the top right and `(24, -24)` at the bottom left.
Because it is the rotated bounding box that aligns, a watermark at a corner stays
whole on the page at any rotation, as long as it fits.

For a watermark 100 points wide and 50 tall on a 600 by 800 page:

| `anchor`       | `offsetX`, `offsetY` | `rotation` | Where it lands                                       |
| -------------- | -------------------- | ---------- | ---------------------------------------------------- |
| `"center"`     | 0, 0                 | 0          | x 250–350, y 375–425                                 |
| `"center"`     | 0, 0                 | 90         | Its centre stays at (300, 400); x 275–325, y 350–450 |
| `"topRight"`   | -24, 24              | 0          | x 476–576, y 24–74                                   |
| `"bottomLeft"` | 0, 0                 | 90         | x 0–50, y 700–800                                    |

### Copies across the page: `tile`

```ts
placement: {
    tile: {
        (gapX, gapY, rotation);
    }
}
```

1. **Rotate** the watermark about its own centre and take its bounding box, as above.
2. The first copy's bounding box stands in the page's **top-left corner**.
3. Each next copy in a row stands `gapX` to the right of the one before, and each next
   row `gapY` below. The gap runs from one bounding box to the next, not from centre to
   centre, and can't be negative.

Each copy turns on its own centre, so the rows stay straight. A watermark 100 by 50
with `gapX: 50`, `gapY: 30` and no rotation has copies at x 0, 150, 300, … and y 0,
80, 160, ….

### Spreadsheets and long pages

A worksheet's grid is far larger than the part in use, so for `at` the "page" is its
used range, from A1: `"center"` is the centre of the data, and moves as the data grows.
`tile` fills the whole grid, so use it to keep a watermark in view as a sheet scrolls.
Use it the same way for a document shown without page breaks, which is one long page.
