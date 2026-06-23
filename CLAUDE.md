# CLAUDE.md

Guidance for working in this repository.

## What this is

**Link Tooltip** is an Obsidian plugin that shows the destination of a hovered link
while editing — in **Live Preview** and **source mode**. A tooltip appears for any
link that hides its destination behind a label: every Markdown link `[label](dest)`
(external URL or internal note path, shown as its literal target) and aliased
wikilinks `[[target|alias]]`. Bare links — raw autolinks and unaliased `[[Note]]` —
already show their destination as text, so they get no tooltip.

Scope decision (intentional): Reading mode is **out of scope**. Obsidian already
renders real `<a href>` elements with native browser tooltips there. This plugin
only targets the editor, where CodeMirror renders links as spans with no `href`
attribute, so the destination must be recovered from the CodeMirror syntax tree.

Goal: prepare this for submission to the **Obsidian community plugins** list.

## Layout

- `main.ts` — the plugin shell, and where link detection lives. A CodeMirror 6
  `hoverTooltip` reads `syntaxTree(view.state)`, walks the leaf style tokens of the
  hovered line, and reassembles the single link under the cursor by classifying each
  token's underscore-joined HyperMD style classes (`link`/`url` for Markdown links,
  `hmd-internal-link`/`link-alias` for wikilinks, `*code*` for code that must be
  skipped). It gates the result by the per-kind settings and renders the destination.
  Also contains the settings tab. Detection is token-driven, not line-based: the
  tokenizer has already resolved code spans/blocks, escapes, and angle-bracket
  destinations, so those cases come for free (see #33).
- `url.mjs` — dependency-free external-URL scheme allowlist (`isExternalUrl`), used by
  `main.ts` to classify a Markdown link's destination as external or internal (the
  tree marks `[[wikilinks]]` as internal but tokenizes `[](note)` and `[](https://…)`
  identically). Standalone so it can be unit-tested with `node --test` without bundling
  `obsidian` / `@codemirror/*`.
- `test/is-external-url.test.mjs` — `node --test` cases for `isExternalUrl`:
  allowed schemes vs. rejected false positives (`c:\…`, `note:`, `tel:`, …).
- `test/fixtures/vault/` — version-controlled sample notes (Markdown/wikilinks,
  aliased vs. bare, code spans/blocks, angle-bracket destinations, range edges), each
  labelled `EXPECT: TOOLTIP` / `EXPECT: NO TOOLTIP`. Token-driven detection needs a
  live editor and can't run under `node --test`, so these drive manual verification.
- `scripts/setup-test-vault.mjs` — builds the gitignored `test-vault/` from those
  fixtures, deploys the current build into it, and enables the plugin, so it opens in
  Obsidian ready to test. Run with `npm run setup-vault`.
- `styles.css` — tooltip styling. Must stay theme-aware (see Conventions).
- `manifest.json` — Obsidian plugin manifest. Keep `version` in sync with
  `package.json` and `versions.json` (the `npm version` flow does this for you).
- `versions.json` — maps each plugin version to the `minAppVersion` it requires.
  Written automatically by `version-bump.mjs`.
- `esbuild.config.mjs` — bundles `main.ts` → `main.js` (CJS, `obsidian` and
  `@codemirror/*` externalized).
- `version-bump.mjs` — run by `npm version` (invoked by `npm run release`); writes
  the new version into `manifest.json` and `versions.json` and stages them.
- `.npmrc` — sets `tag-version-prefix=""` (tags carry no `v` prefix, as the
  community store requires) and `git-tag-version=false` (so `npm version` only
  bumps files; the release workflow owns tags).
- `scripts/prepare-release.mjs` — local half of the release flow (`npm run
  release -- <patch|minor|major>`): bumps the version on a clean tree, lands it on
  a `release/<version>` branch, commits, pushes, and opens a PR to master. Never
  tags — merging the PR is what releases.
- `.github/workflows/release.yml` — runs on pushes to `master`: when
  `manifest.json`'s version has no release yet, builds, attests provenance,
  pushes the matching tag, and creates a draft GitHub release with `main.js` /
  `manifest.json` / `styles.css`. Idempotent; reports via job summary + a commit
  comment. `workflow_dispatch` is a manual fallback.
- `scripts/deploy.mjs` — local-only: builds and copies `main.js` / `manifest.json`
  / `styles.css` into a vault's plugin folder. Not part of the release flow.
- `main.js`, `data.json`, `*.map` are gitignored build/runtime artifacts. `main.js`
  ships only as a GitHub release asset, never committed.

## Commands

- `npm run dev` — esbuild watch (inline sourcemaps).
- `npm run build` — typecheck (`tsc -noEmit -skipLibCheck`) then production bundle.
- `npm test` — run the `node --test` unit tests (`isExternalUrl`).
- `npm run setup-vault` — build, then (re)generate the gitignored `test-vault/` from
  `test/fixtures/vault/` with the plugin deployed and enabled. Open it as a vault to
  verify detection (token-driven detection has no `node --test` coverage).
- `npm run deploy -- --vault "/path/to/Vault"` — build + copy into a vault for
  local testing. Also accepts `--plugin-dir`, or `OBSIDIAN_VAULT` /
  `OBSIDIAN_PLUGIN_DIR` env vars.
- `npm run release -- <patch|minor|major> [branch-description]` — cut a release.
  From a clean tree it bumps the version (syncing `manifest.json` + `versions.json`
  via `version-bump.mjs`), lands it on a `release/<version>` branch (optional
  kebab-case suffix → `release/<version>-<description>`), commits, pushes,
  and opens a PR to master. It does **not** tag. Merging the PR triggers
  `release.yml`, which tags the merged commit (no `v` prefix) and drafts the
  GitHub release. Then review the draft notes and publish.

Always run `npm run build` before considering a change done — it is the typecheck
gate. Run `npm test` (`node --test`) for the `isExternalUrl` unit tests. Because
detection is token-driven and can't be unit-tested, verify link behaviour changes in
Obsidian via `npm run setup-vault`.

## Conventions / hard rules

These reflect Obsidian community-plugin review requirements — keep them holding:

- **Theme-aware styling.** No hardcoded colors in `styles.css`; use CSS variables
  so light/dark/custom themes work.
- **Pop-out window safe.** Do not reach for the global `window` / `document`. The
  editor can live in a separate window; create, append, and position UI relative to
  the view's own window (`view.dom.ownerDocument` / `view.dom.win`).
- **Sentence case** in all UI text (settings names/descriptions, notices).
- **No `innerHTML`.** Build DOM with the Obsidian/DOM helpers (`setText`,
  `createDiv`, `addClass`, …).
- **Clean teardown.** Every listener/element created must be removed on
  `ViewPlugin.destroy()` / plugin `onunload`.
- `console.log` only behind the opt-in **Debug logging** setting.
- Keep `manifest.json` `description` concise, ending with a period, not starting
  with "This plugin", and not containing the word "Obsidian".

## Submission tracking

Readiness work is tracked as GitHub issues on this repo (labels `submission` and
`blocker`). Check open issues for the current state before starting submission work.
