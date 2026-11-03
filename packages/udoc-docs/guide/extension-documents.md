---
description: Open what the docMentis engine doesn't read, such as video, web pages, Canva designs, Google Docs or a format of your own, in the viewer and the editor, and register an extension document for it.
---

# Extension documents

An extension document is a kind of document the docMentis engine doesn't read,
which the viewer and the editor open anyway. Your code renders it into the
document area, and the UI around it stays as it is. Four are built in, for video
and audio, web pages, Canva designs and Google files, and you can register your
own for any other kind of file.

An extension document opens view only, in the editor too.

## The built-in ones

**Media** plays video and audio: a file, an HLS stream, or a YouTube or Vimeo
video by its address. It plays in [Video.js](https://videojs.org/) 10, which
`@docmentis/udoc-ui` bundles, so you install nothing more, and which loads only
when a video or audio file opens. A file with no picture plays in an audio
player. A YouTube or Vimeo video that won't play in the page offers a link to
it on its site.

**Web page** frames a page in a sandboxed iframe, under a bar with its address
and an "Open in new tab" link. It frames a URL only when `open` is given
`format: "url"`, because any URL could just as well be a PDF to open. A site
that refuses to be framed leaves the browser's error page in the frame, which
is why the link always shows. The page follows the UI's theme through its
`prefers-color-scheme`.

**Canva** and **Google** show a link to a Canva design, or to a Google Docs,
Sheets or Slides file, on that service's own read-only page, under the same bar.
`open` knows the link by its address, so it needs no `format`, and an `/edit`
link opens read-only too. The controls in the page are the service's.

They show what the reader can already open, such as a public or link-shared
file. A private file depends on the reader's own sign-in reaching the frame,
which browsers that restrict third-party cookies, such as Safari and Firefox,
can prevent. To show private files yourself, export them with the service's API
and pass the result to `open`. That opens a copy in the engine, which people can
edit in the editor, so use the viewer if it has to stay read-only.

<<< @/snippets/extension-documents/built-in.ts

[Supported formats](./supported-formats#video-audio-web-pages-and-online-documents)
lists the files and streams each one opens.

If your page has a Content Security Policy, it needs to allow what these load.
Media needs inline styles, YouTube's IFrame API script, the YouTube and Vimeo
frames, and the origins your media is served from. A web page needs its origin
allowed as a frame, as Canva needs `www.canva.com` and Google `docs.google.com`.

## How `open` chooses

`open` asks the extension documents before the engine:

1. Given a `format`, the extension document whose `formats` include it opens
   the source, and no `canOpen` is asked. A format no extension document lists
   goes to the engine.
2. Given no `format`, each extension document's `canOpen` is asked in turn:
   yours, in the order you registered them, then the built-in ones. The first
   to answer yes opens the source.
3. If none does, the engine opens it.

`openRemote` and `openLocal` open documents the engine keeps, so they never ask
an extension document. Opening an extension document is licensed and metered
as any other open is.

## Write one

An [`ExtensionDocument`](/api/Common/interfaces/ExtensionDocument) has a doc
type, the formats it opens, a `canOpen` that says whether it opens a source,
and an `open` that renders the source. This one shows a JSON file, indented:

<<< @/snippets/extension-documents/json-document.ts

- **`docType`** names the kind of document, and is what `docType` reports while
  one is open. Registering an extension document of a doc type already
  registered replaces that one. The engine's own doc types (`portable`,
  `wordprocessing`, `presentation`, `spreadsheet` and `image`) are refused.
- **`formats`** are the source formats it opens. Given one of them as `open`'s
  `format`, it opens the source without being asked.
- **`canOpen(request)`** is asked when `open` is given no `format`. The
  [request](/api/Common/interfaces/ExtensionDocumentOpenRequest) holds the
  source and the options as `open` was given them, the source's absolute `url`
  (none for a `Blob` or bytes) and its file `name`. Its `head()` resolves with
  the first 4 KiB and the media type the response or the `Blob` declares. The
  source is read once for every `canOpen` that asks, and the engine reads on
  from there, so a URL is fetched once. Settle what you can by the name first,
  which reads nothing. A `canOpen` that rejects fails the open.
- **`open(container, request, host)`** renders the source into `container`, a
  `<div>` filling the document area, and resolves once it shows. The loading
  overlay covers the area until then. If it rejects, the open fails and the
  container is removed. The [host](/api/Common/interfaces/ExtensionDocumentHost)
  gives the theme and the locale it opens in, a `signal` that aborts when
  another document opens or this one is closed, and `progress(loaded, total)`,
  which moves the loading overlay's bar and fires `"document:loading"`.
- **The viewer** `open` resolves with is an
  [`ExtensionDocumentViewer`](/api/Common/interfaces/ExtensionDocumentViewer):
  its `sourceFormat`, one of `formats`; `close()`, called when it's closed or
  another document opens, after which the container is removed; and
  `setTheme(theme)`, called when the theme changes.

The container inherits the UI's `--udoc-color-*` variables, so what you render
follows the theme if it takes its colors from them, as the JSON document does.
`setTheme` is for what they can't reach, such as a frame's own page.
[Customize the UI](./customize-the-ui#colors) lists the variables.

## Register it

Pass it in the `extensionDocuments` option, or later to
`registerExtensionDocument()`, which reaches every open after the call. The
editor takes it the same way.

<<< @/snippets/extension-documents/register.ts

## Frame pages without a format

To open some URLs as web pages without `format: "url"`, such as your own
embeds, register a web page document with a rule saying which.
[`webpageDocument`](/api/Common/functions/webpageDocument) makes one; its
`canOpen` is asked only for a URL. It replaces the built-in web page document,
and still frames any URL given `format: "url"`.

<<< @/snippets/extension-documents/webpage-rule.ts

To replace the built-in media player with your own, register an extension
document whose doc type is `"media"`. The same goes for `"canva"` and `"google"`,
and one with no `formats` whose `canOpen` always answers no turns that one off.

## While one is open

- `docType` and `sourceFormat` are the extension document's.
- The pages' chrome hides: the side panels, the page controls and the status
  bar. The toolbar keeps full screen and the theme.
- It has no pages, so `pageCount` is `0`, and the calls that need pages,
  search, annotations, saving, exporting, downloading, printing and
  collaboration reject.
- The editor shows it without the mode switch or the ribbon's tabs, and opens
  the next document in the mode it was in before.
- `close()`, `destroy()` or opening another document closes it.
