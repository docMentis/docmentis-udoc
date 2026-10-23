# CLAUDE.md

Guidance for Claude Code when working in this repo.

## Repo purpose

`docmentis-udoc` holds the open-source TypeScript packages of docMentis udoc:
the web viewer and editor, `udoc-ui` they are built on, the Node hosts
(`udoc-node`, `udoc-cli`, `udoc-server`) and the private `udoc-demo` and
`udoc-docs`. The
repo is public and dual-licensed MIT OR Apache-2.0.

The engine they run on is not here. The Rust crates and
`@docmentis/udoc-wasm`, the proprietary WebAssembly runtime built from them,
are developed and released from the private `../docmentis-udoc-engine`. The
packages here depend on an exact `@docmentis/udoc-wasm` version from npm;
when that checkout sits beside this repo, `npm install` links its local build
in place (`scripts/link-engine.mjs`), and `just build-wasm` there refreshes
what the packages here see.

## Conventions

- Packages live under `packages/<name>/`, one npm workspace each.
- `udoc-ui` imports neither the viewer nor the editor, and the viewer never
  imports the editor; `eslint.config.mjs` enforces both.
- A public export's doc comment is its entry in the API reference:
  `udoc-docs` generates the reference from the packages' built declarations
  with TypeDoc, so write it for the package's users. Publishing a GitHub
  release deploys the docs to GitHub Pages (`.github/workflows/docs.yml`);
  docmentis-site proxies `docmentis.com/docs` to it.
- The guides are `packages/udoc-docs/guide/*.md`, one task per page, written
  once for the viewer and the editor (a code group where their code differs),
  and listed in order in `.vitepress/config.ts`. A guide links to the API
  reference rather than repeating it. Its code samples are files in
  `packages/udoc-docs/snippets/`, embedded with `<<< @/snippets/…`, so the
  docs package's typecheck compiles them against the built packages. A guide
  folder gets no `index.md`: the site's proxy needs a rule for each folder
  page, and has them only for the reference's.
- Every package except `udoc-demo` and `udoc-docs` is published, with its own
  copy of `LICENSE-MIT` and `LICENSE-APACHE` listed in its `files`.
- Everything Prettier formats is formatted: the pre-commit hook
  (`.githooks/pre-commit`, turned on by `npm install`) rejects a commit whose
  staged files `prettier --check` fails. `npm run format` fixes them.

## Design docs

Architecture & design documents live under [`docs/design/`](docs/design/).

- [`docs/design/README.md`](docs/design/README.md) is the canonical index.
  **When adding, renaming, or removing a topic doc, update the index in
  the same commit** — the index is the discoverability surface.
- One topic per file. Filenames are kebab-case, lowercase, `.md`. The H1
  inside the file should match the filename (Title Case).
- Keep each topic scoped to roughly one screen. If a topic outgrows that,
  split it rather than letting it bloat.
- The engine's design docs are in the private engine repo: name them in
  prose, never link them.

## Commit messages

Conventional Commits, capitalized subjects:

- Subject: `<type>(<scope>): <Capitalized subject>` — imperative, no trailing
  period, ~72 chars max. Types: `feat`, `fix`, `refactor`, `test`, `docs`,
  `chore`. Scope is the affected package or subsystem (e.g. `ui`, `editor`,
  `viewer`, `node`, `server`, `demo`).
- Body: blank line after the subject, wrap ~72 cols, `*` bullets for
  multi-point changes, and a brief test coverage line when relevant.

## Build / check

```sh
npm install
npm run build
npm run typecheck
npm test
npm run lint
npm run format:check
npm run dev     # the demo, with the UI packages and udoc-server rebuilding
npm run docs    # the docs site, its API reference from the built packages
```
