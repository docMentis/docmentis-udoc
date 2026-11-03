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
