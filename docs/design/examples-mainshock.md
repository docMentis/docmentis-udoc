# Examples Mainshock

Mainshock is a sales enablement app built on the udoc packages, in
`examples/mainshock/`. The other examples each show one way to install the
viewer and the editor; mainshock is a product a customer would build with them
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
  `examples/mainshock/GAPS.md` — what was needed, what the API offers, the
  workaround if there is one — instead of being reached around.

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
and its name head the sidebar, the logo kept with the tenant and served to its
users alone (`/api/tenants/:id/logo`). Larchmere's is a larch cone, faceted
scales on a shield, with a rising arrow breaking out of it. Mainshock's own
mark is left to the sign-in page, where no tenant is known yet, and the foot of
the sidebar, "Powered by Mainshock".

Each of the three speaks in colors of its own, so that no one takes one for
another: docMentis, the narrator, in its indigo; Mainshock, the app, in
orange, `#fe5000`; and Larchmere, its logo and its documents, in green, forest
`#1f4e3d` and sage `#b5dcc2`, the hue furthest from the other two.

## Who uses it

A user's role is what they may do in the app; their job is a title on their
profile, as Seismic and Highspot keep the two apart:

| Role     | May                                                                                       |
| -------- | ----------------------------------------------------------------------------------------- |
| admin    | keep the library (upload, tag, publish, retire), and the workspace's settings and members |
| reviewer | approve what's submitted to the library, or return it                                     |
| member   | find content, personalize it for a deal, share it, present it                             |

A buyer, a prospect institution or its investment consultant, is no user: they
open a link a member shared with them, with no account.

Larchmere's users are four personas, each a job a sales enablement platform
serves at an asset manager, and each with a udoc capability of their own to
show:

| Persona      | Title                         | Role     | Shows                                                              |
| ------------ | ----------------------------- | -------- | ------------------------------------------------------------------ |
| Maya Patel   | Product Marketing Manager     | admin    | a file viewed before it's uploaded; importing; thumbnails          |
| Colin Okafor | Compliance Officer            | reviewer | a submission marked up in the editor, approved or returned         |
| Simon Brooks | Director, Institutional Sales | member   | a deck personalized for a deal, shared with a buyer, presented     |
| Paula Ortiz  | Client Portfolio Manager      | member   | an RFP response co-edited with Simon; the presenter view at finals |

Maya keeps the library and, as marketing does at many firms Larchmere's size,
runs the platform. Colin is there because an asset manager's fact sheets and
pitch books quote performance, so compliance approves each before sales may
use it. Simon owns the relationship with an institution and runs its search
from the RFP to the finals presentation; Paula is the investment expert at his
side, who answers the RFP's questions on the strategy and presents its
performance. Seismic's sales enabler, who trains and coaches the sales team and
builds its plays, has no persona: none of that is a document. Nor has a content
manager, an admin without the workspace's settings, until Settings has members
to invite.

Each first name starts with the letter of the job, so that someone switching
between them in the narrator keeps them apart: Maya in marketing, Colin in
compliance, Simon in sales, Paula on the portfolio; a buyer, named when share
links come, gets a B. The surnames are ordinary.

A user signs in with their work email, `first.last@larchmere.example` for the
seeded ones, at a domain kept for examples so that none is anyone's, and a
password, checked against the scrypt hash `users` keeps (`server/auth.ts`); the
seeded users share the demo's password, which the README gives.

## How it fits together

```
web/  React, Vite, React Router       server/  Node, Fastify
  pages ───────── /api/* ───────────▶   app routes ──▶ node:sqlite   data/mainshock.db
  udoc-viewer ─── /udoc/* ──────────▶   gate ──▶ udoc-server ──▶ store   data/udoc/
  udoc-editor     HTTP and WebSocket                   └─ UDocNode (udoc-node)
```

**udoc-server keeps the documents; SQLite keeps the app.** The backend builds
udoc-server with `createUDocServer` over a `DirectoryDocumentStore`, mounted at
`/udoc` (`basePath`) on its own HTTP server, and it keeps every document,
renders its pages and serves it part by part and for collaboration. SQLite,
Node's own `node:sqlite`, keeps what the app adds: tenants, users, sessions, and
an asset for each document, naming its tenant and its udoc document id. No
document is kept twice.

**The gate.** udoc-server has no end-user authentication, and its ids are
global. So every `/udoc/*` request and WebSocket upgrade passes the gate first,
which wants a signed-in session and a document id the user's tenant has an
asset for, and lets a user only read it; later, a share link's token admits a
buyer to one document's read routes. The browser never imports or deletes a
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

Mainshock looks like the product it is, and beside it a narrator speaks for
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
  happen: "Viewed before uploading: the viewer rendered the file in your
  browser, in WebAssembly, and it hasn't left your computer." Each shows the
  first time its moment happens, with the moment's figures where it has them
  (its format, its pages, how long it took to open), and stays in the panel's
  list.

