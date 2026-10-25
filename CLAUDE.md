# CLAUDE.md

Guidance for Claude Code when working in this repo.

## Repo purpose

`docmentis-udoc` holds the open-source TypeScript packages of docMentis udoc:
the web viewer and editor, `udoc-ui` they are built on, the Node hosts
(`udoc-node`, `udoc-cli`, `udoc-server`), the demo `udoc-demo` and the private
`udoc-docs`. The repo is public and dual-licensed MIT OR Apache-2.0.

The engine they run on is not here. The Rust crates and
`@docmentis/udoc-wasm`, the proprietary WebAssembly runtime built from them,
are developed and released from the private `../docmentis-udoc-engine`. The
packages here depend on an exact `@docmentis/udoc-wasm` version from npm;
when that checkout sits beside this repo, `npm install` links its local build
in place (`scripts/link-engine.mjs`), and `just build-wasm` there refreshes
what the packages here see. `npm run update-engine` moves the pin to the
latest engine release (`-- <version>` for another), with the lockfile,
udoc-ui's generated engine version and the CDN URLs the docs write out.

## Conventions

- Packages live under `packages/<name>/`, one npm workspace each.
- `udoc-ui` imports neither the viewer nor the editor, and the viewer never
  imports the editor; `eslint.config.mjs` enforces both.
- A public export's doc comment is its entry in the API reference:
  `udoc-docs` generates the reference from the packages' built declarations
  with TypeDoc, so write it for the package's users. A release deploys the
  docs to GitHub Pages once its packages are on npm
  (`.github/workflows/docs.yml`, run by the Release workflow);
  docmentis-site proxies `docmentis.com/docs` to it.
- The guides are `packages/udoc-docs/guide/*.md`, one task per page, written
  once for the viewer and the editor (a code group where their code differs),
  and listed in order in `.vitepress/config.ts`. Its frontmatter
  `description`, a sentence on what the reader does in it, is what search
  engines show under its title. A guide links to the API reference rather
  than repeating it. Its code samples are files in
  `packages/udoc-docs/snippets/`, embedded with `<<< @/snippets/…`, so the
  docs package's typecheck compiles them against the built packages. A guide
  folder gets no `index.md`: the site's proxy needs a rule for each folder
  page, and has them only for the reference's.
- `examples/` holds an app per framework or bundler, each with the viewer and
  the editor side by side. They aren't workspaces, and install the packages
  from npm. `npm run examples` (`scripts/examples.mjs`) packs udoc-ui, the
  viewer and the editor, installs them in a copy of each example outside the
  repo, builds it and opens it in headless Chrome; the Examples workflow runs
  it on a change to the browser packages or the examples, and nightly. A change to how the packages load (the engine, its
  fonts, the workers, a new bare import) runs it before it lands.
- Every package except `udoc-docs` is published, with its own copy of
  `LICENSE-MIT` and `LICENSE-APACHE` listed in its `files`, and a
  `repository` naming this repo, which npm's provenance checks.
- `udoc-demo` is published built, its `dist/`, without the engine: its host
  serves `@docmentis/udoc-wasm` beside it, in `udoc-wasm/`. docmentis-site
  installs it and serves it at `/demo/`, its viewer demo opening `?mode=view`
  and its editor demo `?mode=edit`.
- The published packages release together at one version, on the major and
  minor of the engine they pin, and only from CI:
  `npm run release -- <patch|minor|major|version>` tags a release and
  `.github/workflows/release.yml` publishes it
  ([`docs/design/releasing.md`](docs/design/releasing.md)). Never
  `npm publish` by hand. A change a package's users will notice gets a line
  under `## [Unreleased]` in `CHANGELOG.md`, under the package's heading; the
  `changelog` skill (`.claude/skills/changelog/`) collects what's missing before
  a release, the engine's changes included.
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
npm run dev               # the demo, with the UI packages and udoc-server rebuilding
npm run docs              # the docs site, its API reference from the built packages
npm run examples          # each example, built and opened in a browser
npm run release -- patch  # cut a release, which CI publishes
```
