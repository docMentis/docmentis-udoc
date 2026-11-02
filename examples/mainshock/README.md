# Mainshock

A sales enablement app built on the docMentis udoc packages: Larchmere, an
imaginary asset manager, keeps its pitch books, fact sheets and commentaries in
it, and its sales team uses them with the institutions it pitches. It shows the packages doing a real job, and
is where we dogfood them: what their public API lacks goes in
[`GAPS.md`](GAPS.md). Its design is
[`docs/design/examples-mainshock.md`](../../docs/design/examples-mainshock.md).
So far it's the skeleton: signing in, and the app's shell.

## Running it

From the repo's root:

```sh
npm install
npm run mainshock  # the backend on 5281, and the pages on http://localhost:5280
```

It runs against this checkout's packages: `npm run mainshock` installs
mainshock's own dependencies when they're missing or out of date, builds any of
those packages not built yet, and runs `npm run dev` here, which does the rest
once those are in place.

`npm run build` then `npm start` serves the built app from the backend alone,
at http://127.0.0.1:5281.

| Setting              | Default | What it is                                  |
| -------------------- | ------- | ------------------------------------------- |
| `MAINSHOCK_PORT`     | `5281`  | The backend's port.                         |
| `MAINSHOCK_WEB_PORT` | `5280`  | Where Vite serves the pages in development. |
| `MAINSHOCK_DATA`     | `data/` | The database.                               |

To start over from the seed, stop mainshock and run `npm run mainshock:clear`
from the repo's root (`npm run clear` here), which deletes its data.

## Signing in

An empty database is seeded with Larchmere and its users, who all sign in with
the demo's password, `mainshock`:

| Username | Who                                   |
| -------- | ------------------------------------- |
| `maya`   | Maya Patel, Product Marketing Manager |
| `dan`    | Dan Brooks, Account Executive         |
| `lena`   | Lena Ortiz, Sales Engineer            |

## How it's laid out

| Path      | What                                             |
| --------- | ------------------------------------------------ |
| `server/` | The backend: Fastify, and SQLite (`node:sqlite`) |
| `web/`    | The frontend: React, and React Router            |
| `shared/` | The API's types, which both import               |