The product knows nothing of the narrator. It announces **moments** through a
small module of events of its own (`web/src/moments.ts`) — `route` and
`session`, which say how things stand, and `document:opened` and `asset:added`,
which say what just happened — and marks what a step can point at with
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

Like the other examples, mainshock is an app of its own and not a workspace.
Unlike them, it installs the udoc packages from this checkout: `file:` links to
`packages/udoc-viewer`, `-editor`, `-node` and `-server`, not npm. npm adds the
links alone, and what the packages import resolves from the repo's
`node_modules`, so a linked engine checkout (`scripts/link-engine.mjs`) is the
engine mainshock runs, and the root's `npm run dev` rebuilds what it serves. It
needs the root's `npm install` first.

`npm run mainshock`, from the repo's root, installs mainshock's dependencies
when they're missing or out of date, builds any of the packages it links that
isn't built (one built already, the root's `npm run dev` may be rebuilding),
and runs its own `npm run dev`. That starts the server under `node --watch`,
which runs its TypeScript as is, and Vite, which proxies `/api` and `/udoc` to
it; `npm run build` then `npm start` serves the built frontend from the server,
on one port. A browser package's worker carries a copy of the engine's glue,
while the binary is loaded as it is now, so `npm run mainshock` also builds
again a browser package whose worker is older than the engine's glue: a
restart after the engine's rebuilt brings them level.
Its data, in `data/`, is ignored by git, and `npm run mainshock:clear` deletes
it, with the backend stopped, to start over from the seed.

It is no integration recipe, so `scripts/examples.mjs` and the Examples
workflow leave it out; ESLint leaves out all of `examples/`, and Prettier
formats it with the rest of the repo.

## Step 1: the skeleton

The frontend and the backend, set up and running, with no udoc code yet:

- `examples/mainshock/` as laid out above: one `package.json`, the udoc
  packages linked in it, a `tsconfig` for the Node side (`server/`, `shared/`,
  Vite's config) and one for `web/`, and a `typecheck` script; `npm run
mainshock` from the root.
- The backend: Fastify over the database, its migrations counted by `PRAGMA
user_version`: `tenants` and their logos, `users` and `sessions`, and an
  empty one seeded with Larchmere, its logo and its personas.
- Signing in: a work email and a password, over `GET`, `POST` and
  `DELETE /api/session`, a session in an HTTP-only cookie.
- The frontend: the sign-in page, and the shell, a sidebar beside the page,
  folding to a rail of its icons: under the tenant's logo and name, Home,
  Library, Decks, Deals and Analytics, and after a divider Settings; at its
  foot the user's menu (sign out), then, under a divider, "Powered by
  Mainshock". Each section is a placeholder until its step.
- The examples harness and workflow leaving it out, and `examples/README.md`
  and `CLAUDE.md` saying what it is.

## Step 2: the library

udoc end to end, as Maya keeps Larchmere's library: udoc-server behind the
gate, the viewer in the frontend, and the library's folders and files.

- **One tree.** A tenant's library is a tree: folders, each in its parent or
  at the top and named apart from its siblings, and files, the assets, each in
  a folder or at the top. Nothing sits above it. Seismic puts its folders in a
  teamsite and Highspot its content in spots, each a container with members
  of its own, to wall off what some users mustn't see: a retail arm's content
  from the institutional sales team, one region's disclosures from another's.
  Larchmere is one business selling to institutions, so it would have one: a
  picker with nothing to pick. A tenant that needs a second gets that level
  above its tree then. A salesperson's own decks are kept in Decks, not the
  library, as Seismic keeps them in its Workspace.
- **A file is not its document.** An asset has a name and a folder, and
  points at the udoc document it is now. That leaves room for versions: next
  quarter's fact sheet in place of this one's, its links kept.
- **Uploading.** An admin picks a file, or drops one on the list, and it opens
  in the viewer from its own bytes before anything is sent, beside its name,
  filled in from the file's, and where it goes, the folder they're in.
  Uploaded, it's published at once: compliance review is a step of its own.
- **Reading.** The list shows each file's type, who uploaded it, when, and
  its size; a file opens on a page of its own, in the viewer, from
  udoc-server.
- **Managing.** An admin makes, renames and deletes folders, and renames and
  deletes files; a folder is deleted only once it's empty. Deleting stands in
  for retiring, which comes with a file's review and expiry. A member sees
  none of it, and the API refuses them (`managesLibrary`).

`GET /api/library` lists a folder, or the top; `/api/folders` and
`/api/assets` make, rename and delete them, and `GET /api/assets/:id` is a
file and the path to it.

## Later steps

In an order picked as we go: the narrator; the editor; more of the library,
with Larchmere's content (generated), thumbnails from udoc-server's page
routes, tags and search, moving files between folders, and a file's versions;
compliance review,
a reviewer approving what's submitted to the library before members see it, or
marking it up and returning it; decks, a rep assembling slides from the
library's decks and personalizing them for a deal; share links, a buyer's view
with no account, and which pages they read and for how long; presenting, the
slide show and its presenter view; and co-editing an RFP response over
udoc-server's collaboration.
