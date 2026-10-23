# Contributing to docMentis udoc

Thank you for your interest in contributing to docMentis udoc! This guide will help you get started.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 22.18 or later
- npm (comes with Node.js)

### Setup

```bash
# Clone the repository
git clone https://github.com/docMentis/docmentis-udoc.git
cd docmentis-udoc

# Install dependencies (and the pre-commit hook)
npm install

# Build all packages
npm run build

# Run the demo app (http://localhost:5173), with the UI packages and udoc-server rebuilding as you edit
npm run dev
```

### Project Structure

```
docmentis-udoc/
├── packages/
│   ├── udoc-ui/        # The UI the viewer and the editor are built on (@docmentis/udoc-ui)
│   ├── udoc-viewer/    # Document viewer (@docmentis/udoc-viewer)
│   ├── udoc-editor/    # Document editor (@docmentis/udoc-editor)
│   ├── udoc-node/      # The engine in Node.js (@docmentis/udoc-node)
│   ├── udoc-cli/       # The `udoc` command (@docmentis/udoc-cli)
│   ├── udoc-server/    # Document server (@docmentis/udoc-server)
│   ├── udoc-demo/      # Demo application (not published)
│   └── udoc-docs/      # Docs site: guides and API reference (not published)
├── docs/design/        # Architecture and design documents
├── scripts/            # Repo scripts: engine linking, releases
└── .github/            # CI, release and docs workflows
```

### Key Commands

```bash
npm run build          # Build all packages
npm run dev            # Run the demo app
npm run docs           # Run the docs site
npm run typecheck      # Type-check every package
npm test               # Run the tests
npm run lint           # Lint
npm run format         # Format with Prettier (format:check to check only)
npm run clean          # Clean build outputs
```

## How to Contribute

### Reporting Bugs

1. Search [existing issues](https://github.com/docMentis/docmentis-udoc/issues) first to avoid duplicates.
2. Use the **Bug Report** issue template.
3. Include a minimal reproduction (a code snippet, a link to a repo, or a failing example).
4. Specify the package and its version, and the browser or Node.js version and OS.

### Suggesting Features

1. Search [existing issues](https://github.com/docMentis/docmentis-udoc/issues) to see if the feature has been suggested.
2. Use the **Feature Request** issue template.
3. Explain the use case and why it would benefit the project.

### Submitting Pull Requests

1. **Open an issue first** — for non-trivial changes, discuss the approach before writing code.
2. **Fork the repository** and create your branch from `main`.
3. **Make your changes** — keep the scope focused; one feature or fix per PR.
4. **Build and verify** — run `npm run build`, `npm run typecheck`, `npm test`, `npm run lint` and `npm run format:check`, and try your changes in the demo app.
5. **Add a changelog entry** — a change users will notice gets a line under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md), under its package's heading.
6. **Write a clear PR description** — explain what changed and why.
7. **Submit the PR** — a maintainer will review it.

### Branch Naming

Use descriptive branch names with a prefix:

- `fix/` — bug fixes (e.g., `fix/toolbar-zoom-button`)
- `feat/` — new features (e.g., `feat/keyboard-shortcuts`)
- `docs/` — documentation changes (e.g., `docs/react-example`)
- `refactor/` — code refactoring (e.g., `refactor/viewer-lifecycle`)

### Commit Messages

Write [Conventional Commits](https://www.conventionalcommits.org/) with a capitalized subject, scoped to the package or subsystem the change is in:

```
fix(viewer): Correct zoom level calculation on mobile

The zoom level was not accounting for device pixel ratio on mobile
browsers, causing blurry rendering at non-default zoom levels.
```

Use a type of `feat`, `fix`, `refactor`, `test`, `docs` or `chore`, and a scope such as `ui`, `viewer`, `editor`, `node`, `cli`, `server`, `demo` or `docs`. Keep the subject imperative, without a trailing period, and wrap the body at about 72 columns.

## What You Can Contribute To

The TypeScript packages in this repository are open source (MIT OR Apache-2.0). Here are areas where contributions are welcome:

- **Bug fixes** — rendering issues, UI glitches, lifecycle bugs
- **Documentation** — READMEs, guides in `packages/udoc-docs/guide/`, doc comments
- **UI enhancements** — toolbar, panels, navigation
- **Translations** — the UI's languages, in `packages/udoc-ui/src/app/i18n/`
- **Accessibility** — keyboard navigation, screen reader support, ARIA attributes
- **Performance** — optimizations in the TypeScript layer
- **Node.js hosts** — udoc-node, the `udoc` command and udoc-server
- **TypeScript types** — improved type definitions and exports

### Out of Scope

The document engine, [`@docmentis/udoc-wasm`](https://www.npmjs.com/package/@docmentis/udoc-wasm), is built from a separate private repository and is **not** modifiable through this repo. If you encounter a rendering issue that appears to originate in the engine, please open an issue and we will investigate.

PRs that remove or circumvent the attribution branding will not be accepted. Branding removal is available through a [commercial license](mailto:licensing@docmentis.com).

## Code Style

- **TypeScript** — all source code is TypeScript with `strict` mode enabled.
- **ES modules** — use `import`/`export`, not `require`.
- **Formatted by Prettier** — the pre-commit hook rejects a commit whose staged files aren't; `npm run format` fixes them.
- **Package boundaries** — `udoc-ui` imports neither the viewer nor the editor, and the viewer never imports the editor; the lint config enforces both.
- **Doc comments are the API reference** — the docs site generates the reference from a public export's doc comment, so write it for the package's users.
- **Few runtime dependencies** — the browser packages depend only on each other and the engine. Avoid adding new ones unless absolutely necessary.
- **Keep it simple** — prefer straightforward code over clever abstractions.

The design of each part is in [docs/design/](docs/design/README.md).

## License

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in this repository by you, as defined in the Apache-2.0 license, shall be dual licensed under the [MIT License](LICENSE-MIT) and the [Apache License, Version 2.0](LICENSE-APACHE), without any additional terms or conditions.
