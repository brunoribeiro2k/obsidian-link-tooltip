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
attribute, so the destination must be recovered from the document text.

Goal: prepare this for submission to the **Obsidian community plugins** list.

## Layout

- `main.ts` — the plugin shell. A CodeMirror 6 `hoverTooltip` resolves the hovered
  link with `parseLinks` from `links.mjs`, gates it by the per-kind settings, and
  renders the destination in the tooltip. Also contains the settings tab. Does not
  touch the syntax tree — link detection is purely line-based.
- `links.mjs` — dependency-free link parser (`parseLinks`, `destinationToShow`).
  Scans a line for Markdown links and wikilinks and reports each one's range, literal
  destination, `kind` (external/internal), and whether it is `aliased`. Standalone so
  it can be unit-tested with `node --test` without bundling `obsidian` / `@codemirror/*`.
  Imports `isExternalUrl` from `url.mjs`.
- `url.mjs` — dependency-free external-URL scheme allowlist (`isExternalUrl`), used by
  `links.mjs` to classify a destination as external or internal. Standalone for the
  same `node --test` reason.
- `test/links.test.mjs` — `node --test` cases for `parseLinks` / `destinationToShow`:
  Markdown vs. wikilink, aliased vs. bare, image embeds skipped.
- `test/is-external-url.test.mjs` — `node --test` cases for `isExternalUrl`:
  allowed schemes vs. rejected false positives (`c:\…`, `note:`, `tel:`, …).
- `styles.css` — tooltip styling. Must stay theme-aware (see Conventions).
- `manifest.json` — Obsidian plugin manifest. Keep `version` in sync with
  `package.json` and `versions.json` (the `npm version` flow does this for you).
- `versions.json` — maps each plugin version to the `minAppVersion` it requires.
  Written automatically by `version-bump.mjs`.
- `esbuild.config.mjs` — bundles `main.ts` → `main.js` (CJS, `obsidian` and
  `@codemirror/*` externalized).
- `version-bump.mjs` — run by `npm version`; writes the new version into
  `manifest.json` and `versions.json` and stages them.
- `.npmrc` — sets `tag-version-prefix=""` so `npm version` tags without a `v`
  prefix, as the community store requires.
- `.github/workflows/release.yml` — on a pushed tag, builds and creates a draft
  GitHub release with `main.js` / `manifest.json` / `styles.css` attached. Fails
  if the tag is not exactly the `manifest.json` version (no `v` prefix).
- `scripts/deploy.mjs` — local-only: builds and copies `main.js` / `manifest.json`
  / `styles.css` into a vault's plugin folder. Not part of the release flow.
- `main.js`, `data.json`, `*.map` are gitignored build/runtime artifacts. `main.js`
  ships only as a GitHub release asset, never committed.

## Commands

- `npm run dev` — esbuild watch (inline sourcemaps).
- `npm run build` — typecheck (`tsc -noEmit -skipLibCheck`) then production bundle.
- `npm test` — run the `node --test` unit tests (`parseLinks`, `isExternalUrl`).
- `npm run deploy -- --vault "/path/to/Vault"` — build + copy into a vault for
  local testing. Also accepts `--plugin-dir`, or `OBSIDIAN_VAULT` /
  `OBSIDIAN_PLUGIN_DIR` env vars.
- `npm version <patch|minor|major>` — cut a release version: runs
  `version-bump.mjs` to sync `manifest.json` + `versions.json`, then commits and
  creates a tag with **no `v` prefix**. Push it with `git push --follow-tags` to
  trigger `release.yml`, which builds and drafts the GitHub release. Working tree
  must be clean first.

Always run `npm run build` before considering a change done — it is the typecheck
gate. Run `npm test` (`node --test`) for the `parseLinks` / `isExternalUrl` unit tests.

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
