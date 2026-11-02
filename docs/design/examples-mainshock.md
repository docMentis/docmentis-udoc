# Examples Mainshock

Mainshock is a sales enablement app built on the udoc packages, in
`examples/mainshock/`. The other examples each show one way to install the
viewer and the editor; mainshock is a product a customer would build with them
— a content library, decks personalized for a deal, links shared with buyers,
presenting — run locally, with Acme Corp as its example tenant. It is there for
two reasons:

- **A showcase.** Each workflow puts a udoc capability in front of someone with
  a reason to use it: the viewer for a buyer reading a proposal, the editor for
  a rep personalizing a deck, the slide show for presenting, the server for
  keeping and rendering the library.
- **Dogfooding.** It uses the public API alone, as a customer can: what
  `@docmentis/udoc-viewer`, `-editor`, `-node` and `-server` export, never
  `@docmentis/udoc-ui/internal`. Where the API falls short, the gap goes in
  `examples/mainshock/GAPS.md` — what was needed, what the API offers, the
  workaround if there is one — instead of being reached around.

## Who uses it

| Role      | Who                      | Does                                                     |
| --------- | ------------------------ | -------------------------------------------------------- |
| marketing | Acme's content team      | keeps the library: uploads, tags, retires content        |
| sales     | Acme's reps              | finds content, builds decks for a deal, shares, presents |
| buyer     | a prospect, outside Acme | opens a shared link, with no account                     |

Marketing and sales are a tenant's users; a buyer comes through a share link.
Each role is played by a persona, a seeded user whose name is still to be
picked. A user signs in with a username and a password, checked against the
scrypt hash `users` keeps (`server/auth.ts`); the seeded users share the
demo's password, which the README gives.

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
asset for; later, a share link's token admits a buyer to one document's read
routes. The browser never imports a document into udoc-server: the backend
does.

**Importing.** An upload goes to `POST /api/assets`, and the backend imports it
and records the asset under the id udoc-server answers. udoc-server imports only
over HTTP, through its `POST /documents` route, so the backend posts to its own
`/udoc/documents` over loopback, with a per-process token the gate admits: the
first entry in `GAPS.md`.

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
Acme's app so that no one takes one for the other, collapsing to a badge in the
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
the product whole. The script, `web/src/narrator/script.ts`, is typed data: the
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
on one port.
Its data, in `data/`, is ignored by git, and deleting it starts over from the
seed.

It is no integration recipe, so `scripts/examples.mjs` and the Examples
workflow leave it out; ESLint leaves out all of `examples/`, and Prettier
formats it with the rest of the repo.

## Step 1: the skeleton

- `examples/mainshock/` as laid out above: one `package.json`, a `tsconfig`
  for the Node side (`server/`, `shared/`, Vite's config) and one for `web/`,
  and a `typecheck` script.
  The frontend and the backend, set up and running, with no udoc code yet:

- `examples/mainshock/` as laid out above: one `package.json`, the udoc
  packages linked in it, a `tsconfig` for the Node side (`server/`, `shared/`,
  Vite's config) and one for `web/`, and a `typecheck` script; `npm run
mainshock` from the root.
- The backend: Fastify over the database, its migrations counted by `PRAGMA
user_version`: `tenants`, `users` and `sessions`, and an empty one seeded
  with Acme Corp and its personas, one in marketing and two in sales.
- Signing in: a username and a password, over `GET`, `POST` and
  `DELETE /api/session`, a session in an HTTP-only cookie.
- The frontend: the sign-in page, and the shell, a sidebar — Home, Library,
  Decks, Deals, Analytics — and a top bar with the tenant and the user's menu
  (sign out); each section a placeholder until its step.
- The examples harness and workflow leaving it out, and `examples/README.md`
  and `CLAUDE.md` saying what it is.

## Later steps

In an order picked as we go: udoc end to end, udoc-server in the backend behind
the gate and the viewer and the editor in the frontend; the narrator; the
library, with Acme's content (generated),
thumbnails from udoc-server's page routes, tags and search; decks, a rep
assembling slides from the library's decks and personalizing them for a deal;
share links, a buyer's view with no account, and which pages they read and for
how long; presenting, the slide show and its presenter view; and co-editing a
proposal over udoc-server's collaboration.
