---
description: See which formats the docMentis viewer and editor open in the browser, and which of them people can view, edit and export.
---

# Supported formats

docMentis supports all these document formats. Edits save back to the original
format.

| Format                      | Extension                                                                                                 | View | Edit | Export                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------- | ---- | ---- | ----------------------- |
| PDF                         | `.pdf`                                                                                                    | ✓    | ✓    | PDF,&nbsp;SVG,&nbsp;PNG |
| Word                        | `.docx`, `.docm`, `.dotx`, `.dotm`                                                                        | ✓¹   | ✓    | PDF,&nbsp;SVG,&nbsp;PNG |
| PowerPoint                  | `.pptx`, `.pptm`, `.potx`, `.potm`, `.ppsx`, `.ppsm`                                                      | ✓¹   | ✓    | PDF,&nbsp;SVG,&nbsp;PNG |
| Excel                       | `.xlsx`, `.xlsm`, `.xltx`, `.xltm`                                                                        | ✓¹   | ✓    | PDF                     |
| Plain text                  | `.txt`                                                                                                    | ✓    | ✓    | PDF,&nbsp;SVG,&nbsp;PNG |
| Markdown                    | `.md`, `.markdown`                                                                                        | ✓    | ✓    | PDF,&nbsp;SVG,&nbsp;PNG |
| HTML                        | `.html`, `.htm`                                                                                           | ✓    | ✓    | PDF,&nbsp;SVG,&nbsp;PNG |
| Email                       | `.eml`                                                                                                    | ✓    | ✓²   | PDF,&nbsp;SVG,&nbsp;PNG |
| CSV                         | `.csv`                                                                                                    | ✓    | ✓    | PDF                     |
| TSV                         | `.tsv`, `.tab`                                                                                            | ✓    | ✓    | PDF                     |
| PSV                         | `.psv`                                                                                                    | ✓    | ✓    | PDF                     |
| JPEG                        | `.jpg`, `.jpeg`                                                                                           | ✓    | ✓³   | PDF,&nbsp;SVG,&nbsp;PNG |
| PNG                         | `.png`                                                                                                    | ✓    | ✓    | PDF,&nbsp;SVG,&nbsp;PNG |
| GIF                         | `.gif`                                                                                                    | ✓    | ✓³   | PDF,&nbsp;SVG,&nbsp;PNG |
| BMP                         | `.bmp`                                                                                                    | ✓    | ✓    | PDF,&nbsp;SVG,&nbsp;PNG |
| TIFF                        | `.tif`, `.tiff`                                                                                           | ✓    | ✓³   | PDF,&nbsp;SVG,&nbsp;PNG |
| WebP                        | `.webp`                                                                                                   | ✓    | ✓³   | PDF,&nbsp;SVG,&nbsp;PNG |
| SVG, EMF, WMF               | `.svg`, `.emf`, `.wmf`                                                                                    | ✓    | ✓⁴   | PDF,&nbsp;SVG,&nbsp;PNG |
| Video and audio             | `.mp4`, `.m4v`, `.mov`, `.webm`, `.mp3`, `.m4a`, `.aac`, `.wav`, `.ogg`, `.oga`, `.ogv`, `.opus`, `.flac` | ✓    | —    | —                       |
| HLS streams                 | `.m3u8`                                                                                                   | ✓    | —    | —                       |
| YouTube, Vimeo              | Link                                                                                                      | ✓    | —    | —                       |
| Canva                       | Link                                                                                                      | ✓    | —    | —                       |
| Google Docs, Sheets, Slides | Link                                                                                                      | ✓    | —    | —                       |
| Web pages                   | Any URL, with `format: "url"`                                                                             | ✓    | —    | —                       |

1. Password-protected Word, PowerPoint and Excel files don't open yet.
2. An email saves as Word, text, Markdown or HTML, not `.eml`.
3. An animated GIF or WebP, or a CMYK JPEG or TIFF, can't be saved once edited.
4. An SVG, EMF or WMF can't be saved once edited.

[Extension documents](./extension-documents) describes the video, audio and web formats, and how to add your own.

[`@docmentis/udoc-node`](/api/udoc-node/), the `udoc` command line and [`@docmentis/udoc-server`](/api/udoc-server/) open all of these except the video, audio and web formats.

## Not supported today

- The binary Office formats of Office 97–2003: `.doc`, `.xls` and `.ppt`.
- OpenDocument files (`.odt`, `.ods`, `.odp`) and RTF.
- HEIC, AVIF, ICO, TGA, PPM, HDR, EXR and QOI images.
- MKV, AVI and WMV video, and DASH streams.
