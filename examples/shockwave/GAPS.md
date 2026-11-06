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

**Workaround.** The backend renders each version's first page once, as it's
uploaded or saved; keeps it in its database; and serves it from
`/api/thumbnails/:assetId/:number`, for a browser to keep for good
(`server/routes/thumbnails.ts`). The other pages a card in the Library flips to
are asked of udoc-server, and rendered again after a reload.

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

## Nothing says a client's edits have reached the server

**Needed.** A version that holds every edit made before it was saved.

**Offered.** The editor sends an edit as it's made, over its collaboration
socket, with nothing to wait on: no call or event says the server has merged
it, and `requestRemoteCheckpoint` doesn't wait for it either. A checkpoint taken
just after an edit may be taken before that edit lands.

**Workaround.** Saving a version goes through a dialog, which takes longer than
an edit takes to arrive, and is refused while the editor isn't joined. On a slow
enough connection, an edit made just before saving could still land in the next
version.

## Comments and annotations are a PDF's alone

**Needed.** A reviewer marking up what they're reviewing, whatever its format:
most of what's reviewed here is decks and word documents.

**Offered.** The Annotate tab, the comments panel and `addPageAnnotation` work
on a PDF. A deck or a word document has none of them.

**Workaround.** A reviewer returns a version with a written note, for every
format. Marking one up waits on this.

## A new upload can't become a version of a document

**Needed.** A revised file, edited in PowerPoint on someone's own computer,
uploaded as the next version of the file it revises.

**Offered.** `POST /documents` always keeps an upload as a new document, with a
new id. A checkpoint is only ever of the session's own edits, so no route adds
an upload to a document's line of checkpoints.

**Workaround.** None yet: a file is revised in the editor.

## A checkpoint's pages have no images

**Needed.** A thumbnail of each version, and a card that flips through the pages
of the version published.

**Offered.** `layout/pages/:index` renders the document as it is now, and has no
form for a checkpoint. A checkpoint opens in the viewer, and copies through
`file.:format`, but its pages can't be asked for as images.

**Workaround.** Saving a version renders its first page as it is then, and keeps
it as that version's thumbnail. A card in the Library flips through the working
copy's other pages, which only those who read the Library see. A card in
Collections, or on a frontstage, shows its version's first page alone, and doesn't
flip.

## A document can't be copied

**Needed.** A deal room's own copy of a version the library published, to edit apart
from it, with the same pages.

**Offered.** udoc-server has no route that copies a document or forks a checkpoint.
`checkpoints/:version/file.udoc` answers a package, but `POST /documents` turns it down:
"a udoc package is not a document to import".

**Workaround.** The backend saves the checkpoint in its own format, through
`checkpoints/:version/file.:format`, and imports that; for a format udoc-server can't
save, it imports the original (`server/udoc.ts`). Each copy costs a save and an import,
each a session that asks for a permit. Measured once, through the upload route, whose
import also renders a first page: a 19 KB word document took 0.5 s to save and 1.5 s to
import, and an 82 MB deck 0.7 s and 3.9 s. The copy has no history of its own, and the
bytes kept aren't the upload's.

## A rounded clip around the editor shows old frames among new ones

**Needed.** The editor in a card with rounded corners, clipped to them.

**Offered.** With `overflow: hidden` and a `border-radius` on an element around
the editor, Chrome on a Mac showed old and new frames in turn for a few seconds
after the selection changed, in step with the caret's blink: a click on other
text showed the caret there, then the previous selection again, then the caret;
the ruler's markers went back and forth with it. The page's elements and the
engine's reports held the right values throughout, and the same steps showed
nothing while Chrome's screencast was running. A square clip, or a caret that
didn't blink, showed none of it. The caret blinked by opacity, with a backdrop
filter.

**Workaround.** None needed here: udoc-ui's caret now blinks by visibility, which
this checkout's packages have and the next release will bring.

## A viewer in a form submits it

**Needed.** The upload dialog's preview, a viewer on the file, beside the
fields that name it.

**Offered.** The viewer's buttons have no `type`, so in a form each is a
submit button: going to a page, zooming or choosing a tool submits it, as
Enter in its page or zoom number does.

**Workaround.** The dialog's form holds its fields alone, the preview beside
it.

## A viewer's skip link shows outside it until something clips it

**Needed.** A viewer in a dialog, with nothing above it hidden.

**Offered.** The viewer's "Skip to document" link waits 100 pixels above
the viewer until it's focused, hidden only when something around the viewer
clips it; over a dialog's scrim, it shows.

**Workaround.** The upload dialog's preview clips its viewer, as the file's
page and the brand settings do theirs.
