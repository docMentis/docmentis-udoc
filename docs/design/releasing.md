# Releasing

The published packages (udoc-ui, udoc-viewer, udoc-editor, udoc-node,
udoc-cli and udoc-server) release together, from CI, on the engine release
they pin.

## One version

Every published package is at one version, and a release publishes them all,
changed or not. They pin each other exactly (the viewer and the editor pin
udoc-ui; the CLI and the server, udoc-node) and each pins the
`@docmentis/udoc-wasm` it is built against, so a fix to udoc-ui is already a
release of the viewer and the editor, and an engine release is a release of
every package that runs it. Versions apart would be bookkeeping with nothing
behind it. One changelog, `CHANGELOG.md` at the root, lists each release by
package.

## On the engine's minor

A release's major and minor are the engine's: 0.8.x is built on a 0.8
`@docmentis/udoc-wasm`. The patch is the packages' own, so a fix here needs no
engine release. An engine release with nothing new in it would still move the
binary's CDN URL, and every browser would fetch its 28 MB again. A move to a
new engine minor (`npm run update-engine`) makes the next release that minor's
`.0`. A breaking change here, which before 1.0 takes a minor, waits for the
engine's next minor or comes with it. Each release's changelog entry names the
engine it is built on.

## Cutting one

`npm run release -- <patch|minor|major|version>` (`scripts/release.mjs`)
checks the repo, npm and the changelog. It then sets the version, dates
`## [Unreleased]`, builds, runs the checks, commits `chore: Release <version>`,
tags `v<version>` and pushes. The tag is the release. The Release workflow
(`.github/workflows/release.yml`) runs the checks again against the engine on
npm, publishes the packages in dependency order (`scripts/publish.mjs`),
creates the GitHub Release from the changelog and deploys the docs
(`docs.yml`). A prerelease, such as 0.9.0-beta.1, goes out under the `next`
dist-tag and leaves the docs be. When a run fails part-way, run it again: it
skips a package already on npm.

## Only from CI

Nothing is published by hand. npm takes a publish of these packages only from
the Release workflow (trusted publishing, with provenance). Only that build is
sure to run the engine the packages pin: here, `scripts/link-engine.mjs` may
have linked in an engine checkout with unreleased changes under the last
release's version. The workers would bundle that glue beside the released
binary they fetch.

## A new package

npm sets up trusted publishing only for a package it already has. So a newly
published package goes out once by hand, as a placeholder `0.0.0-stage`
published from a directory that holds only its `package.json`, before its
first release. Then, in its settings on npmjs.com, add a trusted publisher
(GitHub Actions, `docMentis/docmentis-udoc`, workflow `release.yml`), and set
its publishing access to require two-factor authentication and disallow
tokens. Its manifest needs `repository` naming this repo, which provenance
checks, and `publishConfig.access: "public"`.
