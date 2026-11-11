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

| Job                                 | docMentis today                                                                                                              | Strength                         |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Previewing the library, any format  | the viewer: PDF, DOCX, PPTX, XLSX, images, Markdown, HTML, CSV, video and audio, web pages                                   | core                             |
| Previewing before uploading         | the viewer renders the file in the browser, in WebAssembly; it never leaves the computer                                     | core                             |
| Thumbnails                          | udoc-server's page routes, PNG or SVG; udoc-node's `exportPageToBytes`                                                       | core                             |
| Personalizing a deck                | the editor edits the PPTX, DOCX or XLSX itself, in the browser, with no trip to desktop Office                               | core                             |
| A frozen PDF of an approved version | `exportToBytes("pdf")`, udoc-server's `pages.pdf`                                                                            | core                             |
| Compliance review                   | annotations, and comment threads with their replies                                                                          | partial: checked for a PDF alone |
| Co-editing an RFP                   | udoc-server's collaboration over WebSocket, with presence and each other's pointers                                          | core                             |
| Presenting                          | the slide show: PowerPoint's transitions, animations and Morph, the presenter view on a second screen; a PDF too             | core                             |
| Buyer engagement, page by page      | the viewer's `currentPage:changed`, `viewport:changed`, `document:downloaded` and `document:printed`, which the host records | core                             |
| Sharing under control               | `setWatermarks`; `showDownloadButton`, `showPrintButton` and `enableCopy` turned off                                         | partial: no redaction            |
| Searching the library, AI on it     | search within one document alone: only a word document saves as text or Markdown, and a PDF's or a deck's text can't be had  | gap                              |
| Decks generated from a template     | udoc-node opens, saves and exports a document, with no API to edit it                                                        | gap                              |
| Copying slides between decks        | not looked into yet                                                                                                          | likely gap                       |

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
users alone (`/api/tenants/:id/logo`). An admin replaces it in Settings, and
sets the brand's color there, which seeds the app's colors: Material 3's
light and dark schemes, its tonal palettes made from the color in HCT, in
the browser (`web/src/scheme.ts`). The admin colors the document viewer
there too, over a preview of a sample deck that changes as they choose: its
toolbar and the background around its pages, each the viewer's own or one
of the four surface containers the brand's color makes, low to highest
(Brand 1 to 4), and its primary, the viewer's own or the app's. Every
viewer in the app
takes them. A user switches the theme, light or dark, with the button
beside their avatar, the system's until they do and again once they switch
to it, and the viewer follows it; the narrator stays light. Larchmere's is a larch cone, faceted
scales on a shield, with a rising arrow breaking out of it. Shockwave's own
mark is left to the sign-in page, where no tenant is known yet, and the foot of
the navigation, "Powered by Shockwave".

Each of the three speaks in colors of its own, so that no one takes one for
another: docMentis, the narrator, in its indigo; Shockwave in orange,
`#fe5000`, its mark and, before a tenant is known, the sign-in page; and
Larchmere in green, forest `#1f4e3d` and sage `#b5dcc2`, the hue furthest
from the other two: its logo, its documents, and, its brand's color, the app
its users see.

## The app

The app is Material 3, all of it: its color roles and schemes, shape scale,
type scale, state layers and elevation, and each component as Material's
tokens give it (`web/src/app.css`); what Material has no component for is
built from those, and says so. Its controls are one height, 32, a desktop
app's: buttons and icon buttons Material 3 Expressive's extra-small ones,
chips their own height, and segmented buttons, text fields (their labels
read but not shown) and search bars taken to it, below any size Material
gives them. The rest is Material's density −2, each component the height
Angular Material's Material 3 tokens give it there. It is its
sections, in a navigation down the window's left, Material 3 Expressive's
navigation rail, and its top app bar across the rest: the tenant's brand, the search bar in its middle, and at its right the
theme's button, the bell for notifications, and the user's avatar, which
opens their menu. A menu button at the navigation's top collapses the rail
from its expanded form, each section's icon and name side by side, to its
icons alone, their names tooltips, and back. Content
moves through the sections one way:

```
Library ──publish──▶ Collections ──add to a deal──▶ Deal Room ──share──▶ buyer
marketing prepares,   a sales manager arranges,      backstage: prepared   frontstage:
compliance approves   sales find                     and personalized      what they see
```

