# UI Extension Document

An extension document is a kind of document the engine doesn't read — video
and audio from files, streams and video sites, a web page — that the viewer
and the editor open, view only. A host registers one with
`extensionDocuments` among the options, or `registerExtensionDocument` on the
viewer or the editor later; two ship built in. When one opens, the shell hands
it a `<div>` where the document goes, and it renders itself there.

An extension document is not an extension. An extension (`UIExtension`,
[UI Extension](ui-extension.md)) adds a mode to the shell — edit mode is
udoc-editor's; an extension document adds a kind of document.

## Why not the engine

The engine composes pages, and a video has none: no layout, no text to search,
nothing to save back. Decoding is the browser's — a slide's video already plays
in the browser's own player over the poster the deck carries (`MediaPlayer`).
Of what the engine does for a document, an extension document needs one thing:
the license gate.

## The seam

```ts
interface ExtensionDocument {
    docType: string;
    formats: readonly string[];
    canOpen(request: ExtensionDocumentOpenRequest): boolean | Promise<boolean>;
    open(
        container: HTMLDivElement,
        request: ExtensionDocumentOpenRequest,
        host: ExtensionDocumentHost,
    ): Promise<ExtensionDocumentViewer>;
}

interface ExtensionDocumentViewer {
    sourceFormat: string;
    close(): void;
    setTheme(theme: "light" | "dark"): void;
}
```

An extension document is registered once and opens any number of times, each
open handing back its `ExtensionDocumentViewer`. What it is asked about is an
`ExtensionDocumentOpenRequest`; the host's name, `ExtensionDocumentHost`, is
provisional.

- `docType` — what kind of document it is, as `"presentation"` is an engine
  one's: `"media"`. It is the extension document's identity: registering a
  `docType` already registered replaces that one, a built-in's included, and
  one of the engine's own doc types is refused.
- `formats` — the source formats it opens, as `pptx`, `potx` and the rest are
  a presentation's: `"mp4"`, `"hls"`, `"youtube"`.
- `canOpen` — whether it opens what `open` was given.
- `open` — renders it into `container`, resolving once it shows.

## Opening

`open` decides who opens what it was given:

1. The session starts, as for every open: the license is checked and,
   unlicensed, the permit taken (`WorkerClient.start`). So an extension
   document is licensed and metered as an engine document is, and a refusal
   shows the same notice. Its session opens nothing.
2. Given an `OpenOptions.format`, the extension document whose `formats` hold
   it opens it, and no `canOpen` is asked — `format` keeps its meaning, the
   source's format, which skips detection, and now takes an extension
   document's formats as well as the engine's. One that neither reads is
   refused, `unsupported`.
3. Given none, each `canOpen` is asked in turn — the host's, in the order
   registered, then the built-ins — and the first to say yes opens it. A
   `canOpen` that throws fails the open, as a document that won't open does,
   unless another document opened, or this one closed, meanwhile.
4. Otherwise the engine opens it, as it does now. `openRemote` and
   `openLocal` open packages, the engine's alone.

The request is `open`'s source and options as given, with what the shell
already makes of them: a URL source made absolute, the file's name as
`download` would name it, and `head()`. `head()` resolves with the first bytes,
at most 4 KiB, and the media type the Blob or the response declares. It reads
once, for whichever `canOpen` asks first, and the engine reads on from it when
none says yes, so a URL is fetched once. An extension document that opens a URL
loads it its own way — a video element streams it with range requests — and
the shell drops its read.

## What the shell lends and asks

**Lends.** The container, a `<div>` filling the document area. It inherits the
chrome's `--udoc-color-*`, so what renders in it takes the theme with no work
of its own; one that wants isolation makes its own iframe inside. And the
host: the theme and the locale it opens in, `signal`, aborted once another
document opens or this one closes — before `open` resolves, a sign to give up
— and `progress`, which drives the loading overlay and `document:loading`.

