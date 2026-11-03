# Examples Shockwave

Shockwave is a sales enablement app built on the udoc packages, in
`examples/shockwave/`. The other examples each show one way to install the
viewer and the editor; shockwave is a product a customer would build with them
— a content library, decks personalized for a deal, links shared with buyers,
presenting — run locally, with Larchmere, an imaginary asset manager, as its
example tenant. It is there for two reasons:

- **A showcase.** Each workflow puts a udoc capability in front of someone with
  a reason to use it: the viewer for a buyer reading a proposal, the editor for
  a rep personalizing a deck, the slide show for presenting, the server for
  keeping and rendering the library.
- **Dogfooding.** It uses the public API alone, as a customer can: what
  `@docmentis/udoc-viewer`, `-editor`, `-node` and `-server` export, never
  `@docmentis/udoc-ui/internal`. Where the API falls short, the gap goes in
  `examples/shockwave/GAPS.md` — what was needed, what the API offers, the
  workaround if there is one — instead of being reached around.

## What a sales enablement platform has to provide

Seismic, Highspot, Showpad and Letter AI each do these jobs:

| Job                        | What it means in practice                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| Content management         | one library, governed: compliance approval, versions, expiry, disclosures, tags, search                   |
| Creating and personalizing | decks assembled from approved slides, made for one deal; answers to RFPs and due diligence questionnaires |
| Sharing with buyers        | links or deal rooms a buyer opens with no account, downloading and copying under control                  |
| Buyer engagement           | who opened what, which pages, for how long; the rep alerted                                               |
| Presenting                 | in the meeting, with the presenter view, the deck as it was built                                         |
| Collaborating              | proposals and RFPs co-edited; review markup                                                               |
| Training and coaching      | learning paths, roleplay; mostly not about documents                                                      |
| Analytics and AI           | content performance, revenue attribution, AI search and generation, the CRM                               |

## Where docMentis fits

| Job                                 | docMentis today                                                                                                              | Strength                            |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Previewing the library, any format  | the viewer: PDF, DOCX, PPTX, XLSX, images, Markdown, HTML, CSV, video and audio, web pages                                   | core                                |
| Previewing before uploading         | the viewer renders the file in the browser, in WebAssembly; it never leaves the computer                                     | core                                |
| Thumbnails                          | udoc-server's page routes, PNG or SVG; udoc-node's `exportPageToBytes`                                                       | core                                |
| Personalizing a deck                | the editor edits the PPTX, DOCX or XLSX itself, in the browser, with no trip to desktop Office                               | core                                |
| A frozen PDF of an approved version | `exportToBytes("pdf")`, udoc-server's `pages.pdf`                                                                            | core                                |
| Compliance review                   | annotations, and comment threads with their replies                                                                          | partial: checked for a PDF alone    |
| Co-editing an RFP                   | udoc-server's collaboration over WebSocket, with presence and each other's pointers                                          | core                                |
| Presenting                          | the slide show: PowerPoint's transitions, animations and Morph, the presenter view on a second screen; a PDF too             | core                                |
| Buyer engagement, page by page      | the viewer's `currentPage:changed`, `viewport:changed`, `document:downloaded` and `document:printed`, which the host records | core                                |
| Sharing under control               | `showDownloadButton`, `showPrintButton` and `enableCopy` turned off                                                          | partial: no watermark, no redaction |
| Searching the library, AI on it     | search within one document alone: only a word document saves as text or Markdown, and a PDF's or a deck's text can't be had  | gap                                 |
| Decks generated from a template     | udoc-node opens, saves and exports a document, with no API to edit it                                                        | gap                                 |
| Copying slides between decks        | not looked into yet                                                                                                          | likely gap                          |

The gaps are what Shockwave logs in `GAPS.md` as it reaches them, and the
strongest candidates for the engine's roadmap.

## What makes docMentis unique here

1. **One engine everywhere.** The browser, udoc-node, the CLI and udoc-server
   all run one WebAssembly build. The thumbnail, the preview, the buyer's view,
   the exported PDF and the presentation are one rendering, so they never
   disagree.
