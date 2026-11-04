# Gaps

What building shockwave found the udoc packages lacking, or doing other than
it needed, through their public API: one entry each, with what was needed,
what the API offers, and the workaround, if any. An entry stays until a
release fixes it, and then says which.

## udoc-server is driven only over HTTP

**Needed.** The backend records an asset for each document it imports, under
the id udoc-server mints, so it imports the upload itself, then records it;
and it deletes a file's document when the file is deleted.

**Offered.** `createUDocServer` answers requests; importing is its
`POST /documents` route, and deleting its `DELETE /documents/:id`, with
nothing an embedder calls in its own process. Its `DocumentStore` is public,
so an embedder could import by hand, opening the upload with `UDocNode` and
putting its package in the store, but that copies the route: its refusal of
a package, its password, the form of its ids. And deleting from the store
alone leaves the server's open session and collaboration on the document.

**Workaround.** The backend asks its own `/udoc/documents` routes, over
loopback, with a per-process token its gate admits (`server/udoc.ts`). It
reads an upload's body once more and makes a second HTTP round trip.

## Importing a small document takes over half a second

**Seen.** With the 0.8.15 engine, importing took 0.55 to 0.6 s a time on a
quiet machine, the same for a 60 KB PPTX, a 152 KB DOCX and a 583 KB PDF: a
cost of the import itself, not of the bytes. The backend's own work beside it
is one database insert. Why isn't looked into yet: the import opens the
upload, a session that asks for a permit, and saves it as a checkpoint.
Before, with an earlier engine, it was about 2.5 s.

## A workbook's first page is all of its first sheet

**Needed.** A thumbnail of each file in the library's grid: its first page,
as an image.

**Offered.** udoc-server's `GET /documents/:id/layout/pages/0.png` renders
page 0, and a workbook's page 0 is the whole of its first sheet: a sample
schedule's is 1.47 million points wide, so its PNG is refused, "output width
736527 exceeds u16", and its SVG is 58 MB. The print pages
`layout/pages.pdf` exports aren't rendered one at a time, and no route
renders a part of a page.

**Workaround.** A workbook is kept as having no thumbnail, and its card
shows its type's badge.

## A page's image is rendered again on each request

**Needed.** A file's thumbnail, shown at once each time the grid shows the
file.

**Offered.** udoc-server renders a page's image on each request, and answers
with no `Cache-Control`, `ETag` or `Last-Modified`, so a browser asks again
each time. The first answer for a document took 0.8 to 1.3 s, which opens it;
later ones, while udoc-server kept it open, 5 to 25 ms.

**Workaround.** The backend renders a file's first page once, on upload, or
for a file uploaded before, when it's first asked for; keeps it in its
database; and serves it from `/api/thumbnails/:documentId`, for a browser to
keep for good (`server/routes/thumbnails.ts`). The other pages a card flips
to are asked of udoc-server, and rendered again after a reload.

## A page at an IPv6 address can't verify free usage

**Needed.** The viewer opening a document on a page served at an IPv6
address, as `http://[::1]:5290`, an instance tested beside another whose
cookies, at `localhost`, it mustn't touch.

**Offered.** The browser packages send the page's `window.location.hostname`
as its domain (udoc-ui's `sessionConfigOf`), which keeps an IPv6 address's
brackets, `[::1]`; the permit comes back issued for `::1`, without them; and
the engine compares the two as they are, so every open there fails: "Cannot
verify free usage: permit issued for '::1', not '[::1]'". A page at a host
name opens as it should.

**Workaround.** None in shockwave: a second instance is tested at
`shockwave.localhost` instead, a name, whose cookies are its own too.

## A background changed on the fly isn't painted until the theme changes

**Needed.** The viewer's background changed while it's open, the preview in
the brand settings showing it as it's chosen.

**Offered.** The engine paints the background around the pages, and the
viewer hands it `--udoc-canvas-background` only as it applies a theme, when
it opens and when its theme changes. The toolbar's and the primary's colors,
which the browser paints, show at once; the background stays as it was.

**Workaround.** When the background changes, `DocumentViewer` sets the
viewer's theme to one that looks the same, the system's or the one the
system shows, and its own again, a microtask apart, so that it hands the
engine the background again.