**Asks.** The `ExtensionDocumentViewer`: its `sourceFormat`, one of the
extension document's `formats`; `close`, when the host closes it or another
document opens; and `setTheme`, when the theme changes, with the theme the
chrome resolved, `"light"` or `"dark"`, a system theme's included — a no-op for
one that renders in the container's variables. More come later as optional members,
each turning on chrome the shell already has: `download` and `print` for the
toolbar's, then `search`, which the search panel queries and shows the matches
of, pages (`goToPage` and the view controls), thumbnails and the outline. A
viewer written before one is added keeps working, without that piece.

## Doc type and source format

`docType` and `sourceFormat` mean for an extension document what they mean for
an engine one:

|                    | `docType`                                                       | `sourceFormat`                                           |
| ------------------ | --------------------------------------------------------------- | -------------------------------------------------------- |
| engine document    | what kind of document, which picks its chrome: `"presentation"` | the file it came from: `"pptx"`                          |
| extension document | the `ExtensionDocument`'s `docType`: `"media"`                  | its viewer's, one of its `formats`: `"mp4"`, `"youtube"` |

As no engine doc type is an extension document's, `docType` alone says who
opened the document. Source formats can overlap: a host's own PDF viewer,
registered as an extension document, lists `"pdf"`, which is true, and is asked
before the engine.

## In the viewer and the editor

While an extension document is open the canvas, its scrollbars and the page
overlays hide, and so do the side panels, the view controls and the status
bar, which have nothing to show until its viewer answers them. The toolbar
keeps fullscreen and the theme; Download and Print show once the viewer has
them. The editor shows it with no mode switch and no tabs — edit mode's strip
has none without an engine doc type — and opens the next engine document in
the mode it was in.

In the store, an open extension document is a load status of its own,
`extension`, beside an engine document's `ready`, so nothing that acts on an
engine document runs; the engine's `docType` and `sourceFormat` are null, and
`extensionDocument` holds its own. Nor does it move `docGeneration`: what
reads the engine's document when that moves would find none.

The API answers as for a document without what a call needs: `pageCount` is
`0`, and the page and sheet calls, search, annotations, saving, exporting,
downloading, printing and collaboration reject; `close` closes it.

## Built-in extension documents

**Media** (`"media"`) plays on Video.js 10 (`@videojs/html`, with its
`hlsjs-video`, `youtube-video` and `vimeo-video` packages), at an exact
version, as the engine is pinned: `<media-i18n>` › the video or audio preset's
player › its skin › the media element — a `<video>` or `<audio>` for a file,
`hlsjs-video` for HLS, `youtube-video` and `vimeo-video` for the sites, one set
of controls over each. Its `formats` are `mp4`, `m4v`, `mov`, `webm`, `mp3`,
`m4a`, `aac`, `wav`, `ogg`, `opus`, `flac`, `hls`, `youtube` and `vimeo` — the
containers browsers play, and none they don't, MKV, AVI or WMV. It loads by
dynamic `import` when a media document opens — the preset, its skin and the
media element's package, hls.js among them — so a PDF's reader downloads none
of it.

Video.js is bundled into udoc-ui's `dist`, as the workers are
(`scripts/bundle-video-js.mjs`): the imports `src/app/video-js.ts` makes become
chunks in `dist/app/video-js/`, which it names relatively. So a host resolves
no Video.js package and installs none — the `@videojs` packages are udoc-ui's
dev dependencies — and a host without a bundler, whose import map names udoc's
packages alone, plays media too. It adds 1.2 MB to the package, 0.35 MB
packed, where the packages as dependencies added 59 MB to every host's install.
`npm run dev` runs tsc's output, the imports resolved from the workspace. What
the bundle holds is others' software, so the same script writes
`dist/THIRD-PARTY-NOTICES.md` from it: each package, its version, its license
and its license text.

- `canOpen` (`media-formats.ts`): a YouTube or Vimeo address, before anything
  is fetched, which fetching would fail on CORS anyway; a file name's
  extension, a stream's manifest's among them; then `head()` — the media type
  declared, else the signatures `ftyp` (by its brand), WebM's EBML header,
  `ID3` or an MPEG frame's sync, ADTS, `RIFF…WAVE`, `OggS` (Opus by its first
  packet), `fLaC`, `#EXTM3U` and `<MPD`.