2. **Native formats from start to finish.** A rep views, edits, presents and
   co-edits the PPTX itself, inside the product. Incumbents commonly convert
   documents to images or PDF to show them, and send people to PowerPoint or
   Office Online to edit them; that's not yet checked product by product.
3. **Presenting without loss.** Morph, transitions, animations and the
   presenter view, in a browser, with no PowerPoint installed. A converted deck
   loses them all.
4. **Self-hosted and client-side.** Documents stay on the tenant's servers or
   in the browser, with no third-party conversion service, and no Microsoft 365
   behind an Office Online integration: what a regulated buyer, Larchmere's
   kind, asks of its vendors.
5. **Embeddable.** A sales enablement vendor builds its product on it, where it
   would otherwise license and integrate several pieces.

## The tenant

Larchmere Investment Management, Larchmere for short, is a mid-sized asset
manager selling to institutions: pension funds, endowments and foundations,
often through their investment consultants. Financial services is where sales
enablement is most at home, and its content gives the packages real work. It is
reviewed by compliance, carries disclosures, dates with each quarter's figures,
and comes in every format: pitch books (PPTX), fact sheets and commentaries
(PDF), answers to RFPs and due diligence questionnaires (DOCX), performance and
fee tables (XLSX). Larchmere is made up, and so is everything about it: its
funds, benchmarks and figures, with no real ticker or index. Each of its
documents says so.

Its users see the app in its brand, as a tenant's do: its logo, a square icon,
and its name lead the header, the logo kept with the tenant and served to its
users alone (`/api/tenants/:id/logo`). Larchmere's is a larch cone, faceted
scales on a shield, with a rising arrow breaking out of it. Shockwave's own
mark is left to the sign-in page, where no tenant is known yet, and the foot of
the navigation, "Powered by Shockwave".

Each of the three speaks in colors of its own, so that no one takes one for
another: docMentis, the narrator, in its indigo; Shockwave, the app, in
orange, `#fe5000`; and Larchmere, its logo and its documents, in green, forest
`#1f4e3d` and sage `#b5dcc2`, the hue furthest from the other two.

## The app

The app is its sections, in a navigation down the window's left, and a header
across the rest: the tenant's brand, search in its middle, and the user's
avatar, which opens their menu. A menu button at the navigation's top turns it
from a panel of the sections' names to a bar of their icons and back. Content
moves through the sections one way:

```
Library ──publish──▶ Collections ──add to a deal──▶ Deal Room ──share──▶ buyer
marketing prepares,   a sales manager arranges,      backstage: prepared   frontstage:
compliance approves   sales find                     and personalized      what they see
```

- **Home**: what needs the user, and what's new for them.
- **Library**: content before it's sold with. Marketing creates and prepares
  it, and compliance reviews it, through a workflow in which only approved
  content is published. Sales never see it. Outside vendors and partners who
  work on its content come later.
- **Collections**: how sales get content. A sales manager arranges published
  content into collections, picking it from what's published, and gives each
  collection a description and instructions, and each document in it its own.
  Sales find their content here.
- **Deal Rooms**: where sales prepare content for a deal and share it. Content
  comes in from collections. A deal room's backstage is where sales prepare and
  personalize it; its frontstage is what the buyer sees, at a link, with no
  account.
- **Learning**: where sales learn, and their managers prepare what they teach.
- **Insights**: how content is used and read, from the Library to the buyer.
- **Settings**: the workspace's, after a divider.

Search finds what the user may see, by name, description and tag: the Library
for those who keep it, collections and deal rooms for sales. A document's text
waits on the engine (above).

## Who uses it

A user's role is what they may do in the app; their job is a title on their
profile, as Seismic and Highspot keep the two apart:

