# Shockwave

A sales enablement app built on the docMentis udoc packages: Larchmere, an
imaginary asset manager, keeps its pitch books, fact sheets and commentaries in
it, and its sales team uses them with the institutions it pitches. It shows the packages doing a real job, and
is where we dogfood them: what their public API lacks goes in
[`GAPS.md`](GAPS.md). Its design is
[`docs/design/examples-shockwave.md`](../../docs/design/examples-shockwave.md).
So far: signing in, the app's shell, and the library, its folders and files,
each opened in the viewer from its own bytes before it's uploaded, and from
udoc-server once it is; edited in the editor; and saved as versions, which are
reviewed, approved and published; the collections a sales manager arranges
what's published in, for everyone at the tenant to read; and the deal rooms sales
prepare it in together, backstage, each put on a frontstage that its buyers read at
a link, with no account, and what they read, anonymously, for those who shared it.

## Running it

From the repo's root:

```sh
npm install
npm run shockwave  # the backend on 5281, and the pages on http://localhost:5280
```

It runs against this checkout's packages: `npm run shockwave` installs
shockwave's own dependencies when they're missing or out of date, builds any of
those packages not built yet, and runs `npm run dev` here, which does the rest
once those are in place. The viewer's and the editor's workers carry the
engine's JavaScript from when they were built: after the engine's rebuilt
(`just build-wasm` in its checkout), restart shockwave, which builds them again.

`npm run build` then `npm start` serves the built app from the backend alone,
at http://127.0.0.1:5281.

| Setting              | Default | What it is                                                                                   |
| -------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `SHOCKWAVE_PORT`     | `5281`  | The backend's port.                                                                          |
| `SHOCKWAVE_WEB_PORT` | `5280`  | Where Vite serves the pages in development.                                                  |
| `SHOCKWAVE_DATA`     | `data/` | The database, and the documents udoc-server keeps.                                           |
| `UDOC_LICENSE`       | none    | A docMentis license key for the backend's udoc-node; without one, usage is free and metered. |
| `UDOC_DOMAIN`        | none    | The domain that license is issued for.                                                       |

To start over from the seed, stop shockwave and run `npm run shockwave:clear`
from the repo's root (`npm run clear` here), which deletes its data.

## Signing in

An empty database is seeded with Larchmere and its users, who all sign in with
the demo's password, `shockwave`:

| Email                            | Who                                        | Role     |
| -------------------------------- | ------------------------------------------ | -------- |
| `maya.patel@larchmere.example`   | Maya Patel, Product Marketing Manager      | admin    |
| `colin.okafor@larchmere.example` | Colin Okafor, Compliance Officer           | reviewer |
| `sam.hughes@larchmere.example`   | Sam Hughes, Head of Institutional Sales    | manager  |
| `ryan.brooks@larchmere.example`  | Ryan Brooks, Director, Institutional Sales | member   |
| `paula.ortiz@larchmere.example`  | Paula Ortiz, Client Portfolio Manager      | member   |

A database from before one of these users gets them the next time shockwave
starts.

## How it's laid out

| Path      | What                                             |
| --------- | ------------------------------------------------ |
| `server/` | The backend: Fastify, and SQLite (`node:sqlite`) |
| `web/`    | The frontend: React, and React Router            |
| `shared/` | The API's types, which both import               |
| `seed/`   | The seed's files: Larchmere's logo               |

`npm run test:isolation`, from the repo's root or here, attacks each tenant with
another: the real backend, on data of its own, with no browser. Run it after a change
to the data or the routes. It fails for a route, a foreign key or a table it doesn't
attack, and says what to add.
