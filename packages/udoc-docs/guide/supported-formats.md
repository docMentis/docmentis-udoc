---
description: See which files the docMentis viewer and editor open, which of them people can edit and save, and what each format can't do yet.
---

# Supported formats

The viewer and the editor open PDFs, Word, PowerPoint and Excel files and the
text formats around them, images, video and audio, and web pages. Each opens as
a _doc type_, which decides the tools the UI offers. Once a document is open,
`docType` says which doc type it opened as, and `sourceFormat` which format it
came from.

## Documents

The docMentis engine reads and renders these. The Editing column says whether
the editor edits a format and saves the edits back to it:

| Format         | Extensions                                                        | `sourceFormat`                               | `docType`        | Editing                                      |
| -------------- | ----------------------------------------------------------------- | -------------------------------------------- | ---------------- | -------------------------------------------- |
| PDF            | `.pdf`                                                            | `pdf`                                        | `portable`       | Yes                                          |
| Word           | `.docx`, `.docm`, `.dotx`, `.dotm`                                | the extension                                | `wordprocessing` | Yes                                          |
| Plain text     | `.txt`                                                            | `txt`                                        | `wordprocessing` | Yes                                          |
| Markdown       | `.md`, `.markdown`                                                | `md`                                         | `wordprocessing` | Yes                                          |
| HTML           | `.html`, `.htm`                                                   | `html`                                       | `wordprocessing` | Yes                                          |
| Email          | `.eml`                                                            | `eml`                                        | `wordprocessing` | Yes, but saved as another format, not `.eml` |
| PowerPoint     | `.pptx`, `.pptm`, `.potx`, `.potm`, `.ppsx`, `.ppsm`              | the extension                                | `presentation`   | Yes                                          |
| Excel          | `.xlsx`, `.xlsm`, `.xltx`, `.xltm`                                | the extension                                | `spreadsheet`    | Yes                                          |
| Delimited text | `.csv`, `.tsv`, `.tab`, `.psv`                                    | `csv`, `tsv` or `psv`                        | `spreadsheet`    | Yes                                          |
| Images         | `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.tif`, `.tiff`, `.webp` | `jpg`, `png`, `gif`, `bmp`, `tiff` or `webp` | `image`          | Yes                                          |
| Vector images  | `.svg`, `.emf`, `.wmf`                                            | the extension                                | `image`          | Yes, but an edited one can't be saved        |

- A template, a slide show or a macro-enabled Office file opens as the document
  it is a variant of, and `sourceFormat` names the variant: `dotx`, `ppsx`,
  `xlsm`.
- A text file opens in Courier New. A text file, a Markdown file (CommonMark,
  with GitHub's tables and strikethrough) and an HTML file (styled by its
  `<style>` rules and `style` attributes) show pageless, their text flowed to
  the width of the pane. The View tab shows them as pages instead.
- A `.udoc` package, which `saveToPackage` saves, opens with `open` as the
  document it holds, its `sourceFormat` the format it recorded.

## Video, audio and web pages

These are extension documents: the browser plays or shows them in the document
area, not the engine. Two are built in, and you can
[add your own](./extension-documents).

| Kind            | Sources                                                                                                                                                                    | `sourceFormat`                                               | `docType` | Editing |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------- | ------- |
| Video and audio | `.mp4`, `.m4v`, `.mov`, `.webm`, `.mp3`, `.m4a`, `.aac`, `.wav`, `.ogg`, `.oga`, `.ogv`, `.opus` and `.flac` files; HLS streams; YouTube and Vimeo videos by their address | `mp4`, `webm`, `mp3` and the rest; `hls`, `youtube`, `vimeo` | `media`   | No      |
| Web pages       | Any URL, given `format: "url"`                                                                                                                                             | `url`                                                        | `webpage` | No      |

## How a format is recognized

`open` tells most formats from the file's content: a PDF, an Office file (and
which variant it is), an image, and an HTML file that starts with
`<!DOCTYPE html>` or `<html>`. A CSV, TSV, PSV, text, Markdown or email file has
no signature, so it's recognized by its name: a `File`'s name, the last segment
of a URL's path, or the `filename` option. Video and audio are recognized by a
YouTube or Vimeo address, then the file's extension, the media type the server
or the `Blob` declares, and finally the file's first bytes.

Where none of that can work, as with bytes from an API, name the format with
the `format` option. It skips detection entirely:

<<< @/snippets/supported-formats/format.ts

A CSV opened without a `delimiter` is split by the comma, semicolon, tab or
vertical bar that splits its first records evenly. When none does, or more than
one does, a dialog shows its first lines and asks the reader which character
splits them.

## What people can do with each

The viewer edits nothing but a PDF's annotations and form fields: it's for
reading. The editor edits every document the engine opens, in its edit mode.
Video, audio and web pages open view only in both.

Edit mode needs the `editing` feature, which free usage includes and a
commercial license includes if it lists it. Without it, the editor offers view
mode alone, and `setMode("edit")` does nothing.

In the viewer, and in the editor's view mode:

