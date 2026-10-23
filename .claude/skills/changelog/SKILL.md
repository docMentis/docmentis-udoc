---
name: changelog
description: Collect the changes since the last release — this repo's commits, and the engine's across the releases the udoc-wasm pin moved over — and write them into CHANGELOG.md's [Unreleased] section, by package, as a user of the packages sees them. Use before a release, or when asked to update the changelog.
---

# Update the changelog

Write what changed since the last release into the `## [Unreleased]` section
of `CHANGELOG.md`. `$ARGUMENTS`, when given, is a git ref to collect from in
place of the last release tag.

## Confidentiality: read first, it applies to every entry

This repo and its changelog are public. The engine is not: it is developed in
the private `../docmentis-udoc-engine` with private dependency repos of its
own. For a change that comes from any of them:

- Describe what a user of the packages sees: the problem fixed, the format or
  feature gained. "A PDF whose fonts are embedded twice renders its text once",
  never the code that changed.
- Never name a private repo, crate, module, file or function, or quote an
  engine commit message, even rephrased closely.
- When in doubt, describe the symptom, not the fix.

This repo's own commits are public, and an entry for one may name the public
API it changes: an option, a method, an event.

## 1. The range

- The last release is the newest `v*` tag: `git describe --tags --match 'v*' --abbrev=0`.
  Collect from it (or `$ARGUMENTS`) to `HEAD`. With no commits since, say so and stop.
- The engine pin is `@docmentis/udoc-wasm` in `packages/udoc-ui/package.json`.
  Read it at the tag (`git show <tag>:packages/udoc-ui/package.json`) and at
  `HEAD`. When they differ, the engine moved from release `<old>` to `<new>`.

## 2. This repo's commits

`git log <tag>..HEAD`, reading each commit's body as well as its subject.

- `feat` and `fix` are the candidates, and a `refactor` or `perf` whose effect
  a user sees. Skip `chore`, `docs`, `test`, and the `demo`, `docs` and
  `examples` scopes, but for an engine update (`chore: Build on udoc-wasm …`),
  which step 3 covers.
- The scope names the package: `viewer`, `editor`, `node`, `cli`, `server`.
  A `ui` change reaches users through the viewer and the editor, so it is
  theirs, as they show it.

## 3. The engine's commits

Only when the pin moved, and only from the engine checkout beside this one;
without it, say the engine's changes weren't collected, and write this repo's.

- `git -C ../docmentis-udoc-engine log udoc-wasm-v<old>..udoc-wasm-v<new>`.
- Each engine release commit (`git log -1 udoc-wasm-v<version>`) lists the
  dependency repos it was built with and their commits. For each one listed in
  both releases, `git -C ../<repo> log <old-commit>..<new-commit>`.
- `feat` and `fix` are the candidates, and a `perf` a user feels. They reach
  users through every package that runs the engine.

## 4. The entries

Read the last released section first, and write in its voice: plain, short,
what changed for the user, one change a line.

- Under `## [Unreleased]`, a `### <package>` heading for each package with
  something to say, in the order udoc-viewer, udoc-editor, udoc-ui, udoc-node,
  udoc-cli, udoc-server. A change two packages show alike goes under one
  heading naming both (`### udoc-viewer and udoc-editor`), and an engine change
  every package shows (how a document renders, opens or saves) under
  `### All packages`, first.
- Under each, `#### Added`, `#### Changed`, `#### Removed`, `#### Fixed`, in
  that order, leaving out the empty ones. Choose by what the user gets, not the
  commit's type: an engine `feat` may be a fix to them, and a `refactor` with
  nothing to see is no entry at all.
- Rewrite, don't copy: no prefixes, no scopes, no hashes. Fold small related
  changes into one line.
- Don't write the "Built on `@docmentis/udoc-wasm` …" line: `npm run release`
  adds it when it dates the section.

## 5. Write it

- `[Unreleased]` runs from its heading to the next `## [`. Keep the entries
  already there, written by hand as changes landed: add what they miss, fold
  duplicates together, and leave their wording be.
- Edit `CHANGELOG.md` in place, run `npx prettier --write CHANGELOG.md`, and
  don't commit: show what was added, by package, for review, and say which
  commits you left out as having nothing for a user to see.