| Role     | May                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------- |
| admin    | keep the Library (create, prepare, submit, publish what's approved, retire), see Insights, and Settings |
| reviewer | review what's submitted to the Library: approve it, or mark it up and return it                         |
| manager  | arrange Collections, teach in Learning, see the team's deal rooms and Insights, and all a member may    |
| member   | find content in Collections, prepare it and share it in Deal Rooms, and learn in Learning               |

A user sees Home and the sections their role may use: neither a manager nor a
member sees the Library. A buyer, a prospect institution or its investment
consultant, is no user: they open a deal room's frontstage at a link a seller
shared with them, with no account.

Larchmere's users are five personas, each a job a sales enablement platform
serves at an asset manager, and each with a udoc capability of their own to
show:

| Persona      | Title                         | Role     | Shows                                                                            |
| ------------ | ----------------------------- | -------- | -------------------------------------------------------------------------------- |
| Maya Patel   | Product Marketing Manager     | admin    | a file viewed before it's uploaded; importing; thumbnails                        |
| Colin Okafor | Compliance Officer            | reviewer | a submission marked up in the editor, approved or returned                       |
| Sam Hughes   | Head of Institutional Sales   | manager  | published content arranged in collections; a lesson's deck and video             |
| Ryan Brooks  | Director, Institutional Sales | member   | a collection's deck personalized in a deal room's backstage, shared, presented   |
| Paula Ortiz  | Client Portfolio Manager      | member   | an RFP response co-edited with Ryan in a deal room; the presenter view at finals |

Maya keeps the Library and, as marketing does at many firms Larchmere's size,
runs the platform. Colin is there because an asset manager's fact sheets and
pitch books quote performance, so compliance approves each before it's
published. Sam heads the institutional sales team, arranging what's published
into the collections it sells from, and teaching it in Learning. Ryan is on
the front line: Ryan owns the relationship with an institution and runs its
search from the RFP to the finals presentation, and Paula is the investment
expert at Ryan's side, who answers the RFP's questions on the strategy and
presents its performance. An outside vendor or partner working on the
Library's content has no persona yet; nor has a content manager, an admin
without the workspace's settings, until Settings has members to invite.

Each first name starts with the letter of the job, so that someone switching
between them in the narrator keeps them apart: Maya in marketing, Colin in
compliance, Sam heading sales, Ryan owning the relationship, Paula on the
portfolio; a buyer, named when deal rooms come, gets a B. The surnames are
ordinary.

A user signs in with their work email, `first.last@larchmere.example` for the
seeded ones, at a domain kept for examples so that none is anyone's, and a
password, checked against the scrypt hash `users` keeps (`server/auth.ts`), and
stays signed in by a session in an HTTP-only cookie (`/api/session`); the
seeded users share the demo's password, which the README gives.

## How it fits together

```
web/  React, Vite, React Router       server/  Node, Fastify
  pages ───────── /api/* ───────────▶   app routes ──▶ node:sqlite   data/shockwave.db
  udoc-viewer ─── /udoc/* ──────────▶   gate ──▶ udoc-server ──▶ store   data/udoc/
  udoc-editor     HTTP and WebSocket                   └─ UDocNode (udoc-node)
```

**udoc-server keeps the documents; SQLite keeps the app.** The backend builds
udoc-server with `createUDocServer` over a `DirectoryDocumentStore`, mounted at
`/udoc` (`basePath`) on its own HTTP server, and it keeps every document,
renders its pages and serves it part by part and for collaboration. SQLite,
Node's own `node:sqlite`, keeps what the app adds: tenants, users, sessions, and
an asset for each document, naming its tenant and its udoc document id, and
its first page as a thumbnail, rendered by udoc-server once, on upload. The
other pages a file's card flips to, udoc-server renders as they're asked for,
and none is kept. No document is kept twice.

**The gate.** udoc-server has no end-user authentication, and its ids are
global. So every `/udoc/*` request and WebSocket upgrade passes the gate first,
which wants a signed-in session and a document id the user's tenant has an
asset for, and lets a user only read it; later, a deal room's link admits a
buyer to the read routes of what its frontstage shares. The browser never imports or deletes a
document in udoc-server: the backend does. Until the editor, no upgrade
passes.

**Importing.** An upload goes to `POST /api/assets`, and the backend imports it
and records the asset under the id udoc-server answers. udoc-server is driven
only over HTTP, through its `POST /documents` and `DELETE /documents/:id`
routes, so the backend asks its own `/udoc/documents` over loopback, with a
per-process token the gate admits: the first entry in `GAPS.md`.

**Opening.** A file picked for upload opens in the viewer from its own bytes,
in the browser, before it is uploaded. The viewer and the editor open a kept
document with `openRemote`, its URL `/udoc/documents/:id/package`, fetching its
parts through the gate with the session's cookie. The React components wrapping
them follow the `react-vite` example, StrictMode's second effect run included.

**Licensing.** The browser packages and `UDocNode` each take a permit for each
session. The backend builds its `UDocNode` with `UDOC_LICENSE` and
`UDOC_DOMAIN` from the environment when they're set, as udoc-server's own
command does.

## The narrator

Shockwave looks like the product it is, and beside it a narrator speaks for
docMentis. It's a panel docked at the window's right edge, styled apart from
the app so that no one takes one for the other, collapsing to a badge in the
corner, and gone with `?narrator=off` when the app is used as a product. It says
two kinds of things:

- **Steps**, what to do next, in chapters, a persona's workflow each: "Sign in
  as the marketer", then "Upload the new datasheet". A step points at its
  target with a ring around it, never a dimmed overlay that would block the
  click it asks for, and is done once the moment it waits for happens, or
  skipped.
- **Highlights**, what just happened and the docMentis technology that made it
  happen: "Previewed before upload. Client-first: docMentis rendered this file
  in your browser, so you see it before it's uploaded, not after." Each shows the first time its moment happens, with the moment's
  figures where it has them (its format, how long it took to open), and stays
  in the panel's list, newest first, until the page loads again.

The product knows nothing of the narrator. It announces **moments** through a
small module of events of its own (`web/src/moments.ts`) — `route` and
`session`, which say how things stand, and `document:opened`, `page:rendered`
and `asset:added`, which say what just happened — and marks what a step can point at with
`data-narrator="…"`; the narrator is their only listener. Taking it out leaves
the product whole. The product's root, `#app`, is all of the window it knows:
its dialogs are modal to it alone, over it and not the narrator, which stays
in view and in reach while one is open, as it must while a file is previewed
before its upload. The script, `web/src/narrator/script.ts`, is typed data: the
chapters' steps, each with its target and the moment that ends it, and the
highlights, each with the moments it tells about and what it says. A step that
how things stand already does, such as opening a page already open, is passed
as it comes. Its progress is kept in the browser, so a chapter carries on when
someone signs in as its next persona.

A step points at the app's own elements alone. The viewer's and the editor's
controls are theirs, with no public way to find one, so a step that points at
a button in their toolbar is likely a gap.

## Running it against this checkout

Like the other examples, shockwave is an app of its own and not a workspace.
Unlike them, it installs the udoc packages from this checkout: `file:` links to
`packages/udoc-viewer`, `-editor`, `-node` and `-server`, not npm. npm adds the
links alone, and what the packages import resolves from the repo's
`node_modules`, so a linked engine checkout (`scripts/link-engine.mjs`) is the
engine shockwave runs, and the root's `npm run dev` rebuilds what it serves. It
needs the root's `npm install` first.

`npm run shockwave`, from the repo's root, installs shockwave's dependencies
when they're missing or out of date, builds any of the packages it links that
isn't built (one built already, the root's `npm run dev` may be rebuilding),
and runs its own `npm run dev`. That starts the server under `node --watch`,
which runs its TypeScript as is, and Vite, which proxies `/api` and `/udoc` to
it; `npm run build` then `npm start` serves the built frontend from the server,
on one port. A browser package's worker carries a copy of the engine's glue,
while the binary is loaded as it is now, so `npm run shockwave` also builds
again a browser package whose worker is older than the engine's glue: a
restart after the engine's rebuilt brings them level.
Its data, in `data/`, is ignored by git, and `npm run shockwave:clear` deletes
it, with the backend stopped, to start over from the seed.

It is no integration recipe, so `scripts/examples.mjs` and the Examples
workflow leave it out; ESLint leaves out all of `examples/`, and Prettier
formats it with the rest of the repo.