| Doc type               | View mode                                                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PDF                    | Thumbnails, outline, layers, search and comments. Annotate: highlight, underline, strikeout, squiggly, note, text box, stamp, pen and shapes. Fill in forms. Present it a page at a time, with the presenter view. |
| Word document          | Thumbnails and search. Show it as pages or pageless, and show its formatting marks.                                                                                                                                |
| Presentation           | Thumbnails with their sections and hidden slides, speaker notes, the Notes Page view and search. Present it, with its transitions, animations and the presenter view.                                              |
| Spreadsheet            | Sheet tabs, the formula bar, the Normal and Page Layout views, and search.                                                                                                                                         |
| Image                  | Thumbnails of its pages.                                                                                                                                                                                           |
| Video, audio, web page | The player or the page, and full screen.                                                                                                                                                                           |

In the editor's edit mode:

| Doc type               | Edit mode                                                                                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PDF                    | Edit the text of the page in place. Select, move, restyle (fill and line), order, align, rotate and group the page's objects. Insert shapes. Insert, duplicate, rotate, delete and reorder pages. Annotate.           |
| Word document          | Edit the text: fonts and character formatting, alignment, spacing, lists and paragraph styles. Restyle and arrange the drawings in its text. It has no Insert tab yet.                                                |
| Presentation           | Edit the text and the shapes. Insert slides, pictures and any of PowerPoint's preset shapes. Duplicate, delete, move and hide slides, and edit sections and speaker notes. Slide masters show, but aren't edited yet. |
| Spreadsheet            | Type values and formulas into cells. Insert, delete, rename, hide, color and move sheets. Cells can't be formatted yet.                                                                                               |
| Image                  | Rotate, flip, crop and resize it, and draw shapes with text over it. Rotate, delete and move the pages of a multi-page image, and duplicate a TIFF's.                                                                 |
| Video, audio, web page | Nothing: they open view only.                                                                                                                                                                                         |

## Saving

The toolbar's Download, and `download()`, save the document in its
`sourceFormat`. In the viewer, a PDF saves with the annotations and form
entries made in it, and any other document downloads as it was opened. In the
editor, every document saves with its edits.

`saveToBytes(format, strategy)` saves to any format of the document's doc type,
and rejects any other:

| Doc type      | Formats it saves to                                 |
| ------------- | --------------------------------------------------- |
| PDF           | `pdf`                                               |
| Word document | `docx`, `docm`, `dotx`, `dotm`, `txt`, `md`, `html` |
| Presentation  | `pptx`, `pptm`, `potx`, `potm`, `ppsx`, `ppsm`      |
| Spreadsheet   | `xlsx`, `xlsm`, `xltx`, `xltm`, `csv`, `tsv`, `psv` |
| Image         | The format it was opened from                       |

The strategy says how much of the original file the saved one keeps:

- `"incremental"` appends the edits to the original as a new revision, which
  keeps a PDF's signatures valid. Only a PDF saves this way, and it's a PDF's
  default.
- `"delta"` writes the parts the edits changed over the original, and keeps
  every other part as it was. It's the default for an Office file saved in its
  own format, and keeps a macro-enabled file's macros.
- `"rewrite"` writes the whole file afresh. It's the default for the text
  formats, CSV, TSV, PSV and images, and the only way to save to a format other
  than the one the document was opened from. It drops a file's macros.

<<< @/snippets/supported-formats/save.ts

Some saves aren't possible yet:

- An email can't be saved as `.eml`, so the editor's Download fails for one.
  Save it as a Word document, Markdown, HTML or text instead.
- A CSV, TSV or PSV holds one sheet, so a workbook saved as one keeps its first
  worksheet only.
- An image saves only as the format it was opened from, and an SVG, EMF or WMF
  that has been edited can't be saved.

## Exporting

`exportToBytes("pdf")` renders any document the engine opened as a PDF of its
pages, and `exportPageToBytes` renders one page as a PNG or an SVG. A workbook
exports every worksheet, on the pages it prints on. An export is a picture of
the document as it stands: unlike a save, it doesn't reopen as the same
document.

## Not supported

These don't open:

- The binary Office formats of Office 97–2003: `.doc`, `.xls` and `.ppt`.
- OpenDocument files (`.odt`, `.ods`, `.odp`) and RTF.
- Word, PowerPoint and Excel files protected by a password. A PDF protected by
  a password opens: the UI asks for it, or `open` takes it as its `password`
  option.
- HEIC, AVIF, ICO, TGA, PPM, HDR, EXR and QOI images.
- MKV, AVI and WMV video, and DASH streams.

## Other limits

- Annotations, comments, form filling, the outline and layers are a PDF's.
- Two pages side by side (`layoutMode`) is for PDFs and Word documents, and
  turning the view (`pageRotation`) for PDFs.
- An image has no search panel.
- A workbook prints its current sheet, on the pages its Page Layout view
  shows.
- An extension document has no pages: while one is open, `pageCount` is `0`,
  and the calls that need pages, search, annotations, saving, exporting,
  downloading, printing and collaboration reject.
- A font a document uses but doesn't embed is fetched from Google Fonts, taken
  from the reader's own machine, or drawn in a font that stands in for it. A
  document whose fonts can't be had any of those ways can look different from
  how it looks in Office.

## On a server

[`@docmentis/udoc-node`](/api/udoc-node/), the `udoc` command line and
[`@docmentis/udoc-server`](/api/udoc-server/) open, save and export the same
documents as the viewer and the editor. Video, audio and web pages are the
browser's, so they don't open there.
