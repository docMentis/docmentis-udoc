# Gaps

What building mainshock found the udoc packages lacking, or doing other than
it needed, through their public API: one entry each, with what was needed,
what the API offers, and the workaround, if any. An entry stays until a
release fixes it, and then says which.

The two below were found by a first prototype of udoc end to end, which the
skeleton took out again; that step brings them back.

## udoc-server imports only over HTTP

**Needed.** The backend records an asset for each document it imports, under
the id udoc-server mints, so it imports the upload itself, then records it.

**Offered.** `createUDocServer` answers requests; importing is its
`POST /documents` route, with nothing an embedder calls in its own process.

**Workaround.** The backend posts the upload to its own `/udoc/documents`
route, over loopback, with a per-process token its gate admits. It reads the
body once more and makes a second HTTP round trip.

## Importing a small document takes over two seconds

**Seen.** Importing a 152 KB DOCX or a 583 KB PDF took about 2.5 s a time, where
the backend's own work beside udoc-server's import was one database insert;
the first import after the server started took 0.7 s. Why isn't looked into
yet: the import opens the upload, a session that asks for a permit, and saves
it as a checkpoint.