- **Home**: what needs the user, and what's new for them, in the sections
  their role has: what needs their attention, for everyone; what's new in the
  Library, for those who keep and review it; and for sales, their deal rooms
  and their collections. A section whose feature isn't built yet says what it
  will hold.
- **Library**: content before it's sold with. Marketing creates and prepares
  it, and compliance reviews it, through [versions](#versions) of which only
  approved ones are published. Sales never see it. Outside vendors and partners
  who work on its content come later.
- **Collections**: how sales get content. A sales manager arranges published
  content into collections, picking it from what's published, and gives each
  collection a description and instructions, and each document in it its own.
  Sales find their content here, and everyone at the tenant can read it
  ([below](#collections)).
- **Deal Rooms**: where sales prepare content for a deal and share it. Content
  comes in from collections. A deal room's backstage is where sales prepare and
  personalize it; its frontstage is what the buyer sees, at a link, with no
  account.
- **Learning**: where sales learn, and their managers prepare what they teach.
- **Insights**: how content is used and read, from the Library to the buyer.
- **Settings**: the workspace's, after a divider, an admin's, in two pages:
  Brand, the tenant's logo and its brand's color, and Users, who's in it.

Search finds what the user may see, by name, description and tag: the Library
for those who keep it, collections for everyone, deal rooms for sales. A document's text
waits on the engine (above).

## Who uses it

A user's role is what they may do in the app; their job is a title on their
profile, as Seismic and Highspot keep the two apart:

| Role     | May                                                                                                      |
| -------- | -------------------------------------------------------------------------------------------------------- |
| admin    | keep the Library (create, prepare, submit, publish what's approved, retire), see Insights, and Settings  |
| reviewer | review what's sent to them from the Library or a deal room: approve it, or return it with a note         |
| manager  | arrange Collections, teach in Learning, enter every deal room, see Insights, and all a member may        |
| member   | find content in Collections, prepare it and share it in the Deal Rooms they're on, and learn in Learning |

A user sees Home and the sections their role may use: neither a manager nor a
member sees the Library, and neither an admin nor a reviewer sees Deal Rooms.
Everyone sees Collections, which only a manager
arranges. A buyer, a prospect institution or its investment
consultant, is no user: they open a deal room's frontstage at a link a seller
shared with them, with no account.

Larchmere's users are five personas, each a job a sales enablement platform
serves at an asset manager, and each with a udoc capability of their own to
show:

| Persona      | Title                         | Role     | Shows                                                                            |
| ------------ | ----------------------------- | -------- | -------------------------------------------------------------------------------- |
| Maya Patel   | Product Marketing Manager     | admin    | a file viewed before it's uploaded; importing; thumbnails                        |
| Colin Okafor | Compliance Officer            | reviewer | a version read as it was submitted, approved or returned                         |
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
  udoc-viewer ─── /udoc/* ──────────▶   gate ──▶ a tenant's udoc-server ──▶ its store   data/udoc/:tenantId/
  udoc-editor     HTTP and WebSocket                   └─ UDocNode (udoc-node)
```

**udoc-server keeps the documents; SQLite keeps the app.** The backend builds a
udoc-server for each tenant with `createUDocServer` over a `DirectoryDocumentStore`,
mounted at `/udoc` (`basePath`) on its own HTTP server, and it keeps that tenant's
documents, renders their pages and serves them part by part and for collaboration.
SQLite, Node's own `node:sqlite`, keeps what the app adds: tenants, users, sessions, and
an asset for each document, naming its tenant and its udoc document id, and each
version's pages as thumbnails, rendered by udoc-server once, as the version's
uploaded or saved. No document is kept twice.

**Tenants.** Shockwave is multi-tenant, and no tenant sees anything of another. They
share one database, and each row says whose it is:

- **The schema.** Every table but `tenants` has `tenant_id`. It starts every table's
  key, but for `sessions`' token and `version_events`' row number, and it's part of
  every foreign key, so no row can refer to another tenant's.
- **The queries.** The routes and the gate hold no database. They hold a `TenantDb`
  for the request's tenant (`server/db.ts`), which refuses a statement that doesn't
  name `:tenant`, and binds it itself, so a query that forgets its tenant fails the
  first time it runs. A route gets one from `Scope` (`server/scope.ts`), with that
  tenant's documents.
- **The documents.** Each tenant has its own folder, `data/udoc/:tenantId`, and its own
  udoc-server, with its own sessions. A request goes to its tenant's, where another
  tenant's document isn't there to find, whatever the gate lets through; and one
  tenant's load doesn't close another's sessions.
- **The way in.** A request says which tenant it's for by a user's email, a session's
  token, or a frontstage's token, each unique across tenants, and those lookups, in
  `server/auth.ts`, are all that read across them. So one email is one account, at one
  tenant. Sign-in takes as long for an email no one has, so that it doesn't say which
  do, at any tenant. An image a browser keeps it asks about each time, so that whoever
  signs in next on that browser gets the refusal, not what's kept.

Its `npm run test:isolation` holds this to it: the real backend, with a second tenant, each
attacked through every route and the gate, and by holding rows with the very ids the
other's have, so that a statement that forgets its tenant answers with the wrong row or
changes the wrong one. It fails for a route, a foreign key or a table it doesn't
attack, so something new has to say how it's attacked.

An operation across tenants, when one comes, is something else: it holds the database
itself, or a `TenantDb` for each tenant it names, in a module of its own. A route never
reaches one by accident.

**The gate.** udoc-server has no end-user authentication. So every `/udoc/*` request
and WebSocket upgrade passes the gate first, which wants a signed-in session and a
document id the user's tenant has an
asset for, and lets a user only read it. Those who read the Library read all of
it; anyone else reads only the checkpoint its file publishes, and nothing of the
document around it. An upgrade, which joins the collaboration that edits a
document, passes only for those who change the Library. A deal room's file is
another matter: those who enter the room read it and join its collaboration, and
a reviewer reads the versions sent to them. A buyer has no session: a frontstage's
link admits them to the package of each file it shows, at the version it shows
([below](#deal-rooms)). The browser
never imports, checkpoints or deletes a document in udoc-server: the backend does.

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

**Editing.** An admin edits a file's working copy, the document as it is now, in
the editor, joined to udoc-server's collaboration through the gate, on the same
page and in the same card the viewer fills.

**Licensing.** The browser packages and `UDocNode` each take a permit for each
session. The backend builds its `UDocNode` with `UDOC_LICENSE` and
`UDOC_DOMAIN` from the environment when they're set, as udoc-server's own
command does.

## Versions

A version is a checkpoint of the file's document, which udoc-server keeps as it
was, whatever happens to the document after. udoc has no second idea of a version:
the app's `versions` table names the checkpoints that matter, and numbers them 1,
2, 3 for people, since udoc-server's own numbers have gaps. An upload is version 1,
the checkpoint importing it made. `Save version` asks udoc-server for another.

Because a version never moves, nothing is locked. The working copy goes on being
edited while a version is reviewed, and what's approved and published is exactly
what was read.

```
save ──▶ draft ──submit──▶ submitted ──approve──▶ approved ──publish──▶ the file's published version
                               └──────return──▶ returned
```

| Step     | Who                                 | What it does                                                                                                            |
| -------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| save     | admin                               | a new checkpoint, a draft version, with a note on what changed                                                          |
| submit   | admin                               | sends a draft to the reviewer they choose                                                                               |
| reassign | admin, or the reviewer it's sent to | sends it to another reviewer                                                                                            |
| approve  | the reviewer it's sent to           | approves what was submitted, as it stands                                                                               |
| return   | the reviewer it's sent to           | sends it back with a note. It stays returned: what changes goes in a new version                                        |
| publish  | admin                               | makes an approved version the file's published one, in place of any before, so an older one takes the file back to it   |
| dismiss  | admin                               | takes an approved or returned version off what's waiting; it stays as it is, and an approved one can still be published |

A version goes to one reviewer, who alone decides it, so it's on record who was
responsible. No one reviews what they submitted themselves: roles keep the two apart
today, and the backend rules it out whatever a role comes to allow.

Publishing is apart from a version's status, a pointer on the file
(`assets.published_version`): an approved version stays approved once another
replaces it, and can be published again. Who did what, when, to whom and with what
note is kept as it happened (`version_events`), each version's history.

A file's page opens the working copy for those who edit it, and for anyone else, the
version sent to them to review, or else the latest; its Versions tab opens any other,
read-only, as a checkpoint is. The Library shows where each file's versions stand,
its latest and any other that's published, and filters by it.

Home's "Needs your attention" lists the versions waiting on the user, by who they
are and not by their role, each saying what for and opening that version:

| Waiting   | On               | Until                                                     |
| --------- | ---------------- | --------------------------------------------------------- |
| to review | the reviewer     | it's approved, returned or reassigned                     |
| returned  | who submitted it | they submit a later version, or dismiss it                |
| approved  | who submitted it | it's published, or a later version is, or they dismiss it |

A version published once isn't waiting to be again, so rolling back leaves nothing
behind. Sales read a published version through [Collections](#collections); the gate
lets them read that and no more.

What this can't do yet is in `GAPS.md`: marking up anything but a PDF, taking a new
upload as a version, and rendering a checkpoint's pages as images. Retiring a file,
and a version's expiry, are still to come.

## Collections

A collection is published files a manager arranges for those who sell, with what it's
for, how to use it, and how to use each file in it. A tenant has as many as it takes,
each choosing its own files; a file can be in any number of them, with its own
instructions and place in each.

| Step               | Who      | What it does                                                                  |
| ------------------ | -------- | ----------------------------------------------------------------------------- |
| make, edit, delete | manager  | a collection's name, description and instructions; its files stay as they are |
| add                | manager  | puts published files at its end, picked from all the tenant publishes         |
| arrange            | manager  | says how to use a file, moves it earlier or later, or takes it out            |
| read               | everyone | its files, each opening its published version in the viewer                   |

**An item is a file, not a version.** It shows whichever version the file publishes:
publishing another, or rolling back, reaches every collection holding the file at once,
so none goes on offering a version compliance has replaced. Only a published file can
be added, and deleting a file takes it out of every collection.

**A collection shows the published version, and nothing around it.** The API answers a
`PublishedFile`, with no working copy, other versions or uploader, whoever asks. For
those who don't read the Library, a version's thumbnails are theirs only while it's the
one published, so a draft's pages never reach them, and the gate opens that
checkpoint alone. A card here flips through that version's pages, as they were saved.

**A tenant's collections are its own** ([above](#how-it-fits-together)): another
tenant's answers `404`, as one that isn't there. Within a tenant, everyone sees all its
collections.

## Deal Rooms

A deal room has two faces. Backstage is where those who sell prepare content for one
deal, together. Its frontstage is what the deal's buyers read, at a link, with no
account. Nothing reaches a buyer until someone puts it there.

| Step              | Who                 | What it does                                                                          |
| ----------------- | ------------------- | ------------------------------------------------------------------------------------- |
| make, set, delete | those who enter it  | a room's title, description, banner color and image, and who's on it                  |
| add               | those who enter it  | copies files from the tenant's collections, each at the version the library publishes |
| edit              | those who enter it  | a copy, together in the editor, through its versions                                  |
| review            | the reviewer chosen | approves or returns a version saved after the copy was made                           |
| put on frontstage | those who enter it  | shows what's chosen, makes the link, or updates what the link shows                   |
| take off          | those who enter it  | the link stops working for good; putting the room back makes a new one                |
| read              | anyone with a link  | the frontstage's banner and files, each opening read-only in the viewer               |

A manager enters every room at their tenant; a member, those they're on, starting with
those they make. An admin or a reviewer enters none.

**A file is a copy, not a reference.** Personalizing means editing the document, so
each file is a document of its own, an asset that `deal_room_files` holds out of the
Library, with the version it came from recorded. It doesn't follow the file it came
from: when the Library publishes another version, the room says so and the copy stays
as it is. Deleting the Library's file leaves it. udoc-server can't copy a document, so
the backend saves the checkpoint in its format and imports that (`GAPS.md`).

**What a buyer reads has been approved.** A copy's first version is approved as the
version it copied was. An edit is saved as a new version and reviewed as a Library
file's is, by the reviewer it's sent to, who reads that version and nothing else of the
room. A file goes on the frontstage at its latest approved version; a version still in
review, or edits not saved as one, stay backstage.

**The frontstage is a copy of its own.** Putting a room on copies its title,
description and banner into `frontstages`, and each file's name, description and place
into `frontstage_files`, and sets the version shown as the asset's `published_version`.
Its routes (`/api/frontstage/:token`) read these alone, so nothing backstage can reach
them. Changing a setting, approving a version or adding a file shows backstage as
changes the frontstage doesn't have yet, until someone updates it. Updating keeps the
link.

**A buyer's link is all they have.** Its token is 256 random bits. The viewer opens a
file at `/udoc/frontstage/:token/files/:assetId/versions/:number/package`, which the
gate checks against what the frontstage shows and turns into that checkpoint's package,
so a buyer never learns a document's id. No other udoc-server route is open to them.
Their viewer has no download or print button, so that the source stays here, and no
annotating, since what they marked would go nowhere. A deck's speaker notes and hidden
slides still reach them (`GAPS.md`), so it's on whoever prepares a file to clear them.

The page is the room's banner, its image under its color, which fades up from the text
so that it reads on any image, over one row to a file: the document and what it says
side by side, turn about. Pressing one opens the document; its card flips through the
pages of the version shown.

**What buyers read is recorded, anonymously, and both of their pages say so.** A browser
that comes gets a cookie for that link alone, naming a visitor with nothing of who it is,
so that it can't be followed from one frontstage to another. It reports coming, opening a
file, and how long each page stays on screen: only while the page is in view and something's
been done with it in the last minute. Time in a slide show isn't counted, since the viewer
doesn't say which slide it's on (`GAPS.md`). This is the one thing anyone can write with no
account, so a report has to be about a file that frontstage shows, small, and one of 120 a
minute from an address at that link, which leaves other links alone. Those signed in at the
tenant aren't counted.

It's kept as running totals, by visitor, file, version and page, so it grows with visitors
and pages and not with time. Backstage, a room shows how many came, each file's visitors,
opens, time and last opening, and the time on each page of the version shown. Home tells
those on a room of visitors since they last looked at it; a manager who isn't on it sees them
by opening it. Taking a room off its frontstage keeps all this; removing a file or deleting a
room deletes what's of it.

## The narrator

Shockwave looks like the product it is, and beside it a narrator speaks for
docMentis. It's a panel docked at the window's right edge, styled apart from
the app so that no one takes one for the other, collapsing to a badge in the
corner. It stays beside a deal room's frontstage too, with no one signed in: the
buyer's experience is part of what's shown. It shows two kinds of card:

- **Guides**, which the visitor clicks for the narrator to do something in the
  app for them, as a visitor would, through the app's own forms and buttons:
  "Sign in as Maya Patel" fills in the sign-in form and presses its button. A
  page's guides show while it does, first in the panel.
- **Highlights**, what just happened and the docMentis technology that made it
  happen: "Previewed before upload. Client-first: docMentis rendered this file
  in your browser, so you see it before it's uploaded, not after." A
  highlight shows when what it tells about shows, and goes when it goes: the
  preview's, while the preview is open; the streaming's, while a file's page
  shows it open; the thumbnails', while a card that flips is in view; the viewer's
  colors', while the brand settings show them. It has
  the moment's figures where it has them (its format, how long it took to
  open), and sits in the panel's list, newest first.

The product knows nothing of the narrator. It announces **moments** through a
small module of events of its own (`web/src/moments.ts`) — `document:opened`,
`document:closed`, `thumbnails:shown`, `thumbnails:hidden`,
`viewer-colors:shown` and `viewer-colors:hidden`, which say what just
happened — and the narrator is their only listener. Taking it out leaves the
product whole. The product's root, `#app`, is all of the window it knows:
its dialogs are modal to it alone, over it and not the narrator, which stays
in view and in reach while one is open, as it must while a file is previewed
before its upload. The script, `web/src/narrator/script.ts`, is typed data: the
guides, each with the page it's offered on and what it does, and the
highlights, each with the moments it tells about and what it says.

A guide acts through the app's own elements alone. The viewer's and the
editor's controls are theirs, with no public way to find one, so a guide that
would press a button in their toolbar is likely a gap.

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