- A URL plays from the URL, never read whole; a Blob or bytes from an object
  URL, revoked on `close`. A file in an audio format plays in the audio preset,
  anything else in the video preset until its metadata shows no picture
  (`videoWidth` and `videoHeight` 0), when it plays in the audio preset — a
  WebM, an MP4 or an Ogg file can hold either. `open` resolves once the
  metadata is read, the media fails, or ten seconds pass.
- The skins inject their own styles, in shadow roots, plus one `<style>` in
  the page's head, so a host's bundler handles no CSS. They take the chrome's
  accent through `--media-accent-color`; the audio skin follows the
  `color-scheme` the chrome sets, and the video skin is dark in either theme, so
  `setTheme` has nothing to do. Their words follow `locale` through
  `<media-i18n>`, whose 53 packs load as needed.
- A source that fails shows the skin's own error dialog, which Video.js gives
  no way to replace. A YouTube or Vimeo video that fails — private, removed,
  or not to be embedded — adds an "Open on YouTube" or "Open on Vimeo" link
  under it.
- Video.js defines its custom elements only when they aren't, so a host page
  running Video.js 10 already has them: media uses the host's version. A host
  with a strict Content Security Policy lets in the inline styles, YouTube's
  IFrame API script and the sites' frames, and the streams' origins; the guide
  says which.
- DASH is left out: Video.js marks its `dash-video` experimental and maps none
  of dash.js's errors, and dash.js would add 130 MB to every host's install.

**Web page** (`"webpage"`) frames a page in an iframe. It isn't registered: a
host registers `webpageDocument({ canOpen })` with its own rule — its Figma or
Loom embeds, say. Taking every URL would frame `report.pdf`, which `open`
fetches as a document, and an HTML file, which the engine reads — so its one
format is `url`, not the engine's `html`. A site that refuses to be framed
(`X-Frame-Options`, `frame-ancestors`) leaves a blank frame its parent can't
reliably tell from a slow one, so an "Open in new tab" link always shows. The
frame's `sandbox` and `allow` grant what a page needs to show and no more.

## Thumbnails in Node

An extension document is browser code, so Node gets a thumbnail function for
each built-in one, outside `UDocNode` — no engine is involved:

- media: a frame for a file or a stream, a URL ffmpeg reads directly, by
  ffmpeg's `thumbnail` filter over the first seconds, which passes over a
  black first frame; for audio its cover art, else its waveform
  (`showwavespic`); for YouTube and Vimeo, the `thumbnail_url` their oEmbed
  endpoints give.
- web page: the page's `og:image`, read as a chat app's link preview reads it,
  with no browser.

ffmpeg is the host's: an option naming it, `ffmpeg` on the `PATH` by default,
and an `unsupported` rejection without one. It isn't bundled: `ffmpeg-static`
is GPL and a binary per platform, where [Node Hosts](node-hosts.md) ships one
artifact for all. The CLI gains `udoc thumbnail`.

## Not decided

- The "Powered by docMentis" decal: the engine paints it into the canvas, which
  an extension document hides — drawn over the container instead, or none.
- Media: encrypted (DRM) streams, which want the Shaka element and key
  systems; and over a YouTube video, our controls or YouTube's own — YouTube's
  developer policies limit what may be laid over its player. Video.js's skin
  drives it now, YouTube's own controls hidden, as `youtube-video` does by
  default.
- A deck's online video: PowerPoint links it from outside the package, where
  `ShapeMedia.data` is unset, so the engine would report the link's URL for
  `MediaPlayer` to play it.
- Whether a thumbnail in Node is metered, and udoc-server: an upload kept as
  its original with no checkpoint, range requests on `original`, which Safari
  plays a video only with, and a thumbnail route.

## Status

**Built:** the seam in udoc-ui, which the viewer and the editor re-export —
`ExtensionDocument` with its `docType`, `formats`, `canOpen` and `open`,
registered by `extensionDocuments` or `registerExtensionDocument`;
`ExtensionDocumentViewer` with `sourceFormat`, `close` and `setTheme`; the
choice of which opens a source; `head()` over a source read once; the `<div>`
and the chrome that hides around it; and the license gate on every open. The
built-in media document — files, HLS, YouTube and Vimeo on Video.js 10.

**Not built:** the web page document, DASH, and thumbnails in Node.
